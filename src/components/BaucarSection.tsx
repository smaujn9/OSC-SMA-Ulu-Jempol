import React, { useState, useEffect, useRef } from 'react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { 
  Folder, 
  FileText, 
  Plus, 
  Search, 
  ArrowLeft, 
  MoreVertical, 
  Download, 
  Trash2, 
  Edit2, 
  Check, 
  Loader2, 
  Clock, 
  AlertCircle, 
  Filter,
  User,
  CreditCard,
  Building2,
  FileCheck,
  PenTool,
  Printer,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, AppUser } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { cleanUndefined } from '../utils/firestoreUtils';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  updateDoc
} from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { logoBase64 } from '../utils/logoBase64';

export interface PaymentVoucher {
  id: string; // PV No e.g. PV-2026-0001
  associationName: string;
  associationNo: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  payeeName: string;
  payeeEmail: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  time: string;
  accountDebit: string;
  accountCredit: string;
  sigTreasurer?: string; // base64
  sigTreasurerName?: string;
  sigTreasurerAt?: string;
  sigChairman?: string; // base64
  sigChairmanName?: string;
  sigChairmanAt?: string;
  sigReceiver?: string; // base64
  sigReceiverName?: string;
  sigReceiverAt?: string;
  txnId: string; // Corresponding ledger transaction ID
  items?: Array<{ description: string; amount: number; }>;
  catatan?: string;
}

interface BaucarSectionProps {
  isMobile: boolean;
  onBack: () => void;
}

