import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface ComplaintData {
  nama: string;
  email: string;
  phone: string;
  noRumah: string;
  details: string;
}

export interface PaymentNotificationItem {
  name: string;
  category?: string;
  amount: number;
  sessionYear?: string;
}

export interface PaymentNotificationDetails {
  payerName: string;
  payerEmail?: string;
  payerPhone?: string;
  paymentMethod: string; // e.g. 'FPX (Maybank2u)' or 'Bayaran Manual (Resit Muat Naik)'
  bankName?: string;
  totalAmount: number;
  approvalStatus: 'Pending' | 'Approved' | string;
  items: PaymentNotificationItem[];
  transactionIds?: string[];
  voucherNumbers?: string[];
  receiptUrl?: string;
  notes?: string;
  aiVerified?: boolean;
  aiDetectedAmount?: number | null;
  aiConfidence?: string;
  aiNotes?: string;
  recordedBy?: string;
}

/**
 * Get the stored Telegram Config securely from the server.
 */
export async function getTelegramConfig(): Promise<{ chatId: string | null, botToken: string | null }> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/telegram/config', {
      headers: idToken ? { 'Authorization': `Bearer ${idToken}` } : {}
    });
    if (response.ok) {
      const data = await response.json();
      return {
        chatId: data.chatId || null,
        botToken: data.botTokenMasked || (data.configured ? '••••••••••••' : null)
      };
    }
  } catch (err) {
    console.error("Gagal mendapatkan konfigurasi Telegram dari server:", err);
  }
  return { chatId: null, botToken: null };
}

/**
 * Save the Telegram Config securely via server.
 */
export async function saveTelegramConfig(chatId: string, botToken: string): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({ chatId, botToken })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyimpan konfigurasi Telegram di pelayan.');
    }
  } catch (err) {
    console.error("Gagal menyimpan konfigurasi Telegram:", err);
    throw err;
  }
}

/**
 * Fetch the latest Chat ID from the bot's /getUpdates endpoint via server.
 */
export async function fetchTelegramUpdates(botToken?: string): Promise<{ chatId: string; username: string; text: string } | null> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/telegram/fetch-chat-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({ botToken })
    });
    const data = await response.json();
    if (data.success && data.chatId) {
      return {
        chatId: data.chatId,
        username: data.username || "Pengguna",
        text: data.text || ""
      };
    }
  } catch (err) {
    console.error("Gagal mendapatkan kemaskini dari Telegram:", err);
  }
  return null;
}

/**
 * Send a complaint message to the Telegram bot, and save the complaint to Firestore.
 */
export async function sendTelegramComplaint(complaintData: ComplaintData): Promise<any> {
  // 1. Save complaint to Firestore collection 'complaints' for persistent tracking FIRST
  try {
    await addDoc(collection(db, 'complaints'), {
      ...complaintData,
      status: 'Baru', // Baru, Sedang Diproses, Selesai
      createdAt: new Date().toISOString(),
      timestamp: new Date().toLocaleDateString('ms-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    });
  } catch (fsErr) {
    console.error("Gagal menyimpan aduan ke Firestore:", fsErr);
  }

  // 2. Format message
  const messageText = `
🚨 *ADUAN BAHARU DITERIMA* 🚨

👤 *Nama Penuh:* ${complaintData.nama}
📧 *Email:* ${complaintData.email || 'Tiada'}
📞 *No. Telefon:* ${complaintData.phone || 'Tiada'}
🏠 *No. Rumah:* ${complaintData.noRumah || 'Tiada'}

📝 *Butiran Aduan:*
${complaintData.details}

📅 *Tarikh & Masa:* ${new Date().toLocaleString('ms-MY')}
`.trim();

  // 3. Send securely via server proxy
  try {
    const sendResponse = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: messageText,
        parse_mode: 'Markdown'
      })
    });

    const sendResult = await sendResponse.json();
    return sendResult;
  } catch (err) {
    console.error("Ralat rangkaian semasa menghubungi Telegram via server:", err);
    return { ok: true, warning: "network_error" };
  }
}

/**
 * Send a generic message to the Telegram bot using the configured token and chatId via server.
 */
