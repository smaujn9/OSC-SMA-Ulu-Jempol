import React from 'react';
import { X, Scale, AlertTriangle, ShieldCheck, FileText, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DisclaimerAktaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DisclaimerAktaModal({ isOpen, onClose }: DisclaimerAktaModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex justify-between items-center bg-slate-900 px-6 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
                <Scale size={20} />
              </div>
              <div>
                <h2 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  Terma Pengesahan & Perundangan Laporan Kes
                </h2>
                <p className="text-[10px] text-slate-400">Akta Undangan-Undang & Perlembagaan Persatuan PTMF2</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] text-slate-700 text-xs leading-relaxed">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-[11px] text-amber-900 font-medium">
                <strong>AMARAN KERAS:</strong> Sebarang laporan kes yang dibuat oleh Ahli Jawatankuasa (AJK) adalah bertujuan untuk rekod persatuan dan rujukan pihak berkuasa. Laporan yang mengandungi maklumat palsu, tohmahan tanpa bukti, atau niat jahat adalah kesalahan di bawah undang-undang Malaysia.
              </div>
            </div>

            {/* Section 182 Penal Code */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                <FileText size={16} className="text-rose-600" />
                <span>1. Seksyen 182 Kanun Keseksaan (Akta 574)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pl-6">
                <strong>Maklumat Palsu Kepada Penjawat Awam / Pengurusan Persatuan:</strong> Mana-mana individu yang memberi maklumat palsu dengan niat menyebabkan tindakan atau kegusaran undang-undang, jika disabitkan kesalahan boleh dihukum dengan:
              </p>
              <ul className="list-disc pl-11 text-[11px] text-rose-700 font-bold space-y-0.5">
                <li>Hukuman penjara sehingga 6 bulan, atau</li>
                <li>Denda sehingga RM2,000.00, atau kedua-duanya sekali.</li>
              </ul>
            </div>

            {/* Section 233 CMA 1998 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                <Lock size={16} className="text-indigo-600" />
                <span>2. Seksyen 233 Akta Komunikasi dan Multimedia 1998 (Akta 588)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pl-6">
                <strong>Penggunaan Tidak Wajar Kemudahan Rangkaian / Sistem Digital:</strong> Mana-mana orang yang membuat atau menyebarkan kandungan yang palsu, mengancam, atau jelik menerusi aplikasi atau sistem persatuan ini dengan niat menyakitkan hati, menganiaya, atau mengganggu orang lain, boleh dikenakan:
              </p>
              <ul className="list-disc pl-11 text-[11px] text-indigo-700 font-bold space-y-0.5">
                <li>Denda tidak melebihi RM50,000.00, atau</li>
                <li>Penjara selama tempoh tidak melebihi 1 tahun, atau kedua-duanya.</li>
              </ul>
            </div>

            {/* Constitution rules */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>3. Perlembagaan & Hak Akses Persatuan PTMF2</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pl-6">
                Hanya AJK sah dari Peringkat Admin Utama, Pengerusi, AJK hingga Juru Audit dibenarkan mendaftarkan kes. Sebarang salah guna platform ini akan menyebabkan <strong>penggantungan serta-merta hak akses AJK</strong> dan pemecatan keahlian jawatankuasa tertakluk kepada keputusan Mesyuarat Khas Jawatankuasa.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl cursor-pointer transition-colors shadow-sm"
            >
              Saya Fahami & Setuju
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
