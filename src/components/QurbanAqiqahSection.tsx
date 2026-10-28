import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
import { cleanUndefined } from '../utils/firestoreUtils';
import { QurbanRegistration } from '../types';
import { 
  QurbanConfig, DEFAULT_QURBAN_CONFIG, getAutoHijriQurbanSession, 
  printQurbanRegistrationPdf, checkAndCancelExpiredQurbanRegistrations,
  calculateQurbanFee 
} from '../utils/qurbanHelper';
import { uploadReceiptImage } from '../utils/uploadReceipt';
import { 
  Heart, ShieldCheck, Calendar, User, Phone, Mail, MapPin, 
  CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Plus, Trash2, 
  CreditCard, DollarSign, Clock, Download, Sparkles, Check, ChevronRight, 
  RefreshCw, FileText, Home, Printer, X, Upload, ShoppingCart, Lock
} from 'lucide-react';

interface QurbanAqiqahSectionProps {
  onBack?: () => void;
  onNavigateToCart?: () => void;
  onNavigateToYuran?: () => void;
  onAddToCart?: (item: any) => void;
  qurbanConfig?: QurbanConfig;
}

export default function QurbanAqiqahSection({
  onBack,
  onNavigateToCart,
  onNavigateToYuran,
  onAddToCart,
  qurbanConfig = DEFAULT_QURBAN_CONFIG
}: QurbanAqiqahSectionProps) {
  const { firebaseUser, currentUserDoc, logAction, loginWithGoogle } = useAuth();

  // Live Config & Existing Registrations for Quota Tracking
  const [liveConfig, setLiveConfig] = useState<QurbanConfig>(qurbanConfig || DEFAULT_QURBAN_CONFIG);
  const [existingRegs, setExistingRegs] = useState<QurbanRegistration[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('tmf2_qurban_registrations_cache');
        if (cached) {
          const parsed = JSON.parse(cached) as QurbanRegistration[];
          if (Array.isArray(parsed)) {
            return parsed.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN');
          }
        }
      } catch (e) {
        console.warn("Gagal membaca cache qurbanRegistrations:", e);
      }
    }
    return [];
  });

  const updateCachedRegistrations = (updater: (prev: QurbanRegistration[]) => QurbanRegistration[]) => {
    setExistingRegs(prev => {
      const next = updater(prev);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('tmf2_qurban_registrations_cache', JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  // Navigation View State: 'landing' | 'form' | 'denied' | 'need_login'
  const [viewMode, setViewMode] = useState<'landing' | 'form' | 'denied' | 'need_login'>('landing');
  const [showNoRegModal, setShowNoRegModal] = useState<boolean>(false);

  // Listen to live system/qurbanConfig & qurbanRegistrations from Firestore
  useEffect(() => {
    if (!db) return;
    const unsubConfig = onSnapshot(doc(db, 'system', 'qurbanConfig'), (docSnap) => {
      if (docSnap.exists()) {
        setLiveConfig(docSnap.data() as QurbanConfig);
      }
    }, (err) => console.warn("Ralat live qurbanConfig:", err));

    const unsubRegs = onSnapshot(collection(db, 'qurbanRegistrations'), (snap) => {
      const list: QurbanRegistration[] = [];
      snap.forEach(d => {
        const data = d.data() as QurbanRegistration;
        if (data.statusPendaftaran !== 'Batal' && data.statusPendaftaran !== 'DITAMATKAN') {
          list.push({ ...data, id: data.id || d.id });
        }
      });
      setExistingRegs(list);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('tmf2_qurban_registrations_cache', JSON.stringify(list));
        } catch (e) {}
      }

      // Auto check and cancel registrations > 24 hours unpaid
      checkAndCancelExpiredQurbanRegistrations(list);
    }, (err) => console.warn("Ralat live qurbanRegistrations:", err));

    return () => {
      unsubConfig();
      unsubRegs();
    };
  }, []);

  // Calculate current counts for each category
  const countBhgLembu = existingRegs
    .filter(r => r.pakejPilihan === '1 BHG LEMBU')
    .reduce((sum, r) => sum + (r.senaraiPeserta?.length || 1), 0);

  const countEkorLembu = existingRegs
    .filter(r => r.pakejPilihan === '1 EKOR LEMBU').length;

  const countEkorKambing = existingRegs
    .filter(r => r.pakejPilihan === '1 EKOR KAMBING').length;

  const limitBhgLembu = liveConfig.limitBhgLembu !== undefined ? liveConfig.limitBhgLembu : (qurbanConfig?.limitBhgLembu ?? 35);
  const limitEkorLembu = liveConfig.limitEkorLembu !== undefined ? liveConfig.limitEkorLembu : (qurbanConfig?.limitEkorLembu ?? 5);
  const limitEkorKambing = liveConfig.limitEkorKambing !== undefined ? liveConfig.limitEkorKambing : (qurbanConfig?.limitEkorKambing ?? 20);

  // Check if category registration is not opened (limit === 0)
  const isBhgLembuClosed = limitBhgLembu === 0;
  const isEkorLembuClosed = limitEkorLembu === 0;
  const isEkorKambingClosed = limitEkorKambing === 0;

  const remainingBhgLembu = isBhgLembuClosed ? 0 : Math.max(0, limitBhgLembu - countBhgLembu);
  const remainingEkorLembu = isEkorLembuClosed ? 0 : Math.max(0, limitEkorLembu - countEkorLembu);
  const remainingEkorKambing = isEkorKambingClosed ? 0 : Math.max(0, limitEkorKambing - countEkorKambing);

  const isBhgLembuFull = !isBhgLembuClosed && remainingBhgLembu <= 0;
  const isEkorLembuFull = !isEkorLembuClosed && remainingEkorLembu <= 0;
  const isEkorKambingFull = !isEkorKambingClosed && remainingEkorKambing <= 0;

  const isBhgLembuUnavailable = isBhgLembuClosed || isBhgLembuFull;
  const isEkorLembuUnavailable = isEkorLembuClosed || isEkorLembuFull;
  const isEkorKambingUnavailable = isEkorKambingClosed || isEkorKambingFull;

  const isAllClosed = isBhgLembuClosed && isEkorLembuClosed && isEkorKambingClosed;
  const isAllUnavailable = isBhgLembuUnavailable && isEkorLembuUnavailable && isEkorKambingUnavailable;

  // Auto-detect Hijri Session (Auto-updates after Aidiladha)
  const sessionInfo = getAutoHijriQurbanSession(liveConfig.sessionYearOverride || qurbanConfig.sessionYearOverride);

  // Form Step State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showClosedModal, setShowClosedModal] = useState<boolean>(false);

  // Step 1: Jenis & Pakej
  const [jenisPenyertaan, setJenisPenyertaan] = useState<'Qurban Sunat' | 'Qurban Wajib' | 'Aqiqah Sunat' | 'Aqiqah Wajib'>('Qurban Sunat');
  const [pakejPilihan, setPakejPilihan] = useState<'1 BHG LEMBU' | '1 EKOR LEMBU' | '1 EKOR KAMBING'>('1 BHG LEMBU');

  // Auto-switch package if the currently selected one is not open or full
  useEffect(() => {
    if (pakejPilihan === '1 BHG LEMBU' && isBhgLembuUnavailable) {
      if (!isEkorLembuUnavailable) setPakejPilihan('1 EKOR LEMBU');
      else if (!isEkorKambingUnavailable) setPakejPilihan('1 EKOR KAMBING');
    } else if (pakejPilihan === '1 EKOR LEMBU' && isEkorLembuUnavailable) {
      if (!isBhgLembuUnavailable) setPakejPilihan('1 BHG LEMBU');
      else if (!isEkorKambingUnavailable) setPakejPilihan('1 EKOR KAMBING');
    } else if (pakejPilihan === '1 EKOR KAMBING' && isEkorKambingUnavailable) {
      if (!isBhgLembuUnavailable) setPakejPilihan('1 BHG LEMBU');
      else if (!isEkorLembuUnavailable) setPakejPilihan('1 EKOR LEMBU');
    }
  }, [pakejPilihan, isBhgLembuUnavailable, isEkorLembuUnavailable, isEkorKambingUnavailable]);

  // Step 2: Maklumat Peribadi (auto-filled from membership profile)
  const [namaPenuh, setNamaPenuh] = useState<string>(currentUserDoc?.displayName || currentUserDoc?.name || '');
  const [noIC, setNoIC] = useState<string>(currentUserDoc?.icNumber || '');
  const [noTelefon, setNoTelefon] = useState<string>(currentUserDoc?.phoneNumber || currentUserDoc?.phone || (currentUserDoc as any)?.noTelefon || '');
  const [emel, setEmel] = useState<string>(currentUserDoc?.email || '');
  const [alamat, setAlamat] = useState<string>(
    currentUserDoc?.noRumah ? `${currentUserDoc.noRumah}, ${currentUserDoc.address || ''}` : (currentUserDoc?.address || '')
  );

  // Sync user details if currentUserDoc is loaded/updated
  useEffect(() => {
    if (currentUserDoc) {
      if (!namaPenuh) setNamaPenuh(currentUserDoc.displayName || currentUserDoc.name || '');
      if (!noIC && currentUserDoc.icNumber) setNoIC(currentUserDoc.icNumber);
      const memberPhone = currentUserDoc.phoneNumber || currentUserDoc.phone || (currentUserDoc as any)?.noTelefon || '';
      if (!noTelefon && memberPhone) setNoTelefon(memberPhone);
      if (!emel && currentUserDoc.email) setEmel(currentUserDoc.email);
      if (!alamat) setAlamat(currentUserDoc.noRumah ? `${currentUserDoc.noRumah}, ${currentUserDoc.address || ''}` : (currentUserDoc.address || ''));
    }
  }, [currentUserDoc]);

  // Step 3: Nama Peserta
  const [senaraiPeserta, setSenaraiPeserta] = useState<string[]>(['']);

  // Adjust participant inputs whenever package changes
  useEffect(() => {
    if (pakejPilihan === '1 BHG LEMBU' || pakejPilihan === '1 EKOR KAMBING') {
      if (senaraiPeserta.length !== 1) {
        setSenaraiPeserta([namaPenuh || '']);
      }
    } else if (pakejPilihan === '1 EKOR LEMBU') {
      if (senaraiPeserta.length !== 7) {
        setSenaraiPeserta([namaPenuh || '', '', '', '', '', '', '']);
      }
    }
  }, [pakejPilihan]);

  // Keep first participant name synced with registrant name if initially empty
  useEffect(() => {
    if (namaPenuh && (!senaraiPeserta[0] || senaraiPeserta[0] === '')) {
      setSenaraiPeserta(prev => {
        const next = [...prev];
        next[0] = namaPenuh;
        return next;
      });
    }
  }, [namaPenuh]);

  // Step 4: Daging & Pembayaran
  const [pilihanDaging, setPilihanDaging] = useState<'Mahu Ambil Daging' | 'Tidak Mahu Daging' | 'Simpan Daging'>('Mahu Ambil Daging');
  const [opsiBayaran, setOpsiBayaran] = useState<'Penuh' | 'Ansuran'>('Penuh');
  const [tempohAnsuranBulan, setTempohAnsuranBulan] = useState<number>(3);
  const [caraPembayaran, setCaraPembayaran] = useState<'Online Transfer' | 'Manual Transfer' | 'Tunai'>('Online Transfer');

  // FPX State
  const FPX_BANKS = [
    { name: 'Maybank2u', logo: '🟡' },
    { name: 'CIMB Clicks', logo: '🔴' },
    { name: 'Bank Islam', logo: '🟢' },
    { name: 'Public Bank', logo: '🔴' },
    { name: 'RHB Now', logo: '🔵' },
    { name: 'AmOnline', logo: '🟡' },
  ];
  const [selectedBank, setSelectedBank] = useState<string>('Maybank2u');
  const [fpxUsername, setFpxUsername] = useState<string>('firdaus_tmf2');
  const [fpxPassword, setFpxPassword] = useState<string>('********');
  const [fpxPaymentStep, setFpxPaymentStep] = useState<'form' | 'authenticating' | 'processing' | 'success'>('form');
  const [showFpxModal, setShowFpxModal] = useState<boolean>(false);
  const [activePayingReg, setActivePayingReg] = useState<QurbanRegistration | null>(null);

  // Manual Transfer Receipt state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string>('');

  // Cash Confirmation Modal state
  const [showCashConfirmModal, setShowCashConfirmModal] = useState<boolean>(false);

  // Cancel Existing Registration state
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);
  const [isCancellingReg, setIsCancellingReg] = useState<boolean>(false);

  // Submission / Loading states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRegistration, setSubmittedRegistration] = useState<QurbanRegistration | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Price calculations
  const getPakejPrice = () => {
    if (pakejPilihan === '1 BHG LEMBU') return liveConfig.bhgLembuPrice || 900;
    if (pakejPilihan === '1 EKOR LEMBU') return liveConfig.ekorLembuPrice || 6300;
    return liveConfig.ekorKambingPrice || 1200;
  };

  const pakejPrice = getPakejPrice();
  const feeDetails = calculateQurbanFee(pakejPrice, liveConfig);
  const mgmtFee = feeDetails.feeAmount;
  const mgmtPercent = feeDetails.feePercent;
  const grandTotal = feeDetails.totalAmount;

  // Installment calculations
  const monthlyInstallment = Math.ceil(grandTotal / tempohAnsuranBulan);
  const depositAmount = monthlyInstallment; // 1st month installment is deposit
  const payableAmount = opsiBayaran === 'Ansuran' ? depositAmount : grandTotal;

  // Access Controls & Gates
  const isLoggedIn = (!!firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local') || (!!currentUserDoc && !!currentUserDoc.uid && currentUserDoc.uid !== 'guest_local');
  const isApprovedMember = currentUserDoc?.approvalStatus === 'Approved' || currentUserDoc?.membershipStatus === 'Aktif';
  const existingUserReg = existingRegs.find(r => {
    if (r.statusPendaftaran === 'Batal' || r.statusPendaftaran === 'DITAMATKAN') return false;
    const fUid = firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local' ? firebaseUser.uid : '';
    const cUid = currentUserDoc?.uid && currentUserDoc.uid !== 'guest_local' ? currentUserDoc.uid : '';
    if (fUid && r.userUid === fUid) return true;
    if (cUid && r.userUid === cUid) return true;
    const userEmailNorm = (firebaseUser?.email || currentUserDoc?.email || '').toLowerCase().trim();
    const regEmailNorm = (r.userEmail || r.emel || '').toLowerCase().trim();
    if (userEmailNorm && regEmailNorm && userEmailNorm === regEmailNorm) return true;
    const userIcNorm = (currentUserDoc?.icNumber || '').replace(/[^0-9]/g, '');
    const regIcNorm = (r.noIC || '').replace(/[^0-9]/g, '');
    if (userIcNorm && regIcNorm && userIcNorm.length >= 6 && userIcNorm === regIcNorm) return true;
    return false;
  });

  // Action Handler: Click "Borang" or "Daftar Sekarang"
  const handleCheckAccessForRegistration = () => {
    if (isAllClosed || isAllUnavailable) {
      setShowClosedModal(true);
      return;
    }
    if (!isLoggedIn) {
      setViewMode('need_login');
      return;
    }
    if (!isApprovedMember) {
      setViewMode('denied');
      return;
    }
    setViewMode('form');
  };

  // Action Handler: Click "Semak Status"
  const handleCheckStatus = () => {
    if (!isLoggedIn) {
      setViewMode('need_login');
      return;
    }

    if (existingUserReg) {
      setSubmittedRegistration(null);
      setViewMode('form');
    } else {
      setShowNoRegModal(true);
    }
  };

  const handleAddParticipant = () => {
    setSenaraiPeserta(prev => [...prev, '']);
  };

  const handleRemoveParticipant = (idx: number) => {
    if (senaraiPeserta.length <= 1) return;
    setSenaraiPeserta(prev => prev.filter((_, i) => i !== idx));
  };

  const handleParticipantChange = (idx: number, val: string) => {
    setSenaraiPeserta(prev => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const validateStep = (step: number) => {
    setErrorMessage(null);
    if (step === 1) {
      if (pakejPilihan === '1 BHG LEMBU') {
        if (isBhgLembuClosed) {
          setErrorMessage('Pakej 1 Bahagian Lembu tidak dibuka untuk pendaftaran.');
          return false;
        }
        if (isBhgLembuFull) {
          setErrorMessage('Kuota bagi 1 Bhg Lembu telah penuh. Sila pilih pakej yang masih mempunyai baki kuota.');
          return false;
        }
      }
      if (pakejPilihan === '1 EKOR LEMBU') {
        if (isEkorLembuClosed) {
          setErrorMessage('Pakej 1 Ekor Lembu tidak dibuka untuk pendaftaran.');
          return false;
        }
        if (isEkorLembuFull) {
          setErrorMessage('Kuota bagi 1 Ekor Lembu telah penuh. Sila pilih pakej yang masih mempunyai baki kuota.');
          return false;
        }
      }
      if (pakejPilihan === '1 EKOR KAMBING') {
        if (isEkorKambingClosed) {
          setErrorMessage('Pakej 1 Ekor Kambing tidak dibuka untuk pendaftaran.');
          return false;
        }
        if (isEkorKambingFull) {
          setErrorMessage('Kuota bagi 1 Ekor Kambing telah penuh. Sila pilih pakej yang masih mempunyai baki kuota.');
          return false;
        }
      }
    }
    if (step === 2) {
      if (!namaPenuh.trim()) { setErrorMessage('Sila masukkan nama penuh anda.'); return false; }
      if (!noIC.trim()) { setErrorMessage('Sila masukkan No. Kad Pengenalan.'); return false; }
      if (!noTelefon.trim()) { setErrorMessage('Sila masukkan No. Telefon.'); return false; }
      if (!alamat.trim()) { setErrorMessage('Sila masukkan alamat lengkap.'); return false; }
    }
    if (step === 3) {
      const validNames = senaraiPeserta.filter(n => n.trim().length > 0);
      if (validNames.length === 0) {
        setErrorMessage('Sila masukkan sekurang-kurangnya satu nama peserta.');
        return false;
      }
    }
    if (step === 4) {
      if (caraPembayaran === 'Manual Transfer' && !receiptFile) {
        setErrorMessage('Sila pilih dan muat naik resit bukti pembayaran pindahan bank terlebih dahulu.');
        return false;
      }
    }
    return true;
  };

  const handleNextStep = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (validateStep(currentStep)) {
      setErrorMessage(null);
      setCurrentStep(prev => Math.min(4, prev + 1));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 120, behavior: 'smooth' });
      }
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  // Helper: re-verify package quota before saving/paying
  const checkLiveQuotaAvailable = (): boolean => {
    if (pakejPilihan === '1 BHG LEMBU') {
      if (isBhgLembuClosed) {
        setErrorMessage('Pakej 1 Bahagian Lembu tidak dibuka untuk pendaftaran.');
        setCurrentStep(1);
        return false;
      }
      if (remainingBhgLembu <= 0) {
        setErrorMessage('Maaf, kuota bagi 1 Bahagian Lembu telah penuh. Sila pilih pakej lain yang masih mempunyai baki.');
        setCurrentStep(1);
        return false;
      }
    }
    if (pakejPilihan === '1 EKOR LEMBU') {
      if (isEkorLembuClosed) {
        setErrorMessage('Pakej 1 Ekor Lembu tidak dibuka untuk pendaftaran.');
        setCurrentStep(1);
        return false;
      }
      if (remainingEkorLembu <= 0) {
        setErrorMessage('Maaf, kuota bagi 1 Ekor Lembu telah penuh. Sila pilih pakej lain yang masih mempunyai baki.');
        setCurrentStep(1);
        return false;
      }
    }
    if (pakejPilihan === '1 EKOR KAMBING') {
      if (isEkorKambingClosed) {
        setErrorMessage('Pakej 1 Ekor Kambing tidak dibuka untuk pendaftaran.');
        setCurrentStep(1);
        return false;
      }
      if (remainingEkorKambing <= 0) {
        setErrorMessage('Maaf, kuota bagi 1 Ekor Kambing telah penuh. Sila pilih pakej lain yang masih mempunyai baki.');
        setCurrentStep(1);
        return false;
      }
    }
    return true;
  };

  // FPX Payment Handler (Direct Online Payment)
  const handleStartFpxPayment = (existingReg?: QurbanRegistration) => {
    if (existingReg) {
      setActivePayingReg(existingReg);
      setShowFpxModal(true);
      return;
    }
    if (!validateStep(4)) return;
    if (!checkLiveQuotaAvailable()) return;
    if (!firebaseUser) {
      setViewMode('need_login');
      return;
    }
    setActivePayingReg(null);
    setShowFpxModal(true);
  };

  const executeFpxPayment = async () => {
    setFpxPaymentStep('authenticating');

    setTimeout(() => {
      setFpxPaymentStep('processing');
      setTimeout(async () => {
        try {
          const regId = activePayingReg?.id || `qurb-${Date.now()}`;
          const nowIso = new Date().toISOString();
          const targetPayable = activePayingReg
            ? (activePayingReg.opsiBayaran === 'Ansuran' ? activePayingReg.depositAmount : activePayingReg.totalAmount)
            : payableAmount;

          let updatedInstallments = activePayingReg?.installmentPayments;
          if (!activePayingReg && opsiBayaran === 'Ansuran') {
            updatedInstallments = Array.from({ length: tempohAnsuranBulan }).map((_, i) => ({
              monthIndex: i + 1,
              monthName: i === 0 ? `Bulan 1 (Deposit)` : `Bulan ${i + 1}`,
              amount: monthlyInstallment,
              status: i === 0 ? ('Lulus' as const) : ('Belum Bayar' as const),
              paidAt: i === 0 ? nowIso : undefined,
              paymentMethod: 'FPX' as const
            }));
          } else if (activePayingReg?.installmentPayments) {
            updatedInstallments = activePayingReg.installmentPayments.map((inst, idx) => {
              if (idx === 0 && inst.status !== 'Lulus') {
                return { ...inst, status: 'Lulus' as const, paidAt: nowIso, paymentMethod: 'FPX' as const };
              }
              return inst;
            });
          }

          const targetPakej = activePayingReg?.pakejPilihan || pakejPilihan;
          const targetJenis = activePayingReg?.jenisPenyertaan || jenisPenyertaan;
          const isAnsuran = (activePayingReg?.opsiBayaran || opsiBayaran) === 'Ansuran';

          const regData: QurbanRegistration = activePayingReg ? {
            ...activePayingReg,
            paymentStatus: isAnsuran ? 'Deposit Dibayar' : 'Selesai',
            statusPendaftaran: 'Disahkan',
            monthsPaid: Math.max(1, activePayingReg.monthsPaid || 1),
            installmentPayments: updatedInstallments,
            updatedAt: nowIso
          } : {
            id: regId,
            userUid: firebaseUser?.uid || '',
            userEmail: firebaseUser?.email || emel || '',
            userName: namaPenuh,
            sessionYear: sessionInfo.fullLabel,
            jenisPenyertaan,
            pakejPilihan,
            pakejPrice,
            managementFeeType: feeDetails.feeType,
            managementFeePercent: feeDetails.feePercent,
            managementFeeFixed: feeDetails.feeType === 'fixed' ? feeDetails.feeAmount : undefined,
            managementFeeAmount: mgmtFee,
            totalAmount: grandTotal,
            namaPenuh,
            noIC,
            noTelefon,
            emel,
            alamat,
            senaraiPeserta: senaraiPeserta.filter(n => n.trim() !== ''),
            pilihanDaging,
            opsiBayaran,
            caraPembayaran: 'Online Transfer',
            tempohAnsuranBulan: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : undefined,
            statusPendaftaran: 'Disahkan',
            paymentStatus: opsiBayaran === 'Ansuran' ? 'Deposit Dibayar' : 'Selesai',
            depositAmount: opsiBayaran === 'Ansuran' ? depositAmount : grandTotal,
            monthlyAmount: opsiBayaran === 'Ansuran' ? monthlyInstallment : undefined,
            totalMonths: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : 1,
            monthsPaid: 1,
            installmentPayments: updatedInstallments,
            createdAt: nowIso,
            updatedAt: nowIso
          };

          if (db) {
            await setDoc(doc(db, 'qurbanRegistrations', regId), cleanUndefined(regData), { merge: true });

            // Record official transaction log in Firestore
            const txnId = `TXN-QURBAN-FPX-${regId.substring(0, 8)}-${Date.now().toString().slice(-4)}`;
            const vchNo = `VCH-QURBAN-${Date.now().toString().slice(-6)}`;
            const todayDateStr = nowIso.split('T')[0];
            const timeStr = new Date().toTimeString().slice(0, 5);
            await setDoc(doc(db, 'kewanganTransactions', txnId), cleanUndefined({
              id: txnId,
              voucherNo: vchNo,
              date: todayDateStr,
              time: timeStr,
              accountDebit: 'Bank',
              accountCredit: 'Qurban Aqiqah',
              amount: targetPayable,
              description: `Bayaran FPX (${selectedBank}) - ${targetJenis} (${targetPakej}) oleh ${namaPenuh || activePayingReg?.namaPenuh || 'Ahli Persatuan'}`,
              category: 'Qurban Aqiqah',
              recordedBy: `${namaPenuh || activePayingReg?.namaPenuh || 'Ahli Persatuan'} (FPX)`,
              approvalStatus: 'Approved',
              approvedDate: todayDateStr,
              approvedBy: 'Sistem FPX Automatik',
              notes: `Bayaran FPX Qurban & Aqiqah (Ref: ${regId})`,
              memberEmail: regData.userEmail || '',
              paidPackageIds: [`qurban-cart-${regId}-m1`],
              sessionYear: '2026',
              qurbanSession: regData.sessionYear,
              auditTrail: [{
                time: `${todayDateStr} ${timeStr}`,
                user: namaPenuh || activePayingReg?.namaPenuh || 'Ahli Persatuan',
                action: `Bayaran FPX (${selectedBank}) disahkan secara automatik.`
              }]
            })).catch(e => console.warn("Ralat simpan kewanganTransactions FPX:", e));
          }

          updateCachedRegistrations(prev => [regData, ...prev.filter(r => r.id !== regData.id)]);

          if (logAction) {
            await logAction('Bayaran FPX Qurban', `Pembayaran FPX sebanyak RM ${targetPayable.toFixed(2)} melalui ${selectedBank} bagi ${targetJenis} (${targetPakej})`);
          }

          setFpxPaymentStep('success');
          setTimeout(() => {
            setShowFpxModal(false);
            setFpxPaymentStep('form');
            setSubmittedRegistration(regData);
            setActivePayingReg(null);
          }, 1000);

        } catch (err: any) {
          console.error("Ralat memproses bayaran FPX:", err);
          setErrorMessage(err.message || "Ralat semasa memproses pembayaran FPX.");
          setFpxPaymentStep('form');
        }
      }, 1600);
    }, 1200);
  };

  // Manual Transfer (Upload Receipt) Handler
  const handleManualTransferSubmit = async () => {
    if (!receiptFile) {
      setReceiptUploadError('Sila pilih dan muat naik resit bukti pembayaran pindahan bank.');
      return;
    }
    if (!validateStep(4)) return;
    if (!checkLiveQuotaAvailable()) return;
    if (!firebaseUser) {
      setViewMode('need_login');
      return;
    }

    setIsUploadingReceipt(true);
    setReceiptUploadError('');
    setErrorMessage(null);

    try {
      const downloadUrl = await uploadReceiptImage(receiptFile);
      const regId = `qurb-${Date.now()}`;
      const nowIso = new Date().toISOString();

      let installmentsList = undefined;
      if (opsiBayaran === 'Ansuran') {
        installmentsList = Array.from({ length: tempohAnsuranBulan }).map((_, i) => ({
          monthIndex: i + 1,
          monthName: i === 0 ? `Bulan 1 (Deposit)` : `Bulan ${i + 1}`,
          amount: monthlyInstallment,
          status: i === 0 ? ('Dalam Semakan' as const) : ('Belum Bayar' as const),
          paymentMethod: 'Manual' as const
        }));
      }

      const newRegistration: QurbanRegistration = {
        id: regId,
        userUid: firebaseUser.uid,
        userEmail: firebaseUser.email || emel || '',
        userName: namaPenuh,
        sessionYear: sessionInfo.fullLabel,
        jenisPenyertaan,
        pakejPilihan,
        pakejPrice,
        managementFeeType: feeDetails.feeType,
        managementFeePercent: feeDetails.feePercent,
        managementFeeFixed: feeDetails.feeType === 'fixed' ? feeDetails.feeAmount : undefined,
        managementFeeAmount: mgmtFee,
        totalAmount: grandTotal,
        namaPenuh,
        noIC,
        noTelefon,
        emel,
        alamat,
        senaraiPeserta: senaraiPeserta.filter(n => n.trim() !== ''),
        pilihanDaging,
        opsiBayaran,
        caraPembayaran: 'Manual Transfer',
        resitUrl: downloadUrl,
        tempohAnsuranBulan: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : undefined,
        statusPendaftaran: 'Dalam Proses',
        paymentStatus: 'Dalam Semakan',
        depositAmount: opsiBayaran === 'Ansuran' ? depositAmount : grandTotal,
        monthlyAmount: opsiBayaran === 'Ansuran' ? monthlyInstallment : undefined,
        totalMonths: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : 1,
        monthsPaid: 0,
        installmentPayments: installmentsList,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      if (db) {
        await setDoc(doc(db, 'qurbanRegistrations', regId), cleanUndefined(newRegistration));
      }

      updateCachedRegistrations(prev => [newRegistration, ...prev.filter(r => r.id !== newRegistration.id)]);

      if (logAction) {
        await logAction('Pendaftaran Qurban & Resit', `Memuat naik resit bayaran manual ${jenisPenyertaan} (${pakejPilihan})`);
      }

      setSubmittedRegistration(newRegistration);
    } catch (err: any) {
      console.error("Ralat mendaftar bayaran manual:", err);
      setReceiptUploadError(err.message || "Gagal memuat naik resit. Sila cuba lagi.");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Cash Confirmation Handler
  const handleCashConfirmSubmit = async () => {
    if (!checkLiveQuotaAvailable()) return;
    if (!firebaseUser) {
      setViewMode('need_login');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const regId = `qurb-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const cashDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      let installmentsList = undefined;
      if (opsiBayaran === 'Ansuran') {
        installmentsList = Array.from({ length: tempohAnsuranBulan }).map((_, i) => ({
          monthIndex: i + 1,
          monthName: i === 0 ? `Bulan 1 (Deposit)` : `Bulan ${i + 1}`,
          amount: monthlyInstallment,
          status: 'Belum Bayar' as const,
          paymentMethod: 'Tunai' as const
        }));
      }

      const newRegistration: QurbanRegistration = {
        id: regId,
        userUid: firebaseUser.uid,
        userEmail: firebaseUser.email || emel || '',
        userName: namaPenuh,
        sessionYear: sessionInfo.fullLabel,
        jenisPenyertaan,
        pakejPilihan,
        pakejPrice,
        managementFeeType: feeDetails.feeType,
        managementFeePercent: feeDetails.feePercent,
        managementFeeFixed: feeDetails.feeType === 'fixed' ? feeDetails.feeAmount : undefined,
        managementFeeAmount: mgmtFee,
        totalAmount: grandTotal,
        namaPenuh,
        noIC,
        noTelefon,
        emel,
        alamat,
        senaraiPeserta: senaraiPeserta.filter(n => n.trim() !== ''),
        pilihanDaging,
        opsiBayaran,
        caraPembayaran: 'Tunai',
        tempohAnsuranBulan: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : undefined,
        statusPendaftaran: 'Dalam Proses',
        paymentStatus: 'Belum Bayar',
        cashDeadline,
        depositAmount: opsiBayaran === 'Ansuran' ? depositAmount : grandTotal,
        monthlyAmount: opsiBayaran === 'Ansuran' ? monthlyInstallment : undefined,
        totalMonths: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : 1,
        monthsPaid: 0,
        installmentPayments: installmentsList,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      if (db) {
        await setDoc(doc(db, 'qurbanRegistrations', regId), cleanUndefined(newRegistration));
      }

      updateCachedRegistrations(prev => [newRegistration, ...prev.filter(r => r.id !== newRegistration.id)]);

      if (logAction) {
        await logAction('Pendaftaran Qurban Tunai', `Mendaftar ${jenisPenyertaan} (${pakejPilihan}) bayaran Tunai (24 jam)`);
      }

      setShowCashConfirmModal(false);
      setSubmittedRegistration(newRegistration);
    } catch (err: any) {
      console.error("Ralat mendaftar qurban tunai:", err);
      setErrorMessage(err.message || "Ralat semasa menyimpan pendaftaran.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add to Cart & Checkout Handler
  const handleSaveAndAddToCart = async () => {
    if (!checkLiveQuotaAvailable()) return;
    if (!firebaseUser) {
      setViewMode('need_login');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const regId = `qurb-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const cashDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      let installmentsList = undefined;
      if (opsiBayaran === 'Ansuran') {
        installmentsList = Array.from({ length: tempohAnsuranBulan }).map((_, i) => ({
          monthIndex: i + 1,
          monthName: i === 0 ? `Bulan 1 (Deposit)` : `Bulan ${i + 1}`,
          amount: monthlyInstallment,
          status: 'Belum Bayar' as const,
          paymentMethod: 'FPX' as const
        }));
      }

      const newRegistration: QurbanRegistration = {
        id: regId,
        userUid: firebaseUser.uid,
        userEmail: firebaseUser.email || emel || '',
        userName: namaPenuh,
        sessionYear: sessionInfo.fullLabel,
        jenisPenyertaan,
        pakejPilihan,
        pakejPrice,
        managementFeeType: feeDetails.feeType,
        managementFeePercent: feeDetails.feePercent,
        managementFeeFixed: feeDetails.feeType === 'fixed' ? feeDetails.feeAmount : undefined,
        managementFeeAmount: mgmtFee,
        totalAmount: grandTotal,
        namaPenuh,
        noIC,
        noTelefon,
        emel,
        alamat,
        senaraiPeserta: senaraiPeserta.filter(n => n.trim() !== ''),
        pilihanDaging,
        opsiBayaran,
        caraPembayaran: 'Online Transfer',
        tempohAnsuranBulan: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : undefined,
        statusPendaftaran: 'Dalam Proses',
        paymentStatus: 'Belum Bayar',
        cashDeadline,
        depositAmount: opsiBayaran === 'Ansuran' ? depositAmount : grandTotal,
        monthlyAmount: opsiBayaran === 'Ansuran' ? monthlyInstallment : undefined,
        totalMonths: opsiBayaran === 'Ansuran' ? tempohAnsuranBulan : 1,
        monthsPaid: 0,
        installmentPayments: installmentsList,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      if (db) {
        await setDoc(doc(db, 'qurbanRegistrations', regId), cleanUndefined(newRegistration));
      }

      updateCachedRegistrations(prev => [newRegistration, ...prev.filter(r => r.id !== newRegistration.id)]);

      if (onAddToCart) {
        const itemAmount = opsiBayaran === 'Ansuran' ? depositAmount : grandTotal;
        const itemName = opsiBayaran === 'Ansuran'
          ? `Deposit Qurban & Aqiqah (${pakejPilihan}) - Bulan 1`
          : `Bayaran Penuh Qurban & Aqiqah (${pakejPilihan})`;

        onAddToCart({
          id: `qurban-cart-${regId}-m1`,
          name: itemName,
          subtitle: `${jenisPenyertaan} (${sessionInfo.fullLabel})`,
          price: itemAmount,
          priceLabel: `RM ${itemAmount.toFixed(2)}`,
          category: 'QurbanAqiqah',
          qurbanRegistrationId: regId,
          qurbanMonthIndex: 1
        });
      }

      if (onNavigateToCart) {
        onNavigateToCart();
      } else {
        setSubmittedRegistration(newRegistration);
      }
    } catch (err: any) {
      console.error("Ralat menambah ke troli:", err);
      setErrorMessage(err.message || "Ralat semasa menyimpan ke troli.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Existing Registration Handler (Allows re-registering cleanly)
  const handleCancelExistingReg = async (regId: string) => {
    setIsCancellingReg(true);
    try {
      if (db) {
        await updateDoc(doc(db, 'qurbanRegistrations', regId), {
          statusPendaftaran: 'Batal',
          paymentStatus: 'Terbatal',
          pembatalanReason: 'Dibatalkan oleh ahli untuk pendaftaran semula.',
          updatedAt: new Date().toISOString()
        });
      }
      setShowCancelConfirmModal(false);
      setCurrentStep(1);
      setViewMode('form');
    } catch (err: any) {
      console.error("Ralat membatalkan pendaftaran:", err);
      setErrorMessage(err.message || "Ralat semasa membatalkan pendaftaran.");
    } finally {
      setIsCancellingReg(false);
    }
  };

  // --------------------------------------------------------------------------
  // VIEW MODE 1: QURBAN DIGITAL HOMEPAGE (LANDING PAGE - ALL ROLES CAN VIEW)
  // --------------------------------------------------------------------------
  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900 font-sans">
        
        {/* HEADER BAR */}
        <header className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-xs">
              <FileText size={18} className="stroke-[2.5]" />
            </div>
            <span className="font-black text-slate-900 text-lg tracking-tight">QurbanDigital</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-2xs">
            <button
              onClick={() => setViewMode('landing')}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white text-emerald-700 font-extrabold text-xs shadow-2xs border border-emerald-100/80 cursor-pointer"
            >
              <Home size={13} />
              <span>Utama</span>
            </button>
            <button
              onClick={handleCheckAccessForRegistration}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-slate-600 hover:text-emerald-700 font-extrabold text-xs cursor-pointer transition-colors"
            >
              <FileText size={13} />
              <span>Borang</span>
            </button>
          </div>
        </header>

        {/* HERO SECTION */}
        <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 text-center flex-1 flex flex-col justify-center items-center">
          
          {/* Top Heart Badge */}
          <div className="w-14 h-14 bg-emerald-100/80 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xs">
            <Heart size={26} className="stroke-[2.5]" />
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Ibadah Qurban & Aqiqah
          </h1>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-500 tracking-tight leading-tight mt-1 mb-4">
            Digital {sessionInfo.hijriYear}
          </h2>

          {/* Subtitle Description */}
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl mx-auto leading-relaxed mb-8">
            Sertai ibadah qurban anda dengan mudah. Proses pendaftaran digital yang lancar, transparen, dan mesra pengguna. Cetak borang anda secara automatik setelah selesai.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleCheckAccessForRegistration}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Daftar Sekarang</span>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={handleCheckStatus}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs sm:text-sm rounded-full border border-slate-200/80 shadow-xs flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Semak Status</span>
            </button>
          </div>

          {/* Had Kuota & Baki Penyertaan Semasa */}
          <div className="max-w-2xl mx-auto w-full mt-10 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black tracking-widest text-emerald-800 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block">
                Had Kuota & Baki Penyertaan Terkini
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              {/* Item 1 */}
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                isBhgLembuClosed ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-slate-50/50 border-slate-100'
              }`}>
                <span className="text-[11px] font-extrabold text-slate-600 uppercase">1 Bhg Lembu</span>
                <div className="my-2">
                  {isBhgLembuClosed ? (
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-black rounded-lg border border-slate-300 block">
                      TIDAK DIBUKA
                    </span>
                  ) : isBhgLembuFull ? (
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-black rounded-lg border border-rose-100 block">
                      PENUH
                    </span>
                  ) : (
                    <span className="text-xl font-black text-emerald-600 block">
                      {remainingBhgLembu} <span className="text-xs font-bold text-slate-400">Bhg</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">
                  {isBhgLembuClosed ? 'Pendaftaran Tidak Dibuka' : `Kuota Maks: ${limitBhgLembu} Bhg`}
                </span>
              </div>

              {/* Item 2 */}
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                isEkorLembuClosed ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-slate-50/50 border-slate-100'
              }`}>
                <span className="text-[11px] font-extrabold text-slate-600 uppercase">1 Ekor Lembu</span>
                <div className="my-2">
                  {isEkorLembuClosed ? (
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-black rounded-lg border border-slate-300 block">
                      TIDAK DIBUKA
                    </span>
                  ) : isEkorLembuFull ? (
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-black rounded-lg border border-rose-100 block">
                      PENUH
                    </span>
                  ) : (
                    <span className="text-xl font-black text-emerald-600 block">
                      {remainingEkorLembu} <span className="text-xs font-bold text-slate-400">Ekor</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">
                  {isEkorLembuClosed ? 'Pendaftaran Tidak Dibuka' : `Kuota Maks: ${limitEkorLembu} Ekor`}
                </span>
              </div>

              {/* Item 3 */}
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                isEkorKambingClosed ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-slate-50/50 border-slate-100'
              }`}>
                <span className="text-[11px] font-extrabold text-slate-600 uppercase">1 Ekor Kambing</span>
                <div className="my-2">
                  {isEkorKambingClosed ? (
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-black rounded-lg border border-slate-300 block">
                      TIDAK DIBUKA
                    </span>
                  ) : isEkorKambingFull ? (
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-black rounded-lg border border-rose-100 block">
                      PENUH
                    </span>
                  ) : (
                    <span className="text-xl font-black text-emerald-600 block">
                      {remainingEkorKambing} <span className="text-xs font-bold text-slate-400">Ekor</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">
                  {isEkorKambingClosed ? 'Pendaftaran Tidak Dibuka' : `Kuota Maks: ${limitEkorKambing} Ekor`}
                </span>
              </div>
            </div>
          </div>

          {/* 3 FEATURE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto w-full mt-14">
            {/* Card 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs text-center space-y-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-xl flex items-center justify-center mx-auto">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Selamat & Patuh</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Sistem yang mematuhi syariat dan data pendaftaran yang selamat.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs text-center space-y-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-xl flex items-center justify-center mx-auto">
                <Printer size={20} />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Cetak Automatik</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Borang pendaftaran dijana secara PDF dan sedia untuk dicetak.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs text-center space-y-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-xl flex items-center justify-center mx-auto">
                <Heart size={20} />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">Kemudahan Ummah</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Memudahkan pengurusan qurban untuk masjid dan komuniti.
              </p>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="text-[11px] text-slate-400 font-medium text-center border-t border-slate-100/80 pt-6 pb-8">
          &copy; {new Date().getFullYear()} Qurban Digital {sessionInfo.hijriYear}. Hak Cipta Terpelihara.
        </footer>

        {/* ALL PACKAGES CLOSED / UNAVAILABLE MODAL */}
        {showClosedModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl text-center">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  {isAllClosed ? 'Pendaftaran Belum Dibuka' : 'Pendaftaran Telah Penuh'}
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed font-medium">
                  {isAllClosed 
                    ? 'Pihak pengurusan persatuan belum membuka pendaftaran bagi mana-mana pakej Qurban & Aqiqah buat masa ini.' 
                    : 'Semua kuota pendaftaran bagi sesi ini telah penuh atau ditutup. Sila hubungi pihak urusetia untuk maklumat lanjut.'}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowClosedModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NO REGISTRATION MODAL ALERT (When user clicks Semak Status without registration) */}
        {showNoRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl text-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Belum Ada Pendaftaran</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed font-medium">
                  Anda belum membuat sebarang pendaftaran Qurban & Aqiqah. Sila tekan <strong className="text-emerald-700">'Daftar Sekarang'</strong> untuk mendaftar.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoRegModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNoRegModal(false);
                    handleCheckAccessForRegistration();
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-emerald-100 transition-all cursor-pointer"
                >
                  Daftar Sekarang
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW MODE 2: NEED LOGIN SCREEN
  // --------------------------------------------------------------------------
  if (viewMode === 'need_login') {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <User size={36} />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 uppercase">
              Log Masuk Diperlukan
            </span>
            <h2 className="text-xl font-black text-slate-900">
              Sila Log Masuk Terlebih Dahulu
            </h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed font-medium">
              Borang Pendaftaran Qurban & Aqiqah hanya boleh diakses oleh ahli yang telah log masuk ke dalam portal.
            </p>
          </div>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            {loginWithGoogle && (
              <button
                onClick={() => loginWithGoogle()}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <User size={16} />
                <span>Log Masuk Akaun</span>
              </button>
            )}
            <button
              onClick={() => setViewMode('landing')}
              className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Kembali ke Laman Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW MODE 3: ACCESS DENIED SCREEN (NON-APPROVED MEMBER)
  // --------------------------------------------------------------------------
  if (viewMode === 'denied') {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-rose-100 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck size={36} />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 uppercase">
              Akses Ditolak
            </span>
            <h2 className="text-xl font-black text-slate-900">
              Keahlian Belum Diluluskan
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
              Hanya ahli persatuan yang status keahliannya telah <strong className="text-emerald-800">Diluluskan</strong> sahaja yang dibenarkan untuk membuat pendaftaran Qurban & Aqiqah. Status akaun anda semasa: <span className="font-bold text-rose-700">{currentUserDoc?.approvalStatus || currentUserDoc?.membershipStatus || 'Belum Mendaftar / Dalam Semakan'}</span>.
            </p>
          </div>
          <div className="pt-3">
            <button
              onClick={() => setViewMode('landing')}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Kembali ke Laman Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW MODE 4: EXISTING REGISTRATION SUMMARY OR REGISTRATION FORM
  // --------------------------------------------------------------------------
  if (existingUserReg && !submittedRegistration) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-emerald-100 shadow-xl text-center space-y-5 animate-in fade-in">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <button
              onClick={() => setViewMode('landing')}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Laman Utama Qurban</span>
            </button>
          </div>

          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase">
              Pendaftaran Wujud
            </span>
            <h2 className="text-xl font-black text-slate-900">
              Anda Telah Mendaftar Bagi Sesi {existingUserReg.sessionYear}
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
              Akaun anda telah mempunyai rekod pendaftaran aktif (Ref: <strong className="text-slate-900">{existingUserReg.id}</strong>).
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex justify-between font-bold">
              <span className="text-slate-500">Nama Pendaftar:</span>
              <span className="text-slate-900">{existingUserReg.namaPenuh}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-slate-500">Jenis Ibadah:</span>
              <span className="text-emerald-800">{existingUserReg.jenisPenyertaan} ({existingUserReg.pakejPilihan})</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-slate-500">Jumlah Amaun:</span>
              <span className="text-slate-900">RM {existingUserReg.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-slate-500">Status Pendaftaran:</span>
              <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">{existingUserReg.statusPendaftaran}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-slate-500">Status Bayaran:</span>
              <span className={`px-2 py-0.5 rounded font-black ${
                existingUserReg.paymentStatus === 'Selesai' || existingUserReg.paymentStatus === 'Deposit Dibayar'
                  ? 'text-emerald-700 bg-emerald-100'
                  : existingUserReg.paymentStatus === 'Dalam Semakan'
                    ? 'text-amber-700 bg-amber-100'
                    : 'text-rose-700 bg-rose-100'
              }`}>
                {existingUserReg.paymentStatus || 'Belum Bayar'}
              </span>
            </div>
          </div>

          {/* Action Callout if Unpaid */}
          {existingUserReg.paymentStatus === 'Belum Bayar' && (
            <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl text-left space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <span>Pendaftaran Menunggu Bayaran Deposit / Penuh</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Pendaftaran ini telah direkodkan tetapi bayaran belum dibuat. Amaun perlu dibayar: <strong className="text-amber-950 font-black">RM {(existingUserReg.opsiBayaran === 'Ansuran' ? existingUserReg.depositAmount : existingUserReg.totalAmount).toFixed(2)}</strong>. Anda boleh selesaikan bayaran FPX sekarang, atau batalkan rekod jika ingin mendaftar semula.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartFpxPayment(existingUserReg)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CreditCard size={14} />
                  <span>Bayar Sekarang (FPX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirmModal(true)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <X size={14} />
                  <span>Batal & Daftar Semula</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
            {onNavigateToYuran && (
              <button
                onClick={onNavigateToYuran}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CreditCard size={15} />
                <span>Ke Menu Bayar Yuran (Ansuran)</span>
              </button>
            )}
            <button
              onClick={() => printQurbanRegistrationPdf(existingUserReg, liveConfig)}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download size={15} />
              <span>Muat Turun Borang PDF (A4)</span>
            </button>
            <button
              onClick={() => setViewMode('landing')}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Kembali ke Laman Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submittedRegistration) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-emerald-100 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase">
              Pendaftaran Berjaya Diterima
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Terima Kasih, {submittedRegistration.namaPenuh}!
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
              Permohonan ibadah <strong className="text-slate-900">{submittedRegistration.jenisPenyertaan} ({submittedRegistration.pakejPilihan})</strong> anda bagi Sesi <strong className="text-emerald-700">{submittedRegistration.sessionYear}</strong> telah berjaya direkodkan.
            </p>
          </div>

          {/* Alert for Cash vs Online */}
          {submittedRegistration.caraPembayaran === 'Tunai' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-black">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <span>Pengesahan Bayaran Tunai (24 Jam)</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                Pendaftaran anda diberikan tempoh selama <strong className="text-amber-900">24 Jam</strong> untuk ditunaikan kepada Bendahari Persatuan. Jika pihak admin/bendahari tidak mengesahkan penerimaan tunai dalam masa 24 jam, pendaftaran ini akan terbatal secara automatik.
              </p>
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-indigo-800 text-xs font-black">
                <CreditCard size={16} className="text-indigo-600 shrink-0" />
                <span>Bayaran Dalam Troli - Tempoh 24 Jam (Online Transfer / FPX)</span>
              </div>
              <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                Item deposit <strong className="text-indigo-900">{submittedRegistration.opsiBayaran === 'Ansuran' ? 'Deposit Month 1' : 'Bayaran Penuh'}</strong> sebanyak <strong className="text-indigo-900">RM {(submittedRegistration.opsiBayaran === 'Ansuran' ? submittedRegistration.depositAmount : submittedRegistration.totalAmount).toFixed(2)}</strong> telah dimasukkan ke Troli Bayaran anda. Sila pelihara tempoh <strong className="text-indigo-950 underline">24 jam</strong> untuk melunaskan bayaran di Troli. Sekiranya tidak dilunaskan dalam 24 jam, pendaftaran akan terbatal secara automatik dan anda perlu mendaftar semula.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => printQurbanRegistrationPdf(submittedRegistration, liveConfig)}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download size={15} />
              <span>Muat Turun Borang PDF (A4)</span>
            </button>

            {submittedRegistration.caraPembayaran === 'Online Transfer' && onNavigateToCart && (
              <button
                onClick={onNavigateToCart}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CreditCard size={15} />
                <span>Ke Troli Pembayaran</span>
              </button>
            )}

            <button
              onClick={() => setViewMode('landing')}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Kembali ke Laman Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP-BY-STEP FORM COMPONENT
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Header Row with Back to Landing */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        <button
          onClick={() => setViewMode('landing')}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer flex items-center gap-2 text-xs font-extrabold"
        >
          <ArrowLeft size={16} />
          <span>Laman Utama Qurban</span>
        </button>
        <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Langkah {currentStep} daripada 4
        </span>
      </div>

      {/* STEP WIZARD BAR */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className={`p-2 rounded-2xl text-[10px] sm:text-xs font-extrabold transition-all ${
            currentStep === 1 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : currentStep > 1 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-400'
          }`}>
            1. Pakej
          </div>
          <div className={`p-2 rounded-2xl text-[10px] sm:text-xs font-extrabold transition-all ${
            currentStep === 2 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : currentStep > 2 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-400'
          }`}>
            2. Peribadi
          </div>
          <div className={`p-2 rounded-2xl text-[10px] sm:text-xs font-extrabold transition-all ${
            currentStep === 3 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : currentStep > 3 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-400'
          }`}>
            3. Peserta
          </div>
          <div className={`p-2 rounded-2xl text-[10px] sm:text-xs font-extrabold transition-all ${
            currentStep === 4 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'bg-slate-50 text-slate-400'
          }`}>
            4. Bayaran
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-extrabold flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* FORM BODY */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (currentStep < 4) {
              handleNextStep();
            }
          }
        }}
        className="bg-white p-5 md:p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6"
      >
        
        {/* STEP 1: JENIS & PAKEJ */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 uppercase">1. Pilih Jenis & Pakej Penyertaan</h2>
              <p className="text-xs text-slate-500">Pilih jenis ibadah dan bahagian ternakan bagi sesi {sessionInfo.fullLabel}.</p>
            </div>

            {/* Jenis Penyertaan */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-700 block uppercase">Jenis Ibadah:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(['Qurban Sunat', 'Qurban Wajib', 'Aqiqah Sunat', 'Aqiqah Wajib'] as const).map(j => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setJenisPenyertaan(j)}
                    className={`p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
                      jenisPenyertaan === j 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs' 
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>

            {/* Pakej Options */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-extrabold text-slate-700 block uppercase">Pilihan Pakej Ternakan:</label>
              
              {/* Option 1: 1 Bhg Lembu */}
              <div
                onClick={() => !isBhgLembuUnavailable && setPakejPilihan('1 BHG LEMBU')}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isBhgLembuUnavailable 
                    ? 'border-slate-200 bg-slate-100/70 opacity-60 cursor-not-allowed' 
                    : pakejPilihan === '1 BHG LEMBU' 
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs cursor-pointer' 
                      : 'border-slate-200 hover:border-emerald-300 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">1 Bahagian Lembu</span>
                    {isBhgLembuClosed ? (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-black rounded-md">TIDAK DIBUKA</span>
                    ) : isBhgLembuFull ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black rounded-md">PENUH</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">Baki: {remainingBhgLembu} Bhg</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isBhgLembuClosed 
                      ? 'Pakej ini tidak dibuka untuk pendaftaran sesi semasa' 
                      : `RM ${(liveConfig.bhgLembuPrice || 900).toFixed(2)} ${calculateQurbanFee(liveConfig.bhgLembuPrice || 900, liveConfig).displayNote}`}
                  </p>
                </div>
                <span className="font-black text-emerald-800 text-sm">
                  {isBhgLembuClosed ? '-' : `RM ${(liveConfig.bhgLembuPrice || 900).toFixed(2)}`}
                </span>
              </div>

              {/* Option 2: 1 Ekor Lembu */}
              <div
                onClick={() => !isEkorLembuUnavailable && setPakejPilihan('1 EKOR LEMBU')}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isEkorLembuUnavailable 
                    ? 'border-slate-200 bg-slate-100/70 opacity-60 cursor-not-allowed' 
                    : pakejPilihan === '1 EKOR LEMBU' 
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs cursor-pointer' 
                      : 'border-slate-200 hover:border-emerald-300 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">1 Ekor Lembu Penuh (7 Bahagian)</span>
                    {isEkorLembuClosed ? (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-black rounded-md">TIDAK DIBUKA</span>
                    ) : isEkorLembuFull ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black rounded-md">PENUH</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">Baki: {remainingEkorLembu} Ekor</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEkorLembuClosed 
                      ? 'Pakej ini tidak dibuka untuk pendaftaran sesi semasa' 
                      : `RM ${(liveConfig.ekorLembuPrice || 6300).toFixed(2)} ${calculateQurbanFee(liveConfig.ekorLembuPrice || 6300, liveConfig).displayNote}`}
                  </p>
                </div>
                <span className="font-black text-emerald-800 text-sm">
                  {isEkorLembuClosed ? '-' : `RM ${(liveConfig.ekorLembuPrice || 6300).toFixed(2)}`}
                </span>
              </div>

              {/* Option 3: 1 Ekor Kambing */}
              <div
                onClick={() => !isEkorKambingUnavailable && setPakejPilihan('1 EKOR KAMBING')}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isEkorKambingUnavailable 
                    ? 'border-slate-200 bg-slate-100/70 opacity-60 cursor-not-allowed' 
                    : pakejPilihan === '1 EKOR KAMBING' 
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs cursor-pointer' 
                      : 'border-slate-200 hover:border-emerald-300 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">1 Ekor Kambing / Biri-biri</span>
                    {isEkorKambingClosed ? (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-black rounded-md">TIDAK DIBUKA</span>
                    ) : isEkorKambingFull ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black rounded-md">PENUH</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">Baki: {remainingEkorKambing} Ekor</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEkorKambingClosed 
                      ? 'Pakej ini tidak dibuka untuk pendaftaran sesi semasa' 
                      : `RM ${(liveConfig.ekorKambingPrice || 1200).toFixed(2)} ${calculateQurbanFee(liveConfig.ekorKambingPrice || 1200, liveConfig).displayNote}`}
                  </p>
                </div>
                <span className="font-black text-emerald-800 text-sm">
                  {isEkorKambingClosed ? '-' : `RM ${(liveConfig.ekorKambingPrice || 1200).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Price Summary Breakdown */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between font-bold text-slate-600">
                <span>Harga Pakej Pilihan:</span>
                <span>RM {pakejPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Caj Pengurusan ({feeDetails.feeType === 'fixed' ? `RM ${feeDetails.feeAmount.toFixed(2)}` : `${feeDetails.feePercent}%`}):</span>
                <span>RM {mgmtFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 text-sm pt-2 border-t border-slate-200">
                <span>Jumlah Keseluruhan:</span>
                <span className="text-emerald-800">RM {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: MAKLUMAT PERIBADI */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 uppercase">2. Maklumat Peribadi Pendaftar</h2>
              <p className="text-xs text-slate-500">Diambil secara automatik daripada profil keahlian anda.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Nama Penuh Pendaftar:</label>
                <input
                  type="text"
                  value={namaPenuh}
                  onChange={(e) => setNamaPenuh(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-extrabold text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Nama Penuh mengikut K/P"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">No. Kad Pengenalan:</label>
                <input
                  type="text"
                  value={noIC}
                  onChange={(e) => setNoIC(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-extrabold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Contoh: 880101055123"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">No. Telefon (Wajib):</label>
                <input
                  type="text"
                  value={noTelefon}
                  onChange={(e) => setNoTelefon(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-extrabold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Contoh: 0123456789"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Alamat Emel:</label>
                <input
                  type="email"
                  value={emel}
                  onChange={(e) => setEmel(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="nama@email.com"
                />
              </div>

              <div className="col-span-1 md:col-span-2 space-y-1.5">
                <label className="font-bold text-slate-700 block">Alamat Kediaman / Surat Menyuara:</label>
                <textarea
                  rows={2}
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Alamat lengkap rumah anda..."
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: NAMA PESERTA / PENAMA */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase">3. Senarai Nama Peserta / Penama</h2>
                <p className="text-xs text-slate-500">Masukkan nama peserta bagi ibadah ini (Pakej: {pakejPilihan}).</p>
              </div>
              {pakejPilihan === '1 EKOR LEMBU' && (
                <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  7 Nama Disyorkan
                </span>
              )}
            </div>

            <div className="space-y-3">
              {senaraiPeserta.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-8 h-8 bg-slate-100 text-slate-700 rounded-xl font-black text-xs flex items-center justify-center shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleParticipantChange(idx, e.target.value)}
                    placeholder={`Nama Peserta Ke-${idx + 1} (cth: ${namaPenuh || 'Ahmad bin Ali'})`}
                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-extrabold text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {senaraiPeserta.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(idx)}
                      className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors cursor-pointer"
                      title="Padam Peserta"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pakejPilihan === '1 EKOR LEMBU' && senaraiPeserta.length < 7 && (
              <button
                type="button"
                onClick={handleAddParticipant}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Tambah Nama Peserta Ke-{senaraiPeserta.length + 1}</span>
              </button>
            )}
          </div>
        )}

        {/* STEP 4: DAGING & PEMBAYARAN */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 uppercase">4. Pengurusan Daging & Pembayaran</h2>
              <p className="text-xs text-slate-500">Pilih pengurusan daging dan selesaikan bayaran untuk melengkapkan pendaftaran.</p>
            </div>

            {/* Ringkasan Bayaran */}
            <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-extrabold text-slate-800">
                <span>Ringkasan Ibadah:</span>
                <span className="text-emerald-800">{jenisPenyertaan} ({pakejPilihan})</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Senarai Penama:</span>
                <span className="text-slate-900 max-w-[220px] text-right truncate">
                  {senaraiPeserta.filter(n => n.trim() !== '').join(', ') || namaPenuh}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Harga Pakej Ternakan:</span>
                <span>RM {pakejPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Caj Pengurusan ({feeDetails.feeType === 'fixed' ? `RM ${feeDetails.feeAmount.toFixed(2)}` : `${feeDetails.feePercent}%`}):</span>
                <span>RM {mgmtFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 text-sm pt-2 border-t border-slate-200">
                <span>Jumlah Keseluruhan:</span>
                <span className="text-slate-900">RM {grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-emerald-800 bg-emerald-100/60 p-2.5 rounded-xl border border-emerald-200">
                <span>Jumlah Perlu Dibayar Sekarang:</span>
                <span className="text-sm">
                  RM {payableAmount.toFixed(2)} {opsiBayaran === 'Ansuran' ? `(Deposit Bulan 1)` : `(Bayaran Penuh)`}
                </span>
              </div>
            </div>

            {/* Pilihan Daging */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-700 block uppercase">Pilihan Pengurusan Daging:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(['Mahu Ambil Daging', 'Tidak Mahu Daging', 'Simpan Daging'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPilihanDaging(p)}
                    className={`p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer text-left ${
                      pilihanDaging === p 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs' 
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{p}</span>
                    {p === 'Simpan Daging' && <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">Kos RM50/sehari</span>}
                    {p === 'Tidak Mahu Daging' && <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">Infaq Penuh Kepada Asnaf</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Opsi Bayaran: Penuh vs Ansuran */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-extrabold text-slate-700 block uppercase">Mod Pembayaran:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOpsiBayaran('Penuh')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    opsiBayaran === 'Penuh'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-extrabold text-slate-900 text-xs block">Bayar Terus (Penuh)</span>
                  <span className="font-black text-emerald-800 text-sm block mt-1">RM {grandTotal.toFixed(2)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpsiBayaran('Ansuran')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    opsiBayaran === 'Ansuran'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-extrabold text-slate-900 text-xs block">Ansuran Bulanan</span>
                  <span className="font-black text-emerald-800 text-sm block mt-1">RM {monthlyInstallment.toFixed(2)} / Bulan</span>
                </button>
              </div>
            </div>

            {/* Tempoh Ansuran (If Ansuran selected) */}
            {opsiBayaran === 'Ansuran' && (
              <div className="space-y-3">
                <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-700 block">Pilih Tempoh Ansuran:</label>
                  <div className="flex gap-2">
                    {(liveConfig.ansuranMonthsOptions || [3, 5, 10]).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTempohAnsuranBulan(m)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          tempohAnsuranBulan === m ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {m} Bulan
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-600 font-semibold pt-1">
                    Deposit Bulan Pertama: <strong className="text-emerald-800">RM {depositAmount.toFixed(2)}</strong> (Perlu dilunaskan untuk mengesahkan pendaftaran).
                  </p>
                </div>

                <div className="p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl flex gap-3 text-left">
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-xs font-black text-amber-900 block">⚠️ NOTA PESANAN PENTING:</span>
                    <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
                      Pilihan tempoh ansuran bulanan (<strong className="text-amber-950 font-black">3 Bulan, 5 Bulan, atau 10 Bulan</strong>) adalah <span className="underline decoration-amber-400 decoration-2 font-black">MUKTAMAD</span> dan tidak boleh ditukar selepas pendaftaran.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cara Pembayaran: 3 Options (FPX, Manual, Tunai) */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-extrabold text-slate-700 block uppercase">Pilih Kaedah Pembayaran:</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Option 1: FPX */}
                <button
                  type="button"
                  onClick={() => setCaraPembayaran('Online Transfer')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    caraPembayaran === 'Online Transfer'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-indigo-950 font-extrabold text-xs">
                    <CreditCard size={16} className="text-indigo-600 shrink-0" />
                    <span>Online Banking (FPX)</span>
                  </div>
                  <p className="text-[10px] text-indigo-700 mt-1 font-medium">Bayar terus dalam talian & disahkan segera.</p>
                </button>

                {/* Option 2: Manual Transfer */}
                <button
                  type="button"
                  onClick={() => setCaraPembayaran('Manual Transfer')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    caraPembayaran === 'Manual Transfer'
                      ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-emerald-950 font-extrabold text-xs">
                    <Upload size={16} className="text-emerald-600 shrink-0" />
                    <span>Pindahan Bank / Resit</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 mt-1 font-medium">Transfer ke akaun CIMB & muat naik resit.</p>
                </button>

                {/* Option 3: Tunai */}
                <button
                  type="button"
                  onClick={() => setCaraPembayaran('Tunai')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                    caraPembayaran === 'Tunai'
                      ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-amber-950 font-extrabold text-xs">
                    <DollarSign size={16} className="text-amber-600 shrink-0" />
                    <span>Tunai (Bendahari)</span>
                  </div>
                  <p className="text-[10px] text-amber-700 mt-1 font-medium">Serah wang tunai dalam tempoh 24 jam.</p>
                </button>
              </div>

              {/* DETAILED PAYMENT FORM ACCORDING TO SELECTED METHOD */}
              {/* 1. ONLINE TRANSFER (FPX) DETAILS */}
              {caraPembayaran === 'Online Transfer' && (
                <div className="p-4 sm:p-5 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl space-y-4 animate-in fade-in">
                  <div>
                    <span className="text-xs font-black text-indigo-950 block">Pilih Bank FPX Anda:</span>
                    <p className="text-[10px] text-indigo-700 font-medium">Pilih bank perbankan internet anda untuk bayaran langsung sebanyak <strong className="text-indigo-950 font-black">RM {payableAmount.toFixed(2)}</strong>.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FPX_BANKS.map((bank) => (
                      <button
                        key={bank.name}
                        type="button"
                        onClick={() => setSelectedBank(bank.name)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          selectedBank === bank.name
                            ? 'border-indigo-600 bg-white ring-2 ring-indigo-500 shadow-xs'
                            : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                        }`}
                      >
                        <span className="text-base">{bank.logo}</span>
                        <span className="text-[11px] font-extrabold text-slate-800">{bank.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleStartFpxPayment()}
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CreditCard size={15} />
                      <span>Bayar Terus FPX Sekarang (RM {payableAmount.toFixed(2)})</span>
                    </button>
                    {onAddToCart && (
                      <button
                        type="button"
                        onClick={handleSaveAndAddToCart}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-300 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ShoppingCart size={15} />
                        <span>Masukkan ke Troli untuk Bayar Kemudian</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 2. MANUAL TRANSFER DETAILS (UPLOAD RECEIPT) */}
              {caraPembayaran === 'Manual Transfer' && (
                <div className="p-4 sm:p-5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-4 animate-in fade-in">
                  <div>
                    <span className="text-xs font-black text-emerald-950 block">Maklumat Akaun Bank Persatuan:</span>
                    <p className="text-[10px] text-emerald-800 font-medium">Sila buat pemindahan perbankan ke akaun rasmi di bawah:</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>Nama Bank:</span>
                      <span className="text-slate-900 font-black">CIMB Bank Berhad</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>No. Akaun:</span>
                      <span className="text-emerald-800 font-black tracking-wider">8601234567</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>Nama Penerima:</span>
                      <span className="text-slate-900">PIBG Sekolah Menengah Agama Ulu Jempol</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>Rujukan Pembayaran:</span>
                      <span className="text-slate-900 font-extrabold">QURBAN - {namaPenuh || 'NAMA AHLI'}</span>
                    </div>
                    <div className="flex justify-between font-black text-emerald-900 pt-1 border-t border-slate-100">
                      <span>Amaun Pemindahan:</span>
                      <span className="text-sm">RM {payableAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Receipt Upload Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Muat Naik Resit Bukti Pembayaran <span className="text-rose-500">*</span>:
                    </label>

                    {receiptPreview ? (
                      <div className="space-y-2">
                        <div className="relative w-full max-w-xs mx-auto border-2 border-emerald-500 rounded-2xl overflow-hidden bg-slate-900/5 p-2">
                          <img
                            src={receiptPreview}
                            alt="Pratonton Resit"
                            className="max-h-48 w-full object-contain rounded-xl"
                          />
                        </div>
                        <div className="flex justify-center gap-2">
                          <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all">
                            Tukar Resit
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setReceiptFile(file);
                                  setReceiptUploadError('');
                                  const reader = new FileReader();
                                  reader.onload = () => setReceiptPreview(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptFile(null);
                              setReceiptPreview('');
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer transition-all"
                          >
                            Padam
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white p-6 rounded-2xl text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload size={20} />
                        </div>
                        <span className="text-xs font-black text-slate-800">Klik untuk pilih gambar atau fail resit bayaran</span>
                        <span className="text-[10px] text-slate-400 font-semibold">Format JPG, PNG, atau PDF (Maks 10MB)</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setReceiptFile(file);
                              setReceiptUploadError('');
                              const reader = new FileReader();
                              reader.onload = () => setReceiptPreview(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}

                    {receiptUploadError && (
                      <p className="text-xs text-rose-600 font-extrabold flex items-center gap-1">
                        <AlertCircle size={14} />
                        <span>{receiptUploadError}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 3. CASH DETAILS */}
              {caraPembayaran === 'Tunai' && (
                <div className="p-4 sm:p-5 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                    <Clock size={16} className="text-amber-600 shrink-0" />
                    <span>Syarat Pembayaran Tunai (Tempoh 24 Jam):</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Wang tunai sebanyak <strong className="text-amber-950 font-black">RM {payableAmount.toFixed(2)}</strong> hendaklah diserahkan secara fizikal kepada Bendahari Persatuan dalam tempoh <strong className="text-amber-950 font-black">24 jam</strong> dari masa pendaftaran dihantar. Pendaftaran anda hanya akan disahkan selepas penerimaan tunai diperakui oleh Bendahari.
                  </p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* STEP BUTTONS FOOTER */}
        <div className="pt-4 border-t border-slate-100 flex justify-between items-center gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Sebelumnya</span>
            </button>
          ) : <div />}

          {currentStep < 4 ? (
            <button
              key="btn-next-step"
              type="button"
              onClick={handleNextStep}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Seterusnya</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {caraPembayaran === 'Online Transfer' && (
                <button
                  type="button"
                  onClick={() => handleStartFpxPayment()}
                  className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <CreditCard size={15} />
                  <span>Bayar FPX Sekarang (RM {payableAmount.toFixed(2)})</span>
                </button>
              )}

              {caraPembayaran === 'Manual Transfer' && (
                <button
                  type="button"
                  disabled={!receiptFile || isUploadingReceipt}
                  onClick={handleManualTransferSubmit}
                  className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingReceipt ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Memuat Naik Resit...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      <span>Hantar Resit & Sahkan Pendaftaran</span>
                    </>
                  )}
                </button>
              )}

              {caraPembayaran === 'Tunai' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!validateStep(4)) return;
                    setShowCashConfirmModal(true);
                  }}
                  className="px-7 py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <DollarSign size={15} />
                  <span>Sahkan Pendaftaran (Bayaran Tunai)</span>
                </button>
              )}
            </div>
          )}
        </div>

      </form>

      {/* MODAL 1: FPX SIMULATED GATEWAY MODAL */}
      {showFpxModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded font-mono">fpx</span>
                <h3 className="text-sm font-black text-slate-900">Perbankan Atas Talian ({selectedBank})</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (fpxPaymentStep === 'form') {
                    setShowFpxModal(false);
                    setActivePayingReg(null);
                  }
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* FPX Steps */}
            {fpxPaymentStep === 'form' && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>Penerima:</span>
                    <span className="text-slate-900 font-extrabold">PIBG SMA Ulu Jempol</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>Tujuan:</span>
                    <span className="text-slate-900">{activePayingReg?.jenisPenyertaan || jenisPenyertaan} ({activePayingReg?.pakejPilihan || pakejPilihan})</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>Nama Pembayar:</span>
                    <span className="text-slate-900">{activePayingReg?.namaPenuh || namaPenuh}</span>
                  </div>
                  <div className="flex justify-between font-black text-emerald-800 text-sm pt-2 border-t border-slate-200">
                    <span>Jumlah Bayaran:</span>
                    <span>RM {(activePayingReg ? (activePayingReg.opsiBayaran === 'Ansuran' ? activePayingReg.depositAmount : activePayingReg.totalAmount) : payableAmount).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">ID Pengguna {selectedBank}:</label>
                    <input
                      type="text"
                      value={fpxUsername}
                      onChange={(e) => setFpxUsername(e.target.value)}
                      className="w-full p-2.5 text-xs border border-slate-200 rounded-xl font-extrabold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Kata Laluan Perbankan:</label>
                    <input
                      type="password"
                      value={fpxPassword}
                      onChange={(e) => setFpxPassword(e.target.value)}
                      className="w-full p-2.5 text-xs border border-slate-200 rounded-xl font-extrabold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFpxModal(false);
                      setActivePayingReg(null);
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={executeFpxPayment}
                    className="flex-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Lock size={14} />
                    <span>Sahkan & Bayar RM {(activePayingReg ? (activePayingReg.opsiBayaran === 'Ansuran' ? activePayingReg.depositAmount : activePayingReg.totalAmount) : payableAmount).toFixed(2)}</span>
                  </button>
                </div>
              </div>
            )}

            {fpxPaymentStep === 'authenticating' && (
              <div className="py-8 text-center space-y-4">
                <RefreshCw size={36} className="text-indigo-600 animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900">Mengesahkan Akses {selectedBank}...</h4>
                  <p className="text-xs text-slate-500 font-medium">Sila tunggu sebentar sementara sambungan selamat dibuat.</p>
                </div>
              </div>
            )}

            {fpxPaymentStep === 'processing' && (
              <div className="py-8 text-center space-y-4">
                <RefreshCw size={36} className="text-emerald-600 animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900">Memproses Transaksi FPX...</h4>
                  <p className="text-xs text-slate-500 font-medium">Menyelesaikan pembayaran dan merekod pengesahan pendaftaran.</p>
                </div>
              </div>
            )}

            {fpxPaymentStep === 'success' && (
              <div className="py-8 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check size={28} className="stroke-[3]" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-black text-slate-900">Pembayaran Berjaya!</h4>
                  <p className="text-xs text-emerald-700 font-bold">Resit pembayaran telah dijana dan pendaftaran telah disahkan.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: CASH PAYMENT CONFIRMATION MODAL */}
      {showCashConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <DollarSign size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">Sahkan Bayaran Tunai?</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Anda memilih bayaran Tunai sebanyak <strong className="text-amber-900">RM {payableAmount.toFixed(2)}</strong>. Anda mesti menyerahkan wang tunai kepada Bendahari Persatuan dalam tempoh <strong className="text-amber-900">24 Jam</strong> untuk mengelakkan pembatalan automatik.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCashConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCashConfirmSubmit}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Ya, Sahkan Tunai'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CANCEL EXISTING REGISTRATION MODAL */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">Batalkan Pendaftaran Ini?</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Pendaftaran yang belum dibuat bayaran ini akan dibatalkan supaya anda boleh membuat pendaftaran baru. Adakah anda pasti?
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-all"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isCancellingReg}
                onClick={() => {
                  if (existingUserReg) {
                    handleCancelExistingReg(existingUserReg.id);
                  }
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                {isCancellingReg ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
