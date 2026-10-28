import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { NotisPanggilan, Kehadiran } from '../types';
import { 
  CheckCircle2, XCircle, AlertCircle, Calendar, Clock, MapPin, 
  ArrowLeft, FileText, Send, Bookmark, UserCheck, Shield, Loader2, LogIn,
  Users, Home, Phone, UserPlus, ArrowRight, X, Sparkles
} from 'lucide-react';

interface KehadiranSectionProps {
  onBack: () => void;
}

// Helper to determine if notice is Mesyuarat Agung Khas (Semua Ahli)
export const isAgungKhasNotice = (notice: NotisPanggilan | null | undefined): boolean => {
  if (!notice) return false;
  const t = (notice.title || '').toUpperCase();
  const cat = (notice.type || '').toUpperCase();
  return (
    cat === 'AGUNG_KHAS' ||
    cat === 'AGUNG' ||
    t.includes('AGUNG') ||
    t.includes('AGUNG KHAS') ||
    t.includes('SEMUA AHLI') ||
    t.includes('MESYUARAT AGUNG')
  );
};

export default function KehadiranSection({ onBack }: KehadiranSectionProps) {
  const { currentUserDoc, firebaseUser, loginWithGoogle, loading, allApplications, allUsers } = useAuth();
  const [activeNotice, setActiveNotice] = useState<NotisPanggilan | null>(null);
  const [currentKehadiran, setCurrentKehadiran] = useState<Kehadiran | null>(null);
  const [isLoadingNotice, setIsLoadingNotice] = useState(true);
  
  // Custom checking and loading states
  const [isChecking, setIsChecking] = useState(false);
  const [internalChecking, setInternalChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Form inputs
  const [status, setStatus] = useState<'Hadir' | 'Tidak Hadir' | null>(null);
  const [reason, setReason] = useState('');
  const [customNoRumah, setCustomNoRumah] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRegisterPromptModal, setShowRegisterPromptModal] = useState(false);

  // Check if current user is signed in with real account (not local guest or anonymous)
  const isUserSignedIn = !!firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local';
  const currentUid = currentUserDoc?.uid || (isUserSignedIn ? firebaseUser.uid : null);

  // Fetch active notice (the one with isTick === true) ALWAYS regardless of sign in
  useEffect(() => {
    if (!db) return;
    setIsLoadingNotice(true);
    const unsubNotices = onSnapshot(collection(db, 'notisPanggilan'), (snapshot) => {
      let active: NotisPanggilan | null = null;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as NotisPanggilan;
        if (data.isTick) {
          active = { id: docSnap.id, ...data };
        }
      });
      setActiveNotice(active);
      setIsLoadingNotice(false);
    }, (err) => {
      console.error("Ralat memuatkan notis:", err);
      setIsLoadingNotice(false);
    });
    return () => unsubNotices();
  }, [db]);

  // Set default phone and house number from currentUserDoc if available
  useEffect(() => {
    if (currentUserDoc) {
      if (currentUserDoc.noRumah) setCustomNoRumah(currentUserDoc.noRumah);
      if (currentUserDoc.phoneNumber) setCustomPhone(currentUserDoc.phoneNumber);
    }
  }, [currentUserDoc]);

  // Fetch current user's attendance status for this active notice
  useEffect(() => {
    if (!db || !currentUid || !activeNotice) {
      setCurrentKehadiran(null);
      return;
    }
    
    const docId = `kehadiran-${activeNotice.id}-${currentUid}`;
    const unsubKehadiran = onSnapshot(doc(db, 'kehadiran', docId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Kehadiran;
        setCurrentKehadiran(data);
        setStatus(data.status);
        setReason(data.reason || '');
        if ((data as any).noRumah && !customNoRumah) {
          setCustomNoRumah((data as any).noRumah);
        }
        if ((data as any).phoneNumber && !customPhone) {
          setCustomPhone((data as any).phoneNumber);
        }
      } else {
        setCurrentKehadiran(null);
        setStatus(null);
        setReason('');
      }
    }, (err) => {
      console.warn("Ralat memuatkan data kehadiran:", err);
    });

    return () => unsubKehadiran();
  }, [currentUid, activeNotice]);

  // Check role eligibility:
  // If Mesyuarat Agung Khas (Semua Ahli), ALL signed-in users are eligible even if not registered as a member!
  const isNoticeAgungKhas = isAgungKhasNotice(activeNotice);

  const isEligible = () => {
    if (!activeNotice) return false;
    if (!isUserSignedIn) return false;

    // Requirement:
    // If it is MESYUARAT AGUNG KHAS (SEMUA AHLI), ANY signed-in user can fill attendance!
    if (isNoticeAgungKhas) {
      return true;
    }

    // For other notices (e.g. AJK only meetings)
    if (!currentUserDoc) return false;
    const nonCommitteeRoles = ['Pelawat', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Penduduk', 'Tetamu'];
    const isAJK = !nonCommitteeRoles.includes(currentUserDoc.role);
    return isAJK;
  };

  // Google Login handler with check states
  const handleGoogleLogin = async () => {
    setIsChecking(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Ralat log masuk Google:", err);
      setLoginError("Gagal log masuk dengan Google. Sila cuba lagi.");
      setIsChecking(false);
    }
  };

  // Set internal checking loading timer on sign in
  useEffect(() => {
    if (firebaseUser && !firebaseUser.isAnonymous && !loading) {
      setInternalChecking(true);
      const timer = setTimeout(() => {
        setInternalChecking(false);
        setIsChecking(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [firebaseUser, loading]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNotice) return;
    
    if (!isUserSignedIn || !firebaseUser) {
      setError("Sila log masuk dengan Google terlebih dahulu sebelum mengisi kehadiran.");
      return;
    }

    if (!isEligible()) {
      setError("Akaun anda tidak mempunyai akses bagi mesyuarat ini.");
      return;
    }

    if (!status) {
      setError("Sila pilih sama ada Hadir atau Tidak Hadir.");
      return;
    }
    if (status === 'Tidak Hadir' && !reason.trim()) {
      setError("Sila nyatakan alasan ketidakhadiran.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const userUid = firebaseUser.uid;
      const userName = currentUserDoc?.displayName || currentUserDoc?.nickname || firebaseUser.displayName || 'Penduduk';
      const userEmail = currentUserDoc?.email || firebaseUser.email || '';
      const userRole = currentUserDoc?.role || 'Pelawat (Belum Daftar Ahli)';
      const docId = `kehadiran-${activeNotice.id}-${userUid}`;

      const payload: Kehadiran & { noRumah?: string; phoneNumber?: string } = {
        id: docId,
        noticeId: activeNotice.id,
        noticeTitle: activeNotice.title,
        userUid: userUid,
        userName: userName,
        userEmail: userEmail,
        userRole: userRole,
        status,
        reason: status === 'Tidak Hadir' ? reason : '',
        updatedAt: new Date().toISOString()
      };

      if (currentUserDoc?.noRumah) {
        payload.noRumah = currentUserDoc.noRumah;
      } else if (customNoRumah.trim()) {
        payload.noRumah = customNoRumah.trim();
      }

      if (currentUserDoc?.phoneNumber) {
        payload.phoneNumber = currentUserDoc.phoneNumber;
      } else if (customPhone.trim()) {
        payload.phoneNumber = customPhone.trim();
      }

      await setDoc(doc(db, 'kehadiran', docId), payload);
      setSuccess("Pengesahan kehadiran anda berjaya dihantar!");
      setTimeout(() => setSuccess(null), 5000);

      // Check if user is not already an active registered member or has submitted an application
      const isAppApprovedOrPending = (allApplications || []).some(app => 
        (app.uid === firebaseUser?.uid || app.uid === currentUserDoc?.uid || (app.email && (app.email.toLowerCase().trim() === (firebaseUser?.email || '').toLowerCase().trim() || app.email.toLowerCase().trim() === (currentUserDoc?.email || '').toLowerCase().trim()))) &&
        (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian' || app.status === 'Approved' || app.status === 'Pending' || app.status === 'Dalam Proses Semakan')
      );

      const matchedAllUser = (allUsers || []).find(u => 
        u.uid === firebaseUser?.uid || 
        u.uid === currentUserDoc?.uid || 
        (u.email && firebaseUser?.email && u.email.toLowerCase().trim() === firebaseUser.email.toLowerCase().trim())
      );

      const isFullRegisteredMember = Boolean(
        isAppApprovedOrPending ||
        (matchedAllUser && (matchedAllUser.membershipStatus === 'Aktif' || !!matchedAllUser.memberNo || matchedAllUser.approvalStatus === 'Approved')) ||
        (currentUserDoc && (
          currentUserDoc.membershipStatus === 'Aktif' ||
          currentUserDoc.membershipStatus === 'Diluluskan' ||
          currentUserDoc.membershipStatus === 'Diluluskan Keahlian' ||
          currentUserDoc.approvalStatus === 'Approved' ||
          currentUserDoc.approvalStatus === 'Diluluskan' ||
          (currentUserDoc.memberNo && currentUserDoc.memberNo.trim().length > 0) ||
          currentUserDoc.approvedAt ||
          currentUserDoc.isSuperAdmin === true ||
          (currentUserDoc.membershipStatus === 'Menunggu Kelulusan' && currentUserDoc.icNumber && currentUserDoc.noRumah) ||
          (currentUserDoc.role !== 'Pelawat' && currentUserDoc.role !== 'Tetamu' && currentUserDoc.role !== 'Penduduk')
        ))
      );

      // Trigger popup asking user to register as member only if they are truly not yet registered
      if (!isFullRegisteredMember) {
        setTimeout(() => {
          setShowRegisterPromptModal(true);
        }, 600);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Gagal menghantar pengesahan. Sila cuba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToDaftarAhli = () => {
    setShowRegisterPromptModal(false);
    sessionStorage.setItem('tmf2_open_daftar_warning', 'true');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tmf2_show_daftar_warning'));
      window.dispatchEvent(new CustomEvent('tmf2_switch_view', { detail: 'daftar-ahli' }));
    }
  };

  // 1. Show checking overlay if any check is in progress
  if (isChecking || loading || internalChecking || isLoadingNotice) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-100 p-12 rounded-3xl text-center space-y-5 shadow-md my-12 animate-in fade-in duration-300">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
        <div className="space-y-2">
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Sila tunggu sebentar</h3>
          <p className="text-xs text-slate-500 font-bold leading-relaxed">
            Sistem sedang menyemak status kelayakan dan notis panggilan mesyuarat...
          </p>
        </div>
      </div>
    );
  }

  // 2. No Active Notice Screen
  if (!activeNotice) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-100 p-8 rounded-3xl text-center space-y-6 shadow-md my-12 animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Tiada Notis Aktif</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            Tiada sebarang notis panggilan mesyuarat aktif untuk pengesahan kehadiran buat masa ini.
          </p>
        </div>
        <button 
          onClick={onBack}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  // 3. User NOT signed in: Prompt to Sign In first!
  if (!isUserSignedIn) {
    return (
      <div className="max-w-lg mx-auto space-y-4 my-8 animate-in fade-in duration-300">
        {/* Active Notice Preview Banner */}
        <div className="bg-indigo-950 text-white rounded-3xl p-6 shadow-md border border-indigo-900 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
              isNoticeAgungKhas 
                ? 'bg-amber-400 text-slate-950 font-black' 
                : 'bg-emerald-500 text-white'
            }`}>
              {isNoticeAgungKhas ? '⭐ Mesyuarat Agung Khas (Semua Ahli & Penduduk)' : 'Notis Panggilan Mesyuarat'}
            </span>
            <span className="text-[10px] text-indigo-300 font-mono">No. Ruj: {activeNotice.referenceNo}</span>
          </div>

          <h3 className="text-sm sm:text-base font-black uppercase text-white leading-snug">
            {activeNotice.title}
          </h3>

          <div className="text-[11px] text-indigo-200 font-bold flex flex-wrap gap-x-4 gap-y-1.5 pt-1 border-t border-indigo-900/60">
            <span className="flex items-center gap-1.5"><Calendar size={13} className="text-amber-400" /> {activeNotice.meetingDate}</span>
            <span className="flex items-center gap-1.5"><Clock size={13} className="text-amber-400" /> {activeNotice.meetingTime}</span>
            <span className="flex items-center gap-1.5"><MapPin size={13} className="text-amber-400" /> {activeNotice.meetingVenue}</span>
          </div>
        </div>

        {/* Sign In Prompt Box */}
        <div className="bg-white border border-slate-100 p-8 rounded-3xl text-center space-y-6 shadow-md">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <LogIn className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Log Masuk Diperlukan Sebelum Mengisi Kehadiran
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-bold">
              {isNoticeAgungKhas ? (
                <>
                  Mesyuarat ini adalah <strong className="text-indigo-700">MESYUARAT AGUNG KHAS (SEMUA AHLI)</strong>. Sila log masuk dengan akaun Google anda terlebih dahulu sebelum mengisi kehadiran. <span className="text-emerald-700 font-black block mt-1">Walaupun anda belum mendaftar sebagai ahli rasmi persatuan, anda tetap boleh mengesahkan kehadiran.</span>
                </>
              ) : (
                <>
                  Sila log masuk dengan akaun Google anda terlebih dahulu untuk mengesahkan kehadiran anda dalam mesyuarat persatuan ini.
                </>
              )}
            </p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl text-xs font-semibold">
              {loginError}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button 
              onClick={handleGoogleLogin}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2.5 shadow-md shadow-indigo-100 hover:shadow-indigo-200"
            >
              <LogIn size={16} />
              Log Masuk Dengan Google
            </button>
            
            <button 
              onClick={onBack}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              Kembali ke Laman Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. User IS signed in, but NOT eligible (e.g. regular AJK meeting and user is not AJK)
  if (!isEligible()) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-100 p-8 rounded-3xl text-center space-y-6 shadow-md my-12 animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <Shield className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Akses Terhad (AJK Sahaja)</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            Notis panggilan mesyuarat aktif ini adalah dikhaskan untuk <strong>Ahli Jawatankuasa (AJK)</strong> sahaja. Hanya <strong>Mesyuarat Agung Khas (Semua Ahli)</strong> dibuka untuk pengesahan kehadiran semua penduduk/ahli.
          </p>
        </div>
        <button 
          onClick={onBack}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  // 5. Eligible! Render attendance form
  const isRegisteredMember = currentUserDoc && (currentUserDoc.role === 'Ahli Biasa' || currentUserDoc.role === 'Admin Utama' || currentUserDoc.isSuperAdmin || !['Pelawat', 'Tetamu', 'Penduduk'].includes(currentUserDoc.role));
  const currentDisplayName = currentUserDoc?.displayName || currentUserDoc?.nickname || firebaseUser?.displayName || 'Penduduk';
  const currentEmail = currentUserDoc?.email || firebaseUser?.email || '-';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
        <button 
          onClick={onBack}
          className="p-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-white text-slate-600 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">Pengesahan Kehadiran Mesyuarat</h2>
          <p className="text-xs text-slate-400 font-bold mt-0.5">Sila sahkan maklum balas dan status kehadiran anda ke mesyuarat persatuan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Notice Document details */}
        <div className="md:col-span-7 bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-3xs space-y-6 relative overflow-hidden">
          
          {/* Subtle design accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full translate-x-12 -translate-y-12 opacity-50" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex flex-wrap items-center gap-2 justify-between border-b border-slate-100 pb-4">
              <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-md ${
                isNoticeAgungKhas 
                  ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                  : 'bg-indigo-50 text-indigo-700'
              }`}>
                {isNoticeAgungKhas ? '⭐ Mesyuarat Agung Khas (Semua Ahli)' : 'Notis Panggilan Mesyuarat'}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase font-mono">
                No. Ruj: {activeNotice.referenceNo}
              </span>
            </div>

            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-base font-black text-slate-950 uppercase leading-snug">
                {activeNotice.title}
              </h3>
              <p className="text-[11px] text-emerald-700 font-extrabold uppercase tracking-wide">
                SEKOLAH MENENGAH AGAMA ULU JEMPOL
              </p>
            </div>

            <div className="border-t border-b border-slate-100/80 py-4 my-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700 font-bold">
              <div className="flex items-start gap-2">
                <Calendar size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Tarikh</span>
                  <span className="text-slate-800">{activeNotice.meetingDate}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Masa</span>
                  <span className="text-slate-800">{activeNotice.meetingTime}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Tempat</span>
                  <span className="text-slate-800 line-clamp-2" title={activeNotice.meetingVenue}>{activeNotice.meetingVenue}</span>
                </div>
              </div>
            </div>

            {/* Agendas list */}
            {activeNotice.agenda && activeNotice.agenda.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Bookmark size={12} className="text-indigo-500" /> Agenda Mesyuarat
                </h4>
                <ol className="text-xs text-slate-700 font-bold space-y-2 bg-slate-50/40 p-4 rounded-2xl border border-slate-100">
                  {activeNotice.agenda.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-indigo-600 shrink-0">{index + 1}.</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Prepared By signature block */}
            <div className="pt-6 border-t border-slate-100/80 text-xs font-bold text-slate-800 flex justify-end">
              <div className="text-right space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase block">Disediakan Oleh,</span>
                <p className="font-extrabold text-slate-900 border-b border-slate-200 pb-1 inline-block">{activeNotice.signatureName}</p>
                <p className="text-[10px] text-slate-500 font-bold block">{activeNotice.signatureRole}</p>
              </div>
            </div>

          </div>
        </div>

        {/* Right Response form */}
        <div className="md:col-span-5 bg-white border border-slate-100 p-6 md:p-8 rounded-3xl shadow-3xs space-y-5 h-fit">
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 uppercase tracking-wide">
              <UserCheck size={16} className="text-emerald-500" />
              Borang Pengesahan Kehadiran
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold">
              Sila pilih status kehadiran anda dan hantar maklum balas.
            </p>
          </div>

          {/* User Identity Card */}
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm uppercase shrink-0">
                {currentDisplayName.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-900 truncate uppercase">{currentDisplayName}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">{currentEmail}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/50">
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                isRegisteredMember 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-indigo-100 text-indigo-800'
              }`}>
                {isRegisteredMember ? (currentUserDoc?.role || 'Ahli Biasa') : 'Penduduk (Mesyuarat Agung Khas)'}
              </span>
              {currentUserDoc?.memberNo && (
                <span className="text-[8px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md">
                  No: {currentUserDoc.memberNo}
                </span>
              )}
            </div>

            {/* Special info for non-registered members in Mesyuarat Agung Khas */}
            {!isRegisteredMember && isNoticeAgungKhas && (
              <div className="bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl text-[10px] text-amber-800 font-bold leading-normal">
                ✨ Anda log masuk sebagai penduduk. Kehadiran anda ke Mesyuarat Agung Khas ini adalah sah dan dialu-alukan.
              </div>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-2xl flex items-center gap-2 text-[11px] font-bold animate-in fade-in duration-200">
              <AlertCircle size={14} className="text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-2xl flex items-center gap-2 text-[11px] font-bold animate-in fade-in duration-200">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {currentKehadiran ? (
            <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-black uppercase">
                <CheckCircle2 size={14} className="text-emerald-600" /> Kehadiran Disahkan
              </div>
              <p className="text-[11px] text-slate-700 font-bold">
                Status direkodkan:{' '}
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  currentKehadiran.status === 'Hadir' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-rose-100 text-rose-700'
                }`}>
                  {currentKehadiran.status}
                </span>
              </p>
              {currentKehadiran.reason && (
                <p className="text-[10px] text-slate-600 italic bg-white/80 p-2 rounded-lg border border-slate-150">
                  Alasan: {currentKehadiran.reason}
                </p>
              )}
              <p className="text-[9px] text-slate-400 font-semibold">
                Anda boleh mengemas kini pilihan anda pada borang di bawah sekiranya terdapat perubahan.
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl">
              <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                Anda belum memberikan sebarang maklum balas bagi mesyuarat ini. Sila pilih pilihan di bawah.
              </p>
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-4">
            
            {/* Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setStatus('Hadir');
                  setError(null);
                }}
                className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wide border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  status === 'Hadir'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-3xs ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <CheckCircle2 size={18} />
                <span>Hadir</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus('Tidak Hadir');
                  setError(null);
                }}
                className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wide border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  status === 'Tidak Hadir'
                    ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-3xs ring-2 ring-rose-500/20'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <XCircle size={18} />
                <span>Tidak Hadir</span>
              </button>
            </div>

            {/* Optional inputs for non-registered users (No Rumah & Phone) */}
            {!currentUserDoc?.noRumah && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">No. Rumah</label>
                  <div className="relative">
                    <Home size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Contoh: 158"
                      value={customNoRumah}
                      onChange={(e) => setCustomNoRumah(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">No. Telefon</label>
                  <div className="relative">
                    <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="019-XXXXXXX"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Conditionally show reason for absence */}
            {status === 'Tidak Hadir' && (
              <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Sebab Ketidakhadiran <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white resize-none focus:outline-hidden focus:border-indigo-500"
                  placeholder="Sila nyatakan sebab ketidakhadiran anda secara rasmi..."
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-black uppercase text-xs tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={14} />
              <span>{submitting ? 'Menghantar...' : currentKehadiran ? 'Kemas Kini Kehadiran' : 'Hantar Pengesahan Kehadiran'}</span>
            </button>
          </form>

        </div>

      </div>

      {/* Pop Up Minta User Daftar Sebagai Ahli */}
      {showRegisterPromptModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            
            {/* Top Accent bar */}
            <div className="h-2.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

            {/* Close Button */}
            <button
              onClick={() => setShowRegisterPromptModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>

            <div className="p-6 sm:p-7 text-center space-y-4">
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <UserPlus size={32} className="stroke-[2.2]" />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-200/60 inline-flex items-center gap-1">
                  <CheckCircle2 size={12} /> Kehadiran Berjaya Direkodkan
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                  Daftar Profil Warga Rasmi SMAUJ
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Terima kasih atas pengesahan kehadiran anda ke <b>{activeNotice?.title || 'Mesyuarat Agung Khas'}</b>. 
                </p>
              </div>

              {/* Informative message box */}
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-700">
                <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed font-semibold">
                  🏡 <strong>1 Rumah 1 Pendaftaran Sahaja:</strong> Cukup seorang wakil mendaftar bagi setiap rumah, dan semua nama dalam <em>Senarai Isi Rumah</em> akan secara automatik menjadi ahli sah persatuan.
                </div>
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Sertai keahlian rasmi Persatuan Penduduk untuk:
                </p>
                <div className="space-y-1.5 text-[11px] font-medium text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                    <span>Hak mengundi & menyuarakan usul dalam persatuan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    <span>Akses penuh penyata kewangan & program kejiranan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
                    <span>Skim Khairat Kematian & faedah komuniti berdaftar</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleGoToDaftarAhli}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-200/60 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <UserPlus size={16} />
                  <span>Daftar Ahli Sekarang</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowRegisterPromptModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Nanti Dahulu / Tutup
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

