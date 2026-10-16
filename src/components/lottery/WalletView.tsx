import React, { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  Search, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Ticket as TicketIcon,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Camera,
  X,
  Eye
} from 'lucide-react';
import { Language, Transaction, UserProfile } from '../../types/lottery';
import { formatEthiopianDate } from '../../utils/lotteryUtils';

interface WalletViewProps {
  user: UserProfile;
  transactions: Transaction[];
  lang: Language;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  triggerHaptic?: (style: 'light' | 'medium' | 'heavy') => void;
  playNotificationSound?: (type: 'click' | 'win' | 'alert') => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  user,
  transactions,
  lang,
  onOpenDeposit,
  onOpenWithdraw,
  triggerHaptic,
  playNotificationSound,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'ticket_purchase'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);

  const handleCopy = (text: string, keyId: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(keyId);
    triggerHaptic?.('light');
    playNotificationSound?.('click');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const totalDeposits = transactions
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalTicketSpend = transactions
    .filter(t => t.type === 'ticket_purchase' && t.status === 'completed')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchRef = t.referenceNumber?.toLowerCase().includes(q);
      const matchAmount = String(t.amount).includes(q);
      const matchTitle = t.lotteryTitleAm?.toLowerCase().includes(q);
      const matchPhone = t.userPhone?.includes(q);
      return matchRef || matchAmount || matchTitle || matchPhone;
    }
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold shadow-inner shrink-0">
              <Wallet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>{lang === 'am' ? 'ዋሌት' : 'Digital Wallet'}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {lang === 'am' ? '' : ''}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'am' ? '' : 'Income & Expense Ledger'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{user.phone || '0910961881'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-5">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              {lang === 'am' ? '' : ''}
            </span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-sans tabular-nums mt-1.5 flex items-baseline gap-2">
              <span>{user.walletBalance.toLocaleString()}</span>
              <span className="text-lg sm:text-xl text-emerald-300 font-sans font-bold">ብር (ETB)</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <span className="text-white font-bold">{user.fullName && user.fullName !== 'ተጠቃሚ' ? user.fullName : 'ማክቤል ማረጉ'}</span>
              <span>•</span>
              <span className="text-emerald-400 font-mono">{user.phone || '0910961881'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                onOpenDeposit();
                triggerHaptic?.('medium');
                playNotificationSound?.('click');
              }}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{lang === 'am' ? '💵 ገቢ አድርግ' : 'Deposit'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenWithdraw();
                triggerHaptic?.('medium');
                playNotificationSound?.('click');
              }}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[3]" />
              <span>{lang === 'am' ? '💸 ገንዘብ አውጣ' : 'Withdraw'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold">{lang === 'am' ? 'ጠቅላላ ገቢ' : 'Total Deposits'}</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-black text-emerald-400 font-sans tabular-nums mt-1">
              +{totalDeposits.toLocaleString()} ብር
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-2xl border border-amber-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold">{lang === 'am' ? 'ጠቅላላ ወጪ' : 'Total Withdrawals'}</span>
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-black text-amber-400 font-sans tabular-nums mt-1">
              -{totalWithdrawals.toLocaleString()} ብር
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold">{lang === 'am' ? 'የቲኬት ግዢ' : 'Ticket Spend'}</span>
              <TicketIcon className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-sm font-black text-teal-300 font-sans tabular-nums mt-1">
              {totalTicketSpend.toLocaleString()} ብር
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-2xl border border-amber-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold">{lang === 'am' ? 'ያሸነፉት ሽልማት' : 'Total Won'}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-black text-amber-400 font-sans tabular-nums mt-1">
              {user.totalWon.toLocaleString()} ብር
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <span>🏦</span>
            <span>{lang === 'am' ? 'ገቢ' : 'Official Deposit Accounts:'}</span>
          </span>
          <span className="text-[10px] text-slate-500">
            {lang === 'am' ? '' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition">
            <div>
              <div className="text-[10px] text-slate-400">📱 ቴሌብር (Makbel Maregu)</div>
              <div className="font-mono font-bold text-xs text-emerald-400">0910961881</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('0910961881', 'tlb_acc')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 transition active:scale-95"
            >
              {copiedKey === 'tlb_acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'tlb_acc' ? 'ኮፒ ሆኗል' : 'ኮፒ'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-sky-500/40 transition">
            <div>
              <div className="text-[10px] text-slate-400">🏦 ሲቢኢ / CBE (Makbel Mareguu)</div>
              <div className="font-mono font-bold text-xs text-sky-400">1000321337124</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('1000321337124', 'cbe_acc')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 transition active:scale-95"
            >
              {copiedKey === 'cbe_acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'cbe_acc' ? 'ኮፒ ሆኗል' : 'ኮፒ'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>{lang === 'am' ? 'የገቢ እና ወጪ ዝርዝር' : 'Income & Expense Ledger'}</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {filteredTransactions.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'am' ? '' : ''}
              </p>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'am' ? '' : ''}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'deposit', label: lang === 'am' ? '⬇️ ገቢ' : 'Deposits' },
              { id: 'withdrawal', label: lang === 'am' ? '⬆️ ወጪ' : 'Withdrawals' },
              { id: 'ticket_purchase', label: lang === 'am' ? '🎟️ የኔ ትኬት' : 'Ticket Purchases' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilterType(tab.id as any);
                  triggerHaptic?.('light');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition active:scale-95 ${
                  filterType === tab.id
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-300">
              {lang === 'am' ? 'ምንም አይነት የተመዘገበ ግብይት አልተገኘም' : 'No transactions found'}
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {lang === 'am' 
                ? 'ገቢ ለማድረግ ከላይ "ገቢ አድርግ" የሚለውን ይጫኑ' 
                : 'Tap Deposit above to add funds to your wallet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((tx) => {
              const isDeposit = tx.type === 'deposit';
              const isWithdrawal = tx.type === 'withdrawal';
              const isTicket = tx.type === 'ticket_purchase';

              const isCompleted = tx.status === 'completed';
              const isPending = tx.status === 'pending';
              const isFailed = tx.status === 'failed';

              return (
                <div
                  key={tx.id}
                  className="p-3.5 bg-slate-950/90 rounded-2xl border border-slate-800/90 hover:border-slate-700 transition flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isDeposit 
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                        : isWithdrawal
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-teal-500/15 border-teal-500/30 text-teal-400'
                    }`}>
                      {isDeposit && <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />}
                      {isWithdrawal && <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />}
                      {isTicket && <TicketIcon className="w-4 h-4 stroke-[2]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="font-black text-white truncate text-xs sm:text-sm">
                        {isDeposit && (lang === 'am' ? 'የዋሌት ገቢ' : 'Wallet Deposit')}
                        {isWithdrawal && (lang === 'am' ? 'ገንዘብ ማውጫ (ወጪ)' : 'Wallet Withdrawal')}
                        {isTicket && (lang === 'am' ? (tx.lotteryTitleAm || 'የቲኬት ግዢ') : 'Ticket Purchase')}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span className="truncate">
                          {tx.referenceNumber || 'TX-REF'}
                        </span>
                        {tx.referenceNumber && (
                          <button
                            type="button"
                            onClick={() => handleCopy(tx.referenceNumber, tx.id)}
                            className="text-slate-500 hover:text-white"
                            title="Copy reference"
                          >
                            {copiedKey === tx.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        <span>•</span>
                        <span>{formatEthiopianDate(tx.timestamp)}</span>
                        {tx.screenshotUrl && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setViewingScreenshot(tx.screenshotUrl!)}
                              className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 text-[10px]"
                              title="ስክሪን ሹት እይ"
                            >
                              <Camera className="w-3 h-3" />
                              <span>{lang === 'am' ? 'ስክሪን ሹት' : 'Screenshot'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-mono font-black text-xs sm:text-sm ${
                      isDeposit 
                        ? 'text-emerald-400' 
                        : isWithdrawal 
                        ? 'text-amber-400' 
                        : 'text-slate-300'
                    }`}>
                      {isDeposit ? '+' : '-'}{tx.amount.toLocaleString()} ብር
                    </div>

                    <div className="mt-0.5">
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>{lang === 'am' ? 'ተፈፅሟል' : 'Completed'}</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{lang === 'am' ? 'በመጠባበቅ ላይ' : 'Pending'}</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span>{lang === 'am' ? 'ውድቅ ተደርጓል' : 'Failed'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 📸 Screenshot Viewer Modal */}
      {viewingScreenshot && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setViewingScreenshot(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>{lang === 'am' ? 'የክፍያ ስክሪን ሹት ማረጋገጫ' : 'Payment Screenshot Receipt'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setViewingScreenshot(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black max-h-[70vh] flex items-center justify-center border border-slate-800">
              <img
                src={viewingScreenshot}
                alt="Receipt Full Preview"
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewingScreenshot(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                {lang === 'am' ? 'ዝጋ' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
