import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, X, Loader2, ShieldAlert } from 'lucide-react';

export interface ConfirmLogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  isGuest?: boolean;
  userName?: string | null;
}

export const ConfirmLogoutModal: React.FC<ConfirmLogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  isGuest = false,
  userName
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        {/* Backdrop click */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isLoading ? undefined : onClose} 
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 p-6 text-slate-800"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition disabled:opacity-50 cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center space-y-4">
            {/* Logout Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
              <LogOut size={28} className="translate-x-0.5" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {isGuest ? 'Keluar Sesi Tetamu?' : 'Log Keluar dari Sistem?'}
              </h3>
              
              <div className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                {isGuest ? (
                  <p>
                    Anda sedang berada dalam sesi tetamu. Tindakan ini akan mengosongkan sesi dan membolehkan anda log masuk menggunakan akaun Google rasmi anda.
                  </p>
                ) : (
                  <p>
                    Adakah anda pasti mahu log keluar daripada akaun <span className="font-bold text-slate-900">{userName || 'anda'}</span>? Sesi anda akan ditamatkan secara selamat.
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <LogOut size={14} />
                    <span>{isGuest ? 'Keluar Sesi' : 'Ya, Log Keluar'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
