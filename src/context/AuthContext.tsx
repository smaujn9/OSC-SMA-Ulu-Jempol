import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider } from 'firebase/auth';
import { 
  auth, 
  db, 
  googleProvider, 
  googleDriveProvider,
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged,
  FirebaseUser
} from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  addDoc,
  deleteDoc,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { sendTelegramMessage } from '../utils/telegramHelper';
import { LoginLog } from '../types';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  uploadedProfileImageUrl?: string | null;
  googleProfileImageUrl?: string | null;
  uploadedCoverImageUrl?: string | null;
  phoneNumber: string | null;
  role: string;
  membershipType: string;
  membershipStatus: string;
  approvalStatus: string;
  isSuperAdmin: boolean;
  createdAt: any;
  updatedAt: any;
  registeredAt?: any;
  approvedAt?: any;
  approvedBy?: string | null;
  lastLoginAt: any;
  memberNo?: string;
  
  // profile fields from membership registration
  noRumah?: string;
  nickname?: string;
  icNumber?: string;
  address?: string;
  poskod?: string;
  bandar?: string;
  negeri?: string;
  statusKediaman?: string;
  namaPemilikRumah?: string;
  noTelPemilikRumah?: string;
  bilanganIsiRumah?: number;
  bilanganTanggungan?: number;
  senaraiAhliKeluarga?: Array<{ nama: string; hubungan: string; umur: string; baseYear?: number }>;
  department?: string;

  // Additional Profile Fields
  bio?: string;
  coverURL?: string;
  jobRole1?: string;
  jobDetails1?: string;
  jobRole2?: string;
  jobDetails2?: string;
  associationRole?: string;
  associationLocation?: string;
  residenceCity?: string;
  hometown?: string;
  joinedDate?: string;
  paidPackageIds?: string[];
  selectedTambahanIds?: string[];
  kuiriRemarks?: string;
  kuiriItems?: string[];
  isHouseholdMember?: boolean;
  householdOwnerUid?: string;
  householdOwnerName?: string;
}

export interface MembershipApplication {
  id: string;
  uid: string;
  name: string;
  nickname: string;
  icNumber: string;
  phone: string;
  email: string;
  noRumah: string;
  address: string;
  poskod: string;
  bandar: string;
  negeri: string;
  statusKediaman: string;
  namaPemilikRumah?: string;
  noTelPemilikRumah?: string;
  bilanganIsiRumah: number;
  bilanganTanggungan?: number;
  senaraiAhliKeluarga: Array<{ nama: string; hubungan: string; umur: string; baseYear?: number }>;
  submittedAt: any;
  status: string; // 'Pending' | 'Diluluskan' | 'Rejected' | 'Kuiri'
  memberNo?: string;
  reviewedAt?: any;
  reviewedBy?: string | null;
  remarks?: string;
  kuiriItems?: string[];
}

export interface AuditLog {
  id: string;
  uid: string;
  action: string;
  description: string;
  performedBy: string;
  timestamp: any;
}

export interface RoleAuditLog {
  id: string;
  userId: string;
  userName: string;
  oldRole: string;
  newRole: string;
  changedBy: string;
  reason: string;
  timestamp: any;
}

/**
 * Resolve the correct avatar URL for display.
 * Priority: uploadedProfileImageUrl > photoURL > googleProfileImageUrl > firebaseUser.photoURL > fallback
 */
export const resolveUserAvatar = (
  userDoc: AppUser | null | undefined,
  firebaseUser: { photoURL?: string | null } | null | undefined,
  fallback: string = 'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc'
): string => {
  if (userDoc) {
    return userDoc.uploadedProfileImageUrl
      || userDoc.photoURL
      || userDoc.googleProfileImageUrl
      || firebaseUser?.photoURL
      || fallback;
  }
  return firebaseUser?.photoURL || fallback;
};

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUserDoc: AppUser | null;
  loading: boolean;
  showChoicePopup: boolean;
  setShowChoicePopup: (show: boolean) => void;
  pendingRegData: any; // stores temp Google login info for registration
  setPendingRegData: (data: any) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  googleDriveToken: string | null;
  setGoogleDriveToken: (token: string | null) => void;
  connectGoogleDrive: () => Promise<string | null>;
  handleChoice: (choice: 'tetamu' | 'daftar') => Promise<void>;
  submitMembershipApplication: (formData: any) => Promise<void>;
  approveApplication: (appId: string, applicantUid: string, type: string) => Promise<void>;
  rejectApplication: (appId: string, applicantUid: string, remarks: string) => Promise<void>;
  queryApplication: (appId: string, applicantUid: string, remarks: string, kuiriItems?: string[]) => Promise<void>;
  changeUserRole: (userId: string, newRole: string, reason: string) => Promise<void>;
  deleteUserDoc: (userId: string) => Promise<void>;
  deleteApplication: (appId: string, email?: string, uid?: string) => Promise<void>;
  logAction: (action: string, description: string) => Promise<void>;
  recordLoginEvent: (method?: string) => Promise<void>;
  updateApplicationStatus: (appId: string, applicantUid: string, status: string, type?: string) => Promise<void>;
  resequenceMemberNumbers: () => Promise<{ success: boolean; updatedCount: number; users: any[] }>;
  
  // Realtime Collections (for Admin view)
  allUsers: AppUser[];
  allApplications: MembershipApplication[];
  auditLogs: AuditLog[];
  roleLogs: RoleAuditLog[];
  loginLogs: LoginLog[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to generate member ID using an optional transaction or latest user state
const generateNextMemberNo = async (transaction?: any) => {
  const currentYear = new Date().getFullYear();
  
  // 1. Fetch all users to find the true highest existing sequence number for the current year
  let maxSeq = 0;
  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    usersSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.memberNo && typeof data.memberNo === 'string') {
        const match = data.memberNo.match(/(?:SMAUJ|PTMF2)-(\d{4})-(\d+)/);
        if (match) {
          const year = parseInt(match[1], 10);
          const seq = parseInt(match[2], 10);
          if (year === currentYear && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });
  } catch (err) {
    console.warn("Ralat membaca users collection untuk nombor ahli:", err);
  }

  // 2. Also check system/memberCounter
  const counterRef = doc(db, 'system', 'memberCounter');
  try {
    let counterData: any = null;
    if (transaction && typeof transaction.get === 'function') {
      const counterSnap = await transaction.get(counterRef);
      if (counterSnap.exists()) counterData = counterSnap.data();
    } else {
      const counterSnap = await getDoc(counterRef);
      if (counterSnap.exists()) counterData = counterSnap.data();
    }
    if (counterData && counterData.year === currentYear && (counterData.seq || 0) > maxSeq) {
      maxSeq = counterData.seq;
    }
  } catch (err) {
    console.warn("Ralat membaca memberCounter:", err);
  }

  const nextSeq = maxSeq + 1;
  const payload = {
    year: currentYear,
    seq: nextSeq,
    updatedAt: serverTimestamp()
  };
  try {
    if (transaction && typeof transaction.set === 'function') {
      transaction.set(counterRef, payload, { merge: true });
    } else {
      await setDoc(counterRef, payload, { merge: true });
    }
  } catch (err) {
    console.warn("Ralat menyimpan memberCounter:", err);
  }
  
  const paddedSeq = nextSeq.toString().padStart(4, '0');
  return `SMAUJ-${currentYear}-${paddedSeq}`;
};

