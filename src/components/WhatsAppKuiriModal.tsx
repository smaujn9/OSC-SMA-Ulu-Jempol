import React, { useState, useEffect } from 'react';
import { MembershipApplication } from '../context/AuthContext';
import { 
  X, MessageCircle, Send, Check, Copy, AlertCircle, HelpCircle, 
  CheckSquare, Square, FileText, User, Phone, Home, Sparkles, AlertTriangle, ArrowRight, Loader2
} from 'lucide-react';

export interface KuiriItemOption {
  id: string;
  label: string;
  detail: string;
}

export const DEFAULT_KUIRI_ITEMS: KuiriItemOption[] = [
  {
    id: 'nama_penuh',
    label: 'Nama Penuh tidak lengkap',
    detail: 'Nama penuh tidak lengkap (contohnya tiada bin/binti, singkatan atau tidak sama seperti dalam Kad Pengenalan).'
  },
  {
    id: 'isi_rumah',
    label: 'Maklumat Isi Rumah tidak dinyatakan',
    detail: 'Bilangan isi rumah atau senarai ahli isi rumah tidak dinyatakan / tidak lengkap.'
  },
  {
    id: 'no_ic',
    label: 'No. Kad Pengenalan tidak tepat',
    detail: 'Nombor Kad Pengenalan tidak tepat atau tidak mencukupi 12 digit tanpa tanda sengkang.'
  },
  {
    id: 'alamat_rumah',
    label: 'Nombor Rumah / Alamat Lorong tidak lengkap',
    detail: 'Nombor rumah (3 digit) atau alamat lorong/fasa kediaman tidak dinyatakan dengan jelas.'
  },
  {
    id: 'status_kediaman',
    label: 'Status Kediaman (Pemilik / Penyewa) tidak dinyatakan',
    detail: 'Status kediaman perlu dinyatakan dengan jelas sama ada sebagai Pemilik (Sendiri) atau Penyewa.'
  },
  {
    id: 'pemilik_penyewa',
    label: 'Maklumat Pemilik Kediaman (Penyewa) tidak lengkap',
    detail: 'Bagi kategori penyewa, nama pemilik rumah dan nombor telefon pemilik kediaman perlu dinyatakan.'
  },
  {
    id: 'no_telefon',
    label: 'Nombor Telefon / Maklumat Hubungan tidak tepat',
    detail: 'Nombor telefon bimbit tidak tepat atau sukar dihubungi untuk urusan pengesahan.'
  }
];

interface QuickTemplate {
  id: string;
  title: string;
  description: string;
  selectedItemIds: string[];
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 'nama_dan_isi_rumah',
    title: 'Nama Penuh & Isi Rumah Gagal',
    description: 'Nama penuh & maklumat isi rumah tidak dinyatakan',
    selectedItemIds: ['nama_penuh', 'isi_rumah']
  },
  {
    id: 'nama_penuh_sahaja',
    title: 'Nama Penuh Tidak Lengkap',
    description: 'Hanya isu ejaan nama / tiada bin/binti',
    selectedItemIds: ['nama_penuh']
  },
  {
    id: 'isi_rumah_sahaja',
    title: 'Isi Rumah Tidak Dinyatakan',
    description: 'Hanya isu bilangan / maklumat isi rumah',
    selectedItemIds: ['isi_rumah']
  },
  {
    id: 'ic_dan_alamat',
    title: 'IC & Alamat Tidak Tepat',
    description: 'No. Kad pengenalan atau nombor rumah perlu semakan',
    selectedItemIds: ['no_ic', 'alamat_rumah']
  },
  {
    id: 'status_kediaman_template',
    title: 'Status Kediaman (Pemilik / Penyewa)',
    description: 'Status sama ada Pemilik atau Penyewa tidak dinyatakan',
    selectedItemIds: ['status_kediaman']
  },
  {
    id: 'penyewa',
    title: 'Maklumat Pemilik (Penyewa)',
    description: 'Status penyewa tanpa info pemilik rumah',
    selectedItemIds: ['pemilik_penyewa']
  },
  {
    id: 'kustom',
    title: 'Pilihan Bebas / Kustom',
    description: 'Pilih sendiri item di bawah & tambah catatan',
    selectedItemIds: []
  }
];

