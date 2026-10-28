import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { cleanUndefined } from '../utils/firestoreUtils';
import { detectActiveSessionYear } from '../utils/yuranConfigHelper';
import { QurbanRegistration } from '../types';
import { printQurbanRegistrationPdf, printAllQurbanRegistrationsPdf, QurbanConfig, DEFAULT_QURBAN_CONFIG, checkAndCancelExpiredQurbanRegistrations } from '../utils/qurbanHelper';
import { 
  Heart, Users, DollarSign, Clock, CheckCircle2, AlertTriangle, 
  Trash2, Search, Filter, RefreshCw, ArrowLeft, ShieldCheck, 
  Check, X, FileText, Calendar, CreditCard, Edit3, Eraser, Save, Printer,
  Plus, Share2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface AdminQurbanSectionProps {
  onBack?: () => void;
}

export default function AdminQurbanSection({ onBack }: AdminQurbanSectionProps) {
  const { currentUserDoc, logAction } = useAuth();

  const [registrations, setRegistrations] = useState<QurbanRegistration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Edit Registration State
  const [editModal, setEditModal] = useState<QurbanRegistration | null>(null);
  const [editedJenisPenyertaan, setEditedJenisPenyertaan] = useState<'Qurban Sunat' | 'Qurban Wajib' | 'Aqiqah Sunat' | 'Aqiqah Wajib'>('Qurban Sunat');
  const [editedPilihanDaging, setEditedPilihanDaging] = useState<'Mahu Ambil Daging' | 'Tidak Mahu Daging' | 'Simpan Daging'>('Mahu Ambil Daging');
  const [editedSenaraiPeserta, setEditedSenaraiPeserta] = useState<string[]>([]);
  const [editedStatusPendaftaran, setEditedStatusPendaftaran] = useState<QurbanRegistration['statusPendaftaran']>('Dalam Proses');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const openEditModal = (reg: QurbanRegistration) => {
    setEditModal(reg);
    setEditedJenisPenyertaan(reg.jenisPenyertaan);
    setEditedPilihanDaging(reg.pilihanDaging || 'Mahu Ambil Daging');
    setEditedSenaraiPeserta([...(reg.senaraiPeserta || [])]);
    setEditedStatusPendaftaran(reg.statusPendaftaran);
  };

  const handleSaveEdit = async () => {
    if (!editModal || !db) return;
    setIsSavingEdit(true);

    try {
      const nowIso = new Date().toISOString();
      const cleanedPeserta = editedSenaraiPeserta.map(p => p.trim()).filter(p => p !== '');
      if (cleanedPeserta.length === 0) {
        throw new Error('Sila masukkan sekurang-kurangnya satu nama peserta.');
      }

      await updateDoc(doc(db, 'qurbanRegistrations', editModal.id), {
        jenisPenyertaan: editedJenisPenyertaan,
        pilihanDaging: editedPilihanDaging,
        senaraiPeserta: cleanedPeserta,
        statusPendaftaran: editedStatusPendaftaran,
        updatedAt: nowIso
      });

      if (logAction) {
        await logAction('Kemaskini Pendaftaran Qurban', `Mengemaskini maklumat pendaftaran & status bagi ${editModal.id} (${editModal.namaPenuh})`);
      }

      showAlert(`Maklumat pendaftaran ${editModal.id} berjaya dikemaskini!`, 'success');
      setEditModal(null);
    } catch (err: any) {
      console.error("Ralat mengemaskini pendaftaran qurban:", err);
      showAlert(err.message || "Gagal mengemaskini maklumat pendaftaran.", 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Config State
  const [qurbanConfig, setQurbanConfig] = useState<QurbanConfig>(DEFAULT_QURBAN_CONFIG);
  const [catatanText, setCatatanText] = useState<string>('');
  const [adminSignatureUrl, setAdminSignatureUrl] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('Semua');

  // Verify Cash Modal
  const [verifyCashModal, setVerifyCashModal] = useState<QurbanRegistration | null>(null);
  const [cashAccount, setCashAccount] = useState<'Tunai' | 'Bank'>('Tunai');
  const [isVerifyingCash, setIsVerifyingCash] = useState<boolean>(false);

  // Installment Editing State
  const [selectedInstallmentReg, setSelectedInstallmentReg] = useState<QurbanRegistration | null>(null);
  const [editingMonthIndex, setEditingMonthIndex] = useState<number | null>(null);
  const [editingInstStatus, setEditingInstStatus] = useState<'Belum Bayar' | 'Dalam Semakan' | 'Lulus' | 'Tolak'>('Belum Bayar');
  const [editingInstMethod, setEditingInstMethod] = useState<'Tunai' | 'FPX' | 'Manual'>('Manual');
  const [editingInstTxnId, setEditingInstTxnId] = useState<string>('');
  const [isSavingInstallment, setIsSavingInstallment] = useState<boolean>(false);

  const handleSaveInstallment = async () => {
    if (!selectedInstallmentReg || editingMonthIndex === null || !db) return;
    setIsSavingInstallment(true);
    try {
      const nowIso = new Date().toISOString();
      const todayDateStr = new Date().toISOString().split('T')[0];

      // Deep copy the installments
      const updatedInstallments = selectedInstallmentReg.installmentPayments 
        ? [...selectedInstallmentReg.installmentPayments] 
        : [];

      const idx = updatedInstallments.findIndex(i => i.monthIndex === editingMonthIndex);
      if (idx !== -1) {
        const prevStatus = updatedInstallments[idx].status;
        updatedInstallments[idx] = {
          ...updatedInstallments[idx],
          status: editingInstStatus,
          paymentMethod: editingInstMethod,
          transactionId: editingInstTxnId,
          paidAt: editingInstStatus === 'Lulus' ? (updatedInstallments[idx].paidAt || nowIso) : undefined
        };

        // Recalculate monthsPaid
        const monthsPaid = updatedInstallments.filter(i => i.status === 'Lulus').length;
        const totalMonths = selectedInstallmentReg.totalMonths || 3;
        const paymentStatus = monthsPaid >= totalMonths 
          ? 'Selesai' 
          : (monthsPaid > 0 ? 'Ansuran Berjalan' : 'Deposit Dibayar');

        await updateDoc(doc(db, 'qurbanRegistrations', selectedInstallmentReg.id), {
          installmentPayments: updatedInstallments,
          monthsPaid: monthsPaid,
          paymentStatus: paymentStatus,
          updatedAt: nowIso
        });

        // Record a transaction if it was newly approved to 'Lulus'
        if (editingInstStatus === 'Lulus' && prevStatus !== 'Lulus') {
          const now = new Date();
          const timeStr = now.toTimeString().slice(0, 5);
          const txnId = `TXN-QURBAN-INST-${selectedInstallmentReg.id.substring(0, 8)}-m${editingMonthIndex}-${Date.now().toString().slice(-4)}`;
          const vchNo = `VCH-QURBAN-INST-${Date.now().toString().slice(-6)}`;
          const debitAcc = editingInstMethod === 'Tunai' ? 'Tunai' : 'Bank';

          // 1. Standard ledger record (kewanganTransactions)
          const newKewanganTxn = {
            id: txnId,
            voucherNo: vchNo,
            date: todayDateStr,
            time: timeStr,
            accountDebit: debitAcc,
            accountCredit: 'Qurban Aqiqah',
            amount: updatedInstallments[idx].amount,
            description: `Bayaran Ansuran ${editingMonthIndex} Qurban/Aqiqah - Ref ID: ${selectedInstallmentReg.id} (${selectedInstallmentReg.namaPenuh})`,
            category: 'Qurban Aqiqah',
            recordedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
            approvalStatus: 'Approved',
            approvedDate: todayDateStr,
            approvedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
            notes: `Bayaran ansuran ${updatedInstallments[idx].monthName} (${editingInstMethod}) diluluskan oleh Admin.`,
            memberEmail: selectedInstallmentReg.userEmail || '',
            paidPackageIds: [`qurban-cart-${selectedInstallmentReg.id}-m${editingMonthIndex}`],
            sessionYear: detectActiveSessionYear() || '2026',
            qurbanSession: selectedInstallmentReg.sessionYear,
            auditTrail: [{
              time: `${todayDateStr} ${timeStr}`,
              user: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
              action: `Bayaran ansuran ${updatedInstallments[idx].monthName} (${editingInstMethod}) diluluskan oleh Admin.`
            }]
          };

          await setDoc(doc(db, 'kewanganTransactions', txnId), cleanUndefined(newKewanganTxn)).catch(err => {
            console.warn("Ralat merekod ke kewanganTransactions:", err);
          });

          // 2. Backward compatibility (financialTransactions)
          await setDoc(doc(db, 'financialTransactions', txnId), cleanUndefined({
            id: txnId,
            date: todayDateStr,
            type: 'Pendapatan',
            category: 'Qurban Aqiqah',
            accountCredit: 'Qurban Aqiqah',
            accountDebit: debitAcc,
            amount: updatedInstallments[idx].amount,
            description: `Bayaran Ansuran ${editingMonthIndex} Qurban/Aqiqah - Ref ID: ${selectedInstallmentReg.id} (${selectedInstallmentReg.namaPenuh})`,
            recordedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
            createdAt: nowIso,
            notes: `Bayaran ansuran ${updatedInstallments[idx].monthName} (${editingInstMethod}) diluluskan oleh Admin.`
          })).catch(err => {
            console.warn("Ralat merekod ke financialTransactions:", err);
          });
        }

        showAlert(`Status ansuran Bulan ${editingMonthIndex} berjaya dikemaskini!`, 'success');
      }
      setSelectedInstallmentReg(null);
      setEditingMonthIndex(null);
    } catch (err: any) {
      console.error("Ralat mengemaskini ansuran:", err);
      showAlert(err.message || "Gagal mengemaskini ansuran.", 'error');
    } finally {
      setIsSavingInstallment(false);
    }
  };

  // Delete Confirm Modal
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<QurbanRegistration | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Alert message
  const [alertMessage, setAlertMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showAlert = (msg: string, type: 'success' | 'error') => {
    setAlertMessage({ msg, type });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Real-time listener for Qurban Registrations & Config
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const unsubConfig = onSnapshot(doc(db, 'system', 'qurbanConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as QurbanConfig;
        setQurbanConfig(data);
        setCatatanText(data.catatanBorang || DEFAULT_QURBAN_CONFIG.catatanBorang || '');
        setAdminSignatureUrl(data.adminSignatureUrl || '');
      }
    }, (err) => console.warn("Ralat muat qurbanConfig di AdminQurbanSection:", err));

    const q = query(collection(db, 'qurbanRegistrations'));
    const unsubRegs = onSnapshot(q, (snapshot) => {
      const list: QurbanRegistration[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data() as QurbanRegistration;
        list.push({ ...d, id: d.id || docSnap.id });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRegistrations(list);
      setLoading(false);
      if (typeof window !== 'undefined') {
        try {
          const activeOnly = list.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN');
          localStorage.setItem('tmf2_qurban_registrations_cache', JSON.stringify(activeOnly));
        } catch (e) {}
      }

      // Auto check and cancel registrations > 24 hours unpaid
      checkAndCancelExpiredQurbanRegistrations(list);
    }, (err) => {
      console.error("Ralat memuatkan pendaftaran qurban:", err);
      setLoading(false);
    });

    return () => {
      unsubConfig();
      unsubRegs();
    };
  }, []);

  // Canvas drawing handlers for signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
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
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSaveConfigNotes = async () => {
    if (!db) return;
    setIsSavingConfig(true);

    try {
      let finalSignatureUrl = adminSignatureUrl;
      const canvas = canvasRef.current;
      if (canvas) {
        // Check if canvas has drawn content
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const hasContent = Array.from(pixelData).some((val: any, idx) => idx % 4 === 3 && val > 0);
          if (hasContent) {
            finalSignatureUrl = canvas.toDataURL('image/png');
          }
        }
      }

      await setDoc(doc(db, 'system', 'qurbanConfig'), {
        catatanBorang: catatanText,
        adminSignatureUrl: finalSignatureUrl
      }, { merge: true });

      setAdminSignatureUrl(finalSignatureUrl);
      showAlert('Catatan & Tandatangan Borang berjaya disimpan!', 'success');
      if (logAction) {
        await logAction('Kemaskini Catatan Borang Qurban', 'Mengemaskini catatan borang & tandatangan urusetia.');
      }
    } catch (e: any) {
      console.error("Ralat menyimpan catatan borang:", e);
      showAlert(e.message || 'Gagal menyimpan catatan borang.', 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Filter registrations
  const filteredRegistrations = registrations.filter(reg => {
    const queryLower = searchQuery.toLowerCase().trim();
    const matchesSearch = !queryLower || 
      reg.namaPenuh.toLowerCase().includes(queryLower) ||
      reg.noIC.includes(queryLower) ||
      reg.noTelefon.includes(queryLower) ||
      reg.senaraiPeserta.some(p => p.toLowerCase().includes(queryLower));

    const matchesStatus = statusFilter === 'Semua' || reg.statusPendaftaran === statusFilter;
    const matchesPaymentMode = paymentModeFilter === 'Semua' || reg.caraPembayaran === paymentModeFilter;

    return matchesSearch && matchesStatus && matchesPaymentMode;
  });

  // Calculate stats
  const totalRegistrations = registrations.length;
  const totalAmountCollected = registrations
    .filter(r => r.statusPendaftaran === 'Disahkan')
    .reduce((sum, r) => sum + (r.opsiBayaran === 'Ansuran' ? (r.monthsPaid * (r.monthlyAmount || 0)) : r.totalAmount), 0);

  const pendingCashCount = registrations.filter(r => r.caraPembayaran === 'Tunai' && r.statusPendaftaran === 'Dalam Proses').length;
  const ansuranActiveCount = registrations.filter(r => r.opsiBayaran === 'Ansuran' && r.paymentStatus !== 'Selesai').length;

  // Extra stats calculations for charts
  const totalAmountExpected = registrations
    .filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN')
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const percentCollected = totalAmountExpected > 0 
    ? Math.min(100, Math.round((totalAmountCollected / totalAmountExpected) * 100)) 
    : 0;

  const totalParticipantsCount = registrations
    .filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN')
    .reduce((sum, r) => sum + (r.senaraiPeserta ? r.senaraiPeserta.length : 0), 0);

  // Slot calculations based on live limits and non-cancelled registrations
  const countBhgLembu = registrations
    .filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pakejPilihan === '1 BHG LEMBU')
    .reduce((sum, r) => sum + (r.senaraiPeserta?.length || 1), 0);

  const countEkorLembu = registrations
    .filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pakejPilihan === '1 EKOR LEMBU').length;

  const countEkorKambing = registrations
    .filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pakejPilihan === '1 EKOR KAMBING').length;

  const targetSlots = (qurbanConfig.limitBhgLembu ?? 35) + (qurbanConfig.limitEkorLembu ?? 5) + (qurbanConfig.limitEkorKambing ?? 20);
  const filledSlots = countBhgLembu + countEkorLembu + countEkorKambing;

  const packageDistribution = [
    { name: '1 Bhg Lembu', value: registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pakejPilihan === '1 BHG LEMBU').length, color: '#3b82f6' },
    { name: '1 Ekor Lembu', value: registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pakejPilihan === '1 EKOR LEMBU').length, color: '#10b981' },
    { name: '1 Ekor Kambing', value: registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pakejPilihan === '1 EKOR KAMBING').length, color: '#f59e0b' },
  ].filter(item => item.value > 0);

  const meatDistribution = [
    { name: 'Mahu Ambil', value: registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pilihanDaging === 'Mahu Ambil Daging').length, color: '#10b981' },
    { name: 'Tidak Mahu', value: registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.pilihanDaging === 'Tidak Mahu Daging').length, color: '#f59e0b' },
    { name: 'Simpan', value: registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && (r.pilihanDaging === 'Simpan Daging' || !r.pilihanDaging)).length, color: '#3b82f6' }
  ].filter(item => item.value > 0);

  // Helper to extract House Number / No Rumah without exposing street name or full address
  const getHouseNoLabel = (alamat: string) => {
    if (!alamat) return "Tiada No. Rumah";
    const firstComma = alamat.split(',')[0].trim();
    const wordsOfFirstComma = firstComma.split(/\s+/);
    // If the first comma-separated part has more than 3 words, it's safer to just take the first 2 words
    if (wordsOfFirstComma.length > 3) {
      return wordsOfFirstComma.slice(0, 2).join(' ');
    }
    return firstComma;
  };

  // WhatsApp sharing logic for payment progress & percentage
  const shareWhatsAppProgress = () => {
    const activeRegs = filteredRegistrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN');
    if (activeRegs.length === 0) {
      alert("Tiada pendaftaran aktif untuk dikongsi.");
      return;
    }

    let message = `*LAPORAN PRESTASI PEMBAYARAN QURBAN & AQIQAH (1448H / 2027M)*\n\n`;
    message += `Berikut adalah status kemajuan pembayaran terkini mengikut No. Rumah peserta (maklumat peribadi seperti nama, kad pengenalan dan no telefon disembunyikan atas faktor privasi):\n\n`;
    message += `🏡 *Senarai Kemajuan Pembayaran:*\n`;

    activeRegs.forEach((reg, index) => {
      const houseNo = getHouseNoLabel(reg.alamat);
      const totalMonths = reg.totalMonths || (reg.opsiBayaran === 'Ansuran' ? (reg.tempohAnsuranBulan || 3) : 1);
      const monthsPaid = reg.monthsPaid || 0;
      const percentPaid = reg.opsiBayaran === 'Penuh' 
        ? (reg.paymentStatus === 'Selesai' ? 100 : 0)
        : Math.min(100, Math.round((monthsPaid / totalMonths) * 100));

      const calculatedPaidRM = reg.opsiBayaran === 'Penuh'
        ? (reg.paymentStatus === 'Selesai' ? reg.totalAmount : 0)
        : (reg.installmentPayments || [])
            .filter(p => p.status === 'Lulus')
            .reduce((sum, p) => sum + p.amount, 0) || (monthsPaid * (reg.monthlyAmount || 0));

      const typeLabel = reg.opsiBayaran === 'Penuh' ? 'Bayar Penuh' : `Ansuran (${monthsPaid}/${totalMonths} Bln)`;
      const progressMarker = percentPaid === 100 ? '✅ [Lunas]' : percentPaid > 0 ? '⏳ [Ansuran]' : '❌ [Belum Mula]';

      message += `${index + 1}. *No. Rumah: ${houseNo}*\n`;
      message += `   Status: ${progressMarker}\n`;
      message += `   Progress: *${percentPaid}%*\n`;
      message += `   Pembayaran: RM ${calculatedPaidRM.toFixed(2)} / RM ${reg.totalAmount.toFixed(2)} (${typeLabel})\n\n`;
    });

    // Overall summary calculation
    const overallExpected = activeRegs.reduce((sum, r) => sum + r.totalAmount, 0);
    const overallCollected = activeRegs.reduce((sum, r) => {
      const totalMonths = r.totalMonths || (r.opsiBayaran === 'Ansuran' ? (r.tempohAnsuranBulan || 3) : 1);
      const monthsPaid = r.monthsPaid || 0;
      return sum + (r.opsiBayaran === 'Penuh'
        ? (r.paymentStatus === 'Selesai' ? r.totalAmount : 0)
        : (r.installmentPayments || [])
            .filter(p => p.status === 'Lulus')
            .reduce((s, p) => s + p.amount, 0) || (monthsPaid * (r.monthlyAmount || 0)));
    }, 0);

    const completedCount = activeRegs.filter(r => r.paymentStatus === 'Selesai').length;
    const overallPercent = overallExpected > 0 ? Math.round((overallCollected / overallExpected) * 100) : 0;

    message += `📊 *Ringkasan Keseluruhan:*\n`;
    message += `• Jumlah Pendaftaran: *${activeRegs.length} Rekod*\n`;
    message += `• Selesai Pembayaran: *${completedCount} / ${activeRegs.length}* (${activeRegs.length > 0 ? Math.round((completedCount/activeRegs.length)*100) : 0}%)\n`;
    message += `• Keseluruhan Dana Terkumpul: *RM ${overallCollected.toFixed(2)} / RM ${overallExpected.toFixed(2)}* (${overallPercent}%)\n\n`;
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
    message += `_Dikemaskini pada: ${formattedDate}, ${formattedTime}_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
  };

  // Handle Verify Cash Payment
  const handleConfirmVerifyCash = async () => {
    if (!verifyCashModal || !db) return;
    setIsVerifyingCash(true);

    try {
      const nowIso = new Date().toISOString();
      const todayDateStr = new Date().toISOString().split('T')[0];

      let updatedInstallments = verifyCashModal.installmentPayments ? [...verifyCashModal.installmentPayments] : undefined;
      let monthsPaid = verifyCashModal.monthsPaid;
      let paymentStatus = verifyCashModal.paymentStatus;

      if (verifyCashModal.opsiBayaran === 'Ansuran') {
        const totalM = verifyCashModal.tempohAnsuranBulan || verifyCashModal.totalMonths || 3;
        const monthlyAmt = verifyCashModal.monthlyAmount || Math.ceil(verifyCashModal.totalAmount / totalM);
        if (!updatedInstallments || updatedInstallments.length === 0) {
          updatedInstallments = Array.from({ length: totalM }).map((_, i) => ({
            monthIndex: i + 1,
            monthName: i === 0 ? 'Bulan 1 (Deposit)' : `Bulan ${i + 1}`,
            amount: monthlyAmt,
            status: i === 0 ? ('Lulus' as const) : ('Belum Bayar' as const),
            paidAt: i === 0 ? nowIso : undefined,
            paymentMethod: 'Tunai' as const
          }));
        } else {
          updatedInstallments[0] = {
            ...updatedInstallments[0],
            status: 'Lulus',
            paidAt: nowIso,
            paymentMethod: 'Tunai'
          };
        }
        monthsPaid = Math.max(1, monthsPaid || 1);
        paymentStatus = 'Deposit Dibayar';
      } else {
        paymentStatus = 'Selesai';
        monthsPaid = 1;
      }

      const updatedRegFields = {
        statusPendaftaran: 'Disahkan' as const,
        paymentStatus: paymentStatus,
        verifiedAt: nowIso,
        verifiedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin Utama',
        monthsPaid: monthsPaid,
        installmentPayments: updatedInstallments || undefined,
        updatedAt: nowIso
      };

      await updateDoc(doc(db, 'qurbanRegistrations', verifyCashModal.id), cleanUndefined({
        ...updatedRegFields,
        installmentPayments: updatedInstallments || null
      }));

      setRegistrations(prev => {
        const next = prev.map(r => r.id === verifyCashModal.id ? { ...r, ...updatedRegFields } : r);
        if (typeof window !== 'undefined') {
          try {
            const activeOnly = next.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN');
            localStorage.setItem('tmf2_qurban_registrations_cache', JSON.stringify(activeOnly));
          } catch (e) {}
        }
        return next;
      });

      // Merekod transaksi kewangan rasmi
      const amountToRecord = verifyCashModal.opsiBayaran === 'Ansuran' 
        ? (verifyCashModal.depositAmount || verifyCashModal.monthlyAmount || 0)
        : verifyCashModal.totalAmount;

      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const generatedTxnId = `TXN-QURBAN-${verifyCashModal.id.substring(0, 8)}-${Date.now().toString().slice(-4)}`;
      const generatedVchNo = `VCH-QURBAN-${Date.now().toString().slice(-6)}`;
      const debitAccount = cashAccount || 'Tunai';

      // 1. Standard Ledger (kewanganTransactions)
      const newKewanganTxn = {
        id: generatedTxnId,
        voucherNo: generatedVchNo,
        date: todayDateStr,
        time: timeStr,
        accountDebit: debitAccount,
        accountCredit: 'Qurban Aqiqah',
        amount: amountToRecord,
        description: `Bayaran Tunai Deposit Bulan 1 Pendaftaran Qurban & Aqiqah (Ref: ${verifyCashModal.id} - ${verifyCashModal.namaPenuh})`,
        category: 'Qurban Aqiqah',
        recordedBy: `${currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin'} (Urusetia Qurban)`,
        approvalStatus: 'Approved',
        approvedDate: todayDateStr,
        approvedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
        notes: `Pengesahan bayaran Tunai Pendaftaran Qurban & Aqiqah (Ref: ${verifyCashModal.id} - ${verifyCashModal.namaPenuh})`,
        memberEmail: verifyCashModal.userEmail || verifyCashModal.emel || '',
        paidPackageIds: [`qurban-cart-${verifyCashModal.id}-m1`],
        sessionYear: detectActiveSessionYear() || '2026',
        qurbanSession: verifyCashModal.sessionYear,
        auditTrail: [{
          time: `${todayDateStr} ${timeStr}`,
          user: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
          action: `Bayaran Tunai disahkan oleh urusetia (${debitAccount}).`
        }]
      };

      await setDoc(doc(db, 'kewanganTransactions', generatedTxnId), cleanUndefined(newKewanganTxn)).catch(err => {
        console.warn("Ralat merekod ke kewanganTransactions:", err);
      });

      if (typeof window !== 'undefined') {
        try {
          const existingTxnsStr = localStorage.getItem('tmf2_kewangan_transactions');
          const existingTxns = existingTxnsStr ? JSON.parse(existingTxnsStr) : [];
          if (Array.isArray(existingTxns) && !existingTxns.some((t: any) => t.id === generatedTxnId)) {
            const updatedTxns = [newKewanganTxn, ...existingTxns];
            localStorage.setItem('tmf2_kewangan_transactions', JSON.stringify(updatedTxns));
            window.dispatchEvent(new Event('tmf2_transactions_updated'));
          }
        } catch (e) {}
      }

      // 2. Backward compatibility (financialTransactions)
      await setDoc(doc(db, 'financialTransactions', generatedTxnId), cleanUndefined({
        id: generatedTxnId,
        date: todayDateStr,
        type: 'Pendapatan',
        category: 'Qurban Aqiqah',
        accountCredit: 'Qurban Aqiqah',
        accountDebit: debitAccount,
        amount: amountToRecord,
        notes: `Pengesahan bayaran Tunai Pendaftaran Qurban & Aqiqah (Ref: ${verifyCashModal.id} - ${verifyCashModal.namaPenuh})`,
        paidPackageIds: [`qurban-cart-${verifyCashModal.id}-m1`],
        payerUid: verifyCashModal.userUid,
        recordedBy: `${currentUserDoc?.displayName || 'Admin'} (Urusetia Qurban)`,
        approvedBy: currentUserDoc?.displayName || 'Admin',
        status: 'Lulus',
        history: [{
          action: 'Pengesahan Bayaran Tunai Qurban & Aqiqah',
          date: nowIso,
          user: currentUserDoc?.displayName || 'Admin',
          notes: `Bayaran Tunai disahkan oleh urusetia (${debitAccount}).`
        }],
        createdAt: nowIso,
        updatedAt: nowIso
      })).catch(err => {
        console.warn("Ralat merekod ke financialTransactions:", err);
      });

      if (logAction) {
        await logAction('Pengesahan Bayaran Tunai Qurban', `Mengesahkan bayaran tunai RM${amountToRecord.toFixed(2)} bagi pendaftaran ${verifyCashModal.id}`).catch(err => {
          console.warn("Ralat audit logAction:", err);
        });
      }

      showAlert(`Bayaran Tunai bagi pendaftaran ${verifyCashModal.id} berjaya disahkan!`, 'success');
      setVerifyCashModal(null);
    } catch (err: any) {
      console.error("Ralat mengesahkan bayaran tunai:", err);
      showAlert(err.message || "Gagal mengesahkan bayaran.", 'error');
    } finally {
      setIsVerifyingCash(false);
    }
  };

  // Handle Delete Registration
  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal || !db) return;
    setIsDeleting(true);

    try {
      await deleteDoc(doc(db, 'qurbanRegistrations', deleteConfirmModal.id));

      if (logAction) {
        await logAction('Padam Pendaftaran Qurban', `Memadam pendaftaran ${deleteConfirmModal.id} (${deleteConfirmModal.namaPenuh})`);
      }

      showAlert(`Pendaftaran ${deleteConfirmModal.id} telah dipadam.`, 'success');
      setDeleteConfirmModal(null);
    } catch (err: any) {
      console.error("Ralat memadam pendaftaran qurban:", err);
      showAlert(err.message || "Gagal memadam pendaftaran.", 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper for cash countdown timer text
  const getCashTimeRemainingText = (deadlineIso?: string) => {
    if (!deadlineIso) return null;
    const deadline = new Date(deadlineIso).getTime();
    const now = new Date().getTime();
    const diff = deadline - now;

    if (diff <= 0) {
      return <span className="text-rose-600 font-extrabold text-[10px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Tamat Tempoh (Masa Tunai Tamat)</span>;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return (
      <span className="text-amber-800 font-extrabold text-[10px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
        <Clock size={11} className="text-amber-600" />
        <span>Baki Masa Tunai: {hours}j {mins}m</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 space-y-6">
      
      {/* Top Header Row */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors cursor-pointer text-slate-700"
              title="Kembali ke Panel Admin"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <span className="text-[9px] font-black tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
              Pengurusan Admin Full Page
            </span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
              Urus Pendaftaran Qurban & Aqiqah
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => printAllQurbanRegistrationsPdf(filteredRegistrations, qurbanConfig)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-100 transition-all cursor-pointer flex items-center gap-2"
            title="Cetak Kelompok Semua Borang Pendaftaran (A4)"
          >
            <Printer size={16} />
            <span>Cetak Semua Borang ({filteredRegistrations.length})</span>
          </button>

          <button
            onClick={shareWhatsAppProgress}
            className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-100 transition-all cursor-pointer flex items-center gap-2"
            title="Kongsi Kemajuan Pembayaran ke WhatsApp"
          >
            <Share2 size={16} />
            <span>Kongsi WhatsApp</span>
          </button>

          <button
            onClick={() => window.location.reload()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer"
            title="Muat Semula Data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
          alertMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {alertMessage.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-rose-600" />}
          <span>{alertMessage.msg}</span>
        </div>
      )}

      {/* STATISTICS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jumlah Peserta Registered</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{totalRegistrations}</span>
            <Users size={20} className="text-emerald-600 opacity-60" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jumlah Kutipan Disahkan</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">RM {totalAmountCollected.toFixed(2)}</span>
            <DollarSign size={20} className="text-emerald-600 opacity-60" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tunai Menunggu Pengesahan</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700">{pendingCashCount}</span>
            <Clock size={20} className="text-amber-600 opacity-60" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ansuran Berjalan</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-700">{ansuranActiveCount}</span>
            <CreditCard size={20} className="text-indigo-600 opacity-60" />
          </div>
        </div>
      </div>

      {/* CHART & KEMAJUAN KESELURUHAN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
        
        {/* Progress Tracker Card (1/3 width) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[9px] font-black tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase">
              Sasaran & Kemajuan
            </span>
            <h3 className="text-base font-black text-slate-900 mt-2">Prestasi Kemajuan Qurban</h3>
            <p className="text-[11px] text-slate-500">Status pencapaian kutipan dana dan sasaran penyertaan semasa.</p>
          </div>

          <div className="space-y-5">
            {/* 1. Kutipan Kewangan */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-slate-700">Dana Terkumpul</span>
                <span className="text-xs font-black text-emerald-700">
                  RM {totalAmountCollected.toFixed(2)} / RM {totalAmountExpected.toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                <div 
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${percentCollected}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>Kemajuan: {percentCollected}%</span>
                <span>Baki: RM {(totalAmountExpected - totalAmountCollected).toFixed(2)}</span>
              </div>
            </div>

            {/* 2. Sasaran Slot Peserta (Had Kuota Bahagian) */}
            {(() => {
              const percentParticipants = targetSlots > 0 ? Math.min(100, Math.round((filledSlots / targetSlots) * 100)) : 0;
              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-700">Sasaran Slot Peserta</span>
                    <span className="text-xs font-black text-blue-700">
                      {filledSlots} / {targetSlots} Slot
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                    <div 
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${percentParticipants}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>Kemajuan: {percentParticipants}%</span>
                    <span>Baki: {Math.max(0, targetSlots - filledSlots)} slot</span>
                  </div>
                </div>
              );
            })()}

            {/* 3. Pembayaran Ansuran Berjalan */}
            {(() => {
              const totalAnsuran = registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.opsiBayaran === 'Ansuran').length;
              const ansuranSelesai = registrations.filter(r => r.statusPendaftaran !== 'Batal' && r.statusPendaftaran !== 'DITAMATKAN' && r.opsiBayaran === 'Ansuran' && r.paymentStatus === 'Selesai').length;
              const percentAnsuranSelesai = totalAnsuran > 0 ? Math.min(100, Math.round((ansuranSelesai / totalAnsuran) * 100)) : 0;
              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-700">Ansuran Selesai</span>
                    <span className="text-xs font-black text-indigo-700">
                      {ansuranSelesai} / {totalAnsuran} Kontrak
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                    <div 
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${percentAnsuranSelesai}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>Kemajuan: {percentAnsuranSelesai}%</span>
                    <span>Aktif: {totalAnsuran - ansuranSelesai} kontrak</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>Dikemaskini secara langsung</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
        </div>

        {/* Chart 1: Pilihan Pakej Qurban & Aqiqah (1/3 width) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[9px] font-black tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 uppercase">
              Pecahan Pakej
            </span>
            <h3 className="text-base font-black text-slate-900 mt-2">Pecahan Pakej Pilihan</h3>
            <p className="text-[11px] text-slate-500">Penyertaan peserta mengikut pakej yang didaftarkan.</p>
          </div>

          {packageDistribution.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-350 py-6">
              <span className="text-xs italic font-semibold">Tiada data untuk dipaparkan</span>
            </div>
          ) : (
            <div className="h-[180px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={packageDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {packageDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(value) => [`${value} Pendaftaran`, 'Jumlah']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Custom Legends */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            {packageDistribution.map((item, idx) => (
              <div key={idx} className="text-center space-y-0.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-slate-500 font-black block truncate">{item.name}</span>
                <span className="text-xs font-extrabold text-slate-900">{item.value} rekod</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Pilihan Pengurusan Daging (1/3 width) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[9px] font-black tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 uppercase">
              Pengurusan Daging
            </span>
            <h3 className="text-base font-black text-slate-900 mt-2">Ketetapan Agihan Daging</h3>
            <p className="text-[11px] text-slate-500">Pilihan peserta mengenai pembahagian daging qurban.</p>
          </div>

          {meatDistribution.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-350 py-6">
              <span className="text-xs italic font-semibold">Tiada data untuk dipaparkan</span>
            </div>
          ) : (
            <div className="h-[180px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meatDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(value) => [`${value} Peserta`, 'Jumlah']}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {meatDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Custom Legends */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            {meatDistribution.map((item, idx) => (
              <div key={idx} className="text-center space-y-0.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-slate-500 font-black block truncate" title={item.name}>{item.name}</span>
                <span className="text-xs font-extrabold text-slate-900">{item.value} slot</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, IC, No Tel, peserta..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none w-full cursor-pointer"
            >
              <option value="Semua">Semua Status</option>
              <option value="Dalam Proses">Dalam Proses</option>
              <option value="Disahkan">Disahkan</option>
              <option value="Batal">Batal</option>
            </select>
          </div>

          {/* Payment Mode Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
            <CreditCard size={14} className="text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Cara Bayaran:</span>
            <select
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none w-full cursor-pointer"
            >
              <option value="Semua">Semua Cara Bayaran</option>
              <option value="Online Transfer">Online Transfer / FPX</option>
              <option value="Tunai">Tunai</option>
            </select>
          </div>
        </div>
      </div>

      {/* REGISTRATIONS TABLE / LIST */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Senarai Pendaftaran Qurban & Aqiqah</h3>
            <p className="text-[11px] text-slate-500">Menunjukkan {filteredRegistrations.length} daripada {totalRegistrations} pendaftaran</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => printAllQurbanRegistrationsPdf(filteredRegistrations, qurbanConfig)}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Cetak Kelompok Borang A4"
            >
              <Printer size={14} />
              <span>Cetak Semua Borang (A4)</span>
            </button>

            <button
              onClick={shareWhatsAppProgress}
              className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Kongsi Kemajuan Pembayaran ke WhatsApp"
            >
              <Share2 size={14} />
              <span>Kongsi WhatsApp</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold space-y-2">
            <RefreshCw size={24} className="animate-spin mx-auto text-emerald-600" />
            <p>Memuatkan pendaftaran...</p>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold space-y-2">
            <AlertTriangle size={24} className="mx-auto text-slate-300" />
            <p>Tiada pendaftaran dijumpai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">No. Ref & Tarikh</th>
                  <th className="py-3 px-4">Pendaftar</th>
                  <th className="py-3 px-4">Pakej & Peserta</th>
                  <th className="py-3 px-4">Pembayaran</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRegistrations.map((reg) => {
                  const createdDate = new Date(reg.createdAt).toLocaleDateString('ms-MY', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Ref & Date */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-extrabold text-slate-900 block">{reg.id}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={11} />
                          {createdDate}
                        </span>
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-extrabold mt-1 uppercase">
                          {reg.sessionYear}
                        </span>
                      </td>

                      {/* Registrant Info */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-extrabold text-slate-900 block uppercase">{reg.namaPenuh}</span>
                        <span className="text-[10px] text-slate-500 block">IC: {reg.noIC} &bull; Tel: {reg.noTelefon}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[180px] block">{reg.alamat}</span>
                      </td>

                      {/* Package & Participants */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-extrabold text-emerald-900 block">{reg.jenisPenyertaan}</span>
                        <span className="text-xs font-black text-slate-800 block">{reg.pakejPilihan} (RM {reg.pakejPrice.toFixed(2)})</span>
                        <div className="mt-1 space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-500 block">Peserta ({reg.senaraiPeserta.length}):</span>
                          {reg.senaraiPeserta.map((p, idx) => (
                            <span key={idx} className="inline-block text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded mr-1 mb-0.5 font-bold">
                              {idx + 1}. {p}
                            </span>
                          ))}
                        </div>
                        {reg.pilihanDaging && (
                          <div className="mt-1.5">
                            <span className="text-[10px] font-bold text-slate-500 block">Pengurusan Daging:</span>
                            <span className="inline-block text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/55 px-1.5 py-0.5 rounded font-extrabold">
                              {reg.pilihanDaging}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Payment details */}
                      <td className="py-3.5 px-4 align-top">
                        {(() => {
                          const totalMonths = reg.totalMonths || (reg.opsiBayaran === 'Ansuran' ? (reg.tempohAnsuranBulan || 3) : 1);
                          const monthsPaid = reg.monthsPaid || 0;
                          const percentPaid = reg.opsiBayaran === 'Penuh' 
                            ? (reg.paymentStatus === 'Selesai' ? 100 : 0)
                            : Math.min(100, Math.round((monthsPaid / totalMonths) * 100));

                          const calculatedPaidRM = reg.opsiBayaran === 'Penuh'
                            ? (reg.paymentStatus === 'Selesai' ? reg.totalAmount : 0)
                            : (reg.installmentPayments || [])
                                .filter(p => p.status === 'Lulus')
                                .reduce((sum, p) => sum + p.amount, 0) || (monthsPaid * (reg.monthlyAmount || 0));

                          return (
                            <div className="space-y-1.5 min-w-[155px]">
                              <span className="font-black text-slate-900 block text-xs">RM {reg.totalAmount.toFixed(2)}</span>
                              
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                  reg.opsiBayaran === 'Penuh' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {reg.opsiBayaran === 'Penuh' ? 'Bayar Penuh' : `Ansuran (${totalMonths} bln)`}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-bold">
                                  Cara: {reg.caraPembayaran}
                                </span>
                              </div>

                              {/* Cash deadline for pending registrations */}
                              {reg.statusPendaftaran === 'Dalam Proses' && (
                                <div className="mt-1">
                                  {getCashTimeRemainingText(reg.cashDeadline || new Date(new Date(reg.createdAt).getTime() + 24*60*60*1000).toISOString())}
                                </div>
                              )}

                              {/* Progress bar */}
                              <div className="pt-1">
                                <div className="flex justify-between items-center text-[10px] mb-0.5 font-bold text-slate-500">
                                  <span>Progress: {percentPaid}%</span>
                                  <span>{reg.opsiBayaran === 'Ansuran' ? `${monthsPaid}/${totalMonths} Bln` : (reg.paymentStatus === 'Selesai' ? 'Selesai' : 'Belum')}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      percentPaid === 100 
                                        ? 'bg-emerald-500' 
                                        : percentPaid > 0 
                                        ? 'bg-indigo-500' 
                                        : 'bg-slate-200'
                                    }`}
                                    style={{ width: `${percentPaid}%` }}
                                  />
                                </div>
                                <div className="text-[10px] text-slate-500 font-extrabold mt-1">
                                  Paid: <span className="text-emerald-700">RM {calculatedPaidRM.toFixed(2)}</span> / RM {reg.totalAmount.toFixed(2)}
                                </div>
                              </div>

                              {/* Installment month bubbles */}
                              {reg.opsiBayaran === 'Ansuran' && reg.installmentPayments && reg.installmentPayments.length > 0 && (
                                <div className="pt-1.5">
                                  <span className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-wider">Jadual Bulan (Klik untuk kemaskini):</span>
                                  <div className="flex flex-wrap gap-1">
                                    {reg.installmentPayments.map((inst) => {
                                      let bgClass = 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200';
                                      if (inst.status === 'Lulus') {
                                        bgClass = 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600';
                                      } else if (inst.status === 'Dalam Semakan' || inst.status === 'Pending' || inst.status === 'Belum Disahkan') {
                                        bgClass = 'bg-amber-400 hover:bg-amber-500 text-white border-amber-500 animate-pulse';
                                      } else if (inst.status === 'Tolak') {
                                        bgClass = 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600';
                                      }
                                      return (
                                        <button
                                          key={inst.monthIndex}
                                          onClick={() => {
                                            setSelectedInstallmentReg(reg);
                                            setEditingMonthIndex(inst.monthIndex);
                                            setEditingInstStatus(inst.status);
                                            setEditingInstMethod(inst.paymentMethod || 'Manual');
                                            setEditingInstTxnId(inst.transactionId || '');
                                          }}
                                          className={`w-5 h-5 rounded-full border text-[9px] font-black flex items-center justify-center transition-all cursor-pointer shadow-xs ${bgClass}`}
                                          title={`${inst.monthName}: RM ${inst.amount.toFixed(2)} (${inst.status})`}
                                        >
                                          {inst.monthIndex}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-top">
                        {reg.statusPendaftaran === 'Disahkan' ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                            <CheckCircle2 size={12} />
                            Disahkan
                          </span>
                        ) : reg.statusPendaftaran === 'DISEMAK' ? (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                            <Clock size={12} className="text-amber-600 animate-pulse" />
                            DISEMAK
                          </span>
                        ) : reg.statusPendaftaran === 'DITAMATKAN' ? (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-300 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} className="text-rose-600" />
                            DITAMATKAN
                          </span>
                        ) : reg.statusPendaftaran === 'Batal' ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                            <X size={12} />
                            Batal
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                            <Clock size={12} />
                            Dalam Proses
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right space-y-1">
                        {/* Print PDF Button */}
                        <button
                          onClick={() => printQurbanRegistrationPdf(reg, qurbanConfig)}
                          className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer flex items-center justify-end gap-1 ml-auto"
                          title="Cetak Borang PDF A4"
                        >
                          <FileText size={13} />
                          <span>Cetak Borang</span>
                        </button>

                        {/* Edit Registration Button */}
                        <button
                          onClick={() => openEditModal(reg)}
                          className="w-full sm:w-auto px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer flex items-center justify-end gap-1 ml-auto"
                          title="Edit Maklumat"
                        >
                          <Edit3 size={13} />
                          <span>Edit Maklumat</span>
                        </button>

                        {/* Verify Cash Payment Button */}
                        {reg.caraPembayaran === 'Tunai' && reg.statusPendaftaran === 'Dalam Proses' && (
                          <button
                            onClick={() => setVerifyCashModal(reg)}
                            className="w-full sm:w-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-end gap-1 ml-auto"
                          >
                            <ShieldCheck size={13} />
                            <span>Sahkan Tunai</span>
                          </button>
                        )}

                        {/* Delete Registration */}
                        <button
                          onClick={() => setDeleteConfirmModal(reg)}
                          className="w-full sm:w-auto px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer flex items-center justify-end gap-1 ml-auto"
                          title="Padam Pendaftaran"
                        >
                          <Trash2 size={13} />
                          <span>Padam</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDITABLE CARD FOR BORANG CATATAN & DIGITAL SIGNATURE */}
      <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
            <Edit3 size={18} />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-sm">Tetapan Catatan & Tandatangan Digital Borang</h2>
            <p className="text-[11px] text-slate-500">Catatan dan lakaran tandatangan ini akan dipaparkan secara automatik di atas ruangan tandatangan pada Borang Cetakan Qurban & Aqiqah (A4).</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Textarea for Catatan Borang */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Catatan Admin / Syarat Khas Borang Cetakan:</label>
            <textarea
              rows={4}
              value={catatanText}
              onChange={(e) => setCatatanText(e.target.value)}
              placeholder="Contoh: Sila pastikan maklumat peserta & akad adalah betul. Pendaftaran tertakluk kepada pengesahan urusetia."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
            />
          </div>

          {/* Digital Signature Canvas */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 block">Tandatangan Digital Urusetia (Canvas):</label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[10px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-all"
              >
                <Eraser size={12} />
                <span>Padam Lakaran</span>
              </button>
            </div>
            
            <div className="relative border border-slate-300 rounded-2xl bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                width={380}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[120px] touch-none cursor-crosshair"
              />
              {!isDrawing && !canvasRef.current && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs italic">
                  Lukis tandatangan di sini
                </div>
              )}
            </div>

            {adminSignatureUrl && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>Tandatangan Tersimpan:</span>
                <img src={adminSignatureUrl} alt="Preview Tandatangan" className="h-6 object-contain border border-slate-200 rounded px-1" />
                <button 
                  type="button" 
                  onClick={() => setAdminSignatureUrl('')}
                  className="text-rose-500 font-bold hover:underline cursor-pointer"
                >
                  Padam Tersimpan
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSaveConfigNotes}
            disabled={isSavingConfig}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-100 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSavingConfig ? 'Menyimpan...' : 'Simpan Catatan & Tandatangan Digital'}</span>
          </button>
        </div>
      </div>

      {/* VERIFY CASH MODAL */}
      {verifyCashModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-100 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
                  Pengesahan Pembayaran Tunai
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">Sahkan Bayaran Tunai</h3>
              </div>
              <button
                onClick={() => setVerifyCashModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs">
              <div><span className="font-bold text-slate-500">Nama Pendaftar:</span> <span className="font-extrabold text-slate-900 uppercase">{verifyCashModal.namaPenuh}</span></div>
              <div><span className="font-bold text-slate-500">Pakej:</span> <span className="font-extrabold text-slate-900">{verifyCashModal.pakejPilihan} ({verifyCashModal.jenisPenyertaan})</span></div>
              <div><span className="font-bold text-slate-500">Mod Bayaran:</span> <span className="font-extrabold text-emerald-800">{verifyCashModal.opsiBayaran === 'Penuh' ? 'Bayaran Penuh' : `Ansuran (${verifyCashModal.tempohAnsuranBulan || 3} Bulan)`}</span></div>
              <div>
                <span className="font-bold text-slate-500">Jumlah Terima Tunai:</span>{' '}
                <span className="font-black text-emerald-700 text-sm">
                  RM {(verifyCashModal.opsiBayaran === 'Ansuran' ? (verifyCashModal.depositAmount || verifyCashModal.monthlyAmount || 0) : verifyCashModal.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Akaun Penerimaan Wang Tunai:</label>
              <select
                value={cashAccount}
                onChange={(e) => setCashAccount(e.target.value as any)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="Tunai">Tunai di Tangan (Urusetia / Bendahari)</option>
                <option value="Bank">Akaun Bank Persatuan</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVerifyCashModal(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmVerifyCash}
                disabled={isVerifyingCash}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-emerald-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isVerifyingCash ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Mengesahkan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Sahkan Penerimaan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Padam Pendaftaran?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Adakah anda pasti untuk memadam pendaftaran <strong className="text-slate-800">{deleteConfirmModal.id}</strong> ({deleteConfirmModal.namaPenuh})? Tindakan ini tidak boleh diundur.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-rose-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? 'Memadam...' : 'Padam Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE INSTALLMENT MODAL */}
      {selectedInstallmentReg && editingMonthIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase">
                  Kemaskini Bayaran Ansuran
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">Bulan {editingMonthIndex}</h3>
                <p className="text-[11px] text-slate-500 font-medium">Ref ID: {selectedInstallmentReg.id} ({selectedInstallmentReg.namaPenuh})</p>
              </div>
              <button
                onClick={() => {
                  setSelectedInstallmentReg(null);
                  setEditingMonthIndex(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs">
              {(() => {
                const inst = selectedInstallmentReg.installmentPayments?.find(i => i.monthIndex === editingMonthIndex);
                return (
                  <>
                    <div><span className="font-bold text-slate-500">Nama Ansuran:</span> <span className="font-extrabold text-slate-900">{inst?.monthName || `Bulan ${editingMonthIndex}`}</span></div>
                    <div><span className="font-bold text-slate-500">Jumlah Ansuran:</span> <span className="font-black text-indigo-700 text-sm">RM {inst?.amount?.toFixed(2) || '0.00'}</span></div>
                    {inst?.paidAt && (
                      <div><span className="font-bold text-slate-500">Tarikh Bayar:</span> <span className="font-extrabold text-slate-900">{new Date(inst.paidAt).toLocaleString('ms-MY')}</span></div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Status Bayaran:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Belum Bayar', 'Dalam Semakan', 'Lulus', 'Tolak'] as const).map(s => {
                    let statusColor = 'border-slate-200 bg-slate-50 text-slate-700';
                    if (editingInstStatus === s) {
                      if (s === 'Lulus') statusColor = 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20';
                      else if (s === 'Dalam Semakan') statusColor = 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20';
                      else if (s === 'Tolak') statusColor = 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20';
                      else statusColor = 'border-slate-600 bg-slate-100 text-slate-900 ring-2 ring-slate-500/20';
                    }
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditingInstStatus(s)}
                        className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${statusColor}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editingInstStatus === 'Lulus' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Cara Bayaran:</label>
                    <select
                      value={editingInstMethod}
                      onChange={(e) => setEditingInstMethod(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="FPX">FPX / Online Gateway</option>
                      <option value="Manual">Manual Transfer</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">No. Rujukan Transaksi (Opsional):</label>
                    <input
                      type="text"
                      value={editingInstTxnId}
                      onChange={(e) => setEditingInstTxnId(e.target.value)}
                      placeholder="e.g. FPX12345678"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedInstallmentReg(null);
                  setEditingMonthIndex(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveInstallment}
                disabled={isSavingInstallment}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSavingInstallment ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-100 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
                  Edit Maklumat Peserta & Pilihan
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">Ubah Maklumat Pendaftaran</h3>
                <p className="text-[11px] text-slate-500 font-medium">Ref ID: {editModal.id} ({editModal.namaPenuh})</p>
              </div>
              <button
                onClick={() => setEditModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Pendaftaran */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 block uppercase">Status Pendaftaran:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['Dalam Proses', 'Disahkan', 'DISEMAK', 'DITAMATKAN', 'Batal'] as const).map(s => {
                    let btnStyle = 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100';
                    if (editedStatusPendaftaran === s) {
                      if (s === 'Disahkan') btnStyle = 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs';
                      else if (s === 'DISEMAK') btnStyle = 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs';
                      else if (s === 'DITAMATKAN') btnStyle = 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs';
                      else if (s === 'Dalam Proses') btnStyle = 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs';
                      else if (s === 'Batal') btnStyle = 'border-slate-600 bg-slate-100 text-slate-900 shadow-xs';
                    }
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditedStatusPendaftaran(s)}
                        className={`p-2.5 rounded-2xl border text-[11px] font-black tracking-tight transition-all cursor-pointer uppercase ${btnStyle}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Jenis Penyertaan */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 block uppercase">Jenis Penyertaan:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Qurban Sunat', 'Qurban Wajib', 'Aqiqah Sunat', 'Aqiqah Wajib'] as const).map(j => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setEditedJenisPenyertaan(j)}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
                        editedJenisPenyertaan === j 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs' 
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pilihan Pengurusan Daging */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 block uppercase">Pilihan Pengurusan Daging:</label>
                <div className="grid grid-cols-1 gap-2">
                  {(['Mahu Ambil Daging', 'Tidak Mahu Daging', 'Simpan Daging'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setEditedPilihanDaging(d)}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all cursor-pointer text-left flex items-center justify-between ${
                        editedPilihanDaging === d 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs' 
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{d}</span>
                      {editedPilihanDaging === d && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Peserta */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 block uppercase">Senarai Nama Peserta / Penama:</label>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {editedSenaraiPeserta.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-400 w-6 text-center">{idx + 1}.</span>
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => {
                          const next = [...editedSenaraiPeserta];
                          next[idx] = e.target.value;
                          setEditedSenaraiPeserta(next);
                        }}
                        placeholder={`Nama Peserta / Penama ${idx + 1}`}
                        className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-extrabold"
                      />
                      {editedSenaraiPeserta.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditedSenaraiPeserta(editedSenaraiPeserta.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Padam Peserta"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditedSenaraiPeserta([...editedSenaraiPeserta, ''])}
                  className="mt-1 text-xs font-extrabold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100"
                >
                  <Plus size={14} />
                  <span>Tambah Peserta</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-emerald-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Simpan Maklumat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
