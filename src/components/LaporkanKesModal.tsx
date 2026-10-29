import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
  isDisiplinAuthorized, 
  KATEGORI_DISIPLIN_OPTIONS, 
  TAHAP_KESALAHAN_OPTIONS, 
  SESI_WAKTU_OPTIONS, 
  LOKASI_DISIPLIN_OPTIONS, 
  PUNCA_DISIPLIN_OPTIONS, 
  TINDAKAN_AWAL_OPTIONS, 
  printCaseReportPdf, 
  compressAndConvertToBase64, 
  cleanSpeechTranscript, 
  processKeteranganFormat 
} from '../utils/kesHelper';
import DisclaimerAktaModal from './DisclaimerAktaModal';
import { 
  X, ShieldAlert, Sparkles, Mic, MicOff, Send, CheckCircle2, 
  AlertCircle, Loader2, FileText, RotateCcw, PenTool, ExternalLink, Printer,
  Image as ImageIcon, Upload, Trash2, Lock, UserCheck, HelpCircle,
  Clock, MapPin, AlertTriangle, ListChecks, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CaseRecord } from '../types';

interface LaporkanKesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LaporkanKesModal({ isOpen, onClose, onSuccess }: LaporkanKesModalProps) {
  const { firebaseUser, currentUserDoc } = useAuth();

  // Role validation: ONLY Admin Utama and Guru can fill this form
  const isAuthorized = isDisiplinAuthorized(currentUserDoc);

  // All registered members for dropdown selection
  const [memberList, setMemberList] = useState<{ id: string; name: string; houseNo: string }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('manual');

  // Pelapor details
  const defaultNamaPengadu = currentUserDoc?.displayName || currentUserDoc?.nickname || firebaseUser?.displayName || 'Guru Pelapor';
  const defaultRolePengadu = currentUserDoc?.role || 'GURU';

  // ================= 5W 1H FORM STATES =================
  // 1. WHAT (Apa Kesalahan)
  const [jenisKes, setJenisKes] = useState(KATEGORI_DISIPLIN_OPTIONS[0]);
  const [tahapKesalahan, setTahapKesalahan] = useState<'Ringan' | 'Sederhana' | 'Berat'>('Sederhana');
  const [whatPerincian, setWhatPerincian] = useState('');

  // 2. WHO (Siapa Terlibat & Saksi)
  const [namaMurid, setNamaMurid] = useState('');
  const [kelasMurid, setKelasMurid] = useState('');
  const [noPelajar, setNoPelajar] = useState('');
  const [saksiKejadian, setSaksiKejadian] = useState('');
  const [pihakTerlibatLain, setPihakTerlibatLain] = useState('');

  // 3. WHEN (Bila Berlaku)
  const [tarikhKes, setTarikhKes] = useState('');
  const [masaKes, setMasaKes] = useState('');
  const [sesiKejadian, setSesiKejadian] = useState(SESI_WAKTU_OPTIONS[0]);

  // 4. WHERE (Di Mana Berlaku)
  const [lokasiKejadian, setLokasiKejadian] = useState(LOKASI_DISIPLIN_OPTIONS[0]);
  const [lokasiPerincian, setLokasiPerincian] = useState('');

  // 5. WHY (Mengapa Berlaku / Punca)
  const [puncaKejadian, setPuncaKejadian] = useState(PUNCA_DISIPLIN_OPTIONS[0]);
  const [sebabPerincian, setSebabPerincian] = useState('');

  // 6. HOW (Bagaimana Berlaku & Tindakan Diambil)
  const [tindakanAwalGuru, setTindakanAwalGuru] = useState(TINDAKAN_AWAL_OPTIONS[0]);
  const [keterangan, setKeterangan] = useState(''); // Penuh / Kronologi kejadian
  const [isPoliceReport, setIsPoliceReport] = useState(false);
  const [balaiPolis, setBalaiPolis] = useState('');
  const [noRepotPolis, setNoRepotPolis] = useState('');

  // Evidence & Signatures
  const [buktiGambarUrl, setBuktiGambarUrl] = useState('');
  const [isUploadingBukti, setIsUploadingBukti] = useState(false);
  const [isAgreedTerms, setIsAgreedTerms] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  // AI & Voice Assistant States
  const [aiNotesInput, setAiNotesInput] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(60);

