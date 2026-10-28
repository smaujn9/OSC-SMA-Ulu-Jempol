import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

// VAPID Public Key for Web Push and FCM. 
// Can be customized via VITE_VAPID_PUBLIC_KEY or VITE_FCM_VAPID_KEY environment variables.
let cachedVapidPublicKey = ((import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string) || 
  ((import.meta as any).env?.VITE_FCM_VAPID_KEY as string) || 
  'BGjz1DsDnip-IHAUKq7IJCuasM6tGaFutR6oI-KqMOhPpHf3krDtBGv7GTdGV38WDdsx5inQKAOj6OghC_pidak';

/**
 * Dapatkan VAPID Public Key secara dinamik dari server
 */
export const fetchVapidPublicKey = async (): Promise<string> => {
  try {
    const res = await fetch('/api/notifications/vapid-public-key');
    if (res.ok) {
      const data = await res.json();
      if (data.publicKey) {
        cachedVapidPublicKey = data.publicKey;
        return data.publicKey;
      }
    }
  } catch (err) {
    console.warn('[NotificationHelper] Gagal mengambil kunci VAPID dari server, menggunakan fallback:', err);
  }
  return cachedVapidPublicKey;
};

export interface NotificationSupportStatus {
  supported: boolean;
  reason: 'supported' | 'server-side' | 'not-secure' | 'not-supported';
  message: string;
}

/**
 * 1. Semak sokongan browser dan persekitaran HTTPS / localhost
 */
export const checkNotificationSupport = (): NotificationSupportStatus => {
  if (typeof window === 'undefined') {
    return { 
      supported: false, 
      reason: 'server-side', 
      message: 'Notifikasi tidak disokong pada persekitaran server.' 
    };
  }
  
  // Semak HTTPS atau localhost
  const isSecure = window.isSecureContext || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';
                   
  if (!isSecure) {
    return { 
      supported: false, 
      reason: 'not-secure', 
      message: 'Notifikasi push memerlukan sambungan selamat (HTTPS) atau localhost.' 
    };
  }

  // Semak sokongan API penting
  const hasSW = 'serviceWorker' in navigator;
  const hasPush = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  if (!hasSW || !hasPush || !hasNotification) {
    return { 
      supported: false, 
      reason: 'not-supported', 
      message: 'Browser ini tidak menyokong push notification. Sila gunakan browser moden seperti Chrome atau Edge.' 
    };
  }

  return { 
    supported: true, 
    reason: 'supported', 
    message: 'Browser menyokong push notification.' 
  };
};

/**
 * 2. Semak dan daftarkan Service Worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  const support = checkNotificationSupport();
  if (!support.supported) {
    throw new Error(support.message);
  }

  try {
    console.log('[NotificationHelper] Mendaftarkan Service Worker...');
    const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    console.log('[NotificationHelper] Service Worker berjaya didaftarkan. Scope:', registration.scope);
    
    // Pastikan service worker aktif sebelum proses push subscription dibuat
    if (registration.installing) {
      console.log('[NotificationHelper] Service worker sedang dipasang...');
      await new Promise<void>((resolve) => {
        registration.installing?.addEventListener('statechange', (e: any) => {
          if (e.target.state === 'activated') {
            console.log('[NotificationHelper] Service worker diaktifkan selepas dipasang.');
            resolve();
          }
        });
      });
    }

    // Tunggu sehingga controller sedia/aktif
    if (!navigator.serviceWorker.controller) {
      console.log('[NotificationHelper] Menunggu controller service worker bersedia...');
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[NotificationHelper] Controller sedia.');
          resolve();
        }, { once: true });
        
        // Timeout sebagai safety fallback jika controllerchange lambat
        setTimeout(resolve, 1000);
      });
    }

    return registration;
  } catch (error) {
    console.error('[NotificationHelper] Pendaftaran Service Worker gagal:', error);
    throw new Error(`Ralat pendaftaran Service Worker: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Helper untuk menukar URL-Safe Base64 kepada Uint8Array (diperlukan untuk VAPID key)
 */
function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Helper untuk menyemak sama ada subskripsi sedia ada mempunyai kunci VAPID yang sepadan
 */
export function checkVapidKeyMatch(subscription: PushSubscription, expectedPublicKey: string): boolean {
  if (!subscription.options || !subscription.options.applicationServerKey) {
    return false;
  }
  try {
    const keyBuffer = subscription.options.applicationServerKey;
    const keyArray = new Uint8Array(keyBuffer);
    const expectedArray = urlB64ToUint8Array(expectedPublicKey);
    
    if (keyArray.length !== expectedArray.length) {
      return false;
    }
    
    for (let i = 0; i < keyArray.length; i++) {
      if (keyArray[i] !== expectedArray[i]) {
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn('[NotificationHelper] Gagal membandingkan kunci VAPID:', e);
    return false;
  }
}

/**
 * 3. Menghantar / Mengemas kini token push ke Firestore untuk user aktif
 */
export const saveSubscriptionToDatabase = async (
  subscription: PushSubscription | null
) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('[NotificationHelper] Tiada pengguna log masuk. Menyimpan subscription ke local storage untuk sync nanti.');
    if (subscription) localStorage.setItem('tmf2_pending_webpush_sub', JSON.stringify(subscription));
    return;
  }

  // 1. Simpan ke database pushSubscriptions/{subscriptionId} (Multi-device support)
  if (subscription && subscription.endpoint) {
    try {
      const endpoint = subscription.endpoint;
      const subscriptionId = window.btoa(endpoint)
        .replace(/\//g, '_')
        .replace(/\+/g, '-')
        .replace(/=/g, '');

      const subRef = doc(db, 'pushSubscriptions', subscriptionId);
      const subData = {
        uid: currentUser.uid,
        endpoint: endpoint,
        subscription: JSON.parse(JSON.stringify(subscription)),
        userAgent: navigator.userAgent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active: true
      };

      await setDoc(subRef, subData);
      console.log('[NotificationHelper] Subskripsi Web Push disimpan ke pushSubscriptions/', subscriptionId);
    } catch (error) {
      console.error('[NotificationHelper] Gagal menyimpan subskripsi ke pushSubscriptions:', error);
    }
  }

  // 2. Simpan juga ke users/{userId} untuk mengekalkan fungsi sedia ada (backward compatibility)
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const updateData: any = {
      notificationsEnabled: true,
      notificationsUpdatedAt: serverTimestamp()
    };
    
    if (subscription) {
      updateData.webPushSubscription = JSON.parse(JSON.stringify(subscription));
      console.log('[NotificationHelper] Menyimpan Web Push Subscription ke DB untuk user:', currentUser.uid);
    }

    await updateDoc(userRef, updateData);
    console.log('[NotificationHelper] Maklumat notifikasi berjaya disinkronkan ke profil pengguna.');
  } catch (error) {
    console.error('[NotificationHelper] Gagal mengemas kini maklumat notifikasi pada profil pengguna:', error);
  }
};

/**
 * Melakukan sync token tertunda (pending token) dari local storage setelah user log masuk
 */
export const syncPendingNotifications = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const pendingSubStr = localStorage.getItem('tmf2_pending_webpush_sub');

  if (pendingSubStr) {
    console.log('[NotificationHelper] Mengesan token tertunda. Melakukan sinkronisasi ke database...');
    let subscription: PushSubscription | null = null;
    try {
      subscription = JSON.parse(pendingSubStr);
    } catch (e) {}

    await saveSubscriptionToDatabase(subscription);
    
    // Clear setelah sync berjaya
    localStorage.removeItem('tmf2_pending_fcm_token');
    localStorage.removeItem('tmf2_pending_webpush_sub');
  }
};

