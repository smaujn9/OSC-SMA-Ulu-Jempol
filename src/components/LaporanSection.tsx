import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Clock, Image, Layers, BookOpen, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Maximize2, X, ArrowUpRight, BarChart2, Sparkles, Loader2, Upload, Pencil, Trash2, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resizeImageToBlob, resizeImage, uploadImageToStorage } from '../utils/imageUtils';
import { useAuth } from '../context/AuthContext';
import { parseDateToMs } from '../utils/dateUtils';

export const convertToGoogleContentUrl = (url: string): string => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return '';
  }
  const trimmed = url.trim();
  if (trimmed.includes('googleusercontent.com') || trimmed.startsWith('data:') || trimmed.includes('firebasestorage.googleapis.com')) {
    return trimmed;
  }
  return `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(trimmed)}`;
};

interface LaporanSectionProps {
  programReports: any[];
  onAddProgramReport: (newReport: any) => void;
  onUpdateProgramReport?: (updatedReport: any) => void;
  onDeleteProgramReport?: (id: string) => void;
  isMobile: boolean;
  hasCommitteeAccess?: boolean;
}

const PRESET_IMAGE_PACKS = [
  {
    id: 'aktiviti',
    name: 'Set Aktiviti Sukaneka',
    images: [
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1489659639091-8b687bc4386e?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400'
    ]
  },
  {
    id: 'mesyuarat',
    name: 'Set Mesyuarat Komuniti',
    images: [
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=400'
    ]
  },
  {
    id: 'jamuan',
    name: 'Set Jamuan Raya & Makan-Makan',
    images: [
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=400'
    ]
  }
];

