import React, { useState } from 'react';
import { 
  Ticket as TicketIcon, 
  Sparkles, 
  CheckCircle2, 
  Trophy, 
  ShieldCheck, 
  Wallet, 
  Search, 
  Copy, 
  Check, 
  AlertCircle, 
  ArrowUpRight, 
  X, 
  Camera, 
  Upload, 
  Plus,
  Edit3,
  Image as ImageIcon,
  FileText,
  Eye,
  Trash2
} from 'lucide-react';
import { Language, LotteryDraw, PaymentMethod, Ticket, Transaction, UserProfile, WinnerNotification } from '../../types/lottery';
import { 
  formatETB, 
  generateLuckyNumber, 
  playNotificationSound, 
  formatEthiopianDate, 
  triggerConfetti 
} from '../../utils/lotteryUtils';
import { triggerHaptic } from '../../utils/telegram';
import { 
  lottery1000BannerImage, 
  lottery5000BannerImage, 
  lottery10000BannerImage, 
  lottery20000BannerImage, 
  getBanknoteForLottery 
} from '../../assets/banknotes';
import { WinnersHistoryView } from './WinnersHistoryView';
import { WalletView } from './WalletView';
import avatar6Image from '../../assets/images/profile_avatar_six_1792157927133.jpg';

const CANONICAL_LOTTERIES_CONFIG: Array<{
  id: string;
  titleAm: string;
  titleEn: string;
  code: string;
  category: 'instant' | 'digital' | 'national';
  bannerUrl: string;
  ticketPrice: number;
  jackpotAmount: number;
}> = [
  {
    id: 'lot_derash_1000',
    titleAm: 'ባለ 1,000 ብር ደራሽ',
    titleEn: 'Bale 1,000 ETB Derash',
    code: 'DERASH-1K',
    category: 'instant',
    bannerUrl: lottery1000BannerImage,
    ticketPrice: 10,
    jackpotAmount: 1000,
  },
  {
    id: 'lot_derash_5000',
    titleAm: 'ባለ 5,000 ብር ደራሽ',
    titleEn: 'Bale 5,000 ETB Derash',
    code: 'DERASH-5K',
    category: 'digital',
    bannerUrl: lottery5000BannerImage,
    ticketPrice: 50,
    jackpotAmount: 5000,
  },
  {
    id: 'lot_derash_10000',
    titleAm: 'ባለ 10,000 ብር ደራሽ',
    titleEn: 'Bale 10,000 ETB Derash',
    code: 'DERASH-10K',
    category: 'national',
    bannerUrl: lottery10000BannerImage,
    ticketPrice: 100,
    jackpotAmount: 10000,
  },
  {
    id: 'lot_derash_20000',
    titleAm: 'ባለ 20,000 ብር ደራሽ',
    titleEn: 'Bale 20,000 ETB Derash',
    code: 'DERASH-20K',
    category: 'national',
    bannerUrl: lottery20000BannerImage,
    ticketPrice: 200,
    jackpotAmount: 20000,
  },
];

interface LotteryHomeProps {
  lang: Language;
  lotteries: LotteryDraw[];
  tickets: Ticket[];
  transactions?: Transaction[];
  user: UserProfile;
  pendingApprovalsCount?: number;
  notifications?: WinnerNotification[];
  onClearNotification?: (id: string) => void;
  onBuyTickets: (lottery: LotteryDraw, ticketNumbers: string[], method: PaymentMethod, reference: string, phone: string, fullName?: string) => void;
  onDepositRequest?: (amount: number, method: PaymentMethod, reference: string, phone: string, fullName?: string, screenshotUrl?: string) => void;
  onWithdrawRequest?: (amount: number, phone: string) => void;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onNavigateToAdmin: () => void;
}

