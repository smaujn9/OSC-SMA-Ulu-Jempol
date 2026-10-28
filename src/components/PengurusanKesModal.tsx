import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { printCaseReportPdf, JENIS_KES_OPTIONS, isAjkUser, compressAndConvertToBase64 } from '../utils/kesHelper';
import { CaseRecord } from '../types';
import { 
  X, ShieldAlert, Search, Filter, Printer, FileText, 
  Pencil, Trash2, AlertTriangle, Loader2, Save, CheckCircle2,
  PenTool, RotateCcw, Check, ChevronDown, Upload, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PengurusanKesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister: () => void;
}

function ExpandableText({ text, className = '' }: { text?: string; className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > 150 || text.includes('\n');

  return (
    <div className={className}>
      <div 
        className={`leading-relaxed transition-all duration-200 ${
          isExpanded 
            ? 'whitespace-pre-wrap' 
            : 'line-clamp-3 whitespace-pre-line overflow-hidden'
        }`}
      >
        {text}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mt-1.5 text-[11px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>{isExpanded ? 'Tutup / Ringkaskan' : 'Lihat Lebih Lanjut...'}</span>
          <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

export default function PengurusanKesModal({ isOpen, onClose, onOpenRegister }: PengurusanKesModalProps) {
  const { currentUserDoc } = useAuth();
  const isAdminUtama = currentUserDoc?.role === 'Admin Utama' || currentUserDoc?.role === 'ADMIN UTAMA' || currentUserDoc?.isSuperAdmin === true || currentUserDoc?.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my';
  const canChangeStatus = isAjkUser(currentUserDoc);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');

  // Delete confirmation state
  const [caseToDelete, setCaseToDelete] = useState<CaseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state
  const [caseToEdit, setCaseToEdit] = useState<CaseRecord | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editPenerimaName, setEditPenerimaName] = useState('');
  const [editPenerimaHouseNo, setEditPenerimaHouseNo] = useState('');
  const [editTarikhKes, setEditTarikhKes] = useState('');
  const [editMasaKes, setEditMasaKes] = useState('');
  const [editJenisKes, setEditJenisKes] = useState('');
  const [editStatus, setEditStatus] = useState<CaseRecord['status']>('Dalam Siasatan');
  const [editIsPoliceReport, setEditIsPoliceReport] = useState(false);
  const [editBalaiPolis, setEditBalaiPolis] = useState('');
  const [editNoRepotPolis, setEditNoRepotPolis] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');
  const [editBuktiGambarUrl, setEditBuktiGambarUrl] = useState('');
  const [editKeteranganSiasatan, setEditKeteranganSiasatan] = useState('');
  const [editKeteranganSelesai, setEditKeteranganSelesai] = useState('');
  const [editBuktiSelesaiUrl, setEditBuktiSelesaiUrl] = useState('');
  const [isUploadingEditBukti, setIsUploadingEditBukti] = useState(false);
  const [isUploadingEditSelesai, setIsUploadingEditSelesai] = useState(false);

  // Status Change Modal State (Quick status & investigation update)
  const [statusUpdateCase, setStatusUpdateCase] = useState<CaseRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<CaseRecord['status']>('Dalam Siasatan');
  const [statusKeteranganSiasatan, setStatusKeteranganSiasatan] = useState('');
  const [statusKeteranganSelesai, setStatusKeteranganSelesai] = useState('');
  const [statusBuktiSelesaiUrl, setStatusBuktiSelesaiUrl] = useState('');
  const [isUploadingStatusSelesai, setIsUploadingStatusSelesai] = useState(false);
  const [isSavingStatusUpdate, setIsSavingStatusUpdate] = useState(false);

  // Signature Modal State
  const [signTarget, setSignTarget] = useState<{ caseItem: CaseRecord; type: 'pengadu' | 'penerima' } | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCases();
    }
  }, [isOpen]);

  const fetchCases = async () => {
    setIsLoading(true);
    try {
      if (!db) return;
      const casesRef = collection(db, 'cases');
      const q = query(casesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: CaseRecord[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CaseRecord);
      });
      setCases(list);
    } catch (err) {
      console.warn('Gagal memuatkan rekod kes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (caseId: string, newStatus: CaseRecord['status']) => {
    if (!canChangeStatus) return;
    const foundCase = cases.find(c => c.id === caseId);
    if (foundCase) {
      openStatusUpdateModal(foundCase, newStatus);
    }
  };

  const openStatusUpdateModal = (c: CaseRecord, newStatus?: CaseRecord['status']) => {
    setStatusUpdateCase(c);
    setTargetStatus(newStatus || c.status);
    setStatusKeteranganSiasatan(c.keteranganSiasatan || '');
    setStatusKeteranganSelesai(c.keteranganSelesai || '');
    setStatusBuktiSelesaiUrl(c.buktiSelesaiUrl || '');
  };

  const handleSaveStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusUpdateCase) return;
    setIsSavingStatusUpdate(true);
    try {
      const updateData: Partial<CaseRecord> = {
        status: targetStatus,
        keteranganSiasatan: statusKeteranganSiasatan.trim(),
        keteranganSelesai: statusKeteranganSelesai.trim(),
        buktiSelesaiUrl: statusBuktiSelesaiUrl,
        updatedAt: new Date().toISOString()
      };

      if (db) {
        await updateDoc(doc(db, 'cases', statusUpdateCase.id), updateData);
      }

      setCases(prev => prev.map(c => c.id === statusUpdateCase.id ? { ...c, ...updateData } : c));
      setStatusUpdateCase(null);
    } catch (err: any) {
      alert(`Gagal menyimpan kemas kini status: ${err.message || 'Ralat'}`);
    } finally {
      setIsSavingStatusUpdate(false);
    }
  };

  const handleEditBuktiGambarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingEditBukti(true);
    try {
      const base64 = await compressAndConvertToBase64(file);
      setEditBuktiGambarUrl(base64);
    } catch (err) {
      alert('Gagal memproses gambar bukti.');
    } finally {
      setIsUploadingEditBukti(false);
    }
  };

  const handleEditBuktiSelesaiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingEditSelesai(true);
    try {
      const base64 = await compressAndConvertToBase64(file);
      setEditBuktiSelesaiUrl(base64);
    } catch (err) {
      alert('Gagal memproses gambar penyelesaian.');
    } finally {
      setIsUploadingEditSelesai(false);
    }
  };

  const handleStatusBuktiSelesaiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingStatusSelesai(true);
    try {
      const base64 = await compressAndConvertToBase64(file);
      setStatusBuktiSelesaiUrl(base64);
    } catch (err) {
      alert('Gagal memproses gambar penyelesaian.');
    } finally {
      setIsUploadingStatusSelesai(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!caseToDelete) return;
    setIsDeleting(true);
    try {
      if (db) {
        await deleteDoc(doc(db, 'cases', caseToDelete.id));
      }
      setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
      setCaseToDelete(null);
    } catch (err: any) {
      alert(`Gagal memadam kes: ${err.message || 'Ralat pelayan'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit Form
  const handleOpenEdit = (c: CaseRecord) => {
    setCaseToEdit(c);
    setEditPenerimaName(c.penerimaName || '');
    setEditPenerimaHouseNo(c.penerimaHouseNo || '');
    setEditTarikhKes(c.tarikhKes || '');
    setEditMasaKes(c.masaKes || '');
    setEditJenisKes(c.jenisKes || JENIS_KES_OPTIONS[0]);
    setEditStatus(c.status || 'Dalam Siasatan');
    setEditIsPoliceReport(c.isPoliceReport || false);
    setEditBalaiPolis(c.balaiPolis || '');
    setEditNoRepotPolis(c.noRepotPolis || '');
    setEditKeterangan(c.keterangan || '');
    setEditBuktiGambarUrl(c.buktiGambarUrl || '');
    setEditKeteranganSiasatan(c.keteranganSiasatan || '');
    setEditKeteranganSelesai(c.keteranganSelesai || '');
    setEditBuktiSelesaiUrl(c.buktiSelesaiUrl || '');
  };

  // Save Edit Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseToEdit) return;
    setIsSavingEdit(true);

    try {
      const updatedData = {
        penerimaName: editPenerimaName.trim(),
        penerimaHouseNo: editPenerimaHouseNo.trim(),
        tarikhKes: editTarikhKes,
        masaKes: editMasaKes,
        jenisKes: editJenisKes,
        status: editStatus,
        isPoliceReport: editIsPoliceReport,
        balaiPolis: editIsPoliceReport ? editBalaiPolis.trim() : '',
        noRepotPolis: editIsPoliceReport ? editNoRepotPolis.trim() : '',
        keterangan: editKeterangan.trim(),
        buktiGambarUrl: editBuktiGambarUrl,
        keteranganSiasatan: editKeteranganSiasatan.trim(),
        keteranganSelesai: editKeteranganSelesai.trim(),
        buktiSelesaiUrl: editBuktiSelesaiUrl,
        updatedAt: new Date().toISOString()
      };

      if (db) {
        await updateDoc(doc(db, 'cases', caseToEdit.id), updatedData);
      }

      setCases(prev => prev.map(c => c.id === caseToEdit.id ? { ...c, ...updatedData } : c));
      setCaseToEdit(null);
    } catch (err: any) {
      alert(`Gagal menyimpan kemas kini: ${err.message || 'Ralat'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Signature Canvas Drawing Logic
  const openSignatureModal = (caseItem: CaseRecord, type: 'pengadu' | 'penerima') => {
    setSignTarget({ caseItem, type });
    setSignatureDataUrl('');
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
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

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        setSignatureDataUrl(canvas.toDataURL('image/png'));
      }
    }
  };

  const clearCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl('');
  };

  const handleSaveSignature = async () => {
    if (!signTarget || !signatureDataUrl) return;
    setIsSavingSignature(true);
    try {
      const fieldToUpdate = signTarget.type === 'pengadu' ? 'pengaduSignatureUrl' : 'penerimaSignatureUrl';
      const updateData = {
        [fieldToUpdate]: signatureDataUrl,
        updatedAt: new Date().toISOString()
      };

      if (db) {
        await updateDoc(doc(db, 'cases', signTarget.caseItem.id), updateData);
      }

      setCases(prev => prev.map(c => c.id === signTarget.caseItem.id ? { ...c, ...updateData } : c));
      setSignTarget(null);
    } catch (err: any) {
      alert(`Gagal menyimpan tandatangan: ${err.message || 'Ralat'}`);
    } finally {
      setIsSavingSignature(false);
    }
  };

  const filteredCases = cases.filter(c => {
    const matchQuery = 
      c.caseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.pengaduName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.penerimaName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.jenisKes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.penerimaHouseNo.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'Semua') return matchQuery;
    return matchQuery && c.status === statusFilter;
  });

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

          {/* Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10 max-h-[88vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-start sm:items-center bg-slate-900 px-4 sm:px-6 py-4 text-white gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                    Pengurusan Rekod Kes Keselamatan Komuniti
                  </h2>
                  <p className="text-[10px] text-slate-400">Arsip Laporan Kes Serius AJK Persatuan PTMF2</p>

                  {/* Mobile View Button under subtext */}
                  <div className="mt-2.5 sm:hidden">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenRegister();
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>+ Daftarkan Kes Baru</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Desktop View Button */}
                <button
                  onClick={() => {
                    onClose();
                    onOpenRegister();
                  }}
                  className="hidden sm:flex px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-sm items-center gap-1.5"
                >
                  <span>+ Daftarkan Kes Baru</span>
                </button>

                <button 
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari No. Kes, Nama Pengadu, Jenis Kes, atau No Rumah..."
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold pl-9 pr-3 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden cursor-pointer"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="Dalam Siasatan">Dalam Siasatan</option>
                  <option value="Dirujuk PDRM">Dirujuk PDRM</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Arsip">Arsip</option>
                </select>
              </div>
            </div>

            {/* Main List */}
            <div className="p-6 overflow-y-auto space-y-4">
              {isLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  Memuatkan senarai kes...
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FileText className="mx-auto text-slate-300" size={32} />
                  <p className="text-xs font-bold text-slate-600">Tiada rekod kes ditemui.</p>
                  <p className="text-[10px] text-slate-400">Tekan "+ Daftarkan Kes Baru" untuk memasukkan laporan pertama.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCases.map((c) => (
                    <div 
                      key={c.id}
                      className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-400 transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-900 px-2.5 py-1 bg-slate-100 rounded-md">
                            {c.caseNo}
                          </span>

                          {canChangeStatus ? (
                            <div className="relative inline-flex items-center">
                              <select
                                value={c.status}
                                onChange={(e) => handleUpdateStatus(c.id, e.target.value as any)}
                                className={`appearance-none cursor-pointer text-[10px] font-black px-2.5 py-1 pr-6 rounded-full uppercase tracking-wider border shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                                  c.status === 'Selesai' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200' :
                                  c.status === 'Dirujuk PDRM' ? 'bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200' :
                                  c.status === 'Dalam Siasatan' ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' :
                                  'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                }`}
                                title="Klik untuk ubah status kes"
                              >
                                <option value="Dalam Siasatan" className="bg-white text-slate-900 font-bold">Dalam Siasatan</option>
                                <option value="Dirujuk PDRM" className="bg-white text-slate-900 font-bold">Dirujuk PDRM</option>
                                <option value="Selesai" className="bg-white text-slate-900 font-bold">Selesai</option>
                                <option value="Arsip" className="bg-white text-slate-900 font-bold">Arsip</option>
                              </select>
                              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-70" />
                            </div>
                          ) : (
                            <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase ${
                              c.status === 'Selesai' ? 'bg-emerald-100 text-emerald-800' :
                              c.status === 'Dirujuk PDRM' ? 'bg-indigo-100 text-indigo-800' :
                              c.status === 'Dalam Siasatan' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {c.status}
                            </span>
                          )}
                        </div>

                        {/* Action Row */}
                        <div className="flex items-center gap-1.5">
                          {/* Print PDF Button (Icon Only without text) */}
                          <button
                            type="button"
                            onClick={() => printCaseReportPdf(c)}
                            title="Cetak Laporan Kes (A4 Portrait)"
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
                          >
                            <Printer size={13} />
                          </button>

                          {/* Admin Utama Only: Icon-Only Edit & Delete Buttons */}
                          {isAdminUtama && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(c)}
                                title="Edit Kes"
                                className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
                              >
                                <Pencil size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setCaseToDelete(c)}
                                title="Padam Kes"
                                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Pengadu (AJK)</span>
                          <p className="font-extrabold text-slate-800">{c.pengaduName}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Penerima Kes</span>
                          <p className="font-extrabold text-slate-800">{c.penerimaName} (No. {c.penerimaHouseNo})</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Jenis Kes</span>
                          <p className="font-extrabold text-rose-700">{c.jenisKes}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700 font-normal leading-relaxed space-y-2">
                        <ExpandableText text={c.keterangan} />

                        {c.buktiGambarUrl && (
                          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2.5">
                            <img 
                              src={c.buktiGambarUrl} 
                              alt="Bukti Kejadian" 
                              className="h-16 w-24 object-cover rounded-lg border border-slate-200 shrink-0 cursor-pointer hover:opacity-90"
                              onClick={() => window.open(c.buktiGambarUrl, '_blank')}
                              title="Klik untuk lihat gambar penuh"
                            />
                            <div>
                              <span className="text-[10px] font-black text-slate-600 uppercase block">Gambar Bukti Kejadian</span>
                              <span className="text-[10px] text-slate-400">Dimuat naik semasa pendaftaran kes</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Keterangan Semasa Siasatan (Jika status Dalam Siasatan atau wujud rekod) */}
                      {(c.status === 'Dalam Siasatan' || c.keteranganSiasatan) && (
                        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                              ⚡ Keterangan Semasa Siasatan
                            </span>
                            {canChangeStatus && (
                              <button
                                type="button"
                                onClick={() => openStatusUpdateModal(c, 'Dalam Siasatan')}
                                className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                              >
                                Kemaskini Siasatan
                              </button>
                            )}
                          </div>
                          {c.keteranganSiasatan ? (
                            <ExpandableText text={c.keteranganSiasatan} />
                          ) : (
                            <p className="italic text-amber-700/60 font-normal text-xs">Tiada keterangan siasatan dimasukkan lagi.</p>
                          )}
                        </div>
                      )}

                      {/* Keterangan & Bukti Selepas Selesai Siasatan (Jika status Selesai atau wujud rekod) */}
                      {(c.status === 'Selesai' || c.keteranganSelesai || c.buktiSelesaiUrl) && (
                        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                              ✅ Keterangan Selepas Selesai Siasatan
                            </span>
                            {canChangeStatus && (
                              <button
                                type="button"
                                onClick={() => openStatusUpdateModal(c, 'Selesai')}
                                className="text-[10px] font-bold text-emerald-800 hover:underline cursor-pointer"
                              >
                                Kemaskini Selesai
                              </button>
                            )}
                          </div>
                          {c.keteranganSelesai ? (
                            <ExpandableText text={c.keteranganSelesai} />
                          ) : (
                            <p className="italic text-emerald-700/60 text-[11px]">Tiada keterangan penyelesaian dimasukkan lagi.</p>
                          )}
                          {c.buktiSelesaiUrl && (
                            <div className="flex items-center gap-2.5 pt-2 border-t border-emerald-200/60">
                              <img 
                                src={c.buktiSelesaiUrl} 
                                alt="Bukti Selesai" 
                                className="h-16 w-24 object-cover rounded-lg border border-emerald-300 shrink-0 cursor-pointer hover:opacity-90"
                                onClick={() => window.open(c.buktiSelesaiUrl, '_blank')}
                                title="Klik untuk lihat gambar penuh"
                              />
                              <div>
                                <span className="text-[10px] font-black text-emerald-900 uppercase block">Gambar / Bukti Penyelesaian</span>
                                <span className="text-[10px] text-emerald-700">Lampiran bukti selepas selesai siasatan</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Direct Signature Action Bar */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Signature Pengadu Button */}
                          <button
                            type="button"
                            onClick={() => openSignatureModal(c, 'pengadu')}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                              c.pengaduSignatureUrl 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            <PenTool size={12} className={c.pengaduSignatureUrl ? 'text-emerald-600' : 'text-slate-500'} />
                            <span>
                              {c.pengaduSignatureUrl ? '✓ T.Tangan Pengadu' : '+ T.Tangan Pengadu'}
                            </span>
                          </button>

                          {/* Signature Penerima Button */}
                          <button
                            type="button"
                            onClick={() => openSignatureModal(c, 'penerima')}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                              c.penerimaSignatureUrl 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            <PenTool size={12} className={c.penerimaSignatureUrl ? 'text-emerald-600' : 'text-slate-500'} />
                            <span>
                              {c.penerimaSignatureUrl ? '✓ T.Tangan Penerima' : '+ T.Tangan Penerima'}
                            </span>
                          </button>
                        </div>

                        <div className="text-[10px] text-slate-400 font-medium">
                          Tarikh Kes: {c.tarikhKes} ({c.masaKes})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
        {signTarget && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSignTarget(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-slate-100 z-10 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <PenTool size={18} className="text-rose-600" />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Tandatangan {signTarget.type === 'pengadu' ? 'Pengadu (AJK)' : 'Penerima Kes'}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Penandatangan: <strong>{signTarget.type === 'pengadu' ? signTarget.caseItem.pengaduName : (signTarget.caseItem.penerimaName || 'Penerima')}</strong>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSignTarget(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Canvas Area */}
              <div className="space-y-2">
                <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 p-2 touch-none">
                  <canvas 
                    ref={signatureCanvasRef}
                    width={380}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-36 bg-white rounded-lg cursor-crosshair border border-slate-200"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-medium">Sila lukis tandatangan di atas skrin</span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span>Padam semula</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSignTarget(null)}
                  disabled={isSavingSignature}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={isSavingSignature || !signatureDataUrl}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isSavingSignature ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Simpan Tandatangan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {caseToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCaseToDelete(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-rose-100 z-10 text-center space-y-4"
            >
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800">Pengesahan Padam Rekod Kes</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Adakah anda pasti mahu memadam rekod kes <strong className="text-slate-900">{caseToDelete.caseNo}</strong> ({caseToDelete.jenisKes}) ini secara kekal?
                </p>
                <p className="text-[10px] text-rose-600 font-bold pt-1">
                  Tindakan ini tidak boleh dibatalkan.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCaseToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>Padam Rekod</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Case Modal (Admin Utama Only) */}
      <AnimatePresence>
        {caseToEdit && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCaseToEdit(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10 my-auto"
            >
              <div className="flex justify-between items-center bg-slate-900 px-5 py-3.5 text-white">
                <div className="flex items-center gap-2">
                  <Pencil size={16} className="text-amber-400" />
                  <h3 className="font-extrabold text-sm text-white">
                    Edit Rekod Kes: {caseToEdit.caseNo}
                  </h3>
                </div>
                <button 
                  onClick={() => setCaseToEdit(null)}
                  className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 overflow-y-auto max-h-[75vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Penerima Kes</label>
                    <input 
                      type="text"
                      value={editPenerimaName}
                      onChange={(e) => setEditPenerimaName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">No. Rumah</label>
                    <input 
                      type="text"
                      value={editPenerimaHouseNo}
                      onChange={(e) => setEditPenerimaHouseNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Tarikh Kes</label>
                    <input 
                      type="date"
                      value={editTarikhKes}
                      onChange={(e) => setEditTarikhKes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-2.5 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Masa Kes</label>
                    <input 
                      type="time"
                      value={editMasaKes}
                      onChange={(e) => setEditMasaKes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-2.5 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Status Kes</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-2 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden cursor-pointer"
                    >
                      <option value="Dalam Siasatan">Dalam Siasatan</option>
                      <option value="Dirujuk PDRM">Dirujuk PDRM</option>
                      <option value="Selesai">Selesai</option>
                      <option value="Arsip">Arsip</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Jenis Kes</label>
                  <select
                    value={editJenisKes}
                    onChange={(e) => setEditJenisKes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden cursor-pointer"
                  >
                    {JENIS_KES_OPTIONS.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-700 uppercase">Laporan PDRM</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                      <input 
                        type="checkbox"
                        checked={editIsPoliceReport}
                        onChange={(e) => setEditIsPoliceReport(e.target.checked)}
                        className="rounded text-slate-900 focus:ring-slate-900"
                      />
                      <span>Ya, Dilaporkan ke Polis</span>
                    </label>
                  </div>

                  {editIsPoliceReport && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <input 
                          type="text"
                          value={editBalaiPolis}
                          onChange={(e) => setEditBalaiPolis(e.target.value)}
                          placeholder="Nama Balai Polis"
                          className="w-full bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg"
                        />
                      </div>
                      <div>
                        <input 
                          type="text"
                          value={editNoRepotPolis}
                          onChange={(e) => setEditNoRepotPolis(e.target.value)}
                          placeholder="No. Repot Polis"
                          className="w-full bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Keterangan Kes</label>
                  <textarea
                    rows={4}
                    value={editKeterangan}
                    onChange={(e) => setEditKeterangan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium text-xs p-3 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden leading-relaxed resize-none"
                    required
                  />
                </div>

                {/* Gambar Bukti Kejadian (Optional) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Gambar Bukti Kejadian (Not required)</label>
                  {editBuktiGambarUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex items-center justify-between">
                      <img src={editBuktiGambarUrl} alt="Bukti Kejadian" className="h-16 w-24 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setEditBuktiGambarUrl('')}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={14} /> Padam Gambar
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl bg-slate-50 cursor-pointer text-slate-500 hover:text-slate-700 transition-all">
                      <Upload size={18} className="text-slate-400 mb-1" />
                      <span className="text-[11px] font-bold">{isUploadingEditBukti ? 'Memproses gambar...' : 'Muat Naik Gambar Bukti'}</span>
                      <input type="file" accept="image/*" onChange={handleEditBuktiGambarUpload} className="hidden" disabled={isUploadingEditBukti} />
                    </label>
                  )}
                </div>

                {/* Status Siasatan Text Areas */}
                {editStatus === 'Dalam Siasatan' && (
                  <div className="space-y-1.5 p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                    <label className="text-[10px] font-black text-amber-900 uppercase block">
                      Keterangan Semasa Siasatan
                    </label>
                    <textarea
                      rows={3}
                      value={editKeteranganSiasatan}
                      onChange={(e) => setEditKeteranganSiasatan(e.target.value)}
                      placeholder="Keterangan perkembangan siasatan oleh AJK..."
                      className="w-full bg-white border border-amber-200 text-slate-800 font-medium text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed resize-none"
                    />
                  </div>
                )}

                {editStatus === 'Selesai' && (
                  <div className="space-y-3 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-emerald-900 uppercase block">
                        Keterangan Selepas Selesai Siasatan
                      </label>
                      <textarea
                        rows={3}
                        value={editKeteranganSelesai}
                        onChange={(e) => setEditKeteranganSelesai(e.target.value)}
                        placeholder="Keterangan rumusan selepas kes diselesaikan..."
                        className="w-full bg-white border border-emerald-200 text-slate-800 font-medium text-xs p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden leading-relaxed resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-900 uppercase block">
                        Gambar Selepas Selesai Siasatan / Bukti Penyelesaian (Not required)
                      </label>
                      {editBuktiSelesaiUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-white p-2 flex items-center justify-between">
                          <img src={editBuktiSelesaiUrl} alt="Bukti Selesai" className="h-16 w-24 object-cover rounded-lg border" />
                          <button
                            type="button"
                            onClick={() => setEditBuktiSelesaiUrl('')}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={14} /> Padam Gambar
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl bg-white cursor-pointer text-emerald-700 transition-all">
                          <Upload size={18} className="text-emerald-500 mb-1" />
                          <span className="text-[11px] font-bold">{isUploadingEditSelesai ? 'Memproses gambar...' : 'Muat Naik Gambar Bukti Penyelesaian'}</span>
                          <input type="file" accept="image/*" onChange={handleEditBuktiSelesaiUpload} className="hidden" disabled={isUploadingEditSelesai} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCaseToEdit(null)}
                    disabled={isSavingEdit}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Status & Investigation Update Modal */}
      <AnimatePresence>
        {statusUpdateCase && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStatusUpdateCase(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10 my-auto"
            >
              <div className="flex justify-between items-center bg-slate-900 px-5 py-3.5 text-white">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-400" />
                  <div>
                    <h3 className="font-extrabold text-sm text-white">
                      Kemaskini Status & Siasatan Kes
                    </h3>
                    <p className="text-[10px] text-slate-400">No. Kes: {statusUpdateCase.caseNo}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setStatusUpdateCase(null)}
                  className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveStatusUpdate} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Status Kes</label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-extrabold text-xs px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-slate-900 outline-hidden cursor-pointer"
                  >
                    <option value="Dalam Siasatan">Dalam Siasatan</option>
                    <option value="Dirujuk PDRM">Dirujuk PDRM</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Arsip">Arsip</option>
                  </select>
                </div>

                {targetStatus === 'Dalam Siasatan' && (
                  <div className="space-y-1.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <label className="text-[10px] font-black text-amber-900 uppercase block">
                      Keterangan Semasa Siasatan
                    </label>
                    <textarea
                      rows={4}
                      value={statusKeteranganSiasatan}
                      onChange={(e) => setStatusKeteranganSiasatan(e.target.value)}
                      placeholder="Masukkan perincian tindakan dan perkembangan siasatan oleh AJK..."
                      className="w-full bg-white border border-amber-200 text-slate-800 font-medium text-xs p-3 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed resize-none"
                    />
                  </div>
                )}

                {targetStatus === 'Selesai' && (
                  <div className="space-y-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-emerald-900 uppercase block">
                        Keterangan Selepas Selesai Siasatan
                      </label>
                      <textarea
                        rows={4}
                        value={statusKeteranganSelesai}
                        onChange={(e) => setStatusKeteranganSelesai(e.target.value)}
                        placeholder="Masukkan rumusan dan penjelasan selepas kes diselesaikan..."
                        className="w-full bg-white border border-emerald-200 text-slate-800 font-medium text-xs p-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden leading-relaxed resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-900 uppercase block">
                        Gambar Selepas Selesai Siasatan / Bukti Penyelesaian (Not required)
                      </label>
                      {statusBuktiSelesaiUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-white p-2 flex items-center justify-between">
                          <img src={statusBuktiSelesaiUrl} alt="Bukti Selesai" className="h-16 w-24 object-cover rounded-lg border" />
                          <button
                            type="button"
                            onClick={() => setStatusBuktiSelesaiUrl('')}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={14} /> Padam Gambar
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl bg-white cursor-pointer text-emerald-700 transition-all">
                          <Upload size={18} className="text-emerald-500 mb-1" />
                          <span className="text-[11px] font-bold">{isUploadingStatusSelesai ? 'Memproses gambar...' : 'Muat Naik Gambar Bukti Penyelesaian'}</span>
                          <input type="file" accept="image/*" onChange={handleStatusBuktiSelesaiUpload} className="hidden" disabled={isUploadingStatusSelesai} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStatusUpdateCase(null)}
                    disabled={isSavingStatusUpdate}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingStatusUpdate}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isSavingStatusUpdate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Simpan Kemas Kini</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