const MALAY_MONTHS = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
];

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTimeString = (offsetMinutes = 0) => {
  const d = new Date();
  if (offsetMinutes !== 0) {
    d.setMinutes(d.getMinutes() + offsetMinutes);
  }
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function LaporanSection({ 
  programReports, 
  onAddProgramReport, 
  onUpdateProgramReport, 
  onDeleteProgramReport, 
  isMobile,
  hasCommitteeAccess = true
}: LaporanSectionProps) {
  const { allUsers } = useAuth();
  
  // Tabs: 'dashboard' | 'borang'
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'borang'>('dashboard');

  // Year filter for statistics
  const [filterYear, setFilterYear] = useState<string>('Semua');
  // Month filter for program list below stats
  const [filterMonth, setFilterMonth] = useState<string>('Semua');

  // Form states
  const [namaProgram, setNamaProgram] = useState('');
  const [blogLabel, setBlogLabel] = useState<'Aktiviti' | 'Mesyuarat' | 'Jamuan'>('Aktiviti');
  const [tarikhMula, setTarikhMula] = useState(getTodayDateString());
  const [tarikhTamat, setTarikhTamat] = useState(getTodayDateString());
  const [masaBermula, setMasaBermula] = useState(getCurrentTimeString());
  const [masaTamat, setMasaTamat] = useState(getCurrentTimeString(120)); // current time + 2 hours
  const [tentatif, setTentatif] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tempat, setTempat] = useState('');

  // 4 image links
  const [images, setImages] = useState<string[]>(['', '', '', '']);
  const [uploading, setUploading] = useState<boolean[]>([false, false, false, false]);

  // UI States
  const [toast, setToast] = useState<string | null>(null);
  const [activeDetailReport, setActiveDetailReport] = useState<any | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Keyboard navigation for Lightbox Galeri Gambar (Next, Previous, Close)
  useEffect(() => {
    if (lightboxIndex === null || !activeDetailReport?.images?.length) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev !== null ? (prev + 1) % activeDetailReport.images.length : 0
        );
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev !== null ? (prev - 1 + activeDetailReport.images.length) % activeDetailReport.images.length : 0
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, activeDetailReport]);

  const capitalizeEachWord = (str: string) => {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  };

  const handlePrint = (report: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Sila benarkan tetingkap timbul (pop-ups) untuk mencetak laporan ini.');
      return;
    }

    const startD = new Date(report.startDate);
    const daysMalay = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
    const dayName = daysMalay[startD.getDay()];
    const formattedDate = `${startD.getDate()} ${MALAY_MONTHS[startD.getMonth()]} ${startD.getFullYear()} (${dayName})`;

    const formatTimeMalay = (timeStr: string) => {
      if (!timeStr) return '';
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr);
      if (isNaN(h)) return timeStr;
      const m = mStr || '00';
      let ampm = 'pagi';
      let displayH = h;
      if (h === 0) {
        displayH = 12;
        ampm = 'tengah malam';
      } else if (h === 12) {
        ampm = 'tengah hari';
      } else if (h > 12) {
        displayH = h - 12;
        if (h < 19) ampm = 'petang';
        else ampm = 'malam';
      } else if (h >= 11) {
        ampm = 'tengah hari';
      } else {
        ampm = 'pagi';
      }
      return `${displayH}.${m} ${ampm}`;
    };

    const formattedTime = report.startTime && report.endTime 
      ? `${formatTimeMalay(report.startTime)} – ${formatTimeMalay(report.endTime)}`
      : report.startTime 
        ? formatTimeMalay(report.startTime) 
        : 'Tidak dinyatakan';

    let tempat = report.venue;
    if (!tempat) {
      tempat = "Kawasan Kejiranan Fasa 2";
      if (report.label === 'Mesyuarat') {
        tempat = "Dewan Al-Ghazali / Surau SMAUJ";
      } else if (report.label === 'Jamuan') {
        tempat = "Kawasan Lapang Fasa 2";
      } else if (report.title.toLowerCase().includes('google meet') || report.title.toLowerCase().includes('online') || report.title.toLowerCase().includes('webinar')) {
        tempat = "Atas Talian (Google Meet)";
      }
    }

    let title1 = "Matlamat & Pelaksanaan Program";
    let title2 = "Impak & Keberhasilan Komuniti";

    if (report.label === 'Aktiviti') {
      title1 = "Penganjuran & Pelaksanaan Aktiviti";
      title2 = "Memperkasa Semangat Kejiranan";
    } else if (report.label === 'Mesyuarat') {
      title1 = "Perbincangan & Ketetapan Mesyuarat";
      title2 = "Muafakat & Keputusan Bersama";
    } else if (report.label === 'Jamuan') {
      title1 = "Sambutan & Kebersamaan Komuniti";
      title2 = "Eratkan Ukhuwah & Silaturahim";
    }

    const paragraphs = report.description.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
    let p1 = report.description;
    let p2 = "Program ini berjaya memupuk semangat kecemerlangan ilmu dan sahsiah dalam kalangan murid, mengeratkan ukhuwah antara guru dan ibu bapa serta menghargai peranan aktif sekolah.";

    if (paragraphs.length >= 2) {
      p1 = paragraphs.slice(0, Math.ceil(paragraphs.length / 2)).join('<br/><br/>');
      p2 = paragraphs.slice(Math.ceil(paragraphs.length / 2)).join('<br/><br/>');
    }

    // Strategic Timeline (Tentatif)
    const parseTentative = (tentativeText: string) => {
      if (!tentativeText) return [];
      const lines = tentativeText.split('\n').map(l => l.trim()).filter(Boolean);
      return lines.map(line => {
        const parts = line.split(/\s+-\s+|\s+–\s+|:\s+/);
        if (parts.length >= 2) {
          const time = parts[0].trim();
          const agenda = parts.slice(1).join(' - ').trim();
          return { time, agenda };
        }
        return { time: '', agenda: line };
      });
    };

    const parsedTentative = parseTentative(report.tentative);
    const tentativeRows = parsedTentative.length > 0
      ? parsedTentative.map((item, idx) => {
          const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-low';
          return `
            <tr class="${rowBg} border-b border-outline-variant/10 text-xs text-on-surface">
              <td class="px-4 py-2.5 font-bold text-primary whitespace-nowrap">${item.time || '-'}</td>
              <td class="px-4 py-2.5 font-semibold">${item.agenda}</td>
            </tr>
          `;
        }).join('')
      : `
        <tr class="bg-white border-b border-outline-variant/10 text-xs text-on-surface">
          <td class="px-4 py-3 text-center text-gray-400 font-bold" colspan="2">Sila rujuk keterangan program</td>
        </tr>
      `;

    // Reference ID
    const year = startD.getFullYear() || 2026;
    const refId = `Ref: ${year}-ADM-${report.id.substring(4, 7).toUpperCase() || '01'}`;

    // Showcase Images (Exactly 4 images)
    const img1 = report.images[0] || 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=400';
    const img2 = report.images[1] || 'https://images.unsplash.com/photo-1489659639091-8b687bc4386e?auto=format&fit=crop&q=80&w=400';
    const img3 = report.images[2] || 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=400';
    const img4 = report.images[3] || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400';

    const setiausaha = allUsers?.find(u => u.role === 'Setiausaha');
    const setiausahaName = setiausaha ? (setiausaha.displayName || setiausaha.name || "Setiausaha") : "Setiausaha";

    const htmlContent = `
<!DOCTYPE html>
<html class="light" lang="ms">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>One-Page Report (OPR) | ${report.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            "on-tertiary-fixed-variant": "#613f1c",
            "surface-container-low": "#f5f3f6",
            "on-secondary-fixed": "#261a00",
            "inverse-on-surface": "#f2f0f3",
            "on-secondary": "#ffffff",
            "on-surface-variant": "#43474d",
            "surface": "#faf9fb",
            "surface-container-high": "#e9e8ea",
            "surface-container-highest": "#e3e2e5",
            "surface-bright": "#faf9fb",
            "inverse-surface": "#2f3033",
            "tertiary-fixed-dim": "#eebd90",
            "on-error-container": "#93000a",
            "on-error": "#ffffff",
            "primary": "#000f22",
            "on-primary-fixed-variant": "#314865",
            "surface-container-lowest": "#ffffff",
            "on-tertiary-fixed": "#2d1600",
            "outline": "#74777e",
            "on-secondary-fixed-variant": "#5b4300",
            "error-container": "#ffdad6",
            "tertiary-fixed": "#ffdcbe",
            "on-primary-fixed": "#001c37",
            "on-primary": "#ffffff",
            "outline-variant": "#c4c6ce",
            "on-tertiary": "#ffffff",
            "background": "#faf9fb",
            "surface-variant": "#e3e2e5",
            "secondary-fixed-dim": "#fabd00",
            "on-primary-container": "#768dad",
            "surface-container": "#efedf0",
            "secondary": "#785900",
            "primary-fixed": "#d2e4ff",
            "error": "#ba1a1a",
            "tertiary-container": "#381d00",
            "on-tertiary-container": "#ae835a",
            "on-surface": "#1b1c1e",
            "secondary-fixed": "#ffdf9e",
            "inverse-primary": "#b0c8eb",
            "on-secondary-container": "#6c5000",
            "secondary-container": "#fdc003",
            "tertiary": "#1a0b00",
            "surface-dim": "#dbd9dc",
            "primary-fixed-dim": "#b0c8eb",
            "surface-tint": "#49607e",
            "primary-container": "#0a2540",
            "on-background": "#1b1c1e"
          },
          spacing: {
            "grid-gutter": "1.5rem"
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
    
    body {
      font-family: 'Hanken Grotesk', sans-serif;
      background-color: #faf9fb;
      color: #1b1c1e;
      -webkit-font-smoothing: antialiased;
    }
    
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined';
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
    }

    .executive-card {
      background-color: #f4f7fa; /* Ice Blue module layer */
      border-radius: 0.75rem;
      padding: 1.5rem;
      transition: all 0.3s ease;
    }

    .action-card {
      background-color: #ffffff;
      box-shadow: 0 4px 20px rgba(0, 15, 34, 0.08);
    }

    .accent-bar {
      height: 4px;
      width: 40px;
      background-color: #000f22;
      margin-bottom: 1rem;
    }

    .gold-accent {
      color: #785900;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    @media print {
      body {
        padding: 0 !important;
        margin: 0 !important;
        background-color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
      /* Keep standard two columns on A4 portrait page */
      .grid-cols-print {
        display: grid !important;
        grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
      }
      .col-span-print-5 {
        grid-column: span 5 / span 5 !important;
      }
      .col-span-print-7 {
        grid-column: span 7 / span 7 !important;
      }
    }
  </style>
</head>
<body class="p-4 md:p-10 bg-background min-h-screen">
  <!-- Container constraints to A4 dimensions on screen, natural fit in print -->
  <div class="w-[210mm] mx-auto bg-white p-6 md:p-10 rounded-2xl border border-outline-variant/30 shadow-lg min-h-[297mm] flex flex-col justify-between print:m-0 print:rounded-none print:shadow-none print:border-none">
    
    <!-- Top Action Row (Hidden during print) -->
    <div class="no-print flex justify-between items-center mb-6 pb-4 border-b border-outline-variant/30">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">print</span>
        <h1 class="text-sm font-bold text-primary">Pratinjau Cetakan One-Page Report (OPR)</h1>
      </div>
      <button onclick="window.print()" class="px-5 py-2 bg-primary text-white text-xs font-black rounded-lg hover:bg-slate-800 transition-all shadow-xs cursor-pointer flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px]">print</span>
        CETAK SEKARANG
      </button>
    </div>

    <!-- MAIN GRID LAYOUT -->
    <main class="grid grid-cols-1 md:grid-cols-12 gap-6 grid-cols-print">
      
      <!-- LEFT ASYMMETRIC COLUMN (col-span-5) -->
      <div class="md:col-span-5 space-y-6 col-span-print-5">
        
        <!-- HEADER MODULE -->
        <div class="executive-card space-y-4">
          <div class="flex items-center gap-3">
            <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo Persatuan" style="width: 48px; height: 48px; object-fit: cover;" class="rounded-full shadow-sm bg-white" />
            <div>
              <p class="text-[9px] font-extrabold text-primary tracking-widest uppercase opacity-70">ONE-PAGE REPORT (OPR)</p>
              <p class="text-xs font-black text-primary tracking-tight">SMAUJ LAPORAN RASMI</p>
            </div>
          </div>
          
          <hr class="border-outline-variant/30" />
          
          <div class="space-y-1.5">
            <p class="text-[10px] font-black tracking-widest text-on-surface-variant uppercase">NAMA PROGRAM</p>
            <h2 class="text-sm md:text-base font-extrabold text-primary leading-tight uppercase tracking-tight">${report.title}</h2>
            <div class="inline-block bg-primary-container text-white text-[9px] font-bold px-2 py-0.5 rounded mt-1">
              ${refId}
            </div>
          </div>
        </div>

        <!-- PARAMETERS LIST MODULE -->
        <div class="executive-card space-y-5">
          <h3 class="text-xs font-black text-primary tracking-widest uppercase">BUTIRAN AKTIVITI</h3>
          <ul class="space-y-4">
            <!-- Parameter 1: Tarikh -->
            <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
              <span class="material-symbols-outlined text-primary mt-0.5 text-lg">calendar_today</span>
              <div>
                <p class="text-[9px] font-black text-on-surface-variant uppercase">TARIKH & HARI</p>
                <p class="text-xs font-bold text-on-background">${formattedDate}</p>
              </div>
            </li>
            
            <!-- Parameter 2: Masa -->
            <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
              <span class="material-symbols-outlined text-primary mt-0.5 text-lg">schedule</span>
              <div>
                <p class="text-[9px] font-black text-on-surface-variant uppercase">MASA PROGRAM</p>
                <p class="text-xs font-bold text-on-background">${formattedTime}</p>
              </div>
            </li>
            
            <!-- Parameter 3: Tempat -->
            <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
              <span class="material-symbols-outlined text-primary mt-0.5 text-lg">location_on</span>
              <div>
                <p class="text-[9px] font-black text-on-surface-variant uppercase">TEMPAT</p>
                <p class="text-xs font-bold text-on-background">${tempat}</p>
              </div>
            </li>

            <!-- Parameter 4: Anjuran -->
            <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
              <span class="material-symbols-outlined text-primary mt-0.5 text-lg">groups</span>
              <div>
                <p class="text-[9px] font-black text-on-surface-variant uppercase">ANJURAN OLEH</p>
                <p class="text-xs font-bold text-on-background">Sekolah Menengah Agama Ulu Jempol (SMAUJ)</p>
              </div>
            </li>
          </ul>
        </div>

        <!-- PREPARED BY MODULE -->
        <div class="executive-card space-y-3">
          <p class="text-[9px] font-black tracking-widest text-on-surface-variant uppercase">Disediakan Oleh</p>
          <div class="space-y-1">
            <p class="text-xs font-extrabold text-primary">${setiausahaName}</p>
            <p class="text-[10px] text-gray-500 font-bold leading-none">Sekolah Menengah Agama Ulu Jempol, Batu Kikir</p>
          </div>
          <div class="pt-4 border-t border-outline-variant/30 flex items-center gap-1 text-[9px] text-gray-400 font-bold">
            <span class="material-symbols-outlined text-sm">verified</span>
            Sistem Laporan Berkomputer SMAUJ
          </div>
        </div>

      </div>

      <!-- RIGHT COLUMN (col-span-7) -->
      <div class="md:col-span-7 space-y-6 col-span-print-7">
        
        <!-- STRATEGIC TIMELINE (TENTATIF) -->
        <div class="bg-white rounded-xl border border-outline-variant/20 overflow-hidden shadow-xs">
          <div class="bg-primary px-4 py-3 flex items-center justify-between">
            <span class="text-white text-xs font-black tracking-widest uppercase">Atur Cara & Tentatif</span>
            <span class="material-symbols-outlined text-white text-lg">format_list_bulleted</span>
          </div>
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-surface-container-high text-primary uppercase text-[9px] font-black tracking-wider border-b border-outline-variant/20">
                <th class="px-4 py-2 w-1/4">Masa</th>
                <th class="px-4 py-2">Aktiviti / Agenda</th>
              </tr>
            </thead>
            <tbody>
              ${tentativeRows}
            </tbody>
          </table>
        </div>

        <!-- ACTIVITY SHOWCASE (IMAGES GRID) -->
        <div class="space-y-3">
          <h3 class="text-xs font-black text-primary tracking-widest uppercase flex items-center gap-1.5">
            <span class="material-symbols-outlined text-lg text-primary">photo_library</span>
            GAMBAR SEKITAR PROGRAM
          </h3>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
              <img src="${img1}" alt="Showcase 1" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
            </div>
            <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
              <img src="${img2}" alt="Showcase 2" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
            </div>
            <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
              <img src="${img3}" alt="Showcase 3" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
            </div>
            <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
              <img src="${img4}" alt="Showcase 4" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
            </div>
          </div>
        </div>

      </div>

    </main>

    <div style="page-break-inside: avoid; break-inside: avoid;">
      <!-- FULL WIDTH OUTCOME & IMPACT (TEXT CARDS) -->
      <div class="grid grid-cols-1 gap-4 mt-6">
      <!-- Card 1 -->
      <div class="bg-white border border-outline-variant/20 rounded-xl p-4 md:p-5 shadow-3xs">
        <div class="accent-bar"></div>
        <h4 class="text-xs md:text-sm font-black text-primary uppercase tracking-tight mb-2">${title1}</h4>
        <p class="text-xs text-on-surface-variant leading-relaxed font-medium">
          ${p1}
        </p>
      </div>

      <!-- Card 2 -->
      <div class="bg-white border border-outline-variant/20 rounded-xl p-4 md:p-5 shadow-3xs">
        <div class="accent-bar"></div>
        <h4 class="text-xs md:text-sm font-black text-primary uppercase tracking-tight mb-2">${title2}</h4>
        <p class="text-xs text-on-surface-variant leading-relaxed font-medium">
          ${p2}
        </p>
      </div>
    </div>

    <!-- Dark Footer Box (OPR Closure) -->
    <div class="mt-8 bg-primary text-white rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
      <div class="flex items-center gap-3">
        <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo Persatuan" style="width: 32px; height: 32px; object-fit: cover;" class="rounded-full bg-white p-0.5" />
        <div>
          <h5 class="text-xs font-black tracking-widest uppercase">SMAUJ LAPORAN RASMI (OPR)</h5>
          <p class="text-[10px] text-primary-fixed-dim font-bold mt-0.5">Sekolah Menengah Agama Ulu Jempol</p>
        </div>
      </div>
      <div class="text-left md:text-right">
        <p class="text-[10px] font-bold text-primary-fixed-dim flex items-center justify-start md:justify-end gap-1.5 mb-1"><span class="material-symbols-outlined text-[14px]">location_on</span> Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan</p>
        <p class="text-[10px] font-bold text-primary-fixed-dim flex items-center justify-start md:justify-end gap-1.5"><span class="material-symbols-outlined text-[14px]">mail</span> E-mel: <a href="mailto:smaujn9@gmail.com" class="text-white hover:underline">smaujn9@gmail.com</a></p>
      </div>
    </div>

    <!-- Footer of report (Always fits clean on A4) -->
      <footer class="mt-4 pt-4 border-t border-outline-variant/20 text-center flex justify-between items-center text-[9px] text-gray-400 font-bold">
        <p>© 2026 Sekolah Menengah Agama Ulu Jempol. Hak Cipta Terpelihara.</p>
        <p>Muka Surat 1 dari 1 (A4 Portrait)</p>
      </footer>
    </div>

  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintAll = () => {
    if (filteredByYearReports.length === 0) {
      alert('Tiada laporan untuk dicetak pada masa ini.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Sila benarkan tetingkap timbul (pop-ups) untuk mencetak laporan ini.');
      return;
    }

    const setiausaha = allUsers?.find(u => u.role === 'Setiausaha');
    const setiausahaName = setiausaha ? (setiausaha.displayName || setiausaha.name || "Setiausaha") : "Setiausaha";

    let allReportsHtml = `
      <div class="w-[210mm] mx-auto bg-primary p-6 md:p-10 rounded-2xl border border-outline-variant/30 shadow-lg h-[297mm] flex flex-col justify-center items-center text-center text-white relative overflow-hidden print-page print:m-0 print:rounded-none print:shadow-none print:border-none">
        <div class="absolute inset-0 opacity-5 mix-blend-overlay pointer-events-none" style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 20px 20px;"></div>
        
        <!-- Top Action Row (Hidden during print) -->
        <div class="no-print absolute top-6 right-6 z-50">
          <button onclick="window.print()" class="px-5 py-2 bg-white text-primary text-xs font-black rounded-lg hover:bg-slate-200 transition-all shadow-xs cursor-pointer flex items-center gap-2 border-2 border-primary-fixed-dim">
            <span class="material-symbols-outlined text-[16px]">print</span>
            CETAK SEMUA
          </button>
        </div>
        
        <div class="relative z-10 flex flex-col items-center mt-12">
          <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo Persatuan" style="width: 140px; height: 140px; object-fit: cover;" class="rounded-full shadow-2xl bg-white p-2 mb-10" />
          <p class="text-sm font-black tracking-widest text-primary-fixed-dim uppercase mb-4 opacity-90">Buku Laporan Tahunan</p>
          <h1 class="text-4xl md:text-5xl font-black uppercase tracking-tight leading-tight mb-8 drop-shadow-lg text-white">Laporan Rasmi<br/>Aktiviti Persekolahan</h1>
          <div class="w-16 h-1 bg-secondary-container mb-8 rounded-full"></div>
          <h2 class="text-lg md:text-xl font-bold text-primary-fixed-dim leading-snug">Sekolah Menengah Agama Ulu Jempol<br/>Batu Kikir, Negeri Sembilan</h2>
        </div>
        <div class="absolute bottom-12 left-0 w-full flex flex-col items-center z-10 text-primary-fixed-dim">
          <p class="text-xs font-bold uppercase tracking-widest mb-1">Tahun Laporan</p>
          <p class="text-2xl font-black uppercase mb-6 text-white">${filterYear === 'Semua' ? 'Keseluruhan' : filterYear}</p>
          <p class="text-[10px] font-bold uppercase tracking-widest">Disediakan Oleh: ${setiausahaName}</p>
        </div>
      </div>
    `;

    filteredByYearReports.forEach((report, index) => {
      const startD = new Date(report.startDate);
      const daysMalay = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
      const dayName = daysMalay[startD.getDay()];
      const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
      const formattedDate = `${startD.getDate()} ${MALAY_MONTHS[startD.getMonth()]} ${startD.getFullYear()} (${dayName})`;

      const formatTimeMalay = (timeStr) => {
        if (!timeStr) return '';
        const [hStr, mStr] = timeStr.split(':');
        const h = parseInt(hStr);
        if (isNaN(h)) return timeStr;
        const m = mStr || '00';
        let ampm = 'pagi';
        let displayH = h;
        if (h === 0) { displayH = 12; ampm = 'tengah malam'; }
        else if (h === 12) { ampm = 'tengah hari'; }
        else if (h > 12) { displayH = h - 12; if (h < 19) ampm = 'petang'; else ampm = 'malam'; }
        else if (h >= 11) { ampm = 'tengah hari'; }
        else { ampm = 'pagi'; }
        return `${displayH}.${m} ${ampm}`;
      };

      const formattedTime = report.startTime && report.endTime 
        ? `${formatTimeMalay(report.startTime)} – ${formatTimeMalay(report.endTime)}`
        : report.startTime 
          ? formatTimeMalay(report.startTime) 
          : 'Tidak dinyatakan';

      let tempat = report.venue;
      if (!tempat) {
        tempat = "Kawasan Kejiranan Fasa 2";
        if (report.label === 'Mesyuarat') { tempat = "Balai Raya Persatuan / Atas Talian"; }
        else if (report.label === 'Jamuan') { tempat = "Kawasan Lapang Fasa 2"; }
        else if (report.title.toLowerCase().includes('google meet') || report.title.toLowerCase().includes('online') || report.title.toLowerCase().includes('webinar')) { tempat = "Atas Talian (Google Meet)"; }
      }

      let title1 = "Matlamat & Pelaksanaan Program";
      let title2 = "Impak & Keberhasilan Komuniti";
      if (report.label === 'Aktiviti') {
        title1 = "Penganjuran & Pelaksanaan Aktiviti";
        title2 = "Memperkasa Semangat Kejiranan";
      } else if (report.label === 'Mesyuarat') {
        title1 = "Perbincangan & Ketetapan Mesyuarat";
        title2 = "Muafakat & Keputusan Bersama";
      } else if (report.label === 'Jamuan') {
        title1 = "Sambutan & Kebersamaan Komuniti";
        title2 = "Eratkan Ukhuwah & Silaturahim";
      }

      const paragraphs = report.description.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      let p1 = report.description;
      let p2 = "Program ini berjaya memupuk semangat kebersamaan dalam komuniti, mengeratkan hubungan antara jiran serta menghargai peranan aktif persatuan.";
      if (paragraphs.length >= 2) {
        p1 = paragraphs.slice(0, Math.ceil(paragraphs.length / 2)).join('<br/><br/>');
        p2 = paragraphs.slice(Math.ceil(paragraphs.length / 2)).join('<br/><br/>');
      }

      const parseTentative = (tentativeText) => {
        if (!tentativeText) return [];
        const lines = tentativeText.split('\n').map(l => l.trim()).filter(Boolean);
        return lines.map(line => {
          const parts = line.split(/\s+-\s+|\s+–\s+|:\s+/);
          if (parts.length >= 2) {
            const time = parts[0].trim();
            const agenda = parts.slice(1).join(' - ').trim();
            return { time, agenda };
          }
          return { time: '', agenda: line };
        });
      };
      const parsedTentative = parseTentative(report.tentative);
      const tentativeRows = parsedTentative.length > 0
        ? parsedTentative.map((item, idx) => {
            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-low';
            return `<tr class="${rowBg} border-b border-outline-variant/10 text-xs text-on-surface">
                <td class="px-4 py-2.5 font-bold text-primary whitespace-nowrap">${item.time || '-'}</td>
                <td class="px-4 py-2.5 font-semibold">${item.agenda}</td>
              </tr>`;
          }).join('')
        : `<tr class="bg-white border-b border-outline-variant/10 text-xs text-on-surface">
            <td class="px-4 py-3 text-center text-gray-400 font-bold" colspan="2">Sila rujuk keterangan program</td>
          </tr>`;

      const year = startD.getFullYear() || 2026;
      const refId = `Ref: ${year}-ADM-${report.id.substring(4, 7).toUpperCase() || '01'}`;

      const img1 = report.images[0] || 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=400';
      const img2 = report.images[1] || 'https://images.unsplash.com/photo-1489659639091-8b687bc4386e?auto=format&fit=crop&q=80&w=400';
      const img3 = report.images[2] || 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=400';
      const img4 = report.images[3] || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400';

      allReportsHtml += `
        <div class="page-break w-[210mm] mx-auto bg-white p-6 md:p-10 rounded-2xl border border-outline-variant/30 shadow-lg min-h-[297mm] flex flex-col justify-between mt-8 print-page print:m-0 print:rounded-none print:shadow-none print:border-none">
          
          <main class="grid grid-cols-1 md:grid-cols-12 gap-6 grid-cols-print">
            <div class="md:col-span-5 space-y-6 col-span-print-5">
              <div class="executive-card space-y-4">
                <div class="flex items-center gap-3">
                  <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo Persatuan" style="width: 48px; height: 48px; object-fit: cover;" class="rounded-full shadow-sm bg-white" />
                  <div>
                    <p class="text-[9px] font-extrabold text-primary tracking-widest uppercase opacity-70">ONE-PAGE REPORT (OPR)</p>
                    <p class="text-xs font-black text-primary tracking-tight">PTMF2 LAPORAN RASMI</p>
                  </div>
                </div>
                <hr class="border-outline-variant/30" />
                <div class="space-y-1.5">
                  <p class="text-[10px] font-black tracking-widest text-on-surface-variant uppercase">NAMA PROGRAM</p>
                  <h2 class="text-sm md:text-base font-extrabold text-primary leading-tight uppercase tracking-tight">${report.title}</h2>
                  <div class="inline-block bg-primary-container text-white text-[9px] font-bold px-2 py-0.5 rounded mt-1">${refId}</div>
                </div>
              </div>

              <div class="executive-card space-y-5">
                <h3 class="text-xs font-black text-primary tracking-widest uppercase">BUTIRAN AKTIVITI</h3>
                <ul class="space-y-4">
                  <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
                    <span class="material-symbols-outlined text-primary mt-0.5 text-lg">calendar_today</span>
                    <div>
                      <p class="text-[9px] font-black text-on-surface-variant uppercase">TARIKH & HARI</p>
                      <p class="text-xs font-bold text-on-background">${formattedDate}</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
                    <span class="material-symbols-outlined text-primary mt-0.5 text-lg">schedule</span>
                    <div>
                      <p class="text-[9px] font-black text-on-surface-variant uppercase">MASA PROGRAM</p>
                      <p class="text-xs font-bold text-on-background">${formattedTime}</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
                    <span class="material-symbols-outlined text-primary mt-0.5 text-lg">location_on</span>
                    <div>
                      <p class="text-[9px] font-black text-on-surface-variant uppercase">TEMPAT</p>
                      <p class="text-xs font-bold text-on-background">${tempat}</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3 pb-3 border-b border-outline-variant/20">
                    <span class="material-symbols-outlined text-primary mt-0.5 text-lg">groups</span>
                    <div>
                      <p class="text-[9px] font-black text-on-surface-variant uppercase">ANJURAN OLEH</p>
                      <p class="text-xs font-bold text-on-background">Sekolah Menengah Agama Ulu Jempol (SMAUJ)</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div class="executive-card space-y-3">
                <p class="text-[9px] font-black tracking-widest text-on-surface-variant uppercase">Disediakan Oleh</p>
                <div class="space-y-1">
                  <p class="text-xs font-extrabold text-primary">${setiausahaName}</p>
                  <p class="text-[10px] text-gray-500 font-bold leading-none">Sekolah Menengah Agama Ulu Jempol, Batu Kikir</p>
                </div>
                <div class="pt-4 border-t border-outline-variant/30 flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                  <span class="material-symbols-outlined text-sm">verified</span> Sistem Laporan Berkomputer SMAUJ
                </div>
              </div>
            </div>

            <div class="md:col-span-7 space-y-6 col-span-print-7">
              <div class="bg-white rounded-xl border border-outline-variant/20 overflow-hidden shadow-xs">
                <div class="bg-primary px-4 py-3 flex items-center justify-between">
                  <span class="text-white text-xs font-black tracking-widest uppercase">Atur Cara & Tentatif</span>
                  <span class="material-symbols-outlined text-white text-lg">format_list_bulleted</span>
                </div>
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-surface-container-high text-primary uppercase text-[9px] font-black tracking-wider border-b border-outline-variant/20">
                      <th class="px-4 py-2 w-1/4">Masa</th>
                      <th class="px-4 py-2">Aktiviti / Agenda</th>
                    </tr>
                  </thead>
                  <tbody>${tentativeRows}</tbody>
                </table>
              </div>

              <div class="space-y-3">
                <h3 class="text-xs font-black text-primary tracking-widest uppercase flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-lg text-primary">photo_library</span> GAMBAR SEKITAR PROGRAM
                </h3>
                <div class="grid grid-cols-2 gap-2">
                  <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
                    <img src="${img1}" alt="Showcase 1" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
                  </div>
                  <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
                    <img src="${img2}" alt="Showcase 2" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
                  </div>
                  <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
                    <img src="${img3}" alt="Showcase 3" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
                  </div>
                  <div class="rounded-lg overflow-hidden border border-outline-variant/20 shadow-2xs h-28 bg-slate-50">
                    <img src="${img4}" alt="Showcase 4" class="w-full h-full object-cover" referrerPolicy="no-referrer"/>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <div style="page-break-inside: avoid; break-inside: avoid;">
            <div class="grid grid-cols-1 gap-4 mt-6">
            <div class="bg-white border border-outline-variant/20 rounded-xl p-4 md:p-5 shadow-3xs">
              <div class="accent-bar"></div>
              <h4 class="text-xs md:text-sm font-black text-primary uppercase tracking-tight mb-2">${title1}</h4>
              <p class="text-xs text-on-surface-variant leading-relaxed font-medium">${p1}</p>
            </div>
            <div class="bg-white border border-outline-variant/20 rounded-xl p-4 md:p-5 shadow-3xs">
              <div class="accent-bar"></div>
              <h4 class="text-xs md:text-sm font-black text-primary uppercase tracking-tight mb-2">${title2}</h4>
              <p class="text-xs text-on-surface-variant leading-relaxed font-medium">${p2}</p>
            </div>
          </div>

          <div class="mt-8 bg-primary text-white rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
            <div class="flex items-center gap-3">
              <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo Persatuan" style="width: 32px; height: 32px; object-fit: cover;" class="rounded-full bg-white p-0.5" />
              <div>
                <h5 class="text-xs font-black tracking-widest uppercase">SMAUJ LAPORAN RASMI (OPR)</h5>
                <p class="text-[10px] text-primary-fixed-dim font-bold mt-0.5">Sekolah Menengah Agama Ulu Jempol</p>
              </div>
            </div>
            <div class="text-left md:text-right">
              <p class="text-[10px] font-bold text-primary-fixed-dim flex items-center justify-start md:justify-end gap-1.5 mb-1"><span class="material-symbols-outlined text-[14px]">location_on</span> Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan</p>
              <p class="text-[10px] font-bold text-primary-fixed-dim flex items-center justify-start md:justify-end gap-1.5"><span class="material-symbols-outlined text-[14px]">mail</span> E-mel: smaujn9@gmail.com</p>
            </div>
          </div>

          <footer class="mt-4 pt-4 border-t border-outline-variant/20 text-center flex justify-between items-center text-[9px] text-gray-400 font-bold">
              <p>© 2026 Sekolah Menengah Agama Ulu Jempol. Hak Cipta Terpelihara.</p>
              <p>Muka Surat ${index + 1} dari ${filteredByYearReports.length}</p>
            </footer>
          </div>
        </div>
      `;
    });

    // Add Back Cover
    allReportsHtml += `
      <div class="page-break w-[210mm] mx-auto bg-primary p-6 md:p-10 rounded-2xl border border-outline-variant/30 shadow-lg h-[297mm] flex flex-col justify-center items-center text-center text-white relative overflow-hidden mt-8 print-page print:m-0 print:rounded-none print:shadow-none print:border-none">
        <div class="absolute inset-0 opacity-5 mix-blend-overlay pointer-events-none" style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 20px 20px;"></div>
        
        <div class="relative z-10 flex flex-col items-center">
          <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo Persatuan" style="width: 80px; height: 80px; object-fit: cover;" class="rounded-full shadow-lg bg-white p-1 mb-8 opacity-90 grayscale contrast-125" />
          <h2 class="text-2xl font-black uppercase tracking-widest text-primary-fixed-dim mb-4 drop-shadow-md">Tamat Laporan</h2>
          <p class="text-sm font-bold text-outline-variant mb-12 max-w-sm leading-relaxed">Terima kasih atas komitmen dan sokongan berterusan dalam memperkasakan komuniti kita.</p>
          
          <div class="space-y-3 text-xs font-bold text-primary-fixed-dim bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 w-full max-w-xs">
            <p class="flex items-center justify-center gap-2"><span class="material-symbols-outlined text-[16px]">location_on</span> Ulu Jempol, Batu Kikir</p>
            <p class="flex items-center justify-center gap-2"><span class="material-symbols-outlined text-[16px]">mail</span> smaujn9@gmail.com</p>
          </div>
        </div>
        <div class="absolute bottom-12 text-[10px] text-outline-variant font-bold uppercase tracking-widest">
           © 2026 SMAUJ. Hak Cipta Terpelihara.
        </div>
      </div>
    `;

    const htmlContent = `
