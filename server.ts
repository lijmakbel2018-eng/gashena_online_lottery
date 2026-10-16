import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Configuration
// Bot token provided: 8831951923:AAHy_FpL8PMJCX33GcS5ye8vBU-iuOuUSxI (@gashena_online_lottery_bot)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8831951923:AAHy_FpL8PMJCX33GcS5ye8vBU-iuOuUSxI';
const BOT_USERNAME = 'gashena_online_lottery_bot';
const APP_URL = process.env.APP_URL || 'https://gashenaonlinelottery.netlify.app';

// Official Admin & Support Contact Details
const OFFICIAL_ADMIN = {
  phone: '0910961881',
  supportUsername: 'lij_makbel',
  fullName: 'Makbel Maregu',
  telebirr: '0910961881',
  cbeAccount: '1000321337124',
};

app.use(express.json());

// Official Gaashena Online Lottery Merchant Details
const OFFICIAL_MERCHANT = {
  fullName: OFFICIAL_ADMIN.fullName,
  telebirr: OFFICIAL_ADMIN.telebirr,
  cbeAccount: OFFICIAL_ADMIN.cbeAccount,
  platform: 'Gaashena Online Lottery (ጋሸና ኦንላይን ሎተሪ)',
  telegramBot: '@' + BOT_USERNAME,
  supportHandle: '@' + OFFICIAL_ADMIN.supportUsername,
  adminPhone: OFFICIAL_ADMIN.phone,
  status: 'active',
  lotteries: [
    { title: 'ባለ 1,000 ብር ደራሽ', price: 10, jackpot: 1000 },
    { title: 'ባለ 5,000 ብር ደራሽ', price: 50, jackpot: 5000 },
    { title: 'ባለ 10,000 ብር ደራሽ', price: 100, jackpot: 10000 },
  ],
};

// ----------------------------------------------------
// Persistent Admin Chats Storage
// ----------------------------------------------------
const ADMIN_CHATS_FILE = path.join(__dirname, 'admin_chats.json');
let adminChatIds: number[] = [];

try {
  if (fs.existsSync(ADMIN_CHATS_FILE)) {
    const raw = fs.readFileSync(ADMIN_CHATS_FILE, 'utf-8');
    adminChatIds = JSON.parse(raw);
  }
} catch {
  adminChatIds = [];
}

function saveAdminChatIds() {
  try {
    fs.writeFileSync(ADMIN_CHATS_FILE, JSON.stringify(Array.from(new Set(adminChatIds)), null, 2));
  } catch (err) {
    console.error('[Save Admin Chats Error]', err);
  }
}

function addAdminChatId(chatId: number) {
  if (!adminChatIds.includes(chatId)) {
    adminChatIds.push(chatId);
    saveAdminChatIds();
    console.log(`[Admin Registered] Chat ID: ${chatId}. Total Admins: ${adminChatIds.length}`);
  }
}

// ----------------------------------------------------
// Persistent User Wallets Store (for Bot and Mini App)
// ----------------------------------------------------
export interface UserWallet {
  userId: string;
  phone: string;
  fullName: string;
  username?: string;
  profileImage?: string;
  walletBalance: number;
  ticketsCount: number;
  totalWon: number;
  language: 'am' | 'en';
}

const WALLETS_FILE = path.join(__dirname, 'wallets_store.json');
let userWallets: Record<string, UserWallet> = {};

try {
  if (fs.existsSync(WALLETS_FILE)) {
    userWallets = JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf-8'));
  }
} catch {
  userWallets = {};
}

function saveUserWallets() {
  try {
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(userWallets, null, 2));
  } catch (err) {
    console.error('[Save Wallets Error]', err);
  }
}

export function findOrCreateWallet(params: { userId?: string; phone?: string; telegramId?: string; fullName?: string; username?: string; profileImage?: string }): UserWallet {
  const { userId, phone, telegramId, fullName, username, profileImage } = params;
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  
  // 1. Direct match by key or existing wallet properties
  for (const [k, w] of Object.entries(userWallets)) {
    if (userId && (k === userId || w.userId === userId)) {
      if (cleanPhone && !w.phone) w.phone = cleanPhone;
      if (username && !w.username) w.username = username;
      if (profileImage && !w.profileImage) w.profileImage = profileImage;
      return w;
    }
    if (telegramId && (k === String(telegramId) || w.userId === String(telegramId))) {
      if (cleanPhone && !w.phone) w.phone = cleanPhone;
      if (username && !w.username) w.username = username;
      if (profileImage && !w.profileImage) w.profileImage = profileImage;
      return w;
    }
    if (cleanPhone && cleanPhone.length >= 9 && w.phone && w.phone.replace(/\D/g, '').includes(cleanPhone.slice(-9))) {
      if (username && !w.username) w.username = username;
      if (profileImage && !w.profileImage) w.profileImage = profileImage;
      return w;
    }
  }

  // 2. Create new wallet if not found
  const newKey = userId || (telegramId ? String(telegramId) : (cleanPhone ? `phone_${cleanPhone}` : `usr_${Date.now()}`));
  userWallets[newKey] = {
    userId: newKey,
    phone: phone || '',
    fullName: fullName || 'ተጠቃሚ',
    username: username || '',
    profileImage: profileImage || '',
    walletBalance: 200,
    ticketsCount: 0,
    totalWon: 0,
    language: 'am',
  };
  saveUserWallets();
  return userWallets[newKey];
}

function getOrCreateWallet(chatId: number, from?: any, phone?: string): UserWallet {
  const cleanPhone = phone || (from?.id === 8759844855 ? OFFICIAL_ADMIN.phone : '');
  const fullName = from?.first_name ? `${from.first_name} ${from.last_name || ''}`.trim() : 'ተጠቃሚ';
  const username = from?.username ? `@${from.username}` : '';
  return findOrCreateWallet({
    telegramId: String(chatId),
    userId: String(chatId),
    phone: cleanPhone,
    fullName,
    username,
  });
}

// ----------------------------------------------------
// User Interactive Step Tracker (for conversational deposit/withdraw)
// ----------------------------------------------------
const userConversationState: Record<string, { step: string; data?: any }> = {};

// ----------------------------------------------------
// Persistent Transaction Store & Sync
// ----------------------------------------------------
export interface SyncedTransaction {
  id: string;
  ticketId?: string;
  lotteryId?: string;
  lotteryTitleAm?: string;
  userId?: string;
  userName: string;
  userPhone: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'ticket_purchase' | 'prize_payout';
  paymentMethod: string;
  referenceNumber: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  approvedBy?: string;
  approvedAt?: string;
  source?: 'bot' | 'mini_app';
}

const TX_FILE = path.join(__dirname, 'transactions_store.json');
let syncedTransactions: SyncedTransaction[] = [];

try {
  if (fs.existsSync(TX_FILE)) {
    syncedTransactions = JSON.parse(fs.readFileSync(TX_FILE, 'utf-8'));
  }
} catch {
  syncedTransactions = [];
}

function saveTransactions() {
  try {
    fs.writeFileSync(TX_FILE, JSON.stringify(syncedTransactions.slice(0, 500), null, 2));
  } catch (err) {
    console.error('[Save Transactions Error]', err);
  }
}

// ----------------------------------------------------
// Persistent Support Messages Store
// ----------------------------------------------------
export interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: string;
  telegramMsgId?: number;
}

const SUPPORT_FILE = path.join(__dirname, 'support_messages.json');
let supportMessages: SupportMessage[] = [];

try {
  if (fs.existsSync(SUPPORT_FILE)) {
    supportMessages = JSON.parse(fs.readFileSync(SUPPORT_FILE, 'utf-8'));
  }
} catch {
  supportMessages = [];
}

function saveSupportMessages() {
  try {
    fs.writeFileSync(SUPPORT_FILE, JSON.stringify(supportMessages.slice(0, 300), null, 2));
  } catch (err) {
    console.error('[Save Support Messages Error]', err);
  }
}

// ----------------------------------------------------
// Telegram Reply Keyboards
// ----------------------------------------------------
function getMainMenuReplyKeyboard(isAdmin?: boolean, showPhoneShare?: boolean) {
  return {
    remove_keyboard: true,
  };
}

