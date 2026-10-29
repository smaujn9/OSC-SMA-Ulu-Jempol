import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { 
  Post, FeeItem, Announcement, UpcomingEvent, BlogItem, ActiveMember, ImageFeePackage, AppNotification, NotisPanggilan, CaseRecord
} from '../types';
import { 
  USER_AHMAD, UPCOMING_EVENTS, BLOG_POSTS 
} from '../data/mockData';
import { 
  LayoutDashboard, FileText, Landmark, CreditCard, Megaphone, Calendar as CalendarIcon, 
  MessageSquare, BookOpen, Users, Folder, MoreHorizontal, Search, Bell, ChevronLeft, 
  ChevronRight, ArrowRight, ArrowUpRight, CheckCircle2, UserCheck, BarChart3, Plus,
  ShoppingCart, Trash2, X, Check, Loader2, UserPlus, Shield, ShieldCheck, LogIn, LogOut, User, Lock, Download, FileCheck, FileSpreadsheet, Wallet, Upload, Clock, AlertCircle, AlertTriangle, Sparkles, RotateCw,
  Sun, Moon
} from 'lucide-react';
import { ConfirmLogoutModal } from './ConfirmLogoutModal';
import ChatSection from './ChatSection';
import YuranSection from './YuranSection';
import ProfileSection from './ProfileSection';
import LaporanSection from './LaporanSection';
import BlogSection from './BlogSection';
import TakwimSection from './TakwimSection';
import PengumumanSection from './PengumumanSection';
import KewanganSection, { INITIAL_TRANSACTIONS, KewanganTransaction } from './KewanganSection';
import { YuranConfig, getPackagePrice } from '../utils/yuranConfigHelper';
import { db } from '../lib/firebase';
import { cleanUndefined } from '../utils/firestoreUtils';
import { doc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth, resolveUserAvatar } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DaftarAhliSection from './DaftarAhliSection';
import AdminSection from './AdminSection';
import AhliJawatankuasaSection from './AhliJawatankuasaSection';
import { AssociationLogo } from './AssociationLogo';
import DokumenSection from './DokumenSection';
import SuratSection from './SuratSection';
import MinitMesyuaratSection from './MinitMesyuaratSection';
import NotisPanggilanSection from './NotisPanggilanSection';
import KehadiranSection from './KehadiranSection';
import KertasKerjaSection from './KertasKerjaSection';
import BannerLaporkanKes from './BannerLaporkanKes';
import BannerSumbangan from './BannerSumbangan';

import KelulusanAhliSection from './KelulusanAhliSection';
import BlogImageCarousel from './BlogImageCarousel';
import { Heart } from 'lucide-react';
import { SumbanganModal } from './SumbanganModal';
import SumbanganSection from './SumbanganSection';
import PetaPendudukSection from './PetaPendudukSection';

import { checkNotificationSupport, registerServiceWorker, subscribeUserToPush } from '../utils/notificationHelper';

import { uploadReceiptImage } from '../utils/uploadReceipt';
import { parseDateToMs, getUpcomingEvents } from '../utils/dateUtils';

interface DesktopViewProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  posts: Post[];
  onAddPost: (content: string, image?: string, scope?: 'Awam' | 'Ahli Jawatankuasa') => void;
  onLikePost: (postId: string) => void;
  onAddComment: (postId: string, commentContent: string) => void;
  onDeletePost?: (postId: string) => void;
  onDeleteComment?: (postId: string, commentId: string) => void;
  fees: FeeItem[];
  onPayFees: (
    feeIds: string[], 
    bankName: string, 
    paidPackages?: ImageFeePackage[],
    options?: {
      isManual?: boolean;
      receiptAttachment?: string;
      approvalStatus?: 'Pending' | 'Approved';
      notes?: string;
      aiVerified?: boolean;
      aiDetectedAmount?: number | null;
      aiConfidence?: string;
      aiNotes?: string;
    }
  ) => void;
  packages: ImageFeePackage[];
  setPackages: Dispatch<SetStateAction<ImageFeePackage[]>>;
  cartPackageIds: string[];
  setCartPackageIds: Dispatch<SetStateAction<string[]>>;
  blogs: BlogItem[];
  setBlogs: Dispatch<SetStateAction<BlogItem[]>>;
  programReports: any[];
  onAddProgramReport: (newReport: any) => void;
  onUpdateProgramReport?: (updatedReport: any) => void;
  onDeleteProgramReport?: (id: string) => void;
  events: UpcomingEvent[];
  onAddEvent: (event: UpcomingEvent) => void;
  onUpdateEvent: (event: UpcomingEvent) => void;
  onDeleteEvent: (id: string) => void;
  onMoveEvent: (id: string) => void;
  announcements: Announcement[];
  onAddAnnouncement: (announcement: Announcement) => void;
  onUpdateAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  transactions: KewanganTransaction[];
  notifications: AppNotification[];
  setNotifications: Dispatch<SetStateAction<AppNotification[]>>;
  hasUnreadNotifications: boolean;
  setHasUnreadNotifications: Dispatch<SetStateAction<boolean>>;
  viewedMember?: ActiveMember | null;
  setViewedMember?: (member: ActiveMember | null) => void;
  yuranConfig: YuranConfig;
  cases?: CaseRecord[];
}

