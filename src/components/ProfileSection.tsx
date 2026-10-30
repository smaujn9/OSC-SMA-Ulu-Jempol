import React, { useState, useEffect, useRef } from 'react';
import { Post, Comment, ActiveMember } from '../types';
import { USER_AHMAD } from '../data/mockData';
import { Camera, Plus, Edit2, Briefcase, MapPin, Calendar, Heart, MessageSquare, ThumbsUp, Send, Share2, Award, Globe, Grid, BookOpen, Users, UserPlus, Trash2, Save, X, User, Home, Phone, Mail, Image, Upload, Lock, LogIn, Check, Loader2, Cloud, CreditCard, Maximize2, ExternalLink, Download, FileText, ShieldCheck, CheckCircle2, Copy, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { generate12Months } from '../utils/yuranConfigHelper';
import { db, storage } from '../lib/firebase';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { resizeImage, uploadImageToStorage, saveTempUploadCache, getTempUploadCache, clearTempUploadCache, preloadImageToCache, saveImageToCache } from '../utils/imageUtils';
import { checkNotificationSupport, registerServiceWorker, subscribeUserToPush } from '../utils/notificationHelper';
import { Bell, BellOff } from 'lucide-react';
import { CachedImage } from './CachedImage';

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  age: string;
  baseYear?: number;
}

const getDynamicAge = (enteredAgeStr: string, baseYear: number | undefined): string => {
  if (!enteredAgeStr || enteredAgeStr === '-') return enteredAgeStr || '-';
  const enteredAge = parseInt(enteredAgeStr, 10);
  if (isNaN(enteredAge)) return enteredAgeStr;
  
  const currentYear = new Date().getFullYear();
  const finalBaseYear = baseYear || 2026;
  const ageDiff = currentYear - finalBaseYear;
  
  return ageDiff > 0 ? (enteredAge + ageDiff).toString() : enteredAgeStr;
};