function getAdminReplyKeyboard() {
  return {
    remove_keyboard: true,
  };
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendTelegramResponse(chatId: number, text: string, replyMarkup?: any) {
  try {
    const isAdmin = adminChatIds.includes(chatId);
    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup !== undefined ? replyMarkup : (isAdmin ? getAdminReplyKeyboard() : getMainMenuReplyKeyboard(isAdmin)),
    };
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await res.json()) as any;
    if (!result?.ok) {
      const desc = result?.description || '';
      // When chat is not found or bot hasn't been started by this user, do not retry with plain text
      if (desc.includes('chat not found') || desc.includes('blocked') || desc.includes('deactivated') || desc.includes('chat_id is empty')) {
        console.info(`[Telegram Notification Skipped: chat ${chatId} has not started the bot yet]`);
        if (adminChatIds.includes(chatId)) {
          adminChatIds = adminChatIds.filter(id => id !== chatId);
          saveAdminChatIds();
        }
        return result;
      }

      console.warn(`[Send Telegram Message HTML failed for chat ${chatId}]:`, desc);
      const plainText = text.replace(/<[^>]*>?/gm, '');
      const fallbackBody = {
        chat_id: chatId,
        text: plainText,
        reply_markup: body.reply_markup,
      };
      const fallbackRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackBody),
      });
      return await fallbackRes.json();
    }
    return result;
  } catch (err) {
    console.error('[Send Telegram Message Error]', err);
    return null;
  }
}

async function editTelegramMessage(chatId: number, messageId: number, text: string, inlineKeyboard?: any) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard ? inlineKeyboard : { inline_keyboard: [] },
      }),
    });
    const result = (await res.json()) as any;
    if (!result?.ok) {
      const desc = result?.description || '';
      if (desc.includes('chat not found') || desc.includes('message to edit not found')) {
        return;
      }
      console.warn(`[Edit Telegram Message HTML failed for chat ${chatId}]:`, desc);
      const plainText = text.replace(/<[^>]*>?/gm, '');
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: plainText,
          reply_markup: inlineKeyboard ? inlineKeyboard : { inline_keyboard: [] },
        }),
      });
    }
  } catch (err) {
    console.error('[Edit Telegram Message Error]', err);
  }
}

async function answerTelegramCallback(callbackQueryId: string, text?: string, showAlert?: boolean) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert || false,
      }),
    });
  } catch (err) {
    console.error('[Answer Callback Error]', err);
  }
}

async function notifyAllAdmins(text: string, inlineKeyboard?: any) {
  if (adminChatIds.length === 0) {
    return [];
  }

  const results = [];
  const currentAdmins = [...adminChatIds];
  for (const chatId of currentAdmins) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard,
        }),
      });
      const data = (await res.json()) as any;
      if (data.ok) {
        results.push({ chatId, messageId: data.result.message_id });
      } else {
        const desc = data.description || '';
        if (desc.includes('chat not found') || desc.includes('blocked') || desc.includes('deactivated')) {
          console.info(`[Admin chat ${chatId} unavailable]: ${desc} (removed from active broadcasts)`);
          adminChatIds = adminChatIds.filter(id => id !== chatId);
          saveAdminChatIds();
        }
      }
    } catch (err) {
      console.error(`[Notify Admin ${chatId} Error]`, err);
    }
  }
  return results;
}

function isAuthorizedAdmin(chatId: number, from?: any, phoneOrPass?: string): boolean {
  if (adminChatIds.includes(chatId)) return true;

  if (from?.id && (from.id === 5588110290 || String(from.id) === '5588110290' || from.id === 8759844855 || String(from.id) === '8759844855')) {
    addAdminChatId(chatId);
    return true;
  }

  if (from?.username && (
    from.username.toLowerCase() === 'lij_makbel' ||
    from.username.toLowerCase() === 'makbel_maregu'
  )) {
    addAdminChatId(chatId);
    return true;
  }

  const wallet = userWallets[String(chatId)];
  if (wallet?.phone && wallet.phone.replace(/\s+/g, '').includes('0910961881')) {
    addAdminChatId(chatId);
    return true;
  }

  if (phoneOrPass) {
    const clean = phoneOrPass.trim().toLowerCase().replace(/[\s-]/g, '');
    if (
      clean.includes('0910961881') ||
      clean.includes('251910961881') ||
      clean.includes('office_makbel_admin') ||
      clean.includes('2728')
    ) {
      addAdminChatId(chatId);
      return true;
    }
  }

  return false;
}

async function sendTransactionsOverview(chatId: number, filter: 'all' | 'deposit' | 'withdrawal' | 'pending' = 'all') {
  let list = syncedTransactions;
  let title = '📋 <b>ሁሉም የጋሸና ሎተሪ ገቢና ወጪ ግብይቶች (All Transactions)</b>';

  if (filter === 'deposit') {
    list = syncedTransactions.filter(t => t.type === 'deposit');
    title = '📥 <b>ሁሉም የዋሌት ገቢ ግብይቶች (Deposits)</b>';
  } else if (filter === 'withdrawal') {
    list = syncedTransactions.filter(t => t.type === 'withdrawal');
    title = '📤 <b>ሁሉም የብር ማውጫ ግብይቶች (Withdrawals)</b>';
  } else if (filter === 'pending') {
    list = syncedTransactions.filter(t => t.status === 'pending');
    title = '⏳ <b>ውሳኔ የሚጠብቁ ክፍያዎች (Pending Approvals)</b>';
  }

  const depSum = syncedTransactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const wthSum = syncedTransactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const pendingCount = syncedTransactions.filter(t => t.status === 'pending').length;

  let msg = `${title}\n━━━━━━━━━━━━━━━━━━━━\n` +
    `📥 <b>የጸደቀ ገቢ፦</b> <b>${depSum.toLocaleString()} ብር</b>\n` +
    `📤 <b>የተከፈለ ወጪ፦</b> <b>${wthSum.toLocaleString()} ብር</b>\n` +
    `⏳ <b>የሚጠብቁ፦</b> <b>${pendingCount}</b> | 🔢 <b>ጠቅላላ፦</b> <b>${syncedTransactions.length}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (list.length === 0) {
    msg += `<i>በዚህ ምድብ ውስጥ የተመዘገበ ምንም ግብይት የለም።</i>`;
  } else {
    for (const tx of list.slice(0, 10)) {
      const isDep = tx.type === 'deposit';
      const isWth = tx.type === 'withdrawal';
      const icon = isDep ? '📥 ገቢ' : (isWth ? '📤 ወጪ' : '🎟️ ትኬት');
      const stBadge = tx.status === 'completed' ? '✅ የጸደቀ' : (tx.status === 'pending' ? '⏳ የሚጠብቅ' : '❌ ውድቅ የተደረገ');
      const timeStr = new Date(tx.timestamp).toLocaleString('am-ET', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      msg += `${icon}፦ <b>${tx.amount.toLocaleString()} ብር</b> (${stBadge})\n` +
        `👤 <b>ደንበኛ፦</b> ${escapeHtml(tx.userName)} (<code>${escapeHtml(tx.userPhone || 'የለም')}</code>)\n` +
        `🔢 <b>ሪፈረንስ፦</b> <code>${escapeHtml(tx.referenceNumber)}</code>\n` +
        `⏱️ <b>ሰዓት፦</b> ${timeStr}\n` +
        `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    }
  }

  const ik = {
    inline_keyboard: [
      [
        { text: filter === 'all' ? '🔘 ሁሉም' : 'ሁሉም', callback_data: 'txfilter_all' },
        { text: filter === 'deposit' ? '🔘 📥 ገቢዎች' : '📥 ገቢዎች', callback_data: 'txfilter_deposit' },
      ],
      [
        { text: filter === 'withdrawal' ? '🔘 📤 ወጪዎች' : '📤 ወጪዎች', callback_data: 'txfilter_withdrawal' },
        { text: filter === 'pending' ? `🔘 ⏳ የሚጠብቁ (${pendingCount})` : `⏳ የሚጠብቁ (${pendingCount})`, callback_data: 'txfilter_pending' },
      ],
      [
        { text: '🎰 ጋሸና ሎተሪ ክፈት (Open Mini App)', url: APP_URL },
      ],
    ],
  };

  await sendTelegramResponse(chatId, msg, ik);

  if (filter === 'pending' && list.length > 0) {
    for (const tx of list.slice(0, 5)) {
      const isDep = tx.type === 'deposit';
      const cardMsg =
        `${isDep ? '📥 <b>የዋሌት ገቢ ማጽደቂያ (Deposit Approval)</b>' : '📤 <b>የብር ማውጫ ማጽደቂያ (Withdrawal Approval)</b>'}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>ደንበኛ፦</b> <b>${tx.userName}</b>\n` +
        `📱 <b>ስልክ፦</b> <code>${tx.userPhone}</code>\n` +
        `💵 <b>መጠን፦</b> <b>${tx.amount.toLocaleString()} ብር (ETB)</b>\n` +
        `💳 <b>መንገድ፦</b> ${tx.paymentMethod.toUpperCase()}\n` +
        `🔢 <b>ሪፈረንስ፦</b> <code>${tx.referenceNumber}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>ዋና አስተዳዳሪ (0910961881) ከታች ባሉት ቁልፎች ይወስኑ፦</i>`;

      const approvalKeyboard = {
        inline_keyboard: [
          [
            { text: '✅ አጽድቅ (Approve)', callback_data: `appr:${tx.id}` },
            { text: '❌ ውድቅ አድርግ (Reject)', callback_data: `rejc:${tx.id}` },
          ],
        ],
      };

      await sendTelegramResponse(chatId, cardMsg, approvalKeyboard);
    }
  }
}