/**
 * 4. Melakukan proses subskripsi push utama (Web Push sahaja)
 */
export const subscribeUserToPush = async (registration: ServiceWorkerRegistration) => {
  console.log('[NotificationHelper] Memulakan proses subskripsi push...');

  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'denied') {
      throw new Error('Kebenaran notifikasi telah disekat pada browser anda. Sila benarkan notifikasi dalam tetapan pelayar (browser settings).');
    }
    if (Notification.permission === 'default') {
      console.log('[NotificationHelper] Meminta kebenaran notifikasi dari pengguna...');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        throw new Error('Kebenaran notifikasi tidak diluluskan oleh pengguna.');
      }
    }
  }

  let subscription: PushSubscription | null = null;

  try {
    const activeVapidKey = await fetchVapidPublicKey();
    console.log('[NotificationHelper] Menggunakan VAPID Public Key:', activeVapidKey);
    const applicationServerKey = urlB64ToUint8Array(activeVapidKey);
    let existingSub = await registration.pushManager.getSubscription();
    
    if (existingSub) {
      const isKeyMatch = checkVapidKeyMatch(existingSub, activeVapidKey);
      if (isKeyMatch) {
        console.log('[NotificationHelper] Menggunakan subskripsi Web Push sedia ada (Kunci VAPID sepadan):', existingSub);
        subscription = existingSub;
      } else {
        console.log('[NotificationHelper] Kunci VAPID berubah atau tidak sepadan. Melakukan unsubscribe dan daftar baru...');
        await existingSub.unsubscribe();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      }
    } else {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
      console.log('[NotificationHelper] Subskripsi Web Push baru berjaya dijana:', subscription);
    }
  } catch (error) {
    console.warn('[NotificationHelper] Gagal mendapatkan subskripsi Web Push:', error);
    throw error;
  }

  // Simpan ke database
  await saveSubscriptionToDatabase(subscription);

  return { subscription };
};

