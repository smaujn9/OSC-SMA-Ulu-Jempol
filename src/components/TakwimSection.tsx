import React, { useState, useEffect } from 'react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { 
  Calendar as CalendarIcon, Clock, MapPin, Plus, Edit2, Trash2, 
  ArrowRightLeft, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, 
  X, CalendarDays, List, BarChart2, Layers, Sparkles 
} from 'lucide-react';
import { UpcomingEvent } from '../types';

interface TakwimSectionProps {
  events: UpcomingEvent[];
  onAddEvent: (event: UpcomingEvent) => void;
  onUpdateEvent: (event: UpcomingEvent) => void;
  onDeleteEvent: (id: string) => void;
  onMoveEvent: (id: string) => void;
  isMobile: boolean;
  hasCommitteeAccess?: boolean;
}

const MALAY_WEEKDAYS = ['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Ahd'];
const MALAY_MONTH_NAMES = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
];

export default function TakwimSection({
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onMoveEvent,
  isMobile,
  hasCommitteeAccess = true
}: TakwimSectionProps) {
  
  // Tabs matching LaporanSection: 'dashboard' | 'borang'
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'borang'>('dashboard');
  
  // Inside dashboard: calendar view vs list view
  const [viewMode, setViewMode] = useState<'kalender' | 'senarai'>('kalender');

  // Filters for Statistics & Archive
  const [filterYear, setFilterYear] = useState<string>('Semua');
  const [filterMonth, setFilterMonth] = useState<string>('Semua');

  // Interactive calendar navigation states (default to current local month and year)
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonthIdx, setCurrentMonthIdx] = useState<number>(() => new Date().getMonth());

  // Selected date filter
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modal edit states
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<UpcomingEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // Form states (For adding in Borang tab, or editing in modal)
  const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getCurrentTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [formTitle, setFormTitle] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formRawDate, setFormRawDate] = useState(() => getTodayDateStr());
  const [formRawEndDate, setFormRawEndDate] = useState(() => getTodayDateStr());
  const [formStartTime, setFormStartTime] = useState(() => getCurrentTimeStr());
  const [formEndTime, setFormEndTime] = useState(() => getCurrentTimeStr());
  const [formStatus, setFormStatus] = useState<'draf' | 'rasmi'>('rasmi');

  // Success toast state
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const isDateInRange = (dateStr: string, startDateStr?: string, endDateStr?: string) => {
    if (!startDateStr) return false;
    const end = endDateStr || startDateStr;
    return dateStr >= startDateStr && dateStr <= end;
  };

  // Parse raw date input to Malay terms
  const parseEventDate = (rawDateStr: string) => {
    const d = new Date(rawDateStr);
    if (isNaN(d.getTime())) {
      return {
        day: "01",
        month: "JAN",
        formatted: "Isnin, 1 Januari 2026"
      };
    }
    const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    const monthsAbbr = ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGO', 'SEP', 'OKT', 'NOV', 'DIS'];
    
    return {
      day: d.getDate().toString(),
      month: monthsAbbr[d.getMonth()],
      formatted: `${days[d.getDay()]} , ${d.getDate()} ${MALAY_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
    };
  };

  const formatTimeToMalay = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const hour = parseInt(parts[0], 10);
    const min = parts[1];
    if (isNaN(hour)) return timeStr;
    
    let period = 'pagi';
    let displayHour = hour;
    
    if (hour === 0) {
      displayHour = 12;
      period = 'pagi';
    } else if (hour === 12) {
      period = 'tengah hari';
    } else if (hour > 12) {
      displayHour = hour - 12;
      if (hour < 19) {
        period = 'petang';
      } else {
        period = 'malam';
      }
    } else if (hour >= 11) {
      period = 'tengah hari';
    }
    
    return `${displayHour}:${min} ${period}`;
  };

  const formatEventTimeRange = (startTimeStr: string, endTimeStr: string) => {
    if (!startTimeStr) return '';
    const startFormatted = formatTimeToMalay(startTimeStr);
    if (!endTimeStr || startTimeStr === endTimeStr) {
      return startFormatted;
    }
    const endFormatted = formatTimeToMalay(endTimeStr);
    return `${startFormatted} - ${endFormatted}`;
  };

  const formatEventDateRange = (startDateStr: string, endDateStr: string) => {
    const startParsed = parseEventDate(startDateStr);
    if (!endDateStr || startDateStr === endDateStr) {
      return startParsed.formatted;
    }
    const endParsed = parseEventDate(endDateStr);
    return `${startParsed.formatted} sehingga ${endParsed.formatted}`;
  };

  // Calendar Grid builder
  const getDaysInMonthGrid = (year: number, monthIndex: number) => {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

    const grid = [];

    // Prev month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const pMonthIdx = monthIndex === 0 ? 11 : monthIndex - 1;
      const pYear = monthIndex === 0 ? year - 1 : year;
      const pDayNum = daysInPrevMonth - i;
      const dateStr = `${pYear}-${(pMonthIdx + 1).toString().padStart(2, '0')}-${pDayNum.toString().padStart(2, '0')}`;
      grid.push({ num: pDayNum.toString(), currentMonth: false, dateStr });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      grid.push({ num: i.toString(), currentMonth: true, dateStr });
    }

    // Next month padding
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      const nMonthIdx = monthIndex === 11 ? 0 : monthIndex + 1;
      const nYear = monthIndex === 11 ? year + 1 : year;
      const dateStr = `${nYear}-${(nMonthIdx + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      grid.push({ num: i.toString(), currentMonth: false, dateStr });
    }

    return grid;
  };

  const calendarGrid = getDaysInMonthGrid(currentYear, currentMonthIdx);

  // Month navigators
  const handlePrevMonth = () => {
    if (currentMonthIdx === 0) {
      setCurrentMonthIdx(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonthIdx(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIdx === 11) {
      setCurrentMonthIdx(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonthIdx(prev => prev + 1);
    }
  };

  // Submit Handler for Adding Event (Tab Borang)
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      alert('Sila masukkan nama aktiviti!');
      return;
    }
    if (!formLocation.trim()) {
      alert('Sila masukkan lokasi program!');
      return;
    }
    if (!formRawDate) {
      alert('Sila pilih tarikh mula program!');
      return;
    }
    if (!formRawEndDate) {
      alert('Sila pilih tarikh tamat program!');
      return;
    }
    if (!formStartTime) {
      alert('Sila pilih masa mula program!');
      return;
    }
    if (!formEndTime) {
      alert('Sila pilih masa tamat program!');
      return;
    }

    if (new Date(formRawEndDate) < new Date(formRawDate)) {
      alert('Tarikh tamat tidak boleh sebelum tarikh mula!');
      return;
    }

    if (formRawDate === formRawEndDate && formEndTime < formStartTime) {
      alert('Masa tamat tidak boleh sebelum masa mula!');
      return;
    }

    const { day, month } = parseEventDate(formRawDate);
    const formattedDateRange = formatEventDateRange(formRawDate, formRawEndDate);
    const formattedTimeRange = formatEventTimeRange(formStartTime, formEndTime);

    const eventPayload: UpcomingEvent = {
      id: `evt-${Date.now()}`,
      title: formTitle,
      location: formLocation,
      date: formattedDateRange,
      time: formattedTimeRange,
      day,
      month,
      status: formStatus,
      rawDate: formRawDate,
      rawEndDate: formRawEndDate,
      startTime: formStartTime,
      endTime: formEndTime
    };

    onAddEvent(eventPayload);
    triggerToast('Aktiviti baharu berjaya diterbitkan dalam takwim!');

    // Auto Push Notification Trigger
    import('../utils/notificationHelper').then(({ notifyOnNewTakwimEvent }) => {
      notifyOnNewTakwimEvent(formTitle, formattedDateRange).catch(err => console.warn('Push error:', err));
    }).catch(err => console.warn(err));
    
    // Reset Form
    setFormTitle('');
    setFormLocation('');
    setFormRawDate(getTodayDateStr());
    setFormRawEndDate(getTodayDateStr());
    setFormStartTime(getCurrentTimeStr());
    setFormEndTime(getCurrentTimeStr());
    setFormStatus('rasmi');

    // Return to dashboard
    setActiveSubTab('dashboard');
  };

  // Submit Handler for Editing Event (Modal Edit)
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingEvent) return;

    if (!formTitle.trim()) {
      alert('Sila masukkan nama aktiviti!');
      return;
    }
    if (!formLocation.trim()) {
      alert('Sila masukkan lokasi program!');
      return;
    }
    if (!formRawDate) {
      alert('Sila pilih tarikh mula program!');
      return;
    }
    if (!formRawEndDate) {
      alert('Sila pilih tarikh tamat program!');
      return;
    }
    if (!formStartTime) {
      alert('Sila pilih masa mula program!');
      return;
    }
    if (!formEndTime) {
      alert('Sila pilih masa tamat program!');
      return;
    }

    if (new Date(formRawEndDate) < new Date(formRawDate)) {
      alert('Tarikh tamat tidak boleh sebelum tarikh mula!');
      return;
    }

    if (formRawDate === formRawEndDate && formEndTime < formStartTime) {
      alert('Masa tamat tidak boleh sebelum masa mula!');
      return;
    }

    const { day, month } = parseEventDate(formRawDate);
    const formattedDateRange = formatEventDateRange(formRawDate, formRawEndDate);
    const formattedTimeRange = formatEventTimeRange(formStartTime, formEndTime);

    const eventPayload: UpcomingEvent = {
      id: editingEvent.id,
      title: formTitle,
      location: formLocation,
      date: formattedDateRange,
      time: formattedTimeRange,
      day,
      month,
      status: formStatus,
      rawDate: formRawDate,
      rawEndDate: formRawEndDate,
      startTime: formStartTime,
      endTime: formEndTime
    };

    onUpdateEvent(eventPayload);
    triggerToast('Aktiviti berjaya dikemaskini!');
    setShowEditModal(false);
    setEditingEvent(null);
  };

  // Open modal edit
  const openEditModal = (event: UpcomingEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormLocation(event.location);
    
    const startD = event.rawDate || getTodayDateStr();
    setFormRawDate(startD);
    setFormRawEndDate(event.rawEndDate || startD);
    
    setFormStartTime(event.startTime || getCurrentTimeStr());
    setFormEndTime(event.endTime || event.startTime || getCurrentTimeStr());
    
    setFormStatus(event.status || 'rasmi');
    setShowEditModal(true);
  };

  const handlePromotion = (id: string, title: string) => {
    onMoveEvent(id);
    triggerToast(`"${title}" telah diluluskan ke Takwim Rasmi!`);
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteEvent(deleteTarget.id);
    triggerToast(`Aktiviti "${deleteTarget.title}" telah dipadam!`);
    setDeleteTarget(null);
  };

  // Extract statistics filters
  const years = Array.from(
    new Set(
      events.map(evt => {
        if (!evt.rawDate) return 2026;
        const d = new Date(evt.rawDate);
        return isNaN(d.getFullYear()) ? 2026 : d.getFullYear();
      })
    )
  ).sort((a, b) => b - a);
  const availableYears = years.length > 0 ? years : [2026, 2025, 2024];

  // Filter events according to Selected Year
  const filteredByYearEvents = events.filter(evt => {
    if (filterYear === 'Semua') return true;
    if (!evt.rawDate) return false;
    const year = new Date(evt.rawDate).getFullYear();
    return year.toString() === filterYear;
  });

  // Calculate Monthly Breakdown
  const monthlyCounts = Array(12).fill(0);
  filteredByYearEvents.forEach(evt => {
    if (!evt.rawDate) return;
    const month = new Date(evt.rawDate).getMonth();
    if (month >= 0 && month < 12) {
      monthlyCounts[month] += 1;
    }
  });
  const maxMonthCount = Math.max(...monthlyCounts, 1);

  // Label distribution stats
  const totalCount = filteredByYearEvents.length;
  const rasmiCount = filteredByYearEvents.filter(evt => (evt.status || 'rasmi') === 'rasmi').length;
  const drafCount = filteredByYearEvents.filter(evt => evt.status === 'draf').length;
  
  // Past events (Completed)
  const selesaiCount = filteredByYearEvents.filter(evt => {
    if (!evt.rawDate) return false;
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    return new Date(evt.rawDate) < todayObj && (evt.status || 'rasmi') === 'rasmi';
  }).length;

  // Filter list of activities by both Year & Month filter & selected calendar date
  const displayEvents = events.filter(evt => {
    if (!evt.rawDate) return false;

    if (selectedDate) {
      return isDateInRange(selectedDate, evt.rawDate, evt.rawEndDate);
    }

    const repDate = new Date(evt.rawDate);
    const repYearStr = repDate.getFullYear().toString();
    const repMonthIdx = repDate.getMonth();

    const matchYear = filterYear === 'Semua' || repYearStr === filterYear;
    const matchMonth = filterMonth === 'Semua' || repMonthIdx.toString() === filterMonth;

    return matchYear && matchMonth;
  });

  return (
    <div className="space-y-6 select-none text-slate-800">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <CalendarIcon size={20} />
            </span>
            Takwim Aktiviti & Kalender Komuniti
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            Rancang perancangan program persatuan penduduk, semak kalender bulanan, draf aktiviti serta takwim rasmi.
          </p>
        </div>

        {/* Sub-tab controls like LaporanSection */}
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto border border-gray-150/50">
          <button
            onClick={() => { setActiveSubTab('dashboard'); setSelectedDate(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
          >
            <BarChart2 size={14} />
            Statistik & Kalender
          </button>
          {hasCommitteeAccess && (
            <button
              onClick={() => {
                setActiveSubTab('borang');
                setFormTitle('');
                setFormLocation('');
                setFormRawDate(getTodayDateStr());
                setFormRawEndDate(getTodayDateStr());
                setFormStartTime(getCurrentTimeStr());
                setFormEndTime(getCurrentTimeStr());
                setFormStatus('rasmi');
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'borang' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
            >
              <Layers size={14} />
              Isi Aktiviti Baharu
            </button>
          )}
        </div>
      </div>

      {/* SUCCESS TOAST */}
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
              <label className="text-xs font-bold text-gray-500">Tahun Takwim:</label>
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

            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="text-indigo-600">●</span> {filteredByYearEvents.length} Aktiviti direkodkan
            </div>
          </div>

          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <CalendarIcon size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Jumlah Aktiviti</span>
                <span className="text-base font-black text-slate-900">{totalCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} className="text-emerald-600" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Takwim Rasmi</span>
                <span className="text-base font-black text-slate-900">{rasmiCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={18} className="text-amber-600" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Draf Perancangan</span>
                <span className="text-base font-black text-slate-900">{drafCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-purple-600" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Telah Selesai</span>
                <span className="text-base font-black text-slate-900">{selesaiCount}</span>
              </div>
            </div>
          </div>

          {/* MONTHLY BREAKDOWN GRAPH */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Statistik Program Mengikut Bulan ({filterYear})</h3>
                <p className="text-[10px] text-gray-400 font-medium">Klik pada bar bulanan untuk menapis senarai aktiviti di bawah</p>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">
                {filterYear === 'Semua' ? 'Kesemua Tahun' : `Tahun ${filterYear}`}
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
                        {count} Aktiviti
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
                        {MALAY_MONTH_NAMES[index].substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sub Filter Status */}
            {filterMonth !== 'Semua' && (
              <div className="flex items-center justify-between bg-indigo-50 text-indigo-800 p-2.5 rounded-lg text-xs font-semibold">
                <span>Penapis aktif: Bulan {MALAY_MONTH_NAMES[parseInt(filterMonth)]} ({filterYear})</span>
                <button 
                  onClick={() => setFilterMonth('Semua')}
                  className="text-[10px] bg-white text-indigo-600 font-bold px-2 py-0.5 rounded-md shadow-xs cursor-pointer hover:bg-indigo-100"
                >
                  Padam Penapis
                </button>
              </div>
            )}
          </div>

          {/* MAIN CALENDAR AND LIST CONTAINER SIDE-BY-SIDE */}
          <div className="space-y-4">
            
            {/* View Switchers header */}
            <div className="flex items-center justify-between bg-slate-100/60 p-2 rounded-xl border border-gray-150/40">
              <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide px-2">Kandungan Takwim</span>
              
              <div className="flex bg-slate-200 p-0.5 rounded-lg border border-gray-200">
                <button
                  onClick={() => { setViewMode('kalender'); setSelectedDate(null); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${viewMode === 'kalender' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
                >
                  <CalendarDays size={13} />
                  Kalender
                </button>
                <button
                  onClick={() => { setViewMode('senarai'); setSelectedDate(null); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${viewMode === 'senarai' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-slate-900'}`}
                >
                  <List size={13} />
                  Senarai Terperinci
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${viewMode === 'kalender' ? 'lg:grid-cols-12' : ''} gap-6`}>
              
              {/* INTERACTIVE CALENDAR COLUMN */}
              {viewMode === 'kalender' && (
                <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                  
                  {/* Calendar Month Header Controller */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon size={16} className="text-indigo-600" />
                      <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-wide">
                        {MALAY_MONTH_NAMES[currentMonthIdx]} {currentYear}
                      </h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={handlePrevMonth}
                        className="p-1.5 hover:bg-slate-50 text-slate-600 rounded-lg border border-gray-200 cursor-pointer transition-colors"
                      >
                        <ChevronLeft size={14} className="stroke-[2.5]" />
                      </button>
                      <button
                        onClick={() => {
                          const today = new Date();
                          setCurrentMonthIdx(today.getMonth());
                          setCurrentYear(today.getFullYear());
                        }}
                        className="px-2.5 py-1 text-[10px] bg-slate-50 border border-gray-200 text-slate-600 font-bold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Hari Ini
                      </button>
                      <button
                        onClick={handleNextMonth}
                        className="p-1.5 hover:bg-slate-50 text-slate-600 rounded-lg border border-gray-200 cursor-pointer transition-colors"
                      >
                        <ChevronRight size={14} className="stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Grid Days Header (Mon-Sun) */}
                  <div className="grid grid-cols-7 text-center border-b border-slate-50 pb-2">
                    {MALAY_WEEKDAYS.map(day => (
                      <span key={day} className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Calendar 42 Days Body Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarGrid.map((cell, idx) => {
                      // Find all events for this cell date
                      const dayEvents = events.filter(evt => isDateInRange(cell.dateStr, evt.rawDate, evt.rawEndDate));
                      const isSelected = selectedDate === cell.dateStr;
                      const todayObj = new Date();
                      const todayLocalStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
                      const isToday = cell.dateStr === todayLocalStr;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (selectedDate === cell.dateStr) {
                              setSelectedDate(null);
                            } else {
                              setSelectedDate(cell.dateStr);
                            }
                          }}
                          className={`min-h-[64px] p-1 rounded-xl flex flex-col justify-between border cursor-pointer transition-all hover:scale-101 select-none ${
                            !cell.currentMonth 
                              ? 'bg-slate-50/40 text-gray-300 border-transparent' 
                              : isSelected 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/10'
                                : isToday
                                  ? 'bg-indigo-600 text-white border-indigo-650 font-black shadow-sm'
                                  : 'bg-white border-gray-100 hover:border-indigo-100 hover:bg-slate-50/50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-black leading-none ${isToday && !isSelected ? 'text-white' : ''}`}>
                              {cell.num}
                            </span>
                            {isToday && (
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            )}
                          </div>

                          {/* Day indicator tags */}
                          <div className="flex flex-wrap gap-0.5 pt-1.5 max-h-[22px] overflow-hidden">
                            {dayEvents.slice(0, 3).map((evt) => (
                              <div 
                                key={evt.id} 
                                title={evt.title}
                                className={`w-full text-[7px] truncate px-1 rounded-sm leading-tight py-0.5 font-bold ${
                                  evt.status === 'draf' 
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100/30' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100/30'
                                }`}
                              >
                                {evt.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[6px] text-gray-400 font-bold block pl-1">+{dayEvents.length - 3} lagi</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-400 pt-2 font-bold justify-between border-t border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0" />
                        <span>Selesai / Rasmi</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0" />
                        <span>Draf Perancangan</span>
                      </div>
                    </div>
                    <span>* Pilih tarikh untuk menapis senarai</span>
                  </div>

                </div>
              )}

              {/* LIST FEED */}
              <div className={`${viewMode === 'kalender' ? 'lg:col-span-5' : 'w-full'} space-y-4`}>
                
                {/* Header of event list */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Senarai Aktiviti ({displayEvents.length})</span>
                    {selectedDate && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-extrabold normal-case">
                        Tapis Tarikh: {selectedDate}
                      </span>
                    )}
                  </h3>

                  {selectedDate && (
                    <button 
                      onClick={() => setSelectedDate(null)}
                      className="text-[9px] text-red-500 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      Padam Tapis <X size={10} className="stroke-[3]" />
                    </button>
                  )}
                </div>

                {/* EVENTS LIST FEED */}
                {displayEvents.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-3 shadow-xs">
                    <CalendarIcon size={28} className="mx-auto text-gray-300" />
                    <div className="space-y-1">
                      <p className="text-xs text-slate-800 font-black">Tiada aktiviti ditemui</p>
                      <p className="text-[10px] text-gray-400 max-w-[200px] mx-auto font-medium">
                        {selectedDate 
                          ? `Tiada program dijadualkan bagi tarikh ${selectedDate}.`
                          : `Tiada aktiviti dikesan bagi tapisan bulan/tahun semasa. Sila tekan tab "Isi Aktiviti Baharu" untuk menerbitkan program baharu.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {displayEvents.map(evt => {
                      const todayObj = new Date();
                      todayObj.setHours(0, 0, 0, 0);
                      const isPast = evt.rawDate && new Date(evt.rawDate) < todayObj;
                      return (
                        <div
                          key={evt.id}
                          className={`bg-white rounded-xl border p-4 shadow-xs transition-all relative group ${
                            evt.status === 'draf' 
                              ? 'border-l-[4px] border-l-amber-500 border-gray-150 hover:border-amber-200' 
                              : 'border-l-[4px] border-l-emerald-500 border-gray-150 hover:border-emerald-200'
                          }`}
                        >
                          {/* Upper badging row */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-1.5 items-center">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                evt.status === 'draf' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {evt.status === 'draf' ? 'Draf' : 'Rasmi'}
                                {isPast && evt.status === 'rasmi' && <span className="text-[8px] font-bold text-gray-400 normal-case ml-1.5">• Selesai</span>}
                              </span>
                              {evt.isFromKertasKerja && (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wider flex items-center gap-0.5">
                                  Kertas Kerja
                                </span>
                              )}
                            </div>

                            {/* Date Badge summary */}
                            <div className="text-[10px] text-indigo-600 font-black bg-slate-50 border border-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CalendarIcon size={11} />
                              {evt.day} {evt.month}
                            </div>
                          </div>

                          {/* Main title & info */}
                          <div className="space-y-2">
                            <h4 className="font-extrabold text-xs md:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                              {evt.title}
                            </h4>

                            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-semibold bg-slate-50 p-2 rounded-lg border border-gray-50">
                              <span className="flex items-center gap-1.5 truncate">
                                <MapPin size={11} className="text-gray-400 shrink-0" />
                                {evt.location}
                              </span>
                              <span className="flex items-center gap-1.5 truncate">
                                <Clock size={11} className="text-gray-400 shrink-0" />
                                {evt.time}
                              </span>
                            </div>

                            <p className="text-[10px] text-gray-400 font-bold">
                              📅 {evt.date}
                            </p>
                          </div>

                          {/* Action buttons row */}
                          {hasCommitteeAccess && (
                            <div className="flex items-center justify-end gap-1.5 mt-3 pt-2.5 border-t border-slate-50">
                              {evt.isFromKertasKerja ? (
                                <span className="text-[9px] text-rose-600 font-bold bg-rose-50/60 px-2 py-1 rounded-lg border border-rose-100/50 flex items-center gap-1">
                                  🔒 Diuruskan via Kertas Kerja
                                </span>
                              ) : (
                                <>
                                  {evt.status === 'draf' && (
                                    <button
                                      onClick={() => handlePromotion(evt.id, evt.title)}
                                      className="px-2.5 py-1 text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-emerald-100"
                                    >
                                      <ArrowRightLeft size={10} />
                                      Lulus Ke Rasmi
                                    </button>
                                  )}

                                  <button
                                    onClick={() => openEditModal(evt)}
                                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-indigo-100"
                                    title="Kemaskini"
                                  >
                                    <Edit2 size={12} />
                                  </button>

                                  <button
                                    onClick={() => handleDelete(evt.id, evt.title)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-red-100"
                                    title="Padam"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

            </div>
          </div>

        </div>
      )}

      {/* 2. TAB BORANG PENGISIAN AKTIVITI */}
      {activeSubTab === 'borang' && (
        <form onSubmit={handleAddSubmit} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-6">
          <div className="border-b border-slate-50 pb-3">
            <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Borang Pendaftaran Aktiviti Sekolah & PIBG</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Sila lengkapkan butiran program di bawah untuk rekod arkib takwim persekolahan SMA Ulu Jempol.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nama Aktiviti */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Nama Aktiviti / Program <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="Contoh: Gotong-Royong Perdana Pembersihan Taman"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Lokasi */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Lokasi Aktiviti <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="Contoh: Padang Permainan & Balai Raya"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Tarikh Mula */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Tarikh Mula <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={formRawDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormRawDate(val);
                  setFormRawEndDate(val); // Tarikh tamat ikut tarikh mula
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
                value={formRawEndDate}
                onChange={(e) => setFormRawEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            {/* Masa Mula */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Masa Mula <span className="text-red-500">*</span></label>
              <input
                type="time"
                required
                value={formStartTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormStartTime(val);
                  setFormEndTime(val); // Masa tamat ikut masa mula
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
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Tahap Status (Rasmi vs Draf) */}
          <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-gray-100">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">Tahap Kelulusan Takwim <span className="text-red-500">*</span></label>
            <p className="text-[10px] text-gray-400 mb-3">Pilih jika aktiviti ini berstatus "Rasmi" (sah berlaku) atau "Draf" (dalam perancangan/cadangan).</p>
            
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setFormStatus('rasmi')}
                className={`py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  formStatus === 'rasmi' 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs' 
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-100'
                }`}
              >
                🟢 Takwim Rasmi (Pasti)
              </button>
              <button
                type="button"
                onClick={() => setFormStatus('draf')}
                className={`py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                  formStatus === 'draf' 
                    ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-xs' 
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-100'
                }`}
              >
                🟡 Takwim Draf (Cadangan)
              </button>
            </div>
          </div>

          {/* Action Buttons */}
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
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-lg transition-all cursor-pointer"
            >
              Terbitkan ke Takwim
            </button>
          </div>
        </form>
      )}

      {/* 3. EDIT MODAL POPUP FOR DIRECT ACTIONS ON DASHBOARD */}
      {showEditModal && editingEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden select-none text-slate-800">
            
            <div className="bg-indigo-950 px-5 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-indigo-300" />
                <h3 className="text-xs md:text-sm font-black uppercase tracking-wide">
                  Kemaskini Butiran Aktiviti
                </h3>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingEvent(null); }}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Nama Aktiviti</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Lokasi Program</label>
                <input
                  type="text"
                  required
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Mula</label>
                  <input
                    type="date"
                    required
                    value={formRawDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormRawDate(val);
                      setFormRawEndDate(val); // Tarikh tamat ikut tarikh mula
                    }}
                    className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Tamat</label>
                  <input
                    type="date"
                    required
                    value={formRawEndDate}
                    onChange={(e) => setFormRawEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Masa Mula</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormStartTime(val);
                      setFormEndTime(val); // Masa tamat ikut masa mula
                    }}
                    className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Masa Tamat</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-gray-100">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Pilih Tahap Takwim</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('rasmi')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                      formStatus === 'rasmi' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-100'
                    }`}
                  >
                    🟢 Takwim Rasmi
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('draf')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                      formStatus === 'draf' 
                        ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-xs' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-100'
                    }`}
                  >
                    🟡 Takwim Draf
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingEvent(null); }}
                  className="px-4 py-2 bg-slate-50 text-slate-600 font-bold text-xs rounded-xl border border-gray-150 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
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