async function handleTelegramMessage(message: any) {
  try {
    const chatId = message.chat?.id;
    if (!chatId) return;

    const from = message.from;
    const text = (message.text || '').trim();
    const contact = message.contact;
    const firstName = from?.first_name || 'ተጠቃሚ';

    let detectedPhone = contact?.phone_number ? contact.phone_number.replace(/\D/g, '') : null;
    if (!detectedPhone && text) {
      const cleanDigits = text.replace(/[\s-+]/g, '');
      const m = cleanDigits.match(/^(?:251|0)?([79]\d{8})$/);
      if (m) {
        detectedPhone = '0' + m[1];
      }
    }

    if (detectedPhone) {
      let cleanPhone = detectedPhone;
      if (cleanPhone.startsWith('251')) {
        cleanPhone = '0' + cleanPhone.slice(3);
      } else if (cleanPhone.startsWith('9') || cleanPhone.startsWith('7')) {
        cleanPhone = '0' + cleanPhone;
      }

      const wallet = getOrCreateWallet(chatId, from, cleanPhone);
      wallet.phone = cleanPhone;
      if (from?.username) wallet.username = `@${from.username}`;
      if (from?.first_name) {
        wallet.fullName = `${from.first_name} ${from.last_name || ''}`.trim();
      }
      saveUserWallets();

      if (cleanPhone.includes('910961881')) {
        addAdminChatId(chatId);
        await sendTelegramResponse(
          chatId,
          `👑 <b>እንኳን ደህና መጡ ዋና አስተዳዳሪ (0910961881)!</b>\n\nእርስዎ የጋሸና ኦንላይን ሎተሪ ዋና አስተዳዳሪ ሆነው በተሳካ ሁኔታ ተመዝግበዋል። ደንበኞች ገቢ እና ወጪ ሲያደርጉ እዚህ ጋር ወዲያውኑ ማሳወቂያ ይደርስዎታል፤ በአንድ ጠቅታ ማጽደቅ ወይም ውድቅ ማድረግ ይችላሉ!`,
          getAdminReplyKeyboard()
        );
        return;
      }

      const registeredMsg =
        `✅ <b>ስልክ ቁጥርዎ (<code>${cleanPhone}</code>) በተሳካ ሁኔታ ተመዝግቧል! 🎉</b>\n\n` +
        `👤 <b>መለያ፦</b> <b>${wallet.fullName}</b> ${wallet.username ? `(${wallet.username})` : ''}\n` +
        `📱 <b>የተረጋገጠ ስልክ፦</b> <code>${cleanPhone}</code>\n` +
        `💰 <b>የመነሻ ዋሌት ቀሪ ሂሳብ፦</b> <b>${wallet.walletBalance.toLocaleString()} ብር</b>\n\n` +
        `አሁን የጋሸና ኦንላይን ሎተሪ ሚኒ አፕን መክፈት፣ ዋሌትዎን መሙላትና መጫወት ይችላሉ! 👇`;

      const ik = {
        inline_keyboard: [
          [
            { text: '🎰 ጋሸና ሎተሪ ሚኒ አፕ ክፈት (Open Mini App)', url: APP_URL },
          ],
          [
            { text: '💵 ገቢ አድርግ (Deposit)', callback_data: 'menu_deposit' },
            { text: '✅ ትኬት ቁረጥ (Buy Ticket)', callback_data: 'menu_tickets' },
          ],
        ],
      };

      await sendTelegramResponse(chatId, registeredMsg, getMainMenuReplyKeyboard());
      await sendTelegramResponse(chatId, `🚀 <b>ሚኒ አፑን ከፍተው ፕሮፋይልዎንና የሎተሪ ዕጣዎችን ይመልከቱ፦</b>`, ik);
      return;
    }

    const wallet = getOrCreateWallet(chatId, from);
    const isAdmin = isAuthorizedAdmin(chatId, from, text);
    const hasPhone = Boolean(wallet.phone && wallet.phone.replace(/\D/g, '').length >= 9 && !wallet.phone.includes('በቦት'));
    const showPhoneShare = !isAdmin && !hasPhone;

    if (message.reply_to_message && isAdmin) {
      const repliedText = message.reply_to_message.text || '';
      const phoneMatch = repliedText.match(/(?:ስልክ|Phone)፦?\s*(\+?251[0-9\s]+|09[0-9\s]+)/i);
      const targetPhone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '') : '';

      const newSupportReply: SupportMessage = {
        id: 'sup_adm_' + Date.now(),
        userId: targetPhone || 'user',
        userName: 'Admin (0910961881)',
        userPhone: targetPhone,
        sender: 'admin',
        text: text,
        timestamp: new Date().toISOString(),
      };

      supportMessages.push(newSupportReply);
      saveSupportMessages();

      await sendTelegramResponse(
        chatId,
        `✅ <b>መልስዎ ለደንበኛው ተልኳል!</b>\n\n📝 <b>የተላከው መልስ፦</b> <i>"${text}"</i>`,
        getAdminReplyKeyboard()
      );
      return;
    }

    const ikOpen = {
      inline_keyboard: [
        [
          { text: 'OPEN', url: APP_URL },
        ],
      ],
    };
    await sendTelegramResponse(
      chatId,
      `👇 <b>እባክዎ መተግበሪያውን ለመክፈት ከታች ያለውን ይጫኑ፦</b>`,
      ikOpen
    );
    return;

    if (text === '/start' || text.startsWith('/start')) {
      let welcomeMsg =
        `🎉 <b>እንኳን ወደ ጋሸና ኦንላይን ሎተሪ (Gaashena Online Lottery) በደህና መጡ!</b> 🇪🇹\n\n` +
        `በኢትዮጵያ ውስጥ ቀዳሚና አስተማማኝ የኦንላይን ሎተሪ መድረክ።\n\n` +
        `🌟 <b>ዕለታዊ የደራሽ ሎተሪዎች፦</b>\n` +
        `• 🎫 <b>ባለ 1,000 ብር ደራሽ</b> — በ 10 ብር ብቻ\n` +
        `• 🎫 <b>ባለ 5,000 ብር ደራሽ</b> — በ 50 ብር ብቻ\n` +
        `• 🎫 <b>ባለ 10,000 ብር ደራሽ</b> — በ 100 ብር ብቻ\n\n` +
        `💳 <b>ክፍያዎችን በቀላሉ በቴሌብር (0910961881) እና ሲቢኢ መፈጸም ይችላሉ።</b>\n\n` +
        `👇 <b>ከታች ያሉትን የሜኑ አዝራሮች በመጫን ወዲያውኑ ይጀምሩ!</b>\n\n` +
        `💡 <b>ማስታወሻ፦</b> ያሸነፉትን ሽልማት በቀጥታ ለመቀበል ከታች «📱 ስልክ ቁጥርዎን ያጋሩ» የሚለውን ይጫኑ ወይም ስልክዎን ይላኩ።`;

      const ik = {
        inline_keyboard: [
          [
            { text: 'OPEN', url: APP_URL },
          ],
        ],
      };

      await sendTelegramResponse(chatId, welcomeMsg, ik);

      if (isAdmin) {
        addAdminChatId(chatId);
        const pendingCount = syncedTransactions.filter(t => t.status === 'pending').length;
        const depSum = syncedTransactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
        const wthSum = syncedTransactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);

        const adminBrief =
          `👑 <b>እንኳን ደህና መጡ ዋና አስተዳዳሪ (0910961881 / @lij_makbel)!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📥 <b>የጸደቀ ገቢ፦</b> <b>${depSum.toLocaleString()} ብር</b>\n` +
          `📤 <b>የተከፈለ ወጪ፦</b> <b>${wthSum.toLocaleString()} ብር</b>\n` +
          `⏳ <b>ውሳኔ የሚጠብቁ፦</b> <b>${pendingCount} ጥያቄዎች</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `ክፍያዎችን በቀጥታ ለማጽደቅ ወይም ውድቅ ለማድረግ «⏳ የሚጠብቁ ክፍያዎች» የሚለውን ይጫኑ!`;

        await sendTelegramResponse(chatId, adminBrief, { remove_keyboard: true });
      }
      return;
    }

    if (text === '✅ ትኬት ቁረጥ' || text === '/play' || text === 'ትኬት' || text.toLowerCase() === 'play') {
      const ticketMsg =
        `🎫 <b>የጋሸና ኦንላይን ሎተሪ ዕጣዎች (Active Lotteries)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `1️⃣ <b>ባለ 1,000 ብር ደራሽ</b>\n` +
        `   • ዋጋ፦ <b>10 ብር ብቻ</b>\n` +
        `   • ጃክፖት፦ <b>1,000 ብር</b>\n\n` +
        `2️⃣ <b>ባለ 5,000 ብር ደራሽ</b>\n` +
        `   • ዋጋ፦ <b>50 ብር ብቻ</b>\n` +
        `   • ጃክፖት፦ <b>5,000 ብር</b>\n\n` +
        `3️⃣ <b>ባለ 10,000 ብር ደራሽ</b>\n` +
        `   • ዋጋ፦ <b>100 ብር ብቻ</b>\n` +
        `   • ጃክፖት፦ <b>10,000 ብር</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 <i>ትኬትዎን ለመቁረጥ እና የዕድል ቁጥሮችዎን ለመምረጥ ከታች «🎰 ጋሸና ሎተሪ ክፈት» የሚለውን ይጫኑ!</i>`;

      const ik = {
        inline_keyboard: [
          [
            { text: '🎰 ጋሸና ሎተሪ ክፈት (Play Now)', url: APP_URL },
          ],
          [
            { text: '💵 መጀመሪያ ዋሌት ሙላ (ገቢ)', callback_data: 'menu_deposit' },
            { text: '💰 ቀሪ ሂሳብ እይ', callback_data: 'menu_balance' },
          ],
        ],
      };

      await sendTelegramResponse(chatId, ticketMsg, ik);
      return;
    }

    if (
      text === '📜 ሁሉም ገቢና ወጪዎች' ||
      text === '📜 ሁሉም ገቢና ወጪዎች (All Transactions)' ||
      text === '/transactions' ||
      text === '/history' ||
      text === 'ግብይቶች' ||
      text.includes('ገቢና ወጪ') ||
      text.includes('ግብይት')
    ) {
      await sendTransactionsOverview(chatId, 'all');
      return;
    }

    const isDepositCmd =
      text === '💵 ገቢ አድርግ (ገቢ)' ||
      text === '💵 ገቢ አድርግ' ||
      text === 'ገቢ' ||
      text === 'ገቢ አድርግ' ||
      text === '/deposit' ||
      text.toLowerCase() === 'deposit' ||
      (text.includes('ገቢ') && !text.includes('ወጪ'));

    if (isDepositCmd) {
      const depositMsg =
        `💵 <b>የዋሌት ሂሳብ መሙያ (Deposit Instructions)</b> 🇪🇹\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `የሚፈልጉትን የገንዘብ መጠን ወደ አንዱ የክፍያ አካውንታችን ያስገቡ፦\n\n` +
        `👤 <b>የተቀባይ ስም፦</b> <b>${OFFICIAL_ADMIN.fullName}</b>\n\n` +
        `📱 <b>ቴሌብር (Telebirr)፦</b>\n` +
        `👉 <code>${OFFICIAL_ADMIN.telebirr}</code> (ኮፒ ለማድረግ ነካ ያድርጉት)\n\n` +
        `🏦 <b>ሲቢኢ (CBE Account)፦</b>\n` +
        `👉 <code>${OFFICIAL_ADMIN.cbeAccount}</code> (ኮፒ ለማድረግ ነካ ያድርጉት)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>ዝቅተኛ ገቢ፦</b> <b>10 ብር</b>\n\n` +
        `✅ ክፍያ ከፈጸሙ በኋላ የደረሰዎትን <b>የክፍያ ማረጋገጫ ቁጥር (Transaction Reference/SMS)</b> ወይም የደረሰኝ ጽሑፍ እዚህ ይላኩልን፤ አስተዳዳሪው (${OFFICIAL_ADMIN.phone}) አረጋግጦ ወዲያውኑ ወደ ዋሌትዎ ገቢ ያደርጋል!\n\n` +
        `<i>(ወይም ከታች በሚኒ አፑ በቀጥታ መሙላት ይችላሉ)</i>`;

      userConversationState[String(chatId)] = { step: 'awaiting_deposit_ref', data: { amount: 50, method: 'telebirr' } };

      const ik = {
        inline_keyboard: [
          [
            { text: '🎰 በ ሚኒ አፕ በቀጥታ ገቢ አድርግ', url: APP_URL },
          ],
          [
            { text: '📜 ሁሉም ገቢና ወጪዎች እይ', callback_data: 'txfilter_all' },
            { text: '💬 ድጋፍ ጠይቅ (@lij_makbel)', url: 'https://t.me/lij_makbel' },
          ],
        ],
      };

      await sendTelegramResponse(chatId, depositMsg, ik);
      return;
    }

    const isWithdrawCmd =
      text === '💸 ገንዘብ አውጣ (ወጪ)' ||
      text === '💸 ገንዘብ አውጣ' ||
      text === 'ወጪ' ||
      text === 'ገንዘብ አውጣ' ||
      text === 'ብር አውጣ' ||
      text === '/withdraw' ||
      text.toLowerCase() === 'withdraw' ||
      (text.includes('ወጪ') && !text.includes('ገቢ'));

    if (isWithdrawCmd) {
      const withdrawMsg =
        `💸 <b>የገንዘብ ማውጫ (Withdrawal Request)</b> 🇪🇹\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 <b>የእርስዎ የአሁን ቀሪ ሂሳብ፦</b> <b>${wallet.walletBalance.toLocaleString()} ብር</b>\n\n` +
        `📌 <b>ደንቦች፦</b>\n` +
        `• ዝቅተኛ ማውጣት፦ <b>50 ብር</b>\n` +
        `• ክፍያ የሚፈጸመው በቴሌብር ወደ ስልክዎ ነው\n` +
        `• አስተዳዳሪው (0910961881) ጥያቄዎን እንዳየ በቅጽበት ይልካል\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `እባክዎ <b>የሚፈልጉትን መጠን እና የቴሌብር ስልክዎን</b> በመልዕክት ይላኩልን (ለምሳሌ፦ <code>100 0910961881</code>) ወይም በሚኒ አፑ በቀጥታ ያውጡ፦`;

      userConversationState[String(chatId)] = { step: 'awaiting_withdraw_details' };

      const ik = {
        inline_keyboard: [
          [
            { text: '💸 በሚኒ አፕ ብር አውጣ (ፈጣን)', url: APP_URL },
          ],
          [
            { text: '📜 ሁሉም ገቢና ወጪዎች እይ', callback_data: 'txfilter_all' },
            { text: '💬 ድጋፍ ጠይቅ (@lij_makbel)', url: 'https://t.me/lij_makbel' },
          ],
        ],
      };

      await sendTelegramResponse(chatId, withdrawMsg, ik);
      return;
    }

    if (text === '💰 ቀሪ ሂሳብ' || text === '/balance' || text === 'ሂሳብ') {
      const balMsg =
        `💰 <b>የዋሌት ቀሪ ሂሳብ</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>ተጠቃሚ፦</b> <b>${wallet.fullName}</b>\n` +
        `💵 <b>የአሁን ቀሪ ሂሳብ፦</b> <b>${wallet.walletBalance.toLocaleString()} ብር (ETB)</b>\n` +
        `🎟️ <b>የተቆረጡ ቲኬቶች፦</b> <b>${wallet.ticketsCount} ቲኬት</b>\n` +
        `🏆 <b>ያሸነፉት አጠቃላይ መጠን፦</b> <b>${wallet.totalWon.toLocaleString()} ብር</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `ቀሪ ሂሳብዎን ለመሙላት «💵 ገቢ አድርግ» ወይም ሎተሪ ለመቁረጥ «✅ ትኬት ቁረጥ» የሚለውን ይጫኑ!`;

      const ik = {
        inline_keyboard: [
          [
            { text: '💵 ገቢ አድርግ', callback_data: 'menu_deposit' },
            { text: '💸 ገንዘብ አውጣ', callback_data: 'menu_withdraw' },
          ],
          [
            { text: '🎰 ጋሸና ሎተሪ ክፈት', url: APP_URL },
          ],
        ],
      };

      await sendTelegramResponse(chatId, balMsg, ik);
      return;
    }

    if (text === '👤 ፕሮፋይል' || text === '/profile') {
      const profMsg =
        `👤 <b>የተጠቃሚ ፕሮፋይል (User Profile)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>ቴሌግራም መለያ፦</b> <code>${chatId}</code>\n` +
        `👤 <b>ሙሉ ስም፦</b> <b>${wallet.fullName}</b>\n` +
        `📱 <b>ስልክ፦</b> <code>${wallet.phone || 'ያልተመዘገበ'}</code>\n` +
        `💰 <b>ቀሪ ሂሳብ፦</b> <b>${wallet.walletBalance.toLocaleString()} ብር</b>\n` +
        `🌐 <b>ቋንቋ፦</b> አማርኛ (Amharic)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👑 <b>ዋና አስተዳዳሪ፦</b> <code>${OFFICIAL_ADMIN.phone}</code>\n` +
        `💬 <b>ድጋፍ ሰጪ፦</b> @${OFFICIAL_ADMIN.supportUsername}`;

      const ik = {
        inline_keyboard: [
          [
            { text: '🎰 ዳሽቦርድ ክፈት', url: APP_URL },
          ],
        ],
      };

      await sendTelegramResponse(chatId, profMsg, ik);
      return;
    }

    if (text === '💬 ድጋፍ' || text === '/support' || text.toLowerCase().includes('help')) {
      const supportMsg =
        `💬 <b>የጋሸና ኦንላይን ሎተሪ የደንበኞች ድጋፍ መስመር</b> 🇪🇹\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `ለማንኛውም አይነት ጥያቄ፣ የክፍያ ማረጋገጫ ወይም ድጋፍ ከታች ባለው የቴሌግራም አካውንት በቀጥታ ያነጋግሩን፦\n\n` +
        `👤 <b>ይፋዊ የድጋፍ መለያ፦</b> <b>@${OFFICIAL_ADMIN.supportUsername}</b>\n` +
        `📱 <b>የአስተዳዳሪ ስልክ፦</b> <code>${OFFICIAL_ADMIN.phone}</code>\n` +
        `⏰ <b>የአገልግሎት ሰዓት፦</b> 24/7 ሁልጊዜ ክፍት\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `በቀጥታ ለማውራት ከታች ያለውን ቁልፍ ይጫኑ፦`;

      const ik = {
        inline_keyboard: [
          [
            { text: '💬 @lij_makbel በቀጥታ አውራ', url: `https://t.me/${OFFICIAL_ADMIN.supportUsername}` },
          ],
          [
            { text: '🎰 ጋሸና ሎተሪ ክፈት', url: APP_URL },
          ],
        ],
      };

      await sendTelegramResponse(chatId, supportMsg, ik);
      return;
    }

    if (text === '🌐 ቋንቋ' || text === '/language') {
      const langMsg =
        `🌐 <b>ቋንቋ ይምረጡ / Choose Language</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `የሚፈልጉትን ቋንቋ ይምረጡ፦\n` +
        `• 🇪🇹 <b>አማርኛ (Amharic)</b> — ነባሪ\n` +
        `• 🇬🇧 <b>English</b>`;

      const ik = {
        inline_keyboard: [
          [
            { text: '🇪🇹 አማርኛ (Amharic) ✓', callback_data: 'lang_am' },
            { text: '🇬🇧 English', callback_data: 'lang_en' },
          ],
        ],
      };

      await sendTelegramResponse(chatId, langMsg, ik);
      return;
    }

    if (text === '/admin' || text === '👑 አስተዳዳሪ' || text === '👑 የአስተዳዳሪ ክፍል (0910961881)' || text.toLowerCase().includes('office_makbel_admin') || text.includes('0910961881')) {
      if (!isAdmin) {
        await sendTelegramResponse(
          chatId,
          `🔒 <b>ይቅርታ!</b> የአስተዳዳሪ ፓነል ለዋና አስተዳዳሪ (${OFFICIAL_ADMIN.phone}) ብቻ የተፈቀደ ነው።`,
          getMainMenuReplyKeyboard()
        );
        return;
      }

      addAdminChatId(chatId);
      const pendingDeposits = syncedTransactions.filter((t) => t.status === 'pending' && t.type === 'deposit');
      const pendingWithdrawals = syncedTransactions.filter((t) => t.status === 'pending' && t.type === 'withdrawal');

      const adminWelcome =
        `👑 <b>ሰላም ማክቤል (0910961881) — የአስተዳዳሪ ፓነል!</b> 🇪🇹\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📥 <b>የሚጠብቁ ገቢዎች፦</b> <b>${pendingDeposits.length}</b>\n` +
        `📤 <b>የሚጠብቁ ወጪዎች፦</b> <b>${pendingWithdrawals.length}</b>\n` +
        `👤 <b>ይፋዊ ድጋፍ፦</b> @${OFFICIAL_ADMIN.supportUsername}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `ክፍያዎችን ለማጽደቅ ከታች «⏳ የሚጠብቁ ክፍያዎች» የሚለውን ይጫኑ!`;

      await sendTelegramResponse(chatId, adminWelcome, getAdminReplyKeyboard());
      return;
    }

    if (text === '⏳ የሚጠብቁ ክፍያዎች (Pending Approvals)' || text === '⏳ የሚጠብቁ ክፍያዎች' || text === '/pending') {
      if (!isAdmin) {
        await sendTelegramResponse(chatId, `🔒 ለዋና አስተዳዳሪ ብቻ የተፈቀደ!`, getMainMenuReplyKeyboard());
        return;
      }

      const pendingList = syncedTransactions.filter((t) => t.status === 'pending');
      if (pendingList.length === 0) {
        await sendTelegramResponse(
          chatId,
          `✅ <b>በአሁኑ ሰዓት ማጽደቂያ የሚጠብቅ ምንም ክፍያ የለም!</b>\n\nሁሉም ገቢዎችና ወጪዎች ተስተናግደዋል። አዲስ ሲመጣ ወዲያውኑ ማሳወቂያ ይደርስዎታል!`,
          getAdminReplyKeyboard()
        );
        return;
      }

      await sendTelegramResponse(
        chatId,
        `⏳ <b>በአጠቃላይ ${pendingList.length} ማጽደቂያ የሚጠብቁ ክፍያዎች አሉ፦</b>`,
        getAdminReplyKeyboard()
      );

      for (const tx of pendingList.slice(0, 5)) {
        const isDep = tx.type === 'deposit';
        const msg =
          `${isDep ? '📥 <b>የዋሌት ገቢ (Deposit)</b>' : '📤 <b>የብር ማውጫ (Withdrawal)</b>'}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>ደንበኛ፦</b> <b>${tx.userName}</b>\n` +
          `📱 <b>ስልክ፦</b> <code>${tx.userPhone}</code>\n` +
          `💵 <b>መጠን፦</b> <b>${tx.amount.toLocaleString()} ብር</b>\n` +
          `💳 <b>መንገድ፦</b> ${tx.paymentMethod.toUpperCase()}\n` +
          `🔢 <b>ሪፈረንስ፦</b> <code>${tx.referenceNumber}</code>`;

        const ik = {
          inline_keyboard: [
            [
              { text: '✅ አጽድቅ (Approve)', callback_data: `appr:${tx.id}` },
              { text: '❌ ውድቅ አድርግ (Reject)', callback_data: `rejc:${tx.id}` },
            ],
          ],
        };
        await sendTelegramResponse(chatId, msg, ik);
      }
      return;
    }

    if (text === '📊 የቢሮ ሁኔታ (Office Status)' || text === '/status') {
      if (!isAdmin) {
        await sendTelegramResponse(chatId, `🔒 ለዋና አስተዳዳሪ ብቻ የተፈቀደ!`, getMainMenuReplyKeyboard());
        return;
      }

      const pendingDeposits = syncedTransactions.filter((t) => t.status === 'pending' && t.type === 'deposit');
      const pendingWithdrawals = syncedTransactions.filter((t) => t.status === 'pending' && t.type === 'withdrawal');
      const completedCount = syncedTransactions.filter((t) => t.status === 'completed').length;

      const statusMsg =
        `📊 <b>የጋሸና ኦንላይን ሎተሪ — የቢሮ ሁኔታ ሪፖርት</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📥 <b>የሚጠብቁ ገቢዎች፦</b> <b>${pendingDeposits.length}</b>\n` +
        `📤 <b>የሚጠብቁ ወጪዎች፦</b> <b>${pendingWithdrawals.length}</b>\n` +
        `✅ <b>የጸደቁ አጠቃላይ ግብይቶች፦</b> <b>${completedCount}</b>\n` +
        `👤 <b>ዋና አስተዳዳሪ ስልክ፦</b> <code>0910961881</code>\n` +
        `💬 <b>ይፋዊ ድጋፍ፦</b> @${OFFICIAL_ADMIN.supportUsername}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ ደንበኞች ገንዘብ ሲያስገቡና ሲያወጡ እዚህ ወዲያውኑ ማሳወቂያ ይደርስዎታል!`;

      await sendTelegramResponse(chatId, statusMsg, getAdminReplyKeyboard());
      return;
    }

    if (
      text === '📜 ሁሉም ገቢና ወጪዎች (All Transactions)' ||
      text === '📜 ሁሉም ገቢና ወጪዎች' ||
      text === '/transactions' ||
      text === '/history' ||
      text === 'ግብይቶች' ||
      text.includes('ገቢና ወጪ') ||
      text.includes('ግብይት')
    ) {
      await sendTransactionsOverview(chatId, 'all');
      return;
    }

    if (text === '🔄 ወደ ተጠቃሚ ሜኑ ተመለስ') {
      await sendTelegramResponse(chatId, `✅ ወደ ተጠቃሚ ሜኑ ተመልሰዋል፦`, getMainMenuReplyKeyboard());
      return;
    }

    if (text === '🎰 ጋሸና ሎተሪ ክፈት') {
      await sendTelegramResponse(chatId, `🎰 <b>የጋሸና ኦንላይን ሎተሪ ሚኒ አፕ ለመክፈት ከታች ያለውን ይጫኑ፦</b>`, {
        inline_keyboard: [
          [{ text: '🎰 ጋሸና ሎተሪ ክፈት', url: APP_URL }],
        ],
      });
      return;
    }

    const fallbackMsg =
      `ሰላም <b>${firstName}</b>! እንኳን ወደ ጋሸና ኦንላይን ሎተሪ በደህና መጡ።\n\n` +
      `ከታች ያሉትን የሜኑ አዝራሮች በመጠቀም መጫወት ይችላሉ፦\n` +
      `• ✅ ትኬት ቁረጥ\n` +
      `• 💵 ገቢ አድርግ (ገቢ)\n` +
      `• 💸 ገንዘብ አውጣ (ወጪ)\n` +
      `• 💰 ቀሪ ሂሳብ\n` +
      `• 👤 ፕሮፋይል\n` +
      `• 💬 ድጋፍ (@lij_makbel)\n\n` +
      `አስተዳዳሪ፦ <code>0910961881</code>`;

    await sendTelegramResponse(chatId, fallbackMsg, isAdmin ? getAdminReplyKeyboard() : getMainMenuReplyKeyboard());
  } catch (e) {
    console.error('[Telegram Message Error]', e);
  }
}

