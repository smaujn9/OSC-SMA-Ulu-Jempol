import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, AppUser } from '../context/AuthContext';
import { 
  Phone, MessageSquare, User, Shield, Award, Users, CheckCircle, 
  Lock, Users2, HelpCircle, ChevronDown, Check, UserCheck, Sparkles, Loader2, 
  HeartHandshake, ShieldAlert, GraduationCap, Heart, Edit3, X, Save, Trash2, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CommitteeMember {
  roleTitle: string;
  roleKey: string;
  name: string;
  phone: string;
  photoURL?: string;
  isFallback: boolean;
  isManual?: boolean;
  uid?: string;
  memberNo?: string;
  noRumah?: string;
}

interface BiroDefinition {
  key: 'keselamatan' | 'ekonomi' | 'pendidikan' | 'wanita';
  title: string;
  shortTitle: string;
  badgeBg: string;
  badgeText: string;
  iconColor: string;
  icon: any;
}

const BIRO_LIST: BiroDefinition[] = [
  {
    key: 'keselamatan',
    title: 'Keselamatan dan Kesihatan',
    shortTitle: 'Biro Keselamatan & Kesihatan',
    badgeBg: 'bg-rose-50 border-rose-200',
    badgeText: 'text-rose-700',
    iconColor: 'text-rose-600',
    icon: ShieldAlert
  },
  {
    key: 'ekonomi',
    title: 'Ekonomi dan Kebajikan',
    shortTitle: 'Biro Ekonomi & Kebajikan',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-700',
    iconColor: 'text-emerald-600',
    icon: HeartHandshake
  },
  {
    key: 'pendidikan',
    title: 'Pendidikan dan Kemajuan Belia',
    shortTitle: 'Biro Pendidikan & Belia',
    badgeBg: 'bg-amber-50 border-amber-200',
    badgeText: 'text-amber-700',
    iconColor: 'text-amber-600',
    icon: GraduationCap
  },
  {
    key: 'wanita',
    title: 'Hal Ehwal Wanita',
    shortTitle: 'Biro Hal Ehwal Wanita',
    badgeBg: 'bg-purple-50 border-purple-200',
    badgeText: 'text-purple-700',
    iconColor: 'text-purple-600',
    icon: Heart
  }
];

interface EditModalState {
  isOpen: boolean;
  roleKey: string;
  roleTitle: string;
  mode: 'dropdown' | 'manual';
  selectedUid: string;
  manualName: string;
  manualPhone: string;
}

export default function AhliJawatankuasaSection({ isMobile = false }: { isMobile?: boolean }) {
  const { allUsers, currentUserDoc, firebaseUser } = useAuth();

  // Real-time Biro & Committee assignments from Firestore system/ajkBiroConfig
  const [biroConfig, setBiroConfig] = useState<Record<string, any>>({});
  const [updatingBiroKey, setUpdatingBiroKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  
  // Modal for editing appointment (Dropdown OR Manual Writing)
  const [editModalState, setEditModalState] = useState<EditModalState | null>(null);

  const triggerFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ show: true, msg, type });
    setTimeout(() => {
      setFeedbackMsg(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system', 'ajkBiroConfig'), (snapshot) => {
      if (snapshot.exists()) {
        setBiroConfig(snapshot.data() || {});
      } else {
        setBiroConfig({});
      }
    }, (err) => {
      console.warn("Ralat membaca ajkBiroConfig dari Firestore:", err);
    });

    return () => unsub();
  }, []);

  // Check if current user is registered (not guest, not Anonymous, and role is not 'Pelawat'/'Tetamu')
  const isRegisteredUser = useMemo(() => {
    if (!firebaseUser) return false;
    if (firebaseUser.isAnonymous) return false;
    if (firebaseUser.uid === 'guest_local') return false;
    if (!currentUserDoc) return false;
    return currentUserDoc.role !== 'Pelawat' && currentUserDoc.role !== 'Tetamu';
  }, [firebaseUser, currentUserDoc]);

  // Permission check: only admin, pengerusi, naib pengerusi, setiausaha, naib setiausaha dan bendahari
  const canManageBiro = useMemo(() => {
    if (!currentUserDoc) return false;
    if (currentUserDoc.isSuperAdmin) return true;
    const allowedRoles = [
      'Admin Utama',
      'Pengerusi',
      'Naib Pengerusi',
      'Setiausaha',
      'Naib Setiausaha',
      'Penolong Setiausaha',
      'Bendahari'
    ];
    return allowedRoles.includes(currentUserDoc.role);
  }, [currentUserDoc]);

  // Registered members available for appointment
  const registeredMemberList = useMemo(() => {
    return allUsers
      .filter(u => u.uid && (u.displayName || u.nickname || u.email))
      .sort((a, b) => {
        const nameA = (a.displayName || a.nickname || a.email || '').toUpperCase();
        const nameB = (b.displayName || b.nickname || b.email || '').toUpperCase();
        return nameA.localeCompare(nameB);
      });
  }, [allUsers]);

  // Clean phone number for WhatsApp wa.me API (e.g. 0123456789 -> 60123456789)
  const getWhatsAppLink = (phone: string, name: string) => {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '60' + cleaned.slice(1);
    } else if (!cleaned.startsWith('60') && cleaned.length > 0) {
      cleaned = '60' + cleaned;
    }
    const message = `Assalamualaikum Tuan/Puan ${name}, saya warga SMAUJ ingin bertanya mengenai urusan sekolah / maklumat persekolahan...`;
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  };

  const avatarFallbackUrl = "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc";

  // Official default committee fallback members for SMAUJ (Sekolah Menengah Agama Ulu Jempol)
  const DEFAULT_COMMITTEE_MEMBERS: Record<string, { name: string; photoURL?: string; phone?: string; uid?: string; memberNo?: string; noRumah?: string }> = {
    pengerusi: {
      uid: "smauj-admin-01",
      name: "USTAZ PENGETUA SMAUJ",
      phone: "064981234",
      photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0001",
      noRumah: "Pejabat Pentadbiran"
    },
    naibPengerusi: {
      uid: "smauj-pk1-02",
      name: "USTAZAH HALIMAH BINTI OTHMAN (PK 1)",
      phone: "01158907334",
      photoURL: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0002",
      noRumah: "Bilik Penolong Kanan"
    },
    setiausaha: {
      uid: "smauj-su-03",
      name: "USTAZ AZMAN BIN SHAFIE (SU PIBG)",
      phone: "0137048407",
      photoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0003",
      noRumah: "Bilik Guru"
    },
    naibSetiausaha: {
      uid: "smauj-nsu-04",
      name: "CIKGU SAIFUL BAHRI (PEN. SU)",
      phone: "0128214128",
      photoURL: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0004",
      noRumah: "Bilik Guru"
    },
    bendahari: {
      uid: "smauj-ben-05",
      name: "USTAZ MUHAMMAD FIRDAUS (BENDAHARI)",
      phone: "0102537234",
      photoURL: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0005",
      noRumah: "Pejabat Kewangan"
    },
    ajk1: {
      uid: "smauj-hem-06",
      name: "CIKGU FARID BIN KAMARUDDIN (PK HEM)",
      phone: "0107906775",
      photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0006",
      noRumah: "Bilik HEM"
    },
    ajk2: {
      uid: "smauj-koko-07",
      name: "USTAZ HAIROL NIZAM (PK KOKO)",
      phone: "0102184542",
      photoURL: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0007",
      noRumah: "Bilik Kokurikulum"
    },
    audit1: {
      uid: "smauj-gkmp-08",
      name: "USTAZ AIDIL ROSLAN (GKMP DINI)",
      phone: "0133001238",
      photoURL: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0008",
      noRumah: "Bilik GKMP"
    },
    audit2: {
      uid: "smauj-pibg-09",
      name: "HJ. RAZAK BIN AHMAD (YDP PIBG)",
      phone: "0174879930",
      photoURL: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200",
      memberNo: "SMAUJ-2026-0009",
      noRumah: "Komuniti Ulu Jempol"
    }
  };

  // Official default biro fallback members
  const DEFAULT_BIRO_MEMBERS: Record<string, { name: string; phone?: string; photoURL?: string; uid?: string }> = {
    keselamatan: {
      uid: "7tY8tlpspeO1E2MZdb5YjtIqs1V2",
      name: "MOHD HAMMBALI BIN ABDULLAH",
      phone: "0172187843",
      photoURL: "https://lh3.googleusercontent.com/a/ACg8ocIhUpskwIji4dTQyOcA5Y-OgJ65cQsLvgJc7cJO84c04stLJg=s96-c"
    },
    ekonomi: {
      uid: "ixLC6gGyPpYU6EyPiSkTwAxDjhz2",
      name: "ADY MUSTAPPA",
      phone: "",
      photoURL: "https://lh3.googleusercontent.com/a-/ALV-UjXuc_TbjozpnpNWJ49AcNoixxbh-_hWJdRiiYngKQqg1GE_65a62jd7KUfis0B5x8-Kh-WQA7UbJz1EBIPe5V6gCbnF02RWrOTUpwVYSgfOMqWh7xNs979GexqzAOQdWYWB3bPpP2Zbz__8iuXsXpvSXJPMvWE0AGq1wna2r_i1cT3PsZrxxuqE5G1FnQpIB1nPgI4HeshA5TElQPW9WgjK3g2VB60CAC2SMbZPGwwa7IJDhHXBgvvtsy4S7t5pafC9swHB0IuBfP0E84yy6Jb29pR9Ozjl1aLuB-ocXmbHlr0yqx5e0YLDfL_hkH_r5N7UN4aD9eHBr_XB2XnICNIzAxICm8xnrigzcwoZO-IsOLhAEPeHw7lDQ2uMYRtX72WUf6uYW5SPLDXdaZNRB7ZaOYiA_NsTD5YwBn6DGoz_i8WHcvn9jSxdJHz73LIIQS22e-C-QbEIWMS69kDLenHYHY_T3SnL8dhVmm_1DbYB5e4YUxVz5UMSb5_WzZ_l8a9xdHdaOtfHIaMc0nSQ_GnfZk0t4oDBrdvmDkZTA3c-s2WhrxS24OLPBGsNsICpg-Q9oGd7WfFYd66dwH3T1d8dfoTG-p8h6MixGGwVXtOwTUDkE6fBmdROYP6gWxroaYsp4O9d4imO2tY2kVzLW7qzny3Xegby9hzDeEWPsvLXmkD29e9EdnhEICgjgNZpnUZOJuxZtY5XEvsy1rA4WtLUSvtZPJUqJyIm0LZJ5wl1RGZiUnFNtD7nSE6_bULMhIur23e_SntDvjaGCqRAoVt84or8hN11K4zvlnv7qO3qOdXQCZm9r1jTqQv8bGwQGH4_yekuUGd0tc54xfdjbHRXNysCThCnIeMIa3oW_naEwfBMPaNvUO1tyfE_2mxwK4HrKTromM2hf2hN3UE5VizixCkhB6a5GX8uTuwKignh2H1CbLjOCXzddEB6osCUxGSsGlGkCH408jVbXAOYAymRTet-lr0aoYT8cp1bj8AqnTHgyfUXINw8HtA4d_65M1yMLF0MCzHSwG4S8VLM60RGSOk5gcyPIs60QTvD5Y2fMGEfEzRG2Pt4LHc=s96-c"
    },
    pendidikan: {
      uid: "YfVFKqDdpjgTgMMDDCP91f3uQgM2",
      name: "AFNAN AFIF BIN ABDUL MUTALIB",
      phone: "0125435828",
      photoURL: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/users%2FYfVFKqDdpjgTgMMDDCP91f3uQgM2%2Favatar%2F1790785334703_IMG_4990.jpeg?alt=media&token=b3313a61-8eab-4060-b428-9735fad22590"
    },
    wanita: {
      name: "MUNIRA BINTI OTHMAN",
      phone: "",
      photoURL: ""
    }
  };

  // Helper to resolve role member from either Firestore `ajkBiroConfig` (manual or assigned) or fallback to user role match
  const resolveMember = (roleKey: string, roleTitle: string, fallbackUser?: AppUser | null): CommitteeMember => {
    const rawAssignment = biroConfig[roleKey];

    // Explicitly assigned in ajkBiroConfig
    if (rawAssignment) {
      // 1. Manual entry (written by hand)
      if (rawAssignment.isManual || (!rawAssignment.uid && rawAssignment.name)) {
        return {
          roleTitle,
          roleKey,
          name: rawAssignment.name || 'Belum dilantik',
          phone: rawAssignment.phone || '',
          photoURL: rawAssignment.photoURL || undefined,
          isFallback: !rawAssignment.name,
          isManual: true
        };
      }

      // 2. Selected from registered user
      if (rawAssignment.uid) {
        const freshUser = allUsers.find(u => u.uid === rawAssignment.uid);
        if (freshUser) {
          return {
            roleTitle,
            roleKey,
            name: (freshUser.displayName || freshUser.nickname || freshUser.email || 'Ahli').toUpperCase(),
            phone: freshUser.phoneNumber || '',
            photoURL: freshUser.uploadedProfileImageUrl || freshUser.photoURL || freshUser.googleProfileImageUrl || undefined,
            isFallback: false,
            isManual: false,
            uid: freshUser.uid,
            memberNo: freshUser.memberNo,
            noRumah: freshUser.noRumah
          };
        }
        return {
          roleTitle,
          roleKey,
          name: rawAssignment.name || 'Ahli',
          phone: rawAssignment.phone || '',
          photoURL: rawAssignment.photoURL || undefined,
          isFallback: false,
          isManual: false,
          uid: rawAssignment.uid,
          memberNo: rawAssignment.memberNo,
          noRumah: rawAssignment.noRumah
        };
      }
    }

    // Fallback: auto-match user by user profile role (if not overridden in ajkBiroConfig)
    if (fallbackUser) {
      return {
        roleTitle,
        roleKey,
        name: (fallbackUser.displayName || fallbackUser.nickname || fallbackUser.email || 'Ahli').toUpperCase(),
        phone: fallbackUser.phoneNumber || '',
        photoURL: fallbackUser.uploadedProfileImageUrl || fallbackUser.photoURL || fallbackUser.googleProfileImageUrl || undefined,
        isFallback: false,
        isManual: false,
        uid: fallbackUser.uid,
        memberNo: fallbackUser.memberNo,
        noRumah: fallbackUser.noRumah
      };
    }

    // Default static committee member fallback (ensures tetamu/guests always see official leaders and photos)
    const defaultStatic = DEFAULT_COMMITTEE_MEMBERS[roleKey];
    if (defaultStatic) {
      const freshUser = defaultStatic.uid ? allUsers.find(u => u.uid === defaultStatic.uid) : null;
      return {
        roleTitle,
        roleKey,
        name: freshUser ? (freshUser.displayName || freshUser.nickname || freshUser.email || defaultStatic.name).toUpperCase() : defaultStatic.name,
        phone: freshUser?.phoneNumber || defaultStatic.phone || '',
        photoURL: freshUser?.uploadedProfileImageUrl || freshUser?.photoURL || freshUser?.googleProfileImageUrl || defaultStatic.photoURL || undefined,
        isFallback: false,
        isManual: false,
        uid: defaultStatic.uid,
        memberNo: freshUser?.memberNo || defaultStatic.memberNo,
        noRumah: freshUser?.noRumah || defaultStatic.noRumah
      };
    }

    // Default unassigned
    return {
      roleTitle,
      roleKey,
      name: 'BELUM DILANTIK',
      phone: '',
      isFallback: true,
      isManual: false
    };
  };

  const getCommitteeMembers = () => {
    // 1. Pengerusi
    const dbPengerusi = allUsers.find(u => u.role === 'Pengerusi' || u.uid === DEFAULT_COMMITTEE_MEMBERS.pengerusi?.uid);
    const pengerusi = resolveMember('pengerusi', 'Pengerusi', dbPengerusi);

    // 2. Naib Pengerusi
    const dbNaibPengerusi = allUsers.find(u => u.role === 'Naib Pengerusi' || u.uid === DEFAULT_COMMITTEE_MEMBERS.naibPengerusi?.uid);
    const naibPengerusi = resolveMember('naibPengerusi', 'Naib Pengerusi', dbNaibPengerusi);

    // 3. Setiausaha
    const dbSetiausaha = allUsers.find(u => u.role === 'Setiausaha' || u.uid === DEFAULT_COMMITTEE_MEMBERS.setiausaha?.uid);
    const setiausaha = resolveMember('setiausaha', 'Setiausaha', dbSetiausaha);

    // 4. Naib Setiausaha
    const dbNaibSetiausaha = allUsers.find(u => u.role === 'Naib Setiausaha' || u.role === 'Penolong Setiausaha' || u.uid === DEFAULT_COMMITTEE_MEMBERS.naibSetiausaha?.uid);
    const naibSetiausaha = resolveMember('naibSetiausaha', 'Penolong Setiausaha', dbNaibSetiausaha);

    // 5. Bendahari
    const dbBendahari = allUsers.find(u => u.role === 'Bendahari' || u.uid === DEFAULT_COMMITTEE_MEMBERS.bendahari?.uid);
    const bendahari = resolveMember('bendahari', 'Bendahari', dbBendahari);

    // 6. 3 AJK
    const dbAjkList = allUsers.filter(u => u.role === 'Ahli Jawatankuasa');
    const ajk: CommitteeMember[] = [
      resolveMember('ajk1', 'Ahli Jawatankuasa 1', dbAjkList[0]),
      resolveMember('ajk2', 'Ahli Jawatankuasa 2', dbAjkList[1]),
      resolveMember('ajk3', 'Ahli Jawatankuasa 3', dbAjkList[2]),
    ];

    // 7. 2 Juru Audit
    const dbAuditList = allUsers.filter(u => u.role === 'Juru Audit');
    const audit: CommitteeMember[] = [
      resolveMember('audit1', 'Juru Audit 1', dbAuditList[0]),
      resolveMember('audit2', 'Juru Audit 2', dbAuditList[1]),
    ];

    return { pengerusi, naibPengerusi, setiausaha, naibSetiausaha, bendahari, ajk, audit };
  };

  const { pengerusi, naibPengerusi, setiausaha, naibSetiausaha, bendahari, ajk, audit } = getCommitteeMembers();

  // Open Edit Modal for any role (Dropdown OR Manual)
  const handleOpenEditModal = (roleKey: string, roleTitle: string, currentMember: CommitteeMember) => {
    const rawAssignment = biroConfig[roleKey];
    const isManual = rawAssignment?.isManual || (!rawAssignment?.uid && Boolean(rawAssignment?.name));
    
    setEditModalState({
      isOpen: true,
      roleKey,
      roleTitle,
      mode: isManual ? 'manual' : 'dropdown',
      selectedUid: rawAssignment?.uid || currentMember.uid || '',
      manualName: isManual ? (rawAssignment?.name || '') : (currentMember.isFallback ? '' : currentMember.name),
      manualPhone: isManual ? (rawAssignment?.phone || '') : (currentMember.isFallback ? '' : currentMember.phone)
    });
  };

  // Save role assignment (either from Dropdown or Manual)
  const handleSaveRole = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editModalState || !canManageBiro) return;

    const { roleKey, roleTitle, mode, selectedUid, manualName, manualPhone } = editModalState;
    setUpdatingBiroKey(roleKey);

    try {
      const updatePayload: any = {};

      if (mode === 'dropdown') {
        if (!selectedUid) {
          updatePayload[roleKey] = null;
          await setDoc(doc(db, 'system', 'ajkBiroConfig'), updatePayload, { merge: true });
          triggerFeedback(`${roleTitle} berjaya dikosongkan.`, 'success');
        } else {
          const selectedUser = allUsers.find(u => u.uid === selectedUid);
          if (selectedUser) {
            updatePayload[roleKey] = {
              uid: selectedUser.uid,
              name: (selectedUser.displayName || selectedUser.nickname || selectedUser.email || 'Ahli').toUpperCase(),
              phone: selectedUser.phoneNumber || '',
              photoURL: selectedUser.uploadedProfileImageUrl || selectedUser.photoURL || selectedUser.googleProfileImageUrl || '',
              memberNo: selectedUser.memberNo || '',
              noRumah: selectedUser.noRumah || '',
              isManual: false,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUserDoc?.displayName || currentUserDoc?.email || 'Admin'
            };
            await setDoc(doc(db, 'system', 'ajkBiroConfig'), updatePayload, { merge: true });
            triggerFeedback(`Pelantikan ${updatePayload[roleKey].name} bagi ${roleTitle} berjaya disimpan!`, 'success');
          }
        }
      } else {
        // Manual entry
        if (!manualName.trim()) {
          triggerFeedback('Sila masukkan Nama Penuh untuk pelantikan manual.', 'error');
          return;
        }

        updatePayload[roleKey] = {
          uid: null,
          name: manualName.trim().toUpperCase(),
          phone: manualPhone.trim() || '',
          photoURL: '',
          isManual: true,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUserDoc?.displayName || currentUserDoc?.email || 'Admin'
        };
        await setDoc(doc(db, 'system', 'ajkBiroConfig'), updatePayload, { merge: true });
        triggerFeedback(`Pelantikan manual ${updatePayload[roleKey].name} bagi ${roleTitle} berjaya disimpan!`, 'success');
      }

      setEditModalState(null);
    } catch (err: any) {
      console.error("Gagal menyimpan pelantikan:", err);
      triggerFeedback(err.message || 'Gagal menyimpan pelantikan.', 'error');
    } finally {
      setUpdatingBiroKey(null);
    }
  };

  // Quick reset / clear role
  const handleClearRole = async (roleKey: string, roleTitle: string) => {
    if (!canManageBiro) return;
    setUpdatingBiroKey(roleKey);
    try {
      const updatePayload: any = {};
      updatePayload[roleKey] = null;
      await setDoc(doc(db, 'system', 'ajkBiroConfig'), updatePayload, { merge: true });
      triggerFeedback(`${roleTitle} telah dikosongkan.`, 'success');
      setEditModalState(null);
    } catch (err: any) {
      console.error("Gagal mengosongkan jawatan:", err);
      triggerFeedback(err.message || 'Gagal mengosongkan jawatan.', 'error');
    } finally {
      setUpdatingBiroKey(null);
    }
  };

  // Quick direct dropdown assignment on Biro Card
  const handleDirectBiroDropdown = async (biroKey: string, biroTitle: string, targetUid: string) => {
    if (!canManageBiro) return;
    setUpdatingBiroKey(biroKey);
    try {
      const updatePayload: any = {};
      if (!targetUid) {
        updatePayload[biroKey] = null;
        await setDoc(doc(db, 'system', 'ajkBiroConfig'), updatePayload, { merge: true });
        triggerFeedback(`${biroTitle} berjaya dikosongkan.`, 'success');
      } else {
        const selectedUser = allUsers.find(u => u.uid === targetUid);
        if (selectedUser) {
          updatePayload[biroKey] = {
            uid: selectedUser.uid,
            name: (selectedUser.displayName || selectedUser.nickname || selectedUser.email || 'Ahli').toUpperCase(),
            phone: selectedUser.phoneNumber || '',
            photoURL: selectedUser.uploadedProfileImageUrl || selectedUser.photoURL || selectedUser.googleProfileImageUrl || '',
            memberNo: selectedUser.memberNo || '',
            noRumah: selectedUser.noRumah || '',
            isManual: false,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserDoc?.displayName || currentUserDoc?.email || 'Admin'
          };
          await setDoc(doc(db, 'system', 'ajkBiroConfig'), updatePayload, { merge: true });
          triggerFeedback(`Pelantikan ${selectedUser.displayName || selectedUser.nickname || 'Ahli'} berjaya disimpan!`, 'success');
        }
      }
    } catch (err: any) {
      console.error("Gagal melantik ahli biro:", err);
      triggerFeedback(err.message || 'Gagal menyimpan pelantikan.', 'error');
    } finally {
      setUpdatingBiroKey(null);
    }
  };

  // Standard Member Card for Organizational Hierarchy
  const MemberCard = ({ member }: { member: CommitteeMember; key?: React.Key }) => {
    const avatarSrc = member.photoURL || avatarFallbackUrl;
    const isSaving = updatingBiroKey === member.roleKey;

    return (
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center relative overflow-hidden group"
      >
        {/* Role badge */}
        <div className="flex items-center justify-between w-full mb-3.5 px-0.5">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full mx-auto">
            {member.roleTitle}
          </span>
        </div>

        {/* Profile Avatar */}
        <div className="relative mb-3">
          <img
            src={avatarSrc}
            alt={member.name}
            className="w-14 h-14 rounded-full border border-slate-100 object-cover shadow-xs bg-slate-50"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = avatarFallbackUrl;
            }}
          />
          {!member.isFallback && (
            <span 
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${member.isManual ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              title={member.isManual ? "Dilantik Manual" : "Aktif / Berdaftar"} 
            />
          )}
        </div>

        {/* Full Name */}
        <h4 className="font-extrabold text-xs text-slate-900 line-clamp-2 max-w-[170px] min-h-[32px] flex items-center justify-center leading-snug">
          {member.name}
        </h4>

        {/* Contact details */}
        <div className="w-full mt-3 pt-3 border-t border-slate-100 flex flex-col items-center gap-2">
          {isRegisteredUser ? (
            <>
              {/* Phone number */}
              <span className="text-[11px] font-mono font-bold text-slate-500">
                {member.phone || (member.isFallback ? 'Tiada No Tel' : 'Tiada No Tel')}
              </span>

              {/* Action Buttons */}
              {member.phone && (
                <div className="flex items-center gap-2.5 mt-1">
                  {/* Phone Call Button */}
                  <a
                    href={`tel:${member.phone}`}
                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                    title="Hubungi (Panggilan Telefon)"
                  >
                    <Phone size={13} strokeWidth={2.5} />
                  </a>

                  {/* WhatsApp Button */}
                  <a
                    href={getWhatsAppLink(member.phone, member.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                    title="Hantar WhatsApp"
                  >
                    <MessageSquare size={13} strokeWidth={2.5} />
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold bg-slate-50 px-2.5 py-1 rounded-md">
              <Lock size={10} className="text-slate-400" />
              <span>Daftar Warga untuk No Tel</span>
            </div>
          )}
        </div>

        {/* Authorized User Edit / Appoint Action Button */}
        {canManageBiro && (
          <div className="w-full mt-3 pt-2.5 border-t border-dashed border-slate-200">
            <button
              onClick={() => handleOpenEditModal(member.roleKey, member.roleTitle, member)}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-xl text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
              title="Ubah Pelantikan (Dropdown / Tulis Manual)"
            >
              {isSaving ? (
                <Loader2 size={11} className="animate-spin text-indigo-600" />
              ) : (
                <Edit3 size={11} className="text-indigo-600" />
              )}
              <span>{member.isFallback ? 'Lantik Jawatan' : 'Ubah / Lantik'}</span>
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  // Interactive Biro Card
  const BiroCard = ({ biro }: { biro: BiroDefinition; key?: React.Key }) => {
    const rawAssignment = biroConfig[biro.key];
    const assignedUid = rawAssignment?.uid;
    const isManual = rawAssignment?.isManual || (!assignedUid && Boolean(rawAssignment?.name));
    
    // Dynamically look up fresh data from allUsers if assigned to a registered user
    const freshUser = assignedUid ? allUsers.find(u => u.uid === assignedUid) : null;
    
    const defaultStatic = DEFAULT_BIRO_MEMBERS[biro.key];
    const isAssigned = Boolean(freshUser || rawAssignment?.name || defaultStatic?.name);
    const displayName = isManual 
      ? (rawAssignment?.name || 'BELUM DILANTIK')
      : (freshUser 
          ? (freshUser.displayName || freshUser.nickname || freshUser.email || 'Ahli').toUpperCase() 
          : (rawAssignment?.name || defaultStatic?.name || 'BELUM DILANTIK'));

    const phone = isManual
      ? (rawAssignment?.phone || '')
      : (freshUser ? (freshUser.phoneNumber || '') : (rawAssignment?.phone || defaultStatic?.phone || ''));

    const photoURL = isManual
      ? (rawAssignment?.photoURL || undefined)
      : (freshUser ? (freshUser.uploadedProfileImageUrl || freshUser.photoURL || freshUser.googleProfileImageUrl) : (rawAssignment?.photoURL || defaultStatic?.photoURL || undefined));

    const avatarSrc = photoURL || avatarFallbackUrl;
    const isSaving = updatingBiroKey === biro.key;

    const currentMemberForEdit: CommitteeMember = {
      roleTitle: biro.title,
      roleKey: biro.key,
      name: displayName,
      phone: phone,
      photoURL: photoURL,
      isFallback: !isAssigned,
      isManual: isManual,
      uid: assignedUid
    };

    return (
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center relative overflow-hidden group"
      >
        {/* Biro Header Title Badge */}
        <div className={`w-full text-center px-2.5 py-1.5 rounded-xl border mb-3 flex items-center justify-center gap-1.5 ${biro.badgeBg}`}>
          <biro.icon size={12} className={biro.iconColor} />
          <span className={`text-[9.5px] font-black uppercase tracking-tight truncate ${biro.badgeText}`} title={biro.title}>
            {biro.title}
          </span>
        </div>

        {/* Profile Avatar */}
        <div className="relative mb-2.5">
          <img
            src={avatarSrc}
            alt={displayName}
            className="w-14 h-14 rounded-full border border-slate-100 object-cover shadow-xs bg-slate-50"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = avatarFallbackUrl;
            }}
          />
          {isAssigned && (
            <span 
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${isManual ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              title={isManual ? "Dilantik Manual" : "Aktif / Dilantik"} 
            />
          )}
        </div>

        {/* Full Name */}
        <h4 className="font-extrabold text-xs text-slate-900 line-clamp-2 max-w-[190px] min-h-[32px] flex items-center justify-center leading-snug">
          {displayName}
        </h4>

        {/* Contact details */}
        <div className="w-full mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col items-center gap-1.5">
          {isRegisteredUser ? (
            <>
              {/* Phone number */}
              <span className="text-[11px] font-mono font-bold text-slate-600">
                {phone || (isAssigned ? 'Tiada No Tel' : '-')}
              </span>

              {/* Action Buttons */}
              {phone && (
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Phone Call Button */}
                  <a
                    href={`tel:${phone}`}
                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                    title="Hubungi (Panggilan Telefon)"
                  >
                    <Phone size={13} strokeWidth={2.5} />
                  </a>

                  {/* WhatsApp Button */}
                  <a
                    href={getWhatsAppLink(phone, displayName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                    title="Hantar WhatsApp"
                  >
                    <MessageSquare size={13} strokeWidth={2.5} />
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-md">
              <Lock size={10} className="text-slate-400" />
              <span>Daftar Warga untuk No Tel</span>
            </div>
          )}
        </div>

        {/* Dropdown & Manual Options for Authorized Leaders */}
        {canManageBiro && (
          <div className="w-full mt-3 pt-2.5 border-t border-dashed border-slate-200 space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={10} className="text-indigo-600" /> Lantik Ketua Biro:
              </span>
              {isSaving && <Loader2 size={10} className="animate-spin text-indigo-600" />}
            </div>

            {/* Quick Dropdown Select */}
            <div className="relative">
              <select
                value={isManual ? 'manual_entry' : (assignedUid || '')}
                disabled={isSaving}
                onChange={(e) => {
                  if (e.target.value === 'manual_entry') {
                    handleOpenEditModal(biro.key, biro.title, currentMemberForEdit);
                  } else {
                    handleDirectBiroDropdown(biro.key, biro.title, e.target.value);
                  }
                }}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer disabled:opacity-50 appearance-none pr-6 truncate"
              >
                <option value="">— Pilih Ahli (Kosong) —</option>
                {isManual && (
                  <option value="manual_entry">
                    ✍️ [Manual]: {displayName}
                  </option>
                )}
                {registeredMemberList.map((u) => {
                  const uName = (u.displayName || u.name || u.email || 'Ahli').toUpperCase();
                  const houseInfo = u.noRumah ? ` [Rumah: ${u.noRumah}]` : '';
                  const memberNoInfo = u.memberNo ? ` (${u.memberNo})` : '';
                  return (
                    <option key={u.uid} value={u.uid}>
                      {uName}{houseInfo}{memberNoInfo}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <ChevronDown size={11} />
              </div>
            </div>

            {/* Manual Writing Button */}
            <button
              type="button"
              onClick={() => handleOpenEditModal(biro.key, biro.title, currentMemberForEdit)}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-xl text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Edit3 size={11} className="text-indigo-600" />
              <span>{isManual ? 'Ubah Maklumat Manual' : 'Tulis Secara Manual'}</span>
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Feedback Toast */}
      {feedbackMsg.show && (
        <div className={`fixed bottom-5 right-5 z-[100] px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom-5 ${
          feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          <CheckCircle size={15} />
          {feedbackMsg.msg}
        </div>
      )}

      {/* Upper header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users2 size={18} />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">Barisan Pentadbir & Guru (AJK / Staf)</h3>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Carta Organisasi Pengurusan Sekolah & Jawatankuasa PIBG Sekolah Menengah Agama Ulu Jempol (Sesi 2026/2027).
          </p>
        </div>

        {canManageBiro && (
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl px-3 py-2 text-indigo-900 text-xs font-bold flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-600 shrink-0" />
            <span>Akses Pelantikan Biro & Jawatankuasa Diaktifkan (Dropdown & Manual)</span>
          </div>
        )}
      </div>

      {/* Organizational Chart Hierarchy Tree (Desktop Flow) */}
      {!isMobile ? (
        <div className="relative overflow-x-auto pb-6">
          <div className="min-w-[960px] flex flex-col items-center space-y-12 py-4">
            
            {/* Level 1: Pengerusi */}
            <div className="w-full flex justify-center relative">
              <div className="w-[200px]">
                <MemberCard member={pengerusi} />
              </div>
              {/* Vertical line down to Naib */}
              <div className="absolute top-full left-1/2 w-0.5 h-12 bg-slate-200 -translate-x-1/2" />
            </div>

            {/* Level 2: Naib Pengerusi */}
            <div className="w-full flex justify-center relative pt-4">
              <div className="w-[200px]">
                <MemberCard member={naibPengerusi} />
              </div>
              {/* Vertical line down to Secretary / Treasurer level */}
              <div className="absolute top-full left-1/2 w-0.5 h-12 bg-slate-200 -translate-x-1/2" />
            </div>

            {/* Level 3: Setiausaha, Penolong Setiausaha, Bendahari (3 Columns) */}
            <div className="w-full flex justify-center relative pt-4">
              {/* Horizontal connection bar */}
              <div className="absolute top-0 left-1/6 right-1/6 h-0.5 bg-slate-200" style={{ left: 'calc(100% / 6)', right: 'calc(100% / 6)' }} />
              
              <div className="grid grid-cols-3 gap-8 w-full max-w-[800px] relative">
                {/* Vertical drops */}
                <div className="absolute -top-4 left-[16.67%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[50%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[83.33%] w-0.5 h-4 bg-slate-200" />

                <MemberCard member={setiausaha} />
                <MemberCard member={naibSetiausaha} />
                <MemberCard member={bendahari} />
              </div>

              {/* Vertical line down to AJK */}
              <div className="absolute top-full left-1/2 w-0.5 h-12 bg-slate-200 -translate-x-1/2" />
            </div>

            {/* Level 4: 3 AJK (3 Columns) */}
            <div className="w-full flex justify-center relative pt-4">
              {/* Horizontal connection bar */}
              <div className="absolute top-0 left-1/6 right-1/6 h-0.5 bg-slate-200" style={{ left: 'calc(100% / 6)', right: 'calc(100% / 6)' }} />

              <div className="grid grid-cols-3 gap-8 w-full max-w-[800px] relative">
                {/* Vertical drops */}
                <div className="absolute -top-4 left-[16.67%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[50%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[83.33%] w-0.5 h-4 bg-slate-200" />

                {ajk.map((member, idx) => (
                  <MemberCard key={member.roleKey || idx} member={member} />
                ))}
              </div>

              {/* Vertical line down to Audit */}
              <div className="absolute top-full left-1/2 w-0.5 h-12 bg-slate-200 -translate-x-1/2" />
            </div>

            {/* Level 5: 2 Juru Audit (2 Columns) */}
            <div className="w-full flex justify-center relative pt-4">
              {/* Horizontal connection bar */}
              <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-slate-200" style={{ left: 'calc(100% / 4)', right: 'calc(100% / 4)' }} />

              <div className="grid grid-cols-2 gap-8 w-full max-w-[520px] relative">
                {/* Vertical drops */}
                <div className="absolute -top-4 left-[25%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[75%] w-0.5 h-4 bg-slate-200" />

                {audit.map((member, idx) => (
                  <MemberCard key={member.roleKey || idx} member={member} />
                ))}
              </div>

              {/* Vertical line down to Biro */}
              <div className="absolute top-full left-1/2 w-0.5 h-12 bg-slate-200 -translate-x-1/2" />
            </div>

            {/* Level 6: 4 AJK & BIRO (4 Columns below Juru Audit) */}
            <div className="w-full flex flex-col items-center relative pt-4">
              {/* Horizontal connection bar for 4 items */}
              <div className="absolute top-0 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200" />

              <div className="grid grid-cols-4 gap-6 w-full max-w-[960px] relative">
                {/* Vertical drops for 4 columns */}
                <div className="absolute -top-4 left-[12.5%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[37.5%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[62.5%] w-0.5 h-4 bg-slate-200" />
                <div className="absolute -top-4 left-[87.5%] w-0.5 h-4 bg-slate-200" />

                {BIRO_LIST.map((biro) => (
                  <BiroCard key={biro.key} biro={biro} />
                ))}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Mobile stacked bento hierarchy */
        <div className="space-y-6">
          <div className="space-y-4">
            
            {/* Level 1 & 2: Pengerusi & Naib */}
            <div className="space-y-3">
              <div className="bg-indigo-900 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg w-fit">
                Kepimpinan Utama
              </div>
              <div className="grid grid-cols-1 gap-3">
                <MemberCard member={pengerusi} />
                <MemberCard member={naibPengerusi} />
              </div>
            </div>

            {/* Level 3: Setiausaha, Penolong & Bendahari */}
            <div className="space-y-3">
              <div className="bg-indigo-900 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg w-fit">
                Sekretariat & Kewangan
              </div>
              <div className="grid grid-cols-1 gap-3">
                <MemberCard member={setiausaha} />
                <MemberCard member={naibSetiausaha} />
                <MemberCard member={bendahari} />
              </div>
            </div>

            {/* Level 4: 3 AJK */}
            <div className="space-y-3">
              <div className="bg-indigo-900 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg w-fit">
                Ahli Jawatankuasa (AJK)
              </div>
              <div className="grid grid-cols-1 gap-3">
                {ajk.map((member, idx) => (
                  <MemberCard key={member.roleKey || idx} member={member} />
                ))}
              </div>
            </div>

            {/* Level 5: 2 Juru Audit */}
            <div className="space-y-3">
              <div className="bg-indigo-900 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg w-fit">
                Juru Audit
              </div>
              <div className="grid grid-cols-1 gap-3">
                {audit.map((member, idx) => (
                  <MemberCard key={member.roleKey || idx} member={member} />
                ))}
              </div>
            </div>

            {/* Level 6: 4 AJK & Biro */}
            <div className="space-y-3 pt-2">
              <div className="bg-indigo-950 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg w-fit flex items-center gap-1.5">
                <Shield size={12} className="text-amber-400" />
                AJK & Biro Persatuan
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BIRO_LIST.map((biro) => (
                  <BiroCard key={biro.key} biro={biro} />
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL PELANTIKAN: PILIH DROPDOWN ATAU TULIS SECARA MANUAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {editModalState?.isOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Pelantikan Jawatan
                    </h3>
                    <p className="text-xs font-semibold text-indigo-600">
                      {editModalState.roleTitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalState(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveRole} className="p-5 space-y-4">
                {/* Tab Mode Selection: Dropdown vs Manual */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setEditModalState(prev => prev ? ({ ...prev, mode: 'dropdown' }) : null)}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editModalState.mode === 'dropdown'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users size={14} />
                    <span>Pilih Ahli (Dropdown)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditModalState(prev => prev ? ({ ...prev, mode: 'manual' }) : null)}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editModalState.mode === 'manual'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 size={14} />
                    <span>Tulis Manual</span>
                  </button>
                </div>

                {/* Option 1: Dropdown Mode */}
                {editModalState.mode === 'dropdown' && (
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Pilih Daripada Senarai Ahli Berdaftar:
                    </label>

                    <div className="relative">
                      <select
                        value={editModalState.selectedUid}
                        onChange={(e) => {
                          const uid = e.target.value;
                          const selected = allUsers.find(u => u.uid === uid);
                          setEditModalState(prev => prev ? ({
                            ...prev,
                            selectedUid: uid,
                            manualName: selected ? (selected.displayName || selected.nickname || selected.email || '').toUpperCase() : '',
                            manualPhone: selected?.phoneNumber || ''
                          }) : null);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 appearance-none pr-8 cursor-pointer"
                      >
                        <option value="">— Kosongkan / Belum Dilantik —</option>
                        {registeredMemberList.map((u) => {
                          const uName = (u.displayName || u.nickname || u.email || 'Ahli').toUpperCase();
                          const houseInfo = u.noRumah ? ` [Rumah: ${u.noRumah}]` : '';
                          const memberNoInfo = u.memberNo ? ` (${u.memberNo})` : '';
                          return (
                            <option key={u.uid} value={u.uid}>
                              {uName}{houseInfo}{memberNoInfo}
                            </option>
                          );
                        })}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      💡 Memilih ahli berdaftar akan memautkan gambar profil akaun, nombor rumah dan nombor telefon rasmi mereka secara automatik.
                    </p>
                  </div>
                )}

                {/* Option 2: Manual Writing Mode */}
                {editModalState.mode === 'manual' && (
                  <div className="space-y-3.5 pt-1">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Nama Penuh: <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Contoh: MUHAMAD AZUAN BIN RAMLI"
                          value={editModalState.manualName}
                          onChange={(e) => setEditModalState(prev => prev ? ({ ...prev, manualName: e.target.value }) : null)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Nombor Telefon:
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          placeholder="Contoh: 0137048407 / 012-3456789"
                          value={editModalState.manualPhone}
                          onChange={(e) => setEditModalState(prev => prev ? ({ ...prev, manualPhone: e.target.value }) : null)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 font-mono"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      ✍️ <strong>Kemasukan Manual:</strong> Gunakan pilihan ini jika individu belum mendaftar akaun di dalam aplikasi ini. Nama dan nombor telefon akan dipaparkan terus pada carta.
                    </p>
                  </div>
                )}

                {/* Live Preview */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-sm shrink-0">
                    <User size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Pratonton {editModalState.roleTitle}
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 truncate">
                      {editModalState.mode === 'dropdown'
                        ? (editModalState.selectedUid 
                            ? (allUsers.find(u => u.uid === editModalState.selectedUid)?.displayName || 'Ahli').toUpperCase()
                            : 'BELUM DILANTIK')
                        : (editModalState.manualName.trim().toUpperCase() || 'BELUM DILANTIK')}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 font-bold">
                      {editModalState.mode === 'dropdown'
                        ? (allUsers.find(u => u.uid === editModalState.selectedUid)?.phoneNumber || 'Tiada No Tel')
                        : (editModalState.manualPhone.trim() || 'Tiada No Tel')}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleClearRole(editModalState.roleKey, editModalState.roleTitle)}
                    disabled={updatingBiroKey === editModalState.roleKey}
                    className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    <span>Kosongkan</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditModalState(null)}
                      className="py-2.5 px-4 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Batal
                    </button>

                    <button
                      type="submit"
                      disabled={updatingBiroKey === editModalState.roleKey}
                      className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {updatingBiroKey === editModalState.roleKey ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      <span>Simpan Pelantikan</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