export default function DesktopView({
  currentView,
  setCurrentView,
  posts,
  onAddPost,
  onLikePost,
  onAddComment,
  onDeletePost,
  onDeleteComment,
  fees,
  onPayFees,
  packages,
  setPackages,
  cartPackageIds,
  setCartPackageIds,
  blogs,
  setBlogs,
  programReports,
  onAddProgramReport,
  onUpdateProgramReport,
  onDeleteProgramReport,
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onMoveEvent,
  announcements,
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  transactions,
  notifications,
  setNotifications,
  hasUnreadNotifications,
  setHasUnreadNotifications,
  viewedMember,
  setViewedMember,
  yuranConfig,
  cases = []
}: DesktopViewProps) {
  
  const { firebaseUser, currentUserDoc, loginWithGoogle, logout, allUsers, allApplications } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const kuiriApp = React.useMemo(() => {
    if (!firebaseUser) return null;
    const userEmail = (currentUserDoc?.email || firebaseUser?.email || '').toLowerCase().trim();
    const userIc = (currentUserDoc?.icNumber || '').trim();
    const userMemberNo = (currentUserDoc?.memberNo || '').trim();
    return (allApplications || []).find(app => 
      (app.uid === currentUserDoc?.uid || app.uid === firebaseUser?.uid || app.id === `app-${firebaseUser?.uid}` || app.id === firebaseUser?.uid || (userEmail && app.email && app.email.toLowerCase().trim() === userEmail) || (userIc && app.icNumber && app.icNumber.trim() === userIc) || (userMemberNo && app.memberNo && app.memberNo.trim() === userMemberNo)) &&
      (app.status === 'Kuiri' || app.status === 'Kuiri Permohonan' || app.status === 'Perlu Kemaskini')
    ) || null;
  }, [allApplications, currentUserDoc, firebaseUser]);

  const isKuiriUser = Boolean(
    currentUserDoc?.membershipStatus === 'Kuiri' ||
    currentUserDoc?.approvalStatus === 'Kuiri' ||
    !!kuiriApp
  );

  const kuiriRemarks = kuiriApp?.remarks || currentUserDoc?.kuiriRemarks || '';
  const kuiriItems: string[] = kuiriApp?.kuiriItems || (currentUserDoc as any)?.kuiriItems || [];

  const userRole = (currentUserDoc?.role || 'TETAMU').toUpperCase();
  const isAdminUtama = Boolean(
    userRole === 'ADMIN UTAMA' ||
    userRole === 'ADMIN' ||
    currentUserDoc?.role === 'ADMIN UTAMA' ||
    currentUserDoc?.role === 'ADMIN' ||
    currentUserDoc?.isSuperAdmin === true ||
    (currentUserDoc?.email && currentUserDoc.email.toLowerCase().trim() === 'g-59129199@moe-dl.edu.my') ||
    (firebaseUser?.email && firebaseUser.email.toLowerCase().trim() === 'g-59129199@moe-dl.edu.my')
  );

  const isGuru = userRole === 'GURU';
  const isMurid = userRole === 'MURID';
  const isIbuBapa = userRole === 'IBU BAPA';
  const isKpm = userRole === 'KPM/JPN/NAZIR/PPD';
  const isTetamu = !firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid === 'guest_local' || userRole === 'TETAMU' || userRole === 'PELAWAT';

  const isApprovedMember = Boolean(
    isAdminUtama ||
    isGuru ||
    isMurid ||
    isIbuBapa ||
    isKpm ||
    (!isKuiriUser && (
      currentUserDoc?.membershipStatus === 'Aktif' || 
      currentUserDoc?.membershipStatus === 'Active' || 
      currentUserDoc?.membershipStatus === 'Diluluskan' || 
      currentUserDoc?.membershipStatus === 'Diluluskan Keahlian' ||
      currentUserDoc?.approvalStatus === 'Approved' || 
      currentUserDoc?.approvalStatus === 'Diluluskan' || 
      currentUserDoc?.approvalStatus === 'Diluluskan Keahlian' || 
      !!currentUserDoc?.memberNo || 
      (currentUserDoc?.role && !['Pelawat', 'Tetamu', 'TETAMU', 'Tiada', 'Penduduk'].includes(currentUserDoc.role)) || 
      currentUserDoc?.isSuperAdmin === true ||
      (allUsers || []).some(u => 
        (u.uid === firebaseUser?.uid || (u.email && firebaseUser?.email && u.email.toLowerCase().trim() === firebaseUser.email.toLowerCase().trim())) &&
        (u.membershipStatus === 'Aktif' || !!u.memberNo || u.approvalStatus === 'Approved') &&
        u.membershipStatus !== 'Kuiri' &&
        u.approvalStatus !== 'Kuiri'
      ) ||
      (allApplications || []).some(app => 
        (app.uid === currentUserDoc?.uid || app.uid === firebaseUser?.uid || app.id === `app-${firebaseUser?.uid}` || app.id === firebaseUser?.uid || (app.email && (app.email.toLowerCase().trim() === (currentUserDoc?.email || '').toLowerCase().trim() || app.email.toLowerCase().trim() === (firebaseUser?.email || '').toLowerCase().trim()))) &&
        (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian' || app.status === 'Approved') &&
        app.status !== 'Kuiri'
      )
    ))
  );

  React.useEffect(() => {
    try {
      localStorage.setItem('tmf2_is_approved_member', isApprovedMember ? '1' : '0');
    } catch (e) {}
  }, [isApprovedMember]);

  const pendingTxnCount = React.useMemo(() => {
    return (transactions || []).filter(t => t.approvalStatus === 'Pending').length;
  }, [transactions]);

  const totalKutipan = React.useMemo(() => {
    let currentBank = 0;
    let currentTunai = 0;
    const approved = (transactions || []).filter(t => t.approvalStatus === 'Approved');
    approved.forEach(txn => {
      if (txn.category === "Baki Bawa Hadapan") return;
      if (txn.accountDebit === "Bank") currentBank += txn.amount;
      if (txn.accountCredit === "Bank") currentBank -= txn.amount;
      if (txn.accountDebit === "Tunai") currentTunai += txn.amount;
      if (txn.accountCredit === "Tunai") currentTunai -= txn.amount;
    });
    return currentBank + currentTunai;
  }, [transactions]);
  
  const [activeAnnouncementIdx, setActiveAnnouncementIdx] = useState(0);
  const [aktivitiCategory, setAktivitiCategory] = useState<string>('Semua');
  const [headerSearch, setHeaderSearch] = useState('');
  const [activeBlog, setActiveBlog] = useState<BlogItem | null>(null);
  const guestAvatar = "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc";
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const { clearAllLocalCaches } = await import('../utils/imageUtils');
      await clearAllLocalCaches(true);
      window.location.reload();
    } catch (e) {
      console.error("Gagal membersihkan cache:", e);
      window.location.reload();
    }
  };
  const [currentAvatar, setCurrentAvatar] = useState(USER_AHMAD.avatar);
  const [currentName, setCurrentName] = useState(() => localStorage.getItem('tmf2_contact_nickname') || USER_AHMAD.name);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const handleAvatarChange = () => {
      setCurrentAvatar(USER_AHMAD.avatar);
    };
    const handleProfileUpdate = () => {
      setCurrentName(localStorage.getItem('tmf2_contact_nickname') || USER_AHMAD.name);
    };
    window.addEventListener('tmf2_avatar_changed', handleAvatarChange);
    window.addEventListener('tmf2_profile_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('tmf2_avatar_changed', handleAvatarChange);
      window.removeEventListener('tmf2_profile_updated', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    if (announcements.length === 0) return;
    const interval = setInterval(() => {
      setActiveAnnouncementIdx((prev) => (prev < announcements.length - 1 ? prev + 1 : 0));
    }, 5000); // Auto-slide every 5 seconds
    return () => clearInterval(interval);
  }, [announcements.length]);

  const [showCartDropdown, setShowCartDropdown] = useState(false);
  const [showLoginStatus, setShowLoginStatus] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const handleOpenLogout = () => {
      setShowLogoutConfirmModal(true);
    };
    window.addEventListener('tmf2_open_logout_modal', handleOpenLogout);
    return () => window.removeEventListener('tmf2_open_logout_modal', handleOpenLogout);
  }, []);

  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (e) {
      console.error("Ralat log keluar:", e);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirmModal(false);
    }
  };

  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
      
      // Auto-sync existing subscription if granted
      const autoSyncGrantedNotification = async () => {
        const support = checkNotificationSupport();
        if (support.supported && Notification.permission === 'granted') {
          try {
            console.log('[Notification] Permission is already granted. Ensuring subscription is active and synced...');
            const reg = await registerServiceWorker();
            await subscribeUserToPush(reg);
          } catch (e) {
            console.warn('[Notification] Failed to auto-sync active subscription:', e);
          }
        }
      };
      autoSyncGrantedNotification();
    }
  }, []);

  const requestNotificationPermission = async () => {
    setNotificationError(null);
    const support = checkNotificationSupport();
    if (!support.supported) {
      setNotificationError(support.message);
      return;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') {
        // Jangan paksa popup keluar semula
        return;
      }

      try {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);

        if (perm === 'granted') {
          // Play a friendly activation chime
          try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(523.25, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
              gain.gain.setValueAtTime(0.12, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.4);
            }
          } catch (e) {}

          const reg = await registerServiceWorker();
          await subscribeUserToPush(reg);

          // Show a welcome test notification
          const title = "🔔 Notifikasi Sistem Aktif";
          const options = {
            body: "Terima kasih! Anda kini akan menerima kemas kini pengumuman dan blog dengan segera.",
            tag: 'smauj-welcome'
          };
          reg.showNotification(title, options).catch(() => {
            new Notification(title, options);
          });
        }
      } catch (error) {
        console.error('[DesktopView] Ralat semasa mengaktifkan notifikasi:', error);
        setNotificationError(error instanceof Error ? error.message : 'Gagal mengaktifkan notifikasi.');
      }
    }
  };

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        return true;
      }
    }
    return false;
  });

  const [showInstallBadge, setShowInstallBadge] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem('tmf2_install_badge_seen');
      return !seen;
    }
    return false;
  });

  const [tickedNotice, setTickedNotice] = useState<NotisPanggilan | null>(null);

  useEffect(() => {
    if (!db) {
      setTickedNotice(null);
      return;
    }
    const q = query(collection(db, 'notisPanggilan'));
    const unsub = onSnapshot(q, (snapshot) => {
      let found: NotisPanggilan | null = null;
      snapshot.forEach((doc) => {
        const data = doc.data() as NotisPanggilan;
        if (data.isTick) {
          found = { id: doc.id, ...data };
        }
      });
      setTickedNotice(found);
    }, (error) => {
      console.warn("Ralat memuatkan notis panggilan dalam DesktopView:", error);
    });
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Pick up the prompt if it was already captured globally
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
      }

      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleCustomBeforeInstallPrompt = (e: any) => {
        setDeferredPrompt(e.detail);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('tmf2_beforeinstallprompt', handleCustomBeforeInstallPrompt as any);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('tmf2_beforeinstallprompt', handleCustomBeforeInstallPrompt as any);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleTriggerInstall = () => {
        handleInstallClick();
      };
      window.addEventListener('tmf2_trigger_install', handleTriggerInstall);
      return () => {
        window.removeEventListener('tmf2_trigger_install', handleTriggerInstall);
      };
    }
  }, [deferredPrompt]);

  useEffect(() => {
    if (showNotifications) {
      setHasUnreadNotifications(false);
    }
  }, [showNotifications]);

  useEffect(() => {
    const container = document.getElementById('desktop-main-scroll');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'instant' as any });
    }
  }, [currentView]);

  const handleInstallClick = async () => {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    // If inside iframe, show instructions to open in new tab
    if (isInIframe) {
      setShowInstallModal(true);
      return;
    }

    const promptToUse = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);

    // Try native prompt first — do NOT show fallback guide if native prompt is available
    if (promptToUse) {
      try {
        promptToUse.prompt();
        const { outcome } = await promptToUse.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') (window as any).deferredPrompt = null;
      } catch (err) {
        console.warn('Error during PWA installation:', err);
        // Native prompt failed, show fallback guide
        setShowInstallModal(true);
      }
    } else {
      // No native prompt available, show manual instructions as fallback
      setShowInstallModal(true);
    }
  };

  const [showHeaderFPXModal, setShowHeaderFPXModal] = useState(false);
  const [headerSelectedBank, setHeaderSelectedBank] = useState('');
  const [headerPaymentStep, setHeaderPaymentStep] = useState<'select-bank' | 'authenticating' | 'processing' | 'success' | 'success-manual'>('select-bank');
  const [headerFpxUsername, setHeaderFpxUsername] = useState('ahmad_tmf2');
  const [headerFpxPassword, setHeaderFpxPassword] = useState('********');

  const [paymentTab, setPaymentTab] = useState<'fpx' | 'manual'>('fpx');
  const [manualReceiptFile, setManualReceiptFile] = useState<File | null>(null);
  const [manualReceiptPreview, setManualReceiptPreview] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);

  // AI Vision Receipt Scanner States
  const [aiScanStatus, setAiScanStatus] = useState<'idle' | 'scanning' | 'valid' | 'invalid'>('idle');
  const [aiScanResult, setAiScanResult] = useState<{
    isValidReceipt: boolean;
    detectedAmount: number | null;
    aiNotes: string;
    confidence?: string;
  } | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string>('');

  const selectedCartPackages = packages.filter(p => cartPackageIds.includes(p.id));
  const subTotalCart = selectedCartPackages.reduce((sum, p) => sum + getPackagePrice(p), 0);
  const cartFpxFee = selectedCartPackages.length > 0 ? (yuranConfig.fpxCharge ?? 1.00) : 0.00;
  const hasOtherTambahanInCart = selectedCartPackages.some(p => p.category === 'Tambahan');
  const isFpxSurcharge = hasOtherTambahanInCart ? true : (yuranConfig.fpxSurchargeMode ?? true);
  const cartTotalAmount = selectedCartPackages.length > 0
    ? isFpxSurcharge 
      ? subTotalCart + cartFpxFee 
      : subTotalCart 
    : 0.00;

  const verifyReceiptWithAi = async (file: File) => {
    setAiScanStatus('scanning');
    setAiErrorMessage('');
    setAiScanResult(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const res = await fetch('/api/verify-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          expectedAmount: subTotalCart
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyemak resit.');
      }

      if (data.isValidReceipt) {
        if (data.detectedAmount !== null && Math.abs(data.detectedAmount - subTotalCart) > 0.01) {
          setAiScanStatus('invalid');
          setAiScanResult(data);
          setAiErrorMessage(`RALAT AMAUN RESIT: Amaun pada resit (RM ${data.detectedAmount.toFixed(2)}) TIDAK PADAN dengan amaun yuran yang perlu dibayar (RM ${subTotalCart.toFixed(2)}). Sila muat naik resit dengan amaun bayaran yang betul.`);
          return { success: false, data };
        } else {
          setAiScanStatus('valid');
          setAiScanResult(data);
          return { success: true, data };
        }
      } else {
        setAiScanStatus('invalid');
        setAiScanResult(data);
        setAiErrorMessage(data.aiNotes || 'Amaran: Gambar/fail yang dimuat naik bukan resit transaksi pembayaran yang sah. Sila muat naik resit yang sah.');
        return { success: false, data };
      }
    } catch (err: any) {
      console.warn("Ralat AI Vision:", err);
      setAiScanStatus('invalid');
      setAiErrorMessage('Gagal mengesahkan resit dengan AI Vision. Sila pastikan gambar resit jelas dan sah.');
      return { success: false, error: err.message };
    }
  };

  const handleConfirmManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReceiptFile) {
      alert("Sila muat naik gambar resit bukti bayaran terlebih dahulu.");
      return;
    }

    try {
      setIsUploadingReceipt(true);

      let aiRes = aiScanResult;
      if (!aiRes || aiScanStatus !== 'valid') {
        const scan = await verifyReceiptWithAi(manualReceiptFile);
        if (!scan.success) {
          alert(scan.data?.aiNotes || scan.error || "Amaran: Fail/Gambar yang dimuat naik bukan resit transaksi pembayaran yang sah. Sila muat naik resit yang sah.");
          setIsUploadingReceipt(false);
          return;
        }
        aiRes = scan.data;
      }

      const receiptUrl = await uploadReceiptImage(manualReceiptFile);

      const parentIdsToPay = selectedCartPackages.length > 0
        ? Array.from(new Set(selectedCartPackages.map(p => p.id)))
        : [];

      onPayFees(parentIdsToPay, 'Bayaran Manual', selectedCartPackages, {
        isManual: true,
        receiptAttachment: receiptUrl,
        approvalStatus: 'Pending',
        notes: manualNotes || 'Bayaran manual bukti resit muat naik.',
        aiVerified: true,
        aiDetectedAmount: aiRes?.detectedAmount ?? null,
        aiConfidence: (aiRes?.confidence as any) || 'Passed',
        aiNotes: aiRes?.aiNotes || 'Resit disahkan oleh OpenRouter AI Vision.'
      });

      setCartPackageIds([]);
      setHeaderPaymentStep('success-manual');
    } catch (err) {
      console.error("Ralat muat naik resit:", err);
      alert("Gagal memuat naik resit. Sila cuba lagi.");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Form Pengeluaran States
  const [showLainLainShortcuts, setShowLainLainShortcuts] = useState<boolean>(false);
  const [showSumbanganModal, setShowSumbanganModal] = useState<boolean>(false);
  const [pTarikh, setPTarikh] = useState<string>(() => {
    const today = new Date();
    // Use local timezone to get YYYY-MM-DD
    const offset = today.getTimezoneOffset();
    return new Date(today.getTime() - (offset*60*1000)).toISOString().split('T')[0];
  });
  const [pVoucher, setPVoucher] = useState<string>("");
  const [pKategori, setPKategori] = useState<string>("Program Komuniti");
  const [pAmaun, setPAmaun] = useState<string>("");
  const [pSumber, setPSumber] = useState<string>("Bank");
  const [pPenerima, setPPenerima] = useState<string>("");
  const [pPerihalan, setPPerihalan] = useState<string>("");
  const [pCatatan, setPCatatan] = useState<string>("");
  const [pSuccess, setPSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (currentView === 'pengeluaran' || currentView === 'dashboard') {
      const nextNum = (transactions?.length || 0) + 1;
      setPVoucher(`VCH-2026-${String(nextNum).padStart(4, '0')}`);
    }
  }, [currentView, transactions]);

  const handleSavePengeluaran = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(pAmaun);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Sila masukkan amaun pengeluaran yang sah (lebih daripada 0).");
      return;
    }
    if (!pPerihalan.trim()) {
      alert("Sila masukkan perihalan pengeluaran.");
      return;
    }

    const nextIdNum = (transactions?.length || 0) + 1;
    const generatedId = `TXN-2026-${String(nextIdNum).padStart(4, '0')}`;

    const newTxn: KewanganTransaction = {
      id: generatedId,
      voucherNo: pVoucher || `VCH-2026-${String(nextIdNum).padStart(4, '0')}`,
      date: pTarikh,
      time: new Date().toTimeString().slice(0, 5),
      accountDebit: pKategori,      // Expense category is debited
      accountCredit: pSumber,       // Bank/Tunai is credited
      amount: amountNum,
      description: `${pPerihalan}${pPenerima ? ` (Dibayar kepada: ${pPenerima})` : ''}`,
      category: pKategori,
      recordedBy: "Ahmad (Bendahari)",
      approvalStatus: "Pending" as const,
      notes: pCatatan,
      auditTrail: [
        {
          time: `${pTarikh} ${new Date().toTimeString().slice(0, 5)}`,
          user: "Ahmad (Bendahari)",
          action: `Merekod pengeluaran luar talian (${pVoucher})`
        }
      ]
    };

    await setDoc(doc(db, 'kewanganTransactions', generatedId), cleanUndefined(newTxn));

    // Show success and reset
    setPSuccess(true);
    setPAmaun("");
    setPPerihalan("");
    setPPenerima("");
    setPCatatan("");

    setTimeout(() => {
      setPSuccess(false);
      // Navigate to Kewangan view
      setCurrentView('kewangan');
    }, 1500);
  };

  const handleRemoveFromCart = (pkgId: string) => {
    setCartPackageIds(prev => prev.filter(id => id !== pkgId));
  };

  const handleAdjustCustomCartAmount = (pkgId: string, delta: number) => {
    setPackages(prev => prev.map(p => {
      if (p.id === pkgId) {
        const email = currentUserDoc?.email || '';
        const totalPaid = transactions
          .filter(t => t.memberEmail === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(pkgId))
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        const remaining = Math.max(0, p.price - totalPaid);

        const currentVal = p.customCartAmount ?? remaining;
        let newVal = currentVal + delta;
        if (newVal < 1) newVal = 1;
        if (newVal > remaining) newVal = remaining;

        return {
          ...p,
          customCartAmount: parseFloat(newVal.toFixed(2))
        };
      }
      return p;
    }));
  };

  const handleInputCustomCartAmount = (pkgId: string, value: string) => {
    let numVal = parseFloat(value) || 0;
    setPackages(prev => prev.map(p => {
      if (p.id === pkgId) {
        const email = currentUserDoc?.email || '';
        const totalPaid = transactions
          .filter(t => t.memberEmail === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(pkgId))
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        const remaining = Math.max(0, p.price - totalPaid);

        if (numVal < 0) numVal = 0;
        if (numVal > p.price) numVal = p.price;

        return {
          ...p,
          customCartAmount: numVal
        };
      }
      return p;
    }));
  };

  const handleConfirmHeaderFPXLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerSelectedBank) return;
    
    setHeaderPaymentStep('authenticating');
    setTimeout(() => {
      setHeaderPaymentStep('processing');
      setTimeout(() => {
        // Mark paid locally
        setPackages(prev => prev.map(p => {
          if (cartPackageIds.includes(p.id)) {
            return { ...p, isPaid: true };
          }
          return p;
        }));

        // Sync with parent's original fees list
        const unpaidParentFeeIds = fees.filter(f => !f.isPaid).map(f => f.id);
        if (unpaidParentFeeIds.length > 0) {
          const numToPay = Math.min(unpaidParentFeeIds.length, cartPackageIds.length);
          const parentIdsToPay = unpaidParentFeeIds.slice(0, numToPay);
          if (parentIdsToPay.length > 0) {
            onPayFees(parentIdsToPay, headerSelectedBank, selectedCartPackages);
          } else {
            onPayFees([unpaidParentFeeIds[0]], headerSelectedBank, selectedCartPackages);
          }
        } else {
          onPayFees([], headerSelectedBank, selectedCartPackages);
        }

        setHeaderPaymentStep('success');
        setCartPackageIds([]); // Reset cart
      }, 2000);
    }, 1500);
  };

  const BANKS = [
    { name: 'Maybank2u', logo: '🟡' },
    { name: 'CIMB Clicks', logo: '🔴' },
    { name: 'Bank Islam', logo: '🟢' },
    { name: 'Public Bank', logo: '🔴' },
    { name: 'RHB Now', logo: '🔵' },
    { name: 'AmOnline', logo: '🟡' },
  ];



  const hasAdminAccess = Boolean(
    isAdminUtama ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi', 'Naib Pengerusi'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const hasKelulusanAhliAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi', 'Naib Pengerusi'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const pendingMembershipCount = React.useMemo(() => {
    if (!hasAdminAccess) return 0;
    return (allApplications || []).filter(app => {
      const st = (app.status || '').toLowerCase().trim();
      return st === 'pending' || st === 'menunggu kelulusan' || st === 'menunggu';
    }).length;
  }, [allApplications, hasAdminAccess]);

  const isAhliAktif = isApprovedMember;

  const isGoogleSignedIn = firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local';

  const hasYuranAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    isIbuBapa ||
    isMurid ||
    isAhliAktif ||
    (currentUserDoc && [
      'Admin Utama', 'ADMIN UTAMA', 'GURU', 'IBU BAPA', 'MURID', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha',
      'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Ahli Jawatankuasa', 'Juru Audit', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat'
    ].includes(currentUserDoc.role)) ||
    currentUserDoc?.isSuperAdmin === true
  );

  const hasCommitteeAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 
      'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Ahli Jawatankuasa'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const hasDokumenAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 
      'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const hasSuratAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 
      'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const hasMinitAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 
      'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const hasNotisPanggilanAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 
      'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const hasKertasKerjaAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 
      'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  const hasKewanganAccess = Boolean(
    isAdminUtama ||
    isGuru ||
    (currentUserDoc && (
      ['Admin Utama', 'ADMIN UTAMA', 'GURU', 'Guru', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Juru Audit'].includes(currentUserDoc.role) ||
      currentUserDoc.isSuperAdmin === true
    ))
  );

  // Sidebar navigation mapping categorized with section headers
  const sidebarSections = [
    {
      title: "Menu Utama",
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'laporan', label: 'Laporan Program', icon: FileText, locked: !isAhliAktif },
        { id: 'kewangan', label: 'Kewangan', icon: Landmark, locked: !hasKewanganAccess },
        { id: 'yuran', label: 'Bayar Yuran', icon: CreditCard, locked: !hasYuranAccess },
      ]
    },
    ...(hasAdminAccess || hasKelulusanAhliAccess ? [{
      title: "Pentadbiran",
      items: [
        ...(hasAdminAccess ? [{ id: 'admin', label: 'Panel Admin', icon: Shield, locked: !hasAdminAccess }] : []),
        ...(hasKelulusanAhliAccess ? [{ id: 'kelulusan-ahli', label: 'Kelulusan Ahli', icon: CheckCircle2, locked: !hasKelulusanAhliAccess }] : []),
      ]
    }] : []),
    {
      title: "Maklumat & Hebahan",
      items: [
        { id: 'pengumuman', label: 'Pengumuman', icon: Megaphone, locked: !isAhliAktif },
        { id: 'takwim', label: 'Takwim', icon: CalendarIcon, locked: !isAhliAktif },
      ]
    },
    {
      title: "Komuniti & Interaksi",
      items: [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'chat', label: 'Chat Komuniti', icon: MessageSquare },
        { id: 'blog', label: 'Blog Komuniti', icon: BookOpen },
        { id: 'ahli', label: 'Ahli Jawatankuasa', icon: Users },
        { id: 'sumbangan', label: 'Sumbangan', icon: Heart },
      ]
    },
    {
      title: "Dokumen & Sumber",
      items: [
        { id: 'dokumen', label: 'Dokumen Persatuan', icon: Folder, locked: !hasDokumenAccess },
        { id: 'surat', label: 'Jana Surat', icon: FileText, locked: !hasSuratAccess },
        { id: 'minit-mesyuarat', label: 'Minit Mesyuarat', icon: FileCheck, locked: !hasMinitAccess },
        { id: 'notis-panggilan', label: 'Notis Panggilan', icon: Bell, locked: !hasNotisPanggilanAccess },
        { id: 'kertas-kerja', label: 'Kertas Kerja', icon: FileSpreadsheet, locked: !hasKertasKerjaAccess },
      ]
    }
  ];

  // Quick action shortcuts
  const shortcuts = [
    { id: 'laporan', label: 'Laporan Program', icon: FileText, bg: 'bg-blue-50 text-blue-600', locked: !isAhliAktif },
    { id: 'kewangan', label: 'Kewangan', icon: Landmark, bg: 'bg-emerald-50 text-emerald-600', locked: !hasKewanganAccess },
    { id: 'yuran', label: 'Bayar Yuran', icon: CreditCard, bg: 'bg-purple-50 text-purple-600', locked: !hasYuranAccess },
    { id: 'pengumuman', label: 'Pengumuman', icon: Megaphone, bg: 'bg-pink-50 text-pink-600', locked: !isAhliAktif },
    { id: 'takwim', label: 'Takwim', icon: CalendarIcon, bg: 'bg-indigo-50 text-indigo-600', locked: !isAhliAktif },
    { id: 'sumbangan', label: 'Sumbangan', icon: Heart, bg: 'bg-rose-50 text-rose-600', locked: false },
    { id: 'chat', label: 'Chat Komuniti', icon: MessageSquare, bg: 'bg-teal-50 text-teal-600' },
    { id: 'ahli', label: 'Ahli Jawatankuasa', icon: Users, bg: 'bg-violet-50 text-violet-600' },
    { id: 'admin', label: 'Panel Admin', icon: Shield, bg: 'bg-blue-50 text-blue-600', locked: !hasAdminAccess },
    { id: 'lain-lain', label: 'Lain-lain', icon: MoreHorizontal, bg: 'bg-slate-50 text-slate-600' },
  ];

  const aksesDitolakCard = (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-100 shadow-3xs max-w-lg mx-auto mt-12 space-y-4">
      <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
        <Lock className="w-7 h-7" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">AKSES TERHAD: PERANAN TETAMU</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          Menu ini hanya boleh diakses oleh peranan sah sekolah (ADMIN, GURU, MURID, IBU BAPA, atau KPM/JPN/NAZIR/PPD).
        </p>
      </div>
      <div className="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-600 font-bold border border-slate-100 max-w-sm">
        Peranan akaun anda pada masa ini adalah <span className="font-extrabold text-indigo-600">TETAMU</span>. Pentadbir Sekolah (ADMIN UTAMA) akan menetapkan peranan rasmi anda melalui Panel Pentadbiran.
      </div>
      {!firebaseUser || firebaseUser.isAnonymous ? (
        <button
          onClick={loginWithGoogle}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-150 transition-all cursor-pointer hover:scale-[1.01]"
        >
          LOG MASUK GOOGLE
        </button>
      ) : (
        <div className="text-[11px] font-bold text-slate-500">
          Sila maklumkan kepada Pentadbir Sekolah untuk penetapan peranan anda.
        </div>
      )}
    </div>
  );

  return (
    <div className="flex bg-slate-50 w-full h-full min-h-0 text-slate-800 font-sans antialiased overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 h-full bg-indigo-950 text-white/90 flex flex-col shrink-0 border-r border-indigo-900/40 relative overflow-hidden">
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-indigo-900/60">
          <div className="shrink-0">
            <AssociationLogo size={42} className="shadow-md" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white">SMAUJ Portal</h1>
            <p className="text-[10px] text-indigo-200/80 font-bold tracking-wide">SMA Ulu Jempol</p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 pl-3 pr-2 py-4 space-y-4 overflow-y-auto sidebar-scrollbar">
          {sidebarSections.map((section, idx) => (
            <div key={section.title || `sidebar-sec-${idx}`} className={idx > 0 ? "pt-1" : ""}>
              {/* Section Header */}
              <h3 className="px-3.5 mb-1.5 text-[10px] uppercase tracking-wider font-extrabold text-indigo-300/40">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id || `nav-item-${itemIdx}`}
                      onClick={() => setCurrentView(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-700/20' 
                          : 'text-indigo-200/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="relative">
                          <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                          {item.id === 'kewangan' && pendingTxnCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-indigo-950 animate-pulse">
                              {pendingTxnCount}
                            </span>
                          )}
                          {item.id === 'kelulusan-ahli' && hasAdminAccess && pendingMembershipCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-indigo-950 animate-pulse">
                              {pendingMembershipCount}
                            </span>
                          )}
                        </div>
                        <span>{item.label}</span>
                      </div>
                      {item.locked && (
                        <Lock size={12} className="opacity-40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Auth status & actions in Sidebar */}
        <div className="px-4 pt-4 border-t border-indigo-900/60 space-y-2.5">
          {/* Log In / Log Out button */}
          {firebaseUser && !firebaseUser.isAnonymous ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowLogoutConfirmModal(true);
              }}
              className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-extrabold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut size={13} />
              <span>Log Keluar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await loginWithGoogle();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 text-[11px] font-extrabold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <LogIn size={13} />
              <span>Log Masuk Google</span>
            </button>
          )}

          {/* Status Keahlian */}
          <div className="bg-indigo-900/30 rounded-xl p-3 border border-indigo-900/40 space-y-1">
            <span className="text-[9px] text-indigo-400 font-extrabold block uppercase tracking-wider">
              Status Keahlian
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-100 font-bold truncate max-w-[120px]">
                {currentUserDoc?.role || 'TETAMU'}
              </span>
              {(() => {
                if (!firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid === 'guest_local') {
                  return (
                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-xs uppercase tracking-wide bg-slate-500/20 text-slate-300 border border-slate-500/20">
                      TETAMU
                    </span>
                  );
                }
                const status = currentUserDoc?.membershipStatus;
                if (status === 'Aktif') {
                  return (
                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-xs uppercase tracking-wide bg-green-500/20 text-green-300 border border-green-500/20">
                      Aktif
                    </span>
                  );
                } else if (status === 'Menunggu Kelulusan') {
                  return (
                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-xs uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Menunggu
                    </span>
                  );
                } else if (status === 'Ditolak') {
                  return (
                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-xs uppercase tracking-wide bg-rose-500/20 text-rose-300 border border-rose-500/20">
                      Ditolak
                    </span>
                  );
                } else {
                  return (
                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-xs uppercase tracking-wide bg-slate-500/20 text-slate-300 border border-slate-500/20">
                      Bukan Ahli
                    </span>
                  );
                }
              })()}
            </div>
          </div>
        </div>

        {/* App Promo Left Sidecard */}
        <div className="p-4 border-t border-indigo-900/60">
          <div className="bg-indigo-900/50 rounded-xl p-4 relative overflow-hidden border border-indigo-800/40">
            <h4 className="text-[10px] font-extrabold text-white leading-normal max-w-[130px]">
              Pasang aplikasi mudah alih kami
            </h4>
            <p className="text-[8px] text-indigo-200/70 mt-1 max-w-[130px] leading-relaxed">
              Dapatkan notifikasi dan kemas kini terus di telefon anda.
            </p>
            
            {/* Phone Illustration mock in corner */}
            <div className="absolute right-[-10px] bottom-[-15px] w-14 h-24 rotate-[-12deg] opacity-70">
              <div className="w-full h-full bg-slate-900 rounded-lg border-2 border-slate-700 p-0.5 shadow-xl relative">
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full mx-auto mb-1" />
                <div className="bg-indigo-600 w-full h-[80%] rounded-sm" />
              </div>
            </div>

            <button 
              onClick={handleInstallClick}
              className="mt-3.5 bg-white text-indigo-950 hover:bg-slate-100 text-[9px] font-extrabold py-2 px-3.5 rounded-lg transition-colors cursor-pointer w-full text-center"
            >
              Pasang aplikasi sekarang
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
        
        {/* TOP NAVIGATION BAR */}
        <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between shrink-0 z-30">
          {/* Search bar */}
          <div className="flex items-center gap-3 w-96">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                placeholder="Cari di Portal SMAUJ..."
                className="w-full h-10 bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs pl-9 pr-8 rounded-xl border border-transparent focus:border-indigo-200 focus:outline-hidden transition-all text-slate-800 font-medium"
              />
              {headerSearch && (
                <button
                  type="button"
                  onClick={() => setHeaderSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* User & Notification shortcuts */}
          <div className="flex items-center gap-4">
            {/* Install Button (Hides when installed) */}
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3f3ebd] hover:bg-[#3433a3] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm animate-pulse"
                title="Pasang Aplikasi SMAUJ"
              >
                <Download size={14} />
                <span>Pasang Aplikasi</span>
              </button>
            )}

            {/* Theme Toggle Button (Mod Terang / Mod Gelap) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-all cursor-pointer text-gray-400 hover:text-amber-500 hover:bg-slate-50 active:scale-95"
              title={isDark ? "Tukar ke Mod Terang" : "Tukar ke Mod Gelap"}
              aria-label={isDark ? "Tukar ke Mod Terang" : "Tukar ke Mod Gelap"}
            >
              {isDark ? (
                <Sun size={18} className="stroke-[2.2] text-amber-400" />
              ) : (
                <Moon size={18} className="stroke-[2.2] text-slate-600" />
              )}
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-xl transition-all cursor-pointer text-gray-400 hover:text-indigo-600 hover:bg-slate-50 ${
                isRefreshing ? 'animate-spin text-indigo-600 bg-indigo-50/50' : ''
              }`}
              title="Muat Semula & Kosongkan Cache"
            >
              <RotateCw size={18} className="stroke-[2.5]" />
            </button>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowCartDropdown(false);
                  setShowLoginStatus(false);
                  if (!showNotifications && showInstallBadge) {
                    setShowInstallBadge(false);
                    localStorage.setItem('tmf2_install_badge_seen', 'true');
                  }
                }}
                className={`p-2 rounded-xl transition-all relative cursor-pointer ${
                  showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-slate-50'
                }`}
                title="Notifikasi"
              >
                <Bell size={18} />
                {(hasUnreadNotifications || (!isInstalled && showInstallBadge)) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-4 text-left space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-extrabold text-xs text-slate-950 uppercase tracking-wider flex items-center gap-2">
                      <Bell size={14} className="text-indigo-600" />
                      Notifikasi Terkini
                    </span>
                    {hasUnreadNotifications && (
                      <button
                        type="button"
                        onClick={() => setHasUnreadNotifications(false)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        Tandakan semua dibaca
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto pr-1 divide-y divide-slate-50">
                    {/* Beautiful customized installation notification at the top */}
                    {!isInstalled && (
                      <div className="p-3 mb-2 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100/60 transition-colors flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Pasang Aplikasi</span>
                          {showInstallBadge ? (
                            <span className="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded-full font-black uppercase flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 bg-white rounded-full inline-block animate-ping" />
                              Baharu
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full font-black uppercase">Sedia</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium leading-normal">
                          Nikmati pengalaman akses lebih pantas dan lancar terus dari skrin utama peranti anda.
                        </p>
                        <button
                          type="button"
                          onClick={handleInstallClick}
                          className="w-full text-center py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                          Pasang Aplikasi
                        </button>
                      </div>
                    )}

                    {/* System Notification Permission Banner */}
                    {(() => {
                      const support = checkNotificationSupport();
                      if (!support.supported) {
                        return (
                          <div className="p-3 mb-2 bg-rose-50/50 border border-rose-100 rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">Notifikasi Sistem</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full font-black uppercase">Tidak Disokong</span>
                            </div>
                            <p className="text-[11px] text-rose-600 font-medium leading-normal">
                              {support.reason === 'not-secure' 
                                ? 'Notifikasi memerlukan sambungan selamat (HTTPS) atau localhost.' 
                                : 'Browser ini tidak menyokong push notification.'}
                            </p>
                          </div>
                        );
                      }

                      if (permissionState === 'granted') {
                        return (
                          <div className="p-3 mb-2 bg-emerald-50/50 border border-emerald-100 rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Notifikasi Sistem</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-black uppercase">Aktif</span>
                            </div>
                            <p className="text-[11px] text-emerald-600 font-medium leading-normal">
                              Notifikasi aktif. Anda akan menerima kemas kini pengumuman dan blog secara terus pada peranti anda.
                            </p>
                          </div>
                        );
                      }

                      if (permissionState === 'denied') {
                        return (
                          <div className="p-3 mb-2 bg-rose-50/40 border border-rose-100 rounded-xl flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Notifikasi Sistem</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full font-black uppercase">Disekat</span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-bold leading-normal">
                              Notifikasi disekat. Sila benarkan semula di tetapan browser.
                            </p>
                            <div className="p-2.5 bg-slate-900/5 rounded-lg border border-slate-900/10 text-[11px] text-slate-600 space-y-1.5 font-medium">
                              <span className="font-extrabold text-[9px] uppercase text-slate-500 block mb-1">Panduan Reset:</span>
                              <p>1. Buka <strong>Site Settings / Tetapan Laman</strong> di browser anda.</p>
                              <p>2. Cari seksyen <strong>Notifications / Notifikasi</strong>.</p>
                              <p>3. Tukar status daripada <strong>Block</strong> kepada <strong>Allow / Benarkan</strong>.</p>
                              <p>4. Muat semula (Refresh) PWA ini.</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="p-3 mb-2 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100/60 transition-colors flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Notifikasi Sistem</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-black uppercase">Belum Diaktifkan</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium leading-normal">
                            Dapatkan makluman pengumuman dan blog baharu terus pada peranti anda melalui notifikasi segera.
                          </p>
                          <button
                            type="button"
                            onClick={requestNotificationPermission}
                            className="w-full text-center py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                          >
                            Aktifkan Notifikasi Sistem
                          </button>
                          {notificationError && (
                            <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{notificationError}</p>
                          )}
                        </div>
                      );
                    })()}

                    {notifications.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-xs text-slate-400 font-semibold">Tiada notifikasi baru.</p>
                      </div>
                    ) : (
                      notifications.map((n, nIdx) => (
                        <div 
                          key={n.id || `notif-${nIdx}`} 
                          onClick={() => {
                            if (n.type === 'announcement') {
                              setCurrentView('pengumuman');
                            } else if (n.type === 'chat') {
                              setCurrentView('chat');
                            } else if (n.type === 'blog') {
                              const foundBlog = blogs.find(b => b.id === n.relatedId);
                              if (foundBlog) {
                                setActiveBlog(foundBlog);
                              }
                              setCurrentView('blog');
                            } else if (n.text.includes('Kes Dilaporkan')) {
                              window.dispatchEvent(new CustomEvent('tmf2_open_pengurusan_kes'));
                            }
                            setShowNotifications(false);
                          }}
                          className="pt-2.5 pb-2 first:pt-0 hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 rounded-lg px-2"
                        >
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">{n.text}</p>
                          <span className="text-[10px] text-slate-400 block mt-1 font-semibold">{n.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Cart Icon in Header */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowCartDropdown(!showCartDropdown);
                  setShowLoginStatus(false);
                }}
                className={`p-2 rounded-xl transition-all relative cursor-pointer ${
                  showCartDropdown ? 'bg-indigo-50 text-[#3f3ebd]' : 'text-gray-400 hover:text-[#3f3ebd] hover:bg-slate-50'
                }`}
                title="Troli Pakej Yuran Anda"
              >
                <ShoppingCart size={18} />
                {cartPackageIds.length > 0 && (
                  <span className="absolute top-1 right-1 bg-rose-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {cartPackageIds.length}
                  </span>
                )}
              </button>

              {/* Cart Dropdown Popover */}
              {showCartDropdown && (
                <div className="absolute right-[-40px] mt-2.5 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-4 text-left space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-extrabold text-xs text-slate-950 uppercase tracking-wider flex items-center gap-2">
                      <ShoppingCart size={14} className="text-[#3f3ebd]" />
                      Troli Pakej Yuran ({cartPackageIds.length})
                    </span>
                    <button 
                      onClick={() => setShowCartDropdown(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded hover:bg-slate-100"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-2.5 pr-1">
                    {selectedCartPackages.length > 0 ? (
                      selectedCartPackages.map((pkg, pIdx) => (
                        <div key={pkg.id || `cart-${pIdx}`} className="flex justify-between items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-slate-800 leading-snug truncate">{pkg.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="inline-block text-[9px] font-black text-[#3f3ebd] bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {pkg.category === 'Tambahan' ? (pkg.realCategory || 'Yuran Tambahan') : pkg.category}
                              </span>
                            </div>
                            {pkg.hasAgePricing && pkg.selectedAgeQuantities && (
                              <div className="text-[10px] text-amber-600 font-extrabold mt-1">
                                Kuantiti: {[
                                  pkg.selectedAgeQuantities.dewasa ? `Dewasa x${pkg.selectedAgeQuantities.dewasa}` : null,
                                  pkg.selectedAgeQuantities.wargaEmas ? `Warga Emas x${pkg.selectedAgeQuantities.wargaEmas}` : null,
                                  pkg.selectedAgeQuantities.kanakKanak ? `Kanak-Kanak x${pkg.selectedAgeQuantities.kanakKanak}` : null
                                ].filter(Boolean).join(', ')}
                              </div>
                            )}
                            {pkg.isCustomAmount && (() => {
                              const email = currentUserDoc?.email || '';
                              const totalPaid = transactions
                                .filter(t => t.memberEmail === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(pkg.id))
                                .reduce((sum, t) => sum + (t.amount || 0), 0);
                              const remaining = Math.max(0, pkg.price - totalPaid);
                              const currentPayAmount = pkg.customCartAmount !== undefined ? pkg.customCartAmount : remaining;
                              const isExceeded = currentPayAmount > remaining;
                              return (
                                <div className="mt-2.5 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/40 space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-indigo-700 font-extrabold uppercase">
                                    <span>Yuran Asal: RM{pkg.price.toFixed(2)}</span>
                                    <span>Baki: RM{remaining.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustCustomCartAmount(pkg.id, -5)}
                                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-black transition-all cursor-pointer"
                                      title="Kurang RM5"
                                    >
                                      - RM5
                                    </button>
                                    <div className="relative flex-1">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">RM</span>
                                      <input
                                        type="number"
                                        step="1"
                                        min="1"
                                        max={remaining}
                                        value={pkg.customCartAmount !== undefined ? pkg.customCartAmount : remaining}
                                        onChange={(e) => handleInputCustomCartAmount(pkg.id, e.target.value)}
                                        className={`w-full text-center text-xs font-black bg-white border rounded p-1 pl-6 focus:outline-none focus:border-indigo-500 ${isExceeded ? 'text-rose-600 border-rose-300 bg-rose-50/20' : 'text-slate-800 border-slate-200'}`}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustCustomCartAmount(pkg.id, 5)}
                                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-black transition-all cursor-pointer"
                                      title="Tambah RM5"
                                    >
                                      + RM5
                                    </button>
                                  </div>
                                  {isExceeded && (
                                    <div className="text-[9px] font-bold text-rose-600 animate-pulse bg-rose-50 p-1 rounded border border-rose-100/50">
                                      ⚠️ Jumlah melebihi baki bayaran RM{remaining.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black text-slate-900">RM{getPackagePrice(pkg).toFixed(2)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(pkg.id)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Padam"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center text-slate-400 text-xs font-bold leading-relaxed">
                        Troli anda kosong.<br />Sila pilih pakej di bahagian Pembayaran Yuran!
                      </div>
                    )}
                  </div>

                  {selectedCartPackages.length > 0 && (() => {
                    const totalDiscountCart = selectedCartPackages.reduce((sum, p) => {
                      if (p.category === 'Penggal') return sum + (yuranConfig?.yuranPenggal?.discount ?? 5);
                      if (p.category === 'Tahunan') return sum + (yuranConfig?.yuranTahunan?.discount ?? 20);
                      return sum;
                    }, 0);
                    const originalSubTotal = subTotalCart + totalDiscountCart;

                    const hasExceededRemaining = selectedCartPackages.some(pkg => {
                      if (!pkg.isCustomAmount) return false;
                      const email = currentUserDoc?.email || '';
                      const totalPaid = transactions
                        .filter(t => t.memberEmail === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(pkg.id))
                        .reduce((sum, t) => sum + (t.amount || 0), 0);
                      const remaining = Math.max(0, pkg.price - totalPaid);
                      const currentPayAmount = pkg.customCartAmount !== undefined ? pkg.customCartAmount : remaining;
                      return currentPayAmount > remaining;
                    });

                    return (
                      <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                        {totalDiscountCart > 0 ? (
                          <>
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>Harga Asal</span>
                              <span className="font-semibold line-through text-slate-400">RM{originalSubTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-600 font-semibold">
                              <span>Diskaun Pakej (Persatuan)</span>
                              <span className="font-black">- RM{totalDiscountCart.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>Jumlah Yuran Bersih</span>
                              <span className="font-extrabold text-slate-800">RM{subTotalCart.toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-slate-500 font-medium">
                            <span>Jumlah Yuran</span>
                            <span className="font-extrabold text-slate-800">RM{subTotalCart.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-500 font-medium">
                          <span>Caj Pemprosesan (FPX)</span>
                          <span className={`font-extrabold ${isFpxSurcharge ? 'text-amber-600' : 'text-slate-400'}`}>
                            {isFpxSurcharge ? `+ RM${cartFpxFee.toFixed(2)}` : `RM${cartFpxFee.toFixed(2)} (Diserap)`}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-black text-sm pt-2.5 border-t border-slate-150">
                          <span>Jumlah Bayaran</span>
                          <span className="text-[#3f3ebd]">RM{cartTotalAmount.toFixed(2)}</span>
                        </div>

                        {hasExceededRemaining && (
                          <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-600 text-center animate-pulse">
                            ⚠️ Jumlah melebihi baki bayaran! Sila betulkan amaun sebelum meneruskan.
                          </div>
                        )}

                        {(() => {
                          const isManualEnabled = yuranConfig?.enableManualPayment !== false;
                          const isFpxEnabled = yuranConfig?.enableFPXPayment !== false;
                          const isBothDisabled = !isManualEnabled && !isFpxEnabled;

                          if (isBothDisabled) {
                            return (
                              <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-center space-y-1.5 shadow-xs">
                                <div className="flex items-center justify-center gap-1.5 text-amber-900 font-black text-xs">
                                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                                  <span>Sistem Pembayaran Ditutup Sementara</span>
                                </div>
                                <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                                  Perkhidmatan pembayaran dalam talian & manual sedang diselenggara untuk kerja-kerja penambahbaikan. Sila cuba semula kemudian atau hubungi Pentadbir Persatuan.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <>
                              {isFpxEnabled && (
                                <button
                                  type="button"
                                  disabled={hasExceededRemaining}
                                  onClick={() => {
                                    setShowCartDropdown(false);
                                    setHeaderPaymentStep('select-bank');
                                    setHeaderSelectedBank('');
                                    setPaymentTab('fpx');
                                    setShowHeaderFPXModal(true);
                                  }}
                                  className={`w-full py-2.5 font-black rounded-xl transition-all text-center text-xs shadow-md flex items-center justify-center gap-1.5 mt-3 ${
                                    hasExceededRemaining
                                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                      : 'bg-[#3f3ebd] hover:bg-[#3433a3] text-white cursor-pointer shadow-indigo-100'
                                  }`}
                                >
                                  <span>Bayar FPX (Dalam Talian)</span>
                                  <ArrowRight size={12} className="stroke-[2.5]" />
                                </button>
                              )}

                              {isManualEnabled && (
                                <button
                                  type="button"
                                  disabled={hasExceededRemaining}
                                  onClick={() => {
                                    setShowCartDropdown(false);
                                    setHeaderPaymentStep('select-bank');
                                    setPaymentTab('manual');
                                    setShowHeaderFPXModal(true);
                                  }}
                                  className={`w-full py-2 font-black rounded-xl transition-all text-center text-xs flex items-center justify-center gap-1.5 mt-1.5 border ${
                                    hasExceededRemaining
                                      ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                                      : 'border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 cursor-pointer shadow-xs'
                                  }`}
                                >
                                  <Upload size={12} className="stroke-[2.5]" />
                                  <span>Bayaran Manual (Resit Bukti)</span>
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <button 
              onClick={() => setCurrentView('chat')}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              <MessageSquare size={18} />
            </button>

            {/* Login Status Icon */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowLoginStatus(!showLoginStatus);
                  setShowCartDropdown(false);
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  showLoginStatus ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-[#3f3ebd] hover:bg-slate-50'
                }`}
                title="Status Log Masuk"
              >
                <LogIn size={18} />
              </button>

              {/* Login Status Dropdown */}
              {showLoginStatus && (
                <div className="absolute right-0 mt-2.5 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-4 text-left space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-extrabold text-xs text-slate-950 uppercase tracking-wider flex items-center gap-2">
                      <LogIn size={14} className="text-indigo-600" />
                      Status Log Masuk
                    </span>
                    <button 
                      onClick={() => setShowLoginStatus(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded hover:bg-slate-100"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={resolveUserAvatar(currentUserDoc, firebaseUser, guestAvatar)}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${firebaseUser ? 'bg-green-500' : 'bg-slate-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-slate-900 text-xs truncate leading-tight">
                        {currentUserDoc?.displayName || firebaseUser?.displayName || currentName}
                      </h5>
                      <span className="text-[9px] text-indigo-600 font-extrabold tracking-wider uppercase">
                        {currentUserDoc?.role || (firebaseUser && !firebaseUser.isAnonymous ? 'Pelawat' : 'Warga SMAUJ')}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Sesi</span>
                      <span className={`font-extrabold ${firebaseUser ? 'text-green-600' : 'text-slate-500'}`}>
                        {firebaseUser ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-medium min-w-0">
                      <span className="shrink-0">E-mel</span>
                      <span className="font-semibold text-slate-800 truncate ml-2 max-w-[150px]">
                        {currentUserDoc?.email || USER_AHMAD.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('tmf2_view_profile', { detail: null }));
                        setCurrentView('profile');
                        setShowLoginStatus(false);
                      }}
                      className="w-full text-center py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Lihat Profil Penuh
                    </button>
                    
                    {firebaseUser && !firebaseUser.isAnonymous ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowLoginStatus(false);
                          setShowLogoutConfirmModal(true);
                        }}
                        className="w-full text-center py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <LogOut size={13} />
                        <span>Log Keluar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          setShowLoginStatus(false);
                          await loginWithGoogle();
                        }}
                        className="w-full text-center py-2 bg-[#3f3ebd] hover:bg-[#3433a3] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
                      >
                        <LogIn size={13} />
                        <span>Log Masuk Google</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Divider */}
            <div className="w-px h-6 bg-gray-200" />

            {/* Profile trigger */}
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('tmf2_view_profile', { detail: null }));
                setCurrentView('profile');
              }}
              className="flex items-center gap-2.5 p-1 hover:bg-slate-50 rounded-xl transition-all cursor-pointer text-left"
            >
              <img
                src={resolveUserAvatar(currentUserDoc, firebaseUser, guestAvatar)}
                alt={currentUserDoc?.displayName || firebaseUser?.displayName || currentName}
                className="w-8 h-8 rounded-full object-cover border border-slate-100"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="font-bold text-xs text-gray-900 block leading-tight">
                  {currentUserDoc?.displayName || firebaseUser?.displayName || (firebaseUser && !firebaseUser.isAnonymous ? 'Pengguna Google' : currentName)}
                </span>
                <span className="text-[9px] text-gray-400 font-bold block uppercase">
                  {currentUserDoc?.role || 'TETAMU'}
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main id="desktop-main-scroll" className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar">
          
          {currentView === 'dashboard' ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* LEFT & CENTER CONTENT (8 COLS) */}
              <div className="xl:col-span-8 space-y-6">
                
                {/* 1. Welcoming Header */}
                <div className="space-y-1">
                  <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                    Assalamualaikum, {currentUserDoc?.nickname || currentUserDoc?.displayName || firebaseUser?.displayName || currentName} 👋
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">
                    Selamat datang ke Portal One Stop Centre Sekolah Menengah Agama Ulu Jempol (SMAUJ)
                  </p>
                </div>

                {/* KUIRI NOTIS BANNER (Pemberitahuan Kuiri Permohonan Keahlian) */}
                {isKuiriUser && (
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl p-5 shadow-lg shadow-amber-500/20 border-2 border-amber-300 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="absolute right-[-20px] top-[-20px] w-48 h-48 bg-white/10 rounded-full blur-xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 bg-white text-amber-700 rounded-xl flex items-center justify-center shrink-0 shadow-md mt-0.5">
                          <AlertTriangle size={24} className="animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-white/20 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-white/30">
                              NOTIS PERMOHONAN KEAHLIAN
                            </span>
                            <span className="bg-amber-950/70 text-amber-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-400/40">
                              STATUS: KUIRI (PERLU KEMASKINI)
                            </span>
                          </div>
                          <h3 className="font-black text-base text-white leading-tight">
                            Permohonan Keahlian Anda Memerlukan Kemaskini
                          </h3>
                          <p className="text-xs text-amber-50 leading-relaxed max-w-2xl font-medium">
                            Pihak pentadbir telah menyemak permohonan keahlian bagi rumah <strong>No. {currentUserDoc?.noRumah || kuiriApp?.noRumah || '-'}</strong> dan mendapati terdapat butiran pendaftaran yang belum lengkap atau gagal (contoh: Nama Penuh tidak lengkap, maklumat Isi Rumah tidak dinyatakan).
                          </p>
                          {kuiriRemarks && (
                            <p className="text-[11px] text-amber-950 font-bold bg-white/95 p-2 rounded-xl mt-1.5 border border-amber-200 inline-block">
                              📌 Catatan Pentadbir: "{kuiriRemarks}"
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setCurrentView('daftar-ahli')}
                        className="w-full md:w-auto px-5 py-3 bg-white hover:bg-amber-50 active:scale-98 text-amber-900 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Kemaskini Sekarang</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}

                 {/* 2. Announcement Banner Slider */}
                <div className="bg-indigo-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-indigo-950/10 border border-indigo-800 h-[215px] flex flex-col justify-between">
                  <div className="absolute right-[-20px] top-[-20px] w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-extrabold tracking-wider uppercase text-indigo-200 bg-white/10 px-2.5 py-1 rounded-full">
                      Pengumuman Terkini
                    </span>
                    <button 
                      onClick={() => setCurrentView('pengumuman')}
                      className="text-xs text-indigo-200 hover:text-white font-bold cursor-pointer transition-colors"
                    >
                      Lihat semua
                    </button>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="flex items-start gap-4 pr-12 min-h-[70px] flex-1 flex flex-col justify-center">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-950 shadow-md shrink-0">
                          <Megaphone size={20} className="text-indigo-600 animate-pulse" />
                        </div>
                        <div className="space-y-1.5">
                          <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white line-clamp-1">
                            Tiada Pengumuman Baru
                          </h3>
                          <p className="text-xs text-indigo-100/90 leading-relaxed max-w-xl line-clamp-2">
                            Belum ada pengumuman terbaharu untuk masa kini. Klik "Lihat semua" atau pintasan "Pengumuman" untuk tambah!
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-between min-h-0">
                      {(() => {
                        const idx = Math.min(activeAnnouncementIdx, announcements.length - 1);
                        const currentAnn = announcements[idx] || announcements[0];
                        if (!currentAnn) return null;
                        return (
                          <div className="flex items-start gap-4 pr-12 min-h-[70px] mt-1.5 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-950 shadow-md shrink-0">
                              <Megaphone size={20} className="text-indigo-600" />
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white line-clamp-1">
                                {currentAnn.title}
                              </h3>
                              <p className="text-xs text-indigo-100/90 leading-relaxed max-w-xl line-clamp-2">
                                {currentAnn.content}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Carousel navigation controls */}
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
                        <button 
                          onClick={() => setActiveAnnouncementIdx((prev) => (prev > 0 ? prev - 1 : announcements.length - 1))}
                          className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button 
                          onClick={() => setActiveAnnouncementIdx((prev) => (prev < announcements.length - 1 ? prev + 1 : 0))}
                          className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      {/* Dots indicator */}
                      <div className="flex gap-1.5 mt-2 justify-center">
                        {announcements.map((ann, idx) => (
                          <span 
                            key={ann.id || `ann-dot-${idx}`}
                            onClick={() => setActiveAnnouncementIdx(idx)}
                            className={`w-2 h-2 rounded-full transition-all cursor-pointer ${idx === Math.min(activeAnnouncementIdx, announcements.length - 1) ? 'bg-white w-4' : 'bg-white/30'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Pintasan Pantas (Grid Menu) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Pintasan Pantas</h3>
                  <div className="grid grid-cols-5 gap-3.5">
                    {shortcuts.map((shortcut, sIdx) => {
                      const Icon = shortcut.icon;
                      return (
                        <button
                          key={shortcut.id || `shortcut-${sIdx}`}
                          onClick={() => {
                            if (shortcut.id === 'sumbangan') {
                              setCurrentView('sumbangan');
                            } else if (shortcut.id === 'lain-lain') {
                              setShowLainLainShortcuts(prev => !prev);
                            } else if (shortcut.id === 'daftar-ahli') {
                              if (!firebaseUser || firebaseUser.isAnonymous) {
                                localStorage.setItem('tmf2_clicked_register_first', 'true');
                                loginWithGoogle().catch(err => {
                                  console.error("Gagal log masuk google:", err);
                                  localStorage.removeItem('tmf2_clicked_register_first');
                                });
                              } else {
                                setCurrentView('daftar-ahli');
                              }
                            } else {
                              setCurrentView(shortcut.id);
                            }
                          }}
                          className={`bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border transition-all cursor-pointer group relative ${
                            shortcut.id === 'lain-lain' && showLainLainShortcuts 
                              ? 'border-sky-300 bg-sky-50/20 shadow-xs' 
                              : 'border-gray-100 hover:border-indigo-100 hover:shadow-xs'
                          }`}
                        >
                          {shortcut.locked && (
                            <div className="absolute top-2 right-2 text-slate-300">
                              <Lock size={10} />
                            </div>
                          )}
                          {shortcut.id === 'daftar-ahli' && yuranConfig?.enableMembershipRegistration === false && (
                            <div className="absolute top-2 right-2 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                              Tutup
                            </div>
                          )}
                          {shortcut.id === 'daftar-ahli' && isKuiriUser && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse border border-white">
                              Kuiri
                            </div>
                          )}
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform ${shortcut.bg}`}>
                              <Icon size={18} />
                            </div>
                            {shortcut.id === 'kewangan' && pendingTxnCount > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
                                {pendingTxnCount}
                              </span>
                            )}
                            {shortcut.id === 'admin' && hasAdminAccess && pendingMembershipCount > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
                                {pendingMembershipCount}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-indigo-600">
                            {shortcut.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {showLainLainShortcuts && (
                    <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-5 mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-sky-800">
                          Pintasan Lain-lain (Tambahan)
                        </span>
                        <button 
                          onClick={() => setShowLainLainShortcuts(false)}
                          className="text-[10px] text-sky-600 hover:text-sky-800 font-black uppercase tracking-wider"
                        >
                          Tutup
                        </button>
                      </div>
                      <div className="grid grid-cols-4 md:grid-cols-5 gap-3">
                        <button
                          onClick={() => setCurrentView('chat')}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-sky-100 hover:border-sky-300 hover:shadow-xs transition-all cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform">
                            <MessageSquare size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-indigo-600">
                            Chat Komuniti
                          </span>
                        </button>

                        <button
                          onClick={() => setCurrentView('blog')}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-teal-100 hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-teal-50 text-teal-600 group-hover:scale-105 transition-transform">
                            <BookOpen size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-teal-600">
                            Blog Komuniti
                          </span>
                        </button>
                        
                        <button
                          onClick={() => setCurrentView('dokumen')}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-blue-100 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group relative"
                        >
                          {!hasDokumenAccess && (
                            <div className="absolute top-2 right-2 text-slate-300">
                              <Lock size={10} />
                            </div>
                          )}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
                            <Folder size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-blue-600">
                            Dokumen Persatuan
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            if (hasSuratAccess) {
                              setCurrentView('surat');
                            } else {
                              alert("Akses Terhad: Hanya Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja yang dibenarkan untuk mengakses modul Jana Surat.");
                            }
                          }}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-indigo-100 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group relative"
                        >
                          {!hasSuratAccess && (
                            <div className="absolute top-2 right-2 text-slate-300">
                              <Lock size={10} />
                            </div>
                          )}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
                            <FileText size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-indigo-600">
                            Jana Surat
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            if (hasMinitAccess) {
                              setCurrentView('minit-mesyuarat');
                            } else {
                              alert("Akses Terhad: Hanya Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja yang dibenarkan untuk mengakses modul Minit Mesyuarat.");
                            }
                          }}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-emerald-100 hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group relative"
                        >
                          {!hasMinitAccess && (
                            <div className="absolute top-2 right-2 text-slate-300">
                              <Lock size={10} />
                            </div>
                          )}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                            <FileCheck size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-emerald-600">
                            Minit Mesyuarat
                          </span>
                        </button>

                        {hasKelulusanAhliAccess && (
                          <button
                            onClick={() => setCurrentView('kelulusan-ahli')}
                            className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-purple-100 hover:border-purple-300 hover:shadow-xs transition-all cursor-pointer group"
                          >
                            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-purple-50 text-purple-600 group-hover:scale-105 transition-transform">
                              <CheckCircle2 size={18} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-purple-600">
                              Kelulusan Ahli
                            </span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (hasNotisPanggilanAccess) {
                              setCurrentView('notis-panggilan');
                            } else {
                              alert("Akses Terhad: Hanya Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja yang dibenarkan untuk mengakses modul Notis Panggilan.");
                            }
                          }}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-pink-100 hover:border-pink-300 hover:shadow-xs transition-all cursor-pointer group relative"
                        >
                          {!hasNotisPanggilanAccess && (
                            <div className="absolute top-2 right-2 text-slate-300">
                              <Lock size={10} />
                            </div>
                          )}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-pink-50 text-pink-600 group-hover:scale-105 transition-transform">
                            <Bell size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-pink-600">
                            Notis Panggilan
                          </span>
                        </button>
                        
                        <button
                          onClick={() => {
                            if (hasKertasKerjaAccess) {
                              setCurrentView('kertas-kerja');
                            } else {
                              alert("Akses Terhad: Hanya Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja yang dibenarkan untuk mengakses modul Kertas Kerja.");
                            }
                          }}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-rose-100 hover:border-rose-300 hover:shadow-xs transition-all cursor-pointer group relative"
                        >
                          {!hasKertasKerjaAccess && (
                            <div className="absolute top-2 right-2 text-slate-300">
                              <Lock size={10} />
                            </div>
                          )}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform">
                            <FileSpreadsheet size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-rose-600">
                            Kertas Kerja
                          </span>
                        </button>


                        <button
                          onClick={() => {
                            if (hasKewanganAccess) {
                              setCurrentView('pengeluaran');
                            } else {
                              alert("Akses Terhad: Hanya Admin Utama, Pengerusi, Setiausaha, Bendahari dan Juru Audit sahaja yang dibenarkan untuk mengakses modul Pengeluaran.");
                            }
                          }}
                          className="bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center border border-amber-100 hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer group relative"
                        >
                          {!hasKewanganAccess && (
                            <div className="absolute top-2 right-2 text-slate-300">
                              <Lock size={10} />
                            </div>
                          )}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5 bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
                            <ArrowUpRight size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-700 leading-tight group-hover:text-amber-600">
                            Pengeluaran
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Upcoming Events & Blogs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Daftar Ahli & Events */}
                  <div className="space-y-6">
                    {/* Daftar Ahli / Kad Keahlian Banner */}
                    {isApprovedMember ? (
                      <div 
                        onClick={() => setCurrentView('daftar-ahli')}
                        className="relative bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 rounded-2xl p-5 overflow-hidden shadow-lg shadow-emerald-900/15 cursor-pointer group border border-emerald-500/30 transition-transform hover:-translate-y-0.5"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity">
                          <ShieldCheck size={80} className="text-white transform rotate-12" />
                        </div>
                        <div className="relative z-10 flex flex-col justify-between h-full">
                          <div className="space-y-1.5 text-white pr-10">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 bg-emerald-400/30 border border-emerald-300/40 text-emerald-100 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-emerald-300" /> KEAHLIAN AKTIF
                              </span>
                              {currentUserDoc?.memberNo && (
                                <span className="font-mono text-xs text-emerald-200 font-extrabold bg-black/20 px-2 py-0.5 rounded-md">
                                  {currentUserDoc.memberNo}
                                </span>
                              )}
                            </div>
                            <h3 className="font-extrabold text-lg flex items-center gap-2">
                              Pengesahan & Kad Keahlian Rasmi <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </h3>
                            <p className="text-xs font-medium text-emerald-100 leading-relaxed">
                              Tahniah! Anda adalah warga sah Sekolah Menengah Agama Ulu Jempol. Klik untuk melihat dan memuat turun kad identiti rasmi untuk simpanan anda (PNG / PDF).
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => {
                          if (!firebaseUser || firebaseUser.isAnonymous) {
                            loginWithGoogle().catch(err => {
                              console.error("Gagal log masuk google:", err);
                            });
                          }
                        }}
                        className="relative bg-gradient-to-br from-indigo-850 to-slate-900 rounded-2xl p-5 overflow-hidden shadow-lg shadow-indigo-900/10 group border border-indigo-500/30 transition-transform hover:-translate-y-0.5"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Users size={80} className="text-white transform rotate-12" />
                        </div>
                        <div className="relative z-10 flex flex-col justify-between h-full">
                          <div className="space-y-1.5 text-white pr-10">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 bg-slate-500/30 border border-slate-400/40 text-slate-200 text-[10px] font-black rounded-full uppercase tracking-wider">
                                PERANAN: {currentUserDoc?.role || 'TETAMU'}
                              </span>
                            </div>
                            <h3 className="font-extrabold text-lg flex items-center gap-2 text-white">
                              Selamat Datang ke Portal Rasmi SMAUJ
                            </h3>
                            <p className="text-xs font-medium text-indigo-100 leading-relaxed">
                              {!firebaseUser || firebaseUser.isAnonymous 
                                ? 'Sila klik untuk log masuk menggunakan emel Google anda. Semua pengguna baharu akan memegang peranan TETAMU sehingga peranan rasmi ditetapkan oleh Pentadbir Sekolah.'
                                : 'Akaun Google anda aktif dengan peranan TETAMU. Pentadbir Sekolah (ADMIN UTAMA) akan menetapkan peranan anda (ADMIN, GURU, MURID, IBU BAPA, atau KPM/JPN/NAZIR/PPD).'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(() => {
                      if (!tickedNotice || !currentUserDoc) return null;
                      const nonCommittee = ['Pelawat', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Penduduk', 'Tetamu'];
                      const isUserAJK = !nonCommittee.includes(currentUserDoc.role);
                      const isUserBiasa = currentUserDoc.role === 'Ahli Biasa';
                      
                      const isEligible = tickedNotice.type === 'agung_khas' 
                        ? (isUserAJK || isUserBiasa) 
                        : isUserAJK;
                        
                      if (!isEligible) return null;
                      
                      return (
                        <div 
                          onClick={() => setCurrentView('kehadiran')}
                          className="relative bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-5 overflow-hidden shadow-lg shadow-emerald-900/10 cursor-pointer group border border-emerald-500/30 transition-transform hover:-translate-y-0.5"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Bell size={80} className="text-white transform rotate-12" />
                          </div>
                          <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="space-y-1.5 text-white pr-10">
                              <span className="bg-emerald-500/50 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                                Tindakan Segera
                              </span>
                              <h3 className="font-extrabold text-sm flex items-center gap-1.5 mt-1">
                                Pengesahan Kehadiran Mesyuarat <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                              </h3>
                              <p className="text-[11px] font-bold text-emerald-100 leading-snug">
                                {tickedNotice.title} pada {tickedNotice.meetingDate}. Sila sahkan kehadiran anda sekarang.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Banner Sumbangan */}
                    <BannerSumbangan onClick={() => setCurrentView('sumbangan')} isMobile={false} />

                    {/* Banner Laporkan Kes Disiplin (Admin Utama & Guru) */}
                    <BannerLaporkanKes isMobile={false} />


                    {/* Aktiviti Terkini feed */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Aktiviti Terkini</h3>
                        <button 
                          onClick={() => setCurrentView('pengumuman')}
                          className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
                        >
                          Lihat Semua
                        </button>
                      </div>
                      <div className="space-y-4">
                        {(() => {
                          const todayIso = new Date().toISOString().split('T')[0];
                          const rawFeed = [
                            ...announcements.map(ann => ({
                              id: `ann-${ann.id}`,
                              icon: Megaphone,
                              text: `Pengumuman baru: ${ann.title}`,
                              time: ann.date || 'Terkini',
                              bg: 'bg-indigo-50 text-indigo-600',
                              ms: parseDateToMs(ann.date)
                            })),
                            ...events
                              .filter(evt => evt.status === 'rasmi' && evt.rawDate && evt.rawDate <= todayIso)
                              .map(evt => ({
                                id: `evt-${evt.id}`,
                                icon: CalendarIcon,
                                text: `Selesai dijalankan: ${evt.title}`,
                                time: evt.date || evt.rawDate || 'Terkini',
                                bg: 'bg-emerald-50 text-emerald-600',
                                ms: parseDateToMs(evt.rawEndDate || evt.rawDate || evt.date)
                              })),
                            ...(cases || []).map(c => ({
                              id: `case-${c.id}`,
                              icon: AlertTriangle,
                              text: `Penambahan Kes Dilaporkan: ${c.jenisKes || 'Aduan Kes'}`,
                              time: c.tarikhKes ? `${c.tarikhKes}` : (c.createdAt ? c.createdAt.split('T')[0] : 'Terkini'),
                              bg: 'bg-rose-50 text-rose-600',
                              ms: parseDateToMs(c.createdAt || c.tarikhKes)
                            }))
                          ];

                          const sortedFeed = rawFeed.sort((a, b) => b.ms - a.ms);

                          return sortedFeed.slice(0, 6).map((act) => {
                            const Icon = act.icon;
                            return (
                              <div key={act.id} className="flex gap-3 items-start text-xs">
                                <div className={`p-2 rounded-lg shrink-0 ${act.bg}`}>
                                  <Icon size={14} />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-gray-800 leading-snug">{act.text}</p>
                                  <span className="text-[10px] text-gray-400 font-bold block">{act.time}</span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Blogs (Sorted latest date first) */}
                  <div className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Blog Terkini</h3>
                      <button 
                        onClick={() => setCurrentView('blog')}
                        className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
                      >
                        Lihat Semua
                      </button>
                    </div>

                    <div className="space-y-3">
                      {blogs && blogs.length > 0 && [...blogs]
                        .sort((a, b) => parseDateToMs(b.date) - parseDateToMs(a.date))
                        .slice(0, 5)
                        .map((blog, idx) => (
                        <div 
                          key={blog.id || idx}
                          onClick={() => {
                            setActiveBlog(blog);
                            setCurrentView('blog');
                          }}
                          className="group cursor-pointer space-y-3 border border-gray-50 rounded-xl p-2 hover:bg-slate-50 hover:border-gray-100 transition-all"
                        >
                          <div className="rounded-lg overflow-hidden h-28 w-full border border-gray-100">
                            <img
                              src={blog.image}
                              alt="Blog"
                              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="space-y-1 px-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Aktiviti</span>
                              <span className="text-[10px] text-gray-400 font-bold">{blog.date}</span>
                            </div>
                            <h4 className="font-extrabold text-xs text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                              {blog.title}
                            </h4>
                            <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2 font-medium">
                              {blog.summary}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT SIDEBAR PANEL (4 COLS) */}
              <div className="xl:col-span-4 space-y-6">
                
                {/* 1. Takwim Calendar Widget */}
                {(() => {
                  const malayMonths = [
                    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
                    "Julai", "Ogos", "September", "Oktober", "November", "Disember"
                  ];
                  const yr = currentCalendarDate.getFullYear();
                  const mth = currentCalendarDate.getMonth();

                  // First day of the month
                  const firstDay = new Date(yr, mth, 1);
                  const startDay = firstDay.getDay();

                  // Days in current month
                  const totalDays = new Date(yr, mth + 1, 0).getDate();

                  // Days in previous month
                  const prevTotalDays = new Date(yr, mth, 0).getDate();

                  const checkDateRange = (dateStr: string, startDateStr?: string, endDateStr?: string) => {
                    if (!startDateStr) return false;
                    const end = endDateStr || startDateStr;
                    return dateStr >= startDateStr && dateStr <= end;
                  };

                  const cellsList: { num: number; monthOffset: number; dateString: string; hasEvent: boolean }[] = [];

                  // Previous month padding
                  for (let i = startDay - 1; i >= 0; i--) {
                    const d = prevTotalDays - i;
                    const prevM = mth === 0 ? 11 : mth - 1;
                    const prevY = mth === 0 ? yr - 1 : yr;
                    const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dayHasEvent = events.some(evt => checkDateRange(dateStr, evt.rawDate, evt.rawEndDate));
                    cellsList.push({
                      num: d,
                      monthOffset: -1,
                      dateString: dateStr,
                      hasEvent: dayHasEvent
                    });
                  }

                  // Current month days
                  for (let d = 1; d <= totalDays; d++) {
                    const dateStr = `${yr}-${String(mth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dayHasEvent = events.some(evt => checkDateRange(dateStr, evt.rawDate, evt.rawEndDate));
                    cellsList.push({
                      num: d,
                      monthOffset: 0,
                      dateString: dateStr,
                      hasEvent: dayHasEvent
                    });
                  }

                  // Next month padding
                  const totalCellsNum = Math.ceil(cellsList.length / 7) * 7;
                  const nextPadding = totalCellsNum - cellsList.length;
                  for (let d = 1; d <= nextPadding; d++) {
                    const nextM = mth === 11 ? 0 : mth + 1;
                    const nextY = mth === 11 ? yr + 1 : yr;
                    const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dayHasEvent = events.some(evt => checkDateRange(dateStr, evt.rawDate, evt.rawEndDate));
                    cellsList.push({
                      num: d,
                      monthOffset: 1,
                      dateString: dateStr,
                      hasEvent: dayHasEvent
                    });
                  }

                  return (
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Takwim</h3>
                          <p className="text-xs text-indigo-600 font-bold tracking-wide">
                            {malayMonths[mth]} {yr}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => {
                              setCurrentCalendarDate(prev => {
                                const newDate = new Date(prev);
                                newDate.setMonth(prev.getMonth() - 1);
                                return newDate;
                              });
                            }}
                            className="p-1 hover:bg-slate-50 text-gray-400 hover:text-slate-700 rounded-md cursor-pointer transition-colors"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              setCurrentCalendarDate(prev => {
                                const newDate = new Date(prev);
                                newDate.setMonth(prev.getMonth() + 1);
                                return newDate;
                              });
                            }}
                            className="p-1 hover:bg-slate-50 text-gray-400 hover:text-slate-700 rounded-md cursor-pointer transition-colors"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Calendar Matrix */}
                      <div className="grid grid-cols-7 gap-y-2 text-center text-[10px]">
                        {/* Headers */}
                        {['Aha', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'].map((day) => (
                          <span key={day} className="font-bold text-gray-400">{day}</span>
                        ))}

                        {/* Days */}
                        {cellsList.map((cell, idx) => {
                          const isSelected = cell.dateString === selectedDateStr;
                          const todayObj = new Date();
                          const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
                          const isToday = cell.dateString === todayStr;
                          const cellEvents = events.filter(evt => checkDateRange(cell.dateString, evt.rawDate, evt.rawEndDate));
                          const hasEvents = cellEvents.length > 0;

                          return (
                            <div 
                              key={`cell-${cell.dateString || idx}`} 
                              onClick={() => setSelectedDateStr(cell.dateString)}
                              className="flex justify-center items-center h-6.5 relative group cursor-pointer"
                            >
                              <span className={`w-6.5 h-6.5 flex items-center justify-center rounded-full font-bold transition-all text-[11px] ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white shadow-xs' 
                                  : isToday
                                    ? 'border border-indigo-600 text-indigo-700 bg-indigo-50/50'
                                    : cell.monthOffset === 0 
                                      ? 'text-slate-800 hover:bg-slate-100' 
                                      : 'text-slate-300'
                              }`}>
                                {cell.num}
                              </span>
                              {cell.hasEvent && (
                                <span className={`absolute bottom-0 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                              )}

                              {/* Hover Tooltip / Petunjuk Program */}
                              {hasEvents && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-indigo-950 text-white text-[10px] p-2.5 rounded-xl shadow-lg w-52 z-50 pointer-events-none transition-all duration-200 origin-bottom scale-95 group-hover:scale-100">
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-indigo-950" />
                                  <div className="font-extrabold text-[8px] text-amber-400 uppercase tracking-wider mb-1">
                                    Program Terjadual
                                  </div>
                                  <div className="space-y-1.5">
                                    {cellEvents.map((evt, eIdx) => (
                                      <div key={evt.id || `cell-evt-${cell.dateString || idx}-${eIdx}`} className={eIdx > 0 ? "border-t border-indigo-900/60 pt-1.5" : ""}>
                                        <p className="font-bold text-white leading-tight">{evt.title}</p>
                                        <p className="text-[9px] text-indigo-200 mt-0.5">
                                          ⏰ {evt.time}
                                        </p>
                                        <p className="text-[9px] text-indigo-200">
                                          📍 {evt.location}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Program Details Section */}
                      <div className="border-t border-slate-100 pt-3">
                        {(() => {
                          const selectedEvents = events.filter(evt => checkDateRange(selectedDateStr, evt.rawDate, evt.rawEndDate));
                          
                          // Format human-friendly selected date in Malay
                          const parts = selectedDateStr.split('-');
                          const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          const daysMalay = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
                          const dayName = daysMalay[dObj.getDay()];
                          const dayNum = dObj.getDate();
                          const monthName = malayMonths[dObj.getMonth()];
                          const yearNum = dObj.getFullYear();
                          const formattedSelectedDate = `${dayName}, ${dayNum} ${monthName} ${yearNum}`;

                          return (
                            <div className="space-y-2.5">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                                  Program: {formattedSelectedDate}
                                </span>
                              </div>

                              {selectedEvents.length === 0 ? (
                                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 text-center">
                                  <p className="text-[10px] font-bold text-slate-500 leading-snug">
                                    Hari ini tiada event.
                                  </p>
                                  <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                                    Tiada program atau mesyuarat dijadualkan.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {selectedEvents.map((event, sIdx) => (
                                    <div 
                                      key={event.id || `selected-evt-${sIdx}`}
                                      className="flex items-center gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 shadow-3xs"
                                    >
                                      <div className="w-8 h-8 bg-indigo-50 text-indigo-700 rounded-lg flex flex-col items-center justify-center font-bold shrink-0">
                                        <span className="text-xs font-black leading-none">{event.day}</span>
                                        <span className="text-[7px] font-bold tracking-wider uppercase mt-0.5 leading-none">{event.month}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 justify-between">
                                          <h4 className="font-extrabold text-[10px] text-slate-900 truncate leading-snug">{event.title}</h4>
                                          <span className={`text-[6px] font-black px-1.5 py-0.5 rounded-xs uppercase tracking-wider shrink-0 ${
                                            event.status === 'draf' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                                          }`}>
                                            {event.status === 'draf' ? 'Draf' : 'Rasmi'}
                                          </span>
                                        </div>
                                        <p className="text-[8px] text-gray-500 mt-0.5 font-semibold leading-none truncate">
                                          📍 {event.location} • ⏰ {event.time}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                    </div>
                  );
                })()}

                {/* 2. Acara Akan Datang */}
                <div className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Acara Akan Datang</h3>
                    <button 
                      onClick={() => setCurrentView('takwim')}
                      className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      Lihat Semua
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      const upcomingEvents = getUpcomingEvents(events).slice(0, 5);

                      if (upcomingEvents.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                            <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center mb-3 shadow-xs">
                              <CalendarIcon size={16} className="text-slate-400" />
                            </div>
                            <p className="text-xs font-black text-slate-800">Tiada Acara Akan Datang</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                              Tiada aktiviti dijadualkan buat masa ini. Ikuti perkembangan kami untuk program akan datang!
                            </p>
                          </div>
                        );
                      }

                      return upcomingEvents.map((event, uIdx) => (
                        <div 
                          key={event.id || `upcoming-evt-${uIdx}`}
                          onClick={() => setCurrentView('takwim')}
                          className="flex items-center gap-3.5 p-3 hover:bg-slate-50 rounded-xl transition-all cursor-pointer border border-gray-50 hover:border-gray-100"
                        >
                          {/* Calendar block */}
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-xl flex flex-col items-center justify-center font-bold shrink-0">
                            <span className="text-sm leading-none font-extrabold">{event.day}</span>
                            <span className="text-[8px] tracking-wider leading-none mt-1 uppercase font-semibold">{event.month}</span>
                          </div>
                          {/* Details */}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-extrabold text-xs text-gray-900 truncate flex-1">{event.title}</h4>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm shrink-0 uppercase tracking-wider ${
                                event.status === 'draf' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {event.status === 'draf' ? 'Draf' : 'Rasmi'}
                              </span>
                            </div>
                            <div className="flex flex-col text-[10px] text-gray-400">
                              <span>📍 {event.location}</span>
                              <span className="mt-0.5">📅 {event.date} • {event.time}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Galeri Gambar Program & Laporan (Carousel 5s Rawak) */}
                <BlogImageCarousel 
                  programReports={programReports}
                  blogs={blogs} 
                  onSelectBlog={(blog) => {
                    setActiveBlog(blog);
                    setCurrentView('blog');
                  }}
                  onNavigateToBlog={() => setCurrentView('blog')}
                  onNavigateToLaporan={() => setCurrentView('laporanList')}
                />

                {/* 3. Ahli Online & 4. Statistik Ringkas (Hidden for Guest users) */}
                {!isTetamu && (
                  <>
                    {/* Ahli Online */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Ahli Online</h3>
                      <div className="flex flex-wrap gap-2.5">
                        {allUsers.slice(0, 8).map((user, uIdx) => (
                          <div 
                            key={user.uid || (user as any).id || `user-online-${uIdx}`} 
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('tmf2_view_profile', { detail: user }));
                              setCurrentView('profile');
                            }}
                            className="relative group cursor-pointer hover:scale-105 transition-transform"
                          >
                            <img
                              src={user.uploadedProfileImageUrl || user.photoURL || user.googleProfileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName || user.uid}`}
                              alt={user.displayName || 'Ahli'}
                              className="w-9 h-9 rounded-full object-cover border border-white shadow-xs"
                              referrerPolicy="no-referrer"
                            />
                            <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                            
                            {/* Hover Name Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 font-bold">
                              {user.displayName || 'Ahli'} ({user.role})
                            </div>
                          </div>
                        ))}
                        {allUsers.length > 8 && (
                          <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer shadow-xs">
                            +{allUsers.length - 8}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Peta Penduduk Taman Musytari Fasa 2 (Hanya Ahli yang Diluluskan) */}
                    {isApprovedMember && <PetaPendudukSection isMobile={false} />}

                    {/* Statistik Ringkas */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Statistik Ringkas</h3>
                      <div className="grid grid-cols-3 gap-2.5">
                        
                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100" title={`Jumlah ahli berdaftar: ${allUsers?.length || 0} orang`}>
                          <div className="flex justify-center text-indigo-600 mb-1.5"><Users size={16} /></div>
                          <span className="text-base font-extrabold text-slate-800 block leading-none">{allUsers?.length || 0}</span>
                          <span className="text-[9px] text-gray-400 font-bold mt-1 block">Bil Ahli</span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100" title={`Jumlah laporan program: ${programReports?.length || 0} program`}>
                          <div className="flex justify-center text-pink-600 mb-1.5"><CalendarIcon size={16} /></div>
                          <span className="text-base font-extrabold text-slate-800 block leading-none">{programReports?.length || 0}</span>
                          <span className="text-[9px] text-gray-400 font-bold mt-1 block">Program</span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100" title={`Baki Semasa (Tunai + Bank): RM ${totalKutipan.toLocaleString()}`}>
                          <div className="flex justify-center text-emerald-600 mb-1.5"><Landmark size={16} /></div>
                          <span className="text-xs font-extrabold text-slate-800 block leading-none truncate">
                            RM{totalKutipan >= 1000 ? `${(totalKutipan / 1000).toFixed(1)}k` : totalKutipan.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold mt-1 block">Baki Semasa</span>
                        </div>

                      </div>
                    </div>
                  </>
                )}

              </div>

            </div>
          ) : currentView === 'chat' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center max-w-2xl mx-auto border-b border-gray-200 pb-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Sembang Komuniti</h2>
                  <p className="text-xs text-gray-400">Saling menyapa, berkongsi berita, dan berbincang sesama komuniti.</p>
                </div>
              </div>
              <ChatSection 
                posts={posts} 
                onAddPost={onAddPost} 
                onLikePost={onLikePost} 
                onAddComment={onAddComment} 
                onDeletePost={onDeletePost}
                onDeleteComment={onDeleteComment}
              />
            </div>
          ) : currentView === 'yuran' ? (
            !isGoogleSignedIn ? (
              <div className="flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-100 shadow-3xs max-w-lg mx-auto mt-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                  <LogIn className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">LOG MASUK DIPERLUKAN</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Sila log masuk menggunakan akaun Google anda terlebih dahulu untuk menyemak status keahlian dan mengakses halaman bayar yuran.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await loginWithGoogle();
                    } catch (err) {
                      console.error("Gagal log masuk:", err);
                    }
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn size={14} className="stroke-[2.5]" />
                  <span>Log Masuk dengan Google</span>
                </button>
              </div>
            ) : isAhliAktif ? (
              hasYuranAccess ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">Pembayaran Yuran & Sumbangan SMAUJ</h2>
                      <p className="text-xs text-gray-400">Semak rekod sumbangan PIBG, yuran persekolahan terkini serta selesaikan secara lancar.</p>
                    </div>
                  </div>
                  <YuranSection 
                    fees={fees} 
                    onPayFees={onPayFees} 
                    packages={packages}
                    setPackages={setPackages}
                    cartPackageIds={cartPackageIds}
                    setCartPackageIds={setCartPackageIds}
                    yuranConfig={yuranConfig}
                    onOpenCart={() => {
                      setShowCartDropdown(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl shadow-xs border border-gray-100">
                  <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                  <p className="text-sm text-slate-500">Anda tidak mempunyai kebenaran untuk melihat halaman ini.</p>
                </div>
              )
            ) : (
              aksesDitolakCard
            )
          ) : currentView === 'profile' ? (
            <div className="space-y-4">
              <ProfileSection 
                posts={posts} 
                onAddPost={onAddPost} 
                onLikePost={onLikePost} 
                onAddComment={onAddComment} 
                onDeletePost={onDeletePost}
                onDeleteComment={onDeleteComment}
                isMobile={false}
                viewedMember={viewedMember}
                setViewedMember={setViewedMember}
                transactions={transactions}
              />
            </div>
          ) : currentView === 'laporan' ? (
            isAhliAktif ? (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-gray-100 shadow-xs">
                <LaporanSection 
                  programReports={programReports}
                  onAddProgramReport={onAddProgramReport}
                  onUpdateProgramReport={onUpdateProgramReport}
                  onDeleteProgramReport={onDeleteProgramReport}
                  isMobile={false}
                  hasCommitteeAccess={hasCommitteeAccess}
                />
              </div>
            ) : (
              aksesDitolakCard
            )
          ) : currentView === 'blog' ? (
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-gray-100 shadow-xs">
              <BlogSection 
                blogs={blogs}
                isMobile={false}
                activeBlog={activeBlog}
                setActiveBlog={setActiveBlog}
              />
            </div>
          ) : currentView === 'ahli' ? (
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-gray-100 shadow-xs">
              <AhliJawatankuasaSection isMobile={false} />
            </div>
          ) : currentView === 'takwim' ? (
            isAhliAktif ? (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-gray-100 shadow-xs">
                <TakwimSection 
                  events={events}
                  onAddEvent={onAddEvent}
                  onUpdateEvent={onUpdateEvent}
                  onDeleteEvent={onDeleteEvent}
                  onMoveEvent={onMoveEvent}
                  isMobile={false}
                  hasCommitteeAccess={hasCommitteeAccess}
                />
              </div>
            ) : (
              aksesDitolakCard
            )
          ) : currentView === 'pengumuman' ? (
            isAhliAktif ? (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-gray-100 shadow-xs">
                <PengumumanSection 
                  announcements={announcements}
                  onAddAnnouncement={onAddAnnouncement}
                  onUpdateAnnouncement={onUpdateAnnouncement}
                  onDeleteAnnouncement={onDeleteAnnouncement}
                  isMobile={false}
                  hasCommitteeAccess={hasCommitteeAccess}
                />
              </div>
            ) : (
              aksesDitolakCard
            )
          ) : currentView === 'admin' ? (
            hasAdminAccess ? (
              <div className="bg-slate-55 p-4 rounded-2xl border border-gray-100 shadow-xs">
                <AdminSection isMobile={false} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Anda tidak mempunyai kebenaran untuk melihat halaman ini.</p>
              </div>
            )
          ) : currentView === 'daftar-ahli' ? (
            <div className="max-w-4xl mx-auto py-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-6">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="font-extrabold text-2xl text-slate-900 tracking-tight">Daftar Ahli</h2>
              </div>
              <DaftarAhliSection isMobile={false} />
            </div>
          ) : currentView === 'pengeluaran' ? (
            hasKewanganAccess ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-8 max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900">Borang Pengeluaran Kewangan</h3>
                    <p className="text-[11px] text-gray-500">Merekod perbelanjaan atau pengeluaran dana persatuan terus ke lejar.</p>
                  </div>
                </div>

              {pSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-8 rounded-2xl text-center space-y-3 animate-in fade-in duration-300">
                  <CheckCircle2 size={44} className="text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-black uppercase tracking-wider">Pengeluaran Berjaya Direkodkan!</h4>
                  <p className="text-xs text-emerald-600 font-bold max-w-md mx-auto">
                    Voucher {pVoucher} bernilai RM {parseFloat(pAmaun || "0").toFixed(2)} telah berjaya dimasukkan dan sedang menunggu pengesahan Bendahari di dalam rekod lejar Kewangan Persatuan.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSavePengeluaran} className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Pengeluaran <span className="text-rose-500">*</span></label>
                      <input 
                        type="date"
                        required
                        value={pTarikh}
                        onChange={(e) => setPTarikh(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">No. Rujukan / Voucher <span className="text-rose-500">*</span></label>
                      <input 
                        type="text"
                        required
                        disabled
                        value={pVoucher}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-500 bg-slate-50 cursor-not-allowed select-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tujuan / Perihalan Pengeluaran <span className="text-rose-500">*</span></label>
                      <input 
                        type="text"
                        required
                        placeholder="Contoh: Pembelian barang kemudahan sukan komuniti"
                        value={pPerihalan}
                        onChange={(e) => setPPerihalan(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Kategori Belanja <span className="text-rose-500">*</span></label>
                      <select
                        value={pKategori}
                        onChange={(e) => setPKategori(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="Pembersihan">Pembersihan</option>
                        <option value="Keselamatan">Keselamatan</option>
                        <option value="Landskap">Landskap</option>
                        <option value="Bil Elektrik">Bil Elektrik</option>
                        <option value="Bil Air">Bil Air</option>
                        <option value="Program Komuniti">Program Komuniti</option>
                        <option value="Operasi Persatuan">Operasi Persatuan</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Akaun Sumber Kredit <span className="text-rose-500">*</span></label>
                      <select
                        value={pSumber}
                        onChange={(e) => setPSumber(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="Bank">Bank (CIMB Persatuan)</option>
                        <option value="Tunai">Tunai Runcit</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Amaun Pengeluaran (RM) <span className="text-rose-500">*</span></label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={pAmaun}
                      onChange={(e) => setPAmaun(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Penerima / Bayar Kepada</label>
                    <input 
                      type="text"
                      placeholder="Contoh: Pembekal Kanopi Maju / Kontraktor landskap"
                      value={pPenerima}
                      onChange={(e) => setPPenerima(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Catatan Tambahan</label>
                    <textarea 
                      placeholder="Masukkan nota tambahan (jika ada)..."
                      rows={3}
                      value={pCatatan}
                      onChange={(e) => setPCatatan(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentView('dashboard')}
                      className="px-5 py-2.5 border border-slate-200 text-slate-700 text-xs font-extrabold uppercase tracking-wider rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-all flex items-center gap-2"
                    >
                      <ArrowUpRight size={14} className="stroke-[3]" />
                      <span>Rekod Pengeluaran</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl shadow-xs border border-gray-100 mt-12 max-w-md mx-auto">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Anda tidak mempunyai kebenaran untuk melihat halaman ini.</p>
              </div>
            )
          ) : currentView === 'kewangan' ? (
            hasKewanganAccess ? (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-gray-100 shadow-xs">
                <KewanganSection isMobile={false} transactions={transactions} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Anda tidak mempunyai kebenaran untuk melihat halaman ini.</p>
              </div>
            )
          ) : currentView === 'kertas-kerja' ? (
            !isGoogleSignedIn ? (
              <div className="flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-100 shadow-3xs max-w-lg mx-auto mt-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                  <LogIn className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">LOG MASUK DIPERLUKAN</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Sila log masuk menggunakan akaun Google anda terlebih dahulu untuk mengakses halaman Kertas Kerja.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await loginWithGoogle();
                    } catch (err) {
                      console.error("Gagal log masuk:", err);
                    }
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn size={14} className="stroke-[2.5]" />
                  <span>Log Masuk dengan Google</span>
                </button>
              </div>
            ) : hasKertasKerjaAccess ? (
              <div className="bg-slate-50/20 p-2 sm:p-4 rounded-2xl">
                <KertasKerjaSection isMobile={false} onBack={() => setCurrentView('dashboard')} />
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl shadow-xs border border-gray-100 mt-12 max-w-md mx-auto">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Halaman Kertas Kerja ini hanya boleh diakses oleh peranan Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja.</p>
              </div>
            )
          ) : currentView === 'dokumen' ? (
            hasDokumenAccess ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs">
                <DokumenSection isMobile={false} hasCommitteeAccess={hasCommitteeAccess} onBack={() => setCurrentView('dashboard')} />
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl shadow-xs border border-gray-100 mt-12 max-w-md mx-auto">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Halaman ini hanya boleh diakses oleh peranan Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib/Penolong Setiausaha, dan Bendahari sahaja.</p>
              </div>
            )
          ) : currentView === 'surat' ? (
            hasSuratAccess ? (
              <div className="bg-slate-50/20 p-2 sm:p-4 rounded-2xl">
                <SuratSection isMobile={false} onBack={() => setCurrentView('dashboard')} />
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl shadow-xs border border-gray-100 mt-12 max-w-md mx-auto">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Halaman Jana Surat Rasmi ini hanya boleh diakses oleh peranan Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja.</p>
              </div>
            )
          ) : currentView === 'minit-mesyuarat' ? (
            hasMinitAccess ? (
              <div className="bg-slate-50/20 p-2 sm:p-4 rounded-2xl">
                <MinitMesyuaratSection isMobile={false} onBack={() => setCurrentView('dashboard')} />
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl shadow-xs border border-gray-100 mt-12 max-w-md mx-auto">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Halaman Minit Mesyuarat ini hanya boleh diakses oleh peranan Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja.</p>
              </div>
            )
          ) : currentView === 'kehadiran' ? (
            <div className="bg-slate-50/20 p-2 sm:p-4 rounded-2xl">
              <KehadiranSection onBack={() => setCurrentView('dashboard')} />
            </div>
          ) : currentView === 'notis-panggilan' ? (
            hasNotisPanggilanAccess ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-6 overflow-hidden max-w-full">
                <NotisPanggilanSection isMobile={false} />
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl shadow-xs border border-gray-100 mt-12 max-w-md mx-auto">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Halaman Notis Panggilan ini hanya boleh diakses oleh peranan Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja.</p>
              </div>
            )
          ) : currentView === 'kelulusan-ahli' ? (
            hasKelulusanAhliAccess ? (
              <div className="bg-slate-50/20 p-2 sm:p-4 rounded-2xl">
                <KelulusanAhliSection onBack={() => setCurrentView('dashboard')} />
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl shadow-xs border border-gray-100 mt-12 max-w-md mx-auto">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-extrabold text-slate-900 mb-2">Akses Ditolak</h2>
                <p className="text-sm text-slate-500">Halaman ini hanya boleh diakses oleh peranan Setiausaha, Penolong Setiausaha, Bendahari dan Admin Utama sahaja.</p>
              </div>
            )
          ) : currentView === 'sumbangan' ? (
            <div className="space-y-4">
              <SumbanganSection
                currentUserDoc={currentUserDoc}
                firebaseUser={firebaseUser}
                yuranConfig={yuranConfig}
                onAddToCart={(pkg) => {
                  setPackages(prev => {
                    if (prev.some(p => p.id === pkg.id)) return prev;
                    return [pkg, ...prev];
                  });
                  setCartPackageIds(prev => {
                    if (prev.includes(pkg.id)) return prev;
                    return [...prev, pkg.id];
                  });
                  alert(`"${pkg.name}" bernilai RM ${pkg.price.toFixed(2)} telah berjaya dimasukkan ke troli! Sila tekan ikon Troli di atas untuk meneruskan pembayaran.`);
                }}
                onBack={() => setCurrentView('dashboard')}
                isMobile={false}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-12 text-center max-w-md mx-auto space-y-4 mt-12">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="font-extrabold text-base text-gray-900">Seksyen "{currentView.toUpperCase()}"</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Anda telah melayari seksyen ini. Kami memfokuskan kepada kualiti, interaksi, serta kefungsian Chat, Yuran & Profil untuk dipaparkan secara dinamik di sini.
              </p>
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Kembali ke Dashboard
              </button>
            </div>
          )}

        </main>
      </div>

      {/* Header FPX Secure Gateway Modal */}
      {showHeaderFPXModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-slate-800">
            {/* Payment Method Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-4 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-orange-400" />
                <span className="text-[11px] font-black tracking-wider uppercase">Pembayaran Yuran (FPX / Manual)</span>
              </div>
              <button 
                onClick={() => setShowHeaderFPXModal(false)}
                className="text-white/80 hover:text-white font-extrabold text-xs cursor-pointer bg-white/10 p-1 rounded-full"
                disabled={headerPaymentStep === 'authenticating' || headerPaymentStep === 'processing'}
              >
                <X size={12} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {headerPaymentStep === 'select-bank' && (() => {
                const isManualEnabled = yuranConfig?.enableManualPayment !== false;
                const isFpxEnabled = yuranConfig?.enableFPXPayment !== false;
                const isBothDisabled = !isManualEnabled && !isFpxEnabled;

                if (isBothDisabled) {
                  return (
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
                      <div className="flex items-center justify-center gap-2 text-amber-900 font-black text-sm">
                        <AlertCircle size={18} className="text-amber-600 shrink-0" />
                        <span>Sistem Pembayaran Ditutup Sementara</span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        Perkhidmatan pembayaran dalam talian & manual sedang diselenggara untuk kerja-kerja penambahbaikan. Sila cuba semula kemudian atau hubungi Pentadbir Persatuan.
                      </p>
                    </div>
                  );
                }

                const activeTabToShow = (paymentTab === 'fpx' && !isFpxEnabled) ? 'manual' : (paymentTab === 'manual' && !isManualEnabled) ? 'fpx' : paymentTab;

                return (
                  <div className="space-y-3">
                    {/* Payment Method Selector Tabs */}
                    {isFpxEnabled && isManualEnabled && (
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setPaymentTab('fpx')}
                          className={`py-2 px-2 text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTabToShow === 'fpx' 
                              ? 'bg-white text-indigo-700 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <span className="font-extrabold text-[9px] bg-orange-500 text-white px-1 py-0.2 rounded">fpx</span>
                          <span>Bayaran FPX</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentTab('manual')}
                          className={`py-2 px-2 text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTabToShow === 'manual' 
                              ? 'bg-white text-indigo-700 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Upload size={12} />
                          <span>Bayaran Manual</span>
                        </button>
                      </div>
                    )}

                    {activeTabToShow === 'fpx' && isFpxEnabled ? (
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-extrabold text-[11px] text-slate-950 uppercase tracking-wider">Pilih Bank FPX Anda:</h4>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">Pemindahan selamat untuk Yuran & Sumbangan PIBG SMAUJ</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-0.5">
                        {BANKS.map((bank, bIdx) => (
                          <button
                            key={bank.name || `bank-${bIdx}`}
                            type="button"
                            onClick={() => setHeaderSelectedBank(bank.name)}
                            className={`p-2 rounded-xl border-2 text-left flex items-center gap-2 transition-all cursor-pointer ${
                              headerSelectedBank === bank.name 
                                ? 'border-[#3f3ebd] bg-indigo-50/50' 
                                : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                            }`}
                          >
                            <span className="text-sm shrink-0">{bank.logo}</span>
                            <span className="text-[10px] font-extrabold text-slate-700">{bank.name}</span>
                          </button>
                        ))}
                      </div>

                      {/* Summary list in modal */}
                      <div className="bg-slate-50 rounded-2xl p-3 text-[10px] text-slate-600 space-y-1.5 border border-slate-100">
                        <div className="flex justify-between font-bold text-slate-400 uppercase tracking-wider">
                          <span>Penerima</span>
                          <span className="text-slate-800 text-right">PIBG SMAUJ</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-400 uppercase tracking-wider pt-1.5 border-t border-slate-200/50">
                          <span>Harga Yuran</span>
                          <span className="text-slate-800 font-extrabold text-right">RM{subTotalCart.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-400 uppercase tracking-wider">
                          <span>Caj FPX</span>
                          <span className={`${isFpxSurcharge ? 'text-amber-600' : 'text-slate-400'} font-extrabold text-right`}>
                            {isFpxSurcharge ? `+ RM${cartFpxFee.toFixed(2)}` : `RM${cartFpxFee.toFixed(2)} (Diserap)`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center font-bold text-slate-400 uppercase tracking-wider pt-1.5 border-t border-slate-200/50">
                          <span>Amaun Keseluruhan</span>
                          <span className="text-[#3f3ebd] text-xs font-black">RM{cartTotalAmount.toFixed(2)}</span>
                        </div>
                      </div>

                      <form onSubmit={handleConfirmHeaderFPXLogin} className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-slate-500 block uppercase tracking-wider">ID Pengguna Bank (Simulasi):</label>
                          <input
                            type="text"
                            required
                            value={headerFpxUsername}
                            onChange={(e) => setHeaderFpxUsername(e.target.value)}
                            className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#3f3ebd] font-bold text-slate-900 bg-slate-50/30"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-slate-500 block uppercase tracking-wider">Kata Laluan Bank (Simulasi):</label>
                          <input
                            type="password"
                            required
                            value={headerFpxPassword}
                            onChange={(e) => setHeaderFpxPassword(e.target.value)}
                            className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#3f3ebd] font-bold text-slate-900 bg-slate-50/30"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={!headerSelectedBank}
                          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer text-center block mt-3 shadow-md shadow-orange-100"
                        >
                          Log Masuk & Bayar RM{cartTotalAmount.toFixed(2)}
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* MANUAL PAYMENT TAB */
                    <form onSubmit={handleConfirmManualPayment} className="space-y-3">
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3 text-[10px] space-y-1">
                        <div className="flex justify-between items-center text-amber-900 font-black border-b border-amber-200/50 pb-1">
                          <span>Akaun Persatuan (Pindahan Bank / CDM):</span>
                          <span className="text-[9px] bg-amber-200/60 text-amber-800 px-1.5 py-0.5 rounded">{yuranConfig.manualBankName || "Bank Islam / Maybank"}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 font-bold">
                          <span>Nama Akaun:</span>
                          <span className="text-slate-900 font-black text-right">{yuranConfig.manualAccountName || "PIBG SEKOLAH MENENGAH AGAMA ULU JEMPOL"}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 font-bold">
                          <span>No. Akaun:</span>
                          <span className="text-indigo-700 font-black tracking-wider text-right">{yuranConfig.manualAccountNumber || "5562 1234 5678"}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 font-bold pt-1 border-t border-amber-200/50">
                          <span>Amaun Perlu Dibayar:</span>
                          <span className="text-indigo-600 font-black text-xs text-right">RM{subTotalCart.toFixed(2)}</span>
                        </div>
                      </div>

                      {yuranConfig.manualQrCodeUrl && (
                        <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Imbas Kod QR Pembayaran</p>
                          <img 
                            src={yuranConfig.manualQrCodeUrl} 
                            alt="Kod QR Pembayaran" 
                            className="h-32 w-32 object-contain rounded-lg border border-slate-100" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-700 block uppercase tracking-wider">
                          Muat Naik Gambar Resit Bukti Bayaran <span className="text-rose-500">*</span>:
                        </label>
                        <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-2xl p-3 text-center transition-all">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            required
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setManualReceiptFile(file);
                                if (file.type.startsWith('image/')) {
                                  const url = URL.createObjectURL(file);
                                  setManualReceiptPreview(url);
                                  verifyReceiptWithAi(file);
                                } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                                  setManualReceiptPreview('');
                                  verifyReceiptWithAi(file);
                                } else {
                                  setManualReceiptPreview('');
                                  setAiScanStatus('idle');
                                }
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          {manualReceiptFile ? (
                            <div className="space-y-1">
                              {manualReceiptPreview && (
                                <img src={manualReceiptPreview} alt="Preview Resit" className="h-20 max-w-full object-contain mx-auto rounded-lg shadow-xs" />
                              )}
                              <p className="text-[10px] font-black text-emerald-700 truncate">{manualReceiptFile.name}</p>
                              <p className="text-[8px] text-slate-400 font-bold">Klik untuk menukar gambar resit</p>
                            </div>
                          ) : (
                            <div className="space-y-1 py-1">
                              <Upload size={20} className="mx-auto text-indigo-500" />
                              <p className="text-[10px] font-black text-slate-700">Pilih atau Seret Gambar Resit Bukti Bayaran</p>
                              <p className="text-[8px] text-slate-400 font-semibold">Format JPG, PNG, JPEG, PDF (Maksimum 5MB)</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AI Vision Scan Result Banner */}
                      {aiScanStatus === 'scanning' && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 text-[10px] text-purple-900 flex items-center gap-2 animate-pulse">
                          <Loader2 size={15} className="animate-spin text-purple-600 shrink-0" />
                          <div>
                            <p className="font-extrabold">OpenRouter AI Vision Sedang Mengimbas Resit...</p>
                            <p className="text-[9px] text-purple-600 font-medium">Mengesahkan kesahihan resit dan jumlah bayaran tertera.</p>
                          </div>
                        </div>
                      )}

                      {aiScanStatus === 'invalid' && (
                        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-2.5 text-[10px] text-rose-950 space-y-1">
                          <div className="flex items-center gap-1.5 font-black text-rose-700">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>AMARAN AI VISION: Gambar / Amaun Resit Tidak Sah!</span>
                          </div>
                          <p className="text-[9.5px] font-bold text-rose-800 leading-snug">
                            {aiErrorMessage || 'Gambar/fail yang dimuat naik dikesan BUKAN resit transaksi pembayaran yang sah atau amaun tidak padan. Sila muat naik gambar resit bayaran yang sah.'}
                          </p>
                          <p className="text-[8.5px] font-semibold text-rose-600">Sila muat naik resit dengan amaun bayaran yang betul untuk membolehkan penghantaran.</p>
                        </div>
                      )}

                      {aiScanStatus === 'valid' && aiScanResult && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[10px] text-emerald-950 space-y-1">
                          <div className="flex items-center justify-between font-black text-emerald-800 border-b border-emerald-200/60 pb-1">
                            <span className="flex items-center gap-1">
                              <Sparkles size={13} className="text-emerald-600" />
                              <span>✓ AI Vision: Resit Bayaran Sah & Amaun Padan</span>
                            </span>
                            <span className="bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded text-[9px] font-black">
                              RM {aiScanResult.detectedAmount ? aiScanResult.detectedAmount.toFixed(2) : subTotalCart.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[9px] text-emerald-700 font-medium">{aiScanResult.aiNotes}</p>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-500 block uppercase tracking-wider">No. Rujukan / Catatan (Pilihan):</label>
                        <input
                          type="text"
                          placeholder="Cth: Ref 123456 / Bayaran CDM Maybank"
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                          className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#3f3ebd] font-bold text-slate-900 bg-slate-50/30"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!manualReceiptFile || isUploadingReceipt || aiScanStatus === 'scanning' || aiScanStatus === 'invalid'}
                        className={`w-full py-2.5 text-xs rounded-xl font-extrabold transition-all text-center flex items-center justify-center gap-2 shadow-md ${
                          !manualReceiptFile || isUploadingReceipt || aiScanStatus === 'scanning' || aiScanStatus === 'invalid'
                            ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none opacity-80'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 cursor-pointer'
                        }`}
                      >
                        {isUploadingReceipt ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Memuat Naik Resit...</span>
                          </>
                        ) : aiScanStatus === 'scanning' ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Mengimbas Resit AI...</span>
                          </>
                        ) : aiScanStatus === 'invalid' ? (
                          <>
                            <AlertCircle size={14} />
                            <span>Muat Naik Resit Amaun Yang Betul</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            <span>Hantar Resit & Serahkan Untuk Pengesahan</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
                );
              })()}

              {(headerPaymentStep === 'authenticating' || headerPaymentStep === 'processing') && (
                <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
                  <Loader2 size={30} className="text-[#3f3ebd] animate-spin" />
                  <div>
                    <h4 className="font-extrabold text-[11px] text-slate-900 uppercase tracking-wider">
                      {headerPaymentStep === 'authenticating' 
                        ? 'Mengesahkan Kelayakan Bank...' 
                        : 'Melaksanakan Pemindahan FPX Selamat...'}
                    </h4>
                    <p className="text-[9px] text-slate-400 font-bold max-w-xs mt-1 leading-normal">
                      Sila tunggu sebentar. Jangan tutup tetingkap atau muat semula halaman ini bagi menjamin kelancaran transaksi.
                    </p>
                  </div>
                </div>
              )}

              {headerPaymentStep === 'success' && (
                <div className="py-4 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <Check size={20} className="stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Pembayaran Berjaya!</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Transaksi FPX anda telah diproses dan disahkan oleh bank.</p>
                  </div>

                  <div className="w-full bg-slate-50 rounded-xl p-3 text-[10px] text-left space-y-1.5 border border-slate-100">
                    <div className="flex justify-between text-slate-400 font-bold uppercase tracking-wider">
                      <span>Status</span>
                      <span className="text-emerald-600 font-black">SUCCESSFUL</span>
                    </div>
                    <div className="flex justify-between text-slate-400 font-bold uppercase tracking-wider">
                      <span>No. Rujukan</span>
                      <span className="font-mono font-extrabold text-slate-800">FPX-20260626-9812A</span>
                    </div>
                    <div className="flex justify-between text-slate-400 font-bold uppercase tracking-wider">
                      <span>Bank Terlibat</span>
                      <span className="font-extrabold text-slate-800">{headerSelectedBank}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 font-bold uppercase tracking-wider pt-1.5 border-t border-slate-200/50">
                      <span>Jumlah Bayaran</span>
                      <span className="font-black text-[#3f3ebd]">RM{cartTotalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowHeaderFPXModal(false)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Kembali ke Portal SMAUJ
                  </button>
                </div>
              )}

              {headerPaymentStep === 'success-manual' && (
                <div className="py-4 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shadow-lg">
                    <Clock size={22} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">Resit Berjaya Dihantar!</h4>
                    <p className="text-[10px] text-amber-700 font-black mt-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block uppercase">
                      Status Transaksi: BELUM DISAHKAN
                    </p>
                  </div>

                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed max-w-xs">
                    Gambar resit bukti bayaran anda telah selamat disimpan. Transaksi ini akan disemak dan disahkan oleh Admin Utama atau Bendahari di Lejar Umum Kewangan.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setShowHeaderFPXModal(false);
                      setHeaderPaymentStep('select-bank');
                      setManualReceiptFile(null);
                      setManualReceiptPreview('');
                      setManualNotes('');
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer text-center shadow-md shadow-indigo-100"
                  >
                    Faham & Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom PWA Install Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm select-none">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#f1f3f4] rounded-lg">
                  {/* Google Chrome Icon */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                    <path d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0Z" fill="#F4B400"/>
                    <path d="M12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6Z" fill="#FFFFFF"/>
                    <path d="M12 7.5C14.4853 7.5 16.5 9.51472 16.5 12C16.5 14.4853 14.4853 16.5 12 16.5C9.51472 16.5 7.5 14.4853 7.5 12C7.5 9.51472 9.51472 7.5 12 7.5ZM12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5Z" fill="#4285F4"/>
                    <path d="M12 0C16.8 0 20.9 2.8 22.8 6.9L16.5 17.8C15.6 19.3 13.9 20.3 12 20.3C9.3 20.3 7 18.5 6.3 16L0.2 5.5C2 2.2 5.7 0 12 0Z" fill="#DB4437" opacity="0.9"/>
                    <path d="M12 24C5.4 24 0 18.6 0 12C0 11.2 0.1 10.4 0.2 9.6L6.5 20.5C7.8 22.6 10.1 24 12.8 24H12Z" fill="#0F9D58" opacity="0.9"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs tracking-tight">Pasang Aplikasi PWA</h3>
                  <p className="text-[9px] text-slate-400 font-bold">Google Chrome Installer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={14} className="stroke-[2.5]" />
              </button>
            </div>
            
            {/* Modal Body */}
            {(() => {
              const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);
              return (
                <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-600 leading-relaxed">
                  {/* Custom Icon Presentation Box */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3.5 shadow-xs">
                    <div className="relative shrink-0">
                      <img 
                        src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/512x512%20piksels.png?alt=media&token=038c8c8a-f072-4cc5-9241-54cf45f0370c" 
                        alt="SMAUJ Logo 512px"
                        className="w-16 h-16 rounded-2xl object-cover shadow-md border border-slate-100 bg-white"
                        onError={(e) => {
                          e.currentTarget.src = "/icons/icon-512x512.png";
                        }}
                      />
                      <img 
                        src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/192x192%20piksel.png?alt=media&token=5680a9a1-dd10-4092-ac50-a313ad94b27c" 
                        alt="SMAUJ Icon 192px"
                        className="w-6 h-6 rounded-lg object-cover shadow-xs border-2 border-white absolute -bottom-1 -right-1 bg-white"
                        onError={(e) => {
                          e.currentTarget.src = "/icons/icon-192x192.png";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900 text-sm tracking-tight mb-0.5">SMAUJ Portal</h4>
                      <p className="text-[10px] text-[#3f3ebd] font-bold tracking-tight truncate">
                        {typeof window !== 'undefined' ? window.location.hostname : 'smaujempol'}
                      </p>
                      <p className="text-[9px] text-slate-500 font-medium mt-0.5">Sekolah Menengah Agama Ulu Jempol</p>
                    </div>
                  </div>

                  {typeof window !== 'undefined' && window.self !== window.top ? (
                    // Inside AI Studio Preview Iframe
                    <div className="space-y-3.5">
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-[10px] font-semibold leading-relaxed flex gap-2">
                        <span className="text-sm">⚠️</span>
                        <div>
                          <strong className="font-extrabold block mb-0.5">Sekatan Sandbox (Iframe)</strong>
                          Anda sedang membuka aplikasi ini di dalam preview Google AI Studio. Pelayar menyekat pemasangan aplikasi secara terus di dalam iframe.
                        </div>
                      </div>
                      
                      <p className="text-slate-500 text-[10px] text-center leading-normal">
                        Untuk menggunakan ciri PWA dengan icon di atas, sila klik butang di bawah untuk membuka aplikasi dalam tab penuh.
                      </p>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowInstallModal(false)}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-center text-[10px]"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            window.open(window.location.href, '_blank');
                            setShowInstallModal(false);
                          }}
                          className="flex-[2] py-2.5 bg-[#3f3ebd] hover:bg-[#3433a3] text-white font-extrabold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-[10px]"
                        >
                          Buka Tab Baharu & Pasang
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Outside Iframe (Live View on Web)
                    <div className="space-y-4">
                      <div className="p-3.5 bg-indigo-50/40 border border-indigo-100/50 rounded-xl text-indigo-950 text-[10px] leading-relaxed font-medium">
                        ✨ <strong>Kenapa Perlu Pasang?</strong> Aplikasi ini menyokong Progressive Web App (PWA) sepenuhnya. Selepas dipasang, ia akan mempunyai menu sendiri di telefon pintar anda dan dilancarkan dengan lebih pantas!
                      </div>

                      {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                        // iOS Instruction Set
                        <div className="space-y-3">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                            <p className="font-extrabold text-slate-800 text-[10px]">📱 Langkah Pemasangan iOS/Safari:</p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[10px]">
                              <li>Tekan butang <strong className="text-indigo-600">Kongsi (Share)</strong> di bahagian bawah Safari.</li>
                              <li>Pilih <strong className="text-indigo-600">'Tambah ke Skrin Utama' (Add to Home Screen)</strong>.</li>
                              <li>Tekan <strong className="text-indigo-600">'Tambah' (Add)</strong> di penjuru kanan atas.</li>
                            </ol>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setShowInstallModal(false)}
                            className="w-full py-2.5 bg-[#3f3ebd] hover:bg-[#3433a3] text-white font-extrabold rounded-xl shadow-md transition-colors cursor-pointer text-center text-[10px]"
                          >
                            Faham & Tutup
                          </button>
                        </div>
                      ) : (
                        // Android & Desktop Chrome Instruction/Action Set
                        <div className="space-y-3">
                          {activePrompt ? (
                            <div className="p-2.5 bg-green-50 border border-green-100 rounded-xl text-green-800 text-[10px] font-semibold text-center leading-normal">
                              🎉 Pelayar Chrome anda sedia untuk dipasang terus ke skrin peranti anda!
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                              <p className="font-extrabold text-slate-800 text-[10px]">💻 Pemasangan Manual Chrome:</p>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[10px]">
                                <li>Sila klik butang <strong className="text-[#3f3ebd]">Pasang Aplikasi</strong> di bar alamat pelayar Chrome anda.</li>
                                <li>Atau klik <strong className="text-[#3f3ebd]">Menu 3-Titik Chrome</strong> di bahagian atas kanan dan pilih <strong className="text-[#3f3ebd]">'Pasang' (Install App)</strong>.</li>
                              </ul>
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowInstallModal(false)}
                              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-center text-[10px]"
                            >
                              Batal
                            </button>
                            
                            {activePrompt ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    activePrompt.prompt();
                                    const { outcome } = await activePrompt.userChoice;
                                    if (outcome === 'accepted') {
                                      setIsInstalled(true);
                                    }
                                    setDeferredPrompt(null);
                                    if (typeof window !== 'undefined') (window as any).deferredPrompt = null;
                                    setShowInstallModal(false);
                                  } catch (err) {
                                    console.warn('PWA prompt error:', err);
                                  }
                                }}
                                className="flex-[2] py-2.5 bg-[#3f3ebd] hover:bg-[#3433a3] text-white font-extrabold rounded-xl shadow-md transition-colors cursor-pointer text-[10px]"
                              >
                                Pasang Sekarang
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowInstallModal(false)}
                                className="flex-[2] py-2.5 bg-[#3f3ebd] hover:bg-[#3433a3] text-white font-extrabold rounded-xl shadow-md transition-colors cursor-pointer text-[10px]"
                              >
                                Selesai
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <ConfirmLogoutModal
        isOpen={showLogoutConfirmModal}
        onClose={() => {
          if (!isLoggingOut) setShowLogoutConfirmModal(false);
        }}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
        isGuest={!firebaseUser || firebaseUser.isAnonymous}
        userName={currentUserDoc?.displayName || firebaseUser?.displayName || 'Pengguna'}
      />

      <SumbanganModal
        isOpen={showSumbanganModal}
        onClose={() => setShowSumbanganModal(false)}
        currentUserDoc={currentUserDoc}
        firebaseUser={firebaseUser}
        onAddToCart={(pkg) => {
          setPackages(prev => {
            if (prev.some(p => p.id === pkg.id)) return prev;
            return [pkg, ...prev];
          });
          setCartPackageIds(prev => {
            if (prev.includes(pkg.id)) return prev;
            return [...prev, pkg.id];
          });
          alert(`"${pkg.name}" bernilai RM ${pkg.price.toFixed(2)} telah berjaya dimasukkan ke troli! Sila tekan ikon Troli di atas untuk meneruskan pembayaran.`);
        }}
      />

    </div>
  );
}
