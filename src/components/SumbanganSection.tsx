import React, { useState, useEffect } from 'react';
import { 
  Heart, Check, AlertCircle, ShoppingCart, 
  Sparkles, ShieldCheck, User, Home, Phone, Mail, FileText,
  ArrowLeft, Share2, Copy, CheckCircle2, Landmark, HelpCircle,
  ExternalLink, Info, QrCode, MessageCircle
} from 'lucide-react';
import { AppUser } from '../context/AuthContext';
import { ImageFeePackage } from '../types';
import { SENARAI_JENIS_SUMBANGAN, DEFAULT_SUMBANGAN_ID } from './SumbanganModal';
import { YuranConfig } from '../utils/yuranConfigHelper';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface SumbanganSectionProps {
  currentUserDoc?: AppUser | null;
  firebaseUser?: any;
  yuranConfig?: YuranConfig;
  onAddToCart?: (pkg: ImageFeePackage) => void;
  onBack?: () => void;
  isMobile?: boolean;
}

export default function SumbanganSection({
  currentUserDoc,
  firebaseUser,
  yuranConfig,
  onAddToCart,
  onBack,
  isMobile = false
}: SumbanganSectionProps) {
  const isLoggedIn = Boolean(firebaseUser && !firebaseUser.isAnonymous);

  // Live Bank & System Config (diambil daripada Konfigurasi Akaun Bank & QR Manual di Admin Panel)
  const [liveConfig, setLiveConfig] = useState<YuranConfig | null>(yuranConfig || null);

  useEffect(() => {
    if (yuranConfig) {
      setLiveConfig(yuranConfig);
    }
  }, [yuranConfig]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system', 'yuranConfig'), (docSnap) => {
      if (docSnap.exists()) {
        setLiveConfig(docSnap.data() as YuranConfig);
      }
    }, (err) => console.warn("Ralat live yuranConfig di SumbanganSection:", err));
    return () => unsub();
  }, []);

  const bankName = liveConfig?.manualBankName?.trim() || yuranConfig?.manualBankName?.trim() || 'Bank Islam Malaysia Berhad (BIMB)';
  const accountName = liveConfig?.manualAccountName?.trim() || yuranConfig?.manualAccountName?.trim() || 'PIBG SEKOLAH MENENGAH AGAMA ULU JEMPOL';
  const accountNumber = liveConfig?.manualAccountNumber?.trim() || yuranConfig?.manualAccountNumber?.trim() || '05012010045678';
  const qrCodeUrl = liveConfig?.manualQrCodeUrl || yuranConfig?.manualQrCodeUrl || '';

  // States - Default pilihan tabung adalah 'Sumbangan Ikhlas / Tabung Am' (DEFAULT_SUMBANGAN_ID)
  const [nama, setNama] = useState('');
  const [noRumah, setNoRumah] = useState('');
  const [noTelefon, setNoTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [jenisSumbanganId, setJenisSumbanganId] = useState(DEFAULT_SUMBANGAN_ID);
  const [nilai, setNilai] = useState<string>('50');
  const [catatan, setCatatan] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [bankCopied, setBankCopied] = useState(false);

  // Quick Amount presets
  const quickAmounts = [10, 30, 50, 100, 200, 500];

  // Autofill data if user is logged in
  useEffect(() => {
    if (isLoggedIn) {
      setNama(currentUserDoc?.displayName || currentUserDoc?.nickname || firebaseUser?.displayName || '');
      setNoRumah(currentUserDoc?.noRumah || '');
      setNoTelefon(currentUserDoc?.phoneNumber || '');
      setEmail(currentUserDoc?.email || firebaseUser?.email || '');
    }
  }, [isLoggedIn, currentUserDoc, firebaseUser]);

  const selectedFund = SENARAI_JENIS_SUMBANGAN.find(f => f.id === jenisSumbanganId) || SENARAI_JENIS_SUMBANGAN[0];
  const transferReference = (selectedFund as any).rujukanPemindahan || `${selectedFund.kategoriLejar.replace('Tabung ', '').toUpperCase()} SMAUJ`;

  // WhatsApp Bendahari (+60102537234) link generator
  const bendahariPhone = "60102537234";
  const donorDisplayName = nama.trim() || currentUserDoc?.displayName || currentUserDoc?.nickname || 'Hamba Allah';
  const donorHouseText = noRumah.trim() ? ` (No. Rumah/Kelas: ${noRumah.trim()})` : '';
  const chosenFundName = selectedFund?.nama || 'Sumbangan Pendidikan SMAUJ';
  const donationAmtText = (nilai && !isNaN(parseFloat(nilai)) && parseFloat(nilai) > 0) 
    ? ` sebanyak RM ${parseFloat(nilai).toFixed(2)}` 
    : '';

  const whatsappMessage = `Assalamualaikum Bendahari SMAUJ, saya ${donorDisplayName}${donorHouseText} ingin menghantar bukti resit sumbangan pindahan manual untuk ${chosenFundName} (Rujukan: ${transferReference})${donationAmtText}. Terima kasih.`;
  const whatsappBendahariUrl = `https://wa.me/${bendahariPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopyShareLink = () => {
    try {
      const shareUrl = `${window.location.origin}/sumbangan`;
      navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      console.warn("Gagal menyalin pautan:", err);
    }
  };

  const handleCopyBankNo = (accNo: string) => {
    try {
      navigator.clipboard.writeText(accNo.replace(/\s+/g, ''));
      setBankCopied(true);
      setTimeout(() => setBankCopied(false), 3000);
    } catch (err) {
      console.warn("Gagal menyalin no akaun:", err);
    }
  };

  const handleSelectFund = (fundId: string) => {
    setJenisSumbanganId(fundId);
    // Smooth scroll to form on mobile or small devices
    const formEl = document.getElementById('borang-sumbangan-smauj');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessToast(null);

    // Validation
    if (!nama.trim()) {
      setErrorMsg('Sila masukkan nama anda atau wakil penderma.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Sila masukkan alamat emel yang sah untuk penghantaran resit rasmi.');
      return;
    }
    if (!noTelefon.trim()) {
      setErrorMsg('Sila masukkan nombor telefon yang boleh dihubungi.');
      return;
    }

    const numValue = parseFloat(nilai);
    if (isNaN(numValue) || numValue <= 0) {
      setErrorMsg('Sila masukkan nilai sumbangan yang sah (minimum RM 1.00).');
      return;
    }

    // Build ImageFeePackage entry for Troli
    const donationUniqueId = `donation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const packageItem: ImageFeePackage = {
      id: donationUniqueId,
      name: selectedFund.nama,
      subtitle: `Sumbangan Ikhlas oleh ${nama.trim()}${noRumah ? ` (No. Rumah: ${noRumah.trim()})` : ''}`,
      price: numValue,
      priceLabel: `RM ${numValue.toFixed(2)}`,
      isPaid: false,
      category: 'Tambahan',
      realCategory: selectedFund.kategoriLejar,
      donorName: nama.trim(),
      donorEmail: email.trim().toLowerCase(),
      donorPhone: noTelefon.trim(),
      donorHouseNo: noRumah.trim() || undefined,
      donationFundId: selectedFund.id,
      donationFundName: selectedFund.nama,
      donationLedgerCategory: selectedFund.kategoriLejar,
      donationNotes: catatan.trim() || undefined,
      isDonation: true
    } as any;

    if (onAddToCart) {
      onAddToCart(packageItem);
    }

    setSuccessToast(`Sumbangan RM ${numValue.toFixed(2)} bagi "${selectedFund.nama}" telah dimasukkan ke Troli Bayaran.`);
    
    // Reset quick amount
    setCatatan('');
  };

  return (
    <div className={`w-full max-w-6xl mx-auto space-y-6 ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      
      {/* 1. TOP BREADCRUMB & SHARE ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>
          )}
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
            <Heart size={15} className="text-rose-500 fill-rose-500" />
            <span>Pusat Sumbangan Rasmi</span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">(/sumbangan)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              linkCopied 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Salin pautan terus /sumbangan untuk dikongsi ke WhatsApp"
          >
            {linkCopied ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
            <span>{linkCopied ? 'Pautan Disalin!' : 'Kongsi Pautan (/sumbangan)'}</span>
          </button>
        </div>
      </div>

      {/* 2. HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="absolute right-8 top-8 opacity-10 pointer-events-none">
          <Heart size={180} />
        </div>

        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-emerald-200 text-xs font-black uppercase tracking-wider">
            <Sparkles size={13} className="text-amber-300" />
            <span>Infaq, Sedekah & Tabung Kebajikan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Tabung Sumbangan Sekolah Menengah Agama Ulu Jempol
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-medium">
            Salurkan infaq, wakaf dan sumbangan ikhlas anda untuk memperkasakan pendidikan Islam, kebajikan murid tahfiz & asnaf, prasarana surau sekolah dan program kecemerlangan akademik SMAUJ demi melahirkan modal insan berakhlak mulia.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-bold text-emerald-200">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>Telus & Diaudit Rasmi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>Resit Digital Dijana</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>6 Pilihan Tabung Khusus</span>
            </div>
          </div>
        </div>
      </div>

      {/* TOAST JIKA BERJAYA TAMBAH KE TROLI */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs font-bold shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button 
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 text-[11px] font-black underline shrink-0 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 3. 6 TABUNG KHUSUS (GRID KAD) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Heart size={16} className="text-rose-500 fill-rose-500" />
              <span>Pilihan 6 Tabung Sumbangan Rasmi</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Pilih tabung yang ingin disalurkan untuk mengisi borang sumbangan di bawah.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SENARAI_JENIS_SUMBANGAN.map((fund) => {
            const isSelected = fund.id === jenisSumbanganId;
            const isVan = fund.id === 'van-jenazah';

            return (
              <div
                key={fund.id}
                onClick={() => handleSelectFund(fund.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                  isSelected 
                    ? isVan 
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20' 
                      : 'border-teal-600 bg-teal-50/70 shadow-md ring-2 ring-teal-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-2xl">{fund.ikon}</span>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                      isVan 
                        ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {fund.badge}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                    {fund.nama}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-medium">
                    {fund.keterangan}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-400">Lejar: {fund.kategoriLejar}</span>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${
                      isSelected 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check size={12} className="stroke-[3]" />
                        <span>Dipilih</span>
                      </>
                    ) : (
                      <span>Pilih Tabung</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. BORANG SUMBANGAN & FPX / TROLI */}
      <div id="borang-sumbangan-smauj" className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Borang Butiran Sumbangan ({selectedFund.nama})
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Sila lengkapkan maklumat di bawah untuk dimasukkan ke troli bayaran dan menerima resit rasmi.
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Tabung Terpilih:</span>
            <span className="text-xs font-black text-amber-300">{selectedFund.nama}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* User login status indicator */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
            isLoggedIn 
              ? 'bg-emerald-50/70 border-emerald-200/60 text-emerald-900' 
              : 'bg-amber-50/70 border-amber-200/60 text-amber-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className={isLoggedIn ? 'text-emerald-600' : 'text-amber-600'} />
              <div>
                <span className="font-extrabold block">
                  {isLoggedIn ? 'Akaun Berdaftar Warga/PIBG SMAUJ (Maklumat Automatik)' : 'Sumbangan Awam / Tetamu (Bukan Warga Berdaftar)'}
                </span>
                <span className="text-[11px] opacity-80 font-medium">
                  {isLoggedIn 
                    ? 'Maklumat profil anda telah dimuatkan secara automatik.' 
                    : 'Anda boleh menyumbang tanpa perlu mendaftar warga terlebih dahulu. Sila lengkapkan borang di bawah.'}
                </span>
              </div>
            </div>
          </div>

          {/* MAKLUMAT PENDERMA */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <User size={14} className="text-emerald-600" />
              <span>1. Maklumat Penderma</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Nama Penuh */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                  Nama Penuh / Nama Penderma <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: En. Ahmad bin Abu / Hamba Allah"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              {/* No Rumah */}
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                  No. Rumah (Pilihan Penduduk Taman)
                </label>
                <div className="relative">
                  <Home size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Contoh: No. 12 (Kosongkan jika bukan penduduk)"
                    value={noRumah}
                    onChange={(e) => setNoRumah(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              {/* No Telefon */}
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                  No. Telefon / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 012-3456789"
                    value={noTelefon}
                    onChange={(e) => setNoTelefon(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              {/* Emel */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                  Alamat Emel (Untuk Penghantaran Resit Digital) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="Contoh: ahmad@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* NILAI SUMBANGAN & PRESET CHIPS */}
          <div className="space-y-3 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Heart size={14} className="text-rose-500" />
                <span>2. Nilai Sumbangan (RM)</span> <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-bold">Ringgit Malaysia (MYR)</span>
            </div>

            {/* Input Nilai */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">
                RM
              </span>
              <input
                type="number"
                step="1"
                min="1"
                required
                placeholder="0.00"
                value={nilai}
                onChange={(e) => setNilai(e.target.value)}
                className="w-full pl-16 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-black text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Pilihan Pantas:</span>
              {quickAmounts.map((amt) => {
                const isActive = parseFloat(nilai) === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNilai(amt.toString())}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs scale-105'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    RM {amt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CATATAN / DOA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                3. Catatan / Hajat / Doa Penderma (Pilihan)
              </label>
              <span className="text-[10px] text-slate-400 font-bold">Tidak Wajib</span>
            </div>
            <div className="relative">
              <FileText size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <textarea
                rows={2}
                placeholder="Contoh: Infaq jariah atas nama almarhum ibu bapa / semoga urusan pengurusan persatuan dipermudahkan..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors resize-none"
              />
            </div>
          </div>

          {/* BUTTON SUBMIT KE TROLI */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              className="w-full sm:flex-1 py-3.5 px-6 bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-98"
            >
              <ShoppingCart size={18} />
              <span>Tambah ke Troli Bayaran (RM {parseFloat(nilai || '0').toFixed(2)})</span>
            </button>
          </div>
        </form>
      </div>

      {/* 5. MAKLUMAT AKAUN BANK PERSATUAN (DIRECT TRANSFER) - Disembunyikan sementara sehingga diberitahu */}
      {/* Setkan flag false buat masa ini */}
      {false && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Landmark size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Pindahan Terus Melalui Perbankan Dalam Talian
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Anda juga boleh membuat pindahan terus ke akaun rasmi persatuan di bawah:
                </p>
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${qrCodeUrl ? 'lg:grid-cols-3' : 'md:grid-cols-2'} gap-4 pt-1`}>
            {/* Kad Akaun Bank Rasmi (Dinamik daripada Konfigurasi Akaun Bank & QR Manual di Admin Panel) */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-amber-900 tracking-wider">Akaun Rasmi Persatuan</span>
                  <span className="text-[11px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">{bankName}</span>
                </div>
                <p className="text-xs font-extrabold text-slate-800 mt-2 uppercase">
                  {accountName}
                </p>
                <div className="mt-1 flex items-center gap-2 font-mono text-base font-black text-slate-900">
                  <span>{accountNumber}</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between gap-1 flex-wrap">
                  <span className="font-bold">Rujukan Pemindahan:</span>
                  <span className="font-black text-amber-950 font-mono bg-white px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs">
                    {transferReference}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopyBankNo(accountNumber)}
                className="w-full py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Copy size={13} />
                <span>{bankCopied ? 'No. Akaun Berjaya Disalin!' : 'Salin No. Akaun'}</span>
              </button>
            </div>

            {/* Kad Kod QR DuitNow (Jika dimuat naik oleh Admin) */}
            {qrCodeUrl && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col items-center justify-between space-y-2.5 text-center">
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-black uppercase tracking-wider mb-2">
                    <QrCode size={12} />
                    <span>Kod QR DuitNow</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-emerald-200/80 shadow-2xs inline-block">
                    <img
                      src={qrCodeUrl}
                      alt="Kod QR DuitNow Rasmi Persatuan"
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-emerald-800 font-bold leading-tight">
                  Imbas untuk bayaran pantas guna MAE, CIMB, Bank Islam, TNG eWallet atau sebarang aplikasi bank.
                </p>
              </div>
            )}

            {/* Notis Pengesahan & Butang WhatsApp Bendahari */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3 text-xs text-slate-600 font-medium">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-900 font-extrabold mb-0.5">
                  <Info size={14} className="text-indigo-600" />
                  <span>Pengesahan & Resit Manual</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Bagi pindahan terus ke akaun bank persatuan, sila hantarkan resit pemindahan kepada pihak Bendahari melalui WhatsApp untuk pengesahan rekod lejar dan penerbitan resit rasmi.
                </p>
              </div>

              {/* Butang WhatsApp Bendahari (+60102537234) */}
              <a
                href={whatsappBendahariUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs shadow-emerald-500/20 active:scale-98 cursor-pointer group"
              >
                <MessageCircle size={15} className="fill-white/20 stroke-[2.5] group-hover:scale-110 transition-transform" />
                <span>Hantar Resit ke WhatsApp Bendahari</span>
              </a>

              <div className="pt-2 text-[10px] text-slate-400 font-bold border-t border-slate-200/60 flex items-center justify-between">
                <span className="font-mono text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  +6010-253 7234
                </span>
                <span>Diaudit & Telus</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