async function handleTelegramCallback(callbackQuery: any) {
  try {
    const callbackId = callbackQuery.id;
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;
    const firstName = callbackQuery.from?.first_name || 'Admin';

    if (data.startsWith('appr:') || data.startsWith('rejc:')) {
      const isApprove = data.startsWith('appr:');
      const txId = data.replace(/^appr:|^rejc:/, '');

      const callerFrom = callbackQuery.from;
      if (!isAuthorizedAdmin(chatId, callerFrom)) {
        await answerTelegramCallback(
          callbackId,
          '⚠️ ይቅርታ፣ ይህንን ክፍያ የማጽደቅ ወይም ውድቅ የማድረግ ፈቃድ ያለው ዋና አስተዳዳሪ (0910961881) ብቻ ነው!',
          true
        );
        return;
      }

      const tx = syncedTransactions.find((t) => t.id === txId);

      if (tx) {
        tx.status = isApprove ? 'completed' : 'failed';
        tx.approvedBy = `${firstName} (0910961881)`;
        tx.approvedAt = new Date().toISOString();
        saveTransactions();

        const userWallet = findOrCreateWallet({ userId: tx.userId, phone: tx.userPhone, fullName: tx.userName });
        if (tx.type === 'deposit') {
          if (isApprove) {
            userWallet.walletBalance += Number(tx.amount);
          }
        } else if (tx.type === 'withdrawal') {
          if (!isApprove) {
            userWallet.walletBalance += Number(tx.amount);
          }
        }
        saveUserWallets();

        const customerChatId = Number(tx.userId);
        if (!isNaN(customerChatId) && customerChatId > 0 && customerChatId !== chatId) {
          const userNotif = isApprove
            ? (tx.type === 'deposit'
                ? `🎉 <b>የዋሌት ገቢ ማረጋገጫ!</b>\n\nየ <b>${tx.amount.toLocaleString()} ብር</b> የገቢ ጥያቄዎ በአስተዳዳሪው (0910961881) ጸድቋል! አሁን ቀሪ ሂሳብዎ <b>${userWallet.walletBalance.toLocaleString()} ብር</b> ነው። ሎተሪ ለመቁረጥ ሚኒ አፑን ይክፈቱ!`
                : `✅ <b>የብር ማውጫ ጥያቄዎ ጸድቋል!</b>\n\nየ <b>${tx.amount.toLocaleString()} ብር</b> በቴሌብር ወደ ስልክዎ (<code>${tx.userPhone}</code>) ተላልፏል!`)
            : (tx.type === 'deposit'
                ? `❌ የ <b>${tx.amount.toLocaleString()} ብር</b> የገቢ ጥያቄዎ ውድቅ ተደርጓል። እባክዎ ትክክለኛ የክፍያ ሪፈረንስ ቁጥር ያስገቡ ወይም ድጋፍ (@lij_makbel) ያነጋግሩ።`
                : `❌ የ <b>${tx.amount.toLocaleString()} ብር</b> የወጪ ጥያቄዎ ውድቅ ተደርጓል፤ ገንዘቡ ወደ ዋሌትዎ ተመልሷል።`);

          sendTelegramResponse(customerChatId, userNotif, getMainMenuReplyKeyboard());
        }
      }

      const alertMsg = isApprove
        ? `✅ ክፍያው በ 0910961881 ጸድቋል!`
        : `❌ ክፍያው ውድቅ ተደርጓል!`;

      await answerTelegramCallback(callbackId, alertMsg, true);

      const originalText = callbackQuery.message?.text || '';
      const messageId = callbackQuery.message?.message_id;

      if (chatId && messageId) {
        const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const badge = isApprove
          ? `\n\n━━━━━━━━━━━━━━━━━━━━\n✅ <b>በአድሚኑ ጸድቋል (APPROVED BY 0910961881)</b>\n👤 ያጸደቀው፦ <b>${firstName}</b>\n⏱️ ሰዓት፦ ${timeNow}`
          : `\n\n━━━━━━━━━━━━━━━━━━━━\n❌ <b>ውድቅ ተደርጓል (REJECTED)</b>\n👤 የወሰነው፦ <b>${firstName}</b>\n⏱️ ሰዓት፦ ${timeNow}`;

        const updatedKeyboard = {
          inline_keyboard: [
            [
              {
                text: isApprove ? '✅ ጸድቋል (Approved)' : '❌ ውድቅ ተደርጓል (Rejected)',
                callback_data: 'done',
              },
            ],
            [
              {
                text: '🎰 ጋሸና ሎተሪ ክፈት (Open Mini App)',
                url: APP_URL,
              },
            ],
          ],
        };

        await editTelegramMessage(chatId, messageId, originalText + badge, updatedKeyboard);
      }
      return;
    }

    if (data.startsWith('txfilter_')) {
      const filter = data.replace('txfilter_', '') as 'all' | 'deposit' | 'withdrawal' | 'pending';
      await answerTelegramCallback(callbackId, 'ተዘምኗል');
      await sendTransactionsOverview(chatId, filter);
      return;
    }

    if (data === 'done' || data === 'noop') {
      await answerTelegramCallback(callbackId, 'ተጠናቋል!');
      return;
    }

    if (data === 'lang_am') {
      await answerTelegramCallback(callbackId, 'ቋንቋ ወደ አማርኛ ተቀይሯል!');
      return;
    }

    if (data === 'lang_en') {
      await answerTelegramCallback(callbackId, 'Language set to English!');
      return;
    }

    await answerTelegramCallback(callbackId);

    if (!chatId) return;

    if (data === 'menu_tickets') {
      await handleTelegramMessage({ chat: { id: chatId }, from: callbackQuery.from, text: '✅ ትኬት ቁረጥ' });
    } else if (data === 'menu_deposit') {
      await handleTelegramMessage({ chat: { id: chatId }, from: callbackQuery.from, text: '💵 ገቢ አድርግ (ገቢ)' });
    } else if (data === 'menu_withdraw') {
      await handleTelegramMessage({ chat: { id: chatId }, from: callbackQuery.from, text: '💸 ገንዘብ አውጣ (ወጪ)' });
    } else if (data === 'menu_balance') {
      await handleTelegramMessage({ chat: { id: chatId }, from: callbackQuery.from, text: '💰 ቀሪ ሂሳብ' });
    }
  } catch (err) {
    console.error('[Telegram Callback Error]', err);
  }
}

