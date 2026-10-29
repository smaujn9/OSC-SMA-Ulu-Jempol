import { useState, useEffect, useMemo } from 'react';
import { Post, FeeItem, Comment, ImageFeePackage, BlogItem, UpcomingEvent, Announcement, AppNotification, ActiveMember, CaseRecord } from './types';
import { INITIAL_POSTS, INITIAL_FEES, USER_AHMAD, BLOG_POSTS, ANNOUNCEMENTS } from './data/mockData';
import { DEFAULT_YURAN_CONFIG, generatePackagesFromConfig, YuranConfig, getPackagePrice, computeAllPaidPackageIds } from './utils/yuranConfigHelper';
import DesktopView from './components/DesktopView';
import MobileView from './components/MobileView';
import LoginPromptModal from './components/LoginPromptModal';
import { KewanganTransaction, INITIAL_TRANSACTIONS } from './components/KewanganSection';
import { Check, Heart, MessageSquare, ShieldAlert, LogIn, Sparkles, Bell, Megaphone, BookOpen, X, AlertTriangle } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { db, storage } from './lib/firebase';
import { sendPushNotificationToAll, notifyOnChatPost } from './utils/notificationHelper';
import { sendTelegramPaymentNotification } from './utils/telegramHelper';
import { cleanUndefined } from './utils/firestoreUtils';
import { parseDateToMs } from './utils/dateUtils';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { uploadBase64ToStorage, preloadImages, preloadImageToCache, initImageCachePrewarm } from './utils/imageUtils';
import FloatingBotWidget from './components/FloatingBotWidget';
import { DonationSuccessModal } from './components/DonationSuccessModal';
import { DonationReceiptData } from './utils/donationReceiptPdf';


const getRouteFromPath = (path: string, userRole?: string) => {
  const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
  if (cleanPath === '/' || cleanPath === '/dashboard' || cleanPath === '/utama') {
    return { desktop: 'dashboard', mobile: 'utama' };
  }
  if (
    cleanPath === '/peta' ||
    cleanPath === '/peta-3d' ||
    cleanPath === '/peta-penduduk' ||
    cleanPath === '/peta-3d-taman-musytari-fasa-2'
  ) {
    if (typeof window !== 'undefined') {
      window.location.replace('/assets/aistudio/peta_3d_taman_musytari_fasa_2_ccae91c0.html' + window.location.search);
    }
    return { desktop: 'dashboard', mobile: 'utama' };
  }
  if (cleanPath === '/chat') return { desktop: 'chat', mobile: 'chat' };
  if (cleanPath === '/yuran') return { desktop: 'yuran', mobile: 'yuran' };
  if (cleanPath === '/profil' || cleanPath === '/profile') return { desktop: 'profile', mobile: 'profil' };
  if (cleanPath === '/blog') return { desktop: 'blog', mobile: 'blog' };
  if (cleanPath === '/laporan') return { desktop: 'laporan', mobile: 'laporan' };
  if (cleanPath === '/takwim') return { desktop: 'takwim', mobile: 'takwim' };
  if (cleanPath === '/pengumuman') return { desktop: 'pengumuman', mobile: 'pengumuman' };
  if (cleanPath === '/lain-lain' || cleanPath === '/lain_lain_view') return { desktop: 'lain-lain', mobile: 'lain_lain_view' };
  if (cleanPath === '/pengeluaran') return { desktop: 'pengeluaran', mobile: 'pengeluaran' };
  if (cleanPath === '/daftar' || cleanPath === '/daftar-ahli') return { desktop: 'dashboard', mobile: 'utama' };
  if (cleanPath === '/ajk' || cleanPath === '/ahli-jawatankuasa') {
    return { desktop: 'ahli', mobile: 'ahli' };
  }
  if (cleanPath === '/ahli' || cleanPath === '/kelulusan-ahli' || cleanPath === '/kelulusan') {
    return { desktop: 'kelulusan-ahli', mobile: 'kelulusan-ahli' };
  }
  if (cleanPath === '/kehadiran') return { desktop: 'kehadiran', mobile: 'kehadiran' };
  if (cleanPath === '/qurban' || cleanPath === '/qurban-aqiqah' || cleanPath === '/urus-qurban') {
    return { desktop: 'dashboard', mobile: 'utama' };
  }
  if (cleanPath === '/kertaskerja' || cleanPath === '/kertas-kerja') {
    return { desktop: 'kertas-kerja', mobile: 'kertas-kerja' };
  }
  if (cleanPath === '/perbelanjaan' || cleanPath === '/perbelanjaan-program') {
    return { desktop: 'perbelanjaan-program', mobile: 'perbelanjaan-program' };
  }
  if (cleanPath === '/baucar' || cleanPath === '/baucar-bayaran') {
    return { desktop: 'baucar', mobile: 'baucar' };
  }
  if (cleanPath === '/minit' || cleanPath === '/minit-mesyuarat') {
    return { desktop: 'minit-mesyuarat', mobile: 'minit-mesyuarat' };
  }
  if (cleanPath === '/surat' || cleanPath === '/surat-rasmi') {
    return { desktop: 'surat', mobile: 'surat' };
  }
  if (cleanPath === '/admin') return { desktop: 'admin', mobile: 'admin' };
  if (cleanPath === '/kewangan') return { desktop: 'kewangan', mobile: 'kewangan' };
  if (cleanPath === '/dokumen') return { desktop: 'dokumen', mobile: 'dokumen' };
  if (cleanPath === '/lapor-kes' || cleanPath === '/pendaftaran-kes' || cleanPath === '/daftar-kes') {
    return { desktop: 'dashboard', mobile: 'utama' };
  }
  if (cleanPath === '/pengurusan-kes' || cleanPath === '/sejarah-kes' || cleanPath === '/rekod-kes' || cleanPath === '/senarai-kes' || cleanPath === '/kes') {
    return { desktop: 'dashboard', mobile: 'utama' };
  }
  if (cleanPath === '/notis' || cleanPath === '/notis-panggilan') return { desktop: 'notis-panggilan', mobile: 'notis-panggilan' };
  if (cleanPath === '/sumbangan' || cleanPath === '/derma' || cleanPath === '/infaq') {
    return { desktop: 'sumbangan', mobile: 'sumbangan' };
  }
  return null;
};

const getPathFromView = (desktopView: string) => {
  if (desktopView === 'dashboard') return '/';
  if (desktopView === 'chat') return '/chat';
  if (desktopView === 'yuran') return '/yuran';
  if (desktopView === 'sumbangan') return '/sumbangan';
  if (desktopView === 'profile') return '/profil';
  if (desktopView === 'blog') return '/blog';
  if (desktopView === 'laporan') return '/laporan';
  if (desktopView === 'takwim') return '/takwim';
  if (desktopView === 'pengumuman') return '/pengumuman';
  if (desktopView === 'lain-lain') return '/lain-lain';
  if (desktopView === 'pengeluaran') return '/pengeluaran';
  if (desktopView === 'daftar-ahli') return '/daftar';
  if (desktopView === 'ahli') return '/ajk';
  if (desktopView === 'kelulusan-ahli') return '/kelulusan-ahli';
  if (desktopView === 'kehadiran') return '/kehadiran';
  if (desktopView === 'kertas-kerja') return '/kertaskerja';
  if (desktopView === 'perbelanjaan-program') return '/perbelanjaan';
  if (desktopView === 'baucar') return '/baucar';
  if (desktopView === 'minit-mesyuarat') return '/minit';
  if (desktopView === 'surat') return '/surat';
  if (desktopView === 'admin') return '/admin';
  if (desktopView === 'kewangan') return '/kewangan';
  if (desktopView === 'dokumen') return '/dokumen';
  if (desktopView === 'notis-panggilan') return '/notis';
  return '/';
};

let globalMigrationFailedCount = 0;
const MAX_MIGRATION_FAILURES = 3;

