import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { JENIS_KES_OPTIONS, printCaseReportPdf, compressAndConvertToBase64, cleanSpeechTranscript, processKeteranganFormat } from '../utils/kesHelper';
import DisclaimerAktaModal from './DisclaimerAktaModal';
import { 
  X, ShieldAlert, Sparkles, Mic, MicOff, Send, CheckCircle2, 
  AlertCircle, Loader2, FileText, RotateCcw, PenTool, ExternalLink, Printer,
  Image as ImageIcon, Upload, Trash2
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

  // All registered members for dropdown selection
  const [memberList, setMemberList] = useState<{ id: string; name: string; houseNo: string }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('manual');

  // Form State
  const defaultNamaPengadu = currentUserDoc?.displayName || currentUserDoc?.nickname || firebaseUser?.displayName || 'AJK Persatuan';
  const defaultRolePengadu = currentUserDoc?.role || 'AJK Persatuan';

  const [penerimaName, setPenerimaName] = useState('');
  const [penerimaHouseNo, setPenerimaHouseNo] = useState('');
  const [tarikhKes, setTarikhKes] = useState('');
  const [masaKes, setMasaKes] = useState('');
  const [jenisKes, setJenisKes] = useState(JENIS_KES_OPTIONS[0]);
  
  const [isPoliceReport, setIsPoliceReport] = useState(false);
  const [balaiPolis, setBalaiPolis] = useState('');
  const [noRepotPolis, setNoRepotPolis] = useState('');

  const [keterangan, setKeterangan] = useState('');
  const [buktiGambarUrl, setBuktiGambarUrl] = useState('');
  const [isUploadingBukti, setIsUploadingBukti] = useState(false);
  const [aiNotesInput, setAiNotesInput] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(60);

  const [isAgreedTerms, setIsAgreedTerms] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

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

  // Initialize dates & fetch member list on open
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setTarikhKes(now.toISOString().split('T')[0]);
      setMasaKes(now.toTimeString().slice(0, 5));
      setPenerimaName('');
      setPenerimaHouseNo('');
      setJenisKes(JENIS_KES_OPTIONS[0]);
      setIsPoliceReport(false);
      setBalaiPolis('');
      setNoRepotPolis('');
      setKeterangan('');
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

  // Fetch approved members from Firestore
  const fetchMembers = async () => {
    try {
      if (!db) return;
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      const list: { id: string; name: string; houseNo: string }[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        const name = data.displayName || data.nickname || 'Ahli';
        const houseNo = data.noRumah || data.houseNo || 'Tiada No Rumah';
        list.push({ id: doc.id, name, houseNo });
      });
      // Sort alphabetically
      list.sort((a, b) => a.name.localeCompare(b.name));
      setMemberList(list);
    } catch (err) {
      console.warn('Gagal memuat senarai ahli:', err);
    }
  };

  // Handle member dropdown change
  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMemberId(val);
    if (val === 'manual') {
      setPenerimaName('');
      setPenerimaHouseNo('');
    } else {
      const found = memberList.find(m => m.id === val);
      if (found) {
        setPenerimaName(found.name);
        setPenerimaHouseNo(found.houseNo);
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

  // Canvas Drawing logic for Pengadu
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

  // Canvas Drawing logic for Penerima
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

  // Stop Web Speech API recording and process transcript cleanly
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

    // Process captured transcript ONLY upon stopping recording
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

  // Toggle Web Speech API recording with 1-minute (60 seconds) limit
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

        // Auto restart if browser stops speech recognition prematurely before 60 seconds
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

  // Handle AI Description Generation
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
          namaPenerima: penerimaName,
          noRumah: penerimaHouseNo,
          tarikhKes,
          masaKes,
          isPoliceReport,
          balaiPolis
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menjana keterangan kes.');

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

  // Generate Case Number
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
          if (lastData.caseNo && lastData.caseNo.startsWith(`KES-${year}-`)) {
            const lastSeq = parseInt(lastData.caseNo.split('-')[2], 10);
            if (!isNaN(lastSeq)) num = lastSeq + 1;
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca nombor kes terdahulu:', e);
    }
    return `KES-${year}-${String(num).padStart(4, '0')}`;
  };

  // Submit Form to Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keterangan.trim()) {
      setErrorMessage('Sila masukkan Keterangan Kes.');
      return;
    }
    if (!isAgreedTerms) {
      setErrorMessage('Anda perlu menanda jawapan pengesahan undang-undang.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const caseNo = await generateCaseNumber();
      const newRecord: Omit<CaseRecord, 'id'> = {
        caseNo,
        pengaduUid: firebaseUser?.uid || 'AJK',
        pengaduName: defaultNamaPengadu,
        pengaduRole: defaultRolePengadu,
        penerimaName: penerimaName.trim() || 'Tidak Dinyatakan',
        penerimaHouseNo: penerimaHouseNo.trim() || '-',
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
        createdAt: new Date().toISOString()
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

      // Trigger Auto Push Notification to AJK
      import('../utils/notificationHelper').then(({ notifyOnSafetyCase }) => {
        notifyOnSafetyCase(`${jenisKes}: ${keterangan.slice(0, 50)}...`, finalSavedRecord.id).catch(err => console.warn('Push error:', err));
      }).catch(err => console.warn(err));

      setSubmitSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Gagal mendaftar kes:', err);
      setErrorMessage(err.message || 'Gagal mendaftarkan kes ke dalam pangkalan data.');
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
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10 my-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-center bg-rose-950 px-5 sm:px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-sm sm:text-base tracking-tight text-white">
                      Borang Pendaftaran Rekod Kes Komuniti
                    </h2>
                    <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded uppercase tracking-wider">
                      Khusus AJK
                    </span>
                  </div>
                  <p className="text-[10px] text-rose-200/80">
                    Untuk Rekod Simpanan Persatuan PTMF2 & Rujukan Pihak Berkuasa
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
            <div className="p-5 sm:p-6 overflow-y-auto max-h-[80vh] space-y-5">
              {submitSuccess && createdCaseRecord ? (
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
                    <h3 className="text-lg font-black text-slate-800">Kes Berjaya Didaftarkan!</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Rekod kes telah disimpan secara rasmi ke dalam sistem persatuan dan sedia untuk dicetak atau dirujuk kepada PDRM / pihak berkuasa.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => printCaseReportPdf(createdCaseRecord)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Printer size={16} />
                      <span>Cetak / Muat Turun PDF Laporan</span>
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
                /* Form View */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 font-medium">
                      <AlertCircle size={16} className="shrink-0 text-rose-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Pengadu (Auto Log In - Disabled) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Nama Pengadu (AJK Yang Tolong Daftarkan)
                      </label>
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-bold rounded">
                        Auto User Log-in
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={defaultNamaPengadu}
                        disabled
                        className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-lg cursor-not-allowed"
                      />
                      <span className="shrink-0 px-2.5 py-2 bg-slate-200 text-slate-700 font-extrabold text-[10px] rounded-lg">
                        {defaultRolePengadu}
                      </span>
                    </div>
                  </div>

                  {/* Penerima Kes / Pihak Terlibat */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Pilih / Taip Nama Penerima Kes <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedMemberId}
                        onChange={handleMemberSelect}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                      >
                        <option value="manual">-- Taip Manual / Lain-lain --</option>
                        {memberList.map(m => (
                          <option key={m.id} value={m.id}>
                            [{m.houseNo}] {m.name}
                          </option>
                        ))}
                      </select>
                      {selectedMemberId === 'manual' && (
                        <input 
                          type="text"
                          value={penerimaName}
                          onChange={(e) => setPenerimaName(e.target.value)}
                          placeholder="Masukkan nama penuh penerima kes / mangsa"
                          className="w-full mt-1.5 bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                          required
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        No. Rumah Penerima Kes <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text"
                        value={penerimaHouseNo}
                        onChange={(e) => setPenerimaHouseNo(e.target.value)}
                        placeholder="Contoh: No. 123"
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  {/* Tarikh Kes & Masa Kes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Tarikh Kes <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="date"
                        value={tarikhKes}
                        onChange={(e) => setTarikhKes(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Masa Kes <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="time"
                        value={masaKes}
                        onChange={(e) => setMasaKes(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  {/* Jenis Kes */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                      Jenis Kes (Kategori Kejadian Perumahan) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={jenisKes}
                      onChange={(e) => setJenisKes(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-900 font-black text-xs px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden cursor-pointer"
                    >
                      {JENIS_KES_OPTIONS.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Melibatkan Kes Polis (PDRM)? */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                        Melibatkan Kes Polis (PDRM)?
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
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200"
                      >
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase block">
                            Nama Balai Polis Yang Dilaporkan <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="text"
                            value={balaiPolis}
                            onChange={(e) => setBalaiPolis(e.target.value)}
                            placeholder="Contoh: Balai Polis Batu Kikir / IPD Bahau"
                            className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-lg focus:ring-2 focus:ring-rose-500 outline-hidden"
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
                            className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-lg focus:ring-2 focus:ring-rose-500 outline-hidden"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Keterangan Kes */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Keterangan & Kronologi Kes <span className="text-rose-500">*</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowAiModal(true)}
                        className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-extrabold rounded-lg hover:brightness-110 cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Sparkles size={12} />
                        <span>Bantuan AI / Suara</span>
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      placeholder="Nyatakan dengan terperinci kronologi kes, nilai kerugian/kerosakan, pihak terlibat, serta tindakan susulan..."
                      className="w-full bg-white border border-slate-200 text-slate-800 font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden leading-relaxed resize-none"
                      required
                    />

                    {/* Gambar Bukti Kejadian (Optional) */}
                    <div className="pt-1">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">
                        Gambar Bukti Kes / Kejadian <span className="text-slate-400 font-normal">(Tidak Wajib)</span>
                      </label>
                      {buktiGambarUrl ? (
                        <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 max-w-xs">
                          <img 
                            src={buktiGambarUrl} 
                            alt="Bukti Kes" 
                            className="w-full h-36 object-cover rounded-lg border border-slate-200" 
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
                        <label className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl cursor-pointer transition-colors text-slate-600">
                          {isUploadingBukti ? (
                            <>
                              <Loader2 size={16} className="animate-spin text-indigo-600" />
                              <span className="text-xs font-bold text-slate-700">Memproses Gambar...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={16} className="text-indigo-600" />
                              <span className="text-xs font-bold">Muat Naik 1 Gambar Bukti (JPEG / PNG)</span>
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
                  </div>

                  {/* Canvas Signatures Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    {/* Tandatangan Pengadu */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Tandatangan Pengadu (AJK)
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
                          width={260}
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
                            Sila lukis tandatangan AJK di sini
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tandatangan Penerima */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                          Tandatangan Penerima / Saksi
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
                          width={260}
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
                            Sila lukis tandatangan Penerima di sini
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pengesahan Checkbox & Hyperlink */}
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
                        Saya mengesahkan bahawa semua maklumat, tarikh, dan keterangan kes yang dilaporkan di atas adalah BENAR dan dibuat tanpa niat jahat.
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowDisclaimerModal(true)}
                      className="text-[10px] text-rose-700 font-black hover:underline flex items-center gap-1 pl-6 cursor-pointer"
                    >
                      <span>Lihat Terma Pengesahan & Akta Kesalahan Maklumat Palsu (Seksyen 182 / 233)</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>

                  {/* Buttons */}
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
                      className="flex-1 py-3 bg-rose-700 hover:bg-rose-800 text-white text-xs font-black rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Mendaftar Kes...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Daftarkan Rekod Kes</span>
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

      {/* AI Assistance Sub-modal */}
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
                  <span>Penjana Keterangan Kes Rasmi AI</span>
                </div>
                <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Taip nota ringkas atau tekan butang mikrofon untuk merakam suara anda (had 1 minit sekali tekan).
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
                    placeholder="Contoh: Pada pukul 10 malam semalam jiran ternampak dua orang mencurigakan naik motor tanpa no plat pusing rumah 45..."
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
                  <span>Jana Keterangan Rasmi</span>
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