// REST API Endpoints
app.get('/api/merchant', (req, res) => {
  res.json({
    ok: true,
    merchant: OFFICIAL_MERCHANT,
  });
});

app.get('/api/lottery/status', (req, res) => {
  res.json({
    ok: true,
    platform: 'Gaashena Online Lottery (ጋሸና ኦንላይን ሎተሪ)',
    merchant: OFFICIAL_MERCHANT,
  });
});

app.get('/api/telegram/status', async (req, res) => {
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await tgRes.json();
    res.json({
      ok: true,
      bot: data.result,
      configuredUrl: APP_URL,
      adminCount: adminChatIds.length,
      adminChatIds: adminChatIds,
      botUsername: BOT_USERNAME,
      officialAdminPhone: OFFICIAL_ADMIN.phone,
      officialSupport: OFFICIAL_ADMIN.supportUsername,
    });
  } catch (err: any) {
    res.json({ ok: false, error: err.message, adminCount: adminChatIds.length });
  }
});

app.post('/api/telegram/test-alert', async (req, res) => {
  try {
    const timeNow = new Date().toLocaleTimeString('en-US');
    const msg =
      `🔔 <b>የሙከራ የአድሚን ማሳወቂያ (Test Admin Alert)</b>\n\n` +
      `✅ የጋሸና ሎተሪ ቴሌግራም ቦት (@${BOT_USERNAME}) በተሳካ ሁኔታ ተገናኝቷል!\n` +
      `📱 የተፈቀደ አድሚን ስልክ፦ <b>0910961881</b>\n` +
      `💬 የድጋፍ መለያ፦ <b>@${OFFICIAL_ADMIN.supportUsername}</b>\n` +
      `⏱️ ሰዓት፦ ${timeNow}\n\n` +
      `ደንበኞች በቦቱ ወይም በሚኒ አፑ የገቢ (Deposit) ወይም የወጪ (Withdrawal) ጥያቄ ሲልኩ እዚህ ጋር ከነ «አጽድቅ» ቁልፍ ይደርስዎታል!`;

    const results = await notifyAllAdmins(msg, {
      inline_keyboard: [
        [
          { text: '✅ ተፈትሿል (Working)', callback_data: 'done' },
          { text: '🎰 ሚኒ አፕ ክፈት', url: APP_URL },
        ],
      ],
    });

    res.json({ ok: true, sentCount: results.length, totalAdmins: adminChatIds.length });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/notify-admin', async (req, res) => {
  const { id, type, userName, userPhone, amount, paymentMethod, referenceNumber, timestamp, userId, telegramId } = req.body;
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Transaction id is required' });
  }

  const finalUserId = userId || telegramId || '';

  findOrCreateWallet({ userId: finalUserId, phone: userPhone, telegramId, fullName: userName });

  const existingIndex = syncedTransactions.findIndex((t) => t.id === id);
  const txRecord: SyncedTransaction = {
    id,
    type: type || 'deposit',
    userId: finalUserId,
    userName: userName || 'ተጠቃሚ',
    userPhone: userPhone || '',
    amount: Number(amount) || 0,
    paymentMethod: paymentMethod || 'telebirr',
    referenceNumber: referenceNumber || 'REF-' + Date.now(),
    timestamp: timestamp || new Date().toISOString(),
    status: 'pending',
    source: 'mini_app',
  };

  if (existingIndex >= 0) {
    syncedTransactions[existingIndex] = { ...syncedTransactions[existingIndex], ...txRecord };
  } else {
    syncedTransactions.unshift(txRecord);
  }
  saveTransactions();

  const isDeposit = type === 'deposit';
  let tgMessage = '';
  let inlineKeyboard = {};

  if (isDeposit) {
    tgMessage =
      `🔔 <b>አዲስ የዋሌት ገቢ ጥያቄ (New Deposit Request)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>ደንበኛ፦</b> <b>${userName}</b>\n` +
      `📱 <b>ስልክ፦</b> <code>${userPhone}</code>\n` +
      `💵 <b>መጠን፦</b> <b>${Number(amount).toLocaleString()} ብር (ETB)</b>\n` +
      `💳 <b>የክፍያ መንገድ፦</b> <b>${String(paymentMethod).toUpperCase()}</b>\n` +
      `🔢 <b>ሪፈረንስ፦</b> <code>${referenceNumber}</code>\n` +
      `⏱️ <b>ሰዓት፦</b> ${new Date(timestamp || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👑 <i>አስተዳዳሪ (0910961881) እባክዎ ክፍያውን በቴሌብር አረጋግጠው ይወስኑ፦</i>`;

    inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ አጽድቅ (Approve)', callback_data: `appr:${id}` },
          { text: '❌ ውድቅ አድርግ (Reject)', callback_data: `rejc:${id}` },
        ],
        [
          { text: '🎰 ዳሽቦርድ ክፈት (Open App)', url: APP_URL },
        ],
      ],
    };
  } else if (type === 'withdrawal') {
    tgMessage =
      `📤 <b>አዲስ የብር ማውጫ ጥያቄ (New Withdrawal Request)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>ደንበኛ፦</b> <b>${userName}</b>\n` +
      `📱 <b>ቴሌብር ስልክ፦</b> <code>${userPhone}</code>\n` +
      `💵 <b>የሚወጣ መጠን፦</b> <b>${Number(amount).toLocaleString()} ብር (ETB)</b>\n` +
      `💳 <b>የመክፈያ መንገድ፦</b> TELEBIRR\n` +
      `⏱️ <b>ሰዓት፦</b> ${new Date(timestamp || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👑 <i>አስተዳዳሪ (0910961881) እባክዎ ${Number(amount).toLocaleString()} ብር ወደ <code>${userPhone}</code> በቴሌብር ከላኩ በኋላ «አጽድቅ» ይበሉ፦</i>`;

    inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ ብሩን ልኬያለሁ • አጽድቅ (Approve)', callback_data: `appr:${id}` },
          { text: '❌ ውድቅ አድርግ (Reject)', callback_data: `rejc:${id}` },
        ],
        [
          { text: '🎰 ዳሽቦርድ ክፈት', url: APP_URL },
        ],
      ],
    };
  } else {
    tgMessage =
      `🎟️ <b>አዲስ የቲኬት ግዢ (New Ticket Purchase)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>ደንበኛ፦</b> <b>${userName}</b> (${userPhone})\n` +
      `💵 <b>መጠን፦</b> <b>${amount} ብር</b>\n` +
      `🔢 <b>ሪፈረንስ፦</b> <code>${referenceNumber}</code>`;
  }

  const sent = await notifyAllAdmins(tgMessage, inlineKeyboard);

  res.json({
    ok: true,
    txId: id,
    deliveredToAdmins: sent.length,
    totalAdmins: adminChatIds.length,
  });
});