/**
 * Convenience helper to register SW and subscribe to push in one step
 */
export const registerServiceWorkerAndSubscribe = async () => {
  const reg = await registerServiceWorker();
  return await subscribeUserToPush(reg);
};

/**
 * 5. Menghantar push notification (Broadcast / Targeted)
 */
export const sendPushNotificationToAll = async (allUsers: any[], title: string, body: string, relatedId?: string) => {
  return sendTargetedPushNotification({
    title,
    body,
    targetAudience: 'all',
    url: `/pengumuman/${relatedId || ''}`
  });
};

/**
 * Send targeted push notification with custom audience filters
 */
export const sendTargetedPushNotification = async ({
  title,
  body,
  targetAudience = 'all',
  targetUids = [],
  excludeUids = [],
  url = '',
  triggerType = null
}: {
  title: string;
  body: string;
  targetAudience?: 'all' | 'ajk' | 'members' | 'uids' | 'leadership';
  targetUids?: string[];
  excludeUids?: string[];
  url?: string;
  triggerType?: string | null;
}) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Hanya pengguna yang log masuk boleh menghantar notifikasi.');
    }

    const idToken = await currentUser.getIdToken();

    console.log(`[NotificationHelper] Meminta server menghantar push notification (Sasaran: ${targetAudience})...`);

    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        payload: {
          title,
          body,
          url: url || '/pengumuman'
        },
        targetAudience,
        targetUids,
        excludeUids,
        triggerType
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Ralat HTTP! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('[NotificationHelper] Keputusan penghantaran push:', result);
    return result;
  } catch (error) {
    console.error('[NotificationHelper] Gagal menghantar push notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Helper to get Authorization header for Admin Server API calls
const getAuthHeader = async () => {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    return idToken ? { 'Authorization': `Bearer ${idToken}` } : {};
  } catch {
    return {};
  }
};

/**
 * Schedule a push notification for a future date and time
 */
export const schedulePushNotification = async (payload: {
  title: string;
  body: string;
  targetAudience: 'all' | 'ajk' | 'members';
  scheduledAt: string;
  url?: string;
}) => {
  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/notifications/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menjadualkan notifikasi.');
    }
    return await response.json();
  } catch (error: any) {
    console.error('[NotificationHelper] Error scheduling notification:', error);
    throw error;
  }
};

/**
 * Fetch all scheduled push notifications
 */
export const fetchScheduledNotifications = async () => {
  try {
    const response = await fetch('/api/notifications/schedule');
    if (!response.ok) throw new Error('Gagal membaca jadual notifikasi.');
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('[NotificationHelper] Error fetching scheduled items:', error);
    return [];
  }
};

/**
 * Cancel / Delete a scheduled push notification
 */
