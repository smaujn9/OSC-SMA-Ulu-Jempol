import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Save, CheckCircle2, Phone, Mail, MapPin, Award, ArrowLeft, Plus, Trash2, Home, Users, HelpCircle, AlertCircle, User, LogIn, X, Lock, AlertTriangle, Bell, Copy, Check, ShieldCheck, ShieldAlert, Edit3, Loader2, Clock, Download, Image as ImageIcon, FileText, Printer } from 'lucide-react';
import { doc, getDoc, getDocs, query, collection, where, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DaftarAhliSectionProps {
  isMobile?: boolean;
  onBack?: () => void;
}

export default function DaftarAhliSection({ isMobile = false, onBack }: DaftarAhliSectionProps) {
  const { firebaseUser, currentUserDoc, loading, submitMembershipApplication, allUsers, allApplications, loginWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [icError, setIcError] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [noRumah, setNoRumah] = useState('');
  const [address, setAddress] = useState('');
  const [poskod, setPoskod] = useState('72200');
  const [bandar, setBandar] = useState('Batu Kikir');
  const [negeri, setNegeri] = useState('Negeri Sembilan');
  const [statusKediaman, setStatusKediaman] = useState('Pemilik'); // 'Pemilik' | 'Penyewa'
  const [namaPemilikRumah, setNamaPemilikRumah] = useState('');
  const [noTelPemilikRumah, setNoTelPemilikRumah] = useState('');
  const [bilanganIsiRumah, setBilanganIsiRumah] = useState(1);
  const [bilanganTanggungan, setBilanganTanggungan] = useState(0);
  const [senaraiAhliKeluarga, setSenaraiAhliKeluarga] = useState<Array<{ nama: string; hubungan: string; umur: string; baseYear?: number }>>([]);

  const [isTruthful, setIsTruthful] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [showTruthModal, setShowTruthModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedMemberNo, setCopiedMemberNo] = useState(false);

  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState<boolean>(true);
  const [hasInitializedForm, setHasInitializedForm] = useState<boolean>(false);

  // Direct fetch fallback from Firestore for high reliability
  const [directCheckedApp, setDirectCheckedApp] = useState<any>(null);
  const [directCheckedUser, setDirectCheckedUser] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDirectData = async () => {
      if (!firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid === 'guest_local') return;
      try {
        // 1. Direct fetch user document
        const uRef = doc(db, 'users', firebaseUser.uid);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists() && isMounted) {
          setDirectCheckedUser(uSnap.data());
        }

        // 2. Direct fetch membership application by ID
        const directAppSnap = await getDoc(doc(db, 'membershipApplications', `app-${firebaseUser.uid}`));
        if (directAppSnap.exists() && isMounted) {
          setDirectCheckedApp(directAppSnap.data());
          return;
        }

        const directRawSnap = await getDoc(doc(db, 'membershipApplications', firebaseUser.uid));
        if (directRawSnap.exists() && isMounted) {
          setDirectCheckedApp(directRawSnap.data());
          return;
        }

        // 3. Query by email
        if (firebaseUser.email) {
          const emailLower = firebaseUser.email.toLowerCase().trim();
          const qApp = query(collection(db, 'membershipApplications'), where('email', '==', emailLower));
          const snap = await getDocs(qApp);
          if (!snap.empty && isMounted) {
            setDirectCheckedApp(snap.docs[0].data());
            return;
          }
        }

        // 4. Query by UID field
        const qAppUid = query(collection(db, 'membershipApplications'), where('uid', '==', firebaseUser.uid));
        const snapUid = await getDocs(qAppUid);
        if (!snapUid.empty && isMounted) {
          setDirectCheckedApp(snapUid.docs[0].data());
          return;
        }
      } catch (err) {
        console.warn("Ralat semak permohonan langsung di DaftarAhliSection:", err);
      }
    };

    fetchDirectData();
    return () => { isMounted = false; };
  }, [firebaseUser]);

  // Check if member is approved through multiple signals (memberNo, approvedAt, approvalStatus, role, or matching application)
  const matchedUser = directCheckedUser || allUsers.find(u => 
    u.uid === currentUserDoc?.uid || 
    (u.email && currentUserDoc?.email && u.email.toLowerCase().trim() === currentUserDoc.email.toLowerCase().trim()) || 
    (u.email && firebaseUser?.email && u.email.toLowerCase().trim() === firebaseUser.email.toLowerCase().trim()) || 
    (u.icNumber && currentUserDoc?.icNumber && u.icNumber === currentUserDoc.icNumber)
  );

  const matchedApp = directCheckedApp || allApplications.find(a => 
    a.uid === currentUserDoc?.uid || 
    (a.uid && firebaseUser?.uid && a.uid === firebaseUser.uid) ||
    (a.id === `app-${firebaseUser?.uid}` || a.id === firebaseUser?.uid) ||
    (currentUserDoc?.memberNo && a.memberNo && a.memberNo.trim() === currentUserDoc.memberNo.trim()) ||
    (a.email && currentUserDoc?.email && a.email.toLowerCase().trim() === currentUserDoc.email.toLowerCase().trim()) || 
    (firebaseUser?.email && a.email?.toLowerCase().trim() === firebaseUser.email.toLowerCase().trim()) || 
    (currentUserDoc?.icNumber && a.icNumber === currentUserDoc.icNumber)
  );

  // Check if current user or application is explicitly set to Kuiri
  const isExplicitlyKuiri = Boolean(
    currentUserDoc?.membershipStatus === 'Kuiri' ||
    currentUserDoc?.approvalStatus === 'Kuiri' ||
    matchedUser?.membershipStatus === 'Kuiri' ||
    matchedUser?.approvalStatus === 'Kuiri' ||
    (matchedApp && (
      matchedApp.status === 'Kuiri' || 
      matchedApp.status === 'Kuiri Permohonan' || 
      matchedApp.status === 'Perlu Kemaskini'
    ))
  );

  // Check if user has updated/resubmitted their application (only if not explicitly set to Kuiri again)
  const isUserResubmitted = !isExplicitlyKuiri && Boolean(
    currentUserDoc?.membershipStatus === 'Menunggu Kelulusan' ||
    currentUserDoc?.approvalStatus === 'Pending' ||
    currentUserDoc?.approvalStatus === 'Dalam Proses Semakan' ||
    (matchedUser && (matchedUser.membershipStatus === 'Menunggu Kelulusan' || matchedUser.approvalStatus === 'Pending')) ||
    (matchedApp && (matchedApp.status === 'Pending' || matchedApp.status === 'Dalam Proses Semakan' || matchedApp.status === 'Diluluskan' || matchedApp.status === 'Approved'))
  );

  // Kuiri status applies whenever isExplicitlyKuiri is true
  const isKuiriMember = isExplicitlyKuiri;

  const isApprovedMember = Boolean(
    !isKuiriMember && (
      // 1. currentUserDoc status
      (currentUserDoc && (
        currentUserDoc.membershipStatus === 'Aktif' ||
        currentUserDoc.membershipStatus === 'Active' ||
        currentUserDoc.membershipStatus === 'Diluluskan' ||
        currentUserDoc.membershipStatus === 'Diluluskan Keahlian' ||
        currentUserDoc.approvalStatus === 'Approved' ||
        currentUserDoc.approvalStatus === 'Diluluskan' ||
        currentUserDoc.approvalStatus === 'Diluluskan Keahlian' ||
        (currentUserDoc.memberNo && typeof currentUserDoc.memberNo === 'string' && currentUserDoc.memberNo.trim().length > 0) ||
        Boolean(currentUserDoc.approvedAt) ||
        currentUserDoc.isSuperAdmin === true ||
        ['Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi', 'Naib Pengerusi', 'Ahli Jawatankuasa', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Juru Audit'].includes(currentUserDoc.role || '')
      )) ||
      // 2. allUsers / directCheckedUser match
      Boolean(matchedUser && (
        matchedUser.membershipStatus === 'Aktif' || 
        matchedUser.membershipStatus === 'Active' || 
        matchedUser.membershipStatus === 'Diluluskan' || 
        matchedUser.membershipStatus === 'Diluluskan Keahlian' || 
        matchedUser.approvalStatus === 'Approved' || 
        matchedUser.approvalStatus === 'Diluluskan' || 
        Boolean(matchedUser.memberNo && typeof matchedUser.memberNo === 'string' && matchedUser.memberNo.trim().length > 0) || 
        Boolean(matchedUser.approvedAt) || 
        matchedUser.isSuperAdmin === true ||
        ['Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi', 'Naib Pengerusi', 'Ahli Jawatankuasa', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Juru Audit'].includes(matchedUser.role || '')
      )) ||
      // 3. allApplications / directCheckedApp match (only if actually approved and NOT Kuiri)
      Boolean(matchedApp && (
        matchedApp.status === 'Diluluskan' || 
        matchedApp.status === 'Approved' || 
        matchedApp.status === 'Diluluskan Keahlian'
      ))
    )
  );

  const isPendingMember = Boolean(
    !isApprovedMember && (!isKuiriMember || isUserResubmitted) && (
      currentUserDoc?.membershipStatus === 'Menunggu Kelulusan' ||
      currentUserDoc?.approvalStatus === 'Pending' ||
      currentUserDoc?.approvalStatus === 'Dalam Proses Semakan' ||
      matchedUser?.membershipStatus === 'Menunggu Kelulusan' ||
      matchedUser?.approvalStatus === 'Pending' ||
      (matchedApp && (matchedApp.status === 'Pending' || matchedApp.status === 'Dalam Proses Semakan')) ||
      isUserResubmitted
    )
  );

  const displayName = currentUserDoc?.displayName || matchedApp?.name || matchedUser?.displayName || firebaseUser?.displayName || name || 'Warga Sekolah';
  const displayMemberNo = currentUserDoc?.memberNo || matchedUser?.memberNo || matchedApp?.memberNo || 'SMAUJ-2026-SAH';
  const displayRole = currentUserDoc?.role || matchedUser?.role || (isApprovedMember ? 'Warga Sekolah' : 'Pelawat');
  const displayIc = currentUserDoc?.icNumber || matchedApp?.icNumber || matchedUser?.icNumber || icNumber || '-';
  const displayNoRumah = currentUserDoc?.noRumah || matchedApp?.noRumah || matchedUser?.noRumah || noRumah || '-';
  const displayAddress = currentUserDoc?.address || matchedApp?.address || matchedUser?.address || address || (displayNoRumah !== '-' ? `Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan` : '-');
  const displayPhone = currentUserDoc?.phoneNumber || matchedApp?.phone || matchedUser?.phoneNumber || phone || '-';
  const displayEmail = currentUserDoc?.email || firebaseUser?.email || matchedApp?.email || matchedUser?.email || '-';
  const isPenyewaSource = [
    directCheckedUser?.statusKediaman,
    directCheckedApp?.statusKediaman,
    currentUserDoc?.statusKediaman,
    matchedApp?.statusKediaman,
    matchedUser?.statusKediaman,
    statusKediaman
  ].some(val => val && String(val).toLowerCase().includes('penyewa'));
  const rawStatusKediaman = isPenyewaSource ? 'Penyewa' : 'Pemilik';
  const displayStatusKediaman = isPenyewaSource ? 'Penyewa' : 'Pemilik (Sendiri)';
  const displayFamily = (currentUserDoc?.senaraiAhliKeluarga && currentUserDoc.senaraiAhliKeluarga.length > 0)
    ? currentUserDoc.senaraiAhliKeluarga
    : (matchedApp?.senaraiAhliKeluarga && matchedApp.senaraiAhliKeluarga.length > 0)
      ? matchedApp.senaraiAhliKeluarga
      : senaraiAhliKeluarga;

  const kuiriRemarks = matchedApp?.remarks || currentUserDoc?.kuiriRemarks || matchedUser?.kuiriRemarks || '';
  const kuiriItems: string[] = matchedApp?.kuiriItems || (currentUserDoc as any)?.kuiriItems || [];

  const checkFieldIsKuiried = (fieldKey: string): boolean => {
    if (!isKuiriMember) return false;
    
    const allItemsLower = (kuiriItems || []).map(i => String(i).toLowerCase().trim());
    const remarksLower = (kuiriRemarks || '').toLowerCase();

    switch (fieldKey) {
      case 'name':
        return allItemsLower.some(i => i.includes('nama_penuh') || i.includes('nama penuh') || i.includes('ejaan nama') || i.includes('singkatan')) ||
               remarksLower.includes('nama penuh') || remarksLower.includes('nama tak lengkap');
      case 'nickname':
        return allItemsLower.some(i => i.includes('nickname') || i.includes('nama panggilan') || i.includes('panggilan')) ||
               remarksLower.includes('panggilan');
      case 'icNumber':
        return allItemsLower.some(i => i.includes('no_ic') || i.includes('kad pengenalan') || i.includes('12 digit') || i.includes('no ic')) ||
               remarksLower.includes('kad pengenalan') || remarksLower.includes('no ic') || remarksLower.includes('no. ic');
      case 'noRumah':
      case 'address':
        return allItemsLower.some(i => i.includes('alamat_rumah') || i.includes('alamat') || i.includes('nombor rumah') || i.includes('no rumah') || i.includes('lorong')) ||
               remarksLower.includes('nombor rumah') || remarksLower.includes('no. rumah') || remarksLower.includes('alamat');
      case 'statusKediaman':
        return allItemsLower.some(i => i.includes('status_kediaman') || i.includes('status kediaman') || i.includes('pemilik') || i.includes('penyewa')) ||
               remarksLower.includes('status kediaman');
      case 'pemilik_penyewa':
        return allItemsLower.some(i => i.includes('pemilik_penyewa') || i.includes('pemilik rumah') || i.includes('maklumat pemilik')) ||
               remarksLower.includes('pemilik rumah');
      case 'phone':
        return allItemsLower.some(i => i.includes('no_telefon') || i.includes('telefon') || i.includes('no. tel') || i.includes('hubungan')) ||
               remarksLower.includes('no. telefon') || remarksLower.includes('no tel');
      case 'isi_rumah':
        return allItemsLower.some(i => i.includes('isi_rumah') || i.includes('isi rumah') || i.includes('tanggungan') || i.includes('ahli keluarga')) ||
               remarksLower.includes('isi rumah') || remarksLower.includes('tanggungan');
      default:
        return false;
    }
  };

  const startEditingForm = () => {
    setName(displayName !== 'Ahli Persatuan' ? displayName : (matchedApp?.name || currentUserDoc?.displayName || name));
    setNickname(currentUserDoc?.nickname || matchedApp?.nickname || nickname || '');
    setIcNumber(displayIc !== '-' ? displayIc : (matchedApp?.icNumber || currentUserDoc?.icNumber || icNumber || ''));
    setPhone(displayPhone !== '-' ? displayPhone : (matchedApp?.phone || currentUserDoc?.phoneNumber || phone || ''));
    setEmail(displayEmail !== '-' ? displayEmail : (matchedApp?.email || currentUserDoc?.email || email || ''));
    setNoRumah(displayNoRumah !== '-' ? displayNoRumah : (matchedApp?.noRumah || currentUserDoc?.noRumah || noRumah || ''));
    setAddress(displayAddress !== '-' ? displayAddress : (matchedApp?.address || currentUserDoc?.address || address || ''));
    setPoskod(currentUserDoc?.poskod || matchedApp?.poskod || poskod || '72200');
    setBandar(currentUserDoc?.bandar || matchedApp?.bandar || bandar || 'Batu Kikir');
    setNegeri(currentUserDoc?.negeri || matchedApp?.negeri || negeri || 'Negeri Sembilan');
    setStatusKediaman(rawStatusKediaman.toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik');
    setNamaPemilikRumah(currentUserDoc?.namaPemilikRumah || matchedApp?.namaPemilikRumah || namaPemilikRumah || '');
    setNoTelPemilikRumah(currentUserDoc?.noTelPemilikRumah || matchedApp?.noTelPemilikRumah || noTelPemilikRumah || '');
    setBilanganIsiRumah(Number(currentUserDoc?.bilanganIsiRumah || matchedApp?.bilanganIsiRumah || bilanganIsiRumah || 1));
    setBilanganTanggungan(Number((currentUserDoc as any)?.bilanganTanggungan || matchedApp?.bilanganTanggungan || bilanganTanggungan || 0));
    setSenaraiAhliKeluarga(displayFamily || []);
    setIsTruthful(true);
    setHasReadPrivacy(true);
    setIsEditing(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system', 'yuranConfig'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.enableMembershipRegistration !== undefined) {
          setIsRegistrationEnabled(data.enableMembershipRegistration !== false);
        }
      }
    }, (err) => {
      console.warn("Ralat semak enableMembershipRegistration di DaftarAhliSection:", err);
    });
    return () => unsub();
  }, []);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);

  const isGoogleSignedIn = firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local';

  useEffect(() => {
    // If user is already approved, pending, or in kuiri, NEVER show the warning modal
    if (isApprovedMember || isPendingMember || isKuiriMember) {
      setShowWarningModal(false);
      setHasShownWarning(true);
      return;
    }

    const handleTriggerWarning = () => {
      if (!isApprovedMember && !isPendingMember && !isKuiriMember) {
        setShowWarningModal(true);
        setHasShownWarning(true);
      }
    };

    window.addEventListener('tmf2_show_daftar_warning', handleTriggerWarning);

    // Auto-display modal for users who have not registered yet when entering registration
    if (!loading && !hasShownWarning && !isApprovedMember && !isPendingMember && !isKuiriMember) {
      setShowWarningModal(true);
      setHasShownWarning(true);
    }

    if (sessionStorage.getItem('tmf2_open_daftar_warning') === 'true') {
      sessionStorage.removeItem('tmf2_open_daftar_warning');
      if (!isApprovedMember && !isPendingMember && !isKuiriMember) {
        setShowWarningModal(true);
        setHasShownWarning(true);
      }
    }

    return () => {
      window.removeEventListener('tmf2_show_daftar_warning', handleTriggerWarning);
    };
  }, [loading, isApprovedMember, isPendingMember, isKuiriMember, hasShownWarning]);

  // Clear stale local snapshots whenever admin resets status to Kuiri in Firestore
  useEffect(() => {
    if (currentUserDoc?.membershipStatus === 'Kuiri' || currentUserDoc?.approvalStatus === 'Kuiri') {
      setDirectCheckedApp(null);
      setDirectCheckedUser(null);
    }
  }, [currentUserDoc?.membershipStatus, currentUserDoc?.approvalStatus]);

  // Auto-heal active membership status in Firestore if user is recognized as approved (ONLY IF NOT KUIRI)
  useEffect(() => {
    if (!isKuiriMember && isApprovedMember && currentUserDoc && firebaseUser && !firebaseUser.isAnonymous) {
      if (currentUserDoc.membershipStatus !== 'Aktif' || currentUserDoc.approvalStatus !== 'Approved') {
        const updatePayload: any = {
          membershipStatus: 'Aktif',
          approvalStatus: 'Approved'
        };
        if (!currentUserDoc.role || currentUserDoc.role === 'Pelawat' || currentUserDoc.role === 'Tetamu') {
          updatePayload.role = 'Ahli Biasa';
        }
        if (!currentUserDoc.memberNo && displayMemberNo && displayMemberNo !== 'SMAUJ-2026-SAH') {
          updatePayload.memberNo = displayMemberNo;
        }
        if (!currentUserDoc.noRumah && displayNoRumah && displayNoRumah !== '-') {
          updatePayload.noRumah = displayNoRumah;
        }
        if (!currentUserDoc.icNumber && displayIc && displayIc !== '-') {
          updatePayload.icNumber = displayIc;
        }
        updateDoc(doc(db, 'users', firebaseUser.uid), updatePayload).catch(e => console.warn("Auto-heal keahlian aktif error:", e));
      }
    }
  }, [isApprovedMember, currentUserDoc, firebaseUser, displayMemberNo, displayNoRumah, displayIc]);

  // Populate from currentUserDoc or defaults on initial load
  useEffect(() => {
    if (!hasInitializedForm && currentUserDoc) {
      setName(currentUserDoc.displayName || '');
      setNickname(currentUserDoc.nickname || '');
      setIcNumber(currentUserDoc.icNumber || '');
      setPhone(currentUserDoc.phoneNumber || '');
      setEmail(currentUserDoc.email || firebaseUser?.email || '');
      setNoRumah(currentUserDoc.noRumah || '');
      setAddress(currentUserDoc.address || '');
      setPoskod(currentUserDoc.poskod || '72200');
      setBandar(currentUserDoc.bandar || 'Batu Kikir');
      setNegeri(currentUserDoc.negeri || 'Negeri Sembilan');
      setStatusKediaman((currentUserDoc.statusKediaman || 'Pemilik').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik');
      setNamaPemilikRumah(currentUserDoc.namaPemilikRumah || '');
      setNoTelPemilikRumah(currentUserDoc.noTelPemilikRumah || '');
      setBilanganIsiRumah(currentUserDoc.bilanganIsiRumah || 1);
      setBilanganTanggungan((currentUserDoc as any).bilanganTanggungan || 0);
      setSenaraiAhliKeluarga(currentUserDoc.senaraiAhliKeluarga || []);
      setHasInitializedForm(true);
    } else if (!hasInitializedForm && firebaseUser) {
      setEmail(firebaseUser.email || '');
      setName((firebaseUser.displayName || '').toUpperCase());
      setHasInitializedForm(true);
    }
  }, [currentUserDoc, firebaseUser, hasInitializedForm]);

  const handleIcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setIcNumber(val);
    
    if (val.length === 12) {
      // Check real duplicates in firestore list
      const isIcDuplicate = allUsers.some(u => u.icNumber === val && u.uid !== firebaseUser?.uid);
      if (isIcDuplicate) {
        setIcError("No. Kad Pengenalan ini telah digunakan oleh ahli lain.");
      } else {
        setIcError("");
      }
    } else if (val.length > 0 && val.length < 12) {
      setIcError("Sila masukkan 12 digit tanpa sengkang.");
    } else {
      setIcError("");
    }
  };

  const addFamilyMember = () => {
    setSenaraiAhliKeluarga(prev => [...prev, { nama: '', hubungan: '', umur: '', baseYear: new Date().getFullYear() }]);
  };

  const removeFamilyMember = (index: number) => {
    setSenaraiAhliKeluarga(prev => prev.filter((_, i) => i !== index));
  };

  const handleFamilyMemberChange = (index: number, field: string, value: string) => {
    setSenaraiAhliKeluarga(prev => prev.map((member, i) => {
      if (i === index) {
        return { ...member, [field]: value };
      }
      return member;
    }));
  };

  const isFamilyMembersValid = 
    senaraiAhliKeluarga.length === 0 || 
    senaraiAhliKeluarga.every(m => m.nama.trim().length > 0 && m.hubungan.trim().length > 0 && m.umur.trim().length > 0);

  const isFormValid = 
    name.trim().length > 0 && 
    nickname.trim().length > 0 && 
    icNumber.length === 12 && 
    !icError && 
    phone.trim().length > 0 && 
    noRumah.trim().length > 0 && 
    address.trim().length > 0 && 
    poskod.trim().length > 0 && 
    bandar.trim().length > 0 &&
    bilanganIsiRumah >= 1 &&
    isFamilyMembersValid &&
    isTruthful &&
    hasReadPrivacy;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    try {
      setIsSubmitting(true);
      setSubmitError('');

      // If user is already approved and editing their details:
      if (isApprovedMember && firebaseUser) {
        const updatedFamily = senaraiAhliKeluarga.filter(m => m.nama.trim() !== '').map(m => ({
          nama: m.nama.trim(),
          hubungan: m.hubungan.trim(),
          umur: m.umur.trim(),
          baseYear: m.baseYear || new Date().getFullYear()
        }));

        const statusKediamanVal = statusKediaman === 'Penyewa' ? 'Penyewa' : 'Pemilik (Sendiri)';

        const userUpdatePayload = {
          displayName: name.trim().toUpperCase(),
          nickname: nickname.trim(),
          phoneNumber: phone.trim(),
          email: (email || firebaseUser.email || '').trim().toLowerCase(),
          noRumah: noRumah.trim(),
          address: address.trim(),
          poskod: poskod.trim(),
          bandar: bandar.trim(),
          negeri,
          statusKediaman: statusKediamanVal,
          namaPemilikRumah: statusKediaman === 'Penyewa' ? namaPemilikRumah.trim() : '',
          noTelPemilikRumah: statusKediaman === 'Penyewa' ? noTelPemilikRumah.trim() : '',
          bilanganIsiRumah,
          bilanganTanggungan,
          senaraiAhliKeluarga: updatedFamily,
          membershipStatus: 'Aktif',
          approvalStatus: 'Approved',
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), userUpdatePayload, { merge: true });

        // Also sync to membershipApplications so admin Kelulusan Ahli views see latest edits
        const appSyncPayload = {
          name: name.trim().toUpperCase(),
          nickname: nickname.trim(),
          phone: phone.trim(),
          email: (email || firebaseUser.email || '').trim().toLowerCase(),
          noRumah: noRumah.trim(),
          address: address.trim(),
          poskod: poskod.trim(),
          bandar: bandar.trim(),
          negeri,
          statusKediaman: statusKediamanVal,
          namaPemilikRumah: statusKediaman === 'Penyewa' ? namaPemilikRumah.trim() : '',
          noTelPemilikRumah: statusKediaman === 'Penyewa' ? noTelPemilikRumah.trim() : '',
          bilanganIsiRumah,
          bilanganTanggungan,
          senaraiAhliKeluarga: updatedFamily,
          updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, 'membershipApplications', `app-${firebaseUser.uid}`), appSyncPayload, { merge: true }).catch(() => {});
        await setDoc(doc(db, 'membershipApplications', firebaseUser.uid), appSyncPayload, { merge: true }).catch(() => {});

        // Directly update local state so UI updates instantly
        setDirectCheckedUser((prev: any) => ({
          ...(prev || {}),
          ...userUpdatePayload,
          statusKediaman: statusKediamanVal
        }));
        setDirectCheckedApp((prev: any) => ({
          ...(prev || {}),
          ...appSyncPayload,
          statusKediaman: statusKediamanVal
        }));

        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          setIsEditing(false);
        }, 1500);
        return;
      }
      
      const payload = {
        name: name.trim().toUpperCase(),
        nickname: nickname.trim(),
        icNumber: icNumber.trim(),
        phone: phone.trim(),
        email: (email || firebaseUser?.email || '').trim().toLowerCase(),
        noRumah: noRumah.trim(),
        address: address.trim(),
        poskod: poskod.trim(),
        bandar: bandar.trim(),
        negeri,
        statusKediaman,
        namaPemilikRumah: statusKediaman === 'Penyewa' ? namaPemilikRumah.trim() : '',
        noTelPemilikRumah: statusKediaman === 'Penyewa' ? noTelPemilikRumah.trim() : '',
        bilanganIsiRumah,
        bilanganTanggungan,
        senaraiAhliKeluarga: senaraiAhliKeluarga.filter(m => m.nama.trim() !== '').map(m => ({
          nama: m.nama.trim(),
          hubungan: m.hubungan.trim(),
          umur: m.umur.trim(),
          baseYear: m.baseYear || new Date().getFullYear()
        }))
      };

      await submitMembershipApplication(payload);
      setDirectCheckedApp({
        id: `app-${firebaseUser?.uid}`,
        uid: firebaseUser?.uid,
        ...payload,
        status: 'Pending',
        remarks: '',
        kuiriItems: [],
        submittedAt: new Date()
      } as any);
      setDirectCheckedUser({
        ...currentUserDoc,
        ...payload,
        membershipStatus: 'Menunggu Kelulusan',
        approvalStatus: 'Pending',
        kuiriRemarks: '',
        kuiriItems: []
      } as any);
      setIsEditing(false);
      
      // Automatically register & subscribe device to Push Notifications for approval alerts
      try {
        const { registerServiceWorkerAndSubscribe } = await import('../utils/notificationHelper');
        await registerServiceWorkerAndSubscribe();
      } catch (pushErr) {
        console.warn("Makluman subskripsi automatik notifikasi push:", pushErr);
      }

      // Trigger push notification to leadership: Admin, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, Bendahari
      try {
        const { notifyOnNewMemberRegistration } = await import('../utils/notificationHelper');
        await notifyOnNewMemberRegistration({
          applicantName: payload.name,
          noRumah: payload.noRumah,
          phone: payload.phone,
          applicantUid: firebaseUser?.uid
        });
      } catch (notifyErr) {
        console.warn("Makluman penghantaran notifikasi pendaftaran ahli:", notifyErr);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        if (onBack) onBack();
      }, 2500);
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal menghantar permohonan. Cuba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = (
    <div className="space-y-4">
      {/* Admin Utama Notice when registration is OFF */}
      {!isRegistrationEnabled && (currentUserDoc?.role === 'Admin Utama' || currentUserDoc?.isSuperAdmin === true) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 text-amber-900 text-xs font-bold">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <div>
            <span>PENDAFTARAN SEDANG DITUTUP (OFF):</span> Anda melihat borang ini kerana anda bertindak sebagai Admin Utama. Ahli biasa/penduduk tidak dapat mengakses borang pendaftaran semasa mod ini dinyahaktifkan.
          </div>
        </div>
      )}

      {/* Edit Mode Banner for Approved Member */}
      {isApprovedMember && isEditing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-emerald-900 text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span>MOD KEMASKINI MAKLUMAT AHLI BERDAFTAR</span>
              <p className="text-[10px] font-normal text-emerald-700">Mengemaskini butiran bagi No. Ahli: <strong className="font-mono font-bold">{displayMemberNo}</strong>.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-[10px] px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
        </div>
      )}

      {/* Edit Mode Banner for Kuiri Member */}
      {isKuiriMember && isEditing && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 text-xs font-bold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black uppercase tracking-wider block text-amber-900">MOD KEMASKINI KUIRI PERMOHONAN</span>
              <p className="text-[11px] font-semibold text-amber-800 mt-0.5">
                Sila perbaiki maklumat yang telah dikuiri oleh pihak pentadbir di bawah (seperti Nama Penuh atau maklumat Isi Rumah) dan klik butang <strong>Hantar Semula Permohonan</strong>.
              </p>
              {kuiriRemarks && (
                <p className="text-[10px] text-amber-950 italic mt-1 font-semibold bg-white/80 p-2 rounded-lg border border-amber-200">
                  Catatan Pentadbir: "{kuiriRemarks}"
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-[10px] px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg font-bold hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
          >
            Batal
          </button>
        </div>
      )}

      {/* Edit Mode Banner for Pending Member */}
      {!isKuiriMember && !isApprovedMember && isEditing && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between text-indigo-950 text-xs font-bold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <Edit3 size={18} className="text-indigo-600 shrink-0" />
            <div>
              <span className="font-black uppercase tracking-wider block text-indigo-900">MOD KEMASKINI PERMOHONAN</span>
              <p className="text-[10px] font-normal text-indigo-700">Mengemaskini butiran permohonan pendaftaran warga sebelum disahkan oleh pihak sekolah.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-[10px] px-3 py-1.5 bg-white border border-indigo-300 text-indigo-900 rounded-lg font-bold hover:bg-indigo-100 transition-colors cursor-pointer shrink-0"
          >
            Batal
          </button>
        </div>
      )}

      {/* Status Info Box */}
      {(() => {
        const hasSubmittedApplication = !!(currentUserDoc?.icNumber && currentUserDoc?.noRumah);
        const status = currentUserDoc?.membershipStatus;
        if (isApprovedMember) {
          return (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="space-y-0.5">
                <h5 className="font-extrabold text-xs text-emerald-800">WARGA AKTIF</h5>
                <p className="text-[10px] text-emerald-600 font-bold leading-relaxed">
                  Tahniah! Anda adalah warga berdaftar Sekolah Menengah Agama Ulu Jempol (SMAUJ) dengan No. Pendaftaran: <span className="font-mono bg-emerald-100/50 px-1.5 py-0.5 rounded text-emerald-700 font-extrabold">{displayMemberNo}</span>. Maklumat di bawah merupakan butiran berdaftar anda.
                </p>
              </div>
            </div>
          );
        } else if (isKuiriMember || status === 'Kuiri' || currentUserDoc?.approvalStatus === 'Kuiri') {
          return (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 space-y-3 shadow-md animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                  <h5 className="font-black text-xs text-amber-950 uppercase tracking-wider">STATUS: KUIRI PERMOHONAN (PERLU KEMASKINI)</h5>
                  <p className="text-[11px] text-amber-900 font-bold leading-relaxed">
                    Pihak pentadbir persatuan telah melabelkan beberapa maklumat yang memerlukan pembetulan. Sila perhatikan tanda <strong className="text-amber-950 underline decoration-amber-500">⚠️ DIKUIRI: PERLU DIPERBETULKAN</strong> pada medan input berpetak kuning di bawah:
                  </p>
                  {kuiriRemarks && (
                    <p className="text-[10px] text-amber-950 font-bold italic bg-white/90 p-2.5 rounded-xl border border-amber-300 mt-1.5 shadow-2xs">
                      📌 Catatan Pentadbir: "{kuiriRemarks}"
                    </p>
                  )}
                </div>
              </div>

              {kuiriItems && kuiriItems.length > 0 && (
                <div className="pt-2 border-t border-amber-200/80">
                  <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider block mb-1.5">
                    Senarai Item Dikuiri Oleh Pentadbir:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {kuiriItems.map((item, idx) => (
                      <span key={idx} className="bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                        <AlertTriangle size={11} /> {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        } else if ((status === 'Menunggu Kelulusan' || currentUserDoc?.approvalStatus === 'Pending') && hasSubmittedApplication) {
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Clock size={16} className="animate-pulse text-amber-600" />
              </div>
              <div className="space-y-0.5">
                <h5 className="font-extrabold text-xs text-amber-900 uppercase tracking-wider">PERMOHONAN SEDANG DIPROSES (SEMAKAN SEMULA)</h5>
                <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                  Borang permohonan pendaftaran warga anda telah berjaya dikemaskini dan kini berada dalam status <strong className="text-amber-950 font-black underline decoration-amber-400">Semakan Semula</strong>. Sila tunggu pihak Pentadbir Sekolah membuat semakan dan kelulusan semula secara berkala.
                </p>
              </div>
            </div>
          );
        } else if (status === 'Ditolak' || currentUserDoc?.approvalStatus === 'Rejected') {
          return (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle size={16} />
              </div>
              <div className="space-y-0.5">
                <h5 className="font-extrabold text-xs text-rose-800">PERMOHONAN DITOLAK</h5>
                <p className="text-[10px] text-rose-600 font-bold leading-relaxed">
                  Dukacita dimaklumkan permohonan pendaftaran warga anda telah ditolak. Sila kemas kini maklumat anda di bawah dan hantar semula permohonan baru.
                </p>
              </div>
            </div>
          );
        } else {
          return (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <User size={16} />
              </div>
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h5 className="font-extrabold text-xs text-indigo-950">STATUS: BUKAN WARGA</h5>
                  <button
                    type="button"
                    onClick={() => setShowWarningModal(true)}
                    className="text-[10px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <AlertCircle size={12} />
                    <span>Polisi: 1 Rumah 1 Pendaftaran</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                  Anda melayari sistem sebagai pelawat/tetamu sahaja. Sila lengkapkan borang di bawah untuk memohon pendaftaran warga rasmi sehinggalah permohonan anda disahkan oleh pihak pentadbir sekolah.
                </p>
              </div>
            </div>
          );
        }
      })()}

      {/* 1. Maklumat Peribadi */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-1">
          <Award size={14} className="text-indigo-600" />
          Maklumat Peribadi
        </h4>

        {/* Nama Penuh */}
        <div className={`space-y-1 p-2.5 rounded-xl transition-all ${checkFieldIsKuiried('name') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : ''}`}>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nama Penuh (Huruf Besar)</label>
            {checkFieldIsKuiried('name') && (
              <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                <AlertTriangle size={11} /> DIKUIRI: PERLU DIPERBETULKAN
              </span>
            )}
          </div>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="Contoh: AHMAD BIN IDRIS"
            className={`w-full border rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden transition-all ${
              checkFieldIsKuiried('name') ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
            }`}
          />
          {checkFieldIsKuiried('name') && (
            <p className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1 mt-1">
              ⚠️ Nama penuh perlu diperbetulkan mengikut Kad Pengenalan rasmi (sertakan BIN / BINTI jika ada).
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Nama Panggilan */}
          <div className={`space-y-1 p-2.5 rounded-xl transition-all ${checkFieldIsKuiried('nickname') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nama Panggilan</label>
              {checkFieldIsKuiried('nickname') && (
                <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                  <AlertTriangle size={11} /> DIKUIRI
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Contoh: Ahmad"
              className={`w-full border rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden transition-all ${
                checkFieldIsKuiried('nickname') ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
              }`}
            />
            {checkFieldIsKuiried('nickname') && (
              <p className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1 mt-1">
                ⚠️ Nama panggilan perlu diisi atau dikemaskini.
              </p>
            )}
          </div>

          {/* No IC */}
          <div className={`space-y-1 p-2.5 rounded-xl transition-all ${checkFieldIsKuiried('icNumber') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">No. Kad Pengenalan (12 Digit)</label>
              {checkFieldIsKuiried('icNumber') && (
                <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                  <AlertTriangle size={11} /> DIKUIRI: PERLU DIPERBETULKAN
                </span>
              )}
            </div>
            <input
              type="text"
              required
              maxLength={12}
              pattern="\d{12}"
              placeholder="Contoh: 820512105123"
              value={icNumber}
              onChange={handleIcChange}
              className={`w-full border rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden transition-all ${
                icError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 
                checkFieldIsKuiried('icNumber') ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
              }`}
            />
            {icError && (
              <p className="text-[10px] text-rose-500 font-bold mt-1 leading-tight">{icError}</p>
            )}
            {checkFieldIsKuiried('icNumber') && (
              <p className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1 mt-1">
                ⚠️ Sila semak semula No. Kad Pengenalan (mesti 12 digit tanpa sengkang).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Maklumat Kediaman & Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-1">
          <Home size={14} className="text-teal-600" />
          Maklumat Kediaman
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* No. Rumah */}
          <div className={`space-y-1 p-2.5 rounded-xl transition-all ${checkFieldIsKuiried('noRumah') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">No. Rumah (3 Digit Nombor sahaja)</label>
              {checkFieldIsKuiried('noRumah') && (
                <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                  <AlertTriangle size={11} /> DIKUIRI: PERLU DIPERBETULKAN
                </span>
              )}
            </div>
            <input
              type="text"
              required
              maxLength={3}
              placeholder="Contoh: 045"
              value={noRumah}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setNoRumah(val.slice(0, 3));
              }}
              className={`w-full border rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden transition-all ${
                checkFieldIsKuiried('noRumah') ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
              }`}
            />
            {checkFieldIsKuiried('noRumah') && (
              <p className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1 mt-1">
                ⚠️ Nombor rumah 3 digit perlu dinyatakan dengan tepat (contoh: 045).
              </p>
            )}
          </div>

          {/* Status Kediaman */}
          <div className={`space-y-1.5 p-2.5 rounded-xl transition-all ${checkFieldIsKuiried('statusKediaman') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status Kediaman</label>
              {checkFieldIsKuiried('statusKediaman') && (
                <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                  <AlertTriangle size={11} /> DIKUIRI
                </span>
              )}
            </div>

            {/* Responsive Touch-Friendly Selector Buttons */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 mb-2">
              <button
                type="button"
                onClick={() => setStatusKediaman('Pemilik')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  statusKediaman !== 'Penyewa'
                    ? 'bg-teal-600 text-white shadow-xs ring-1 ring-teal-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>Pemilik (Sendiri)</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusKediaman('Penyewa')}
                className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  statusKediaman === 'Penyewa'
                    ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>Penyewa</span>
              </button>
            </div>

            {checkFieldIsKuiried('statusKediaman') && (
              <p className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1 mt-1">
                ⚠️ Pilih status kediaman sama ada Pemilik atau Penyewa.
              </p>
            )}
          </div>
        </div>

        {statusKediaman === 'Penyewa' && (
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl transition-all animate-in fade-in duration-200 ${
            checkFieldIsKuiried('pemilik_penyewa') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : 'bg-amber-50/50 border border-amber-100'
          }`}>
            <div className="col-span-full flex items-center justify-between border-b border-amber-200/80 pb-1.5 mb-1">
              <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">Maklumat Pemilik Kediaman (Penyewa)</span>
              {checkFieldIsKuiried('pemilik_penyewa') && (
                <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                  <AlertTriangle size={11} /> DIKUIRI: PERLU DIPERBETULKAN
                </span>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Nama Pemilik Rumah</label>
              <input
                type="text"
                value={namaPemilikRumah}
                onChange={(e) => setNamaPemilikRumah(e.target.value)}
                placeholder="Nama Pemilik"
                className="w-full border border-amber-300 rounded-lg p-2 text-xs font-bold text-amber-950 bg-white focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">No. Tel Pemilik Rumah</label>
              <input
                type="text"
                value={noTelPemilikRumah}
                onChange={(e) => setNoTelPemilikRumah(e.target.value)}
                placeholder="No. Telefon Pemilik"
                className="w-full border border-amber-300 rounded-lg p-2 text-xs font-bold text-amber-950 bg-white focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>
        )}

        {/* Alamat Penuh */}
        <div className={`space-y-1 p-2.5 rounded-xl transition-all ${checkFieldIsKuiried('address') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : ''}`}>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Alamat Penuh (Lorong & Fasa)</label>
            {checkFieldIsKuiried('address') && (
              <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                <AlertTriangle size={11} /> DIKUIRI: PERLU DIPERBETULKAN
              </span>
            )}
          </div>
          <textarea
            required
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan"
            className={`w-full border rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden transition-all resize-none ${
              checkFieldIsKuiried('address') ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
            }`}
          />
          {checkFieldIsKuiried('address') && (
            <p className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1 mt-1">
              ⚠️ Alamat lorong & fasa perlu diisi dengan lengkap.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Poskod</label>
            <input
              type="text"
              required
              placeholder="43000"
              value={poskod}
              onChange={(e) => setPoskod(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Bandar</label>
            <input
              type="text"
              required
              placeholder="Kajang"
              value={bandar}
              onChange={(e) => setBandar(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Negeri</label>
            <select
              value={negeri}
              onChange={(e) => setNegeri(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="Selangor">Selangor</option>
              <option value="Kuala Lumpur">Kuala Lumpur</option>
              <option value="Putrajaya">Putrajaya</option>
              <option value="Negeri Sembilan">Negeri Sembilan</option>
              <option value="Melaka">Melaka</option>
              <option value="Johor">Johor</option>
              <option value="Perak">Perak</option>
              <option value="Pulau Pinang">Pulau Pinang</option>
              <option value="Kedah">Kedah</option>
              <option value="Perlis">Perlis</option>
              <option value="Pahang">Pahang</option>
              <option value="Terengganu">Terengganu</option>
              <option value="Kelantan">Kelantan</option>
              <option value="Sabah">Sabah</option>
              <option value="Sarawak">Sarawak</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Maklumat Hubungan & Integrasi */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-1">
          <Phone size={14} className="text-sky-600" />
          Maklumat Perhubungan
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* No Telefon */}
          <div className={`space-y-1 p-2.5 rounded-xl transition-all ${checkFieldIsKuiried('phone') ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">No. Telefon</label>
              {checkFieldIsKuiried('phone') && (
                <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
                  <AlertTriangle size={11} /> DIKUIRI: PERLU DIPERBETULKAN
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 0123456789"
              className={`w-full border rounded-lg p-2.5 text-xs font-bold text-gray-800 bg-white focus:outline-hidden transition-all ${
                checkFieldIsKuiried('phone') ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
              }`}
            />
            {checkFieldIsKuiried('phone') && (
              <p className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1 mt-1">
                ⚠️ Nombor telefon perlu dipastikan tepat untuk urusan pengesahan & WhatsApp.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">E-mel (Sistem Google)</label>
            <input
              type="email"
              disabled
              value={email}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-gray-400 bg-gray-50 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* 4. Maklumat Isi Rumah */}
      <div className={`border rounded-xl p-4 space-y-4 shadow-xs transition-all ${
        checkFieldIsKuiried('isi_rumah') 
          ? 'bg-amber-500/10 border-2 border-amber-500 ring-2 ring-amber-400/20' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
          <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
            <Users size={14} className="text-indigo-600" />
            Maklumat Isi Rumah & Tanggungan
          </h4>
          {checkFieldIsKuiried('isi_rumah') && (
            <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-2xs">
              <AlertTriangle size={11} /> DIKUIRI: PERLU DIPERBETULKAN
            </span>
          )}
        </div>

        {/* Makluman 1 Rumah 1 Pendaftaran & Keahlian Automatik */}
        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-900 leading-relaxed font-semibold">
            <strong>Peringatan 1 Rumah 1 Pendaftaran Sahaja:</strong> Nama-nama yang didaftarkan di dalam Senarai Isi Rumah ini secara <strong>automatik akan menjadi ahli sah persatuan</strong> tanpa perlu membuat permohonan berasingan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Bilangan Isi Rumah (Orang)</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBilanganIsiRumah(prev => Math.max(1, prev - 1))}
                className="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:bg-slate-50 active:bg-slate-100 font-extrabold text-lg select-none cursor-pointer transition-colors"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={bilanganIsiRumah || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setBilanganIsiRumah(isNaN(val) ? 1 : Math.max(1, val));
                }}
                className="w-16 h-10 border border-gray-200 rounded-lg text-center font-extrabold text-xs text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setBilanganIsiRumah(prev => prev + 1)}
                className="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:bg-slate-50 active:bg-slate-100 font-extrabold text-lg select-none cursor-pointer transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-[9px] text-slate-400 font-semibold">Isi secara manual atau gunakan butang - / +.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Bilangan Tanggungan Sekolah / IPTA</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBilanganTanggungan(prev => Math.max(0, prev - 1))}
                className="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:bg-slate-50 active:bg-slate-100 font-extrabold text-lg select-none cursor-pointer transition-colors"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                value={bilanganTanggungan}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setBilanganTanggungan(isNaN(val) ? 0 : Math.max(0, val));
                }}
                className="w-16 h-10 border border-gray-200 rounded-lg text-center font-extrabold text-xs text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setBilanganTanggungan(prev => prev + 1)}
                className="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:bg-slate-50 active:bg-slate-100 font-extrabold text-lg select-none cursor-pointer transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-[9px] text-slate-400 font-semibold">Gunakan butang - / + untuk tukar bilangan.</p>
          </div>
        </div>

        <div className="space-y-2.5 mt-2">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Senarai Ahli Keluarga (Pilihan)</span>
              <span className="text-[9px] text-slate-400 font-medium">Boleh diisi jika ingin menyenaraikan ahli keluarga / tanggungan</span>
            </div>
            <button
              type="button"
              onClick={addFamilyMember}
              className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus size={12} /> Tambah Ahli
            </button>
          </div>

          {senaraiAhliKeluarga.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic text-center py-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">Tiada ahli keluarga ditambah (pilihan).</p>
          ) : (
            <div className="space-y-2.5">
              {senaraiAhliKeluarga.map((member, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 relative group animate-in fade-in duration-150">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nama Ahli"
                      value={member.nama}
                      onChange={(e) => handleFamilyMemberChange(idx, 'nama', e.target.value.toUpperCase())}
                      className="border border-gray-200 rounded-md p-1.5 text-[11px] font-bold text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Hubungan (e.g. Isteri, Anak)"
                      value={member.hubungan}
                      onChange={(e) => handleFamilyMemberChange(idx, 'hubungan', e.target.value)}
                      className="border border-gray-200 rounded-md p-1.5 text-[11px] font-semibold text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500"
                    />
                    <input
                      type="number"
                      required
                      placeholder="Umur"
                      value={member.umur}
                      onChange={(e) => handleFamilyMemberChange(idx, 'umur', e.target.value)}
                      className="border border-gray-200 rounded-md p-1.5 text-[11px] font-semibold text-gray-800 bg-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFamilyMember(idx)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Checkboxes Persetujuan */}
      <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input 
            type="checkbox" 
            required 
            checked={isTruthful}
            onChange={(e) => setIsTruthful(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-[10px] text-gray-600 font-medium leading-relaxed flex-1">
            Saya mengakui bahawa <strong className="text-gray-800">segala data di atas adalah benar</strong>. Saya faham bahawa memberikan maklumat palsu adalah satu kesalahan dan boleh dikenakan tindakan undang-undang.{' '}
            <button type="button" onClick={() => setShowTruthModal(true)} className="text-indigo-600 font-bold hover:underline">Baca Lanjut</button>
          </span>
        </label>
        
        <label className="flex items-start gap-3 cursor-pointer group">
          <input 
            type="checkbox" 
            required 
            checked={hasReadPrivacy}
            onChange={(e) => setHasReadPrivacy(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-[10px] text-gray-600 font-medium leading-relaxed flex-1">
            Saya telah membaca dan memahami <strong className="text-gray-800">Polisi Privasi (Privacy Policy)</strong>. Saya bersetuju dengan pengumpulan dan pemprosesan data peribadi saya sejajar dengan Akta Perlindungan Data Peribadi 2010.{' '}
            <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-indigo-600 font-bold hover:underline">Lihat Polisi Privasi</button>
          </span>
        </label>
      </div>

      {/* 6. Tarikh Integrasi (Disabled) */}
      <div className="grid grid-cols-2 gap-3 bg-slate-100/50 p-3 rounded-xl border border-slate-200/60">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Mohon (Hari Semasa)</label>
          <input
            type="text"
            disabled
            value={new Date().toLocaleDateString('ms-MY')}
            className="w-full border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-400 bg-slate-50 cursor-not-allowed"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Kemaskini (Hari Semasa)</label>
          <input
            type="text"
            disabled
            value={new Date().toLocaleDateString('ms-MY')}
            className="w-full border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-400 bg-slate-50 cursor-not-allowed"
          />
        </div>
      </div>

      {submitError && (
        <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-xs font-bold border border-rose-100">
          {submitError}
        </div>
      )}

      {isSuccess && (
        <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-lg flex items-center gap-2 text-xs font-bold border border-emerald-100 animate-in fade-in zoom-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-500" />
          Permohonan anda telah berjaya dihantar dan sedang menunggu kelulusan daripada Setiausaha Persatuan.
        </div>
      )}

      {/* Push Notification Notice */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-start gap-2.5">
        <Bell size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-indigo-900 font-semibold leading-relaxed">
          <strong className="font-bold">Notifikasi Automatik:</strong> Anda akan menerima pemberitahuan push notification pada peranti ini secara langsung sebaik sahaja permohonan pendaftaran warga anda disemak dan disahkan.
        </p>
      </div>

      <button
        type="submit"
        disabled={!isFormValid || isSubmitting || (!isEditing && currentUserDoc?.membershipStatus === 'Menunggu Kelulusan')}
        className={`w-full font-extrabold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${
          isFormValid && !isSubmitting && (isEditing || currentUserDoc?.membershipStatus !== 'Menunggu Kelulusan')
            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-750 hover:to-indigo-800 text-white cursor-pointer shadow-indigo-200 hover:scale-[1.01]' 
            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
        }`}
      >
        <Save size={16} />
        {isSubmitting 
          ? 'MENGHANTAR PERMOHONAN...' 
          : isKuiriMember || (isEditing && !isApprovedMember)
            ? 'HANTAR SEMULA PERMOHONAN (KEMASKINI)'
            : currentUserDoc?.membershipStatus === 'Menunggu Kelulusan'
              ? 'PERMOHONAN SEDANG DIPROSES'
              : currentUserDoc?.membershipStatus === 'Aktif'
                ? 'KEMASKINI MAKLUMAT WARGA'
                : 'DAFTAR WARGA'}
      </button>

      {/* Modals for Policies */}
      {showTruthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-500" />
                Akuan Maklumat Benar
              </h3>
              <button onClick={() => setShowTruthModal(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-[11px] text-slate-600 font-medium">
              <p>
                Dengan menandatangani/mengesahkan borang ini, anda mengakui bahawa semua maklumat yang diberikan adalah <strong>tepat, benar dan lengkap</strong> sepanjang pengetahuan anda.
              </p>
              <p>
                <strong>Kesalahan Memberikan Maklumat Palsu:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-500">
                <li>Berdasarkan undang-undang Malaysia, memberikan maklumat palsu dalam apa-apa permohonan atau pengisytiharan rasmi boleh menjadi satu kesalahan di bawah Kanun Keseksaan (Penal Code) dan akta-akta berkaitan.</li>
                <li>Sekiranya maklumat didapati palsu, pihak pengurusan sekolah berhak membatalkan permohonan pendaftaran warga anda serta-merta tanpa sebarang notis.</li>
                <li>Sebarang yuran yang telah dibayar mungkin tidak akan dikembalikan sekiranya pendaftaran warga terbatal akibat penipuan identiti.</li>
              </ul>
              <div className="bg-amber-50 text-amber-700 p-3 rounded-xl border border-amber-100 mt-2 font-bold">
                Sila pastikan anda menyemak semula butiran peribadi, nombor kad pengenalan dan maklumat isi rumah sebelum menghantar permohonan ini.
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end">
              <button onClick={() => { setShowTruthModal(false); setIsTruthful(true); }} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors">
                Saya Faham
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-indigo-500" />
                Polisi Privasi (Privacy Policy)
              </h3>
              <button onClick={() => setShowPrivacyModal(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-[11px] text-slate-600 font-medium">
              <p>
                Sekolah Menengah Agama Ulu Jempol (SMAUJ) komited untuk melindungi data peribadi anda selaras dengan <strong>Akta Perlindungan Data Peribadi 2010 (PDPA)</strong> Malaysia.
              </p>
              
              <div className="space-y-3">
                <div>
                  <strong className="text-slate-800 block mb-0.5">1. Pengumpulan Data</strong>
                  <p className="text-slate-500 leading-relaxed">Kami hanya mengumpul maklumat peribadi yang diberikan secara sukarela oleh anda melalui borang ini, termasuk nama, No. Kad Pengenalan, alamat, maklumat perhubungan, dan senarai isi rumah.</p>
                </div>
                <div>
                  <strong className="text-slate-800 block mb-0.5">2. Tujuan Penggunaan Data</strong>
                  <p className="text-slate-500 leading-relaxed">Data anda digunakan khusus untuk tujuan pendaftaran warga, pengurusan rekod sekolah, penyampaian notis mesyuarat, serta perancangan aktiviti dan kutipan sumbangan/yuran sekolah.</p>
                </div>
                <div>
                  <strong className="text-slate-800 block mb-0.5">3. Keselamatan Data</strong>
                  <p className="text-slate-500 leading-relaxed">Maklumat anda disimpan dengan selamat dalam sistem pangkalan data awan (Google Cloud / Firebase) yang dilindungi oleh pengesahan identiti terkini dan Polisi Keselamatan (Security Rules). Akses kepada data anda hanya diberikan kepada pihak pentadbir yang diberi kuasa.</p>
                </div>
                <div>
                  <strong className="text-slate-800 block mb-0.5">4. Pendedahan Pihak Ketiga</strong>
                  <p className="text-slate-500 leading-relaxed">Kami tidak akan menjual, menyewa, atau menukar data peribadi anda kepada mana-mana entiti luar, korporat atau pihak ketiga tanpa persetujuan bertulis dari anda, melainkan diwajibkan oleh undang-undang kerajaan Malaysia.</p>
                </div>
              </div>
              
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end">
              <button onClick={() => { setShowPrivacyModal(false); setHasReadPrivacy(true); }} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors">
                Saya Bersetuju
              </button>
            </div>
          </div>
        </div>
      )}

      {showWarningModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="h-2 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500" />
            
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <AlertCircle size={16} className="stroke-[2.5]" />
                </span>
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-amber-950 uppercase tracking-wide">
                    Peringatan Pendaftaran Warga
                  </h3>
                  <p className="text-[10px] text-amber-700 font-bold">1 Rumah 1 Pendaftaran Sahaja</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWarningModal(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-center max-h-[75vh]">
              {/* Icon Accent */}
              <div className="relative mx-auto w-16 h-16 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200 text-amber-800 rounded-2xl flex items-center justify-center shadow-inner">
                <Home size={30} className="stroke-[2.2]" />
                <span className="absolute -bottom-1 -right-1 p-1 bg-white rounded-lg shadow-sm border border-amber-200 text-orange-600">
                  <Users size={14} className="stroke-[2.5]" />
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="inline-block px-3 py-1 bg-amber-100/80 text-amber-900 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200/80">
                  Polisi Pendaftaran Warga SMAUJ
                </span>
                <h4 className="font-black text-base sm:text-lg text-slate-900 tracking-tight leading-snug">
                  1 Rumah, 1 Pendaftaran Sahaja
                </h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Pendaftaran rasmi warga adalah berasaskan unit kediaman bagi mengelakkan pertindihan rekod alamat.
                </p>
              </div>

              {/* Informative Content Cards */}
              <div className="space-y-2.5 text-left">
                {/* Point 1: 1 Rumah 1 Pendaftaran */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-1.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                    <Home size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-extrabold text-xs text-amber-950">
                      Satu (1) Pendaftaran Bagi Setiap Kediaman
                    </h5>
                    <p className="text-[11px] text-amber-900/90 leading-relaxed font-medium">
                      Hanya <strong>seorang wakil</strong> sahaja dari setiap unit rumah (pemilik atau penyewa) perlu mengisi borang pendaftaran warga rasmi ini.
                    </p>
                  </div>
                </div>

                {/* Point 2: Warga Automatik Isi Rumah */}
                <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 mt-0.5">
                    <Users size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-extrabold text-xs text-emerald-950">
                      Pendaftaran Warga Automatik Untuk Seluruh Isi Rumah
                    </h5>
                    <p className="text-[11px] text-emerald-900/90 leading-relaxed font-medium">
                      Semua nama yang didaftarkan di dalam <strong>Senarai Isi Rumah & Tanggungan</strong> secara <strong>automatik diiktiraf sebagai Warga Sah Sekolah</strong> serta layak menerima kemudahan dan kebajikan bersama.
                    </p>
                  </div>
                </div>
              </div>

              {/* Reassuring Note */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-left">
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Ahli keluarga atau penghuni rumah yang lain <strong>tidak perlu mendaftar borang berasingan</strong>. Sila pastikan nama mereka disenaraikan di bawah ruangan isi rumah.
                  </span>
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-center">
              <button 
                onClick={() => setShowWarningModal(false)} 
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-200/60 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Saya Faham & Teruskan Pendaftaran</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const handleCopyMemberNo = () => {
    if (navigator?.clipboard && displayMemberNo) {
      navigator.clipboard.writeText(displayMemberNo);
      setCopiedMemberNo(true);
      setTimeout(() => setCopiedMemberNo(false), 2000);
    }
  };

  const approvedMemberView = (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Penyata Pengesahan Pendaftaran Warga Sekolah */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white shadow-xl shadow-emerald-900/20 border border-emerald-400/30 p-5 sm:p-6">
        {/* Decorative background watermark */}
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
          <ShieldCheck size={200} className="text-white transform -rotate-12" />
        </div>
        
        <div className="relative z-10 space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/15 pb-3.5">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200">
                Penyata Pengesahan Pendaftaran Warga
              </span>
              <h3 className="font-black text-sm sm:text-base tracking-tight leading-tight mt-0.5">
                Sekolah Menengah Agama Ulu Jempol (SMAUJ)
              </h3>
              <p className="text-[9px] text-emerald-200/90 font-mono mt-0.5">KOD: NFT0001 | BATU KIKIR, NEGERI SEMBILAN</p>
            </div>
            <div className="shrink-0 bg-emerald-500/30 border border-emerald-300/40 rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-xs">
              <CheckCircle2 size={13} className="text-emerald-200 fill-emerald-500/50" />
              <span className="text-[10px] font-black uppercase tracking-wider text-white">WARGA AKTIF</span>
            </div>
          </div>

          {/* Member No Display */}
          <div className="bg-black/25 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/10 flex items-center justify-between gap-3">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-200 block">
                Nombor ID Warga Rasmi
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-widest">
                {displayMemberNo}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyMemberNo}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
              title="Salin Nombor ID Warga"
            >
              {copiedMemberNo ? (
                <>
                  <Check size={12} className="text-emerald-300" />
                  <span>Disalin</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>

          {/* Core Member Details Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[9px] font-bold text-emerald-200/80 uppercase tracking-wider block">Nama Warga</span>
              <span className="font-extrabold text-xs sm:text-sm text-white block truncate uppercase">{displayName}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-emerald-200/80 uppercase tracking-wider block">Jawatan / Peranan</span>
              <span className="font-extrabold text-xs sm:text-sm text-emerald-100 block truncate">{displayRole}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-emerald-200/80 uppercase tracking-wider block">No. Rumah</span>
              <span className="font-black text-xs sm:text-sm text-white block">No. {displayNoRumah}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-emerald-200/80 uppercase tracking-wider block">No. Kad Pengenalan</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-emerald-100 block">{displayIc}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Status Notification Callout */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
          <ShieldCheck size={22} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-xs text-emerald-950 uppercase tracking-tight">Warga Sah & Aktif</h4>
            <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-800 text-[9px] font-extrabold rounded-md">STATUS: AKTIF</span>
          </div>
          <p className="text-[11px] text-emerald-800 font-semibold leading-relaxed">
            Tahniah! Anda adalah warga berdaftar Sekolah Menengah Agama Ulu Jempol (SMAUJ). Rekod pendaftaran anda telah disahkan rasmi dalam pangkalan data sekolah. Anda tidak perlu membuat permohonan baharu.
          </p>
        </div>
      </div>

      {/* 3. Detailed Registered Information Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="font-black text-xs text-slate-900 flex items-center gap-2 uppercase tracking-wider">
            <Award size={15} className="text-emerald-600" />
            Butiran Pendaftaran Warga
          </h4>
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
            No. ID Warga: {displayMemberNo}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Penuh</span>
            <span className="font-black text-slate-800 uppercase block">{displayName}</span>
          </div>

          <div className="space-y-1 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Panggilan</span>
            <span className="font-bold text-slate-800 block">{nickname || currentUserDoc?.nickname || matchedApp?.nickname || '-'}</span>
          </div>

          <div className="space-y-1 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Kad Pengenalan</span>
            <span className="font-mono font-black text-slate-800 block">{displayIc}</span>
          </div>

          <div className="space-y-1 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Telefon</span>
            <span className="font-mono font-bold text-slate-800 block">{displayPhone}</span>
          </div>

          <div className="space-y-1 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Emel Berdaftar</span>
            <span className="font-semibold text-slate-800 block truncate">{displayEmail}</span>
          </div>

          <div className="space-y-1 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Kediaman</span>
            <span className="font-extrabold text-slate-800 block">{displayStatusKediaman}</span>
          </div>

          <div className="space-y-1 p-3 bg-slate-50/80 rounded-xl border border-slate-100 sm:col-span-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alamat Kediaman</span>
            <span className="font-bold text-slate-800 block">{displayAddress}</span>
          </div>
        </div>

        {/* Tanggungan / Isi Rumah */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-indigo-600" />
              Senarai Isi Rumah & Tanggungan ({displayFamily.length} orang)
            </span>
          </div>

          {displayFamily.length === 0 ? (
            <div className="p-3 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400 italic border border-dashed border-slate-200">
              Tiada senarai tanggungan berdaftar.
            </div>
          ) : (
            <div className="space-y-2">
              {displayFamily.map((f: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-slate-800 block uppercase">{f.nama}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">{f.hubungan || 'Keluarga'}</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {f.umur} tahun
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Laman Utama</span>
          </button>
        )}
        <button
          type="button"
          onClick={startEditingForm}
          className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Edit3 size={15} />
          <span>Kemaskini Maklumat Ahli</span>
        </button>
      </div>
    </div>
  );

  const pendingMemberView = (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
          <Clock size={28} className="animate-pulse" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 text-[9px] font-black rounded-full uppercase tracking-wider">
            STATUS: MENUNGGU KELULUSAN
          </span>
          <h3 className="font-black text-base text-amber-950 uppercase tracking-tight">
            Permohonan Sedang Diproses
          </h3>
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            Permohonan pendaftaran warga anda bagi unit rumah <strong className="font-bold">No. {displayNoRumah}</strong> telah berjaya diterima dan sedang menunggu semakan serta pengesahan pihak Pentadbir Sekolah.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-xs">
        <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5">
          Ringkasan Permohonan Dihantar
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Pemohon</span>
            <span className="font-black text-slate-800 block uppercase">{displayName}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Rumah</span>
            <span className="font-black text-slate-800 block">No. {displayNoRumah}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Kad Pengenalan</span>
            <span className="font-mono font-bold text-slate-800 block">{displayIc}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Telefon</span>
            <span className="font-mono font-bold text-slate-800 block">{displayPhone}</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 font-semibold italic text-center pt-2">
          Anda akan dimaklumkan secara automatik melalui notifikasi setelah permohonan disahkan.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Laman Utama</span>
          </button>
        )}
        <button
          type="button"
          onClick={startEditingForm}
          className="flex-1 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          title="Kemaskini maklumat permohonan yang telah dihantar"
        >
          <Edit3 size={15} />
          <span>Kemaskini Borang Permohonan</span>
        </button>
      </div>
    </div>
  );

  const kuiriMemberView = (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Official Digital Membership Card with NOTIS KUIRI */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600 via-orange-700 to-amber-900 text-white shadow-xl shadow-amber-900/20 border-2 border-amber-300/60 p-5 sm:p-6">
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
          <ShieldAlert size={200} className="text-white transform -rotate-12" />
        </div>
        
        <div className="relative z-10 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-white/20 pb-3.5">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-200">
                Kad Permohonan Warga Sekolah
              </span>
              <h3 className="font-black text-sm sm:text-base tracking-tight leading-tight mt-0.5">
                Sekolah Menengah Agama Ulu Jempol (SMAUJ)
              </h3>
              <p className="text-[9px] text-amber-200/90 font-mono mt-0.5">KOD: NFT0001 | BATU KIKIR, NEGERI SEMBILAN</p>
            </div>
            <div className="shrink-0 bg-amber-400/30 border border-amber-300 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-xs animate-pulse">
              <AlertTriangle size={13} className="text-amber-200 fill-amber-400/50" />
              <span className="text-[10px] font-black uppercase tracking-wider text-white">STATUS: KUIRI</span>
            </div>
          </div>

          {/* Pendaftaran Warga Box */}
          <div className="bg-black/25 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200 block">
                Status Kelulusan Pendaftaran Warga
              </span>
              <span className="font-mono text-base sm:text-lg font-black text-amber-100 tracking-wide block">
                PERLU KEMASKINI (KUIRI)
              </span>
            </div>
            {displayMemberNo && displayMemberNo !== 'SMAUJ-2026-SAH' ? (
              <div className="sm:text-right">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200 block">
                  No. ID Warga (Ditangguhkan)
                </span>
                <span className="font-mono text-xs font-black text-white bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-400/50 inline-block mt-0.5">
                  {displayMemberNo}
                </span>
              </div>
            ) : (
              <span className="px-3 py-1 bg-amber-500/40 text-amber-100 text-[10px] font-extrabold rounded-xl border border-amber-300/40">
                Unit: No. {displayNoRumah}
              </span>
            )}
          </div>

          {/* Core Member Details Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-wider block">Nama Pemohon</span>
              <span className="font-extrabold text-xs sm:text-sm text-white block truncate uppercase">{displayName}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-wider block">Jawatan / Status</span>
              <span className="font-extrabold text-xs sm:text-sm text-amber-100 block truncate">Pemohon (Kuiri)</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-wider block">No. Rumah</span>
              <span className="font-black text-xs sm:text-sm text-white block">No. {displayNoRumah}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-wider block">No. Kad Pengenalan</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-amber-100 block">{displayIc}</span>
            </div>
          </div>

          {/* Kuiri Alert Notice Bar */}
          <div className="mt-2 pt-3 border-t border-white/20 bg-amber-950/40 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-3xl flex items-start gap-2.5 text-xs text-amber-100">
            <AlertCircle size={16} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <strong className="text-white block font-black">NOTIS KUIRI PENDAFTARAN WARGA:</strong>
              Pendaftaran warga anda ditangguhkan sementara kerana terdapat butiran pendaftaran yang masih gagal/belum lengkap. Sila klik butang di bawah untuk kemaskini permohonan.
            </div>
          </div>
        </div>
      </div>

      {/* 2. Alert Action Box */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle size={28} className="animate-pulse" />
        </div>
        <div className="space-y-2 max-w-lg mx-auto">
          <span className="px-3 py-1 bg-amber-200 text-amber-950 text-[10px] font-black rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 border border-amber-300">
            <AlertCircle size={13} className="text-amber-700" />
            STATUS: KUIRI PERMOHONAN (MEMERLUKAN KEMASKINI)
          </span>
          <h3 className="font-black text-base sm:text-lg text-amber-950 uppercase tracking-tight">
            Permohonan Anda Perlu Dikemaskini
          </h3>
          <p className="text-xs text-amber-900 font-medium leading-relaxed">
            Pihak Pentadbir telah menyemak permohonan pendaftaran warga bagi unit rumah <strong className="font-bold">No. {displayNoRumah}</strong> dan mendapati terdapat maklumat yang masih belum lengkap/gagal. Sila kemaskini butiran yang dinyatakan di bawah dan hantar semula permohonan.
          </p>
        </div>

        {/* Kuiri items & remarks card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200 text-left space-y-3 shadow-xs">
          <h5 className="font-black text-xs text-amber-950 uppercase tracking-wider flex items-center gap-2 border-b border-amber-100 pb-2">
            <HelpCircle size={15} className="text-amber-600" />
            Item Pendaftaran Yang Memerlukan Pembetulan:
          </h5>

          {kuiriItems && kuiriItems.length > 0 ? (
            <div className="space-y-2">
              {kuiriItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 bg-amber-50/60 p-2.5 rounded-xl border border-amber-150">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="font-bold leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-slate-800 bg-amber-50/60 p-2.5 rounded-xl border border-amber-150">
              <span className="font-bold leading-relaxed">Sila semak semula maklumat peribadi (Nama Penuh), nombor rumah, atau maklumat isi rumah anda.</span>
            </div>
          )}

          {kuiriRemarks && (
            <div className="pt-2 border-t border-dashed border-amber-150 text-xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Catatan / Ulasan Pentadbir:</span>
              <p className="text-slate-800 font-semibold italic mt-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                "{kuiriRemarks}"
              </p>
            </div>
          )}
        </div>

        {/* Button to start editing */}
        <button
          type="button"
          onClick={startEditingForm}
          className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-200 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Edit3 size={16} />
          <span>Kemaskini Maklumat Borang Sekarang</span>
        </button>
      </div>

      {/* Summary of submitted data */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-xs">
        <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2.5">
          Ringkasan Permohonan Semasa
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Pemohon</span>
            <span className="font-black text-slate-800 block uppercase">{displayName}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Rumah</span>
            <span className="font-black text-slate-800 block">No. {displayNoRumah}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Kad Pengenalan</span>
            <span className="font-mono font-bold text-slate-800 block">{displayIc}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. Telefon</span>
            <span className="font-mono font-bold text-slate-800 block">{displayPhone}</span>
          </div>
        </div>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Laman Utama</span>
        </button>
      )}
    </div>
  );

  const isAdminUtama = currentUserDoc?.role === 'Admin Utama' || currentUserDoc?.role === 'ADMIN UTAMA' || currentUserDoc?.isSuperAdmin === true || currentUserDoc?.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my';

  if (loading || (firebaseUser && !currentUserDoc && !firebaseUser.isAnonymous)) {
    const loadingContent = (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 my-8">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-sm text-slate-800">Menyemak Status Warga</h4>
          <p className="text-xs text-slate-500 font-medium">Sila tunggu sebentar sementara sistem memuatkan maklumat pendaftaran...</p>
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-slate-50 flex flex-col justify-center min-h-[70vh]">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
            {loadingContent}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-8 max-w-2xl mx-auto flex flex-col justify-center min-h-[350px]">
        {loadingContent}
      </div>
    );
  }

  if (!isRegistrationEnabled && !isAdminUtama && !isApprovedMember) {
    const closedContent = (
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <Lock size={32} />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="font-extrabold text-base text-slate-900 uppercase tracking-tight">
            PENDAFTARAN WARGA DITUTUP
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Pendaftaran warga baharu dinyahaktifkan sementara waktu oleh Admin Utama. Sila semak semula kelak atau hubungi pihak Pentadbir Sekolah untuk maklumat lanjut.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-100"
          >
            Kembali ke Dashboard
          </button>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-slate-50 flex flex-col justify-center min-h-[70vh]">
          <div className="bg-white rounded-2xl border border-rose-100 p-6 shadow-xs">
            {closedContent}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-rose-100 shadow-xs p-8 max-w-2xl mx-auto flex flex-col justify-center min-h-[350px]">
        {closedContent}
      </div>
    );
  }

  if (!isGoogleSignedIn) {
    const signInContent = (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
          <LogIn size={28} className="stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h3 className="font-extrabold text-base text-slate-900 tracking-tight">Log Masuk Diperlukan</h3>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed font-medium">
            Sila log masuk menggunakan akaun Google anda terlebih dahulu sebelum dibenarkan untuk mengisi borang pendaftaran warga Sekolah Menengah Agama Ulu Jempol (SMAUJ).
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
          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] cursor-pointer"
        >
          <LogIn size={14} className="stroke-[2.5]" />
          <span>Log Masuk dengan Google</span>
        </button>
      </div>
    );

    if (isMobile) {
      return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-slate-50 flex flex-col justify-center min-h-[70vh]">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
            {signInContent}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-8 max-w-2xl mx-auto flex flex-col justify-center min-h-[400px]">
        {signInContent}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-slate-55">
        <div className="flex items-center gap-2 border-b border-slate-150 pb-2.5">
          {onBack && (
            <button 
              onClick={onBack} 
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
              {isApprovedMember 
                ? 'Pengesahan Pendaftaran' 
                : isKuiriMember 
                  ? 'Kemaskini Permohonan (Kuiri)' 
                  : isPendingMember 
                    ? 'Status Permohonan' 
                    : 'Pendaftaran Warga SMAUJ'}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Sekolah Menengah Agama Ulu Jempol</p>
          </div>
        </div>
        {isApprovedMember && !isEditing ? (
          approvedMemberView
        ) : isKuiriMember && !isEditing ? (
          kuiriMemberView
        ) : isPendingMember && !isEditing ? (
          pendingMemberView
        ) : (
          <form onSubmit={handleSave}>
            {formContent}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isApprovedMember ? 'bg-emerald-50 text-emerald-600' : 'bg-teal-50 text-teal-600'}`}>
          {isApprovedMember ? <ShieldCheck size={24} /> : <UserPlus size={24} />}
        </div>
        <div>
          <h3 className="font-extrabold text-lg text-gray-900">
            {isApprovedMember 
              ? 'Pengesahan Pendaftaran Warga SMAUJ' 
              : isKuiriMember
                ? 'Kemaskini Permohonan Pendaftaran (Kuiri)'
                : isPendingMember 
                  ? 'Status Permohonan Pendaftaran' 
                  : 'Pendaftaran Warga Sekolah & Ibu Bapa SMAUJ'}
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            {isApprovedMember 
              ? 'Maklumat pendaftaran rasmi anda dalam pengkalan data Sekolah Menengah Agama Ulu Jempol (SMAUJ), Batu Kikir, Negeri Sembilan.' 
              : isKuiriMember
                ? 'Permohonan anda memerlukan kemaskini maklumat mengikut semakan pihak pentadbir SMAUJ.'
                : 'Semak dan kemaskini maklumat pendaftaran Sekolah Menengah Agama Ulu Jempol, Batu Kikir, Negeri Sembilan.'}
          </p>
        </div>
      </div>
      {isApprovedMember && !isEditing ? (
        approvedMemberView
      ) : isKuiriMember && !isEditing ? (
        kuiriMemberView
      ) : isPendingMember && !isEditing ? (
        pendingMemberView
      ) : (
        <form onSubmit={handleSave}>
          {formContent}
        </form>
      )}
    </div>
  );
}
