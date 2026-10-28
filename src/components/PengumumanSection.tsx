import React, { useState } from 'react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { 
  Megaphone, Search, Plus, Edit2, Trash2, Calendar, Tag, X, 
  CheckCircle2, AlertCircle, Sparkles, BarChart2, Layers 
} from 'lucide-react';
import { Announcement } from '../types';
import { parseDateToMs } from '../utils/dateUtils';

interface PengumumanSectionProps {
  announcements: Announcement[];
  onAddAnnouncement: (announcement: Announcement) => void;
  onUpdateAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  isMobile: boolean;
  hasCommitteeAccess?: boolean;
}

const CATEGORIES = ['Semua', 'Mesyuarat', 'Keselamatan', 'Aktiviti', 'Umum', 'Kecemasan'];
const FORM_CATEGORIES = ['Mesyuarat', 'Keselamatan', 'Aktiviti', 'Umum', 'Kecemasan'];

const MALAY_MONTH_NAMES = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
];

const MALAY_MONTH_MAP: { [key: string]: number } = {
  'Januari': 0, 'Februari': 1, 'Mac': 2, 'April': 3, 'Mei': 4, 'Jun': 5,
  'Julai': 6, 'Ogos': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Disember': 11
};

export default function PengumumanSection({
  announcements,
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  isMobile,
  hasCommitteeAccess = true
}: PengumumanSectionProps) {
  
  // Tabs: 'dashboard' | 'borang'
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'borang'>('dashboard');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Year & Month filter for dashboard graph
  const [filterYear, setFilterYear] = useState<string>('Semua');
  const [filterMonth, setFilterMonth] = useState<string>('Semua');

  // Modal / Form states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // Form Fields (For add in Borang tab, or edit in modal)
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('Umum');
  const [formRawDate, setFormRawDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Success message toast state
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Format date helper (e.g., 2026-06-27 -> 27 Jun 2026)
  const formatDateMalay = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()} ${MALAY_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Helper to parse date back to date-picker value
  const parseToRawDateValue = (formattedDate: string) => {
    const match = formattedDate.match(/(\d+)\s+([A-Za-z]+)\s+(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const monthMalay = match[2];
      const year = match[3];
      // Lookup month
      let monthIndex = MALAY_MONTH_MAP[monthMalay];
      if (monthIndex === undefined) {
        // Fallback for short matches or other
        const found = Object.keys(MALAY_MONTH_MAP).find(k => k.startsWith(monthMalay.substring(0, 3)));
        monthIndex = found ? MALAY_MONTH_MAP[found] : 5;
      }
      const monthNum = (monthIndex + 1).toString().padStart(2, '0');
      return `${year}-${monthNum}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  // Handle submit for Adding (Borang Tab)
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      alert('Sila masukkan tajuk pengumuman!');
      return;
    }
    if (!formContent.trim()) {
      alert('Sila masukkan kandungan pengumuman!');
      return;
    }

    const payload: Announcement = {
      id: `ann-${Date.now()}`,
      title: formTitle,
      content: formContent,
      category: formCategory,
      date: formatDateMalay(formRawDate)
    };

    onAddAnnouncement(payload);
    triggerToast('Pengumuman baharu berjaya diterbitkan secara langsung!');
    
    // Auto Push Notification Trigger
    import('../utils/notificationHelper').then(({ notifyOnNewAnnouncement }) => {
      notifyOnNewAnnouncement(formTitle, payload.id).catch(err => console.warn('Push error:', err));
    }).catch(err => console.warn(err));
    
    // Reset Form
    setFormTitle('');
    setFormContent('');
    setFormCategory('Umum');
    setFormRawDate(new Date().toISOString().split('T')[0]);

    setActiveSubTab('dashboard');
  };

  // Handle submit for Editing (Modal)
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAnnouncement) return;

    if (!formTitle.trim()) {
      alert('Sila masukkan tajuk pengumuman!');
      return;
    }
    if (!formContent.trim()) {
      alert('Sila masukkan kandungan pengumuman!');
      return;
    }

    const payload: Announcement = {
      id: editingAnnouncement.id,
      title: formTitle,
      content: formContent,
      category: formCategory,
      date: formatDateMalay(formRawDate)
    };

    onUpdateAnnouncement(payload);
    triggerToast('Pengumuman berjaya dikemaskini!');
    setShowEditModal(false);
    setEditingAnnouncement(null);
  };

  // Open modal for Editing
  const openEditModal = (ann: Announcement) => {
    setEditingAnnouncement(ann);
    setFormTitle(ann.title);
    setFormContent(ann.content);
    setFormCategory(ann.category);
    setFormRawDate(parseToRawDateValue(ann.date));
    setShowEditModal(true);
  };

  // Handle delete
  const handleDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteAnnouncement(deleteTarget.id);
    triggerToast(`Pengumuman "${deleteTarget.title}" telah berjaya dipadam!`);
    setDeleteTarget(null);
  };

  // Extract Years from Announcements
  const years = Array.from(
    new Set(
      announcements.map(ann => {
        const raw = parseToRawDateValue(ann.date);
        const d = new Date(raw);
        return isNaN(d.getFullYear()) ? 2026 : d.getFullYear();
      })
    )
  ).sort((a, b) => b - a);
  const availableYears = years.length > 0 ? years : [2026, 2025, 2024];

  // Filter announcements for Stats according to selected Year
  const filteredByYearAnnouncements = announcements.filter(ann => {
    if (filterYear === 'Semua') return true;
    const raw = parseToRawDateValue(ann.date);
    const year = new Date(raw).getFullYear();
    return year.toString() === filterYear;
  });

  // Calculate Monthly Breakdown for interactive graph
  const monthlyCounts = Array(12).fill(0);
  filteredByYearAnnouncements.forEach(ann => {
    const raw = parseToRawDateValue(ann.date);
    const month = new Date(raw).getMonth();
    if (month >= 0 && month < 12) {
      monthlyCounts[month] += 1;
    }
  });
  const maxMonthCount = Math.max(...monthlyCounts, 1);

  // Statistics counters
  const totalCount = filteredByYearAnnouncements.length;
  const mesyuaratCount = filteredByYearAnnouncements.filter(ann => ann.category === 'Mesyuarat').length;
  const keselamatanCount = filteredByYearAnnouncements.filter(ann => ann.category === 'Keselamatan').length;
  const kecemasanCount = filteredByYearAnnouncements.filter(ann => ann.category === 'Kecemasan').length;

  // Filter and search logic for the announcements displayed below
  const displayAnnouncements = announcements.filter(ann => {
    // 1. Year Filter
    const raw = parseToRawDateValue(ann.date);
    const dateObj = new Date(raw);
    const repYearStr = dateObj.getFullYear().toString();
    const repMonthIdx = dateObj.getMonth();

    const matchYear = filterYear === 'Semua' || repYearStr === filterYear;
    const matchMonth = filterMonth === 'Semua' || repMonthIdx.toString() === filterMonth;

    // 2. Category button filter
    const matchesCategory = selectedCategory === 'Semua' || ann.category.toLowerCase() === selectedCategory.toLowerCase();

    // 3. Search query
    const matchesSearch = 
      ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ann.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchYear && matchMonth && matchesCategory && matchesSearch;
  }).sort((a, b) => parseDateToMs(b.date) - parseDateToMs(a.date));

  return (
    <div className="space-y-6 select-none text-slate-800">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-pink-50 text-pink-600 rounded-lg">
              <Megaphone size={20} />
            </span>
            Seksyen Pengumuman & Hebahan Komuniti
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            Hebahan berita, makluman keselamatan, pemberitahuan kecemasan, dan mesyuarat penting penduduk Taman Musytari Fasa 2.
          </p>
        </div>

        {/* Sub-tab controls like LaporanSection */}
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto border border-gray-150/50">
          <button
            onClick={() => { setActiveSubTab('dashboard'); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'dashboard' ? 'bg-white text-pink-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
          >
            <BarChart2 size={14} />
            Statistik & Arkib
          </button>
          {hasCommitteeAccess && (
            <button
              onClick={() => {
                setActiveSubTab('borang');
                setFormTitle('');
                setFormContent('');
                setFormCategory('Umum');
                setFormRawDate(new Date().toISOString().split('T')[0]);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'borang' ? 'bg-white text-pink-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
            >
              <Layers size={14} />
              Isi Pengumuman Baharu
            </button>
          )}
        </div>
      </div>

      {/* TOAST SUCCESS NOTIFICATION */}
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2 animate-fade-in shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{toast}</span>
        </div>
      )}

      {/* 1. VIEW STATISTIK & ARCHIVE TAB */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* FILTER CONTROLS */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-bold text-gray-500">Tahun Hebahan:</label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setFilterYear('Semua'); setFilterMonth('Semua'); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${filterYear === 'Semua' ? 'bg-pink-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  Semua Tahun
                </button>
                {availableYears.map(yr => (
                  <button
                    key={yr}
                    onClick={() => { setFilterYear(yr.toString()); setFilterMonth('Semua'); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${filterYear === yr.toString() ? 'bg-pink-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="text-pink-600">●</span> {filteredByYearAnnouncements.length} Hebahan diterbitkan
            </div>
          </div>

          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                <Megaphone size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Jumlah Hebahan</span>
                <span className="text-base font-black text-slate-900">{totalCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Tag size={18} className="text-amber-600" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Pemberitahuan Keselamatan</span>
                <span className="text-base font-black text-slate-900">{keselamatanCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Calendar size={18} className="text-indigo-600" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Notis Mesyuarat</span>
                <span className="text-base font-black text-slate-900">{mesyuaratCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle size={18} className="text-rose-600" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Notis Kecemasan</span>
                <span className="text-base font-black text-slate-900">{kecemasanCount}</span>
              </div>
            </div>
          </div>

          {/* MONTHLY BREAKDOWN GRAPH */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Statistik Hebahan Bulanan ({filterYear})</h3>
                <p className="text-[10px] text-gray-400 font-medium">Klik pada bar bulanan untuk menapis senarai pengumuman</p>
              </div>
              <span className="text-[10px] bg-pink-50 text-pink-600 font-bold px-2 py-0.5 rounded-full">
                {filterYear === 'Semua' ? 'Semua Hebahan' : `Tahun ${filterYear}`}
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
                        {count} Hebahan
                      </div>

                      {/* Bar body */}
                      <div className="w-full bg-slate-50 rounded-t-lg h-32 flex items-end overflow-hidden border border-slate-100/50">
                        <div 
                          style={{ height: `${percentage}%` }}
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isFiltered 
                              ? 'bg-gradient-to-t from-pink-600 to-rose-600' 
                              : 'bg-gradient-to-t from-pink-400/80 to-pink-500/80 group-hover:from-pink-500 group-hover:to-pink-600'
                          }`}
                        />
                      </div>

                      {/* Label Month */}
                      <span className={`text-[8px] md:text-[10px] font-bold mt-2 ${isFiltered ? 'text-pink-600 font-black' : 'text-gray-400'}`}>
                        {MALAY_MONTH_NAMES[index].substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sub Filter Status */}
            {filterMonth !== 'Semua' && (
              <div className="flex items-center justify-between bg-pink-50 text-pink-800 p-2.5 rounded-lg text-xs font-semibold font-sans">
                <span>Penapis aktif: Bulan {MALAY_MONTH_NAMES[parseInt(filterMonth)]} ({filterYear})</span>
                <button 
                  onClick={() => setFilterMonth('Semua')}
                  className="text-[10px] bg-white text-pink-600 font-bold px-2 py-0.5 rounded-md shadow-xs cursor-pointer hover:bg-pink-100"
                >
                  Padam Penapis
                </button>
              </div>
            )}
          </div>

          {/* FILTER, SEARCH BAR & CARDS BLOCK */}
          <div className="space-y-4 pt-2">
            
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cari kata kunci dalam arkib hebahan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/20 text-slate-800 font-medium shadow-2xs"
                />
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-3 text-gray-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category buttons list */}
              <div className="flex flex-wrap gap-1.5 items-center">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-2 text-[11px] font-bold rounded-xl border cursor-pointer transition-all ${
                      selectedCategory === cat
                        ? 'bg-pink-600 text-white border-pink-600 shadow-sm shadow-pink-500/15'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* ANNOUNCEMENTS LIST GRID */}
            {displayAnnouncements.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-4 shadow-2xs">
                <Megaphone size={36} className="mx-auto text-gray-300" />
                <div className="space-y-1">
                  <p className="text-sm text-slate-800 font-black">Tiada pengumuman ditemui</p>
                  <p className="text-xs text-gray-400 max-w-[280px] mx-auto font-medium">
                    Tiada rekod pengumuman bagi tapisan bulan/tahun serta kata kunci yang dimasukkan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayAnnouncements.map(ann => {
                  let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-100';
                  if (ann.category === 'Kecemasan') badgeStyle = 'bg-rose-50 text-rose-700 border-rose-150 animate-pulse';
                  else if (ann.category === 'Keselamatan') badgeStyle = 'bg-amber-50 text-amber-700 border-amber-100';
                  else if (ann.category === 'Aktiviti') badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  else if (ann.category === 'Mesyuarat') badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-100';

                  return (
                    <div
                      key={ann.id}
                      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-2xs hover:shadow-md hover:border-pink-100 transition-all flex flex-col justify-between group relative border-l-[4px] border-l-pink-500"
                    >
                      <div className="space-y-3.5">
                        {/* Category and Date Header */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${badgeStyle}`}>
                            {ann.category}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            <Calendar size={11} className="text-gray-300" />
                            {ann.date}
                          </span>
                        </div>

                        {/* Title and Content */}
                        <div className="space-y-2">
                          <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-pink-600 transition-colors leading-snug">
                            {ann.title}
                          </h3>
                          <p className="text-xs text-gray-500 font-medium leading-relaxed whitespace-pre-wrap">
                            {ann.content}
                          </p>
                        </div>
                      </div>

                      {/* Edit & Delete Action Buttons */}
                      {hasCommitteeAccess && (
                        <div className="flex items-center justify-end gap-1.5 mt-5 pt-3 border-t border-slate-50">
                          <button
                            onClick={() => openEditModal(ann)}
                            className="p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-pink-100"
                            title="Ubah Pengumuman"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(ann.id, ann.title)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-rose-100"
                            title="Padam"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DYNAMIC SPARKLE BANNER */}
          <div className="bg-slate-50 border border-gray-150/60 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-pink-500 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-slate-900">Pemberitahuan Segera di Dashboard Utama</p>
              <p className="text-[10px] text-gray-400 font-medium">
                Sebarang hebahan baharu yang dimuat naik akan muncul secara langsung di bar gelangsar (banner slider) bahagian atas dashboard hadapan penduduk.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* 2. TAB BORANG PENGISIAN PENGUMUMAN */}
      {activeSubTab === 'borang' && (
        <form onSubmit={handleAddSubmit} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-6">
          <div className="border-b border-slate-50 pb-3">
            <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Borang Hebahan Pengumuman Komuniti</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Sila lengkapkan butiran di bawah untuk berkongsi makluman rasmi atau notis penting kepada semua penduduk.</p>
          </div>

          <div className="space-y-4">
            {/* Category selection row */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500">Kategori Makluman <span className="text-red-500">*</span></label>
              <p className="text-[10px] text-gray-400 mb-2">Pilih kategori yang paling bersesuaian dengan kandungan hebahan anda.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {FORM_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormCategory(cat)}
                    className={`py-2 px-3 text-[11px] font-bold rounded-xl border transition-all cursor-pointer text-center ${
                      formCategory === cat 
                        ? 'bg-pink-50 border-pink-500 text-pink-700 shadow-2xs' 
                        : 'bg-slate-50 border-gray-100 text-gray-500 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Tajuk Pengumuman */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">Tajuk Pengumuman <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jadual Kutipan Sampah Semasa Raya Aidiladha"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/20 bg-white"
                />
              </div>

              {/* Tarikh Pengumuman */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">Tarikh Hebahan <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={formRawDate}
                  onChange={(e) => setFormRawDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/20 bg-white"
                />
              </div>
            </div>

            {/* Kandungan perincian */}
            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-gray-500">Butiran / Perincian Hebahan <span className="text-red-500">*</span></label>
              <textarea
                required
                rows={6}
                placeholder="Tuliskan huraian lengkap pengumuman anda di sini agar mudah difahami oleh penduduk..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/20 bg-white resize-none leading-relaxed"
              />
            </div>

          </div>

          {/* Action buttons row */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-50">
            <button
              type="button"
              onClick={() => setActiveSubTab('dashboard')}
              className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-gray-150 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-md shadow-pink-500/10 hover:shadow-lg transition-all cursor-pointer"
            >
              Terbitkan Pengumuman
            </button>
          </div>
        </form>
      )}

      {/* 3. DIRECT EDIT MODAL FROM DASHBOARD CARDS */}
      {showEditModal && editingAnnouncement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-800">
            
            <div className="bg-pink-950 px-5 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-pink-300" />
                <h3 className="text-xs md:text-sm font-black uppercase tracking-wide">
                  Kemaskini Pengumuman Komuniti
                </h3>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingAnnouncement(null); }}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Kategori Makluman</label>
                <div className="grid grid-cols-3 gap-2">
                  {FORM_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`py-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer text-center ${
                        formCategory === cat 
                          ? 'bg-pink-50 border-pink-500 text-pink-700 shadow-2xs' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tajuk Hebahan</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-pink-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Hebahan</label>
                <input
                  type="date"
                  required
                  value={formRawDate}
                  onChange={(e) => setFormRawDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-pink-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Perincian Hebahan</label>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-pink-500 bg-white resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingAnnouncement(null); }}
                  className="px-4 py-2 bg-slate-50 text-slate-600 font-bold text-xs rounded-xl border border-gray-150 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.title}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

    </div>
  );
}
