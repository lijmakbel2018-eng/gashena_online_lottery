/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { LotteryHome } from './components/lottery/LotteryHome';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { 
  INITIAL_LOTTERIES, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_TICKETS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_USER 
} from './data/mockData';
import { 
  Language, 
  LotteryDraw, 
  PaymentMethod, 
  Ticket, 
  Transaction, 
  UserProfile, 
  WinnerNotification 
} from './types/lottery';
import { 
  generateSecurityHash, 
  playNotificationSound, 
  triggerConfetti 
} from './utils/lotteryUtils';
import { 
  initTelegramWebApp, 
  getTelegramUser, 
  setupTelegramBackButton,
  triggerHaptic 
} from './utils/telegram';

export default function App() {
  const [lang] = useState<Language>('am');
  const [currentView, setCurrentView] = useState<'home' | 'admin'>('home');

  const [lotteries, setLotteries] = useState<LotteryDraw[]>(INITIAL_LOTTERIES);
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('gol_user_transactions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_TRANSACTIONS;
  });
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('gol_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.avatarUrl || parsed.avatarUrl.includes('photo-1546182990-dffeafbe841d') || parsed.avatarUrl.includes('photo-1535713875002-d1d0cf377fde')) {
          parsed.avatarUrl = '/avatars/avatar_6.jpg';
        }
        return parsed;
      }
    } catch {}
    return INITIAL_USER;
  });
  const [notifications, setNotifications] = useState<WinnerNotification[]>(INITIAL_NOTIFICATIONS);

  const creditedTxIdsRef = useRef<Set<string>>(new Set());
  const debitedTxIdsRef = useRef<Set<string>>(new Set());
  const rejectedTxIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    transactions.forEach(t => {
      if (t.status === 'completed') {
        if (t.type === 'deposit') creditedTxIdsRef.current.add(t.id);
        if (t.type === 'withdrawal') debitedTxIdsRef.current.add(t.id);
      } else if (t.status === 'failed') {
        rejectedTxIdsRef.current.add(t.id);
      }
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gol_user_profile', JSON.stringify(user));
    } catch {}
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('gol_user_transactions', JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    initTelegramWebApp();

    const tgUser = getTelegramUser();
    if (tgUser) {
      setUser(prev => ({
        ...prev,
        telegramId: tgUser.id.toString(),
        telegramUsername: tgUser.username || prev.telegramUsername,
        fullName: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() || prev.fullName,
      }));
    }
  }, []);

  useEffect(() => {
    const cleanup = setupTelegramBackButton(() => {
      triggerHaptic('light');
      setCurrentView('home');
    }, currentView === 'admin');

    return cleanup;
  }, [currentView]);

  const handleBuyTickets = (
    lottery: LotteryDraw,
    ticketNumbers: string[],
    method: PaymentMethod,
    reference: string,
    phone: string,
    fullName?: string
  ) => {
    const now = new Date().toISOString();
    const capacity = 200;
    const currentRound = lottery.round || 1;
    const currentSold = lottery.ticketsSold || 0;

    if (fullName?.trim()) {
      setUser(prev => ({ ...prev, fullName: fullName.trim() }));
    }
    if (phone?.trim()) {
      setUser(prev => ({ ...prev, phone: phone.trim() }));
    }

    const assignedBuyerName = fullName?.trim() || user.fullName || 'ደንበኛ';
    const assignedBuyerPhone = phone?.trim() || user.phone || '';

    const assignedRound = currentSold >= capacity ? currentRound + 1 : currentRound;

    const newTickets: Ticket[] = ticketNumbers.map((num) => ({
      id: 'tkt_' + Math.random().toString(36).substring(2, 9),
      lotteryId: lottery.id,
      lotteryTitleAm: `${lottery.titleAm} (ዙር ${assignedRound})`,
      lotteryTitleEn: `${lottery.titleEn} (Round ${assignedRound})`,
      ticketNumber: num,
      userId: user.id,
      userName: assignedBuyerName,
      userPhone: assignedBuyerPhone,
      userTelegram: user.telegramUsername ? (user.telegramUsername.startsWith('@') ? user.telegramUsername : `@${user.telegramUsername}`) : undefined,
      userAvatar: user.avatarUrl,
      pricePaid: lottery.ticketPrice,
      purchasedAt: now,
      paymentMethod: method,
      paymentReference: reference,
      round: assignedRound,
      status: 'active',
      securityHash: generateSecurityHash(num, lottery.id, now),
    }));

    const totalCost = lottery.ticketPrice * ticketNumbers.length;

    if (method === 'wallet' && user.walletBalance < totalCost) {
      playNotificationSound('alert');
      return;
    }

    const newTx: Transaction = {
      id: 'tx_' + Date.now(),
      ticketId: newTickets[0]?.id,
      lotteryId: lottery.id,
      lotteryTitleAm: `${lottery.titleAm} (ዙር ${assignedRound})`,
      userId: user.id,
      userName: assignedBuyerName,
      userPhone: assignedBuyerPhone,
      amount: totalCost,
      type: 'ticket_purchase',
      paymentMethod: method,
      referenceNumber: reference,
      timestamp: now,
      status: 'completed',
      gatewayFee: Number((totalCost * 0.015).toFixed(2)),
    };

    setTickets(prev => [...newTickets, ...prev]);
    setTransactions(prev => [newTx, ...prev]);

    setLotteries(prev => prev.map(l => {
      if (l.id === lottery.id) {
        if (currentSold >= capacity) {
          return {
            ...l,
            status: 'active' as const,
            round: currentRound + 1,
            totalInventory: 200,
            ticketsSold: ticketNumbers.length,
          };
        } else {
          return {
            ...l,
            status: 'active' as const,
            totalInventory: 200,
            ticketsSold: Math.min(capacity, currentSold + ticketNumbers.length),
          };
        }
      }
      return l;
    }));

    setUser(prev => ({
      ...prev,
      walletBalance: method === 'wallet' ? Math.max(0, prev.walletBalance - totalCost) : prev.walletBalance,
      ticketsCount: prev.ticketsCount + ticketNumbers.length,
    }));
  };

  const handleDepositRequest = (
    amount: number,
    method: PaymentMethod,
    reference: string,
    phone: string,
    fullName?: string,
    screenshotUrl?: string
  ) => {
    const finalUserName = fullName?.trim() || user.fullName;
    const newTx: Transaction = {
      id: 'tx_dep_' + Date.now(),
      lotteryId: 'wallet',
      lotteryTitleAm: 'የዋሌት ሂሳብ መሙያ (Deposit)',
      userId: user.id,
      userName: finalUserName,
      userPhone: phone || user.phone,
      amount,
      type: 'deposit',
      paymentMethod: method,
      referenceNumber: reference,
      screenshotUrl: screenshotUrl || undefined,
      timestamp: new Date().toISOString(),
      status: 'pending',
      gatewayFee: 0,
    };

    if (fullName?.trim()) {
      setUser(prev => ({ ...prev, fullName: fullName.trim() }));
    }
    if (phone?.trim()) {
      setUser(prev => ({ ...prev, phone: phone.trim() }));
    }

    setTransactions(prev => [newTx, ...prev]);
    playNotificationSound('click');

    fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTx,
        userId: user.id,
        telegramId: user.telegramId,
      }),
    }).catch(err => console.error('[Notify Admin Error]', err));
  };

  const handleApproveDeposit = (txId: string) => {
    const targetTx = transactions.find(t => t.id === txId);
    if (!targetTx || targetTx.status === 'completed') return;

    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        return { ...t, status: 'completed' as const };
      }
      return t;
    }));

    setUser(prev => ({
      ...prev,
      walletBalance: prev.walletBalance + targetTx.amount,
    }));

    fetch(`/api/transactions/${txId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', approvedBy: 'Admin (0910961881)' }),
    }).catch(() => {});

    const notif: WinnerNotification = {
      id: 'notif_dep_' + Date.now(),
      userId: user.id,
      lotteryId: 'wallet',
      lotteryTitleAm: 'የዋሌት ገቢ ማረጋገጫ',
      ticketNumber: '000000',
      amountWon: targetTx.amount,
      timestamp: new Date().toISOString(),
      isRead: false,
      messageAm: `✅ ወደ ዋሌትዎ ገቢ ተደርጓል! (${targetTx.amount.toLocaleString()} ብር)`,
      messageEn: `✅ Funds have been credited to your wallet! (${targetTx.amount.toLocaleString()} ETB)`,
    };
    setNotifications(prev => [notif, ...prev]);

    playNotificationSound('win');
    triggerConfetti();
  };

  const handleRejectDeposit = (txId: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        return { ...t, status: 'failed' as const };
      }
      return t;
    }));

    fetch(`/api/transactions/${txId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', approvedBy: 'Admin (0910961881)' }),
    }).catch(() => {});

    playNotificationSound('click');
  };

  const handleWithdrawRequest = (amount: number, phone: string) => {
    if (user.walletBalance < amount) return;

    setUser(prev => ({
      ...prev,
      walletBalance: Math.max(0, prev.walletBalance - amount),
    }));

    const newTx: Transaction = {
      id: 'tx_wth_' + Date.now(),
      lotteryId: 'wallet',
      lotteryTitleAm: 'የብር ማውጫ (Withdrawal Request)',
      userId: user.id,
      userName: user.fullName,
      userPhone: phone || user.phone,
      amount,
      type: 'withdrawal',
      paymentMethod: 'telebirr',
      referenceNumber: 'WTH-' + Math.floor(100000 + Math.random() * 900000),
      timestamp: new Date().toISOString(),
      status: 'pending',
      gatewayFee: 0,
    };

    setTransactions(prev => [newTx, ...prev]);
    playNotificationSound('click');

    fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTx,
        userId: user.id,
        telegramId: user.telegramId,
      }),
    }).catch(err => console.error('[Notify Admin Error]', err));
  };

  const handleApproveWithdrawal = (txId: string) => {
    const targetTx = transactions.find(t => t.id === txId);
    if (!targetTx || targetTx.status === 'completed') return;

    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        return { ...t, status: 'completed' as const };
      }
      return t;
    }));

    fetch(`/api/transactions/${txId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', approvedBy: 'Admin (0910961881)' }),
    }).catch(() => {});

    const notif: WinnerNotification = {
      id: 'notif_wth_' + Date.now(),
      userId: user.id,
      lotteryId: 'wallet',
      lotteryTitleAm: 'የብር ማውጣት ጸድቋል',
      ticketNumber: '000000',
      amountWon: targetTx.amount,
      timestamp: new Date().toISOString(),
      isRead: false,
      messageAm: `✅ የ ${targetTx.amount.toLocaleString()} ብር የወጪ ጥያቄዎ ጸድቆ ወደ ቴሌብር ስልክዎ (${targetTx.userPhone}) ተላልፏል!`,
      messageEn: `✅ Your withdrawal of ${targetTx.amount.toLocaleString()} ETB was approved and sent to your Telebirr (${targetTx.userPhone})!`,
    };
    setNotifications(prev => [notif, ...prev]);

    playNotificationSound('win');
  };

  const handleRejectWithdrawal = (txId: string) => {
    const targetTx = transactions.find(t => t.id === txId);
    if (!targetTx || targetTx.status === 'failed') return;

    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        return { ...t, status: 'failed' as const };
      }
      return t;
    }));

    setUser(prev => ({
      ...prev,
      walletBalance: prev.walletBalance + targetTx.amount,
    }));

    fetch(`/api/transactions/${txId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', approvedBy: 'Admin (0910961881)' }),
    }).catch(() => {});

    const notif: WinnerNotification = {
      id: 'notif_wth_fail_' + Date.now(),
      userId: user.id,
      lotteryId: 'wallet',
      lotteryTitleAm: 'የብር ማውጣት ውድቅ ተደርጓል',
      ticketNumber: '000000',
      amountWon: 0,
      timestamp: new Date().toISOString(),
      isRead: false,
      messageAm: `❌ የ ${targetTx.amount.toLocaleString()} ብር የወጪ ጥያቄዎ ውድቅ ተደርጓል፤ ገንዘቡ ወደ ዋሌትዎ ተመልሷል።`,
      messageEn: `❌ Your withdrawal request of ${targetTx.amount.toLocaleString()} ETB was rejected. The funds have been returned to your wallet.`,
    };
    setNotifications(prev => [notif, ...prev]);

    playNotificationSound('alert');
  };

  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const queryParams = new URLSearchParams({
          userId: user.id,
          phone: user.phone || '',
          tgId: user.telegramId || '',
        });
        const res = await fetch(`/api/transactions/sync?${queryParams.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) {
          if (data.wallet) {
            setUser(prev => {
              let changed = false;
              const upd = { ...prev };
              if (data.wallet.phone && data.wallet.phone.length >= 9 && (!prev.phone || prev.phone !== data.wallet.phone)) {
                upd.phone = data.wallet.phone;
                changed = true;
              }
              if (data.wallet.username && (!prev.telegramUsername || prev.telegramUsername !== data.wallet.username)) {
                upd.telegramUsername = data.wallet.username;
                changed = true;
              }
              if (data.wallet.fullName && (!prev.fullName || prev.fullName === 'ተጠቃሚ' || prev.fullName !== data.wallet.fullName)) {
                upd.fullName = data.wallet.fullName;
                changed = true;
              }
              if (data.wallet.profileImage && (!prev.avatarUrl || prev.avatarUrl !== data.wallet.profileImage)) {
                upd.avatarUrl = data.wallet.profileImage;
                changed = true;
              }
              return changed ? upd : prev;
            });
          }

          if (Array.isArray(data.transactions)) {
            const serverTxs: any[] = data.transactions;

            serverTxs.forEach(stx => {
              const isMyTx =
                transactions.some(t => t.id === stx.id) ||
                !stx.userId ||
                stx.userId === user.id ||
                (user.phone && stx.userPhone && stx.userPhone.replace(/\D/g, '').includes(user.phone.replace(/\D/g, '').slice(-9))) ||
                (user.telegramId && (stx.userId === user.telegramId || String(stx.userId) === String(user.telegramId))) ||
                (!user.telegramId && (stx.source === 'bot' || stx.userId === '8759844855' || !stx.userId));

              if (stx.type === 'deposit' && stx.status === 'completed') {
                if (!creditedTxIdsRef.current.has(stx.id)) {
                  creditedTxIdsRef.current.add(stx.id);

                  if (isMyTx) {
                    const creditedAmt = Number(stx.amount);
                    setUser(prev => {
                      const newBal = prev.walletBalance + creditedAmt;
                      fetch('/api/user/wallet/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: prev.id,
                          phone: prev.phone,
                          telegramId: prev.telegramId,
                          walletBalance: newBal,
                        }),
                      }).catch(() => {});
                      return {
                        ...prev,
                        walletBalance: newBal,
                      };
                    });

                    const notif: WinnerNotification = {
                      id: 'notif_dep_appr_' + Date.now(),
                      userId: user.id,
                      lotteryId: 'wallet',
                      lotteryTitleAm: 'የዋሌት ገቢ ማረጋገጫ',
                      ticketNumber: '000000',
                      amountWon: Number(stx.amount),
                      timestamp: new Date().toISOString(),
                      isRead: false,
                      messageAm: `✅ ወደ ዋሌትዎ ገቢ ተደርጓል! (${Number(stx.amount).toLocaleString()} ብር)`,
                      messageEn: `✅ Deposit approved! (${Number(stx.amount).toLocaleString()} ETB credited)`,
                    };
                    setNotifications(prev => [notif, ...prev]);

                    playNotificationSound('win');
                    triggerConfetti();
                  }
                }
              }

              if (stx.type === 'withdrawal' && stx.status === 'completed') {
                if (!debitedTxIdsRef.current.has(stx.id)) {
                  debitedTxIdsRef.current.add(stx.id);

                  if (isMyTx) {
                    if (stx.source === 'bot') {
                      const debitedAmt = Number(stx.amount);
                      setUser(prev => {
                        const newBal = Math.max(0, prev.walletBalance - debitedAmt);
                        fetch('/api/user/wallet/update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId: prev.id,
                            phone: prev.phone,
                            telegramId: prev.telegramId,
                            walletBalance: newBal,
                          }),
                        }).catch(() => {});
                        return {
                          ...prev,
                          walletBalance: newBal,
                        };
                      });
                    }

                    const notif: WinnerNotification = {
                      id: 'notif_wth_appr_' + Date.now(),
                      userId: user.id,
                      lotteryId: 'wallet',
                      lotteryTitleAm: 'የብር ማውጣት ጸድቋል',
                      ticketNumber: '000000',
                      amountWon: Number(stx.amount),
                      timestamp: new Date().toISOString(),
                      isRead: false,
                      messageAm: `✅ የ ${Number(stx.amount).toLocaleString()} ብር የወጪ ጥያቄዎ ጸድቆ በቴሌብር ተላልፏል!`,
                      messageEn: `✅ Withdrawal of ${Number(stx.amount).toLocaleString()} ETB was approved!`,
                    };
                    setNotifications(prev => [notif, ...prev]);
                    playNotificationSound('win');
                  }
                }
              }

              if (stx.type === 'withdrawal' && stx.status === 'failed') {
                if (!rejectedTxIdsRef.current.has(stx.id)) {
                  rejectedTxIdsRef.current.add(stx.id);

                  setTransactions(prev => {
                    const target = prev.find(t => t.id === stx.id && t.status === 'pending');
                    if (target) {
                      setUser(u => ({
                        ...u,
                        walletBalance: u.walletBalance + Number(stx.amount),
                      }));

                      const notif: WinnerNotification = {
                        id: 'notif_wth_fail_' + Date.now(),
                        userId: user.id,
                        lotteryId: 'wallet',
                        lotteryTitleAm: 'የብር ማውጣት ውድቅ ተደርጓል',
                        ticketNumber: '000000',
                        amountWon: 0,
                        timestamp: new Date().toISOString(),
                        isRead: false,
                        messageAm: `❌ የ ${Number(stx.amount).toLocaleString()} ብር የወጪ ጥያቄዎ ውድቅ ተደርጓል፤ ገንዘቡ ወደ ዋሌትዎ ተመልሷል።`,
                        messageEn: `❌ Withdrawal of ${Number(stx.amount).toLocaleString()} ETB was rejected. Funds refunded.`,
                      };
                      setNotifications(n => [notif, ...n]);
                      playNotificationSound('alert');
                    }
                    return prev;
                  });
                }
              }

              if (stx.type === 'deposit' && stx.status === 'failed') {
                if (!rejectedTxIdsRef.current.has(stx.id)) {
                  rejectedTxIdsRef.current.add(stx.id);

                  if (isMyTx) {
                    const notif: WinnerNotification = {
                      id: 'notif_dep_fail_' + Date.now(),
                      userId: user.id,
                      lotteryId: 'wallet',
                      lotteryTitleAm: 'የዋሌት ገቢ ውድቅ ተደርጓል',
                      ticketNumber: '000000',
                      amountWon: 0,
                      timestamp: new Date().toISOString(),
                      isRead: false,
                      messageAm: `❌ የ ${Number(stx.amount).toLocaleString()} ብር የገቢ ጥያቄዎ ውድቅ ተደርጓል። እባክዎ ትክክለኛ የክፍያ ማረጋገጫ ቁጥር ያስገቡ ወይም ድጋፍ (@lij_makbel) ያነጋግሩ።`,
                      messageEn: `❌ Deposit of ${Number(stx.amount).toLocaleString()} ETB was rejected.`,
                    };
                    setNotifications(prev => [notif, ...prev]);
                    playNotificationSound('alert');
                  }
                }
              }
            });

            setTransactions(prev => {
              const map = new Map<string, Transaction>();
              serverTxs.forEach(stx => {
                map.set(stx.id, {
                  id: stx.id,
                  lotteryId: stx.lotteryId || 'wallet',
                  lotteryTitleAm: stx.lotteryTitleAm || (stx.type === 'deposit' ? 'የዋሌት ሂሳብ መሙያ (Deposit)' : (stx.type === 'withdrawal' ? 'የብር ማውጫ (Withdrawal)' : 'የቲኬት ግዢ')),
                  userId: stx.userId || user.id,
                  userName: stx.userName || user.fullName,
                  userPhone: stx.userPhone || user.phone,
                  amount: Number(stx.amount),
                  type: stx.type,
                  paymentMethod: stx.paymentMethod,
                  referenceNumber: stx.referenceNumber,
                  timestamp: stx.timestamp,
                  status: stx.status,
                  gatewayFee: 0,
                });
              });
              prev.forEach(t => {
                if (!map.has(t.id)) map.set(t.id, t);
              });
              return Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
          }
        }
      } catch {
        // silent sync error
      }
    }, 1500);

    return () => clearInterval(syncInterval);
  }, [user.id, user.phone, user.telegramId]);

  useEffect(() => {
    fetch('/api/user/wallet/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        phone: user.phone,
        telegramId: user.telegramId,
        walletBalance: user.walletBalance,
        ticketsCount: user.ticketsCount,
        totalWon: user.totalWon,
      }),
    }).catch(() => {});
  }, [user.walletBalance, user.ticketsCount, user.totalWon, user.id, user.phone, user.telegramId]);

  const handleExecuteDraw = (
    lotteryId: string,
    winningNumbers: { firstPrize: string; secondPrize: string; thirdPrize: string; consolationSuffix: string }
  ) => {
    const targetLottery = lotteries.find(l => l.id === lotteryId);
    if (!targetLottery) return;

    const currentRound = targetLottery.round || 1;

    const winningTicket = tickets.find(
      t => (t.lotteryId === lotteryId || t.ticketNumber === winningNumbers.firstPrize) && (!t.round || t.round === currentRound)
    );
    const winnerDetails = {
      firstPrizeWinner: {
        ticketNumber: winningNumbers.firstPrize,
        name: winningTicket?.userName || user.fullName || 'ማክቤል ማረጉ',
        phone: winningTicket?.userPhone || user.phone || '0910961881',
        telegram: winningTicket?.userTelegram || (user.telegramUsername ? (user.telegramUsername.startsWith('@') ? user.telegramUsername : `@${user.telegramUsername}`) : '@lij_makbel'),
        avatar: winningTicket?.userAvatar || user.avatarUrl || 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=150&q=80',
      }
    };

    const completedRecord: LotteryDraw = {
      ...targetLottery,
      id: `drawn_${lotteryId}_r${currentRound}_${Date.now()}`,
      titleAm: `${targetLottery.titleAm} (ዙር ${currentRound})`,
      titleEn: `${targetLottery.titleEn} (Round ${currentRound})`,
      round: currentRound,
      status: 'completed' as const,
      ticketsSold: targetLottery.ticketsSold || 200,
      totalInventory: 200,
      winningNumbers,
      winnerDetails,
      drawDate: new Date().toISOString(),
    };

    setLotteries(prev => [
      completedRecord,
      ...prev.map(l => {
        if (l.id === lotteryId) {
          return {
            ...l,
            status: 'active' as const,
            round: currentRound + 1,
            totalInventory: 200,
            ticketsSold: 0,
            drawDate: new Date(Date.now() + 86400000 * 2).toISOString(),
            winningNumbers: undefined,
          };
        }
        return l;
      }),
    ]);

    let userWonAny = false;
    let totalWonInThisDraw = 0;

    setTickets(prevTickets => {
      return prevTickets.map(t => {
        if (t.lotteryId !== lotteryId || t.status !== 'active') return t;
        if (t.round && t.round !== currentRound) return t;

        if (t.ticketNumber === winningNumbers.firstPrize) {
          userWonAny = true;
          totalWonInThisDraw += targetLottery.jackpotAmount;
          return {
            ...t,
            status: 'won' as const,
            prizeWon: targetLottery.jackpotAmount,
            prizeTitleAm: '1ኛ ታላቅ ዕጣ (ጃክፖት)',
            prizeTitleEn: '1st Grand Prize (Jackpot)',
          };
        }

        if (t.ticketNumber === winningNumbers.secondPrize) {
          const p2 = targetLottery.prizes[1]?.amount || 500;
          userWonAny = true;
          totalWonInThisDraw += p2;
          return {
            ...t,
            status: 'won' as const,
            prizeWon: p2,
            prizeTitleAm: '2ኛ ዕጣ',
            prizeTitleEn: '2nd Prize',
          };
        }

        if (t.ticketNumber.endsWith(winningNumbers.consolationSuffix)) {
          const pC = targetLottery.prizes[2]?.amount || 100;
          userWonAny = true;
          totalWonInThisDraw += pC;
          return {
            ...t,
            status: 'won' as const,
            prizeWon: pC,
            prizeTitleAm: `ማበረታቻ ተከታታይ (${winningNumbers.consolationSuffix})`,
            prizeTitleEn: `Consolation Match (${winningNumbers.consolationSuffix})`,
          };
        }

        return {
          ...t,
          status: 'lost' as const,
        };
      });
    });

    if (userWonAny && totalWonInThisDraw > 0) {
      setUser(prev => ({
        ...prev,
        walletBalance: prev.walletBalance + totalWonInThisDraw,
        totalWon: prev.totalWon + totalWonInThisDraw,
      }));

      const payoutTx: Transaction = {
        id: 'tx_win_' + Date.now(),
        lotteryId,
        lotteryTitleAm: targetLottery.titleAm,
        userId: user.id,
        userName: user.fullName,
        userPhone: user.phone,
        amount: totalWonInThisDraw,
        type: 'prize_payout',
        paymentMethod: 'telebirr',
        referenceNumber: 'WIN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        timestamp: new Date().toISOString(),
        status: 'completed',
        gatewayFee: 0,
      };
      setTransactions(prev => [payoutTx, ...prev]);

      const winNotif: WinnerNotification = {
        id: 'notif_win_' + Date.now(),
        userId: user.id,
        lotteryId,
        lotteryTitleAm: targetLottery.titleAm,
        ticketNumber: winningNumbers.firstPrize,
        amountWon: totalWonInThisDraw,
        timestamp: new Date().toISOString(),
        isRead: false,
        messageAm: `🎉 እንኳን ደስ አለዎት ማክቤል! በ ${targetLottery.titleAm} የ ${totalWonInThisDraw.toLocaleString()} ብር አሸናፊ ሆነዋል!`,
        messageEn: `🎉 Congratulations! You won ${totalWonInThisDraw.toLocaleString()} ETB in ${targetLottery.titleEn}!`,
      };
      setNotifications(prev => [winNotif, ...prev]);
      playNotificationSound('win');
      triggerConfetti();
    } else {
      const broadcastNotif: WinnerNotification = {
        id: 'notif_draw_' + Date.now(),
        userId: user.id,
        lotteryId,
        lotteryTitleAm: targetLottery.titleAm,
        ticketNumber: winningNumbers.firstPrize,
        amountWon: 0,
        timestamp: new Date().toISOString(),
        isRead: false,
        messageAm: `📢 የ ${targetLottery.titleAm} ይፋዊ ዕጣ ወጥቷል! አሸናፊ ቁጥር: #${winningNumbers.firstPrize}።`,
        messageEn: `📢 Draw completed for ${targetLottery.titleEn}! Winning number: #${winningNumbers.firstPrize}.`,
      };
      setNotifications(prev => [broadcastNotif, ...prev]);
    }
  };

  const handleBroadcastNotification = (messageAm: string, messageEn: string) => {
    const newNotif: WinnerNotification = {
      id: 'notif_bcast_' + Date.now(),
      userId: user.id,
      lotteryId: 'all',
      lotteryTitleAm: 'ጋሸና ኦንላይን ሎተሪ',
      ticketNumber: '000000',
      amountWon: 0,
      timestamp: new Date().toISOString(),
      isRead: false,
      messageAm,
      messageEn,
    };

    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleAddLottery = (newLottery: LotteryDraw) => {
    setLotteries(prev => [newLottery, ...prev]);
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setUser(prev => {
      const next = { ...prev, ...updated };
      fetch('/api/user/wallet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: next.id,
          phone: next.phone,
          telegramId: next.telegramId,
          fullName: next.fullName,
          username: next.telegramUsername,
          profileImage: next.avatarUrl,
          walletBalance: next.walletBalance,
        }),
      }).catch(() => {});
      return next;
    });
  };

  const pendingApprovalsCount = transactions.filter(t => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center selection:bg-yellow-400 selection:text-slate-950">
      <div className="w-full max-w-md sm:max-w-lg min-h-screen bg-slate-950 flex flex-col relative sm:border-x sm:border-slate-800/80 shadow-2xl overflow-x-hidden">
        {currentView === 'home' ? (
          <LotteryHome
            lang={lang}
            lotteries={lotteries}
            tickets={tickets}
            transactions={transactions}
            user={user}
            pendingApprovalsCount={pendingApprovalsCount}
            notifications={notifications}
            onClearNotification={(notifId) => {
              setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
            }}
            onBuyTickets={handleBuyTickets}
            onDepositRequest={handleDepositRequest}
            onWithdrawRequest={handleWithdrawRequest}
            onUpdateProfile={handleUpdateProfile}
            onNavigateToAdmin={() => setCurrentView('admin')}
          />
        ) : (
          <AdminDashboard
            lang={lang}
            lotteries={lotteries}
            tickets={tickets}
            transactions={transactions}
            onAddLottery={handleAddLottery}
            onExecuteDraw={handleExecuteDraw}
            onBroadcastNotification={handleBroadcastNotification}
            onApproveDeposit={handleApproveDeposit}
            onRejectDeposit={handleRejectDeposit}
            onApproveWithdrawal={handleApproveWithdrawal}
            onRejectWithdrawal={handleRejectWithdrawal}
            onBack={() => setCurrentView('home')}
          />
        )}
      </div>
    </div>
  );
}
