import React, { useState, useEffect } from 'react';
import { 
  Heart, X, Check, AlertCircle, ShoppingCart, 
  Sparkles, ShieldCheck, User, Home, Phone, Mail, FileText
} from 'lucide-react';
import { AppUser } from '../context/AuthContext';
import { ImageFeePackage } from '../types';

export interface SumbanganItemData {
  nama: string;
  noRumah?: string;
  noTelefon: string;
  email: string;
  jenisSumbangan: string;
  kategoriLejar: string;
  nilai: number;
  catatan?: string;
}

interface SumbanganModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserDoc?: AppUser | null;
  firebaseUser?: any;
  onAddToCart: (pkg: ImageFeePackage) => void;
}

export const DEFAULT_SUMBANGAN_ID = 'ikhlas-am';

// Jenis Tabung Sumbangan Rasmi SMAUJ & Pemetaannya ke Lejar Kewangan
export const SENARAI_JENIS_SUMBANGAN = [
  {
    id: 'ikhlas-am',
    nama: 'Sumbangan Ikhlas / Tabung Am Sekolah',
    kategoriLejar: 'Tabung Sumbangan Am',
    rujukanPemindahan: 'TABUNG AM SMAUJ',
    keterangan: 'Infaq umum tanpa peruntukan khusus untuk menyokong pentadbiran sekolah dan kebajikan murid.',
    ikon: '🤍',
    badge: 'Tabung Am'
  },
  {
    id: 'kebajikan-khairat',
    nama: 'Sumbangan Kebajikan & Asnaf Murid',
    kategoriLejar: 'Tabung Kebajikan Murid',
    rujukanPemindahan: 'KEBAJIKAN SMAUJ',
    keterangan: 'Bantuan kecemasan perubatan, pakaian seragam, tambang bas, anak yatim & kebajikan murid asnaf.',
    ikon: '🤝',
    badge: 'Kebajikan'
  },
  {
    id: 'surau-komuniti',
    nama: 'Sumbangan Pengimarahan Surau & Dakwah SMAUJ',
    kategoriLejar: 'Tabung Surau & Dakwah',
    rujukanPemindahan: 'SURAU SMAUJ',
    keterangan: 'Aktiviti solat hajat, qiamullail, ceramah agama, ihya Ramadhan & kelengkapan ibadah murid.',
    ikon: '🕌',
    badge: 'Ibadah'
  },
  {
    id: 'fasiliti-taman',
    nama: 'Sumbangan Pembangunan & Prasarana Sekolah',
    kategoriLejar: 'Tabung Pembangunan Fizikal',
    rujukanPemindahan: 'FASILITI SMAUJ',
    keterangan: 'Baik pulih kelas, makmal sains, asrama, pusat sumber, dewan dan infrastruktur digital sekolah.',
    ikon: '🏫',
    badge: 'Pembangunan'
  },
  {
    id: 'pendidikan',
    nama: 'Sumbangan Tabung Akademik & Peperiksaan',
    kategoriLejar: 'Tabung Akademik & SPM',
    rujukanPemindahan: 'AKADEMIK SMAUJ',
    keterangan: 'Program kecemerlangan SPM & KBD, modul pembelajaran intensif, bengkel teknik menjawab dan hadiah kecemerlangan.',
    ikon: '🎓',
    badge: 'Akademik'
  },
  {
    id: 'kecemasan-bencana',
    nama: 'Sumbangan Tabung Kecemasan & Bencana',
    kategoriLejar: 'Tabung Kecemasan',
    rujukanPemindahan: 'KECEMASAN SMAUJ',
    keterangan: 'Bantuan segera menghadapi kerosakan ribut, banjir, atau musibah mengejut warga sekolah.',
    ikon: '🚨',
    badge: 'Kecemasan'
  }
];

