import React, { useState } from 'react';
import { Heart, Download, CheckCircle2, Mail, Sparkles, X, Share2 } from 'lucide-react';
import { generateDonationReceiptPdf, DonationReceiptData } from '../utils/donationReceiptPdf';
import { AppUser } from '../context/AuthContext';

interface DonationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  donationData: DonationReceiptData | null;
  allUsers?: AppUser[];
}

export const DonationSuccessModal: React.FC<DonationSuccessModalProps> = ({
  isOpen,
  onClose,
  donationData,
  allUsers
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !donationData) return null;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await generateDonationReceiptPdf(donationData, allUsers, true);
    } catch (err) {
      console.error("Gagal menjana resit sumbangan:", err);
      alert("Gagal memuat turun resit sumbangan. Sila cuba sebentar lagi.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-emerald-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 relative text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* BUTANG TUTUP ATAS */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer z-10"
          title="Tutup"
        >
          <X size={18} />
        </button>

        {/* HEADER DENGAN ILUSTRASI HATI & KEBERKATAN */}
        <div className="bg-linear-to-b from-emerald-50 via-teal-50/50 to-white pt-8 pb-4 px-6">
          <div className="relative inline-block mb-3">
            <div className="w-20 h-20 rounded-full bg-linear-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-200 mx-auto animate-bounce-short">
              <Heart size={38} className="fill-white stroke-[2.5]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-white shadow-sm">
              <Sparkles size={14} className="fill-white" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[10px] font-black uppercase tracking-wider mb-2">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>Sumbangan Berjaya Diterima</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Terima Kasih Atas Sumbangan Anda!
          </h2>
          <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto mt-1 leading-relaxed">
            Semoga Allah SWT memberkati dan melipatgandakan rezeki serta mengurniakan ganjaran jariah yang berkekalan buat anda sekeluarga.
          </p>
        </div>

        {/* RINGKASAN SUMBANGAN CARD */}
        <div className="px-6 py-4 space-y-3.5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No. Resit Sumbangan</span>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {donationData.receiptNo}
              </span>
            </div>

            <div className="flex justify-between items-start text-xs">
              <span className="text-slate-500 font-bold">Tabung Sumbangan:</span>
              <span className="text-slate-900 font-black text-right max-w-[60%]">
                {donationData.fundType}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold">Penderma:</span>
              <span className="text-slate-800 font-extrabold">{donationData.donorName}</span>
            </div>

            <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2">
              <span className="text-slate-900 font-black">Jumlah Sumbangan:</span>
              <span className="text-base font-black text-emerald-600">
                RM {donationData.amount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* NOTA PENGHANTARAN EMEL */}
          <div className="bg-emerald-50/80 border border-emerald-200/70 rounded-2xl p-3.5 flex items-start gap-3 text-left">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
              <Mail size={16} />
            </div>
            <div className="text-[11px] leading-relaxed text-emerald-900">
              <p className="font-extrabold">Salinan Resit Dihantar ke Emel Anda</p>
              <p className="text-emerald-700 font-medium">
                Resit rasmi sumbangan ini telah dihantar secara automatik ke alamat emel <strong className="underline">{donationData.donorEmail}</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* TINDAKAN / BUTANG */}
        <div className="p-6 pt-2 space-y-2.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full py-3 px-5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <Download size={16} />
            <span>{isDownloading ? 'Menjana PDF...' : 'Muat Turun Resit Sumbangan (PDF)'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
          >
            Kembali ke Halaman Utama
          </button>
        </div>
      </div>
    </div>
  );
};
