import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendTelegramComplaint } from '../utils/telegramHelper';
import { X, Send, AlertCircle, CheckCircle2, Loader2, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ComplaintModal({ isOpen, onClose }: ComplaintModalProps) {
  const { firebaseUser, currentUserDoc } = useAuth();
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Default user values
  const defaultNama = currentUserDoc?.displayName || firebaseUser?.displayName || 'Tetamu';
  const defaultEmail = currentUserDoc?.email || firebaseUser?.email || 'Tiada Email';
  const defaultPhone = currentUserDoc?.phoneNumber || firebaseUser?.phoneNumber || 'Tiada No Telefon';
  const defaultNoRumah = currentUserDoc?.noRumah || 'Tiada No Rumah';

  // Reset form state on open/close
  useEffect(() => {
    if (isOpen) {
      setDetails('');
      setSubmitStatus('idle');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      setErrorMessage('Sila masukkan butiran aduan anda.');
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSubmitStatus('idle');

    try {
      await sendTelegramComplaint({
        nama: defaultNama,
        email: defaultEmail,
        phone: defaultPhone,
        noRumah: defaultNoRumah,
        details: details.trim()
      });
      setSubmitStatus('success');
      setDetails('');
    } catch (err: any) {
      console.error("Gagal menghantar aduan:", err);
      setErrorMessage(err.message || 'Ralat tidak dijangka berlaku.');
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex justify-between items-center bg-indigo-900 px-6 py-4 text-white">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="text-indigo-200" size={20} />
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight">Hantar Aduan Baru</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form / Status */}
          <div className="p-6 overflow-y-auto max-h-[80vh] space-y-4">
            {submitStatus === 'success' ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-8 text-center space-y-4"
              >
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={36} className="animate-bounce" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-slate-800">Aduan Berjaya Dihantar!</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Aduan anda telah berjaya direkodkan di dalam sistem dan disalurkan ke Telegram rasmi persatuan penduduk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                >
                  Selesai
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitStatus === 'error' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-medium"
                  >
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                    <div className="space-y-1">
                      <p className="font-bold">Gagal Menghantar Aduan</p>
                      <p className="text-[10px] leading-relaxed text-rose-600/90">{errorMessage}</p>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nama Penuh (Disabled) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Nama Penuh</label>
                    <input 
                      type="text" 
                      value={defaultNama}
                      disabled
                      className="w-full bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs px-3.5 py-2 rounded-xl cursor-not-allowed focus:outline-hidden"
                    />
                  </div>

                  {/* Email (Disabled) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Emel</label>
                    <input 
                      type="text" 
                      value={defaultEmail}
                      disabled
                      className="w-full bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs px-3.5 py-2 rounded-xl cursor-not-allowed focus:outline-hidden"
                    />
                  </div>

                  {/* No Telefon (Disabled) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">No. Telefon</label>
                    <input 
                      type="text" 
                      value={defaultPhone}
                      disabled
                      className="w-full bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs px-3.5 py-2 rounded-xl cursor-not-allowed focus:outline-hidden"
                    />
                  </div>

                  {/* No Rumah (Disabled) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">No. Rumah</label>
                    <input 
                      type="text" 
                      value={defaultNoRumah}
                      disabled
                      className="w-full bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs px-3.5 py-2 rounded-xl cursor-not-allowed focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Butiran Aduan (Editable Long Text) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                    Butiran Aduan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Sila nyatakan masalah, aduan atau cadangan anda secara terperinci di sini..."
                    className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-medium leading-relaxed resize-none shadow-xs"
                    required
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl cursor-pointer transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 hover:shadow-lg disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Menghantar...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Hantar Aduan</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