export const cancelScheduledNotification = async (id: string) => {
  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch(`/api/notifications/schedule/${id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    if (!response.ok) throw new Error('Gagal memadam jadual notifikasi.');
    return await response.json();
  } catch (error) {
    console.error('[NotificationHelper] Error cancelling scheduled item:', error);
    throw error;
  }
};

/**
 * Fetch notification auto-trigger settings
 */
export const fetchNotificationSettings = async () => {
  try {
    const response = await fetch('/api/notifications/settings');
    if (!response.ok) throw new Error('Gagal membaca tetapan notifikasi.');
    const data = await response.json();
    return data.settings || {};
  } catch (error) {
    console.error('[NotificationHelper] Error fetching settings:', error);
    return {
      notifyMemberApproval: true,
      notifyNewAnnouncement: true,
      notifySafetyCases: true,
      notifyTakwimEvents: true,
      notifyReports: true,
      notifyDailyEvents: true,
      notifyYuran26th: true,
      notifyChatPost: true,
      notifyNewMemberRegistration: true
    };
  }
};

/**
 * Trigger 26th Yuran Reminder Manual Sweep
 */
export const triggerYuranReminderNow = async () => {
  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/notifications/trigger-yuran-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      }
    });
    if (!response.ok) throw new Error('Gagal mencetuskan peringatan yuran.');
    return await response.json();
  } catch (error) {
    console.error('[NotificationHelper] Error triggering yuran reminder:', error);
    throw error;
  }
};

/**
 * Save notification auto-trigger settings
 */
export const saveNotificationSettings = async (settings: any) => {
  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/notifications/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ settings })
    });
    if (!response.ok) throw new Error('Gagal menyimpan tetapan notifikasi.');
    return await response.json();
  } catch (error) {
    console.error('[NotificationHelper] Error saving settings:', error);
    throw error;
  }
};

/**
 * Auto-Trigger Helpers
 */
export const notifyOnChatPost = async ({
  authorName,
  content,
  scope = 'Awam',
  hasImage = false,
  postId
}: {
  authorName: string;
  content: string;
  scope?: 'Awam' | 'Ahli Jawatankuasa';
  hasImage?: boolean;
  postId?: string;
}) => {
  const isAjk = scope === 'Ahli Jawatankuasa';
  const prefix = isAjk ? '🔒 Chat Komuniti (AJK)' : '💬 Sembang Komuniti';
  const title = `${prefix}: ${authorName || 'Penduduk'}`;

  let body = '';
  const cleanContent = (content || '').trim();
  if (cleanContent && hasImage) {
    const snippet = cleanContent.length > 80 ? `${cleanContent.slice(0, 80)}...` : cleanContent;
    body = `${snippet} 📷 [Foto]`;
  } else if (cleanContent) {
    body = cleanContent.length > 100 ? `${cleanContent.slice(0, 100)}...` : cleanContent;
  } else if (hasImage) {
    body = 'Memuat naik foto baharu dalam sembang komuniti.';
  } else {
    body = 'Berkongsi hantaran baharu dalam sembang komuniti.';
  }

  const currentUser = auth.currentUser;
  const excludeUids: string[] = [];
  if (currentUser?.uid) {
    excludeUids.push(currentUser.uid);
  }

  return sendTargetedPushNotification({
    title,
    body,
    targetAudience: isAjk ? 'ajk' : 'all',
    url: '/chat',
    triggerType: 'notifyChatPost',
    excludeUids
  });
};

export const notifyOnMemberApproved = async (userName: string, userUid: string, userEmail?: string) => {
  const targetUids = [userUid];
  if (userEmail && userEmail.trim()) {
    targetUids.push(userEmail.trim().toLowerCase());
  }
  return sendTargetedPushNotification({
    title: '🎉 Pendaftaran Diluluskan!',
    body: `Tahniah ${userName || 'Ahli'}! Permohonan pendaftaran anda bagi Sekolah Menengah Agama Ulu Jempol (SMAUJ) telah diluluskan.`,
    targetAudience: 'uids',
    targetUids,
    url: '/profil',
    triggerType: 'notifyMemberApproval'
  });
};

/**
 * Send Membership Approval Email directly via Server API
 */
export interface SendApprovalEmailParams {
  email: string;
  name: string;
  memberNo: string;
  icNumber?: string;
  noRumah?: string;
  address?: string;
  membershipType?: string;
  statusKediaman?: string;
  approvedAtStr?: string;
  approvedBy?: string;
  portalUrl?: string;
  uid?: string;
}

export const sendMembershipApprovalEmail = async (params: SendApprovalEmailParams): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    if (!params.email || !params.email.trim()) {
      return { success: false, error: 'Tiada alamat emel disediakan untuk pemohon ini.' };
    }

    const authHeaders = await getAuthHeader();
    const res = await fetch('/api/membership/send-approval-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        ...params,
        portalUrl: params.portalUrl || window.location.origin
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menghantar emel kelulusan.');
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    console.error('[NotificationHelper] Ralat menghantar emel kelulusan:', err);
    return { success: false, error: err.message || 'Gagal menghantar emel.' };
  }
};

/**
 * Fetch Email / SMTP Server Config
 */
export const fetchEmailConfig = async () => {
  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/email/config', {
      headers: authHeaders
    });
    if (!response.ok) throw new Error('Gagal membaca tetapan emel.');
    const data = await response.json();
    return data.config || {};
  } catch (error) {
    console.error('[NotificationHelper] Error fetching email config:', error);
    return {
      enabled: true,
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: '',
      pass: '',
      fromName: 'Sekolah Menengah Agama Ulu Jempol (SMAUJ)',
      fromEmail: 'smaujn9@gmail.com',
      replyTo: 'smaujn9@gmail.com',
      autoSendOnApproval: true
    };
  }
};

/**
 * Save Email / SMTP Server Config
 */
export const saveEmailConfig = async (config: any) => {
  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/email/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ config })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menyimpan konfigurasi emel.');
    }
    return await response.json();
  } catch (error: any) {
    console.error('[NotificationHelper] Error saving email config:', error);
    throw error;
  }
};

/**
 * Test Email Dispatch via Server API
 */
export const sendTestEmail = async (recipientEmail: string) => {
  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/email/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ recipientEmail })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Gagal menghantar emel ujian.');
    }
    return data;
  } catch (error: any) {
    console.error('[NotificationHelper] Error sending test email:', error);
    throw error;
  }
};

export const notifyOnNewAnnouncement = async (announcementTitle: string, announcementId?: string) => {
  return sendTargetedPushNotification({
    title: '📢 Pengumuman Baharu SMAUJ',
    body: announcementTitle,
    targetAudience: 'all',
    url: announcementId ? `/pengumuman/${announcementId}` : '/pengumuman',
    triggerType: 'notifyNewAnnouncement'
  });
};

export const notifyOnSafetyCase = async (caseTitle: string, caseId?: string) => {
  return sendTargetedPushNotification({
    title: '🚨 Aduan / Kes Baharu',
    body: `Kes: ${caseTitle}. Sila semak di Pengurusan Keselamatan / Disiplin.`,
    targetAudience: 'ajk',
    url: '/laporan-kes',
    triggerType: 'notifySafetyCases'
  });
};

export const notifyOnNewTakwimEvent = async (eventTitle: string, eventDate: string) => {
  return sendTargetedPushNotification({
    title: '📅 Program / Aktiviti Baharu Ditambah',
    body: `${eventTitle} (Tarikh: ${eventDate}). Sila semak Takwim Persekolahan SMAUJ.`,
    targetAudience: 'all',
    url: '/takwim',
    triggerType: 'notifyTakwimEvents'
  });
};

export const notifyOnReportGenerated = async (docType: string, docTitle: string) => {
  return sendTargetedPushNotification({
    title: `📄 ${docType} Baharu Disediakan`,
    body: `${docTitle} telah berjaya dijana dan sedia untuk dirujuk.`,
    targetAudience: 'ajk',
    url: '/laporan',
    triggerType: 'notifyReports'
  });
};

export const notifyOnNewMemberRegistration = async ({
  applicantName,
  noRumah,
  phone,
  applicantUid
}: {
  applicantName: string;
  noRumah?: string;
  phone?: string;
  applicantUid?: string;
}) => {
  const houseInfo = noRumah ? ` (No. Rumah/Kelas: ${noRumah})` : '';
  return sendTargetedPushNotification({
    title: '📋 Pendaftaran Ahli / Warga Baharu SMAUJ',
    body: `Permohonan pendaftaran diterima daripada ${applicantName || 'Pemohon'}${houseInfo}. Sila buat semakan di Kelulusan Ahli.`,
    targetAudience: 'leadership',
    url: '/kelulusan-ahli',
    triggerType: 'notifyNewMemberRegistration'
  });
};


