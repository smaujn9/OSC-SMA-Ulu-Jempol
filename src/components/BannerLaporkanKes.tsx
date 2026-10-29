import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { isDisiplinAuthorized } from '../utils/kesHelper';
import LaporkanKesModal from './LaporkanKesModal';
import PengurusanKesModal from './PengurusanKesModal';
import { ShieldAlert, ChevronRight, Lock, X, FileText, ShieldCheck, LogIn, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BannerLaporkanKesProps {
  isMobile?: boolean;
}

export default function BannerLaporkanKes({ isMobile = false }: BannerLaporkanKesProps) {
  const { firebaseUser, currentUserDoc, loginWithGoogle, loading } = useAuth();

  const isGoogleLoggedIn = Boolean(
    firebaseUser && 
    !firebaseUser.isAnonymous && 
    firebaseUser.uid !== 'guest_local' &&
    firebaseUser.email
  );

  const isAuthorized = isDisiplinAuthorized(currentUserDoc);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [showGoogleLoginModal, setShowGoogleGoogleLoginModal] = useState(false);
  const [pendingKesAction, setPendingKesAction] = useState<'register' | 'management' | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Main Action Handler for Opening Kes Modals
  const handleActionTrigger = useCallback((action: 'register' | 'management') => {
    // 1. Check if user is signed in with Google
    if (!isGoogleLoggedIn) {
      setPendingKesAction(action);
      setShowGoogleGoogleLoginModal(true);
      setShowAccessDeniedModal(false);
      return;
    }

    // 2. Check if user is Admin Utama or Guru
    if (!isAuthorized) {
      setShowAccessDeniedModal(true);
      setShowGoogleGoogleLoginModal(false);
      return;
    }

    // 3. User is Google-logged-in & Authorized (Admin Utama / Guru)
    setShowGoogleGoogleLoginModal(false);
    setShowAccessDeniedModal(false);
    if (action === 'register') {
      setIsRegisterOpen(true);
    } else {
      setIsManagementOpen(true);
    }
  }, [isGoogleLoggedIn, isAuthorized]);

  // Resume pending action after Google Login completes
  useEffect(() => {
    if (isGoogleLoggedIn && pendingKesAction) {
      const action = pendingKesAction;
      setPendingKesAction(null);
      setShowGoogleGoogleLoginModal(false);

      if (isAuthorized) {
        if (action === 'register') setIsRegisterOpen(true);
        if (action === 'management') setIsManagementOpen(true);
      } else {
        setShowAccessDeniedModal(true);
      }
    }
  }, [isGoogleLoggedIn, pendingKesAction, isAuthorized]);

  // Check URL paths and query params for Redirects & Direct Links
  const checkUrlForKesRoute = useCallback(() => {
    if (typeof window === 'undefined') return;

    const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
    const searchParams = new URLSearchParams(window.location.search);
    const actionParam = searchParams.get('action') || searchParams.get('modal') || searchParams.get('page') || searchParams.get('kes');

    // Registration routes/params
    const isRegisterRoute = 
      path === '/lapor-kes' || 
      path === '/pendaftaran-kes' || 
      path === '/daftar-kes' || 
      path === '/lapor-disiplin' ||
      path === '/kes-disiplin' ||
      actionParam === 'lapor-kes' || 
      actionParam === 'pendaftaran-kes' || 
      actionParam === 'lapor' || 
      actionParam === 'lapor-disiplin' ||
      actionParam === 'disiplin' ||
      actionParam === 'register';

    // Management/History routes/params
    const isManagementRoute = 
      path === '/pengurusan-kes' || 
      path === '/sejarah-kes' || 
      path === '/rekod-kes' || 
      path === '/senarai-kes' || 
      path === '/rekod-disiplin' ||
      path === '/pengurusan-disiplin' ||
      path === '/kes' || 
      actionParam === 'pengurusan-kes' || 
      actionParam === 'sejarah-kes' || 
      actionParam === 'rekod-kes' || 
      actionParam === 'pengurusan-disiplin' || 
      actionParam === 'rekod-disiplin' || 
      actionParam === 'pengurusan' || 
      actionParam === 'management';

    if (isRegisterRoute) {
      handleActionTrigger('register');
    } else if (isManagementRoute) {
      handleActionTrigger('management');
    }
  }, [handleActionTrigger]);

  // Listen to custom window events & URL changes
  useEffect(() => {
    const handleOpenPengurusan = () => handleActionTrigger('management');
    const handleOpenLapor = () => handleActionTrigger('register');

    window.addEventListener('tmf2_open_pengurusan_kes', handleOpenPengurusan);
    window.addEventListener('tmf2_open_lapor_kes', handleOpenLapor);
    window.addEventListener('popstate', checkUrlForKesRoute);

    // Initial check on load
    if (!loading) {
      checkUrlForKesRoute();
    }

    return () => {
      window.removeEventListener('tmf2_open_pengurusan_kes', handleOpenPengurusan);
      window.removeEventListener('tmf2_open_lapor_kes', handleOpenLapor);
      window.removeEventListener('popstate', checkUrlForKesRoute);
    };
  }, [handleActionTrigger, checkUrlForKesRoute, loading]);

  const handleBannerClick = () => {
    handleActionTrigger('register');
  };

  const handleGoogleLoginClick = async () => {
    try {
      setIsLoggingIn(true);
      await loginWithGoogle();
    } catch (err) {
      console.error("Ralat log masuk Google:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <div 
        onClick={handleBannerClick}
        className={`relative bg-gradient-to-br from-slate-900 via-rose-950 to-red-950 rounded-2xl ${
          isMobile ? 'p-4' : 'p-5'
        } overflow-hidden shadow-lg shadow-rose-950/20 cursor-pointer group border border-rose-800/40 transition-all hover:scale-[1.01] hover:border-rose-600/60 my-3`}
      >
        {/* Background Icon Watermark */}
        <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
          <ShieldAlert size={isMobile ? 65 : 85} className="text-rose-400 transform rotate-12" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full">
          <div className="space-y-1.5 text-white pr-8">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider rounded">
                Khusus Admin Utama & Guru
              </span>
              {(!isGoogleLoggedIn || !isAuthorized) && (
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 font-bold text-[9px] rounded flex items-center gap-1 border border-slate-700">
                  <Lock size={10} />
                  <span>Akses Terhad</span>
                </span>
              )}
            </div>

            <h3 className={`font-black ${isMobile ? 'text-sm' : 'text-lg'} flex items-center gap-2 text-white`}>
              <span>Laporkan Kes Disiplin</span>
              <ChevronRight size={isMobile ? 16 : 18} className="group-hover:translate-x-1 transition-transform text-rose-400" />
            </h3>

            <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium text-rose-100/90 leading-relaxed max-w-xl`}>
              Borang khas pendaftaran rekod salah laku & kes disiplin murid berasaskan prinsip 5W 1H oleh Guru dan Admin Utama untuk siasatan serta tindakan tatatertib sekolah.
            </p>
          </div>

          {/* Action Row for Authorized Staff (Admin Utama & Guru) */}
          {isGoogleLoggedIn && isAuthorized && (
            <div className="pt-3 flex items-center justify-between border-t border-rose-900/40 mt-3 text-[10px] sm:text-xs">
              <span className="text-rose-200/80 font-bold flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Status: Anda dibenarkan mendaftar kes disiplin</span>
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionTrigger('management');
                }}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-lg backdrop-blur-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <FileText size={12} />
                <span>Arkib & Rekod Kes ({currentUserDoc?.role || 'Guru'})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Laporkan Kes Modal */}
      <LaporkanKesModal 
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => {
          setIsRegisterOpen(false);
          setIsManagementOpen(true);
        }}
      />

      {/* Pengurusan Kes Modal */}
      <PengurusanKesModal 
        isOpen={isManagementOpen}
        onClose={() => setIsManagementOpen(false)}
        onOpenRegister={() => setIsRegisterOpen(true)}
      />

      {/* 1. Google Login Required Modal */}
      <AnimatePresence>
        {showGoogleLoginModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGoogleGoogleLoginModal(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs cursor-pointer"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-100 z-10 text-center"
            >
              <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-rose-500 to-red-600" />
              
              <button
                type="button"
                onClick={() => setShowGoogleGoogleLoginModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="p-6 space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-rose-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-indigo-100">
                  <LogIn size={32} className="stroke-[2.2]" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">
                    Log Masuk Google Diperlukan
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed px-2">
                    Akses ke <b>Borang & Pengurusan Kes Disiplin</b> memerlukan anda log masuk menggunakan <b>Akaun Google</b> terlebih dahulu untuk pengesahan peranan <b>Admin Utama</b> atau <b>Guru</b>.
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-left text-xs space-y-2 text-slate-700">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <ShieldAlert size={15} className="text-rose-500 shrink-0" />
                    <span>Syarat Kelayakan Akses Kes Disiplin:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 font-medium pl-1">
                    <li>Log masuk menggunakan akaun rasmi anda.</li>
                    <li>Sistem mengesahkan peranan anda sebagai <b>Admin Utama</b> atau <b>Guru</b>.</li>
                    <li>Borang Laporan Disiplin (5W 1H) dibuka untuk pengisian.</li>
                  </ol>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    disabled={isLoggingIn}
                    onClick={handleGoogleLoginClick}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-700 hover:to-rose-700 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <LogIn size={16} />
                    <span>{isLoggingIn ? 'Sedang Log Masuk...' : 'Log Masuk dengan Google'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGoogleGoogleLoginModal(false)}
                    className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Access Denied Modal for Non-Authorized Users */}
      <AnimatePresence>
        {showAccessDeniedModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAccessDeniedModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-rose-100 z-10 text-center space-y-4"
            >
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Lock size={28} />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-800">Akses Ditolak: Khusus Admin Utama & Guru</h3>
                
                {firebaseUser?.email && (
                  <div className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[11px] font-mono font-bold border border-slate-200">
                    Akaun: {firebaseUser.email} {currentUserDoc?.role ? `(${currentUserDoc.role})` : ''}
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Borang Pendaftaran & Pengurusan Kes Disiplin ini <b>hanya dibenarkan diisi dan diakses oleh pengguna dengan peranan Admin Utama dan Guru</b> sahaja bagi tujuan pemantauan disiplin, siasatan tatatertib, dan rekod Hal Ehwal Murid (HEM).
                </p>

                <p className="text-xs text-rose-700 font-bold pt-1">
                  Akaun anda semasa ini tidak mempunyai peranan Admin Utama atau Guru. Sila hubungi pihak pentadbiran sekolah sekiranya akaun anda memerlukan akses tersebut.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAccessDeniedModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl cursor-pointer transition-colors"
              >
                Saya Fahami
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