<!DOCTYPE html>
<html class="light" lang="ms">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>Buku Laporan Tahunan | SMAUJ</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            "on-tertiary-fixed-variant": "#613f1c",
            "surface-container-low": "#f5f3f6",
            "on-secondary-fixed": "#261a00",
            "inverse-on-surface": "#f2f0f3",
            "on-secondary": "#ffffff",
            "on-surface-variant": "#43474d",
            "surface": "#faf9fb",
            "surface-container-high": "#e9e8ea",
            "surface-container-highest": "#e3e2e5",
            "surface-bright": "#faf9fb",
            "inverse-surface": "#2f3033",
            "tertiary-fixed-dim": "#eebd90",
            "on-error-container": "#93000a",
            "on-error": "#ffffff",
            "primary": "#000f22",
            "on-primary-fixed-variant": "#314865",
            "surface-container-lowest": "#ffffff",
            "on-tertiary-fixed": "#2d1600",
            "outline": "#74777e",
            "on-secondary-fixed-variant": "#5b4300",
            "error-container": "#ffdad6",
            "tertiary-fixed": "#ffdcbe",
            "on-primary-fixed": "#001c37",
            "on-primary": "#ffffff",
            "outline-variant": "#c4c6ce",
            "on-tertiary": "#ffffff",
            "background": "#faf9fb",
            "surface-variant": "#e3e2e5",
            "secondary-fixed-dim": "#fabd00",
            "on-primary-container": "#768dad",
            "surface-container": "#efedf0",
            "secondary": "#785900",
            "primary-fixed": "#d2e4ff",
            "error": "#ba1a1a",
            "tertiary-container": "#381d00",
            "on-tertiary-container": "#ae835a",
            "on-surface": "#1b1c1e",
            "secondary-fixed": "#ffdf9e",
            "inverse-primary": "#b0c8eb",
            "on-secondary-container": "#6c5000",
            "secondary-container": "#fdc003",
            "tertiary": "#1a0b00",
            "surface-dim": "#dbd9dc",
            "primary-fixed-dim": "#b0c8eb",
            "surface-tint": "#49607e",
            "primary-container": "#0a2540",
            "on-background": "#1b1c1e"
          },
          spacing: {
            "grid-gutter": "1.5rem"
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
    
    body {
      font-family: 'Hanken Grotesk', sans-serif;
      background-color: #faf9fb;
      color: #1b1c1e;
      -webkit-font-smoothing: antialiased;
    }
    
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined';
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
    }

    .executive-card {
      background-color: #f4f7fa;
      border-radius: 0.75rem;
      padding: 1.5rem;
      transition: all 0.3s ease;
    }

    .accent-bar {
      height: 4px;
      width: 40px;
      background-color: #000f22;
      margin-bottom: 1rem;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    @media print {
      body {
        padding: 0 !important;
        margin: 0 !important;
        background-color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
      .page-break:first-child {
        page-break-before: avoid;
      }
      .grid-cols-print {
        display: grid !important;
        grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
      }
      .col-span-print-5 {
        grid-column: span 5 / span 5 !important;
      }
      .col-span-print-7 {
        grid-column: span 7 / span 7 !important;
      }
      .print-page {
        margin-top: 0 !important;
        border: none !important;
        box-shadow: none !important;
        min-height: 100vh !important;
      }
    }
  </style>
</head>
<body class="p-4 md:p-10 bg-background min-h-screen">
  ${allReportsHtml}
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };


  const handleGenerateWithAI = async () => {
    if (!namaProgram.trim()) return;
    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/program/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: namaProgram,
          tarikhMula,
          tarikhTamat,
          masaBermula,
          masaTamat
        }),
      });
      if (!response.ok) {
        let errorMsg = 'Gagal menghubungi pelayan AI.';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.blogLabel) setBlogLabel(data.blogLabel);
      if (data.tarikhMula) setTarikhMula(data.tarikhMula);
      if (data.tarikhTamat) setTarikhTamat(data.tarikhTamat);
      if (data.masaBermula) setMasaBermula(data.masaBermula);
      if (data.masaTamat) setMasaTamat(data.masaTamat);
      if (data.tentatif) setTentatif(data.tentatif);
      if (data.keterangan) setKeterangan(data.keterangan);
      if (data.tempat) setTempat(data.tempat);

      const providerLabel = data.provider === 'gemini' 
        ? `Gemini AI (${data.modelUsed || 'Gemini Flash'})` 
        : `OpenRouter Fallback (${data.modelUsed || 'Gemini Flash 2.5'})`;
      setToast(`Selesai! Maklumat borang telah diisi secara automatik oleh ${providerLabel}. ✨`);
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Ralat semasa menjana maklumat program.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleStartEdit = (report: any) => {
    setNamaProgram(report.title);
    setBlogLabel(report.label || 'Aktiviti');
    setTarikhMula(report.startDate);
    setTarikhTamat(report.endDate);
    setMasaBermula(report.startTime);
    setMasaTamat(report.endTime);
    setTentatif(report.tentative);
    setKeterangan(report.description);
    setTempat(report.venue || '');
    
    const reportImages = [...(report.images || [])];
    while (reportImages.length < 4) {
      reportImages.push('');
    }
    setImages(reportImages);
    
    setEditingReportId(report.id);
    setActiveSubTab('borang');
    setActiveDetailReport(null);
  };

  const handleDeleteReport = async (id: string) => {
    if (onDeleteProgramReport) {
      try {
        await onDeleteProgramReport(id);
        setToast('Laporan Program berjaya dipadamkan! 🗑️');
        setTimeout(() => setToast(null), 3500);
      } catch (err) {
        console.error("Error deleting report:", err);
      }
    }
    setConfirmDeleteId(null);
    setActiveDetailReport(null);
  };

  // Auto-populate uploader with presets
  const applyPresetPack = (packId: string) => {
    const pack = PRESET_IMAGE_PACKS.find(p => p.id === packId);
    if (pack) {
      setImages([...pack.images]);
      setToast(`Gambar daripada "${pack.name}" telah diisi.`);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleImageChange = (index: number, val: string) => {
    const updated = [...images];
    updated[index] = val;
    setImages(updated);
  };

  const triggerFileSelect = (index: number) => {
    const el = document.getElementById(`file-input-${index}`);
    if (el) {
      el.click();
    }
  };

  const handleFileChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(prev => {
      const next = [...prev];
      next[index] = true;
      return next;
    });

    try {
      setToast('Sedang memproses & memuat naik gambar... ⏳');
      // 1. Upload compressed image directly to Firebase Storage
      const downloadURL = await uploadImageToStorage(file, 'reports', 600, 600, 0.5);
      
      // 2. Update form images array instantly with the storage download URL
      handleImageChange(index, downloadURL);
      setToast('Gambar berjaya dimuat naik ke Storage! ✨');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      console.error('Error processing image: ', err);
      alert('Gagal memproses gambar: ' + (err.message || err));
      setToast('Pemampatan/Muat naik gagal. Sila cuba lagi.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploading(prev => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
      // Clear input value so selecting the same file triggers change again
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!namaProgram.trim()) {
      alert('Sila masukkan Nama Program');
      return;
    }
    if (!tarikhMula) {
      alert('Sila pilih Tarikh Mula');
      return;
    }
    if (!tarikhTamat) {
      alert('Sila pilih Tarikh Tamat');
      return;
    }
    if (!masaBermula) {
      alert('Sila masukkan Masa Bermula');
      return;
    }
    if (!masaTamat) {
      alert('Sila masukkan Masa Tamat');
      return;
    }
    if (!tentatif.trim()) {
      alert('Sila masukkan Tentatif Program');
      return;
    }
    if (!keterangan.trim()) {
      alert('Sila masukkan Keterangan & Impak Program');
      return;
    }
    if (!tempat.trim()) {
      alert('Sila masukkan Tempat Program');
      return;
    }

    // Must have exactly 4 images filled and converted to Google Content Proxy format
    const filledImages = images.filter(img => img.trim() !== '').map(img => convertToGoogleContentUrl(img));
    if (filledImages.length < 4) {
      alert('Sila isi kesemua 4 keping gambar program (gunakan preset sedia ada untuk mempercepatkan proses!)');
      return;
    }

    if (editingReportId) {
      const updatedReport = {
        id: editingReportId,
        title: namaProgram,
        label: blogLabel,
        startDate: tarikhMula,
        endDate: tarikhTamat,
        startTime: masaBermula,
        endTime: masaTamat,
        tentative: tentatif,
        images: filledImages,
        description: keterangan,
        venue: tempat
      };
      if (onUpdateProgramReport) {
        onUpdateProgramReport(updatedReport);
      }
      setToast('Laporan Program berjaya dikemaskini! ✨');
    } else {
      const newReport = {
        id: `rep-${Date.now()}`,
        title: namaProgram,
        label: blogLabel,
        startDate: tarikhMula,
        endDate: tarikhTamat,
        startTime: masaBermula,
        endTime: masaTamat,
        tentative: tentatif,
        images: filledImages,
        description: keterangan,
        venue: tempat
      };
      onAddProgramReport(newReport);
      setToast('Laporan Program berjaya dihantar & diterbitkan di Blog Terkini! 🚀');
    }

    setTimeout(() => setToast(null), 4000);

    // Reset Form
    setNamaProgram('');
    setBlogLabel('Aktiviti');
    setTarikhMula(getTodayDateString());
    setTarikhTamat(getTodayDateString());
    setMasaBermula(getCurrentTimeString());
    setMasaTamat(getCurrentTimeString(120));
    setTentatif('');
    setKeterangan('');
    setTempat('');
    setImages(['', '', '', '']);
    setEditingReportId(null);

    // Go back to dashboard view to see the stats and report list
    setActiveSubTab('dashboard');
  };

  // Extract statistics
  const years = Array.from(
    new Set(
      programReports.map(rep => {
        const date = new Date(rep.startDate);
        return isNaN(date.getFullYear()) ? 2026 : date.getFullYear();
      })
    )
  ).sort((a, b) => b - a);

  // If no years or empty, default
  const availableYears = years.length > 0 ? years : [2026, 2025, 2024];

  // Filter reports according to selected year filter
  const filteredByYearReports = programReports.filter(rep => {
    if (filterYear === 'Semua') return true;
    const year = new Date(rep.startDate).getFullYear();
    return year.toString() === filterYear;
  });

  // Calculate monthly stats for the selected year
  // Array of 12 numbers representing count of reports for each month
  const monthlyCounts = Array(12).fill(0);
  filteredByYearReports.forEach(rep => {
    const month = new Date(rep.startDate).getMonth(); // 0 to 11
    if (month >= 0 && month < 12) {
      monthlyCounts[month] += 1;
    }
  });

  const maxMonthCount = Math.max(...monthlyCounts, 1);

  // Label distribution stats
  const labelCounts = { Aktiviti: 0, Mesyuarat: 0, Jamuan: 0 };
  filteredByYearReports.forEach(rep => {
    const label = rep.label as 'Aktiviti' | 'Mesyuarat' | 'Jamuan';
    if (labelCounts[label] !== undefined) {
      labelCounts[label] += 1;
    }
  });

  // Filter list of programs shown in table/cards by year and month
  const displayReports = programReports.filter(rep => {
    const repDate = new Date(rep.startDate);
    const repYearStr = repDate.getFullYear().toString();
    const repMonthIdx = repDate.getMonth();

    const matchYear = filterYear === 'Semua' || repYearStr === filterYear;
    const matchMonth = filterMonth === 'Semua' || repMonthIdx.toString() === filterMonth;

    return matchYear && matchMonth;
  }).sort((a, b) => parseDateToMs(b.startDate || b.tarikhProgram || b.createdAt) - parseDateToMs(a.startDate || a.tarikhProgram || a.createdAt));

  return (
    <div className="space-y-6 select-none text-slate-800">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileText size={20} />
            </span>
            Laporan & Statistik Program
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            Pengurusan pelaporan aktiviti, mesyuarat, dan program Sekolah Menengah Agama Ulu Jempol.
          </p>
        </div>

        {/* Tab Controls: Dashboard vs Borang */}
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
          >
            <BarChart2 size={14} />
            Statistik & Arkib
          </button>
          {hasCommitteeAccess && (
            <button
              onClick={() => setActiveSubTab('borang')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'borang' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
            >
              <Layers size={14} />
              Isi Laporan Baharu
            </button>
          )}
        </div>
      </div>

      {/* TOAST SUCCESS NOTIFICATION */}
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{toast}</span>
        </div>
      )}

      {/* 1. VIEW STATISTIK & ARCHIVE TAB */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* FILTER CONTROLS */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <label className="text-xs font-bold text-gray-500">Tahun Statistik:</label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setFilterYear('Semua'); setFilterMonth('Semua'); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${filterYear === 'Semua' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    Semua Tahun
                  </button>
                  {availableYears.map(yr => (
                    <button
                      key={yr}
                      onClick={() => { setFilterYear(yr.toString()); setFilterMonth('Semua'); }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${filterYear === yr.toString() ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>
              
              <button
                onClick={handlePrintAll}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200"
                title="Cetak Semua Laporan"
              >
                <Printer size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="text-indigo-600">●</span> {filteredByYearReports.length} Laporan dijumpai
            </div>
          </div>

          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Jumlah Program</span>
                <span className="text-base font-black text-slate-900">{filteredByYearReports.length}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Kategori Aktiviti</span>
                <span className="text-base font-black text-slate-900">{labelCounts.Aktiviti}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <BookOpen size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Kategori Mesyuarat</span>
                <span className="text-base font-black text-slate-900">{labelCounts.Mesyuarat}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Kategori Jamuan</span>
                <span className="text-base font-black text-slate-900">{labelCounts.Jamuan}</span>
              </div>
            </div>
          </div>

          {/* MONTHLY BREAKDOWN GRAPH */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Statistik Program Bulanan ({filterYear})</h3>
                <p className="text-[10px] text-gray-400 font-medium">Klik pada bar bulan untuk menapis senarai program</p>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">
                {filterYear === 'Semua' ? 'Semua Program' : `Tahun ${filterYear}`}
              </span>
            </div>

            {/* Custom Vertical Bar Chart */}
            <div className="pt-6 pb-2">
              <div className="flex items-end justify-between h-40 gap-1 md:gap-3">
                {monthlyCounts.map((count, index) => {
                  const percentage = (count / maxMonthCount) * 100;
                  const isFiltered = filterMonth === index.toString();
                  return (
                    <div 
                      key={index} 
                      onClick={() => setFilterMonth(isFiltered ? 'Semua' : index.toString())}
                      className="flex-1 flex flex-col items-center group cursor-pointer"
                    >
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md mb-1 absolute transform -translate-y-12 shadow-md pointer-events-none whitespace-nowrap z-10">
                        {count} Program
                      </div>

                      {/* Bar body */}
                      <div className="w-full bg-slate-50 rounded-t-lg h-32 flex items-end overflow-hidden border border-slate-100/50">
                        <div 
                          style={{ height: `${percentage}%` }}
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isFiltered 
                              ? 'bg-gradient-to-t from-indigo-600 to-purple-600' 
                              : 'bg-gradient-to-t from-indigo-400/80 to-indigo-500/80 group-hover:from-indigo-500 group-hover:to-indigo-600'
                          }`}
                        />
                      </div>

                      {/* Label Month */}
                      <span className={`text-[8px] md:text-[10px] font-bold mt-2 ${isFiltered ? 'text-indigo-600 font-black' : 'text-gray-400'}`}>
                        {MALAY_MONTHS[index].substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sub Filter Status */}
            {filterMonth !== 'Semua' && (
              <div className="flex items-center justify-between bg-indigo-50 text-indigo-800 p-2.5 rounded-lg text-xs font-semibold">
                <span>Penapis aktif: Bulan {MALAY_MONTHS[parseInt(filterMonth)]} ({filterYear})</span>
                <button 
                  onClick={() => setFilterMonth('Semua')}
                  className="text-[10px] bg-white text-indigo-600 font-bold px-2 py-0.5 rounded-md shadow-xs cursor-pointer hover:bg-indigo-100"
                >
                  Padam Penapis
                </button>
              </div>
            )}
          </div>

          {/* ARCHIVE PROGRAM LIST */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase flex items-center justify-between">
              <span>Senarai Program & Laporan ({displayReports.length})</span>
              {displayReports.length === 0 && <span className="text-[10px] text-red-500 font-bold normal-case">Tiada program direkodkan bagi bulan/tahun ini</span>}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayReports.map(rep => {
                const startD = new Date(rep.startDate);
                const endD = new Date(rep.endDate);
                const formatRange = startD.toDateString() === endD.toDateString()
                  ? startD.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
                  : `${startD.getDate()} ${MALAY_MONTHS[startD.getMonth()].substring(0, 3)} - ${endD.getDate()} ${MALAY_MONTHS[endD.getMonth()]} ${endD.getFullYear()}`;

                return (
                  <div 
                    key={rep.id} 
                    onClick={() => setActiveDetailReport(rep)}
                    className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-xs hover:border-indigo-100 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="p-4 space-y-3">
                      {/* Top badging */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] md:text-[9px] font-bold px-2.5 py-1 rounded-full ${
                          rep.label === 'Aktiviti' ? 'bg-emerald-50 text-emerald-700' :
                          rep.label === 'Mesyuarat' ? 'bg-amber-50 text-amber-700' :
                          'bg-pink-50 text-pink-700'
                        }`}>
                          {rep.label}
                        </span>
                        <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                          <Calendar size={11} />
                          {formatRange}
                        </div>
                      </div>

                      {/* Main details */}
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-xs md:text-sm text-slate-900 line-clamp-1">{rep.title}</h4>
                        <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed line-clamp-2 font-medium">
                          {rep.description}
                        </p>
                      </div>

                      {/* Image grids preview (4 images) */}
                      <div className="grid grid-cols-4 gap-1 pt-1">
                        {rep.images.slice(0, 4).map((imgUrl: string, idx: number) => (
                          <div key={idx} className="h-10 rounded bg-slate-100 overflow-hidden border border-gray-50">
                            <img src={imgUrl} alt="prog-preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 px-4 py-2 flex items-center justify-between text-[10px] border-t border-gray-50 text-indigo-600 font-bold">
                      <span>Lihat Tentatif & Impak Penuh</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrint(rep);
                          }}
                          className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-lg cursor-pointer transition-all shadow-3xs active:scale-95 flex items-center justify-center"
                          title="Cetak Laporan"
                        >
                          <Printer size={13} />
                        </button>
                        <ChevronRight size={14} className="stroke-[2.5]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 2. TAB BORANG PENGISIAN LAPORAN */}
      {activeSubTab === 'borang' && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-6">
          <div className="border-b border-slate-50 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">
                {editingReportId ? 'Kemaskini Pelaporan Program' : 'Borang Pelaporan Program'}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {editingReportId 
                  ? 'Sila kemaskini butiran laporan program yang telah dipilih di bawah.' 
                  : 'Sila lengkapkan butiran program di bawah untuk rekod arkib sekolah & penerbitan automatik ke Blog Terkini.'}
              </p>
            </div>
            {editingReportId && (
              <span className="text-[9px] bg-amber-50 text-amber-700 font-black px-2 py-1 rounded-md uppercase tracking-wide">
                Mod Edit Aktif
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nama Program */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Nama Program <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="Contoh: Gotong-Royong Fasa 2A"
                value={namaProgram}
                onChange={(e) => setNamaProgram(capitalizeEachWord(e.target.value))}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Blog Label */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Kategori / Blog Label <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {(['Aktiviti', 'Mesyuarat', 'Jamuan'] as const).map(lbl => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setBlogLabel(lbl)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer text-center ${blogLabel === lbl ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-slate-50 border-gray-100 text-gray-500 hover:bg-slate-100'}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Tarikh Mula */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Tarikh Mula <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={tarikhMula}
                onChange={(e) => {
                  const val = e.target.value;
                  setTarikhMula(val);
                  setTarikhTamat(val);
                }}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Tarikh Tamat */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Tarikh Tamat <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={tarikhTamat}
                onChange={(e) => setTarikhTamat(e.target.value)}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Masa Bermula */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Masa Bermula <span className="text-red-500">*</span></label>
              <input
                type="time"
                required
                value={masaBermula}
                onChange={(e) => {
                  const val = e.target.value;
                  setMasaBermula(val);
                  setMasaTamat(val);
                }}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Masa Tamat */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Masa Tamat <span className="text-red-500">*</span></label>
              <input
                type="time"
                required
                value={masaTamat}
                onChange={(e) => setMasaTamat(e.target.value)}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Tempat Program */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">Tempat Program <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="Contoh: Dewan Al-Ghazali / Dataran SMAUJ"
              value={tempat}
              onChange={(e) => setTempat(e.target.value)}
              className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
            />
          </div>

          {/* Tentatif Program */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">Tentatif Program <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={8}
              placeholder={`Contoh susunan tentatif (gunakan selang baris/enter untuk nampak kemas):\n\n08:00 pagi - Pendaftaran ahli\n\n08:30 pagi - Taklimat ringkas pengerusi\n\n09:00 pagi - Aktiviti bermula\n\n12:30 tengah hari - Makan tengah hari & bersurai`}
              value={tentatif}
              onChange={(e) => setTentatif(e.target.value)}
              className="w-full border border-gray-200 rounded-xl py-3 px-4 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 font-mono leading-relaxed"
            />
          </div>

          {/* Keterangan & Impak Program */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">Keterangan & Impak Program <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={8}
              placeholder={`Huraikan tujuan program dijalankan, bilangan peserta, serta impak positif kepada komuniti.\n\nGunakan enter (selang satu baris kosong) di antara setiap perenggan supaya paparan kelihatan sangat kemas dan tersusun.`}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="w-full border border-gray-200 rounded-xl py-3 px-4 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 leading-relaxed font-medium"
            />
          </div>

          {/* Upload 4 keping gambar */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <span className="text-xs font-bold text-slate-900 block uppercase tracking-wide">Muat Naik 4 Gambar Program <span className="text-red-500">*</span></span>
                <p className="text-[9px] text-gray-400 font-medium">Sila isi kesemua 4 pautan gambar atau gunakan Preset Paket di bawah.</p>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-1">
                {PRESET_IMAGE_PACKS.map(pack => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => applyPresetPack(pack.id)}
                    className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black px-2 py-1 rounded border border-indigo-100 cursor-pointer transition-colors"
                  >
                    🚀 Preset {pack.name.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs & Previews Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {images.map((imgUrl, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded-lg border border-gray-100 space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500">Gambar {idx + 1} {idx === 0 && <span className="text-indigo-600 font-black text-[8px] uppercase tracking-wide bg-indigo-50 px-1.5 py-0.5 rounded-md ml-1">(Utama Blog)</span>}</span>
                    {imgUrl.trim() !== '' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded">Sedia</span>
                        <button
                          type="button"
                          onClick={() => handleImageChange(idx, '')}
                          className="text-[8px] text-red-500 hover:text-red-700 font-black cursor-pointer"
                          title="Padam"
                        >
                          Padam
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Drag-and-drop & Click to upload area */}
                  <div 
                    onClick={() => triggerFileSelect(idx)}
                    className="h-24 w-full bg-slate-50 hover:bg-slate-100 rounded-md overflow-hidden flex items-center justify-center border border-dashed border-gray-200 relative cursor-pointer group transition-colors"
                    title="Klik untuk muat naik fail gambar ke Firebase Storage"
                  >
                    {uploading[idx] && (
                      <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-10">
                        <Loader2 size={16} className="animate-spin text-indigo-600" />
                        <span className="text-[8px] mt-1 font-bold text-indigo-600 animate-pulse">Memuat naik...</span>
                      </div>
                    )}

                    {imgUrl.trim() !== '' ? (
                      <>
                        <img src={imgUrl} alt={`preview-${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[9px] font-bold">
                          <Upload size={16} className="text-white mb-1" />
                          <span>Ganti Gambar</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-center text-gray-400 group-hover:text-indigo-600 transition-colors p-2">
                        <Upload size={18} className="text-gray-300 group-hover:text-indigo-400 mb-1" />
                        <span className="text-[8px] font-bold">Muat Naik Fail</span>
                        <span className="text-[7px] text-gray-400 mt-0.5">(Klik di sini)</span>
                      </div>
                    )}
                  </div>

                  {/* Hidden file input */}
                  <input
                    id={`file-input-${idx}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(idx, e)}
                  />

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wide block">Atau Pautan URL Gambar</label>
                    <input
                      type="text"
                      required
                      placeholder="Pautan gambar (URL)"
                      value={imgUrl}
                      onChange={(e) => handleImageChange(idx, e.target.value)}
                      className="w-full border border-gray-150 rounded py-1 px-1.5 text-[10px] outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SUBMIT ACTION BUTTON */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setNamaProgram('');
                setBlogLabel('Aktiviti');
                setTarikhMula(getTodayDateString());
                setTarikhTamat(getTodayDateString());
                setMasaBermula(getCurrentTimeString());
                setMasaTamat(getCurrentTimeString(120));
                setTentatif('');
                setKeterangan('');
                setImages(['', '', '', '']);
                setEditingReportId(null);
                setActiveSubTab('dashboard');
              }}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-gray-150 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-lg transition-all cursor-pointer"
            >
              {editingReportId ? 'Simpan Perubahan' : 'Hantar & Terbitkan Laporan'}
            </button>
          </div>

        </form>
      )}

      {/* 3. REPORT DETAIL MODAL OVERLAY */}
      {activeDetailReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 pb-24 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl relative select-none text-slate-800">
            {/* Header image cover (First Image) */}
            <div 
              className="h-44 w-full bg-slate-900 relative group cursor-pointer"
              onClick={() => setLightboxIndex(0)}
              title="Klik untuk lihat gambar utama bersaiz penuh"
            >
              <img 
                src={convertToGoogleContentUrl(activeDetailReport.images[0])} 
                alt="header-cover" 
                className="w-full h-full object-cover opacity-85 group-hover:opacity-95 transition-opacity" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              
              <div className="absolute top-3 left-3 bg-black/50 hover:bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 size={12} />
                <span>Lihat Gambar Penuh</span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDetailReport(null);
                }}
                className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white p-1.5 rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                title="Tutup Maklumat Program"
              >
                <X size={16} />
              </button>

              <div className="absolute bottom-4 left-4 right-4 text-white space-y-1 pointer-events-none">
                <span className={`text-[8px] md:text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  activeDetailReport.label === 'Aktiviti' ? 'bg-emerald-600 text-white' :
                  activeDetailReport.label === 'Mesyuarat' ? 'bg-amber-500 text-white' :
                  'bg-pink-600 text-white'
                }`}>
                  {activeDetailReport.label}
                </span>
                <h3 className="text-sm md:text-lg font-black leading-tight drop-shadow-sm">{activeDetailReport.title}</h3>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              
              {/* Date & Time specs info bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-gray-100">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Tarikh Mula</span>
                  <span className="font-extrabold text-slate-800">{new Date(activeDetailReport.startDate).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Tarikh Tamat</span>
                  <span className="font-extrabold text-slate-800">{new Date(activeDetailReport.endDate).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Masa Bermula</span>
                  <span className="font-extrabold text-slate-800">{activeDetailReport.startTime} pagi/malam</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Masa Tamat</span>
                  <span className="font-extrabold text-slate-800">{activeDetailReport.endTime} pagi/malam</span>
                </div>
              </div>

              {/* Tempat Program */}
              {activeDetailReport.venue && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tempat Program</h4>
                  <div className="text-xs text-gray-600 font-medium">
                    <p>{activeDetailReport.venue}</p>
                  </div>
                </div>
              )}

              {/* Keterangan & Impak */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Keterangan & Impak Program</h4>
                <div className="text-xs text-gray-600 leading-relaxed font-medium space-y-2">
                  {activeDetailReport.description ? (
                    activeDetailReport.description.split('\n').map((line: string, i: number) => {
                      if (line.trim() === '') return <div key={i} className="h-2" />;
                      return <p key={i}>{line}</p>;
                    })
                  ) : (
                    <p className="text-gray-400 italic">Tiada keterangan disediakan.</p>
                  )}
                </div>
              </div>

              {/* Tentatif */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tentatif Aturcara</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-gray-100 text-[11px] font-mono text-slate-700 leading-relaxed space-y-1.5">
                  {activeDetailReport.tentative ? (
                    activeDetailReport.tentative.split('\n').map((line: string, i: number) => {
                      if (line.trim() === '') return <div key={i} className="h-1.5" />;
                      return <p key={i}>{line}</p>;
                    })
                  ) : (
                    <p className="text-gray-400 italic">Tiada aturcara tentatif.</p>
                  )}
                </div>
              </div>

              {/* All 4 images lightbox grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Image size={13} />
                    <span>Galeri Gambar Program ({activeDetailReport.images?.length || 0} Keping)</span>
                  </h4>
                  <span className="text-[9px] text-slate-400 font-semibold hidden sm:inline">
                    Klik mana-mana gambar untuk besarkan
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {activeDetailReport.images.map((img: string, i: number) => (
                    <button 
                      key={i} 
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="h-24 bg-slate-100 rounded-xl overflow-hidden border border-gray-200 block group relative hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      title={`Klik untuk buka gambar ${i + 1} bersaiz besar`}
                    >
                      <img 
                        src={convertToGoogleContentUrl(img)} 
                        alt={`gallery-${i + 1}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        referrerPolicy="no-referrer" 
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 text-indigo-950 p-1.5 rounded-full shadow-md scale-90 group-hover:scale-100 duration-200">
                          <Maximize2 size={13} strokeWidth={2.5} />
                        </span>
                      </div>
                      <span className="absolute bottom-1 right-1 text-[8px] bg-slate-900/75 backdrop-blur-xs text-white font-black px-1.5 py-0.5 rounded shadow-xs">
                        #{i + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer actions */}
            <div className="bg-slate-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasCommitteeAccess && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(activeDetailReport)}
                      className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 border border-amber-200/50 rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center active:scale-95"
                      title="Edit Laporan"
                    >
                      <Pencil size={15} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(activeDetailReport.id)}
                      className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200/50 rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center active:scale-95"
                      title="Buang Laporan"
                    >
                      <Trash2 size={15} strokeWidth={2.5} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrint(activeDetailReport)}
                  className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 border border-indigo-200/50 rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center active:scale-95"
                  title="Cetak Laporan"
                >
                  <Printer size={15} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailReport(null)}
                  className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 border border-indigo-200/50 rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center active:scale-95"
                  title="Tutup Laporan"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. POPUP LIGHTBOX GAMBAR BESAR (NEXT & PREVIOUS)         */}
      {/* ======================================================== */}
      {lightboxIndex !== null && activeDetailReport?.images?.[lightboxIndex] && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between px-3 pt-3 pb-24 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pt-5 sm:pb-5 select-none animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Header Lightbox */}
          <div 
            className="flex items-center justify-between text-white w-full max-w-5xl mx-auto z-10 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2.5 py-1 rounded-full bg-indigo-600/90 text-white text-[11px] font-black tracking-wide shadow-md shrink-0">
                {lightboxIndex + 1} / {activeDetailReport.images.length}
              </span>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                  {activeDetailReport.title}
                </h4>
                <p className="text-[10px] text-slate-300 truncate hidden sm:block">
                  Galeri Foto Rasmi Program • Gambar {lightboxIndex + 1}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={activeDetailReport.images[lightboxIndex]}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center justify-center text-xs"
                title="Buka fail asal"
              >
                <ArrowUpRight size={16} />
              </a>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-full bg-white/15 hover:bg-red-500/80 text-white transition-colors cursor-pointer flex items-center justify-center"
                title="Tutup (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Bahagian Tengah: Gambar Besar + Butang Previous & Next */}
          <div 
            className="relative flex-1 flex items-center justify-center my-2 max-w-5xl w-full mx-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Butang Previous */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((prev) =>
                  prev !== null
                    ? (prev - 1 + activeDetailReport.images.length) % activeDetailReport.images.length
                    : 0
                )
              }
              aria-label="Gambar Sebelum (Previous)"
              title="Gambar Sebelum (Anak Panah Kiri)"
              className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-xl border border-white/20 backdrop-blur-md transition-all active:scale-90 hover:scale-105 cursor-pointer"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>

            {/* Gambar Besar */}
            <div className="relative max-h-[58vh] sm:max-h-[72vh] max-w-full flex items-center justify-center p-1 sm:p-2">
              <img
                key={lightboxIndex}
                src={convertToGoogleContentUrl(activeDetailReport.images[lightboxIndex])}
                alt={`Gambar ${lightboxIndex + 1}`}
                className="max-h-[55vh] sm:max-h-[70vh] max-w-full w-auto h-auto object-contain rounded-xl sm:rounded-2xl shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Butang Next */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((prev) =>
                  prev !== null
                    ? (prev + 1) % activeDetailReport.images.length
                    : 0
                )
              }
              aria-label="Gambar Seterusnya (Next)"
              title="Gambar Seterusnya (Anak Panah Kanan)"
              className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-xl border border-white/20 backdrop-blur-md transition-all active:scale-90 hover:scale-105 cursor-pointer"
            >
              <ChevronRight size={22} strokeWidth={2.5} />
            </button>
          </div>

          {/* Footer Lightbox: Jalur Thumbnail (Preview 4 Gambar) & Petunjuk */}
          <div 
            className="w-full max-w-md mx-auto z-10 space-y-2 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-2 p-1.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 w-fit mx-auto shadow-lg">
              {activeDetailReport.images.map((thumb: string, idx: number) => {
                const isActive = idx === lightboxIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`relative w-12 h-10 sm:w-14 sm:h-11 rounded-lg overflow-hidden transition-all cursor-pointer ${
                      isActive
                        ? 'ring-2 ring-indigo-400 scale-105 shadow-md shadow-indigo-500/30'
                        : 'opacity-50 hover:opacity-90'
                    }`}
                    title={`Pilih Gambar ${idx + 1}`}
                  >
                    <img
                      src={convertToGoogleContentUrl(thumb)}
                      alt={`thumb-${idx}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/70 text-white font-extrabold px-1 rounded">
                      {idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Gunakan butang <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-white">←</kbd> dan <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-white">→</kbd> pada papan kekunci atau klik butang untuk tukar gambar
            </p>
          </div>
        </div>
      )}

      {/* GORGEOUS HIGH-PRIORITY FLOATING AI BUTTON */}
      <AnimatePresence>
        {activeSubTab === 'borang' && namaProgram.trim().length > 0 && (
          <motion.button
            key="ai-floating-btn"
            type="button"
            onClick={() => {
              if (!tarikhMula || !tarikhTamat || !masaBermula || !masaTamat) {
                alert("Sila lengkapkan Tarikh Mula, Tarikh Tamat, Masa Bermula, dan Masa Tamat terlebih dahulu supaya AI boleh merangka tentatif & huraian program yang tepat!");
                return;
              }
              handleGenerateWithAI();
            }}
            disabled={isGeneratingAI}
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              transition: { type: 'spring', stiffness: 260, damping: 20 }
            }}
            exit={{ opacity: 0, scale: 0.5, y: 40, transition: { duration: 0.2 } }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`fixed bottom-24 right-6 md:right-10 z-[999999] px-5 py-3.5 rounded-full shadow-2xl text-white flex items-center gap-2.5 transition-shadow cursor-pointer focus:outline-none ${
              isGeneratingAI 
                ? 'bg-gradient-to-r from-slate-600 to-slate-700 shadow-slate-500/20' 
                : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 shadow-indigo-500/40 hover:shadow-indigo-500/60 ring-4 ring-indigo-500/10'
            }`}
            title={isGeneratingAI ? "Sedang menjana..." : "Auto-isi borang menggunakan AI (Gemini API dengan fallback OpenRouter)"}
          >
            <div className="relative flex items-center justify-center">
              {isGeneratingAI ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <>
                  <motion.span 
                    className="absolute -inset-2 rounded-full bg-white/20"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  />
                  <Sparkles size={16} className="text-white fill-white/20" />
                </>
              )}
            </div>
            <span className="text-xs font-black tracking-wide uppercase select-none">
              {isGeneratingAI ? 'Sedang Menjana...' : 'Auto-Isi (AI) ✨'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* 4. CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1000000] animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center relative select-none text-slate-800 animate-scale-in">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900">Padam Laporan Program?</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Tindakan ini tidak boleh diundur. Adakah anda pasti ingin memadam laporan program ini secara kekal dari pangkalan data?
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-xs rounded-xl border border-gray-150 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteReport(confirmDeleteId)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-500/10 hover:shadow-lg transition-all cursor-pointer"
                >
                  Ya, Padam
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