interface WhatsAppKuiriModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: MembershipApplication | null;
  onConfirmKuiri?: (app: MembershipApplication, remarks: string, kuiriItems: string[]) => Promise<void>;
  canEdit?: boolean;
}

export default function WhatsAppKuiriModal({
  isOpen,
  onClose,
  application,
  onConfirmKuiri,
  canEdit = true
}: WhatsAppKuiriModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('nama_dan_isi_rumah');
  const [selectedItems, setSelectedItems] = useState<string[]>(['nama_penuh', 'isi_rumah']);
  const [additionalRemarks, setAdditionalRemarks] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (application) {
      // Default to the first template requested by user: Nama penuh + isi rumah
      setSelectedTemplateId('nama_dan_isi_rumah');
      setSelectedItems(['nama_penuh', 'isi_rumah']);
      setAdditionalRemarks(application.remarks && application.remarks !== 'Dalam Proses Semakan' && application.remarks !== 'Permohonan ditolak.' ? application.remarks : '');
      setCopied(false);
    }
  }, [application]);

  if (!isOpen || !application) return null;

  const handleTemplateSelect = (template: QuickTemplate) => {
    setSelectedTemplateId(template.id);
    setSelectedItems(template.selectedItemIds);
  };

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      
      // Update template id selection to custom if mismatch
      const matched = QUICK_TEMPLATES.find(t => 
        t.id !== 'kustom' && 
        t.selectedItemIds.length === next.length && 
        t.selectedItemIds.every(id => next.includes(id))
      );
      setSelectedTemplateId(matched ? matched.id : 'kustom');
      return next;
    });
  };

  // Build failed items list for the message
  const failedItemsList: string[] = selectedItems.map(id => {
    const found = DEFAULT_KUIRI_ITEMS.find(item => item.id === id);
    return found ? found.detail : '';
  }).filter(Boolean);

  const applicantName = application.name || 'Pemohon';
  const houseNo = application.noRumah || '-';

  // Construct message complying strictly with user requirements:
  // 1. Didahulukan dengan ayat terima kasih kerana mendaftar.
  // 2. Senarai item pendaftaran yang masih gagal (contoh Nama Penuh tidak lengkap, isi Rumah tidak dinyatakan).
  // 3. Ayat terakhir beritahu ini adalah mesej peringatan tidak perlu dibalas.
  const appPortalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://smauj.web.app';

  let itemsNumberedText = '';
  if (failedItemsList.length > 0) {
    itemsNumberedText = failedItemsList.map((detail, index) => `${index + 1}. *${DEFAULT_KUIRI_ITEMS.find(it => it.detail === detail)?.label || 'Item Pembetulan'}:*\n   ${detail}`).join('\n\n');
  } else {
    itemsNumberedText = '1. *Maklumat permohonan perlu dikemaskini mengikut garis panduan pendaftaran sekolah.*';
  }

  const remarksBlock = additionalRemarks.trim() 
    ? `\n\n📌 *Catatan Tambahan Pentadbir:*\n"${additionalRemarks.trim()}"` 
    : '';

  const generatedWhatsAppMessage = `Assalamualaikum & Salam Sejahtera *${applicantName}*,

Terima kasih kerana mendaftar profil bagi *Sekolah Menengah Agama Ulu Jempol (SMAUJ)*.

Permohonan pendaftaran anda bagi peranan/lokasi *${houseNo || 'Warga Sekolah'}* memerlukan tindakan semakan & kemaskini bagi item yang masih belum lengkap/gagal seperti berikut:

${itemsNumberedText}${remarksBlock}

👉 *Tindakan Anda:*
Sila layari Portal Sekolah SMAUJ di:
${appPortalUrl}
dan log masuk menggunakan akaun Google anda, kemudian buka menu *Daftar Profil* untuk mengemaskini maklumat permohonan anda dan klik *Hantar Semula Permohonan*.

_Peringatan: Ini adalah mesej peringatan secara automatik daripada Sistem Pengurusan Sekolah Menengah Agama Ulu Jempol (SMAUJ), tidak perlu dibalas. Terima kasih._`;

  const cleanPhone = (application.phone || '').replace(/\D/g, '');
  let formattedPhone = cleanPhone;
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '6' + formattedPhone;
  } else if (!formattedPhone.startsWith('60') && formattedPhone.length > 0) {
    formattedPhone = '60' + formattedPhone;
  }

  const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(generatedWhatsAppMessage)}`;

  const handleCopyMessage = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(generatedWhatsAppMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenWhatsAppOnly = () => {
    if (!formattedPhone) {
      alert('Nombor telefon pemohon tidak sah.');
      return;
    }
    window.open(waLink, '_blank');
  };

  const handleConfirmKuiriAndWhatsApp = async () => {
    if (!onConfirmKuiri) {
      handleOpenWhatsAppOnly();
      onClose();
      return;
    }

    const rawLabels = selectedItems.map(id => DEFAULT_KUIRI_ITEMS.find(i => i.id === id)?.label).filter((l): l is string => Boolean(l));
    const summaryItems = Array.from(new Set([...selectedItems, ...rawLabels]));
    const combinedRemarks = [
      rawLabels.length > 0 ? `Item Gagal: ${rawLabels.join(', ')}` : '',
      additionalRemarks.trim() ? additionalRemarks.trim() : ''
    ].filter(Boolean).join(' | ') || 'Permohonan dikuiri untuk pembetulan.';

    setIsSubmitting(true);
    try {
      await onConfirmKuiri(application, combinedRemarks, summaryItems);
      // Open WhatsApp
      if (formattedPhone) {
        window.open(waLink, '_blank');
      }
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal mengemaskini status kuiri.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveKuiriStatusOnly = async () => {
    if (!onConfirmKuiri) {
      onClose();
      return;
    }

    const rawLabels = selectedItems.map(id => DEFAULT_KUIRI_ITEMS.find(i => i.id === id)?.label).filter((l): l is string => Boolean(l));
    const summaryItems = Array.from(new Set([...selectedItems, ...rawLabels]));
    const combinedRemarks = [
      rawLabels.length > 0 ? `Item Gagal: ${rawLabels.join(', ')}` : '',
      additionalRemarks.trim() ? additionalRemarks.trim() : ''
    ].filter(Boolean).join(' | ') || 'Permohonan dikuiri untuk pembetulan.';

    setIsSubmitting(true);
    try {
      await onConfirmKuiri(application, combinedRemarks, summaryItems);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal mengemaskini status kuiri.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[999] animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <MessageCircle size={22} className="text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-400/25 border border-emerald-300/40 text-emerald-100 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Template WhatsApp & Kuiri
                </span>
                <span className="text-[10px] text-emerald-200/90 font-mono">SMAUJ</span>
              </div>
              <h3 className="font-black text-sm sm:text-base leading-tight mt-0.5">
                Hantar Kuiri Pendaftaran Ahli
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Recipient Details Pill */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-[200px]">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center uppercase text-xs border border-emerald-200 shrink-0">
                {applicantName.slice(0, 2)}
              </div>
              <div>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Pemohon</span>
                <p className="font-extrabold text-slate-900 text-sm leading-tight uppercase">{applicantName}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold mt-0.5 flex-wrap">
                  <span>Rumah: <strong className="text-slate-800">No. {houseNo}</strong></span>
                  <span>•</span>
                  <span>Panggilan: <strong className="text-indigo-700">{application.nickname || 'Belum Diisi'}</strong></span>
                  <span>•</span>
                  <span>IC: <strong className="text-slate-800 font-mono">{application.icNumber || '-'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700">
              <Phone size={13} className="text-emerald-600" />
              <span className="font-mono">{application.phone || 'Tiada No. Tel'}</span>
            </div>
          </div>

          {/* Quick Template Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                Pilih Template Pantas:
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Klik untuk auto-pilih item gagal</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleTemplateSelect(tmpl)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-55'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-black text-[11px] leading-tight block">
                        {tmpl.title}
                      </span>
                      {isSelected && <Check size={12} className="text-emerald-600 shrink-0" />}
                    </div>
                    <span className="text-[9px] text-slate-500 font-medium line-clamp-1">
                      {tmpl.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Item Checklist Selection */}
          <div className="space-y-2 bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
              Pilih Item Pendaftaran Yang Masih Gagal / Perlu Dibetulkan:
            </label>
            <div className="space-y-2 pt-1">
              {DEFAULT_KUIRI_ITEMS.map((item) => {
                const isChecked = selectedItems.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isChecked
                        ? 'bg-white border-amber-300 shadow-2xs'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-amber-600">
                      {isChecked ? <CheckSquare size={16} className="text-amber-600" /> : <Square size={16} className="text-slate-300" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-xs ${isChecked ? 'text-slate-900' : 'text-slate-700'}`}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Custom Remarks */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Catatan Tambahan Pentadbir (Pilihan):
            </label>
            <textarea
              rows={2}
              value={additionalRemarks}
              onChange={(e) => setAdditionalRemarks(e.target.value)}
              placeholder="Contoh: Sila semak semula ejaan nama pada kad pengenalan dan lampirkan senarai anak-anak..."
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Real-time WhatsApp Message Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-emerald-600" />
                Pratonton Mesej WhatsApp (Automatik):
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                title="Salin Teks WhatsApp"
              >
                {copied ? (
                  <>
                    <Check size={11} className="text-emerald-600" />
                    <span>Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Salin Mesej</span>
                  </>
                )}
              </button>
            </div>

            {/* WhatsApp Chat Preview Box */}
            <div className="bg-[#EFEAE2] p-3 sm:p-4 rounded-2xl border border-[#D9D2C7] shadow-inner relative overflow-hidden">
              {/* WhatsApp chat bubble */}
              <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-xs border border-emerald-100/60 text-[11px] leading-relaxed font-sans text-slate-800 space-y-2 whitespace-pre-wrap max-w-full">
                <div className="text-xs text-slate-800">{generatedWhatsAppMessage}</div>
                <div className="text-right text-[9px] text-slate-400 font-mono flex items-center justify-end gap-1">
                  <span>{new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</span>
                  <Check size={11} className="text-sky-500" />
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 italic">
              * Mesej ini didahulukan dengan ucapan terima kasih kerana mendaftar dan diakhiri dengan peringatan bahawa ia mesej peringatan tidak perlu dibalas mengikut ketetapan persatuan.
            </p>
          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            {canEdit && onConfirmKuiri && (
              <button
                type="button"
                onClick={handleSaveKuiriStatusOnly}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                title="Tukar status pemohon kepada KUIRI supaya pemohon boleh mengemaskini borang di portal"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin text-amber-700" /> : <HelpCircle size={14} className="text-amber-700" />}
                <span>Set Status KUIRI Sahaja</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenWhatsAppOnly}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="Buka WhatsApp terus ke nombor pemohon"
            >
              <MessageCircle size={14} className="text-emerald-600" />
              <span>Buka WhatsApp Sahaja</span>
            </button>

            {canEdit && onConfirmKuiri && (
              <button
                type="button"
                onClick={handleConfirmKuiriAndWhatsApp}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-200 hover:scale-[1.01] disabled:opacity-50"
                title="Tukar status ke KUIRI & terus buka WhatsApp"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Set KUIRI & Buka WhatsApp</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
