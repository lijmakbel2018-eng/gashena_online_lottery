import React, { useState } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Search, 
  Copy, 
  Check, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  FileText, 
  X
} from 'lucide-react';
import { Language, LotteryDraw, Ticket } from '../../types/lottery';
import { formatETB, formatEthiopianDate } from '../../utils/lotteryUtils';

interface WinnersHistoryViewProps {
  drawnLotteries: LotteryDraw[];
  tickets: Ticket[];
  lang: Language;
  onVerifyTicket: (ticketNumber: string) => void;
  triggerHaptic?: (style: 'light' | 'medium' | 'heavy') => void;
  playNotificationSound?: (type: 'click' | 'win' | 'alert') => void;
  compactHeader?: boolean;
}

export const WinnersHistoryView: React.FC<WinnersHistoryViewProps> = ({
  drawnLotteries,
  tickets,
  lang,
  onVerifyTicket,
  triggerHaptic,
  playNotificationSound,
  compactHeader: _compactHeader = false,
}) => {
  const [historyFilterTier, setHistoryFilterTier] = useState<'all' | '10' | '50' | '100' | '200'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<LotteryDraw | null>(null);

  const handleCopyNumber = (num: string, keyId: string) => {
    if (!num) return;
    navigator.clipboard?.writeText(num);
    setCopiedKey(keyId);
    triggerHaptic?.('light');
    playNotificationSound?.('click');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerify = (ticketNum: string) => {
    onVerifyTicket(ticketNum);
    triggerHaptic?.('medium');
    playNotificationSound?.('click');
  };

  const filteredDraws = drawnLotteries.filter((draw) => {
    if (historyFilterTier !== 'all' && String(draw.ticketPrice) !== historyFilterTier) {
      return false;
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.trim().toLowerCase();
      const matchNumber = 
        draw.winningNumbers?.firstPrize?.toLowerCase().includes(q) ||
        draw.winningNumbers?.secondPrize?.toLowerCase().includes(q) ||
        draw.winningNumbers?.thirdPrize?.toLowerCase().includes(q);
      const matchTitle = 
        draw.titleAm.toLowerCase().includes(q) || 
        draw.titleEn.toLowerCase().includes(q);
      const matchRound = String(draw.round || 1).includes(q);
      const matchWinnerName = 
        draw.winnerDetails?.firstPrizeWinner?.name?.toLowerCase().includes(q);
      const matchWinnerPhone = 
        draw.winnerDetails?.firstPrizeWinner?.phone?.includes(q);
      return matchNumber || matchTitle || matchRound || matchWinnerName || matchWinnerPhone;
    }
    return true;
  });

  const totalPayout = drawnLotteries.reduce((acc, d) => acc + (d.jackpotAmount || 0), 0);

  return (
    <div className="space-y-3.5 w-full">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shadow-inner shrink-0">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-white flex items-center gap-1.5 truncate">
                <span>{lang === 'am' ? 'አሸናፊ' : 'Winners'}</span>
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {lang === 'am' 
                  ? 'አሸናፊዎች ዝርዝር' 
                  : 'Official list of lottery winners and draw results'}
              </p>
            </div>
          </div>

          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2.5 py-1 rounded-xl font-bold font-mono text-xs tabular-nums shrink-0">
            {drawnLotteries.length} {lang === 'am' ? 'አሸናፊዎች' : 'Winners'}
          </span>
        </div>

        {/* Tier Filter Pills */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1 text-xs">
          {[
            { id: 'all', label: lang === 'am' ? 'ሁሉም' : 'All' },
            { id: '10', label: '1,000 ደራሽ' },
            { id: '50', label: '5,000 ደራሽ' },
            { id: '100', label: '10,000 ደራሽ' },
            { id: '200', label: '20,000 ደራሽ' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setHistoryFilterTier(t.id as any);
                triggerHaptic?.('light');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap border ${
                historyFilterTier === t.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-black'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        {drawnLotteries.length > 0 && (
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder={lang === 'am' ? 'በቁጥር ወይም በስም ፈልግ...' : 'Search by ticket # or winner...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {historySearchQuery && (
              <button
                type="button"
                onClick={() => setHistorySearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State vs List */}
      {filteredDraws.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto text-2xl">
            🏆
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-black text-white">
              {lang === 'am' ? 'እስካሁን የወጣ አሸናፊ የለም' : 'No Winners Yet'}
            </h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              {lang === 'am'
                ? ''
                : 'When the admin executes an official draw, winning numbers and customer details will appear here automatically.'}
            </p>
          </div>
        </div>
      ) : (
        /* Phone-optimized Winner Cards */
        <div className="space-y-3">
          {filteredDraws.map((draw) => {
            const drawDateFormatted = formatEthiopianDate(draw.drawDate, true);
            const firstPrizeNum = draw.winningNumbers?.firstPrize || '------';
            const secondPrizeNum = draw.winningNumbers?.secondPrize;
            const thirdPrizeNum = draw.winningNumbers?.thirdPrize;

            const winnerTicket = tickets.find(
              t => t.ticketNumber === draw.winningNumbers?.firstPrize
            );
            const winnerObj = draw.winnerDetails?.firstPrizeWinner || (winnerTicket ? {
              ticketNumber: winnerTicket.ticketNumber,
              name: winnerTicket.userName,
              phone: winnerTicket.userPhone,
              telegram: winnerTicket.userTelegram,
              avatar: winnerTicket.userAvatar,
            } : null);

            return (
              <div 
                key={draw.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-lg space-y-3 p-3.5 transition"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans">
                        ዙር {draw.round || 1}
                      </span>
                      <h4 className="text-sm font-black text-white truncate">
                        {lang === 'am' ? draw.titleAm : draw.titleEn}
                      </h4>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{drawDateFormatted}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-semibold">{lang === 'am' ? 'ሽልማት' : 'Prize'}</span>
                    <span className="text-sm font-black text-emerald-400 font-sans tabular-nums">
                      {formatETB(draw.jackpotAmount)}
                    </span>
                  </div>
                </div>

                {/* 1st Prize Winning Number Drum */}
                <div className="p-3 bg-gradient-to-r from-slate-950 via-amber-950/30 to-slate-950 rounded-xl border border-amber-500/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">
                      1ኛ ይፋዊ አሸናፊ ቁጥር
                    </span>
                    <div className="font-mono font-black text-2xl text-yellow-400 tracking-wider">
                      #{firstPrizeNum}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyNumber(firstPrizeNum, draw.id)}
                      title="Copy"
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition active:scale-95"
                    >
                      {copiedKey === draw.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify(firstPrizeNum)}
                      className="px-2.5 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-bold rounded-lg transition active:scale-95"
                    >
                      {lang === 'am' ? 'አረጋግጥ' : 'Verify'}
                    </button>
                  </div>
                </div>

                {/* Secondary numbers */}
                {(secondPrizeNum || thirdPrizeNum) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {secondPrizeNum && (
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                        <span className="text-slate-400 text-[10px]">2ኛ ዕጣ:</span>
                        <span className="font-mono font-bold text-amber-300">#{secondPrizeNum}</span>
                      </div>
                    )}
                    {thirdPrizeNum && (
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                        <span className="text-slate-400 text-[10px]">3ኛ ዕጣ:</span>
                        <span className="font-mono font-bold text-amber-300">#{thirdPrizeNum}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Winner Customer info */}
                {winnerObj ? (
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400 bg-slate-800 shrink-0 flex items-center justify-center font-bold text-amber-300 text-xs">
                        {winnerObj.avatar ? (
                          <img src={winnerObj.avatar} alt="Winner" className="w-full h-full object-cover" />
                        ) : (
                          winnerObj.name?.charAt(0) || '🏆'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-amber-300 text-xs truncate">{winnerObj.name}</div>
                        <div className="text-[10px] text-teal-400 font-mono">
                          {winnerObj.phone ? winnerObj.phone.replace(/(\d{4})\d{3}(\d{3})/, '$1***$2') : '0910***881'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCertificate(draw);
                        triggerHaptic?.('light');
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">{lang === 'am' ? 'ሰነድ' : 'Cert'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
                    <span>{lang === 'am' ? 'ℹ️ ያልተሸጠ ቲኬት ቁጥር' : 'ℹ️ Unsold ticket'}</span>
                    <button
                      type="button"
                      onClick={() => handleVerify(firstPrizeNum)}
                      className="text-teal-400 font-bold hover:underline"
                    >
                      {lang === 'am' ? 'አረጋግጥ' : 'Verify'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Draw Certificate Modal */}
      {selectedCertificate && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl space-y-3.5 p-4 text-xs animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white text-sm">
                  {lang === 'am' ? 'ይፋዊ የአሸናፊነት ሰነድ' : 'Official Winner Certificate'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCertificate(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">የሎተሪ ስም፦</span>
                <span className="font-bold text-white">{selectedCertificate.titleAm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ዙር፦</span>
                <span className="font-mono text-amber-300 font-bold">ዙር {selectedCertificate.round || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">አሸናፊ ቁጥር፦</span>
                <span className="font-mono text-yellow-400 font-black text-sm">#{selectedCertificate.winningNumbers?.firstPrize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">የሽልማት መጠን፦</span>
                <span className="font-sans text-emerald-400 font-bold">{formatETB(selectedCertificate.jackpotAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">የወጣበት ቀን፦</span>
                <span className="text-slate-300">{formatEthiopianDate(selectedCertificate.drawDate, true)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const num = selectedCertificate.winningNumbers?.firstPrize;
                  if (num) {
                    onVerifyTicket(num);
                    setSelectedCertificate(null);
                  }
                }}
                className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition text-xs flex items-center justify-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{lang === 'am' ? 'በማረጋገጫው ፈትሽ' : 'Verify'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCertificate(null)}
                className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
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