const PRESET_AVATARS = [
  { id: '1', label: '1', url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=200&q=80' },
  { id: '2', label: '2', url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=200&q=80' },
  { id: '3', label: '3', url: 'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=200&q=80' },
  { id: '4', label: '4', url: 'https://images.unsplash.com/photo-1611689342806-0863700ce1e4?auto=format&fit=crop&w=200&q=80' },
  { id: '5', label: '5', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80' },
  { id: '6', label: '6', url: avatar6Image },
];

export const LotteryHome: React.FC<LotteryHomeProps> = ({
  lang,
  lotteries,
  tickets,
  transactions = [],
  user,
  pendingApprovalsCount: _pendingApprovalsCount = 0,
  notifications = [],
  onClearNotification,
  onBuyTickets,
  onDepositRequest,
  onWithdrawRequest,
  onUpdateProfile,
  onNavigateToAdmin,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'active' | 'drawn' | 'wallet' | 'profile'>('active');

  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(!user.isRegistered);
  const [regFullName, setRegFullName] = useState(user.fullName || '');
  const [regPhone, setRegPhone] = useState(user.phone || '');
  const [regError, setRegError] = useState('');

  const handleRegisterUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim()) {
      setRegError(lang === 'am' ? 'እባክዎ ሙሉ ስምዎን ያስገቡ' : 'Please enter your full name');
      return;
    }
    if (!regPhone.trim() || regPhone.trim().length < 9) {
      setRegError(lang === 'am' ? 'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ' : 'Please enter a valid phone number');
      return;
    }
    setRegError('');
    if (onUpdateProfile) {
      onUpdateProfile({
        fullName: regFullName.trim(),
        phone: regPhone.trim(),
        isRegistered: true,
        walletBalance: user.walletBalance,
      });
    }
    triggerHaptic('success');
    playNotificationSound('win');
    setIsRegistrationModalOpen(false);
  };

  const handleShareContactSimulation = () => {
    if (!regFullName.trim()) {
      setRegFullName('ተጠቃሚ ቴሌግራም');
    }
    setRegPhone('0910961881');
    if (onUpdateProfile) {
      onUpdateProfile({
        fullName: regFullName.trim() || 'ተጠቃሚ ቴሌግራም',
        phone: '0910961881',
        isRegistered: true,
        walletBalance: user.walletBalance,
      });
    }
    triggerHaptic('success');
    playNotificationSound('win');
    setIsRegistrationModalOpen(false);
  };

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [ticketFilterTier, setTicketFilterTier] = useState<'all' | '10' | '50' | '100' | '200'>('all');
  const [profileDashboardTab, setProfileDashboardTab] = useState<'tickets' | 'verify'>('tickets');

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(user.fullName || '');
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editProfileError, setEditProfileError] = useState('');
  const [editProfileSuccess, setEditProfileSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) {
      setEditProfileError(lang === 'am' ? 'እባክዎ ሙሉ ስምዎን ያስገቡ' : 'Please enter your full name');
      return;
    }
    if (!editPhone.trim()) {
      setEditProfileError(lang === 'am' ? 'እባክዎ ስልክ ቁጥርዎን ያስገቡ' : 'Please enter your phone number');
      return;
    }
    setEditProfileError('');
    if (onUpdateProfile) {
      onUpdateProfile({
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
      });
    }
    setEditProfileSuccess(true);
    triggerHaptic('medium');
    playNotificationSound('win');
    setTimeout(() => {
      setEditProfileSuccess(false);
      setIsEditProfileModalOpen(false);
    }, 900);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('የምስሉ መጠን ከ 2MB መብለጥ የለበትም');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (onUpdateProfile) {
            onUpdateProfile({ avatarUrl: reader.result });
          }
          triggerHaptic('medium');
          playNotificationSound('win');
          setIsAvatarModalOpen(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [selectedLottery, setSelectedLottery] = useState<LotteryDraw | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [customNumbers, setCustomNumbers] = useState<string[]>([generateLuckyNumber()]);

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState(50);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('telebirr');
  const [depositRef, setDepositRef] = useState('');
  const [depositPhone, setDepositPhone] = useState(user.phone || '0910961881');
  const [depositFullName] = useState(user.fullName && user.fullName !== 'ተጠቃሚ' ? user.fullName : '');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);

  // 📸 Screenshot upload state for deposits
  const [depositProofMode, setDepositProofMode] = useState<'reference' | 'screenshot'>('reference');
  const [depositScreenshot, setDepositScreenshot] = useState<string | null>(null);
  const [depositScreenshotName, setDepositScreenshotName] = useState<string>('');
  const [depositScreenshotError, setDepositScreenshotError] = useState<string | null>(null);
  const [previewScreenshotModalUrl, setPreviewScreenshotModalUrl] = useState<string | null>(null);

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setDepositScreenshotError(lang === 'am' ? 'እባክዎ ትክክለኛ የምስል ፋይል (JPG, PNG) ይምረጡ' : 'Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setDepositScreenshotError(lang === 'am' ? 'የምስሉ መጠን ከ 10MB መብለጥ የለበትም' : 'Image size must be under 10MB');
      return;
    }

    setDepositScreenshotError(null);
    setDepositScreenshotName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setDepositScreenshot(dataUrl);
            triggerHaptic('light');
          } else {
            setDepositScreenshot(event.target?.result as string);
          }
        } catch {
          setDepositScreenshot(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const [withdrawAmount, setWithdrawAmount] = useState(50);
  const [withdrawAccountType, setWithdrawAccountType] = useState<'telebirr' | 'cbe'>('telebirr');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState(user.phone || '0910961881');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [, setHeaderClicks] = useState(0);

  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [verifySearchQuery, setVerifySearchQuery] = useState('');
  const [verifyActiveResult, setVerifyActiveResult] = useState<{
    found: boolean;
    ticketNumber: string;
    lotteryTitle: string;
    round?: number;
    status: 'won' | 'active' | 'lost' | 'not_found' | 'refunded';
    prizeAmount?: number;
    prizeTitle?: string;
    drawDate?: string;
    purchasedAt?: string;
    pricePaid?: number;
    paymentRef?: string;
    securityHash?: string;
  } | null>(null);

  const [purchasedSuccess, setPurchasedSuccess] = useState<{
    lotteryTitle: string;
    ticketNumbers: string[];
    reference: string;
    totalAmount: number;
    phone: string;
  } | null>(null);

  const handlePerformDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasRef = Boolean(depositRef.trim());
    const hasScreenshot = Boolean(depositScreenshot);

    if ((!hasRef && !hasScreenshot) || depositAmount < 10 || !depositPhone.trim()) return;

    const finalReference = hasRef 
      ? depositRef.trim() 
      : `SCREENSHOT-${Date.now().toString().slice(-6)}`;

    setDepositSubmitting(true);
    if (onDepositRequest) {
      onDepositRequest(
        depositAmount,
        depositMethod,
        finalReference,
        depositPhone.trim(),
        depositFullName.trim() || user.fullName,
        depositScreenshot || undefined
      );
    }
    triggerHaptic('medium');
    playNotificationSound('win');
    setDepositSuccessMsg(
      lang === 'am'
        ? `✅ የ ${depositAmount.toLocaleString()} ብር የገቢ ጥያቄዎ ${hasScreenshot ? 'ከስክሪን ሹት ጋር ' : ''}ለአስተዳዳሪው (0910961881) ተልኳል! ክፍያው ሲረጋገጥ በቅጽበት ወደ ዋሌትዎ ገቢ ይደረጋል።`
        : `✅ Deposit request of ${depositAmount.toLocaleString()} ETB ${hasScreenshot ? 'with screenshot ' : ''}sent to admin! Will be credited once verified.`
    );
    setDepositSubmitting(false);
    setTimeout(() => {
      setDepositRef('');
      setDepositScreenshot(null);
      setDepositScreenshotName('');
      setDepositScreenshotError(null);
      setDepositSuccessMsg(null);
      setIsDepositModalOpen(false);
    }, 2200);
  };

  const handlePerformWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount < 50 || withdrawAmount > user.walletBalance || !withdrawAccountNumber.trim()) return;
    setWithdrawSubmitting(true);
    if (onWithdrawRequest) {
      onWithdrawRequest(withdrawAmount, `${withdrawAccountType.toUpperCase()}: ${withdrawAccountNumber.trim()}`);
    }
    triggerHaptic('medium');
    playNotificationSound('click');
    setWithdrawSuccessMsg(
      lang === 'am'
        ? `✅ የ ${withdrawAmount.toLocaleString()} ብር የወጪ ጥያቄዎ ለአስተዳዳሪው (0910961881) ተልኳል! በአካውንትዎ (${withdrawAccountType.toUpperCase()}: ${withdrawAccountNumber}) ይላክሎታል።`
        : `✅ Withdrawal request sent to admin! Will be sent to your account.`
    );
    setWithdrawSubmitting(false);
    setTimeout(() => {
      setWithdrawSuccessMsg(null);
      setIsWithdrawModalOpen(false);
    }, 2200);
  };

  const activeLotteries: LotteryDraw[] = CANONICAL_LOTTERIES_CONFIG.map((config) => {
    const foundActive = lotteries.find(
      l => l.status === 'active' && (l.id === config.id || l.ticketPrice === config.ticketPrice)
    );
    if (foundActive) {
      return {
        ...foundActive,
        bannerUrl: foundActive.bannerUrl || getBanknoteForLottery(config.ticketPrice),
        totalInventory: 200,
        round: foundActive.round || 1,
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
      category: config.category,
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

  const drawnLotteries = lotteries.filter(l => l.status === 'completed' || !!l.winningNumbers);

  const handleOpenPurchase = (lottery: LotteryDraw) => {
    setSelectedLottery(lottery);
    setPurchaseQuantity(1);
    setCustomNumbers([generateLuckyNumber()]);
    playNotificationSound('click');
  };

  const handleQuantityChange = (newQty: number) => {
    if (newQty < 1 || newQty > 20) return;
    setPurchaseQuantity(newQty);
    
    setCustomNumbers(prev => {
      if (newQty > prev.length) {
        const added: string[] = [];
        for (let i = prev.length; i < newQty; i++) {
          added.push(generateLuckyNumber());
        }
        return [...prev, ...added];
      } else {
        return prev.slice(0, newQty);
      }
    });
  };

  const handleCutTicketWithWallet = () => {
    if (!selectedLottery) return;
    const totalCost = selectedLottery.ticketPrice * customNumbers.length;

    if (user.walletBalance < totalCost) {
      triggerHaptic('heavy');
      playNotificationSound('alert');
      return;
    }

    const reference = 'WLT-' + Math.floor(100000 + Math.random() * 900000);
    onBuyTickets(selectedLottery, customNumbers, 'wallet', reference, user.phone, user.fullName);

    setPurchasedSuccess({
      lotteryTitle: lang === 'am' ? selectedLottery.titleAm : selectedLottery.titleEn,
      ticketNumbers: [...customNumbers],
      reference,
      totalAmount: totalCost,
      phone: user.phone,
    });

    setSelectedLottery(null);
    triggerConfetti();
    playNotificationSound('success');
    triggerHaptic('medium');
  };

  const handleVerifyAdminPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (enteredPin.trim() === '2728') {
      setIsAdminPinModalOpen(false);
      setEnteredPin('');
      setPinError(null);
      triggerHaptic('medium');
      playNotificationSound('success');
      onNavigateToAdmin();
    } else {
      setPinError(lang === 'am' ? 'የተሳሳተ የይለፍ ቃል! እባክዎ እንደገና ይሞክሩ።' : 'Incorrect PIN! Please try again.');
      setEnteredPin('');
      triggerHaptic('error');
      playNotificationSound('alert');
    }
  };

  const handleVerifyTicket = (queryNum?: string) => {
    const rawTarget = (queryNum || verifySearchQuery).trim().replace('#', '');
    if (!rawTarget) return;
    if (queryNum) setVerifySearchQuery(rawTarget);

    const matchedUserTicket = tickets.find(t => 
      t.ticketNumber === rawTarget || t.id.toLowerCase() === rawTarget.toLowerCase() || t.securityHash.includes(rawTarget)
    );

    const matchedDraw = drawnLotteries.find(d => 
      d.winningNumbers?.firstPrize === rawTarget || 
      d.winningNumbers?.secondPrize === rawTarget || 
      d.winningNumbers?.thirdPrize === rawTarget
    );

    if (matchedDraw) {
      const isFirst = matchedDraw.winningNumbers?.firstPrize === rawTarget;
      const isSecond = matchedDraw.winningNumbers?.secondPrize === rawTarget;
      const prizeAmount = isFirst 
        ? matchedDraw.jackpotAmount 
        : isSecond 
        ? Math.round(matchedDraw.jackpotAmount * 0.1) 
        : Math.round(matchedDraw.jackpotAmount * 0.04);
      const prizeRank = 'የዕድል ሽልማት (Jackpot)';

      setVerifyActiveResult({
        found: true,
        ticketNumber: rawTarget,
        lotteryTitle: lang === 'am' ? matchedDraw.titleAm : matchedDraw.titleEn,
        round: matchedDraw.round || 1,
        status: 'won',
        prizeAmount,
        prizeTitle: `${prizeRank} (${prizeAmount.toLocaleString()} ብር)`,
        drawDate: matchedDraw.drawDate,
        securityHash: matchedDraw.provablyFairSeed || 'ETH-SEC-HASH-VERIFIED',
      });
      playNotificationSound('win');
      return;
    }

    if (matchedUserTicket) {
      setVerifyActiveResult({
        found: true,
        ticketNumber: matchedUserTicket.ticketNumber,
        lotteryTitle: matchedUserTicket.lotteryTitleAm,
        round: matchedUserTicket.round || 1,
        status: 'active',
        prizeAmount: 0,
        prizeTitle: lang === 'am' ? 'ንቁ ቲኬት (ዕጣ አልወጣለትም)' : 'Active Ticket (Not Drawn)',
        purchasedAt: matchedUserTicket.purchasedAt,
        pricePaid: matchedUserTicket.pricePaid,
        paymentRef: matchedUserTicket.paymentReference,
        securityHash: matchedUserTicket.securityHash,
      });
      playNotificationSound('click');
      return;
    }

    setVerifyActiveResult({
      found: false,
      ticketNumber: rawTarget,
      lotteryTitle: 'ያልተመዘገበ ቁጥር',
      status: 'not_found',
    });
    playNotificationSound('click');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full px-4 py-2.5 flex items-center justify-center">
          <div 
            onClick={() => {
              setHeaderClicks(prev => {
                const next = prev + 1;
                if (next >= 5) {
                  setEnteredPin('');
                  setPinError(null);
                  setIsAdminPinModalOpen(true);
                  return 0;
                }
                return next;
              });
            }}
            className="flex flex-col items-center justify-center text-center cursor-pointer select-none"
          >
            <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-yellow-400 drop-shadow-[0_2px_14px_rgba(250,204,21,0.65)] uppercase select-none leading-none">
              GOL
            </h1>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-300 tracking-wide mt-1">
              (Gashena Online Lottery)
            </span>
          </div>
        </div>
      </header>

      {notifications.length > 0 && !notifications[0].isRead && (
        <div className="mx-3 mt-2 bg-gradient-to-r from-emerald-950/90 to-teal-950/90 border border-emerald-500/50 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 text-base">
              💰
            </span>
            <div className="min-w-0">
              <h5 className="text-xs font-black text-emerald-300">
                {lang === 'am' ? 'ወደ ዋሌትዎ ገቢ ተደርጓል!' : 'Funds Deposited to Wallet!'}
              </h5>
              <p className="text-[11px] text-slate-200 truncate">
                {lang === 'am' ? notifications[0].messageAm : notifications[0].messageEn}
              </p>
            </div>
          </div>
          {onClearNotification && (
            <button
              onClick={() => onClearNotification(notifications[0].id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <main className="flex-1 w-full px-3 py-3.5 pb-24 sm:pb-28 space-y-4">
        {activeMainTab === 'active' && (
          <div className="space-y-4">
            <div className="flex flex-col space-y-4">
              {activeLotteries.map((draw) => (
                <div 
                  key={draw.id}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col group"
                >
                  <div className="relative h-40 sm:h-48 overflow-hidden bg-slate-950">
                    <img 
                      src={draw.bannerUrl || getBanknoteForLottery(draw.ticketPrice)} 
                      alt={lang === 'am' ? draw.titleAm : draw.titleEn} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-98"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    
                    <div className="absolute top-2.5 left-2.5 bg-slate-950/90 backdrop-blur-md text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-lg text-[11px] font-black shadow-md flex items-center space-x-1">
                      <span>🔄 {lang === 'am' ? `ዙር ${draw.round || 1}` : `Round ${draw.round || 1}`}</span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-lg text-[11px] font-black shadow-md">
                      {lang === 'am' ? `በ ${draw.ticketPrice} ብር ብቻ` : `${draw.ticketPrice} ETB`}
                    </div>

                    <div className="absolute bottom-2.5 left-3 right-3">
                      <h4 className="text-lg font-black text-white drop-shadow-md">
                        {lang === 'am' ? draw.titleAm : draw.titleEn}
                      </h4>
                    </div>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-center">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                        {lang === 'am' ? 'የዕድል ሽልማት' : 'Jackpot Prize'}
                      </span>
                      <div className="text-2xl font-black text-emerald-400 font-sans tabular-nums mt-0.5">
                        {formatETB(draw.jackpotAmount)}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="w-full bg-slate-950 rounded-full h-2.5 p-0.5 border border-emerald-500/40 overflow-hidden shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 h-full rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                          style={{ width: `${Math.max(8, Math.min(100, Math.round(((draw.ticketsSold || 0) / 200) * 100)))}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenPurchase(draw)}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-500/20"
                    >
                      <TicketIcon className="w-4 h-4" />
                      <span>
                        {lang === 'am' 
                          ? `በ ${draw.ticketPrice} ብር ቲኬት ቁረጡ` 
                          : `Cut Ticket for ${draw.ticketPrice} ETB`}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeMainTab === 'drawn' && (
          <WinnersHistoryView
            drawnLotteries={drawnLotteries}
            tickets={tickets}
            lang={lang}
            onVerifyTicket={(num) => {
              setVerifySearchQuery(num);
              handleVerifyTicket(num);
              setProfileDashboardTab('verify');
              setActiveMainTab('profile');
              triggerHaptic('medium');
              playNotificationSound('click');
            }}
            triggerHaptic={triggerHaptic}
            playNotificationSound={playNotificationSound}
          />
        )}

        {activeMainTab === 'wallet' && (
          <WalletView
            user={user}
            transactions={transactions}
            lang={lang}
            onOpenDeposit={() => {
              setIsDepositModalOpen(true);
              triggerHaptic('medium');
              playNotificationSound('click');
            }}
            onOpenWithdraw={() => {
              setIsWithdrawModalOpen(true);
              triggerHaptic('medium');
              playNotificationSound('click');
            }}
            triggerHaptic={triggerHaptic}
            playNotificationSound={playNotificationSound}
          />
        )}

        {activeMainTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-full border-2 border-teal-400/80 p-0.5 shadow-lg bg-slate-950 overflow-hidden">
                    <img
                      src={user.avatarUrl || avatar6Image}
                      alt={user.fullName || 'User Profile'}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarModalOpen(true);
                      triggerHaptic('light');
                      playNotificationSound('click');
                    }}
                    title={lang === 'am' ? 'ፎቶ ቀይር' : 'Change Avatar'}
                    aria-label={lang === 'am' ? 'ፎቶ ቀይር' : 'Change Avatar'}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-full shadow-md transition active:scale-90"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 justify-center sm:justify-start">
                    <h3 className="text-xl font-black text-white">
                      {user.fullName || 'ማክቤል ማረጉ'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setEditFullName(user.fullName || '');
                        setEditPhone(user.phone || '');
                        setEditProfileError('');
                        setEditProfileSuccess(false);
                        setIsEditProfileModalOpen(true);
                        triggerHaptic('light');
                      }}
                      className="text-slate-400 hover:text-teal-300 p-1 rounded-lg transition inline-flex items-center self-center"
                      title={lang === 'am' ? 'ስም ቀይር' : 'Edit Name'}
                      aria-label="Edit Name"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-teal-400/80" />
                    </button>
                  </div>

                  <div className="text-xs text-amber-400 font-semibold font-mono flex items-center justify-center sm:justify-start gap-1">
                    <span>✈️</span>
                    <span>{user.telegramUsername ? (user.telegramUsername.startsWith('@') ? user.telegramUsername : `@${user.telegramUsername}`) : '@lij_makbel'}</span>
                  </div>

                  <div className="text-xs text-slate-300 font-sans flex items-center justify-center sm:justify-start gap-1.5 font-bold">
                    <span>📱 ስልክ፦</span>
                    <span className="font-mono text-emerald-400 font-bold">{user.phone || '0910961881'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditFullName(user.fullName || '');
                        setEditPhone(user.phone || '');
                        setEditProfileError('');
                        setEditProfileSuccess(false);
                        setIsEditProfileModalOpen(true);
                        triggerHaptic('light');
                      }}
                      className="text-slate-400 hover:text-emerald-300 p-0.5 rounded transition inline-flex items-center"
                      title={lang === 'am' ? 'ስልክ ቀይር' : 'Edit Phone'}
                      aria-label="Edit Phone"
                    >
                      <Edit3 className="w-3 h-3 text-emerald-400/80" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800/80 text-center">
                <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800/60 shadow-inner">
                  <span className="text-[11px] text-slate-400 block font-semibold">{lang === 'am' ? 'የተቆረጡ ቲኬቶች' : 'Total Tickets'}</span>
                  <span className="text-sm font-black text-teal-300 font-mono mt-0.5 block">{tickets.length}</span>
                </div>
                <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800/60 shadow-inner">
                  <span className="text-[11px] text-slate-400 block font-semibold">{lang === 'am' ? 'ያሸነፉት ጠቅላላ' : 'Total Won'}</span>
                  <span className="text-sm font-black text-amber-400 font-mono mt-0.5 block">{user.totalWon.toLocaleString()} ብር</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-lg grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setProfileDashboardTab('tickets');
                  triggerHaptic('light');
                }}
                className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  profileDashboardTab === 'tickets'
                    ? 'bg-teal-500 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <TicketIcon className="w-3.5 h-3.5" />
                <span>{lang === 'am' ? 'የእኔ ቲኬቶች' : 'My Tickets'}</span>
                <span className="text-[10px] font-mono opacity-80">({tickets.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileDashboardTab('verify');
                  triggerHaptic('light');
                }}
                className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  profileDashboardTab === 'verify'
                    ? 'bg-teal-500 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{lang === 'am' ? 'ቲኬት ማረጋገጫ' : 'Authenticator'}</span>
              </button>
            </div>

            {profileDashboardTab === 'verify' && (
            <div className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-teal-500/30 hover:border-teal-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_10px_35px_rgba(0,0,0,0.6)] space-y-4 relative overflow-hidden transition-colors">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500/25 to-emerald-500/10 border border-teal-500/40 text-teal-300 flex items-center justify-center shadow-inner">
                    <ShieldCheck className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white flex items-center gap-1.5">
                      <span>{lang === 'am' ? 'የይፋዊ ቲኬት ማረጋገጫ' : 'Official Ticket Authenticator'}</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </h4>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/25 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  <span>{lang === 'am' ? 'የጸደቀ ማህተም' : 'Verified Seal'}</span>
                </span>
              </div>

              {tickets.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 block font-semibold">
                    {lang === 'am' ? 'ፈጣን ምርጫ (የእርስዎ የቅርብ ትኬቶች)፦' : 'Quick fill from your tickets:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tickets.slice(0, 4).map((tk) => (
                      <button
                        key={tk.id}
                        type="button"
                        onClick={() => {
                          setVerifySearchQuery(tk.ticketNumber);
                          handleVerifyTicket(tk.ticketNumber);
                          triggerHaptic('light');
                          playNotificationSound('click');
                        }}
                        className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold transition flex items-center gap-1 active:scale-95 border ${
                          verifySearchQuery === tk.ticketNumber
                            ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md font-black'
                            : 'bg-slate-950/80 text-teal-300 hover:text-white border-teal-500/30 hover:border-teal-400 hover:bg-slate-900'
                        }`}
                      >
                        <span className="text-amber-400 font-bold">#</span>
                        <span>{tk.ticketNumber}</span>
                        <span className="text-[9px] opacity-75 font-sans font-medium">({tk.pricePaid} ብር)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyTicket();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                    <span className="text-amber-400 font-mono font-black text-sm">#</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={verifySearchQuery}
                    onChange={(e) => setVerifySearchQuery(e.target.value.replace(/[^0-9A-Za-z_-]/g, ''))}
                    placeholder={lang === 'am' ? 'የ 6-ድጂት ቁጥሩን እዚህ ያስገቡ...' : 'Enter 6-digit ticket number...'}
                    className="w-full bg-slate-950 border-2 border-slate-700/80 hover:border-teal-500/60 focus:border-teal-400 rounded-2xl pl-8 pr-9 py-2.5 text-amber-300 font-mono font-black text-sm sm:text-base tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:font-medium placeholder:text-xs placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20 transition shadow-inner"
                  />
                  {verifySearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setVerifySearchQuery('');
                        setVerifyActiveResult(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg"
                      aria-label="Clear input"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm transition shadow-lg shadow-teal-500/25 flex items-center justify-center space-x-1.5 active:scale-95 shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>{lang === 'am' ? 'አረጋግጥ' : 'Verify'}</span>
                </button>
              </form>

              {verifyActiveResult && (
                <div className={`p-4 rounded-2xl border transition-all animate-in zoom-in-95 ${
                  verifyActiveResult.status === 'won'
                    ? 'bg-gradient-to-br from-amber-950/80 via-slate-950 to-amber-900/60 border-2 border-amber-400/90 shadow-[0_0_30px_rgba(251,191,36,0.25)] text-white'
                    : verifyActiveResult.status === 'active'
                    ? 'bg-gradient-to-br from-emerald-950/70 via-slate-950 to-teal-950/60 border-2 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.2)] text-white'
                    : verifyActiveResult.found
                    ? 'bg-slate-950 border border-slate-700/80 text-slate-300'
                    : 'bg-rose-950/40 border border-rose-500/50 text-slate-300'
                }`}>
                  {verifyActiveResult.status === 'won' ? (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-base shadow">
                            🏆
                          </div>
                          <div>
                            <div className="flex items-center space-x-1 text-amber-300 font-black text-sm sm:text-base">
                              <span>{lang === 'am' ? 'እንኳን ደስ አለዎት! ይፋዊ አሸናፊ ቲኬት ነው!' : 'Grand Winning Ticket!'}</span>
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              {verifyActiveResult.lotteryTitle} • ዙር {verifyActiveResult.round || 1}
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-950 px-3.5 py-1.5 rounded-xl border border-amber-400 font-mono font-black text-base sm:text-lg text-amber-300 self-start sm:self-auto shadow-inner">
                          #{verifyActiveResult.ticketNumber}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/20">
                        <span className="text-amber-200 font-semibold">{verifyActiveResult.prizeTitle}</span>
                        <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md font-black">
                          {lang === 'am' ? 'ሽልማቱ የተረጋገጠ' : 'Prize Confirmed'}
                        </span>
                      </div>
                    </div>
                  ) : verifyActiveResult.status === 'active' ? (
                    <div className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <div className="text-emerald-400 font-black text-xs sm:text-sm">
                              {lang === 'am' ? 'ንቁ እና ህጋዊ ቲኬት (በዕጣው ላይ የሚሳተፍ)' : 'Active Official Ticket'}
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              {verifyActiveResult.lotteryTitle} • ዙር {verifyActiveResult.round || 1}
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-950 px-3 py-1 rounded-xl border border-emerald-500/50 font-mono font-bold text-emerald-400 text-sm self-start sm:self-auto shadow-inner">
                          #{verifyActiveResult.ticketNumber}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                        {lang === 'am' ? '⏳ የዚህ ዙር ይፋዊ ዕጣ ገና አልወጣም፤ በስርዓቱ ላይ በንቃት እየተሳተፈ ነው።' : 'Draw is pending. This ticket is registered and active in the system.'}
                      </div>
                    </div>
                  ) : verifyActiveResult.found ? (
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-300">
                          {lang === 'am' ? 'ያለፈ ዕጣ (ያልደረሰ ቲኬት)' : 'Past Draw (Non-winning)'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{verifyActiveResult.lotteryTitle}</div>
                      </div>
                      <div className="font-mono text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        #{verifyActiveResult.ticketNumber}
                      </div>
                    </div>
                  ) : (
                    <div className="text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        {lang === 'am' 
                          ? `ቁጥር #${verifyActiveResult.ticketNumber} በሲስተሙ አልተገኘም። እባክዎ የ 6-ድጂት ቁጥሩን በትክክል ያስገቡ።` 
                          : `Ticket #${verifyActiveResult.ticketNumber} not found in the database. Please verify the digits.`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {profileDashboardTab === 'tickets' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                    <TicketIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">
                      {lang === 'am' ? 'የተቆረጡ ቲኬቶች ዝርዝር' : 'Purchased Tickets Roster'}
                    </h4>
                  </div>
                </div>
                <span className="text-xs font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-xl border border-teal-500/20 font-sans tabular-nums self-start sm:self-auto">
                  {tickets.length} {lang === 'am' ? 'ቲኬቶች' : 'Tickets'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: lang === 'am' ? 'ሁሉም ቲኬቶች' : 'All' },
                  { id: '10', label: '10 ብር (1,000 ደራሽ)' },
                  { id: '50', label: '50 ብር (5,000 ደራሽ)' },
                  { id: '100', label: '100 ብር (10,000 ደራሽ)' },
                  { id: '200', label: '200 ብር (20,000 ደራሽ)' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => {
                      setTicketFilterTier(tier.id as any);
                      triggerHaptic('light');
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      ticketFilterTier === tier.id
                        ? 'bg-teal-500 text-slate-950 shadow'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>

              {(() => {
                const filteredTickets = tickets.filter(t => {
                  if (ticketFilterTier === 'all') return true;
                  return String(t.pricePaid) === ticketFilterTier;
                });

                if (filteredTickets.length === 0) {
                  return (
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 text-center space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-lg">
                        🎟️
                      </div>
                      <p className="text-xs text-slate-400">
                        {lang === 'am' ? 'በዚህ ደረጃ እስካሁን የተቆረጠ ቲኬት የለም' : 'No tickets in this category'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMainTab('active');
                          triggerHaptic('light');
                        }}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
                      >
                        {lang === 'am' ? 'አሁን ቲኬት ይቁረጡ' : 'Cut Tickets Now'}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {filteredTickets.map((tk) => (
                      <div
                        key={tk.id}
                        className="bg-slate-950/90 border border-slate-800 hover:border-teal-500/40 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-900 border border-amber-500/40 px-2.5 py-1.5 rounded-xl text-center min-w-[76px]">
                            <span className="text-[9px] text-slate-400 block font-semibold">{lang === 'am' ? 'ቁጥር' : 'Ticket'}</span>
                            <span className="text-base font-black text-amber-300 font-sans tabular-nums tracking-wide">
                              #{tk.ticketNumber}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-white">
                              {lang === 'am' ? tk.lotteryTitleAm : tk.lotteryTitleEn}
                            </h5>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                              {tk.round && (
                                <span className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-medium">
                                  ዙር {tk.round}
                                </span>
                              )}
                              <span className="font-sans tabular-nums font-bold text-emerald-400">
                                {tk.pricePaid} ብር
                              </span>
                              <span className="text-slate-500 font-sans">
                                • {formatEthiopianDate(tk.purchasedAt, true)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            tk.status === 'won'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {tk.status === 'won' ? (lang === 'am' ? '🏆 አሸናፊ' : 'Winner') : (lang === 'am' ? '✅ ንቁ' : 'Active')}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setVerifySearchQuery(tk.ticketNumber);
                              handleVerifyTicket(tk.ticketNumber);
                              setProfileDashboardTab('verify');
                              triggerHaptic('light');
                              playNotificationSound('click');
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white rounded-lg text-[11px] font-semibold transition border border-slate-700/60"
                          >
                            {lang === 'am' ? 'ፈትሽ' : 'Check'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            )}
          </div>
        )}
      </main>

      {/* Ticket Selection & Purchase Modal */}
      {selectedLottery && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-base">
                    {lang === 'am' ? selectedLottery.titleAm : selectedLottery.titleEn}
                  </h4>
                  <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    🔄 {lang === 'am' ? `ዙር ${(selectedLottery.ticketsSold || 0) >= 200 ? (selectedLottery.round || 1) + 1 : selectedLottery.round || 1}` : `Round ${(selectedLottery.ticketsSold || 0) >= 200 ? (selectedLottery.round || 1) + 1 : selectedLottery.round || 1}`}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLottery(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {(selectedLottery.ticketsSold || 0) >= 200 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300">
                {lang === 'am' 
                  ? `ℹ️ ማስታወሻ፡ የዙር ${selectedLottery.round || 1} 200 ቲኬቶች ስለሞሉ ቲኬትዎ ለቀጣዩ ዙር (ዙር ${(selectedLottery.round || 1) + 1}) ይመዘገባል።` 
                  : `ℹ️ Note: Round ${selectedLottery.round || 1} 200 tickets are full. Your tickets will register for Round ${(selectedLottery.round || 1) + 1}.`}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                {lang === 'am' ? 'የቲኬት ብዛት ይምረጡ:' : 'Select Quantity:'}
              </label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(purchaseQuantity - 1)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg"
                >
                  -
                </button>
                <div className="flex-1 text-center font-mono font-bold text-xl text-white bg-slate-950 py-2 rounded-xl border border-slate-800">
                  {purchaseQuantity}
                </div>
                <button
                  type="button"
                  onClick={() => handleQuantityChange(purchaseQuantity + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg"
                >
                  +
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                {[1, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleQuantityChange(n)}
                    className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold border transition ${
                      purchaseQuantity === n 
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">
                  {lang === 'am' ? 'የተዘጋጁ የዕድል ቁጥሮችዎ:' : 'Generated Lucky Numbers:'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const regenerated = Array.from({ length: purchaseQuantity }, () => generateLuckyNumber());
                    setCustomNumbers(regenerated);
                    playNotificationSound('click');
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{lang === 'am' ? 'ቁጥሮችን ቀይር' : 'Reroll'}</span>
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded-xl border border-slate-800">
                {customNumbers.map((num, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs px-2 py-1 bg-slate-900 rounded-lg">
                    <span className="text-slate-400">ቲኬት {idx + 1}</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">#{num}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block">{lang === 'am' ? 'ጠቅላላ ክፍያ' : 'Total Amount'}</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {formatETB(selectedLottery.ticketPrice * purchaseQuantity)}
                  </span>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <span>{purchaseQuantity} × {selectedLottery.ticketPrice} ብር</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'am' ? 'ዋሌት:' : 'Wallet:'}</span>
                </span>
                <span className={`font-mono font-bold ${user.walletBalance >= selectedLottery.ticketPrice * purchaseQuantity ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {user.walletBalance.toLocaleString()} ብር
                </span>
              </div>

              {user.walletBalance < selectedLottery.ticketPrice * purchaseQuantity && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{lang === 'am' ? '❌ በዋሌትዎ ውስጥ በቂ ሂሳብ የለም!' : '❌ Insufficient Wallet Balance!'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {lang === 'am'
                      ? `የሚያስፈልገው ክፍያ ${(selectedLottery.ticketPrice * purchaseQuantity).toLocaleString()} ብር ሲሆን በዋሌትዎ ውስጥ ያለው ቀሪ ሂሳብ ${user.walletBalance.toLocaleString()} ብር ብቻ ነው። እባክዎ በአድሚን (0910961881) በኩል ገቢ ያድርጉ፤ አስተዳዳሪው ሲያጸድቅ በቅጽበት ይሞላል።`
                      : `Required: ${(selectedLottery.ticketPrice * purchaseQuantity).toLocaleString()} ETB, but your wallet has ${user.walletBalance.toLocaleString()} ETB. Please contact admin (0910961881) for deposit; it will be credited instantly once approved.`}
                  </p>
                </div>
              )}
              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-xs font-sans">
                    {user.fullName || (lang === 'am' ? 'በዋሌት ገቢ ጊዜ የሚሞላ ስም' : 'Pending deposit name')}
                  </span>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="font-bold text-teal-400 font-sans tabular-nums text-xs">
                    {user.phone || (lang === 'am' ? 'በገቢ ጊዜ ይሞላል' : 'Pending phone')}
                  </span>
                </div>
              </div>
            </div>

            {user.walletBalance < selectedLottery.ticketPrice * purchaseQuantity ? (
              <button
                disabled
                className="w-full py-3.5 bg-slate-800/80 text-slate-500 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-700/50 flex items-center justify-center space-x-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400/60" />
                <span>{lang === 'am' ? 'በቂ የዋሌት ሂሳብ የለም (መቁረጥ አይቻልም)' : 'Insufficient Balance (Cannot Buy)'}</span>
              </button>
            ) : (
              <button
                onClick={handleCutTicketWithWallet}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-slate-950 font-black rounded-xl text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2"
              >
                <TicketIcon className="w-4 h-4" />
                <span>
                  {lang === 'am' 
                    ? `ቲኬት ቁረጡ (${(selectedLottery.ticketPrice * purchaseQuantity).toLocaleString()} ብር ከዋሌት ይቀነሳል)` 
                    : `Cut Ticket (${(selectedLottery.ticketPrice * purchaseQuantity).toLocaleString()} ETB from Wallet)`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {purchasedSuccess && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl w-full max-w-md p-6 space-y-5 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">
                {lang === 'am' ? 'ቲኬትዎ በተሳካ ሁኔታ ተቆርጧል!' : 'Tickets Purchased Successfully!'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'am' ? 'የዕድል ቲኬትዎ ተመዝግቧል፤ መልካም ዕድል!' : 'Your tickets have been issued and enrolled.'}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-400">{lang === 'am' ? 'የሎተሪ ዓይነት:' : 'Lottery:'}</span>
                <span className="font-bold text-white">{purchasedSuccess.lotteryTitle}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-400">{lang === 'am' ? 'የክፍያ ቁጥር:' : 'Reference:'}</span>
                <span className="font-mono text-emerald-400 font-bold">{purchasedSuccess.reference}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-400">{lang === 'am' ? 'የተከፈለው ገንዘብ:' : 'Amount Paid:'}</span>
                <span className="font-mono text-white font-bold">{formatETB(purchasedSuccess.totalAmount)} (ከዋሌት)</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-400">{lang === 'am' ? 'ቀሪ የዋሌት ሂሳብ:' : 'Remaining Balance:'}</span>
                <span className="font-mono text-emerald-400 font-bold">{formatETB(user.walletBalance)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-400">{lang === 'am' ? 'የተገዛበት ቀን:' : 'Purchase Date:'}</span>
                <span className="font-sans text-amber-300 font-semibold">{formatEthiopianDate(new Date(), true)}</span>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1.5">{lang === 'am' ? 'የዕድል ቁጥሮችዎ:' : 'Your Lucky Numbers:'}</span>
                <div className="flex flex-wrap gap-1.5">
                  {purchasedSuccess.ticketNumbers.map((num, i) => (
                    <span key={i} className="px-3 py-1 bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono font-black text-sm rounded-lg">
                      #{num}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setPurchasedSuccess(null)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm transition"
            >
              {lang === 'am' ? 'ተጠናቋል' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Telegram Bot Mini App Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.7)] pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        <div className="max-w-md sm:max-w-lg mx-auto px-1.5 py-1 grid grid-cols-4 gap-1 text-center">
          <button
            onClick={() => {
              setActiveMainTab('active');
              triggerHaptic('light');
              playNotificationSound('click');
            }}
            aria-label={lang === 'am' ? 'ዕጣዎች' : 'Lotteries'}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition min-h-[46px] active:scale-95 ${
              activeMainTab === 'active'
                ? 'text-emerald-400 bg-emerald-500/15 font-black ring-1 ring-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <div className="relative">
              <TicketIcon className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
              <span className="absolute -top-1 -right-2 px-1 min-w-[12px] h-3 bg-emerald-500 text-slate-950 text-[8px] font-black rounded-full flex items-center justify-center">
                {activeLotteries.length}
              </span>
            </div>
            <span className="text-[10px] mt-0.5 font-bold leading-none tracking-tight">
              {lang === 'am' ? 'ዕጣዎች' : 'Draws'}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('drawn');
              triggerHaptic('light');
              playNotificationSound('click');
            }}
            aria-label={lang === 'am' ? 'አሸናፊ' : 'Winners'}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition min-h-[46px] active:scale-95 ${
              activeMainTab === 'drawn'
                ? 'text-amber-400 bg-amber-500/15 font-black ring-1 ring-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <div className="relative">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
              {drawnLotteries.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[12px] h-3 bg-amber-500 text-slate-950 text-[8px] font-black rounded-full flex items-center justify-center">
                  {drawnLotteries.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-bold leading-none tracking-tight">
              {lang === 'am' ? 'አሸናፊ' : 'Winners'}
            </span>
          </button>

          <button
            onClick={() => {
              if (!user.isRegistered) {
                setIsRegistrationModalOpen(true);
                triggerHaptic('medium');
                return;
              }
              setActiveMainTab('wallet');
              triggerHaptic('light');
              playNotificationSound('click');
            }}
            aria-label={lang === 'am' ? 'ዋሌት' : 'Wallet'}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition min-h-[46px] active:scale-95 ${
              activeMainTab === 'wallet'
                ? 'text-emerald-400 bg-emerald-500/15 font-black ring-1 ring-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <div className="relative">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
            </div>
            <span className="text-[10px] mt-0.5 font-bold leading-none tracking-tight">
              {lang === 'am' ? 'ዋሌት' : 'Wallet'}
            </span>
          </button>

          <button
            onClick={() => {
              if (!user.isRegistered) {
                setIsRegistrationModalOpen(true);
                triggerHaptic('medium');
                return;
              }
              setActiveMainTab('profile');
              triggerHaptic('light');
              playNotificationSound('click');
            }}
            aria-label={lang === 'am' ? 'ፕሮፋይል' : 'Profile'}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition min-h-[46px] active:scale-95 ${
              activeMainTab === 'profile'
                ? 'text-teal-400 bg-teal-500/15 font-black ring-1 ring-teal-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <div className="relative">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
            </div>
            <span className="text-[10px] mt-0.5 font-bold leading-none tracking-tight">
              {lang === 'am' ? 'ፕሮፋይል' : 'Profile'}
            </span>
          </button>
        </div>
      </nav>

      {/* Secret Admin PIN Modal (PIN: 2728 strictly secret) */}
      {isAdminPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xs p-6 space-y-4 shadow-2xl relative text-center">
            <button
              type="button"
              onClick={() => {
                setIsAdminPinModalOpen(false);
                setEnteredPin('');
                setPinError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center mx-auto text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {lang === 'am' ? 'የአድሚን ፒን (PIN) ያስገቡ' : 'Enter Admin PIN'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'am' ? 'የአስተዳዳሪ ክፍል ለመግባት ባለ 4 ድጂት ሚስጥር ቁጥር ያስገቡ' : 'Enter 4-digit PIN to access admin dashboard'}
              </p>
            </div>

            {pinError && (
              <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs py-2 px-3 rounded-xl font-medium animate-in shake">
                {pinError}
              </div>
            )}

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError(null);
                }}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-2xl font-bold bg-slate-950 border border-slate-700 rounded-2xl py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminPinModalOpen(false);
                    setEnteredPin('');
                    setPinError(null);
                  }}
                  className="py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition"
                >
                  {lang === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={enteredPin.length === 0}
                  className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition disabled:opacity-50"
                >
                  {lang === 'am' ? 'ግባ' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Image & Avatar Picker Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-400" />
                <span>{lang === 'am' ? 'የፕሮፋይል ፎቶ ይምረጡ' : 'Choose Profile Picture'}</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsAvatarModalOpen(false)} 
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                {lang === 'am' ? 'Upload from device' : 'Upload from phone'}
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-950 border border-dashed border-teal-500/40 hover:border-teal-400 rounded-2xl cursor-pointer transition text-xs font-bold text-teal-300 active:scale-95">
                <Upload className="w-4 h-4" />
                <span>{lang === 'am' ? 'ከስልክዎ ፎቶ ይምረጡ...' : 'Select Photo...'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                {lang === 'am' ? 'ወይም ከእነዚህ ምስሎች ይምረጡ (በቁጥር)፦' : 'Or choose avatar by number:'}
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {PRESET_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      if (onUpdateProfile) {
                        onUpdateProfile({ avatarUrl: av.url });
                      }
                      triggerHaptic('light');
                      playNotificationSound('click');
                      setIsAvatarModalOpen(false);
                    }}
                    className={`flex flex-col items-center p-2 rounded-2xl border transition active:scale-95 ${
                      user.avatarUrl === av.url 
                        ? 'bg-teal-500/20 border-teal-400 ring-1 ring-teal-400' 
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700 mb-1">
                      <img src={av.url} alt={`Avatar #${av.label}`} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs font-mono font-black text-amber-400">#{av.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Edit Profile (Name & Phone) Modal */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-5 sm:p-6 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    {lang === 'am' ? 'Edit Profile Info' : 'Edit Profile Info'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'am' ? '' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editProfileError && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editProfileError}</span>
              </div>
            )}

            {editProfileSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-2 font-bold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{lang === 'am' ? 'መረጃዎ በሚገባ ተስተካክሏል!' : 'Profile updated successfully!'}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  {lang === 'am' ? 'ሙሉ ስም (Full Name)' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => {
                    setEditFullName(e.target.value);
                    if (editProfileError) setEditProfileError('');
                  }}
                  placeholder={lang === 'am' ? '' : ''}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-2xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  {lang === 'am' ? 'ስልክ ቁጥር (Phone Number)' : 'Phone Number'}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={editPhone}
                  onChange={(e) => {
                    setEditPhone(e.target.value.replace(/[^0-9+]/g, ''));
                    if (editProfileError) setEditProfileError('');
                  }}
                  placeholder={lang === 'am' ? '' : ''}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-2xl px-3.5 py-2.5 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition"
                >
                  {lang === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>{lang === 'am' ? 'አስቀምጥ' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💵 Deposit Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    {lang === 'am' ? 'የዋሌት ሂሳብ መሙያ (Deposit)' : 'Deposit Funds to Wallet'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'am' ? 'በቴሌብር ወይም ሲቢኢ በቀላሉ ይሙሉ' : 'Instant deposit via Telebirr or CBE'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDepositModalOpen(false);
                  setDepositSuccessMsg(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {depositSuccessMsg ? (
              <div className="p-5 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl border border-emerald-500/40">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-xs text-emerald-200 font-bold leading-relaxed">
                  {depositSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handlePerformDeposit} className="space-y-4">
                <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-semibold">
                    {lang === 'am' ? '' : ''}
                  </span>

                  <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition">
                    <div>
                      <div className="text-[10px] text-slate-400">ቴሌብር (Makbel Maregu)</div>
                      <div className="font-mono font-bold text-sm text-emerald-400">0910961881</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('0910961881');
                        setCopiedKey('telebirr_dep');
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      {copiedKey === 'telebirr_dep' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'telebirr_dep' ? 'ኮፒ ሆኗል' : 'ኮፒ'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-sky-500/40 transition">
                    <div>
                      <div className="text-[10px] text-slate-400">ሲቢኢ (Makbel Maregu)</div>
                      <div className="font-mono font-bold text-sm text-sky-400">1000321337124</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('1000321337124');
                        setCopiedKey('cbe_dep');
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      {copiedKey === 'cbe_dep' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'cbe_dep' ? 'ኮፒ ሆኗል' : 'ኮፒ'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {lang === 'am' ? 'የገቢ መጠን (ብር)፦' : 'Deposit Amount (ETB):'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[50, 100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositAmount(amt)}
                        className={`py-2 rounded-xl font-mono text-xs font-bold transition border ${
                          depositAmount === amt
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {amt} ብር
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={100000}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Math.max(10, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="ብጁ መጠን (Custom Amount)..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {lang === 'am' ? 'የከፈሉበት መንገድ፦' : 'Payment Method:'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDepositMethod('telebirr')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                        depositMethod === 'telebirr'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      📱 ቴሌብር (Telebirr)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositMethod('cbe_birr')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                        depositMethod === 'cbe_birr'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      🏦 ሲቢኢ (CBE Account)
                    </button>
                  </div>
                </div>

                {/* 📸 የክፍያ ማረጋገጫ አማራጭ (Proof Option: SMS Ref or Screenshot) */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>{lang === 'am' ? 'የክፍያ ማረጋገጫ መንገድ፦' : 'Payment Proof Method:'}</span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {lang === 'am' ? 'እንደ አማራጭ ይምረጡ' : 'Choose option'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setDepositProofMode('reference')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        depositProofMode === 'reference'
                          ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{lang === 'am' ? 'በሪፈረንስ ቁጥር' : 'Reference / SMS'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositProofMode('screenshot')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        depositProofMode === 'screenshot'
                          ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/50'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{lang === 'am' ? 'በስክሪን ሹት' : 'Screenshot'}</span>
                      {depositScreenshot && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                    </button>
                  </div>
                </div>

                {depositProofMode === 'reference' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      {lang === 'am' ? 'የደረሰኝ ሪፈረንስ ቁጥር (Transaction Ref / SMS)፦' : 'Transaction Reference:'}
                    </label>
                    <input
                      type="text"
                      required={!depositScreenshot}
                      value={depositRef}
                      onChange={(e) => setDepositRef(e.target.value)}
                      placeholder={lang === 'am' ? 'ምሳሌ፡ TLB-889......' : 'e.g., TLB-889.....'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {!depositScreenshot ? (
                      <button
                        type="button"
                        onClick={() => setDepositProofMode('screenshot')}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 pt-0.5 font-medium"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{lang === 'am' ? 'ወይም ስክሪን ሹት (ፎቶ) ማስገባት ይፈልጋሉ?' : 'Or upload screenshot instead?'}</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between p-2 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 mt-1">
                        <div className="flex items-center gap-2 truncate">
                          <ImageIcon className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span className="truncate">{depositScreenshotName || 'ስክሪን ሹት ተያይዟል'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDepositScreenshot(null);
                            setDepositScreenshotName('');
                          }}
                          className="text-slate-400 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>{lang === 'am' ? 'የክፍያ ስክሪን ሹት (Screenshot)፦' : 'Payment Screenshot / Receipt:'}</span>
                      {depositScreenshot && (
                        <span className="text-[10px] text-emerald-400 font-bold">✓ ተያይዟል</span>
                      )}
                    </label>

                    {!depositScreenshot ? (
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-slate-950/70 hover:bg-slate-950 rounded-2xl cursor-pointer transition group">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 transition">
                          <Upload className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <span className="text-xs font-bold text-white text-center">
                          {lang === 'am' ? '' : ''}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 text-center">
                          {lang === 'am' ? 'የቴሌብር ወይም የሲቢኢ ክፍያ ማረጋገጫ (PNG, JPG)' : 'Telebirr or CBE confirmation image (PNG, JPG)'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotFileChange}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-2xl border border-emerald-500/40 bg-slate-950 p-2.5 flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800 relative group">
                            <img
                              src={depositScreenshot}
                              alt="Deposit Screenshot"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewScreenshotModalUrl(depositScreenshot)}
                              className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">
                              {depositScreenshotName || 'Screenshot.jpg'}
                            </p>
                            <p className="text-[10px] text-emerald-400 mt-0.5">
                              {lang === 'am' ? '✅ ስክሪን ሹት በተሳካ ሁኔታ ተያይዟል' : '✅ Screenshot attached'}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewScreenshotModalUrl(depositScreenshot)}
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{lang === 'am' ? 'እይ' : 'Preview'}</span>
                              </button>
                              <label className="text-[11px] text-slate-300 hover:text-white font-bold flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg cursor-pointer">
                                <Camera className="w-3 h-3" />
                                <span>{lang === 'am' ? 'ቀይር' : 'Change'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleScreenshotFileChange}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setDepositScreenshot(null);
                                  setDepositScreenshotName('');
                                }}
                                className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{lang === 'am' ? 'አጥፋ' : 'Remove'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Optional Ref number */}
                        <div className="pt-1">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            {lang === 'am' ? 'የሪፈረንስ ቁጥር (ካለዎት - አማራጭ)፦' : 'Reference Number (Optional):'}
                          </label>
                          <input
                            type="text"
                            value={depositRef}
                            onChange={(e) => setDepositRef(e.target.value)}
                            placeholder={lang === 'am' ? 'ምሳሌ፡ TLB-889... (አስገዳጅ አይደለም)' : 'e.g. TLB-889... (Optional)'}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    )}

                    {depositScreenshotError && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{depositScreenshotError}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {lang === 'am' ? 'ስልክ ቁጥር፦' : 'Phone Number:'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={depositPhone}
                    onChange={(e) => setDepositPhone(e.target.value)}
                    placeholder=""
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={depositSubmitting || (!depositRef.trim() && !depositScreenshot)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>{depositSubmitting ? (lang === 'am' ? 'በመላክ ላይ...' : 'Sending...') : (lang === 'am' ? 'ገቢ አድርግ (ማረጋገጫ ላክ)' : 'Submit Deposit Request')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 💸 Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
                  <ArrowUpRight className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    {lang === 'am' ? 'የገንዘብ ማውጫ (Withdrawal)' : 'Withdraw Funds'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'am' ? 'ቀጥታ ወደ ቴሌብር ስልክዎ ይላካል' : 'Direct payout to your Telebirr phone'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWithdrawModalOpen(false);
                  setWithdrawSuccessMsg(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {withdrawSuccessMsg ? (
              <div className="p-5 bg-amber-950/60 border border-amber-500/50 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xl border border-amber-500/40">
                  <Check className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-xs text-amber-200 font-bold leading-relaxed">
                  {withdrawSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handlePerformWithdraw} className="space-y-4">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {lang === 'am' ? 'የሚገኝ ቀሪ ሂሳብ፦' : 'Available Balance:'}
                  </span>
                  <span className="font-mono font-black text-base text-emerald-400">
                    {user.walletBalance.toLocaleString()} ብር
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {lang === 'am' ? 'የሚወጣው መጠን (ዝቅተኛ 50 ብር)፦' : 'Withdraw Amount (Min 50 ETB):'}
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[50, 100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setWithdrawAmount(amt)}
                        className={`py-2 rounded-xl font-mono text-xs font-bold transition border ${
                          withdrawAmount === amt
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {amt} ብር
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={50}
                    max={user.walletBalance || 100000}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="የብር መጠን..."
                  />
                  {user.walletBalance < withdrawAmount && (
                    <p className="text-[11px] text-rose-400 font-medium">
                      ⚠️ ከቀሪ ሂሳብዎ በላይ ማውጣት አይችሉም
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {lang === 'am' ? 'የአካውንት አይነት ይምረጡ (CBE ወይም ቴሌብር)፦' : 'Select Account Type (CBE / Telebirr):'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWithdrawAccountType('telebirr')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                        withdrawAccountType === 'telebirr'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      📱 ቴሌብር (Telebirr)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithdrawAccountType('cbe')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                        withdrawAccountType === 'cbe'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      🏦 ሲቢኢ (CBE Account)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {lang === 'am' ? (withdrawAccountType === 'telebirr' ? 'የቴሌብር ስልክ ቁጥር፦' : 'የሲቢኢ አካውንት ቁጥር (CBE Account No):') : 'Account Number / Phone:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={withdrawAccountNumber}
                    onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                    placeholder={withdrawAccountType === 'telebirr' ? '0910961881' : '1000...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    {lang === 'am' ? 'አስተዳዳሪው ጥያቄዎን ሲያጸድቅ ወደዚህ አካውንት ይለቃል' : 'Admin will transfer funds to this account'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={withdrawSubmitting || withdrawAmount < 50 || withdrawAmount > user.walletBalance}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{withdrawSubmitting ? (lang === 'am' ? 'በመላክ ላይ...' : 'Processing...') : (lang === 'am' ? 'ገንዘብ አውጣ (ጥያቄ ላክ)' : 'Request Withdrawal')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 📸 Screenshot Preview Modal */}
      {previewScreenshotModalUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewScreenshotModalUrl(null)}
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
                onClick={() => setPreviewScreenshotModalUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black max-h-[70vh] flex items-center justify-center border border-slate-800">
              <img
                src={previewScreenshotModalUrl}
                alt="Receipt Full Preview"
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewScreenshotModalUrl(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                {lang === 'am' ? 'ዝጋ' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Welcome / Mandatory User Registration Modal */}
      {isRegistrationModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            if (user.isRegistered) setIsRegistrationModalOpen(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-5 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center border border-emerald-500/30">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-black text-white">
                {lang === 'am' ? '📱 ቴሌግራም ስልክ ቁጥር ማረጋገጫ' : 'Telegram Phone Verification'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'am' 
                  ? 'መተግበሪያውን ለመክፈት (OPEN) እባክዎ ከታች ያለውን የቴሌግራም ስልክ ቁጥር ማጋሪያ ቁልፍ ይጫኑ ወይም ሙሉ ስም እና ስልክ ቁጥር ያስገቡ።' 
                  : 'To open the app, please share your Telegram contact or enter your name and phone number.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleShareContactSimulation}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
            >
              <Smartphone className="w-4 h-4" />
              <span>{lang === 'am' ? '📱 ቴሌግራም ስልክ ቁጥር አጋራ (ክፈት / OPEN)' : 'Share Telegram Contact (OPEN)'}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider">{lang === 'am' ? 'ወይም በሰንጠረዥ ይመዝገቡ' : 'or register manually'}</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <form onSubmit={handleRegisterUser} className="space-y-3">
              {regError && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-xs text-rose-300 font-medium text-center">
                  {regError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  {lang === 'am' ? 'ሙሉ ስም (Full Name)፦' : 'Full Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder={lang === 'am' ? 'ለምሳሌ፡ አበበ ከበደ' : 'e.g. Abebe Kebede'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-medium text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  {lang === 'am' ? 'ስልክ ቁጥር (Phone Number)፦' : 'Phone Number:'}
                </label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="0911223344"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2 active:scale-95 mt-2"
              >
                <span>{lang === 'am' ? '🚀 ይመዝገቡና ይክፈቱ (OPEN)' : 'Register & Open'}</span>
              </button>

              {user.isRegistered && (
                <button
                  type="button"
                  onClick={() => setIsRegistrationModalOpen(false)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  {lang === 'am' ? 'ሰርዝ / ዝጋ' : 'Cancel'}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