export const SumbanganModal: React.FC<SumbanganModalProps> = ({
  isOpen,
  onClose,
  currentUserDoc,
  firebaseUser,
  onAddToCart
}) => {
  const isLoggedIn = Boolean(firebaseUser && !firebaseUser.isAnonymous);

  // States
  const [nama, setNama] = useState('');
  const [noRumah, setNoRumah] = useState('');
  const [noTelefon, setNoTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [jenisSumbanganId, setJenisSumbanganId] = useState(DEFAULT_SUMBANGAN_ID);
  const [nilai, setNilai] = useState<string>('30');
  const [catatan, setCatatan] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Autofill data jika pengguna log masuk
  useEffect(() => {
    if (isOpen) {
      if (isLoggedIn) {
        setNama(currentUserDoc?.displayName || currentUserDoc?.nickname || firebaseUser?.displayName || '');
        setNoRumah(currentUserDoc?.noRumah || '');
        setNoTelefon(currentUserDoc?.phoneNumber || '');
        setEmail(currentUserDoc?.email || firebaseUser?.email || '');
      } else {
        setNama('');
        setNoRumah('');
        setNoTelefon('');
        setEmail('');
      }
      setJenisSumbanganId(DEFAULT_SUMBANGAN_ID);
      setNilai('30');
      setCatatan('');
      setErrorMsg('');
    }
  }, [isOpen, isLoggedIn, currentUserDoc, firebaseUser]);

  if (!isOpen) return null;

  const selectedFund = SENARAI_JENIS_SUMBANGAN.find(f => f.id === jenisSumbanganId) || SENARAI_JENIS_SUMBANGAN[0];
  const quickAmounts = [10, 30, 50, 100, 200, 500];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validasi
    if (!nama.trim()) {
      setErrorMsg('Sila masukkan nama anda.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Sila masukkan alamat emel yang sah untuk penerimaan resit rasmi.');
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

    // Bina entri ImageFeePackage unik untuk Troli
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
      // Metadata khusus sumbangan
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

    onAddToCart(packageItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. HEADER MODAL */}
        <div className="bg-linear-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-5 sm:p-6 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner shrink-0">
              <Heart size={24} className="fill-white/20 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-emerald-100 text-[10px] font-black uppercase tracking-wider mb-1">
                <Sparkles size={11} className="text-amber-300" />
                <span>Infaq & Sedekah Jariah</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight leading-tight">
                Borang Sumbangan & Infaq Sekolah
              </h2>
              <p className="text-xs text-emerald-100/90 font-medium">
                Sekolah Menengah Agama Ulu Jempol (SMAUJ)
              </p>
            </div>
          </div>
        </div>

        {/* 2. KANDUNGAN BORANG (SCROLLABLE) */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-bold animate-in shake">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STATUS LOG MASUK BADGE */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
            isLoggedIn 
              ? 'bg-emerald-50/70 border-emerald-200/60 text-emerald-900' 
              : 'bg-amber-50/70 border-amber-200/60 text-amber-900'
          }`}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={isLoggedIn ? 'text-emerald-600' : 'text-amber-600'} />
              <div>
                <span className="font-extrabold block">
                  {isLoggedIn ? 'Pengguna Berdaftar (Log Masuk)' : 'Sumbangan Awam / Tetamu'}
                </span>
                <span className="text-[11px] opacity-80">
                  {isLoggedIn ? 'Maklumat anda telah diisi secara automatik.' : 'Sila masukkan maklumat peribadi anda secara manual di bawah.'}
                </span>
              </div>
            </div>
          </div>

          {/* BAHAGIAN 1: MAKLUMAT PENDERMA */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <User size={14} className="text-emerald-600" />
              <span>Maklumat Penderma</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nama Penuh */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Nama Penuh / Nama Penderma <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad bin Abu / Hamba Allah"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              {/* No Rumah (HANYA MUNCUL JIKA LOG MASUK) */}
              {isLoggedIn && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    No. Rumah Penduduk <span className="text-emerald-600">(Ahli)</span>
                  </label>
                  <div className="relative">
                    <Home size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cth: No. 12"
                      value={noRumah}
                      onChange={(e) => setNoRumah(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* No Telefon */}
              <div className={`space-y-1 ${!isLoggedIn ? 'sm:col-span-1' : ''}`}>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  No. Telefon <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 012-3456789"
                    value={noTelefon}
                    onChange={(e) => setNoTelefon(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              {/* Alamat Emel */}
              <div className={`space-y-1 ${!isLoggedIn ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Alamat Emel (Untuk Resit Rasmi) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="Contoh: nama@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BAHAGIAN 2: PILIHAN JENIS TABUNG SUMBANGAN */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Heart size={14} className="text-emerald-600" />
                <span>Pilih Jenis Tabung Sumbangan</span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold">6 Tabung Khusus</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SENARAI_JENIS_SUMBANGAN.map((fund) => {
                const isSelected = fund.id === jenisSumbanganId;
                const isVan = fund.id === 'van-jenazah';

                return (
                  <button
                    key={fund.id}
                    type="button"
                    onClick={() => setJenisSumbanganId(fund.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? isVan 
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-600/20' 
                          : 'border-teal-600 bg-teal-50/70 shadow-sm ring-2 ring-teal-600/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-base">{fund.ikon}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isVan 
                            ? 'bg-emerald-200/70 text-emerald-900 border border-emerald-300' 
                            : 'bg-slate-200/70 text-slate-800'
                        }`}>
                          {fund.badge}
                        </span>
                      </div>
                      <p className="text-xs font-black text-slate-900 leading-snug">
                        {fund.nama}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        {fund.keterangan}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[9px] font-extrabold">
                      <span className="text-slate-400">Lejar: {fund.kategoriLejar}</span>
                      {isSelected && (
                        <span className="text-emerald-700 flex items-center gap-0.5">
                          <Check size={12} className="stroke-[3]" />
                          Dipilih
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BAHAGIAN 3: NILAI SUMBANGAN & BUTANG CEPAT */}
          <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Nilai Sumbangan (RM) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-bold">Ringgit Malaysia</span>
            </div>

            {/* Kotak Input Nilai */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">
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
                className="w-full pl-14 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all text-left"
              />
            </div>

            {/* Butang Pantas (Quick Chips) */}
            <div className="flex flex-wrap gap-2 pt-1">
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
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    + RM {amt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BAHAGIAN 4: CATATAN / DOA (TIDAK WAJIB) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Catatan / Hajat / Doa Penderma
              </label>
              <span className="text-[9px] text-slate-400 font-bold">Pilihan (Tidak Wajib)</span>
            </div>
            <div className="relative">
              <FileText size={14} className="absolute left-3.5 top-3 text-slate-400" />
              <textarea
                rows={2}
                placeholder="Contoh: Infaq ikhlas atas nama arwah ibu bapa / semoga urusan persatuan dipermudahkan..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors resize-none"
              />
            </div>
          </div>

          {/* 3. FOOTER TINDAKAN */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-extrabold transition-all cursor-pointer order-2 sm:order-1"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-6 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2 order-1 sm:order-2 active:scale-98"
            >
              <ShoppingCart size={16} />
              <span>Tambah Sumbangan ke Troli (RM {parseFloat(nilai || '0').toFixed(2)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
