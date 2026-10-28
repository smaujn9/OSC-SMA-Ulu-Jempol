import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, getDocs, updateDoc, setDoc, doc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Wallet, Plus, Trash2, PenTool, Loader2, ArrowLeft, Image as ImageIcon, AlertTriangle, X, Printer, Eye, Lock, Coins, TrendingUp, CheckCircle, Check } from 'lucide-react';
import { KertasKerja, PerbelanjaanProgram } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface PerbelanjaanProgramSectionProps {
  isMobile: boolean;
  onBack?: () => void;
}

export default function PerbelanjaanProgramSection({ isMobile, onBack }: PerbelanjaanProgramSectionProps) {
  const { firebaseUser, currentUserDoc, allUsers } = useAuth();
  const user = firebaseUser;
  const userRole = currentUserDoc?.role;

  const dbPengerusi = allUsers?.find(u => u.role === 'Pengerusi');
  const dbBendahari = allUsers?.find(u => u.role === 'Bendahari');
  
  const [kertasKerjaList, setKertasKerjaList] = useState<KertasKerja[]>([]);
  const [selectedKertasKerja, setSelectedKertasKerja] = useState<KertasKerja | null>(null);
  
  const [perbelanjaanList, setPerbelanjaanList] = useState<PerbelanjaanProgram[]>([]);
  const [allPerbelanjaan, setAllPerbelanjaan] = useState<PerbelanjaanProgram[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'senarai' | 'borang'>('senarai');
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Signature States
  const [signatureConfirm, setSignatureConfirm] = useState<{ kk: KertasKerja; as: 'belanjaBendahariProgram' | 'belanjaBendahariPersatuan' | 'belanjaPengerusi' } | null>(null);
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
        nama: activeName,
        uid: user?.uid || '',
        tarikh: new Date().toISOString(),
        tandatangan: signatureUrl
      };
      
      const updateData = {
        [as]: signatureData,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'kertasKerja', kk.id), updateData);
      
      // Update local state so UI updates immediately
      if (selectedKertasKerja?.id === kk.id) {
        setSelectedKertasKerja(prev => {
          if (!prev) return null;
          return {
            ...prev,
            [as]: signatureData
          };
        });
      }
      
      await fetchKertasKerja();
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan tandatangan.");
    } finally {
      setSignatureConfirm(null);
    }
  };
  
  const [formData, setFormData] = useState<Partial<PerbelanjaanProgram>>({
    tarikhSemasa: new Date().toISOString().split('T')[0],
    masaSemasa: new Date().toTimeString().substring(0, 5),
    butiranPengeluaran: '',
    jumlah: 0,
    kaedahBayaran: 'Tunai',
    catatan: ''
  });
  const [resitFile, setResitFile] = useState<File | null>(null);

  useEffect(() => {
    fetchKertasKerja();
    fetchAllPerbelanjaan();
  }, [user?.uid, userRole]);

  const fetchKertasKerja = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'kertasKerja'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const allKK: KertasKerja[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KertasKerja));
      
      // Filter Kertas Kerja: only show 'Lulus' or 'Selesai' status. Draft and Rejected are hidden.
      const allowedKK = allKK.filter(kk => 
        kk.status === 'Lulus' || kk.status === 'Selesai'
      );
      
      setKertasKerjaList(allowedKK);
    } catch (err) {
      console.error("Error fetching Kertas Kerja:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPerbelanjaan = async () => {
    try {
      const q = query(collection(db, 'perbelanjaanProgram'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerbelanjaanProgram));
      setAllPerbelanjaan(data);
    } catch (err) {
      console.error("Error fetching all perbelanjaan:", err);
    }
  };

  const fetchPerbelanjaan = async (kkId: string) => {
    try {
      const q = query(collection(db, 'perbelanjaanProgram'), where('kertasKerjaId', '==', kkId));
      const snapshot = await getDocs(q);
      const data: PerbelanjaanProgram[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PerbelanjaanProgram));
      // Sort by date and time locally
      data.sort((a, b) => new Date(b.tarikhSemasa + 'T' + b.masaSemasa).getTime() - new Date(a.tarikhSemasa + 'T' + a.masaSemasa).getTime());
      setPerbelanjaanList(data);
    } catch (err) {
      console.error("Error fetching Perbelanjaan:", err);
    }
  };

  const handleSelectKK = (kkId: string) => {
    const kk = kertasKerjaList.find(k => k.id === kkId) || null;
    setSelectedKertasKerja(kk);
    if (kk) {
      fetchPerbelanjaan(kk.id);
    } else {
      setPerbelanjaanList([]);
    }
    setActiveTab('senarai');
    resetForm();
  };

  const handleChange = (field: keyof PerbelanjaanProgram, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKertasKerja) return;
    
    // Auth Check
    const isAuthorized = userRole === 'Admin Utama' || selectedKertasKerja.bendahariProgramUid === user?.uid;
    if (!isAuthorized) {
      alert("Akses dinafikan. Hanya Bendahari Program ini atau Admin Utama boleh menyimpan perbelanjaan.");
      return;
    }

    setSaving(true);
    try {
      let resitUrl = formData.resitUrl;
      if (resitFile) {
        const fileRef = ref(storage, `perbelanjaan_program/${selectedKertasKerja.id}/${Date.now()}_${resitFile.name}`);
        await uploadBytes(fileRef, resitFile);
        resitUrl = await getDownloadURL(fileRef);
      }

      const payload = {
        ...formData,
        kertasKerjaId: selectedKertasKerja.id,
        kertasKerjaTajuk: selectedKertasKerja.tajuk,
        resitUrl: resitUrl || null,
        updatedAt: new Date().toISOString()
      };

      let targetDocId = currentId;
      if (currentId) {
        await updateDoc(doc(db, 'perbelanjaanProgram', currentId), payload);
      } else {
        const newRef = await addDoc(collection(db, 'perbelanjaanProgram'), {
          ...payload,
          createdBy: user?.uid,
          createdAt: serverTimestamp()
        });
        targetDocId = newRef.id;
      }

      // Auto-sync to Lejar Umum (kewanganTransactions)
      if (targetDocId && (Number(formData.jumlah) || 0) > 0) {
        const txnId = `TXN-PROG-${targetDocId}`;
        const vchNo = `VCH-PROG-${targetDocId.substring(0, 6).toUpperCase()}`;
        const txnDate = formData.tarikhSemasa || new Date().toISOString().split('T')[0];
        const txnTime = formData.masaSemasa || '12:00';
        const creditAcc = formData.kaedahBayaran === 'Tunai' ? 'Tunai' : 'Bank';
        const recorderName = currentUserDoc?.displayName || user?.displayName || user?.email || 'Bendahari Program';
        const ledgerTxn: Record<string, any> = {
          id: txnId,
          voucherNo: vchNo,
          date: txnDate,
          time: txnTime,
          accountDebit: 'Program Komuniti',
          accountCredit: creditAcc,
          amount: Number(formData.jumlah) || 0,
          description: `Perbelanjaan Program [${selectedKertasKerja.tajuk}]: ${formData.butiranPengeluaran}`,
          category: 'Program Komuniti',
          recordedBy: recorderName,
          approvalStatus: 'Approved',
          approvedBy: recorderName,
          approvedDate: txnDate,
          notes: formData.catatan ? `${formData.catatan} (Kertas Kerja: ${selectedKertasKerja.tajuk})` : `Perbelanjaan Kertas Kerja: ${selectedKertasKerja.tajuk}`,
          sessionYear: txnDate.split('-')[0] || String(new Date().getFullYear()),
          auditTrail: [
            {
              time: new Date().toISOString().replace('T', ' ').slice(0, 16),
              user: recorderName,
              action: currentId ? `Mengemaskini perbelanjaan program (${selectedKertasKerja.tajuk})` : `Merekod perbelanjaan program (${selectedKertasKerja.tajuk})`
            }
          ]
        };
        if (resitUrl) {
          ledgerTxn.receiptAttachment = resitUrl;
        }
        await setDoc(doc(db, 'kewanganTransactions', txnId), ledgerTxn, { merge: true }).catch(err => {
          console.warn("Gagal menyelaraskan perbelanjaan program ke Lejar Umum:", err);
        });
      }
      
      await fetchPerbelanjaan(selectedKertasKerja.id);
      await fetchAllPerbelanjaan();
      setActiveTab('senarai');
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data pengeluaran.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId || !selectedKertasKerja) return;
    try {
      await deleteDoc(doc(db, 'perbelanjaanProgram', deleteConfirmId));
      await deleteDoc(doc(db, 'kewanganTransactions', `TXN-PROG-${deleteConfirmId}`)).catch(() => {});
      await fetchPerbelanjaan(selectedKertasKerja.id);
      await fetchAllPerbelanjaan();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleEdit = (p: PerbelanjaanProgram) => {
    setFormData(p);
    setCurrentId(p.id);
    setActiveTab('borang');
  };

  const resetForm = () => {
    setCurrentId(null);
    setFormData({
      tarikhSemasa: new Date().toISOString().split('T')[0],
      masaSemasa: new Date().toTimeString().substring(0, 5),
      butiranPengeluaran: '',
      jumlah: 0,
      kaedahBayaran: 'Tunai',
      catatan: ''
    });
    setResitFile(null);
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

  const handlePrintPerbelanjaan = (kk: KertasKerja) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Sila benarkan popup untuk mencetak laporan perbelanjaan.");
      return;
    }

    const getPrintName = (sigObj: any, dbUser: any, fallbackName?: string) => {
      if (sigObj?.tarikh && sigObj?.nama) {
        return sigObj.nama.toUpperCase();
      }
      if (fallbackName) {
        return fallbackName.toUpperCase();
      }
      if (dbUser) {
        return (dbUser.displayName || dbUser.name || '').toUpperCase();
      }
      return 'BELUM DILANTIK';
    };

    const namaBenProg = getPrintName(kk.belanjaBendahariProgram, null, kk.bendahariProgramNama);
    const namaBenPers = getPrintName(kk.belanjaBendahariPersatuan, dbBendahari);
    const namaPeng = getPrintName(kk.belanjaPengerusi, dbPengerusi);

    const kkExpenses = allPerbelanjaan.filter(p => p.kertasKerjaId === kk.id);
    const totalSpent = kkExpenses.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
    const remainingBalance = (kk.jumlahPendapatan || 0) - totalSpent;

    const formattedTarikh = formatTarikhMelayu(kk.tarikh);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ms">
      <head>
        <meta charset="UTF-8">
        <title>Laporan Perbelanjaan - ${kk.tajuk}</title>
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
            background-color: #059669;
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
            background-color: #047857;
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
            margin-bottom: 40px;
            line-height: 1.3;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }

          .doc-header h1 {
            font-size: 16pt;
            font-weight: bold;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }

          .doc-header h2 {
            font-size: 12pt;
            font-weight: normal;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }

          .doc-header h3 {
            font-size: 11pt;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }

          .info-table {
            width: 100%;
            border-collapse: collapse;
          }

          .info-table td {
            font-size: 10pt;
            padding: 4px 0;
            vertical-align: top;
          }

          .section-title {
            font-size: 12pt;
            font-weight: bold;
            margin: 25px 0 10px 0;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            text-transform: uppercase;
          }

          .stats-panel {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 25px;
          }

          .stat-box {
            border: 1px solid #ccc;
            padding: 12px;
            border-radius: 6px;
            text-align: center;
          }

          .stat-box-title {
            font-size: 8pt;
            text-transform: uppercase;
            font-weight: bold;
            color: #555;
            margin-bottom: 4px;
          }

          .stat-box-value {
            font-size: 13pt;
            font-weight: bold;
          }

          .item-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }

          .item-table th, .item-table td {
            border: 1px solid #000;
            padding: 8px 10px;
            font-size: 10pt;
            text-align: left;
          }

          .item-table th {
            background-color: #f2f2f2;
            font-weight: bold;
          }

          .total-row td {
            font-weight: bold;
            background-color: #fafafa;
          }

          .images-section {
            page-break-before: auto;
          }

          .receipt-container {
            page-break-inside: avoid;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 25px;
            text-align: center;
            background-color: #fafafa;
          }

          .receipt-title {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: left;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
          }

          .receipt-img {
            max-height: 450px;
            max-width: 100%;
            object-fit: contain;
            border-radius: 4px;
            border: 1px solid #ddd;
          }

          .signatures-grid {
            margin-top: 50px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            page-break-inside: avoid;
          }

          .signature-block {
            text-align: center;
          }

          .sig-label {
            font-size: 10pt;
            margin-bottom: 10px;
            text-align: center;
          }

          .sig-line {
            border-bottom: 1px solid #000;
            margin-bottom: 5px;
          }

          .sig-name {
            font-size: 10pt;
            font-weight: bold;
            text-transform: uppercase;
          }

          .sig-role {
            font-size: 9pt;
            color: #444;
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

            tr, .receipt-container, .signature-block {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-toolbar">
          <div style="font-weight: bold; font-size: 16px;">Pratinjau Cetak Perbelanjaan Program</div>
          <div style="display: flex; gap: 12px;">
            <button class="btn-close" onclick="window.close()">Tutup</button>
            <button class="btn-print" onclick="window.print()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
              Cetak Laporan
            </button>
          </div>
        </div>

        <div class="print-page">
          <!-- Header -->
          <div class="doc-header">
            <h1>LAPORAN PERBELANJAAN PROGRAM</h1>
            <h2>${kk.tajuk.toUpperCase()}</h2>
            <h3>SEKOLAH MENENGAH AGAMA ULU JEMPOL</h3>
            <h3>BATU KIKIR NEGERI SEMBILAN</h3>
          </div>

          <!-- Info Ringkas -->
          <div class="info-grid">
            <table class="info-table">
              <tr>
                <td style="width: 140px; font-weight: bold;">Program</td>
                <td style="width: 15px;">:</td>
                <td>${kk.tajuk}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Tarikh Program</td>
                <td>:</td>
                <td>${formattedTarikh}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Bendahari Program</td>
                <td>:</td>
                <td>${kk.bendahariProgramNama || 'Belum dilantik'}</td>
              </tr>
            </table>

            <table class="info-table">
              <tr>
                <td style="width: 140px; font-weight: bold;">Penganjur</td>
                <td style="width: 15px;">:</td>
                <td>${kk.penganjur || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Status Kertas Kerja</td>
                <td>:</td>
                <td><strong style="text-transform: uppercase;">${kk.status}</strong></td>
              </tr>
              <tr>
                <td style="font-weight: bold;">Sesi / Tahun</td>
                <td>:</td>
                <td>${new Date(kk.tarikh || Date.now()).getFullYear()}</td>
              </tr>
            </table>
          </div>

          <!-- Statistik Ringkas -->
          <h3 class="section-title">Ringkasan Kewangan</h3>
          <div class="stats-panel">
            <div class="stat-box" style="background-color: #fafafa;">
              <div class="stat-box-title">Peruntukan Lulus</div>
              <div class="stat-box-value" style="color: #1e293b;">RM ${(kk.jumlahPendapatan || 0).toFixed(2)}</div>
            </div>
            <div class="stat-box" style="background-color: #fef2f2; border-color: #fecaca;">
              <div class="stat-box-title" style="color: #991b1b;">Telah Dibelanjakan</div>
              <div class="stat-box-value" style="color: #991b1b;">RM ${totalSpent.toFixed(2)}</div>
            </div>
            <div class="stat-box" style="background-color: #ecfdf5; border-color: #a7f3d0;">
              <div class="stat-box-title" style="color: #065f46;">Baki Peruntukan</div>
              <div class="stat-box-value" style="color: #065f46;">RM ${remainingBalance.toFixed(2)}</div>
            </div>
          </div>

          <!-- Jadual Perbelanjaan -->
          <h3 class="section-title">Butiran Perbelanjaan</h3>
          <table class="item-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">No.</th>
                <th style="width: 110px;">Tarikh & Masa</th>
                <th>Butiran Pengeluaran</th>
                <th style="width: 110px;">Kaedah Bayar</th>
                <th>Catatan</th>
                <th style="width: 110px; text-align: right;">Jumlah (RM)</th>
              </tr>
            </thead>
            <tbody>
              ${kkExpenses.length === 0 
                ? '<tr><td colspan="6" style="text-align: center; color: #555;">Tiada rekod perbelanjaan ditemui untuk program ini.</td></tr>'
                : kkExpenses.map((p, index) => `
                  <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>
                      <div>${p.tarikhSemasa}</div>
                      <div style="font-size: 8pt; color: #555;">${p.masaSemasa}</div>
                    </td>
                    <td><strong>${p.butiranPengeluaran}</strong></td>
                    <td>${p.kaedahBayaran}</td>
                    <td style="font-size: 9pt; color: #444;">${p.catatan || '-'}</td>
                    <td style="text-align: right; font-weight: bold; color: #991b1b;">RM ${Number(p.jumlah).toFixed(2)}</td>
                  </tr>
                `).join('')
              }
              <tr class="total-row">
                <td colspan="5" style="text-align: right; font-weight: bold; padding-right: 15px;">Jumlah Perbelanjaan Sebenar</td>
                <td style="text-align: right; font-weight: bold; font-size: 11pt; color: #991b1b; text-decoration: underline; border-bottom: 2px double black;">
                  RM ${totalSpent.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Lampiran Gambar / Resit -->
          ${kkExpenses.some(p => p.resitUrl) ? `
            <div class="images-section">
              <h3 class="section-title">Dokumen Sokongan / Bukti Resit</h3>
              ${kkExpenses.filter(p => p.resitUrl).map((p, index) => `
                <div class="receipt-container">
                  <div class="receipt-title">Lampiran ${index + 1}: Resit bagi ${p.butiranPengeluaran} (RM ${Number(p.jumlah).toFixed(2)})</div>
                  <img src="${p.resitUrl}" class="receipt-img" alt="Resit ${p.butiranPengeluaran}" />
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Pengesahan -->
          <div class="signatures-grid">
            <div class="signature-block">
              <p class="sig-label">Disediakan oleh (Bendahari Program),</p>
              <div style="height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                ${kk.belanjaBendahariProgram?.tandatangan ? `<img src="${kk.belanjaBendahariProgram.tandatangan}" style="max-height: 70px; max-width: 100%;" />` : '<div style="height: 60px;"></div>'}
              </div>
              <div class="sig-line"></div>
              <p class="sig-name">(${namaBenProg})</p>
              <p class="sig-role">Bendahari Program</p>
              ${kk.belanjaBendahariProgram?.tarikh ? `<p style="font-size: 8pt; color: #555; margin: 4px 0 0 0;">Tarikh: ${new Date(kk.belanjaBendahariProgram.tarikh).toLocaleDateString('ms-MY')}</p>` : ''}
            </div>

            <div class="signature-block">
              <p class="sig-label">Disemak oleh (Bendahari Persatuan),</p>
              <div style="height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                ${kk.belanjaBendahariPersatuan?.tandatangan ? `<img src="${kk.belanjaBendahariPersatuan.tandatangan}" style="max-height: 70px; max-width: 100%;" />` : '<div style="height: 60px;"></div>'}
              </div>
              <div class="sig-line"></div>
              <p class="sig-name">(${namaBenPers})</p>
              <p class="sig-role">Bendahari Persatuan</p>
              ${kk.belanjaBendahariPersatuan?.tarikh ? `<p style="font-size: 8pt; color: #555; margin: 4px 0 0 0;">Tarikh: ${new Date(kk.belanjaBendahariPersatuan.tarikh).toLocaleDateString('ms-MY')}</p>` : ''}
            </div>

            <div class="signature-block">
              <p class="sig-label">Disahkan oleh (Pengerusi),</p>
              <div style="height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                ${kk.belanjaPengerusi?.tandatangan ? `<img src="${kk.belanjaPengerusi.tandatangan}" style="max-height: 70px; max-width: 100%;" />` : '<div style="height: 60px;"></div>'}
              </div>
              <div class="sig-line"></div>
              <p class="sig-name">(${namaPeng})</p>
              <p class="sig-role">Pengerusi Persatuan</p>
              ${kk.belanjaPengerusi?.tarikh ? `<p style="font-size: 8pt; color: #555; margin: 4px 0 0 0;">Tarikh: ${new Date(kk.belanjaPengerusi.tarikh).toLocaleDateString('ms-MY')}</p>` : ''}
            </div>
          </div>

        </div>

        <script>
          window.addEventListener('load', () => {
            setTimeout(() => {
              window.print();
            }, 1000);
          });
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const renderProgramCard = (kk: KertasKerja) => {
    const kkExpenses = allPerbelanjaan.filter(p => p.kertasKerjaId === kk.id);
    const totalSpent = kkExpenses.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
    const remainingBalance = (kk.jumlahPendapatan || 0) - totalSpent;

    const isAuthorized = userRole === 'Admin Utama' || kk.bendahariProgramUid === user?.uid;

    return (
      <div key={kk.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between h-full relative overflow-hidden">
        {/* Status indicator pill top right */}
        <div className="absolute top-4 right-4">
          <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
            kk.status === 'Lulus' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {kk.status}
          </span>
        </div>

        <div>
          {/* Program Title & Date */}
          <div className="pr-16">
            <h4 className="font-extrabold text-slate-800 text-lg leading-tight mb-1">{kk.tajuk}</h4>
            <p className="text-xs text-slate-500 font-semibold">{formatTarikhMelayu(kk.tarikh)}</p>
          </div>

          {/* Program Treasurer */}
          <div className="mt-4 flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
              {kk.bendahariProgramNama ? kk.bendahariProgramNama.substring(0, 2) : 'BP'}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Bendahari Program</p>
              <p className="text-xs font-extrabold text-slate-700 mt-1">
                {kk.bendahariProgramNama || 'Belum dilantik'}
              </p>
            </div>
            {kk.bendahariProgramUid === user?.uid && (
              <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 bg-indigo-600 text-white rounded-md tracking-wider uppercase">Anda</span>
            )}
          </div>

          {/* Statistics Grid */}
          <div className="mt-4 grid grid-cols-3 gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div className="text-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Peruntukan</span>
              <span className="text-xs font-black text-slate-800 mt-0.5 block">
                RM {(kk.jumlahPendapatan || 0).toFixed(0)}
              </span>
            </div>
            <div className="text-center border-x border-slate-200/60">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Dibelanja</span>
              <span className="text-xs font-black text-rose-600 mt-0.5 block">
                RM {totalSpent.toFixed(0)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Baki</span>
              <span className={`text-xs font-black mt-0.5 block ${remainingBalance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                RM {remainingBalance.toFixed(0)}
              </span>
            </div>
          </div>

          {/* Digital Signatures Status */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Tandatangan Pengesahan</p>
            
            {/* 1. Bendahari Program */}
            <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100/60">
              <div className="flex flex-col">
                <span className="font-bold text-slate-700">Bendahari Program</span>
                {kk.belanjaBendahariProgram?.tarikh ? (
                  <span className="text-[10px] text-emerald-600 font-medium">
                    ✓ {kk.belanjaBendahariProgram.nama}
                  </span>
                ) : kk.bendahariProgramNama ? (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Sedia disahkan ({kk.bendahariProgramNama})
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-500 font-bold">Belum Dilantik</span>
                )}
              </div>
              <div>
                {kk.belanjaBendahariProgram?.tandatangan ? (
                  <img src={kk.belanjaBendahariProgram.tandatangan} alt="Tandatangan" className="h-6 w-auto object-contain bg-white rounded border border-slate-200 px-1" />
                ) : (
                  (user?.uid === kk.bendahariProgramUid || userRole === 'Admin Utama') && kk.bendahariProgramNama ? (
                    <button
                      type="button"
                      onClick={() => setSignatureConfirm({ kk, as: 'belanjaBendahariProgram' })}
                      className="py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <PenTool size={10} />
                      <span>Sahkan</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Tiada akses</span>
                  )
                )}
              </div>
            </div>

            {/* 2. Bendahari Persatuan */}
            <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100/60">
              <div className="flex flex-col">
                <span className="font-bold text-slate-700">Bendahari Persatuan</span>
                {kk.belanjaBendahariPersatuan?.tarikh ? (
                  <span className="text-[10px] text-emerald-600 font-medium">
                    ✓ {kk.belanjaBendahariPersatuan.nama}
                  </span>
                ) : dbBendahari ? (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Sedia disahkan ({dbBendahari.displayName || dbBendahari.name})
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-500 font-bold">Belum Dilantik</span>
                )}
              </div>
              <div>
                {kk.belanjaBendahariPersatuan?.tandatangan ? (
                  <img src={kk.belanjaBendahariPersatuan.tandatangan} alt="Tandatangan" className="h-6 w-auto object-contain bg-white rounded border border-slate-200 px-1" />
                ) : (
                  (userRole === 'Bendahari' || userRole === 'Admin Utama') && dbBendahari ? (
                    <button
                      type="button"
                      onClick={() => setSignatureConfirm({ kk, as: 'belanjaBendahariPersatuan' })}
                      className="py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <PenTool size={10} />
                      <span>Sahkan</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Tiada akses</span>
                  )
                )}
              </div>
            </div>

            {/* 3. Pengerusi */}
            <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100/60">
              <div className="flex flex-col">
                <span className="font-bold text-slate-700">Pengerusi</span>
                {kk.belanjaPengerusi?.tarikh ? (
                  <span className="text-[10px] text-emerald-600 font-medium">
                    ✓ {kk.belanjaPengerusi.nama}
                  </span>
                ) : dbPengerusi ? (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Sedia disahkan ({dbPengerusi.displayName || dbPengerusi.name})
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-500 font-bold">Belum Dilantik</span>
                )}
              </div>
              <div>
                {kk.belanjaPengerusi?.tandatangan ? (
                  <img src={kk.belanjaPengerusi.tandatangan} alt="Tandatangan" className="h-6 w-auto object-contain bg-white rounded border border-slate-200 px-1" />
                ) : (
                  (userRole === 'Pengerusi' || userRole === 'Admin Utama') && dbPengerusi ? (
                    <button
                      type="button"
                      onClick={() => setSignatureConfirm({ kk, as: 'belanjaPengerusi' })}
                      className="py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <PenTool size={10} />
                      <span>Sahkan</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Tiada akses</span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* Printing Button */}
          <button
            type="button"
            onClick={() => handlePrintPerbelanjaan(kk)}
            className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            title="Cetak Laporan Perbelanjaan beserta Resit"
          >
            <Printer size={14} className="stroke-[2.5]" />
            <span>Cetak</span>
          </button>

          {/* Edit / Manage Button - Selesai is print-only */}
          {kk.status !== 'Selesai' && (
            <button
              type="button"
              onClick={() => handleSelectKK(kk.id)}
              className={`flex-1 py-2.5 px-3 border rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                isAuthorized
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {isAuthorized ? (
                <>
                  <PenTool size={14} className="stroke-[2.5]" />
                  <span>Urus Belanja</span>
                </>
              ) : (
                <>
                  <Eye size={14} className="stroke-[2.5]" />
                  <span>Papar Sahaja</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const jumlahDibelanjakan = perbelanjaanList.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0);
  const bakiDiLuluskan = (selectedKertasKerja?.jumlahPendapatan || 0) - jumlahDibelanjakan;
  const isAuthorized = selectedKertasKerja 
    ? (userRole === 'Admin Utama' || selectedKertasKerja.bendahariProgramUid === user?.uid)
    : false;

  return (
    <div className={`space-y-6 ${isMobile ? 'pb-24' : ''}`}>
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div className="flex items-center gap-3">
          {onBack && !selectedKertasKerja && (
            <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600">
              <ArrowLeft size={20} />
            </button>
          )}
          {selectedKertasKerja && (
            <button onClick={() => setSelectedKertasKerja(null)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="font-extrabold text-2xl text-slate-900 tracking-tight">Perbelanjaan Program</h2>
            <p className="text-sm text-slate-500 font-medium">Rekod Pengeluaran Kewangan Program</p>
          </div>
        </div>

        {selectedKertasKerja && (
          <button
            onClick={() => handlePrintPerbelanjaan(selectedKertasKerja)}
            className="flex items-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
          >
            <Printer size={14} className="stroke-[2.5]" />
            <span className="hidden sm:inline">Cetak Perbelanjaan</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="animate-spin text-amber-500 mx-auto" size={40} />
          <p className="text-slate-500 text-sm font-semibold mt-4">Memuatkan data program...</p>
        </div>
      ) : !selectedKertasKerja ? (
        <div className="space-y-8">
          {/* Section: Kertas Kerja Lulus */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="h-5 w-1.5 rounded-full bg-emerald-500" />
              <h3 className="font-extrabold text-slate-800 tracking-tight text-base sm:text-lg">Kertas Kerja LULUS</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                {kertasKerjaList.filter(kk => kk.status === 'Lulus').length} Program
              </span>
            </div>

            {kertasKerjaList.filter(kk => kk.status === 'Lulus').length === 0 ? (
              <div className="text-center p-8 text-slate-500 bg-white rounded-2xl border border-slate-150 shadow-sm">
                Tiada Kertas Kerja berstatus LULUS buat masa ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {kertasKerjaList.filter(kk => kk.status === 'Lulus').map(kk => renderProgramCard(kk))}
              </div>
            )}
          </div>

          {/* Section: Kertas Kerja Selesai */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="h-5 w-1.5 rounded-full bg-blue-500" />
              <h3 className="font-extrabold text-slate-800 tracking-tight text-base sm:text-lg">Kertas Kerja SELESAI</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-100">
                {kertasKerjaList.filter(kk => kk.status === 'Selesai').length} Program
              </span>
            </div>

            {kertasKerjaList.filter(kk => kk.status === 'Selesai').length === 0 ? (
              <div className="text-center p-8 text-slate-500 bg-white rounded-2xl border border-slate-150 shadow-sm">
                Tiada Kertas Kerja berstatus SELESAI buat masa ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {kertasKerjaList.filter(kk => kk.status === 'Selesai').map(kk => renderProgramCard(kk))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Back button link */}
          <div>
            <button 
              onClick={() => setSelectedKertasKerja(null)} 
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Senarai Program</span>
            </button>
          </div>

          {/* Program Header Info */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
            <span className={`text-[9px] px-2 py-0.5 rounded font-black tracking-wider uppercase ${
              selectedKertasKerja.status === 'Lulus' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
            }`}>
              Program {selectedKertasKerja.status}
            </span>
            <h3 className="text-xl font-black mt-2 tracking-tight">{selectedKertasKerja.tajuk}</h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">Tarikh: {formatTarikhMelayu(selectedKertasKerja.tarikh)} | Bendahari Program: <span className="text-indigo-400 font-extrabold">{selectedKertasKerja.bendahariProgramNama || 'Belum dilantik'}</span></p>
          </div>

          {/* Authorization Warning Banner */}
          {!isAuthorized && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
              <Lock className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div>
                <h5 className="font-extrabold text-amber-800 text-sm">Akses Paparan Sahaja (Terhad)</h5>
                <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                  Hanya Bendahari Program yang dilantik (<strong>{selectedKertasKerja.bendahariProgramNama || 'Belum dilantik'}</strong>) dan Admin Utama yang boleh memasukkan atau mengedit rekod pengeluaran.
                </p>
              </div>
            </div>
          )}

          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Peruntukan Lulus</p>
              <h3 className="text-xl font-black text-slate-800 mt-1">RM {(selectedKertasKerja.jumlahPendapatan || 0).toFixed(2)}</h3>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl shadow-sm border border-rose-100">
              <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Telah Dibelanjakan</p>
              <h3 className="text-xl font-black text-rose-800 mt-1">RM {jumlahDibelanjakan.toFixed(2)}</h3>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100">
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Baki Peruntukan</p>
              <h3 className="text-xl font-black text-emerald-800 mt-1">RM {bakiDiLuluskan.toFixed(2)}</h3>
            </div>
          </div>

          {/* Tab buttons - only show if authorized */}
          {isAuthorized ? (
            <div className="flex gap-2 p-1 bg-slate-200/60 rounded-xl overflow-x-auto">
              <button
                onClick={() => { setActiveTab('senarai'); resetForm(); }}
                className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'senarai' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/80'}`}
              >
                Rekod Pengeluaran
              </button>
              <button
                onClick={() => setActiveTab('borang')}
                className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'borang' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/80'}`}
              >
                {currentId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
              </button>
            </div>
          ) : (
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Senarai Perbelanjaan Program</span>
              <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-black text-slate-500 uppercase tracking-wider">Papar Sahaja</span>
            </div>
          )}

          {activeTab === 'senarai' || !isAuthorized ? (
            <div className="space-y-4">
              {perbelanjaanList.length === 0 ? (
                <div className="text-center p-8 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">Tiada rekod pengeluaran.</div>
              ) : (
                perbelanjaanList.map(p => (
                  <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-800 text-lg">{p.butiranPengeluaran}</h3>
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold text-slate-500">{p.kaedahBayaran}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{p.tarikhSemasa} {p.masaSemasa} | <span className="text-amber-700 font-bold">Catatan:</span> {p.catatan || '-'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-black text-rose-600">- RM {(Number(p.jumlah) || 0).toFixed(2)}</h3>
                      {p.resitUrl && (
                        <a href={p.resitUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 text-slate-600" title="Lihat Resit">
                          <ImageIcon size={18} />
                        </a>
                      )}
                      {isAuthorized && (
                        <>
                          <button onClick={() => handleEdit(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Edit"><PenTool size={16} /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Padam"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tarikh Semasa</label>
                  <input required type="date" value={formData.tarikhSemasa || ''} onChange={e => handleChange('tarikhSemasa', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Masa Semasa</label>
                  <input required type="time" value={formData.masaSemasa || ''} onChange={e => handleChange('masaSemasa', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Butiran Pengeluaran</label>
                <input required type="text" value={formData.butiranPengeluaran || ''} onChange={e => handleChange('butiranPengeluaran', e.target.value)} placeholder="Contoh: Beli air mineral dan makanan" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-800" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah (RM)</label>
                  <input required type="number" step="0.01" value={formData.jumlah ?? ''} onChange={e => handleChange('jumlah', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-rose-600" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kaedah Bayaran</label>
                  <select required value={formData.kaedahBayaran || 'Tunai'} onChange={e => handleChange('kaedahBayaran', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">
                    <option value="Tunai">Tunai</option>
                    <option value="Pindahan Bank (Transfer)">Pindahan Bank (Transfer)</option>
                    <option value="Cek">Cek</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-bold">Upload Resit / Gambar</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setResitFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                {formData.resitUrl && !resitFile && (
                  <div className="mt-2 p-2 border border-slate-100 rounded-lg bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-blue-600 font-bold"><a href={formData.resitUrl} target="_blank" rel="noopener noreferrer">Lihat Resit Semasa</a></span>
                    <img src={formData.resitUrl} className="w-10 h-10 object-cover rounded border border-slate-200" alt="Resit semasa" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
                <textarea value={formData.catatan || ''} onChange={e => handleChange('catatan', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button type="submit" disabled={saving} className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Wallet size={18} />}
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          )}
        </div>
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
                  Padam Perbelanjaan?
                </h3>

                {/* Description */}
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Adakah anda pasti ingin memadam rekod perbelanjaan <span className="font-extrabold text-slate-900">"{perbelanjaanList.find(p => p.id === deleteConfirmId)?.butiranPengeluaran || 'ini'}"</span>? Tindakan ini adalah kekal dan tidak boleh diundurkan.
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
                        {signatureConfirm.as === 'belanjaBendahariProgram' ? 'Bendahari Program' : signatureConfirm.as === 'belanjaBendahariPersatuan' ? 'Bendahari Persatuan' : 'Pengerusi'}
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