export const DEFAULT_TETAMU_USER_DOC: AppUser = {
  uid: 'guest_local',
  email: null,
  displayName: 'TETAMU',
  photoURL: null,
  uploadedProfileImageUrl: null,
  googleProfileImageUrl: null,
  uploadedCoverImageUrl: null,
  phoneNumber: null,
  role: 'TETAMU',
  membershipType: 'TETAMU',
  membershipStatus: 'Bukan Ahli',
  approvalStatus: 'Belum Mohon',
  isSuperAdmin: false,
  createdAt: null,
  updatedAt: null,
  lastLoginAt: null
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('tmf2_cached_firebase_user');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error("Gagal membaca cached firebase user:", e);
        }
      }
    }
    return null;
  });

  const [currentUserDoc, setCurrentUserDoc] = useState<AppUser | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('tmf2_cached_user_doc');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error("Gagal membaca cached user doc:", e);
        }
      }
    }
    return DEFAULT_TETAMU_USER_DOC;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('tmf2_cached_user_doc');
      if (cached) return false;
    }
    return true;
  });

  const [showChoicePopup, setShowChoicePopup] = useState(false);
  const [pendingRegData, setPendingRegData] = useState<any>(null);
  const [googleDriveToken, setGoogleDriveToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('tmf2_google_drive_token');
      const timeStr = localStorage.getItem('tmf2_google_drive_token_time');
      if (token && timeStr) {
        const time = parseInt(timeStr, 10);
        // Google OAuth access tokens expire after 60 minutes (3600 seconds).
        // If older than 50 minutes, discard to prevent 401 UNAUTHENTICATED errors.
        if (Date.now() - time > 50 * 60 * 1000) {
          localStorage.removeItem('tmf2_google_drive_token');
          localStorage.removeItem('tmf2_google_drive_token_time');
          return null;
        }
        return token;
      } else if (token && !timeStr) {
        // Legacy token without timestamp - clear to force a clean, fresh authorization
        localStorage.removeItem('tmf2_google_drive_token');
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (googleDriveToken) {
      localStorage.setItem('tmf2_google_drive_token', googleDriveToken);
      if (!localStorage.getItem('tmf2_google_drive_token_time')) {
        localStorage.setItem('tmf2_google_drive_token_time', Date.now().toString());
      }
    } else {
      localStorage.removeItem('tmf2_google_drive_token');
      localStorage.removeItem('tmf2_google_drive_token_time');
    }
  }, [googleDriveToken]);

  // Save user details to cache whenever they change
  useEffect(() => {
    if (currentUserDoc) {
      localStorage.setItem('tmf2_cached_user_doc', JSON.stringify(currentUserDoc));
    }
  }, [currentUserDoc]);

  useEffect(() => {
    // Only cache real Google authenticated user sessions to prevent destroying cached auth with guest_local
    if (firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local') {
      const minimalFirebaseUser = {
        uid: firebaseUser.uid,
        isAnonymous: false,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        phoneNumber: firebaseUser.phoneNumber
      };
      localStorage.setItem('tmf2_cached_firebase_user', JSON.stringify(minimalFirebaseUser));
    }
  }, [firebaseUser]);

  // Admin list states
  const [allUsers, setAllUsers] = useState<AppUser[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('tmf2_cached_all_users');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error("Gagal membaca cached all users:", e);
        }
      }
    }
    return [];
  });
  const [allApplications, setAllApplications] = useState<MembershipApplication[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [roleLogs, setRoleLogs] = useState<RoleAuditLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const isClearingLogs = useRef(false);

  // Function to log user login events to Firestore loginLogs collection
  const recordLoginLog = async (
    targetUser?: FirebaseUser | null,
    targetProfile?: Partial<AppUser> | null,
    loginMethod: string = 'Google Sign-In'
  ) => {
    const fUser = targetUser || firebaseUser;
    if (!fUser || fUser.isAnonymous || !fUser.email) return;

    try {
      const profile = targetProfile || currentUserDoc;
      const isAppointed = (profile?.approvalStatus === 'Approved' || (profile as any)?.status === 'Diluluskan' || (profile as any)?.status === 'Diluluskan Keahlian') && 
                          (profile?.membershipStatus === 'Aktif' || profile?.membershipStatus === 'Active');
      const role = profile?.role || 'Pelawat';
      const membershipType = profile?.membershipType || 'Tiada';
      const hasRegData = !!(profile?.icNumber && profile?.noRumah);
      const membershipStatus = profile?.membershipStatus || (hasRegData ? 'Menunggu Kelulusan' : 'Bukan Ahli');
      const approvalStatus = profile?.approvalStatus || (hasRegData ? 'Pending' : 'Belum Mohon');

      const loginData = {
        uid: fUser.uid, // Fixed UID in Firebase Auth & Firestore per email
        email: fUser.email,
        displayName: (profile?.displayName || fUser.displayName || 'Pengguna Google').toUpperCase(),
        photoURL: profile?.uploadedProfileImageUrl || profile?.photoURL || profile?.googleProfileImageUrl || fUser.photoURL || null,
        role: role,
        membershipType: membershipType,
        membershipStatus: membershipStatus,
        approvalStatus: approvalStatus,
        isAppointedMember: !!isAppointed,
        memberNo: profile?.memberNo || null,
        noRumah: profile?.noRumah || null,
        phoneNumber: profile?.phoneNumber || fUser.phoneNumber || null,
        loginMethod: loginMethod,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'loginLogs'), loginData);
    } catch (err) {
      console.warn("Gagal merekod loginLog ke Firestore:", err);
    }
  };

  const recordLoginEvent = async (method: string = 'Google Sign-In') => {
    await recordLoginLog(firebaseUser, currentUserDoc, method);
  };

  // Function to log actions to Firestore auditLogs
  const logAction = async (action: string, description: string) => {
    try {
      const performedBy = firebaseUser 
        ? (currentUserDoc?.displayName || firebaseUser.displayName || firebaseUser.email || 'Pengguna Tanpa Nama')
        : 'Sistem Tetamu';
      await addDoc(collection(db, 'auditLogs'), {
        uid: firebaseUser?.uid || 'guest',
        action,
        description,
        performedBy,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Gagal merekod audit log: ", e);
    }
  };

  // Helper to check if email is Super Admin
  const isSuperAdminEmail = (email: string | null) => {
    if (!email) return false;
    const em = email.toLowerCase().trim();
    return em === 'g-59129199@moe-dl.edu.my' || em === 'smaujn9@gmail.com' || em === 'firdaushadi442@gmail.com';
  };

  // Automatically authenticate anonymously on mount if not logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      const isExplicitLogout = typeof window !== 'undefined' && sessionStorage.getItem('tmf2_explicit_logout') === 'true';
      const cachedUserStr = typeof window !== 'undefined' ? localStorage.getItem('tmf2_cached_firebase_user') : null;
      let cachedUserObj: any = null;
      if (cachedUserStr) {
        try {
          cachedUserObj = JSON.parse(cachedUserStr);
        } catch (e) {}
      }
      const hasValidCachedUser = cachedUserObj && !cachedUserObj.isAnonymous && cachedUserObj.uid && cachedUserObj.uid !== 'guest_local';

      // If fUser is anonymous but we have a valid cached authenticated user and no explicit logout, keep the cached user
      if (fUser && fUser.isAnonymous && !isExplicitLogout && hasValidCachedUser) {
        setFirebaseUser(cachedUserObj);
        setLoading(false);
        return;
      }

      if (fUser) {
        setFirebaseUser(fUser);
        // Sync any pending notification subscriptions / tokens
        import('../utils/notificationHelper').then(({ syncPendingNotifications }) => {
          syncPendingNotifications();
        }).catch(err => console.error('Error importing notificationHelper:', err));

        // Fetch or listen to Firestore doc
        const userDocRef = doc(db, 'users', fUser.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as AppUser;
          
          const isUploadedUrl = (url: string | null | undefined) => {
            if (!url) return false;
            return url.startsWith('data:image/') || url.includes('firebasestorage.googleapis.com') || url.includes('/users/');
          };

          const updatePayload: any = {
            lastLoginAt: serverTimestamp(),
            ...(fUser.email && !data.email && { email: fUser.email }),
            ...(fUser.displayName && !data.displayName && { displayName: fUser.displayName })
          };

          // Synchronize latest googleProfileImageUrl from firebase user
          if (fUser.photoURL && data.googleProfileImageUrl !== fUser.photoURL) {
            updatePayload.googleProfileImageUrl = fUser.photoURL;
          }

          // Automatic in-place migration for older user documents or missing fields
          if (data.photoURL && !data.uploadedProfileImageUrl) {
            if (isUploadedUrl(data.photoURL)) {
              updatePayload.uploadedProfileImageUrl = data.photoURL;
            } else if (!data.googleProfileImageUrl) {
              updatePayload.googleProfileImageUrl = fUser.photoURL || data.photoURL;
            }
          }
          if (data.coverURL && !data.uploadedCoverImageUrl) {
            updatePayload.uploadedCoverImageUrl = data.coverURL;
          }

          // Priority resolution for photoURL and coverURL (Backward Compatibility)
          const existingUploadedUrl = data.uploadedProfileImageUrl || updatePayload.uploadedProfileImageUrl;
          let resolvedPhoto: string | null;

          if (existingUploadedUrl) {
            // User has a custom uploaded image - do not replace it with the Google profile photo
            resolvedPhoto = existingUploadedUrl;
          } else if (data.photoURL && isUploadedUrl(data.photoURL)) {
            // If uploadedProfileImageUrl is missing but the existing photoURL is a custom uploaded image
            // This also acts as a race-condition guard: if photoURL is already a Firebase Storage URL,
            // keep it even if uploadedProfileImageUrl hasn't been written yet (timing window during upload)
            resolvedPhoto = data.photoURL;
          } else {
            // No custom uploaded image exists - fallback to Google URL or existing photoURL
            resolvedPhoto = fUser.photoURL || data.photoURL || null;
          }

          // Safety guard 1: Never overwrite photoURL with a lower-priority URL (e.g. Google URL)
          // if the current value in Firestore is already a Firebase Storage / custom-uploaded URL.
          // This prevents a race condition where auth token refresh fires during an image upload,
          // reads stale Firestore data (uploadedProfileImageUrl still null), and then overwrites
          // the photoURL that was just set by the upload operation.
          const currentPhotoIsCustom = isUploadedUrl(data.photoURL);
          const resolvedIsCustom = isUploadedUrl(resolvedPhoto || '');
          const wouldDowngrade = currentPhotoIsCustom && !resolvedIsCustom;

          if (resolvedPhoto !== data.photoURL && !wouldDowngrade) {
            // Safety guard 2: Never set photoURL to null if a value already exists.
            // Only update photoURL if resolvedPhoto is a real URL.
            if (resolvedPhoto) {
              updatePayload.photoURL = resolvedPhoto;
            }
          }

          const resolvedCover = data.uploadedCoverImageUrl || updatePayload.uploadedCoverImageUrl || data.coverURL || null;
          if (resolvedCover !== data.coverURL) {
            updatePayload.coverURL = resolvedCover;
          }

          // Check official roles & auto-heal
          const emailLower = (fUser.email || '').toLowerCase().trim();
          const isSuper = isSuperAdminEmail(fUser.email);
          const isSetiausaha = emailLower === 'setiausahamusytari@gmail.com' || emailLower === 'setiaushamusytari@gmail.com';
          const isBendahari = emailLower === 'bendaharimusytari@gmail.com';
          
          const hasRegData = !!(data.icNumber && data.noRumah);
          const hasMemberNo = !!(data.memberNo && typeof data.memberNo === 'string' && data.memberNo.trim().length > 0);
          const hasApprovedDate = !!data.approvedAt;
          
          let isApproved = data.membershipStatus === 'Aktif' || 
                             data.membershipStatus === 'Active' ||
                             data.membershipStatus === 'Diluluskan' || 
                             data.membershipStatus === 'Diluluskan Keahlian' ||
                             data.approvalStatus === 'Approved' || 
                             data.approvalStatus === 'Diluluskan' || 
                             data.approvalStatus === 'Diluluskan Keahlian' || 
                             hasMemberNo ||
                             hasApprovedDate ||
                             isSuper ||
                             isSetiausaha ||
                              isBendahari ||
                              (data.role && !['Pelawat', 'Tetamu', 'Tiada', 'Penduduk'].includes(data.role));

          let matchingApp: any = null;
          // If not marked approved or missing memberNo, check if an application exists in membershipApplications
          if ((!isApproved || !hasMemberNo) && (emailLower || fUser.uid)) {
            try {
              if (fUser.uid) {
                const directAppSnap = await getDoc(doc(db, 'membershipApplications', `app-${fUser.uid}`));
                if (directAppSnap.exists()) matchingApp = directAppSnap.data();
                if (!matchingApp) {
                  const directRawSnap = await getDoc(doc(db, 'membershipApplications', fUser.uid));
                  if (directRawSnap.exists()) matchingApp = directRawSnap.data();
                }
              }
              if (!matchingApp && emailLower) {
                const qApp = query(collection(db, 'membershipApplications'), where('email', '==', emailLower));
                const snap = await getDocs(qApp);
                if (!snap.empty) matchingApp = snap.docs[0].data();
              }
              if (!matchingApp && fUser.email && fUser.email !== emailLower) {
                const qAppOrig = query(collection(db, 'membershipApplications'), where('email', '==', fUser.email));
                const snapOrig = await getDocs(qAppOrig);
                if (!snapOrig.empty) matchingApp = snapOrig.docs[0].data();
              }
              if (!matchingApp && fUser.uid) {
                const qAppUid = query(collection(db, 'membershipApplications'), where('uid', '==', fUser.uid));
                const snapUid = await getDocs(qAppUid);
                if (!snapUid.empty) matchingApp = snapUid.docs[0].data();
              }
              if (!matchingApp && data.icNumber) {
                const qAppIc = query(collection(db, 'membershipApplications'), where('icNumber', '==', data.icNumber));
                const snapIc = await getDocs(qAppIc);
                if (!snapIc.empty) matchingApp = snapIc.docs[0].data();
              }

              if (matchingApp && (matchingApp.status === 'Diluluskan' || matchingApp.status === 'Diluluskan Keahlian' || matchingApp.status === 'Approved')) {
                isApproved = true;
                if (!data.memberNo && matchingApp.memberNo) {
                  updatePayload.memberNo = matchingApp.memberNo;
                }
                if (matchingApp.noRumah && !data.noRumah) {
                  updatePayload.noRumah = matchingApp.noRumah;
                }
                if (matchingApp.icNumber && !data.icNumber) {
                  updatePayload.icNumber = matchingApp.icNumber;
                }
                if (matchingApp.phone && !data.phoneNumber) {
                  updatePayload.phoneNumber = matchingApp.phone;
                }
                if (matchingApp.name && !data.displayName) {
                  updatePayload.displayName = matchingApp.name;
                }
              }
            } catch (err) {
              console.warn("Ralat semak permohonan keahlian pengguna:", err);
            }
          }

          if (isSuper) {
            updatePayload.role = 'ADMIN UTAMA';
            updatePayload.department = 'Pentadbiran Utama';
            updatePayload.membershipType = 'ADMIN UTAMA';
            updatePayload.membershipStatus = 'Aktif';
            updatePayload.approvalStatus = 'Approved';
            updatePayload.isSuperAdmin = true;
            if (!data.approvedAt) updatePayload.approvedAt = serverTimestamp();
            if (!data.approvedBy) updatePayload.approvedBy = 'Sistem Autolulus';
            if (!data.memberNo && !updatePayload.memberNo) {
              updatePayload.memberNo = await generateNextMemberNo();
            }
            await updateDoc(userDocRef, updatePayload).catch(e => console.warn(e));
          } else if (isSetiausaha) {
            updatePayload.role = 'Setiausaha';
            updatePayload.department = 'Setiausaha';
            updatePayload.membershipType = data.membershipType && data.membershipType !== 'Tiada' ? data.membershipType : 'Ahli Biasa';
            updatePayload.membershipStatus = 'Aktif';
            updatePayload.approvalStatus = 'Approved';
            if (!data.approvedAt) updatePayload.approvedAt = serverTimestamp();
            if (!data.approvedBy) updatePayload.approvedBy = 'Sistem Autolulus';
            if (!data.memberNo && !updatePayload.memberNo) {
              updatePayload.memberNo = await generateNextMemberNo();
            }
            await updateDoc(userDocRef, updatePayload).catch(e => console.warn(e));
          } else if (isBendahari) {
            updatePayload.role = 'Bendahari';
            updatePayload.department = 'Bendahari';
            updatePayload.membershipType = data.membershipType && data.membershipType !== 'Tiada' ? data.membershipType : 'Ahli Biasa';
            updatePayload.membershipStatus = 'Aktif';
            updatePayload.approvalStatus = 'Approved';
            if (!data.approvedAt) updatePayload.approvedAt = serverTimestamp();
            if (!data.approvedBy) updatePayload.approvedBy = 'Sistem Autolulus';
            if (!data.memberNo && !updatePayload.memberNo) {
              updatePayload.memberNo = await generateNextMemberNo();
            }
            await updateDoc(userDocRef, updatePayload).catch(e => console.warn(e));
          } else if (isApproved) {
            // Auto-heal membershipStatus and role for all approved members
            updatePayload.membershipStatus = 'Aktif';
            updatePayload.approvalStatus = 'Approved';
            // If user was previously 'Pelawat' or 'Tetamu' but has been approved, promote to 'Ahli Biasa'
            if (!data.role || data.role === 'Pelawat' || data.role === 'Tetamu' || data.role === 'Penduduk') {
              updatePayload.role = 'Ahli Biasa';
            }
            if (!data.membershipType || data.membershipType === 'Tiada') {
              updatePayload.membershipType = matchingApp?.membershipType || 'Ahli Biasa';
            }
            if (!data.memberNo && !updatePayload.memberNo) {
              updatePayload.memberNo = await generateNextMemberNo();
            }
            await updateDoc(userDocRef, updatePayload).catch(e => console.warn(e));
          } else if (hasRegData) {
            if (data.membershipStatus === 'Ditolak' || data.approvalStatus === 'Rejected') {
              updatePayload.membershipStatus = 'Ditolak';
              updatePayload.approvalStatus = 'Rejected';
            } else if (data.membershipStatus !== 'Aktif' && data.approvalStatus !== 'Approved') {
              updatePayload.membershipStatus = 'Menunggu Kelulusan';
              updatePayload.approvalStatus = 'Pending';
            }
            if (!data.role) {
              updatePayload.role = 'Pelawat';
            }
            if (!data.membershipType) {
              updatePayload.membershipType = 'Tiada';
            }
            await updateDoc(userDocRef, updatePayload).catch(e => console.warn(e));
          } else {
            // Truly a new visitor with no registration data - protect existing active/member status
            const isExistingActiveOrMember = 
              data.membershipStatus === 'Aktif' || 
              data.membershipStatus === 'Diluluskan' ||
              data.membershipStatus === 'Diluluskan Keahlian' ||
              data.approvalStatus === 'Approved' ||
              data.approvalStatus === 'Diluluskan' ||
              data.membershipStatus === 'Menunggu Kelulusan' || 
              hasMemberNo ||
              hasApprovedDate ||
              (data.role && !['Pelawat', 'Tetamu', 'Tiada'].includes(data.role));

            if (!isExistingActiveOrMember) {
              updatePayload.membershipStatus = 'Bukan Ahli';
              updatePayload.approvalStatus = 'Belum Mohon';
              if (!data.role) {
                updatePayload.role = 'Pelawat';
              }
              if (!data.membershipType) {
                updatePayload.membershipType = 'Tiada';
              }
              await updateDoc(userDocRef, updatePayload).catch(e => console.warn(e));
            }
          }
          
          // Set state immediately with merged values for ultra-fast, seamless rendering without empty-state flicker
          const mergedData = {
            ...data,
            ...updatePayload,
            lastLoginAt: data.lastLoginAt || new Date()
          };
          setCurrentUserDoc(mergedData as AppUser);

          // Record login log once per browser session per UID for Google user
          if (fUser.email && !fUser.isAnonymous) {
            const sessionKey = `tmf2_session_logged_${fUser.uid}`;
            if (sessionStorage.getItem(sessionKey) !== 'true') {
              sessionStorage.setItem(sessionKey, 'true');
              recordLoginLog(fUser, mergedData, 'Google Sign-In');
            }
          }

          await logAction('Login', `Log masuk berjaya sebagai ${data.role}`);
          setLoading(false);
        } else {
          // If super admin email, create doc automatically
          if (isSuperAdminEmail(fUser.email)) {
            // SAFETY: Do a second server-forced read inside the transaction to ensure
            // we are not re-creating a document that already exists (stale cache issue).
            // Use setDoc with merge:true so existing image URLs are NEVER overwritten.
            await runTransaction(db, async (transaction) => {
              // Read INSIDE transaction for strong consistency
              const freshSnap = await transaction.get(userDocRef);
              const existingData = freshSnap.exists() ? freshSnap.data() : null;

              let memberNo = existingData?.memberNo;
              if (!memberNo) {
                memberNo = await generateNextMemberNo(transaction);
              }

              const newAdminDoc: Partial<AppUser> = {
                uid: fUser.uid,
                email: fUser.email || '',
                displayName: existingData?.displayName || fUser.displayName || 'Ahli Persatuan',
                // CRITICAL: Preserve existing image URLs — never overwrite with Google URL or null
                photoURL: existingData?.photoURL || existingData?.uploadedProfileImageUrl || fUser.photoURL || null,
                googleProfileImageUrl: fUser.photoURL || existingData?.googleProfileImageUrl || null,
                // Only set uploadedProfileImageUrl if existing doc has one, otherwise leave undefined
                // so Firestore merge does not write null over an existing value
                ...(existingData?.uploadedProfileImageUrl
                  ? { uploadedProfileImageUrl: existingData.uploadedProfileImageUrl }
                  : {}),
                ...(existingData?.uploadedCoverImageUrl
                  ? { uploadedCoverImageUrl: existingData.uploadedCoverImageUrl }
                  : {}),
                phoneNumber: existingData?.phoneNumber || '',
                role: 'ADMIN UTAMA',
                department: existingData?.department || 'Pentadbiran Utama',
                membershipType: existingData?.membershipType || 'ADMIN UTAMA',
                membershipStatus: existingData?.membershipStatus || 'Aktif',
                approvalStatus: 'Approved',
                isSuperAdmin: true,
                memberNo: memberNo,
                createdAt: existingData?.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
                registeredAt: existingData?.registeredAt || serverTimestamp(),
                approvedAt: existingData?.approvedAt || serverTimestamp(),
                approvedBy: existingData?.approvedBy || 'Sistem Autolulus',
                lastLoginAt: serverTimestamp(),
                residenceCity: existingData?.residenceCity || 'Batu Kikir',
                negeri: existingData?.negeri || 'Negeri Sembilan',
                hometown: existingData?.hometown || 'Negeri Sembilan',
                jobRole1: existingData?.jobRole1 || 'Warga Sekolah / PIBG',
                jobDetails1: existingData?.jobDetails1 || 'SMA Ulu Jempol (SMAUJ) - 2026 - Sekarang',
                jobRole2: existingData?.jobRole2 || 'Admin Utama',
                jobDetails2: existingData?.jobDetails2 || 'Jawatan Rasmi'
              };
              // Use merge:true — this NEVER overwrites existing fields not in the payload,
              // protecting uploadedProfileImageUrl from being silently reset.
              transaction.set(userDocRef, newAdminDoc, { merge: true });
            });
            const freshDoc = await getDoc(userDocRef);
            setCurrentUserDoc(freshDoc.data() as AppUser);
            await logAction('Login', 'Cipta / Kemaskini & Log masuk sebagai Super Admin Utama');
            setLoading(false);
          } else {
            // New user without doc (could be anonymous, or brand new Google login)
            if (fUser.isAnonymous) {
              // Anonymous guest account automatically receives TETAMU role
              setCurrentUserDoc(DEFAULT_TETAMU_USER_DOC);
              setLoading(false);
            } else {
              // Google user with no Firestore doc yet!
              // Check if this Google user already has an application in membershipApplications by UID or email
              let foundExisting = false;
              try {
                let appDoc: any = null;
                let appData: any = null;

                // 1. Check direct deterministic ID
                if (fUser.uid) {
                  const directAppSnap = await getDoc(doc(db, 'membershipApplications', `app-${fUser.uid}`));
                  if (directAppSnap.exists()) {
                    appDoc = directAppSnap;
                    appData = directAppSnap.data();
                  } else {
                    const directRawAppSnap = await getDoc(doc(db, 'membershipApplications', fUser.uid));
                    if (directRawAppSnap.exists()) {
                      appDoc = directRawAppSnap;
                      appData = directRawAppSnap.data();
                    }
                  }
                }

                // 2. Check query by UID in membershipApplications
                if (!appData && fUser.uid) {
                  const qAppUid = query(collection(db, 'membershipApplications'), where('uid', '==', fUser.uid));
                  const appUidSnap = await getDocs(qAppUid);
                  if (!appUidSnap.empty) {
                    appDoc = appUidSnap.docs[0];
                    appData = appDoc.data();
                  }
                }

                // 3. Check by email lowercase
                if (!appData && fUser.email) {
                  const qApp = query(collection(db, 'membershipApplications'), where('email', '==', fUser.email.toLowerCase()));
                  const appSnap = await getDocs(qApp);
                  if (!appSnap.empty) {
                    appDoc = appSnap.docs[0];
                    appData = appDoc.data();
                  }
                }

                // 4. Check by email original case if different
                if (!appData && fUser.email && fUser.email !== fUser.email.toLowerCase()) {
                  const qApp2 = query(collection(db, 'membershipApplications'), where('email', '==', fUser.email));
                  const appSnap2 = await getDocs(qApp2);
                  if (!appSnap2.empty) {
                    appDoc = appSnap2.docs[0];
                    appData = appDoc.data();
                  }
                }

                // 5. Check if an existing user record exists with matching email
                let existingUserWithEmail: any = null;
                if (!appData && fUser.email) {
                  const qUser = query(collection(db, 'users'), where('email', '==', fUser.email.toLowerCase()));
                  const uSnap = await getDocs(qUser);
                  if (!uSnap.empty) {
                    existingUserWithEmail = uSnap.docs[0].data();
                  }
                }

                // 6. Direct server verification of userDocRef before assuming absent
                if (!appData && !existingUserWithEmail) {
                  const serverVerifySnap = await getDoc(userDocRef);
                  if (serverVerifySnap.exists()) {
                    existingUserWithEmail = serverVerifySnap.data();
                  }
                }

                if (appData || existingUserWithEmail) {
                  const src = { ...appData, ...existingUserWithEmail };
                  const hasRegisteredData = !!(src.icNumber && src.noRumah);
                  const emailVal = (fUser.email || src.email || '').toLowerCase().trim();
                  const isUserSuper = isSuperAdminEmail(emailVal);
                  const isUserSetia = emailVal === 'setiausahamusytari@gmail.com' || emailVal === 'setiaushamusytari@gmail.com';
                  const isUserBenda = emailVal === 'bendaharimusytari@gmail.com';

                  const isApproved = (
                    src.status === 'Diluluskan' || 
                    src.status === 'Diluluskan Keahlian' || 
                    src.membershipStatus === 'Aktif' || 
                    src.membershipStatus === 'Diluluskan' || 
                    src.approvalStatus === 'Approved' || 
                    src.approvalStatus === 'Diluluskan' || 
                    Boolean(src.memberNo && String(src.memberNo).trim()) ||
                    Boolean(src.approvedAt) ||
                    isUserSuper ||
                    isUserSetia ||
                    isUserBenda
                  );
                  const isRejected = (src.status === 'Rejected' || src.status === 'Ditolak' || src.membershipStatus === 'Ditolak');

                  let finalMembershipStatus = 'Bukan Ahli';
                  let finalApprovalStatus = 'Belum Mohon';

                  if (isApproved) {
                    finalMembershipStatus = 'Aktif';
                    finalApprovalStatus = 'Approved';
                  } else if (isRejected) {
                    finalMembershipStatus = 'Ditolak';
                    finalApprovalStatus = 'Rejected';
                  } else if (hasRegisteredData || appData) {
                    finalMembershipStatus = 'Menunggu Kelulusan';
                    finalApprovalStatus = 'Pending';
                  }

                  let resolvedRole = src.role || 'Pelawat';
                  if (isUserSuper) {
                    resolvedRole = 'Admin Utama';
                  } else if (isUserSetia) {
                    resolvedRole = 'Setiausaha';
                  } else if (isUserBenda) {
                    resolvedRole = 'Bendahari';
                  } else if (isApproved && (!resolvedRole || resolvedRole === 'Pelawat' || resolvedRole === 'Tetamu')) {
                    resolvedRole = 'Ahli Biasa';
                  }

                  let memberNo = src.memberNo;
                  if (isApproved && !memberNo) {
                    memberNo = await generateNextMemberNo();
                  }

                  const restoredUserDoc: AppUser = {
                    uid: fUser.uid,
                    email: fUser.email || src.email || '',
                    displayName: (src.name || src.displayName || fUser.displayName || 'Pemohon').toUpperCase(),
                    nickname: src.nickname || '',
                    icNumber: src.icNumber || '',
                    phoneNumber: src.phone || src.phoneNumber || '',
                    noRumah: src.noRumah || '',
                    address: src.address || '',
                    poskod: src.poskod || '72200',
                    bandar: src.bandar || 'Batu Kikir',
                    negeri: src.negeri || 'Negeri Sembilan',
                    statusKediaman: ((existingUserWithEmail?.statusKediaman || appData?.statusKediaman || '').toLowerCase().includes('penyewa')) ? 'Penyewa' : 'Pemilik',
                    namaPemilikRumah: existingUserWithEmail?.namaPemilikRumah !== undefined ? existingUserWithEmail.namaPemilikRumah : (appData?.namaPemilikRumah || ''),
                    noTelPemilikRumah: existingUserWithEmail?.noTelPemilikRumah !== undefined ? existingUserWithEmail.noTelPemilikRumah : (appData?.noTelPemilikRumah || ''),
                    bilanganIsiRumah: Number(src.bilanganIsiRumah || 1),
                    bilanganTanggungan: Number(src.bilanganTanggungan || 0),
                    senaraiAhliKeluarga: src.senaraiAhliKeluarga || [],
                    photoURL: fUser.photoURL || src.photoURL || null,
                    googleProfileImageUrl: fUser.photoURL || null,
                    role: resolvedRole,
                    department: isUserBenda ? 'Bendahari' : isUserSetia ? 'Setiausaha' : (src.department || undefined),
                    membershipType: isApproved && (!src.membershipType || src.membershipType === 'Tiada') ? 'Ahli Biasa' : (src.membershipType || 'Tiada'),
                    membershipStatus: finalMembershipStatus,
                    approvalStatus: finalApprovalStatus,
                    isSuperAdmin: isUserSuper,
                    memberNo: memberNo || undefined,
                    approvedAt: src.approvedAt || (isApproved ? serverTimestamp() : undefined),
                    approvedBy: src.approvedBy || (isApproved ? 'Sistem Autolulus' : undefined),
                    createdAt: src.createdAt || serverTimestamp(),
                    registeredAt: src.submittedAt || src.registeredAt || serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastLoginAt: serverTimestamp()
                  };

                  await setDoc(userDocRef, restoredUserDoc, { merge: true });
                  if (appDoc && appData && appData.uid !== fUser.uid) {
                    await updateDoc(doc(db, 'membershipApplications', appDoc.id), { uid: fUser.uid }).catch(() => {});
                  }
                  setCurrentUserDoc(restoredUserDoc);
                  localStorage.setItem('tmf2_cached_user_doc', JSON.stringify(restoredUserDoc));
                  foundExisting = true;
                }
              } catch (e) {
                console.warn("Ralat semak padanan permohonan keahlian pengguna baharu:", e);
              }

              if (!foundExisting) {
                // Double check if doc already exists in Firestore before writing visitor doc
                const checkExistingSnap = await getDoc(userDocRef).catch(() => null);
                if (checkExistingSnap && checkExistingSnap.exists()) {
                  const existingData = checkExistingSnap.data() as AppUser;
                  setCurrentUserDoc(existingData);
                  localStorage.setItem('tmf2_cached_user_doc', JSON.stringify(existingData));
                } else {
                  // Initialize default user document in Firestore so their profile exists immediately
                  const newEmailLower = (fUser.email || '').toLowerCase().trim();
                  const isNewSuper = isSuperAdminEmail(fUser.email);
                  const isNewSetia = newEmailLower === 'setiausahamusytari@gmail.com' || newEmailLower === 'setiaushamusytari@gmail.com';
                  const isNewBenda = newEmailLower === 'bendaharimusytari@gmail.com';

                  // Check if user is listed in senaraiAhliKeluarga of an approved house
                  let householdOwner: any = null;
                  const userDisplayNameNorm = (fUser.displayName || '').trim().toLowerCase();
                  if (userDisplayNameNorm.length >= 3) {
                    for (const existingU of allUsers) {
                      if (existingU.senaraiAhliKeluarga && Array.isArray(existingU.senaraiAhliKeluarga) && (existingU.membershipStatus === 'Aktif' || existingU.approvalStatus === 'Approved')) {
                        const matched = existingU.senaraiAhliKeluarga.find((m: any) => {
                          const mName = (m.nama || m.name || '').trim().toLowerCase();
                          return mName && (mName === userDisplayNameNorm || (mName.length > 4 && userDisplayNameNorm.includes(mName)) || (userDisplayNameNorm.length > 4 && mName.includes(userDisplayNameNorm)));
                        });
                        if (matched) {
                          householdOwner = existingU;
                          break;
                        }
                      }
                    }
                  }

                  const isHouseholdAhli = Boolean(householdOwner);

                  const newVisitorDoc: AppUser = {
                    uid: fUser.uid,
                    email: fUser.email || '',
                    displayName: (fUser.displayName || (isNewSuper ? 'ADMIN UTAMA' : isNewSetia ? 'Setiausaha' : isNewBenda ? 'Bendahari' : 'Pengguna Google')).toUpperCase(),
                    photoURL: fUser.photoURL || null,
                    googleProfileImageUrl: fUser.photoURL || null,
                    phoneNumber: fUser.phoneNumber || '',
                    role: isNewSuper ? 'ADMIN UTAMA' : isNewSetia ? 'Setiausaha' : isNewBenda ? 'Bendahari' : isHouseholdAhli ? 'IBU BAPA' : 'TETAMU',
                    department: isNewBenda || isNewSuper ? 'Pentadbiran Utama' : isNewSetia ? 'Setiausaha' : undefined,
                    membershipType: isNewSuper ? 'ADMIN UTAMA' : (isNewSetia || isNewBenda || isHouseholdAhli) ? 'Ahli Biasa' : 'TETAMU',
                    membershipStatus: (isNewSuper || isNewSetia || isNewBenda || isHouseholdAhli) ? 'Aktif' : 'Bukan Ahli',
                    approvalStatus: (isNewSuper || isNewSetia || isNewBenda || isHouseholdAhli) ? 'Approved' : 'Belum Mohon',
                    noRumah: householdOwner?.noRumah || '',
                    address: householdOwner?.address || '',
                    poskod: householdOwner?.poskod || '72200',
                    bandar: householdOwner?.bandar || 'Batu Kikir',
                    negeri: householdOwner?.negeri || 'Negeri Sembilan',
                    statusKediaman: householdOwner?.statusKediaman || 'Pemilik',
                    isHouseholdMember: isHouseholdAhli,
                    householdOwnerUid: householdOwner?.uid || undefined,
                    householdOwnerName: householdOwner?.displayName || undefined,
                    isSuperAdmin: isNewSuper,
                    approvedBy: isHouseholdAhli ? `Autolulus (Isi Rumah No. ${householdOwner.noRumah || '-'})` : (isNewSuper || isNewSetia || isNewBenda ? 'Sistem Autolulus' : undefined),
                    approvedAt: (isNewSuper || isNewSetia || isNewBenda || isHouseholdAhli) ? serverTimestamp() : undefined,
                    createdAt: serverTimestamp(),
                    registeredAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastLoginAt: serverTimestamp()
                  };

                  try {
                    await setDoc(userDocRef, newVisitorDoc, { merge: true });
                  } catch (err) {
                    console.warn("Gagal mencipta dokumen pengguna baharu di Firestore:", err);
                  }

                  setCurrentUserDoc(newVisitorDoc);
                  localStorage.setItem('tmf2_cached_user_doc', JSON.stringify(newVisitorDoc));

                  // Store temp register data
                  const registerData = {
                    uid: fUser.uid,
                    email: fUser.email,
                    displayName: fUser.displayName,
                    photoURL: fUser.photoURL,
                    phoneNumber: fUser.phoneNumber
                  };
                  setPendingRegData(registerData);
                }
              }
              setLoading(false);
            }
          }
        }
      } else {
        // Check if an explicit logout was performed by the user
        const isExplicitLogout = typeof window !== 'undefined' && sessionStorage.getItem('tmf2_explicit_logout') === 'true';
        const cachedUserStr = typeof window !== 'undefined' ? localStorage.getItem('tmf2_cached_firebase_user') : null;
        let cachedUserObj: any = null;
        if (cachedUserStr) {
          try {
            cachedUserObj = JSON.parse(cachedUserStr);
          } catch (e) {}
        }

        const hasValidCachedUser = cachedUserObj && !cachedUserObj.isAnonymous && cachedUserObj.uid && cachedUserObj.uid !== 'guest_local';

        // Only transition to guest_local if user explicitly logged out or never had an authenticated account
        if (isExplicitLogout || !hasValidCachedUser) {
          setFirebaseUser({
            uid: 'guest_local',
            isAnonymous: true,
            displayName: 'TETAMU',
            email: null,
            photoURL: null,
            phoneNumber: null
          } as any);
          setCurrentUserDoc(DEFAULT_TETAMU_USER_DOC);
        } else {
          // If a transient token refresh or background tab suspension occurred, keep session alive
          console.warn("[Auth] onAuthStateChanged received null but valid session exists in cache. Preserving session to prevent accidental auto-logout.");
          setFirebaseUser(auth.currentUser || cachedUserObj);
        }
        
        const choseTetamu = localStorage.getItem('tmf2_chose_tetamu') === 'true';
        const guestChosen = localStorage.getItem('tmf2_guest_chosen') === 'true';
        if (!choseTetamu && !guestChosen) {
          setShowChoicePopup(false);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Proactive Keep-Alive & Token Refresh Heartbeat:
  // Proactively refreshes Firebase ID token every 8 minutes and on window focus/tab visibility.
  // This guarantees that sessions never silently expire or log out during desktop mode usage.
  useEffect(() => {
    if (!firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid === 'guest_local') return;

    const handleFocus = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(false);
          console.log("[Auth Keep-Alive] Sesi disahkan semasa fokus tab.");
        }
      } catch (err) {
        console.warn("[Auth Keep-Alive] Amaran kemas kini token fokus:", err);
      }
    };

    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);

    // Heartbeat every 8 minutes
    const interval = setInterval(async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
          console.log("[Auth Keep-Alive] Pembaharuan token berkala berjaya.");
        }
      } catch (err) {
        console.warn("[Auth Keep-Alive] Amaran pembaharuan token berkala:", err);
      }
    }, 8 * 60 * 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [firebaseUser?.uid]);

  // Set up real-time listener for the logged-in user's Firestore document
  useEffect(() => {
    if (!firebaseUser || firebaseUser.uid === 'guest_local') {
      const isExplicitLogout = typeof window !== 'undefined' && sessionStorage.getItem('tmf2_explicit_logout') === 'true';
      const hasCachedDoc = typeof window !== 'undefined' && !!localStorage.getItem('tmf2_cached_user_doc');
      if (isExplicitLogout || !hasCachedDoc) {
        setCurrentUserDoc(DEFAULT_TETAMU_USER_DOC);
      }
      return;
    }

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubDoc = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppUser;
        setCurrentUserDoc(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('tmf2_cached_user_doc', JSON.stringify(data));
        }
      } else {
        // If the document doesn't exist yet, we don't clear current user doc if we've set a temporary guest profile in UI
      }
    }, (error) => {
      console.error("Ralat melanggan dokumen pengguna:", error);
    });

    return () => unsubDoc();
  }, [firebaseUser?.uid]);

  // Set up real-time listener for all users (accessible to all logged-in users and guests)
  useEffect(() => {
    if (!db) return;

    const FIXED_SETIAUSAHA_UID = 'zQ8mK2pL4vR9wN1yT3bJ6hC0sD5x';
    const q = collection(db, 'users');

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const usersList: AppUser[] = [];
      const seenEmails = new Set<string>();
      const seenUids = new Set<string>();
      
      for (const docSnap of snapshot.docs) {
        const u = docSnap.data() as AppUser;
        const docId = docSnap.id;
        const emailLower = (u.email || '').toLowerCase().trim();
        const isSetiausaha = emailLower === 'setiausahamusytari@gmail.com' || emailLower === 'setiaushamusytari@gmail.com' || docId.includes('setia') || u.uid?.includes('setia');

        // Delete legacy dummy doc IDs
        if (docId === 'user-setiaushamusytari' || docId === 'user-setiausahamusytari') {
          deleteDoc(doc(db, 'users', docId)).catch(() => {});
          continue;
        }

        // Clean up duplicate setiausaha docs if not the canonical FIXED_SETIAUSAHA_UID
        if (isSetiausaha && docId !== FIXED_SETIAUSAHA_UID && docId.startsWith('user-')) {
          deleteDoc(doc(db, 'users', docId)).catch(() => {});
          continue;
        }

        // Canonical ID for Setiausaha if not logged in with real Google UID
        const effectiveUid = isSetiausaha ? (docId.length === 28 ? docId : FIXED_SETIAUSAHA_UID) : (u.uid || docId);

        // Deduplication guard by email
        if (emailLower) {
          if (seenEmails.has(emailLower)) {
            continue;
          }
          seenEmails.add(emailLower);
        }

        // Deduplication guard by UID
        if (seenUids.has(effectiveUid)) {
          continue;
        }
        seenUids.add(effectiveUid);

        usersList.push({
          ...u,
          uid: effectiveUid,
          ...(isSetiausaha ? { email: 'setiausahamusytari@gmail.com', role: 'Setiausaha' } : {})
        });
      }

      setAllUsers(usersList);
      if (typeof window !== 'undefined' && usersList.length > 0) {
        try {
          localStorage.setItem('tmf2_cached_all_users', JSON.stringify(usersList));
        } catch (e) {
          // ignore quota
        }
      }
    }, (error) => {
      console.warn("Ralat akses senarai pengguna:", error);
    });

    return () => unsubscribe();
  }, []);

  // Set up real-time listener for all applications (Admin & Setiausaha only)
  useEffect(() => {
    if (!currentUserDoc) {
      setAllApplications([]);
      return;
    }

    const rolesWithViewAccess = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'];
    if (!rolesWithViewAccess.includes(currentUserDoc.role) && !currentUserDoc.isSuperAdmin) {
      if (!firebaseUser || firebaseUser.isAnonymous) {
        setAllApplications([]);
        return;
      }

      // Non-admins still receive their own application in real-time so their approval status is 100% synced
      const userUid = firebaseUser.uid;
      const userEmail = (firebaseUser.email || currentUserDoc.email || '').toLowerCase().trim();

      const unsubscribeOwn = onSnapshot(doc(db, 'membershipApplications', `app-${userUid}`), async (docSnap) => {
        if (docSnap.exists()) {
          setAllApplications([{ id: docSnap.id, ...docSnap.data() } as MembershipApplication]);
        } else {
          // Fallback query by email if app id is different
          if (userEmail) {
            try {
              const qOwn = query(collection(db, 'membershipApplications'), where('email', '==', userEmail));
              const snap = await getDocs(qOwn);
              if (!snap.empty) {
                setAllApplications(snap.docs.map(d => ({ id: d.id, ...d.data() } as MembershipApplication)));
                return;
              }
            } catch (e) {
              console.warn("Ralat muat permohonan keahlian kendiri:", e);
            }
          }
          setAllApplications([]);
        }
      }, () => {
        setAllApplications([]);
      });

      return () => unsubscribeOwn();
    }

    const q = collection(db, 'membershipApplications');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsList: MembershipApplication[] = [];
      const seenAppEmails = new Set<string>();

      snapshot.forEach((docSnap) => {
        const appData = { id: docSnap.id, ...docSnap.data() } as MembershipApplication;
        if (!appData.name && !appData.uid && !appData.email) {
          deleteDoc(doc(db, 'membershipApplications', docSnap.id)).catch(() => {});
          return;
        }
        const appEmail = (appData.email || '').toLowerCase().trim();
        if (appEmail) {
          if (seenAppEmails.has(appEmail)) {
            // Delete duplicate application from Firestore
            deleteDoc(doc(db, 'membershipApplications', docSnap.id)).catch(() => {});
            return;
          }
          seenAppEmails.add(appEmail);
        }
        appsList.push(appData);
      });

      setAllApplications(appsList);
    }, (err) => {
      console.warn("Ralat akses senarai permohonan keahlian:", err);
    });

    return () => unsubscribe();
  }, [currentUserDoc, firebaseUser]);

  // Audit Logs listener
  useEffect(() => {
    if (!currentUserDoc) {
      setAuditLogs([]);
      return;
    }

    const rolesWithViewAccess = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'];
    if (!rolesWithViewAccess.includes(currentUserDoc.role) && !currentUserDoc.isSuperAdmin) {
      setAuditLogs([]);
      return;
    }

    const q = collection(db, 'auditLogs');
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const logsList: AuditLog[] = [];
      snapshot.forEach((doc) => {
        logsList.push({ id: doc.id, ...doc.data() } as AuditLog);
      });

      // Check if audit logs reached 500
      if (logsList.length >= 500 && !isClearingLogs.current) {
        isClearingLogs.current = true;
        try {
          const batch = writeBatch(db);
          logsList.forEach((log) => {
            batch.delete(doc(db, 'auditLogs', log.id));
          });
          await batch.commit();

          // Log system clear event
          await addDoc(collection(db, 'auditLogs'), {
            uid: 'system',
            action: 'SISTEM',
            description: 'Audit Log Tindakan telah dipadam semua log tindakan secara automatik kerana telah mencapai had maksimum 500 log. Sistem bermula semula dari 0.',
            performedBy: 'Sistem Auto-Padam',
            timestamp: serverTimestamp()
          });

          // Refresh the page to start clean from 0/1
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (err) {
          console.error("Gagal auto padam audit logs:", err);
          isClearingLogs.current = false;
        }
        return;
      }

      // Sort client-side by timestamp descending
      logsList.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setAuditLogs(logsList);
    }, (err) => {
      console.warn("Ralat akses senarai audit log:", err);
    });

    return () => unsubscribe();
  }, [currentUserDoc, firebaseUser]);

  // Roles audit log listener
  useEffect(() => {
    if (!currentUserDoc) {
      setRoleLogs([]);
      return;
    }

    const rolesWithViewAccess = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'];
    if (!rolesWithViewAccess.includes(currentUserDoc.role) && !currentUserDoc.isSuperAdmin) {
      setRoleLogs([]);
      return;
    }

    const q = collection(db, 'roles');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsList: RoleAuditLog[] = [];
      snapshot.forEach((doc) => {
        logsList.push({ id: doc.id, ...doc.data() } as RoleAuditLog);
      });
      logsList.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setRoleLogs(logsList);
    }, (err) => {
      console.warn("Ralat akses senarai log peranan:", err);
    });

    return () => unsubscribe();
  }, [currentUserDoc, firebaseUser]);

  // Login logs listener (Admin & AJK view)
  useEffect(() => {
    if (!currentUserDoc) {
      setLoginLogs([]);
      return;
    }

    const rolesWithViewAccess = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'];
    if (!rolesWithViewAccess.includes(currentUserDoc.role) && !currentUserDoc.isSuperAdmin) {
      setLoginLogs([]);
      return;
    }

    const q = collection(db, 'loginLogs');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsList: LoginLog[] = [];
      snapshot.forEach((docSnap) => {
        logsList.push({ id: docSnap.id, ...docSnap.data() } as LoginLog);
      });

      // Sort client-side by timestamp descending
      logsList.sort((a, b) => {
        const timeA = a.timestamp?.seconds || (a.timestamp?.toMillis ? a.timestamp.toMillis() / 1000 : 0) || (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() / 1000 : 0);
        const timeB = b.timestamp?.seconds || (b.timestamp?.toMillis ? b.timestamp.toMillis() / 1000 : 0) || (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() / 1000 : 0);
        return timeB - timeA;
      });

      setLoginLogs(logsList);
    }, (err) => {
      console.warn("Ralat akses senarai log masuk pengguna:", err);
    });

    return () => unsubscribe();
  }, [currentUserDoc]);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tmf2_explicit_logout');
        sessionStorage.setItem('tmf2_login_prompt_dismissed', 'true');
        localStorage.setItem('tmf2_login_prompt_dismissed', 'true');
        localStorage.removeItem('tmf2_chose_tetamu');
        localStorage.removeItem('tmf2_guest_chosen');
      }
      const result = await signInWithPopup(auth, googleProvider);

      // Record login log directly upon Google popup sign in
      const fUser = result.user;
      if (fUser) {
        const userDocRef = doc(db, 'users', fUser.uid);
        const docSnap = await getDoc(userDocRef);
        const existingData = docSnap.exists() ? (docSnap.data() as AppUser) : null;
        
        sessionStorage.setItem(`tmf2_session_logged_${fUser.uid}`, 'true');
        await recordLoginLog(fUser, existingData, 'Google Sign-In');

        if (!docSnap.exists()) {
          const messageText = `
🔑 *LOG MASUK GOOGLE BAHARU* 🔑

👤 *Nama:* ${fUser.displayName || 'Tiada Nama'}
📧 *Emel:* ${fUser.email || 'Tiada Emel'}
🆔 *UID:* ${fUser.uid}
ℹ️ *Status:* Log masuk akaun Google (Pengguna belum melengkapkan Profil SMAUJ)

📅 *Tarikh & Masa:* ${new Date().toLocaleString('ms-MY')}
`.trim();
          sendTelegramMessage(messageText).catch(err => {
            console.error("Gagal menghantar notifikasi Telegram log masuk:", err);
          });
        }
      }
    } catch (e: any) {
      setLoading(false);
      // If user closed the popup or popup was blocked, handle gracefully without logging an error
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request') {
        console.info("Log masuk Google dibatalkan oleh pengguna.");
        return;
      }
      console.error("Gagal log masuk Google: ", e);
      throw e;
    }
  };

  const connectGoogleDrive = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleDriveProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleDriveToken(credential.accessToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('tmf2_google_drive_token_time', Date.now().toString());
        }
        return credential.accessToken;
      }
      return null;
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request') {
        console.info("Penyambungan Google Drive dibatalkan oleh pengguna.");
        return null;
      }
      console.error("Gagal menyambung ke Google Drive: ", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tmf2_explicit_logout', 'true');
      }
      // 1. Log action with timeout so logout is never blocked by slow network
      try {
        await Promise.race([
          logAction('Logout', 'Log keluar dari sistem'),
          new Promise((resolve) => setTimeout(resolve, 800))
        ]);
      } catch (logErr) {
        console.warn("Audit log logout gagal:", logErr);
      }

      // 2. Sign out from Firebase Auth
      try {
        if (auth) {
          await signOut(auth);
        }
      } catch (signOutErr) {
        console.warn("signOut error:", signOutErr);
      }
      
      // 3. Clear current state and preferences
      setCurrentUserDoc(DEFAULT_TETAMU_USER_DOC);
      setGoogleDriveToken(null);
      setFirebaseUser({
        uid: 'guest_local',
        isAnonymous: true,
        displayName: 'TETAMU',
        email: null,
        photoURL: null,
        phoneNumber: null
      } as any);

      // 4. Clear all local auth caches
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('tmf2_cached_user_doc');
          localStorage.removeItem('tmf2_cached_firebase_user');
          localStorage.removeItem('tmf2_chose_tetamu');
          localStorage.removeItem('tmf2_guest_chosen');
          localStorage.removeItem('tmf2_google_drive_token');
          localStorage.removeItem('tmf2_google_drive_token_time');
          sessionStorage.clear();
        } catch (e) {
          console.warn("Gagal memadam storage:", e);
        }
      }
      
      // 5. Clear all local caches with a tight timeout
      try {
        const { clearAllLocalCaches } = await import('../utils/imageUtils');
        await Promise.race([
          clearAllLocalCaches(false),
          new Promise((resolve) => setTimeout(resolve, 800))
        ]);
      } catch (cacheErr) {
        console.warn("Gagal membersihkan semua cache semasa logout:", cacheErr);
      }
      
      // 6. Reload page to start with a completely fresh state
      window.location.reload();
    } catch (e) {
      console.error("Gagal log keluar: ", e);
      setCurrentUserDoc(null);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('tmf2_cached_user_doc');
          localStorage.removeItem('tmf2_cached_firebase_user');
          localStorage.removeItem('tmf2_chose_tetamu');
          localStorage.removeItem('tmf2_guest_chosen');
        } catch (err) {}
      }
      window.location.reload();
    }
  };

  const signInAsGuest = async () => {
    try {
      setLoading(true);
      localStorage.setItem('tmf2_chose_tetamu', 'true');
      localStorage.setItem('tmf2_guest_chosen', 'true');
      setShowChoicePopup(false);
      
      if (!firebaseUser || firebaseUser.uid === 'guest_local') {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.warn("Menggunakan mod tetamu tempatan (tidak dapat menghubungi Firebase Auth):", err);
          setFirebaseUser({
            uid: 'guest_local',
            isAnonymous: true,
            displayName: 'Tetamu',
            email: null,
            photoURL: null,
            phoneNumber: null
          } as any);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Gagal log masuk tetamu: ", err);
      setLoading(false);
    }
  };

  const handleChoice = async (choice: 'tetamu' | 'daftar') => {
    if (choice === 'tetamu') {
      localStorage.setItem('tmf2_chose_tetamu', 'true');
      setShowChoicePopup(false);
      
      // If they are a Google user who chose guest, we check if they already have a user doc.
      // If they do, we do not overwrite their profile or reset image URLs! We just update lastLoginAt.
      if (firebaseUser && !firebaseUser.isAnonymous) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
          const existingData = docSnap.data() as AppUser;
          await updateDoc(userDocRef, {
            lastLoginAt: serverTimestamp()
          });
          setCurrentUserDoc(existingData);
        } else {
          // SAFETY: Re-read from server before creating to guard against stale cache returning exists=false.
          // Use setDoc with merge:true to NEVER overwrite existing image URL fields.
          const serverSnap = await getDoc(userDocRef);
          const existingPelawat = serverSnap.exists() ? serverSnap.data() : null;

          const newPelawatDoc: Partial<AppUser> = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: existingPelawat?.displayName || firebaseUser.displayName || 'Pengguna Google',
            // Preserve existing image URLs; only fall back to Google URL if nothing else exists
            photoURL: existingPelawat?.uploadedProfileImageUrl || existingPelawat?.photoURL || firebaseUser.photoURL || null,
            googleProfileImageUrl: firebaseUser.photoURL || existingPelawat?.googleProfileImageUrl || null,
            // Never write null for image fields — omit them so existing values survive the merge
            ...(existingPelawat?.uploadedProfileImageUrl
              ? { uploadedProfileImageUrl: existingPelawat.uploadedProfileImageUrl }
              : {}),
            ...(existingPelawat?.uploadedCoverImageUrl
              ? { uploadedCoverImageUrl: existingPelawat.uploadedCoverImageUrl }
              : {}),
            phoneNumber: existingPelawat?.phoneNumber || '',
            role: existingPelawat?.role || 'Pelawat',
            membershipType: existingPelawat?.membershipType || 'Tiada',
            membershipStatus: existingPelawat?.membershipStatus || 'Belum Berdaftar',
            approvalStatus: existingPelawat?.approvalStatus || 'Belum Mohon',
            isSuperAdmin: isSuperAdminEmail(firebaseUser.email),
            createdAt: existingPelawat?.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            residenceCity: existingPelawat?.residenceCity || 'Batu Kikir',
            negeri: existingPelawat?.negeri || 'Negeri Sembilan',
            hometown: existingPelawat?.hometown || 'Negeri Sembilan',
            jobRole1: existingPelawat?.jobRole1 || 'Ahli Persatuan',
            jobDetails1: existingPelawat?.jobDetails1 || 'SMA Ulu Jempol (SMAUJ) - 2026 - Sekarang',
            jobRole2: existingPelawat?.jobRole2 || '',
            jobDetails2: existingPelawat?.jobDetails2 || ''
          };
          // merge:true = never wipe existing fields in Firestore
          await setDoc(userDocRef, newPelawatDoc, { merge: true });
          const mergedPelawat = serverSnap.exists()
            ? { ...existingPelawat, ...newPelawatDoc }
            : newPelawatDoc;
          setCurrentUserDoc(mergedPelawat as AppUser);
        }
        await logAction('Daftar Tetamu', 'Memilih menjadi Tetamu/Pelawat');
      }
    } else {
      // Go to membership signup
      setShowChoicePopup(false);
      // Let the main views handle rendering of 'daftar-ahli' view
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tmf2_switch_view', { detail: 'daftar-ahli' }));
      }
    }
  };

  // Submit membership application
  const submitMembershipApplication = async (formData: any) => {
    if (!firebaseUser) throw new Error("Pengguna tidak ditemui.");
    
    // Create or update current user document
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    
    // Fetch the latest user doc directly from Firestore to ensure no cache or state race-condition issues can wipe out custom profile images
    const docSnap = await getDoc(userDocRef);
    const latestUserDoc = docSnap.exists() ? (docSnap.data() as AppUser) : null;
    
    const existingMemberNo = latestUserDoc?.memberNo || currentUserDoc?.memberNo;
    const isAlreadyApproved = latestUserDoc?.approvalStatus === 'Approved' || currentUserDoc?.approvalStatus === 'Approved' || latestUserDoc?.membershipStatus === 'Aktif' || currentUserDoc?.membershipStatus === 'Aktif';

    const userUpdateData: Partial<AppUser> = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: formData.name.toUpperCase(),
      phoneNumber: formData.phone,
      role: latestUserDoc?.role || currentUserDoc?.role || 'Pelawat', // stays Pelawat
      membershipType: isAlreadyApproved ? (latestUserDoc?.membershipType || currentUserDoc?.membershipType || 'Ahli Biasa') : 'Tiada',
      membershipStatus: isAlreadyApproved ? (latestUserDoc?.membershipStatus || currentUserDoc?.membershipStatus || 'Aktif') : 'Menunggu Kelulusan',
      approvalStatus: isAlreadyApproved ? (latestUserDoc?.approvalStatus || currentUserDoc?.approvalStatus || 'Approved') : 'Pending',
      isSuperAdmin: isSuperAdminEmail(firebaseUser.email),
      updatedAt: serverTimestamp(),
      registeredAt: latestUserDoc?.registeredAt || serverTimestamp(),
      ...(existingMemberNo ? { memberNo: existingMemberNo } : {}),
      ...(latestUserDoc?.approvedAt ? { approvedAt: latestUserDoc.approvedAt } : {}),
      ...(latestUserDoc?.approvedBy ? { approvedBy: latestUserDoc.approvedBy } : {}),
      
      // fields
      noRumah: formData.noRumah,
      nickname: formData.nickname,
      icNumber: formData.icNumber,
      address: formData.address,
      poskod: formData.poskod,
      bandar: formData.bandar,
      negeri: formData.negeri,
      statusKediaman: formData.statusKediaman,
      namaPemilikRumah: formData.namaPemilikRumah || '',
      noTelPemilikRumah: formData.noTelPemilikRumah || '',
      bilanganIsiRumah: Number(formData.bilanganIsiRumah),
      bilanganTanggungan: Number(formData.bilanganTanggungan || 0),
      senaraiAhliKeluarga: formData.senaraiAhliKeluarga || [],
      kuiriRemarks: '',
      kuiriItems: []
    };

    // Preserve image URLs — always prefer Firebase Storage URL over Google profile URL.
    // Read from latestUserDoc (fresh Firestore read) first to avoid race condition where
    // currentUserDoc in memory may be stale (image upload in progress at the same time).
    const finalUploadedProfileImageUrl = latestUserDoc?.uploadedProfileImageUrl || currentUserDoc?.uploadedProfileImageUrl || null;
    const finalUploadedCoverImageUrl = latestUserDoc?.uploadedCoverImageUrl || currentUserDoc?.uploadedCoverImageUrl || null;
    const finalGoogleProfileImageUrl = latestUserDoc?.googleProfileImageUrl || currentUserDoc?.googleProfileImageUrl || firebaseUser.photoURL || null;

    // For photoURL: always prefer uploaded Firebase Storage URL over Google profile URL.
    // Never let a Google profile URL overwrite an existing Firebase Storage URL.
    const isUploadedStorageUrl = (url: string | null | undefined) =>
      !!(url && (url.includes('firebasestorage.googleapis.com') || url.startsWith('data:image/')));

    const existingPhotoIsCustom = isUploadedStorageUrl(latestUserDoc?.photoURL || currentUserDoc?.photoURL);
    const candidatePhoto = finalUploadedProfileImageUrl
      || latestUserDoc?.photoURL
      || currentUserDoc?.photoURL
      || firebaseUser.photoURL
      || null;
    // Only allow Google URL if there's no custom-uploaded image at all
    const resolvedPhoto = existingPhotoIsCustom
      ? (finalUploadedProfileImageUrl || latestUserDoc?.photoURL || currentUserDoc?.photoURL)
      : candidatePhoto;

    if (resolvedPhoto) {
      userUpdateData.photoURL = resolvedPhoto;
    }
    // Only write uploadedProfileImageUrl if it has a real value — never write null
    // to avoid clearing an upload that may have just completed concurrently.
    if (finalUploadedProfileImageUrl) {
      userUpdateData.uploadedProfileImageUrl = finalUploadedProfileImageUrl;
    }
    if (finalUploadedCoverImageUrl) {
      userUpdateData.uploadedCoverImageUrl = finalUploadedCoverImageUrl;
    }
    if (finalGoogleProfileImageUrl) {
      userUpdateData.googleProfileImageUrl = finalGoogleProfileImageUrl;
    }

    // 1. Add record to membershipApplications collection using deterministic ID
    const appId = `app-${firebaseUser.uid}`;
    const appRef = doc(db, 'membershipApplications', appId);
    const applicationPayload: MembershipApplication = {
      id: appId,
      uid: firebaseUser.uid,
      name: formData.name.toUpperCase(),
      nickname: formData.nickname,
      icNumber: formData.icNumber,
      phone: formData.phone,
      email: (firebaseUser.email || formData.email || '').trim().toLowerCase(),
      noRumah: formData.noRumah,
      address: formData.address,
      poskod: formData.poskod,
      bandar: formData.bandar,
      negeri: formData.negeri,
      statusKediaman: formData.statusKediaman,
      namaPemilikRumah: formData.namaPemilikRumah || '',
      noTelPemilikRumah: formData.noTelPemilikRumah || '',
      bilanganIsiRumah: Number(formData.bilanganIsiRumah),
      bilanganTanggungan: Number(formData.bilanganTanggungan || 0),
      senaraiAhliKeluarga: formData.senaraiAhliKeluarga || [],
      submittedAt: serverTimestamp(),
      status: isAlreadyApproved ? (latestUserDoc?.membershipStatus === 'Aktif' ? 'Diluluskan' : 'Pending') : 'Pending',
      remarks: '',
      kuiriItems: [],
      ...(existingMemberNo ? { memberNo: existingMemberNo } : {})
    };

    let directWriteSucceeded = false;
    try {
      await setDoc(appRef, applicationPayload, { merge: true });
      // Also update raw firebaseUser.uid application doc if it exists in Firestore
      if (firebaseUser.uid) {
        try {
          const rawAppRef = doc(db, 'membershipApplications', firebaseUser.uid);
          const rawSnap = await getDoc(rawAppRef);
          if (rawSnap.exists()) {
            await setDoc(rawAppRef, { status: 'Pending', remarks: '', kuiriItems: [], updatedAt: serverTimestamp() }, { merge: true });
          }
        } catch (e) {
          console.warn("Ralat kemaskini borang mentah:", e);
        }
      }

      if (!latestUserDoc) {
        (userUpdateData as any).createdAt = serverTimestamp();
        (userUpdateData as any).lastLoginAt = serverTimestamp();
        await setDoc(userDocRef, userUpdateData);
      } else {
        await setDoc(userDocRef, userUpdateData, { merge: true });
      }
      directWriteSucceeded = true;
    } catch (clientErr) {
      console.warn("Makluman penulisan langsung klien Firestore semasa daftar ahli:", clientErr);
    }

    // 2. Ultra-reliable server-side proxy fallback to guarantee database persistence
    let serverWriteSucceeded = false;
    try {
      const resp = await fetch('/api/membership/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          uid: firebaseUser.uid,
          email: firebaseUser.email || formData.email || ''
        })
      });
      if (resp.ok) {
        serverWriteSucceeded = true;
      }
    } catch (apiErr) {
      console.warn("Makluman fallback API pendaftaran:", apiErr);
    }

    // If neither the direct Firestore write nor the server endpoint succeeded, do NOT mark as success
    if (!directWriteSucceeded && !serverWriteSucceeded) {
      throw new Error("Gagal menyimpan borang pendaftaran ke pangkalan data Firebase. Sila periksa sambungan internet anda dan cuba lagi.");
    }

    // 3. Synchronize local state and cache immediately so the review status reflects without delay
    const finalUserDoc: AppUser = {
      ...(latestUserDoc || {}),
      ...userUpdateData,
      uid: firebaseUser.uid,
      email: firebaseUser.email || (userUpdateData as any).email || null,
      displayName: (userUpdateData as any).displayName || null,
      phoneNumber: (userUpdateData as any).phoneNumber || null,
      role: isSuperAdminEmail(firebaseUser.email) ? 'Admin Utama' : 
            ((firebaseUser.email || '').toLowerCase().trim() === 'setiausahamusytari@gmail.com' || (firebaseUser.email || '').toLowerCase().trim() === 'setiaushamusytari@gmail.com') ? 'Setiausaha' :
            ((firebaseUser.email || '').toLowerCase().trim() === 'bendaharimusytari@gmail.com') ? 'Bendahari' :
            (latestUserDoc?.role && latestUserDoc.role !== 'Pelawat' && latestUserDoc.role !== 'Tetamu' ? latestUserDoc.role : 'Pelawat'),
      membershipType: latestUserDoc?.membershipType || 'Tiada',
      membershipStatus: latestUserDoc?.membershipStatus === 'Aktif' ? 'Aktif' : 'Menunggu Kelulusan',
      approvalStatus: latestUserDoc?.approvalStatus === 'Approved' ? 'Approved' : 'Pending',
      kuiriRemarks: '',
      kuiriItems: [],
      isSuperAdmin: isSuperAdminEmail(firebaseUser.email),
      updatedAt: new Date(),
      registeredAt: (userUpdateData as any).registeredAt || new Date(),
      lastLoginAt: new Date()
    } as AppUser;
    setCurrentUserDoc(finalUserDoc);
    localStorage.setItem('tmf2_cached_user_doc', JSON.stringify(finalUserDoc));

    // Also update allApplications state immediately so that Admin/Setiausaha views see it without lag
    setAllApplications(prev => {
      const isMatch = (a: any) => 
        a.id === appId || 
        a.uid === firebaseUser.uid || 
        (a.email && (firebaseUser.email || formData.email) && a.email.toLowerCase().trim() === (firebaseUser.email || formData.email).toLowerCase().trim()) ||
        (a.icNumber && formData.icNumber && a.icNumber === formData.icNumber);

      const exists = prev.some(isMatch);
      if (exists) {
        return prev.map(a => isMatch(a) ? { ...a, ...applicationPayload, status: 'Pending', remarks: '', kuiriItems: [], submittedAt: new Date() } : a);
      }
      return [{ ...applicationPayload, submittedAt: new Date() }, ...prev];
    });

    await logAction('Daftar Ahli', `Menghantar borang permohonan keahlian (${formData.name.toUpperCase()})`);

    // Send Telegram notification for membership registration/update
    try {
      const isKuiriResubmit = latestUserDoc?.membershipStatus === 'Kuiri' || latestUserDoc?.approvalStatus === 'Kuiri' || (latestUserDoc?.kuiriItems && latestUserDoc.kuiriItems.length > 0);
      const titleHeader = isKuiriResubmit 
        ? '🔄 *KEMASKINI PERMOHONAN KEAHLIAN (SEMAKAN SEMULA)* 🔄\n📌 *Catatan:* Pemohon telah mengemaskini borang kuiri. Tunggu Admin / Setiausaha semak semula.' 
        : '📝 *PENDAFTARAN KEAHLIAN BAHARU* 📝';

      const messageText = `
${titleHeader}

👤 *Nama Penuh:* ${formData.name.toUpperCase()}
💬 *Nama Panggilan:* ${formData.nickname || 'Tiada'}
🪪 *No. Kad Pengenalan:* ${formData.icNumber}
📞 *No. Telefon:* ${formData.phone}
🏠 *No. Rumah:* ${formData.noRumah}
📍 *Alamat:* ${formData.address}, ${formData.poskod} ${formData.bandar}, ${formData.negeri}
👨‍👩‍👧‍👦 *Bilangan Isi Rumah:* ${formData.bilanganIsiRumah} orang
🏠 *Status Kediaman:* ${formData.statusKediaman}

📅 *Tarikh & Masa Hantar:* ${new Date().toLocaleString('ms-MY')}
`.trim();
      sendTelegramMessage(messageText).catch(err => {
        console.error("Gagal menghantar notifikasi Telegram pendaftaran:", err);
      });
    } catch (telegramErr) {
      console.error("Ralat menghantar notifikasi pendaftaran ke Telegram:", telegramErr);
    }
  };

  // Approve a membership application
  const approveApplication = async (appId: string, applicantUid: string, type: string) => {
    if (!currentUserDoc) throw new Error("Sesi admin tidak sah.");
    
    // Check role permissions: Setiausaha, Penolong Setiausaha, Bendahari, Pengerusi, or Admin Utama
    const canApprove = currentUserDoc.isSuperAdmin || 
      ['Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi'].includes(currentUserDoc.role);
    if (!canApprove) {
      throw new Error("Tiada kebenaran meluluskan keahlian.");
    }

    const reviewerName = currentUserDoc.displayName || currentUserDoc.email || 'Admin';
    let targetApplicantName = 'Ahli';
    let targetApplicantEmail = '';

    // Pre-resolve target UID by checking email or IC in users collection/state
    let targetUid = applicantUid;
    try {
      const appSnapPre = await getDoc(doc(db, 'membershipApplications', appId));
      if (appSnapPre.exists()) {
        const preData = appSnapPre.data();
        const preEmail = (preData.email || '').toLowerCase().trim();
        const preIc = (preData.icNumber || '').trim();

        const foundInState = allUsers.find(u => 
          (applicantUid && u.uid === applicantUid) || 
          (preEmail && u.email && u.email.toLowerCase().trim() === preEmail) ||
          (preIc && u.icNumber && u.icNumber.trim() === preIc)
        );
        if (foundInState && foundInState.uid) {
          targetUid = foundInState.uid;
        } else if (preEmail) {
          const qUser = query(collection(db, 'users'), where('email', '==', preEmail));
          const uSnap = await getDocs(qUser);
          if (!uSnap.empty) {
            targetUid = uSnap.docs[0].id;
          }
        }
      }
    } catch (e) {
      console.warn("Ralat mencari user dengan emel:", e);
    }

    let finalMemberNo = '';
    let finalIcNumber = '';
    let finalNoRumah = '';
    let finalAddress = '';
    let finalStatusKediaman = 'Pemilik';

    // Execute within a Firebase Transaction
    await runTransaction(db, async (transaction) => {
      const appDocRef = doc(db, 'membershipApplications', appId);
      const userDocRef = doc(db, 'users', targetUid);

      const appSnap = await transaction.get(appDocRef);
      if (!appSnap.exists()) throw new Error("Permohonan tidak ditemui.");
      
      const userSnap = await transaction.get(userDocRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const appData = appSnap.data() as MembershipApplication;
      
      targetApplicantName = appData?.name || userData?.displayName || 'Ahli';
      targetApplicantEmail = appData?.email || userData?.email || '';

      const applicantEmailLower = (appData?.email || userData?.email || '').toLowerCase().trim();
      const isAppSuper = isSuperAdminEmail(applicantEmailLower);
      const isAppSetia = applicantEmailLower === 'setiausahamusytari@gmail.com' || applicantEmailLower === 'setiaushamusytari@gmail.com';
      const isAppBenda = applicantEmailLower === 'bendaharimusytari@gmail.com';

      let targetRole = 'Ahli Biasa';
      if (isAppSuper) {
        targetRole = 'Admin Utama';
      } else if (isAppSetia) {
        targetRole = 'Setiausaha';
      } else if (isAppBenda) {
        targetRole = 'Bendahari';
      } else if (userData?.role && userData.role !== 'Pelawat' && userData.role !== 'Tetamu') {
        targetRole = userData.role;
      }

      let memberNo = userData?.memberNo || appData?.memberNo;
      if (!memberNo) {
        memberNo = await generateNextMemberNo(transaction);
      }

      finalMemberNo = memberNo;
      finalIcNumber = appData?.icNumber || userData?.icNumber || '';
      finalNoRumah = appData?.noRumah || userData?.noRumah || '';
      finalAddress = appData?.address || userData?.address || '';
      finalStatusKediaman = (userData?.statusKediaman || appData?.statusKediaman || 'Pemilik').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik';

      // 1. Update application
      transaction.update(appDocRef, {
        uid: targetUid,
        status: 'Diluluskan',
        reviewedAt: serverTimestamp(),
        reviewedBy: reviewerName,
        remarks: `Diluluskan sebagai ${type}`
      });

      // 2. Update applicant user details
      const updateData: any = {
        role: targetRole,
        membershipType: type,
        membershipStatus: 'Aktif',
        approvalStatus: 'Approved',
        memberNo: memberNo,
        approvedAt: serverTimestamp(),
        approvedBy: reviewerName,
        updatedAt: serverTimestamp(),
        // Update job fields based on new role
        jobRole1: 'Ahli Persatuan',
        jobDetails1: 'SMA Ulu Jempol (SMAUJ) - 2026 - Sekarang',
        jobRole2: (type === 'Ahli Biasa' || type === 'Pelawat') ? '' : type,
        jobDetails2: (type === 'Ahli Biasa' || type === 'Pelawat') ? '' : 'Jawatan Rasmi'
      };

      if (appData || userData) {
        const effectiveStatus = userData?.statusKediaman || appData?.statusKediaman;
        if (effectiveStatus) updateData.statusKediaman = effectiveStatus.toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik';
        const effectiveOwnerName = userData?.namaPemilikRumah !== undefined && userData.namaPemilikRumah !== '' ? userData.namaPemilikRumah : appData?.namaPemilikRumah;
        if (effectiveOwnerName !== undefined) updateData.namaPemilikRumah = effectiveOwnerName;
        const effectiveOwnerPhone = userData?.noTelPemilikRumah !== undefined && userData.noTelPemilikRumah !== '' ? userData.noTelPemilikRumah : appData?.noTelPemilikRumah;
        if (effectiveOwnerPhone !== undefined) updateData.noTelPemilikRumah = effectiveOwnerPhone;
        if (appData?.noRumah) updateData.noRumah = appData.noRumah;
        if (appData.icNumber) updateData.icNumber = appData.icNumber;
        if (appData.phone) updateData.phoneNumber = appData.phone;
        if (appData.address) updateData.address = appData.address;
        if (appData.poskod) updateData.poskod = appData.poskod;
        if (appData.bandar) updateData.bandar = appData.bandar;
        if (appData.negeri) updateData.negeri = appData.negeri;
        if (appData.nickname) updateData.nickname = appData.nickname;
        if (appData.name) updateData.displayName = appData.name;
        const existingFamily = userSnap.exists() ? (userSnap.data() as AppUser)?.senaraiAhliKeluarga : undefined;
        if (appData.senaraiAhliKeluarga && (!existingFamily || existingFamily.length === 0 || appData.senaraiAhliKeluarga.length >= existingFamily.length)) {
          updateData.senaraiAhliKeluarga = appData.senaraiAhliKeluarga;
          if (appData.bilanganIsiRumah) updateData.bilanganIsiRumah = Number(appData.bilanganIsiRumah);
          if (appData.bilanganTanggungan !== undefined) updateData.bilanganTanggungan = Number(appData.bilanganTanggungan);
        }
      }

      if (userSnap.exists()) {
        transaction.update(userDocRef, updateData);
      } else {
        transaction.set(userDocRef, {
          uid: targetUid,
          email: appData.email || '',
          displayName: appData.name || 'Ahli Persatuan',
          nickname: appData.nickname || '',
          icNumber: appData.icNumber || '',
          phoneNumber: appData.phone || '',
          noRumah: appData.noRumah || '',
          address: appData.address || '',
          poskod: appData.poskod || '72200',
          bandar: appData.bandar || 'Batu Kikir',
          negeri: appData.negeri || 'Negeri Sembilan',
          statusKediaman: ((appData.statusKediaman || '').toLowerCase().includes('penyewa')) ? 'Penyewa' : 'Pemilik',
          namaPemilikRumah: appData.namaPemilikRumah || '',
          noTelPemilikRumah: appData.noTelPemilikRumah || '',
          bilanganIsiRumah: Number(appData.bilanganIsiRumah || 1),
          bilanganTanggungan: Number(appData.bilanganTanggungan || 0),
          senaraiAhliKeluarga: appData.senaraiAhliKeluarga || [],
          isSuperAdmin: false,
          createdAt: serverTimestamp(),
          registeredAt: appData.submittedAt || serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          ...updateData
        });
      }
    });

    await logAction('Lulus Permohonan', `Meluluskan permohonan ahli (${targetApplicantName} / ${targetUid}) sebagai ${type}`);

    // Trigger Push Notification and Approval Email to the approved member automatically
    import('../utils/notificationHelper').then(({ notifyOnMemberApproved, sendMembershipApprovalEmail }) => {
      notifyOnMemberApproved(targetApplicantName, targetUid, targetApplicantEmail).catch(err => {
        console.warn('Ralat hantar push notification kelulusan:', err);
      });

      if (targetApplicantEmail && targetApplicantEmail.trim()) {
        sendMembershipApprovalEmail({
          email: targetApplicantEmail.trim(),
          name: targetApplicantName,
          memberNo: finalMemberNo || 'SMAUJ-2026-AHLI',
          icNumber: finalIcNumber,
          noRumah: finalNoRumah,
          address: finalAddress,
          membershipType: type,
          statusKediaman: finalStatusKediaman,
          approvedBy: reviewerName,
          uid: targetUid
        }).then((res) => {
          if (res.success) {
            console.log(`[AuthContext] Emel kelulusan keahlian berjaya dihantar ke ${targetApplicantEmail}`);
          }
        }).catch(err => {
          console.warn('[AuthContext] Ralat menghantar emel kelulusan keahlian:', err);
        });
      }
    }).catch(err => console.warn(err));
  };

  // Reject membership application
  const rejectApplication = async (appId: string, applicantUid: string, remarks: string) => {
    if (!currentUserDoc) throw new Error("Sesi admin tidak sah.");
    
    // Check role permissions: Setiausaha, Penolong Setiausaha, Bendahari, Pengerusi, or Admin Utama
    const canReject = currentUserDoc.isSuperAdmin || 
      ['Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi'].includes(currentUserDoc.role);
    if (!canReject) {
      throw new Error("Tiada kebenaran menolak keahlian.");
    }

    const reviewerName = currentUserDoc.displayName || currentUserDoc.email || 'Admin';

    await runTransaction(db, async (transaction) => {
      const appDocRef = doc(db, 'membershipApplications', appId);
      const userDocRef = doc(db, 'users', applicantUid);

      const appSnap = await transaction.get(appDocRef);
      if (!appSnap.exists()) throw new Error("Permohonan tidak ditemui.");
      const appData = appSnap.data() as MembershipApplication;
      const userSnap = await transaction.get(userDocRef);

      // 1. Update application status
      transaction.update(appDocRef, {
        status: 'Rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: reviewerName,
        remarks: remarks || 'Permohonan ditolak.'
      });

      // 2. Update user document
      const rejectUserData = {
        membershipStatus: 'Ditolak',
        approvalStatus: 'Rejected',
        role: 'Pelawat',
        membershipType: 'Tiada',
        updatedAt: serverTimestamp()
      };

      if (userSnap.exists()) {
        transaction.update(userDocRef, rejectUserData);
      } else {
        transaction.set(userDocRef, {
          uid: applicantUid,
          email: appData.email || '',
          displayName: appData.name || 'Ahli',
          nickname: appData.nickname || '',
          icNumber: appData.icNumber || '',
          phoneNumber: appData.phone || '',
          noRumah: appData.noRumah || '',
          address: appData.address || '',
          poskod: appData.poskod || '72200',
          bandar: appData.bandar || 'Batu Kikir',
          negeri: appData.negeri || 'Negeri Sembilan',
          isSuperAdmin: false,
          createdAt: serverTimestamp(),
          registeredAt: appData.submittedAt || serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          ...rejectUserData
        });
      }
    });

    await logAction('Tolak Permohonan', `Menolak permohonan ahli (${applicantUid}) dengan sebab: ${remarks}`);
  };

  // Query a membership application (Kuiri Permohonan - minta pemohon kemaskini borang)
  const queryApplication = async (appId: string, applicantUid: string, remarks: string, kuiriItems: string[] = []) => {
    if (!currentUserDoc) throw new Error("Sesi admin tidak sah.");
    
    // Check role permissions: Setiausaha, Penolong Setiausaha, Bendahari, Pengerusi, or Admin Utama
    const canQuery = currentUserDoc.isSuperAdmin || 
      ['Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi'].includes(currentUserDoc.role);
    if (!canQuery) {
      throw new Error("Tiada kebenaran menghantar kuiri permohonan keahlian.");
    }

    const reviewerName = currentUserDoc.displayName || currentUserDoc.email || 'Admin';
    let targetUid = applicantUid;

    try {
      const appSnapPre = await getDoc(doc(db, 'membershipApplications', appId));
      if (appSnapPre.exists()) {
        const preData = appSnapPre.data();
        const preEmail = (preData.email || '').toLowerCase().trim();
        const preIc = (preData.icNumber || '').trim();

        const foundInState = allUsers.find(u => 
          (applicantUid && u.uid === applicantUid) || 
          (preEmail && u.email && u.email.toLowerCase().trim() === preEmail) ||
          (preIc && u.icNumber && u.icNumber.trim() === preIc)
        );
        if (foundInState && foundInState.uid) {
          targetUid = foundInState.uid;
        } else if (preEmail) {
          const qUser = query(collection(db, 'users'), where('email', '==', preEmail));
          const uSnap = await getDocs(qUser);
          if (!uSnap.empty) {
            targetUid = uSnap.docs[0].id;
          }
        }
      }
    } catch (e) {
      console.warn("Ralat mencari user dengan emel semasa kuiri:", e);
    }

    await runTransaction(db, async (transaction) => {
      const appDocRef = doc(db, 'membershipApplications', appId);
      const userDocRef = doc(db, 'users', targetUid);

      const appSnap = await transaction.get(appDocRef);
      if (!appSnap.exists()) throw new Error("Permohonan tidak ditemui.");
      const userSnap = await transaction.get(userDocRef);
      const appData = appSnap.data() as MembershipApplication;

      // 1. Update application status to Kuiri
      transaction.update(appDocRef, {
        status: 'Kuiri',
        reviewedAt: serverTimestamp(),
        reviewedBy: reviewerName,
        remarks: remarks || 'Permohonan dikuiri untuk pembetulan.',
        kuiriItems: kuiriItems || []
      });

      // 2. Update user document
      const kuiriUserData = {
        membershipStatus: 'Kuiri',
        approvalStatus: 'Kuiri',
        kuiriRemarks: remarks || 'Permohonan dikuiri untuk pembetulan.',
        kuiriItems: kuiriItems || [],
        updatedAt: serverTimestamp()
      };

      if (userSnap.exists()) {
        transaction.update(userDocRef, kuiriUserData);
      } else {
        transaction.set(userDocRef, {
          uid: targetUid,
          email: appData.email || '',
          displayName: appData.name || 'Pemohon',
          nickname: appData.nickname || '',
          icNumber: appData.icNumber || '',
          phoneNumber: appData.phone || '',
          noRumah: appData.noRumah || '',
          address: appData.address || '',
          poskod: appData.poskod || '72200',
          bandar: appData.bandar || 'Batu Kikir',
          negeri: appData.negeri || 'Negeri Sembilan',
          statusKediaman: ((appData.statusKediaman || '').toLowerCase().includes('penyewa')) ? 'Penyewa' : 'Pemilik',
          namaPemilikRumah: appData.namaPemilikRumah || '',
          noTelPemilikRumah: appData.noTelPemilikRumah || '',
          bilanganIsiRumah: Number(appData.bilanganIsiRumah || 1),
          bilanganTanggungan: Number(appData.bilanganTanggungan || 0),
          senaraiAhliKeluarga: appData.senaraiAhliKeluarga || [],
          isSuperAdmin: false,
          createdAt: serverTimestamp(),
          registeredAt: appData.submittedAt || serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          ...kuiriUserData
        });
      }
    });

    // Update in-memory state instantly
    setAllApplications(prev => prev.map(a => {
      if (a.id === appId || (targetUid && a.uid === targetUid)) {
        return {
          ...a,
          status: 'Kuiri',
          remarks: remarks || 'Permohonan dikuiri untuk pembetulan.',
          kuiriItems: kuiriItems || [],
          reviewedAt: new Date(),
          reviewedBy: reviewerName
        };
      }
      return a;
    }));

    setAllUsers(prev => prev.map(u => {
      if (u.uid === targetUid) {
        return {
          ...u,
          membershipStatus: 'Kuiri',
          approvalStatus: 'Kuiri',
          kuiriRemarks: remarks || 'Permohonan dikuiri untuk pembetulan.',
          kuiriItems: kuiriItems || []
        };
      }
      return u;
    }));

    if (currentUserDoc && currentUserDoc.uid === targetUid) {
      setCurrentUserDoc(prev => prev ? {
        ...prev,
        membershipStatus: 'Kuiri',
        approvalStatus: 'Kuiri',
        kuiriRemarks: remarks || 'Permohonan dikuiri untuk pembetulan.',
        kuiriItems: kuiriItems || []
      } : prev);
    }

    await logAction('Kuiri Permohonan', `Menghantar kuiri bagi permohonan ahli (${appId}) dengan catatan: ${remarks}`);
  };

  // Change user role (Admin Utama and Admin)
  const changeUserRole = async (userId: string, newRole: string, reason: string) => {
    if (!currentUserDoc) throw new Error("Sesi tidak sah.");
    const isCallerAdminUtama = 
      currentUserDoc.role?.toUpperCase() === 'ADMIN UTAMA' || 
      currentUserDoc.role?.toUpperCase() === 'ADMIN' || 
      currentUserDoc.isSuperAdmin === true || 
      isSuperAdminEmail(currentUserDoc.email);
    if (!isCallerAdminUtama) {
      throw new Error("Kebenaran khas ADMIN UTAMA atau ADMIN diperlukan untuk mengubah role.");
    }

    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) throw new Error("Pengguna tidak ditemui.");

    const userData = userSnap.data() as AppUser;
    
    // Prevent modifying the super admin or official super admin accounts by others
    if (userData.isSuperAdmin && currentUserDoc.uid !== userId && isSuperAdminEmail(userData.email)) {
      throw new Error("Akaun ADMIN UTAMA rasmi tidak boleh diubah.");
    }

    const changerName = currentUserDoc.displayName || currentUserDoc.email || 'ADMIN UTAMA';
    const isRoleMember = ['ADMIN UTAMA', 'ADMIN', 'GURU', 'MURID', 'IBU BAPA', 'KPM/JPN/NAZIR/PPD'].includes(newRole);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Update user role and jobs
        const updatePayload: any = {
          role: newRole,
          updatedAt: serverTimestamp(),
          membershipStatus: isRoleMember ? 'Aktif' : (newRole === 'TETAMU' ? 'Bukan Ahli' : userData.membershipStatus || 'Aktif'),
          approvalStatus: isRoleMember ? 'Approved' : (newRole === 'TETAMU' ? 'Belum Mohon' : userData.approvalStatus || 'Approved'),
          membershipType: newRole,
          jobRole1: 'Warga Sekolah / PIBG',
          jobDetails1: 'SMA Ulu Jempol (SMAUJ) - 2026 - Sekarang',
          jobRole2: newRole,
          jobDetails2: 'Peranan Rasmi'
        };

        if (newRole === 'ADMIN UTAMA') {
          updatePayload.isSuperAdmin = true;
          updatePayload.department = 'Pentadbiran Utama';
        }

        transaction.update(userDocRef, updatePayload);

        // 2. Add log entry inside "roles" collection (Audit Trail for roles)
        const roleLogRef = doc(collection(db, 'roles'));
        transaction.set(roleLogRef, {
          userId,
          userName: userData.displayName || 'Ahli',
          oldRole: userData.role,
          newRole,
          changedBy: changerName,
          reason: reason || 'Kemaskini admin',
          timestamp: serverTimestamp()
        });
      });

      await logAction('Tukar Role', `Mengubah role ${userData.displayName || 'Ahli'} daripada ${userData.role} kepada ${newRole}`);
    } catch (e: any) {
      console.error("Ralat menukar role pengguna:", e);
      throw e;
    }

    // Immediately update local state so UI updates in real-time without delay
    setAllUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole as any, membershipStatus: isRoleMember ? 'Aktif' : (newRole === 'TETAMU' ? 'Bukan Ahli' : u.membershipStatus) } : u));
    if (currentUserDoc && currentUserDoc.uid === userId) {
      setCurrentUserDoc(prev => prev ? { ...prev, role: newRole as any, membershipStatus: isRoleMember ? 'Aktif' : (newRole === 'TETAMU' ? 'Bukan Ahli' : prev.membershipStatus) } : prev);
    }
  };

  // Delete membership application directly
  const deleteApplication = async (appId: string, email?: string, uid?: string) => {
    if (!currentUserDoc) throw new Error("Sesi tidak sah.");
    if (currentUserDoc.role !== 'Admin Utama' && currentUserDoc.role !== 'Setiausaha') {
      throw new Error("Tiada kebenaran memadam permohonan.");
    }

    const emailLower = (email || '').trim().toLowerCase();
    const emailRaw = (email || '').trim();

    try {
      const appDocIdsToDelete = new Set<string>();
      appDocIdsToDelete.add(appId);

      // 1. Check direct doc ID
      const directRef = doc(db, 'membershipApplications', appId);
      await deleteDoc(directRef).catch(() => {});

      // 2. Query by UID if present
      if (uid) {
        const directAppUidRef = doc(db, 'membershipApplications', `app-${uid}`);
        await deleteDoc(directAppUidRef).catch(() => {});
        appDocIdsToDelete.add(`app-${uid}`);
        appDocIdsToDelete.add(uid);

        const qUid = query(collection(db, 'membershipApplications'), where('uid', '==', uid));
        const uidSnap = await getDocs(qUid);
        for (const docSnap of uidSnap.docs) {
          appDocIdsToDelete.add(docSnap.id);
          await deleteDoc(docSnap.ref).catch(() => {});
        }
      }

      // 3. Query by Email if present
      if (emailLower) {
        const qEmailLower = query(collection(db, 'membershipApplications'), where('email', '==', emailLower));
        const emailLowerSnap = await getDocs(qEmailLower);
        for (const docSnap of emailLowerSnap.docs) {
          appDocIdsToDelete.add(docSnap.id);
          await deleteDoc(docSnap.ref).catch(() => {});
        }

        if (emailRaw && emailRaw !== emailLower) {
          const qEmailRaw = query(collection(db, 'membershipApplications'), where('email', '==', emailRaw));
          const emailRawSnap = await getDocs(qEmailRaw);
          for (const docSnap of emailRawSnap.docs) {
            appDocIdsToDelete.add(docSnap.id);
            await deleteDoc(docSnap.ref).catch(() => {});
          }
        }
      }

      // 4. Also scan allApplications in memory to ensure complete cleanup
      for (const app of allApplications) {
        const appEmail = (app.email || '').trim().toLowerCase();
        if (app.id === appId || (uid && (app.uid === uid || app.id === `app-${uid}` || app.id === uid)) || (emailLower && appEmail === emailLower)) {
          appDocIdsToDelete.add(app.id);
          await deleteDoc(doc(db, 'membershipApplications', app.id)).catch(() => {});
        }
      }

      // 5. Update user document in 'users' collection if it exists to reset status
      if (uid) {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data() as AppUser;
          if (uData.membershipStatus !== 'Aktif') {
            await updateDoc(userRef, {
              membershipStatus: 'Bukan Ahli',
              approvalStatus: 'Belum Mohon',
              updatedAt: serverTimestamp()
            }).catch(() => {});
          }
        }
      }

      // Instantly update local state
      setAllApplications(prev => prev.filter(app => {
        const appEmail = (app.email || '').trim().toLowerCase();
        const matchesUid = !!(uid && (app.uid === uid || app.id === `app-${uid}` || app.id === uid));
        const matchesEmail = !!(emailLower && appEmail === emailLower);
        const matchesId = app.id === appId || appDocIdsToDelete.has(app.id);
        return !(matchesId || matchesUid || matchesEmail);
      }));
    } catch (err) {
      console.error("Gagal memadam permohonan keahlian:", err);
      throw err;
    }

    await logAction('Padam Permohonan', `Memadam borang permohonan keahlian (${appId})`);
  };

  // Delete user document
  const deleteUserDoc = async (userId: string, directEmail?: string) => {
    if (!currentUserDoc) throw new Error("Sesi tidak sah.");
    if (currentUserDoc.role !== 'Admin Utama' && currentUserDoc.role !== 'Setiausaha') {
      throw new Error("Tiada kebenaran memadam rekod.");
    }

    const userDocRef = doc(db, 'users', userId);
    let userData: AppUser | undefined = allUsers.find(u => u.uid === userId);
    
    try {
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        userData = userSnap.data() as AppUser;
      }
    } catch (e) {
      console.warn("Could not getDoc userDocRef:", e);
    }

    if (userData?.isSuperAdmin) {
      throw new Error("Akaun Admin Utama tidak boleh dipadam.");
    }

    // Collect all possible emails matching this user
    const emailsToMatch = new Set<string>();
    if (directEmail && directEmail.trim()) {
      emailsToMatch.add(directEmail.trim().toLowerCase());
    }
    if (userData?.email && userData.email.trim()) {
      emailsToMatch.add(userData.email.trim().toLowerCase());
    }
    const matchUserInState = allUsers.find(u => u.uid === userId);
    if (matchUserInState?.email) {
      emailsToMatch.add(matchUserInState.email.trim().toLowerCase());
    }
    const matchAppsInState = allApplications.filter(a => a.uid === userId || a.id === `app-${userId}` || a.id === userId);
    matchAppsInState.forEach(a => {
      if (a.email) emailsToMatch.add(a.email.trim().toLowerCase());
    });

    const userIcNumber = userData?.icNumber?.trim() || matchUserInState?.icNumber?.trim() || matchAppsInState[0]?.icNumber?.trim() || '';

    // Collect all application doc IDs to delete
    const appDocIdsToDelete = new Set<string>();
    appDocIdsToDelete.add(`app-${userId}`);
    appDocIdsToDelete.add(userId);

    // Search in current allApplications state
    allApplications.forEach((app) => {
      const aEmail = (app.email || '').trim().toLowerCase();
      const aIc = (app.icNumber || '').trim();
      const matchesUid = app.uid === userId || app.id === `app-${userId}` || app.id === userId;
      const matchesEmail = emailsToMatch.has(aEmail);
      const matchesIc = !!(userIcNumber && aIc === userIcNumber);

      if (matchesUid || matchesEmail || matchesIc) {
        appDocIdsToDelete.add(app.id);
      }
    });

    // 1. Direct application ref
    await deleteDoc(doc(db, 'membershipApplications', `app-${userId}`)).catch(() => {});
    await deleteDoc(doc(db, 'membershipApplications', userId)).catch(() => {});

    // 2. Query Firestore applications by UID
    try {
      const qUid = query(collection(db, 'membershipApplications'), where('uid', '==', userId));
      const uidSnapshot = await getDocs(qUid);
      for (const docSnap of uidSnapshot.docs) {
        appDocIdsToDelete.add(docSnap.id);
        await deleteDoc(docSnap.ref).catch(() => {});
      }
    } catch (e) {}

    // 3. Query Firestore applications by each matching email
    for (const em of Array.from(emailsToMatch)) {
      try {
        const qEmail = query(collection(db, 'membershipApplications'), where('email', '==', em));
        const emailSnap = await getDocs(qEmail);
        for (const docSnap of emailSnap.docs) {
          appDocIdsToDelete.add(docSnap.id);
          await deleteDoc(docSnap.ref).catch(() => {});
        }
      } catch (e) {}
    }

    // 4. Query Firestore applications by IC Number if exists
    if (userIcNumber) {
      try {
        const qIc = query(collection(db, 'membershipApplications'), where('icNumber', '==', userIcNumber));
        const icSnap = await getDocs(qIc);
        for (const docSnap of icSnap.docs) {
          appDocIdsToDelete.add(docSnap.id);
          await deleteDoc(docSnap.ref).catch(() => {});
        }
      } catch (e) {}
    }

    // 5. Delete any remaining app doc IDs found
    for (const appId of Array.from(appDocIdsToDelete)) {
      await deleteDoc(doc(db, 'membershipApplications', appId)).catch(() => {});
    }

    // 6. Delete the target user doc in users collection
    await deleteDoc(userDocRef).catch(() => {});

    // 7. Clean up any duplicate user docs with the same email if exists
    for (const em of Array.from(emailsToMatch)) {
      try {
        const qOtherUsers = query(collection(db, 'users'), where('email', '==', em));
        const otherUsersSnap = await getDocs(qOtherUsers);
        for (const uDoc of otherUsersSnap.docs) {
          if (!uDoc.data().isSuperAdmin) {
            await deleteDoc(uDoc.ref).catch(() => {});
          }
        }
      } catch (e) {}
    }

    // 8. Instantly update React state so UI updates with 0 delay!
    setAllApplications(prev => prev.filter(app => {
      const aEmail = (app.email || '').trim().toLowerCase();
      const aIc = (app.icNumber || '').trim();
      const matchesUid = app.uid === userId || app.id === `app-${userId}` || app.id === userId;
      const matchesEmail = emailsToMatch.has(aEmail);
      const matchesIc = !!(userIcNumber && aIc === userIcNumber);
      return !(matchesUid || matchesEmail || matchesIc || appDocIdsToDelete.has(app.id));
    }));

    setAllUsers(prev => prev.filter(u => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const matchesUid = u.uid === userId;
      const matchesEmail = emailsToMatch.has(uEmail);
      return !matchesUid && !matchesEmail;
    }));

    await logAction('Padam Data', `Memadam rekod pengguna & permohonan keahlian berkaitan: ${userData?.displayName || userData?.email || userId} (${Array.from(emailsToMatch).join(', ') || 'Tiada Emel'})`);
  };

  // Update membership application status dynamically
  const updateApplicationStatus = async (appId: string, applicantUid: string, status: string, type: string = 'Ahli Biasa') => {
    if (!currentUserDoc) throw new Error("Sesi admin tidak sah.");
    
    // Check role permissions: Setiausaha, Penolong Setiausaha, Bendahari, Pengerusi, or Admin Utama
    const canUpdateStatus = currentUserDoc.isSuperAdmin || 
      ['Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi'].includes(currentUserDoc.role);
    if (!canUpdateStatus) {
      throw new Error("Tiada kebenaran mengemaskini status keahlian.");
    }

    const reviewerName = currentUserDoc.displayName || currentUserDoc.email || 'Admin';
    let targetApplicantName = 'Ahli';
    let targetApplicantEmail = '';
    let finalMemberNo = '';
    let finalIcNumber = '';
    let finalNoRumah = '';
    let finalAddress = '';
    let finalStatusKediaman = 'Pemilik';

    // Pre-resolve target UID by checking email or IC in users collection/state
    let targetUid = applicantUid;
    try {
      const appSnapPre = await getDoc(doc(db, 'membershipApplications', appId));
      if (appSnapPre.exists()) {
        const preData = appSnapPre.data();
        const preEmail = (preData.email || '').toLowerCase().trim();
        const preIc = (preData.icNumber || '').trim();

        const foundInState = allUsers.find(u => 
          (applicantUid && u.uid === applicantUid) || 
          (preEmail && u.email && u.email.toLowerCase().trim() === preEmail) ||
          (preIc && u.icNumber && u.icNumber.trim() === preIc)
        );
        if (foundInState && foundInState.uid) {
          targetUid = foundInState.uid;
        } else if (preEmail) {
          const qUser = query(collection(db, 'users'), where('email', '==', preEmail));
          const uSnap = await getDocs(qUser);
          if (!uSnap.empty) {
            targetUid = uSnap.docs[0].id;
          }
        }
      }
    } catch (e) {
      console.warn("Ralat mencari user dengan emel:", e);
    }

    await runTransaction(db, async (transaction) => {
      const appDocRef = doc(db, 'membershipApplications', appId);
      const userDocRef = doc(db, 'users', targetUid);

      const appSnap = await transaction.get(appDocRef);
      if (!appSnap.exists()) throw new Error("Permohonan tidak ditemui.");
      
      const userSnap = await transaction.get(userDocRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const appData = appSnap.data() as MembershipApplication;

      targetApplicantName = appData?.name || userData?.displayName || 'Ahli';
      targetApplicantEmail = appData?.email || userData?.email || '';

      const applicantEmailLower = (appData?.email || userData?.email || '').toLowerCase().trim();
      const isAppSuper = isSuperAdminEmail(applicantEmailLower);
      const isAppSetia = applicantEmailLower === 'setiausahamusytari@gmail.com' || applicantEmailLower === 'setiaushamusytari@gmail.com';
      const isAppBenda = applicantEmailLower === 'bendaharimusytari@gmail.com';

      let targetRole = 'Ahli Biasa';
      if (isAppSuper) {
        targetRole = 'Admin Utama';
      } else if (isAppSetia) {
        targetRole = 'Setiausaha';
      } else if (isAppBenda) {
        targetRole = 'Bendahari';
      } else if (userData?.role && userData.role !== 'Pelawat' && userData.role !== 'Tetamu') {
        targetRole = userData.role;
      }

      let memberNo = userData?.memberNo || appData?.memberNo;

      if (status === 'Diluluskan' || status === 'Diluluskan Keahlian') {
        if (!memberNo) {
          memberNo = await generateNextMemberNo(transaction);
        }

        finalMemberNo = memberNo;
        finalIcNumber = appData?.icNumber || userData?.icNumber || '';
        finalNoRumah = appData?.noRumah || userData?.noRumah || '';
        finalAddress = appData?.address || userData?.address || '';
        finalStatusKediaman = (userData?.statusKediaman || appData?.statusKediaman || 'Pemilik').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik';

        transaction.update(appDocRef, {
          uid: targetUid,
          status: 'Diluluskan',
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerName,
          remarks: `Diluluskan sebagai ${type}`
        });

        const updateData: any = {
          role: targetRole,
          membershipType: type,
          membershipStatus: 'Aktif',
          approvalStatus: 'Approved',
          memberNo: memberNo,
          approvedAt: serverTimestamp(),
          approvedBy: reviewerName,
          updatedAt: serverTimestamp(),
          jobRole1: 'Ahli Persatuan',
          jobDetails1: 'SMA Ulu Jempol (SMAUJ) - 2026 - Sekarang',
          jobRole2: (type === 'Ahli Biasa' || type === 'Pelawat') ? '' : type,
          jobDetails2: (type === 'Ahli Biasa' || type === 'Pelawat') ? '' : 'Jawatan Rasmi'
        };

        if (appData || userData) {
          const effectiveStatus = userData?.statusKediaman || appData?.statusKediaman;
          if (effectiveStatus) updateData.statusKediaman = effectiveStatus.toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik';
          const effectiveOwnerName = userData?.namaPemilikRumah !== undefined && userData.namaPemilikRumah !== '' ? userData.namaPemilikRumah : appData?.namaPemilikRumah;
          if (effectiveOwnerName !== undefined) updateData.namaPemilikRumah = effectiveOwnerName;
          const effectiveOwnerPhone = userData?.noTelPemilikRumah !== undefined && userData.noTelPemilikRumah !== '' ? userData.noTelPemilikRumah : appData?.noTelPemilikRumah;
          if (effectiveOwnerPhone !== undefined) updateData.noTelPemilikRumah = effectiveOwnerPhone;
          if (appData?.noRumah) updateData.noRumah = appData.noRumah;
          if (appData.icNumber) updateData.icNumber = appData.icNumber;
          if (appData.phone) updateData.phoneNumber = appData.phone;
          if (appData.address) updateData.address = appData.address;
          if (appData.poskod) updateData.poskod = appData.poskod;
          if (appData.bandar) updateData.bandar = appData.bandar;
          if (appData.negeri) updateData.negeri = appData.negeri;
          if (appData.nickname) updateData.nickname = appData.nickname;
          if (appData.name) updateData.displayName = appData.name;
          const existingFamilyStatus = userSnap.exists() ? (userSnap.data() as AppUser)?.senaraiAhliKeluarga : undefined;
          if (appData.senaraiAhliKeluarga && (!existingFamilyStatus || existingFamilyStatus.length === 0 || appData.senaraiAhliKeluarga.length >= existingFamilyStatus.length)) {
            updateData.senaraiAhliKeluarga = appData.senaraiAhliKeluarga;
            if (appData.bilanganIsiRumah) updateData.bilanganIsiRumah = Number(appData.bilanganIsiRumah);
            if (appData.bilanganTanggungan !== undefined) updateData.bilanganTanggungan = Number(appData.bilanganTanggungan);
          }
        }

        if (userSnap.exists()) {
          transaction.update(userDocRef, updateData);
        } else {
          transaction.set(userDocRef, {
            uid: targetUid,
            email: appData.email || '',
            displayName: appData.name || 'Ahli Persatuan',
            nickname: appData.nickname || '',
            icNumber: appData.icNumber || '',
            phoneNumber: appData.phone || '',
            noRumah: appData.noRumah || '',
            address: appData.address || '',
            poskod: appData.poskod || '72200',
            bandar: appData.bandar || 'Batu Kikir',
            negeri: appData.negeri || 'Negeri Sembilan',
            statusKediaman: ((appData.statusKediaman || '').toLowerCase().includes('penyewa')) ? 'Penyewa' : 'Pemilik',
            namaPemilikRumah: appData.namaPemilikRumah || '',
            noTelPemilikRumah: appData.noTelPemilikRumah || '',
            bilanganIsiRumah: Number(appData.bilanganIsiRumah || 1),
            bilanganTanggungan: Number(appData.bilanganTanggungan || 0),
            senaraiAhliKeluarga: appData.senaraiAhliKeluarga || [],
            isSuperAdmin: false,
            createdAt: serverTimestamp(),
            registeredAt: appData.submittedAt || serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            ...updateData
          });
        }
      } else if (status === 'Pending' || status === 'Dalam Proses Semakan') {
        transaction.update(appDocRef, {
          status: 'Pending',
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerName,
          remarks: 'Dalam Proses Semakan'
        });

        const pendingUserData = {
          membershipStatus: 'Menunggu Kelulusan',
          approvalStatus: 'Pending',
          role: 'Pelawat',
          membershipType: 'Tiada',
          updatedAt: serverTimestamp()
        };

        if (userSnap.exists()) {
          transaction.update(userDocRef, pendingUserData);
        } else {
          transaction.set(userDocRef, {
            uid: targetUid,
            email: appData.email || '',
            displayName: appData.name || 'Pemohon',
            nickname: appData.nickname || '',
            icNumber: appData.icNumber || '',
            phoneNumber: appData.phone || '',
            noRumah: appData.noRumah || '',
            address: appData.address || '',
            poskod: appData.poskod || '72200',
            bandar: appData.bandar || 'Batu Kikir',
            negeri: appData.negeri || 'Negeri Sembilan',
            statusKediaman: ((appData.statusKediaman || '').toLowerCase().includes('penyewa')) ? 'Penyewa' : 'Pemilik',
            namaPemilikRumah: appData.namaPemilikRumah || '',
            noTelPemilikRumah: appData.noTelPemilikRumah || '',
            bilanganIsiRumah: Number(appData.bilanganIsiRumah || 1),
            bilanganTanggungan: Number(appData.bilanganTanggungan || 0),
            senaraiAhliKeluarga: appData.senaraiAhliKeluarga || [],
            isSuperAdmin: false,
            createdAt: serverTimestamp(),
            registeredAt: appData.submittedAt || serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            ...pendingUserData
          });
        }
      } else if (status === 'Rejected' || status === 'Ditolak Keahlian') {
        transaction.update(appDocRef, {
          status: 'Rejected',
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerName,
          remarks: 'Ditolak Keahlian'
        });

        const rejectedUserData = {
          membershipStatus: 'Ditolak',
          approvalStatus: 'Rejected',
          role: 'Pelawat',
          membershipType: 'Tiada',
          updatedAt: serverTimestamp()
        };

        if (userSnap.exists()) {
          transaction.update(userDocRef, rejectedUserData);
        } else {
          transaction.set(userDocRef, {
            uid: targetUid,
            email: appData.email || '',
            displayName: appData.name || 'Pemohon',
            nickname: appData.nickname || '',
            icNumber: appData.icNumber || '',
            phoneNumber: appData.phone || '',
            noRumah: appData.noRumah || '',
            address: appData.address || '',
            poskod: appData.poskod || '72200',
            bandar: appData.bandar || 'Batu Kikir',
            negeri: appData.negeri || 'Negeri Sembilan',
            isSuperAdmin: false,
            createdAt: serverTimestamp(),
            registeredAt: appData.submittedAt || serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            ...rejectedUserData
          });
        }
      } else if (status === 'Dilucutkan Keahlian') {
        transaction.update(appDocRef, {
          status: 'Dilucutkan Keahlian',
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerName,
          remarks: 'Dilucutkan Keahlian'
        });

        transaction.update(userDocRef, {
          membershipStatus: 'Tidak Aktif',
          approvalStatus: 'Dilucutkan',
          role: 'Pelawat',
          membershipType: 'Tiada',
          updatedAt: serverTimestamp()
        });
      } else if (status === 'Dinyahaktifkan Keahlian') {
        transaction.update(appDocRef, {
          status: 'Dinyahaktifkan Keahlian',
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerName,
          remarks: 'Dinyahaktifkan Keahlian'
        });

        transaction.update(userDocRef, {
          membershipStatus: 'Tidak Aktif',
          approvalStatus: 'Dinyahaktifkan',
          role: 'Pelawat',
          membershipType: 'Tiada',
          updatedAt: serverTimestamp()
        });
      } else if (status === 'Kuiri' || status === 'Kuiri Permohonan' || status === 'Perlu Kemaskini') {
        transaction.update(appDocRef, {
          status: 'Kuiri',
          reviewedAt: serverTimestamp(),
          reviewedBy: reviewerName,
          remarks: 'Kuiri Permohonan - Perlu Kemaskini'
        });

        const kuiriUserData = {
          membershipStatus: 'Kuiri',
          approvalStatus: 'Kuiri',
          role: 'Pelawat',
          membershipType: 'Tiada',
          kuiriRemarks: 'Kuiri Permohonan - Perlu Kemaskini',
          updatedAt: serverTimestamp()
        };

        if (userSnap.exists()) {
          transaction.update(userDocRef, kuiriUserData);
        } else {
          transaction.set(userDocRef, {
            uid: targetUid,
            email: appData.email || '',
            displayName: appData.name || 'Pemohon',
            nickname: appData.nickname || '',
            icNumber: appData.icNumber || '',
            phoneNumber: appData.phone || '',
            noRumah: appData.noRumah || '',
            address: appData.address || '',
            poskod: appData.poskod || '72200',
            bandar: appData.bandar || 'Batu Kikir',
            negeri: appData.negeri || 'Negeri Sembilan',
            statusKediaman: ((appData.statusKediaman || '').toLowerCase().includes('penyewa')) ? 'Penyewa' : 'Pemilik',
            namaPemilikRumah: appData.namaPemilikRumah || '',
            noTelPemilikRumah: appData.noTelPemilikRumah || '',
            bilanganIsiRumah: Number(appData.bilanganIsiRumah || 1),
            bilanganTanggungan: Number(appData.bilanganTanggungan || 0),
            senaraiAhliKeluarga: appData.senaraiAhliKeluarga || [],
            isSuperAdmin: false,
            createdAt: serverTimestamp(),
            registeredAt: appData.submittedAt || serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            ...kuiriUserData
          });
        }
      }
    });
    
    // If approved, trigger Push Notification and Approval Email to the applicant
    if (status === 'Diluluskan' || status === 'Diluluskan Keahlian') {
      import('../utils/notificationHelper').then(({ notifyOnMemberApproved, sendMembershipApprovalEmail }) => {
        notifyOnMemberApproved(targetApplicantName, targetUid, targetApplicantEmail).catch(err => {
          console.warn('Ralat hantar push notification kelulusan status:', err);
        });

        if (targetApplicantEmail && targetApplicantEmail.trim()) {
          sendMembershipApprovalEmail({
            email: targetApplicantEmail.trim(),
            name: targetApplicantName,
            memberNo: finalMemberNo || 'SMAUJ-2026-AHLI',
            icNumber: finalIcNumber,
            noRumah: finalNoRumah,
            address: finalAddress,
            membershipType: type,
            statusKediaman: finalStatusKediaman,
            approvedBy: reviewerName,
            uid: targetUid
          }).then((res) => {
            if (res.success) {
              console.log(`[AuthContext] Emel kelulusan keahlian status berjaya dihantar ke ${targetApplicantEmail}`);
            }
          }).catch(err => {
            console.warn('[AuthContext] Ralat menghantar emel kelulusan status:', err);
          });
        }
      }).catch(err => console.warn(err));
    }

    await logAction('Kemaskini Status Ahli', `Mengemaskini status permohonan (${targetApplicantName} / ${applicantUid}) kepada ${status}`);
  };

  // Resequence Member Numbers starting PTMF2-2026-0001, PTMF2-2026-0002...
  const resequenceMemberNumbers = async (): Promise<{ success: boolean; updatedCount: number; users: any[] }> => {
    if (!currentUserDoc) throw new Error("Sesi tidak sah.");
    if (currentUserDoc.role !== 'Admin Utama' && !currentUserDoc.isSuperAdmin && currentUserDoc.role !== 'Setiausaha') {
      throw new Error("Tiada kebenaran menyusun nombor ahli.");
    }

    try {
      // 1. Try server endpoint first for authoritative background update
      const idToken = await firebaseUser?.getIdToken();
      const res = await fetch('/api/admin/resequence-member-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state immediately
        if (data.users && Array.isArray(data.users)) {
          const userMap = new Map<string, string>();
          data.users.forEach((u: any) => userMap.set(u.uid, u.newMemberNo));
          setAllUsers(prev => prev.map(u => userMap.has(u.uid) ? { ...u, memberNo: userMap.get(u.uid) } : u));
          if (currentUserDoc && userMap.has(currentUserDoc.uid)) {
            setCurrentUserDoc(prev => prev ? { ...prev, memberNo: userMap.get(prev.uid) } : prev);
          }
        }
        await logAction('Susun No Ahli', `Menyusun semula nombor ahli kepada format SMAUJ-2026-0001 secara berurutan (${data.updatedCount} ahli)`);
        return data;
      }
    } catch (apiErr) {
      console.warn("Server resequence endpoint fallback:", apiErr);
    }

    // 2. Direct client Firestore update fallback
    const activeMembers = allUsers.filter(u => 
      u.membershipStatus === 'Aktif' || 
      u.approvalStatus === 'Approved' || 
      (u.memberNo && (u.memberNo.startsWith('SMAUJ-') || u.memberNo.startsWith('PTMF2-'))) ||
      ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Ahli Jawatankuasa', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Juru Audit'].includes(u.role)
    );

    activeMembers.sort((a, b) => {
      if (a.isSuperAdmin || a.role === 'Admin Utama') return -1;
      if (b.isSuperAdmin || b.role === 'Admin Utama') return 1;

      const getNum = (mNo?: string) => {
        if (!mNo) return 999999;
        const match = mNo.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 999999;
      };
      const numA = getNum(a.memberNo);
      const numB = getNum(b.memberNo);
      if (numA !== 999999 || numB !== 999999) {
        if (numA !== numB) return numA - numB;
      }

      const timeA = (a.approvedAt as any)?.seconds ? (a.approvedAt as any).seconds * 1000 : (a.approvedAt ? new Date(a.approvedAt).getTime() : ((a.registeredAt as any)?.seconds ? (a.registeredAt as any).seconds * 1000 : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0)));
      const timeB = (b.approvedAt as any)?.seconds ? (b.approvedAt as any).seconds * 1000 : (b.approvedAt ? new Date(b.approvedAt).getTime() : ((b.registeredAt as any)?.seconds ? (b.registeredAt as any).seconds * 1000 : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0)));
      return timeA - timeB;
    });

    const currentYear = 2026;
    let seq = 1;
    const updatedUsers: any[] = [];
    const userMap = new Map<string, string>();

    for (const member of activeMembers) {
      const paddedSeq = seq.toString().padStart(4, '0');
      const newMemberNo = `SMAUJ-${currentYear}-${paddedSeq}`;

      await updateDoc(doc(db, 'users', member.uid), {
        memberNo: newMemberNo,
        updatedAt: serverTimestamp()
      }).catch(() => {});

      userMap.set(member.uid, newMemberNo);
      updatedUsers.push({
        uid: member.uid,
        name: member.displayName || member.email,
        oldMemberNo: member.memberNo,
        newMemberNo
      });

      seq++;
    }

    const finalSeq = seq - 1;
    await setDoc(doc(db, 'system', 'memberCounter'), {
      year: currentYear,
      seq: finalSeq,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});

    setAllUsers(prev => prev.map(u => userMap.has(u.uid) ? { ...u, memberNo: userMap.get(u.uid) } : u));
    if (currentUserDoc && userMap.has(currentUserDoc.uid)) {
      setCurrentUserDoc(prev => prev ? { ...prev, memberNo: userMap.get(prev.uid) } : prev);
    }

    await logAction('Susun No Ahli', `Menyusun semula nombor ahli kepada format SMAUJ-2026-0001 secara berurutan (${updatedUsers.length} ahli)`);
    return { success: true, updatedCount: updatedUsers.length, users: updatedUsers };
  };

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      currentUserDoc,
      loading,
      showChoicePopup,
      setShowChoicePopup,
      pendingRegData,
      setPendingRegData,
      loginWithGoogle,
      logout,
      signInAsGuest,
      googleDriveToken,
      setGoogleDriveToken,
      connectGoogleDrive,
      handleChoice,
      submitMembershipApplication,
      approveApplication,
      rejectApplication,
      queryApplication,
      changeUserRole,
      deleteUserDoc,
      deleteApplication,
      logAction,
      updateApplicationStatus,
      resequenceMemberNumbers,
      
      allUsers,
      allApplications,
      auditLogs,
      roleLogs,
      loginLogs,
      recordLoginEvent
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
