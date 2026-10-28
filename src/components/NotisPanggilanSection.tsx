import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, writeBatch, getDocs, query } from 'firebase/firestore';
import { useAuth, AppUser } from '../context/AuthContext';
import { NotisPanggilan, Kehadiran } from '../types';
import { sortAttendance } from './MinitMesyuaratSection';
import { 
  Plus, Trash2, Edit2, Check, X, Printer, CheckSquare, Square, Users, Calendar, Clock, MapPin, 
  User, ClipboardList, AlertCircle, FileText, CheckCircle2, ChevronRight, Bookmark
} from 'lucide-react';

interface NotisPanggilanSectionProps {
  isMobile?: boolean;
}

export default function NotisPanggilanSection({ isMobile = false }: NotisPanggilanSectionProps) {
  const { currentUserDoc, firebaseUser } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState<'agung_khas' | 'agung'>('agung_khas');
  const [activeSubTab, setActiveSubTab] = useState<'notis' | 'kehadiran'>('notis');

  // Lists from DB
  const [notices, setNotices] = useState<NotisPanggilan[]>([]);
  const [attendances, setAttendances] = useState<Kehadiran[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  // Form State
  const [editNoticeId, setEditNoticeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [dateOfNotice, setDateOfNotice] = useState(new Date().toISOString().split('T')[0]);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingVenue, setMeetingVenue] = useState('');
  const [agendaInput, setAgendaInput] = useState('');
  const [signatureName, setSignatureName] = useState(currentUserDoc?.displayName || currentUserDoc?.nickname || '');
  const [signatureRole, setSignatureRole] = useState(currentUserDoc?.role || 'Setiausaha');

  // Signature States
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<'saved' | 'draw'>('draw');

  // Printing State
  const [printNotice, setPrintNotice] = useState<NotisPanggilan | null>(null);

  // Letterhead Image URL from Jana Surat Rasmi
  const letterheadUrl = '/api/letterhead?v=10ade430-1225-4f58-89ca-87972937912b';
  const directLetterheadUrl = 'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/Letterhead%20Taman%20Musytari%20-Pendek.png?alt=media&token=10ade430-1225-4f58-89ca-87972937912b';
  const [letterheadBase64, setLetterheadBase64] = useState<string | null>(null);

  // Load Letterhead on component mount
  useEffect(() => {
    const fetchLetterhead = async () => {
      try {
        const res = await fetch(letterheadUrl);
        if (!res.ok) throw new Error("Proxy response not OK");
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLetterheadBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn("Fetch letterhead failed in NotisPanggilan, fallback to canvas/direct url:", err);
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = directLetterheadUrl;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              setLetterheadBase64(canvas.toDataURL('image/png'));
            }
          };
        } catch (e) {
          console.error("Error setting up image canvas for letterhead:", e);
        }
      }
    };
    fetchLetterhead();
  }, []);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check roles: "Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha dan Bendahari sahaja"
  const allowedRoles = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Bendahari'];
  const hasAccess = currentUserDoc && (allowedRoles.includes(currentUserDoc.role) || currentUserDoc.isSuperAdmin);

  // Set default form values when active tab changes
  useEffect(() => {
    resetForm();
  }, [activeMainTab]);

  const resetForm = () => {
    setEditNoticeId(null);
    if (activeMainTab === 'agung_khas') {
      setTitle('Notis Panggilan Mesyuarat Agung Khas PIBG SMAUJ');
      setReferenceNo(`SMAUJ/PIBG/NK-${Date.now().toString().slice(-4)}`);
    } else {
      setTitle('Notis Panggilan Mesyuarat Agung Tahunan PIBG SMAUJ');
      setReferenceNo(`SMAUJ/PIBG/AGM-${Date.now().toString().slice(-4)}`);
    }
    setDateOfNotice(new Date().toISOString().split('T')[0]);
    setMeetingDate('');
    setMeetingTime('');
    setMeetingVenue('Dewan Al-Ghazali, Sekolah Menengah Agama Ulu Jempol');
    setAgendaInput("1. Perutusan Pengerusi\n2. Pembentangan dan meluluskan Minit Mesyuarat yang lalu\n3. Pembentangan Laporan Kewangan Tahunan\n4. Pemilihan Ahli Jawatankuasa Baru\n5. Hal-hal lain");
    setSignatureName(currentUserDoc?.displayName || currentUserDoc?.nickname || '');
    setSignatureRole(currentUserDoc?.role || 'Setiausaha');
    
    if (currentUserDoc?.signatureUrl) {
      setSignatureDataUrl(currentUserDoc.signatureUrl);
      setSignatureMode('saved');
    } else {
      setSignatureDataUrl(null);
      setSignatureMode('draw');
    }
    
    setError(null);
  };

  // Fetch Notices, Attendances, and Users
  useEffect(() => {
    if (!db || !hasAccess || !firebaseUser || firebaseUser.uid === 'guest_local') {
      setNotices([]);
      setAttendances([]);
      setUsers([]);
      return;
    }

    const unsubNotices = onSnapshot(collection(db, 'notisPanggilan'), (snapshot) => {
      const list: NotisPanggilan[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as NotisPanggilan);
      });
      // Sort by creation time descending
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setNotices(list);
    }, (err) => console.error("Error fetching notices:", err));

    const unsubKehadiran = onSnapshot(collection(db, 'kehadiran'), (snapshot) => {
      const list: Kehadiran[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Kehadiran);
      });
      setAttendances(list);
    }, (err) => console.error("Error fetching attendance:", err));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: AppUser[] = [];
      snapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() } as AppUser);
      });
      setUsers(list);
    }, (err) => console.error("Error fetching users:", err));

    return () => {
      unsubNotices();
      unsubKehadiran();
      unsubUsers();
    };
  }, [db, hasAccess, firebaseUser]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 shadow-3xs max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">AKSES DITOLAK</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Halaman Notis Panggilan hanya boleh diakses oleh Admin Utama, Pengerusi, Naib Pengerusi, Setiausaha, Naib Setiausaha, dan Bendahari sahaja.
          </p>
        </div>
      </div>
    );
  }

  // Handle Save (Create or Update Notice)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title || !meetingDate || !meetingTime || !meetingVenue) {
      setError("Sila isi semua ruangan wajib.");
      return;
    }

    try {
      const id = editNoticeId || `notice-${Date.now()}`;
      const agendas = agendaInput.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      const noticeData: NotisPanggilan = {
        id,
        type: activeMainTab,
        title,
        referenceNo,
        dateOfNotice,
        meetingDate,
        meetingTime,
        meetingVenue,
        agenda: agendas,
        signatureName,
        signatureRole,
        isTick: editNoticeId ? (notices.find(n => n.id === editNoticeId)?.isTick || false) : false,
        createdAt: editNoticeId ? (notices.find(n => n.id === editNoticeId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        signatureData: signatureDataUrl || ''
      };

      await setDoc(doc(db, 'notisPanggilan', id), noticeData);
      setSuccess(editNoticeId ? "Notis panggilan berjaya dikemas kini!" : "Notis panggilan baru berjaya disimpan!");
      resetForm();
      
      // Auto close success msg after 4s
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      setError("Gagal menyimpan notis panggilan. Sila cuba lagi.");
    }
  };

  // Edit Notice Handler
  const handleEdit = (notice: NotisPanggilan) => {
    setEditNoticeId(notice.id);
    setTitle(notice.title);
    setReferenceNo(notice.referenceNo);
    setDateOfNotice(notice.dateOfNotice);
    setMeetingDate(notice.meetingDate);
    setMeetingTime(notice.meetingTime);
    setMeetingVenue(notice.meetingVenue);
    setAgendaInput(notice.agenda.join('\n'));
    setSignatureName(notice.signatureName);
    setSignatureRole(notice.signatureRole);
    if (notice.signatureData) {
      setSignatureDataUrl(notice.signatureData);
      setSignatureMode('saved');
    } else {
      setSignatureDataUrl(currentUserDoc?.signatureUrl || null);
      setSignatureMode(currentUserDoc?.signatureUrl ? 'saved' : 'draw');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete Notice Handler
  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteNotice = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'notisPanggilan', deleteTargetId));
      setSuccess("Notis panggilan berjaya dipadamkan.");
      setDeleteTargetId(null);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      setError("Gagal memadamkan notis panggilan.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Tick Notice Handler (Only one notice is active at a time)
  const handleTick = async (noticeId: string) => {
    try {
      const updatedNotices = notices.map(n => {
        const isCurrent = n.id === noticeId;
        // If already ticked, toggle off. Otherwise, set true for current and false for others.
        const shouldTick = isCurrent ? !n.isTick : false;
        return { ...n, isTick: shouldTick };
      });

      // Batch update to ensure atomicity
      for (const notice of updatedNotices) {
        await updateDoc(doc(db, 'notisPanggilan', notice.id), { isTick: notice.isTick });
      }

      const activeNotice = updatedNotices.find(n => n.isTick);
      if (activeNotice) {
        setSuccess(`Notis '${activeNotice.title}' diaktifkan untuk Pengesahan Kehadiran.`);
      } else {
        setSuccess("Semua notis telah dinyahaktifkan.");
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error("Error updating tick status:", err);
      setError("Gagal mengaktifkan notis.");
    }
  };

  // Filter notices for current main tab & sort by date descending (most recent first)
  const filteredNotices = notices
    .filter(n => n.type === activeMainTab)
    .sort((a, b) => {
      const timeA = new Date(a.dateOfNotice || a.meetingDate || 0).getTime();
      const timeB = new Date(b.dateOfNotice || b.meetingDate || 0).getTime();
      return timeB - timeA;
    });
  // Find current active notice for this tab
  const activeNotice = notices.find(n => n.isTick && n.type === activeMainTab);

  // Canvas drawing handlers
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
      if (e.cancelable) e.preventDefault();
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
    const canvas = canvasRef.current;
    if (canvas) {
      const empty = isCanvasEmpty(canvas);
      if (!empty) {
        setSignatureDataUrl(canvas.toDataURL('image/png'));
      }
    }
  };

  const isCanvasEmpty = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) return true;
    const buffer = new Uint32Array(
      context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  const formatMalayDate = (dateStr: string) => {
    const months = [
      'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
      'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
    ];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handlePrintNoticeAndAttendance = (notice: NotisPanggilan) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Sila benarkan popup untuk mencetak dokumen.');
      return;
    }

    const meetingYear = notice.meetingDate ? new Date(notice.meetingDate).getFullYear() : 2026;
    const recipient = notice.type === 'agung_khas' || notice.type === 'agung' ? 'SEMUA AHLI PERSATUAN' : 'SEMUA AHLI JAWATANKUASA';
    const formattedDateOfNotice = formatMalayDate(notice.dateOfNotice);

    const letterTitle = notice.type === 'agung_khas'
      ? `MESYUARAT AGUNG KHAS PIBG SEKOLAH MENENGAH AGAMA ULU JEMPOL BIL 1/${meetingYear}`
      : `MESYUARAT AGUNG TAHUNAN PIBG SEKOLAH MENENGAH AGAMA ULU JEMPOL (${meetingYear})`;

    const meetingNameWithSuffix = notice.type === 'agung_khas'
      ? `Mesyuarat Agung Khas PIBG Sekolah Menengah Agama Ulu Jempol Bil 1/${meetingYear}`
      : `Mesyuarat Agung Tahunan PIBG Sekolah Menengah Agama Ulu Jempol`;

    const agendas = notice.agenda || [];
    const renderedAgendas = agendas.map((ag, idx) => {
      const cleanAg = ag.replace(/^\s*[\d\.\bull;&\-]+\s*/, '');
      return `
        <div style="margin-left: 18px; margin-top: 3px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; line-height: 1.35;">
          3.${idx + 1} &nbsp;&nbsp;&nbsp;&nbsp; ${cleanAg}
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notis Panggilan - ${notice.title}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 20mm;
            }
            *, *:before, *:after {
              box-sizing: border-box;
            }
            html, body {
              background: #fff !important;
              color: #000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-page {
              box-sizing: border-box;
              font-family: 'Times New Roman', Times, serif;
              font-size: 9.5pt;
              line-height: 1.38;
              color: #000;
              background: #fff;
              width: 100%;
              page-break-before: avoid;
              page-break-after: avoid;
              page-break-inside: avoid;
            }
            p {
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          <div class="print-page">
            <!-- Letterhead (Besar & Penuh Ke Lebar Margin) -->
            <div style="width: 100%; margin-bottom: 12px; text-align: center;">
              <img 
                src="${letterheadBase64 || directLetterheadUrl}" 
                alt="Letterhead Persatuan" 
                style="width: 100% !important; min-width: 100% !important; height: auto !important; display: block; margin: 0 auto;" 
                referrerpolicy="no-referrer"
                onerror="this.style.display='none'; document.getElementById('fallback-lh-1').style.display='block';"
              />
              <div id="fallback-lh-1" style="display: none; text-align: center; font-family: 'Times New Roman', Times, serif; line-height: 1.25; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 6px;">
                <strong style="font-size: 14pt; letter-spacing: 0.5px; text-transform: uppercase;">SEKOLAH MENENGAH AGAMA ULU JEMPOL<br>PERSATUAN IBU BAPA DAN GURU (PIBG)</strong><br>
                <span style="font-size: 8.5pt;">Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan &bull; Emel: smaujn9@gmail.com</span>
              </div>
            </div>

            <!-- Centered Header -->
            <div style="text-align: center; font-family: 'Times New Roman', Times, serif; font-weight: bold; font-size: 10.5pt; line-height: 1.35; margin-bottom: 10px; text-transform: uppercase;">
              NOTIS PANGGILAN ${notice.type === 'agung_khas' ? 'MESYUARAT AGUNG KHAS PIBG' : 'MESYUARAT AGUNG TAHUNAN PIBG'}<br>
              SEKOLAH MENENGAH AGAMA ULU JEMPOL<br>
              ${notice.type === 'agung_khas' ? 'BIL 1/' + meetingYear : '(' + meetingYear + ')'}
            </div>

            <!-- Metadata Block -->
            <div style="display: flex; justify-content: space-between; font-family: 'Times New Roman', Times, serif; font-size: 9pt; margin-bottom: 8px;">
              <div>
                <strong>Kepada :</strong><br>
                <strong style="text-transform: uppercase;">${recipient}</strong>
              </div>
              <div style="text-align: right; line-height: 1.3;">
                Nombor Rujukan : ${notice.referenceNo || '-'}<br>
                Tarikh : ${formattedDateOfNotice}
              </div>
            </div>

            <!-- Salutation -->
            <p style="margin: 4px 0; font-size: 9.5pt;">Tuan/Puan,</p>

            <!-- Subject Line -->
            <p style="font-weight: bold; text-transform: uppercase; text-decoration: underline; margin: 6px 0 8px 0; font-size: 9.5pt; line-height: 1.3;">
              ${letterTitle}
            </p>

            <!-- Letter Body -->
            <div style="text-align: justify; line-height: 1.35; font-size: 9.5pt;">
              <p style="margin: 0 0 4px 0;">Perkara di atas adalah dirujuk.</p>
              
              <p style="margin: 0 0 4px 0;">
                2. &nbsp; Sukacita dimaklumkan bahawa <strong>${meetingNameWithSuffix}</strong> akan diadakan seperti ketentuan berikut :
              </p>

              <!-- Ketentuan Block -->
              <div style="margin: 4px 0 6px 16px; font-weight: bold;">
                <table style="border: none; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 9pt;">
                  <tr>
                    <td style="width: 75px; padding: 1px 0; font-weight: bold;">Tarikh</td>
                    <td style="width: 15px; padding: 1px 0; text-align: center; font-weight: bold;">:</td>
                    <td style="padding: 1px 0; font-weight: bold;">${formatMalayDate(notice.meetingDate)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 1px 0; font-weight: bold;">Masa</td>
                    <td style="padding: 1px 0; text-align: center; font-weight: bold;">:</td>
                    <td style="padding: 1px 0; font-weight: bold;">${notice.meetingTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 1px 0; font-weight: bold;">Tempat</td>
                    <td style="padding: 1px 0; text-align: center; font-weight: bold;">:</td>
                    <td style="padding: 1px 0; font-weight: bold;">${notice.meetingVenue}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 3px 0;">
                3. &nbsp; Agenda mesyuarat adalah seperti berikut :
              </p>

              <!-- Agenda list -->
              <div style="margin-bottom: 5px;">
                ${renderedAgendas}
              </div>

              ${notice.type === 'agung' ? `
                <p style="margin: 5px 0; text-align: justify;">
                  4. &nbsp; Bersama-sama ini dilampirkan Minit Mesyuarat Agung yang lalu, Laporan Aktiviti yang lalu dan Laporan Kewangan bagi tahun yang lalu yang telah diluluskan oleh juruaudit.
                </p>
              ` : ''}

              <p style="margin: 5px 0 3px 0;">
                Kehadiran dan kerjasama daripada pihak tuan/puan didahului dengan ucapan terima kasih.
              </p>
              
              <p style="margin: 2px 0 0 0;">Sekian.</p>
            </div>

            <!-- Signature block (Terus di bawah teks, tiada ruang kosong melampau) -->
            <div style="margin-top: 16px; line-height: 1.3; font-size: 9pt; page-break-inside: avoid;">
              <p style="margin: 0 0 2px 0;">Yang benar,</p>
              <div style="position: relative; height: 38px; margin-top: 2px;">
                ${notice.signatureData ? `
                  <img src="${notice.signatureData}" style="position: absolute; bottom: 2px; left: 10px; max-height: 36px; max-width: 120px; mix-blend-multiply: multiply;" referrerpolicy="no-referrer" />
                ` : ''}
                <p style="margin: 0; padding-top: 20px; font-weight: bold; color: #000;">
                  ………………………………………………………
                </p>
              </div>
              <p style="margin: 3px 0 0 0; font-weight: bold; text-transform: uppercase; font-size: 9.5pt;">${notice.signatureName || 'Norziana binti Rosli'}</p>
              <p style="margin: 0; text-transform: uppercase; color: #333; font-size: 8.5pt;">${notice.signatureRole || 'Setiausaha'}</p>
              <p style="margin: 0; color: #555; font-size: 8pt;">Sekolah Menengah Agama Ulu Jempol, Batu Kikir</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  // Generate complete attendance list for any notice
  const getAttendanceRosterForNotice = (notice: NotisPanggilan | null) => {
    if (!notice) return [];

    const nonCommitteeRoles = ['Pelawat', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Penduduk', 'Tetamu'];
    
    const targetUsers = users.filter(user => {
      const isAJK = !nonCommitteeRoles.includes(user.role);
      const isNormalMember = user.role === 'Ahli Biasa';
      
      if (notice.type === 'agung_khas') {
        return isAJK || isNormalMember;
      } else {
        return isAJK;
      }
    });

    const activeNoticeAttendances = attendances.filter(a => a.noticeId === notice.id);

    const roster = targetUsers.map(user => {
      const record = activeNoticeAttendances.find(a => a.userUid === user.uid);
      return {
        uid: user.uid,
        name: user.displayName || user.nickname || 'Ahli Tanpa Nama',
        email: user.email || '-',
        role: user.role,
        status: record ? record.status : 'Belum Sah',
        reason: record?.reason || ''
      };
    });

    // Also include any attendee who submitted attendance for this notice but is not in targetUsers
    // (e.g. residents / pelawat who attended Mesyuarat Agung Khas before registering as member)
    activeNoticeAttendances.forEach(a => {
      if (!targetUsers.some(u => u.uid === a.userUid)) {
        const u = users.find(user => user.uid === a.userUid);
        roster.push({
          uid: a.userUid,
          name: a.userName || u?.displayName || u?.nickname || 'Penduduk',
          email: a.userEmail || u?.email || '-',
          role: u?.role || a.userRole || 'Penduduk',
          status: a.status,
          reason: a.reason || ''
        });
      }
    });

    return sortAttendance(roster);
  };

  const attendanceRoster = getAttendanceRosterForNotice(activeNotice);
  const countHadir = attendanceRoster.filter(r => r.status === 'Hadir').length;
  const countTidakHadir = attendanceRoster.filter(r => r.status === 'Tidak Hadir').length;
  const countBelumSah = attendanceRoster.filter(r => r.status === 'Belum Sah').length;

  return (
    <div className="space-y-6">
      {/* Upper Banner Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-5 gap-4 overflow-hidden">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
            Notis Panggilan Mesyuarat <span className="bg-pink-100 text-pink-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase shrink-0">PENTADBIRAN</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Urus, semak, jana serta aktifkan notis panggilan rasmi mesyuarat jawatankuasa atau ahli biasa persatuan.
          </p>
        </div>

        {/* Notice Main Tabs */}
        <div className="flex flex-wrap sm:flex-nowrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl shrink-0 self-start sm:self-center max-w-full">
          <button
            onClick={() => setActiveMainTab('agung_khas')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-tight transition-all cursor-pointer ${
              activeMainTab === 'agung_khas'
                ? 'bg-white text-slate-900 shadow-3xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Mesyuarat Agung Khas (Semua Ahli)
          </button>
          <button
            onClick={() => setActiveMainTab('agung')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-tight transition-all cursor-pointer ${
              activeMainTab === 'agung'
                ? 'bg-white text-slate-900 shadow-3xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Mesyuarat Agung (AJK Sahaja)
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in duration-200">
          <AlertCircle size={16} className="text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Sub-Tabs: Notice Creator vs Attendance table */}
      <div className="flex gap-3 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab('notis')}
          className={`pb-2.5 text-xs font-extrabold uppercase tracking-wider relative transition-colors cursor-pointer ${
            activeSubTab === 'notis' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Notis & Sejarah
          {activeSubTab === 'notis' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('kehadiran')}
          className={`pb-2.5 text-xs font-extrabold uppercase tracking-wider relative transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'kehadiran' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Jadual Kehadiran
          {activeNotice && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
          {activeSubTab === 'kehadiran' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'notis' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
          
          {/* Form Column */}
          <div className="lg:col-span-5 bg-white border border-slate-100 p-6 rounded-3xl shadow-3xs space-y-5 h-fit">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 uppercase tracking-wide">
                <FileText size={16} className="text-pink-500" />
                {editNoticeId ? 'Kemaskini Notis' : 'Jana Notis Baru'}
              </h3>
              {editNoticeId && (
                <button 
                  onClick={resetForm}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-extrabold uppercase"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tajuk Mesyuarat <span className="text-rose-500">*</span></label>
                <input 
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                  placeholder="Contoh: Mesyuarat Agung Khas Kali Ke-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">No. Rujukan <span className="text-rose-500">*</span></label>
                  <input 
                    type="text"
                    required
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                    placeholder="Contoh: SMAUJ/PIBG-1/2026"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Notis <span className="text-rose-500">*</span></label>
                  <input 
                    type="date"
                    required
                    value={dateOfNotice}
                    onChange={(e) => setDateOfNotice(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tarikh Mesyuarat <span className="text-rose-500">*</span></label>
                  <input 
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Masa Mesyuarat <span className="text-rose-500">*</span></label>
                  <input 
                    type="text"
                    required
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                    placeholder="Contoh: 9.00 Pagi"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tempat Mesyuarat <span className="text-rose-500">*</span></label>
                <input 
                  type="text"
                  required
                  value={meetingVenue}
                  onChange={(e) => setMeetingVenue(e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                  placeholder="Tempat Mesyuarat"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Agenda Mesyuarat (Setiap talian ialah satu agenda) <span className="text-rose-500">*</span></label>
                <textarea 
                  required
                  rows={4}
                  value={agendaInput}
                  onChange={(e) => setAgendaInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                  placeholder="Setiap perenggan mewakili 1 Agenda..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Disediakan Oleh (Nama)</label>
                  <input 
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Disediakan Oleh (Jawatan)</label>
                  <input 
                    type="text"
                    value={signatureRole}
                    onChange={(e) => setSignatureRole(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-normal"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tandatangan Digital Setiausaha</label>
                
                <div className="flex gap-2 border-b border-slate-100 pb-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSignatureMode('draw')}
                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg cursor-pointer ${
                      signatureMode === 'draw' 
                        ? 'bg-slate-950 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Lukis Baru
                  </button>
                  {currentUserDoc?.signatureUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSignatureMode('saved');
                        setSignatureDataUrl(currentUserDoc.signatureUrl);
                      }}
                      className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg cursor-pointer ${
                        signatureMode === 'saved' 
                          ? 'bg-slate-950 text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Guna Profil Tetap
                    </button>
                  )}
                </div>

                {signatureMode === 'draw' ? (
                  <div className="space-y-2">
                    <div className="relative border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden h-[150px] flex items-center justify-center">
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                        width={400}
                        height={150}
                      />
                      {!signatureDataUrl && (
                        <span className="text-[10px] font-bold text-slate-400 pointer-events-none">
                          Sila tandatangan di sini menggunakan tetikus atau jari
                        </span>
                      )}
                    </div>
                    {signatureDataUrl && (
                      <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                        <span className="text-[9px] font-black text-emerald-700 uppercase">Tandatangan direkodkan!</span>
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all"
                        >
                          Set Semula
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col items-center justify-center h-[150px] relative">
                    {signatureDataUrl ? (
                      <img 
                        src={signatureDataUrl} 
                        alt="Tandatangan Profil Tetap" 
                        className="max-h-[110px] object-contain mix-blend-multiply" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Tiada tandatangan profil disimpan.</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSignatureMode('draw')}
                      className="absolute bottom-2 right-2 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Lukis Semula
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={15} />
                <span>{editNoticeId ? 'Kemas Kini Notis' : 'Simpan Notis Panggilan'}</span>
              </button>
            </form>
          </div>

          {/* History Column */}
          <div className="lg:col-span-7 space-y-4 min-w-0">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
              Sejarah Notis Panggilan ({filteredNotices.length})
            </h3>

            {filteredNotices.length === 0 ? (
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 text-center space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Tiada Sejarah Notis</h4>
                <p className="text-[11px] text-slate-400">Gunakan borang di sebelah untuk menjana notis panggilan mesyuarat pertama anda.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
                {filteredNotices.map((notice) => {
                  const agendaArr = notice.agenda || [];
                  return (
                    <div 
                      key={notice.id}
                      className={`bg-white border rounded-3xl p-4 sm:p-5 shadow-3xs transition-all relative group flex flex-col md:flex-row gap-4 sm:gap-5 min-w-0 overflow-hidden ${
                        notice.isTick 
                          ? 'border-emerald-500 bg-emerald-50/5 ring-1 ring-emerald-500/20' 
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {/* Left: Ticking System */}
                      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4 shrink-0">
                        <button
                          onClick={() => handleTick(notice.id)}
                          className="flex items-center gap-1.5 cursor-pointer text-left"
                          title="Aktifkan Notis ini untuk Pengesahan Kehadiran"
                        >
                          {notice.isTick ? (
                            <div className="flex flex-col items-center">
                              <CheckSquare size={26} className="text-emerald-500 fill-emerald-100" />
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">Aktif</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Square size={26} className="text-slate-300 hover:text-slate-400" />
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Guna</span>
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Right: Notice Body Container */}
                      <div className="flex-1 space-y-3.5 min-w-0 overflow-hidden">
                        {/* Notice Header Metadata */}
                        <div className="flex justify-between items-start gap-2.5 min-w-0">
                          <div className="min-w-0 flex-1">
                            <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-full">
                              Rujukan: {notice.referenceNo}
                            </span>
                            <h4 className="font-extrabold text-slate-900 text-xs mt-1.5 uppercase tracking-wide leading-snug break-words">
                              {notice.title}
                            </h4>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handlePrintNoticeAndAttendance(notice)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                              title="Cetak Notis & Kehadiran"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => handleEdit(notice)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                              title="Edit Notis"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(notice.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                              title="Padam Notis"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Meeting Info Summary */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-2.5 sm:p-3 rounded-2xl border border-slate-100 text-[10px] text-slate-600 min-w-0">
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[8px] font-black text-slate-400 uppercase block truncate">Tarikh</span>
                            <p className="font-bold text-slate-800 truncate">{notice.meetingDate}</p>
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[8px] font-black text-slate-400 uppercase block truncate">Masa</span>
                            <p className="font-bold text-slate-800 truncate">{notice.meetingTime}</p>
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[8px] font-black text-slate-400 uppercase block truncate">Tempat</span>
                            <p className="font-bold text-slate-800 truncate" title={notice.meetingVenue}>{notice.meetingVenue}</p>
                          </div>
                        </div>

                        {/* Notice Content / Agenda Sneak Peak */}
                        <div className="space-y-1.5 min-w-0">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Agenda Mesyuarat ({agendaArr.length})</span>
                          <ul className="text-[10px] font-bold text-slate-700 space-y-1 bg-slate-50/20 p-2.5 rounded-2xl border border-slate-100/50 min-w-0 overflow-hidden">
                            {agendaArr.slice(0, 3).map((ag, index) => (
                              <li key={index} className="truncate">&bull; {ag}</li>
                            ))}
                            {agendaArr.length > 3 && (
                              <li className="text-slate-400 text-[9px] font-extrabold uppercase mt-1 pl-2.5 truncate">
                                + {agendaArr.length - 3} agenda lain...
                              </li>
                            )}
                          </ul>
                        </div>

                        {/* Signature Info */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[9px] font-black uppercase text-slate-400 border-t border-slate-100/60 pt-2.5 gap-1 min-w-0">
                          <span className="shrink-0">Dikeluarkan: {notice.dateOfNotice}</span>
                          <span className="text-slate-600 truncate max-w-full">Oleh: {notice.signatureName} ({notice.signatureRole})</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Attendance Tab Table */
        <div className="space-y-6">
          {/* Active Notice Header Status card */}
          {!activeNotice ? (
            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8 text-center space-y-3">
              <AlertCircle className="w-9 h-9 text-amber-500 mx-auto animate-bounce" />
              <h4 className="text-sm font-black text-amber-800 uppercase tracking-wider">Tiada Notis Aktif</h4>
              <p className="text-xs text-amber-600 max-w-md mx-auto font-bold leading-relaxed">
                Anda perlu menanda/menandai "Tick" pada salah satu notis dalam tab 'Notis & Sejarah' terlebih dahulu untuk mula memantau maklum balas dan pengesahan kehadiran ahli jawatankuasa/biasa.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Notice summary & Stats */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Aktif Menunggu Respon
                    </span>
                    <span className="text-slate-400 text-[10px] font-mono">No. Ruj: {activeNotice.referenceNo}</span>
                  </div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white leading-tight">
                    {activeNotice.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-bold flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1 text-slate-400"><Calendar size={13} /> {activeNotice.meetingDate}</span>
                    <span className="flex items-center gap-1 text-slate-400"><Clock size={13} /> {activeNotice.meetingTime}</span>
                    <span className="flex items-center gap-1 text-slate-400"><MapPin size={13} /> {activeNotice.meetingVenue}</span>
                  </p>
                </div>

                {/* Micro Stats Ratios */}
                <div className="flex gap-4 self-stretch md:self-center bg-slate-800/50 p-4 rounded-2xl border border-slate-800 shrink-0 justify-around text-center">
                  <div className="px-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Hadir</span>
                    <span className="text-xl font-black text-emerald-400 block mt-0.5">{countHadir}</span>
                  </div>
                  <div className="border-r border-slate-700 h-8 self-center" />
                  <div className="px-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tidak</span>
                    <span className="text-xl font-black text-rose-400 block mt-0.5">{countTidakHadir}</span>
                  </div>
                  <div className="border-r border-slate-700 h-8 self-center" />
                  <div className="px-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Belum</span>
                    <span className="text-xl font-black text-amber-400 block mt-0.5">{countBelumSah}</span>
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-3xs">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={15} className="text-indigo-500" />
                    Senarai Roster Maklum Balas Kehadiran ({attendanceRoster.length} Ahli)
                  </h4>
                  
                  {/* CSV or Print Simulation */}
                  <button 
                    onClick={() => activeNotice && handlePrintNoticeAndAttendance(activeNotice)}
                    className="p-2 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-white flex items-center justify-center"
                    title="Cetak Notis & Kehadiran"
                  >
                    <Printer size={14} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-5">Nama Ahli / Email</th>
                        <th className="py-3 px-5">Peranan (Role)</th>
                        <th className="py-3 px-5 text-center">Status Maklum Balas</th>
                        <th className="py-3 px-5">Alasan (Jika Tidak Hadir)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRoster.map((row) => (
                        <tr key={row.uid} className="border-b border-slate-100/50 hover:bg-slate-50/50 transition-colors text-xs text-slate-700 font-bold">
                          <td className="py-3 px-5">
                            <div>
                              <p className="text-slate-900 font-extrabold text-xs">{row.name}</p>
                              <span className="text-[9px] text-slate-400 font-mono font-medium block">{row.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              {row.role}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              row.status === 'Hadir' 
                                ? 'bg-emerald-50 text-emerald-600'
                                : row.status === 'Tidak Hadir'
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-amber-50 text-amber-600'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-slate-500 font-normal italic text-[11px]">
                            {row.reason || (row.status === 'Tidak Hadir' ? 'Tiada alasan dinyatakan' : '-')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* Printable Section rendered via Portal directly under body */}
      {printNotice && createPortal(
        <>
          <style>{`
            #print-section {
              display: none;
            }
            @media print {
              @page {
                size: A4 portrait;
                margin: 15mm 20mm;
              }
              html, body {
                background: #fff !important;
                color: #000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body > *:not(#print-section) {
                display: none !important;
              }
              #print-section {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                color: black !important;
                font-family: 'Times New Roman', Times, serif;
                font-size: 9.5pt;
                line-height: 1.38;
              }
              .print-page {
                box-sizing: border-box;
                width: 100%;
                position: relative;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                page-break-before: avoid !important;
              }
            }
          `}</style>
          
          <div id="print-section">
            {/* Page 1: Notis Panggilan Only */}
            <div className="print-page">
              {/* Letterhead (Besar & Penuh Ke Lebar Margin) */}
              <div className="w-full mb-3 text-center">
                <img 
                  src={letterheadBase64 || directLetterheadUrl} 
                  alt="Letterhead Persatuan" 
                  className="w-full min-w-full h-auto pointer-events-none block mx-auto" 
                  style={{ width: '100%', minWidth: '100%', height: 'auto' }}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fb = document.getElementById('portal-fallback-lh-1');
                    if (fb) fb.style.display = 'block';
                  }}
                />
                <div id="portal-fallback-lh-1" style={{ display: 'none' }} className="text-center space-y-0.5 pb-1.5 border-b-2 border-black mb-2">
                  <h2 className="text-sm font-extrabold tracking-wide uppercase" style={{ fontSize: '14pt', lineHeight: '1.25' }}>
                    SEKOLAH MENENGAH AGAMA ULU JEMPOL<br/>PERSATUAN IBU BAPA DAN GURU (PIBG)
                  </h2>
                  <p className="text-[10px] text-black" style={{ fontSize: '8.5pt' }}>
                    Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan &bull; Emel: smaujn9@gmail.com
                  </p>
                </div>
              </div>

              {/* Title centered */}
              <div className="text-center font-bold tracking-wide mt-2 mb-2.5 uppercase space-y-0.5" style={{ fontSize: '10.5pt', lineHeight: '1.35' }}>
                <p>NOTIS PANGGILAN {printNotice.type === 'agung_khas' ? 'MESYUARAT AGUNG KHAS PIBG' : 'MESYUARAT AGUNG TAHUNAN PIBG'}</p>
                <p>SEKOLAH MENENGAH AGAMA ULU JEMPOL</p>
                {printNotice.type === 'agung' && <p>({new Date(printNotice.meetingDate).getFullYear() || new Date().getFullYear()})</p>}
                {printNotice.type === 'agung_khas' && <p>BIL 1/{(new Date(printNotice.meetingDate).getFullYear() || new Date().getFullYear())}</p>}
              </div>

              {/* Notice Metadata block */}
              <div className="flex justify-between items-start mt-2 text-xs mb-2" style={{ fontSize: '9pt', lineHeight: '1.3' }}>
                <div>
                  <p className="font-bold">Kepada :</p>
                  <p className="font-extrabold uppercase mt-0.5">
                    {printNotice.type === 'agung_khas' || printNotice.type === 'agung' ? 'SEMUA AHLI PERSATUAN' : 'SEMUA AHLI JAWATANKUASA'}
                  </p>
                </div>
                <div className="text-right space-y-0.5" style={{ fontSize: '9pt', lineHeight: '1.3' }}>
                  <p>Nombor Rujukan : {printNotice.referenceNo}</p>
                  <p>Tarikh : {(() => {
                    const months = [
                      'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
                      'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
                    ];
                    const d = new Date(printNotice.dateOfNotice);
                    if (isNaN(d.getTime())) return printNotice.dateOfNotice;
                    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                  })()}</p>
                </div>
              </div>

              {/* Salutation */}
              <div className="mt-1 text-xs" style={{ fontSize: '9.5pt' }}>
                <p>Tuan/Puan,</p>
              </div>

              {/* Subject Title */}
              <div className="mt-2 mb-2">
                <h1 className="font-bold uppercase underline decoration-1 underline-offset-2 tracking-wide leading-snug" style={{ fontSize: '9.5pt', lineHeight: '1.3' }}>
                  {printNotice.title.toUpperCase()} SEKOLAH MENENGAH AGAMA ULU JEMPOL<br />
                  BATU KIKIR NEGERI SEMBILAN
                </h1>
              </div>

              {/* Content Body */}
              <div className="text-justify space-y-1" style={{ fontSize: '9.5pt', lineHeight: '1.35' }}>
                <p>Perkara di atas adalah dirujuk.</p>
                <p>
                  2.&nbsp;&nbsp;Sukacita dimaklumkan bahawa {printNotice.type === 'agung_khas' ? 'Mesyuarat Agung Khas PIBG' : 'Mesyuarat Agung Tahunan PIBG'} Sekolah Menengah Agama Ulu Jempol akan diadakan seperti ketentuan berikut :
                </p>
                
                {/* Ketentuan block */}
                <div className="pl-4 my-1.5 font-bold">
                  <table className="border-none w-auto" style={{ borderCollapse: 'collapse', border: 'none' }}>
                    <tbody>
                      <tr style={{ border: 'none' }}>
                        <td style={{ border: 'none', padding: '1px 6px 1px 0px', fontWeight: 'bold', width: '75px', fontSize: '9pt' }}>Tarikh</td>
                        <td style={{ border: 'none', padding: '1px 6px', fontWeight: 'bold', fontSize: '9pt' }}>:</td>
                        <td style={{ border: 'none', padding: '1px 6px', fontWeight: 'bold', fontSize: '9pt' }}>{(() => {
                          const months = [
                            'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
                            'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
                          ];
                          const d = new Date(printNotice.meetingDate);
                          if (isNaN(d.getTime())) return printNotice.meetingDate;
                          return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                        })()}</td>
                      </tr>
                      <tr style={{ border: 'none' }}>
                        <td style={{ border: 'none', padding: '1px 6px 1px 0px', fontWeight: 'bold', fontSize: '9pt' }}>Masa</td>
                        <td style={{ border: 'none', padding: '1px 6px', fontWeight: 'bold', fontSize: '9pt' }}>:</td>
                        <td style={{ border: 'none', padding: '1px 6px', fontWeight: 'bold', fontSize: '9pt' }}>{printNotice.meetingTime}</td>
                      </tr>
                      <tr style={{ border: 'none' }}>
                        <td style={{ border: 'none', padding: '1px 6px 1px 0px', fontWeight: 'bold', fontSize: '9pt' }}>Tempat</td>
                        <td style={{ border: 'none', padding: '1px 6px', fontWeight: 'bold', fontSize: '9pt' }}>:</td>
                        <td style={{ border: 'none', padding: '1px 6px', fontWeight: 'bold', fontSize: '9pt' }}>{printNotice.meetingVenue}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p>
                  3.&nbsp;&nbsp;Agenda mesyuarat adalah seperti berikut :
                </p>

                {/* Agenda list */}
                <div className="pl-4 space-y-0.5 font-semibold" style={{ fontSize: '9.5pt' }}>
                  {printNotice.agenda && printNotice.agenda.map((ag, idx) => {
                    const cleanAg = ag.replace(/^\s*[\d\.\bull;&\-]+\s*/, '');
                    return (
                      <p key={idx}>3.{idx + 1}&nbsp;&nbsp;&nbsp;&nbsp;{cleanAg}</p>
                    );
                  })}
                </div>

                {printNotice.type === 'agung' && (
                  <p>
                    4.&nbsp;&nbsp;Bersama-sama ini dilampirkan Minit Mesyuarat Agung yang lalu, Laporan Aktiviti yang lalu dan Laporan Kewangan bagi tahun yang lalu yang telah diluluskan oleh juruaudit.
                  </p>
                )}

                <p className="pt-0.5">
                  Kehadiran dan kerjasama daripada pihak tuan/puan didahului dengan ucapan terima kasih.
                </p>
                <p>Sekian.</p>
              </div>

              {/* Signatures and Sign-off (Terus di bawah teks, tiada ruang kosong melampau) */}
              <div className="mt-4 pt-1 space-y-0.5" style={{ fontSize: '9pt', lineHeight: '1.3' }}>
                <p>Yang benar,</p>
                
                {/* Signature Image or dotted line */}
                <div className="relative mt-1 min-h-[38px] w-48">
                  {printNotice.signatureData && (
                    <img 
                      src={printNotice.signatureData} 
                      alt="Tandatangan" 
                      className="absolute bottom-1 left-2 max-h-[36px] max-w-[120px] object-contain mix-blend-multiply" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <p className="pt-5 text-black font-bold">......................................................</p>
                </div>

                <p className="font-extrabold uppercase mt-1" style={{ fontSize: '9.5pt' }}>{printNotice.signatureName}</p>
                <p className="uppercase text-gray-800" style={{ fontSize: '8.5pt' }}>{printNotice.signatureRole}</p>
                <p className="text-gray-600" style={{ fontSize: '8pt' }}>Sekolah Menengah Agama Ulu Jempol, Batu Kikir</p>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        itemName={notices.find(n => n.id === deleteTargetId)?.title || "notis panggilan ini"}
        isLoading={isDeleting}
        onConfirm={confirmDeleteNotice}
        onClose={() => setDeleteTargetId(null)}
      />

    </div>
  );
}