app.get('/api/transactions/sync', (req, res) => {
  const userId = req.query.userId as string;
  const phone = req.query.phone as string;
  const tgId = req.query.tgId as string;

  let wallet = undefined;
  if (userId || phone || tgId) {
    wallet = findOrCreateWallet({ userId, phone, telegramId: tgId });
  }

  res.json({
    ok: true,
    transactions: syncedTransactions,
    wallet: wallet ? {
      userId: wallet.userId,
      walletBalance: wallet.walletBalance,
      phone: wallet.phone,
      fullName: wallet.fullName,
      username: wallet.username,
      profileImage: wallet.profileImage,
      ticketsCount: wallet.ticketsCount,
      totalWon: wallet.totalWon,
    } : null,
  });
});

app.post('/api/user/wallet/update', (req, res) => {
  const { userId, phone, telegramId, walletBalance, ticketsCount, totalWon, fullName, username, profileImage } = req.body;
  if (!userId && !phone && !telegramId) {
    return res.status(400).json({ ok: false, error: 'User identifier required' });
  }
  const wallet = findOrCreateWallet({ userId, phone, telegramId });
  if (typeof walletBalance === 'number') wallet.walletBalance = walletBalance;
  if (typeof ticketsCount === 'number') wallet.ticketsCount = ticketsCount;
  if (typeof totalWon === 'number') wallet.totalWon = totalWon;
  if (fullName) wallet.fullName = fullName;
  if (phone) wallet.phone = phone;
  if (username) wallet.username = username;
  if (profileImage) wallet.profileImage = profileImage;
  saveUserWallets();
  res.json({ ok: true, wallet });
});