const getMemberDetails = (name: string) => {
  const membersData: Record<string, {
    role: string;
    bio: string;
    avatar: string;
    cover: string;
    address: string;
    phone: string;
    email: string;
    joined: string;
    job: { title: string; company: string; sector: string };
    residence: { houseNumber: string; ownershipType: string; ownerName: string; ownerPhone: string };
    family: { id: string; name: string; relationship: string; age: string }[];
  }> = {
    "Ustazah Siti Aminah": {
      role: "Guru Kanan | Kaunselor Sekolah",
      bio: "Guru Bimbingan & Kaunseling Sekolah Menengah Agama Ulu Jempol. Sentiasa sedia membimbing anak-anak pelajar! 🌸",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
      cover: "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&q=80&w=1000",
      address: "Kuarters Guru SMAUJ, Ulu Jempol",
      phone: "+60 11-1234 5678",
      email: "siti.aminah@gmail.com",
      joined: "Januari 2022",
      job: { title: "Guru Kaunseling", company: "SMA Ulu Jempol", sector: "Pendidikan Islam" },
      residence: { houseNumber: "Kuarters G1", ownershipType: "Kuarters Kerajaan", ownerName: "SMA Ulu Jempol", ownerPhone: "+60 11-1234 5678" },
      family: [
        { id: 'fms-1', name: 'Zulkifli bin Ismail', relationship: 'Suami', age: '42' },
        { id: 'fms-2', name: 'Aishah binti Zulkifli', relationship: 'Anak', age: '10' }
      ]
    },
    "Hj. Ismail Hashim": {
      role: "Yang Dipertua PIBG SMAUJ",
      bio: "Menerajui PIBG Sekolah Menengah Agama Ulu Jempol demi kebajikan dan kejayaan anak-anak murid. 🤝",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
      cover: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=1000",
      address: "Kampung Ulu Jempol, 72200 Batu Kikir",
      phone: "+60 16-987 6543",
      email: "ydp.smauj@gmail.com",
      joined: "Mac 2021",
      job: { title: "Usahawan", company: "Perniagaan Jempol Jaya", sector: "Perniagaan" },
      residence: { houseNumber: "No. 88", ownershipType: "Pemilik Sendiri", ownerName: "Hj. Ismail Hashim", ownerPhone: "+60 16-987 6543" },
      family: [
        { id: 'fmr-1', name: 'Hjh. Rokiah', relationship: 'Isteri', age: '50' }
      ]
    },
    "Ustaz Kamaruzzaman": {
      role: "GPK Pentadbiran SMAUJ",
      bio: "Menyelaras pentadbiran kurikulum dan hal ehwal akademik murid SMAUJ. 📚",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200",
      cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1000",
      address: "Kuarters Pentadbir SMAUJ, Batu Kikir",
      phone: "+60 19-222 3344",
      email: "gpk.smauj@gmail.com",
      joined: "Ogos 2020",
      job: { title: "Guru Penolong Kanan", company: "SMA Ulu Jempol", sector: "Pengurusan Sekolah" },
      residence: { houseNumber: "Kuarters P1", ownershipType: "Kuarters Kerajaan", ownerName: "KPM/JAIMS", ownerPhone: "+60 19-222 3344" },
      family: [
        { id: 'fmc-1', name: 'Ustazah Noraini', relationship: 'Isteri', age: '45' }
      ]
    },
    "Ahmad Zakaria": {
      role: "Bendahari PIBG SMAUJ",
      bio: "Pengurusan rekod kewangan dan sumbangan sekolah secara amanah dan telus. 💼",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200",
      cover: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000",
      address: "Ulu Jempol, 72200 Batu Kikir",
      phone: "+60 12-999 8888",
      email: "bendahari.smauj@gmail.com",
      joined: "Disember 2019",
      job: { title: "Pegawai Kewangan", company: "SMA Ulu Jempol", sector: "Kewangan & Akaun" },
      residence: { houseNumber: "No. 12", ownershipType: "Pemilik Sendiri", ownerName: "Ahmad Zakaria", ownerPhone: "+60 12-999 8888" },
      family: [
        { id: 'fmpa-1', name: 'Salmah binti Harun', relationship: 'Isteri', age: '40' }
      ]
    },
    "Ustazah Zaiton Omar": {
      role: "GPK Hal Ehwal Murid (HEM)",
      bio: "Menjaga kebajikan, disiplin dan asrama pelajar Sekolah Menengah Agama Ulu Jempol. ❤️",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200",
      cover: "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=1000",
      address: "Kuarters Guru SMAUJ, Batu Kikir",
      phone: "+60 17-654 3210",
      email: "hem.smauj@gmail.com",
      joined: "September 2021",
      job: { title: "GPK HEM", company: "SMA Ulu Jempol", sector: "Pendidikan Islam" },
      residence: { houseNumber: "Kuarters G2", ownershipType: "Kuarters Kerajaan", ownerName: "SMA Ulu Jempol", ownerPhone: "+60 17-654 3210" },
      family: [
        { id: 'fmst-1', name: 'Mohamad bin Daud', relationship: 'Suami', age: '48' }
      ]
    }
  };

  return membersData[name] || {
    role: "Warga Sekolah Menengah Agama Ulu Jempol",
    bio: `Saya ${name}, warga dan komuniti Sekolah Menengah Agama Ulu Jempol (SMAUJ). 👋`,
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    cover: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/Fotokulit.png?alt=media&token=ef7f9ad4-0afc-4e0f-b000-11ce9f0a34db",
    address: "Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan",
    phone: "+60 12-000 0000",
    email: `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
    joined: "Jun 2021",
    job: { title: "Warga / Ibu Bapa", company: "SMA Ulu Jempol", sector: "Pendidikan" },
    residence: { houseNumber: "No. N/A", ownershipType: "Ibu Bapa / Penjaga", ownerName: name, ownerPhone: "+60 12-000 0000" },
    family: []
  };
};

interface ProfileSectionProps {
  posts: Post[];
  onAddPost: (content: string, image?: string, scope?: 'Awam' | 'Ahli Jawatankuasa') => void;
  onLikePost: (postId: string) => void;
  onAddComment: (postId: string, commentContent: string) => void;
  onDeletePost?: (postId: string) => void;
  onDeleteComment?: (postId: string, commentId: string) => void;
  isMobile?: boolean;
  viewedMember?: ActiveMember | null;
  setViewedMember?: (member: ActiveMember | null) => void;
  transactions?: any[];
}

// Helper function to turn URLs into clickable hyperlinks opening in a new tab
const renderTextWithLinks = (text: string) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part.match(/^(https?:\/\/|www\.)/i)) {
      const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`;
      return (
        <a 
          key={index} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-indigo-600 hover:underline break-all font-bold"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export const formatJoinedDate = (date: any) => {
  if (!date) return '';
  if (typeof date === 'string') return date;
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function ProfileSection({ 
  posts, 
  onAddPost, 
  onLikePost, 
  onAddComment, 
  onDeletePost,
  onDeleteComment,
  isMobile = false,
  viewedMember: propViewedMember,
  setViewedMember: propSetViewedMember,
  transactions: propTransactions
}: ProfileSectionProps) {
  const { firebaseUser, currentUserDoc, loginWithGoogle, allUsers, allApplications } = useAuth();

  // Transactions State for Khairat Kematian Calculation
  const [internalTransactions, setInternalTransactions] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tmf2_kewangan_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('tmf2_kewangan_transactions');
        if (saved) setInternalTransactions(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('tmf2_transactions_updated', handleSync);
    return () => {
      window.removeEventListener('tmf2_transactions_updated', handleSync);
    };
  }, []);

  const transactions = propTransactions && propTransactions.length > 0 ? propTransactions : internalTransactions;

  // --- Push Notification State Hooks ---
  const [pushPermission, setPushPermission] = useState<string>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [pushLoading, setPushLoading] = useState<boolean>(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setPushPermission(Notification.permission);
      }
      
      const checkCurrentSubscription = async () => {
        try {
          if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              const sub = await reg.pushManager.getSubscription();
              setIsPushSubscribed(!!sub);
            }
          }
        } catch (e) {
          console.warn('Gagal menyemak subskripsi sedia ada:', e);
        }
      };
      checkCurrentSubscription();
    }
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    setPushError(null);
    try {
      const support = checkNotificationSupport();
      if (!support.supported) {
        throw new Error(support.message);
      }
      
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      
      if (perm === 'granted') {
        const reg = await registerServiceWorker();
        const sub = await subscribeUserToPush(reg);
        setIsPushSubscribed(true);
        
        // Play activation chime
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
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

        // Show welcome notification
        reg.showNotification("🔔 Notifikasi Diaktifkan", {
          body: "Anda kini sedia menerima kemas kini daripada Portal SMAUJ secara masa nyata!",
          tag: "smauj-welcome"
        });
      } else {
        throw new Error("Kebenaran notifikasi ditolak.");
      }
    } catch (err: any) {
      console.error(err);
      setPushError(err.message || "Gagal mengaktifkan notifikasi.");
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    setPushError(null);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
          }
        }
      }
      
      if (firebaseUser && !firebaseUser.isAnonymous) {
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            webPushSubscription: null,
            fcmToken: null
          });
        } catch (dbErr) {
          console.warn('Gagal memadam subskripsi dari DB:', dbErr);
        }
      }
      setIsPushSubscribed(false);
    } catch (err: any) {
      console.error(err);
      setPushError(err.message || "Gagal mematikan notifikasi.");
    } finally {
      setPushLoading(false);
    }
  };

  // --- Intro Details State Variables (Declared early to prevent TDZ error) ---
  const [associationRole, setAssociationRole] = useState(currentUserDoc?.associationRole || 'Warga Sekolah / PIBG');
  const [associationLocation, setAssociationLocation] = useState(currentUserDoc?.associationLocation || 'SMA Ulu Jempol');
  const [residenceCity, setResidenceCity] = useState(currentUserDoc?.residenceCity || 'Batu Kikir, Negeri Sembilan');
  const [hometown, setHometown] = useState(currentUserDoc?.hometown || 'Negeri Sembilan');
  const [joinedDate, setJoinedDate] = useState(currentUserDoc?.joinedDate || formatJoinedDate(currentUserDoc?.approvedAt || currentUserDoc?.registeredAt) || 'Jan 2026');

  const [isEditingIntroDetails, setIsEditingIntroDetails] = useState(false);
  const [introDetailsForm, setIntroDetailsForm] = useState({
    associationRole: '',
    associationLocation: '',
    residenceCity: '',
    hometown: '',
    joinedDate: ''
  });

  const isAnonymous = !firebaseUser || firebaseUser.isAnonymous;
  const [localViewedMember, setLocalViewedMember] = useState<ActiveMember | null>(null);
  
  const viewedMember = propViewedMember !== undefined ? propViewedMember : localViewedMember;
  const setViewedMember = propSetViewedMember !== undefined ? propSetViewedMember : setLocalViewedMember;
  
  const communityMembers: ActiveMember[] = (allUsers || []).map(u => ({
    name: u.nickname || u.displayName || 'Pengguna',
    displayName: u.displayName || '',
    nickname: u.nickname || '',
    avatar: u.uploadedProfileImageUrl || u.photoURL || u.googleProfileImageUrl || 'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc',
    role: u.role || 'Pelawat',
    isOnline: true,
    bio: u.bio || undefined,
    cover: u.coverURL || undefined,
    address: u.address || undefined,
    phone: u.phoneNumber || undefined,
    email: u.email || undefined,
    joined: u.joinedDate || formatJoinedDate(u.approvedAt || u.registeredAt) || undefined,
  }));
  const [showLockModal, setShowLockModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'hantaran' | 'tentang' | 'rakan' | 'foto'>('hantaran');
  const [bioText, setBioText] = useState(currentUserDoc?.bio || `Saya ${currentUserDoc?.displayName || firebaseUser?.displayName || USER_AHMAD.name}, warga Sekolah Menengah Agama Ulu Jempol (SMAUJ). 👋`);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [postImage, setPostImage] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isUploadingPostImage, setIsUploadingPostImage] = useState(false);
  const postImageInputRef = useRef<HTMLInputElement>(null);

  const [profileAvatar, setProfileAvatar] = useState(() => {
    if (firebaseUser) {
      const cached = getTempUploadCache(`tmf2_cached_avatar_upload_${firebaseUser.uid}`);
      if (cached) return cached;
    }
    if (currentUserDoc) {
      return currentUserDoc.uploadedProfileImageUrl || currentUserDoc.photoURL || currentUserDoc.googleProfileImageUrl || USER_AHMAD.avatar;
    }
    return firebaseUser?.photoURL || USER_AHMAD.avatar;
  });
  const [profileCover, setProfileCover] = useState(() => {
    if (firebaseUser) {
      const cached = getTempUploadCache(`tmf2_cached_cover_upload_${firebaseUser.uid}`);
      if (cached) return cached;
    }
    if (typeof localStorage !== 'undefined') {
      const fastCached = localStorage.getItem('tmf2_cached_cover_data') || localStorage.getItem('tmf2_cover');
      if (fastCached) return fastCached;
    }
    if (currentUserDoc) {
      return currentUserDoc.uploadedCoverImageUrl || currentUserDoc.coverURL || USER_AHMAD.cover;
    }
    return USER_AHMAD.cover;
  });
  const [nickname, setNickname] = useState(currentUserDoc?.nickname || currentUserDoc?.displayName || firebaseUser?.displayName || USER_AHMAD.name);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState<'idle' | 'resizing' | 'uploading' | 'saving' | 'success'>('idle');
  const [coverUploadStatus, setCoverUploadStatus] = useState<'idle' | 'resizing' | 'uploading' | 'saving' | 'success'>('idle');
  const [storageDiagnosticStatus, setStorageDiagnosticStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [storageDiagnosticError, setStorageDiagnosticError] = useState<string | null>(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [confirmDeleteCommentInfo, setConfirmDeleteCommentInfo] = useState<{postId: string, commentId: string} | null>(null);
  const [previewFullImage, setPreviewFullImage] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewFullImage(null);
      }
    };
    if (previewFullImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewFullImage]);

  useEffect(() => {
    const isCustomAvatar = (url: string | null | undefined) => {
      if (!url) return false;
      return url.startsWith('data:image/') || url.includes('firebasestorage.googleapis.com') || url.includes('/users/');
    };

    if (currentUserDoc && firebaseUser && !firebaseUser.isAnonymous) {
      if (currentUserDoc.bio) setBioText(currentUserDoc.bio);
      
      const cachedAvatar = getTempUploadCache(`tmf2_cached_avatar_upload_${firebaseUser.uid}`);
      const resolvedAvatar = cachedAvatar || currentUserDoc.uploadedProfileImageUrl || currentUserDoc.photoURL || currentUserDoc.googleProfileImageUrl;
      if (resolvedAvatar) {
        setProfileAvatar(resolvedAvatar);
      } else if (isCustomAvatar(USER_AHMAD.avatar)) {
        setProfileAvatar(USER_AHMAD.avatar);
      } else if (firebaseUser.photoURL) {
        setProfileAvatar(firebaseUser.photoURL);
      }
      
      const cachedCover = getTempUploadCache(`tmf2_cached_cover_upload_${firebaseUser.uid}`);
      const resolvedCover = cachedCover || currentUserDoc.uploadedCoverImageUrl || currentUserDoc.coverURL;
      if (resolvedCover) {
        setProfileCover(resolvedCover);
        USER_AHMAD.cover = resolvedCover;
        preloadImageToCache(resolvedCover);
      }
      setNickname(currentUserDoc.nickname || currentUserDoc.displayName || firebaseUser.displayName || USER_AHMAD.name);
    } else {
      setBioText(`Saya ${currentUserDoc?.displayName || firebaseUser?.displayName || USER_AHMAD.name}, warga Sekolah Menengah Agama Ulu Jempol (SMAUJ). 👋`);
      setProfileAvatar(USER_AHMAD.avatar);
      setProfileCover(USER_AHMAD.cover);
      preloadImageToCache(USER_AHMAD.cover);
      setNickname(USER_AHMAD.name);
    }
  }, [currentUserDoc, firebaseUser]);

  // Computed variables
  const isViewingSelf = !viewedMember || Boolean(
    (viewedMember.uid && currentUserDoc?.uid && viewedMember.uid === currentUserDoc.uid) ||
    (viewedMember.uid && firebaseUser?.uid && viewedMember.uid === firebaseUser.uid) ||
    (viewedMember.email && currentUserDoc?.email && viewedMember.email.toLowerCase().trim() === currentUserDoc.email.toLowerCase().trim()) ||
    (viewedMember.email && firebaseUser?.email && viewedMember.email.toLowerCase().trim() === firebaseUser.email.toLowerCase().trim())
  );
  
  const userRole = currentUserDoc?.role;
  const canAccessOthersAbout = userRole === 'Admin Utama' || userRole === 'Pengerusi' || userRole === 'Setiausaha';

  const viewedUserDoc = React.useMemo(() => {
    if (isViewingSelf) return currentUserDoc;
    return (allUsers || []).find(u => 
      (u.uid && viewedMember?.uid && u.uid === viewedMember.uid) ||
      (u.email && viewedMember?.email && u.email.toLowerCase().trim() === viewedMember.email.toLowerCase().trim()) ||
      (u.phoneNumber && viewedMember?.phone && u.phoneNumber.replace(/\D/g, '') && u.phoneNumber.replace(/\D/g, '') === viewedMember.phone.replace(/\D/g, '')) ||
      (u.nickname && viewedMember?.nickname && u.nickname.trim().toLowerCase() === viewedMember.nickname.trim().toLowerCase()) || 
      (u.displayName && viewedMember?.name && u.displayName.trim().toLowerCase() === viewedMember.name.trim().toLowerCase())
    ) || null;
  }, [isViewingSelf, currentUserDoc, allUsers, viewedMember]);

  const viewedUserApp = React.useMemo(() => {
    if (isViewingSelf) return null;
    const targetUid = viewedMember?.uid || viewedUserDoc?.uid;
    const targetEmail = (viewedMember?.email || viewedUserDoc?.email || '').toLowerCase().trim();
    const targetIc = (viewedMember?.icNumber || viewedUserDoc?.icNumber || '').trim();
    return (allApplications || []).find(a =>
      (targetUid && a.uid === targetUid) ||
      (targetEmail && a.email && a.email.toLowerCase().trim() === targetEmail) ||
      (targetIc && a.icNumber && a.icNumber.trim() === targetIc)
    ) || null;
  }, [isViewingSelf, viewedMember, viewedUserDoc, allApplications]);

  const [profileYuranConfig, setProfileYuranConfig] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('tmf2_yuran_config');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system', 'yuranConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfileYuranConfig(data);
        localStorage.setItem('tmf2_yuran_config', JSON.stringify(data));
      }
    }, (error) => {
      console.warn("Ralat akses system/yuranConfig di ProfileSection:", error);
    });
    return () => unsub();
  }, [db, firebaseUser]);

  const isMonthPaidInSession = (sessionYear: string, monthIndex: number) => {
    const paidPackageIds = viewedUserDoc?.paidPackageIds || [];
    
    if (paidPackageIds.includes(`pkg-tahunan-${sessionYear}`)) {
      return true;
    }
    
    const sesi = (profileYuranConfig?.sesiList || []).find((s: any) => s.id === sessionYear);
    const months = sesi ? generate12Months(sesi.startMonth, sesi.startYear) : generate12Months(1, parseInt(sessionYear) || 2026);
    const p1Months = months.slice(0, 6).map(m => m.val);
    const p2Months = months.slice(6, 12).map(m => m.val);
    
    if (p1Months.includes(monthIndex) && paidPackageIds.includes(`pkg-penggal-1-${sessionYear}`)) {
      return true;
    }
    if (p2Months.includes(monthIndex) && paidPackageIds.includes(`pkg-penggal-2-${sessionYear}`)) {
      return true;
    }
    
    const monthStr = monthIndex.toString().padStart(2, '0');
    if (paidPackageIds.includes(`pkg-bulanan-${sessionYear}-${monthStr}`)) {
      return true;
    }
    
    return false;
  };

  const currentProfileName = isViewingSelf 
    ? nickname 
    : (viewedUserApp?.name || viewedMember?.name || viewedUserDoc?.displayName || viewedUserDoc?.nickname || viewedMember?.displayName || 'Pengguna');
  const currentProfileRole = isViewingSelf 
    ? "Rukun Tetangga" 
    : (viewedUserDoc?.role || (viewedMember?.role === "AJK" ? "AJK Rukun Tetangga" : (viewedMember?.role || "Ahli Biasa")));
  
  // Custom mock data for other members
  const memberDetails = getMemberDetails(isViewingSelf ? USER_AHMAD.name : (viewedMember?.displayName || viewedMember?.name || currentProfileName));
  const currentProfileAvatar = isViewingSelf 
    ? profileAvatar 
    : (viewedMember?.avatar || viewedUserDoc?.uploadedProfileImageUrl || viewedUserDoc?.photoURL || viewedUserDoc?.googleProfileImageUrl || memberDetails.avatar);
  const currentProfileCover = isViewingSelf 
    ? profileCover 
    : (viewedMember?.cover || viewedUserDoc?.uploadedCoverImageUrl || viewedUserDoc?.coverURL || memberDetails.cover);
  const currentProfileBio = isViewingSelf 
    ? bioText 
    : (viewedUserDoc?.bio || viewedMember?.bio || memberDetails.bio);
  const currentProfileJoined = isViewingSelf 
    ? `Sertai pada ${joinedDate}` 
    : `Menyertai persatuan pada ${viewedMember?.joined || formatJoinedDate(viewedUserDoc?.approvedAt || viewedUserDoc?.registeredAt || viewedUserApp?.reviewedAt || viewedUserApp?.submittedAt) || memberDetails.joined || "Jun 2021"}`;
  const currentProfileAddress = isViewingSelf 
    ? "Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan" 
    : (viewedUserApp?.address || viewedMember?.address || viewedUserDoc?.address || memberDetails.address);

  // Preload and keep cover photo fresh in cache
  useEffect(() => {
    if (currentProfileCover) {
      preloadImageToCache(currentProfileCover);
    }
  }, [currentProfileCover]);

  const handleViewMember = (member: ActiveMember | null) => {
    setViewedMember(member);
    setActiveTab('hantaran');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleViewProfileEvent = (e: any) => {
      let member = e.detail;
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
            joined: member.joinedDate || member.joined || formatJoinedDate(member.approvedAt || member.registeredAt) || undefined,
            icNumber: member.icNumber || undefined,
            noRumah: member.noRumah || undefined,
            statusKediaman: member.statusKediaman || undefined,
            memberNo: member.memberNo || undefined,
          };
        }
      }
      setViewedMember(member);
      setActiveTab('hantaran');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('tmf2_view_profile', handleViewProfileEvent);
    return () => {
      window.removeEventListener('tmf2_view_profile', handleViewProfileEvent);
    };
  }, [currentUserDoc, firebaseUser]);

  useEffect(() => {
    const onAvatarChange = () => {
      setProfileAvatar(USER_AHMAD.avatar);
    };
    const onCoverChange = () => {
      setProfileCover(USER_AHMAD.cover);
    };
    window.addEventListener('tmf2_avatar_changed', onAvatarChange);
    window.addEventListener('tmf2_cover_changed', onCoverChange);
    return () => {
      window.removeEventListener('tmf2_avatar_changed', onAvatarChange);
      window.removeEventListener('tmf2_cover_changed', onCoverChange);
    };
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setAvatarUploadStatus('uploading');
        
        // 1. Generate local preview immediately to ensure the display is ready instantly
        const localBase64 = await resizeImage(file, 800, 800, 0.85);
        setProfileAvatar(localBase64);
        USER_AHMAD.avatar = localBase64;
        if (firebaseUser) {
          saveTempUploadCache(`tmf2_cached_avatar_upload_${firebaseUser.uid}`, localBase64);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('tmf2_avatar_changed'));
        }
        
        // 2. Perform background upload
        const downloadURL = await uploadImageToStorage(file, `users/${firebaseUser?.uid || 'anonymous'}/avatar`, 800, 800, 0.85);
        
        // 3. Update local UI states with the final URL on completion
        USER_AHMAD.avatar = downloadURL;
        setProfileAvatar(downloadURL);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('tmf2_avatar_changed'));
        }
        
        if (firebaseUser) {
          setAvatarUploadStatus('saving');
          await setDoc(doc(db, 'users', firebaseUser.uid), { 
            uploadedProfileImageUrl: downloadURL,
            photoURL: downloadURL 
          }, { merge: true });
          
          // Clear temp cache on successful DB write
          clearTempUploadCache(`tmf2_cached_avatar_upload_${firebaseUser.uid}`);
        }
        
        setAvatarUploadStatus('success');
        setTimeout(() => setAvatarUploadStatus('idle'), 1500);
      } catch (err) {
        console.error("Error updating avatar:", err);
        setAvatarUploadStatus('idle');
        alert("Ralat semasa memuat naik gambar profil.");
      }
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setCoverUploadStatus('uploading');
        
        // 1. Generate local preview immediately to ensure the display is ready instantly
        const localBase64 = await resizeImage(file, 1600, 800, 0.85);
        setProfileCover(localBase64);
        USER_AHMAD.cover = localBase64;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tmf2_cover', localBase64);
          localStorage.setItem('tmf2_cached_cover_data', localBase64);
        }
        await saveImageToCache(localBase64, localBase64);
        if (firebaseUser) {
          saveTempUploadCache(`tmf2_cached_cover_upload_${firebaseUser.uid}`, localBase64);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('tmf2_cover_changed'));
        }
        
        // 2. Perform background upload
        const downloadURL = await uploadImageToStorage(file, `users/${firebaseUser?.uid || 'anonymous'}/cover`, 1600, 800, 0.85);
        
        // 3. Update local UI states with the final URL on completion
        USER_AHMAD.cover = downloadURL;
        setProfileCover(downloadURL);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tmf2_cover', downloadURL);
          localStorage.setItem('tmf2_cached_cover_data', localBase64);
        }
        await saveImageToCache(downloadURL, localBase64);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('tmf2_cover_changed'));
        }
        
        if (firebaseUser) {
          setCoverUploadStatus('saving');
          await setDoc(doc(db, 'users', firebaseUser.uid), { 
            uploadedCoverImageUrl: downloadURL,
            coverURL: downloadURL 
          }, { merge: true });
          
          // Clear temp cache on successful DB write
          clearTempUploadCache(`tmf2_cached_cover_upload_${firebaseUser.uid}`);
        }
        
        setCoverUploadStatus('success');
        setTimeout(() => setCoverUploadStatus('idle'), 1500);
      } catch(err) {
        console.error("Error updating cover:", err);
        setCoverUploadStatus('idle');
        alert("Ralat semasa memuat naik gambar latar belakang.");
      }
    }
  };

  const runStorageDiagnostic = async () => {
    setStorageDiagnosticStatus('running');
    setStorageDiagnosticError(null);
    try {
      const dummyContent = `TMF2 Diagnostics Test: ${new Date().toISOString()}`;
      const blob = new Blob([dummyContent], { type: 'text/plain' });
      const testPath = `diagnostics/test_${firebaseUser?.uid || 'anonymous'}.txt`;
      const testRef = ref(storage, testPath);
      
      console.log("[Diagnostic] Attempting diagnostic upload to:", testPath);
      await uploadBytes(testRef, blob);
      
      const downloadUrl = await getDownloadURL(testRef);
      console.log("[Diagnostic] Diagnostic upload successful, download URL:", downloadUrl);
      
      setStorageDiagnosticStatus('success');
    } catch (err: any) {
      console.error("[Diagnostic] Firebase Storage test failed:", err);
      let errorMsg = err.message || String(err);
      if (err.code) {
        errorMsg = `${err.code}: ${errorMsg}`;
      }
      setStorageDiagnosticError(errorMsg);
      setStorageDiagnosticStatus('failed');
    }
  };

  // Family members state
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    if (currentUserDoc?.senaraiAhliKeluarga && currentUserDoc.senaraiAhliKeluarga.length > 0) {
      return currentUserDoc.senaraiAhliKeluarga.map((m: any, i: number) => ({
        id: `fm-${i}`,
        name: m.nama || m.name || '',
        relationship: m.hubungan || m.relationship || 'Anak',
        age: m.umur || m.age || '-',
        baseYear: m.baseYear || 2026
      }));
    }
    const targetUid = firebaseUser?.uid || currentUserDoc?.uid;
    if (targetUid) {
      try {
        const cached = localStorage.getItem(`tmf2_family_${targetUid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    if (currentUserDoc?.senaraiAhliKeluarga && currentUserDoc.senaraiAhliKeluarga.length > 0) {
      setFamilyMembers(currentUserDoc.senaraiAhliKeluarga.map((m: any, i: number) => ({
        id: `fm-${i}`,
        name: m.nama || m.name || '',
        relationship: m.hubungan || m.relationship || 'Anak',
        age: m.umur || m.age || '-',
        baseYear: m.baseYear || 2026
      })));
    } else {
      // Check in allApplications if senaraiAhliKeluarga exists there
      const targetUid = firebaseUser?.uid || currentUserDoc?.uid;
      const targetEmail = firebaseUser?.email || currentUserDoc?.email;
      const myApp = (allApplications || []).find(app => 
        (targetUid && app.uid === targetUid) ||
        (targetEmail && app.email === targetEmail) ||
        (currentUserDoc?.icNumber && app.icNumber === currentUserDoc.icNumber)
      );
      if (myApp?.senaraiAhliKeluarga && myApp.senaraiAhliKeluarga.length > 0) {
        setFamilyMembers(myApp.senaraiAhliKeluarga.map((m: any, i: number) => ({
          id: `fm-${i}`,
          name: m.nama || m.name || '',
          relationship: m.hubungan || m.relationship || 'Anak',
          age: m.umur || m.age || '-',
          baseYear: m.baseYear || 2026
        })));
      } else if (targetUid) {
        try {
          const cached = localStorage.getItem(`tmf2_family_${targetUid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setFamilyMembers(parsed);
            }
          }
        } catch (e) {}
      }
    }
  }, [currentUserDoc, allApplications, firebaseUser]);

  // Function to save family members to firestore
  const saveFamilyToFirestore = async (newMembers: FamilyMember[]) => {
    const targetUid = firebaseUser?.uid || currentUserDoc?.uid;
    const userEmail = firebaseUser?.email || currentUserDoc?.email;
    if (!targetUid && !userEmail) return;

    const currentYear = new Date().getFullYear();
    const formatted = newMembers.map(m => ({ 
      nama: m.name.trim(), 
      hubungan: m.relationship, 
      umur: m.age.trim() || '-',
      baseYear: m.baseYear || currentYear 
    }));

    // 1. Instantly save to local cache for refresh safety
    try {
      if (targetUid) {
        localStorage.setItem(`tmf2_family_${targetUid}`, JSON.stringify(newMembers));
      }
      const cachedUserStr = localStorage.getItem('tmf2_cached_user_doc');
      if (cachedUserStr) {
        const parsedUser = JSON.parse(cachedUserStr);
        parsedUser.senaraiAhliKeluarga = formatted;
        parsedUser.bilanganTanggungan = formatted.length;
        parsedUser.bilanganIsiRumah = formatted.length + 1;
        localStorage.setItem('tmf2_cached_user_doc', JSON.stringify(parsedUser));
      }
    } catch (e) {
      console.warn('Gagal simpan ke cache tempatan:', e);
    }

    try {
      // 2. Persist to Firestore `users` collection using setDoc with merge: true
      if (targetUid) {
        await setDoc(doc(db, 'users', targetUid), { 
          senaraiAhliKeluarga: formatted,
          bilanganTanggungan: formatted.length,
          bilanganIsiRumah: formatted.length + 1,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 3. Persist / sync to `membershipApplications` collection if document exists
      const appSyncPayload = {
        senaraiAhliKeluarga: formatted,
        bilanganTanggungan: formatted.length,
        bilanganIsiRumah: formatted.length + 1,
        updatedAt: new Date().toISOString()
      };

      if (targetUid) {
        await setDoc(doc(db, 'membershipApplications', `app-${targetUid}`), appSyncPayload, { merge: true }).catch(() => {});
        await setDoc(doc(db, 'membershipApplications', targetUid), appSyncPayload, { merge: true }).catch(() => {});
      }

      const normalizedEmail = (userEmail || '').toLowerCase().trim();
      const matchingApps = (allApplications || []).filter(app => 
        (targetUid && app.uid === targetUid) ||
        (normalizedEmail && (app.email || '').toLowerCase().trim() === normalizedEmail) ||
        (currentUserDoc?.icNumber && app.icNumber === currentUserDoc.icNumber)
      );

      for (const app of matchingApps) {
        if (app.id) {
          await setDoc(doc(db, 'membershipApplications', app.id), appSyncPayload, { merge: true }).catch(err => console.warn('Sync app family error:', err));
        }
      }

      // 4. Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('tmf2_user_doc_updated', { 
        detail: { senaraiAhliKeluarga: formatted } 
      }));
    } catch(err) { 
      console.error("Ralat menyimpan maklumat keluarga ke database:", err); 
    }
  };

  // CRUD states for family members
  const [isAddingFamily, setIsAddingFamily] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states for family members
  const [familyForm, setFamilyForm] = useState({
    name: '',
    relationship: 'Anak',
    age: ''
  });

  const handleAddFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyForm.name.trim()) return;

    const currentYear = new Date().getFullYear();
    const newMember: FamilyMember = {
      id: `fm-${Date.now()}`,
      name: familyForm.name.trim(),
      relationship: familyForm.relationship,
      age: familyForm.age.trim() || '-',
      baseYear: currentYear
    };

    const updated = [...familyMembers, newMember];
    setFamilyMembers(updated);
    await saveFamilyToFirestore(updated);
    
    setFamilyForm({ name: '', relationship: 'Anak', age: '' });
    setIsAddingFamily(false);
  };

  const handleEditFamilyClick = (member: FamilyMember) => {
    setEditingFamilyId(member.id);
    setIsAddingFamily(false);
    setDeleteConfirmId(null);
    setFamilyForm({
      name: member.name,
      relationship: member.relationship,
      age: member.age === '-' ? '' : member.age
    });
  };

  const handleSaveEditFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFamilyId || !familyForm.name.trim()) return;

    const currentYear = new Date().getFullYear();
    const updated = familyMembers.map(m => {
       if (m.id === editingFamilyId) {
         return {
           ...m,
           name: familyForm.name.trim(),
           relationship: familyForm.relationship,
           age: familyForm.age.trim() || '-',
           baseYear: m.baseYear || currentYear
         };
       }
       return m;
     });

    setFamilyMembers(updated);
    await saveFamilyToFirestore(updated);

    setEditingFamilyId(null);
    setFamilyForm({ name: '', relationship: 'Anak', age: '' });
  };

  const handleDeleteFamilyMember = async (id: string) => {
    const updated = familyMembers.filter(m => m.id !== id);
    setFamilyMembers(updated);
    await saveFamilyToFirestore(updated);
    setDeleteConfirmId(null);
  };

  const normalizeOwnership = (val?: string): 'Sendiri' | 'Penyewa' => {
    if (!val) return 'Sendiri';
    return val.toLowerCase().includes('penyewa') ? 'Penyewa' : 'Sendiri';
  };

  // --- Residence Information (Maklumat Kediaman) ---
  const [houseNumber, setHouseNumber] = useState<string>(currentUserDoc?.noRumah || '-');
  const [ownershipType, setOwnershipType] = useState<'Sendiri' | 'Penyewa'>(normalizeOwnership(currentUserDoc?.statusKediaman));
  const [ownerName, setOwnerName] = useState<string>(currentUserDoc?.namaPemilikRumah || '-');
  const [ownerPhone, setOwnerPhone] = useState<string>(currentUserDoc?.noTelPemilikRumah || '-');

  const [isEditingResidence, setIsEditingResidence] = useState(false);
  const [residenceError, setResidenceError] = useState<string | null>(null);
  const [residenceForm, setResidenceForm] = useState({
    houseNumber: '',
    ownershipType: 'Sendiri' as 'Sendiri' | 'Penyewa',
    ownerName: '',
    ownerPhone: ''
  });

  useEffect(() => {
    if (currentUserDoc) {
      if (currentUserDoc.noRumah) setHouseNumber(currentUserDoc.noRumah);
      if (currentUserDoc.statusKediaman) setOwnershipType(normalizeOwnership(currentUserDoc.statusKediaman));
      if (currentUserDoc.namaPemilikRumah) setOwnerName(currentUserDoc.namaPemilikRumah);
      if (currentUserDoc.noTelPemilikRumah) setOwnerPhone(currentUserDoc.noTelPemilikRumah);
    }
  }, [currentUserDoc]);

  const handleEditResidenceClick = () => {
    setResidenceForm({
      houseNumber,
      ownershipType,
      ownerName,
      ownerPhone
    });
    setResidenceError(null);
    setIsEditingResidence(true);
  };

  const handleSaveResidence = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = residenceForm.houseNumber.replace(/\D/g, '');
    if (digitsOnly.length !== 3) {
      setResidenceError("No. Rumah mestilah mengandungi tepat 3 digit angka sahaja!");
      return;
    }
    if (residenceForm.ownershipType === 'Penyewa' && !residenceForm.ownerName.trim()) {
      setResidenceError("Sila nyatakan Nama Pemilik rumah!");
      return;
    }
    if (residenceForm.ownershipType === 'Penyewa' && !residenceForm.ownerPhone.trim()) {
      setResidenceError("Sila nyatakan No. Telefon Pemilik rumah!");
      return;
    }

    setHouseNumber(digitsOnly);
    setOwnershipType(residenceForm.ownershipType);
    setOwnerName(residenceForm.ownerName.trim());
    setOwnerPhone(residenceForm.ownerPhone.trim());
    
    const targetUid = firebaseUser?.uid || currentUserDoc?.uid;
    if (targetUid) {
      try {
        await setDoc(doc(db, 'users', targetUid), {
          noRumah: digitsOnly,
          statusKediaman: residenceForm.ownershipType,
          namaPemilikRumah: residenceForm.ownerName.trim(),
          noTelPemilikRumah: residenceForm.ownerPhone.trim(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch(err) { console.error(err); }
    }
    
    setResidenceError(null);
    setIsEditingResidence(false);
  };

  // --- Pekerjaan & Tanggungjawab States & Handlers ---
  const [jobRole1, setJobRole1] = useState(currentUserDoc?.jobRole1 || 'Warga Sekolah / PIBG');
  const [jobDetails1, setJobDetails1] = useState(currentUserDoc?.jobDetails1 || 'SMA Ulu Jempol - 2026 - Sekarang');
  
  const getDynamicJobRole2 = () => {
    if (currentUserDoc?.jobRole2) return currentUserDoc.jobRole2;
    const role = currentUserDoc?.role;
    if (!role || role === 'Ahli Biasa' || role === 'Pelawat') return '';
    return role;
  };

  const getDynamicJobDetails2 = () => {
    if (currentUserDoc?.jobDetails2) return currentUserDoc.jobDetails2;
    const role = currentUserDoc?.role;
    if (!role || role === 'Ahli Biasa' || role === 'Pelawat') return '';
    return 'Jawatan Rasmi';
  };

  const [jobRole2, setJobRole2] = useState(getDynamicJobRole2());
  const [jobDetails2, setJobDetails2] = useState(getDynamicJobDetails2());

  const [isEditingJobs, setIsEditingJobs] = useState(false);
  const [jobsForm, setJobsForm] = useState({
    jobRole1: '',
    jobDetails1: '',
    jobRole2: '',
    jobDetails2: ''
  });

  useEffect(() => {
    if (currentUserDoc) {
      if (currentUserDoc.jobRole1) setJobRole1(currentUserDoc.jobRole1);
      if (currentUserDoc.jobDetails1) setJobDetails1(currentUserDoc.jobDetails1);
      if (currentUserDoc.jobRole2) setJobRole2(currentUserDoc.jobRole2);
      if (currentUserDoc.jobDetails2) setJobDetails2(currentUserDoc.jobDetails2);
    }
  }, [currentUserDoc]);

  const handleEditJobsClick = () => {
    setJobsForm({
      jobRole1,
      jobDetails1,
      jobRole2,
      jobDetails2
    });
    setIsEditingJobs(true);
  };

  const handleSaveJobs = async (e: React.FormEvent) => {
    e.preventDefault();
    setJobRole1(jobsForm.jobRole1.trim());
    setJobDetails1(jobsForm.jobDetails1.trim());
    setJobRole2(jobsForm.jobRole2.trim());
    setJobDetails2(jobsForm.jobDetails2.trim());

    const targetUid = firebaseUser?.uid || currentUserDoc?.uid;
    if (targetUid) {
      try {
        await setDoc(doc(db, 'users', targetUid), {
          jobRole1: jobsForm.jobRole1.trim(),
          jobDetails1: jobsForm.jobDetails1.trim(),
          jobRole2: jobsForm.jobRole2.trim(),
          jobDetails2: jobsForm.jobDetails2.trim(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch(err) { console.error(err); }
    }

    setIsEditingJobs(false);
  };

  // --- Maklumat Perhubungan States & Handlers ---
  const [contactPhone, setContactPhone] = useState(currentUserDoc?.phoneNumber || '');
  const [contactEmail, setContactEmail] = useState(currentUserDoc?.email || '');
  const [contactAddress, setContactAddress] = useState(currentUserDoc?.address || '');

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    nickname: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    if (currentUserDoc) {
      if (currentUserDoc.phoneNumber) setContactPhone(currentUserDoc.phoneNumber);
      if (currentUserDoc.email) setContactEmail(currentUserDoc.email);
      if (currentUserDoc.address) setContactAddress(currentUserDoc.address);
    }
  }, [currentUserDoc]);

  const handleEditContactClick = () => {
    setContactForm({
      nickname: nickname,
      phone: contactPhone,
      email: contactEmail,
      address: contactAddress
    });
    setIsEditingContact(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setNickname(contactForm.nickname.trim());
    setContactPhone(contactForm.phone.trim());
    setContactEmail(contactForm.email.trim());
    setContactAddress(contactForm.address.trim());

    const targetUid = firebaseUser?.uid || currentUserDoc?.uid;
    if (targetUid) {
      try {
        await setDoc(doc(db, 'users', targetUid), {
          nickname: contactForm.nickname.trim(),
          phoneNumber: contactForm.phone.trim(),
          email: contactForm.email.trim(),
          address: contactForm.address.trim(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch(err) { console.error(err); }
    }

    setIsEditingContact(false);
  };

  // --- Displayed Profile Variables (Supports viewing other members as well as self) ---
  const displayedFamilyMembers = React.useMemo(() => {
    if (isViewingSelf) {
      return familyMembers;
    }
    const familySource = viewedUserDoc?.senaraiAhliKeluarga || viewedUserApp?.senaraiAhliKeluarga;
    if (familySource && Array.isArray(familySource)) {
      return familySource.map((m: any, i: number) => ({
        id: `fm-${i}`,
        name: m.nama || m.name || '',
        relationship: m.hubungan || m.relationship || 'Keluarga',
        age: m.umur || m.age || '-',
        baseYear: m.baseYear || 2026
      }));
    }
    return [];
  }, [isViewingSelf, familyMembers, viewedUserDoc, viewedUserApp]);

  const displayedJobRole1 = isViewingSelf ? jobRole1 : (viewedUserDoc?.jobRole1 || 'Warga Sekolah / PIBG');
  const displayedJobDetails1 = isViewingSelf ? jobDetails1 : (viewedUserDoc?.jobDetails1 || 'SMA Ulu Jempol - 2026 - Sekarang');
  const displayedJobRole2 = isViewingSelf ? jobRole2 : (viewedUserDoc?.jobRole2 || (viewedUserDoc?.role !== 'Ahli Biasa' && viewedUserDoc?.role !== 'Pelawat' ? viewedUserDoc?.role : ''));
  const displayedJobDetails2 = isViewingSelf ? jobDetails2 : (viewedUserDoc?.jobDetails2 || (viewedUserDoc?.role !== 'Ahli Biasa' && viewedUserDoc?.role !== 'Pelawat' ? 'Jawatan Rasmi' : ''));

  const displayedMemberNo = isViewingSelf 
    ? (currentUserDoc?.approvalStatus === 'Approved' ? (currentUserDoc?.memberNo || "-") : "-") 
    : (viewedUserDoc?.memberNo || viewedUserApp?.memberNo || viewedMember?.memberNo || (viewedUserDoc?.approvalStatus === 'Approved' || viewedUserApp?.status === 'Diluluskan' ? "SMAUJ-AHLI" : "-"));

  const displayedDisplayName = isViewingSelf 
    ? (currentUserDoc?.displayName || currentUserDoc?.nickname || firebaseUser?.displayName || "-") 
    : (viewedUserApp?.name || viewedMember?.name || viewedUserDoc?.displayName || viewedUserDoc?.nickname || "-");

  const displayedIcNumber = isViewingSelf 
    ? (currentUserDoc?.icNumber || "-") 
    : (viewedUserDoc?.icNumber || viewedUserApp?.icNumber || viewedMember?.icNumber || "-");

  const displayedPhone = isViewingSelf 
    ? (contactPhone || "-") 
    : (viewedUserDoc?.phoneNumber || viewedUserApp?.phone || viewedMember?.phone || memberDetails.phone || "-");

  const displayedEmail = isViewingSelf 
    ? (contactEmail || "-") 
    : (viewedUserDoc?.email || viewedUserApp?.email || viewedMember?.email || memberDetails.email || "-");

  const displayedAddress = isViewingSelf 
    ? (contactAddress || "-") 
    : (viewedUserDoc?.address || viewedUserApp?.address || viewedMember?.address || memberDetails.address || "-");

  const displayedApprovedAt = isViewingSelf 
    ? (currentUserDoc?.approvalStatus === 'Approved' && currentUserDoc?.approvedAt ? new Date(currentUserDoc.approvedAt?.seconds ? currentUserDoc.approvedAt.seconds * 1000 : currentUserDoc.approvedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : "-")
    : ((viewedUserDoc?.approvalStatus === 'Approved' || viewedUserApp?.status === 'Diluluskan') && (viewedUserDoc?.approvedAt || viewedUserApp?.reviewedAt) ? new Date((viewedUserDoc?.approvedAt?.seconds ? viewedUserDoc.approvedAt.seconds * 1000 : viewedUserDoc?.approvedAt) || (viewedUserApp?.reviewedAt?.seconds ? viewedUserApp.reviewedAt.seconds * 1000 : viewedUserApp?.reviewedAt)).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : "-");

  const displayedMembershipType = isViewingSelf 
    ? (currentUserDoc?.approvalStatus === 'Approved' ? (currentUserDoc?.membershipType || "Ahli Biasa") : "Tetamu")
    : (viewedUserDoc?.membershipType || (viewedUserDoc?.approvalStatus === 'Approved' || viewedUserApp?.status === 'Diluluskan' ? "Ahli Biasa" : "Tetamu"));

  const displayedApprovalStatusRaw = isViewingSelf 
    ? (currentUserDoc?.approvalStatus || "Pending") 
    : (viewedUserDoc?.approvalStatus || (viewedUserApp?.status === 'Diluluskan' ? 'Approved' : viewedUserApp?.status || "Pending"));

  const isUserKuiri = isViewingSelf 
    ? (currentUserDoc?.membershipStatus === 'Kuiri' || currentUserDoc?.approvalStatus === 'Kuiri' || (allApplications || []).some(a => (a.uid === currentUserDoc?.uid || (a.email && currentUserDoc?.email && a.email.toLowerCase().trim() === currentUserDoc.email.toLowerCase().trim()) || (currentUserDoc?.memberNo && a.memberNo && a.memberNo.trim() === currentUserDoc.memberNo.trim())) && (a.status === 'Kuiri' || a.status === 'Kuiri Permohonan' || a.status === 'Perlu Kemaskini')))
    : (viewedUserDoc?.membershipStatus === 'Kuiri' || viewedUserDoc?.approvalStatus === 'Kuiri' || viewedUserApp?.status === 'Kuiri' || (allApplications || []).some(a => (a.uid === viewedUserDoc?.uid || (a.email && viewedUserDoc?.email && a.email.toLowerCase().trim() === viewedUserDoc.email.toLowerCase().trim()) || (viewedUserDoc?.memberNo && a.memberNo && a.memberNo.trim() === viewedUserDoc.memberNo.trim())) && (a.status === 'Kuiri' || a.status === 'Kuiri Permohonan' || a.status === 'Perlu Kemaskini')));

  const displayedApprovalStatus = isUserKuiri ? 'Kuiri' : displayedApprovalStatusRaw;

  const displayedNickname = isViewingSelf 
    ? nickname 
    : (viewedUserApp?.nickname || viewedUserDoc?.nickname || viewedMember?.nickname || viewedUserDoc?.displayName || viewedMember?.name || "-");

  const displayedHouseNumber = isViewingSelf ? houseNumber : (viewedUserDoc?.noRumah || viewedUserApp?.noRumah || viewedMember?.noRumah || "-");
  const isPenyewaProfile = [
    isViewingSelf ? ownershipType : null,
    currentUserDoc?.statusKediaman,
    viewedUserDoc?.statusKediaman,
    viewedUserApp?.statusKediaman,
    viewedMember?.statusKediaman
  ].some(val => val && String(val).toLowerCase().includes('penyewa'));
  const displayedOwnershipType = isPenyewaProfile ? 'Penyewa' : 'Sendiri';
  const displayedOwnerName = isViewingSelf ? ownerName : (viewedUserDoc?.namaPemilikRumah || viewedUserApp?.namaPemilikRumah || "-");
  const displayedOwnerPhone = isViewingSelf ? ownerPhone : (viewedUserDoc?.noTelPemilikRumah || viewedUserApp?.noTelPemilikRumah || "-");

  // 1. Tabung Khairat Kematian Terkumpul: Terkumpul dari SEMUA ahli yang telah membuat bayaran (bukan individu sahaja)
  const totalKhairatTerkumpul = React.useMemo(() => {
    // A. Kira daripada transaksi kewangan yang diluluskan (kutipan daripada semua ahli)
    const txnIncome = transactions.filter(t => 
      t.approvalStatus === "Approved" && (
        t.accountCredit === "Khairat Kematian" ||
        (t.category === "Khairat Kematian" && t.accountDebit !== "Khairat Kematian" && t.accountCredit !== "Bank" && t.accountCredit !== "Tunai") ||
        ((t.description || '').toLowerCase().includes('khairat') && t.accountCredit === "Khairat Kematian")
      )
    ).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // B. Kira daripada rekod pakej berbayar (paidPackageIds) semua ahli
    const pkgIncome = (allUsers || []).reduce((userSum, u) => {
      const paidIds: string[] = u.paidPackageIds || [];
      if (!paidIds || paidIds.length === 0) return userSum;

      const userKhairat = paidIds.reduce((sum, pkgId) => {
        if (pkgId.includes('tahunan')) {
          return sum + (profileYuranConfig?.yuranTahunan?.khairat ?? 60);
        } else if (pkgId.includes('penggal')) {
          return sum + (profileYuranConfig?.yuranPenggal?.khairat ?? 30);
        } else if (pkgId.startsWith('pkg-20') || pkgId.includes('bulanan') || /pkg-\d{4}-\d+/.test(pkgId)) {
          return sum + (profileYuranConfig?.yuranBulanan?.khairat ?? 5);
        } else if (pkgId.includes('khairat')) {
          return sum + (profileYuranConfig?.yuranBulanan?.khairat ?? 5);
        }
        return sum;
      }, 0);

      return userSum + userKhairat;
    }, 0);

    return Math.max(txnIncome, pkgIncome);
  }, [transactions, allUsers, profileYuranConfig]);

  // 2. Pengeluaran Tabung Khairat Kematian Terkumpul: Berdasarkan pengeluaran di menu "Kewangan" dari lejar "Khairat Kematian"
  const totalKhairatPengeluaran = React.useMemo(() => {
    return transactions.filter(t => 
      t.approvalStatus === "Approved" && (
        t.accountDebit === "Khairat Kematian" ||
        ((t.accountCredit === "Bank" || t.accountCredit === "Tunai") && (
          t.category === "Khairat Kematian" ||
          (t.category || '').toLowerCase().includes("khairat") ||
          (t.description || '').toLowerCase().includes("khairat")
        ))
      )
    ).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  // 3. Baki Semasa Tabung Khairat Kematian
  const bakiKhairatSemasa = totalKhairatTerkumpul - totalKhairatPengeluaran;
  const khairatBalance = bakiKhairatSemasa;


  // --- Intro Details (Butiran Seterusnya) ---

  useEffect(() => {
    if (currentUserDoc) {
      if (currentUserDoc.associationRole) setAssociationRole(currentUserDoc.associationRole);
      if (currentUserDoc.associationLocation) setAssociationLocation(currentUserDoc.associationLocation);
      if (currentUserDoc.residenceCity) setResidenceCity(currentUserDoc.residenceCity);
      if (currentUserDoc.hometown) setHometown(currentUserDoc.hometown);
      if (currentUserDoc.joinedDate) {
        setJoinedDate(currentUserDoc.joinedDate);
      } else {
        setJoinedDate(formatJoinedDate(currentUserDoc.approvedAt || currentUserDoc.registeredAt));
      }
    }
  }, [currentUserDoc]);

  const handleEditIntroDetailsClick = () => {
    setIntroDetailsForm({
      associationRole,
      associationLocation,
      residenceCity,
      hometown,
      joinedDate
    });
    setIsEditingIntroDetails(true);
  };

  const handleSaveIntroDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssociationRole(introDetailsForm.associationRole.trim());
    setAssociationLocation(introDetailsForm.associationLocation.trim());
    setResidenceCity(introDetailsForm.residenceCity.trim());
    setHometown(introDetailsForm.hometown.trim());
    setJoinedDate(introDetailsForm.joinedDate.trim());

    if (firebaseUser) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          associationRole: introDetailsForm.associationRole.trim(),
          associationLocation: introDetailsForm.associationLocation.trim(),
          residenceCity: introDetailsForm.residenceCity.trim(),
          hometown: introDetailsForm.hometown.trim(),
          joinedDate: introDetailsForm.joinedDate.trim()
        });
      } catch(err) { console.error(err); }
    }

    setIsEditingIntroDetails(false);
  };

  const handleTambahCeritaClick = () => {
    setActiveTab('hantaran');
    setTimeout(() => {
      const composer = document.getElementById('composer-section');
      if (composer) {
        composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const textarea = composer.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        }
      }
    }, 100);
  };

  const handleEditProfileClick = () => {
    setActiveTab('tentang');
    setIsEditingBio(true);
    handleEditIntroDetailsClick();
    handleEditJobsClick();
    handleEditContactClick();
    handleEditResidenceClick();
  };

  // Filter posts to show ONLY the current viewed user's posts (strictly no posts from other users)
  const displayedPosts = posts.filter(p => {
    if (isViewingSelf) {
      const myUid = firebaseUser?.uid || currentUserDoc?.uid;
      
      // 1. If post has an authorUid, strictly check against current user's UID
      if (p.authorUid) {
        return Boolean(myUid && p.authorUid === myUid);
      }

      // 2. If post has no authorUid (legacy data), check STRICT exact equality only (no substring matching)
      const myNames = [
        currentUserDoc?.nickname,
        currentUserDoc?.displayName,
        firebaseUser?.displayName,
        nickname
      ].filter((n): n is string => Boolean(n && n.trim().length > 0));

      if (myNames.length > 0) {
        const authorLower = (p.authorName || '').trim().toLowerCase();
        return myNames.some(name => {
          const nameLower = name.trim().toLowerCase();
          return authorLower === nameLower;
        });
      }

      return false;
    } else {
      // Viewing another member's profile
      const targetUid = viewedUserDoc?.uid || (viewedMember as any)?.uid;
      
      // 1. If post has an authorUid and target has a known UID, strictly match
      if (p.authorUid) {
        return Boolean(targetUid && p.authorUid === targetUid);
      }

      // 2. If no authorUid, check STRICT exact equality only with target member's names
      const targetNames = [
        viewedMember?.name,
        viewedMember?.displayName,
        viewedMember?.nickname,
        viewedUserDoc?.displayName,
        viewedUserDoc?.nickname
      ].filter((n): n is string => Boolean(n && n.trim().length > 0));

      if (targetNames.length > 0) {
        const authorLower = (p.authorName || '').trim().toLowerCase();
        return targetNames.some(name => {
          const nameLower = name.trim().toLowerCase();
          return authorLower === nameLower;
        });
      }

      return false;
    }
  });

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    onAddPost(newPostText, postImage || undefined);
    setNewPostText('');
    setPostImage('');
    setShowImageInput(false);
  };

  const handleCommentSubmit = (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;
    onAddComment(postId, text);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Cover & Profile Header Card */}
      <div className="bg-white rounded-xl shadow-xs overflow-hidden border border-gray-100">
        {/* Cover Image */}
        <div className="relative h-48 md:h-64 bg-slate-200">
          <CachedImage
            src={currentProfileCover}
            alt="Cover"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {coverUploadStatus !== 'idle' && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-[2px] transition-all duration-300">
              {coverUploadStatus === 'success' ? (
                <Check className="text-green-400 mb-2" size={32} />
              ) : (
                <span className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent mb-2"></span>
              )}
              <span className="text-xs font-bold bg-black/40 px-3 py-1 rounded-full border border-white/10">
                {coverUploadStatus === 'resizing' && 'Memproses foto latar...'}
                {coverUploadStatus === 'uploading' && 'Memuat naik foto latar...'}
                {coverUploadStatus === 'saving' && 'Menyimpan foto latar...'}
                {coverUploadStatus === 'success' && 'Selesai! 🎉'}
              </span>
            </div>
          )}
          {isViewingSelf && !isAnonymous && coverUploadStatus === 'idle' && (
            <>
              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverChange}
                accept="image/*"
                className="hidden"
              />
              <button 
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer backdrop-blur-xs transition-colors"
              >
                <Camera size={14} />
                <span className="hidden sm:inline">Edit Foto Kulit</span>
              </button>
            </>
          )}
        </div>

        {/* Profile Info Row */}
        <div className="px-4 md:px-6 pb-4">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4 -mt-16 md:-mt-8 mb-4">
            {/* Large Avatar */}
            <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white shadow-md overflow-hidden bg-white shrink-0">
              <CachedImage
                src={currentProfileAvatar}
                alt={currentProfileName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {avatarUploadStatus !== 'idle' && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-[1px] transition-all duration-300">
                  {avatarUploadStatus === 'success' ? (
                    <Check className="text-green-400 mb-1" size={20} />
                  ) : (
                    <span className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mb-1"></span>
                  )}
                  <span className="text-[10px] font-bold text-center leading-tight max-w-[85%] bg-black/30 px-1.5 py-0.5 rounded-md">
                    {avatarUploadStatus === 'resizing' && 'Memproses...'}
                    {avatarUploadStatus === 'uploading' && 'Memuat naik...'}
                    {avatarUploadStatus === 'saving' && 'Menyimpan...'}
                    {avatarUploadStatus === 'success' && 'Selesai! 🎉'}
                  </span>
                </div>
              )}
              {isViewingSelf && !isAnonymous && avatarUploadStatus === 'idle' && (
                <>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button 
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-1 right-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full p-1.5 border border-white cursor-pointer shadow-xs transition-colors"
                  >
                    <Camera size={14} />
                  </button>
                </>
              )}
            </div>

            {/* User Title & Quick Stats */}
            <div className="text-center md:text-left flex-1 space-y-1">
              <div className="flex flex-col items-center md:flex-row md:items-center gap-2">
                <h2 className="text-2xl font-extrabold text-gray-950">{currentProfileName}</h2>
                <span className="inline-flex items-center bg-indigo-100 text-indigo-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                  {currentProfileRole}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {communityMembers.length} rakan komuniti • {displayedPosts.length} hantaran
              </p>
              {/* Overlap Friends avatars */}
              <div 
                className="flex justify-center md:justify-start -space-x-2 pt-1 overflow-hidden cursor-pointer"
                onClick={() => setActiveTab('rakan')}
              >
                {communityMembers.slice(1, 6).map((member, i) => (
                  <CachedImage
                    key={i}
                    src={member.avatar}
                    alt={member.name}
                    className="w-6 h-6 rounded-full border-2 border-white object-cover"
                    referrerPolicy="no-referrer"
                  />
                ))}
                <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-gray-500">
                  +12
                </div>
              </div>
            </div>

            {/* FB Style Buttons */}
            <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0 justify-center">
              {isViewingSelf ? (
                isAnonymous ? (
                  <button 
                    onClick={() => loginWithGoogle()}
                    className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <LogIn size={14} />
                    <span>Log Masuk Google</span>
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={handleTambahCeritaClick}
                      className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus size={14} />
                      <span>Tambah Cerita</span>
                    </button>
                    <button 
                      onClick={handleEditProfileClick}
                      className="flex-1 md:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-800 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Edit2 size={14} />
                      <span>Edit Profil</span>
                    </button>
                  </>
                )
              ) : (
                <>
                  <button 
                    onClick={() => alert(`Permintaan rakan dihantar kepada ${currentProfileName}!`)}
                    className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <UserPlus size={14} />
                    <span>Tambah Rakan</span>
                  </button>
                  <button 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('tmf2_switch_view', { detail: 'chat' }));
                    }}
                    className="flex-1 md:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-800 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <MessageSquare size={14} />
                    <span>Hantar Mesej</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Facebook Style Tabs bar */}
          <div className="flex border-t border-gray-100 pt-2 overflow-x-auto gap-1">
            {[
              { id: 'hantaran', label: 'Hantaran' },
              { id: 'tentang', label: 'Tentang' },
              { id: 'rakan', label: 'Rakan' },
              { id: 'foto', label: 'Foto' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (isAnonymous) {
                    setActiveTab(tab.id as any);
                  } else if (tab.id === 'tentang' && !isViewingSelf && !canAccessOthersAbout) {
                    setShowLockModal(true);
                  } else {
                    setActiveTab(tab.id as any);
                  }
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{tab.label}</span>
                {(isAnonymous || (tab.id === 'tentang' && !isViewingSelf && !canAccessOthersAbout)) && (
                  <Lock size={12} className="text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Contents */}
      {isAnonymous ? (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-8 text-center space-y-4 max-w-lg mx-auto my-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-indigo-100">
            <Lock size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-extrabold text-slate-900">Kandungan Profil Dikunci</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Hantaran, maklumat peribadi (Tentang), rakan komuniti, dan galeri foto dikunci untuk pelawat luar. Sila log masuk dengan Google untuk melihat profil penuh persatuan.
            </p>
          </div>
          <button
            onClick={() => loginWithGoogle()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn size={15} />
            <span>Log Masuk dengan Google</span>
          </button>
        </div>
      ) : (
        <>
          {activeTab === 'hantaran' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column (Intro / About sidebar) */}
          <div className="md:col-span-5 space-y-4">
            {/* Pengenalan Card */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 space-y-4">
              <h3 className="font-extrabold text-sm text-gray-950">Pengenalan</h3>

              {/* Bio Block */}
              <div className="text-center space-y-2 pb-2 border-b border-gray-100">
                {isEditingBio && isViewingSelf ? (
                  <div className="space-y-2">
                    <textarea
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      className="w-full text-xs p-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-600 resize-none h-16"
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => {
                          setBioText(currentUserDoc?.bio || `Saya ${currentUserDoc?.displayName || firebaseUser?.displayName || USER_AHMAD.name}, warga Sekolah Menengah Agama Ulu Jempol (SMAUJ). 👋`);
                          setIsEditingBio(false);
                        }}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        onClick={async () => {
                          if (firebaseUser) {
                            try {
                              await updateDoc(doc(db, 'users', firebaseUser.uid), {
                                bio: bioText
                              });
                            } catch(err) { console.error(err); }
                          }
                          setIsEditingBio(false);
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded cursor-pointer"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-700 italic leading-relaxed">
                      "{currentProfileBio}"
                    </p>
                    {isViewingSelf && (
                      <button
                        onClick={() => setIsEditingBio(true)}
                        className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Edit Bio
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Details List */}
              {isEditingIntroDetails && isViewingSelf ? (
                <form onSubmit={handleSaveIntroDetails} className="space-y-3 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Peranan Komuniti</label>
                    <input
                      type="text"
                      required
                      value={introDetailsForm.associationRole}
                      onChange={(e) => setIntroDetailsForm(prev => ({ ...prev, associationRole: e.target.value }))}
                      className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Kawasan Komuniti</label>
                    <input
                      type="text"
                      required
                      value={introDetailsForm.associationLocation}
                      onChange={(e) => setIntroDetailsForm(prev => ({ ...prev, associationLocation: e.target.value }))}
                      className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tempat Tinggal</label>
                    <input
                      type="text"
                      required
                      value={introDetailsForm.residenceCity}
                      onChange={(e) => setIntroDetailsForm(prev => ({ ...prev, residenceCity: e.target.value }))}
                      className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tempat Asal</label>
                    <input
                      type="text"
                      required
                      value={introDetailsForm.hometown}
                      onChange={(e) => setIntroDetailsForm(prev => ({ ...prev, hometown: e.target.value }))}
                      className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tarikh Menyertai</label>
                    <input
                      type="text"
                      required
                      value={introDetailsForm.joinedDate}
                      onChange={(e) => setIntroDetailsForm(prev => ({ ...prev, joinedDate: e.target.value }))}
                      className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-1.5 pt-1.5 border-t border-gray-200/50">
                    <button
                      type="button"
                      onClick={() => setIsEditingIntroDetails(false)}
                      className="px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-md transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Save size={10} />
                      <span>Simpan</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="space-y-3 text-xs text-gray-700">
                    <div className="flex items-center gap-2.5">
                      <Briefcase size={16} className="text-gray-400" />
                      <span>{isViewingSelf ? associationRole : currentProfileRole} di <strong className="font-semibold text-gray-900">{isViewingSelf ? associationLocation : "Sekolah Menengah Agama Ulu Jempol"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin size={16} className="text-gray-400" />
                      <span>Tinggal di <strong className="font-semibold text-gray-900">{isViewingSelf ? residenceCity : "Batu Kikir, Negeri Sembilan"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin size={16} className="text-gray-400" />
                      <span>Berasal dari <strong className="font-semibold text-gray-900">{isViewingSelf ? hometown : "Negeri Sembilan"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Calendar size={16} className="text-gray-400" />
                      <span>Menyertai persatuan pada <strong className="font-semibold text-gray-900">{isViewingSelf ? joinedDate : (viewedMember?.joined || memberDetails.joined || "Jun 2021")}</strong></span>
                    </div>
                  </div>
                  {isViewingSelf && (
                    <button
                      onClick={handleEditIntroDetailsClick}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      Edit Butiran Seterusnya
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Tetapan Notifikasi Push Card */}
            {isViewingSelf && (
              <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 space-y-3.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Bell size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-950 leading-tight">Notifikasi Sistem</h3>
                    <p className="text-[10px] text-gray-400 font-medium">Urus hantaran pemberitahuan peranti</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Status Peranti</span>
                    {(() => {
                      if (!('Notification' in window)) {
                        return <span className="text-[9px] px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-black uppercase">Tidak Disokong</span>;
                      }
                      if (pushPermission === 'granted') {
                        return (
                          <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-black uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />
                            Aktif
                          </span>
                        );
                      }
                      if (pushPermission === 'denied') {
                        return <span className="text-[9px] px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-black uppercase">Disekat</span>;
                      }
                      return <span className="text-[9px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-black uppercase">Belum Aktif</span>;
                    })()}
                  </div>

                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    {(() => {
                      if (!('Notification' in window)) {
                        return 'Pelayar ini tidak menyokong fungsi push notification. Sila gunakan pelayar moden.';
                      }
                      if (pushPermission === 'granted') {
                        return isPushSubscribed 
                          ? 'Anda kini bersedia untuk menerima sebarang pengumuman dan kemas kini blog secara masa nyata terus pada skrin peranti.'
                          : 'Kebenaran dibenarkan tetapi subskripsi belum didaftarkan semula. Sila klik butang di bawah.';
                      }
                      if (pushPermission === 'denied') {
                        return 'Kebenaran disekat. Sila klik ikon kunci mangga di bar alamat pelayar untuk membenarkan semula notifikasi.';
                      }
                      return 'Dapatkan pemberitahuan terus ke peranti anda sebaik sahaja pengumuman penting persatuan atau laporan blog baharu dimuat naik.';
                    })()}
                  </p>

                  {pushError && (
                    <div className="p-2 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold rounded-lg">
                      {pushError}
                    </div>
                  )}

                  {('Notification' in window) && (
                    <div className="pt-1">
                      {pushPermission === 'granted' && isPushSubscribed ? (
                        <button
                          type="button"
                          disabled={pushLoading}
                          onClick={handleDisablePush}
                          className="w-full text-center py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {pushLoading ? 'Mematikan...' : 'Matikan Notifikasi'}
                        </button>
                      ) : pushPermission === 'denied' ? (
                        <div className="text-[10px] text-slate-400 font-bold border border-slate-200 bg-white p-2 rounded-md">
                          Sila layari Site Settings / Tetapan Laman di pelayar anda untuk membuka kunci (Allow) kebenaran notifikasi bagi aplikasi ini.
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={pushLoading}
                          onClick={handleEnablePush}
                          className="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {pushLoading ? 'Mengaktifkan...' : 'Benarkan Notifikasi'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rakan Grid Card */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-950">Rakan Komuniti</h3>
                  <p className="text-[10px] text-gray-400">17 rakan aktif</p>
                </div>
                <button 
                  onClick={() => setActiveTab('rakan')}
                  className="text-indigo-600 hover:underline text-xs font-semibold cursor-pointer"
                >
                  Lihat Semua
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {communityMembers.filter(m => m.name !== currentProfileName).slice(0, 6).map((member, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleViewMember(member)}
                    className="space-y-1 cursor-pointer hover:opacity-85 transition-opacity"
                  >
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-full h-20 object-cover rounded-lg border border-gray-100"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] font-bold text-gray-800 truncate block text-center">
                      {member.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Ahmad's Timeline & Post Composer) */}
          <div className="md:col-span-7 space-y-4">
            {/* Status Composer */}
            {!isViewingSelf ? (
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-indigo-950">Melawat Profil {currentProfileName}</h4>
                  <p className="text-[10px] text-gray-500 font-medium leading-relaxed">Melihat hantaran dan aktiviti daripada {currentProfileName} sahaja.</p>
                </div>
                <button
                  onClick={() => handleViewMember(null)}
                  className="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-slate-50 text-indigo-600 font-bold text-[10px] rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                >
                  Kembali Ke Profil Saya
                </button>
              </div>
            ) : (
              <div id="composer-section" className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 space-y-3">
                <div className="flex gap-3 items-start">
                  <img
                    src={profileAvatar}
                    alt={currentUserDoc?.nickname || currentUserDoc?.displayName || firebaseUser?.displayName || "Pengguna"}
                    className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0 mt-1"
                    referrerPolicy="no-referrer"
                  />
                  <form onSubmit={handlePostSubmit} className="flex-1 space-y-3">
                    <textarea
                      value={newPostText}
                      onChange={(e) => setNewPostText(e.target.value)}
                      placeholder={`Apa yang anda fikirkan, ${currentUserDoc?.nickname || currentUserDoc?.displayName?.split(' ')[0] || firebaseUser?.displayName?.split(' ')[0] || "Pengguna"}? Kongsikan cerita anda...`}
                      rows={2}
                      className="w-full bg-gray-150/40 hover:bg-gray-150/60 focus:bg-white text-slate-800 text-xs rounded-xl py-2 px-3 outline-hidden border-0 focus:ring-1 focus:ring-indigo-600 transition-colors resize-none leading-relaxed"
                    />

                    {/* Hidden File Input */}
                    <input
                      type="file"
                      ref={postImageInputRef}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setIsUploadingPostImage(true);
                            const downloadURL = await uploadImageToStorage(file, 'chats', 800, 800, 0.7);
                            setPostImage(downloadURL);
                            setShowImageInput(true);
                          } catch (err) {
                            console.error("Error uploading image:", err);
                            alert("Gagal memuat naik gambar. Sila cuba lagi.");
                          } finally {
                            setIsUploadingPostImage(false);
                          }
                        }
                      }}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Image input/preview section */}
                    {showImageInput && (
                      <div className="p-3 bg-slate-50 rounded-lg space-y-3 border border-slate-200 relative">
                        <button
                          type="button"
                          onClick={() => {
                            setPostImage('');
                            setShowImageInput(false);
                          }}
                          className="absolute top-2 right-2 p-1 bg-gray-900/80 hover:bg-gray-950 text-white rounded-full cursor-pointer transition-colors z-10"
                        >
                          <X size={14} />
                        </button>

                        {postImage ? (
                          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white max-h-[180px] flex items-center justify-center">
                            <img
                              src={postImage}
                              alt="Preview upload"
                              className="max-h-[160px] object-contain rounded-md"
                            />
                          </div>
                        ) : isUploadingPostImage ? (
                          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="animate-spin text-indigo-600" size={24} />
                            <span className="text-xs font-semibold text-slate-600">Sedang memuat naik gambar...</span>
                          </div>
                        ) : (
                          <div 
                            onClick={() => postImageInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-100/50 cursor-pointer transition-colors flex flex-col items-center justify-center gap-2"
                          >
                            <Upload className="text-slate-400" size={24} />
                            <span className="text-xs font-semibold text-slate-600">Klik untuk muat naik gambar</span>
                          </div>
                        )}

                        {/* Alternative URL Input */}
                        <div className="pt-2 border-t border-slate-200">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Atau masukkan pautan URL gambar:</label>
                          <input
                            type="text"
                            value={postImage.startsWith('data:') ? '' : postImage}
                            onChange={(e) => {
                              setPostImage(e.target.value);
                              if (e.target.value) setShowImageInput(true);
                            }}
                            placeholder="https://images.unsplash.com/photo-..."
                            className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowImageInput(true);
                          postImageInputRef.current?.click();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-xs font-medium text-green-600 transition-colors cursor-pointer"
                      >
                        <Image size={16} />
                        <span>Tambah Foto</span>
                      </button>

                      <button
                        type="submit"
                        disabled={(!newPostText.trim() && !postImage.trim()) || isUploadingPostImage}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full transition-colors disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        {isUploadingPostImage && <Loader2 className="animate-spin" size={12} />}
                        <span>{isUploadingPostImage ? 'Memuat naik...' : 'Hantar'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Ahmad's Personal Posts */}
            <div className="space-y-4">
              {displayedPosts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-8 text-center text-gray-500 text-xs">
                  {isViewingSelf 
                    ? "Sila tulis sesuatu di atas untuk memulakan hantaran pertama anda!" 
                    : `Tiada hantaran daripada ${currentProfileName} buat masa ini.`
                  }
                </div>
              ) : (
                displayedPosts.map((post) => {
                  const hasLiked = post.likes.includes(USER_AHMAD.name) || (currentUserDoc?.nickname && post.likes.includes(currentUserDoc.nickname)) || (firebaseUser?.uid && post.likes.includes(firebaseUser.uid));
                  const isPostAhmad = (post.authorUid && firebaseUser && post.authorUid === firebaseUser.uid) ||
                                      (post.authorUid && currentUserDoc?.uid && post.authorUid === currentUserDoc.uid) ||
                                      post.authorName === USER_AHMAD.name || 
                                      post.authorName === currentUserDoc?.nickname || 
                                      post.authorName === currentUserDoc?.displayName ||
                                      post.authorName === nickname ||
                                      post.authorName === currentProfileName;
                  const postMember = communityMembers.find(m => 
                    (post.authorUid && (m as any).uid === post.authorUid) ||
                    m.nickname === post.authorName || 
                    m.displayName === post.authorName || 
                    m.name === post.authorName
                  );
                  const resolvedPostAuthorName = isPostAhmad 
                    ? (nickname || currentUserDoc?.nickname || post.authorName || currentUserDoc?.displayName || USER_AHMAD.name)
                    : (postMember?.nickname || postMember?.displayName || post.authorName);
                  const resolvedPostAuthorAvatar = isPostAhmad
                    ? (currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || firebaseUser?.photoURL || USER_AHMAD.avatar)
                    : (postMember?.avatar || post.authorAvatar);
                  const roleToDisplay = isPostAhmad 
                    ? (currentUserDoc?.role || post.authorRole || USER_AHMAD.role || "Pelawat") 
                    : (post.authorRole || postMember?.role || getMemberDetails(post.authorName)?.role || "Ahli Aktif");

                  return (
                    <div key={post.id} className="bg-white rounded-xl shadow-xs border border-gray-100 p-4">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3">
                          <img
                            src={resolvedPostAuthorAvatar}
                            alt={resolvedPostAuthorName}
                            className="w-10 h-10 rounded-full object-cover border border-gray-100"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-gray-900">{resolvedPostAuthorName}</span>
                              <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm">
                                <Award size={10} />
                                {roleToDisplay}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span>{post.timestamp}</span>
                              <span>•</span>
                              <Globe size={10} />
                            </div>
                          </div>
                        </div>

                        {(isPostAhmad || userRole === 'Admin Utama') && onDeletePost && (
                          <button
                            onClick={() => setConfirmDeletePostId(post.id)}
                            className="text-gray-400 hover:text-rose-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Padam Hantaran"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-sm text-gray-800 leading-relaxed mb-4 whitespace-pre-line">
                        {renderTextWithLinks(post.content)}
                      </p>

                      {/* Photo if any */}
                      {post.image && (
                        <div 
                          onClick={() => setPreviewFullImage(post.image!)}
                          className="rounded-xl overflow-hidden border border-gray-100 mb-4 max-h-[420px] cursor-pointer relative group bg-slate-900/5 flex items-center justify-center transition-all duration-200"
                          title="Klik untuk lihat gambar penuh"
                        >
                          <CachedImage
                            src={post.image}
                            alt="Post Media"
                            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-200"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="bg-black/75 text-white text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-xs transform translate-y-1 group-hover:translate-y-0 transition-all">
                              <Maximize2 size={14} />
                              <span>Lihat Gambar Penuh</span>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex justify-between items-center text-xs text-gray-500 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-1 w-5 h-5">
                            <ThumbsUp size={10} fill="currentColor" />
                          </span>
                          <span>{post.likes.length} Suka</span>
                        </div>
                        <span>{post.comments.length} Komen</span>
                      </div>

                      {/* Actions */}
                      <div className="flex grid grid-cols-3 gap-1 py-1 text-xs font-semibold text-gray-600 border-b border-gray-100">
                        <button
                          onClick={() => onLikePost(post.id)}
                          className={`flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${hasLiked ? 'text-blue-600 font-bold' : ''}`}
                        >
                          <ThumbsUp size={16} fill={hasLiked ? 'currentColor' : 'none'} />
                          <span>Suka</span>
                        </button>
                        <button 
                          onClick={() => {
                            const el = document.getElementById(`comment-profile-${post.id}`);
                            if (el) el.focus();
                          }}
                          className="flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <MessageSquare size={16} />
                          <span>Komen</span>
                        </button>
                        <button className="flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <Share2 size={16} />
                          <span>Kongsi</span>
                        </button>
                      </div>

                      {/* Comments list */}
                      {post.comments.length > 0 && (
                        <div className="space-y-3 mt-4 pt-2">
                          {post.comments.map((comment) => {
                            const isCommentAhmad = (comment.authorUid && firebaseUser && comment.authorUid === firebaseUser.uid) ||
                                                   (comment.authorUid && currentUserDoc?.uid && comment.authorUid === currentUserDoc.uid) ||
                                                   comment.authorName === USER_AHMAD.name || 
                                                   comment.authorName === currentUserDoc?.nickname || 
                                                   comment.authorName === currentUserDoc?.displayName ||
                                                   comment.authorName === nickname ||
                                                   comment.authorName === currentProfileName;
                            const commentMember = communityMembers.find(m => 
                              (comment.authorUid && (m as any).uid === comment.authorUid) ||
                              m.nickname === comment.authorName || 
                              m.displayName === comment.authorName || 
                              m.name === comment.authorName
                            );
                            const resolvedCommentAuthorName = isCommentAhmad 
                              ? (nickname || currentUserDoc?.nickname || comment.authorName) 
                              : (commentMember?.nickname || commentMember?.displayName || comment.authorName);
                            const resolvedCommentAuthorAvatar = isCommentAhmad
                              ? (currentUserDoc?.uploadedProfileImageUrl || currentUserDoc?.photoURL || firebaseUser?.photoURL || USER_AHMAD.avatar)
                              : (commentMember?.avatar || comment.authorAvatar);

                            const isCommentOwner = (comment.authorUid && firebaseUser && comment.authorUid === firebaseUser.uid) || 
                                                   (!comment.authorUid && isCommentAhmad);

                            return (
                              <div key={comment.id} className="flex gap-2.5 items-start text-xs">
                                <img
                                  src={resolvedCommentAuthorAvatar}
                                  alt={resolvedCommentAuthorName}
                                  onClick={() => {
                                    handleViewMember(isCommentAhmad ? null : (commentMember || null));
                                  }}
                                  className="w-8 h-8 rounded-full object-cover border border-gray-100 mt-0.5 cursor-pointer hover:opacity-85 transition-opacity"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1">
                                  <div className="bg-gray-100 p-2.5 rounded-2xl inline-block max-w-[90%]">
                                    <span 
                                      onClick={() => {
                                        handleViewMember(isCommentAhmad ? null : (commentMember || null));
                                      }}
                                      className="font-bold text-gray-900 block mb-0.5 hover:underline cursor-pointer"
                                    >
                                      {resolvedCommentAuthorName}
                                    </span>
                                    <p className="text-gray-800 leading-normal">{comment.content}</p>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1 pl-2.5">
                                    <span className="font-semibold hover:underline cursor-pointer text-gray-600">Suka</span>
                                    <span>•</span>
                                    <span className="font-semibold hover:underline cursor-pointer text-gray-600">Balas</span>
                                    <span>•</span>
                                    {(isCommentOwner || userRole === 'Admin Utama') && onDeleteComment && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setConfirmDeleteCommentInfo({postId: post.id, commentId: comment.id});
                                          }}
                                          className="font-semibold hover:underline text-rose-600 cursor-pointer"
                                        >
                                          Padam
                                        </button>
                                        <span>•</span>
                                      </>
                                    )}
                                    <span>{comment.timestamp}</span>
                                  </div>
                                </div>
                              </div>
                            );
                        })}
                        </div>
                      )}

                      {/* Add comment in timeline */}
                      <div className="flex gap-2.5 items-center mt-4">
                        <img
                          src={profileAvatar}
                          alt={currentUserDoc?.nickname || currentUserDoc?.displayName || firebaseUser?.displayName || "Pengguna"}
                          className="w-8 h-8 rounded-full object-cover border border-gray-100"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 flex gap-2 items-center bg-gray-100 rounded-full px-3 py-1.5 border border-gray-100">
                          <input
                            id={`comment-profile-${post.id}`}
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Tulis komen..."
                            className="flex-1 bg-transparent border-0 outline-hidden focus:ring-0 text-xs py-0.5 text-gray-800"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCommentSubmit(post.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleCommentSubmit(post.id)}
                            className="text-indigo-600 hover:text-indigo-800 disabled:opacity-40 cursor-pointer p-0.5"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'tentang' && (
        <div className="space-y-6">
          {/* Butiran Peribadi Card */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-gray-950 border-b border-gray-100 pb-2">Butiran Peribadi Tentang {isViewingSelf ? (currentUserDoc?.nickname || currentUserDoc?.displayName?.split(' ')[0] || firebaseUser?.displayName?.split(' ')[0] || "Pengguna") : (viewedMember?.displayName || viewedMember?.name || "Pengguna")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-700 pt-1">
              
              {/* Pekerjaan & Tanggungjawab Column */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-900 text-xs">Pekerjaan & Tanggungjawab</h4>
                    {isViewingSelf && !isEditingJobs && (
                      <button
                        type="button"
                        onClick={handleEditJobsClick}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit2 size={11} />
                        <span>Kemaskini</span>
                      </button>
                    )}
                  </div>

                  {isEditingJobs ? (
                    <form onSubmit={handleSaveJobs} className="space-y-3 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs">
                      {/* Job 1 */}
                      <div className="space-y-2 pb-2 border-b border-gray-200/50">
                        <h5 className="font-bold text-[10px] text-indigo-600 uppercase">Peranan Utama</h5>
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-gray-500 uppercase">Nama Jawatan</label>
                          <input
                            type="text"
                            required
                            value={jobsForm.jobRole1}
                            onChange={(e) => setJobsForm(prev => ({ ...prev, jobRole1: e.target.value }))}
                            className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-gray-500 uppercase">Butiran & Tarikh</label>
                          <input
                            type="text"
                            required
                            value={jobsForm.jobDetails1}
                            onChange={(e) => setJobsForm(prev => ({ ...prev, jobDetails1: e.target.value }))}
                            className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                          />
                        </div>
                      </div>

                      {/* Job 2 */}
                      <div className="space-y-2 pt-1">
                        <h5 className="font-bold text-[10px] text-indigo-600 uppercase">Peranan Sampingan</h5>
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-gray-500 uppercase">Nama Jawatan</label>
                          <input
                            type="text"
                            required
                            value={jobsForm.jobRole2}
                            onChange={(e) => setJobsForm(prev => ({ ...prev, jobRole2: e.target.value }))}
                            className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold text-gray-500 uppercase">Butiran & Tarikh</label>
                          <input
                            type="text"
                            required
                            value={jobsForm.jobDetails2}
                            onChange={(e) => setJobsForm(prev => ({ ...prev, jobDetails2: e.target.value }))}
                            className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-1.5 pt-1.5 border-t border-gray-200/50">
                        <button
                          type="button"
                          onClick={() => setIsEditingJobs(false)}
                          className="px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-md transition-colors cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <Save size={10} />
                          <span>Simpan</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex gap-2 items-center p-2.5 bg-slate-50 rounded-lg">
                        <Briefcase size={16} className="text-indigo-600" />
                        <div>
                          <span className="font-semibold block text-gray-900">{displayedJobRole1}</span>
                          <span className="text-gray-400 text-[10px]">{displayedJobDetails1}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center p-2.5 bg-slate-50 rounded-lg">
                        <BookOpen size={16} className="text-indigo-600" />
                        <div>
                          <span className="font-semibold block text-gray-900">{displayedJobRole2}</span>
                          <span className="text-gray-400 text-[10px]">{displayedJobDetails2}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Maklumat Warga */}
                <div className="space-y-3 border-t border-gray-100 pt-4 select-none">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                    <Award size={14} className="text-indigo-600" />
                    <span>Maklumat Warga</span>
                  </h4>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between items-start py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium">No. ID Warga:</span>
                      <span className="font-bold text-gray-900 font-mono text-right">{displayedMemberNo}</span>
                    </div>
                    <div className="flex justify-between items-start py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium">Nama Penuh:</span>
                      <span className="font-extrabold text-gray-950 text-right uppercase">{displayedDisplayName}</span>
                    </div>
                    <div className="flex justify-between items-start py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium">No. Kad Pengenalan:</span>
                      <span className="font-bold text-gray-900 font-mono text-right">{displayedIcNumber}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium flex items-center gap-2">
                        <Phone size={12} className="text-gray-400" />
                        <span>No. Telefon:</span>
                      </span>
                      <span className="font-semibold text-gray-900 text-right">{displayedPhone}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium flex items-center gap-2">
                        <Mail size={12} className="text-gray-400" />
                        <span>Emel:</span>
                      </span>
                      <span className="font-semibold text-gray-900 text-right break-all max-w-[180px]">{displayedEmail}</span>
                    </div>
                    <div className="flex justify-between items-start py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium flex items-center gap-2 pt-0.5">
                        <MapPin size={12} className="text-gray-400" />
                        <span>Alamat:</span>
                      </span>
                      <span className="font-semibold text-gray-900 text-right max-w-[180px] leading-relaxed">{displayedAddress}</span>
                    </div>
                    <div className="flex justify-between items-start py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium">Tarikh Kelulusan Warga:</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {displayedApprovedAt}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-200/40">
                      <span className="text-gray-500 font-medium">Jenis Warga:</span>
                      <span className="font-bold text-xs text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded-md text-right">{displayedMembershipType}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-gray-500 font-medium">Status:</span>
                      <span className={`font-bold text-xs px-2 py-0.5 rounded-md flex items-center gap-1.5 text-right ${
                        isUserKuiri 
                          ? 'text-amber-800 bg-amber-100 border border-amber-300 font-black'
                          : displayedApprovalStatus === 'Approved' 
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-100/60' 
                            : 'text-amber-700 bg-amber-50 border border-amber-100/60'
                      }`}>
                        {isUserKuiri ? (
                          <>
                            <AlertTriangle size={12} className="text-amber-600 animate-pulse" />
                            <span>Kuiri (Perlu Kemaskini)</span>
                          </>
                        ) : displayedApprovalStatus === 'Approved' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Warga Aktif</span>
                          </>
                        ) : (
                          <span>Belum Daftar Warga</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maklumat Perhubungan & Kediaman Column */}
              <div className="space-y-6">
                
                {/* Maklumat Perhubungan */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <Phone size={14} className="text-indigo-600" />
                      <span>Maklumat Perhubungan</span>
                    </h4>
                    {isViewingSelf && !isEditingContact && (
                      <button
                        type="button"
                        onClick={handleEditContactClick}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit2 size={11} />
                        <span>Kemaskini</span>
                      </button>
                    )}
                  </div>

                  {isEditingContact ? (
                    <form onSubmit={handleSaveContact} className="space-y-3 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nama Panggilan</label>
                        <input
                          type="text"
                          required
                          value={contactForm.nickname}
                          onChange={(e) => setContactForm(prev => ({ ...prev, nickname: e.target.value }))}
                          className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">No. Telefon</label>
                        <input
                          type="text"
                          required
                          value={contactForm.phone}
                          onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">E-mel</label>
                        <input
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Alamat Rumah</label>
                        <textarea
                          required
                          rows={2}
                          value={contactForm.address}
                          onChange={(e) => setContactForm(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-indigo-500 text-gray-900 font-medium resize-none"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-1.5 pt-1.5 border-t border-gray-200/50">
                        <button
                          type="button"
                          onClick={() => setIsEditingContact(false)}
                          className="px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-md transition-colors cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <Save size={10} />
                          <span>Simpan</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                        <span className="text-gray-500 font-medium flex items-center gap-2">
                          <User size={12} className="text-gray-400" />
                          <span>Nama Panggilan:</span>
                        </span>
                        <span className="font-semibold text-gray-900">{displayedNickname}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                        <span className="text-gray-500 font-medium flex items-center gap-2">
                          <Phone size={12} className="text-gray-400" />
                          <span>No. Telefon:</span>
                        </span>
                        <span className="font-semibold text-gray-900">{displayedPhone}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                        <span className="text-gray-500 font-medium flex items-center gap-2">
                          <Mail size={12} className="text-gray-400" />
                          <span>E-mel:</span>
                        </span>
                        <span className="font-semibold text-gray-900">{displayedEmail}</span>
                      </div>
                      <div className="flex justify-between items-start py-1.5">
                        <span className="text-gray-500 font-medium flex items-center gap-2 pt-0.5">
                          <MapPin size={12} className="text-gray-400" />
                          <span>Alamat Rumah:</span>
                        </span>
                        <span className="font-semibold text-gray-900 text-right max-w-[200px]">{displayedAddress}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Friends Tab */}
      {activeTab === 'rakan' && (
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-sm text-gray-950">Semua Rakan Komuniti (Active)</h3>
            <span className="text-xs text-gray-500 font-semibold">{communityMembers.length} orang aktif</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
            {communityMembers.map((member, i) => (
              <div 
                key={i} 
                onClick={() => handleViewMember(member)}
                className="flex gap-3 items-center p-2.5 border border-gray-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer active:scale-98"
              >
                <div className="relative">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-100"
                    referrerPolicy="no-referrer"
                  />
                  {member.isOnline && (
                    <span className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <span className="font-bold text-xs text-gray-900 block truncate">{member.name}</span>
                  <span className="text-[10px] text-gray-400 block font-medium">{member.role} SMAUJ</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'foto' && (
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-5 space-y-4">
          <h3 className="font-extrabold text-sm text-gray-950 border-b border-gray-100 pb-2">Album Komuniti & Aktiviti</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
            {displayedPosts.filter(p => p.image).length > 0 ? (
              displayedPosts.filter(p => p.image).map((post, idx) => (
                <div 
                  key={post.id || idx} 
                  onClick={() => setPreviewFullImage(post.image!)}
                  className="group relative rounded-xl overflow-hidden aspect-square border border-gray-100 cursor-pointer shadow-xs bg-slate-900/5"
                  title="Klik untuk lihat gambar penuh"
                >
                  <CachedImage
                    src={post.image}
                    alt={post.content.substring(0, 20)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                    <span className="text-[10px] font-bold text-white line-clamp-2">{post.content}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-8 text-center text-gray-500 text-xs">
                Tiada gambar dikongsikan lagi.
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* Modern Lock Warning Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-amber-50 border border-amber-200 mb-4 text-amber-500">
              <Lock size={28} className="animate-pulse" />
            </div>
            
            <h3 className="text-sm font-extrabold text-gray-950 mb-1.5">
              Tab "Tentang" Dikunci
            </h3>
            
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
              Hanya **Admin sahaja** yang dibenarkan untuk mengakses maklumat peribadi, nombor telefon, pekerjaan dan butiran keluarga rakan komuniti demi keselamatan privasi ahli.
            </p>
            
            <button
              type="button"
              onClick={() => setShowLockModal(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-all"
            >
              Faham & Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modal Pop-up Confirmation for Post Delete */}
      {confirmDeletePostId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setConfirmDeletePostId(null)}
          />
          
          {/* Modal Content */}
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative z-10 border border-gray-100 transform scale-100 transition-all duration-200 animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              {/* Warning Icon */}
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                <Trash2 size={24} />
              </div>
              
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Padam Hantaran?
              </h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Adakah anda pasti ingin memadam hantaran ini secara kekal? Tindakan ini tidak boleh diundurkan.
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmDeletePostId(null)}
                  className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (onDeletePost) {
                      onDeletePost(confirmDeletePostId);
                    }
                    setConfirmDeletePostId(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
                >
                  Padam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pop-up Confirmation for Comment Delete */}
      {confirmDeleteCommentInfo && onDeleteComment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setConfirmDeleteCommentInfo(null)}
          />
          
          {/* Modal Content */}
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative z-10 border border-gray-100 transform scale-100 transition-all duration-200 animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              {/* Warning Icon */}
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                <Trash2 size={24} />
              </div>
              
              <h3 className="text-base font-bold text-gray-900 mb-2">
                Padam Komen?
              </h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Adakah anda pasti ingin memadam komen ini secara kekal? Tindakan ini tidak boleh diundurkan.
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmDeleteCommentInfo(null)}
                  className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    onDeleteComment(confirmDeleteCommentInfo.postId, confirmDeleteCommentInfo.commentId);
                    setConfirmDeleteCommentInfo(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                >
                  Padam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal View Full Image */}
      {previewFullImage && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewFullImage(null)}
        >
          {/* Action buttons bar */}
          <div 
            className="absolute top-4 right-4 z-20 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={previewFullImage}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm flex items-center justify-center"
              title="Buka pautan dalam tab baru"
            >
              <ExternalLink size={18} />
            </a>
            <button
              onClick={() => setPreviewFullImage(null)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm flex items-center justify-center"
              title="Tutup (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Centered Image Container */}
          <div 
            className="relative max-w-5xl max-h-[88vh] w-full flex items-center justify-center p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <CachedImage
              src={previewFullImage}
              alt="Gambar penuh komuniti"
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

    </div>
  );
}