export async function sendTelegramMessage(messageText: string): Promise<any> {
  try {
    const sendResponse = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: messageText,
        parse_mode: 'Markdown'
      })
    });

    const sendResult = await sendResponse.json();
    return sendResult;
  } catch (err) {
    console.error("Ralat rangkaian semasa menghubungi Telegram via server:", err);
    return { ok: false, warning: "network_error" };
  }
}

/**
 * Send a comprehensive payment notification (Manual or FPX) to the Telegram bot via server.
 */
export async function sendTelegramPaymentNotification(details: PaymentNotificationDetails): Promise<any> {
  const isPending = details.approvalStatus === 'Pending';

  const statusTitle = isPending
    ? '🧾 NOTIFIKASI PEMBAYARAN MANUAL (PERLU KELULUSAN)'
    : '💳 NOTIFIKASI PEMBAYARAN FPX (DISAHKAN)';

  const statusBadge = isPending
    ? '🟡 MENUNGGU KELULUSAN ADMIN / BENDAHARI'
    : '🟢 LULUS (DISAHKAN AUTOMATIK OLEH FPX)';

  const nowStr = new Date().toLocaleString('ms-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const itemsFormatted = details.items && details.items.length > 0
    ? details.items.map((item, idx) => {
        const catTag = item.category ? ` [${item.category}]` : '';
        const sesTag = item.sessionYear ? ` (Sesi ${item.sessionYear})` : '';
        return `  ${idx + 1}. <b>${item.name}</b>${catTag}${sesTag} - <b>RM ${item.amount.toFixed(2)}</b>`;
      }).join('\n')
    : '  1. <b>Bayaran Yuran / Perkhidmatan</b>';

  const txnIdsText = details.transactionIds && details.transactionIds.length > 0
    ? details.transactionIds.join(', ')
    : 'Di-jana secara automatik';

  // Construct message text in HTML format
  let htmlMessage = `<b>${statusTitle}</b>\n\n` +
    `📌 <b>Status:</b> ${statusBadge}\n` +
    `👤 <b>Nama Pembayar:</b> ${details.payerName}\n` +
    `📧 <b>Emel:</b> ${details.payerEmail || 'Tiada'}\n` +
    (details.payerPhone ? `📞 <b>No. Telefon:</b> ${details.payerPhone}\n` : '') +
    `💰 <b>Jumlah Keseluruhan:</b> <b>RM ${details.totalAmount.toFixed(2)}</b>\n` +
    `🏦 <b>Kaedah Pembayaran:</b> ${details.paymentMethod}${details.bankName ? ` (${details.bankName})` : ''}\n\n` +
    `📋 <b>Butiran Senarai Item / Yuran:</b>\n${itemsFormatted}\n\n` +
    `🆔 <b>No. Transaksi:</b> <code>${txnIdsText}</code>\n` +
    `📅 <b>Tarikh & Masa:</b> ${nowStr}\n`;

  if (details.recordedBy) {
    htmlMessage += `👤 <b>Perekod / Sistem:</b> ${details.recordedBy}\n`;
  }

  if (details.notes) {
    htmlMessage += `📝 <b>Catatan:</b> ${details.notes}\n`;
  }

  if (details.aiVerified) {
    htmlMessage += `🤖 <b>Pengesahan AI Vision:</b> ✅ Disahkan Sah${details.aiDetectedAmount ? ` (Jumlah Resit: RM ${details.aiDetectedAmount.toFixed(2)})` : ''}\n`;
    if (details.aiNotes) {
      htmlMessage += `ℹ️ <b>Nota AI:</b> ${details.aiNotes}\n`;
    }
  }

  if (details.receiptUrl) {
    htmlMessage += `📎 <b>Resit Pembayaran:</b> <a href="${details.receiptUrl}">Lihat Gambar Resit</a>\n`;
  }

  // Send securely via server proxy
  try {
    const sendResponse = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: htmlMessage,
        photoUrl: details.receiptUrl,
        parse_mode: 'HTML'
      })
    });

    const sendResult = await sendResponse.json();
    return sendResult;
  } catch (err) {
    console.error("Ralat hantar notifikasi Telegram via server:", err);
    return { ok: false, warning: "network_error" };
  }
}
