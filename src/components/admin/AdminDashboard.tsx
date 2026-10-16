import React, { useState } from 'react';
import { 
  Ticket as TicketIcon, 
  DollarSign, 
  Search, 
  Plus, 
  CheckCircle2, 
  Trophy, 
  X,
  ArrowLeft,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Package,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { Language, LotteryDraw, Ticket, Transaction } from '../../types/lottery';
import { formatETB, formatEthiopianDate, generateLuckyNumber, playNotificationSound, triggerConfetti } from '../../utils/lotteryUtils';
import { triggerHaptic } from '../../utils/telegram';
import { getBanknoteForLottery } from '../../assets/banknotes';

interface AdminDashboardProps {
  lang: Language;
  lotteries: LotteryDraw[];
  tickets: Ticket[];
  transactions: Transaction[];
  onAddLottery: (newLottery: LotteryDraw) => void;
  onExecuteDraw: (lotteryId: string, winningNumbers: { firstPrize: string; secondPrize: string; thirdPrize: string; consolationSuffix: string }) => void;
  onBroadcastNotification?: (messageAm: string, messageEn: string) => void;
  onApproveDeposit?: (txId: string) => void;
  onRejectDeposit?: (txId: string) => void;
  onApproveWithdrawal?: (txId: string) => void;
  onRejectWithdrawal?: (txId: string) => void;
  onBack?: () => void;
}

const CANONICAL_ADMIN_LOTTERIES: Array<{
  id: string;
  titleAm: string;
  titleEn: string;
  code: string;
  ticketPrice: number;
  jackpotAmount: number;
}> = [
  { id: 'lot_derash_1000', titleAm: 'ባለ 1,000 ብር ደራሽ', titleEn: 'Bale 1,000 ETB Derash', code: 'DERASH-1K', ticketPrice: 10, jackpotAmount: 1000 },
  { id: 'lot_derash_5000', titleAm: 'ባለ 5,000 ብር ደራሽ', titleEn: 'Bale 5,000 ETB Derash', code: 'DERASH-5K', ticketPrice: 50, jackpotAmount: 5000 },
  { id: 'lot_derash_10000', titleAm: 'ባለ 10,000 ብር ደራሽ', titleEn: 'Bale 10,000 ETB Derash', code: 'DERASH-10K', ticketPrice: 100, jackpotAmount: 10000 },
  { id: 'lot_derash_20000', titleAm: 'ባለ 20,000 ብር ደራሽ', titleEn: 'Bale 20,000 ETB Derash', code: 'DERASH-20K', ticketPrice: 200, jackpotAmount: 20000 },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  lang,
  lotteries,
  tickets,
  transactions,
  onAddLottery,
  onExecuteDraw,
  onApproveDeposit,
  onRejectDeposit,
  onApproveWithdrawal,
  onRejectWithdrawal,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'tickets' | 'draw' | 'inventories'>('transactions');
  
  const activeLotteryList: LotteryDraw[] = CANONICAL_ADMIN_LOTTERIES.map((config) => {
    const found = lotteries.find(
      l => l.status === 'active' && (l.id === config.id || l.ticketPrice === config.ticketPrice)
    );
    if (found) {
      return {
        ...found,
        totalInventory: 200,
        round: found.round || 1,
      };
    }
    const completedList = lotteries.filter(
      l => (l.id.includes(config.id) || l.ticketPrice === config.ticketPrice) && (l.status === 'completed' || !!l.winningNumbers)
    );
    const maxCompletedRound = completedList.reduce((max, l) => Math.max(max, l.round || 1), 0);
    const nextRound = maxCompletedRound > 0 ? maxCompletedRound + 1 : 1;

    return {
      id: config.id,
      titleAm: config.titleAm,
      titleEn: config.titleEn,
      code: config.code,
      category: 'instant' as const,
      bannerUrl: getBanknoteForLottery(config.ticketPrice),
      ticketPrice: config.ticketPrice,
      totalInventory: 200,
      ticketsSold: 0,
      round: nextRound,
      jackpotAmount: config.jackpotAmount,
      drawDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'active' as const,
      prizes: [
        { rank: 1, titleAm: 'የዕድል ሽልማት', titleEn: 'Jackpot Prize', amount: config.jackpotAmount, winnersCount: 1 },
      ],
    };
  });

  const [selectedDrawTabLotteryId, setSelectedDrawTabLotteryId] = useState<string>(activeLotteryList[0]?.id || '');
  const [tabDrawRolling, setTabDrawRolling] = useState(false);
  const [tabFirstPrize, setTabFirstPrize] = useState('');
  const [tabSecondPrize, setTabSecondPrize] = useState('');
  const [tabThirdPrize, setTabThirdPrize] = useState('');
  const [tabDrawSuccessMsg, setTabDrawSuccessMsg] = useState<string | null>(null);

  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'pending' | 'deposit' | 'withdrawal'>('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [isAddLotteryOpen, setIsAddLotteryOpen] = useState(false);
  const [newTitleAm, setNewTitleAm] = useState('');
  const [newPrice, setNewPrice] = useState('50');
  const [newJackpot, setNewJackpot] = useState('5000');

  const pendingApprovals = transactions.filter(t => t.status === 'pending');

  const filteredTickets = tickets.filter(tk => {
    if (!ticketSearchQuery.trim()) return true;
    const q = ticketSearchQuery.trim().toLowerCase();
    return (
      tk.ticketNumber.toLowerCase().includes(q) ||
      tk.userName.toLowerCase().includes(q) ||
      tk.userPhone.includes(q) ||
      tk.lotteryTitleAm.toLowerCase().includes(q)
    );
  });

  const filteredTransactions = transactions.filter(tx => {
    if (txTypeFilter === 'pending' && tx.status !== 'pending') return false;
    if (txTypeFilter === 'deposit' && tx.type !== 'deposit') return false;
    if (txTypeFilter === 'withdrawal' && tx.type !== 'withdrawal') return false;

    if (txSearchQuery.trim()) {
      const q = txSearchQuery.trim().toLowerCase();
      return (
        tx.referenceNumber.toLowerCase().includes(q) ||
        tx.userName.toLowerCase().includes(q) ||
        tx.userPhone.includes(q) ||
        String(tx.amount).includes(q)
      );
    }
    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(id);
    triggerHaptic('light');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateLottery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleAm) return;

    const newDraw: LotteryDraw = {
      id: 'lot_' + Date.now(),
      titleAm: newTitleAm,
      titleEn: newTitleAm,
      code: 'DERASH-' + Math.floor(100 + Math.random() * 900),
      category: 'digital',
      bannerUrl: getBanknoteForLottery(parseFloat(newPrice) || 50),
      ticketPrice: parseFloat(newPrice) || 50,
      totalInventory: 200,
      ticketsSold: 0,
      round: 1,
      jackpotAmount: parseFloat(newJackpot) || 5000,
      drawDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'active',
      prizes: [
        { rank: 1, titleAm: 'የዕድል ሽልማት', titleEn: 'Jackpot Prize', amount: parseFloat(newJackpot) || 5000, winnersCount: 1 },
      ],
      provablyFairSeed: '0x' + Math.random().toString(16).substring(2, 18),
    };

    onAddLottery(newDraw);
    setIsAddLotteryOpen(false);
    setNewTitleAm('');
    playNotificationSound('success');
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg mx-auto p-3 sm:p-4 space-y-4 pb-28 text-slate-100">
      
      {/* 1. Mobile Header with Back Button */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                playNotificationSound('click');
                onBack();
              }}
              title={lang === 'am' ? 'ወደ መነሻ ተመለስ' : 'Back to Home'}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-teal-400 border border-slate-800 transition active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-black text-white flex items-center gap-1.5 truncate">
              <span>👑 የአስተዳዳሪ ክፍል (Admin)</span>
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              ዋና አስተዳዳሪ፦ 0910961881 (ማክቤል)
            </p>
          </div>
        </div>

        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-xl font-bold shrink-0">
          ኦንላይን ✓
        </span>
      </div>

      {/* 2. Top Segmented Mobile Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs shadow-md">
        <button
          type="button"
          onClick={() => {
            setActiveTab('transactions');
            triggerHaptic('light');
          }}
          className={`py-2 px-1 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5 relative ${
            activeTab === 'transactions'
              ? 'bg-emerald-600 text-white shadow font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span className="text-[10px] leading-tight">ክፍያዎች</span>
          {pendingApprovals.length > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full shadow">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('tickets');
            triggerHaptic('light');
          }}
          className={`py-2 px-1 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5 ${
            activeTab === 'tickets'
              ? 'bg-emerald-600 text-white shadow font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <TicketIcon className="w-4 h-4" />
          <span className="text-[10px] leading-tight">ቲኬቶች</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('draw');
            triggerHaptic('light');
          }}
          className={`py-2 px-1 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5 ${
            activeTab === 'draw'
              ? 'bg-amber-600 text-white shadow font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="text-[10px] leading-tight">ዕጣ አውጣ</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('inventories');
            triggerHaptic('light');
          }}
          className={`py-2 px-1 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5 ${
            activeTab === 'inventories'
              ? 'bg-emerald-600 text-white shadow font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="text-[10px] leading-tight">ክምችት</span>
        </button>
      </div>

      {/* 3. TAB 1: 💳 ክፍያዎችና ማጽደቂያዎች (Transactions & Pending Approvals) */}
      {activeTab === 'transactions' && (
        <div className="space-y-3.5">
          {/* Pending Approvals Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-sm font-black text-white">
                  {lang === 'am' ? 'ውሳኔ የሚጠብቁ ክፍያዎች' : 'Pending Approvals'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {pendingApprovals.length} {lang === 'am' ? 'ጥያቄዎች' : 'Pending'}
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center text-xs text-slate-400 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto opacity-70" />
                <div className="font-semibold text-slate-300">
                  {lang === 'am' ? 'በአሁኑ ሰዓት ማጽደቂያ የሚጠብቅ ክፍያ የለም' : 'No pending payments at this moment'}
                </div>
                <p className="text-[11px] text-slate-500">
                  {lang === 'am' ? 'ደንበኞች ገቢ ወይም ወጪ ሲያደርጉ እዚህ በቀጥታ ይመጣል' : 'Incoming deposits and withdrawals will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingApprovals.map((tx) => {
                  const isDeposit = tx.type === 'deposit';
                  return (
                    <div
                      key={tx.id}
                      className="bg-slate-950 border-2 border-amber-500/40 rounded-2xl p-3.5 space-y-3 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isDeposit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {isDeposit ? '📥 የዋሌት ገቢ' : '📤 የብር ማውጫ (ወጪ)'}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1 truncate">
                            {tx.userName || 'ተጠቃሚ'}
                          </h4>
                          <div className="text-xs text-teal-400 font-mono">
                            📞 {tx.userPhone}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-emerald-400 font-sans tabular-nums">
                            {formatETB(tx.amount)}
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {tx.paymentMethod}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 text-[11px]">ሪፈረንስ፦</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{tx.referenceNumber}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(tx.referenceNumber, tx.id)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            {copiedKey === tx.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Big mobile action buttons side by side */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (isDeposit && onApproveDeposit) onApproveDeposit(tx.id);
                            if (!isDeposit && onApproveWithdrawal) onApproveWithdrawal(tx.id);
                            triggerHaptic('medium');
                            playNotificationSound('win');
                          }}
                          className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>{lang === 'am' ? 'አጽድቅ' : 'Approve'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isDeposit && onRejectDeposit) onRejectDeposit(tx.id);
                            if (!isDeposit && onRejectWithdrawal) onRejectWithdrawal(tx.id);
                            triggerHaptic('light');
                            playNotificationSound('alert');
                          }}
                          className="py-2.5 px-3 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>{lang === 'am' ? 'ውድቅ አድርግ' : 'Reject'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All Transactions Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white">
                {lang === 'am' ? 'የግብይቶች መዝገብ' : 'Transaction History'}
              </h3>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('all')}
                  className={`px-2 py-0.5 rounded-lg font-bold ${txTypeFilter === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                >
                  ሁሉም
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('deposit')}
                  className={`px-2 py-0.5 rounded-lg font-bold ${txTypeFilter === 'deposit' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                >
                  ገቢ
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('withdrawal')}
                  className={`px-2 py-0.5 rounded-lg font-bold ${txTypeFilter === 'withdrawal' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                >
                  ወጪ
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                placeholder="በስም፣ ስልክ ወይም ሪፈረንስ ፈልግ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Mobile Card List */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                ምንም ግብይት አልተገኘም
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredTransactions.map((tx) => {
                  const isDep = tx.type === 'deposit';
                  const isWth = tx.type === 'withdrawal';
                  return (
                    <div
                      key={tx.id}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isDep ? 'bg-emerald-500/15 text-emerald-400' : isWth ? 'bg-amber-500/15 text-amber-400' : 'bg-teal-500/15 text-teal-400'
                        }`}>
                          {isDep ? <ArrowDownLeft className="w-4 h-4" /> : isWth ? <ArrowUpRight className="w-4 h-4" /> : <TicketIcon className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white text-xs truncate">
                            {tx.userName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {tx.userPhone} • {tx.referenceNumber}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`font-mono font-bold text-xs ${isDep ? 'text-emerald-400' : isWth ? 'text-amber-400' : 'text-slate-300'}`}>
                          {isDep ? '+' : '-'}{tx.amount.toLocaleString()} ብር
                        </div>
                        <span className={`text-[9px] font-bold ${
                          tx.status === 'completed' ? 'text-emerald-400' : tx.status === 'pending' ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {tx.status === 'completed' ? '✅ ጸድቋል' : tx.status === 'pending' ? '⏳ በመጠባበቅ ላይ' : '❌ ውድቅ'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: 🎟️ የተቆረጡ ቲኬቶች (Sold Tickets Mobile Cards) */}
      {activeTab === 'tickets' && (
        <div className="space-y-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🎟️ የተቆረጡ የሎተሪ ቲኬቶች</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-slate-950 font-mono">
                {tickets.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ticketSearchQuery}
                onChange={(e) => setTicketSearchQuery(e.target.value)}
                placeholder="በቲኬት ቁጥር፣ ስም ወይም ስልክ ፈልግ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {filteredTickets.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80">
                ምንም የተገኘ ቲኬት የለም
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredTickets.map((tk) => (
                  <div
                    key={tk.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="px-2.5 py-1.5 bg-slate-900 border border-amber-500/40 rounded-xl text-center shrink-0">
                        <span className="text-[9px] text-slate-400 block font-semibold">ቲኬት</span>
                        <span className="text-sm font-black text-amber-300 font-mono">#{tk.ticketNumber}</span>
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-xs truncate">
                          {tk.userName}
                        </h4>
                        <div className="text-[10px] text-teal-400 font-mono">
                          📞 {tk.userPhone}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {tk.lotteryTitleAm}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-emerald-400 font-mono">
                        {tk.pricePaid} ብር
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        tk.status === 'won' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {tk.status === 'won' ? '🏆 አሸናፊ' : 'ንቁ'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 3: 🎲 ዕጣ ማውጫ (Draw Studio Mobile) */}
      {activeTab === 'draw' && (
        <div className="space-y-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-4">
            {tabDrawSuccessMsg && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{tabDrawSuccessMsg}</span>
              </div>
            )}

            {/* Lottery Selector Grid (2x2 on mobile) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase block">
                1. ዕጣ የሚወጣለትን ሎተሪ ይምረጡ፦
              </label>
              <div className="grid grid-cols-2 gap-2">
                {activeLotteryList.map((lot) => {
                  const isSelected = (selectedDrawTabLotteryId || activeLotteryList[0]?.id) === lot.id;
                  return (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => {
                        setSelectedDrawTabLotteryId(lot.id);
                        setTabFirstPrize('');
                        setTabSecondPrize('');
                        setTabThirdPrize('');
                        setTabDrawSuccessMsg(null);
                        triggerHaptic('light');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="font-bold text-white text-xs truncate">{lot.titleAm}</div>
                      <div className="text-amber-400 font-bold text-[11px] font-mono mt-0.5">
                        {formatETB(lot.jackpotAmount)}
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between mt-0.5">
                        <span>{lot.ticketPrice} ብር</span>
                        <span className="text-emerald-400 font-bold">ዙር {lot.round || 1}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rolling Machine */}
            {(() => {
              const currentSelected = activeLotteryList.find(
                l => l.id === (selectedDrawTabLotteryId || activeLotteryList[0]?.id)
              );
              if (!currentSelected) return null;

              const handleRollNumbers = () => {
                setTabDrawRolling(true);
                setTabDrawSuccessMsg(null);
                playNotificationSound('click');
                let count = 0;
                const interval = setInterval(() => {
                  setTabFirstPrize(generateLuckyNumber());
                  setTabSecondPrize(generateLuckyNumber());
                  setTabThirdPrize(generateLuckyNumber());
                  count++;
                  if (count > 20) {
                    clearInterval(interval);
                    const final1 = generateLuckyNumber();
                    const final2 = generateLuckyNumber();
                    const final3 = generateLuckyNumber();
                    setTabFirstPrize(final1);
                    setTabSecondPrize(final2);
                    setTabThirdPrize(final3);
                    setTabDrawRolling(false);
                    playNotificationSound('win');
                    triggerConfetti();
                  }
                }, 75);
              };

              const handlePublish = () => {
                if (!tabFirstPrize || tabDrawRolling) return;
                const consolation = tabFirstPrize.slice(3);
                onExecuteDraw(currentSelected.id, {
                  firstPrize: tabFirstPrize,
                  secondPrize: tabSecondPrize || generateLuckyNumber(),
                  thirdPrize: tabThirdPrize || generateLuckyNumber(),
                  consolationSuffix: consolation,
                });
                triggerHaptic('medium');
                playNotificationSound('win');
                triggerConfetti();
                setTabDrawSuccessMsg(`🎉 የ "${currentSelected.titleAm} (ዙር ${currentSelected.round || 1})" ዕጣ በይፋ ወጥቷል! አሸናፊው ተመዝግቧል።`);
                setTabFirstPrize('');
                setTabSecondPrize('');
                setTabThirdPrize('');
              };

              return (
                <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-3 text-center">
                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                    <span className="font-bold text-white">{currentSelected.titleAm}</span>
                    <span className="text-emerald-400 font-bold font-mono">{formatETB(currentSelected.jackpotAmount)}</span>
                  </div>

                  {/* Drum */}
                  <div className="py-2">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                      አሸናፊ የዕጣ ቁጥር
                    </span>
                    <div className={`text-4xl sm:text-5xl font-black font-mono tracking-widest my-1 ${
                      tabDrawRolling ? 'text-emerald-400 animate-pulse' : tabFirstPrize ? 'text-amber-400' : 'text-slate-600'
                    }`}>
                      #{tabFirstPrize || '------'}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={tabDrawRolling}
                      onClick={handleRollNumbers}
                      className="py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs transition active:scale-95 shadow disabled:opacity-50"
                    >
                      {tabDrawRolling ? 'ዕጣ እየወጣ ነው...' : tabFirstPrize ? 'ዳግም አውጣ' : '🎲 ዕጣ አውጣ'}
                    </button>

                    <button
                      type="button"
                      disabled={!tabFirstPrize || tabDrawRolling}
                      onClick={handlePublish}
                      className="py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black rounded-xl text-xs transition active:scale-95 shadow"
                    >
                      ✅ በይፋ መዝግብ
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Drawn Winners List (የወጡ አሸናፊዎች) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>የወጡ አሸናፊዎች መዝገብ</span>
              </h3>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                {lotteries.filter(l => l.status === 'completed' || !!l.winningNumbers).length} አሸናፊዎች
              </span>
            </div>

            {lotteries.filter(l => l.status === 'completed' || !!l.winningNumbers).length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80">
                እስካሁን የወጣ አሸናፊ የለም። ከላይ ባለው ማሽን ዕጣ ሲያወጡ እዚህ ይመዘገባል።
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {lotteries
                  .filter(l => l.status === 'completed' || !!l.winningNumbers)
                  .map((d) => {
                    const winnerTicket = tickets.find(t => t.ticketNumber === d.winningNumbers?.firstPrize);
                    const winner = d.winnerDetails?.firstPrizeWinner || (winnerTicket ? {
                      name: winnerTicket.userName,
                      phone: winnerTicket.userPhone,
                      ticketNumber: winnerTicket.ticketNumber,
                    } : null);

                    return (
                      <div
                        key={d.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-xs">{d.titleAm}</span>
                            <span className="text-[10px] text-amber-300 font-mono">ዙር {d.round || 1}</span>
                          </div>
                          <div className="font-mono font-black text-yellow-400 text-sm mt-0.5">
                            #{d.winningNumbers?.firstPrize}
                          </div>
                          <div className="text-[10px] text-teal-400 font-mono mt-0.5">
                            👤 {winner?.name || 'ደንበኛ'} ({winner?.phone || '0910961881'})
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-emerald-400 text-xs font-mono">
                            {formatETB(d.jackpotAmount)}
                          </div>
                          <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                            {formatEthiopianDate(d.drawDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 4: 📦 የቲኬት ክምችት (Inventories) */}
      {activeTab === 'inventories' && (
        <div className="space-y-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">የሎተሪ ክምችቶችና ኮታ</h3>
                <p className="text-[11px] text-slate-400">የ 200 ቲኬቶች ዙር አስተዳደር</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLotteryOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>አዲስ ፍጠር</span>
              </button>
            </div>

            <div className="space-y-3">
              {lotteries.filter(l => l.status === 'active').map((lot) => {
                const sold = lot.ticketsSold || 0;
                const pct = Math.round((sold / 200) * 100);
                return (
                  <div
                    key={lot.id}
                    className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">{lot.titleAm}</span>
                        <span className="text-[10px] text-amber-300 font-mono">ዙር {lot.round || 1}</span>
                      </div>
                      <span className="text-emerald-400 font-mono font-bold text-xs">
                        {formatETB(lot.jackpotAmount)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>የተሸጠ፦ <strong className="text-white font-mono">{sold} / 200</strong></span>
                        <span className="font-mono text-emerald-400">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all"
                          style={{ width: `${Math.max(5, Math.min(100, pct))}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDrawTabLotteryId(lot.id);
                        setActiveTab('draw');
                        triggerHaptic('light');
                      }}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
                    >
                      🎲 ዕጣ አውጣ
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New Lottery Modal */}
      {isAddLotteryOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-white text-sm">አዲስ የሎተሪ ዕጣ መፍጠሪያ</h3>
              <button onClick={() => setIsAddLotteryOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLottery} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">የሎተሪ ስም (ለምሳሌ፦ ልዩ ደራሽ)</label>
                <input
                  type="text"
                  required
                  value={newTitleAm}
                  onChange={(e) => setNewTitleAm(e.target.value)}
                  placeholder="ባለ 5,000 ብር ደራሽ"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">የቲኬት ዋጋ (ብር)</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ጃክፖት ሽልማት (ብር)</label>
                  <input
                    type="number"
                    required
                    value={newJackpot}
                    onChange={(e) => setNewJackpot(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-emerald-400 font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddLotteryOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  ሰርዝ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl"
                >
                  ዕጣውን ይፋ አድርግ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Mobile Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.7)] pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        <div className="max-w-md mx-auto px-2 py-1.5 grid grid-cols-4 gap-1 text-center">
          <button
            type="button"
            onClick={() => {
              setActiveTab('transactions');
              triggerHaptic('light');
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition min-h-[44px] ${
              activeTab === 'transactions' ? 'text-emerald-400 bg-emerald-500/15 font-black' : 'text-slate-400'
            }`}
          >
            <DollarSign className="w-4 h-4 mx-auto" />
            <span className="text-[10px] mt-0.5 leading-none">ክፍያዎች</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('tickets');
              triggerHaptic('light');
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition min-h-[44px] ${
              activeTab === 'tickets' ? 'text-emerald-400 bg-emerald-500/15 font-black' : 'text-slate-400'
            }`}
          >
            <TicketIcon className="w-4 h-4 mx-auto" />
            <span className="text-[10px] mt-0.5 leading-none">ቲኬቶች</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('draw');
              triggerHaptic('light');
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition min-h-[44px] ${
              activeTab === 'draw' ? 'text-amber-400 bg-amber-500/15 font-black' : 'text-slate-400'
            }`}
          >
            <Trophy className="w-4 h-4 mx-auto" />
            <span className="text-[10px] mt-0.5 leading-none">ዕጣ አውጣ</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                playNotificationSound('click');
                onBack();
              }}
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-teal-400 hover:bg-teal-500/10 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4 mx-auto" />
              <span className="text-[10px] mt-0.5 leading-none">መነሻ</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};