  // Canvas Signature Refs & States
  const pengaduCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const penerimaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingPengadu, setIsDrawingPengadu] = useState(false);
  const [isDrawingPenerima, setIsDrawingPenerima] = useState(false);
  const [pengaduSignatureUrl, setPengaduSignatureUrl] = useState('');
  const [penerimaSignatureUrl, setPenerimaSignatureUrl] = useState('');

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdCaseRecord, setCreatedCaseRecord] = useState<CaseRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Speech Recognition Refs
  const recognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);
  const speechSessionBufferRef = useRef<string>('');
  const accumulatedSpeechRef = useRef<string[]>([]);

  // Initialize dates & reset state on open
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setTarikhKes(now.toISOString().split('T')[0]);
      setMasaKes(now.toTimeString().slice(0, 5));
      setJenisKes(KATEGORI_DISIPLIN_OPTIONS[0]);
      setTahapKesalahan('Sederhana');
      setWhatPerincian('');
      setNamaMurid('');
      setKelasMurid('');
      setNoPelajar('');
      setSaksiKejadian('');
      setPihakTerlibatLain('');
      setSesiKejadian(SESI_WAKTU_OPTIONS[0]);
      setLokasiKejadian(LOKASI_DISIPLIN_OPTIONS[0]);
      setLokasiPerincian('');
      setPuncaKejadian(PUNCA_DISIPLIN_OPTIONS[0]);
      setSebabPerincian('');
      setTindakanAwalGuru(TINDAKAN_AWAL_OPTIONS[0]);
      setKeterangan('');
      setIsPoliceReport(false);
      setBalaiPolis('');
      setNoRepotPolis('');
      setBuktiGambarUrl('');
      setAiNotesInput('');
      setIsAgreedTerms(false);
      setSubmitSuccess(false);
      setCreatedCaseRecord(null);
      setErrorMessage('');
      setPengaduSignatureUrl('');
      setPenerimaSignatureUrl('');
      setSelectedMemberId('manual');

      fetchMembers();
    }
  }, [isOpen]);

  // Fetch registered users (for student / member quick select)
  const fetchMembers = async () => {
    try {
      if (!db) return;
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      const list: { id: string; name: string; houseNo: string }[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        const name = data.displayName || data.nickname || 'Murid';
        const houseNo = data.noRumah || data.houseNo || data.department || 'Tingkatan';
        list.push({ id: doc.id, name, houseNo });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setMemberList(list);
    } catch (err) {
      console.warn('Gagal memuat senarai murid:', err);
    }
  };

  // Handle member dropdown change
  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMemberId(val);
    if (val === 'manual') {
      setNamaMurid('');
      setKelasMurid('');
    } else {
      const found = memberList.find(m => m.id === val);
      if (found) {
        setNamaMurid(found.name);
        setKelasMurid(found.houseNo);
      }
    }
  };

  // Handle Bukti Gambar File Upload
  const handleBuktiGambarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBukti(true);
    try {
      const base64 = await compressAndConvertToBase64(file);
      setBuktiGambarUrl(base64);
    } catch (err) {
      console.error('Gagal memproses gambar bukti:', err);
      alert('Gagal memproses gambar. Sila cuba gambar lain.');
    } finally {
      setIsUploadingBukti(false);
    }
  };

  // Canvas Drawing logic for Guru Pelapor
  const startDrawingPengadu = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = pengaduCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawingPengadu(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawPengadu = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingPengadu) return;
    const canvas = pengaduCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawingPengadu = () => {
    if (isDrawingPengadu) {
      setIsDrawingPengadu(false);
      const canvas = pengaduCanvasRef.current;
      if (canvas) {
        setPengaduSignatureUrl(canvas.toDataURL('image/png'));
      }
    }
  };

  const clearPengaduCanvas = () => {
    const canvas = pengaduCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPengaduSignatureUrl('');
  };

  // Canvas Drawing logic for Murid / Saksi / Penerima
  const startDrawingPenerima = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = penerimaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawingPenerima(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawPenerima = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingPenerima) return;
    const canvas = penerimaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawingPenerima = () => {
    if (isDrawingPenerima) {
      setIsDrawingPenerima(false);
      const canvas = penerimaCanvasRef.current;
      if (canvas) {
        setPenerimaSignatureUrl(canvas.toDataURL('image/png'));
      }
    }
  };

  const clearPenerimaCanvas = () => {
    const canvas = penerimaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPenerimaSignatureUrl('');
  };

  // Speech recording helpers
  const stopSpeechRecording = () => {
    isRecordingRef.current = false;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    const rawTranscript = speechSessionBufferRef.current.trim();
    if (rawTranscript) {
      const cleaned = cleanSpeechTranscript(rawTranscript);
      if (cleaned) {
        setAiNotesInput(prev => (prev ? `${prev} ${cleaned}` : cleaned));
      }
    }
    speechSessionBufferRef.current = '';
    accumulatedSpeechRef.current = [];

    setIsRecording(false);
    setRecordingTimeLeft(60);
  };

  const toggleSpeechRecording = () => {
    if (isRecording) {
      stopSpeechRecording();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Pelayar web anda tidak menyokong rakaman suara langsung. Sila taip nota anda secara manual.');
      return;
    }

    try {
      speechSessionBufferRef.current = '';
      accumulatedSpeechRef.current = [];
      const recognition = new SpeechRecognition();
      recognition.lang = 'ms-MY';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        const currentSessionFinals: string[] = [];
        let currentInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentSessionFinals.push(transcriptChunk.trim());
          } else {
            currentInterim += ' ' + transcriptChunk.trim();
          }
        }

        const allFinals = [...accumulatedSpeechRef.current, ...currentSessionFinals];
        const combined = [...allFinals, currentInterim.trim()].filter(Boolean).join(' ');
        speechSessionBufferRef.current = combined;
      };

      recognition.onerror = (err: any) => {
        console.error('Speech Recognition Error:', err);
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          stopSpeechRecording();
        }
      };

      recognition.onend = () => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        if (speechSessionBufferRef.current.trim()) {
          accumulatedSpeechRef.current = [speechSessionBufferRef.current.trim()];
        }

        if (isRecordingRef.current && elapsed < 60) {
          try {
            recognition.start();
          } catch (e) {
            stopSpeechRecording();
          }
        } else {
          stopSpeechRecording();
        }
      };

      recordingStartTimeRef.current = Date.now();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingTimeLeft(60);

      recognition.start();
      recognitionRef.current = recognition;

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        const remaining = 60 - elapsed;
        if (remaining <= 0) {
          stopSpeechRecording();
        } else {
          setRecordingTimeLeft(remaining);
        }
      }, 1000);

    } catch (e) {
      console.error('Gagal memulakan Speech Recognition:', e);
      stopSpeechRecording();
    }
  };

  // AI 5W1H Description Generator
  const handleGenerateAiDescription = async () => {
    if (!aiNotesInput.trim()) {
      alert('Sila taip atau rakam nota ringkas kes terlebih dahulu.');
      return;
    }

    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/kes/generate-keterangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputNotes: aiNotesInput.trim(),
          jenisKes,
          tahapKesalahan,
          namaMurid: namaMurid || 'Murid terlibat',
          kelasMurid: kelasMurid || 'Tidak dinyatakan',
          tarikhKes,
          masaKes,
          sesiKejadian,
          lokasiKejadian,
          puncaKejadian,
          tindakanAwalGuru,
          isPoliceReport,
          balaiPolis
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menjana keterangan kes disiplin.');

      if (data.keterangan) {
        const formattedKeterangan = processKeteranganFormat(data.keterangan);
        setKeterangan(prev => prev ? `${prev}\n\n${formattedKeterangan}` : formattedKeterangan);
        setShowAiModal(false);
        setAiNotesInput('');
      }
    } catch (err: any) {
      alert(`Ralat AI: ${err.message}`);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Generate Unique Case ID
  const generateCaseNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    let num = 1;
    try {
      if (db) {
        const casesRef = collection(db, 'cases');
        const q = query(casesRef, orderBy('createdAt', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const lastData = snap.docs[0].data();
          if (lastData.caseNo && lastData.caseNo.startsWith(`DIS-${year}-`)) {
            const lastSeq = parseInt(lastData.caseNo.split('-')[2], 10);
            if (!isNaN(lastSeq)) num = lastSeq + 1;
          } else if (lastData.caseNo && lastData.caseNo.startsWith(`KES-${year}-`)) {
            const lastSeq = parseInt(lastData.caseNo.split('-')[2], 10);
            if (!isNaN(lastSeq)) num = lastSeq + 1;
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca nombor kes terdahulu:', e);
    }
    return `DIS-${year}-${String(num).padStart(4, '0')}`;
  };

  // Submit Form to Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthorized) {
      setErrorMessage('Akses Ditolak: Hanya pengguna dengan peranan Admin Utama dan Guru sahaja yang dibenarkan untuk mengisi laporan kes disiplin.');
      return;
    }

    if (!namaMurid.trim()) {
      setErrorMessage('Sila masukkan Nama Murid yang terlibat (WHO).');
      return;
    }

    if (!keterangan.trim()) {
      setErrorMessage('Sila masukkan Keterangan & Kronologi Kejadian (HOW).');
      return;
    }

    if (!isAgreedTerms) {
      setErrorMessage('Sila tandakan kotak perakuan pengesahan laporan di bahagian bawah.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const caseNo = await generateCaseNumber();

      const newRecord: Omit<CaseRecord, 'id'> = {
        caseNo,
        pengaduUid: firebaseUser?.uid || 'GURU',
        pengaduName: defaultNamaPengadu,
        pengaduRole: defaultRolePengadu,
        // Backward-compatible fields
        penerimaName: namaMurid.trim(),
        penerimaHouseNo: kelasMurid.trim() || '-',
        tarikhKes,
        masaKes,
        jenisKes,
        isPoliceReport,
        balaiPolis: isPoliceReport ? balaiPolis.trim() : '',
        noRepotPolis: isPoliceReport ? noRepotPolis.trim() : '',
        keterangan: keterangan.trim(),
        buktiGambarUrl: buktiGambarUrl || '',
        pengaduSignatureUrl,
        penerimaSignatureUrl,
        status: isPoliceReport ? 'Dirujuk PDRM' : 'Dalam Siasatan',
        createdAt: new Date().toISOString(),

        // 5W 1H Dedicated Fields
        whatPerincian: whatPerincian.trim(),
        tahapKesalahan,
        namaMurid: namaMurid.trim(),
        kelasMurid: kelasMurid.trim(),
        noPelajar: noPelajar.trim(),
        saksiKejadian: saksiKejadian.trim(),
        pihakTerlibatLain: pihakTerlibatLain.trim(),
        sesiKejadian,
        lokasiKejadian,
        lokasiPerincian: lokasiPerincian.trim(),
        puncaKejadian,
        sebabPerincian: sebabPerincian.trim(),
        kronologiKejadian: keterangan.trim(),
        tindakanAwalGuru
      };

      let finalSavedRecord: CaseRecord;

      if (db) {
        const docRef = await addDoc(collection(db, 'cases'), newRecord);
        finalSavedRecord = { ...newRecord, id: docRef.id };
        setCreatedCaseRecord(finalSavedRecord);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tmf2_case_added', { detail: finalSavedRecord }));
        }
      } else {
        finalSavedRecord = { ...newRecord, id: `local-${Date.now()}` };
        setCreatedCaseRecord(finalSavedRecord);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tmf2_case_added', { detail: finalSavedRecord }));
        }
      }

      // Trigger Push Notification for Discipline Record
      import('../utils/notificationHelper').then(({ notifyOnSafetyCase }) => {
        notifyOnSafetyCase(`[Kes Disiplin] ${jenisKes} (${tahapKesalahan}) - Murid: ${namaMurid}`, finalSavedRecord.id).catch(err => console.warn('Push error:', err));
      }).catch(err => console.warn(err));

      setSubmitSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Gagal mendaftar kes disiplin:', err);
      setErrorMessage(err.message || 'Gagal mendaftarkan kes disiplin ke dalam pangkalan data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10 my-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-center bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 px-5 sm:px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-sm sm:text-base tracking-tight text-white">
                      Borang Pendaftaran Rekod Kes Disiplin
                    </h2>
                    <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded uppercase tracking-wider">
                      Admin Utama & Guru
                    </span>
                  </div>
                  <p className="text-[10px] text-rose-200/90 font-medium">
                    Dokumentasi Salah Laku Berasaskan Prinsip 5W dan 1H • Unit Disiplin & HEM SMAUJ
                  </p>
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

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto max-h-[82vh] space-y-5">
              
              {/* Access Check: Denied View if user is neither Admin Utama nor Guru */}
              {!isAuthorized ? (
                <div className="py-8 px-4 text-center space-y-4 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Lock size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-slate-800">
                      Akses Terhad: Khusus Role Admin Utama dan Guru Sahaja
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Borang Laporan Kes Disiplin ini adalah dokumen rasmi sekolah yang hanya boleh diisi dan direkodkan oleh pegawai yang memegang peranan <b>Admin Utama</b> dan <b>Guru</b> sahaja.
                    </p>
                    <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-700 font-bold inline-block">
                      Peranan Anda: {currentUserDoc?.role || 'Bukan Guru'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl cursor-pointer transition-colors"
                  >
                    Tutup Borang
                  </button>
                </div>
              ) : submitSuccess && createdCaseRecord ? (
                /* Success View */
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 text-center space-y-5"
                >
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 size={38} className="animate-bounce" />
                  </div>
                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-slate-900 text-white text-xs font-mono font-black rounded-lg">
                      No. Rujukan: {createdCaseRecord.caseNo}
                    </span>
                    <h3 className="text-lg font-black text-slate-800">Kes Disiplin Berjaya Didaftarkan!</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Rekod salah laku murid telah disimpan ke dalam sistem disiplin Hal Ehwal Murid (HEM) mengikut format 5W 1H dan sedia untuk dicetak, dipantau, atau dirujuk kepada Kaunselor / PDRM.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => printCaseReportPdf(createdCaseRecord)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Printer size={16} />
                      <span>Cetak / Muat Turun PDF Laporan (5W 1H)</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl cursor-pointer transition-colors"
                    >
                      Selesai
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* ================= 5W 1H FORM VIEW ================= */
                <form onSubmit={handleSubmit} className="space-y-5">
                  {errorMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 font-medium">
                      <AlertCircle size={16} className="shrink-0 text-rose-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Pelapor Card (Auto User) */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                        Guru / Pegawai Pelapor (Auto Log Masuk)
                      </span>
                      <p className="font-extrabold text-slate-800 text-xs">{defaultNamaPengadu}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 font-black text-[10px] rounded-lg border border-indigo-200 flex items-center gap-1">
                      <UserCheck size={12} />
                      <span>{defaultRolePengadu}</span>
                    </span>
                  </div>

                  {/* ================= 1. WHAT (APA KESALAHAN YANG BERLAKU) ================= */}
                  <div className="p-4 bg-white border border-rose-200 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                          W1
                        </span>
                        <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                          WHAT — Apa Kesalahan Yang Berlaku?
                        </h4>
                      </div>
                      <span className="text-[10px] text-rose-600 font-bold">Wajib Diisi *</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Kategori Kesalahan Disiplin <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={jenisKes}
                          onChange={(e) => setJenisKes(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden cursor-pointer"
                        >
                          {KATEGORI_DISIPLIN_OPTIONS.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Tahap Kesalahan <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {TAHAP_KESALAHAN_OPTIONS.map((lvl) => {
                            const isSelected = tahapKesalahan === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => setTahapKesalahan(lvl)}
                                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                                  isSelected 
                                    ? lvl === 'Ringan' 
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                      : lvl === 'Sederhana'
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                        : 'bg-rose-700 text-white border-rose-700 shadow-sm'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {isSelected && <Check size={14} />}
                                <span>{lvl}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Perincian Khusus Perlakuan Salah Laku
                        </label>
                        <input
                          type="text"
                          value={whatPerincian}
                          onChange={(e) => setWhatPerincian(e.target.value)}
                          placeholder="Contoh: Menghisap pod vape berperisa strawberi semasa ketiadaan guru di belakang kelas"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ================= 2. WHO (SIAPA YANG TERLIBAT & SAKSI) ================= */}
                  <div className="p-4 bg-white border border-blue-200 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                          W2
                        </span>
                        <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                          WHO — Siapa Yang Terlibat & Saksi?
                        </h4>
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold">Wajib Diisi *</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Pilih / Taip Nama Murid (Pelaku Kesalahan) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={selectedMemberId}
                          onChange={handleMemberSelect}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                        >
                          <option value="manual">-- Taip Manual Nama Murid --</option>
                          {memberList.map(m => (
                            <option key={m.id} value={m.id}>
                              [{m.houseNo}] {m.name}
                            </option>
                          ))}
                        </select>
                        <input 
                          type="text"
                          value={namaMurid}
                          onChange={(e) => setNamaMurid(e.target.value)}
                          placeholder="Masukkan nama penuh murid terlibat"
                          className="w-full mt-1.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Kelas / Tingkatan Murid <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text"
                          value={kelasMurid}
                          onChange={(e) => setKelasMurid(e.target.value)}
                          placeholder="Contoh: Tingkatan 3 Al-Farabi"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          No. Kad Pengenalan / Angka Pelajar
                        </label>
                        <input 
                          type="text"
                          value={noPelajar}
                          onChange={(e) => setNoPelajar(e.target.value)}
                          placeholder="Contoh: 090514-05-XXXX / SMAUJ-2024-0012"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Saksi Kejadian (Guru / Pengawas / Murid Lain)
                        </label>
                        <input 
                          type="text"
                          value={saksiKejadian}
                          onChange={(e) => setSaksiKejadian(e.target.value)}
                          placeholder="Contoh: Cikgu Halim & Ketua Pengawas (Ahmad Faizal)"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Pihak Lain Terlibat / Mangsa (Jika Ada)
                        </label>
                        <input 
                          type="text"
                          value={pihakTerlibatLain}
                          onChange={(e) => setPihakTerlibatLain(e.target.value)}
                          placeholder="Contoh: Mangsa buli (Mohd Danial, Tingkatan 1) / Rakan sekongkol"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ================= 3. WHEN (BILA BERLAKU) ================= */}
                  <div className="p-4 bg-white border border-amber-200 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-black text-xs flex items-center justify-center">
                          W3
                        </span>
                        <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                          WHEN — Bila Kejadian Berlaku?
                        </h4>
                      </div>
                      <span className="text-[10px] text-amber-700 font-bold">Wajib Diisi *</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Tarikh Kes <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="date"
                          value={tarikhKes}
                          onChange={(e) => setTarikhKes(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Masa Kes <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="time"
                          value={masaKes}
                          onChange={(e) => setMasaKes(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                          required
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Sesi Waktu Sekolah <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={sesiKejadian}
                          onChange={(e) => setSesiKejadian(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                        >
                          {SESI_WAKTU_OPTIONS.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ================= 4. WHERE (DI MANA BERLAKU) ================= */}
                  <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                          W4
                        </span>
                        <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                          WHERE — Di Mana Kejadian Berlaku?
                        </h4>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold">Wajib Diisi *</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Lokasi Utama Kejadian <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={lokasiKejadian}
                          onChange={(e) => setLokasiKejadian(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                        >
                          {LOKASI_DISIPLIN_OPTIONS.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Perincian Tempat Spesifik
                        </label>
                        <input 
                          type="text"
                          value={lokasiPerincian}
                          onChange={(e) => setLokasiPerincian(e.target.value)}
                          placeholder="Contoh: Tandas Blok B Aras 2 / Belakang Bilik Kebal"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ================= 5. WHY (MENGAPA BERLAKU / PUNCA) ================= */}
                  <div className="p-4 bg-white border border-purple-200 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center">
                          W5
                        </span>
                        <h4 className="text-xs font-black text-purple-950 uppercase tracking-wider">
                          WHY — Mengapa Berlaku / Punca Kejadian?
                        </h4>
                      </div>
                      <span className="text-[10px] text-purple-700 font-bold">Wajib Diisi *</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Faktor Utama Punca Salah Laku <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={puncaKejadian}
                          onChange={(e) => setPuncaKejadian(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-purple-500 outline-hidden"
                        >
                          {PUNCA_DISIPLIN_OPTIONS.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Huraian Motif / Latar Belakang Murid
                        </label>
                        <input 
                          type="text"
                          value={sebabPerincian}
                          onChange={(e) => setSebabPerincian(e.target.value)}
                          placeholder="Contoh: Murid mengaku terikut ajakan rakan sekelas dan mencuba untuk keseronokan"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-purple-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ================= 6. HOW (BAGAIMANA BERLAKU & TINDAKAN DIAMBIL) ================= */}
                  <div className="p-4 bg-white border border-indigo-200 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                          1H
                        </span>
                        <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                          HOW — Bagaimana Berlaku & Tindakan Diambil?
                        </h4>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setShowAiModal(true)}
                        className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-extrabold rounded-lg hover:brightness-110 cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Sparkles size={12} />
                        <span>Bantuan AI / Suara (5W 1H)</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Tindakan Serta-merta / Awal Guru Pelapor <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={tindakanAwalGuru}
                          onChange={(e) => setTindakanAwalGuru(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        >
                          {TINDAKAN_AWAL_OPTIONS.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Kronologi Penuh Kejadian & Cara Dikesan <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={5}
                          value={keterangan}
                          onChange={(e) => setKeterangan(e.target.value)}
                          placeholder="Huraikan bagaimana perlakuan salah laku dikesan, bagaimana murid bertindak balas semasa ditegur, dan langkah awal yang telah diambil..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden leading-relaxed resize-none"
                          required
                        />
                      </div>

                      {/* Melibatkan Rujukan Polis / Pegawai Perhubungan Sekolah (PDRM / PPS) */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                            Rujuk Pegawai Perhubungan Sekolah / Polis (PDRM)?
                          </label>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                              <input 
                                type="radio"
                                name="isPoliceReport"
                                checked={isPoliceReport === true}
                                onChange={() => setIsPoliceReport(true)}
                                className="text-rose-600 focus:ring-rose-500"
                              />
                              <span>Ya</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                              <input 
                                type="radio"
                                name="isPoliceReport"
                                checked={isPoliceReport === false}
                                onChange={() => setIsPoliceReport(false)}
                                className="text-rose-600 focus:ring-rose-500"
                              />
                              <span>Tidak</span>
                            </label>
                          </div>
                        </div>

                        {isPoliceReport && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-600 uppercase block">
                                Balai Polis / Nama Pegawai PPS <span className="text-rose-500">*</span>
                              </label>
                              <input 
                                type="text"
                                value={balaiPolis}
                                onChange={(e) => setBalaiPolis(e.target.value)}
                                placeholder="Contoh: Balai Polis Batu Kikir / Sarjan Ali (PPS)"
                                className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-lg outline-hidden"
                                required={isPoliceReport}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-600 uppercase block">
                                No. Repot Polis (Jika Ada)
                              </label>
                              <input 
                                type="text"
                                value={noRepotPolis}
                                onChange={(e) => setNoRepotPolis(e.target.value)}
                                placeholder="Contoh: BTKIKIR/001234/26"
                                className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-lg outline-hidden"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ================= BUKTI GAMBAR & TANDATANGAN ================= */}
                  {/* Gambar Barang Bukti */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                      Gambar Barang Bukti / Rampasan / Kerosakan <span className="text-slate-400 font-normal">(Pilihan)</span>
                    </label>

                    {buktiGambarUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white p-2 max-w-xs">
                        <img 
                          src={buktiGambarUrl} 
                          alt="Bukti Kes" 
                          className="w-full h-36 object-contain rounded-lg border border-slate-200 bg-slate-50" 
                        />
                        <button
                          type="button"
                          onClick={() => setBuktiGambarUrl('')}
                          className="mt-2 w-full py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Padam Gambar Bukti</span>
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl cursor-pointer transition-colors text-slate-600">
                        {isUploadingBukti ? (
                          <>
                            <Loader2 size={16} className="animate-spin text-indigo-600" />
                            <span className="text-xs font-bold text-slate-700">Memproses Gambar...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={16} className="text-indigo-600" />
                            <span className="text-xs font-bold">Muat Naik Gambar Rampasan / Bukti Kejadian</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleBuktiGambarUpload}
                          disabled={isUploadingBukti}
                          className="hidden" 
                        />
                      </label>
                    )}
                  </div>

                  {/* Canvas Tandatangan Digital */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    {/* Tandatangan Guru Pelapor */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Tandatangan Guru Pelapor
                        </label>
                        <button
                          type="button"
                          onClick={clearPengaduCanvas}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw size={10} />
                          <span>Padam</span>
                        </button>
                      </div>
                      <div className="relative bg-white border border-slate-300 rounded-lg overflow-hidden touch-none">
                        <canvas
                          ref={pengaduCanvasRef}
                          width={280}
                          height={90}
                          onMouseDown={startDrawingPengadu}
                          onMouseMove={drawPengadu}
                          onMouseUp={stopDrawingPengadu}
                          onMouseLeave={stopDrawingPengadu}
                          onTouchStart={startDrawingPengadu}
                          onTouchMove={drawPengadu}
                          onTouchEnd={stopDrawingPengadu}
                          className="w-full h-[90px] cursor-crosshair"
                        />
                        {!pengaduSignatureUrl && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-[10px] font-medium italic">
                            Sila lukis tandatangan Guru di sini
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tandatangan Murid / Saksi */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Tandatangan Murid / Saksi / Penerima
                        </label>
                        <button
                          type="button"
                          onClick={clearPenerimaCanvas}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw size={10} />
                          <span>Padam</span>
                        </button>
                      </div>
                      <div className="relative bg-white border border-slate-300 rounded-lg overflow-hidden touch-none">
                        <canvas
                          ref={penerimaCanvasRef}
                          width={280}
                          height={90}
                          onMouseDown={startDrawingPenerima}
                          onMouseMove={drawPenerima}
                          onMouseUp={stopDrawingPenerima}
                          onMouseLeave={stopDrawingPenerima}
                          onTouchStart={startDrawingPenerima}
                          onTouchMove={drawPenerima}
                          onTouchEnd={stopDrawingPenerima}
                          className="w-full h-[90px] cursor-crosshair"
                        />
                        {!penerimaSignatureUrl && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-[10px] font-medium italic">
                            Sila lukis tandatangan Murid / Saksi di sini
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pengesahan Perakuan Checkbox */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={isAgreedTerms}
                        onChange={(e) => setIsAgreedTerms(e.target.checked)}
                        className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 shrink-0"
                        required
                      />
                      <span className="text-[11px] font-bold text-amber-950 leading-snug">
                        Saya dengan ini mengesahkan bahawa segala fakta kejadian 5W 1H yang dilaporkan ini adalah BENAR berpandukan siasatan awal disiplin tanpa sebarang niat prasangka.
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowDisclaimerModal(true)}
                      className="text-[10px] text-rose-700 font-black hover:underline flex items-center gap-1 pl-6 cursor-pointer"
                    >
                      <span>Lihat Peraturan Disiplin & Akta Integriti Maklumat (Seksyen 182 / 233)</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl cursor-pointer transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-gradient-to-r from-rose-700 to-red-700 hover:from-rose-800 hover:to-red-800 text-white text-xs font-black rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Mendaftar Kes Disiplin...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Daftarkan Rekod Kes Disiplin (5W 1H)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* AI 5W1H Description Generator Sub-modal */}
      {showAiModal && (
        <AnimatePresence>
          <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowAiModal(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-2xl p-5 shadow-2xl border border-slate-100 z-10 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-sm">
                  <Sparkles size={18} />
                  <span>Penjana Kronologi Kes Disiplin 5W 1H (AI)</span>
                </div>
                <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Taip nota ringkas atau tekan butang mikrofon untuk merakam suara anda. AI akan menyusun mengikut prinsip 5W 1H.
                  </p>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                    Had 1 Minit (60s)
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={aiNotesInput}
                    onChange={(e) => setAiNotesInput(e.target.value)}
                    placeholder="Contoh: Semasa rondaan waktu rehat di tandas murid lelaki blok B, pengawas melaporkan terhidu bau asap vape. Apabila diserbu, murid ini didapati sedang memegang vape dan cuba membuangnya ke dalam mangkuk tandas..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium text-xs p-3 pb-12 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />

                  <button
                    type="button"
                    onClick={toggleSpeechRecording}
                    className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                      isRecording 
                        ? 'bg-rose-600 text-white animate-pulse' 
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                  >
                    {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                    <span>
                      {isRecording ? `Selesai Rakam (${recordingTimeLeft}s)` : 'Rakaman Suara (1 Minit)'}
                    </span>
                  </button>
                </div>

                {isRecording && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center justify-between animate-fade-in">
                    <span className="flex items-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                      Sedang merakam suara... Teks akan keluar di sini selepas selesai rakam.
                    </span>
                    <span className="font-mono text-xs font-black bg-rose-200 text-rose-950 px-2 py-0.5 rounded-lg">
                      {recordingTimeLeft}s
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAiDescription}
                  disabled={isAiGenerating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {isAiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Jana Kronologi 5W 1H</span>
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}

      {/* Disclaimer Akta Modal */}
      <DisclaimerAktaModal 
        isOpen={showDisclaimerModal} 
        onClose={() => setShowDisclaimerModal(false)} 
      />
    </>
  );
}
