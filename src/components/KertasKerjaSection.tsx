import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy, where, setDoc } from 'firebase/firestore';
import { FileSpreadsheet, Plus, Trash2, PenTool, Check, Loader2, ArrowLeft, Eye, Save, AlertTriangle, X, Printer } from 'lucide-react';
import { KertasKerja, ActiveMember } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface KertasKerjaSectionProps {
  isMobile: boolean;
  onBack?: () => void;
}

export default function KertasKerjaSection({ isMobile, onBack }: KertasKerjaSectionProps) {
  const { firebaseUser, currentUserDoc, allUsers } = useAuth();
  const user = firebaseUser;
  const userRole = currentUserDoc?.role;

  const dbPengerusi = allUsers?.find(u => u.role === 'Pengerusi');
  const dbSetiausaha = allUsers?.find(u => u.role === 'Setiausaha');
  const dbBendahari = allUsers?.find(u => u.role === 'Bendahari');
  const [activeTab, setActiveTab] = useState<'senarai' | 'borang'>('senarai');
  const [kertasKerjaList, setKertasKerjaList] = useState<KertasKerja[]>([]);
  const [ahliList, setAhliList] = useState<ActiveMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // AI State
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');

  // Form State
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [signatureConfirm, setSignatureConfirm] = useState<{ kk: KertasKerja; as: 'disediakan' | 'disemak' | 'disahkan' } | null>(null);
  
  // Signature Canvas Drawing States & Ref
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Signature Pad Event Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1e3a8a'; // dark blue
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const [formData, setFormData] = useState<Partial<KertasKerja>>({
    tajuk: '',
    tarikh: new Date().toISOString().split('T')[0],
    pengenalan: '',
    objektif: [''],
    pelaksanaan: {
      tarikh: new Date().toISOString().split('T')[0],
      masa: new Date().toTimeString().substring(0, 5),
      tempatBerkumpul: '',
      destinasi: '',
      tarikhMula: new Date().toISOString().split('T')[0],
      tarikhTamat: new Date().toISOString().split('T')[0],
      masaMula: '08:00',
      masaTamat: '17:00'
    },
    kumpulanSasar: '',
    anggaranKos: [],
    jumlahKos: 0,
    sumberKewangan: [],
    jumlahPendapatan: 0,
    penganjur: '',
    jadualAktiviti: [],
    strategiPelaksanaan: '',
    kawalanPenyeliaan: 'AJK Tertinggi:\nPengerusi:\nNaib Pengerusi:\nSetiausaha:\nNaib Setiausaha:\nBendahari:\n',
    senaraiAhliJawatanKuasa: [
      { jawatan: 'Pengarah Program', tugas: 'Memantau dan mengawal selia program', nama: '', uid: '' },
      { jawatan: 'Timbalan Pengarah', tugas: 'Membantu pengarah', nama: '', uid: '' },
    ],
    penutup: '',
    bendahariProgramNama: '',
    bendahariProgramUid: '',
    status: 'Draf'
  });

  useEffect(() => {
    fetchKertasKerja();
    fetchAhli();
  }, []);

  const parseEventDateForTakwim = (rawDateStr: string) => {
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
    const malayMonthNames = [
      'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
      'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
    ];
    
    return {
      day: d.getDate().toString(),
      month: monthsAbbr[d.getMonth()],
      formatted: `${days[d.getDay()]}, ${d.getDate()} ${malayMonthNames[d.getMonth()]} ${d.getFullYear()}`
    };
  };

  const formatTimeToMalayForTakwim = (timeStr: string) => {
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

  const formatEventTimeRangeForTakwim = (startTimeStr: string, endTimeStr: string) => {
    if (!startTimeStr) return '';
    const startFormatted = formatTimeToMalayForTakwim(startTimeStr);
    if (!endTimeStr || startTimeStr === endTimeStr) {
      return startFormatted;
    }
    const endFormatted = formatTimeToMalayForTakwim(endTimeStr);
    return `${startFormatted} - ${endFormatted}`;
  };

  const formatEventDateRangeForTakwim = (startDateStr: string, endDateStr: string) => {
    const startParsed = parseEventDateForTakwim(startDateStr);
    if (!endDateStr || startDateStr === endDateStr) {
      return startParsed.formatted;
    }
    const endParsed = parseEventDateForTakwim(endDateStr);
    return `${startParsed.formatted} sehingga ${endParsed.formatted}`;
  };

  const syncKertasKerjaToTakwim = async (kkId: string, kk: any) => {
    try {
      const rawDate = kk.pelaksanaan?.tarikhMula || kk.pelaksanaan?.tarikh || new Date().toISOString().split('T')[0];
      const rawEndDate = kk.pelaksanaan?.tarikhTamat || rawDate;
      const startTime = kk.pelaksanaan?.masaMula || kk.pelaksanaan?.masa || '08:00';
      const endTime = kk.pelaksanaan?.masaTamat || startTime;

      const { day, month } = parseEventDateForTakwim(rawDate);
      const formattedDateRange = formatEventDateRangeForTakwim(rawDate, rawEndDate);
      const formattedTimeRange = formatEventTimeRangeForTakwim(startTime, endTime);

      const eventStatus = (kk.status === 'Lulus' || kk.status === 'Selesai') ? 'rasmi' : 'draf';

      const eventPayload = {
        id: `kk-${kkId}`,
        title: kk.tajuk || 'Kertas Kerja Tanpa Tajuk',
        location: kk.pelaksanaan?.destinasi || kk.pelaksanaan?.tempatBerkumpul || 'Akan ditentukan',
        date: formattedDateRange,
        time: formattedTimeRange,
        day,
        month,
        status: eventStatus,
        rawDate,
        rawEndDate,
        startTime,
        endTime,
        kertasKerjaId: kkId,
        isFromKertasKerja: true
      };

      await setDoc(doc(db, 'events', `kk-${kkId}`), eventPayload);
    } catch (err) {
      console.error("Error syncing Kertas Kerja to Takwim:", err);
    }
  };

  const fetchKertasKerja = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'kertasKerja'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data: KertasKerja[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KertasKerja));
      setKertasKerjaList(data);
      
      // Sync each fetched Kertas Kerja as an event in Takwim (running concurrently)
      await Promise.all(data.map(kk => syncKertasKerjaToTakwim(kk.id, kk)));
    } catch (err) {
      console.error("Error fetching Kertas Kerja:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAhli = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => {
          const u = doc.data();
          const displayName = u.displayName || u.name || 'Tanpa Nama';
          return {
            uid: doc.id,
            ...u,
            name: displayName
          } as ActiveMember;
        })
        .filter(u => {
          const uAny = u as any;
          return uAny.membershipStatus === 'Aktif' || (uAny.role && uAny.role !== 'Pelawat');
        });
      setAhliList(data);
      
      // Auto-populate AJK Tertinggi if it's a new form
      if (!currentId) {
        const pengerusi = data.find(u => u.role === 'Pengerusi')?.name || '';
        const naibPengerusi = data.find(u => u.role === 'Naib Pengerusi')?.name || '';
        const su = data.find(u => u.role === 'Setiausaha')?.name || '';
        const naibSu = data.find(u => u.role === 'Naib Setiausaha' || u.role === 'Penolong Setiausaha')?.name || '';
        const bendahari = data.find(u => u.role === 'Bendahari')?.name || '';
        
        setFormData(prev => ({
          ...prev,
          kawalanPenyeliaan: `AJK Tertinggi:\nPengerusi: ${pengerusi}\nNaib Pengerusi: ${naibPengerusi}\nSetiausaha: ${su}\nNaib Setiausaha: ${naibSu}\nBendahari: ${bendahari}\n`
        }));
      }
    } catch (err) {
      console.error("Error fetching Ahli:", err);
    }
  };

  const handleChange = (field: keyof KertasKerja, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateAI = async () => {
    if (!aiInstruction.trim() && !formData.tajuk?.trim()) {
      alert("Sila masukkan tajuk atau arahan untuk AI menjana kertas kerja.");
      return;
    }
    setIsAiGenerating(true);
    try {
      const response = await fetch('/api/kertas-kerja/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instruction: aiInstruction, 
          tajuk: formData.tajuk,
          tarikhKertasKerja: formData.tarikh,
          tarikhPelaksanaan: formData.pelaksanaan?.tarikh,
          masaPelaksanaan: formData.pelaksanaan?.masa,
        })
      });
      if (!response.ok) throw new Error("Gagal menjana AI");
      const data = await response.json();
      setFormData(prev => ({
        ...prev,
        tajuk: data.tajuk || prev.tajuk,
        pengenalan: data.pengenalan || prev.pengenalan,
        objektif: data.objektif || prev.objektif,
        pelaksanaan: {
          tarikh: data.pelaksanaan?.tarikh || prev.pelaksanaan?.tarikh || prev.tarikh || '',
          masa: data.pelaksanaan?.masa || prev.pelaksanaan?.masa || '',
          tempatBerkumpul: data.pelaksanaan?.tempatBerkumpul || prev.pelaksanaan?.tempatBerkumpul || '',
          destinasi: data.pelaksanaan?.destinasi || prev.pelaksanaan?.destinasi || '',
          tarikhMula: data.pelaksanaan?.tarikhMula || data.pelaksanaan?.tarikh || prev.pelaksanaan?.tarikhMula || '',
          tarikhTamat: data.pelaksanaan?.tarikhTamat || data.pelaksanaan?.tarikh || prev.pelaksanaan?.tarikhTamat || '',
          masaMula: data.pelaksanaan?.masaMula || data.pelaksanaan?.masa || prev.pelaksanaan?.masaMula || '',
          masaTamat: data.pelaksanaan?.masaTamat || prev.pelaksanaan?.masaTamat || '',
        },
        kumpulanSasar: data.kumpulanSasar || prev.kumpulanSasar,
        anggaranKos: data.anggaranKos || prev.anggaranKos,
        jumlahKos: data.jumlahKos || data.anggaranKos?.reduce((sum: number, item: any) => sum + (Number(item.jumlah) || 0), 0) || 0,
        sumberKewangan: data.sumberKewangan || prev.sumberKewangan,
        jumlahPendapatan: data.jumlahPendapatan || data.sumberKewangan?.reduce((sum: number, item: any) => sum + (Number(item.jumlah) || 0), 0) || 0,
        penganjur: data.penganjur || prev.penganjur,
        jadualAktiviti: data.jadualAktiviti || prev.jadualAktiviti,
        strategiPelaksanaan: data.strategiPelaksanaan || prev.strategiPelaksanaan,
        kawalanPenyeliaan: data.kawalanPenyeliaan || prev.kawalanPenyeliaan,
        senaraiAhliJawatanKuasa: data.senaraiAhliJawatanKuasa || prev.senaraiAhliJawatanKuasa,
        penutup: data.penutup || prev.penutup,
      }));
      alert("Berjaya dijana!");
    } catch (err) {
      console.error(err);
      alert("Gagal menjana dari AI.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanUndefined = (val: any): any => {
        if (Array.isArray(val)) {
          return val.map(cleanUndefined);
        } else if (val !== null && typeof val === 'object') {
          const res: any = {};
          for (const k of Object.keys(val)) {
            if (val[k] !== undefined) {
              res[k] = cleanUndefined(val[k]);
            }
          }
          return res;
        }
        return val;
      };

      const defaultDisediakanOleh = {
        nama: currentUserDoc?.displayName || currentUserDoc?.name || '',
        jawatan: userRole || '',
        uid: user?.uid || ''
      };

      const payload = cleanUndefined({
        ...formData,
        disediakanOleh: formData.disediakanOleh || defaultDisediakanOleh,
        updatedAt: new Date().toISOString()
      });

      if (currentId) {
        await updateDoc(doc(db, 'kertasKerja', currentId), payload);
      } else {
        await addDoc(collection(db, 'kertasKerja'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      await fetchKertasKerja();
      setActiveTab('senarai');
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'kertasKerja', deleteConfirmId));
      // Delete corresponding event from Takwim Section
      await deleteDoc(doc(db, 'events', `kk-${deleteConfirmId}`));
      await fetchKertasKerja();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleEdit = (kk: KertasKerja) => {
    setFormData(kk);
    setCurrentId(kk.id);
    setActiveTab('borang');
  };

  const resetForm = () => {
    setCurrentId(null);
    
    const pengerusi = ahliList.find(u => u.role === 'Pengerusi')?.name || '';
    const naibPengerusi = ahliList.find(u => u.role === 'Naib Pengerusi')?.name || '';
    const su = ahliList.find(u => u.role === 'Setiausaha')?.name || '';
    const naibSu = ahliList.find(u => u.role === 'Naib Setiausaha' || u.role === 'Penolong Setiausaha')?.name || '';
    const bendahari = ahliList.find(u => u.role === 'Bendahari')?.name || '';

    setFormData({
      tajuk: '',
      tarikh: new Date().toISOString().split('T')[0],
      pengenalan: '',
      objektif: [''],
      pelaksanaan: {
        tarikh: new Date().toISOString().split('T')[0],
        masa: new Date().toTimeString().substring(0, 5),
        tempatBerkumpul: '',
        destinasi: ''
      },
      kumpulanSasar: '',
      anggaranKos: [],
      jumlahKos: 0,
      sumberKewangan: [],
      jumlahPendapatan: 0,
      penganjur: '',
      jadualAktiviti: [],
      strategiPelaksanaan: '',
      kawalanPenyeliaan: `AJK Tertinggi:\nPengerusi: ${pengerusi}\nNaib Pengerusi: ${naibPengerusi}\nSetiausaha: ${su}\nNaib Setiausaha: ${naibSu}\nBendahari: ${bendahari}\n`,
      senaraiAhliJawatanKuasa: [
        { jawatan: 'Pengarah Program', tugas: 'Memantau dan mengawal selia program', nama: '', uid: '' },
        { jawatan: 'Timbalan Pengarah', tugas: 'Membantu pengarah', nama: '', uid: '' },
      ],
      penutup: '',
      bendahariProgramNama: '',
      bendahariProgramUid: '',
      status: 'Draf'
    });
    setAiInstruction('');
  };

  const handleUpdateStatus = async (kkId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'kertasKerja', kkId), { status: newStatus });
      await fetchKertasKerja();
    } catch (err) {
      console.error("Gagal mengemaskini status:", err);
      alert("Gagal menukar status.");
    }
  };

  const formatTarikhMelayu = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
        'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
      ];
      const dayName = days[d.getDay()];
      const dayNum = d.getDate();
      const monthName = months[d.getMonth()];
      const year = d.getFullYear();
      return `${dayNum} ${monthName} ${year} (${dayName})`;
    } catch (e) {
      return dateStr;
    }
  };

  const handlePrint = (kk: KertasKerja) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Sila benarkan popup untuk mencetak kertas kerja.");
      return;
    }

    const getPrintName = (sigObj: any, dbUser: any) => {
      if (sigObj?.tarikh && sigObj?.nama) {
        return sigObj.nama.toUpperCase();
      }
      if (dbUser) {
        return (dbUser.displayName || dbUser.name || '').toUpperCase();
      }
      return 'BELUM DILANTIK';
    };

    const namaSU = getPrintName(kk.disediakanOleh, dbSetiausaha);
    const namaBen = getPrintName(kk.disemakOleh, dbBendahari);
    const namaPeng = getPrintName(kk.disahkanOleh, dbPengerusi);

    const formattedTarikh = formatTarikhMelayu(kk.tarikh);
    const formattedPelaksanaanTarikhMula = formatTarikhMelayu(kk.pelaksanaan?.tarikhMula || kk.pelaksanaan?.tarikh);
    const formattedPelaksanaanTarikhTamat = formatTarikhMelayu(kk.pelaksanaan?.tarikhTamat || kk.pelaksanaan?.tarikh);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ms">
      <head>
        <meta charset="UTF-8">
        <title>Cetak Kertas Kerja - ${kk.tajuk}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #000;
            line-height: 1.5;
            padding: 0;
            margin: 0;
            background-color: #f3f4f6;
          }
          
          .print-page {
            background: #fff;
            width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            padding: 25mm 20mm;
            box-sizing: border-box;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }

          .no-print-toolbar {
            background: #1e293b;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
            font-family: system-ui, -apple-system, sans-serif;
          }

          .btn-print {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
          }

          .btn-print:hover {
            background-color: #1d4ed8;
          }

          .btn-close {
            background-color: transparent;
            color: #94a3b8;
            border: 1px solid #475569;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          }

          .btn-close:hover {
            color: #fff;
            border-color: #94a3b8;
          }

          .doc-header {
            text-align: center;
            margin-bottom: 50px;
            line-height: 1.3;
          }

          .doc-header h1 {
            font-size: 18pt;
            font-weight: bold;
            margin: 0 0 10px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .doc-header h2 {
            font-size: 14pt;
            font-weight: bold;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }

          .doc-header h3 {
            font-size: 12pt;
            font-weight: bold;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }

          .doc-header h4 {
            font-size: 12pt;
            font-weight: bold;
            margin: 0;
          }

          .doc-date {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 40px;
          }

          .section-container {
            margin-bottom: 30px;
          }

          .section-title {
            font-size: 11pt;
            font-weight: bold;
            margin: 0 0 12px 0;
          }

          .section-text {
            font-size: 11pt;
            margin: 0 0 15px 0;
            text-align: justify;
            white-space: pre-wrap;
          }

          .bullet-list {
            margin: 0 0 15px 0;
            padding-left: 20px;
          }

          .bullet-list li {
            font-size: 11pt;
            margin-bottom: 8px;
            list-style-type: disc;
          }

          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }

          .info-table td {
            font-size: 11pt;
            padding: 6px 0;
            vertical-align: top;
          }

          .item-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          .item-table th, .item-table td {
            border: 1px solid #000;
            padding: 10px 12px;
            font-size: 11pt;
            text-align: left;
          }

          .item-table th {
            background-color: #f2f2f2;
            font-weight: bold;
          }

          .total-row td {
            border: none;
            border-top: 1px solid #000;
            padding-top: 15px;
          }

          .signatures-stack {
            margin-top: 60px;
            display: flex;
            flex-direction: column;
            gap: 60px;
          }

          .signature-block {
            page-break-inside: avoid;
            width: 320px;
          }

          .sig-label {
            font-size: 11pt;
            margin: 0 0 5px 0;
          }

          .sig-image-container {
            height: 80px;
            display: flex;
            align-items: flex-end;
            margin-bottom: -15px;
          }

          .sig-img {
            max-height: 80px;
            max-width: 280px;
            object-fit: contain;
            mix-blend-mode: multiply;
          }

          .sig-line {
            font-size: 11pt;
            margin: 0 0 5px 0;
            letter-spacing: 1px;
          }

          .sig-name {
            font-size: 11pt;
            font-weight: bold;
            margin: 0 0 2px 0;
            text-transform: uppercase;
          }

          .sig-role {
            font-size: 11pt;
            margin: 0 0 2px 0;
          }

          .sig-org {
            font-size: 11pt;
            margin: 0 0 2px 0;
          }

          .sig-date {
            font-size: 9pt;
            color: #444;
            margin: 4px 0 0 0;
          }

          @media print {
            body {
              background-color: #fff;
            }

            .no-print-toolbar {
              display: none;
            }

            .print-page {
              width: 100%;
              min-height: auto;
              margin: 0;
              padding: 0;
              box-shadow: none;
            }

            thead {
              display: table-header-group;
            }

            tr, .section-container, .signature-block {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-toolbar">
          <div style="font-weight: bold; font-size: 16px;">Pratinjau Cetak Kertas Kerja</div>
          <div style="display: flex; gap: 12px;">
            <button class="btn-close" onclick="window.close()">Tutup</button>
            <button class="btn-print" onclick="window.print()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
              Cetak Dokumen
            </button>
          </div>
        </div>

        <div class="print-page">
          <!-- Header -->
          <div class="doc-header">
            <h1>KERTAS KERJA</h1>
            <h2>${kk.tajuk.toUpperCase()}</h2>
            <h3>SEKOLAH MENENGAH AGAMA ULU JEMPOL</h3>
            <h3>BATU KIKIR NEGERI SEMBILAN</h3>
            <h4>${new Date(kk.tarikh || Date.now()).getFullYear()}</h4>
          </div>

          <div class="doc-date">
            Tarikh : ${formattedTarikh}
          </div>

          <!-- 1.0 Pengenalan -->
          <div class="section-container">
            <h3 class="section-title">1.0 Pengenalan</h3>
            <p class="section-text">${kk.pengenalan || '-'}</p>
          </div>

          <!-- 2.0 Objektif -->
          <div class="section-container">
            <h3 class="section-title">2.0 Objektif</h3>
            <ul class="bullet-list">
              ${(kk.objektif || []).map(obj => obj.trim() ? `<li>${obj}</li>` : '').join('') || '<li>Tiada objektif dinyatakan</li>'}
            </ul>
          </div>

          <!-- 3.0 Pelaksanaan -->
          <div class="section-container">
            <h3 class="section-title">3.0 Pelaksanaan</h3>
            <table class="info-table">
              <tr>
                <td style="width: 180px; font-weight: bold;">Tarikh Mula</td>
                <td style="width: 20px;">:</td>
                <td>${formattedPelaksanaanTarikhMula || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Tarikh Tamat</td>
                <td>:</td>
                <td>${formattedPelaksanaanTarikhTamat || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Masa Mula</td>
                <td>:</td>
                <td>${kk.pelaksanaan?.masaMula || kk.pelaksanaan?.masa || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Masa Tamat</td>
                <td>:</td>
                <td>${kk.pelaksanaan?.masaTamat || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Tempat Berkumpul</td>
                <td>:</td>
                <td>${kk.pelaksanaan?.tempatBerkumpul || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Destinasi / Tempat</td>
                <td>:</td>
                <td>${kk.pelaksanaan?.destinasi || '-'}</td>
              </tr>
            </table>
          </div>

          <!-- 4.0 Kumpulan Sasar -->
          <div class="section-container">
            <h3 class="section-title">4.0 Kumpulan Sasar</h3>
            <p class="section-text">${kk.kumpulanSasar || '-'}</p>
          </div>

          <!-- 5.0 Anggaran Kos Perbelanjaan -->
          <div class="section-container">
            <h3 class="section-title">5.0 Anggaran Kos Perbelanjaan</h3>
            <table class="item-table">
              <thead>
                <tr>
                  <th style="width: 60px; text-align: center;">No.</th>
                  <th>Butiran Perbelanjaan</th>
                  <th style="width: 160px; text-align: right;">Jumlah (RM)</th>
                </tr>
              </thead>
              <tbody>
                ${(kk.anggaranKos || []).map((kos, index) => `
                  <tr>
                    <td style="text-align: center;">5.${index + 1}</td>
                    <td>${kos.perkara}</td>
                    <td style="text-align: right;">${Number(kos.jumlah).toFixed(2)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="3" style="text-align: center;">Tiada anggaran kos dinyatakan</td></tr>'}
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; font-weight: bold;">Jumlah</td>
                  <td style="text-align: right; font-weight: bold; text-decoration: underline; border-bottom: 2px double black;">RM ${Number(kk.jumlahKos || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 6.0 Sumber Kewangan -->
          <div class="section-container">
            <h3 class="section-title">6.0 Sumber Kewangan</h3>
            <table class="item-table">
              <thead>
                <tr>
                  <th style="width: 60px; text-align: center;">No.</th>
                  <th>Butiran Sumber Kewangan</th>
                  <th style="width: 160px; text-align: right;">Jumlah (RM)</th>
                </tr>
              </thead>
              <tbody>
                ${(kk.sumberKewangan || []).map((sumber, index) => `
                  <tr>
                    <td style="text-align: center;">6.${index + 1}</td>
                    <td>${sumber.perkara}</td>
                    <td style="text-align: right;">${Number(sumber.jumlah).toFixed(2)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="3" style="text-align: center;">Tiada sumber kewangan dinyatakan</td></tr>'}
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; font-weight: bold;">Jumlah Pendapatan</td>
                  <td style="text-align: right; font-weight: bold; text-decoration: underline; border-bottom: 2px double black;">RM ${Number(kk.jumlahPendapatan || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 7.0 Penganjur -->
          <div class="section-container">
            <h3 class="section-title">7.0 Penganjur</h3>
            <p class="section-text">${kk.penganjur || '-'}</p>
          </div>

          <!-- 8.0 Jadual Aktiviti -->
          <div class="section-container">
            <h3 class="section-title">8.0 Jadual Aktiviti</h3>
            <table class="item-table">
              <thead>
                <tr>
                  <th style="width: 220px;">Tarikh & Masa</th>
                  <th>Aktiviti / Program</th>
                </tr>
              </thead>
              <tbody>
                ${(kk.jadualAktiviti || []).map(jadual => `
                  <tr>
                    <td style="vertical-align: top;">
                      <div style="font-weight: bold;">${formatTarikhMelayu(jadual.tarikh)}</div>
                      <div style="font-size: 10pt; color: #555; margin-top: 4px;">Masa: ${jadual.masa || '-'}</div>
                    </td>
                    <td style="vertical-align: top; white-space: pre-wrap;">${jadual.aktiviti}</td>
                  </tr>
                `).join('') || '<tr><td colspan="2" style="text-align: center;">Tiada jadual aktiviti dinyatakan</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 9.0 Strategi Pelaksanaan -->
          <div class="section-container">
            <h3 class="section-title">9.0 Strategi Pelaksanaan</h3>
            <p class="section-text">${kk.strategiPelaksanaan || '-'}</p>
          </div>

          <!-- 10.0 Kawalan & Penyeliaan -->
          <div class="section-container">
            <h3 class="section-title">10.0 Kawalan & Penyeliaan</h3>
            <p class="section-text">${kk.kawalanPenyeliaan || '-'}</p>
          </div>

          <!-- 11.0 Ahli Jawatankuasa -->
          <div class="section-container">
            <h3 class="section-title">11.0 Ahli Jawatankuasa</h3>
            <ul class="bullet-list">
              ${(kk.senaraiAhliJawatanKuasa || []).map(ajk => `
                <li><strong>${ajk.jawatan}</strong> : ${ajk.nama}</li>
              `).join('') || '<li>Tiada jawatankuasa dinyatakan</li>'}
            </ul>
          </div>

          <!-- 12.0 Senarai Ahli Jawatankuasa (Tugas-Tugas) -->
          <div class="section-container">
            <h3 class="section-title">12.0 Senarai Ahli Jawatankuasa</h3>
            <table class="item-table">
              <thead>
                <tr>
                  <th style="width: 250px;">Jawatan Kuasa & Nama</th>
                  <th>Tugas-Tugas</th>
                </tr>
              </thead>
              <tbody>
                ${(kk.senaraiAhliJawatanKuasa || []).map(ajk => `
                  <tr>
                    <td style="vertical-align: top;">
                      <div style="font-weight: bold; text-decoration: underline; text-transform: uppercase;">${ajk.jawatan}</div>
                      <div style="margin-top: 4px; font-style: italic;">${ajk.nama}</div>
                    </td>
                    <td style="vertical-align: top; white-space: pre-wrap;">${ajk.tugas}</td>
                  </tr>
                `).join('') || '<tr><td colspan="2" style="text-align: center;">Tiada senarai tugas dinyatakan</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 13.0 Penutup -->
          <div class="section-container">
            <h3 class="section-title">13.0 Penutup</h3>
            <p class="section-text">${kk.penutup || '-'}</p>
          </div>

          <!-- Signatures -->
          <div class="signatures-stack">
            <!-- Disediakan oleh -->
            <div class="signature-block">
              <p class="sig-label">Disediakan oleh,</p>
              <div class="sig-image-container">
                ${kk.disediakanOleh?.tandatangan ? `<img src="${kk.disediakanOleh.tandatangan}" alt="Tandatangan" class="sig-img" />` : '<div style="height: 60px;"></div>'}
              </div>
              <p class="sig-line">.....................................................</p>
              <p class="sig-name">(${namaSU})</p>
              <p class="sig-role">${kk.disediakanOleh?.jawatan || 'Setiausaha'}</p>
              <p class="sig-org">Sekolah Menengah Agama Ulu Jempol</p>
              ${kk.disediakanOleh?.tarikh ? `<p class="sig-date">Tarikh: ${formatTarikhMelayu(kk.disediakanOleh.tarikh.split('T')[0])}</p>` : ''}
            </div>

            <!-- Disemak oleh -->
            <div class="signature-block">
              <p class="sig-label">Disemak oleh,</p>
              <div class="sig-image-container">
                ${kk.disemakOleh?.tandatangan ? `<img src="${kk.disemakOleh.tandatangan}" alt="Tandatangan" class="sig-img" />` : '<div style="height: 60px;"></div>'}
              </div>
              <p class="sig-line">.....................................................</p>
              <p class="sig-name">(${namaBen})</p>
              <p class="sig-role">${kk.disemakOleh?.jawatan || 'Bendahari'}</p>
              <p class="sig-org">Sekolah Menengah Agama Ulu Jempol</p>
              ${kk.disemakOleh?.tarikh ? `<p class="sig-date">Tarikh: ${formatTarikhMelayu(kk.disemakOleh.tarikh.split('T')[0])}</p>` : ''}
            </div>

            <!-- Disahkan oleh -->
            <div class="signature-block">
              <p class="sig-label">Disahkan oleh,</p>
              <div class="sig-image-container">
                ${kk.disahkanOleh?.tandatangan ? `<img src="${kk.disahkanOleh.tandatangan}" alt="Tandatangan" class="sig-img" />` : '<div style="height: 60px;"></div>'}
              </div>
              <p class="sig-line">.....................................................</p>
              <p class="sig-name">(${namaPeng})</p>
              <p class="sig-role">${kk.disahkanOleh?.jawatan || 'Pengerusi'}</p>
              <p class="sig-org">Sekolah Menengah Agama Ulu Jempol</p>
              ${kk.disahkanOleh?.tarikh ? `<p class="sig-date">Tarikh: ${formatTarikhMelayu(kk.disahkanOleh.tarikh.split('T')[0])}</p>` : ''}
            </div>
          </div>

        </div>

        <script>
          // Auto-trigger print dialog after images have loaded
          window.addEventListener('load', () => {
            setTimeout(() => {
              window.print();
            }, 500);
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const signDocument = (kk: KertasKerja, as: 'disediakan' | 'disemak' | 'disahkan') => {
    setSignatureConfirm({ kk, as });
  };

  const isCanvasEmpty = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) return true;
    const buffer = new Uint32Array(
      context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  };

  const executeSignDocument = async () => {
    if (!signatureConfirm) return;
    const { kk, as } = signatureConfirm;
    const actingRole = as === 'disediakan' ? 'Setiausaha' : as === 'disemak' ? 'Bendahari' : 'Pengerusi';
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (isCanvasEmpty(canvas)) {
      alert("Lakaran tandatangan masih kosong. Sila lukis tandatangan anda terlebih dahulu.");
      return;
    }
    
    const signatureUrl = canvas.toDataURL('image/png');
    
    try {
      const activeName = currentUserDoc?.displayName || currentUserDoc?.name || '';
      const signatureData = { 
        nama: userRole === 'Admin Utama' ? `${activeName} (BAGI PIHAK)` : activeName, 
        jawatan: userRole === 'Admin Utama' ? actingRole : (userRole || ''), 
        uid: user?.uid || '', 
        tarikh: new Date().toISOString(),
        tandatangan: signatureUrl
      };
      const fieldName = as === 'disediakan' ? 'disediakanOleh' : as === 'disemak' ? 'disemakOleh' : 'disahkanOleh';
      
      const updateData: any = { [fieldName]: signatureData };
      
      // Auto-approve if status is 'Draf' and all 3 signatures are present
      const willHaveSedia = as === 'disediakan' ? true : !!kk.disediakanOleh?.tarikh;
      const willHaveSemak = as === 'disemak' ? true : !!kk.disemakOleh?.tarikh;
      const willHaveSah = as === 'disahkan' ? true : !!kk.disahkanOleh?.tarikh;
      
      if (kk.status === 'Draf' && willHaveSedia && willHaveSemak && willHaveSah) {
        updateData.status = 'Lulus';
      }
      
      await updateDoc(doc(db, 'kertasKerja', kk.id), updateData);
      
      if (currentId === kk.id) {
        setFormData(prev => {
          const updated = {
            ...prev,
            [fieldName]: signatureData
          };
          if (prev.status === 'Draf' && willHaveSedia && willHaveSemak && willHaveSah) {
            updated.status = 'Lulus';
          }
          return updated;
        });
      }
      
      await fetchKertasKerja();
    } catch (error) {
      console.error(error);
    } finally {
      setSignatureConfirm(null);
    }
  };

  return (
    <div className={`space-y-6 ${isMobile ? 'pb-24' : ''}`}>
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        {onBack && (
          <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h2 className="font-extrabold text-2xl text-slate-900 tracking-tight">Kertas Kerja</h2>
          <p className="text-sm text-slate-500 font-medium">Pengurusan Kertas Kerja Program Persatuan</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/60 rounded-xl overflow-x-auto">
        <button
          onClick={() => { setActiveTab('senarai'); resetForm(); }}
          className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'senarai' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/80'}`}
        >
          Senarai Kertas Kerja
        </button>
        <button
          onClick={() => setActiveTab('borang')}
          className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'borang' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/80'}`}
        >
          {currentId ? 'Edit Kertas Kerja' : 'Tambah Baru'}
        </button>
      </div>

      {activeTab === 'senarai' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : kertasKerjaList.length === 0 ? (
            <div className="text-center p-8 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">Tiada kertas kerja setakat ini.</div>
          ) : (
            kertasKerjaList.map(kk => (
              <div key={kk.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-800">{kk.tajuk}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      kk.status === 'Lulus' ? 'bg-emerald-100 text-emerald-700' :
                      kk.status === 'Ditolak' ? 'bg-rose-100 text-rose-700' :
                      kk.status === 'Selesai' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {kk.status || 'Draf'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Tarikh: {kk.tarikh} | Kos: RM {(kk.jumlahKos || 0).toFixed(2)}</p>
                  <div className="flex gap-2 mt-2 text-[10px] uppercase font-bold text-slate-500">
                    <span className={kk.disediakanOleh?.tarikh ? 'text-emerald-600' : 'text-rose-500'}>Disediakan (SU) {kk.disediakanOleh?.tarikh ? '✓' : '✗'}</span>
                    <span className={kk.disemakOleh?.tarikh ? 'text-emerald-600' : 'text-rose-500'}>Disemak (Bendahari) {kk.disemakOleh?.tarikh ? '✓' : '✗'}</span>
                    <span className={kk.disahkanOleh?.tarikh ? 'text-emerald-600' : 'text-rose-500'}>Disahkan (Pengerusi) {kk.disahkanOleh?.tarikh ? '✓' : '✗'}</span>
                  </div>

                  {/* Status Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-extrabold text-slate-400 mr-1 tracking-wider">TUKAR STATUS:</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(kk.id, 'Draf')}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        kk.status === 'Draf'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Draf
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(kk.id, 'Ditolak')}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        kk.status === 'Ditolak'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Ditolak
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(kk.id, 'Selesai')}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        kk.status === 'Selesai'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Selesai
                    </button>
                    {kk.status === 'Lulus' && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-600 text-white font-bold rounded shadow-sm">
                        Lulus (Selesai Tandatangan)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!kk.disediakanOleh?.tarikh && (userRole === 'Setiausaha' || userRole === 'Admin Utama') && (
                    <button onClick={() => signDocument(kk, 'disediakan')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700">
                      Sedia (SU) {userRole === 'Admin Utama' ? '(BAGI PIHAK)' : ''}
                    </button>
                  )}
                  {!kk.disemakOleh?.tarikh && (userRole === 'Bendahari' || userRole === 'Admin Utama') && (
                    <button onClick={() => signDocument(kk, 'disemak')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700">
                      Semak (Bendahari) {userRole === 'Admin Utama' ? '(BAGI PIHAK)' : ''}
                    </button>
                  )}
                  {!kk.disahkanOleh?.tarikh && (userRole === 'Pengerusi' || userRole === 'Admin Utama') && (
                    <button onClick={() => signDocument(kk, 'disahkan')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700">
                      Sah (Pengerusi) {userRole === 'Admin Utama' ? '(BAGI PIHAK)' : ''}
                    </button>
                  )}
                  
                  <button onClick={() => handlePrint(kk)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="Cetak Kertas Kerja"><Printer size={16} /></button>
                  <button onClick={() => handleEdit(kk)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><PenTool size={16} /></button>
                  <button onClick={() => handleDelete(kk.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-8">
          {/* AI Generator */}
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-indigo-900 mb-1">Arahan AI (Pilihan)</label>
              <input type="text" value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} placeholder="Contoh: Buat kertas kerja pertandingan mewarna kanak-kanak" className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button type="button" onClick={handleGenerateAI} disabled={isAiGenerating} className="mt-5 sm:mt-0 w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap">
              {isAiGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : 'Jana dengan AI'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tajuk Program</label>
              <input required type="text" value={formData.tajuk || ''} onChange={e => handleChange('tajuk', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tarikh Kertas Kerja</label>
              <input required type="date" value={formData.tarikh || ''} onChange={e => handleChange('tarikh', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">1.0 Pengenalan</label>
            <textarea required value={formData.pengenalan || ''} onChange={e => handleChange('pengenalan', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>

          {/* 2.0 Objektif */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">2.0 Objektif</label>
            <div className="space-y-2">
              {(formData.objektif || []).map((obj, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="text-sm font-bold text-slate-500 mt-2">{idx + 1}.</span>
                  <input 
                    type="text" 
                    value={obj || ''} 
                    onChange={e => {
                      const newObj = [...(formData.objektif || [])];
                      newObj[idx] = e.target.value;
                      handleChange('objektif', newObj);
                    }} 
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" 
                  />
                  <button type="button" onClick={() => {
                    const newObj = [...(formData.objektif || [])];
                    newObj.splice(idx, 1);
                    handleChange('objektif', newObj);
                  }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg mt-0.5">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => handleChange('objektif', [...(formData.objektif || []), ''])} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Plus size={14} /> Tambah Objektif
              </button>
            </div>
          </div>

          {/* 3.0 Pelaksanaan */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-black text-slate-800 mb-3">3.0 Pelaksanaan</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tarikh Mula</label>
                <input required type="date" value={formData.pelaksanaan?.tarikhMula || ''} onChange={e => handleChange('pelaksanaan', { ...formData.pelaksanaan, tarikhMula: e.target.value, tarikh: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tarikh Tamat</label>
                <input required type="date" value={formData.pelaksanaan?.tarikhTamat || ''} onChange={e => handleChange('pelaksanaan', { ...formData.pelaksanaan, tarikhTamat: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Masa Mula</label>
                <input required type="time" value={formData.pelaksanaan?.masaMula || ''} onChange={e => handleChange('pelaksanaan', { ...formData.pelaksanaan, masaMula: e.target.value, masa: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Masa Tamat</label>
                <input required type="time" value={formData.pelaksanaan?.masaTamat || ''} onChange={e => handleChange('pelaksanaan', { ...formData.pelaksanaan, masaTamat: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tempat Berkumpul</label>
                <input type="text" value={formData.pelaksanaan?.tempatBerkumpul || ''} onChange={e => handleChange('pelaksanaan', { ...formData.pelaksanaan, tempatBerkumpul: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destinasi / Tempat</label>
                <input required type="text" value={formData.pelaksanaan?.destinasi || ''} onChange={e => handleChange('pelaksanaan', { ...formData.pelaksanaan, destinasi: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">4.0 Kumpulan Sasar</label>
            <textarea required value={formData.kumpulanSasar || ''} onChange={e => handleChange('kumpulanSasar', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>

          {/* 5.0 Anggaran Kos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">5.0 Anggaran Kos Perbelanjaan</label>
              <span className="text-xs font-black text-rose-600">Jumlah: RM {(formData.jumlahKos || 0).toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                <div className="col-span-7 sm:col-span-8">Perkara</div>
                <div className="col-span-4 sm:col-span-3 text-right">Jumlah (RM)</div>
                <div className="col-span-1"></div>
              </div>
              {(formData.anggaranKos || []).map((kos, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7 sm:col-span-8">
                    <input type="text" placeholder="Contoh: Makanan 50 orang x RM10" value={kos.perkara || ''} onChange={e => {
                      const newKos = [...(formData.anggaranKos || [])];
                      newKos[idx].perkara = e.target.value;
                      handleChange('anggaranKos', newKos);
                    }} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <input type="number" step="0.01" value={kos.jumlah ?? ''} onChange={e => {
                      const newKos = [...(formData.anggaranKos || [])];
                      newKos[idx].jumlah = Number(e.target.value);
                      const total = newKos.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
                      setFormData(prev => ({ ...prev, anggaranKos: newKos, jumlahKos: total }));
                    }} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-right" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => {
                      const newKos = [...(formData.anggaranKos || [])];
                      newKos.splice(idx, 1);
                      const total = newKos.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
                      setFormData(prev => ({ ...prev, anggaranKos: newKos, jumlahKos: total }));
                    }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => handleChange('anggaranKos', [...(formData.anggaranKos || []), { perkara: '', jumlah: 0 }])} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2">
                <Plus size={14} /> Tambah Kos
              </button>
            </div>
          </div>

          {/* 6.0 Sumber Kewangan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">6.0 Sumber Kewangan</label>
              <span className="text-xs font-black text-emerald-600">Jumlah Pendapatan: RM {(formData.jumlahPendapatan || 0).toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                <div className="col-span-7 sm:col-span-8">Perkara</div>
                <div className="col-span-4 sm:col-span-3 text-right">Jumlah (RM)</div>
                <div className="col-span-1"></div>
              </div>
              {(formData.sumberKewangan || []).map((sumber, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7 sm:col-span-8">
                    <input type="text" placeholder="Contoh: Kutipan Yuran Khas" value={sumber.perkara || ''} onChange={e => {
                      const newSumber = [...(formData.sumberKewangan || [])];
                      newSumber[idx].perkara = e.target.value;
                      handleChange('sumberKewangan', newSumber);
                    }} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <input type="number" step="0.01" value={sumber.jumlah ?? ''} onChange={e => {
                      const newSumber = [...(formData.sumberKewangan || [])];
                      newSumber[idx].jumlah = Number(e.target.value);
                      const total = newSumber.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
                      setFormData(prev => ({ ...prev, sumberKewangan: newSumber, jumlahPendapatan: total }));
                    }} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-right" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => {
                      const newSumber = [...(formData.sumberKewangan || [])];
                      newSumber.splice(idx, 1);
                      const total = newSumber.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
                      setFormData(prev => ({ ...prev, sumberKewangan: newSumber, jumlahPendapatan: total }));
                    }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => handleChange('sumberKewangan', [...(formData.sumberKewangan || []), { perkara: '', jumlah: 0 }])} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2">
                <Plus size={14} /> Tambah Sumber
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">7.0 Penganjur</label>
            <input required type="text" value={formData.penganjur || ''} onChange={e => handleChange('penganjur', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>

          {/* 8.0 Jadual Aktiviti */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">8.0 Jadual Aktiviti</label>
            <div className="space-y-2 overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">
                  <div className="col-span-3">Tarikh</div>
                  <div className="col-span-2">Masa</div>
                  <div className="col-span-6">Aktiviti</div>
                  <div className="col-span-1"></div>
                </div>
                {(formData.jadualAktiviti || []).map((jadual, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2">
                    <div className="col-span-3">
                      <input type="date" value={jadual.tarikh || ''} onChange={e => {
                        const newJadual = [...(formData.jadualAktiviti || [])];
                        newJadual[idx].tarikh = e.target.value;
                        handleChange('jadualAktiviti', newJadual);
                      }} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <input type="time" value={jadual.masa || ''} onChange={e => {
                        const newJadual = [...(formData.jadualAktiviti || [])];
                        newJadual[idx].masa = e.target.value;
                        handleChange('jadualAktiviti', newJadual);
                      }} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div className="col-span-6">
                      <input type="text" placeholder="Aktiviti" value={jadual.aktiviti || ''} onChange={e => {
                        const newJadual = [...(formData.jadualAktiviti || [])];
                        newJadual[idx].aktiviti = e.target.value;
                        handleChange('jadualAktiviti', newJadual);
                      }} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button type="button" onClick={() => {
                        const newJadual = [...(formData.jadualAktiviti || [])];
                        newJadual.splice(idx, 1);
                        handleChange('jadualAktiviti', newJadual);
                      }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => handleChange('jadualAktiviti', [...(formData.jadualAktiviti || []), { tarikh: formData.pelaksanaan?.tarikh || '', masa: '', aktiviti: '' }])} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2">
                <Plus size={14} /> Tambah Aktiviti
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">9.0 Strategi Pelaksanaan</label>
            <textarea required value={formData.strategiPelaksanaan || ''} onChange={e => handleChange('strategiPelaksanaan', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>

          {/* 10.0 Kawalan Penyeliaan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">10.0 Kawalan & Penyeliaan</label>
            <textarea required value={formData.kawalanPenyeliaan || ''} onChange={e => handleChange('kawalanPenyeliaan', e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>

          {/* 12.0 Senarai AJK Pelaksana */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">11.0 / 12.0 Ahli Jawatankuasa Pelaksana (Tugas)</label>
            <div className="space-y-2 overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">
                  <div className="col-span-3">Jawatan</div>
                  <div className="col-span-4">Tugas</div>
                  <div className="col-span-4">Nama / Ahli</div>
                  <div className="col-span-1"></div>
                </div>
                {(formData.senaraiAhliJawatanKuasa || []).map((ajk, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2">
                    <div className="col-span-3">
                      <input type="text" placeholder="Jawatan" value={ajk.jawatan || ''} onChange={e => {
                        const newAjk = [...(formData.senaraiAhliJawatanKuasa || [])];
                        newAjk[idx].jawatan = e.target.value;
                        handleChange('senaraiAhliJawatanKuasa', newAjk);
                      }} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div className="col-span-4">
                      <input type="text" placeholder="Tugas utama" value={ajk.tugas || ''} onChange={e => {
                        const newAjk = [...(formData.senaraiAhliJawatanKuasa || [])];
                        newAjk[idx].tugas = e.target.value;
                        handleChange('senaraiAhliJawatanKuasa', newAjk);
                      }} className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div className="col-span-4">
                      <select 
                        value={ajk.uid || ''} 
                        onChange={e => {
                          const newAjk = [...(formData.senaraiAhliJawatanKuasa || [])];
                          newAjk[idx].uid = e.target.value;
                          newAjk[idx].nama = e.target.options[e.target.selectedIndex].text;
                          if (!e.target.value) newAjk[idx].nama = '';
                          handleChange('senaraiAhliJawatanKuasa', newAjk);
                        }}
                        className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm"
                      >
                        <option value="">-- Pilih Ahli (Pilihan) --</option>
                        {ahliList.map(ahli => (
                          <option key={ahli.uid} value={ahli.uid}>{ahli.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button type="button" onClick={() => {
                        const newAjk = [...(formData.senaraiAhliJawatanKuasa || [])];
                        newAjk.splice(idx, 1);
                        handleChange('senaraiAhliJawatanKuasa', newAjk);
                      }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => handleChange('senaraiAhliJawatanKuasa', [...(formData.senaraiAhliJawatanKuasa || []), { jawatan: '', tugas: '', nama: '', uid: '' }])} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2">
                <Plus size={14} /> Tambah AJK
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Bendahari Program (Pilihan)</label>
              <select 
                value={formData.bendahariProgramUid || ''} 
                onChange={e => {
                  handleChange('bendahariProgramUid', e.target.value);
                  handleChange('bendahariProgramNama', e.target.value ? e.target.options[e.target.selectedIndex].text : '');
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Tiada Bendahari Khusus --</option>
                {ahliList.map(ahli => (
                  <option key={ahli.uid} value={ahli.uid}>{ahli.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Bendahari program yang dipilih akan bertanggungjawab bagi urusan rekod dan pengurusan kewangan program untuk kertas kerja ini.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">13.0 Penutup</label>
            <textarea required value={formData.penutup || ''} onChange={e => handleChange('penutup', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </div>
          
          <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
            <label className="block text-xs font-bold text-slate-700 mb-2">Status Kertas Kerja</label>
            
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleChange('status', 'Draf')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  formData.status === 'Draf'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Draf
              </button>
              
              <button
                type="button"
                onClick={() => handleChange('status', 'Ditolak')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  formData.status === 'Ditolak'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Ditolak
              </button>
              
              <button
                type="button"
                onClick={() => handleChange('status', 'Selesai')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  formData.status === 'Selesai'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Selesai
              </button>

              {formData.status === 'Lulus' && (
                <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                  <Check size={14} className="stroke-[3]" />
                  <span>Lulus (Selesai Tandatangan)</span>
                </div>
              )}
            </div>
            
            <p className="text-[10px] text-slate-500 mt-1 mb-4">
              * Nota: Status <strong>Lulus</strong> tidak boleh dipilih secara manual. Ia akan dikemaskini secara automatik setelah ketiga-tiga pihak (Setiausaha, Bendahari & Pengerusi) selesai menurunkan tandatangan digital mereka.
            </p>
            
            {currentId && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 border-t border-slate-200 pt-3">Tandatangan Digital Kelulusan (Pengerusi, Setiausaha, Bendahari)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className={`p-3 rounded-lg border text-xs font-bold flex flex-col justify-center items-center ${formData.disediakanOleh?.tarikh ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                    <span>Setiausaha</span>
                    <span className="text-[10px] text-slate-400 font-medium text-center">
                      {dbSetiausaha ? `(${dbSetiausaha.displayName || dbSetiausaha.name})` : '(Belum Dilantik)'}
                    </span>
                    {formData.disediakanOleh?.tarikh ? (
                      <div className="flex flex-col items-center mt-1">
                        {formData.disediakanOleh.tandatangan ? (
                          <img src={formData.disediakanOleh.tandatangan} referrerPolicy="no-referrer" alt="Tandatangan SU" className="max-h-12 object-contain bg-white border border-slate-200 rounded p-1 mb-1 shadow-sm" />
                        ) : null}
                        <span className="text-[10px] font-normal text-center">Ditandatangani oleh {formData.disediakanOleh.nama}</span>
                      </div>
                    ) : (userRole === 'Admin Utama' || (userRole === 'Setiausaha' && dbSetiausaha)) ? (
                      <button type="button" onClick={() => signDocument(formData as KertasKerja, 'disediakan')} className="mt-2 px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md">
                        Tandatangan {userRole === 'Admin Utama' ? '(BAGI PIHAK)' : ''}
                      </button>
                    ) : (
                      <span className="text-[10px] font-normal mt-1">Belum ditandatangani</span>
                    )}
                  </div>
                  
                  <div className={`p-3 rounded-lg border text-xs font-bold flex flex-col justify-center items-center ${formData.disemakOleh?.tarikh ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                    <span>Bendahari</span>
                    <span className="text-[10px] text-slate-400 font-medium text-center">
                      {dbBendahari ? `(${dbBendahari.displayName || dbBendahari.name})` : '(Belum Dilantik)'}
                    </span>
                    {formData.disemakOleh?.tarikh ? (
                      <div className="flex flex-col items-center mt-1">
                        {formData.disemakOleh.tandatangan ? (
                          <img src={formData.disemakOleh.tandatangan} referrerPolicy="no-referrer" alt="Tandatangan Bendahari" className="max-h-12 object-contain bg-white border border-slate-200 rounded p-1 mb-1 shadow-sm" />
                        ) : null}
                        <span className="text-[10px] font-normal text-center">Ditandatangani oleh {formData.disemakOleh.nama}</span>
                      </div>
                    ) : (userRole === 'Admin Utama' || (userRole === 'Bendahari' && dbBendahari)) ? (
                      <button type="button" onClick={() => signDocument(formData as KertasKerja, 'disemak')} className="mt-2 px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md">
                        Tandatangan {userRole === 'Admin Utama' ? '(BAGI PIHAK)' : ''}
                      </button>
                    ) : (
                      <span className="text-[10px] font-normal mt-1">Belum ditandatangani</span>
                    )}
                  </div>

                  <div className={`p-3 rounded-lg border text-xs font-bold flex flex-col justify-center items-center ${formData.disahkanOleh?.tarikh ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                    <span>Pengerusi</span>
                    <span className="text-[10px] text-slate-400 font-medium text-center">
                      {dbPengerusi ? `(${dbPengerusi.displayName || dbPengerusi.name})` : '(Belum Dilantik)'}
                    </span>
                    {formData.disahkanOleh?.tarikh ? (
                      <div className="flex flex-col items-center mt-1">
                        {formData.disahkanOleh.tandatangan ? (
                          <img src={formData.disahkanOleh.tandatangan} referrerPolicy="no-referrer" alt="Tandatangan Pengerusi" className="max-h-12 object-contain bg-white border border-slate-200 rounded p-1 mb-1 shadow-sm" />
                        ) : null}
                        <span className="text-[10px] font-normal text-center">Ditandatangani oleh {formData.disahkanOleh.nama}</span>
                      </div>
                    ) : (userRole === 'Admin Utama' || (userRole === 'Pengerusi' && dbPengerusi)) ? (
                      <button type="button" onClick={() => signDocument(formData as KertasKerja, 'disahkan')} className="mt-2 px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md">
                        Tandatangan {userRole === 'Admin Utama' ? '(BAGI PIHAK)' : ''}
                      </button>
                    ) : (
                      <span className="text-[10px] font-normal mt-1">Belum ditandatangani</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button type="submit" disabled={saving} className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-2">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Simpan Kertas Kerja
            </button>
          </div>
        </form>
      )}

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
            >
              <div className="h-2 w-full bg-red-500" />
              
              {/* Close Button */}
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                title="Batal"
              >
                <X size={18} />
              </button>

              <div className="px-6 pt-8 pb-6 text-center">
                {/* Warning Icon Badge */}
                <div className="mx-auto w-14 h-14 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 shadow-inner">
                  <AlertTriangle size={24} className="stroke-[2.5]" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight mb-2">
                  Padam Kertas Kerja?
                </h3>

                {/* Description */}
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Adakah anda pasti ingin memadam kertas kerja <span className="font-extrabold text-slate-900">"{kertasKerjaList.find(kk => kk.id === deleteConfirmId)?.tajuk || 'ini'}"</span>? Tindakan ini adalah kekal dan tidak boleh diundurkan.
                </p>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={executeDelete}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    <span>Ya, Padam</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Signature Confirmation Modal */}
      <AnimatePresence>
        {signatureConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSignatureConfirm(null)}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
            >
              <div className="h-2 w-full bg-indigo-600" />
              
              {/* Close Button */}
              <button
                onClick={() => setSignatureConfirm(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                title="Batal"
              >
                <X size={18} />
              </button>

              <div className="px-6 pt-8 pb-6">
                {/* Sign Icon Badge */}
                <div className="mx-auto w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600 shadow-inner">
                  <PenTool size={24} className="stroke-[2.5]" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-extrabold text-slate-900 text-center tracking-tight mb-2">
                  Sahkan Tandatangan Digital
                </h3>

                {/* Info Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Program:</span>
                      <span className="text-slate-900 font-bold text-right max-w-[200px] truncate">{signatureConfirm.kk.tajuk}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Penandatangan:</span>
                      <span className="text-slate-900 font-bold">{currentUserDoc?.displayName || currentUserDoc?.name || 'Pengguna'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Jawatan:</span>
                      <span className="text-slate-900 font-bold">
                        {userRole === 'Admin Utama' 
                          ? (signatureConfirm.as === 'disediakan' ? 'Setiausaha' : signatureConfirm.as === 'disemak' ? 'Bendahari' : 'Pengerusi') 
                          : (userRole || 'Ahli')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Digital Signature Drawing Canvas */}
                <div className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden relative shadow-inner mb-2">
                  <div className="absolute top-2 left-2 flex items-center gap-1 text-[8px] font-bold text-indigo-500 tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded-md z-10 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span>LUKIS TANDATANGAN DI SINI</span>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={180}
                    className="w-full bg-white cursor-crosshair touch-none block animate-fade-in"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-6">
                  <span>Gunakan tetikus atau skrin sentuh anda.</span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-rose-500 hover:underline cursor-pointer font-black"
                  >
                    Padam Lakaran
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setSignatureConfirm(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={executeSignDocument}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    <span>Tandatangan</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