app.post('/api/transactions/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, approvedBy } = req.body;

  const tx = syncedTransactions.find((t) => t.id === id);
  if (!tx) {
    return res.status(404).json({ ok: false, error: 'Transaction not found' });
  }

  tx.status = status;
  tx.approvedBy = approvedBy || 'Admin 0910961881';
  tx.approvedAt = new Date().toISOString();
  saveTransactions();

  const userWallet = findOrCreateWallet({ userId: tx.userId, phone: tx.userPhone, fullName: tx.userName });
  if (tx.type === 'deposit') {
    if (status === 'completed') {
      userWallet.walletBalance += Number(tx.amount);
    }
  } else if (tx.type === 'withdrawal') {
    if (status === 'completed') {
      userWallet.walletBalance = Math.max(0, userWallet.walletBalance - Number(tx.amount));
    } else if (status === 'failed') {
      userWallet.walletBalance += Number(tx.amount);
    }
  }
  saveUserWallets();

  res.json({ ok: true, transaction: tx });
});

app.get('/api/support/messages', (req, res) => {
  const userPhone = req.query.phone as string;
  if (!userPhone) {
    return res.json({ ok: true, messages: supportMessages.slice(-50) });
  }

  const cleanPhone = userPhone.replace(/\s+/g, '');
  const userFiltered = supportMessages.filter(
    (m) => m.userPhone.replace(/\s+/g, '').includes(cleanPhone) || cleanPhone.includes(m.userPhone.replace(/\s+/g, ''))
  );

  res.json({ ok: true, messages: userFiltered });
});