export default function App() {
  const { firebaseUser, currentUserDoc, loginWithGoogle, logout, loading, allUsers } = useAuth();
  const [googleLoginError, setGoogleLoginError] = useState<string | null>(null);

  // Sync USER_AHMAD with current firebase user details
  useEffect(() => {
    const isCustomAvatar = (url: string | null | undefined) => {
      if (!url) return false;
      return url.startsWith('data:image/') || url.includes('firebasestorage.googleapis.com') || url.includes('/users/');
    };

    if (currentUserDoc && firebaseUser && !firebaseUser.isAnonymous) {
      USER_AHMAD.name = currentUserDoc.nickname || currentUserDoc.displayName || 'Pengguna';
      USER_AHMAD.email = currentUserDoc.email || '';
      USER_AHMAD.role = currentUserDoc.role || 'Pelawat';
      USER_AHMAD.address = currentUserDoc.address || '';
      USER_AHMAD.phone = currentUserDoc.phoneNumber || '';
      const resolvedAvatar = currentUserDoc.uploadedProfileImageUrl || currentUserDoc.photoURL || currentUserDoc.googleProfileImageUrl;
      if (resolvedAvatar) {
        USER_AHMAD.avatar = resolvedAvatar;
      } else if (firebaseUser.photoURL && !isCustomAvatar(USER_AHMAD.avatar)) {
        USER_AHMAD.avatar = firebaseUser.photoURL;
      }
      
      const resolvedCover = currentUserDoc.uploadedCoverImageUrl || currentUserDoc.coverURL;
      if (resolvedCover) {
        USER_AHMAD.cover = resolvedCover;
        preloadImageToCache(resolvedCover);
      }
    } else if (firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local') {
      USER_AHMAD.name = firebaseUser.displayName || 'Tetamu';
      USER_AHMAD.email = '';
      USER_AHMAD.role = 'Pelawat';
      USER_AHMAD.phone = '';
      if (firebaseUser.photoURL && !isCustomAvatar(USER_AHMAD.avatar)) {
        USER_AHMAD.avatar = firebaseUser.photoURL;
      }
    } else if (!loading) {
      USER_AHMAD.name = "Tetamu";
      USER_AHMAD.email = "";
      USER_AHMAD.role = "Pelawat";
      USER_AHMAD.phone = "";
      USER_AHMAD.address = "";
    }
    // Dispatch events to notify other components of avatar/name changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tmf2_avatar_changed'));
      window.dispatchEvent(new Event('tmf2_cover_changed'));
    }
  }, [currentUserDoc, firebaseUser, loading]);

  // Startup Choice Modal disabled per request (automatically bypass and log in anonymously)

  // Device mode toggler: 'desktop' | 'mobile' (automatically responsive based on viewport width)
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 ? 'mobile' : 'desktop';
    }
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      setDeviceMode(window.innerWidth < 1024 ? 'mobile' : 'desktop');
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Unified real-time states
  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem('tmf2_posts');
    return saved ? JSON.parse(saved) : [];
  });

  // Early startup pre-warming of critical images (Cover photo & Chat images)
  useEffect(() => {
    initImageCachePrewarm();
  }, []);

  // Pre-cache cover photo and chat images in the background on startup for a buttery-smooth experience
  useEffect(() => {
    const coverToPreload = currentUserDoc?.uploadedCoverImageUrl || currentUserDoc?.coverURL || USER_AHMAD.cover;
    const chatImages = (posts || []).map(p => p.image).filter((img): img is string => typeof img === 'string' && img.trim() !== '');
    const chatAvatars = (posts || []).map(p => p.authorAvatar).filter((av): av is string => typeof av === 'string' && av.trim() !== '');
    preloadImages([coverToPreload, ...chatImages, ...chatAvatars]);
  }, [currentUserDoc, posts]);
  const [fees, setFees] = useState<FeeItem[]>(() => {
    const saved = localStorage.getItem('tmf2_fees');
    return saved ? JSON.parse(saved) : [];
  });
  const [blogs, setBlogs] = useState<BlogItem[]>(() => {
    const saved = localStorage.getItem('tmf2_blog_posts');
    return saved ? JSON.parse(saved) : [];
  });
  const [programReports, setProgramReports] = useState<any[]>(() => {
    const saved = localStorage.getItem('tmf2_program_reports');
    return saved ? JSON.parse(saved) : [];
  });
  const [events, setEvents] = useState<UpcomingEvent[]>(() => {
    const saved = localStorage.getItem('tmf2_events');
    return saved ? JSON.parse(saved) : [];
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const saved = localStorage.getItem('tmf2_announcements');
    return saved ? JSON.parse(saved) : [];
  });
  const [transactions, setTransactions] = useState<KewanganTransaction[]>(() => {
    const saved = localStorage.getItem('tmf2_kewangan_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [cases, setCases] = useState<CaseRecord[]>(() => {
    const saved = localStorage.getItem('tmf2_cases');
    return saved ? JSON.parse(saved) : [];
  });
  const [viewedMember, setViewedMember] = useState<ActiveMember | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const local = localStorage.getItem('tmf2_notifications_list');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    return [];
  });

  const [hasUnreadNotifications, setHasUnreadNotifications] = useState<boolean>(() => {
    const local = localStorage.getItem('tmf2_notifications_list');
    if (!local) return false;
    const val = localStorage.getItem('tmf2_notifications_unread');
    return val !== 'false';
  });

  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  // Play custom chime using Web Audio API
  const playNotificationChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.12); // C6

      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio output blocked or unsupported:', e);
    }
  };

  const addNotification = (text: string, type: 'announcement' | 'blog' | 'general' | 'chat', relatedId?: string) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text,
      time: "Baru saja",
      type,
      relatedId
    };

    setNotifications(prev => {
      // Update historical notifications relative times
      const relativeList = prev.map(n => {
        if (n.time === "Baru saja") return { ...n, time: "Sebentar tadi" };
        if (n.time === "Sebentar tadi") return { ...n, time: "Hari ini" };
        return n;
      });
      const updated = [newNotif, ...relativeList].slice(0, 30);
      localStorage.setItem('tmf2_notifications_list', JSON.stringify(updated));
      return updated;
    });
    setHasUnreadNotifications(true);
    localStorage.setItem('tmf2_notifications_unread', 'true');

    // Play sound chime
    playNotificationChime();

    // Trigger standard Web Notification if supported and permitted
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        const title = type === 'announcement' 
          ? '📣 Pengumuman Baharu SMAUJ' 
          : type === 'chat'
            ? '💬 Sembang Warga SMAUJ'
            : '✍️ Laporan Terkini SMAUJ';
        const options = {
          body: text,
          tag: type === 'chat' ? 'smauj-chat' : 'smauj-alert',
          renotify: true
        };
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, options).catch(() => {
              new Notification(title, options);
            });
          }).catch(() => {
            new Notification(title, options);
          });
        } else {
          new Notification(title, options);
        }
      }
    }

    // Trigger sliding in-app toast
    setActiveToast(newNotif);
  };


  const [yuranConfig, setYuranConfig] = useState<YuranConfig>(() => {
    const local = localStorage.getItem('tmf2_yuran_config');
    return local ? JSON.parse(local) : DEFAULT_YURAN_CONFIG;
  });

  const [packages, setPackages] = useState<ImageFeePackage[]>(() => {
    const baseConfig = (() => {
      const local = localStorage.getItem('tmf2_yuran_config');
      return local ? JSON.parse(local) : DEFAULT_YURAN_CONFIG;
    })();
    const baseList = generatePackagesFromConfig(baseConfig, null);
    const cachedPkgs = (() => {
      try {
        const saved = localStorage.getItem('tmf2_yuran_packages');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    })();
    const customCached = cachedPkgs.filter((p: any) => !baseList.some(b => b.id === p.id));
    return [...baseList, ...customCached];
  });

  useEffect(() => {
    localStorage.setItem('tmf2_yuran_config', JSON.stringify(yuranConfig));
  }, [yuranConfig]);

  useEffect(() => {
    setPackages(prev => {
      const basePkgs = generatePackagesFromConfig(yuranConfig, currentUserDoc?.uid);
      const email = (currentUserDoc?.email || firebaseUser?.email || '').toLowerCase();
      
      const directPaidIds = new Set<string>(currentUserDoc?.paidPackageIds || []);

      if (email) {
        transactions.forEach(t => {
          if (t.memberEmail && t.memberEmail.toLowerCase() === email && t.approvalStatus === 'Approved') {
            if (t.paidPackageIds && Array.isArray(t.paidPackageIds)) {
              t.paidPackageIds.forEach(id => directPaidIds.add(id));
            }
            // Match transaction description or notes if present
            const desc = (t.description || '').toLowerCase();
            const notes = (t.notes || '').toLowerCase();
            basePkgs.forEach(bp => {
              if (bp.name && (desc.includes(bp.name.toLowerCase()) || notes.includes(bp.name.toLowerCase()))) {
                directPaidIds.add(bp.id);
              }
            });
          }
        });
      }

      const allPaidIds = computeAllPaidPackageIds(basePkgs, directPaidIds);

      const baseUpdated = basePkgs.map(bp => {
        let finalIsPaid = allPaidIds.has(bp.id);
        let customCartAmt = bp.customCartAmount;

        if (bp.isCustomAmount) {
          const totalPaid = transactions
            .filter(t => (t.memberEmail || '').toLowerCase() === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(bp.id))
            .reduce((sum, t) => sum + (t.amount || 0), 0);
          
          const remaining = Math.max(0, bp.price - totalPaid);
          finalIsPaid = remaining <= 0;
          
          const prevPkg = prev.find(p => p.id === bp.id);
          if (prevPkg && prevPkg.customCartAmount !== undefined) {
            customCartAmt = prevPkg.customCartAmount;
          } else {
            customCartAmt = remaining;
          }
        }

        return { 
          ...bp, 
          isPaid: finalIsPaid,
          customCartAmount: customCartAmt
        };
      });

      // Preserve dynamic non-base packages (such as Qurban items)
      const customPkgs = prev.filter(p => !basePkgs.some(bp => bp.id === p.id));
      return [...baseUpdated, ...customPkgs];
    });
  }, [yuranConfig, currentUserDoc, firebaseUser, transactions]);

  const [cartPackageIds, setCartPackageIds] = useState<string[]>(() => {
    const local = localStorage.getItem('tmf2_cart_package_ids');
    return local ? JSON.parse(local) : [];
  });

  useEffect(() => {
    localStorage.setItem('tmf2_yuran_packages', JSON.stringify(packages));
  }, [packages]);

  useEffect(() => {
    localStorage.setItem('tmf2_cart_package_ids', JSON.stringify(cartPackageIds));
  }, [cartPackageIds]);

  // States untuk Pop-up Penghargaan & Resit Sumbangan
  const [completedDonation, setCompletedDonation] = useState<DonationReceiptData | null>(null);
  const [showDonationSuccessModal, setShowDonationSuccessModal] = useState<boolean>(false);



  // Remove pending or paid package IDs from cart automatically
  useEffect(() => {
    const userEmail = currentUserDoc?.email || firebaseUser?.email || '';
    if (!userEmail) return;

    const userPendingTxns = transactions.filter(t => 
      t.memberEmail && 
      t.memberEmail.toLowerCase() === userEmail.toLowerCase() && 
      t.approvalStatus === 'Pending'
    );
    const pendingIds = userPendingTxns.flatMap(t => t.paidPackageIds || []);
    const paidIds = currentUserDoc?.paidPackageIds || [];

    const unavailableIds = new Set([...pendingIds, ...paidIds]);

    if (unavailableIds.size > 0) {
      setCartPackageIds(prev => {
        const filtered = prev.filter(id => !unavailableIds.has(id));
        return filtered.length !== prev.length ? filtered : prev;
      });
    }
  }, [transactions, currentUserDoc, firebaseUser]);

  // Real-time Firestore synchronization for all datasets
  useEffect(() => {
    // 1. Posts Sync (Public)
    let isInitialPosts = true;
    const unsubPosts = onSnapshot(collection(db, 'posts'), (snap) => {
      const list = snap.docs.map(d => d.data() as Post);
      list.sort((a, b) => b.id.localeCompare(a.id));
      setPosts(list);
      localStorage.setItem('tmf2_posts', JSON.stringify(list));

      if (!isInitialPosts) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newPost = change.doc.data() as Post;
            const myUid = firebaseUser?.uid || currentUserDoc?.uid;
            const myName = currentUserDoc?.nickname || currentUserDoc?.displayName || USER_AHMAD.name;
            const isMe = (newPost.authorUid && myUid && newPost.authorUid === myUid) || 
                         (newPost.authorName === myName);
            if (!isMe) {
              const preview = newPost.content 
                ? (newPost.content.length > 50 ? `${newPost.content.slice(0, 50)}...` : newPost.content) 
                : 'berkongsi foto baharu';
              addNotification(`💬 ${newPost.authorName}: "${preview}" di Chat Komuniti.`, 'chat', newPost.id);
            }
          }
        });
      }
      isInitialPosts = false;
    }, (error) => {
      console.error("Ralat akses posts:", error);
    });

    // 2. Fees Sync (Private - requires isSignedIn)
    let unsubFees = () => {};
    if (firebaseUser && firebaseUser.uid !== 'guest_local') {
      unsubFees = onSnapshot(collection(db, 'fees'), (snap) => {
        const list = snap.docs.map(d => d.data() as FeeItem);
        setFees(list);
        localStorage.setItem('tmf2_fees', JSON.stringify(list));
      }, (error) => {
        console.error("Ralat akses fees:", error);
      });
    }

    // 3. Blogs Sync (Public)
    let isInitialBlogs = true;
    const unsubBlogs = onSnapshot(collection(db, 'blogs'), (snap) => {
      const list = snap.docs.map(d => d.data() as BlogItem);
      list.sort((a, b) => parseDateToMs(b.date) - parseDateToMs(a.date));
      setBlogs(list);
      localStorage.setItem('tmf2_blog_posts', JSON.stringify(list));
      
      if (!isInitialBlogs) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newBlog = change.doc.data() as BlogItem;
            addNotification(`✍️ Artikel Blog: "${newBlog.title}" telah diterbitkan di portal komuniti.`, 'blog', newBlog.id);
          }
        });
      }
      isInitialBlogs = false;
    }, (error) => {
      console.error("Ralat akses blogs:", error);
    });

    // 4. Program Reports Sync (Public)
    const unsubReports = onSnapshot(collection(db, 'programReports'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }));
      list.sort((a: any, b: any) => parseDateToMs(b.startDate || b.tarikhProgram || b.createdAt) - parseDateToMs(a.startDate || a.tarikhProgram || a.createdAt));
      setProgramReports(list);
      localStorage.setItem('tmf2_program_reports', JSON.stringify(list));
    }, (error) => {
      console.error("Ralat akses programReports:", error);
    });

    // 5. Events Sync (Public)
    const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id } as UpcomingEvent));
      list.sort((a, b) => parseDateToMs(b.rawDate || b.date) - parseDateToMs(a.rawDate || a.date));
      setEvents(list);
      localStorage.setItem('tmf2_events', JSON.stringify(list));
    }, (error) => {
      console.error("Ralat akses events:", error);
    });

    // 6. Announcements Sync (Public)
    let isInitialAnnouncements = true;
    const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id } as Announcement));
      list.sort((a, b) => parseDateToMs(b.date) - parseDateToMs(a.date));
      setAnnouncements(list);
      localStorage.setItem('tmf2_announcements', JSON.stringify(list));

      if (!isInitialAnnouncements) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newAnn = change.doc.data() as Announcement;
            addNotification(`📣 Pengumuman Terkini: "${newAnn.title}" (${newAnn.category}) telah diterbitkan.`, 'announcement', newAnn.id);
          }
        });
      }
      isInitialAnnouncements = false;
    }, (error) => {
      console.error("Ralat akses announcements:", error);
    });

    // 7. Kewangan Transactions Sync
    const unsubTransactions = onSnapshot(collection(db, 'kewanganTransactions'), (snap) => {
      const list = snap.docs.map(d => d.data() as KewanganTransaction);
      list.sort((a, b) => b.id.localeCompare(a.id));
      setTransactions(list);
      localStorage.setItem('tmf2_kewangan_transactions', JSON.stringify(list));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tmf2_transactions_updated'));
      }
    }, (error) => {
      console.error("Ralat akses kewanganTransactions:", error);
    });

    // 8. Yuran Config Sync (Public - always keep in sync with Firestore)
    const unsubYuranConfig = onSnapshot(doc(db, 'system', 'yuranConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as YuranConfig;
        setYuranConfig(data);
        localStorage.setItem('tmf2_yuran_config', JSON.stringify(data));
      }
    }, (error) => {
      console.error("Ralat akses yuranConfig:", error);
    });

    // 9. Cases Sync (Public)
    let isInitialCases = true;
    const unsubCases = onSnapshot(collection(db, 'cases'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CaseRecord));
      list.sort((a, b) => parseDateToMs(b.createdAt || b.tarikhKes) - parseDateToMs(a.createdAt || a.tarikhKes));
      setCases(list);
      localStorage.setItem('tmf2_cases', JSON.stringify(list));

      if (!isInitialCases) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newCase = { id: change.doc.id, ...change.doc.data() } as CaseRecord;
            addNotification(`📢 Penambahan Kes Dilaporkan (${newCase.jenisKes || 'Aduan Baru'})`, 'general', newCase.id);
          }
        });
      }
      isInitialCases = false;
    }, (error) => {
      console.error("Ralat akses cases:", error);
    });

    return () => {
      unsubPosts();
      unsubFees();
      unsubBlogs();
      unsubReports();
      unsubEvents();
      unsubAnnouncements();
      unsubTransactions();
      unsubYuranConfig();
      unsubCases();
    };
  }, [firebaseUser]);

  useEffect(() => {
    const handleCaseAdded = (e: any) => {
      const newCase = e.detail as CaseRecord;
      if (newCase) {
        addNotification(`📢 Penambahan Kes Dilaporkan (${newCase.jenisKes || 'Aduan Baru'})`, 'general', newCase.id);
        setCases(prev => {
          if (prev.some(c => c.id === newCase.id)) return prev;
          const updated = [newCase, ...prev];
          localStorage.setItem('tmf2_cases', JSON.stringify(updated));
          return updated;
        });
      }
    };
    window.addEventListener('tmf2_case_added', handleCaseAdded);
    return () => window.removeEventListener('tmf2_case_added', handleCaseAdded);
  }, []);

  // Background migration for legacy Base64 images to Firebase Storage
  useEffect(() => {
    if (!firebaseUser || firebaseUser.uid === 'guest_local') return;

    const performMigration = async () => {
      if (globalMigrationFailedCount >= MAX_MIGRATION_FAILURES) {
        console.warn("[Migration] Background migration is paused for this session to avoid spamming Firebase Storage due to previous errors.");
        return;
      }

      // 1. Migrate Current User Profile
      if (currentUserDoc) {
        const profileUrl = currentUserDoc.uploadedProfileImageUrl || currentUserDoc.photoURL;
        const coverUrl = currentUserDoc.uploadedCoverImageUrl || currentUserDoc.coverURL;
        const updatedFields: Record<string, any> = {};

        if (profileUrl && profileUrl.startsWith('data:image/')) {
          const localKey = `migrated_user_avatar_${firebaseUser.uid}`;
          if (!localStorage.getItem(localKey)) {
            try {
              console.log("[Migration] Migrating user avatar to Firebase Storage...");
              const cleanUrl = await uploadBase64ToStorage(profileUrl, `users/${firebaseUser.uid}/avatar_${Date.now()}`);
              updatedFields.uploadedProfileImageUrl = cleanUrl;
              updatedFields.photoURL = cleanUrl;
              localStorage.setItem(localKey, 'true');
            } catch (e) {
              console.warn("[Migration] Warning migrating avatar (will fallback and keep Base64):", e);
              localStorage.setItem(localKey, 'failed');
              globalMigrationFailedCount++;
              if (globalMigrationFailedCount >= MAX_MIGRATION_FAILURES) return;
            }
          }
        }

        if (coverUrl && coverUrl.startsWith('data:image/')) {
          const localKey = `migrated_user_cover_${firebaseUser.uid}`;
          if (!localStorage.getItem(localKey)) {
            try {
              console.log("[Migration] Migrating user cover to Firebase Storage...");
              const cleanUrl = await uploadBase64ToStorage(coverUrl, `users/${firebaseUser.uid}/cover_${Date.now()}`);
              updatedFields.uploadedCoverImageUrl = cleanUrl;
              updatedFields.coverURL = cleanUrl;
              localStorage.setItem(localKey, 'true');
            } catch (e) {
              console.warn("[Migration] Warning migrating cover (will fallback and keep Base64):", e);
              localStorage.setItem(localKey, 'failed');
              globalMigrationFailedCount++;
              if (globalMigrationFailedCount >= MAX_MIGRATION_FAILURES) return;
            }
          }
        }

        if (Object.keys(updatedFields).length > 0) {
          try {
            await updateDoc(doc(db, 'users', firebaseUser.uid), updatedFields);
            console.log("[Migration] User profile successfully migrated to Firebase Storage.");
          } catch (e) {
            console.warn("[Migration] Failed to update user profile doc after migration:", e);
          }
        }
      }

      // 2. Migrate Posts
      const postsToMigrate = posts.filter(p => p.image && p.image.startsWith('data:image/'));
      for (const post of postsToMigrate) {
        const localKey = `migrated_post_${post.id}`;
        if (localStorage.getItem(localKey)) continue;

        try {
          console.log(`[Migration] Migrating post ${post.id} image to Firebase Storage...`);
          const storageUrl = await uploadBase64ToStorage(post.image!, `chats/post_${post.id}_${Date.now()}`);
          await updateDoc(doc(db, 'posts', post.id), { image: storageUrl });
          localStorage.setItem(localKey, 'true');
          console.log(`[Migration] Post ${post.id} successfully migrated.`);
        } catch (e) {
          console.warn(`[Migration] Warning migrating post ${post.id} (will fallback and keep Base64):`, e);
          localStorage.setItem(localKey, 'failed');
          globalMigrationFailedCount++;
          if (globalMigrationFailedCount >= MAX_MIGRATION_FAILURES) return;
        }
      }

      // 3. Migrate Program Reports
      const reportsToMigrate = programReports.filter((r: any) => r.images && r.images.some((img: string) => img && img.startsWith('data:image/')));
      for (const report of reportsToMigrate) {
        const localKey = `migrated_report_${report.id}`;
        if (localStorage.getItem(localKey)) continue;

        try {
          console.log(`[Migration] Migrating report ${report.id} images to Firebase Storage...`);
          const updatedImages = await Promise.all(
            report.images.map(async (img: string, idx: number) => {
              if (img && img.startsWith('data:image/')) {
                return await uploadBase64ToStorage(img, `reports/report_${report.id}_${idx}_${Date.now()}`);
              }
              return img;
            })
          );
          await updateDoc(doc(db, 'programReports', report.id), { images: updatedImages });
          localStorage.setItem(localKey, 'true');
          console.log(`[Migration] Report ${report.id} successfully migrated.`);
        } catch (e) {
          console.warn(`[Migration] Warning migrating report ${report.id} (will fallback and keep Base64):`, e);
          localStorage.setItem(localKey, 'failed');
          globalMigrationFailedCount++;
          if (globalMigrationFailedCount >= MAX_MIGRATION_FAILURES) return;
        }
      }
    };

    // Run migration check slightly delayed to not block initial render path
    const timer = setTimeout(() => {
      performMigration();
    }, 5000);

    return () => clearTimeout(timer);
  }, [firebaseUser, currentUserDoc, posts, programReports]);

  const handleAddEvent = async (newEvt: UpcomingEvent) => {
    await setDoc(doc(db, 'events', newEvt.id), newEvt);
  };

  const handleUpdateEvent = async (updatedEvt: UpcomingEvent) => {
    await setDoc(doc(db, 'events', updatedEvt.id), updatedEvt);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteDoc(doc(db, 'events', id));
  };

  const handleMoveEvent = async (id: string) => {
    await updateDoc(doc(db, 'events', id), { status: 'rasmi' });
  };

  const handleAddAnnouncement = async (newAnn: Announcement) => {
    await setDoc(doc(db, 'announcements', newAnn.id), newAnn);
    
    // Menghantar push notification kepada semua ahli berdaftar
    try {
      const title = `📣 Pengumuman Baharu SMAUJ`;
      const body = `"${newAnn.title}" (${newAnn.category}) telah diterbitkan.`;
      console.log('[App] Menghantar push notification untuk pengumuman baharu:', newAnn.title);
      await sendPushNotificationToAll(allUsers, title, body, newAnn.id);
    } catch (e) {
      console.error('[App] Ralat menghantar push notification untuk pengumuman baharu:', e);
    }
  };

  const handleUpdateAnnouncement = async (updatedAnn: Announcement) => {
    await setDoc(doc(db, 'announcements', updatedAnn.id), updatedAnn);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await deleteDoc(doc(db, 'announcements', id));
  };

  // Views routers with initial state from current URL path
  const [desktopView, setDesktopView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const route = getRouteFromPath(window.location.pathname);
      if (route) return route.desktop;
    }
    return 'dashboard';
  });

  const [mobileTab, setMobileTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const route = getRouteFromPath(window.location.pathname);
      if (route) return route.mobile;
    }
    return 'utama';
  });

  const updateViewAndTab = (view: string, tab: string) => {
    setDesktopView(view);
    setMobileTab(tab);
    if (typeof window !== 'undefined') {
      const targetPath = getPathFromView(view);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, '', targetPath);
      }
    }
  };

  const handleSetCurrentView = (view: string) => {
    let targetView = view;

    let tab = 'utama';
    if (targetView === 'dashboard') tab = 'utama';
    else if (targetView === 'chat') tab = 'chat';
    else if (targetView === 'yuran') tab = 'yuran';
    else if (targetView === 'profile') tab = 'profil';
    else if (targetView === 'blog') tab = 'blog';
    else if (targetView === 'laporan') tab = 'laporan';
    else if (targetView === 'takwim') tab = 'takwim';
    else if (targetView === 'pengumuman') tab = 'pengumuman';
    else if (targetView === 'lain-lain') tab = 'lain_lain_view';
    else if (targetView === 'pengeluaran') tab = 'pengeluaran';
    else if (targetView === 'daftar-ahli') tab = 'daftar-ahli';
    else if (targetView === 'ahli') tab = 'ahli';
    else if (targetView === 'kelulusan-ahli') tab = 'kelulusan-ahli';
    else if (targetView === 'kehadiran') tab = 'kehadiran';
    else if (targetView === 'kertas-kerja') tab = 'kertas-kerja';
    else if (targetView === 'perbelanjaan-program') tab = 'perbelanjaan-program';
    else if (targetView === 'baucar') tab = 'baucar';
    else if (targetView === 'minit-mesyuarat') tab = 'minit-mesyuarat';
    else if (targetView === 'surat') tab = 'surat';
    else if (targetView === 'admin') tab = 'admin';
    else if (targetView === 'kewangan') tab = 'kewangan';
    else if (targetView === 'dokumen') tab = 'dokumen';
    else if (targetView === 'notis-panggilan') tab = 'notis-panggilan';
    else if (targetView === 'sumbangan') tab = 'sumbangan';
    else if (targetView === 'qurban_register') tab = 'qurban_register';
    else if (targetView === 'urus_qurban') tab = 'urus_qurban';
    updateViewAndTab(targetView, tab);
  };

  const handleSetCurrentTab = (tab: string) => {
    let targetTab = tab;

    let view = 'dashboard';
    if (targetTab === 'utama') view = 'dashboard';
    else if (targetTab === 'chat') view = 'chat';
    else if (targetTab === 'yuran') view = 'yuran';
    else if (targetTab === 'sumbangan') view = 'sumbangan';
    else if (targetTab === 'profil') view = 'profile';
    else if (targetTab === 'blog') view = 'blog';
    else if (targetTab === 'laporan') view = 'laporan';
    else if (targetTab === 'takwim') view = 'takwim';
    else if (targetTab === 'pengumuman') view = 'pengumuman';
    else if (targetTab === 'lain_lain_view') view = 'lain-lain';
    else if (targetTab === 'pengeluaran') view = 'pengeluaran';
    else if (targetTab === 'daftar-ahli') view = 'daftar-ahli';
    else if (targetTab === 'ahli') view = 'ahli';
    else if (targetTab === 'kelulusan-ahli') view = 'kelulusan-ahli';
    else if (targetTab === 'kehadiran') view = 'kehadiran';
    else if (targetTab === 'kertas-kerja') view = 'kertas-kerja';
    else if (targetTab === 'perbelanjaan-program') view = 'perbelanjaan-program';
    else if (targetTab === 'baucar') view = 'baucar';
    else if (targetTab === 'minit-mesyuarat') view = 'minit-mesyuarat';
    else if (targetTab === 'surat') view = 'surat';
    else if (targetTab === 'admin') view = 'admin';
    else if (targetTab === 'kewangan') view = 'kewangan';
    else if (targetTab === 'dokumen') view = 'dokumen';
    else if (targetTab === 'notis-panggilan') view = 'notis-panggilan';
    else if (targetTab === 'qurban_register') view = 'qurban_register';
    else if (targetTab === 'urus_qurban') view = 'urus_qurban';
    updateViewAndTab(view, targetTab);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set initial history state on load
      const userRole = currentUserDoc?.role || USER_AHMAD.role;
      const route = getRouteFromPath(window.location.pathname, userRole);
      const initialView = route ? route.desktop : 'dashboard';
      const initialPath = getPathFromView(initialView);
      window.history.replaceState({ view: initialView }, '', initialPath);
      if (route) {
        setDesktopView(route.desktop);
        setMobileTab(route.mobile);
      }
    }
  }, [currentUserDoc]);

  useEffect(() => {
    const handleSwitchView = (e: any) => {
      const view = e.detail;
      handleSetCurrentView(view);
    };
    
    const handleViewProfile = (e: any) => {
      let member = e ? e.detail : null;
      if (member) {
        const myUid = currentUserDoc?.uid || firebaseUser?.uid;
        const myEmail = (currentUserDoc?.email || firebaseUser?.email || '').toLowerCase().trim();
        const memberUid = member.uid;
        const memberEmail = (member.email || '').toLowerCase().trim();

        const isSelf = Boolean(
          (myUid && memberUid && memberUid === myUid) ||
          (myEmail && memberEmail && memberEmail === myEmail)
        );

        if (isSelf) {
          member = null;
        } else {
          member = {
            uid: member.uid || undefined,
            name: member.name || member.displayName || member.nickname || 'Pengguna',
            displayName: member.displayName || member.name || '',
            nickname: member.nickname || '',
            avatar: member.uploadedProfileImageUrl || member.photoURL || member.avatar || member.googleProfileImageUrl || 'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc',
            role: member.role || 'Pelawat',
            isOnline: true,
            bio: member.bio || undefined,
            cover: member.uploadedCoverImageUrl || member.coverURL || member.cover || undefined,
            address: member.address || undefined,
            phone: member.phoneNumber || member.phone || undefined,
            email: member.email || undefined,
            icNumber: member.icNumber || undefined,
            noRumah: member.noRumah || undefined,
            statusKediaman: member.statusKediaman || undefined,
            memberNo: member.memberNo || undefined,
          };
        }
      }
      setViewedMember(member);
      handleSetCurrentView('profile');
    };

    const handlePopState = (e: PopStateEvent) => {
      const userRole = currentUserDoc?.role || USER_AHMAD.role;
      const route = getRouteFromPath(window.location.pathname, userRole);
      if (route) {
        setDesktopView(route.desktop);
        setMobileTab(route.mobile);
      }
    };

    window.addEventListener('tmf2_switch_view', handleSwitchView);
    window.addEventListener('tmf2_view_profile', handleViewProfile);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('tmf2_switch_view', handleSwitchView);
      window.removeEventListener('tmf2_view_profile', handleViewProfile);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Common Action Handlers
  const handleAddPost = async (content: string, image?: string, scope?: 'Awam' | 'Ahli Jawatankuasa') => {
    const postId = `post-${Date.now()}`;
    let finalImageUrl = image;

    if (image && image.startsWith('data:')) {
      try {
        const storageRef = ref(storage, `posts/${postId}_${Date.now()}`);
        await uploadString(storageRef, image, 'data_url');
        finalImageUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Gagal muat naik imej post ke Firebase Storage (fallback kepada base64):", storageErr);
      }
    }

    const authorName = currentUserDoc?.nickname || currentUserDoc?.displayName || firebaseUser?.displayName || USER_AHMAD.name;
    const authorAvatar = currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || currentUserDoc?.googleProfileImageUrl || firebaseUser?.photoURL || USER_AHMAD.avatar;
    const authorRole = currentUserDoc?.role || USER_AHMAD.role || "Pelawat";

    const postData: any = {
      id: postId,
      authorName,
      authorAvatar,
      authorUid: firebaseUser?.uid || currentUserDoc?.uid || 'guest_local',
      authorRole,
      content,
      scope: scope || 'Awam',
      timestamp: new Date().toLocaleString('ms-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      likes: [],
      comments: []
    };

    if (finalImageUrl !== undefined) {
      postData.image = finalImageUrl;
    }

    await setDoc(doc(db, 'posts', postId), postData);

    // Hantar notifikasi tolak (push notification) kepada pengguna/penduduk
    try {
      console.log('[App] Menghantar push notification untuk post baharu di Chat Komuniti...');
      notifyOnChatPost({
        authorName,
        content,
        scope: scope || 'Awam',
        hasImage: !!finalImageUrl,
        postId
      }).catch(err => {
        console.warn('[App] Ralat push notification chat (non-critical):', err);
      });
    } catch (e) {
      console.warn('[App] Gagal memanggil notifyOnChatPost:', e);
    }
  };

  const handleLikePost = async (postId: string) => {
    const postToLike = posts.find(p => p.id === postId);
    if (!postToLike) return;
    const userIdentifier = currentUserDoc?.nickname || currentUserDoc?.displayName || USER_AHMAD.name;
    const hasLiked = postToLike.likes.includes(userIdentifier) || postToLike.likes.includes(USER_AHMAD.name) || (firebaseUser?.uid && postToLike.likes.includes(firebaseUser.uid));
    const updatedLikes = hasLiked
      ? postToLike.likes.filter(name => name !== userIdentifier && name !== USER_AHMAD.name && name !== firebaseUser?.uid)
      : [...postToLike.likes, userIdentifier];
    await updateDoc(doc(db, 'posts', postId), { likes: updatedLikes });
  };

  const handleAddComment = async (postId: string, commentContent: string) => {
    const postToComment = posts.find(p => p.id === postId);
    if (!postToComment) return;
    const authorName = currentUserDoc?.nickname || currentUserDoc?.displayName || firebaseUser?.displayName || USER_AHMAD.name;
    const authorAvatar = currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || currentUserDoc?.googleProfileImageUrl || firebaseUser?.photoURL || USER_AHMAD.avatar;

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      authorName,
      authorAvatar,
      authorUid: firebaseUser?.uid || currentUserDoc?.uid || 'guest_local',
      content: commentContent,
      timestamp: new Date().toLocaleString('ms-MY', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    await updateDoc(doc(db, 'posts', postId), {
      comments: [...postToComment.comments, newComment]
    });
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      console.error("Ralat padam hantaran:", err);
      alert("Anda tiada kebenaran untuk memadam hantaran ini.");
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      const postToUpdate = posts.find(p => p.id === postId);
      if (!postToUpdate) return;
      const updatedComments = postToUpdate.comments.filter(c => c.id !== commentId);
      await updateDoc(doc(db, 'posts', postId), {
        comments: updatedComments
      });
    } catch (err) {
      console.error("Ralat padam komen:", err);
      alert("Gagal memadam komen.");
    }
  };

  const handlePayFees = async (
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
      aiConfidence?: 'Passed' | 'Failed' | 'Uncertain';
      aiNotes?: string;
    }
  ) => {
    const isManual = options?.isManual || false;
    const approvalStatus: 'Pending' | 'Approved' = options?.approvalStatus ? options.approvalStatus : (isManual ? 'Pending' : 'Approved');
    const isPending = approvalStatus === 'Pending';
    const receiptAttachment = options?.receiptAttachment;
    const manualNotes = options?.notes;
    const aiVerified = options?.aiVerified;
    const aiDetectedAmount = options?.aiDetectedAmount;
    const aiConfidence = options?.aiConfidence;
    const aiNotes = options?.aiNotes;

    // 1. Update individual fee items paid status in Firestore (only if approved/FPX)
    if (!isPending) {
      for (const id of feeIds) {
        await updateDoc(doc(db, 'fees', id), {
          isPaid: true,
          datePaid: new Date().toLocaleDateString('ms-MY', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        }).catch((err) => console.error("Error updating fee in Firestore:", err));
      }
    }

    const actualPaid = paidPackages && paidPackages.length > 0
      ? paidPackages
      : packages.filter(p => cartPackageIds.includes(p.id));

    // 1.5 Update paidPackageIds for the user in Firestore (only if approved/FPX)
    if (!isPending && firebaseUser && actualPaid.length > 0) {
      const newPaidIds: string[] = [];
      const email = currentUserDoc?.email || firebaseUser.email || '';
      
      actualPaid.forEach(p => {
        if (p.isCustomAmount) {
          const prevPaid = transactions
            .filter(t => t.memberEmail === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(p.id))
            .reduce((sum, t) => sum + (t.amount || 0), 0);
          
          const currentPayAmt = p.customCartAmount ?? p.price;
          if (prevPaid + currentPayAmt >= p.price) {
            newPaidIds.push(p.id);
          }
        } else {
          newPaidIds.push(p.id);
        }
      });

      if (newPaidIds.length > 0) {
        const currentPaidIds = currentUserDoc?.paidPackageIds || [];
        const updatedPaidIds = Array.from(new Set([...currentPaidIds, ...newPaidIds]));
        
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          paidPackageIds: updatedPaidIds
        }).catch(err => console.error("Error updating paid packages:", err));
      }
    }

    // 2. Generate Kewangan transaction for this payment

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // "2026-06-27"
    const timeStr = now.toTimeString().slice(0, 5);  // "18:25"

    const newTxnsList: KewanganTransaction[] = [];
    const payerName = currentUserDoc?.displayName || currentUserDoc?.nickname || 'Ahli';
    const payerEmail = currentUserDoc?.email || firebaseUser?.email || "";

    const recordedByStr = isManual ? `${payerName} (Ahli - Bayaran Manual)` : `${payerName} (Ahli - Pembayaran FPX)`;
    const methodTag = isManual ? `Bayaran Manual` : `FPX: ${bankName}`;

    let latestDonationForModal: DonationReceiptData | null = null;

    if (actualPaid.length > 0) {
      actualPaid.forEach((p, idx) => {
        const isDonation = Boolean((p as any).isDonation || p.id.startsWith('donation-'));
        const isKeahlian = !isDonation && p.category === 'Keahlian';
        
        if (isDonation) {
          const donationAmt = p.price;
          const fundCategory = (p as any).donationLedgerCategory || p.realCategory || 'Tabung Sumbangan Am';
          const fundName = (p as any).donationFundName || p.name;
          const donorName = (p as any).donorName || payerName;
          const donorEmail = (p as any).donorEmail || payerEmail;
          const donorPhone = (p as any).donorPhone || currentUserDoc?.phoneNumber || '';
          const donorHouseNo = (p as any).donorHouseNo || currentUserDoc?.noRumah || '';
          const donationNotes = (p as any).donationNotes || '';

          const nextIdNum = transactions.length + newTxnsList.length + 1;
          const receiptNo = `RST-SMB-2026-${String(nextIdNum).padStart(4, '0')}`;
          const nextTxnId = `TXN-2026-${String(nextIdNum).padStart(4, '0')}`;
          const nextVchId = `VCH-2026-${String(nextIdNum).padStart(4, '0')}`;

          const donationTxn: KewanganTransaction = {
            id: nextTxnId,
            voucherNo: nextVchId,
            date: dateStr,
            time: timeStr,
            accountDebit: "Bank",
            accountCredit: fundCategory,
            amount: donationAmt,
            description: `Sumbangan ${fundName} oleh ${donorName}${donorHouseNo ? ` (${donorHouseNo})` : ''} [${receiptNo}]`,
            category: fundCategory,
            recordedBy: isManual ? `${donorName} (Penderma - Bayaran Manual)` : `${donorName} (Penderma - FPX)`,
            approvalStatus: approvalStatus,
            approvedDate: isPending ? undefined : dateStr,
            approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
            receiptAttachment: receiptAttachment,
            notes: donationNotes ? `Hajat/Catatan: ${donationNotes}` : (manualNotes || `Sumbangan ikhlas bagi ${fundCategory}.`),
            memberEmail: donorEmail,
            paidPackageIds: [p.id],
            aiVerified: aiVerified,
            aiDetectedAmount: aiDetectedAmount,
            aiConfidence: aiConfidence,
            aiNotes: aiNotes,
            auditTrail: [
              {
                time: `${dateStr} ${timeStr}`,
                user: isManual ? donorName : "Sistem FPX",
                action: isPending ? `Merekod sumbangan manual ${fundCategory} (Menunggu Pengesahan)` : `Merekod sumbangan automatik ${fundCategory} (Lulus)`
              }
            ]
          };
          newTxnsList.push(donationTxn);

          latestDonationForModal = {
            receiptNo,
            transactionId: nextTxnId,
            date: dateStr,
            time: timeStr,
            donorName,
            donorEmail,
            donorPhone,
            donorHouseNo,
            fundType: fundName,
            amount: donationAmt,
            paymentMethod: isManual ? 'Bayaran Manual (Resit Bukti)' : `FPX Online Transfer`,
            bankName: isManual ? undefined : bankName,
            notes: donationNotes
          };

          if (donorEmail) {
            fetch('/api/send-donation-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                receiptNo,
                donorName,
                donorEmail,
                donorPhone,
                donorHouseNo,
                fundType: fundName,
                amount: donationAmt,
                paymentMethod: isManual ? 'Bayaran Manual (Resit Bukti)' : `FPX Online Transfer`,
                bankName: isManual ? undefined : bankName,
                notes: donationNotes,
                date: dateStr,
                time: timeStr
              })
            }).catch(err => console.warn('Ralat penghantaran emel resit sumbangan:', err));
          }
        } else if (isKeahlian) {
          const nextIdNum = transactions.length + newTxnsList.length + 1;
          const nextTxnId = `TXN-2026-${String(nextIdNum).padStart(4, '0')}`;
          const nextVchId = `VCH-2026-${String(nextIdNum).padStart(4, '0')}`;

          const newTxn: KewanganTransaction = {
            id: nextTxnId,
            voucherNo: nextVchId,
            date: dateStr,
            time: timeStr,
            accountDebit: p.account || "Bank",
            accountCredit: "Yuran Keahlian",
            amount: p.price,
            description: `Bayaran Yuran Keahlian (${p.name}) oleh ${payerName} (${methodTag})`,
            category: "Yuran Keahlian",
            recordedBy: recordedByStr,
            approvalStatus: approvalStatus,
            approvedDate: isPending ? undefined : dateStr,
            approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
            receiptAttachment: receiptAttachment,
            notes: manualNotes || (isPending ? `Bayaran manual resit bukti bayaran. Menunggu pengesahan Pentadbir / Bendahari.` : `Pembayaran automatik bagi ${p.name} melalui portal keahlian.`),
            memberEmail: payerEmail,
            paidPackageIds: [p.id],
            aiVerified: aiVerified,
            aiDetectedAmount: aiDetectedAmount,
            aiConfidence: aiConfidence,
            aiNotes: aiNotes,
            auditTrail: [
              { 
                time: `${dateStr} ${timeStr}`, 
                user: isManual ? payerName : "Sistem FPX", 
                action: isPending ? `Merekod transaksi bayaran manual Yuran Keahlian (Menunggu Pengesahan)` : `Merekod transaksi automatik Yuran Keahlian (Lulus)` 
              }
            ]
          };
          newTxnsList.push(newTxn);
        } else {
          // It's a Yuran Bulanan/Penggal/Tahunan or Tambahan package
          let yuranAmount = 0;
          let khairatAmount = 0;

          const isTambahan = p.category === 'Tambahan';
          const isTahunan = !isTambahan && (p.category === 'Tahunan' || p.name.includes('PerTahun') || p.name.includes('Tahunan') || p.name.includes('12 Bulan'));
          const isPenggal = !isTambahan && (p.category === 'Penggal' || p.name.includes('Perpenggal') || p.name.includes('Penggal') || p.name.includes('6 Bulan'));
          const isBulanan = !isTambahan && (p.category === 'Bulanan' || p.name.includes('Bulanan'));

          if (isTambahan) {
            yuranAmount = getPackagePrice(p);
          } else if (isTahunan) {
            khairatAmount = yuranConfig?.yuranTahunan?.khairat ?? 60;
            yuranAmount = Math.max(0, p.price - khairatAmount);
          } else if (isPenggal) {
            khairatAmount = yuranConfig?.yuranPenggal?.khairat ?? 30;
            yuranAmount = Math.max(0, p.price - khairatAmount);
          } else if (isBulanan) {
            khairatAmount = yuranConfig?.yuranBulanan?.khairat ?? 5;
            yuranAmount = Math.max(0, p.price - khairatAmount);
          } else {
            if (p.breakdown) {
              yuranAmount = parseFloat(p.breakdown.usersAmount.replace(/[^0-9.]/g, '')) || 0;
              khairatAmount = parseFloat(p.breakdown.heartAmount.replace(/[^0-9.]/g, '')) || 0;
            } else {
              yuranAmount = p.price;
            }
          }

          if (yuranAmount > 0) {
            const nextIdNum1 = transactions.length + newTxnsList.length + 1;
            const creditAcc = isTambahan ? (p.realCategory || "Yuran Tambahan") : "Yuran Bulanan";
            const sessionTag = p.sessionYear ? ` - Sesi ${p.sessionYear}` : '';
            newTxnsList.push({
              id: `TXN-2026-${String(nextIdNum1).padStart(4, '0')}`,
              voucherNo: `VCH-2026-${String(nextIdNum1).padStart(4, '0')}`,
              date: dateStr,
              time: timeStr,
              accountDebit: p.account || "Bank",
              accountCredit: creditAcc,
              amount: yuranAmount,
              description: `Bayaran ${creditAcc} (${p.name}${sessionTag}) oleh ${payerName} (${methodTag})`,
              category: creditAcc,
              recordedBy: recordedByStr,
              approvalStatus: approvalStatus,
              approvedDate: isPending ? undefined : dateStr,
              approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
              receiptAttachment: receiptAttachment,
              notes: manualNotes || (isPending ? `Bayaran manual resit bukti bayaran. Menunggu pengesahan Pentadbir / Bendahari.` : `Pembayaran automatik bagi ${p.name} melalui portal keahlian.`),
              memberEmail: payerEmail,
              paidPackageIds: [p.id],
              sessionYear: p.sessionYear,
              aiVerified: aiVerified,
              aiDetectedAmount: aiDetectedAmount,
              aiConfidence: aiConfidence,
              aiNotes: aiNotes,
              auditTrail: [
                { 
                  time: `${dateStr} ${timeStr}`, 
                  user: isManual ? payerName : "Sistem FPX", 
                  action: isPending ? `Merekod transaksi bayaran manual ${creditAcc} (Menunggu Pengesahan)` : `Merekod transaksi automatik ${creditAcc} (Lulus)` 
                }
              ]
            });
          }
          if (khairatAmount > 0) {
            const nextIdNum2 = transactions.length + newTxnsList.length + 1;
            const sessionTagKhairat = p.sessionYear ? ` - Sesi ${p.sessionYear}` : '';
            newTxnsList.push({
              id: `TXN-2026-${String(nextIdNum2).padStart(4, '0')}`,
              voucherNo: `VCH-2026-${String(nextIdNum2).padStart(4, '0')}`,
              date: dateStr,
              time: timeStr,
              accountDebit: p.account || "Bank",
              accountCredit: "Khairat Kematian",
              amount: khairatAmount,
              description: `Bayaran Khairat Kematian (${p.name}${sessionTagKhairat}) oleh ${payerName} (${methodTag})`,
              category: "Khairat Kematian",
              recordedBy: recordedByStr,
              approvalStatus: approvalStatus,
              approvedDate: isPending ? undefined : dateStr,
              approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
              receiptAttachment: receiptAttachment,
              notes: manualNotes || (isPending ? `Bayaran manual resit bukti bayaran. Menunggu pengesahan Pentadbir / Bendahari.` : `Pembayaran automatik bagi ${p.name} melalui portal keahlian.`),
              memberEmail: payerEmail,
              paidPackageIds: [p.id],
              sessionYear: p.sessionYear,
              aiVerified: aiVerified,
              aiDetectedAmount: aiDetectedAmount,
              aiConfidence: aiConfidence,
              aiNotes: aiNotes,
              auditTrail: [
                { 
                  time: `${dateStr} ${timeStr}`, 
                  user: isManual ? payerName : "Sistem FPX", 
                  action: isPending ? `Merekod transaksi bayaran manual Khairat Kematian (Menunggu Pengesahan)` : `Merekod transaksi automatik Khairat Kematian (Lulus)` 
                }
              ]
            });
          }
        }
      });
    } else {
      // Fallback if actualPaid is empty
      const nextIdNum = transactions.length + 1;
      const nextTxnId = `TXN-2026-${String(nextIdNum).padStart(4, '0')}`;
      const nextVchId = `VCH-2026-${String(nextIdNum).padStart(4, '0')}`;

      const newTxn: KewanganTransaction = {
        id: nextTxnId,
        voucherNo: nextVchId,
        date: dateStr,
        time: timeStr,
        accountDebit: "Bank",
        accountCredit: "Yuran Bulanan",
        amount: 50.00,
        description: `Bayaran Yuran Bulanan oleh ${payerName} (${methodTag})`,
        category: "Yuran Bulanan",
        recordedBy: recordedByStr,
        approvalStatus: approvalStatus,
        approvedDate: isPending ? undefined : dateStr,
        approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
        receiptAttachment: receiptAttachment,
        notes: manualNotes || (isPending ? `Bayaran manual resit bukti bayaran. Menunggu pengesahan Pentadbir / Bendahari.` : `Pembayaran automatik berikutan transaksi yuran FPX melalui portal keahlian.`),
        memberEmail: payerEmail,
        paidPackageIds: [],
        sessionYear: "2026",
        aiVerified: aiVerified,
        aiDetectedAmount: aiDetectedAmount,
        aiConfidence: aiConfidence,
        aiNotes: aiNotes,
        auditTrail: [
          { 
            time: `${dateStr} ${timeStr}`, 
            user: isManual ? payerName : "Sistem FPX", 
            action: isPending ? `Merekod transaksi bayaran manual (Menunggu Pengesahan)` : `Merekod transaksi automatik (Lulus)` 
          }
        ]
      };
      newTxnsList.push(newTxn);
    }

    // Record FPX Fee in General Ledger (Lejar Umum) - ONLY for FPX / non-manual payments
    if (!isManual && actualPaid.length > 0) {
      const fpxFeeAmt = yuranConfig.fpxCharge ?? 1.00;
      
      const hasOtherTambahan = actualPaid.some(p => p.category === 'Tambahan');
      const isSurchargeMode = hasOtherTambahan ? true : (yuranConfig.fpxSurchargeMode ?? true);
      
      if (isSurchargeMode) {
        // --- SURCHARGE MODE ---
        // 1. Record the collection of FPX Surcharge from payer (Income)
        const nextIdNumFPXIn = transactions.length + newTxnsList.length + 1;
        newTxnsList.push({
          id: `TXN-2026-${String(nextIdNumFPXIn).padStart(4, '0')}`,
          voucherNo: `VCH-2026-${String(nextIdNumFPXIn).padStart(4, '0')}`,
          date: dateStr,
          time: timeStr,
          accountDebit: "Bank",
          accountCredit: "Caj Perkhidmatan",
          amount: fpxFeeAmt,
          description: `Kutipan Caj Perkhidmatan FPX (Surcharge) - ${payerName}`,
          category: "Caj Perkhidmatan",
          recordedBy: `Sistem FPX (${bankName})`,
          approvalStatus: approvalStatus,
          approvedDate: isPending ? undefined : dateStr,
          approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
          notes: `Kutipan caj tambahan FPX dibayar oleh pembayar ${payerName} bagi transaksi yuran.`,
          memberEmail: payerEmail,
          paidPackageIds: actualPaid.map(p => p.id),
          sessionYear: actualPaid[0]?.sessionYear || "2026",
          auditTrail: [
            { time: `${dateStr} ${timeStr}`, user: "Sistem FPX", action: isPending ? `Merekod kutipan caj perkhidmatan FPX (Menunggu Pengesahan)` : `Merekod kutipan caj perkhidmatan FPX (Surcharge)` }
          ]
        });

        // 2. Record the payment of FPX service charge to the provider (Expense)
        const nextIdNumFPXOut = transactions.length + newTxnsList.length + 1;
        newTxnsList.push({
          id: `TXN-2026-${String(nextIdNumFPXOut).padStart(4, '0')}`,
          voucherNo: `VCH-2026-${String(nextIdNumFPXOut).padStart(4, '0')}`,
          date: dateStr,
          time: timeStr,
          accountDebit: "Caj Perkhidmatan",
          accountCredit: "Bank",
          amount: fpxFeeAmt,
          description: `Caj Perkhidmatan FPX (Surcharge) - ${payerName}`,
          category: "Caj Perkhidmatan",
          recordedBy: `Sistem FPX (${bankName})`,
          approvalStatus: approvalStatus,
          approvedDate: isPending ? undefined : dateStr,
          approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
          notes: `Bayaran caj gerbang pembayaran FPX bagi transaksi yuran oleh ${payerName}.`,
          memberEmail: payerEmail,
          paidPackageIds: actualPaid.map(p => p.id),
          sessionYear: actualPaid[0]?.sessionYear || "2026",
          auditTrail: [
            { time: `${dateStr} ${timeStr}`, user: "Sistem FPX", action: isPending ? `Merekod caj gerbang pembayaran FPX (Menunggu Pengesahan)` : `Merekod caj gerbang pembayaran FPX` }
          ]
        });
      } else {
        // --- ABSORBED MODE ---
        // Record only the payment of FPX service charge (Expense) - since it is absorbed from the main yuran collection
        const nextIdNumFPX = transactions.length + newTxnsList.length + 1;
        newTxnsList.push({
          id: `TXN-2026-${String(nextIdNumFPX).padStart(4, '0')}`,
          voucherNo: `VCH-2026-${String(nextIdNumFPX).padStart(4, '0')}`,
          date: dateStr,
          time: timeStr,
          accountDebit: "Caj Perkhidmatan",
          accountCredit: "Bank",
          amount: fpxFeeAmt,
          description: `Caj Perkhidmatan FPX (Diserap dari Yuran) - ${payerName}`,
          category: "Caj Perkhidmatan",
          recordedBy: `Sistem FPX (${bankName})`,
          approvalStatus: approvalStatus,
          approvedDate: isPending ? undefined : dateStr,
          approvedBy: isPending ? undefined : `Sistem FPX (${bankName})`,
          notes: `Caj gerbang pembayaran FPX diserap bagi pembayaran yuran oleh ${payerName}.`,
          memberEmail: payerEmail,
          paidPackageIds: actualPaid.map(p => p.id),
          sessionYear: actualPaid[0]?.sessionYear || "2026",
          auditTrail: [
            { time: `${dateStr} ${timeStr}`, user: "Sistem FPX", action: `Merekod caj gerbang pembayaran FPX (Diserap)` }
          ]
        });
      }
    }

    // Write all new transactions to Firestore
    for (const txn of newTxnsList) {
      const cleanedTxn = cleanUndefined(txn);
      await setDoc(doc(db, 'kewanganTransactions', txn.id), cleanedTxn).catch((err) => console.error("Error setting txn in Firestore:", err));
    }

    // Jika transaksi mengandungi sumbangan, aktifkan modal pop-up terima kasih & muat turun resit
    if (latestDonationForModal) {
      setCompletedDonation(latestDonationForModal);
      setShowDonationSuccessModal(true);
    }

    // Send Telegram Notification for Payment (Manual or FPX)
    try {
      const totalAmountPaid = newTxnsList.reduce((sum, t) => sum + (t.amount || 0), 0);
      const itemsList = actualPaid.length > 0 
        ? actualPaid.map(p => ({
            name: p.name,
            category: p.category,
            amount: p.customCartAmount ?? p.price,
            sessionYear: p.sessionYear
          }))
        : feeIds.map(fId => {
            const fItem = fees.find(f => f.id === fId);
            return {
              name: fItem?.title || 'Yuran',
              amount: fItem?.amount || 0,
              category: 'Yuran'
            };
          });

      const paymentMethodLabel = isManual ? 'Bayaran Manual (Resit Muat Naik)' : `FPX Online Transfer`;

      await sendTelegramPaymentNotification({
        payerName,
        payerEmail,
        payerPhone: currentUserDoc?.phoneNumber || '',
        paymentMethod: paymentMethodLabel,
        bankName: isManual ? undefined : bankName,
        totalAmount: totalAmountPaid > 0 ? totalAmountPaid : itemsList.reduce((s, i) => s + i.amount, 0),
        approvalStatus: approvalStatus,
        items: itemsList,
        transactionIds: newTxnsList.map(t => t.id),
        voucherNumbers: newTxnsList.map(t => t.voucherNo),
        receiptUrl: receiptAttachment,
        notes: manualNotes,
        aiVerified: aiVerified,
        aiDetectedAmount: aiDetectedAmount,
        aiNotes: aiNotes,
        recordedBy: isManual ? `${payerName} (Ahli - Resit Muat Naik)` : `Sistem FPX (${bankName})`
      });
    } catch (tgErr) {
      console.error("Gagal hantar notifikasi pembayaran Telegram di handlePayFees:", tgErr);
    }
  };

  const handleAddProgramReport = async (newReport: any) => {
    await setDoc(doc(db, 'programReports', newReport.id), newReport);

    const d = new Date(newReport.startDate);
    const monthsName = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
    const formattedDate = `${d.getDate()} ${monthsName[d.getMonth()]} ${d.getFullYear()}`;

    const firstImg = newReport.images && newReport.images[0]
      ? newReport.images[0]
      : "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=400";

    const newBlog: BlogItem = {
      id: `blog-${Date.now()}`,
      title: newReport.title,
      date: formattedDate,
      summary: newReport.description,
      image: firstImg
    };

    await setDoc(doc(db, 'blogs', newBlog.id), newBlog);
  };

  const handleUpdateProgramReport = async (updatedReport: any) => {
    await setDoc(doc(db, 'programReports', updatedReport.id), updatedReport);
  };

  const handleDeleteProgramReport = async (id: string) => {
    await deleteDoc(doc(db, 'programReports', id));
  };

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const isUserCommittee = (role?: string) => {
    if (!role) return false;
    const nonCommitteeRoles = ['Pelawat', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Penduduk', 'Tetamu'];
    return !nonCommitteeRoles.includes(role);
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (post.scope === 'Ahli Jawatankuasa') {
        return isUserCommittee(currentUserDoc?.role || USER_AHMAD.role);
      }
      return true;
    });
  }, [posts, currentUserDoc?.role, USER_AHMAD.role]);

  return (
    <div id="tmf2-app-root" className="w-full max-w-full min-h-[100dvh] h-[100dvh] bg-slate-900 flex flex-col font-sans relative overflow-hidden">
      


      {/* Main Container Workspace */}
      <div className="flex-1 w-full max-w-full flex items-center justify-center relative bg-slate-900 overflow-hidden">
        {deviceMode === 'desktop' ? (
          <div className="w-full h-full bg-slate-50 overflow-hidden">
            <DesktopView
              currentView={desktopView}
              setCurrentView={handleSetCurrentView}
              posts={filteredPosts}
              onAddPost={handleAddPost}
              onLikePost={handleLikePost}
              onAddComment={handleAddComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
              fees={fees}
              onPayFees={handlePayFees}
              packages={packages}
              setPackages={setPackages}
              cartPackageIds={cartPackageIds}
              setCartPackageIds={setCartPackageIds}
              blogs={blogs}
              setBlogs={setBlogs}
              programReports={programReports}
              onAddProgramReport={handleAddProgramReport}
              onUpdateProgramReport={handleUpdateProgramReport}
              onDeleteProgramReport={handleDeleteProgramReport}
              events={events}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onMoveEvent={handleMoveEvent}
              announcements={announcements}
              onAddAnnouncement={handleAddAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              transactions={transactions}
              notifications={notifications}
              setNotifications={setNotifications}
              hasUnreadNotifications={hasUnreadNotifications}
              setHasUnreadNotifications={setHasUnreadNotifications}
              viewedMember={viewedMember}
              setViewedMember={setViewedMember}
              yuranConfig={yuranConfig}
              cases={cases}
            />
          </div>
        ) : (
          <div className="w-full max-w-full h-[100dvh] max-h-[100dvh] flex flex-col bg-slate-50 select-none overflow-hidden">
            <MobileView
              currentTab={mobileTab}
              setCurrentTab={handleSetCurrentTab}
              posts={filteredPosts}
              onAddPost={handleAddPost}
              onLikePost={handleLikePost}
              onAddComment={handleAddComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
              fees={fees}
              onPayFees={handlePayFees}
              packages={packages}
              setPackages={setPackages}
              cartPackageIds={cartPackageIds}
              setCartPackageIds={setCartPackageIds}
              blogs={blogs}
              setBlogs={setBlogs}
              programReports={programReports}
              onAddProgramReport={handleAddProgramReport}
              onUpdateProgramReport={handleUpdateProgramReport}
              onDeleteProgramReport={handleDeleteProgramReport}
              events={events}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onMoveEvent={handleMoveEvent}
              announcements={announcements}
              onAddAnnouncement={handleAddAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              transactions={transactions}
              notifications={notifications}
              setNotifications={setNotifications}
              hasUnreadNotifications={hasUnreadNotifications}
              setHasUnreadNotifications={setHasUnreadNotifications}
              viewedMember={viewedMember}
              setViewedMember={setViewedMember}
              yuranConfig={yuranConfig}
              cases={cases}
            />
          </div>
        )}
      </div>

      {/* Dynamic Push Notification Sliding In-App Toast */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-5 left-4 right-4 sm:left-auto sm:right-5 z-100 max-w-sm bg-slate-900 border border-indigo-500/30 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3.5 backdrop-blur-md bg-opacity-95"
          >
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl shrink-0">
              {activeToast.type === 'announcement' ? (
                <Megaphone size={20} className="text-pink-400 animate-bounce" />
              ) : activeToast.type === 'chat' ? (
                <MessageSquare size={20} className="text-indigo-400 animate-bounce" />
              ) : activeToast.type === 'general' ? (
                <AlertTriangle size={20} className="text-rose-400 animate-bounce" />
              ) : (
                <BookOpen size={20} className="text-teal-400 animate-bounce" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit mb-1">
                {activeToast.type === 'announcement' 
                  ? 'Pengumuman Baru' 
                  : activeToast.type === 'chat'
                    ? 'Sembang Komuniti'
                    : activeToast.type === 'general' 
                      ? 'Laporan Kes Terkini' 
                      : 'Aktiviti Blog Baru'}
              </span>
              <p className="text-xs text-slate-100 font-bold leading-snug line-clamp-2">
                {activeToast.text}
              </p>
              
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (activeToast.type === 'announcement') {
                      handleSetCurrentView('pengumuman');
                    } else if (activeToast.type === 'chat') {
                      handleSetCurrentView('chat');
                    } else if (activeToast.type === 'blog') {
                      handleSetCurrentView('blog');
                    } else if (activeToast.type === 'general') {
                      window.dispatchEvent(new CustomEvent('tmf2_open_pengurusan_kes'));
                    }
                    setActiveToast(null);
                  }}
                  className="text-[11px] font-black text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Buka Seksyen &rarr;
                </button>
                <span className="text-slate-600 text-[9px] font-medium ml-auto">Baru saja</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded-lg hover:bg-slate-800"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt login modal - explicitly disabled on /kehadiran */}
      {desktopView !== 'kehadiran' && mobileTab !== 'kehadiran' && (
        <LoginPromptModal currentView={desktopView} currentTab={mobileTab} />
      )}

      {/* Floating Robot Mascot & Chatbot Widget */}
      <FloatingBotWidget />

      {/* Pop-up Terima Kasih & Muat Turun Resit Sumbangan */}
      <DonationSuccessModal
        isOpen={showDonationSuccessModal}
        onClose={() => setShowDonationSuccessModal(false)}
        donationData={completedDonation}
      />

    </div>
  );
}
