import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, X, User, ArrowRight, Download, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginPromptModalProps {
  currentView?: string;
  currentTab?: string;
}

export default function LoginPromptModal({ currentView, currentTab }: LoginPromptModalProps = {}) {
  const { firebaseUser, loginWithGoogle, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        return true;
      }
    }
    return false;
  });
  const [showInstructions, setShowInstructions] = useState(false);

  // Check if user is currently on /kehadiran page/route
  const isKehadiranPage = Boolean(
    currentView === 'kehadiran' ||
    currentTab === 'kehadiran' ||
    (typeof window !== 'undefined' && (
      window.location.pathname.toLowerCase().replace(/\/+$/, '') === '/kehadiran' ||
      window.location.pathname.toLowerCase().startsWith('/kehadiran/')
    ))
  );

  useEffect(() => {
    // If auth is still loading, wait
    if (loading) return;

    // Do NOT show popup on /kehadiran page
    if (isKehadiranPage) {
      setIsOpen(false);
      return;
    }

    // Check if user is logged in (not anonymous or has valid cached session)
    let hasCachedGoogleUser = false;
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('tmf2_cached_firebase_user');
      if (cached) {
        try {
          const u = JSON.parse(cached);
          if (u && !u.isAnonymous && u.uid && u.uid !== 'guest_local') {
            hasCachedGoogleUser = true;
          }
        } catch (e) {}
      }
    }

    const isUserLoggedIn = (firebaseUser && !firebaseUser.isAnonymous && firebaseUser.uid !== 'guest_local') || hasCachedGoogleUser;

    // Check if dismissed in this session or explicitly
    const isDismissed = sessionStorage.getItem('tmf2_login_prompt_dismissed') === 'true' ||
                        localStorage.getItem('tmf2_login_prompt_dismissed') === 'true' ||
                        localStorage.getItem('tmf2_chose_tetamu') === 'true';

    if (!isUserLoggedIn && !isDismissed) {
      // Trigger modal open after a slightly longer delay (5 seconds) to allow the application data to fully load and render first
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setIsOpen(false);
    }
  }, [firebaseUser, loading, isKehadiranPage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
      }

      const handleBeforePrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleCustomBeforePrompt = (e: any) => {
        setDeferredPrompt(e.detail);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      };

      window.addEventListener('beforeinstallprompt', handleBeforePrompt);
      window.addEventListener('tmf2_beforeinstallprompt', handleCustomBeforePrompt as any);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
        window.removeEventListener('tmf2_beforeinstallprompt', handleCustomBeforePrompt as any);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem('tmf2_login_prompt_dismissed', 'true');
    localStorage.setItem('tmf2_login_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  const handleLogin = async () => {
    try {
      sessionStorage.setItem('tmf2_login_prompt_dismissed', 'true');
      setIsOpen(false);
      await loginWithGoogle();
    } catch (err) {
      console.error("Error logging in from prompt:", err);
    }
  };

  const handleInstallClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tmf2_trigger_install'));
    }
  };

  if (!isOpen || isKehadiranPage) return null;

  if (showInstructions) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInstructions(false)}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
          >
            <div className="h-2.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            {/* Back Button */}
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-4 left-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center"
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center"
              title="Tutup"
            >
              <X size={18} />
            </button>

            <div className="px-6 pt-8 pb-6 text-center">
              {/* Elegant Icon badge */}
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl flex items-center justify-center mb-5 text-indigo-600 shadow-inner">
                <Download size={28} className="stroke-[2.5]" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">
                Pasang Aplikasi SMAUJ
              </h3>

              {/* Content */}
              <div className="text-left space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 mt-4">
                {typeof window !== 'undefined' && window.self !== window.top ? (
                  <div className="space-y-3.5">
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs font-semibold leading-relaxed">
                      ⚠️ Anda sedang membuka aplikasi ini di dalam Google AI Studio (iframe). Pelayar web menyekat pemasangan aplikasi secara terus di dalam iframe.
                    </div>
                    <p className="font-semibold text-slate-700 text-xs sm:text-sm">
                      Sila buka aplikasi ini dalam tab baharu untuk memasang aplikasi PWA secara terus ke skrin utama anda:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(window.location.href, '_blank');
                        setShowInstructions(false);
                      }}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                    >
                      <span>Buka Dalam Tab Baharu & Pasang</span>
                      <ArrowRight size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="font-semibold text-slate-700 text-xs sm:text-sm">
                      Aplikasi ini menyokong Progressive Web App (PWA) untuk memberikan pengalaman seperti aplikasi mudah alih sebenar (laju, boleh dibuka terus di skrin utama & sokongan notifikasi).
                    </p>

                    {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5">
                        <p className="font-extrabold text-slate-800 text-xs">📱 Cara pemasangan di iOS / Safari:</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-slate-600 text-xs font-semibold">
                          <li>Tekan butang <span className="font-extrabold text-indigo-600">Kongsi (Share)</span> di bahagian bawah Safari.</li>
                          <li>Tatal ke bawah dan pilih <span className="font-extrabold text-indigo-600">'Tambah ke Skrin Utama' (Add to Home Screen)</span>.</li>
                          <li>Tekan <span className="font-extrabold text-indigo-600">'Tambah' (Add)</span> di bahagian atas kanan.</li>
                        </ol>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5">
                        <p className="font-extrabold text-slate-800 text-xs">💻 Pemasangan Manual:</p>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-600 text-xs font-semibold">
                          <li>Klik butang <span className="font-extrabold text-indigo-600">Pasang</span> di bahagian bar alamat URL pelayar web anda.</li>
                          <li>Atau buka menu pelayar (tiga titik di kanan atas) dan pilih <span className="font-extrabold text-indigo-600">'Pasang Aplikasi' (Install App)</span> atau <span className="font-extrabold text-indigo-600">'Tambah ke Skrin Utama'</span>.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Kembali ke Log Masuk
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
        >
          {/* Header Graphic Accent */}
          <div className="h-2.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>

          <div className="px-6 pt-8 pb-6 text-center">
            {/* Elegant Icon badge */}
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl flex items-center justify-center mb-5 text-indigo-600 shadow-inner">
              <LogIn size={28} className="stroke-[2.5]" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">
              Sila Log Masuk Portal SMAUJ
            </h3>

            {/* Subtitle / Description */}
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6">
              Selamat datang ke portal <b>Sekolah Menengah Agama Ulu Jempol (SMAUJ)</b>. Sila log masuk ke akaun anda untuk mengakses penuh ciri-ciri persekolahan:
            </p>

            {/* Bullet list of key locked features */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left border border-slate-100/80 space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Takwim & Laporan Aktiviti Sekolah</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Pembayaran Sumbangan PIBG & Yuran Secara Atas Talian</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Dokumen Rasmi & Penyata Kewangan Sekolah</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                <span>Ruang Sembang Komuniti Warga Sekolah</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleLogin}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-[#3f3ebd] hover:from-indigo-700 hover:to-[#3433a3] text-white text-sm font-extrabold rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <LogIn size={16} className="stroke-[2.5]" />
                <span>Log Masuk Google</span>
                <ArrowRight size={14} className="stroke-[2.5]" />
              </button>

              {!isInstalled && (
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-[#3f3ebd] text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-100 shadow-sm"
                >
                  <Download size={14} className="stroke-[2.5]" />
                  <span>Pasang Aplikasi (PWA)</span>
                </button>
              )}

              <button
                onClick={handleClose}
                className="w-full py-3 hover:bg-slate-100 text-slate-500 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <User size={14} />
                <span>Teruskan sebagai Pelawat / Tetamu</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