app.post('/api/support/send', async (req, res) => {
  const { userName, userPhone, text, userId } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'Message text is required' });
  }

  const newMsg: SupportMessage = {
    id: 'sup_' + Date.now(),
    userId: userId || 'user',
    userName: userName || 'ደንበኛ',
    userPhone: userPhone || '',
    sender: 'user',
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };

  supportMessages.push(newMsg);
  saveSupportMessages();

  const adminNotification =
    `💬 <b>አዲስ የደንበኛ የድጋፍ መልዕክት (Support Inquiry)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>ከ፦</b> <b>${newMsg.userName}</b>\n` +
    `📱 <b>ስልክ፦</b> <code>${newMsg.userPhone}</code>\n` +
    `📝 <b>መልዕክት፦</b>\n` +
    `<i>"${newMsg.text}"</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ <b>መልስ ለመስጠት፦</b> ይህንን መልዕክት በቴሌግራም Reply ያድርጉ ወይም <code>/reply ${newMsg.userPhone || newMsg.id} [መልስዎ]</code> ብለው ይላኩ!\n` +
    `ወይም ደንበኛው በቀጥታ በ <b>@${OFFICIAL_ADMIN.supportUsername}</b> ማነጋገር ይችላል።`;

  await notifyAllAdmins(adminNotification);

  res.json({ ok: true, message: newMsg });
});

app.post('/api/telegram/webhook', async (req, res) => {
  res.sendStatus(200);
  if (req.body?.message) {
    await handleTelegramMessage(req.body.message);
  } else if (req.body?.callback_query) {
    await handleTelegramCallback(req.body.callback_query);
  }
});

const UPDATE_ID_FILE = path.join(__dirname, 'last_update_id.txt');
let lastUpdateId = 0;
try {
  if (fs.existsSync(UPDATE_ID_FILE)) {
    lastUpdateId = parseInt(fs.readFileSync(UPDATE_ID_FILE, 'utf-8').trim(), 10) || 0;
  }
} catch {
  lastUpdateId = 0;
}

function saveLastUpdateId(id: number) {
  try {
    fs.writeFileSync(UPDATE_ID_FILE, String(id));
  } catch {}
}

async function startTelegramPolling() {
  console.log(`[Telegram Bot] Starting polling for @${BOT_USERNAME} with token ${TELEGRAM_BOT_TOKEN.slice(0, 10)}...`);

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'ቦቱን ማስጀመሪያ / ሜኑ መክፈቻ' },
          { command: 'play', description: '✅ ትኬት ቁረጥ (ሎተሪ ክፈት)' },
          { command: 'deposit', description: '💵 ገቢ አድርግ (ገቢ)' },
          { command: 'withdraw', description: '💸 ገንዘብ አውጣ (ወጪ)' },
          { command: 'balance', description: '💰 ቀሪ ሂሳብ' },
          { command: 'profile', description: '👤 ፕሮፋይል' },
          { command: 'support', description: '💬 ድጋፍ (@lij_makbel)' },
          { command: 'language', description: '🌐 ቋንቋ' },
          { command: 'admin', description: '👑 አስተዳዳሪ (Admin 0910961881)' },
        ],
      }),
    });

    // setChatMenuButton removed to ensure opening via browser link prevents iframe 403 errors
  } catch (err) {
    console.error('[Bot Init Warning]', err);
  }

  while (true) {
    try {
      const offset = lastUpdateId > 0 ? lastUpdateId + 1 : 0;
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`
      );
      if (!res.ok) {
        console.warn(`[Telegram Polling HTTP Error ${res.status}]`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      const data = (await res.json()) as any;
      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          saveLastUpdateId(lastUpdateId);
          try {
            if (update.message) {
              console.log(`[Telegram Update] Chat ${update.message.chat?.id}: "${update.message.text || (update.message.contact ? 'contact' : 'other')}"`);
              await handleTelegramMessage(update.message);
            } else if (update.callback_query) {
              console.log(`[Telegram Callback] Chat ${update.callback_query.message?.chat?.id}: data="${update.callback_query.data}"`);
              await handleTelegramCallback(update.callback_query);
            }
          } catch (innerErr) {
            console.error('[Update Processing Error]', update.update_id, innerErr);
          }
        }
      } else if (data && !data.ok) {
        console.warn('[Telegram Polling API returned not ok]:', data.description || data);
      }
    } catch (pollErr) {
      console.error('[Telegram Polling Network Error]', pollErr);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);
  const isDev = process.env.NODE_ENV !== 'production' && !hasDist;

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Gaashena Server] Running on http://0.0.0.0:${PORT}`);
    startTelegramPolling().catch((err) => console.error('[Polling Fatal Error]', err));
  });
}

startServer();