export const BaucarSection: React.FC<BaucarSectionProps> = ({ isMobile, onBack }) => {
  const { currentUserDoc, allUsers, firebaseUser } = useAuth();

  // Transactions State for Balance Calculation
  const [transactions, setTransactions] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tmf2_kewangan_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('tmf2_kewangan_transactions');
        if (saved) setTransactions(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('tmf2_transactions_updated', handleSync);
    return () => {
      window.removeEventListener('tmf2_transactions_updated', handleSync);
    };
  }, []);

  // States
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua'); // Semua, Belum Ditandatangan, Lengkap, dsb.

  // Modal States
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Form Fields
  const [formPvNo, setFormPvNo] = useState('');
  const [formAssociationName, setFormAssociationName] = useState('Sekolah Menengah Agama Ulu Jempol (SMAUJ)');
  const [formAssociationNo, setFormAssociationNo] = useState('PIBG / SMAUJ');
  const [formBankName, setFormBankName] = useState('');
  const [formBankAccountName, setFormBankAccountName] = useState('');
  const [formBankAccountNumber, setFormBankAccountNumber] = useState('');
  const [formPayeeName, setFormPayeeName] = useState('');
  const [formPayeeEmail, setFormPayeeEmail] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Operasi Persatuan');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formDebitAccount, setFormDebitAccount] = useState('Operasi Persatuan');
  const [formCreditAccount, setFormCreditAccount] = useState('Bank');
  const [formItems, setFormItems] = useState<Array<{ description: string; amount: string }>>([{ description: '', amount: '' }]);
  const [formCatatan, setFormCatatan] = useState('');
  const [isManualPayee, setIsManualPayee] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-calculate Khairat Kematian balance
  const [khairatBalance, setKhairatBalance] = useState<number>(0);

  useEffect(() => {
    if ((formDebitAccount === 'Khairat Kematian' || formCategory === 'Khairat Kematian') && formPayeeEmail) {
      const income = transactions.filter(t => 
        t.memberEmail === formPayeeEmail &&
        t.accountCredit === "Khairat Kematian" &&
        t.approvalStatus === "Approved"
      ).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
      const expense = transactions.filter(t => 
        t.memberEmail === formPayeeEmail &&
        t.accountDebit === "Khairat Kematian" &&
        t.approvalStatus === "Approved"
      ).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
      const accumulated = income - expense;
      setKhairatBalance(accumulated);
      
      if (!isEditMode) {
        setFormAmount(accumulated > 0 ? accumulated.toString() : '');
        if (formItems.length === 1 && (!formItems[0].description || formItems[0].description.includes("Khairat"))) {
          setFormItems([{ description: 'Pembayaran Manfaat Khairat Kematian', amount: accumulated > 0 ? accumulated.toString() : '0' }]);
        }
      }
    } else {
      setKhairatBalance(0);
    }
  }, [formDebitAccount, formCategory, formPayeeEmail, transactions, isEditMode]);

  // Digital Signature Modal States
  const [showSignModal, setShowSignModal] = useState(false);
  const [signingRole, setSigningRole] = useState<'Treasurer' | 'Chairman' | 'Receiver' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Loading & Progress states for action buttons
  const [deletingVoucherId, setDeletingVoucherId] = useState<string | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [clearingSignatureRole, setClearingSignatureRole] = useState<'Treasurer' | 'Chairman' | 'Receiver' | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [confirmDeleteVoucher, setConfirmDeleteVoucher] = useState<PaymentVoucher | null>(null);
  const [confirmClearSigRole, setConfirmClearSigRole] = useState<'Treasurer' | 'Chairman' | 'Receiver' | null>(null);

  const accountsList = [
    "Tunai", "Bank", "Yuran Keahlian", "Yuran Bulanan", "Khairat Kematian", "Qurban Aqiqah", "Sumbangan", "Sewaan Dewan", 
    "Sewaan Tapak", "Sewaan Mesin Minuman", "Pendapatan Program", "Faedah Bank", 
    "Bil Elektrik", "Bil Air", "Landskap", "Pbersihan", "Keselamatan", 
    "Program Komuniti", "Operasi Persatuan", "Caj Perkhidmatan"
  ];

  const categoriesList = [
    "Yuran Keahlian", "Yuran Bulanan", "Khairat Kematian", "Qurban Aqiqah", "Sumbangan", "Sewaan Dewan", "Sewaan Tapak", "Pembersihan",
    "Keselamatan", "Bil Elektrik", "Bil Air", "Landskap", "Program Komuniti", "Operasi Persatuan", "Pindahan Wang (Kontra)", "Caj Perkhidmatan"
  ];

  // Access check
  const role = currentUserDoc?.role || '';
  const isAdminUtama = role === 'Admin Utama' || role === 'ADMIN UTAMA' || currentUserDoc?.isSuperAdmin === true || currentUserDoc?.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my';
  const isBendahari = role === 'Bendahari';
  const isPengerusi = role === 'Pengerusi';
  const userEmail = currentUserDoc?.email || '';

  // Can manage (Create, Edit, Delete)
  const canManage = isAdminUtama || isBendahari;

  // Real-time Firestore Sync
  useEffect(() => {
    if (!firebaseUser || firebaseUser.uid === 'guest_local') {
      setVouchers([]);
      setIsLoading(false);
      return;
    }

    const unsub = onSnapshot(collection(db, 'paymentVouchers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as PaymentVoucher[];
      
      // Sort vouchers by date & PV No descending
      data.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      });

      setVouchers(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Gagal mendapatkan baucar:", error);
      setIsLoading(false);
    });

    return () => unsub();
  }, [firebaseUser]);

  // Filter and Search logic
  const filteredVouchers = vouchers.filter(v => {
    // Search match
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = 
      v.id.toLowerCase().includes(searchLower) ||
      v.payeeName.toLowerCase().includes(searchLower) ||
      v.payeeEmail.toLowerCase().includes(searchLower) ||
      v.description.toLowerCase().includes(searchLower);

    // Category match
    const matchCategory = filterCategory === 'Semua' || v.category === filterCategory;

    // Status match
    let matchStatus = true;
    const hasTreasurerSig = !!v.sigTreasurer;
    const hasChairmanSig = !!v.sigChairman;
    const hasReceiverSig = !!v.sigReceiver;

    if (filterStatus === 'Lengkap') {
      matchStatus = hasTreasurerSig && hasChairmanSig && hasReceiverSig;
    } else if (filterStatus === 'Belum Selesai') {
      matchStatus = !(hasTreasurerSig && hasChairmanSig && hasReceiverSig);
    } else if (filterStatus === 'Belum Ditandatangan Bendahari') {
      matchStatus = !hasTreasurerSig;
    } else if (filterStatus === 'Belum Ditandatangan Pengerusi') {
      matchStatus = !hasChairmanSig;
    } else if (filterStatus === 'Belum Ditandatangan Penerima') {
      matchStatus = !hasReceiverSig;
    }

    // Role-specific filtering: If ordinary user is payee, they only see vouchers assigned to their email!
    let visibleForRole = false;
    if (isAdminUtama || isBendahari || isPengerusi) {
      visibleForRole = true;
    } else if (v.payeeEmail && v.payeeEmail.toLowerCase() === userEmail.toLowerCase()) {
      visibleForRole = true;
    }

    return matchSearch && matchCategory && matchStatus && visibleForRole;
  });

  // Handle payee selection change
  useEffect(() => {
    if (!isManualPayee && formPayeeName && allUsers) {
      const selected = allUsers.find(u => u.displayName === formPayeeName || u.nickname === formPayeeName);
      if (selected?.email) {
        setFormPayeeEmail(selected.email);
      }
    }
  }, [formPayeeName, allUsers, isManualPayee]);

  // Auto-calculate total amount and summary description from itemized rows
  useEffect(() => {
    const isAnyItemAmountFilled = formItems.some(item => item.amount.trim() !== '');
    if (isAnyItemAmountFilled) {
      const total = formItems.reduce((sum, item) => {
        const val = parseFloat(item.amount) || 0;
        return sum + val;
      }, 0);
      setFormAmount(total > 0 ? total.toFixed(2) : '');
    }

    const filledDescs = formItems.map(item => item.description.trim()).filter(Boolean);
    if (filledDescs.length > 0) {
      setFormDescription(filledDescs.join(', '));
    }
  }, [formItems]);

  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setSelectedVoucher(null);
    setIsManualPayee(false);
    setFormCatatan('');
    
    // Auto generate collision-free PV No
    const currentYear = new Date().getFullYear();
    let maxPvNum = vouchers.length;
    vouchers.forEach(v => {
      const m = v.id?.match(/^PV-\d{4}-(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxPvNum) maxPvNum = num;
      }
    });
    const nextNum = maxPvNum + 1;
    const generatedNo = `PV-${currentYear}-${String(nextNum).padStart(4, '0')}`;
    setFormPvNo(generatedNo);

    // Form defaults
    setFormAssociationName('Sekolah Menengah Agama Ulu Jempol (SMAUJ)');
    setFormAssociationNo('PIBG / SMAUJ');
    setFormBankName('');
    setFormBankAccountName('');
    setFormBankAccountNumber('');
    setFormPayeeName('');
    setFormPayeeEmail('');
    setFormAmount('');
    setFormDescription('');
    setFormCategory('Operasi Persatuan');
    setFormDebitAccount('Operasi Persatuan');
    setFormCreditAccount('Bank');
    setFormItems([{ description: '', amount: '' }]);

    // Default Date and Time
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setFormDate(`${yyyy}-${mm}-${dd}`);

    const hh = String(today.getHours()).padStart(2, '0');
    const min = String(today.getMinutes()).padStart(2, '0');
    setFormTime(`${hh}:${min}`);

    setShowAddEditModal(true);
  };

  const handleOpenEditModal = (voucher: PaymentVoucher, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    setSelectedVoucher(voucher);

    setFormPvNo(voucher.id);
    setFormAssociationName(voucher.associationName);
    setFormAssociationNo(voucher.associationNo || 'PPM-001-05-28092026');
    setFormBankName(voucher.bankName || '');
    setFormBankAccountName(voucher.bankAccountName || '');
    setFormBankAccountNumber(voucher.bankAccountNumber || '');
    setFormPayeeName(voucher.payeeName);
    setFormPayeeEmail(voucher.payeeEmail);
    setFormAmount(String(voucher.amount));
    setFormDescription(voucher.description);
    setFormCategory(voucher.category);
    setFormDate(voucher.date);
    setFormTime(voucher.time || '12:00');
    setFormDebitAccount(voucher.accountDebit || voucher.category);
    setFormCreditAccount(voucher.accountCredit || 'Bank');
    setFormCatatan(voucher.catatan || '');

    const isMember = allUsers?.some(u => u.displayName === voucher.payeeName || u.nickname === voucher.payeeName);
    setIsManualPayee(!isMember);

    if (voucher.items && voucher.items.length > 0) {
      setFormItems(voucher.items.map(item => ({ description: item.description, amount: String(item.amount) })));
    } else {
      setFormItems([{ description: voucher.description, amount: String(voucher.amount) }]);
    }

    setShowAddEditModal(true);
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      alert("Anda tiada kebenaran untuk menyimpan baucar.");
      return;
    }

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Sila masukkan nilai jumlah (RM) yang sah.");
      return;
    }

    if (!formPayeeName) {
      alert("Sila pilih penerima.");
      return;
    }

    try {
      setIsSaving(true);
      const docId = formPvNo;

      // Unique corresponding ledger transaction ID
      // If edit mode and already has txnId, use that. Otherwise, generate a new one.
      const txnId = isEditMode && selectedVoucher?.txnId 
        ? selectedVoucher.txnId 
        : `TXN-PV-${Date.now()}`;

      const voucherData: PaymentVoucher = {
        id: docId,
        associationName: formAssociationName,
        associationNo: formAssociationNo,
        bankName: formBankName,
        bankAccountName: formBankAccountName,
        bankAccountNumber: formBankAccountNumber,
        payeeName: formPayeeName,
        payeeEmail: formPayeeEmail,
        amount: parsedAmount,
        description: formDescription,
        category: formCategory,
        date: formDate,
        time: formTime,
        accountDebit: formDebitAccount,
        accountCredit: formCreditAccount,
        txnId: txnId,
        items: formItems.map(item => ({
          description: item.description,
          amount: parseFloat(item.amount) || 0
        })),
        catatan: formCatatan,
        // Preserve signatures if in edit mode
        ...(isEditMode && selectedVoucher ? {
          sigTreasurer: selectedVoucher.sigTreasurer,
          sigTreasurerName: selectedVoucher.sigTreasurerName,
          sigTreasurerAt: selectedVoucher.sigTreasurerAt,
          sigChairman: selectedVoucher.sigChairman,
          sigChairmanName: selectedVoucher.sigChairmanName,
          sigChairmanAt: selectedVoucher.sigChairmanAt,
          sigReceiver: selectedVoucher.sigReceiver,
          sigReceiverName: selectedVoucher.sigReceiverName,
          sigReceiverAt: selectedVoucher.sigReceiverAt,
        } : {})
      };

      // 1. Save Voucher to Firestore
      await setDoc(doc(db, 'paymentVouchers', docId), cleanUndefined(voucherData));

      // 2. Sync to Ledger (kewanganTransactions)
      // Determine ledger transaction status: Approved if signed by Treasurer AND Chairman, otherwise Pending
      const hasTreasurerSig = isEditMode ? !!selectedVoucher?.sigTreasurer : false;
      const hasChairmanSig = isEditMode ? !!selectedVoucher?.sigChairman : false;
      const approvalStatus = (hasTreasurerSig && hasChairmanSig) ? 'Approved' : 'Pending';

      const ledgerTxn = {
        id: txnId,
        voucherNo: docId,
        date: formDate,
        time: formTime,
        accountDebit: formDebitAccount,
        accountCredit: formCreditAccount,
        amount: parsedAmount,
        description: `Baucar ${docId}: Bayaran kepada ${formPayeeName} - ${formDescription}`,
        category: formCategory,
        recordedBy: currentUserDoc?.displayName || currentUserDoc?.email || "Bendahari",
        approvalStatus: approvalStatus,
        notes: `Baucar Bayaran automatik dari modul Baucar.`,
        memberEmail: formPayeeEmail || undefined,
        sessionYear: (formDate || '').split('-')[0] || String(new Date().getFullYear()),
        auditTrail: [
          {
            time: new Date().toISOString().replace('T', ' ').slice(0, 16),
            user: currentUserDoc?.displayName || currentUserDoc?.email || "Bendahari",
            action: isEditMode ? `Mengemas kini baucar bayaran ${docId}` : `Mencipta baucar bayaran ${docId}`
          }
        ]
      };

      await setDoc(doc(db, 'kewanganTransactions', txnId), cleanUndefined(ledgerTxn));

      setShowAddEditModal(false);
      setSelectedVoucher(null);
    } catch (err) {
      console.error("Gagal menyimpan baucar:", err);
      alert("Gagal menyimpan baucar. Sila cuba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVoucher = (voucher: PaymentVoucher, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManage) {
      alert("Anda tiada kebenaran untuk memadam baucar.");
      return;
    }
    setConfirmDeleteVoucher(voucher);
  };

  const handleConfirmDeleteVoucher = async () => {
    if (!confirmDeleteVoucher) return;
    const voucherId = confirmDeleteVoucher.id;
    const txnId = confirmDeleteVoucher.txnId;

    try {
      setDeletingVoucherId(voucherId);
      // 1. Delete Voucher document
      await deleteDoc(doc(db, 'paymentVouchers', voucherId));

      // 2. Delete corresponding ledger transaction if present
      if (txnId) {
        await deleteDoc(doc(db, 'kewanganTransactions', txnId));
      }
      setConfirmDeleteVoucher(null);
    } catch (err) {
      console.error("Gagal memadam baucar:", err);
      alert("Ralat memadam baucar.");
    } finally {
      setDeletingVoucherId(null);
    }
  };

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

  const handleOpenSignModal = (role: 'Treasurer' | 'Chairman' | 'Receiver') => {
    setSigningRole(role);
    setShowSignModal(true);
    setIsDrawing(false);
    setTimeout(() => {
      clearCanvas();
    }, 100);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !signingRole || !selectedVoucher) return;

    try {
      setIsSavingSignature(true);
      const dataUrl = canvas.toDataURL('image/png');
      const signerName = currentUserDoc?.displayName || currentUserDoc?.email || "Pengguna";
      const signDate = new Date().toLocaleString('ms-MY', { hour12: false });

      const updatedVoucher = { ...selectedVoucher };

      if (signingRole === 'Treasurer') {
        updatedVoucher.sigTreasurer = dataUrl;
        updatedVoucher.sigTreasurerName = signerName;
        updatedVoucher.sigTreasurerAt = signDate;
      } else if (signingRole === 'Chairman') {
        updatedVoucher.sigChairman = dataUrl;
        updatedVoucher.sigChairmanName = signerName;
        updatedVoucher.sigChairmanAt = signDate;
      } else if (signingRole === 'Receiver') {
        updatedVoucher.sigReceiver = dataUrl;
        updatedVoucher.sigReceiverName = signerName;
        updatedVoucher.sigReceiverAt = signDate;
      }

      // Update in database
      await setDoc(doc(db, 'paymentVouchers', selectedVoucher.id), updatedVoucher);
      
      // Sync status to Ledger
      const hasTreasurerSig = !!updatedVoucher.sigTreasurer;
      const hasChairmanSig = !!updatedVoucher.sigChairman;
      const approvalStatus = (hasTreasurerSig && hasChairmanSig) ? 'Approved' : 'Pending';

      if (selectedVoucher.txnId) {
        const txnUpdates: any = {
          approvalStatus: approvalStatus,
          sessionYear: (selectedVoucher.date || '').split('-')[0] || String(new Date().getFullYear())
        };
        if (approvalStatus === 'Approved') {
          txnUpdates.approvedBy = updatedVoucher.sigChairmanName || currentUserDoc?.displayName || 'Pengerusi';
          txnUpdates.approvedDate = new Date().toISOString().split('T')[0];
        } else {
          txnUpdates.approvedBy = "";
          txnUpdates.approvedDate = "";
        }
        await updateDoc(doc(db, 'kewanganTransactions', selectedVoucher.txnId), txnUpdates);
      }

      // Update selected voucher in detail view state
      setSelectedVoucher(updatedVoucher);
      setShowSignModal(false);
    } catch (err) {
      console.error("Gagal menyimpan tandatangan:", err);
      alert("Gagal menyimpan tandatangan. Cuba lagi.");
    } finally {
      setIsSavingSignature(false);
    }
  };

  const initiateClearSignature = (role: 'Treasurer' | 'Chairman' | 'Receiver') => {
    setConfirmClearSigRole(role);
  };

  const clearVoucherSignature = async () => {
    if (!selectedVoucher || !confirmClearSigRole) return;
    const role = confirmClearSigRole;

    try {
      setClearingSignatureRole(role);
      const updatedVoucher = { ...selectedVoucher };

      if (role === 'Treasurer') {
        updatedVoucher.sigTreasurer = "";
        updatedVoucher.sigTreasurerName = "";
        updatedVoucher.sigTreasurerAt = "";
      } else if (role === 'Chairman') {
        updatedVoucher.sigChairman = "";
        updatedVoucher.sigChairmanName = "";
        updatedVoucher.sigChairmanAt = "";
      } else if (role === 'Receiver') {
        updatedVoucher.sigReceiver = "";
        updatedVoucher.sigReceiverName = "";
        updatedVoucher.sigReceiverAt = "";
      }

      await setDoc(doc(db, 'paymentVouchers', selectedVoucher.id), updatedVoucher);

      // Sync status to Ledger
      const hasTreasurerSig = !!updatedVoucher.sigTreasurer;
      const hasChairmanSig = !!updatedVoucher.sigChairman;
      const approvalStatus = (hasTreasurerSig && hasChairmanSig) ? 'Approved' : 'Pending';

      if (selectedVoucher.txnId) {
        const txnUpdates: any = {
          approvalStatus: approvalStatus,
          sessionYear: (selectedVoucher.date || '').split('-')[0] || String(new Date().getFullYear())
        };
        if (approvalStatus === 'Approved') {
          txnUpdates.approvedBy = updatedVoucher.sigChairmanName || currentUserDoc?.displayName || 'Pengerusi';
          txnUpdates.approvedDate = new Date().toISOString().split('T')[0];
        } else {
          txnUpdates.approvedBy = "";
          txnUpdates.approvedDate = "";
        }
        await updateDoc(doc(db, 'kewanganTransactions', selectedVoucher.txnId), txnUpdates);
      }

      setSelectedVoucher(updatedVoucher);
      setConfirmClearSigRole(null);
    } catch (err) {
      console.error("Gagal memadam tandatangan:", err);
      alert("Gagal memadam tandatangan. Cuba lagi.");
    } finally {
      setClearingSignatureRole(null);
    }
  };

  // PDF Download with premium loading/progress spinner
  const triggerDownloadVoucherPdf = async (v: PaymentVoucher) => {
    try {
      setDownloadingPdfId(v.id);
      await new Promise(resolve => setTimeout(resolve, 850)); // Aesthetic duration to appreciate loading animation
      downloadVoucherPdf(v);
    } catch (err) {
      console.error("Gagal memuat turun PDF:", err);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // PDF Download using jsPDF
  const downloadVoucherPdf = (v: PaymentVoucher) => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // 1. Header Text
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(9);
    pdf.setTextColor(29, 78, 216); // blue-700
    pdf.text('ORGANISASI PENGELUAR', 15, 20);

    // Split name if it contains location
    const assocName = v.associationName || '';
    let mainName = assocName;
    let locationName = 'Batu Kikir, Negeri Sembilan';

    if (assocName.includes('Batu Kikir Negeri Sembilan')) {
      mainName = assocName.replace('Batu Kikir Negeri Sembilan', '').trim();
    } else if (assocName.includes('Batu Kikir, Negeri Sembilan')) {
      mainName = assocName.replace('Batu Kikir, Negeri Sembilan', '').trim();
    }

    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42); // slate-900
    pdf.text(mainName, 15, 27);

    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105); // slate-600
    pdf.text(locationName, 15, 33);

    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text(`No. Pendaftaran: ${v.associationNo || 'N/A'}`, 15, 39);

    // Logo
    if (logoBase64) {
      pdf.addImage(logoBase64, 'PNG', 160, 12, 35, 35);
    } else {
      pdf.setDrawColor(0, 15, 34);
      pdf.setFillColor(0, 15, 34);
      pdf.circle(177.5, 29.5, 12, 'FD');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('Helvetica', 'Bold');
      pdf.setFontSize(12);
      pdf.text('SMAUJ', 177.5, 31, { align: 'center' });
    }

    // Title
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(22);
    pdf.setTextColor(0, 15, 34);
    pdf.text('BAUCAR BAYARAN', 195, 60, { align: 'right' });
    pdf.setFontSize(13);
    pdf.text('PAYMENT VOUCHER', 195, 66, { align: 'right' });

    // Details Grid
    pdf.setDrawColor(226, 232, 240); // slate-200
    pdf.setLineWidth(0.3);
    pdf.line(15, 73, 195, 73);

    // Left block: Payee Info
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(29, 78, 216);
    pdf.text('PENERIMA (PAYEE)', 15, 80);

    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(v.payeeName, 15, 87);

    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Email: ${v.payeeEmail || 'Tiada'}`, 15, 93);

    // Right block: Voucher Meta
    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('No. Baucar / PV No:', 125, 80);
    pdf.setFont('Helvetica', 'Bold');
    pdf.text(v.id, 195, 80, { align: 'right' });

    pdf.setFont('Helvetica', 'Normal');
    pdf.text('Tarikh / Date:', 125, 86);
    pdf.setFont('Helvetica', 'Bold');
    pdf.text(v.date, 195, 86, { align: 'right' });

    pdf.setFont('Helvetica', 'Normal');
    pdf.text('Kategori / Category:', 125, 92);
    pdf.setFont('Helvetica', 'Bold');
    pdf.text(v.category, 195, 92, { align: 'right' });

    const hasBankDetails = !!(v.bankName?.trim() || v.bankAccountName?.trim() || v.bankAccountNumber?.trim());

    if (hasBankDetails) {
      // Bank Details
      pdf.line(15, 98, 195, 98);
      pdf.setFont('Helvetica', 'Bold');
      pdf.setFontSize(9);
      pdf.setTextColor(29, 78, 216);
      pdf.text('MAKLUMAT BANK PENERIMA', 15, 104);

      pdf.setFont('Helvetica', 'Normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Nama Bank: ${v.bankName || ''}`, 15, 109);
      pdf.text(`No. Akaun: ${v.bankAccountNumber || ''}`, 110, 109);
      pdf.text(`Nama Akaun: ${v.bankAccountName || ''}`, 15, 114);
    }

    const hasItems = v.items && v.items.length > 0;
    const tableStartY = hasBankDetails ? 118 : 98;
    let currentY = tableStartY + 12;

    if (hasItems) {
      // Table Header of Payment Details
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.rect(15, tableStartY, 180, 8, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(15, tableStartY, 180, 8, 'D');

      pdf.setFont('Helvetica', 'Bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text('BIL', 18, tableStartY + 5);
      pdf.text('BUTIRAN PEMBAYARAN (DESCRIPTION OF PAYMENT)', 32, tableStartY + 5);
      pdf.text('JUMLAH (RM)', 192, tableStartY + 5, { align: 'right' });

      // Rows
      v.items!.forEach((item, index) => {
        pdf.setFont('Helvetica', 'Normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(51, 65, 85);

        const splitItemDesc = pdf.splitTextToSize(item.description, 120);
        const textHeight = splitItemDesc.length * 5;

        pdf.text(String(index + 1), 18, currentY);
        pdf.text(splitItemDesc, 32, currentY);

        pdf.setFont('Helvetica', 'Bold');
        pdf.setFontSize(10);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`RM ${item.amount.toFixed(2)}`, 192, currentY, { align: 'right' });

        currentY += Math.max(8, textHeight + 2);
      });
    } else {
      // Legacy / Single-item rendering
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.rect(15, tableStartY, 180, 8, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(15, tableStartY, 180, 8, 'D');

      pdf.setFont('Helvetica', 'Bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text('BUTIRAN PEMBAYARAN (DESCRIPTION OF PAYMENT)', 18, tableStartY + 5);
      pdf.text('JUMLAH (AMOUNT)', 192, tableStartY + 5, { align: 'right' });

      // Description text
      pdf.setFont('Helvetica', 'Normal');
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      const splitDesc = pdf.splitTextToSize(v.description, 130);
      pdf.text(splitDesc, 18, tableStartY + 16);

      // Amount text
      pdf.setFont('Helvetica', 'Bold');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`RM ${v.amount.toFixed(2)}`, 192, tableStartY + 16, { align: 'right' });

      currentY = tableStartY + 32;
    }

    // Table line at the bottom of rows
    pdf.line(15, currentY, 195, currentY);

    // Total box & Ledgers placement
    const totalBoxY = currentY + 5;
    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.rect(125, totalBoxY, 70, 12, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(125, totalBoxY, 70, 12, 'D');
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text('JUMLAH BESAR / TOTAL:', 128, totalBoxY + 8);
    pdf.setFontSize(11);
    pdf.text(`RM ${v.amount.toFixed(2)}`, 192, totalBoxY + 8, { align: 'right' });

    // Ledgers debited/credited
    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Akaun Debit: ${v.accountDebit || 'N/A'}`, 15, totalBoxY + 3);
    pdf.text(`Akaun Kredit: ${v.accountCredit || 'N/A'}`, 15, totalBoxY + 8);

    // Catatan block
    let finalSectionY = totalBoxY + 16;
    if (v.catatan) {
      pdf.setFont('Helvetica', 'Bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('CATATAN / REMARKS:', 15, finalSectionY);
      
      pdf.setFont('Helvetica', 'Normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      const splitCatatan = pdf.splitTextToSize(v.catatan, 180);
      pdf.text(splitCatatan, 15, finalSectionY + 4.5);
      
      finalSectionY += 6 + (splitCatatan.length * 4.5);
    }

    // Signatures block
    const sigY = finalSectionY + 10;
    pdf.setDrawColor(203, 213, 225); // slate-300
    
    // Column 1: Bendahari
    pdf.line(15, sigY + 22, 65, sigY + 22);
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Disediakan Oleh', 15, sigY + 27);
    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(8);
    pdf.text('(Bendahari / Treasurer)', 15, sigY + 31);
    if (v.sigTreasurer) {
      pdf.addImage(v.sigTreasurer, 'PNG', 20, sigY - 2, 25, 20);
      pdf.setFontSize(7.5);
      pdf.text(`Nama: ${v.sigTreasurerName || ''}`, 15, sigY + 36);
      pdf.text(`Tarikh: ${v.sigTreasurerAt || ''}`, 15, sigY + 40);
    }

    // Column 2: Pengerusi
    pdf.line(80, sigY + 22, 130, sigY + 22);
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(9);
    pdf.text('Disahkan Oleh', 80, sigY + 27);
    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(8);
    pdf.text('(Pengerusi / Chairman)', 80, sigY + 31);
    if (v.sigChairman) {
      pdf.addImage(v.sigChairman, 'PNG', 85, sigY - 2, 25, 20);
      pdf.setFontSize(7.5);
      pdf.text(`Nama: ${v.sigChairmanName || ''}`, 80, sigY + 36);
      pdf.text(`Tarikh: ${v.sigChairmanAt || ''}`, 80, sigY + 40);
    }

    // Column 3: Receiver
    pdf.line(145, sigY + 22, 195, sigY + 22);
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(9);
    pdf.text('Diterima Oleh', 145, sigY + 27);
    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(8);
    pdf.text('(Penerima / Recipient)', 145, sigY + 31);
    if (v.sigReceiver) {
      pdf.addImage(v.sigReceiver, 'PNG', 150, sigY - 2, 25, 20);
      pdf.setFontSize(7.5);
      pdf.text(`Nama: ${v.sigReceiverName || ''}`, 145, sigY + 36);
      pdf.text(`Tarikh: ${v.sigReceiverAt || ''}`, 145, sigY + 40);
    }

    // Save PDF
    pdf.save(`Payment_Voucher_${v.id}.pdf`);
  };

  const isAnyItemAmountFilled = formItems.some(item => item.amount.trim() !== '');

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isMobile ? 'pb-24' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-all shrink-0 bg-slate-50 border border-slate-100"
            id="baucar-back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-xl font-black text-slate-950 tracking-tight flex items-center gap-2 flex-wrap">
              <FileCheck className="text-indigo-600 shrink-0" size={24} />
              <span>Baucar Bayaran</span>
            </h1>
            <p className="text-[10px] md:text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
              Modul Payment Voucher & digital signing untuk pengurusan kewangan
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
            id="baucar-create-btn"
          >
            <Plus size={16} />
            Buat Baucar
          </button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Cari No Baucar, Penerima, atau Butiran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {/* Category filter */}
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-100 rounded-2xl pl-3 pr-8 py-2.5 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Semua">Semua Kategori</option>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <ChevronDown size={14} />
              </div>
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-100 rounded-2xl pl-3 pr-8 py-2.5 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Semua">Semua Status</option>
                <option value="Lengkap">Tandatangan Lengkap</option>
                <option value="Belum Selesai">Belum Selesai</option>
                <option value="Belum Ditandatangan Bendahari">Belum Sign Bendahari</option>
                <option value="Belum Ditandatangan Pengerusi">Belum Sign Pengerusi</option>
                <option value="Belum Ditandatangan Penerima">Belum Sign Penerima</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Grid/List */}
      {isLoading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="text-xs font-bold text-slate-500">Memuatkan sejarah baucar bayaran...</p>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="text-slate-300" size={48} />
          <p className="text-xs font-bold text-slate-500">Tiada rekod baucar bayaran ditemui.</p>
          {canManage && (
            <button
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-100 transition-colors"
            >
              Mula Cipta Baucar
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredVouchers.map((v) => {
              const isFullySigned = !!v.sigTreasurer && !!v.sigChairman && !!v.sigReceiver;
              const pendingSignaturesCount = 
                (v.sigTreasurer ? 0 : 1) + 
                (v.sigChairman ? 0 : 1) + 
                (v.sigReceiver ? 0 : 1);

              return (
                <motion.div
                  key={v.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => {
                    setSelectedVoucher(v);
                    setShowDetailModal(true);
                  }}
                  className="bg-white rounded-3xl p-5 border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between h-56"
                  id={`voucher-card-${v.id}`}
                >
                  <div>
                    {/* Badge & PV Number */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-mono font-extrabold text-slate-400 block leading-none mb-1">
                          {v.date}
                        </span>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight">
                          {v.id}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold ${
                        isFullySigned 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {isFullySigned ? 'Lengkap' : `${pendingSignaturesCount} Belum Sign`}
                      </span>
                    </div>

                    {/* Payee Details */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1">
                        <User size={12} className="text-slate-400 shrink-0" />
                        <span className="text-xs font-black text-slate-800 line-clamp-1">
                          {v.payeeName}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 line-clamp-2 leading-relaxed">
                        {v.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-3 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block leading-none">
                        Jumlah (Amount)
                      </span>
                      <span className="text-sm font-black text-slate-950">
                        RM {v.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => triggerDownloadVoucherPdf(v)}
                        disabled={downloadingPdfId === v.id}
                        title="Muat Turun PDF"
                        className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        {downloadingPdfId === v.id ? (
                          <Loader2 size={14} className="animate-spin text-slate-600" />
                        ) : (
                          <Printer size={14} />
                        )}
                      </button>

                      {canManage && (
                        <>
                          <button
                            onClick={(e) => handleOpenEditModal(v, e)}
                            title="Edit"
                            className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:text-white hover:bg-indigo-600 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteVoucher(v, e)}
                            disabled={deletingVoucherId === v.id}
                            title="Delete"
                            className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:text-white hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            {deletingVoucherId === v.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Voucher Modal */}
      <AnimatePresence>
        {showAddEditModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    {isEditMode ? 'Kemaskini Baucar Bayaran' : 'Cipta Baucar Bayaran Baru'}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500">
                    Sila lengkapkan butiran baucar bayaran di bawah.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddEditModal(false);
                    setSelectedVoucher(null);
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  X
                </button>
              </div>

              {/* Modal Form Scroll Area */}
              <form onSubmit={handleSaveVoucher} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Section: Organisasi Persatuan */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <h3 className="text-xs font-black text-indigo-700 tracking-tight uppercase flex items-center gap-1.5">
                    <Building2 size={14} />
                    Butiran Organisasi Persatuan
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">NAMA PERSATUAN</label>
                      <input
                        type="text"
                        value={formAssociationName}
                        onChange={(e) => setFormAssociationName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">NO. PERSATUAN</label>
                      <input
                        type="text"
                        value={formAssociationNo}
                        onChange={(e) => setFormAssociationNo(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Penerima (Dropdown & Bank Details) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-black text-emerald-700 tracking-tight uppercase flex items-center gap-1.5">
                    <User size={14} />
                    Butiran Penerima Bayaran (Payee)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-black text-slate-600">NAMA PENERIMA</label>
                        <label className="inline-flex items-center gap-1 cursor-pointer text-[9px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                          <input
                            type="checkbox"
                            checked={isManualPayee}
                            onChange={(e) => {
                              setIsManualPayee(e.target.checked);
                              setFormPayeeName('');
                              setFormPayeeEmail('');
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          Input Manual (Bukan Ahli)
                        </label>
                      </div>
                      
                      {isManualPayee ? (
                        <input
                          type="text"
                          value={formPayeeName}
                          onChange={(e) => setFormPayeeName(e.target.value)}
                          placeholder="Masukkan nama penerima manual"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      ) : (
                        <div className="relative">
                          <select
                            value={formPayeeName}
                            onChange={(e) => setFormPayeeName(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                            required
                          >
                            <option value="">-- Sila Pilih Ahli --</option>
                            {allUsers && allUsers
                              .filter(u => u.role !== 'Pelawat' && (u.displayName || u.nickname))
                              .map(u => {
                                const name = u.displayName || u.nickname || '';
                                return (
                                  <option key={u.uid} value={name}>
                                    {name} ({u.role})
                                  </option>
                                );
                              })
                            }
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">EMAIL PENERIMA</label>
                      {isManualPayee ? (
                        <input
                          type="email"
                          value={formPayeeEmail}
                          onChange={(e) => setFormPayeeEmail(e.target.value)}
                          placeholder="Masukkan email penerima"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      ) : (
                        <input
                          type="email"
                          value={formPayeeEmail}
                          readOnly
                          placeholder="Auto keluar setelah pilih ahli"
                          className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-hidden cursor-not-allowed"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">NAMA BANK PENERIMA</label>
                      <input
                        type="text"
                        value={formBankName}
                        onChange={(e) => setFormBankName(e.target.value)}
                        placeholder="Contoh: Maybank, CIMB, BSN"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">NAMA AKAUN BANK PENERIMA</label>
                      <input
                        type="text"
                        value={formBankAccountName}
                        onChange={(e) => setFormBankAccountName(e.target.value)}
                        placeholder="Nama pemilik akaun bank"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">NO. AKAUN BANK PENERIMA</label>
                      <input
                        type="text"
                        value={formBankAccountNumber}
                        onChange={(e) => setFormBankAccountNumber(e.target.value)}
                        placeholder="Nombor akaun bank"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Maklumat Kewangan Form (Similar to Kewangan Tambah Transaksi) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-black text-blue-700 tracking-tight uppercase flex items-center gap-1.5">
                    <CreditCard size={14} />
                    Butiran Kewangan & Transaksi
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">NO. BAUCAR / PV NO</label>
                      <input
                        type="text"
                        value={formPvNo}
                        onChange={(e) => setFormPvNo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-800 cursor-not-allowed"
                        readOnly
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">TARIKH</label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">WASA (TIME)</label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">JUMLAH (RM)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        disabled={isAnyItemAmountFilled}
                        placeholder={isAnyItemAmountFilled ? "Diisi auto" : "e.g. 150.00"}
                        className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-all ${
                          isAnyItemAmountFilled ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-dashed' : ''
                        }`}
                        required
                      />
                      {(formDebitAccount === 'Khairat Kematian' || formCategory === 'Khairat Kematian') && formPayeeEmail && (
                        <p className="mt-1 text-[10px] font-semibold text-indigo-600">
                          Baki Terkumpul: RM {khairatBalance.toFixed(2)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">KATEGORI</label>
                      <div className="relative">
                        <select
                          value={formCategory}
                          onChange={(e) => {
                            setFormCategory(e.target.value);
                            setFormDebitAccount(e.target.value); // Sync by default
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 appearance-none cursor-pointer"
                        >
                          {categoriesList.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">AKAUN KREDIT (SUMBER)</label>
                      <div className="relative">
                        <select
                          value={formCreditAccount}
                          onChange={(e) => setFormCreditAccount(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 appearance-none cursor-pointer"
                        >
                          <option value="Bank">Bank (Akaun Persatuan)</option>
                          <option value="Tunai">Tunai (Petty Cash)</option>
                          <option value="Qurban Aqiqah">Qurban Aqiqah</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">AKAUN DEBIT (BELANJA)</label>
                      <div className="relative">
                        <select
                          value={formDebitAccount}
                          onChange={(e) => setFormDebitAccount(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 appearance-none cursor-pointer"
                        >
                          {accountsList.map(acc => (
                            <option key={acc} value={acc}>{acc}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-600 mb-1">BUTIRAN PEMBAYARAN</label>
                      <input
                        type="text"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        disabled={isAnyItemAmountFilled}
                        placeholder={isAnyItemAmountFilled ? "Diselaraskan dari butiran" : "e.g. Pembelian baja, upah potong rumput dsb."}
                        className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-all ${
                          isAnyItemAmountFilled ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-dashed' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>

                  {/* Section: Butiran Pembayaran Itemized */}
                  <div className="bg-slate-50/55 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black text-indigo-800 tracking-wider uppercase">
                        Butiran Pembayaran Bil / Itemized Details
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormItems([...formItems, { description: '', amount: '' }])}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus size={12} />
                        Tambah Baris
                      </button>
                    </div>

                    <div className="space-y-2">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-2 text-[9px] font-black text-slate-400 uppercase tracking-wider px-1">
                        <span className="col-span-1 text-center">Bil</span>
                        <span className="col-span-7">Butiran Pembayaran</span>
                        <span className="col-span-3">Jumlah (RM)</span>
                        <span className="col-span-1 text-center">Padam</span>
                      </div>

                      {formItems.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          {/* Bil */}
                          <div className="col-span-1 text-center text-xs font-bold text-slate-400 font-mono">
                            {index + 1}
                          </div>

                          {/* Butiran Pembayaran */}
                          <div className="col-span-7">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[index].description = e.target.value;
                                setFormItems(newItems);
                              }}
                              placeholder={`Butiran item #${index + 1}`}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white shadow-xs focus:border-indigo-200"
                              required
                            />
                          </div>

                          {/* Jumlah */}
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[index].amount = e.target.value;
                                setFormItems(newItems);
                              }}
                              placeholder="0.00"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white shadow-xs focus:border-indigo-200 font-mono"
                            />
                          </div>

                          {/* Padam */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              disabled={formItems.length === 1}
                              onClick={() => {
                                if (formItems.length > 1) {
                                  const newItems = formItems.filter((_, i) => i !== index);
                                  setFormItems(newItems);
                                }
                              }}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                              title="Padam baris ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section: Catatan */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    Catatan / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="Sila masukkan catatan tambahan jika ada..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white shadow-xs focus:border-indigo-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddEditModal(false);
                      setSelectedVoucher(null);
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 hover:bg-indigo-700 cursor-pointer"
                  >
                    {isSaving && <Loader2 size={14} className="animate-spin" />}
                    Simpan Baucar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail View Modal */}
      <AnimatePresence>
        {showDetailModal && selectedVoucher && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <FileText className="text-indigo-600" size={20} />
                    Dokumen Baucar Bayaran ({selectedVoucher.id})
                  </h2>
                  <p className="text-[10px] font-bold text-slate-500">
                    Sila semak, urus tandatangan digital atau cetak PDF bagi baucar ini.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerDownloadVoucherPdf(selectedVoucher)}
                    disabled={downloadingPdfId === selectedVoucher.id}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {downloadingPdfId === selectedVoucher.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Printer size={15} />
                    )}
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedVoucher(null);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    X
                  </button>
                </div>
              </div>

              {/* Scrollable Document Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Physical-style Voucher Sheet */}
                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 space-y-6">
                  {/* Header Row */}
                  <div className="flex justify-between items-start">
                    <div>
                      {(() => {
                        const assocName = selectedVoucher.associationName || '';
                        let mainName = assocName;
                        let locationName = 'Batu Kikir, Negeri Sembilan';

                        if (assocName.includes('Batu Kikir Negeri Sembilan')) {
                          mainName = assocName.replace('Batu Kikir Negeri Sembilan', '').trim();
                        } else if (assocName.includes('Batu Kikir, Negeri Sembilan')) {
                          mainName = assocName.replace('Batu Kikir, Negeri Sembilan', '').trim();
                        }

                        return (
                          <>
                            <h3 className="text-md font-black text-slate-950 tracking-tight leading-snug">
                              {mainName}
                            </h3>
                            <p className="text-[10px] font-bold text-indigo-600 mt-0.5">
                              {locationName}
                            </p>
                          </>
                        );
                      })()}
                      <p className="text-[10px] font-bold text-slate-500 mt-1">
                        No. Persatuan: {selectedVoucher.associationNo}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[10px] font-extrabold inline-block mb-2">
                        {selectedVoucher.id}
                      </span>
                      <p className="text-[10px] font-bold text-slate-500 block">
                        Tarikh: {selectedVoucher.date}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 block">
                        Masa: {selectedVoucher.time || '12:00'}
                      </p>
                    </div>
                  </div>

                  {/* Financial Meta Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-b border-slate-200/60 py-4">
                    <div>
                      <span className="text-[9px] font-black text-indigo-600 block mb-1 uppercase tracking-wider">Penerima Bayaran</span>
                      <p className="text-xs font-black text-slate-800">{selectedVoucher.payeeName}</p>
                      <p className="text-[10px] font-bold text-slate-500">{selectedVoucher.payeeEmail}</p>
                    </div>

                     <div>
                       <span className="text-[9px] font-black text-indigo-600 block mb-1 uppercase tracking-wider">Maklumat Bank</span>
                       {selectedVoucher.bankName || selectedVoucher.bankAccountName || selectedVoucher.bankAccountNumber ? (
                         <>
                           {selectedVoucher.bankName && (
                             <p className="text-xs font-bold text-slate-800">
                               <span className="text-slate-400">Bank:</span> {selectedVoucher.bankName}
                             </p>
                           )}
                           {selectedVoucher.bankAccountName && (
                             <p className="text-xs font-bold text-slate-800">
                               <span className="text-slate-400">Nama Akaun:</span> {selectedVoucher.bankAccountName}
                             </p>
                           )}
                           {selectedVoucher.bankAccountNumber && (
                             <p className="text-xs font-bold text-slate-800">
                               <span className="text-slate-400">No. Akaun:</span> {selectedVoucher.bankAccountNumber}
                             </p>
                           )}
                         </>
                       ) : (
                         <p className="text-xs font-medium text-slate-400 italic">Tiada maklumat bank disediakan</p>
                       )}
                     </div>
                  </div>

                  {/* Payment Details Table */}
                  <div className="space-y-2">
                    {selectedVoucher.items && selectedVoucher.items.length > 0 ? (
                      <>
                        <div className="grid grid-cols-12 bg-slate-100 border border-slate-200/80 p-2.5 rounded-xl text-[10px] font-black text-slate-700">
                          <span className="col-span-1 text-center">BIL</span>
                          <span className="col-span-8">BUTIRAN PEMBAYARAN</span>
                          <span className="col-span-3 text-right">JUMLAH</span>
                        </div>
                        {selectedVoucher.items.map((item, index) => (
                          <div key={index} className="grid grid-cols-12 p-3 bg-white border border-slate-200/50 rounded-xl text-xs font-bold text-slate-800 items-center">
                            <span className="col-span-1 text-center text-slate-500 font-mono font-bold">{index + 1}</span>
                            <span className="col-span-8 pr-4 leading-relaxed">{item.description}</span>
                            <span className="col-span-3 text-right text-sm font-black text-slate-950">
                              RM {item.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-12 bg-slate-100 border border-slate-200/80 p-2.5 rounded-xl text-[10px] font-black text-slate-700">
                          <span className="col-span-8">BUTIRAN PEMBAYARAN</span>
                          <span className="col-span-4 text-right">JUMLAH</span>
                        </div>
                        <div className="grid grid-cols-12 p-3 bg-white border border-slate-200/50 rounded-xl text-xs font-bold text-slate-800 min-h-[60px] items-center">
                          <span className="col-span-8 pr-4 leading-relaxed">{selectedVoucher.description}</span>
                          <span className="col-span-4 text-right text-sm font-black text-slate-950">
                            RM {selectedVoucher.amount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Total Summary Row */}
                    <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100/60 p-3 rounded-xl">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-indigo-500 block">Akaun Debit: {selectedVoucher.accountDebit}</span>
                        <span className="text-[9px] font-bold text-slate-400 block">Akaun Kredit: {selectedVoucher.accountCredit}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-indigo-700 block uppercase leading-none mb-1">JUMLAH BESAR</span>
                        <span className="text-base font-black text-slate-950">RM {selectedVoucher.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Catatan / Remarks */}
                  {selectedVoucher.catatan && (
                    <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-xl text-left space-y-1">
                      <span className="text-[9px] font-black text-slate-500 tracking-wider uppercase block">CATATAN / REMARKS</span>
                      <p className="text-xs font-semibold text-slate-700 whitespace-pre-line leading-relaxed">{selectedVoucher.catatan}</p>
                    </div>
                  )}

                  {/* Signatures Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200/60">
                    
                    {/* Treasurer Signature */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between min-h-[140px] text-center relative group">
                      <span className="text-[9px] font-black text-slate-400 block uppercase">Disediakan Oleh</span>
                      
                      <div className="my-2 flex items-center justify-center min-h-[60px]">
                        {selectedVoucher.sigTreasurer ? (
                          <div className="relative inline-block">
                            <img src={selectedVoucher.sigTreasurer} alt="Bendahari Sign" className="max-h-[60px] max-w-[120px] object-contain mx-auto" />
                            {canManage && (
                              <button
                                onClick={() => initiateClearSignature('Treasurer')}
                                disabled={clearingSignatureRole === 'Treasurer'}
                                className={`absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-1 hover:bg-rose-600 cursor-pointer transition-opacity ${clearingSignatureRole === 'Treasurer' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                title="Padam Tandatangan"
                              >
                                {clearingSignatureRole === 'Treasurer' ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Trash2 size={10} />
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          (isBendahari || isAdminUtama) ? (
                            <button
                              onClick={() => handleOpenSignModal('Treasurer')}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <PenTool size={12} />
                              Tandatangan
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-300 italic font-bold">Belum ditandatangan</span>
                          )
                        )}
                      </div>

                      <div className="border-t border-slate-50 pt-1">
                        <span className="text-[10px] font-black text-slate-700 block truncate">
                          {selectedVoucher.sigTreasurerName || 'Bendahari'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 block">
                          {selectedVoucher.sigTreasurerAt || '(Bendahari)'}
                        </span>
                      </div>
                    </div>

                    {/* Chairman Signature */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between min-h-[140px] text-center relative group">
                      <span className="text-[9px] font-black text-slate-400 block uppercase">Disahkan Oleh</span>
                      
                      <div className="my-2 flex items-center justify-center min-h-[60px]">
                        {selectedVoucher.sigChairman ? (
                          <div className="relative inline-block">
                            <img src={selectedVoucher.sigChairman} alt="Pengerusi Sign" className="max-h-[60px] max-w-[120px] object-contain mx-auto" />
                            {(isPengerusi || isAdminUtama) && (
                              <button
                                onClick={() => initiateClearSignature('Chairman')}
                                disabled={clearingSignatureRole === 'Chairman'}
                                className={`absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-1 hover:bg-rose-600 cursor-pointer transition-opacity ${clearingSignatureRole === 'Chairman' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                title="Padam Tandatangan"
                              >
                                {clearingSignatureRole === 'Chairman' ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Trash2 size={10} />
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          (isPengerusi || isAdminUtama) ? (
                            <button
                              onClick={() => handleOpenSignModal('Chairman')}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <PenTool size={12} />
                              Tandatangan
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-300 italic font-bold">Belum ditandatangan</span>
                          )
                        )}
                      </div>

                      <div className="border-t border-slate-50 pt-1">
                        <span className="text-[10px] font-black text-slate-700 block truncate">
                          {selectedVoucher.sigChairmanName || 'Pengerusi'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 block">
                          {selectedVoucher.sigChairmanAt || '(Pengerusi)'}
                        </span>
                      </div>
                    </div>

                    {/* Receiver Signature */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between min-h-[140px] text-center relative group">
                      <span className="text-[9px] font-black text-slate-400 block uppercase">Diterima Oleh</span>
                      
                      <div className="my-2 flex items-center justify-center min-h-[60px]">
                        {selectedVoucher.sigReceiver ? (
                          <div className="relative inline-block">
                            <img src={selectedVoucher.sigReceiver} alt="Penerima Sign" className="max-h-[60px] max-w-[120px] object-contain mx-auto" />
                            {((selectedVoucher.payeeEmail && selectedVoucher.payeeEmail.toLowerCase() === userEmail.toLowerCase()) || isAdminUtama) && (
                              <button
                                onClick={() => initiateClearSignature('Receiver')}
                                disabled={clearingSignatureRole === 'Receiver'}
                                className={`absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-1 hover:bg-rose-600 cursor-pointer transition-opacity ${clearingSignatureRole === 'Receiver' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                title="Padam Tandatangan"
                              >
                                {clearingSignatureRole === 'Receiver' ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Trash2 size={10} />
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          ((selectedVoucher.payeeEmail && selectedVoucher.payeeEmail.toLowerCase() === userEmail.toLowerCase()) || isAdminUtama) ? (
                            <button
                              onClick={() => handleOpenSignModal('Receiver')}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <PenTool size={12} />
                              Tandatangan
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-300 italic font-bold">Belum ditandatangan</span>
                          )
                        )}
                      </div>

                      <div className="border-t border-slate-50 pt-1">
                        <span className="text-[10px] font-black text-slate-700 block truncate">
                          {selectedVoucher.sigReceiverName || selectedVoucher.payeeName}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 block">
                          {selectedVoucher.sigReceiverAt || '(Penerima)'}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Signature Pad Modal */}
      <AnimatePresence>
        {showSignModal && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-51">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              {/* Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <PenTool className="text-indigo-600" size={16} />
                    Lakar Tandatangan Digital
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                    Tandatangan untuk peranan:{' '}
                    <span className="text-indigo-600 font-extrabold">
                      {signingRole === 'Treasurer' ? 'Bendahari' : signingRole === 'Chairman' ? 'Pengerusi' : 'Penerima'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setShowSignModal(false)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer font-bold text-sm"
                >
                  X
                </button>
              </div>

              {/* Drawing Area */}
              <div className="p-4 space-y-3 flex-1">
                <div className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden relative shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={180}
                    className="w-full bg-white cursor-crosshair touch-none block"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                  <span>Gunakan tetikus atau skrin sentuh anda.</span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-rose-500 hover:underline cursor-pointer font-black"
                  >
                    Padam Lakaran
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSignModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveSignature}
                  disabled={isSavingSignature}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingSignature && <Loader2 size={13} className="animate-spin" />}
                  Simpan & Sahkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal for Deleting Voucher */}
      <AnimatePresence>
        {confirmDeleteVoucher && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-100 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Padam Baucar Bayaran?
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Adakah anda pasti mahu memadam baucar ini? Tindakan ini tidak boleh diundur dan juga akan memadam rekod berkaitan di lejar kewangan.
                  </p>
                </div>
              </div>

              {/* Voucher Detail Summary Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5 text-xs text-slate-700 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">No. Baucar:</span>
                  <span className="font-black text-slate-900">{confirmDeleteVoucher.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Penerima/Syarikat:</span>
                  <span className="font-black text-slate-900">{confirmDeleteVoucher.payeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Jumlah Bayaran:</span>
                  <span className="font-black text-indigo-600">RM {(parseFloat(confirmDeleteVoucher.amount) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Kategori:</span>
                  <span className="font-bold text-slate-800">{confirmDeleteVoucher.category}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 justify-center">
                <button
                  type="button"
                  disabled={deletingVoucherId === confirmDeleteVoucher.id}
                  onClick={() => setConfirmDeleteVoucher(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition w-1/2 cursor-pointer disabled:opacity-50 text-center"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deletingVoucherId === confirmDeleteVoucher.id}
                  onClick={handleConfirmDeleteVoucher}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-sm transition w-1/2 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-center"
                >
                  {deletingVoucherId === confirmDeleteVoucher.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Padam
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Signature Modal */}
      <ConfirmDeleteModal
        isOpen={!!confirmClearSigRole}
        title="Padam Tandatangan"
        message="Adakah anda pasti mahu memadam tandatangan ini?"
        isLoading={!!clearingSignatureRole}
        onConfirm={clearVoucherSignature}
        onClose={() => setConfirmClearSigRole(null)}
      />
    </div>
  );
};
