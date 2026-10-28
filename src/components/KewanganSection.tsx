import React, { useState, useMemo, useEffect } from 'react';
import { 
  Landmark, FileText, CreditCard, Megaphone, Calendar as CalendarIcon, 
  MessageSquare, BookOpen, Users, Folder, MoreHorizontal, 
  ArrowUpRight, ArrowDownRight, Search, Filter, Plus, Edit, Trash2, 
  Copy, Printer as PrinterIcon, Download, CheckCircle2, 
  AlertTriangle, Check, X, Eye, Send, FileSpreadsheet, ShieldCheck, 
  ChevronDown, ChevronRight, Layers, ArrowRight, RefreshCw, Upload, EyeOff, ArrowRightLeft, Clock,
  BarChart3, TrendingUp, PieChart as PieChartIcon, Sliders, ArrowLeft, ExternalLink, Sparkles, Cpu
} from 'lucide-react';
import { DEFAULT_YURAN_CONFIG, YuranConfig, monthNamesMs, generate12Months, getCategoryBadgeStyle, detectActiveSessionYear } from '../utils/yuranConfigHelper';
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
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { db, storage } from '../lib/firebase';
import { cleanUndefined } from '../utils/firestoreUtils';
import { sendTelegramPaymentNotification } from '../utils/telegramHelper';
import { doc, setDoc, deleteDoc, collection, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { generateReceiptPdf } from '../utils/receiptPdf';
import { generateFinancialBookHtml } from '../utils/generateFinancialBookHtml';

export interface KewanganTransaction {
  id: string;
  voucherNo: string;
  date: string;
  time: string;
  accountDebit: string;
  accountCredit: string;
  amount: number;
  description: string;
  category: string;
  recordedBy: string;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  approvedDate?: string;
  approvedBy?: string;
  receiptAttachment?: string;
  invoiceAttachment?: string;
  notes?: string;
  memberEmail?: string;
  paidPackageIds?: string[];
  sessionYear?: string;
  qurbanSession?: string;
  aiVerified?: boolean;
  aiDetectedAmount?: number | null;
  aiConfidence?: 'Passed' | 'Failed' | 'Uncertain';
  aiNotes?: string;
  auditTrail: {
    time: string;
    user: string;
    action: string;
  }[];
}

interface KewanganSectionProps {
  isMobile?: boolean;
  transactions?: KewanganTransaction[];
}

// Pre-seeded initial realistic Malaysian Resident Association transactions
export const INITIAL_TRANSACTIONS: KewanganTransaction[] = [
  {
    id: "TXN-2026-0001",
    voucherNo: "VCH-2026-0001",
    date: "2026-06-02",
    time: "10:15",
    accountDebit: "Bank",
    accountCredit: "Yuran Bulanan",
    amount: 1500.00,
    description: "Bayaran yuran bulanan Jun oleh 30 penduduk Fasa 2",
    category: "Yuran Bulanan",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-02",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "resit_kolektif_0602.pdf",
    notes: "Kelulusan diperoleh dalam Mesyuarat Jawatankuasa Bil. 3/2026",
    auditTrail: [
      { time: "2026-06-02 10:15", user: "Ahmad (Bendahari)", action: "Merekod transaksi baru" },
      { time: "2026-06-02 12:00", user: "En. Kamal (Pengerusi)", action: "Meluluskan transaksi" }
    ]
  },
  {
    id: "TXN-2026-0001b",
    voucherNo: "VCH-2026-0001b",
    date: "2026-06-03",
    time: "09:30",
    accountDebit: "Bank",
    accountCredit: "Yuran Keahlian",
    amount: 750.00,
    description: "Bayaran yuran pendaftaran keahlian baru (15 penduduk baru)",
    category: "Yuran Keahlian",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-03",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "resit_keahlian_0603.pdf",
    notes: "Pendaftaran ahli baru sempena hari terbuka komuniti",
    auditTrail: [
      { time: "2026-06-03 09:30", user: "Ahmad (Bendahari)", action: "Merekod transaksi baru" },
      { time: "2026-06-03 11:00", user: "En. Kamal (Pengerusi)", action: "Meluluskan transaksi" }
    ]
  },
  {
    id: "TXN-2026-0002",
    voucherNo: "VCH-2026-0002",
    date: "2026-06-05",
    time: "11:30",
    accountDebit: "Bank",
    accountCredit: "Sumbangan",
    amount: 1500.00,
    description: "Sumbangan kebajikan daripada Ahli Majlis MBSA",
    category: "Sumbangan",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-06",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "resit_mbsa_109.pdf",
    notes: "Sumbangan diterima untuk kegunaan program kebersihan komuniti",
    auditTrail: [
      { time: "2026-06-05 11:30", user: "Ahmad (Bendahari)", action: "Merekod transaksi baru" },
      { time: "2026-06-06 09:00", user: "En. Kamal (Pengerusi)", action: "Meluluskan transaksi" }
    ]
  },
  {
    id: "TXN-2026-0003",
    voucherNo: "VCH-2026-0003",
    date: "2026-06-10",
    time: "15:45",
    accountDebit: "Pembersihan",
    accountCredit: "Bank",
    amount: 600.00,
    description: "Bayaran bulanan kontraktor pembersihan sisa taman Fasa 2",
    category: "Pembersihan",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-10",
    approvedBy: "Pengerusi (En. Kamal)",
    invoiceAttachment: "invois_bersih_77.pdf",
    notes: "Kontrak pembersihan bagi bulan Jun 2026",
    auditTrail: [
      { time: "2026-06-10 15:45", user: "Ahmad (Bendahari)", action: "Merekod transaksi" },
      { time: "2026-06-10 16:30", user: "En. Kamal (Pengerusi)", action: "Meluluskan bayaran" }
    ]
  },
  {
    id: "TXN-2026-0004",
    voucherNo: "VCH-2026-0004",
    date: "2026-06-12",
    time: "09:00",
    accountDebit: "Program Komuniti",
    accountCredit: "Tunai",
    amount: 250.00,
    description: "Pembelian bungkusan makanan & plastik sampah gotong-royong",
    category: "Program Komuniti",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-12",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "resit_pasar_raya_992.pdf",
    notes: "Perolehan barang gotong-royong Fasa 2",
    auditTrail: [
      { time: "2026-06-12 09:00", user: "Ahmad (Bendahari)", action: "Merekod transaksi tunai runcit" },
      { time: "2026-06-12 09:15", user: "En. Kamal (Pengerusi)", action: "Meluluskan transaksi" }
    ]
  },
  {
    id: "TXN-2026-0005",
    voucherNo: "VCH-2026-0005",
    date: "2026-06-14",
    time: "16:20",
    accountDebit: "Keselamatan",
    accountCredit: "Bank",
    amount: 800.00,
    description: "Bayaran perkhidmatan pengawal keselamatan luaran Jun",
    category: "Keselamatan",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-15",
    approvedBy: "Pengerusi (En. Kamal)",
    invoiceAttachment: "invois_security_334.pdf",
    notes: "Kelulusan diperoleh dalam Mesyuarat Jawatankuasa Bil. 3/2026",
    auditTrail: [
      { time: "2026-06-14 16:20", user: "Ahmad (Bendahari)", action: "Merekod tuntutan perkhidmatan" },
      { time: "2026-06-15 10:00", user: "En. Kamal (Pengerusi)", action: "Meluluskan invois pengawal" }
    ]
  },
  {
    id: "TXN-2026-0006",
    voucherNo: "VCH-2026-0006",
    date: "2026-06-18",
    time: "10:30",
    accountDebit: "Bank",
    accountCredit: "Sewaan Dewan",
    amount: 300.00,
    description: "Sewaan dewan komuniti untuk majlis kenduri kesyukuran penduduk",
    category: "Sewaan Dewan",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-18",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "resit_sewaan_004.pdf",
    notes: "Bayaran sewaan dewan untuk program komuniti",
    auditTrail: [
      { time: "2026-06-18 10:30", user: "Ahmad (Bendahari)", action: "Merekod sewaan dewan" }
    ]
  },
  {
    id: "TXN-2026-0007",
    voucherNo: "VCH-2026-0007",
    date: "2026-06-20",
    time: "14:10",
    accountDebit: "Bil Elektrik",
    accountCredit: "Bank",
    amount: 120.00,
    description: "Bayaran bil TNB bagi lampu jalan & balai pengawal",
    category: "Bil Elektrik",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-20",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "tnb_receipt_jun.pdf",
    notes: "Melalui akaun autodebit bank",
    auditTrail: [
      { time: "2026-06-20 14:10", user: "Ahmad (Bendahari)", action: "Merekod transaksi bil" }
    ]
  },
  {
    id: "TXN-2026-0008",
    voucherNo: "VCH-2026-0008",
    date: "2026-06-21",
    time: "09:00",
    accountDebit: "Bil Air",
    accountCredit: "Bank",
    amount: 40.00,
    description: "Bayaran bil air Syabas untuk dewan komuniti & balai pengawal",
    category: "Bil Air",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-21",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "syabas_receipt_jun.pdf",
    notes: "Penyelenggaraan bil bulanan",
    auditTrail: [
      { time: "2026-06-21 09:00", user: "Ahmad (Bendahari)", action: "Merekod transaksi bil air" }
    ]
  },
  {
    id: "TXN-2026-0009",
    voucherNo: "VCH-2026-0009",
    date: "2026-06-24",
    time: "11:00",
    accountDebit: "Landskap",
    accountCredit: "Bank",
    amount: 450.00,
    description: "Bayaran pembelian baja & tanaman landskap bulatan utama",
    category: "Landskap",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-25",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "resit_nurseri_indah.pdf",
    notes: "Pembelian peralatan gotong-royong & tanaman",
    auditTrail: [
      { time: "2026-06-24 11:00", user: "Ahmad (Bendahari)", action: "Merekod transaksi landskap" }
    ]
  },
  {
    id: "TXN-2026-0010",
    voucherNo: "VCH-2026-0010",
    date: "2026-06-26",
    time: "15:00",
    accountDebit: "Bank",
    accountCredit: "Sewaan Tapak",
    amount: 150.00,
    description: "Sewaan tapak niaga pasar malam mingguan dewan",
    category: "Sewaan Tapak",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-26",
    approvedBy: "Pengerusi (En. Kamal)",
    receiptAttachment: "resit_tapak_pasar.pdf",
    notes: "Kutipan mingguan tapak perniagaan penduduk",
    auditTrail: [
      { time: "2026-06-26 15:00", user: "Ahmad (Bendahari)", action: "Merekod kutipan sewaan tapak" }
    ]
  },
  {
    id: "TXN-2026-0011",
    voucherNo: "VCH-2026-0011",
    date: "2026-06-27",
    time: "10:00",
    accountDebit: "Operasi Persatuan",
    accountCredit: "Bank",
    amount: 180.00,
    description: "Pembelian dakwat pencetak & kertas A4 pejabat persatuan",
    category: "Operasi Persatuan",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Pending",
    notes: "Tuntutan pembelian alat tulis bulan Jun",
    auditTrail: [
      { time: "2026-06-27 10:00", user: "Ahmad (Bendahari)", action: "Merekod transaksi (Menunggu Kelulusan)" }
    ]
  },
  {
    id: "TXN-2026-0012",
    voucherNo: "VCH-2026-0012",
    date: "2026-06-28",
    time: "11:00",
    accountDebit: "Tunai",
    accountCredit: "Bank",
    amount: 500.00,
    description: "Pengeluaran wang bank untuk tunai runcit persatuan (Kontra)",
    category: "Pindahan Wang (Kontra)",
    recordedBy: "Ahmad (Bendahari)",
    approvalStatus: "Approved",
    approvedDate: "2026-06-28",
    approvedBy: "Pengerusi (En. Kamal)",
    notes: "Pengeluaran wang tunai untuk kegunaan runcit pejabat persatuan.",
    auditTrail: [
      { time: "2026-06-28 11:00", user: "Ahmad (Bendahari)", action: "Merekod pindahan tunai dari bank" }
    ]
  }
];

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xl text-[10px] font-bold font-mono">
        <p className="mb-1 text-slate-400">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span>RM {entry.value.toFixed(2)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function KewanganSection({ isMobile = false, transactions: propsTransactions }: KewanganSectionProps) {
  const { currentUserDoc, allUsers, allApplications, firebaseUser } = useAuth();
  const isAdminUtama = currentUserDoc?.role === 'Admin Utama' || currentUserDoc?.role === 'ADMIN UTAMA' || currentUserDoc?.isSuperAdmin === true || currentUserDoc?.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my';
  const isBendahari = currentUserDoc?.role === 'Bendahari';

  const [showEditFees, setShowEditFees] = useState(false);
  const [editConfig, setEditConfig] = useState<YuranConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // States for Additional Fees
  const [showAdditionalFeeModal, setShowAdditionalFeeModal] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [addFeeTitle, setAddFeeTitle] = useState("");
  const [addFeeAccount, setAddFeeAccount] = useState("Bank");
  const [addFeeCategory, setAddFeeCategory] = useState("Yuran Bulanan");
  const [addFeePrice, setAddFeePrice] = useState("");
  const [addFeeType, setAddFeeType] = useState<'Tahunan' | 'Bulanan'>('Tahunan');
  const [addFeeSession, setAddFeeSession] = useState("Sesi 2026/2027");
  const [addFeeMonths, setAddFeeMonths] = useState<string[]>([]);
  const [addFeeHasAgePricing, setAddFeeHasAgePricing] = useState(false);
  const [addFeeIsCustomAmount, setAddFeeIsCustomAmount] = useState(false);
  const [addFeeAgeDewasaEnabled, setAddFeeAgeDewasaEnabled] = useState(false);
  const [addFeeAgeDewasaPrice, setAddFeeAgeDewasaPrice] = useState("");
  const [addFeeAgeWargaEmasEnabled, setAddFeeAgeWargaEmasEnabled] = useState(false);
  const [addFeeAgeWargaEmasPrice, setAddFeeAgeWargaEmasPrice] = useState("");
  const [addFeeAgeKanakKanakEnabled, setAddFeeAgeKanakKanakEnabled] = useState(false);
  const [addFeeAgeKanakKanakPrice, setAddFeeAgeKanakKanakPrice] = useState("");
  const [addFeeScopeType, setAddFeeScopeType] = useState<'all' | 'specific'>('all');
  const [addFeeAssignedUids, setAddFeeAssignedUids] = useState<string[]>([]);
  const [addFeeUserSearch, setAddFeeUserSearch] = useState<string>("");

  const handleOpenAddFee = () => {
    setEditingFeeId(null);
    setAddFeeTitle("");
    setAddFeeAccount("Bank");
    setAddFeeCategory("Yuran Bulanan");
    setAddFeePrice("");
    setAddFeeType('Tahunan');
    if (editConfig?.sesiList && editConfig.sesiList.length > 0) {
      setAddFeeSession(editConfig.sesiList[0].name);
    } else {
      setAddFeeSession("Sesi 2026/2027");
    }
    setAddFeeMonths([]);
    setAddFeeHasAgePricing(false);
    setAddFeeIsCustomAmount(false);
    setAddFeeAgeDewasaEnabled(false);
    setAddFeeAgeDewasaPrice("");
    setAddFeeAgeWargaEmasEnabled(false);
    setAddFeeAgeWargaEmasPrice("");
    setAddFeeAgeKanakKanakEnabled(false);
    setAddFeeAgeKanakKanakPrice("");
    setAddFeeScopeType('all');
    setAddFeeAssignedUids([]);
    setAddFeeUserSearch("");
    setShowAdditionalFeeModal(true);
  };

  const handleOpenEditFee = (fee: any) => {
    setEditingFeeId(fee.id);
    setAddFeeTitle(fee.title || "");
    setAddFeeAccount(fee.account || "Bank");
    setAddFeeCategory(fee.category || "Yuran Bulanan");
    setAddFeePrice(fee.price !== undefined ? fee.price.toString() : "");
    setAddFeeType(fee.feeType || 'Tahunan');
    setAddFeeSession(fee.sessionYear || "Sesi 2026/2027");
    setAddFeeMonths(fee.months || []);
    setAddFeeHasAgePricing(fee.hasAgePricing || false);
    setAddFeeIsCustomAmount(fee.isCustomAmount || false);
    
    if (fee.agePricing) {
      setAddFeeAgeDewasaEnabled(fee.agePricing.dewasa?.enabled || false);
      setAddFeeAgeDewasaPrice(fee.agePricing.dewasa?.price !== undefined ? fee.agePricing.dewasa.price.toString() : "");
      setAddFeeAgeWargaEmasEnabled(fee.agePricing.wargaEmas?.enabled || false);
      setAddFeeAgeWargaEmasPrice(fee.agePricing.wargaEmas?.price !== undefined ? fee.agePricing.wargaEmas.price.toString() : "");
      setAddFeeAgeKanakKanakEnabled(fee.agePricing.kanakKanak?.enabled || false);
      setAddFeeAgeKanakKanakPrice(fee.agePricing.kanakKanak?.price !== undefined ? fee.agePricing.kanakKanak.price.toString() : "");
    } else {
      setAddFeeAgeDewasaEnabled(false);
      setAddFeeAgeDewasaPrice("");
      setAddFeeAgeWargaEmasEnabled(false);
      setAddFeeAgeWargaEmasPrice("");
      setAddFeeAgeKanakKanakEnabled(false);
      setAddFeeAgeKanakKanakPrice("");
    }
    
    setAddFeeScopeType(fee.assignedUids && fee.assignedUids.length > 0 ? 'specific' : 'all');
    setAddFeeAssignedUids(fee.assignedUids || []);
    setAddFeeUserSearch("");
    setShowAdditionalFeeModal(true);
  };

  const handleDeleteAdditionalFee = async (feeId: string) => {
    if (!editConfig) return;
    const currentFees = editConfig.additionalFees || [];
    const updatedFees = currentFees.filter(f => f.id !== feeId);
    const updatedConfig = {
      ...editConfig,
      additionalFees: updatedFees
    };
    setEditConfig(updatedConfig);
    try {
      await setDoc(doc(db, 'system', 'yuranConfig'), {
        additionalFees: updatedFees
      }, { merge: true });
      localStorage.setItem('tmf2_yuran_config', JSON.stringify(updatedConfig));
    } catch (err) {
      console.error("Gagal auto-delete yuranConfig:", err);
    }
  };

  const handleSaveNewAdditionalFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editConfig) return;
    if (!addFeeTitle.trim()) {
      alert("Sila masukkan tajuk yuran.");
      return;
    }
    const basePrice = parseFloat(addFeePrice) || 0;
    if (basePrice <= 0 && !addFeeHasAgePricing) {
      alert("Sila masukkan amaun yuran.");
      return;
    }

    if (addFeeType === 'Bulanan' && addFeeMonths.length === 0) {
      alert("Sila pilih sekurang-kurangnya satu bulan.");
      return;
    }

    if (addFeeHasAgePricing && !addFeeAgeDewasaEnabled && !addFeeAgeWargaEmasEnabled && !addFeeAgeKanakKanakEnabled) {
      alert("Sila pilih sekurang-kurangnya satu kategori umur.");
      return;
    }

    if (addFeeScopeType === 'specific' && addFeeAssignedUids.length === 0) {
      alert("Sila pilih sekurang-kurangnya seorang ahli persatuan jika anda memilih skop bayaran ahli khusus.");
      return;
    }

    const newFee: any = {
      id: editingFeeId || `fee-additional-${Date.now()}`,
      title: addFeeTitle,
      account: addFeeAccount,
      category: addFeeCategory,
      price: basePrice,
      feeType: addFeeType,
      hasAgePricing: addFeeHasAgePricing,
      isCustomAmount: addFeeIsCustomAmount,
      assignedUids: addFeeScopeType === 'specific' ? addFeeAssignedUids : undefined
    };

    if (addFeeType === 'Tahunan') {
      newFee.sessionYear = addFeeSession;
    } else {
      newFee.months = addFeeMonths;
    }

    if (addFeeHasAgePricing) {
      newFee.agePricing = {
        dewasa: {
          enabled: addFeeAgeDewasaEnabled,
          price: addFeeAgeDewasaEnabled ? (parseFloat(addFeeAgeDewasaPrice) || 0) : 0
        },
        wargaEmas: {
          enabled: addFeeAgeWargaEmasEnabled,
          price: addFeeAgeWargaEmasEnabled ? (parseFloat(addFeeAgeWargaEmasPrice) || 0) : 0
        },
        kanakKanak: {
          enabled: addFeeAgeKanakKanakEnabled,
          price: addFeeAgeKanakKanakEnabled ? (parseFloat(addFeeAgeKanakKanakPrice) || 0) : 0
        }
      };
      // Set the base price to the first enabled age price
      if (addFeeAgeDewasaEnabled) newFee.price = parseFloat(addFeeAgeDewasaPrice) || 0;
      else if (addFeeAgeWargaEmasEnabled) newFee.price = parseFloat(addFeeAgeWargaEmasPrice) || 0;
      else if (addFeeAgeKanakKanakEnabled) newFee.price = parseFloat(addFeeAgeKanakKanakPrice) || 0;
    }

    const currentFees = editConfig.additionalFees || [];
    let updatedFees: any[];
    if (editingFeeId) {
      updatedFees = currentFees.map(f => f.id === editingFeeId ? newFee : f);
    } else {
      updatedFees = [...currentFees, newFee];
    }

    const updatedConfig = {
      ...editConfig,
      additionalFees: updatedFees
    };
    setEditConfig(updatedConfig);

    try {
      await setDoc(doc(db, 'system', 'yuranConfig'), {
        additionalFees: updatedFees
      }, { merge: true });
      localStorage.setItem('tmf2_yuran_config', JSON.stringify(updatedConfig));
    } catch (err) {
      console.error("Gagal auto-save yuranConfig:", err);
    }

    setShowAdditionalFeeModal(false);
    setEditingFeeId(null);
  };

  const renderAdditionalFeeModal = () => {
    if (!showAdditionalFeeModal) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[999] flex items-center justify-center p-4 overflow-y-auto text-left">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100 my-8">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                {editingFeeId ? <Edit size={16} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {editingFeeId ? "Kemaskini Yuran Tambahan" : "Tambah Tambahan Yuran Baru"}
                </h3>
                <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                  {editingFeeId ? "Ubah konfigurasi yuran tambahan yang dipilih" : "Konfigurasi yuran tambahan khusus penduduk"}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setShowAdditionalFeeModal(false)}
              className="w-7 h-7 rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-100"
            >
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSaveNewAdditionalFee} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto bg-slate-50">
            {/* Tajuk Yuran */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Tajuk Yuran <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                placeholder="Contoh: Yuran Pelekat Kereta 2026, Yuran Sukan Komuniti"
                value={addFeeTitle}
                onChange={(e) => setAddFeeTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Akaun Apa */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Masuk Akaun Mana <span className="text-rose-500">*</span></label>
                <select
                  value={addFeeAccount}
                  onChange={(e) => setAddFeeAccount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                >
                  <option value="Bank">Bank</option>
                  <option value="Tunai">Tunai</option>
                </select>
              </div>

              {/* Kategori Apa */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Kategori Transaksi (Taip / Pilih) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  list="incomeCategoriesList"
                  required
                  placeholder="Contoh: Yuran Tambahan Khusus"
                  value={addFeeCategory}
                  onChange={(e) => setAddFeeCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white"
                />
                <datalist id="incomeCategoriesList">
                  {incomeCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Berapa RM Yuran tersebut */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Jumlah Yuran Asal (RM) <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">RM</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={addFeePrice}
                  onChange={(e) => setAddFeePrice(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Jenis Kutipan: Tahunan or Bulanan */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Kekerapan Kutipan <span className="text-rose-500">*</span></label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="addFeeType"
                    checked={addFeeType === 'Tahunan'}
                    onChange={() => setAddFeeType('Tahunan')}
                    className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                  />
                  Tahunan (Mengikut Sesi)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="addFeeType"
                    checked={addFeeType === 'Bulanan'}
                    onChange={() => setAddFeeType('Bulanan')}
                    className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                  />
                  Bulanan (Bulan-bulan khusus)
                </label>
              </div>
            </div>

            {/* Conditional inputs depending on type */}
            {addFeeType === 'Tahunan' ? (
              <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Sesi Tahunan <span className="text-rose-500">*</span></label>
                <select
                  value={addFeeSession}
                  onChange={(e) => setAddFeeSession(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                >
                  {editConfig?.sesiList.map((sesi) => (
                    <option key={sesi.id} value={sesi.name}>{sesi.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Pilih Bulan Yang Dikenakan <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableMonthsForTicking.map((m) => {
                    const isTicked = addFeeMonths.includes(m);
                    return (
                      <label key={m} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                        isTicked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => {
                            if (isTicked) {
                              setAddFeeMonths(prev => prev.filter(x => x !== m));
                            } else {
                              setAddFeeMonths(prev => [...prev, m]);
                            }
                          }}
                          className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                        />
                        {m}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Age Based Pricing */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-100">
              <label className="flex items-center gap-2 text-xs font-extrabold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addFeeHasAgePricing}
                  onChange={(e) => {
                    setAddFeeHasAgePricing(e.target.checked);
                    if (e.target.checked) {
                      setAddFeeIsCustomAmount(false);
                    }
                  }}
                  className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                />
                Mempunyai perbezaan bayaran mengikut kategori umur (Dewasa, Warga Emas, Kanak-Kanak)
              </label>

              {addFeeHasAgePricing && (
                <div className="space-y-3 pt-2.5 border-t border-slate-100 animate-fadeIn">
                  {/* Dewasa */}
                  <div className="flex items-center justify-between gap-4 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addFeeAgeDewasaEnabled}
                        onChange={(e) => setAddFeeAgeDewasaEnabled(e.target.checked)}
                        className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                      />
                      Dewasa
                    </label>
                    {addFeeAgeDewasaEnabled && (
                      <div className="relative w-32 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">RM</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={addFeeAgeDewasaEnabled}
                          placeholder="Dewasa"
                          value={addFeeAgeDewasaPrice}
                          onChange={(e) => setAddFeeAgeDewasaPrice(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg pl-7 pr-1.5 py-1.5 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Warga Emas */}
                  <div className="flex items-center justify-between gap-4 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addFeeAgeWargaEmasEnabled}
                        onChange={(e) => setAddFeeAgeWargaEmasEnabled(e.target.checked)}
                        className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                      />
                      Warga Emas
                    </label>
                    {addFeeAgeWargaEmasEnabled && (
                      <div className="relative w-32 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">RM</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={addFeeAgeWargaEmasEnabled}
                          placeholder="Warga Emas"
                          value={addFeeAgeWargaEmasPrice}
                          onChange={(e) => setAddFeeAgeWargaEmasPrice(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg pl-7 pr-1.5 py-1.5 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Kanak-Kanak */}
                  <div className="flex items-center justify-between gap-4 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addFeeAgeKanakKanakEnabled}
                        onChange={(e) => setAddFeeAgeKanakKanakEnabled(e.target.checked)}
                        className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                      />
                      Kanak-Kanak
                    </label>
                    {addFeeAgeKanakKanakEnabled && (
                      <div className="relative w-32 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">RM</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={addFeeAgeKanakKanakEnabled}
                          placeholder="Kanak-Kanak"
                          value={addFeeAgeKanakKanakPrice}
                          onChange={(e) => setAddFeeAgeKanakKanakPrice(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg pl-7 pr-1.5 py-1.5 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bayaran Ikut Suka */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-100">
              <label className="flex items-center gap-2 text-xs font-extrabold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addFeeIsCustomAmount}
                  onChange={(e) => {
                    setAddFeeIsCustomAmount(e.target.checked);
                    if (e.target.checked) {
                      setAddFeeHasAgePricing(false);
                    }
                  }}
                  className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                />
                Bayaran Ikut Suka (Flexible Payment)
              </label>
              <p className="text-[10px] text-slate-400 pl-5 font-medium leading-relaxed">
                Apabila diaktifkan, pengguna bebas membayar mana-mana amaun yang mereka inginkan (contohnya bayaran ansuran) sehingga keseluruhan amaun yuran asal selesai dijelaskan.
              </p>
            </div>

            {/* Sasaran Ahli / Penduduk yang Perlu Bayar */}
            <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Penerima / Sasaran Yuran <span className="text-rose-500">*</span></label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="addFeeScopeType"
                    checked={addFeeScopeType === 'all'}
                    onChange={() => setAddFeeScopeType('all')}
                    className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                  />
                  Semua Penduduk
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="addFeeScopeType"
                    checked={addFeeScopeType === 'specific'}
                    onChange={() => setAddFeeScopeType('specific')}
                    className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                  />
                  Penduduk Pilihan Sahaja
                </label>
              </div>

              {addFeeScopeType === 'specific' && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100 animate-fadeIn">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari penduduk mengikut nama atau e-mel..."
                      value={addFeeUserSearch}
                      onChange={(e) => setAddFeeUserSearch(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                    {(() => {
                      const filteredUsers = (allUsers || []).filter(u => {
                        const q = addFeeUserSearch.toLowerCase();
                        const nameMatch = (u.displayName || u.nickname || "").toLowerCase().includes(q);
                        const emailMatch = (u.email || "").toLowerCase().includes(q);
                        return nameMatch || emailMatch;
                      });

                      if (filteredUsers.length === 0) {
                        return (
                          <div className="text-center py-4 text-[10px] text-slate-400 font-bold">
                            Tiada penduduk ditemui.
                          </div>
                        );
                      }

                      return filteredUsers.map((u) => {
                        const isChecked = addFeeAssignedUids.includes(u.uid);
                        return (
                          <label key={u.uid} className={`flex items-center justify-between p-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                            isChecked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-semibold' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                          }`}>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setAddFeeAssignedUids(prev => prev.filter(uid => uid !== u.uid));
                                  } else {
                                    setAddFeeAssignedUids(prev => [...prev, u.uid]);
                                  }
                                }}
                                className="cursor-pointer text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="flex flex-col">
                                <span>{u.displayName || u.nickname || 'Penduduk Tanpa Nama'}</span>
                                <span className="text-[9px] text-slate-400 font-normal">{u.email || 'Tiada e-mel'} • {u.role || 'Penduduk'}</span>
                              </div>
                            </div>
                            {isChecked && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">Dipilih</span>
                            )}
                          </label>
                        );
                      });
                    })()}
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold px-1">
                    <span>Dipilih: {addFeeAssignedUids.length} orang</span>
                    {addFeeAssignedUids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAddFeeAssignedUids([])}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        Padam Semua Pilihan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setShowAdditionalFeeModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase shadow-xs transition-all cursor-pointer"
              >
                Simpan Yuran
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const availableMonthsForTicking = editConfig?.sesiList ? editConfig.sesiList.flatMap(sesi => {
    return generate12Months(sesi.startMonth, sesi.startYear).map(m => m.name);
  }) : [];
  const [activeTab, setActiveTab] = useState<'lejar' | 'untung-rugi' | 'kunci-kira-kira' | 'aliran-tunai'>('lejar');
  const [configTab, setConfigTab] = useState<'debit' | 'kredit'>('debit');
  const [transactions, setTransactions] = useState<KewanganTransaction[]>(() => {
    if (propsTransactions) {
      return propsTransactions;
    }
    const saved = localStorage.getItem('tmf2_kewangan_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  useEffect(() => {
    if (propsTransactions) {
      setTransactions(propsTransactions);
    }
  }, [propsTransactions]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      try {
        const saved = localStorage.getItem('tmf2_kewangan_transactions');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTransactions(parsed);
          }
        }
      } catch (e) {}
    };
    window.addEventListener('tmf2_transactions_updated', handleStorageUpdate);
    return () => window.removeEventListener('tmf2_transactions_updated', handleStorageUpdate);
  }, []);

  // Auto-backfill confirmed Qurban registrations into Lejar Umum if missing
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'qurbanRegistrations'), (snapshot) => {
      const confirmedRegs: any[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.statusPendaftaran === 'Disahkan') {
          confirmedRegs.push({ ...d, id: d.id || docSnap.id });
        }
      });
      if (confirmedRegs.length === 0) return;

      setTransactions(prev => {
        const next = [...prev];
        let changed = false;
        confirmedRegs.forEach(reg => {
          const hasExistingTxn = next.some(t =>
            (t.description && t.description.includes(reg.id)) ||
            (t.notes && t.notes.includes(reg.id)) ||
            (t.paidPackageIds && t.paidPackageIds.some((pid: string) => pid.includes(reg.id)))
          );
          if (!hasExistingTxn) {
            const isAnsuran = reg.opsiBayaran === 'Ansuran';
            const inst0 = reg.installmentPayments?.[0];
            const isCash = inst0?.paymentMethod === 'Tunai' || reg.paymentMethod === 'Tunai';
            const amt = isAnsuran
              ? (reg.depositAmount || reg.monthlyAmount || inst0?.amount || 0)
              : (reg.totalAmount || 0);
            if (amt > 0) {
              const verifiedDate = (reg.verifiedAt || reg.updatedAt || reg.createdAt || new Date().toISOString()).split('T')[0];
              const txnId = `TXN-QURBAN-${reg.id.substring(0, 8)}-M1`;
              const vchNo = `VCH-QURBAN-${reg.id.substring(0, 6).toUpperCase()}`;
              const debitAccount = isCash ? 'Tunai' : 'Bank';
              const synthesizedTxn: KewanganTransaction = {
                id: txnId,
                voucherNo: vchNo,
                date: verifiedDate,
                time: '12:00',
                accountDebit: debitAccount,
                accountCredit: 'Qurban Aqiqah',
                amount: amt,
                description: isAnsuran
                  ? `Bayaran ${isCash ? 'Tunai ' : ''}Deposit Bulan 1 Pendaftaran Qurban & Aqiqah (Ref: ${reg.id} - ${reg.namaPenuh})`
                  : `Bayaran ${isCash ? 'Tunai ' : ''}Penuh Pendaftaran Qurban & Aqiqah (Ref: ${reg.id} - ${reg.namaPenuh})`,
                category: 'Qurban Aqiqah',
                recordedBy: `${reg.verifiedBy || 'Admin'} (Urusetia Qurban)`,
                approvalStatus: 'Approved',
                approvedDate: verifiedDate,
                approvedBy: reg.verifiedBy || 'Admin',
                notes: `Pengesahan bayaran ${isCash ? 'Tunai' : 'Penuh/Deposit'} Pendaftaran Qurban & Aqiqah (Ref: ${reg.id} - ${reg.namaPenuh})`,
                memberEmail: reg.userEmail || reg.emel || '',
                paidPackageIds: [`qurban-cart-${reg.id}-m1`],
                sessionYear: detectActiveSessionYear() || '2026',
                auditTrail: [{
                  time: `${verifiedDate} 12:00`,
                  user: reg.verifiedBy || 'Admin',
                  action: `Bayaran ${debitAccount} disahkan oleh urusetia.`
                }]
              };
              next.unshift(synthesizedTxn);
              changed = true;
              setDoc(doc(db, 'kewanganTransactions', txnId), synthesizedTxn, { merge: true }).catch(() => {});
            }
          }
        });
        if (changed) {
          next.sort((a, b) => b.id.localeCompare(a.id));
          try {
            localStorage.setItem('tmf2_kewangan_transactions', JSON.stringify(next));
          } catch (e) {}
          return next;
        }
        return prev;
      });
    }, () => {});
    return () => unsub();
  }, [db]);

  useEffect(() => {
    localStorage.setItem('tmf2_kewangan_transactions', JSON.stringify(transactions));
  }, [transactions]);
  
  // Filters state
  const [filterMonth, setFilterMonth] = useState<string>("All");
  const [filterYear, setFilterYear] = useState<string>(() => detectActiveSessionYear());
  const [filterAccount, setFilterAccount] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterType, setFilterType] = useState<string>("All"); // 'Debit' | 'Kredit' | 'All'
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAnalysis, setShowAnalysis] = useState<boolean>(false);

  // Accordion Grouping State
  const [groupByCategoryAccordion, setGroupByCategoryAccordion] = useState<boolean>(false);
  const [collapsedAccordionCategories, setCollapsedAccordionCategories] = useState<{ [key: string]: boolean }>({});
  const [groupByDateTimeAccordion, setGroupByDateTimeAccordion] = useState<boolean>(false);
  const [collapsedAccordionDates, setCollapsedAccordionDates] = useState<{ [key: string]: boolean }>({});

  // Carry Forward State
  const [showCarryForwardModal, setShowCarryForwardModal] = useState(false);
  const [selectedCFYear, setSelectedCFYear] = useState<string>("2026");
  const [closedYears, setClosedYears] = useState<string[]>(() => {
    const saved = localStorage.getItem('tmf2_closed_years');
    return saved ? JSON.parse(saved) : [];
  });

  // Approval manager modal state
  const [selectedTxn, setSelectedTxn] = useState<KewanganTransaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Receipt View Modal state
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [selectedReceiptTxn, setSelectedReceiptTxn] = useState<KewanganTransaction | null>(null);
  const [isApprovingReceipt, setIsApprovingReceipt] = useState<boolean>(false);

  const handleApproveTransaction = async (txn: KewanganTransaction) => {
    try {
      setIsApprovingReceipt(true);
      const updatedTxn: KewanganTransaction = {
        ...txn,
        approvalStatus: 'Approved',
        approvedBy: `${currentUserDoc?.displayName || 'Admin'} (${currentUserDoc?.role || 'Admin'})`,
        approvedDate: new Date().toISOString().split('T')[0],
        auditTrail: [
          ...txn.auditTrail,
          {
            time: new Date().toISOString().replace('T', ' ').slice(0, 16),
            user: `${currentUserDoc?.displayName || 'Admin'} (${currentUserDoc?.role || 'Admin'})`,
            action: `Mengesahkan dan meluluskan bayaran manual resit`
          }
        ]
      };
      await setDoc(doc(db, 'kewanganTransactions', txn.id), cleanUndefined(updatedTxn));

      // Sync member paid packages if memberEmail and paidPackageIds exist
      if (txn.memberEmail && txn.paidPackageIds && txn.paidPackageIds.length > 0) {
        const userDoc = allUsers?.find(u => u.email === txn.memberEmail);
        if (userDoc) {
          const currentPaidIds = userDoc.paidPackageIds || [];
          const updatedPaidIds = Array.from(new Set([...currentPaidIds, ...txn.paidPackageIds]));
          await updateDoc(doc(db, 'users', userDoc.uid), {
            paidPackageIds: updatedPaidIds
          }).catch(err => console.error("Error updating member paid packages on approval:", err));
        }
      }

      // Hantar notifikasi Telegram kelulusan resit
      try {
        const userDoc = allUsers?.find(u => u.email === txn.memberEmail);
        await sendTelegramPaymentNotification({
          payerName: userDoc?.displayName || userDoc?.nickname || txn.memberEmail || 'Ahli',
          payerEmail: txn.memberEmail || '',
          payerPhone: userDoc?.phoneNumber || '',
          paymentMethod: 'Bayaran Manual (Resit Disahkan Admin)',
          totalAmount: txn.amount || 0,
          approvalStatus: 'Approved',
          items: [{
            name: txn.description || txn.category || 'Bayaran Yuran',
            category: txn.category,
            amount: txn.amount || 0,
            sessionYear: txn.sessionYear
          }],
          transactionIds: [txn.id],
          voucherNumbers: [txn.voucherNo],
          receiptUrl: txn.receiptAttachment,
          notes: `Bayaran telah disahkan dan diluluskan oleh ${currentUserDoc?.displayName || 'Admin'} pada ${new Date().toLocaleDateString('ms-MY')}.`,
          recordedBy: `${currentUserDoc?.displayName || 'Admin'} (Pengesahan Resit)`
        });
      } catch (tgErr) {
        console.error("Gagal hantar notifikasi kelulusan Telegram:", tgErr);
      }

      alert("Transaksi telah BERJAYA DISAHKAN dan DILULUSKAN!");
      setShowReceiptModal(false);
    } catch (err) {
      console.error("Ralat mengesahkan transaksi:", err);
      alert("Gagal mengesahkan transaksi.");
    } finally {
      setIsApprovingReceipt(false);
    }
  };

  // Custom Confirmation Modal States
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState<string>("");
  const [confirmModalMessage, setConfirmModalMessage] = useState<string>("");
  const [confirmModalAction, setConfirmModalAction] = useState<(() => void) | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState<boolean>(false);

  // Metadata Edit Modal States
  const [showMetadataModal, setShowMetadataModal] = useState<boolean>(false);
  const [editStatementDate, setEditStatementDate] = useState<string>("");
  const [editAuditStatus, setEditAuditStatus] = useState<string>("");
  const [editTreasurerName, setEditTreasurerName] = useState<string>("");

  // Asset & Liability Manager Modal States
  const [showAssetLiabilityModal, setShowAssetLiabilityModal] = useState<boolean>(false);
  const [activeAssetLiabilityTab, setActiveAssetLiabilityTab] = useState<'fixed-assets' | 'liabilities' | 'current-assets' | 'other-liabilities' | 'capital'>('fixed-assets');
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; val: number } | null>(null);
  const [formItemName, setFormItemName] = useState<string>("");
  const [formItemVal, setFormItemVal] = useState<string>("");

  // Form Fields
  const [formDate, setFormDate] = useState<string>("2026-06-27");
  const [formTime, setFormTime] = useState<string>("12:00");
  const [formDebitAccount, setFormDebitAccount] = useState<string>("Bank");
  const [formCreditAccount, setFormCreditAccount] = useState<string>("Yuran Bulanan");
  const [formAmount, setFormAmount] = useState<string>("150.00");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("Yuran Bulanan");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formStatus, setFormStatus] = useState<'Pending' | 'Approved' | 'Rejected'>("Approved");
  const [formVoucherNo, setFormVoucherNo] = useState<string>("");

  // Loading states for buttons
  const [isSavingTxn, setIsSavingTxn] = useState<boolean>(false);
  const [isDeletingTxn, setIsDeletingTxn] = useState<boolean>(false);
  const [isSavingAssetLiability, setIsSavingAssetLiability] = useState<boolean>(false);
  const [processingTxnId, setProcessingTxnId] = useState<string | null>(null);
  const [processingGroupKey, setProcessingGroupKey] = useState<string | null>(null);
  const [isCarryingForward, setIsCarryingForward] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isGeneratingStatement, setIsGeneratingStatement] = useState<boolean>(false);
  const [isSavingComment, setIsSavingComment] = useState<boolean>(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState<boolean>(false);

  const [formTxnType, setFormTxnType] = useState<'standard' | 'contra'>('standard');
  const [formContraDirection, setFormContraDirection] = useState<'bank_to_cash' | 'cash_to_bank'>('bank_to_cash');

  // Auto-sync form fields for internal transfers (Contra)
  useEffect(() => {
    if (formTxnType === 'contra') {
      setFormCategory("Pindahan Wang (Kontra)");
      if (formContraDirection === 'bank_to_cash') {
        setFormDebitAccount("Tunai");
        setFormCreditAccount("Bank");
      } else {
        setFormDebitAccount("Bank");
        setFormCreditAccount("Tunai");
      }
    }
  }, [formTxnType, formContraDirection]);

  // Signatures checklist status with useAuth & Firestore persistence
  const isFinanceAdmin = currentUserDoc?.role === 'Bendahari' || isAdminUtama;

  // Dynamic names mapping from allUsers
  const bendahariUser = allUsers?.find(u => u.role === 'Bendahari');
  const setiausahaUser = allUsers?.find(u => u.role === 'Setiausaha');
  const pengerusiUser = allUsers?.find(u => u.role === 'Pengerusi');
  const juruAudits = allUsers?.filter(u => u.role === 'Juru Audit') || [];
  const juruAudit1User = juruAudits[0];
  const juruAudit2User = juruAudits[1];

  const bendahariName = bendahariUser?.displayName || "Belum Dilantik";
  const setiausahaName = setiausahaUser?.displayName || "Belum Dilantik";
  const pengerusiName = pengerusiUser?.displayName || "Belum Dilantik";
  const juruAudit1Name = juruAudit1User?.displayName || "Belum Dilantik";
  const juruAudit2Name = juruAudit2User?.displayName || "Belum Dilantik";

  // Dynamic state for verification notes & signatures synced from Firestore
  const [verificationData, setVerificationData] = useState({
    treasurerComment: "",
    auditorComment: "",
    preparedSigned: false,
    reviewedSigned: false,
    authorizedSigned: false,
    audited1Signed: false,
    audited2Signed: false,
    preparedSignURL: "",
    reviewedSignURL: "",
    authorizedSignURL: "",
    audited1SignURL: "",
    audited2SignURL: "",
    preparedBy: "",
    reviewedBy: "",
    authorizedBy: "",
    audited1By: "",
    audited2By: "",
    preparedAt: "",
    reviewedAt: "",
    authorizedAt: "",
    audited1At: "",
    audited2At: "",
    statementDate: "",
    auditStatus: "",
    treasurerName: ""
  });

  const currentStatementDate = verificationData.statementDate || (verificationData.preparedAt ? verificationData.preparedAt.split(',')[0] : "2026-06-27");
  const currentAuditStatus = verificationData.auditStatus || (
    (verificationData.audited1Signed && verificationData.audited2Signed)
      ? "Diaudit Penuh & Sah"
      : (verificationData.audited1Signed || verificationData.audited2Signed)
        ? "Diaudit Sebahagian"
        : "Belum Diaudit Penuh (Dalaman Sahaja)"
  );
  const currentTreasurerName = verificationData.treasurerName || (bendahariName !== "Belum Dilantik" ? bendahariName : "Ahmad Bin Ismail");

  // Local comments for textareas
  const [localTreasurerComment, setLocalTreasurerComment] = useState<string>("");
  const [localAuditorComment, setLocalAuditorComment] = useState<string>("");

  // State for the digital signature pad modal
  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [roleToSign, setRoleToSign] = useState<'prepared' | 'reviewed' | 'authorized' | 'audited1' | 'audited2' | null>(null);
  const [roleLabelToSign, setRoleLabelToSign] = useState<string>("");
  const [roleNameToSign, setRoleNameToSign] = useState<string>("");
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const [isUploadingSign, setIsUploadingSign] = useState<boolean>(false);

  // Sync from Firestore kewanganVerification
  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local') return;
    const unsub = onSnapshot(doc(db, 'kewanganVerification', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setVerificationData({
          treasurerComment: data.treasurerComment || "",
          auditorComment: data.auditorComment || "",
          preparedSigned: !!data.preparedSigned,
          reviewedSigned: !!data.reviewedSigned,
          authorizedSigned: !!data.authorizedSigned,
          audited1Signed: !!data.audited1Signed,
          audited2Signed: !!data.audited2Signed,
          preparedSignURL: data.preparedSignURL || "",
          reviewedSignURL: data.reviewedSignURL || "",
          authorizedSignURL: data.authorizedSignURL || "",
          audited1SignURL: data.audited1SignURL || "",
          audited2SignURL: data.audited2SignURL || "",
          preparedBy: data.preparedBy || "",
          reviewedBy: data.reviewedBy || "",
          authorizedBy: data.authorizedBy || "",
          audited1By: data.audited1By || "",
          audited2By: data.audited2By || "",
          preparedAt: data.preparedAt || "",
          reviewedAt: data.reviewedAt || "",
          authorizedAt: data.authorizedAt || "",
          audited1At: data.audited1At || "",
          audited2At: data.audited2At || "",
          statementDate: data.statementDate || "",
          auditStatus: data.auditStatus || "",
          treasurerName: data.treasurerName || ""
        });
      }
    }, (error) => {
      console.warn("Ralat akses data verifikasi kewangan:", error);
    });
    return () => unsub();
  }, [db, firebaseUser]);

  // Update local comments when Firestore data is received
  useEffect(() => {
    setLocalTreasurerComment(verificationData.treasurerComment);
  }, [verificationData.treasurerComment]);

  useEffect(() => {
    setLocalAuditorComment(verificationData.auditorComment);
  }, [verificationData.auditorComment]);

  // Canvas drawing ref
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a'; // slate-900 color
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

  // Sign helper roles matching
  const canSign = (roleKey: 'prepared' | 'reviewed' | 'authorized' | 'audited1' | 'audited2') => {
    if (!currentUserDoc) return false;
    // Admin Utama / Superadmin can sign everything for testing/setup/convenience
    if (isAdminUtama) {
      return true;
    }
    if (roleKey === 'prepared') return currentUserDoc.role === 'Bendahari';
    if (roleKey === 'reviewed') return currentUserDoc.role === 'Setiausaha';
    if (roleKey === 'authorized') return currentUserDoc.role === 'Pengerusi';
    if (roleKey === 'audited1') {
      // First Juru Audit
      return currentUserDoc.role === 'Juru Audit';
    }
    if (roleKey === 'audited2') {
      // Second Juru Audit
      return currentUserDoc.role === 'Juru Audit';
    }
    return false;
  };

  const canClear = (roleKey: 'prepared' | 'reviewed' | 'authorized' | 'audited1' | 'audited2') => {
    if (!currentUserDoc) return false;
    if (isAdminUtama) return true;
    if (roleKey === 'prepared') return currentUserDoc.role === 'Bendahari';
    if (roleKey === 'reviewed') return currentUserDoc.role === 'Setiausaha';
    if (roleKey === 'authorized') return currentUserDoc.role === 'Pengerusi';
    if (roleKey === 'audited1' || roleKey === 'audited2') return currentUserDoc.role === 'Juru Audit';
    return false;
  };

  const handleOpenSignModal = (
    roleKey: 'prepared' | 'reviewed' | 'authorized' | 'audited1' | 'audited2',
    label: string,
    fallbackName: string
  ) => {
    setRoleToSign(roleKey);
    setRoleLabelToSign(label);
    setRoleNameToSign(fallbackName);
    setShowSignModal(true);
    setSignatureMode('draw');
  };

  const handleClearSignature = (roleKey: 'prepared' | 'reviewed' | 'authorized' | 'audited1' | 'audited2') => {
    setConfirmModalTitle("Padam Tandatangan");
    setConfirmModalMessage("Adakah anda pasti mahu memadam tandatangan ini?");
    setConfirmModalAction(() => async () => {
      try {
        await setDoc(doc(db, 'kewanganVerification', 'current'), {
          [`${roleKey}Signed`]: false,
          [`${roleKey}SignURL`]: "",
          [`${roleKey}By`]: "",
          [`${roleKey}At`]: ""
        }, { merge: true });
      } catch (err) {
        console.error("Gagal memadam tandatangan:", err);
      }
    });
    setShowConfirmModal(true);
  };

  const handleSaveSignature = async (imageUrl: string) => {
    if (!roleToSign) return;
    try {
      setIsUploadingSign(true);
      const signDate = new Date().toLocaleString('ms-MY', { hour12: false });
      const signerName = currentUserDoc?.displayName || currentUserDoc?.email || "Ahli Jawatankuasa";
      
      await setDoc(doc(db, 'kewanganVerification', 'current'), {
        [`${roleToSign}Signed`]: true,
        [`${roleToSign}SignURL`]: imageUrl,
        [`${roleToSign}By`]: signerName,
        [`${roleToSign}At`]: signDate
      }, { merge: true });

      // Clean modal
      setShowSignModal(false);
      setRoleToSign(null);
    } catch (err) {
      console.error("Ralat menyimpan tandatangan:", err);
      alert("Gagal menyimpan tandatangan.");
    } finally {
      setIsUploadingSign(false);
    }
  };

  const handleCanvasSignSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setIsUploadingSign(true);
      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert("Lukisan tandatangan kosong.");
          setIsUploadingSign(false);
          return;
        }
        try {
          const storageRef = ref(storage, `signatures/current_${roleToSign}_${Date.now()}.png`);
          const snapshot = await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(snapshot.ref);
          await handleSaveSignature(downloadURL);
        } catch (error) {
          console.error("Gagal muat naik:", error);
          alert("Gagal memuat naik imej ke Firebase Storage.");
          setIsUploadingSign(false);
        }
      }, 'image/png');
    } catch (error) {
      console.error("Ralat kanvas:", error);
      setIsUploadingSign(false);
    }
  };

  const handleFileSignSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingSign(true);
      const storageRef = ref(storage, `signatures/current_${roleToSign}_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      await handleSaveSignature(downloadURL);
    } catch (error) {
      console.error("Gagal muat naik fail:", error);
      alert("Gagal memuat naik fail tandatangan.");
    } finally {
      setIsUploadingSign(false);
    }
  };

  const handleSaveTreasurerComment = async () => {
    try {
      await setDoc(doc(db, 'kewanganVerification', 'current'), {
        treasurerComment: localTreasurerComment
      }, { merge: true });
      alert("Catatan Bendahari berjaya disimpan!");
    } catch (err) {
      console.error("Gagal menyimpan catatan Bendahari:", err);
      alert("Gagal menyimpan catatan.");
    }
  };

  const handleSaveAuditorComment = async () => {
    try {
      await setDoc(doc(db, 'kewanganVerification', 'current'), {
        auditorComment: localAuditorComment
      }, { merge: true });
      alert("Catatan Juruaudit berjaya disimpan!");
    } catch (err) {
      console.error("Gagal menyimpan catatan Juruaudit:", err);
      alert("Gagal menyimpan catatan.");
    }
  };

  const handleOpenMetadataModal = () => {
    setEditStatementDate(currentStatementDate);
    setEditAuditStatus(currentAuditStatus);
    setEditTreasurerName(currentTreasurerName);
    setShowMetadataModal(true);
  };

  const handleSaveMetadata = async () => {
    setIsSavingMetadata(true);
    try {
      await setDoc(doc(db, 'kewanganVerification', 'current'), {
        statementDate: editStatementDate,
        auditStatus: editAuditStatus,
        treasurerName: editTreasurerName
      }, { merge: true });
      setShowMetadataModal(false);
      alert("Maklumat penyata kewangan berjaya dikemaskini!");
    } catch (err) {
      console.error("Gagal mengemaskini maklumat penyata:", err);
      alert("Ralat mengemaskini maklumat penyata.");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const { incomeCategories, expenseCategories } = useMemo(() => {
    const baseIncome = [
      "Yuran Keahlian", "Yuran Bulanan", "Khairat Kematian", "Sumbangan", "Sewaan Dewan", "Sewaan Tapak", 
      "Sewaan Mesin Minuman", "Pendapatan Program", "Faedah Bank", "Caj Perkhidmatan", "Program"
    ];
    const baseExpense = [
      "Pembersihan", "Keselamatan", "Bil Elektrik", "Bil Air", "Landskap", 
      "Program Komuniti", "Operasi Persatuan", "Caj Perkhidmatan", "Program"
    ];
    
    const dynamicIncome = new Set(baseIncome);
    const dynamicExpense = new Set(baseExpense);

    transactions.forEach(txn => {
      if (txn.category === "Baki Bawa Hadapan" || txn.category === "Pindahan Wang (Kontra)" || txn.category === "Kontra") return;
      const isInternalTransfer = (txn.accountDebit === "Bank" && txn.accountCredit === "Tunai") || (txn.accountDebit === "Tunai" && txn.accountCredit === "Bank");
      if (!isInternalTransfer) {
        if (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") {
          dynamicIncome.add(txn.category);
        } else if (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai") {
          dynamicExpense.add(txn.category);
        }
      }
    });

    return { 
      incomeCategories: Array.from(dynamicIncome), 
      expenseCategories: Array.from(dynamicExpense) 
    };
  }, [transactions]);

  const { accountsList, categoriesList } = useMemo(() => {
    const baseAccounts = [
      "Tunai", "Bank", "Qurban Aqiqah", "Yuran Keahlian", "Yuran Bulanan", "Khairat Kematian", "Sumbangan", "Sewaan Dewan", 
      "Sewaan Tapak", "Sewaan Mesin Minuman", "Pendapatan Program", "Faedah Bank", 
      "Bil Elektrik", "Bil Air", "Landskap", "Pembersihan", "Keselamatan", 
      "Program Komuniti", "Operasi Persatuan", "Caj Perkhidmatan", "Program"
    ];
    const baseCategories = [
      "Tunai", "Qurban Aqiqah", "Yuran Keahlian", "Yuran Bulanan", "Khairat Kematian", "Sumbangan", "Sewaan Dewan", "Sewaan Tapak", "Pembersihan",
      "Keselamatan", "Bil Elektrik", "Bil Air", "Landskap", "Program Komuniti", "Operasi Persatuan", "Pindahan Wang (Kontra)", "Caj Perkhidmatan", "Program"
    ];
    const dynamicAccounts = new Set(baseAccounts);
    const dynamicCategories = new Set(baseCategories);
    incomeCategories.forEach(cat => {
      dynamicAccounts.add(cat);
      dynamicCategories.add(cat);
    });
    expenseCategories.forEach(cat => {
      dynamicAccounts.add(cat);
      dynamicCategories.add(cat);
    });
    return {
      accountsList: Array.from(dynamicAccounts).sort(),
      categoriesList: Array.from(dynamicCategories).sort()
    };
  }, [incomeCategories, expenseCategories]);


  


  // Dynamic states for Balance Sheet items with Firestore sync
  const [fixedAssets, setFixedAssets] = useState<{ id: string; name: string; val: number }[]>([]);
  const [liabilitiesList, setLiabilitiesList] = useState<{ id: string; name: string; val: number }[]>([]);
  const [otherCurrentAssets, setOtherCurrentAssets] = useState<{ id: string; name: string; val: number }[]>([]);
  const [otherLiabilities, setOtherLiabilities] = useState<{ id: string; name: string; val: number }[]>([]);
  const [capitalList, setCapitalList] = useState<{ id: string; name: string; val: number }[]>([]);
  const [yuranConfig, setYuranConfig] = useState<YuranConfig | null>(null);

  // Real-time Firestore sync for Balance Sheet items
  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local') return;
    const unsub = onSnapshot(collection(db, 'kewanganBalanceSheet'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        val: Number(doc.data().val) || 0,
        type: doc.data().type || ''
      }));
      setFixedAssets(items.filter(item => item.type === 'fixed-assets'));
      setLiabilitiesList(items.filter(item => item.type === 'liabilities'));
      setOtherCurrentAssets(items.filter(item => item.type === 'current-assets'));
      setOtherLiabilities(items.filter(item => item.type === 'other-liabilities'));
      setCapitalList(items.filter(item => item.type === 'capital'));
    }, (error) => {
      console.warn("Ralat akses kewanganBalanceSheet:", error);
    });
    return () => unsub();
  }, [db, firebaseUser]);

  // Real-time Firestore sync for Yuran Config
  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local') return;
    const unsub = onSnapshot(doc(db, 'system', 'yuranConfig'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setYuranConfig({
          ...DEFAULT_YURAN_CONFIG,
          ...data,
          yuranKeahlian: { ...DEFAULT_YURAN_CONFIG.yuranKeahlian, ...(data.yuranKeahlian || {}) },
          yuranBulanan: { ...DEFAULT_YURAN_CONFIG.yuranBulanan, ...(data.yuranBulanan || {}) },
          yuranPenggal: { ...DEFAULT_YURAN_CONFIG.yuranPenggal, ...(data.yuranPenggal || {}) },
          yuranTahunan: { ...DEFAULT_YURAN_CONFIG.yuranTahunan, ...(data.yuranTahunan || {}) },
          additionalFees: data.additionalFees || [],
        } as YuranConfig);
      } else {
        setYuranConfig(DEFAULT_YURAN_CONFIG);
      }
    }, (error) => {
      console.warn("Ralat akses system/yuranConfig:", error);
    });
    return () => unsub();
  }, [db, firebaseUser]);

  // Real-time Firestore sync for closed sessions
  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local') return;
    const unsub = onSnapshot(doc(db, 'system', 'closedSessions'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.closedYears)) {
          setClosedYears(data.closedYears);
          localStorage.setItem('tmf2_closed_years', JSON.stringify(data.closedYears));
        }
      }
    }, (error) => {
      console.warn("Ralat akses system/closedSessions:", error);
    });
    return () => unsub();
  }, [db, firebaseUser]);

  // Auto-create new session and carry forward Tambahan Yuran Baru on 1 January if missing
  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local' || !yuranConfig) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const sesiList = yuranConfig.sesiList || [];
    
    // Check if current year session exists (e.g. from 1 January)
    const hasCurrentSession = sesiList.some(s => s.id === currentYear.toString() || s.startYear === currentYear);

    if (!hasCurrentSession && sesiList.length > 0) {
      const newSession = {
        id: currentYear.toString(),
        name: `Sesi ${currentYear}`,
        startMonth: 1, // Bermula 1 Januari hingga 31 Disember
        startYear: currentYear
      };
      const updatedSesiList = [...sesiList, newSession].sort((a, b) => a.startYear - b.startYear);
      
      // Auto-carry forward recurring Tambahan Yuran Baru from previous session
      const prevYearStr = (currentYear - 1).toString();
      const currentFees = yuranConfig.additionalFees || [];
      const newFeesToAdd: any[] = [];

      currentFees.forEach(fee => {
        const feeSession = fee.sessionYear || '';
        if (feeSession.includes(prevYearStr) || feeSession === prevYearStr) {
          const nextSessionName = `Sesi ${currentYear}`;
          const alreadyExists = currentFees.some(f => 
            f.title === fee.title && 
            f.sessionYear && 
            (f.sessionYear.includes(currentYear.toString()) || f.sessionYear === currentYear.toString())
          );
          if (!alreadyExists) {
            newFeesToAdd.push({
              ...fee,
              id: `fee-additional-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              sessionYear: nextSessionName
            });
          }
        }
      });

      const updatedFees = newFeesToAdd.length > 0 ? [...currentFees, ...newFeesToAdd] : currentFees;

      setDoc(doc(db, 'system', 'yuranConfig'), {
        sesiList: updatedSesiList,
        additionalFees: updatedFees
      }, { merge: true }).catch(err => {
        console.warn("Auto-create sesi baru 1 Januari gagal:", err);
      });
    }
  }, [db, firebaseUser, yuranConfig]);

  // Dynamically calculate baki bank & tunai based on transactions
  // Bank baki awal: 0, Tunai baki awal: 0
  const initialBank = 0;
  const initialTunai = 0;

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      // Month Filter
      if (filterMonth !== "All") {
        const m = txn.date.split('-')[1];
        if (m !== filterMonth) return false;
      }
      // Session Filter
      if (filterYear !== "All") {
        const txnYear = parseInt(txn.date.split('-')[0]);
        const filterY = parseInt(filterYear);
        const matchesDateYear = !isNaN(filterY) && txnYear === filterY;
        const matchesSession = txn.sessionYear === filterYear || 
                               (txn.sessionYear != null && txn.sessionYear.includes(filterYear));
        const isHijriOrSpecial = txn.category === "Qurban Aqiqah" || 
                                 (txn.sessionYear != null && (txn.sessionYear.includes('H') || txn.sessionYear.includes('144')));
        
        if (!matchesSession && !matchesDateYear && !isHijriOrSpecial) {
          return false;
        }
        if (!matchesSession && isHijriOrSpecial && !matchesDateYear) {
          return false;
        }
      }
      // Account Filter
      if (filterAccount !== "All") {
        if (txn.accountDebit !== filterAccount && txn.accountCredit !== filterAccount) return false;
      }
      // Category Filter
      if (filterCategory !== "All") {
        if (filterCategory === "Tunai") {
          if (txn.accountDebit !== "Tunai" && txn.accountCredit !== "Tunai" && txn.category !== "Tunai") return false;
        } else if (txn.category !== filterCategory && getTransactionGroupCategory(txn) !== filterCategory) {
          return false;
        }
      }
      // Type Filter (Debit vs Kredit)
      if (filterType !== "All") {
        const isDebitInflow = txn.accountDebit === 'Bank' || txn.accountDebit === 'Tunai';
        const isKreditOutflow = txn.accountCredit === 'Bank' || txn.accountCredit === 'Tunai';
        if (filterType === 'Debit' && !isDebitInflow) return false;
        if (filterType === 'Kredit' && !isKreditOutflow) return false;
      }
      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchDesc = txn.description.toLowerCase().includes(q);
        const matchId = txn.id.toLowerCase().includes(q);
        const matchCategory = txn.category.toLowerCase().includes(q);
        const matchVch = txn.voucherNo.toLowerCase().includes(q);
        const matchEmail = txn.memberEmail ? txn.memberEmail.toLowerCase().includes(q) : false;
        if (!matchDesc && !matchId && !matchCategory && !matchVch && !matchEmail) return false;
      }
      return true;
    });
  }, [transactions, filterMonth, filterYear, filterAccount, filterCategory, filterType, searchQuery]);

  // Categorize helper for accordion grouping
  const getTransactionGroupCategory = (txn: KewanganTransaction): string => {
    const cat = (txn.category || '').trim().toLowerCase();
    const desc = (txn.description || '').trim().toLowerCase();
    const notes = (txn.notes || '').trim().toLowerCase();
    const vch = (txn.voucherNo || '').trim().toLowerCase();

    // Check Qurban Aqiqah FIRST
    if (cat.includes('qurban') || cat.includes('aqiqah') || desc.includes('qurban') || desc.includes('aqiqah')) {
      return 'Qurban Aqiqah';
    }

    // Check Khairat Kematian
    if (cat.includes('khairat') || desc.includes('khairat') || desc.includes('kematian')) {
      if (desc.includes('penggal') || desc.includes('perpenggal') || desc.includes('6 bulan') || notes.includes('penggal') || cat.includes('penggal')) {
        return 'Khairat Kematian (Bayaran Perpenggal)';
      }
      if (desc.includes('tahunan') || desc.includes('setahun') || desc.includes('12 bulan') || notes.includes('tahunan') || cat.includes('tahunan')) {
        return 'Khairat Kematian (Bayaran Tahunan)';
      }
      if (desc.includes('bulanan') || notes.includes('bulanan') || cat.includes('bulanan')) {
        return 'Khairat Kematian (Bayaran Bulanan)';
      }
      return 'Khairat Kematian';
    }

    // Check Yuran Bulanan / Penggal / Tahunan
    if (cat.includes('bulanan') || cat.includes('penggal') || cat.includes('tahunan') || 
        desc.includes('yuran bulanan') || desc.includes('yuran penggal') || desc.includes('yuran tahunan') ||
        desc.includes('yuran (bulanan') || desc.includes('yuran (penggal') || desc.includes('yuran (tahunan')) {
      
      if (desc.includes('penggal') || desc.includes('perpenggal') || desc.includes('6 bulan') || notes.includes('penggal') || cat.includes('penggal')) {
        return 'Yuran Bulanan (Bayaran Perpenggal)';
      }
      if (desc.includes('tahunan') || desc.includes('setahun') || desc.includes('12 bulan') || notes.includes('tahunan') || cat.includes('tahunan')) {
        return 'Yuran Bulanan (Bayaran Tahunan)';
      }
      return 'Yuran Bulanan (Bayaran Bulanan)';
    }

    if (cat.includes('keahlian') || desc.includes('keahlian') || desc.includes('yuran keahlian')) {
      return 'Yuran Keahlian';
    }
    if (cat.includes('tambahan') || desc.includes('yuran tambahan')) {
      return 'Yuran Tambahan';
    }
    if (cat.includes('voucher') || cat.includes('baucar') || vch.startsWith('vch-') || desc.includes('voucher') || desc.includes('baucar')) {
      return 'Voucher';
    }

    // 6 Tabung Sumbangan Berasingan
    if (cat.includes('van jenazah') || desc.includes('van jenazah')) {
      return 'Tabung Van Jenazah';
    }
    if ((cat.includes('kebajikan') && cat.includes('khairat')) || desc.includes('kebajikan & khairat') || desc.includes('kebajikan dan khairat')) {
      return 'Tabung Kebajikan & Khairat';
    }
    if (cat.includes('surau') || desc.includes('pengimarahan surau') || cat.includes('surau & komuniti')) {
      return 'Tabung Surau & Komuniti';
    }
    if (cat.includes('fasiliti') || desc.includes('penyelenggaraan fasiliti') || cat.includes('fasiliti & taman')) {
      return 'Tabung Fasiliti & Taman';
    }
    if (cat.includes('kecemasan') || cat.includes('bencana') || desc.includes('kecemasan & bencana')) {
      return 'Tabung Kecemasan & Bencana';
    }
    if (cat.includes('pendidikan') || desc.includes('pendidikan') || desc.includes('pelajar') || cat.includes('pelajar') || desc.includes('tuisyen') || desc.includes('sekolah')) {
      return 'Tabung Pendidikan';
    }
    if (cat.includes('sumbangan am') || cat.includes('tabung am') || cat.includes('sumbangan') || cat.includes('infaq') || desc.includes('sumbangan am') || desc.includes('sumbangan ikhlas')) {
      return 'Tabung Sumbangan Am';
    }
    
    // Check if expense / pengeluaran
    const isExpense = (txn.accountCredit === 'Bank' || txn.accountCredit === 'Tunai') &&
                      txn.accountDebit !== 'Bank' && txn.accountDebit !== 'Tunai' &&
                      txn.category !== 'Pindahan Wang (Kontra)';

    if (isExpense || cat.includes('sewa') || cat.includes('pembersihan') || cat.includes('utiliti') || cat.includes('penyelenggaraan') || cat.includes('pengeluaran') || cat.includes('belanja')) {
      return 'Pengeluaran Lain';
    }

    return 'Lain-lain';
  };

  const accordionGroupedTransactions = useMemo(() => {
    if (!groupByCategoryAccordion) return [];

    const approvedFiltered = filteredTransactions.filter(txn => txn.approvalStatus !== 'Pending');

    const preferredOrder = [
      'Yuran Bulanan (Bayaran Bulanan)',
      'Yuran Bulanan (Bayaran Perpenggal)',
      'Yuran Bulanan (Bayaran Tahunan)',
      'Khairat Kematian (Bayaran Bulanan)',
      'Khairat Kematian (Bayaran Perpenggal)',
      'Khairat Kematian (Bayaran Tahunan)',
      'Khairat Kematian',
      'Yuran Keahlian',
      'Yuran Tambahan',
      'Qurban Aqiqah',
      'Tabung Van Jenazah',
      'Tabung Kebajikan & Khairat',
      'Tabung Surau & Komuniti',
      'Tabung Fasiliti & Taman',
      'Tabung Kecemasan & Bencana',
      'Tabung Pendidikan',
      'Tabung Sumbangan Am',
      'Voucher',
      'Pengeluaran Lain',
      'Lain-lain'
    ];

    const map: { [groupKey: string]: KewanganTransaction[] } = {};

    approvedFiltered.forEach(txn => {
      const groupName = getTransactionGroupCategory(txn);
      if (!map[groupName]) {
        map[groupName] = [];
      }
      map[groupName].push(txn);
    });

    const keys = Object.keys(map).sort((a, b) => {
      let indexA = preferredOrder.indexOf(a);
      let indexB = preferredOrder.indexOf(b);
      if (indexA === -1) indexA = 99;
      if (indexB === -1) indexB = 99;
      if (indexA !== indexB) return indexA - indexB;
      return a.localeCompare(b);
    });

    return keys.map(groupName => {
      const items = map[groupName];
      let totalDebit = 0;
      let totalCredit = 0;

      items.forEach(txn => {
        let debitAmount = 0;
        let creditAmount = 0;

        if (filterAccount === "Bank") {
          if (txn.accountDebit === "Bank") debitAmount = txn.amount;
          if (txn.accountCredit === "Bank") creditAmount = txn.amount;
        } else if (filterAccount === "Tunai") {
          if (txn.accountDebit === "Tunai") debitAmount = txn.amount;
          if (txn.accountCredit === "Tunai") creditAmount = txn.amount;
        } else {
          if (txn.category === "Pindahan Wang (Kontra)") {
            if (txn.accountDebit === "Tunai" && txn.accountCredit === "Bank") {
              debitAmount = txn.amount;
              creditAmount = txn.amount;
            } else {
              debitAmount = txn.amount;
              creditAmount = txn.amount;
            }
          } else {
            const isIncoming = txn.accountDebit === "Bank" || txn.accountDebit === "Tunai";
            if (isIncoming) debitAmount = txn.amount;
            else creditAmount = txn.amount;
          }
        }

        totalDebit += debitAmount;
        totalCredit += creditAmount;
      });

      return {
        groupName,
        items,
        totalDebit,
        totalCredit
      };
    });
  }, [filteredTransactions, groupByCategoryAccordion, filterAccount]);

  const accordionDateTimeGroupedTransactions = useMemo(() => {
    if (!groupByDateTimeAccordion) return [];

    const approvedFiltered = filteredTransactions.filter(txn => txn.approvalStatus !== 'Pending');

    const groupsMap: { [key: string]: KewanganTransaction[] } = {};

    approvedFiltered.forEach(txn => {
      const dateKey = txn.date || 'Lain-lain Tarikh';
      const timeKey = txn.time || '00:00';
      const groupKey = `${dateKey}___${timeKey}`;
      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = [];
      }
      groupsMap[groupKey].push(txn);
    });

    // Sort by Date & Time descending so latest is first
    const sortedGroupKeys = Object.keys(groupsMap).sort((a, b) => b.localeCompare(a));

    return sortedGroupKeys.map(key => {
      const [date, time] = key.split('___');
      const items = groupsMap[key];
      
      let totalDebit = 0;
      let totalCredit = 0;

      items.forEach(txn => {
        let debitAmount = 0;
        let creditAmount = 0;

        if (filterAccount === "Bank") {
          if (txn.accountDebit === "Bank") debitAmount = txn.amount;
          if (txn.accountCredit === "Bank") creditAmount = txn.amount;
        } else if (filterAccount === "Tunai") {
          if (txn.accountDebit === "Tunai") debitAmount = txn.amount;
          if (txn.accountCredit === "Tunai") creditAmount = txn.amount;
        } else {
          if (txn.category === "Pindahan Wang (Kontra)") {
            if (txn.accountDebit === "Tunai" && txn.accountCredit === "Bank") {
              debitAmount = txn.amount;
              creditAmount = txn.amount;
            } else {
              debitAmount = txn.amount;
              creditAmount = txn.amount;
            }
          } else {
            const isIncoming = txn.accountDebit === "Bank" || txn.accountDebit === "Tunai";
            if (isIncoming) debitAmount = txn.amount;
            else creditAmount = txn.amount;
          }
        }

        totalDebit += debitAmount;
        totalCredit += creditAmount;
      });

      return {
        date,
        time,
        groupName: `${date} • ${time}`,
        items,
        totalDebit,
        totalCredit
      };
    });
  }, [filteredTransactions, groupByDateTimeAccordion, filterAccount]);

  // Compute real-time values based on APPROVED transactions
  const approvedTxns = useMemo(() => {
    return transactions.filter(t => t.approvalStatus === 'Approved');
  }, [transactions]);

  // Filtered and approved transactions specifically for real-time charts analysis
  const approvedFilteredTxns = useMemo(() => {
    return filteredTransactions.filter(t => t.approvalStatus === 'Approved');
  }, [filteredTransactions]);

  const projectedCF = useMemo(() => {
    let balBank = initialBank;
    let balTunai = initialTunai;
    let pendingCount = 0;

    // Per-category/tabung/lejar breakdown
    const categoryBreakdown: { [category: string]: { bank: number; tunai: number } } = {};

    const trackableCategories = [
      'Qurban Aqiqah',
      'Tabung Van Jenazah',
      'Tabung Kebajikan & Khairat',
      'Tabung Surau & Komuniti',
      'Tabung Fasiliti & Taman',
      'Tabung Kecemasan & Bencana',
      'Tabung Pendidikan',
      'Tabung Sumbangan Am',
    ];

    approvedTxns.forEach(txn => {
      if (txn.category === "Baki Bawa Hadapan") return;
      const txnYear = parseInt(txn.date.split('-')[0]);
      const txnSession = txn.sessionYear ? parseInt(txn.sessionYear) : txnYear;

      if (txnSession <= parseInt(selectedCFYear)) {
        if (txn.accountDebit === "Bank") balBank += txn.amount;
        if (txn.accountCredit === "Bank") balBank -= txn.amount;
        if (txn.accountDebit === "Tunai") balTunai += txn.amount;
        if (txn.accountCredit === "Tunai") balTunai -= txn.amount;

        // Track per-category balance for tabung/fund categories
        const groupCat = getTransactionGroupCategory(txn);
        const catKey = trackableCategories.includes(groupCat) ? groupCat : 
                       (txn.category?.toLowerCase().includes('tambahan') || txn.description?.toLowerCase().includes('yuran tambahan')) ? 'Yuran Tambahan' :
                       null;
        
        if (catKey) {
          if (!categoryBreakdown[catKey]) {
            categoryBreakdown[catKey] = { bank: 0, tunai: 0 };
          }
          // Income to this fund
          if (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") {
            if (txn.accountDebit === "Bank") categoryBreakdown[catKey].bank += txn.amount;
            if (txn.accountDebit === "Tunai") categoryBreakdown[catKey].tunai += txn.amount;
          }
          // Expense from this fund
          if (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai") {
            if (txn.accountCredit === "Bank") categoryBreakdown[catKey].bank -= txn.amount;
            if (txn.accountCredit === "Tunai") categoryBreakdown[catKey].tunai -= txn.amount;
          }
        }
      }
    });

    // Also track additional fees from yuranConfig that have remaining balance
    if (yuranConfig?.additionalFees) {
      yuranConfig.additionalFees.forEach(fee => {
        const feeSession = fee.sessionYear || '';
        const feeSessionYear = feeSession.match(/\d{4}/)?.[0];
        if (feeSessionYear && parseInt(feeSessionYear) <= parseInt(selectedCFYear)) {
          const catKey = 'Yuran Tambahan';
          if (!categoryBreakdown[catKey]) {
            categoryBreakdown[catKey] = { bank: 0, tunai: 0 };
          }
          // Additional fees are tracked via transactions, no extra amount needed here
        }
      });
    }

    transactions.forEach(txn => {
      const txnYear = parseInt(txn.date.split('-')[0]);
      const txnSession = txn.sessionYear ? parseInt(txn.sessionYear) : txnYear;
      if (txnSession <= parseInt(selectedCFYear) && txn.approvalStatus === 'Pending') {
        pendingCount++;
      }
    });

    // Filter out categories with zero or negative balance
    const filteredBreakdown: { [category: string]: { bank: number; tunai: number; total: number } } = {};
    Object.entries(categoryBreakdown).forEach(([cat, bal]) => {
      const total = bal.bank + bal.tunai;
      if (total > 0) {
        filteredBreakdown[cat] = { ...bal, total };
      }
    });

    return { balBank, balTunai, total: balBank + balTunai, pendingCount, categoryBreakdown: filteredBreakdown };
  }, [transactions, approvedTxns, selectedCFYear, initialBank, initialTunai, yuranConfig]);

  // Pending transactions grouped by date and time
  const pendingGroups = useMemo(() => {
    const pendingTxns = transactions.filter(t => t.approvalStatus === 'Pending');
    const groupsMap: { [key: string]: KewanganTransaction[] } = {};

    pendingTxns.forEach(txn => {
      const dateKey = txn.date || 'Lain-lain Tarikh';
      const timeKey = txn.time || '00:00';
      const groupKey = `${dateKey}___${timeKey}`;
      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = [];
      }
      groupsMap[groupKey].push(txn);
    });

    const sortedGroupKeys = Object.keys(groupsMap).sort((a, b) => b.localeCompare(a));

    return sortedGroupKeys.map(key => {
      const [date, time] = key.split('___');
      const items = groupsMap[key];
      const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
      return {
        date,
        time,
        items,
        totalAmount
      };
    });
  }, [transactions]);

  // Shared transaction row renderer for flat table & accordion table
  const renderTransactionRow = (txn: KewanganTransaction) => {
    let debitAmount: number | null = null;
    let creditAmount: number | null = null;

    if (filterAccount === "Bank") {
      if (txn.accountDebit === "Bank") debitAmount = txn.amount;
      if (txn.accountCredit === "Bank") creditAmount = txn.amount;
    } else if (filterAccount === "Tunai") {
      if (txn.accountDebit === "Tunai") debitAmount = txn.amount;
      if (txn.accountCredit === "Tunai") creditAmount = txn.amount;
    } else {
      if (txn.category === "Pindahan Wang (Kontra)") {
        if (txn.accountDebit === "Tunai" && txn.accountCredit === "Bank") {
          debitAmount = txn.amount;
          creditAmount = txn.amount;
        } else {
          debitAmount = txn.amount;
          creditAmount = txn.amount;
        }
      } else {
        const isIncoming = txn.accountDebit === "Bank" || txn.accountDebit === "Tunai";
        if (isIncoming) debitAmount = txn.amount;
        else creditAmount = txn.amount;
      }
    }

    return (
      <tr 
        key={txn.id} 
        onClick={() => {
          setSelectedTxn(txn);
          setShowDetailModal(true);
        }}
        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
      >
        <td className="py-3.5 px-4">
          <p className="font-extrabold text-slate-900">{txn.date}</p>
          <p className="text-[9px] text-slate-400 font-bold mt-0.5">{txn.time}</p>
        </td>
        <td className="py-3.5 px-4">
          <span className="font-mono text-[10px] font-extrabold bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded text-slate-700 block w-fit">
            {txn.id}
          </span>
          <span className="text-[9px] text-slate-400 font-bold mt-1 block">
            Voucher: {txn.voucherNo}
          </span>
          {txn.memberEmail && (() => {
            const memberUser = allUsers?.find(u => u.email === txn.memberEmail);
            const memberName = memberUser?.displayName || txn.memberEmail;
            const memberNoRumah = memberUser?.noRumah;
            return (
              <>
                <span className="text-[8px] font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded mt-1.5 block w-fit truncate max-w-[125px]" title={memberName}>
                  Ahli: {memberName}
                </span>
                {memberNoRumah && (
                  <span className="text-[8px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded mt-1 block w-fit">
                    No Rumah: {memberNoRumah}
                  </span>
                )}
              </>
            );
          })()}
        </td>
        <td className="py-3.5 px-4">
          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border inline-block shadow-3xs ${getCategoryBadgeStyle(txn.category)}`}>
            {txn.category}
          </span>
          <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400 font-bold">
            <span>Db: {txn.accountDebit}</span>
            <span>•</span>
            <span>Cr: {txn.accountCredit}</span>
          </div>
        </td>
        <td className="py-3.5 px-4 max-w-xs">
          <p className="text-slate-800 font-semibold truncate">{txn.description}</p>
          {txn.notes && <p className="text-[9px] text-amber-600 font-bold mt-0.5 truncate">📌 {txn.notes}</p>}
          {txn.aiNotes && (
            <p className="text-[8.5px] text-purple-700 font-bold mt-0.5 truncate flex items-center gap-1" title={txn.aiNotes}>
              <Sparkles size={10} className="text-purple-600 shrink-0" />
              <span>AI: {txn.aiNotes}</span>
            </p>
          )}
        </td>
        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
          {debitAmount ? `+${debitAmount.toFixed(2)}` : '-'}
        </td>
        <td className="py-3.5 px-4 text-right font-bold text-rose-500">
          {creditAmount ? `-${creditAmount.toFixed(2)}` : '-'}
        </td>
        <td className="py-3.5 px-4 text-center">
          <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
            txn.approvalStatus === 'Approved' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
              : txn.approvalStatus === 'Pending'
                ? 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            {txn.approvalStatus === 'Approved' ? 'Lulus' : txn.approvalStatus === 'Pending' ? 'Pending' : 'Ditolak'}
          </span>

          {txn.aiVerified && (
            <div className="mt-1 flex items-center justify-center">
              <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200" title={txn.aiNotes || 'Resit disahkan oleh AI Vision'}>
                <Sparkles size={9} className="text-purple-600" />
                <span>AI RM{(txn.aiDetectedAmount ?? txn.amount).toFixed(2)}</span>
              </span>
            </div>
          )}
        </td>
        <td className="py-3.5 px-4 text-center">
          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => handleOpenEdit(txn, e)}
              disabled={processingTxnId !== null}
              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
              title="Edit Transaksi"
            >
              <Edit size={13} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReceiptTxn(txn);
                setShowReceiptModal(true);
              }}
              className={`p-1 hover:bg-slate-100 rounded-md transition-colors cursor-pointer ${
                txn.receiptAttachment ? 'text-indigo-600 hover:text-indigo-800 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
              title={txn.receiptAttachment ? "Lihat Resit Bukti Bayaran" : "Lihat Transaksi / Resit Bukti Bayaran"}
            >
              <Eye size={13} />
            </button>
            {txn.approvalStatus === 'Approved' && (
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await generateReceiptPdf(txn, allUsers || []);
                  } catch (err) {
                    console.error(err);
                    alert("Gagal memuat turun resit.");
                  }
                }}
                className="p-1 hover:bg-slate-100 text-[#3f3ebd] hover:text-indigo-800 rounded-md transition-colors cursor-pointer"
                title="Muat turun Resit PDF"
              >
                <Download size={13} />
              </button>
            )}
            <button 
              onClick={(e) => handleDeleteTransaction(txn.id, e)}
              disabled={processingTxnId !== null}
              className="p-1 hover:bg-slate-100 text-rose-500 hover:text-rose-700 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
              title="Padam"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // 1. Chart statistics & data memos
  const analysisSummary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let transactionCount = approvedFilteredTxns.length;
    
    approvedFilteredTxns.forEach(txn => {
      const isInternalTransfer = 
        (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
        (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
      if (!isInternalTransfer) {
        const isCasPerkhidmatanIncome = txn.category === "Caj Perkhidmatan" && (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai");
        const isCasPerkhidmatanExpense = txn.category === "Caj Perkhidmatan" && (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
        
        if (isCasPerkhidmatanIncome || (txn.category !== "Caj Perkhidmatan" && incomeCategories.includes(txn.category))) {
          totalIncome += txn.amount;
        } else if (isCasPerkhidmatanExpense || (txn.category !== "Caj Perkhidmatan" && expenseCategories.includes(txn.category))) {
          totalExpense += txn.amount;
        }
      }
    });

    const netSurplus = totalIncome - totalExpense;
    const avgTxnAmount = transactionCount > 0 
      ? approvedFilteredTxns.reduce((sum, t) => sum + t.amount, 0) / transactionCount 
      : 0;

    return {
      totalIncome,
      totalExpense,
      netSurplus,
      avgTxnAmount,
      transactionCount
    };
  }, [approvedFilteredTxns, incomeCategories, expenseCategories]);

  // 2. Trend Data (Chronological/Daily/Monthly)
  const chartTrendData = useMemo(() => {
    // If a specific month is selected (not "All"), group by individual days for high fidelity
    if (filterMonth !== "All") {
      const daysMap: Record<string, { label: string; dayNum: number; Pendapatan: number; Perbelanjaan: number }> = {};
      const monthNamesShort = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
      const mIdx = parseInt(filterMonth) - 1;
      const mName = monthNamesShort[mIdx] || filterMonth;

      approvedFilteredTxns.forEach(txn => {
        const parts = txn.date.split('-');
        if (parts.length >= 3) {
          const dayNum = parseInt(parts[2]);
          const label = `${dayNum} ${mName}`;
          
          if (!daysMap[label]) {
            daysMap[label] = { label, dayNum, Pendapatan: 0, Perbelanjaan: 0 };
          }
          
          const isInternalTransfer = 
            (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
            (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
          
          if (!isInternalTransfer) {
            const isCasPerkhidmatanIncome = txn.category === "Caj Perkhidmatan" && (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai");
            const isCasPerkhidmatanExpense = txn.category === "Caj Perkhidmatan" && (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
            
            if (isCasPerkhidmatanIncome || (txn.category !== "Caj Perkhidmatan" && incomeCategories.includes(txn.category))) {
              daysMap[label].Pendapatan += txn.amount;
            } else if (isCasPerkhidmatanExpense || (txn.category !== "Caj Perkhidmatan" && expenseCategories.includes(txn.category))) {
              daysMap[label].Perbelanjaan += txn.amount;
            }
          }
        }
      });
      
      return Object.values(daysMap).sort((a, b) => a.dayNum - b.dayNum);
    } else {
      // Group by Month
      const monthsMap: Record<string, { label: string; monthIdx: number; Pendapatan: number; Perbelanjaan: number }> = {};
      const monthNamesShort = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
      
      approvedFilteredTxns.forEach(txn => {
        const parts = txn.date.split('-');
        if (parts.length >= 2) {
          const mIdx = parseInt(parts[1]) - 1;
          const label = monthNamesShort[mIdx] || parts[1];
          
          if (!monthsMap[label]) {
            monthsMap[label] = { label, monthIdx: mIdx, Pendapatan: 0, Perbelanjaan: 0 };
          }
          
          const isInternalTransfer = 
            (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
            (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
          
          if (!isInternalTransfer) {
            const isCasPerkhidmatanIncome = txn.category === "Caj Perkhidmatan" && (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai");
            const isCasPerkhidmatanExpense = txn.category === "Caj Perkhidmatan" && (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
            
            if (isCasPerkhidmatanIncome || (txn.category !== "Caj Perkhidmatan" && incomeCategories.includes(txn.category))) {
              monthsMap[label].Pendapatan += txn.amount;
            } else if (isCasPerkhidmatanExpense || (txn.category !== "Caj Perkhidmatan" && expenseCategories.includes(txn.category))) {
              monthsMap[label].Perbelanjaan += txn.amount;
            }
          }
        }
      });
      
      return Object.values(monthsMap).sort((a, b) => a.monthIdx - b.monthIdx);
    }
  }, [approvedFilteredTxns, filterMonth, incomeCategories, expenseCategories]);

  // 3. Income Breakdown Data
  const chartIncomeCategoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    approvedFilteredTxns.forEach(txn => {
      const isInternalTransfer = 
        (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
        (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
      const isCasPerkhidmatanIncome = txn.category === "Caj Perkhidmatan" && (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai");
      if (!isInternalTransfer && (isCasPerkhidmatanIncome || (txn.category !== "Caj Perkhidmatan" && incomeCategories.includes(txn.category)))) {
        catMap[txn.category] = (catMap[txn.category] || 0) + txn.amount;
      }
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [approvedFilteredTxns, incomeCategories]);

  // 4. Expense Breakdown Data
  const chartExpenseCategoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    approvedFilteredTxns.forEach(txn => {
      const isInternalTransfer = 
        (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
        (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
      const isCasPerkhidmatanExpense = txn.category === "Caj Perkhidmatan" && (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
      if (!isInternalTransfer && (isCasPerkhidmatanExpense || (txn.category !== "Caj Perkhidmatan" && expenseCategories.includes(txn.category)))) {
        catMap[txn.category] = (catMap[txn.category] || 0) + txn.amount;
      }
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [approvedFilteredTxns, expenseCategories]);

  // 5. Channel (Bank vs Tunai) Flow Data
  const chartChannelData = useMemo(() => {
    let bankIn = 0;
    let bankOut = 0;
    let cashIn = 0;
    let cashOut = 0;
    
    approvedFilteredTxns.forEach(txn => {
      const isInternalTransfer = 
        (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
        (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
      if (!isInternalTransfer) {
        if (txn.accountDebit === "Bank") bankIn += txn.amount;
        if (txn.accountCredit === "Bank") bankOut += txn.amount;
        if (txn.accountDebit === "Tunai") cashIn += txn.amount;
        if (txn.accountCredit === "Tunai") cashOut += txn.amount;
      }
    });
    
    return [
      { name: 'Bank', Aliran_Masuk: bankIn, Aliran_Keluar: bankOut },
      { name: 'Tunai Runcit', Aliran_Masuk: cashIn, Aliran_Keluar: cashOut }
    ];
  }, [approvedFilteredTxns]);

  // Helper to extract 4-digit session year from transaction
  const getTxnSessionYearNum = (txn: KewanganTransaction): number => {
    if (txn.sessionYear) {
      const match = String(txn.sessionYear).match(/\d{4}/);
      if (match) return parseInt(match[0], 10);
    }
    const y = parseInt((txn.date || '').split('-')[0], 10);
    return !isNaN(y) ? y : new Date().getFullYear();
  };

  // Calculate dynamic Baki Awal (Bank & Tunai) based on filters
  const bakiAwalBreakdown = useMemo(() => {
    let balBank = initialBank;
    let balTunai = initialTunai;

    if (filterYear !== "All") {
      const selectedSession = parseInt(filterYear, 10);
      const matchedSesi = yuranConfig?.sesiList?.find(
        s => s.id === filterYear || String(s.startYear) === filterYear || (s.name && s.name.includes(filterYear))
      );
      const startM = matchedSesi?.startMonth ?? 1;
      const getSessionMonthOrder = (m: number) => (m >= startM ? m - startM + 1 : m + 12 - startM + 1);

      // Check if there are non-CF transactions in prior sessions
      const priorNonCfTxns = approvedTxns.filter(
        t => t.category !== "Baki Bawa Hadapan" && getTxnSessionYearNum(t) < selectedSession
      );
      // Check if there are explicit Baki Bawa Hadapan transactions for selectedSession
      const currentCfTxns = approvedTxns.filter(
        t => t.category === "Baki Bawa Hadapan" && getTxnSessionYearNum(t) === selectedSession
      );

      if (currentCfTxns.length > 0) {
        currentCfTxns.forEach(t => {
          if (t.accountDebit === "Bank") balBank += t.amount;
          if (t.accountCredit === "Bank") balBank -= t.amount;
          if (t.accountDebit === "Tunai") balTunai += t.amount;
          if (t.accountCredit === "Tunai") balTunai -= t.amount;
        });
      } else if (priorNonCfTxns.length > 0) {
        priorNonCfTxns.forEach(t => {
          if (t.accountDebit === "Bank") balBank += t.amount;
          if (t.accountCredit === "Bank") balBank -= t.amount;
          if (t.accountDebit === "Tunai") balTunai += t.amount;
          if (t.accountCredit === "Tunai") balTunai -= t.amount;
        });
      }

      // If a specific month is selected within the session, add transactions from earlier months in the same session
      if (filterMonth !== "All") {
        const filterMonthOrder = getSessionMonthOrder(parseInt(filterMonth, 10));
        approvedTxns.forEach(txn => {
          if (txn.category === "Baki Bawa Hadapan") return;
          const txnSession = getTxnSessionYearNum(txn);
          if (txnSession === selectedSession) {
            const txnMonth = parseInt((txn.date || '').split('-')[1], 10);
            if (!isNaN(txnMonth) && getSessionMonthOrder(txnMonth) < filterMonthOrder) {
              if (txn.accountDebit === "Bank") balBank += txn.amount;
              if (txn.accountCredit === "Bank") balBank -= txn.amount;
              if (txn.accountDebit === "Tunai") balTunai += txn.amount;
              if (txn.accountCredit === "Tunai") balTunai -= txn.amount;
            }
          }
        });
      }
    } else {
      // When filterYear === "All", include any initial Baki Bawa Hadapan from the earliest session if no prior txns exist
      const allNonCfYears = approvedTxns
        .filter(t => t.category !== "Baki Bawa Hadapan")
        .map(t => getTxnSessionYearNum(t));
      const minNonCfYear = allNonCfYears.length > 0 ? Math.min(...allNonCfYears) : Infinity;

      approvedTxns.forEach(txn => {
        if (txn.category === "Baki Bawa Hadapan") {
          const cfYear = getTxnSessionYearNum(txn);
          if (cfYear <= minNonCfYear) {
            if (txn.accountDebit === "Bank") balBank += txn.amount;
            if (txn.accountCredit === "Bank") balBank -= txn.amount;
            if (txn.accountDebit === "Tunai") balTunai += txn.amount;
            if (txn.accountCredit === "Tunai") balTunai -= txn.amount;
          }
        }
      });
    }

    return {
      bank: balBank,
      tunai: balTunai,
      total: balBank + balTunai
    };
  }, [approvedTxns, filterYear, filterMonth, yuranConfig]);

  const bakiAwal = useMemo(() => {
    if (filterAccount === "Bank") return bakiAwalBreakdown.bank;
    if (filterAccount === "Tunai") return bakiAwalBreakdown.tunai;
    return bakiAwalBreakdown.total;
  }, [bakiAwalBreakdown, filterAccount]);

  // General statistics
  const totals = useMemo(() => {
    let currentBank = bakiAwalBreakdown.bank;
    let currentTunai = bakiAwalBreakdown.tunai;
    let totalIncomeThisMonth = 0;
    let totalExpenseThisMonth = 0;

    const currentDate = new Date();
    const currentM = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentY = String(currentDate.getFullYear());
    const targetM = filterMonth !== "All" ? filterMonth : currentM;

    // Accumulate balances for the active period (session & month)
    approvedTxns.forEach(txn => {
      if (txn.category === "Baki Bawa Hadapan") return;

      // Check if transaction belongs to current filterYear & filterMonth period
      let inSelectedPeriod = true;
      if (filterYear !== "All") {
        const txnYear = parseInt((txn.date || '').split('-')[0], 10);
        const filterY = parseInt(filterYear, 10);
        const matchesDateYear = !isNaN(filterY) && txnYear === filterY;
        const matchesSession = txn.sessionYear === filterYear ||
                               (txn.sessionYear != null && txn.sessionYear.includes(filterYear));
        const isHijriOrSpecial = txn.category === "Qurban Aqiqah" ||
                                 (txn.sessionYear != null && (txn.sessionYear.includes('H') || txn.sessionYear.includes('144')));
        if (!matchesSession && !matchesDateYear && !isHijriOrSpecial) {
          inSelectedPeriod = false;
        } else if (!matchesSession && isHijriOrSpecial && !matchesDateYear) {
          inSelectedPeriod = false;
        }
      }
      if (inSelectedPeriod && filterMonth !== "All") {
        const m = (txn.date || '').split('-')[1];
        if (m !== filterMonth) inSelectedPeriod = false;
      }

      if (inSelectedPeriod) {
        if (txn.accountDebit === "Bank") currentBank += txn.amount;
        if (txn.accountCredit === "Bank") currentBank -= txn.amount;
        if (txn.accountDebit === "Tunai") currentTunai += txn.amount;
        if (txn.accountCredit === "Tunai") currentTunai -= txn.amount;
      }

      const isInternalTransfer = 
        (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
        (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");

      const isCasPerkhidmatanIncome = txn.category === "Caj Perkhidmatan" && (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai");
      const isCasPerkhidmatanExpense = txn.category === "Caj Perkhidmatan" && (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");

      const isIncome = (isCasPerkhidmatanIncome || (txn.category !== "Caj Perkhidmatan" && incomeCategories.includes(txn.category))) && !isInternalTransfer;
      const isExpense = (isCasPerkhidmatanExpense || (txn.category !== "Caj Perkhidmatan" && expenseCategories.includes(txn.category))) && !isInternalTransfer;

      // Determine if transaction is in the target month/year for statistics
      const txnParts = (txn.date || '').split('-');
      if (txnParts.length >= 2) {
        const txnYear = txnParts[0];
        const txnMonth = txnParts[1];
        
        let isTargetMonth = (txnMonth === targetM);
        
        if (isTargetMonth) {
          if (filterYear !== "All") {
            const txnY = parseInt(txnYear);
            const filterY = parseInt(filterYear);
            const matchesDateYear = !isNaN(filterY) && txnY === filterY;
            const matchesSession = txn.sessionYear === filterYear || 
                                   (txn.sessionYear != null && txn.sessionYear.includes(filterYear));
            const isHijriOrSpecial = txn.category === "Qurban Aqiqah" || 
                                     (txn.sessionYear != null && (txn.sessionYear.includes('H') || txn.sessionYear.includes('144')));
            if (!matchesSession && !matchesDateYear && !isHijriOrSpecial) {
              isTargetMonth = false;
            } else if (!matchesSession && isHijriOrSpecial && !matchesDateYear) {
              isTargetMonth = false;
            }
          } else if (filterMonth === "All") {
            if (txnYear !== currentY) {
              isTargetMonth = false;
            }
          }
        }

        if (isTargetMonth) {
          if (isIncome) totalIncomeThisMonth += txn.amount;
          if (isExpense) totalExpenseThisMonth += txn.amount;
        }
      }
    });

    return {
      currentBank,
      currentTunai,
      totalIncomeThisMonth,
      totalExpenseThisMonth,
      balanceSemasa: currentBank + currentTunai,
      totalTransactionsCount: filteredTransactions.length
    };
  }, [approvedTxns, filteredTransactions, incomeCategories, expenseCategories, filterMonth, filterYear, bakiAwalBreakdown]);

  // Profit and Loss Breakdown
  const profitLossData = useMemo(() => {
    const incomes: { [cat: string]: number } = {};
    const expenses: { [cat: string]: number } = {};

    const filteredApprovedTxns = filteredTransactions.filter(t => t.approvalStatus === 'Approved');

    filteredApprovedTxns.forEach(txn => {
      if (txn.category === "Baki Bawa Hadapan" || txn.category === "Pindahan Wang (Kontra)" || txn.category === "Kontra") return;

      const isInternalTransfer = 
        (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
        (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");

      const isCasPerkhidmatanIncome = txn.category === "Caj Perkhidmatan" && (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai");
      const isCasPerkhidmatanExpense = txn.category === "Caj Perkhidmatan" && (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");

      const isIncome = (isCasPerkhidmatanIncome || (txn.category !== "Caj Perkhidmatan" && incomeCategories.includes(txn.category))) && !isInternalTransfer;
      const isExpense = (isCasPerkhidmatanExpense || (txn.category !== "Caj Perkhidmatan" && expenseCategories.includes(txn.category))) && !isInternalTransfer;
      if (isIncome) {
        if (filterAccount !== "All" && txn.accountDebit !== filterAccount) {
          return;
        }
        incomes[txn.category] = (incomes[txn.category] || 0) + txn.amount;
      } else if (isExpense) {
        if (filterAccount !== "All" && txn.accountCredit !== filterAccount) {
          return;
        }
        expenses[txn.category] = (expenses[txn.category] || 0) + txn.amount;
      }
    });

    const totalIncome = Object.values(incomes).reduce((sum, v) => sum + v, 0);
    const totalExpense = Object.values(expenses).reduce((sum, v) => sum + v, 0);
    const surplus = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? (surplus / totalIncome) * 100 : 0;

    return {
      incomes,
      expenses,
      totalIncome,
      totalExpense,
      surplus,
      margin
    };
  }, [filteredTransactions, incomeCategories, expenseCategories, filterAccount]);

  // Balance Sheet Sections
  const balanceSheetData = useMemo(() => {
    let cashAssetAmount = totals.balanceSemasa;
    if (filterAccount === "Bank") {
      cashAssetAmount = totals.currentBank;
    } else if (filterAccount === "Tunai") {
      cashAssetAmount = totals.currentTunai;
    }

    const totalAsetSemasa = cashAssetAmount + otherCurrentAssets.reduce((sum, a) => sum + a.val, 0);
    const totalAsetBukanSemasa = fixedAssets.reduce((sum, a) => sum + a.val, 0);
    const totalAset = totalAsetSemasa + totalAsetBukanSemasa;

    const totalLiabiliti = liabilitiesList.reduce((sum, l) => sum + l.val, 0) + otherLiabilities.reduce((sum, l) => sum + l.val, 0);
    const totalDanaAsal = capitalList.reduce((sum, c) => sum + c.val, 0);
    
    // Total Dana Persatuan includes Baki Awal (Bawa Hadapan), manual capital items, and Surplus/Deficit from current period
    const totalDana = totalDanaAsal + bakiAwal + profitLossData.surplus;
    const totalLiabilitiDanDana = totalLiabiliti + totalDana;

    const isBalanced = Math.abs(totalAset - totalLiabilitiDanDana) < 0.01;

    return {
      asetSemasa: totalAsetSemasa,
      asetBukanSemasa: totalAsetBukanSemasa,
      totalAset,
      liabiliti: totalLiabiliti,
      bakiBawaHadapan: bakiAwal,
      danaPersatuan: totalDana,
      totalLiabilitiDanDana,
      isBalanced
    };
  }, [totals, profitLossData, fixedAssets, liabilitiesList, otherCurrentAssets, otherLiabilities, capitalList, filterAccount, bakiAwal]);

  // Cash Flow / Pergerakan Tunai calculation
  const cashFlowData = useMemo(() => {
    const inflows: { name: string; amount: number }[] = [];
    const outflows: { name: string; amount: number }[] = [];
    let totalInflow = 0;
    let totalOutflow = 0;

    // Get the filtered transactions for the active session and month (approved only)
    const filteredApprovedTxns = filteredTransactions.filter(t => t.approvalStatus === 'Approved');

    // Calculate normal incomes and expenses first
    incomeCategories.forEach(cat => {
      const amt = profitLossData.incomes[cat] || 0;
      if (amt > 0) {
        inflows.push({ name: `Kutipan ${cat}`, amount: amt });
        totalInflow += amt;
      }
    });

    expenseCategories.forEach(cat => {
      const amt = profitLossData.expenses[cat] || 0;
      if (amt > 0) {
        outflows.push({ name: `Bayaran ${cat}`, amount: amt });
        totalOutflow += amt;
      }
    });

    // If filterAccount is active, also add Contra transfers to inflows/outflows!
    if (filterAccount === "Bank") {
      let contraInflow = 0; // Tunai -> Bank (Debit Bank)
      let contraOutflow = 0; // Bank -> Tunai (Credit Bank)
      
      filteredApprovedTxns.forEach(txn => {
        if (txn.category === "Pindahan Wang (Kontra)") {
          if (txn.accountDebit === "Bank") {
            contraInflow += txn.amount;
          }
          if (txn.accountCredit === "Bank") {
            contraOutflow += txn.amount;
          }
        }
      });

      if (contraInflow > 0) {
        inflows.push({ name: "Deposit Tunai (Kontra)", amount: contraInflow });
        totalInflow += contraInflow;
      }
      if (contraOutflow > 0) {
        outflows.push({ name: "Ambilan Tunai (Kontra)", amount: contraOutflow });
        totalOutflow += contraOutflow;
      }
    } else if (filterAccount === "Tunai") {
      let contraInflow = 0; // Bank -> Tunai (Debit Tunai)
      let contraOutflow = 0; // Tunai -> Bank (Credit Tunai)

      filteredApprovedTxns.forEach(txn => {
        if (txn.category === "Pindahan Wang (Kontra)") {
          if (txn.accountDebit === "Tunai") {
            contraInflow += txn.amount;
          }
          if (txn.accountCredit === "Tunai") {
            contraOutflow += txn.amount;
          }
        }
      });

      if (contraInflow > 0) {
        inflows.push({ name: "Ambilan Tunai dari Bank (Kontra)", amount: contraInflow });
        totalInflow += contraInflow;
      }
      if (contraOutflow > 0) {
        outflows.push({ name: "Deposit Tunai ke Bank (Kontra)", amount: contraOutflow });
        totalOutflow += contraOutflow;
      }
    }

    const netChange = totalInflow - totalOutflow;
    const bakiAkhir = bakiAwal + netChange;

    return {
      inflows,
      outflows,
      totalInflow,
      totalOutflow,
      netChange,
      bakiAkhir
    };
  }, [filteredTransactions, profitLossData, filterAccount, bakiAwal, incomeCategories, expenseCategories]);

  // Helper to generate collision-free sequential TXN & VCH IDs
  const generateNextTxnAndVoucherId = (yearStr?: string) => {
    const targetYear = yearStr || (filterYear !== "All" ? filterYear : String(new Date().getFullYear()));
    let maxNum = transactions.length;
    transactions.forEach(t => {
      const mTxn = t.id?.match(/^TXN-\d{4}-(\d+)$/);
      if (mTxn) {
        const n = parseInt(mTxn[1], 10);
        if (n > maxNum) maxNum = n;
      }
      const mVch = t.voucherNo?.match(/^VCH-\d{4}-(\d+)$/);
      if (mVch) {
        const n = parseInt(mVch[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const nextNum = maxNum + 1;
    return {
      nextTxnId: `TXN-${targetYear}-${String(nextNum).padStart(4, '0')}`,
      nextVchId: `VCH-${targetYear}-${String(nextNum).padStart(4, '0')}`
    };
  };

  // CRUD Actions
  const handleOpenAdd = () => {
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const nowTime = now.toTimeString().slice(0, 5);
    setIsEditMode(false);
    setFormTxnType('standard');
    setFormContraDirection('bank_to_cash');
    setFormDate(todayIso);
    setFormTime(nowTime);
    setFormDebitAccount("Bank");
    setFormCreditAccount("Yuran Bulanan");
    setFormAmount("150.00");
    setFormDescription("");
    setFormCategory("Yuran Bulanan");
    setFormNotes("");
    setFormStatus("Approved");
    
    const { nextVchId } = generateNextTxnAndVoucherId(todayIso.split('-')[0]);
    setFormVoucherNo(nextVchId);
    
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (txn: KewanganTransaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    setSelectedTxn(txn);
    if (txn.category === "Pindahan Wang (Kontra)") {
      setFormTxnType('contra');
      if (txn.accountDebit === 'Tunai' && txn.accountCredit === 'Bank') {
        setFormContraDirection('bank_to_cash');
      } else {
        setFormContraDirection('cash_to_bank');
      }
    } else {
      setFormTxnType('standard');
    }
    setFormDate(txn.date);
    setFormTime(txn.time);
    setFormDebitAccount(txn.accountDebit);
    setFormCreditAccount(txn.accountCredit);
    setFormAmount(txn.amount.toString());
    setFormDescription(txn.description);
    setFormCategory(txn.category);
    setFormNotes(txn.notes || "");
    setFormStatus(txn.approvalStatus);
    setFormVoucherNo(txn.voucherNo);
    setShowAddEditModal(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount) || 0;
    if (parsedAmount <= 0) {
      alert("Amaun mestilah bernilai positif!");
      return;
    }

    const isInternalTransfer = 
      (formDebitAccount === "Bank" || formDebitAccount === "Tunai") && 
      (formCreditAccount === "Bank" || formCreditAccount === "Tunai");
    
    const finalCategory = isInternalTransfer ? "Pindahan Wang (Kontra)" : formCategory;
    const actorName = `${currentUserDoc?.displayName || currentUserDoc?.nickname || currentUserDoc?.email || "Bendahari"} (${currentUserDoc?.role || "Pentadbir"})`;

    setIsSavingTxn(true);
    try {
      if (isEditMode && selectedTxn) {
        // Edit mode
        const updatedTxn: KewanganTransaction = {
          ...selectedTxn,
          date: formDate,
          time: formTime,
          accountDebit: formDebitAccount,
          accountCredit: formCreditAccount,
          amount: parsedAmount,
          description: formDescription,
          category: finalCategory,
          notes: formNotes,
          approvalStatus: formStatus,
          sessionYear: selectedTxn.sessionYear || (filterYear !== "All" ? filterYear : (formDate.split('-')[0] || "2026")),
          approvedBy: formStatus === 'Approved' ? (selectedTxn.approvedBy || actorName) : undefined,
          approvedDate: formStatus === 'Approved' ? formDate : undefined,
          auditTrail: [
            ...selectedTxn.auditTrail,
            { 
              time: new Date().toISOString().replace('T', ' ').slice(0, 16), 
              user: actorName, 
              action: `Mengemaskini transaksi. Status: ${formStatus}` 
            }
          ]
        };
        await setDoc(doc(db, 'kewanganTransactions', selectedTxn.id), cleanUndefined(updatedTxn));

        // Sync user packages if status is modified
        if (selectedTxn.memberEmail && selectedTxn.paidPackageIds && selectedTxn.paidPackageIds.length > 0) {
          const userDoc = allUsers?.find(u => u.email === selectedTxn.memberEmail);
          if (userDoc) {
            const currentPaidIds = userDoc.paidPackageIds || [];
            let updatedPaidIds = [...currentPaidIds];

            if (formStatus === 'Approved') {
              updatedPaidIds = Array.from(new Set([...currentPaidIds, ...selectedTxn.paidPackageIds]));
            } else {
              updatedPaidIds = currentPaidIds.filter(pid => !selectedTxn.paidPackageIds?.includes(pid));
            }

            await updateDoc(doc(db, 'users', userDoc.uid), {
              paidPackageIds: updatedPaidIds
            }).catch(err => console.error("Error updating member packages on edit save:", err));
          }
        }
      } else {
        // Add mode
        const txnYearStr = formDate.split('-')[0] || (filterYear !== "All" ? filterYear : "2026");
        const { nextTxnId, nextVchId } = generateNextTxnAndVoucherId(txnYearStr);
        const finalVchId = formVoucherNo || nextVchId;

        const newTxn: KewanganTransaction = {
          id: nextTxnId,
          voucherNo: finalVchId,
          date: formDate,
          time: formTime,
          accountDebit: formDebitAccount,
          accountCredit: formCreditAccount,
          amount: parsedAmount,
          description: formDescription,
          category: finalCategory,
          recordedBy: actorName,
          approvalStatus: formStatus,
          notes: formNotes,
          sessionYear: filterYear !== "All" ? filterYear : txnYearStr,
          approvedBy: formStatus === 'Approved' ? actorName : undefined,
          approvedDate: formStatus === 'Approved' ? formDate : undefined,
          auditTrail: [
            { 
              time: new Date().toISOString().replace('T', ' ').slice(0, 16), 
              user: actorName, 
              action: `Merekod transaksi baru (${formStatus})` 
            }
          ]
        };
        await setDoc(doc(db, 'kewanganTransactions', nextTxnId), cleanUndefined(newTxn));
      }

      setShowAddEditModal(false);
    } catch (err) {
      console.error("Gagal menyimpan transaksi:", err);
      alert("Gagal menyimpan transaksi, sila cuba lagi.");
    } finally {
      setIsSavingTxn(false);
    }
  };

  const handleDeleteTransaction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModalTitle("Padam Transaksi");
    setConfirmModalMessage(`Adakah anda pasti mahu memadam transaksi berasingan ${id}? Tindakan ini tidak boleh diundurkan.`);
    setConfirmModalAction(() => async () => {
      const txnToDelete = transactions.find(t => t.id === id);
      if (txnToDelete && txnToDelete.memberEmail && txnToDelete.paidPackageIds && txnToDelete.paidPackageIds.length > 0 && txnToDelete.approvalStatus === 'Approved') {
        const userDoc = allUsers?.find(u => u.email === txnToDelete.memberEmail);
        if (userDoc) {
          const currentPaidIds = userDoc.paidPackageIds || [];
          const remainingPaidIds = currentPaidIds.filter(pid => !txnToDelete.paidPackageIds?.includes(pid));
          await updateDoc(doc(db, 'users', userDoc.uid), {
            paidPackageIds: remainingPaidIds
          }).catch(err => console.error("Error rolling back paid packages on delete:", err));
        }
      }
      await deleteDoc(doc(db, 'kewanganTransactions', id));
      setTransactions(prev => {
        const updated = prev.filter(t => t.id !== id);
        localStorage.setItem('tmf2_kewangan_transactions', JSON.stringify(updated));
        return updated;
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tmf2_transactions_updated'));
      }
      if (selectedTxn?.id === id) {
        setShowDetailModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  // Helper to add/edit/delete asset & liability items
  const handleSaveAssetLiabilityItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedVal = parseFloat(formItemVal) || 0;
    if (!formItemName.trim()) {
      alert("Sila masukkan nama perihalan!");
      return;
    }

    const docId = editingItem ? editingItem.id : `${activeAssetLiabilityTab}-${Date.now()}`;
    const itemData = {
      name: formItemName,
      val: parsedVal,
      type: activeAssetLiabilityTab
    };

    setIsSavingAssetLiability(true);
    try {
      await setDoc(doc(db, 'kewanganBalanceSheet', docId), itemData);
      // Reset form
      setEditingItem(null);
      setFormItemName("");
      setFormItemVal("");
    } catch (err) {
      console.error("Gagal menyimpan item:", err);
      alert("Gagal menyimpan item, sila cuba lagi.");
    } finally {
      setIsSavingAssetLiability(false);
    }
  };

  const handleDeleteAssetLiabilityItem = (tab: typeof activeAssetLiabilityTab, id: string) => {
    setConfirmModalTitle("Padam Item Kunci Kira-Kira");
    setConfirmModalMessage("Adakah anda pasti mahu memadam item aset/liabiliti ini? Tindakan ini tidak boleh diundurkan.");
    setConfirmModalAction(() => async () => {
      try {
        await deleteDoc(doc(db, 'kewanganBalanceSheet', id));
      } catch (err) {
        console.error("Gagal memadam item:", err);
      }

      if (editingItem?.id === id) {
        setEditingItem(null);
        setFormItemName("");
        setFormItemVal("");
      }
    });
    setShowConfirmModal(true);
  };

  const handleStartEditAssetLiabilityItem = (item: { id: string; name: string; val: number }) => {
    setEditingItem(item);
    setFormItemName(item.name);
    setFormItemVal(item.val.toString());
  };

  const handleDuplicateTransaction = async (txn: KewanganTransaction, e: React.MouseEvent) => {
    e.stopPropagation();
    const { nextTxnId, nextVchId } = generateNextTxnAndVoucherId((txn.date || '').split('-')[0]);
    const actorName = `${currentUserDoc?.displayName || currentUserDoc?.nickname || currentUserDoc?.email || "Bendahari"} (${currentUserDoc?.role || "Pentadbir"})`;

    const dup: KewanganTransaction = {
      ...txn,
      id: nextTxnId,
      voucherNo: nextVchId,
      description: `[Salinan] ${txn.description}`,
      approvalStatus: 'Pending',
      approvedBy: undefined,
      approvedDate: undefined,
      auditTrail: [
        { 
          time: new Date().toISOString().replace('T', ' ').slice(0, 16), 
          user: actorName, 
          action: "Menduplikasi transaksi asal" 
        }
      ]
    };

    setProcessingTxnId(txn.id);
    try {
      await setDoc(doc(db, 'kewanganTransactions', nextTxnId), cleanUndefined(dup));
      alert(`Transaksi ${txn.id} berjaya diduplikasi sebagai ${nextTxnId}!`);
    } catch (err) {
      console.error("Gagal menduplikasi transaksi:", err);
      alert("Gagal menduplikasi transaksi, sila cuba lagi.");
    } finally {
      setProcessingTxnId(null);
    }
  };

  const handleApproveStatusDirectly = async (txn: KewanganTransaction, status: 'Approved' | 'Rejected') => {
    const approverName = currentUserDoc?.displayName || currentUserDoc?.nickname || 'En. Kamal (Pengerusi)';
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().slice(0, 5);
    const updatedTxn: KewanganTransaction = {
      ...txn,
      approvalStatus: status,
      approvedBy: status === 'Approved' ? approverName : undefined,
      approvedDate: status === 'Approved' ? currentDate : undefined,
      auditTrail: [
        ...txn.auditTrail,
        { 
          time: `${currentDate} ${currentTime}`, 
          user: approverName, 
          action: `Menukar status kelulusan kepada: ${status}` 
        }
      ]
    };

    setProcessingTxnId(txn.id);

    // Update local state immediately for fast feedback
    setTransactions(prev => prev.map(t => t.id === txn.id ? updatedTxn : t));

    try {
      await setDoc(doc(db, 'kewanganTransactions', txn.id), cleanUndefined(updatedTxn));

      // Bidirectional sync for user packages
      if (txn.memberEmail && txn.paidPackageIds && txn.paidPackageIds.length > 0) {
        const userDoc = allUsers?.find(u => u.email === txn.memberEmail);
        if (userDoc) {
          const currentPaidIds = userDoc.paidPackageIds || [];
          let updatedPaidIds = [...currentPaidIds];

          if (status === 'Approved') {
            updatedPaidIds = Array.from(new Set([...currentPaidIds, ...txn.paidPackageIds]));
          } else if (status === 'Rejected') {
            updatedPaidIds = currentPaidIds.filter(pid => !txn.paidPackageIds?.includes(pid));
          }

          await updateDoc(doc(db, 'users', userDoc.uid), {
            paidPackageIds: updatedPaidIds
          }).catch(err => console.error("Error updating member paidPackageIds on status change:", err));
        }
      }

      // If selected txn is open, update it
      if (selectedTxn?.id === txn.id) {
        setSelectedTxn(updatedTxn);
      }
    } catch (err) {
      console.error("Gagal menukar status:", err);
      alert("Gagal mengemaskini status transaksi, sila cuba lagi.");
    } finally {
      setProcessingTxnId(null);
    }
  };

  const handleApproveAllInGroup = async (groupItems: KewanganTransaction[], groupKey: string) => {
    if (!groupItems || groupItems.length === 0) return;

    setProcessingGroupKey(groupKey);

    const approverName = currentUserDoc?.displayName || currentUserDoc?.nickname || 'En. Kamal (Pengerusi)';
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().slice(0, 5);
    const approvedIds = new Set(groupItems.map(t => t.id));

    // Update local state immediately so UI gives instant response and hides pending items
    setTransactions(prev => prev.map(t => {
      if (approvedIds.has(t.id)) {
        return {
          ...t,
          approvalStatus: 'Approved',
          approvedBy: approverName,
          approvedDate: currentDate,
          auditTrail: [
            ...(t.auditTrail || []),
            { 
              time: `${currentDate} ${currentTime}`, 
              user: approverName, 
              action: `Menukar status kelulusan kepada: Approved (Kelulusan Pukal)` 
            }
          ]
        };
      }
      return t;
    }));

    try {
      for (const txn of groupItems) {
        const updatedTxn: KewanganTransaction = {
          ...txn,
          approvalStatus: 'Approved',
          approvedBy: approverName,
          approvedDate: currentDate,
          auditTrail: [
            ...(txn.auditTrail || []),
            { 
              time: `${currentDate} ${currentTime}`, 
              user: approverName, 
              action: `Menukar status kelulusan kepada: Approved (Kelulusan Pukal)` 
            }
          ]
        };

        await setDoc(doc(db, 'kewanganTransactions', txn.id), cleanUndefined(updatedTxn));

        if (txn.memberEmail && txn.paidPackageIds && txn.paidPackageIds.length > 0) {
          const userDoc = allUsers?.find(u => u.email === txn.memberEmail);
          if (userDoc) {
            const currentPaidIds = userDoc.paidPackageIds || [];
            const updatedPaidIds = Array.from(new Set([...currentPaidIds, ...txn.paidPackageIds]));

            await updateDoc(doc(db, 'users', userDoc.uid), {
              paidPackageIds: updatedPaidIds
            }).catch(err => console.error("Error updating member paidPackageIds on bulk approve:", err));
          }
        }
      }
    } catch (err) {
      console.error("Gagal mengesahkan semua transaksi kumpulan:", err);
      alert("Terdapat ralat semasa mengesahkan transaksi. Sila cuba lagi.");
    } finally {
      setProcessingGroupKey(null);
    }
  };

  const handleOpenEditFees = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'system', 'yuranConfig'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEditConfig({
          ...DEFAULT_YURAN_CONFIG,
          ...data,
          yuranKeahlian: { ...DEFAULT_YURAN_CONFIG.yuranKeahlian, ...(data.yuranKeahlian || {}) },
          yuranBulanan: { ...DEFAULT_YURAN_CONFIG.yuranBulanan, ...(data.yuranBulanan || {}) },
          yuranPenggal: { ...DEFAULT_YURAN_CONFIG.yuranPenggal, ...(data.yuranPenggal || {}) },
          yuranTahunan: { ...DEFAULT_YURAN_CONFIG.yuranTahunan, ...(data.yuranTahunan || {}) },
          additionalFees: data.additionalFees || [],
        } as YuranConfig);
      } else {
        setEditConfig({
          ...DEFAULT_YURAN_CONFIG,
          additionalFees: [],
        });
      }
      setShowEditFees(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error("Gagal mendapatkan config yuran:", err);
      setEditConfig({
        ...DEFAULT_YURAN_CONFIG,
        additionalFees: [],
      });
      setShowEditFees(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editConfig) return;
    setSavingConfig(true);
    try {
      // ONLY update fee-related fields, NEVER overwrite payment switches or bank info
      await setDoc(doc(db, 'system', 'yuranConfig'), {
        yuranKeahlian: editConfig.yuranKeahlian,
        yuranBulanan: editConfig.yuranBulanan,
        yuranPenggal: editConfig.yuranPenggal,
        yuranTahunan: editConfig.yuranTahunan,
        sesiList: editConfig.sesiList,
        additionalFees: editConfig.additionalFees || []
      }, { merge: true });
      localStorage.setItem('tmf2_yuran_config', JSON.stringify(editConfig));
      setConfigSuccess(true);
      setTimeout(() => {
        setConfigSuccess(false);
        setShowEditFees(false);
      }, 1500);
    } catch (err) {
      console.error("Gagal menyimpan konfigurasi yuran:", err);
      alert("Gagal menyimpan konfigurasi. Sila semak sambungan rangkaian.");
    } finally {
      setSavingConfig(false);
    }
  };

  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mac", "04": "Apr", "05": "Mei", "06": "Jun",
    "07": "Jul", "08": "Ogo", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dis"
  };
  const currentDateForDisplay = new Date();
  const currentMDisplay = String(currentDateForDisplay.getMonth() + 1).padStart(2, '0');
  const targetMDisplay = filterMonth !== "All" ? filterMonth : currentMDisplay;
  const targetMonthName = monthNames[targetMDisplay] || targetMDisplay;

  if (showEditFees && editConfig) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowEditFees(false)}
              className="p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-slate-600 cursor-pointer transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Pengurusan Struktur Yuran & Sesi</h2>
              <p className="text-xs text-slate-400 font-bold">Tetapkan jumlah yuran persatuan, khairat kematian, diskaun, permulaan sesi tahunan, serta caj perkhidmatan</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEditFees(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold uppercase rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              form="yuran-config-form"
              disabled={savingConfig || configSuccess}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold uppercase rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
            >
              {savingConfig ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : configSuccess ? (
                <Check size={12} />
              ) : (
                <CheckCircle2 size={12} />
              )}
              <span>{savingConfig ? "Menyimpan..." : configSuccess ? "Tersimpan!" : "Simpan Tetapan"}</span>
            </button>
          </div>
        </div>

        {configSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold text-center animate-pulse">
            ✔ Konfigurasi Yuran & Sesi berjaya disimpan! Pakej yuran sedang dikemaskini dalam sistem penduduk.
          </div>
        )}

        {/* TAB SELECTION */}
        <div className="flex gap-2 border-b border-slate-100 pb-2">
          <button
            type="button"
            onClick={() => setConfigTab('debit')}
            className={`px-4 py-2.5 text-xs font-black uppercase rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              configTab === 'debit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            📈 Konfigurasi Debit
          </button>
          <button
            type="button"
            onClick={() => setConfigTab('kredit')}
            className={`px-4 py-2.5 text-xs font-black uppercase rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              configTab === 'kredit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            📉 Konfigurasi Kredit
          </button>
        </div>

        <form id="yuran-config-form" onSubmit={handleSaveConfig}>
          {configTab === 'debit' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT SIDE: Yuran Packages Config */}
              <div className="lg:col-span-7 space-y-6">
                <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-5">
                  <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">Struktur Bayaran Yuran</h3>
                  
                  {/* Yuran Keahlian */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Yuran Keahlian (Sekali Bayar)</h4>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-black">Pendaftaran</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Jumlah Bayaran (RM)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editConfig.yuranKeahlian.price}
                        onChange={(e) => setEditConfig({
                          ...editConfig,
                          yuranKeahlian: { price: parseFloat(e.target.value) || 0 }
                        })}
                        className="border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                      />
                    </div>
                  </div>

                  {/* Yuran Bulanan */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Yuran Bulanan Biasa</h4>
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-black">Kutipan Setiap Bulan</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Pecahan Persatuan (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranBulanan.persatuan}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranBulanan: {
                              ...editConfig.yuranBulanan,
                              persatuan: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Pecahan Khairat Kematian (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranBulanan.khairat}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranBulanan: {
                              ...editConfig.yuranBulanan,
                              khairat: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-slate-500">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">Jumlah Bayaran Bulanan:</span>
                      <span className="text-xs font-black text-slate-900 font-mono">
                        RM {(editConfig.yuranBulanan.persatuan + editConfig.yuranBulanan.khairat).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Yuran Perpenggal */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Yuran Perpenggal (6 Bulan)</h4>
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-black">Setengah Tahun</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Persatuan (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranPenggal.persatuan}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranPenggal: {
                              ...editConfig.yuranPenggal,
                              persatuan: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Khairat (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranPenggal.khairat}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranPenggal: {
                              ...editConfig.yuranPenggal,
                              khairat: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Diskaun (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranPenggal.discount}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranPenggal: {
                              ...editConfig.yuranPenggal,
                              discount: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-50 space-y-1 text-slate-500">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                        <span>Bayaran Sebelum Diskaun:</span>
                        <span>RM {(editConfig.yuranPenggal.persatuan + editConfig.yuranPenggal.khairat).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center font-black text-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase">Harga Bersih Pakej (Selepas Diskaun):</span>
                        <span className="text-xs text-indigo-600 font-mono">
                          RM {((editConfig.yuranPenggal.persatuan + editConfig.yuranPenggal.khairat) - editConfig.yuranPenggal.discount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Yuran PerTahun */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Yuran PerTahun (12 Bulan)</h4>
                      <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded font-black">Setahun Penuh</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Persatuan (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranTahunan.persatuan}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranTahunan: {
                              ...editConfig.yuranTahunan,
                              persatuan: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Khairat (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranTahunan.khairat}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranTahunan: {
                              ...editConfig.yuranTahunan,
                              khairat: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Diskaun (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editConfig.yuranTahunan.discount}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            yuranTahunan: {
                              ...editConfig.yuranTahunan,
                              discount: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-50 space-y-1 text-slate-500">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                        <span>Bayaran Sebelum Diskaun:</span>
                        <span>RM {(editConfig.yuranTahunan.persatuan + editConfig.yuranTahunan.khairat).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center font-black text-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase">Harga Bersih Pakej (Selepas Diskaun):</span>
                        <span className="text-xs text-rose-600 font-mono">
                          RM {((editConfig.yuranTahunan.persatuan + editConfig.yuranTahunan.khairat) - editConfig.yuranTahunan.discount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Yuran Tambahan Section */}
                  <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-5">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h3 className="text-sm font-black text-slate-900">Yuran Tambahan Khusus</h3>
                      <button
                        type="button"
                        onClick={handleOpenAddFee}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={14} className="stroke-[3]" /> Tambah Yuran
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editConfig.additionalFees && editConfig.additionalFees.length > 0 ? (
                        editConfig.additionalFees.map((fee) => (
                          <div key={fee.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex justify-between items-start gap-4">
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">{fee.title}</h4>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Db: {fee.account}
                                </span>
                                <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Kategori: {fee.category}
                                </span>
                                <span className="text-[9px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Jenis: {fee.feeType}
                                </span>
                                {fee.feeType === 'Tahunan' && fee.sessionYear && (
                                  <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold">
                                    Sesi {fee.sessionYear}
                                  </span>
                                )}
                                {fee.isCustomAmount && (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                    Bayaran Ikut Suka
                                  </span>
                                )}
                                {fee.assignedUids && fee.assignedUids.length > 0 ? (
                                  <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-extrabold uppercase animate-pulse">
                                    Ahli Pilihan Sahaja ({fee.assignedUids.length} Penduduk)
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
                                    Semua Penduduk
                                  </span>
                                )}
                              </div>
                              {fee.assignedUids && fee.assignedUids.length > 0 && (
                                <div className="text-[10px] text-slate-500 font-bold max-w-sm mt-1">
                                  <span className="text-[9px] text-slate-400 block uppercase">Senarai Ahli Yang Terlibat:</span>
                                  <span className="text-slate-700 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg block mt-0.5 max-h-16 overflow-y-auto font-sans leading-relaxed text-[10px]">
                                    {fee.assignedUids.map(uid => {
                                      const u = allUsers?.find(usr => usr.uid === uid);
                                      return u ? (u.displayName || u.nickname || u.email || uid) : uid;
                                    }).join(', ')}
                                  </span>
                                </div>
                              )}
                              {fee.feeType === 'Bulanan' && fee.months && (
                                <div className="text-[10px] text-slate-500 font-bold">
                                  Bulan: {fee.months.join(', ')}
                                </div>
                              )}
                              {fee.hasAgePricing && fee.agePricing && (
                                <div className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-600 font-bold space-y-0.5">
                                  <p className="text-[9px] text-slate-400 uppercase">Perbezaan Harga:</p>
                                  {fee.agePricing.dewasa?.enabled && <p>• Dewasa: RM{fee.agePricing.dewasa.price.toFixed(2)}</p>}
                                  {fee.agePricing.wargaEmas?.enabled && <p>• Warga Emas: RM{fee.agePricing.wargaEmas.price.toFixed(2)}</p>}
                                  {fee.agePricing.kanakKanak?.enabled && <p>• Kanak-Kanak: RM{fee.agePricing.kanakKanak.price.toFixed(2)}</p>}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2.5">
                              <span className="text-sm font-black text-slate-900">
                                RM{fee.price.toFixed(2)}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditFee(fee)}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdditionalFee(fee.id)}
                                  className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  Padam
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold">
                          Tiada yuran tambahan khusus dikonfigurasikan lagi.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT SIDE: Sesi Tahun Config & Calendar Generator */}
              <div className="lg:col-span-5 space-y-6">
                <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-5 h-full">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-black text-slate-900">Pengurusan Sesi Kewangan</h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editConfig.sesiList.map(s => ({
                            ...s,
                            startMonth: 8,
                            name: `Sesi ${s.startYear}/${s.startYear + 1}`
                          }));
                          setEditConfig({ ...editConfig, sesiList: updated });
                          alert("Semua sesi telah ditukarkan kepada bermula Ogos dan berakhir 31 Julai (cth: Sesi 2026/2027 berakhir 31 Julai 2027)!");
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border border-emerald-200"
                        title="Tukar semua sesi kepada 1 Ogos hingga 31 Julai"
                      >
                        <RefreshCw size={11} />
                        Set Semua (Ogos – Julai)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editConfig.sesiList.map(s => ({
                            ...s,
                            startMonth: 1,
                            name: `Sesi ${s.startYear}`
                          }));
                          setEditConfig({ ...editConfig, sesiList: updated });
                          alert("Semua sesi telah ditukarkan kepada bermula Januari dan berakhir Disember!");
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border border-indigo-200"
                      >
                        <RefreshCw size={11} />
                        Set (Jan – Dis)
                      </button>
                    </div>
                  </div>
                  
                  {editConfig.sesiList.map((sesi, index) => {
                    const months = generate12Months(sesi.startMonth, sesi.startYear);
                    const endMonthObj = months[11];
                    
                    return (
                      <div key={sesi.id} className="bg-white p-4 rounded-xl border border-slate-100 space-y-4 shadow-xs">
                        <div className="flex justify-between items-center">
                          <input
                            type="text"
                            value={sesi.name}
                            onChange={(e) => {
                              const newList = [...editConfig.sesiList];
                              newList[index] = { ...newList[index], name: e.target.value };
                              setEditConfig({ ...editConfig, sesiList: newList });
                            }}
                            className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-dashed border-slate-200 focus:outline-none focus:border-indigo-500 bg-transparent"
                            placeholder={`Sesi ${sesi.startYear}`}
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold font-mono">ID: {sesi.id}</span>
                            {editConfig.sesiList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Padam ${sesi.name}?`)) {
                                    const newList = editConfig.sesiList.filter((_, i) => i !== index);
                                    setEditConfig({ ...editConfig, sesiList: newList });
                                  }
                                }}
                                className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                                title="Padam sesi"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Bulan Mula</label>
                            <select
                              value={sesi.startMonth}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                const newList = [...editConfig.sesiList];
                                newList[index] = { ...newList[index], startMonth: val };
                                setEditConfig({ ...editConfig, sesiList: newList });
                              }}
                              className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                            >
                              {monthNamesMs.map((name, mIdx) => (
                                <option key={mIdx} value={mIdx + 1}>{name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Tahun Mula</label>
                            <select
                              value={sesi.startYear}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 2026;
                                const newList = [...editConfig.sesiList];
                                newList[index] = { ...newList[index], startYear: val };
                                setEditConfig({ ...editConfig, sesiList: newList });
                              }}
                              className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                            >
                              {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((yr) => (
                                <option key={yr} value={yr}>{yr}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Auto Ending Month Display (Auto-genap Setahun) */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-500 leading-relaxed font-bold">
                          <span className="text-slate-400">📅 Sesi Auto-Genap Setahun:</span>
                          <div className="mt-1 flex items-center gap-1.5 text-slate-800 font-extrabold text-xs">
                            <span>{monthNamesMs[sesi.startMonth - 1]} {sesi.startYear}</span>
                            <span className="text-slate-400 font-normal">→</span>
                            <span>{endMonthObj.name}</span>
                          </div>
                        </div>

                        {/* Miniature month list preview */}
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Peta Aliran Bulanan ({months.length} Bulan):</span>
                          <div className="flex flex-wrap gap-1">
                            {months.map((m, mIdx) => (
                              <div key={mIdx} className="text-[9px] bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded font-medium border border-slate-100 text-slate-600 transition-all">
                                {m.name.split(' ')[0].substring(0, 3)} {m.name.split(' ')[1]}
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    );
                  })}

                  {/* Add New Session Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentList = editConfig.sesiList || [];
                      const maxYear = currentList.length > 0 ? Math.max(...currentList.map(s => s.startYear)) : new Date().getFullYear();
                      const newYear = maxYear + 1;
                      const newSesi = {
                        id: newYear.toString(),
                        name: `Sesi ${newYear}`,
                        startMonth: 1, // Bermula 1 Januari hingga 31 Disember
                        startYear: newYear
                      };
                      setEditConfig({
                        ...editConfig,
                        sesiList: [...currentList, newSesi].sort((a, b) => a.startYear - b.startYear)
                      });
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <Plus size={14} />
                    Tambah Sesi Baharu (Januari – Disember)
                  </button>

                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-[11px] text-indigo-800 leading-relaxed font-medium space-y-1.5">
                    <p className="font-extrabold text-indigo-900">💡 Tip Penting untuk Bendahari:</p>
                    <p>
                      Sesi kewangan persatuan boleh ditetapkan bermula Ogos dan berakhir 31 Julai tahun berikutnya (atau Januari - Disember) secara automatik genap setahun (12 bulan).
                    </p>
                    <p>
                      Penyata kewangan rasmi ("Cetak Penyata") dan paparan yuran pembayar akan sentiasa mengikut tetapan takwim sesi semasa yang aktif di sini.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-5">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">Tetapan Caj Pembayaran & Kredit</h3>
                    <p className="text-xs text-slate-400 font-bold">Uruskan bayaran caj luar atau perbelanjaan gerbang pembayaran</p>
                  </div>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-bold uppercase">FPX Payment Gateway</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-100 space-y-4 shadow-xs">
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 uppercase block">Bayaran Caj Perkhidmatan FPX (RM)</label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">RM</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={editConfig.fpxCharge ?? 1.00}
                        onChange={(e) => setEditConfig({
                          ...editConfig,
                          fpxCharge: parseFloat(e.target.value) || 0
                        })}
                        className="w-full pl-10 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-indigo-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold leading-relaxed pt-1">
                      💡 Sila masukkan jumlah caj perkhidmatan FPX yang dikenakan (Contoh: 1.00). Caj ini akan dipaparkan secara automatik dalam resit rasmi pembayar/penduduk semasa membuat transaksi pembayaran dalam sistem.
                    </p>
                  </div>
                </div>

                {/* FPX Surcharge Mode Checkbox Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 space-y-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center h-5">
                      <input
                        id="fpx-surcharge-mode"
                        type="checkbox"
                        checked={editConfig.fpxSurchargeMode ?? true}
                        onChange={(e) => setEditConfig({
                          ...editConfig,
                          fpxSurchargeMode: e.target.checked
                        })}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="fpx-surcharge-mode" className="text-xs font-extrabold text-slate-800 uppercase cursor-pointer select-none">
                        Caj Tambahan FPX (Surcharge Mode)
                      </label>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Jika <strong>DITICK</strong> (Caj Tambahan): Caj perkhidmatan RM 1.00 akan ditambah di atas yuran (Contoh: yuran RM50.00, jumlah bayar RM51.00. RM50.00 bersih masuk akaun persatuan, RM1.00 caj FPX).
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        Jika <strong>UNTICK</strong> (Caj Diserap): Caj perkhidmatan RM 1.00 dikira terus dalam yuran (Contoh: yuran RM50.00, jumlah bayar RM50.00. RM49.00 bersih masuk akaun persatuan, RM1.00 caj FPX).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-xl text-indigo-950 text-xs leading-relaxed space-y-2 font-medium">
                  <p className="font-extrabold text-indigo-900">🔍 Mengapa ini penting?</p>
                  <p>
                    Setiap pembayaran digital melalui perbankan dalam talian (FPX) mempunyai caj transaksi pembekal gerbang. Berdasarkan tetapan pilihan anda sekarang ({ (editConfig.fpxSurchargeMode ?? true) ? "Caj Tambahan" : "Caj Diserap" }):
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 font-semibold">
                    { (editConfig.fpxSurchargeMode ?? true) ? (
                      <>
                        <li>Amaun yuran bersih akan masuk penuh ke akaun persatuan (Debit)</li>
                        <li>Amaun RM { (editConfig.fpxCharge ?? 1.00).toFixed(2) } FPX ditambahkan ke atas yuran dan ditunjukkan secara berasingan dalam slip resit sebagai caj perkhidmatan.</li>
                      </>
                    ) : (
                      <>
                        <li>Amaun yuran bersih selepas tolak caj FPX akan masuk ke akaun persatuan (Debit)</li>
                        <li>Amaun RM { (editConfig.fpxCharge ?? 1.00).toFixed(2) } FPX diserap dari dalam yuran dan ditunjukkan secara berasingan dalam slip resit sebagai caj perkhidmatan.</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </form>
        {renderAdditionalFeeModal()}
      </div>
    );
  }

  return (
    <div id="section-kewangan" className="w-full space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Landmark size={24} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Sistem Kewangan Sekolah & PIBG SMAUJ</h2>
            <p className="text-xs text-slate-500 font-medium">Pengurusan akaun bertaraf profesional, telus, dan berintegriti untuk Sekolah Menengah Agama Ulu Jempol</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {isFinanceAdmin && (
            <>
              <button 
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Tambah Transaksi</span>
              </button>
              <button 
                onClick={handleOpenEditFees}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm"
              >
                <Sliders size={14} strokeWidth={2.5} />
                <span>Edit Yuran & Sesi</span>
              </button>
              <button 
                onClick={() => {
                  setIsGeneratingStatement(true);
                  setTimeout(() => {
                    setIsGeneratingStatement(false);
                    try {
                      const bookHtml = generateFinancialBookHtml(
                        transactions,
                        yuranConfig || DEFAULT_YURAN_CONFIG,
                        verificationData,
                        fixedAssets,
                        liabilitiesList,
                        otherCurrentAssets,
                        otherLiabilities,
                        capitalList,
                        allUsers || [],
                        filterYear,
                        totals,
                        allApplications || []
                      );
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(bookHtml);
                        printWindow.document.close();
                      } else {
                        alert("Sila benarkan pop-up untuk mencetak buku penyata kewangan.");
                      }
                    } catch (err) {
                      console.error("Ralat menjana buku penyata kewangan:", err);
                      alert("Gagal menjana buku penyata kewangan.");
                    }
                  }, 1200);
                }}
                disabled={isGeneratingStatement}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all border border-slate-200 disabled:opacity-50"
              >
                {isGeneratingStatement ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <PrinterIcon size={14} />
                )}
                <span>{isGeneratingStatement ? "Menjana..." : "Cetak Penyata"}</span>
              </button>
              <button 
                onClick={() => {
                  setIsExportingExcel(true);
                  setTimeout(() => {
                    try {
                      const escapeCsv = (val: any) => {
                        const s = val == null ? '' : String(val);
                        return `"${s.replace(/"/g, '""')}"`;
                      };
                      const headers = [
                        'Tarikh', 'Masa', 'ID Transaksi', 'No Baucar', 'Sesi Kewangan',
                        'Kategori', 'Akaun Debit (Db)', 'Akaun Kredit (Cr)', 'Perihalan / Keterangan',
                        'Catatan', 'Emel Ahli', 'Amaun (RM)', 'Status Kelulusan', 'Direkod Oleh', 'Diluluskan Oleh'
                      ];
                      const rows = filteredTransactions.map(t => [
                        t.date,
                        t.time,
                        t.id,
                        t.voucherNo,
                        t.sessionYear || filterYear,
                        t.category,
                        t.accountDebit,
                        t.accountCredit,
                        t.description,
                        t.notes || '',
                        t.memberEmail || '',
                        (Number(t.amount) || 0).toFixed(2),
                        t.approvalStatus,
                        t.recordedBy || '',
                        t.approvedBy || ''
                      ].map(escapeCsv).join(','));

                      const summaryLines = [
                        '',
                        [escapeCsv('RINGKASAN KEWANGAN SMAUJ'), escapeCsv(`Sesi: ${filterYear === 'All' ? 'Semua Sesi' : filterYear}`)].join(','),
                        [escapeCsv('Baki Awal (Bawa Hadapan)'), escapeCsv(`RM ${bakiAwal.toFixed(2)}`)].join(','),
                        [escapeCsv('Jumlah Pendapatan (Diluluskan)'), escapeCsv(`RM ${profitLossData.totalIncome.toFixed(2)}`)].join(','),
                        [escapeCsv('Jumlah Perbelanjaan (Diluluskan)'), escapeCsv(`RM ${profitLossData.totalExpense.toFixed(2)}`)].join(','),
                        [escapeCsv('Lebihan / Defisit Semasa'), escapeCsv(`RM ${profitLossData.surplus.toFixed(2)}`)].join(','),
                        [escapeCsv('Baki Semasa Bank'), escapeCsv(`RM ${totals.currentBank.toFixed(2)}`)].join(','),
                        [escapeCsv('Baki Semasa Tunai'), escapeCsv(`RM ${totals.currentTunai.toFixed(2)}`)].join(','),
                        [escapeCsv('Jumlah Baki Semasa (Bank + Tunai)'), escapeCsv(`RM ${totals.balanceSemasa.toFixed(2)}`)].join(',')
                      ];

                      const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows, ...summaryLines].join('\r\n');
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `Laporan_Kewangan_SMAUJ_Sesi_${filterYear}_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error("Gagal mengeksport CSV:", err);
                      alert("Ralat mengeksport fail CSV.");
                    } finally {
                      setIsExportingExcel(false);
                    }
                  }, 300);
                }}
                disabled={isExportingExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all border border-slate-200 disabled:opacity-50"
              >
                {isExportingExcel ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={14} />
                )}
                <span>{isExportingExcel ? "Eksport..." : "Export Excel"}</span>
              </button>
              <button 
                onClick={() => setShowCarryForwardModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-all border border-indigo-200 ml-1"
              >
                <ArrowRightLeft size={14} />
                <span className="hidden md:inline">Tutup & Carry Forward</span>
                <span className="md:hidden">Carry Forward</span>
              </button>
            </>
          )}
          
          <button 
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`flex items-center gap-1.5 px-3 py-2 active:scale-95 text-xs font-bold rounded-xl cursor-pointer transition-all border ml-1 ${
              showAnalysis 
                ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <BarChart3 size={14} />
            <span>{showAnalysis ? "Sembunyikan Analisa" : "Lihat Analisa"}</span>
          </button>
        </div>
      </div>

      {/* SUB-MENU TABS FOR FINANCIAL STATEMENTS */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white p-1 rounded-xl border border-slate-100">
        {[
          { id: 'lejar', label: 'Lejar Umum', desc: 'Rekod Transaksi' },
          { id: 'untung-rugi', label: 'Untung Rugi', desc: 'Penyata Pendapatan' },
          { id: 'kunci-kira-kira', label: 'Kunci Kira-kira', desc: 'Kedudukan Aset & Liabiliti' },
          { id: 'aliran-tunai', label: 'Pergerakan Tunai', desc: 'Aliran Wang Keluar Masuk' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[120px] text-center py-2.5 px-3 rounded-lg cursor-pointer transition-all ${
              activeTab === tab.id 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <p className="text-xs font-black leading-tight">{tab.label}</p>
            <p className="text-[8px] opacity-75 font-bold mt-0.5 tracking-wide uppercase leading-none hidden sm:block">{tab.desc}</p>
          </button>
        ))}
      </div>

      {/* PENDING TRANSACTIONS BATCHES SECTION (Minta disahkan) */}
      {activeTab === 'lejar' && transactions.some(t => t.approvalStatus === 'Pending') && (
        <div className="space-y-4 mb-2">
          <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                  <Clock size={18} className="animate-pulse" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-amber-950 uppercase tracking-tight flex items-center gap-2">
                    <span>Transaksi Belum Disahkan (Pending)</span>
                    <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                      {transactions.filter(t => t.approvalStatus === 'Pending').length} Rekod
                    </span>
                  </h3>
                  <p className="text-[10px] font-bold text-amber-800/90 mt-0.5">
                    Digroupkan mengikut tarikh & masa transaksi yang sama untuk semakan & kelulusan mudah admin.
                  </p>
                </div>
              </div>

              {pendingGroups.length > 0 && (isAdminUtama || isBendahari) && (
                <div className="text-[10px] font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-700" />
                  <span>Semak & Sahkan Penerimaan Bayaran</span>
                </div>
              )}
            </div>

            {pendingGroups.length === 0 ? (
              <div className="bg-white/90 rounded-xl p-3.5 text-center border border-amber-200/60">
                <div className="flex items-center justify-center gap-2 text-emerald-700 font-black text-xs">
                  <CheckCircle2 size={16} />
                  <span>Tiada Transaksi Pending – Semua transaksi telah disahkan!</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingGroups.map((group, groupIdx) => (
                  <div key={`${group.date}-${group.time}-${groupIdx}`} className="bg-white border-2 border-amber-200 rounded-xl p-3.5 shadow-3xs space-y-3">
                    {/* Group Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/90 p-2.5 rounded-lg border border-amber-200/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 bg-white border border-amber-200 px-2.5 py-1 rounded-md shadow-3xs flex items-center gap-1.5">
                          <CalendarIcon size={13} className="text-amber-600" />
                          <span>{group.date}</span>
                          <span className="text-slate-300">•</span>
                          <Clock size={13} className="text-amber-600" />
                          <span>{group.time}</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md">
                          {group.items.length} Transaksi Serentak
                        </span>
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-[9px] text-amber-800 font-extrabold block uppercase tracking-wider">Jumlah Kumpulan:</span>
                          <span className="text-sm font-black text-emerald-700">RM {group.totalAmount.toFixed(2)}</span>
                        </div>

                        {(isAdminUtama || isBendahari) && (() => {
                          const currentGroupKey = `${group.date}_${group.time}_${groupIdx}`;
                          const isThisGroupProcessing = processingGroupKey === currentGroupKey;
                          const isBusy = isThisGroupProcessing || processingGroupKey !== null || processingTxnId !== null;

                          return (
                            <button
                              disabled={isBusy}
                              onClick={async () => {
                                await handleApproveAllInGroup(group.items, currentGroupKey);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold text-[11px] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-all"
                              title="Sahkan & Luluskan semua transaksi dalam kumpulan ini"
                            >
                              {isThisGroupProcessing ? (
                                <>
                                  <RefreshCw size={13} className="animate-spin" />
                                  <span>Memproses... ({group.items.length})</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={13} />
                                  <span>Sahkan Semua ({group.items.length})</span>
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Group Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 bg-slate-50/50">
                            <th className="py-2 px-3">Voucher & ID</th>
                            <th className="py-2 px-3">Pembayar / Ahli</th>
                            <th className="py-2 px-3">Perincian & Kategori</th>
                            <th className="py-2 px-3 text-right">Amaun (RM)</th>
                            <th className="py-2 px-3 text-center">Resit / AI</th>
                            <th className="py-2 px-3 text-center">Tindakan Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                          {group.items.map((txn) => {
                            const memberUser = allUsers?.find(u => u.email === txn.memberEmail);
                            const memberName = memberUser?.displayName || txn.memberEmail || 'Awam';
                            const isTxnProcessing = processingTxnId === txn.id;
                            const isAnyBusy = isTxnProcessing || processingTxnId !== null || processingGroupKey !== null;

                            return (
                              <tr key={txn.id} className="hover:bg-amber-50/30 transition-colors">
                                <td className="py-2.5 px-3">
                                  <span className="font-mono text-[10px] font-black bg-amber-100/60 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded block w-fit">
                                    {txn.voucherNo || txn.id}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{txn.id}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <p className="font-extrabold text-slate-900 text-xs">{memberName}</p>
                                  {memberUser?.noRumah && (
                                    <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">
                                      🏠 {memberUser.noRumah}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 max-w-xs">
                                  <p className="font-bold text-slate-800 truncate">{txn.description}</p>
                                  <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border inline-block mt-0.5 shadow-3xs ${getCategoryBadgeStyle(txn.category)}`}>
                                    {txn.category}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                                  RM {txn.amount.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {txn.receiptAttachment ? (
                                    <button
                                      onClick={() => {
                                        setSelectedReceiptTxn(txn);
                                        setShowReceiptModal(true);
                                      }}
                                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-md border border-indigo-200 transition-all cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <FileText size={11} />
                                      <span>Resit</span>
                                    </button>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 italic">Tiada Resit</span>
                                  )}
                                  {txn.aiVerified && (
                                    <span className="block mt-1 text-[8px] font-black text-purple-700 bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                                      ✨ AI Sah
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {(isAdminUtama || isBendahari) ? (
                                      <>
                                        <button
                                          disabled={isAnyBusy}
                                          onClick={() => handleApproveStatusDirectly(txn, 'Approved')}
                                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-extrabold text-[10px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer px-2 disabled:cursor-not-allowed"
                                          title="Sahkan & Luluskan"
                                        >
                                          {isTxnProcessing ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                          ) : (
                                            <Check size={13} />
                                          )}
                                          <span>{isTxnProcessing ? 'Memproses...' : 'Sahkan'}</span>
                                        </button>
                                        <button
                                          disabled={isAnyBusy}
                                          onClick={() => handleApproveStatusDirectly(txn, 'Rejected')}
                                          className="p-1.5 bg-rose-100 hover:bg-rose-200 disabled:bg-rose-50 text-rose-700 disabled:text-rose-400 rounded-lg font-extrabold text-[10px] flex items-center gap-1 transition-all cursor-pointer px-2 disabled:cursor-not-allowed"
                                          title="Tolak Transaksi"
                                        >
                                          {isTxnProcessing ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                          ) : (
                                            <X size={13} />
                                          )}
                                          <span>{isTxnProcessing ? 'Memproses...' : 'Tolak'}</span>
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Menunggu Admin</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters Panel - Now Global */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-500" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Carian & Saringan Laporan</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer bg-indigo-50/80 hover:bg-indigo-100/80 px-3 py-1.5 rounded-xl border border-indigo-200/80 transition-all select-none w-fit">
              <input
                type="checkbox"
                checked={groupByCategoryAccordion}
                onChange={(e) => {
                  setGroupByCategoryAccordion(e.target.checked);
                  if (e.target.checked) {
                    setGroupByDateTimeAccordion(false);
                  }
                }}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
              />
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-600" />
                <span>Kategorikan Laporan (Gaya Accordion)</span>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-amber-50/80 hover:bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-200/80 transition-all select-none w-fit">
              <input
                type="checkbox"
                checked={groupByDateTimeAccordion}
                onChange={(e) => {
                  setGroupByDateTimeAccordion(e.target.checked);
                  if (e.target.checked) {
                    setGroupByCategoryAccordion(false);
                  }
                }}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer accent-amber-600"
              />
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <CalendarIcon size={13} className="text-amber-600" />
                <span>Kategorikan Mengikut Tarikh & Masa</span>
              </span>
            </label>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {/* Search */}
          <div className="col-span-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari rujukan, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-indigo-600 bg-white"
            />
          </div>

          {/* Month */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Bulan</label>
            <select 
              value={filterMonth} 
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full h-9 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white cursor-pointer focus:outline-indigo-600"
            >
              <option value="All">Semua Bulan</option>
              <option value="01">Januari</option>
              <option value="02">Februari</option>
              <option value="03">Mac</option>
              <option value="04">April</option>
              <option value="05">Mei</option>
              <option value="06">Jun</option>
              <option value="07">Julai</option>
              <option value="08">Ogos</option>
              <option value="09">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Disember</option>
            </select>
          </div>

          {/* Session */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Sesi Tahunan</label>
            <select 
              value={filterYear} 
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full h-9 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white cursor-pointer focus:outline-indigo-600"
            >
              <option value="All">Semua Sesi</option>
              {yuranConfig?.sesiList && yuranConfig.sesiList.length > 0 ? (
                yuranConfig.sesiList.map(s => (
                  <option key={s.id} value={s.id}>{s.name || `Sesi ${s.startYear}/${s.startYear + 1}`}</option>
                ))
              ) : (
                <>
                  <option value="2024">Sesi 2024/2025</option>
                  <option value="2025">Sesi 2025/2026</option>
                  <option value="2026">Sesi 2026/2027</option>
                  <option value="2027">Sesi 2027/2028</option>
                </>
              )}
            </select>
          </div>

          {/* Account filter */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Akaun</label>
            <select 
              value={filterAccount} 
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full h-9 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white cursor-pointer focus:outline-indigo-600"
            >
              <option value="All">Semua Akaun</option>
              {accountsList.map(acc => <option key={acc} value={acc}>{acc}</option>)}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Kategori</label>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full h-9 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white cursor-pointer focus:outline-indigo-600"
            >
              <option value="All">Semua Kategori</option>
              {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 1. GENERAL LEDGER (LEJAR UMUM) */}
      {activeTab === 'lejar' && (
        <div className="space-y-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-wider">Pendapatan ({targetMonthName})</span>
                <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg"><ArrowUpRight size={14} /></span>
              </div>
              <p className="text-base font-black text-slate-900 mt-2">RM {totals.totalIncomeThisMonth.toFixed(2)}</p>
              <p className="text-[9px] text-emerald-600 font-bold mt-0.5">↑ Dana masuk komuniti</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-wider">Perbelanjaan ({targetMonthName})</span>
                <span className="p-1 bg-rose-50 text-rose-600 rounded-lg"><ArrowDownRight size={14} /></span>
              </div>
              <p className="text-base font-black text-slate-900 mt-2">RM {totals.totalExpenseThisMonth.toFixed(2)}</p>
              <p className="text-[9px] text-rose-500 font-bold mt-0.5">↓ Operasi & Utiliti</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-100/65 bg-indigo-50/10 shadow-3xs">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700">Bank sahaja</span>
                <span className="p-1 bg-blue-50 text-blue-600 rounded-lg"><Landmark size={14} /></span>
              </div>
              <p className="text-base font-black text-slate-900 mt-2">RM {totals.currentBank.toFixed(2)}</p>
              <p className="text-[9px] text-indigo-600 font-bold mt-0.5">Simpanan di bank</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/10 shadow-3xs">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-700">Tunai sahaja</span>
                <span className="p-1 bg-amber-50 text-amber-600 rounded-lg"><CreditCard size={14} /></span>
              </div>
              <p className="text-base font-black text-slate-900 mt-2">RM {totals.currentTunai.toFixed(2)}</p>
              <p className="text-[9px] text-amber-600 font-bold mt-0.5">Tunai runcit persatuan</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-wider">Baki Semasa (Tunai + Bank)</span>
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg"><Landmark size={14} /></span>
              </div>
              <p className="text-base font-black text-slate-900 mt-2">RM {totals.balanceSemasa.toFixed(2)}</p>
              <p className="text-[9px] text-slate-500 font-bold mt-0.5">Jumlah aset cair terkumpul</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[9px] font-black uppercase tracking-wider">Bilangan Transaksi</span>
                <span className="p-1 bg-slate-50 text-slate-600 rounded-lg"><FileText size={14} /></span>
              </div>
              <p className="text-base font-black text-slate-900 mt-2">{totals.totalTransactionsCount}</p>
              <p className="text-[9px] text-slate-500 font-bold mt-0.5">Dikemas kini masa nyata</p>
            </div>
          </div>

          {/* ANALYTICS DASHBOARD SECTION */}
          {showAnalysis && (
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-4 md:p-6 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-emerald-600" size={18} />
                    <span>Dashboard Analisa Kewangan SMAUJ</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold">
                    Penyelidikan visual berdasarkan tapisan dan saringan semasa
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200/50">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Data Auto-Kemas Kini</span>
                </div>
              </div>

              {/* Mini Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/40 shadow-3xs">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Hasil Masuk (Ditapis)</span>
                  <span className="text-sm font-black text-emerald-600 mt-1 block">RM {analysisSummary.totalIncome.toFixed(2)}</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/40 shadow-3xs">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Belanja Keluar (Ditapis)</span>
                  <span className="text-sm font-black text-rose-600 mt-1 block">RM {analysisSummary.totalExpense.toFixed(2)}</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/40 shadow-3xs">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Lebihan Bersih (Surplus)</span>
                  <span className={`text-sm font-black mt-1 block ${analysisSummary.netSurplus >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                    RM {analysisSummary.netSurplus.toFixed(2)}
                  </span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/40 shadow-3xs">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Purata Per Transaksi</span>
                  <span className="text-sm font-black text-slate-700 mt-1 block">RM {analysisSummary.avgTxnAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Conditional placeholder if empty */}
              {analysisSummary.transactionCount === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-200/40 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-full">
                    <BarChart3 size={32} />
                  </div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Tiada Data Padanan</h4>
                  <p className="text-[10px] text-slate-400 font-bold max-w-sm">
                    Tiada transaksi diluluskan yang memenuhi kriteria carian/tapis semasa. Sila tukar bulan, tahun atau kategori tapisan untuk melihat analisa.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Grid 1: Trend Line/Area Chart */}
                  <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/40 shadow-3xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-indigo-600" />
                        <span>Trend Aliran Masuk-Keluar Kewangan ({filterMonth === "All" ? "Sesi " + filterYear : "Bulan " + targetMonthName})</span>
                      </h4>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">Analisa Garis Masa</span>
                    </div>

                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                            </linearGradient>
                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="label" 
                            stroke="#94a3b8" 
                            fontSize={9} 
                            fontWeight="bold"
                            tickLine={false} 
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={9} 
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false} 
                            tickFormatter={(v) => `RM${v}`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend 
                            verticalAlign="top" 
                            height={36} 
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                          />
                          <Area 
                            name="Pendapatan (Masuk)" 
                            type="monotone" 
                            dataKey="Pendapatan" 
                            stroke="#10b981" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorIn)" 
                          />
                          <Area 
                            name="Perbelanjaan (Keluar)" 
                            type="monotone" 
                            dataKey="Perbelanjaan" 
                            stroke="#ef4444" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorOut)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Grid 2: Pie Charts for Incomes and Expenses breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Income Donut Chart */}
                    <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/40 shadow-3xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <PieChartIcon size={14} className="text-emerald-600" />
                          <span>Pecahan Pendapatan Mengikut Kategori</span>
                        </h4>
                      </div>

                      {chartIncomeCategoryData.length === 0 ? (
                        <div className="h-60 flex items-center justify-center text-center text-slate-400 text-[10px] font-bold">
                          Tiada aliran pendapatan dalam tapisan semasa
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="h-52 w-52 relative mx-auto">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartIncomeCategoryData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={75}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {chartIncomeCategoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [`RM ${Number(value).toFixed(2)}`, 'Jumlah']} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Hasil</span>
                              <span className="text-xs font-black text-slate-800">RM {analysisSummary.totalIncome.toFixed(0)}</span>
                            </div>
                          </div>

                          <div className="flex-1 space-y-1.5 max-h-52 overflow-y-auto w-full pr-1">
                            {chartIncomeCategoryData.map((item, idx) => {
                              const pct = analysisSummary.totalIncome > 0 ? (item.value / analysisSummary.totalIncome) * 100 : 0;
                              return (
                                <div key={item.name} className="flex items-center justify-between text-[10px] font-bold">
                                  <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                    <span className="text-slate-600 truncate">{item.name}</span>
                                  </div>
                                  <span className="text-slate-900 font-mono">
                                    RM{item.value.toFixed(0)} ({pct.toFixed(0)}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expense Donut Chart */}
                    <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/40 shadow-3xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <PieChartIcon size={14} className="text-rose-600" />
                          <span>Pecahan Perbelanjaan Mengikut Kategori</span>
                        </h4>
                      </div>

                      {chartExpenseCategoryData.length === 0 ? (
                        <div className="h-60 flex items-center justify-center text-center text-slate-400 text-[10px] font-bold">
                          Tiada aliran perbelanjaan dalam tapisan semasa
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="h-52 w-52 relative mx-auto">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartExpenseCategoryData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={75}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {chartExpenseCategoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [`RM ${Number(value).toFixed(2)}`, 'Jumlah']} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Belanja</span>
                              <span className="text-xs font-black text-slate-800">RM {analysisSummary.totalExpense.toFixed(0)}</span>
                            </div>
                          </div>

                          <div className="flex-1 space-y-1.5 max-h-52 overflow-y-auto w-full pr-1">
                            {chartExpenseCategoryData.map((item, idx) => {
                              const pct = analysisSummary.totalExpense > 0 ? (item.value / analysisSummary.totalExpense) * 100 : 0;
                              return (
                                <div key={item.name} className="flex items-center justify-between text-[10px] font-bold">
                                  <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[(idx + 3) % COLORS.length] }}></span>
                                    <span className="text-slate-600 truncate">{item.name}</span>
                                  </div>
                                  <span className="text-slate-900 font-mono">
                                    RM{item.value.toFixed(0)} ({pct.toFixed(0)}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grid 3: Channel Bar Chart (Bank vs Tunai Flow) */}
                  <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/40 shadow-3xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 size={14} className="text-emerald-600" />
                        <span>Agihan Aliran Tunai Mengikut Akaun (Bank vs Tunai Runcit)</span>
                      </h4>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">Analisa Saluran</span>
                    </div>

                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartChannelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={9} 
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `RM${v}`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend 
                            verticalAlign="top" 
                            height={36} 
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                          />
                          <Bar name="Aliran Masuk" dataKey="Aliran_Masuk" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                          <Bar name="Aliran Keluar" dataKey="Aliran_Keluar" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transactions Section: Accordion View vs Flat Table View */}
          {groupByCategoryAccordion ? (
            <div className="space-y-3.5">
              {accordionGroupedTransactions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 font-bold">
                  Tiada transaksi disahkan ditemui sepadan dengan kriteria carian.
                </div>
              ) : (
                accordionGroupedTransactions.map((group) => {
                  const isCollapsed = collapsedAccordionCategories[group.groupName] === true;
                  return (
                    <div 
                      key={group.groupName} 
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden transition-all duration-200"
                    >
                      {/* Accordion Header */}
                      <div 
                        onClick={() => {
                          setCollapsedAccordionCategories(prev => ({
                            ...prev,
                            [group.groupName]: !prev[group.groupName]
                          }));
                        }}
                        className="bg-slate-50 hover:bg-slate-100/90 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer border-b border-slate-150 select-none transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 shadow-2xs">
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </span>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">
                              {group.groupName}
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border inline-block shadow-3xs ${getCategoryBadgeStyle(group.groupName)}`}>
                              {group.groupName}
                            </span>
                            <span className="text-[10px] font-black bg-indigo-100/80 text-indigo-900 px-2.5 py-0.5 rounded-full border border-indigo-200">
                              {group.items.length} Rekod
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-black self-end sm:self-auto">
                          {group.totalDebit > 0 && (
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 block uppercase font-extrabold">Total Debit:</span>
                              <span className="text-emerald-600 font-extrabold">+RM {group.totalDebit.toFixed(2)}</span>
                            </div>
                          )}
                          {group.totalCredit > 0 && (
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 block uppercase font-extrabold">Total Kredit:</span>
                              <span className="text-rose-500 font-extrabold">-RM {group.totalCredit.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Accordion Body */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[9px] font-extrabold uppercase tracking-wider">
                                <th className="py-3.5 px-4">Tarikh</th>
                                <th className="py-3.5 px-4">Rujukan</th>
                                <th className="py-3.5 px-4">Kategori / Akaun</th>
                                <th className="py-3.5 px-4">Catatan Perincian</th>
                                <th className="py-3.5 px-4 text-right">Debit (RM)</th>
                                <th className="py-3.5 px-4 text-right">Kredit (RM)</th>
                                <th className="py-3.5 px-4 text-center">Status</th>
                                <th className="py-3.5 px-4 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                              {group.items.map((txn) => renderTransactionRow(txn))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : groupByDateTimeAccordion ? (
            <div className="space-y-3.5">
              {accordionDateTimeGroupedTransactions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 font-bold">
                  Tiada transaksi disahkan ditemui sepadan dengan kriteria carian.
                </div>
              ) : (
                accordionDateTimeGroupedTransactions.map((group) => {
                  const isCollapsed = collapsedAccordionDates[group.groupName] === true;
                  return (
                    <div 
                      key={group.groupName} 
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden transition-all duration-200"
                    >
                      {/* Accordion Header */}
                      <div 
                        onClick={() => {
                          setCollapsedAccordionDates(prev => ({
                            ...prev,
                            [group.groupName]: !prev[group.groupName]
                          }));
                        }}
                        className="bg-amber-50/40 hover:bg-amber-50/70 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer border-b border-slate-150 select-none transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 shadow-2xs">
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </span>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                              <CalendarIcon size={14} className="text-amber-600" />
                              <span>{group.date}</span>
                              <span className="text-slate-300">•</span>
                              <Clock size={14} className="text-amber-600" />
                              <span>{group.time}</span>
                            </span>
                            <span className="text-[10px] font-black bg-amber-100/80 text-amber-950 px-2.5 py-0.5 rounded-full border border-amber-200">
                              {group.items.length} Rekod
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-black self-end sm:self-auto">
                          {group.totalDebit > 0 && (
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 block uppercase font-extrabold">Total Debit:</span>
                              <span className="text-emerald-600 font-extrabold">+RM {group.totalDebit.toFixed(2)}</span>
                            </div>
                          )}
                          {group.totalCredit > 0 && (
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 block uppercase font-extrabold">Total Kredit:</span>
                              <span className="text-rose-500 font-extrabold">-RM {group.totalCredit.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Accordion Body */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[9px] font-extrabold uppercase tracking-wider">
                                <th className="py-3.5 px-4">Tarikh</th>
                                <th className="py-3.5 px-4">Rujukan</th>
                                <th className="py-3.5 px-4">Kategori / Akaun</th>
                                <th className="py-3.5 px-4">Catatan Perincian</th>
                                <th className="py-3.5 px-4 text-right">Debit (RM)</th>
                                <th className="py-3.5 px-4 text-right">Kredit (RM)</th>
                                <th className="py-3.5 px-4 text-center">Status</th>
                                <th className="py-3.5 px-4 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                              {group.items.map((txn) => renderTransactionRow(txn))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Flat Table (Standard View) */
            <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[9px] font-extrabold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Tarikh</th>
                      <th className="py-3.5 px-4">Rujukan</th>
                      <th className="py-3.5 px-4">Kategori / Akaun</th>
                      <th className="py-3.5 px-4">Catatan Perincian</th>
                      <th className="py-3.5 px-4 text-right">Debit (RM)</th>
                      <th className="py-3.5 px-4 text-right">Kredit (RM)</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {filteredTransactions.filter(txn => txn.approvalStatus !== 'Pending').length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400 font-bold">
                          Tiada transaksi disahkan ditemui sepadan dengan kriteria carian.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.filter(txn => txn.approvalStatus !== 'Pending').map(txn => renderTransactionRow(txn))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. UNTUNG RUGI (INCOME STATEMENT) */}
      {activeTab === 'untung-rugi' && (
        <div className="space-y-6">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jumlah Pendapatan</p>
              <p className="text-xl font-black text-slate-900 mt-1">RM {profitLossData.totalIncome.toFixed(2)}</p>
              <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full w-full" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jumlah Perbelanjaan</p>
              <p className="text-xl font-black text-slate-900 mt-1">RM {profitLossData.totalExpense.toFixed(2)}</p>
              <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-rose-500 h-full" 
                  style={{ width: `${profitLossData.totalIncome > 0 ? Math.min((profitLossData.totalExpense / profitLossData.totalIncome) * 100, 100) : 0}%` }} 
                />
              </div>
            </div>

            <div className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs ${profitLossData.surplus >= 0 ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'}`}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lebihan / Defisit</p>
              <p className={`text-xl font-black mt-1 ${profitLossData.surplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                RM {profitLossData.surplus.toFixed(2)}
              </p>
              <p className="text-[9px] text-slate-400 font-bold mt-1">Status Lebihan Sesi Semasa</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Margin Keuntungan</p>
              <p className="text-xl font-black text-slate-900 mt-1">{profitLossData.margin.toFixed(1)}%</p>
              <p className="text-[9px] text-indigo-600 font-bold mt-1">Peratusan kecekapan dana</p>
            </div>
          </div>

          {/* Interactive Chart Visualizations (Custom SVG for maximum React 19 stability) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Pendapatan vs Perbelanjaan Comparison */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Carta Perbandingan Dana (RM)</h4>
                <p className="text-[10px] text-slate-400 font-bold">Perbandingan visual antara kemasukan yuran/sumbangan dan aliran belanja bulanan</p>
              </div>

              <div className="h-44 w-full flex items-end justify-around pb-2 border-b border-slate-150">
                {/* Bar 1: Pendapatan */}
                <div className="flex flex-col items-center w-20 group">
                  <span className="text-[10px] font-black text-emerald-600 mb-1">RM{profitLossData.totalIncome}</span>
                  <div className="w-12 bg-emerald-500 rounded-t-lg transition-all group-hover:bg-emerald-600 h-32" />
                  <span className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase">Pendapatan</span>
                </div>

                {/* Bar 2: Perbelanjaan */}
                <div className="flex flex-col items-center w-20 group">
                  <span className="text-[10px] font-black text-rose-500 mb-1">RM{profitLossData.totalExpense}</span>
                  <div 
                    className="w-12 bg-rose-400 rounded-t-lg transition-all group-hover:bg-rose-500" 
                    style={{ height: `${profitLossData.totalIncome > 0 ? Math.min((profitLossData.totalExpense / profitLossData.totalIncome) * 110, 120) : 40}px` }}
                  />
                  <span className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase">Perbelanjaan</span>
                </div>
              </div>

              <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                  <span>Kutipan Yuran, Sumbangan & Sewaan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-400" />
                  <span>Bil Utiliti, Kebersihan, Keselamatan</span>
                </div>
              </div>
            </div>

            {/* Chart 2: Perbelanjaan Breakdown Stacked Visualizer */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Pecahan Perbelanjaan Mengikut Kategori</h4>
                <p className="text-[10px] text-slate-400 font-bold">Pengagihan agihan belanjawan bulanan persatuan penduduk</p>
              </div>

              <div className="space-y-3.5">
                {Object.keys(profitLossData.expenses).length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold text-center py-10">Tiada rekod perbelanjaan dijumpai.</p>
                ) : (
                  Object.entries(profitLossData.expenses).map(([category, rawAmount]) => {
                    const amount = rawAmount as number;
                    const percentage = profitLossData.totalExpense > 0 ? (amount / profitLossData.totalExpense) * 100 : 0;
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-slate-800">{category}</span>
                          <span className="text-slate-500">RM {amount.toFixed(2)} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                          <div 
                            className="bg-indigo-600 h-full rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Statement Table Section */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-3xs overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Kandungan Penyata Untung Rugi</span>
              <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase">Penyata Rasmi</span>
            </div>

            <div className="p-6 space-y-6">
              
              {/* SECTION PENDAPATAN */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider border-b border-emerald-100 pb-1 flex justify-between">
                  <span>A. PENDAPATAN (INCOME)</span>
                  <span>RM</span>
                </h4>
                
                <div className="divide-y divide-slate-100 pl-2">
                  {incomeCategories.map(cat => {
                    const amt = profitLossData.incomes[cat] || 0;
                    return (
                      <div key={cat} className="flex justify-between py-2 text-xs font-bold text-slate-700">
                        <span>{cat}</span>
                        <span>{amt.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between py-2.5 text-xs font-black text-slate-900 border-t border-slate-200 bg-slate-50/50 px-2">
                    <span>JUMLAH PENDAPATAN</span>
                    <span>{profitLossData.totalIncome.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* SECTION PERBELANJAAN */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider border-b border-rose-100 pb-1 flex justify-between">
                  <span>B. PERBELANJAAN (EXPENSES)</span>
                  <span>RM</span>
                </h4>
                
                <div className="divide-y divide-slate-100 pl-2">
                  {expenseCategories.map(cat => {
                    const amt = profitLossData.expenses[cat] || 0;
                    return (
                      <div key={cat} className="flex justify-between py-2 text-xs font-bold text-slate-700">
                        <span>{cat}</span>
                        <span>{amt.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between py-2.5 text-xs font-black text-slate-900 border-t border-slate-200 bg-slate-50/50 px-2">
                    <span>JUMLAH PERBELANJAAN</span>
                    <span>{profitLossData.totalExpense.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* SURPLUS CALCULATION */}
              <div className="border-t-2 border-slate-300 pt-4 flex justify-between items-center text-sm font-black text-slate-900 bg-slate-900 text-white p-4 rounded-xl shadow-xs">
                <span>LEBIHAN / DEFISIT SEMASA (A - B)</span>
                <span>RM {profitLossData.surplus.toFixed(2)}</span>
              </div>

            </div>
          </div>

          {/* SIGNATURES AND AUDIT BLOCK */}
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-3xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="text-indigo-600" size={18} />
              <h4 className="text-xs font-black uppercase tracking-wider">Seksyen Pengesahan & Audit Berdigital</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2">
              {/* Box 1: Prepared By (Bendahari) */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2 flex flex-col justify-between min-h-[150px]">
                <div>
                  <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Disediakan Oleh</p>
                  <p className="text-xs font-black text-slate-800 line-clamp-1">{bendahariName}</p>
                  <p className="text-[9px] text-slate-500 font-bold">Bendahari SMAUJ / PIBG</p>
                </div>
                <div>
                  {verificationData.preparedSigned && verificationData.preparedSignURL ? (
                    <div className="space-y-1">
                      <div className="h-12 flex items-center justify-center bg-white rounded border border-slate-100 p-1">
                        <img 
                          src={verificationData.preparedSignURL} 
                          alt="Tandatangan Bendahari" 
                          className="max-h-full max-w-full object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-500">
                        <span className="text-emerald-600 font-extrabold">Signed Digitally</span>
                        <span className="font-mono">{verificationData.preparedAt.split(',')[0]}</span>
                      </div>
                      {canClear('prepared') && (
                        <button 
                          onClick={() => handleClearSignature('prepared')} 
                          className="text-[8px] text-rose-500 hover:underline w-full text-center font-bold cursor-pointer"
                        >
                          Padam
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-10 flex items-center justify-center border border-dashed border-slate-200 rounded text-[9px] text-slate-400 font-semibold bg-white">
                        Menunggu Tandatangan
                      </div>
                      {canSign('prepared') ? (
                        <button
                          onClick={() => handleOpenSignModal('prepared', 'Bendahari', bendahariName)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] py-1 px-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>✍️ Tandatangan</span>
                        </button>
                      ) : (
                        <p className="text-[8px] text-slate-400 text-center font-bold italic">Hanya Bendahari</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Reviewed By (Setiausaha) */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2 flex flex-col justify-between min-h-[150px]">
                <div>
                  <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Disemak Oleh</p>
                  <p className="text-xs font-black text-slate-800 line-clamp-1">{setiausahaName}</p>
                  <p className="text-[9px] text-slate-500 font-bold">Setiausaha PIBG / Sekolah</p>
                </div>
                <div>
                  {verificationData.reviewedSigned && verificationData.reviewedSignURL ? (
                    <div className="space-y-1">
                      <div className="h-12 flex items-center justify-center bg-white rounded border border-slate-100 p-1">
                        <img 
                          src={verificationData.reviewedSignURL} 
                          alt="Tandatangan Setiausaha" 
                          className="max-h-full max-w-full object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-500">
                        <span className="text-emerald-600 font-extrabold">Signed Digitally</span>
                        <span className="font-mono">{verificationData.reviewedAt.split(',')[0]}</span>
                      </div>
                      {canClear('reviewed') && (
                        <button 
                          onClick={() => handleClearSignature('reviewed')} 
                          className="text-[8px] text-rose-500 hover:underline w-full text-center font-bold cursor-pointer"
                        >
                          Padam
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-10 flex items-center justify-center border border-dashed border-slate-200 rounded text-[9px] text-slate-400 font-semibold bg-white">
                        Menunggu Tandatangan
                      </div>
                      {canSign('reviewed') ? (
                        <button
                          onClick={() => handleOpenSignModal('reviewed', 'Setiausaha', setiausahaName)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] py-1 px-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>✍️ Tandatangan</span>
                        </button>
                      ) : (
                        <p className="text-[8px] text-slate-400 text-center font-bold italic">Hanya Setiausaha</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 3: Authorized By (Pengerusi) */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2 flex flex-col justify-between min-h-[150px]">
                <div>
                  <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Disahkan Oleh</p>
                  <p className="text-xs font-black text-slate-800 line-clamp-1">{pengerusiName}</p>
                  <p className="text-[9px] text-slate-500 font-bold">Pengetua / YDP PIBG</p>
                </div>
                <div>
                  {verificationData.authorizedSigned && verificationData.authorizedSignURL ? (
                    <div className="space-y-1">
                      <div className="h-12 flex items-center justify-center bg-white rounded border border-slate-100 p-1">
                        <img 
                          src={verificationData.authorizedSignURL} 
                          alt="Tandatangan Pengerusi" 
                          className="max-h-full max-w-full object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-500">
                        <span className="text-emerald-600 font-extrabold">Authorized OK</span>
                        <span className="font-mono">{verificationData.authorizedAt.split(',')[0]}</span>
                      </div>
                      {canClear('authorized') && (
                        <button 
                          onClick={() => handleClearSignature('authorized')} 
                          className="text-[8px] text-rose-500 hover:underline w-full text-center font-bold cursor-pointer"
                        >
                          Padam
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-10 flex items-center justify-center border border-dashed border-slate-200 rounded text-[9px] text-slate-400 font-semibold bg-white">
                        Menunggu Tandatangan
                      </div>
                      {canSign('authorized') ? (
                        <button
                          onClick={() => handleOpenSignModal('authorized', 'Pengerusi', pengerusiName)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] py-1 px-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>✍️ Tandatangan</span>
                        </button>
                      ) : (
                        <p className="text-[8px] text-slate-400 text-center font-bold italic">Hanya Pengerusi</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 4: Audited By (1) */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2 flex flex-col justify-between min-h-[150px]">
                <div>
                  <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Diaudit Oleh (1)</p>
                  <p className="text-xs font-black text-slate-800 line-clamp-1">{juruAudit1Name}</p>
                  <p className="text-[9px] text-slate-500 font-bold">Juruaudit Dalaman 1</p>
                </div>
                <div>
                  {verificationData.audited1Signed && verificationData.audited1SignURL ? (
                    <div className="space-y-1">
                      <div className="h-12 flex items-center justify-center bg-white rounded border border-slate-100 p-1">
                        <img 
                          src={verificationData.audited1SignURL} 
                          alt="Tandatangan Juruaudit 1" 
                          className="max-h-full max-w-full object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-500">
                        <span className="text-emerald-600 font-extrabold">Selesai Audit</span>
                        <span className="font-mono">{verificationData.audited1At.split(',')[0]}</span>
                      </div>
                      {canClear('audited1') && (
                        <button 
                          onClick={() => handleClearSignature('audited1')} 
                          className="text-[8px] text-rose-500 hover:underline w-full text-center font-bold cursor-pointer"
                        >
                          Padam
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-10 flex items-center justify-center border border-dashed border-slate-200 rounded text-[9px] text-slate-400 font-semibold bg-white">
                        Menunggu Tandatangan
                      </div>
                      {canSign('audited1') ? (
                        <button
                          onClick={() => handleOpenSignModal('audited1', 'Juruaudit 1', juruAudit1Name)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] py-1 px-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>✍️ Tandatangan</span>
                        </button>
                      ) : (
                        <p className="text-[8px] text-slate-400 text-center font-bold italic">Hanya Juruaudit</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 5: Audited By (2) */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2 flex flex-col justify-between min-h-[150px]">
                <div>
                  <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Diaudit Oleh (2)</p>
                  <p className="text-xs font-black text-slate-800 line-clamp-1">{juruAudit2Name}</p>
                  <p className="text-[9px] text-slate-500 font-bold">Juruaudit Dalaman 2</p>
                </div>
                <div>
                  {verificationData.audited2Signed && verificationData.audited2SignURL ? (
                    <div className="space-y-1">
                      <div className="h-12 flex items-center justify-center bg-white rounded border border-slate-100 p-1">
                        <img 
                          src={verificationData.audited2SignURL} 
                          alt="Tandatangan Juruaudit 2" 
                          className="max-h-full max-w-full object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-500">
                        <span className="text-emerald-600 font-extrabold">Selesai Audit</span>
                        <span className="font-mono">{verificationData.audited2At.split(',')[0]}</span>
                      </div>
                      {canClear('audited2') && (
                        <button 
                          onClick={() => handleClearSignature('audited2')} 
                          className="text-[8px] text-rose-500 hover:underline w-full text-center font-bold cursor-pointer"
                        >
                          Padam
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-10 flex items-center justify-center border border-dashed border-slate-200 rounded text-[9px] text-slate-400 font-semibold bg-white">
                        Menunggu Tandatangan
                      </div>
                      {canSign('audited2') ? (
                        <button
                          onClick={() => handleOpenSignModal('audited2', 'Juruaudit 2', juruAudit2Name)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] py-1 px-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>✍️ Tandatangan</span>
                        </button>
                      ) : (
                        <p className="text-[8px] text-slate-400 text-center font-bold italic">Hanya Juruaudit</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Treasurer & Auditor comments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-800">
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Catatan Bendahari:</label>
                  {(currentUserDoc?.role === 'Bendahari' || isAdminUtama) ? (
                    <button 
                      onClick={handleSaveTreasurerComment}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      Simpan Catatan
                    </button>
                  ) : (
                    <span className="text-[8px] text-slate-400 italic">Hanya Bendahari</span>
                  )}
                </div>
                <textarea 
                  value={localTreasurerComment}
                  onChange={(e) => setLocalTreasurerComment(e.target.value)}
                  disabled={!(currentUserDoc?.role === 'Bendahari' || isAdminUtama)}
                  placeholder="Tiada catatan direkodkan..."
                  className="w-full border border-slate-200 p-2 text-xs font-medium text-slate-800 rounded-lg placeholder-slate-400 h-16 focus:outline-indigo-600 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Catatan & Ulasan Juruaudit:</label>
                  {(currentUserDoc?.role === 'Juru Audit' || isAdminUtama) ? (
                    <button 
                      onClick={handleSaveAuditorComment}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      Simpan Catatan
                    </button>
                  ) : (
                    <span className="text-[8px] text-slate-400 italic">Hanya Juruaudit</span>
                  )}
                </div>
                <textarea 
                  value={localAuditorComment}
                  onChange={(e) => setLocalAuditorComment(e.target.value)}
                  disabled={!(currentUserDoc?.role === 'Juru Audit' || isAdminUtama)}
                  placeholder="Tiada catatan & ulasan direkodkan..."
                  className="w-full border border-slate-200 p-2 text-xs font-medium text-slate-800 rounded-lg placeholder-slate-400 h-16 focus:outline-indigo-600 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 3. KUNCI KIRA-KIRA (BALANCE SHEET) */}
      {activeTab === 'kunci-kira-kira' && (
        <div className="space-y-6">
          
          {/* Warning Banner if Unbalanced (Only show if all accounts are viewed) */}
          {filterAccount === "All" && !balanceSheetData.isBalanced && (
            <div className="bg-rose-50 border border-rose-150 p-4 rounded-xl flex items-center gap-3 text-rose-700 animate-pulse">
              <AlertTriangle size={18} strokeWidth={2.5} />
              <div className="text-xs font-bold">
                <p className="font-extrabold uppercase">AMARAN: KUNCI KIRA-KIRA TIDAK SEIMBANG!</p>
                <p className="opacity-90 mt-0.5">Sila semak semula kemasukan transaksi debit dan kredit dalam lejar umum anda.</p>
              </div>
            </div>
          )}

          {/* Balance Sheet Concept Header */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-1.5">
              <span className="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Formula Perakaunan</span>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">Jumlah Aset (A) = Jumlah Liabiliti + Dana Persatuan (B)</h4>
              <p className="text-[10px] text-slate-400 font-bold">Kedudukan kewangan rasmi Persatuan setakat tarikh hari ini.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-5 w-full lg:w-auto">
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-[9px] font-black uppercase text-slate-400">Jumlah Aset (A)</p>
                  <p className="text-base font-black text-slate-900">RM {balanceSheetData.totalAset.toFixed(2)}</p>
                </div>
                <div className="text-center border-l border-slate-200 pl-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">Liabiliti & Dana (B)</p>
                  <p className="text-base font-black text-indigo-600">RM {balanceSheetData.totalLiabilitiDanDana.toFixed(2)}</p>
                </div>
              </div>

              {isFinanceAdmin && (
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setFormItemName("");
                    setFormItemVal("");
                    setShowAssetLiabilityModal(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider ml-auto lg:ml-0 animate-pulse hover:animate-none"
                >
                  <Plus size={13} className="stroke-[3]" />
                  <span>Urus Aset & Liabiliti</span>
                </button>
              )}
            </div>
          </div>

          {/* Balance Sheet Statement */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-3xs overflow-hidden">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              
              {/* SEKSYEN ASET */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider border-b-2 border-indigo-900 pb-1">1. SEKSYEN ASET</h3>
                </div>

                {/* Aset Semasa */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Aset Semasa:</h4>
                  <div className="space-y-2 pl-2 text-xs font-bold text-slate-700">
                    {(filterAccount === "All" || filterAccount === "Tunai") && (
                      <div className="flex justify-between">
                        <span>Tunai di Tangan</span>
                        <span>{totals.currentTunai.toFixed(2)}</span>
                      </div>
                    )}
                    {(filterAccount === "All" || filterAccount === "Bank") && (
                      <div className="flex justify-between">
                        <span>Tunai di Bank</span>
                        <span>{totals.currentBank.toFixed(2)}</span>
                      </div>
                    )}
                    {otherCurrentAssets.map(item => (
                      <div key={item.id} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>{item.val.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2.5 text-xs font-black text-slate-900 border-t border-slate-100 bg-slate-50 px-2.5 rounded-lg">
                      <span>Jumlah Aset Semasa</span>
                      <span>{balanceSheetData.asetSemasa.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Aset Bukan Semasa */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Aset Bukan Semasa (Aset Tetap):</h4>
                  <div className="space-y-2 pl-2 text-xs font-bold text-slate-700">
                    {fixedAssets.map(item => (
                      <div key={item.id || item.name} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>{item.val.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2.5 text-xs font-black text-slate-900 border-t border-slate-100 bg-slate-50 px-2.5 rounded-lg">
                      <span>Jumlah Aset Bukan Semasa</span>
                      <span>{balanceSheetData.asetBukanSemasa.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* TOTAL ASET */}
                <div className="bg-indigo-950 text-white p-3.5 rounded-xl flex justify-between items-center text-xs font-black uppercase">
                  <span>JUMLAH ASET</span>
                  <span>RM {balanceSheetData.totalAset.toFixed(2)}</span>
                </div>
              </div>

              {/* SEKSYEN LIABILITI & DANA */}
              <div className="space-y-6 md:pl-8 pt-6 md:pt-0">
                <div>
                  <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider border-b-2 border-indigo-900 pb-1">2. SEKSYEN LIABILITI & DANA PERSATUAN</h3>
                </div>

                {/* Liabiliti */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Liabiliti (Hutang Belum Bayar):</h4>
                  <div className="space-y-2 pl-2 text-xs font-bold text-slate-700">
                    {liabilitiesList.map(item => (
                      <div key={item.id || item.name} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>{item.val.toFixed(2)}</span>
                      </div>
                    ))}
                    {otherLiabilities.map(item => (
                      <div key={item.id || item.name} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>{item.val.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2.5 text-xs font-black text-slate-900 border-t border-slate-100 bg-slate-50 px-2.5 rounded-lg">
                      <span>Jumlah Liabiliti</span>
                      <span>{balanceSheetData.liabiliti.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Dana Persatuan */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Dana Persatuan & Rizab:</h4>
                  <div className="space-y-2 pl-2 text-xs font-bold text-slate-700">
                    {balanceSheetData.bakiBawaHadapan !== 0 && (
                      <div className="flex justify-between">
                        <span>Baki Bawa Hadapan (Dana Terkumpul Awal)</span>
                        <span>{balanceSheetData.bakiBawaHadapan.toFixed(2)}</span>
                      </div>
                    )}
                    {capitalList.map(item => (
                      <div key={item.id || item.name} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>{item.val.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-indigo-700 font-extrabold">
                      <span>Lebihan Bersih Sesi Semasa</span>
                      <span>{profitLossData.surplus.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2.5 text-xs font-black text-slate-900 border-t border-slate-100 bg-slate-50 px-2.5 rounded-lg">
                      <span>Jumlah Dana</span>
                      <span>{balanceSheetData.danaPersatuan.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* TOTAL LIABILITI & DANA */}
                <div className="bg-indigo-900 text-white p-3.5 rounded-xl flex justify-between items-center text-xs font-black uppercase">
                  <span>JUMLAH LIABILITI & DANA</span>
                  <span>RM {balanceSheetData.totalLiabilitiDanDana.toFixed(2)}</span>
                </div>
              </div>

            </div>
          </div>
          
          {/* Metadata */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex flex-wrap justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <span>Tarikh Penyata: {currentStatementDate}</span>
              <span>Status Audit: {currentAuditStatus}</span>
              <span>Nama Bendahari: {currentTreasurerName}</span>
            </div>
            {isFinanceAdmin && (
              <button 
                onClick={handleOpenMetadataModal}
                className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer font-black"
              >
                ⚙️ Kemaskini Maklumat
              </button>
            )}
          </div>

        </div>
      )}

      {/* 4. CASH FLOW (PERGERAKAN TUNAI) */}
      {activeTab === 'aliran-tunai' && (
        <div className="space-y-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-3xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Baki Awal (Brought Forward)</span>
              <p className="text-base font-black text-slate-900 mt-2">RM {bakiAwal.toFixed(2)}</p>
              <p className="text-[8px] text-slate-400 font-bold mt-1">
                {filterYear !== "All" ? `Baki sedia ada awal Sesi ${filterYear}/${parseInt(filterYear)+1}` : 'Baki permulaan sistem'}
              </p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-3xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-emerald-600">Tunai Masuk (Inflow)</span>
              <p className="text-base font-black text-emerald-600 mt-2">RM {cashFlowData.totalInflow.toFixed(2)}</p>
              <p className="text-[8px] text-emerald-600 font-bold mt-1">Sumbangan & Yuran berbayar</p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-3xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-rose-500">Tunai Keluar (Outflow)</span>
              <p className="text-base font-black text-rose-500 mt-2">RM {cashFlowData.totalOutflow.toFixed(2)}</p>
              <p className="text-[8px] text-rose-500 font-bold mt-1">Perbelanjaan operasi & utiliti</p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-3xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Baki Akhir (Carried Forward)</span>
              <p className="text-base font-black text-slate-900 mt-2">RM {cashFlowData.bakiAkhir.toFixed(2)}</p>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Baki aliran tunai semasa</p>
            </div>
          </div>

          {/* Cash Flow Statement */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-3xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Jadual Penyata Aliran Tunai Sebenar</span>
            </div>

            <div className="p-6 space-y-6">
              {/* Aliran Wang Masuk */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider border-b border-emerald-100 pb-1">1. ALIRAN TUNAI MASUK (CASH INFLOW)</h4>
                <div className="space-y-2 pl-2 text-xs font-bold text-slate-700">
                  {cashFlowData.inflows.length === 0 ? (
                    <p className="text-xs text-slate-400 font-bold italic py-1">Tiada aliran wang masuk direkodkan.</p>
                  ) : (
                    cashFlowData.inflows.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1.5 border-b border-slate-50">
                        <span>{item.name}</span>
                        <span className="text-emerald-600 font-extrabold">+{item.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Aliran Wang Keluar */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider border-b border-rose-100 pb-1">2. ALIRAN TUNAI KELUAR (CASH OUTFLOW)</h4>
                <div className="space-y-2 pl-2 text-xs font-bold text-slate-700">
                  {cashFlowData.outflows.length === 0 ? (
                    <p className="text-xs text-slate-400 font-bold italic py-1">Tiada aliran wang keluar direkodkan.</p>
                  ) : (
                    cashFlowData.outflows.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1.5 border-b border-slate-50">
                        <span>{item.name}</span>
                        <span className="text-rose-500 font-extrabold">-{item.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* NET CHANGE IN CASH */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center text-xs font-black uppercase">
                <span>PERUBAHAN BERSIH ALIRAN TUNAI</span>
                <span className={cashFlowData.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  RM {cashFlowData.netChange.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: TRANSACTION FULL DETAIL (DRAWER SIMULATOR) */}
      {showDetailModal && selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider uppercase">Butiran Transaksi: {selectedTxn.id}</span>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-white/80 hover:text-white font-extrabold text-xs cursor-pointer bg-white/10 p-1.5 rounded-full"
              >
                <X size={14} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">No Voucher</label>
                  <p className="text-xs font-black text-slate-900">{selectedTxn.voucherNo}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Amaun Transaksi</label>
                  <p className="text-sm font-black text-emerald-600">RM {selectedTxn.amount.toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tarikh & Masa</label>
                  <p className="text-xs font-bold text-slate-800">{selectedTxn.date} @ {selectedTxn.time}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Kategori / Kumpulan</label>
                  <p className="text-xs font-bold text-slate-800">{selectedTxn.category}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Akaun Debit (Db)</label>
                  <p className="text-xs font-extrabold text-indigo-750">{selectedTxn.accountDebit}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Akaun Kredit (Cr)</label>
                  <p className="text-xs font-extrabold text-rose-750">{selectedTxn.accountCredit}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Catatan Perihalan</label>
                <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {selectedTxn.description}
                </p>
              </div>

              {selectedTxn.notes && (
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Catatan Tambahan Bendahari</label>
                  <p className="text-xs font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-100 leading-normal">
                    📌 {selectedTxn.notes}
                  </p>
                </div>
              )}

              {/* Status and approval block */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 space-y-2">
                {selectedTxn.memberEmail && (() => {
                  const detailMemberUser = allUsers?.find(u => u.email === selectedTxn.memberEmail);
                  const detailMemberName = detailMemberUser?.displayName || selectedTxn.memberEmail;
                  const detailMemberNoRumah = detailMemberUser?.noRumah;
                  return (
                    <div className="border-b border-slate-200/60 pb-2 mb-1 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-400">Ahli Pembayar</span>
                        <span className="text-xs font-extrabold text-indigo-750 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg select-all">
                          {detailMemberName}
                        </span>
                      </div>
                      {detailMemberNoRumah && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-slate-400">No Rumah</span>
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                            No {detailMemberNoRumah}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400">Status Kelulusan</span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                    selectedTxn.approvalStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedTxn.approvalStatus === 'Approved' ? 'Lulus' : 'Menunggu Kelulusan'}
                  </span>
                </div>
                {selectedTxn.approvedBy && (
                  <div className="text-[10px] text-slate-600 font-semibold space-y-0.5">
                    <p>Diluluskan Oleh: <span className="font-extrabold text-slate-900">{selectedTxn.approvedBy}</span></p>
                    <p>Tarikh Kelulusan: <span className="font-extrabold text-slate-900">{selectedTxn.approvedDate}</span></p>
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Lampiran Dokumen</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold text-indigo-700">
                    <FileText size={16} />
                    <span className="truncate">{selectedTxn.receiptAttachment || 'resit_pembelian.pdf'}</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold text-indigo-700">
                    <FileText size={16} />
                    <span className="truncate">{selectedTxn.invoiceAttachment || 'invois_syarikat.pdf'}</span>
                  </div>
                </div>
              </div>

              {/* Audit trail */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Audit Trail & Log Perubahan</label>
                <div className="space-y-1.5 pl-1">
                  {selectedTxn.auditTrail.map((log, idx) => (
                    <div key={idx} className="flex gap-2 text-[9px] text-slate-500 font-bold leading-normal">
                      <span>•</span>
                      <p>
                        <span className="text-slate-800 font-extrabold">{log.time}</span> - {log.user}: {log.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Actions Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-150 flex justify-between gap-2">
              <div className="flex gap-2">
                {(isAdminUtama || isBendahari) && (
                  <>
                    <button 
                      onClick={() => handleApproveStatusDirectly(selectedTxn, 'Approved')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                    >
                      Luluskan Transaksi
                    </button>
                    <button 
                      onClick={() => handleApproveStatusDirectly(selectedTxn, 'Rejected')}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                    >
                      Tolak
                    </button>
                  </>
                )}
              </div>
              <button 
                onClick={async () => {
                  try {
                    await generateReceiptPdf(selectedTxn, allUsers || []);
                  } catch (err) {
                    console.error(err);
                    alert("Gagal memuat turun resit PDF.");
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-900 hover:bg-indigo-950 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all"
              >
                <Download size={12} />
                <span>Cetak Baucer (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT TRANSACTION FORM */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4.5 flex justify-between items-center">
              <span className="text-xs font-black tracking-wider uppercase">
                {isEditMode ? 'Kemaskini Transaksi' : 'Merekod Transaksi Baharu'}
              </span>
              <button 
                onClick={() => setShowAddEditModal(false)}
                className="text-white/80 hover:text-white font-extrabold text-xs cursor-pointer bg-white/10 p-1.5 rounded-full"
              >
                <X size={14} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTransaction} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Tarikh <span className="text-rose-500">*</span></label>
                  <input 
                    type="date" 
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Masa <span className="text-rose-500">*</span></label>
                  <input 
                    type="time" 
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Jenis Transaksi Toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Jenis Transaksi</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormTxnType('standard')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formTxnType === 'standard' 
                        ? 'bg-white text-slate-900 shadow-3xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Kutipan / Belanja
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTxnType('contra')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formTxnType === 'contra' 
                        ? 'bg-white text-slate-900 shadow-3xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Pindahan Kontra (Bank ⇄ Tunai)
                  </button>
                </div>
              </div>

              {formTxnType === 'contra' ? (
                <div className="space-y-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-250">
                  <span className="text-[9px] font-black tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Tetapan Kontra Automatik
                  </span>
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Arah Pindahan Wang</label>
                    <select
                      value={formContraDirection}
                      onChange={(e) => setFormContraDirection(e.target.value as 'bank_to_cash' | 'cash_to_bank')}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="bank_to_cash">Ambilan Tunai dari Bank (Bank ➔ Tunai)</option>
                      <option value="cash_to_bank">Deposit Tunai ke Bank (Tunai ➔ Bank)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 text-[11px] font-semibold text-slate-600">
                    <div className="bg-white border border-slate-150 p-2 rounded-lg">
                      <span className="text-[8px] font-black text-slate-400 block uppercase">Debited Account (Db)</span>
                      <span className="font-extrabold text-indigo-750">{formDebitAccount}</span>
                    </div>
                    <div className="bg-white border border-slate-150 p-2 rounded-lg">
                      <span className="text-[8px] font-black text-slate-400 block uppercase">Credited Account (Cr)</span>
                      <span className="font-extrabold text-rose-600">{formCreditAccount}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 italic">
                    * Nota Akauntan: Pindahan kontra ini tidak menjejaskan jumlah pendapatan atau perbelanjaan persatuan.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Akaun Debit (Db) <span className="text-rose-500">*</span></label>
                    <input 
                      type="text"
                      list="accountsListList"
                      value={formDebitAccount} 
                      onChange={(e) => setFormDebitAccount(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Akaun Kredit (Cr) <span className="text-rose-500">*</span></label>
                    <input 
                      type="text"
                      list="accountsListList"
                      value={formCreditAccount} 
                      onChange={(e) => setFormCreditAccount(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                    />
                    <datalist id="accountsListList">
                      {accountsList.map(acc => <option key={acc} value={acc} />)}
                    </datalist>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Amaun (RM) <span className="text-rose-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 placeholder-slate-400"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Kategori <span className="text-rose-500">*</span></label>
                  {formTxnType === 'contra' ? (
                    <div className="w-full border border-slate-200 bg-indigo-50/50 rounded-lg p-2 text-xs font-extrabold text-indigo-700 block">
                      Pindahan Wang (Kontra)
                    </div>
                  ) : (
                    <>
                      <input 
                        type="text"
                        list="categoriesListList"
                        value={formCategory} 
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="Contoh: Yuran Bulanan"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                      />
                      <datalist id="categoriesListList">
                        {categoriesList.map(cat => <option key={cat} value={cat} />)}
                      </datalist>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">No Voucher</label>
                <input 
                  type="text" 
                  disabled
                  value={formVoucherNo}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-500 bg-slate-50 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Tujuan / Perihalan <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 placeholder-slate-400"
                  placeholder="cth: Bayaran bil elektrik atau kutipan yuran penduduk"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Catatan Tambahan Bendahari</label>
                <textarea 
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 placeholder-slate-400 h-16"
                  placeholder="Cth: Kelulusan diperoleh dalam Mesyuarat Jawatankuasa Bil. 3/2026"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Kelulusan & Aliran Kerja</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="approval_status" 
                      checked={formStatus === 'Approved'}
                      onChange={() => setFormStatus('Approved')}
                    />
                    <span>Approved (Lulus)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="approval_status" 
                      checked={formStatus === 'Pending'}
                      onChange={() => setFormStatus('Pending')}
                    />
                    <span>Pending</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowAddEditModal(false)}
                  disabled={isSavingTxn}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingTxn}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingTxn ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Sila tunggu...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? 'Simpan Kemaskini' : 'Tambah Transaksi'}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSET & LIABILITY MANAGEMENT */}
      {showAssetLiabilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-950 text-white p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xs font-black tracking-wider uppercase">Pengurusan Aset & Liabiliti</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Tambah, edit dan padam nilai aset, liabiliti, dan dana persatuan.</p>
              </div>
              <button 
                onClick={() => {
                  setShowAssetLiabilityModal(false);
                  setEditingItem(null);
                  setFormItemName("");
                  setFormItemVal("");
                }}
                className="text-white/80 hover:text-white font-extrabold text-xs cursor-pointer bg-white/10 p-2 rounded-full"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Category tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
                {[
                  { id: 'fixed-assets', label: 'Aset Bukan Semasa (Tetap)' },
                  { id: 'current-assets', label: 'Aset Semasa Lain' },
                  { id: 'liabilities', label: 'Liabiliti Bukan Semasa' },
                  { id: 'other-liabilities', label: 'Liabiliti Semasa' },
                  { id: 'capital', label: 'Dana Persatuan / Rizab' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveAssetLiabilityTab(tab.id as any);
                      setEditingItem(null);
                      setFormItemName("");
                      setFormItemVal("");
                    }}
                    className={`flex-1 min-w-[120px] text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-lg transition-all cursor-pointer ${
                      activeAssetLiabilityTab === tab.id
                        ? 'bg-indigo-950 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Side: List of current items */}
                <div className="md:col-span-7 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Senarai Item Aktif</h4>
                  
                  <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-[250px] overflow-y-auto bg-slate-50/50">
                    {/* Get items for active tab */}
                    {(() => {
                      let items: { id: string; name: string; val: number }[] = [];
                      if (activeAssetLiabilityTab === 'fixed-assets') items = fixedAssets;
                      if (activeAssetLiabilityTab === 'liabilities') items = liabilitiesList;
                      if (activeAssetLiabilityTab === 'current-assets') items = otherCurrentAssets;
                      if (activeAssetLiabilityTab === 'other-liabilities') items = otherLiabilities;
                      if (activeAssetLiabilityTab === 'capital') items = capitalList;

                      if (items.length === 0) {
                        return (
                          <div className="p-8 text-center text-[11px] text-slate-400 font-bold">
                            Tiada item dalam kategori ini.
                          </div>
                        );
                      }

                      return items.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 pr-3">
                            <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                            <p className="text-[10px] font-black text-slate-400 mt-0.5">RM {item.val.toFixed(2)}</p>
                          </div>
                          
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEditAssetLiabilityItem(item)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                              title="Kemaskini"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteAssetLiabilityItem(activeAssetLiabilityTab, item.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Padam"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Right Side: Add / Edit Form */}
                <form onSubmit={handleSaveAssetLiabilityItem} className="md:col-span-5 border border-slate-150 rounded-2xl p-4.5 bg-slate-50 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {editingItem ? 'Kemaskini Butiran' : 'Tambah Rekod Baru'}
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Nama Perihalan / Item</label>
                    <input 
                      type="text"
                      required
                      placeholder="Contoh: Deposit Tetap CIMB"
                      value={formItemName}
                      onChange={(e) => setFormItemName(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Nilai (RM)</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formItemVal}
                      onChange={(e) => setFormItemVal(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="pt-2 flex gap-1.5">
                    {editingItem && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(null);
                          setFormItemName("");
                          setFormItemVal("");
                        }}
                        disabled={isSavingAssetLiability}
                        className="flex-1 py-2 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-slate-100 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingAssetLiability}
                      className="flex-1 py-2 bg-indigo-950 hover:bg-indigo-900 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingAssetLiability ? (
                        <>
                          <RefreshCw size={11} className="animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <span>{editingItem ? 'Simpan' : 'Tambah'}</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-150 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setShowAssetLiabilityModal(false);
                  setEditingItem(null);
                  setFormItemName("");
                  setFormItemVal("");
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carry Forward Modal */}
      {showCarryForwardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <ArrowRightLeft size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Tutup Akaun Sesi</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Carry Forward Kewangan</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCarryForwardModal(false)}
                className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grow bg-slate-50 space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Pilih sesi yang anda ingin tutup. Sistem akan mengira baki akhir sesi tersebut dan menjana <strong>Baki Bawa Hadapan</strong> secara automatik untuk sesi berikutnya, <strong>mengikut tabung/kategori/lejar</strong> masing-masing.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Sesi Untuk Ditutup</label>
                <select 
                  id="carryForwardYearSelect"
                  value={selectedCFYear}
                  onChange={(e) => setSelectedCFYear(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white cursor-pointer"
                >
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const years = new Set<number>();
                    for (let y = 2024; y <= currentYear + 1; y++) years.add(y);
                    if (yuranConfig?.sesiList) {
                      yuranConfig.sesiList.forEach(s => {
                        years.add(s.startYear);
                        years.add(s.startYear + 1);
                      });
                    }
                    return Array.from(years).sort().map(year => (
                      <option key={year} value={year} disabled={closedYears.includes(year.toString())}>
                        Sesi {year} (Jan – Dis) {closedYears.includes(year.toString()) ? '(Telah Ditutup)' : ''}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              {/* Live Preview Summary Card */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-md">
                <div className="flex items-center justify-between border-b border-indigo-700/50 pb-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Pra-Paparan Baki Pembuka</span>
                  <span className="text-[10px] font-black bg-indigo-500/30 px-2 py-0.5 rounded-full text-indigo-200">Sesi {parseInt(selectedCFYear)+1} (Jan – Dis)</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                    <p className="text-[10px] text-slate-300 font-medium">Anggaran Bank</p>
                    <p className={`text-xs font-black mt-0.5 ${projectedCF.balBank >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>RM {projectedCF.balBank.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                    <p className="text-[10px] text-slate-300 font-medium">Anggaran Tunai</p>
                    <p className={`text-xs font-black mt-0.5 ${projectedCF.balTunai >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>RM {projectedCF.balTunai.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-indigo-700/50">
                  <span className="text-xs font-bold text-indigo-200">Jumlah Bawa Hadapan:</span>
                  <span className="text-sm font-black text-white">RM {projectedCF.total.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Per-Category/Tabung/Lejar Breakdown */}
              {Object.keys(projectedCF.categoryBreakdown).length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Layers size={12} />
                      Pecahan Baki Mengikut Tabung / Kategori / Lejar
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {Object.entries(projectedCF.categoryBreakdown as Record<string, { bank: number; tunai: number; total: number }>)
                      .sort(([, a], [, b]) => b.total - a.total)
                      .map(([cat, bal]) => {
                        const catColors: { [key: string]: string } = {
                          'Qurban Aqiqah': 'bg-purple-50 text-purple-700 border-purple-200',
                          'Tabung Van Jenazah': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          'Tabung Kebajikan & Khairat': 'bg-rose-50 text-rose-700 border-rose-200',
                          'Tabung Surau & Komuniti': 'bg-blue-50 text-blue-700 border-blue-200',
                          'Tabung Fasiliti & Taman': 'bg-amber-50 text-amber-700 border-amber-200',
                          'Tabung Kecemasan & Bencana': 'bg-red-50 text-red-700 border-red-200',
                          'Tabung Pendidikan': 'bg-blue-50 text-blue-700 border-blue-200',
                          'Tabung Sumbangan Am': 'bg-teal-50 text-teal-700 border-teal-200',
                          'Yuran Tambahan': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                        };
                        const colorClass = catColors[cat] || 'bg-slate-50 text-slate-700 border-slate-200';
                        return (
                          <div key={cat} className="px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorClass}`}>{cat}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-black text-slate-900">RM {bal.total.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</p>
                              <p className="text-[9px] text-slate-400">
                                {bal.bank > 0 ? `Bank: RM ${bal.bank.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}` : ''}
                                {bal.bank > 0 && bal.tunai > 0 ? ' · ' : ''}
                                {bal.tunai > 0 ? `Tunai: RM ${bal.tunai.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}` : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Pending Transaction Alert Warning */}
              {projectedCF.pendingCount > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3">
                  <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-xs font-bold text-rose-800">Perhatian: {projectedCF.pendingCount} Transaksi Masih Belum Disahkan!</p>
                    <p className="text-[10px] text-rose-700 mt-1">Sila sahkan atau batalkan transaksi dalam status Pending untuk Sesi {selectedCFYear} terlebih dahulu sebelum menutup akaun.</p>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-xs font-bold text-amber-800">Amaran Penting</p>
                  <p className="text-[10px] text-amber-700 mt-1">Tindakan ini akan menjana transaksi Baki Bawa Hadapan mengikut tabung/kategori. Rekod lama kekal selamat untuk rujukan audit. Sesi baru akan dijana secara automatik.</p>
                </div>
              </div>

              {/* Info about auto-session creation */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                <CalendarIcon className="text-blue-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-xs font-bold text-blue-800">Penciptaan Sesi Automatik</p>
                  <p className="text-[10px] text-blue-700 mt-1">Sesi baru akan dijana automatik setiap tahun baru (1 Januari). Baki tabung/kategori yang belum digunakan dari sesi sebelumnya akan dibawa ke sesi seterusnya.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                onClick={() => setShowCarryForwardModal(false)}
                disabled={isCarryingForward}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={async () => {
                  if (projectedCF.pendingCount > 0) {
                    alert(`Terdapat ${projectedCF.pendingCount} transaksi berstatus Pending bagi sesi ini. Sila sahkan atau tolak transaksi tersebut sebelum menutup akaun.`);
                    return;
                  }
                  const select = document.getElementById('carryForwardYearSelect') as HTMLSelectElement;
                  const yearToClose = select?.value || selectedCFYear;
                  
                  // Calculate balance up to end of selected year
                  let balBank = initialBank;
                  let balTunai = initialTunai;
                  
                  // Per-category breakdown for carry forward
                  const cfCategoryBreakdown: { [category: string]: { bank: number; tunai: number } } = {};
                  const trackableCategories = [
                    'Qurban Aqiqah',
                    'Tabung Van Jenazah',
                    'Tabung Kebajikan & Khairat',
                    'Tabung Surau & Komuniti',
                    'Tabung Fasiliti & Taman',
                    'Tabung Kecemasan & Bencana',
                    'Tabung Pendidikan',
                    'Tabung Sumbangan Am',
                  ];

                  approvedTxns.forEach(txn => {
                    if (txn.category === "Baki Bawa Hadapan") return;
                    const txnSession = getTxnSessionYearNum(txn);

                    if (txnSession <= parseInt(yearToClose, 10)) {
                      if (txn.accountDebit === "Bank") balBank += txn.amount;
                      if (txn.accountCredit === "Bank") balBank -= txn.amount;
                      if (txn.accountDebit === "Tunai") balTunai += txn.amount;
                      if (txn.accountCredit === "Tunai") balTunai -= txn.amount;

                      // Track per-category
                      const groupCat = getTransactionGroupCategory(txn);
                      const catKey = trackableCategories.includes(groupCat) ? groupCat : 
                                     (txn.category?.toLowerCase().includes('tambahan') || txn.description?.toLowerCase().includes('yuran tambahan')) ? 'Yuran Tambahan' :
                                     null;
                      
                      if (catKey) {
                        if (!cfCategoryBreakdown[catKey]) {
                          cfCategoryBreakdown[catKey] = { bank: 0, tunai: 0 };
                        }
                        if (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") {
                          if (txn.accountDebit === "Bank") cfCategoryBreakdown[catKey].bank += txn.amount;
                          if (txn.accountDebit === "Tunai") cfCategoryBreakdown[catKey].tunai += txn.amount;
                        }
                        if (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai") {
                          if (txn.accountCredit === "Bank") cfCategoryBreakdown[catKey].bank -= txn.amount;
                          if (txn.accountCredit === "Tunai") cfCategoryBreakdown[catKey].tunai -= txn.amount;
                        }
                      }
                    }
                  });

                  const nextYear = parseInt(yearToClose, 10) + 1;
                  const newTxns: KewanganTransaction[] = [];
                  
                  // Create deterministic per-category carry forward transactions (prevents duplicate CF records)
                  Object.entries(cfCategoryBreakdown).forEach(([catKey, bal]) => {
                    const cleanCatSlug = catKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    if (bal.bank > 0) {
                      newTxns.push({
                        id: `CF-${nextYear}-${cleanCatSlug}-BANK`,
                        voucherNo: `CF-${nextYear}-${catKey.substring(0, 10).toUpperCase().replace(/\s/g, '')}`,
                        date: `${nextYear}-01-01`,
                        time: "00:00",
                        accountDebit: "Bank",
                        accountCredit: catKey === 'Yuran Tambahan' ? 'Dana Terkumpul' : catKey,
                        amount: bal.bank,
                        description: `Baki Bawa Hadapan Bank [${catKey}] dari Sesi ${yearToClose}/${nextYear}`,
                        category: "Baki Bawa Hadapan",
                        sessionYear: nextYear.toString(),
                        recordedBy: `${currentUserDoc?.displayName || 'Admin'} (Sistem)`,
                        approvalStatus: "Approved",
                        auditTrail: [{ time: new Date().toISOString().slice(0, 16).replace('T', ' '), user: currentUserDoc?.displayName || "Sistem", action: `Penjanaan Automatik Baki Bawa Hadapan Bank [${catKey}] (RM ${bal.bank.toFixed(2)}) dari Sesi ${yearToClose}/${nextYear}` }]
                      });
                    }
                    if (bal.tunai > 0) {
                      newTxns.push({
                        id: `CF-${nextYear}-${cleanCatSlug}-TUNAI`,
                        voucherNo: `CF-${nextYear}-${catKey.substring(0, 10).toUpperCase().replace(/\s/g, '')}`,
                        date: `${nextYear}-01-01`,
                        time: "00:00",
                        accountDebit: "Tunai",
                        accountCredit: catKey === 'Yuran Tambahan' ? 'Dana Terkumpul' : catKey,
                        amount: bal.tunai,
                        description: `Baki Bawa Hadapan Tunai [${catKey}] dari Sesi ${yearToClose}/${nextYear}`,
                        category: "Baki Bawa Hadapan",
                        sessionYear: nextYear.toString(),
                        recordedBy: `${currentUserDoc?.displayName || 'Admin'} (Sistem)`,
                        approvalStatus: "Approved",
                        auditTrail: [{ time: new Date().toISOString().slice(0, 16).replace('T', ' '), user: currentUserDoc?.displayName || "Sistem", action: `Penjanaan Automatik Baki Bawa Hadapan Tunai [${catKey}] (RM ${bal.tunai.toFixed(2)}) dari Sesi ${yearToClose}/${nextYear}` }]
                      });
                    }
                  });

                  // Calculate remaining balance not covered by category breakdown
                  let coveredBank = 0;
                  let coveredTunai = 0;
                  Object.values(cfCategoryBreakdown).forEach(bal => {
                    if (bal.bank > 0) coveredBank += bal.bank;
                    if (bal.tunai > 0) coveredTunai += bal.tunai;
                  });

                  const remainingBank = balBank - coveredBank;
                  const remainingTunai = balTunai - coveredTunai;

                  // Create general carry forward for remaining balance
                  if (remainingBank > 0) {
                    newTxns.push({
                      id: `CF-${nextYear}-BANK`,
                      voucherNo: `CF-${nextYear}`,
                      date: `${nextYear}-01-01`,
                      time: "00:00",
                      accountDebit: "Bank",
                      accountCredit: "Dana Terkumpul",
                      amount: remainingBank,
                      description: `Baki Bawa Hadapan Bank (Am) dari Sesi ${yearToClose}/${nextYear}`,
                      category: "Baki Bawa Hadapan",
                      sessionYear: nextYear.toString(),
                      recordedBy: `${currentUserDoc?.displayName || 'Admin'} (Sistem)`,
                      approvalStatus: "Approved",
                      auditTrail: [{ time: new Date().toISOString().slice(0, 16).replace('T', ' '), user: currentUserDoc?.displayName || "Sistem", action: `Penjanaan Automatik Baki Bawa Hadapan Bank Am (RM ${remainingBank.toFixed(2)})` }]
                    });
                  }
                  
                  if (remainingTunai > 0) {
                    newTxns.push({
                      id: `CF-${nextYear}-TUNAI`,
                      voucherNo: `CF-${nextYear}`,
                      date: `${nextYear}-01-01`,
                      time: "00:00",
                      accountDebit: "Tunai",
                      accountCredit: "Dana Terkumpul",
                      amount: remainingTunai,
                      description: `Baki Bawa Hadapan Tunai (Am) dari Sesi ${yearToClose}/${nextYear}`,
                      category: "Baki Bawa Hadapan",
                      sessionYear: nextYear.toString(),
                      recordedBy: `${currentUserDoc?.displayName || 'Admin'} (Sistem)`,
                      approvalStatus: "Approved",
                      auditTrail: [{ time: new Date().toISOString().slice(0, 16).replace('T', ' '), user: currentUserDoc?.displayName || "Sistem", action: `Penjanaan Automatik Baki Bawa Hadapan Tunai Am (RM ${remainingTunai.toFixed(2)})` }]
                    });
                  }

                  setIsCarryingForward(true);
                  try {
                    // Remove any old Baki Bawa Hadapan transactions for nextYear before saving fresh ones
                    const existingCfForNextYear = transactions.filter(
                      t => t.category === "Baki Bawa Hadapan" && String(getTxnSessionYearNum(t)) === nextYear.toString()
                    );
                    for (const oldCf of existingCfForNextYear) {
                      if (!newTxns.some(nt => nt.id === oldCf.id)) {
                        await deleteDoc(doc(db, 'kewanganTransactions', oldCf.id)).catch(() => {});
                      }
                    }

                    // Save all carry forward transactions
                    for (const txn of newTxns) {
                      await setDoc(doc(db, 'kewanganTransactions', txn.id), cleanUndefined(txn));
                    }

                    // Auto-create next session in yuranConfig if not exists
                    try {
                      const configSnap = await getDoc(doc(db, 'system', 'yuranConfig'));
                      const currentConfig = configSnap.exists() ? configSnap.data() : {};
                      const currentSesiList = currentConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList || [];
                      
                      const nextSessionExists = currentSesiList.some((s: any) => 
                        s.id === nextYear.toString() || s.startYear === nextYear
                      );

                      // Also duplicate and carry forward Tambahan Yuran Baru for next session
                      const currentFees = currentConfig.additionalFees || [];
                      const newFeesToAdd: any[] = [];
                      currentFees.forEach((fee: any) => {
                        const feeSession = fee.sessionYear || '';
                        if (feeSession.includes(yearToClose) || feeSession === yearToClose) {
                          const nextSessionName = `Sesi ${nextYear}/${nextYear + 1}`;
                          const alreadyExists = currentFees.some((f: any) => 
                            f.title === fee.title && 
                            f.sessionYear && 
                            (f.sessionYear.includes(nextYear.toString()) || f.sessionYear === nextYear.toString())
                          );
                          if (!alreadyExists) {
                            newFeesToAdd.push({
                              ...fee,
                              id: `fee-additional-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                              sessionYear: nextSessionName
                            });
                          }
                        }
                      });

                      const updatedFees = newFeesToAdd.length > 0 ? [...currentFees, ...newFeesToAdd] : currentFees;
                      const updatedSesiList = !nextSessionExists ? [...currentSesiList, {
                        id: nextYear.toString(),
                        name: `Sesi ${nextYear}`,
                        startMonth: 1, // Bermula Januari hingga Disember
                        startYear: nextYear
                      }].sort((a: any, b: any) => a.startYear - b.startYear) : currentSesiList;

                      if (!nextSessionExists || newFeesToAdd.length > 0) {
                        await setDoc(doc(db, 'system', 'yuranConfig'), {
                          sesiList: updatedSesiList,
                          additionalFees: updatedFees
                        }, { merge: true });
                        
                        // Update local yuranConfig state
                        if (yuranConfig) {
                          setYuranConfig({
                            ...yuranConfig,
                            sesiList: updatedSesiList,
                            additionalFees: updatedFees
                          });
                        }
                      }
                    } catch (cfgErr) {
                      console.warn("Gagal auto-create sesi baru:", cfgErr);
                    }

                    // Mark year as closed
                    setClosedYears(prev => {
                      const updated = Array.from(new Set([...prev, yearToClose]));
                      localStorage.setItem('tmf2_closed_years', JSON.stringify(updated));
                      return updated;
                    });

                    // Save closed year to Firestore for persistence
                    try {
                      await setDoc(doc(db, 'system', 'closedSessions'), {
                        closedYears: Array.from(new Set([...closedYears, yearToClose]))
                      }, { merge: true });
                    } catch (saveErr) {
                      console.warn("Gagal simpan sesi ditutup ke Firestore:", saveErr);
                    }
                    
                    setShowCarryForwardModal(false);

                    const categoryCount = Object.keys(cfCategoryBreakdown).filter(k => {
                      const b = cfCategoryBreakdown[k];
                      return (b.bank > 0 || b.tunai > 0);
                    }).length;
                    
                    alert(
                      `✅ Akaun bagi Sesi ${yearToClose}/${nextYear} telah berjaya ditutup!\n\n` +
                      `📊 ${newTxns.length} transaksi Baki Bawa Hadapan dijana:\n` +
                      (categoryCount > 0 ? `   • ${categoryCount} tabung/kategori dibawa ke sesi seterusnya\n` : '') +
                      (remainingBank > 0 || remainingTunai > 0 ? `   • Baki Am turut dibawa hadapan\n` : '') +
                      `\n➡️ Baki dibawa ke Sesi ${nextYear}/${nextYear+1}.`
                    );
                  } catch (err) {
                    console.error("Gagal melakukan Carry Forward:", err);
                    alert("Gagal memproses tutup buku & carry forward, sila cuba lagi.");
                  } finally {
                    setIsCarryingForward(false);
                  }
                }}
                disabled={isCarryingForward}
                className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCarryingForward ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={16} />
                    <span>Sahkan & Carry Forward</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Fee Modal */}
      {renderAdditionalFeeModal()}

      {/* Digital Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <ShieldCheck size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Tandatangan Digital</h3>
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">{roleLabelToSign}: {roleNameToSign}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowSignModal(false);
                  setRoleToSign(null);
                }}
                className="w-7 h-7 rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-100"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4 bg-slate-50">
              {/* Tab Selector for input mode */}
              <div className="flex bg-slate-200/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSignatureMode('draw')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                    signatureMode === 'draw' 
                      ? 'bg-white text-indigo-950 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✍️ Lakar Tandatangan
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('upload')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                    signatureMode === 'upload' 
                      ? 'bg-white text-indigo-950 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📤 Muat Naik Imej
                </button>
              </div>

              {signatureMode === 'draw' ? (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
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
                   <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                     <span>Sila gunakan tetikus atau skrin sentuh untuk melakar.</span>
                     <button 
                       type="button"
                       onClick={clearCanvas}
                       className="text-rose-500 hover:underline cursor-pointer font-black"
                     >
                       Padam Lakaran
                     </button>
                   </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleFileSignSubmit}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isUploadingSign}
                    />
                    <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                    <p className="text-[11px] font-black text-slate-700">Pilih Fail Imej Tandatangan</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">Sokongan format PNG, JPG, JPEG dsb.</p>
                  </div>
                </div>
              )}

              <p className="text-[9px] text-slate-400 text-center font-semibold leading-relaxed">
                Dengan menandatangani dokumen ini secara digital, saya mengesahkan baki, kunci kira-kira dan laporan kewangan Sekolah / PIBG SMAUJ bagi sesi semasa adalah sahih dan teratur.
              </p>
            </div>

            {signatureMode === 'draw' && (
              <div className="bg-white p-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button 
                  onClick={() => {
                    setShowSignModal(false);
                    setRoleToSign(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleCanvasSignSubmit}
                  disabled={isUploadingSign}
                  className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  {isUploadingSign ? (
                    <>
                      <RefreshCw className="animate-spin" size={12} />
                      Sedang Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check size={12} strokeWidth={3} />
                      Sahkan & Simpan
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-rose-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertTriangle size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{confirmModalTitle}</h3>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmModalAction(null);
                }}
                className="w-7 h-7 rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-100"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-white text-center">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                {confirmModalMessage}
              </p>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmModalAction(null);
                }}
                disabled={isConfirmingAction}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={async () => {
                  if (confirmModalAction) {
                    setIsConfirmingAction(true);
                    try {
                      await confirmModalAction();
                    } catch (err) {
                      console.error("Gagal melakukan tindakan pengesahan:", err);
                    } finally {
                      setIsConfirmingAction(false);
                    }
                  }
                  setShowConfirmModal(false);
                  setConfirmModalAction(null);
                }}
                disabled={isConfirmingAction}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50"
              >
                {isConfirmingAction ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Sila tunggu...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={12} strokeWidth={3} />
                    <span>Sahkan Padam</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Penyata Metadata Modal */}
      {showMetadataModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 select-none">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <ShieldCheck size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Kemaskini Maklumat Penyata</h3>
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Sesi {filterYear !== "All" ? `${filterYear}/${parseInt(filterYear)+1}` : "Semasa"}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowMetadataModal(false)}
                className="w-7 h-7 rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-100"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4 bg-slate-50">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Tarikh Penyata</label>
                <input 
                  type="text" 
                  value={editStatementDate} 
                  onChange={(e) => setEditStatementDate(e.target.value)}
                  placeholder="Contoh: 2026-06-27"
                  className="w-full h-9 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Status Audit</label>
                <input 
                  type="text" 
                  value={editAuditStatus} 
                  onChange={(e) => setEditAuditStatus(e.target.value)}
                  placeholder="Contoh: Belum Diaudit Penuh (Dalaman Sahaja)"
                  className="w-full h-9 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Nama Bendahari</label>
                <input 
                  type="text" 
                  value={editTreasurerName} 
                  onChange={(e) => setEditTreasurerName(e.target.value)}
                  placeholder="Contoh: Ahmad Bin Ismail"
                  className="w-full h-9 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="bg-white p-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                onClick={() => setShowMetadataModal(false)}
                disabled={isSavingMetadata}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveMetadata}
                disabled={isSavingMetadata}
                className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isSavingMetadata ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Sila tunggu...</span>
                  </>
                ) : (
                  <>
                    <Check size={12} strokeWidth={3} />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lihat Resit Bukti Bayaran */}
      {showReceiptModal && selectedReceiptTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100 max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Eye size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Resit Bukti Bayaran Manual</h3>
                  <p className="text-[10px] text-slate-500 font-extrabold">{selectedReceiptTxn.voucherNo} • {selectedReceiptTxn.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="w-7 h-7 rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-100"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Transaction Summary Card */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Amaun Transaksi</span>
                  <span className="text-indigo-600 font-black text-base">RM{selectedReceiptTxn.amount.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 font-bold block">Penerima / Kategori</span>
                    <span className={`font-black text-[10px] px-2.5 py-0.5 rounded-full border inline-block mt-0.5 ${getCategoryBadgeStyle(selectedReceiptTxn.category)}`}>
                      {selectedReceiptTxn.category}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Tarikh & Masa</span>
                    <span className="font-extrabold text-slate-800">{selectedReceiptTxn.date} ({selectedReceiptTxn.time})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Direkod Oleh</span>
                    <span className="font-extrabold text-slate-800">{selectedReceiptTxn.recordedBy}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Status Kelulusan</span>
                    <span className={`inline-block font-black text-[9px] px-2 py-0.5 rounded-full uppercase mt-0.5 ${
                      selectedReceiptTxn.approvalStatus === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedReceiptTxn.approvalStatus === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}>
                      {selectedReceiptTxn.approvalStatus === 'Approved' ? 'Lulus / Sah' : selectedReceiptTxn.approvalStatus === 'Pending' ? 'BELUM DISAHKAN' : 'Ditolak'}
                    </span>
                  </div>
                </div>
                {selectedReceiptTxn.description && (
                  <div className="pt-2 border-t border-slate-200/50 text-[10px]">
                    <span className="text-slate-400 font-bold block">Keterangan:</span>
                    <span className="font-semibold text-slate-700">{selectedReceiptTxn.description}</span>
                  </div>
                )}
              </div>

              {/* AI Vision Verification Status Card */}
              {selectedReceiptTxn.aiVerified && (
                <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-purple-200/60 pb-1.5">
                    <div className="flex items-center gap-1.5 font-black text-purple-900">
                      <Sparkles size={15} className="text-purple-600 shrink-0" />
                      <span>Pengesahan AI Vision (OpenRouter)</span>
                    </div>
                    <span className="bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider">
                      Disahkan AI
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    <div>
                      <span className="text-purple-700 font-bold block">Amaun Dikesan AI:</span>
                      <span className="font-black text-slate-900 text-xs">
                        RM {selectedReceiptTxn.aiDetectedAmount ? selectedReceiptTxn.aiDetectedAmount.toFixed(2) : selectedReceiptTxn.amount.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-700 font-bold block">Status Padanan Amaun:</span>
                      <span className={`font-black text-[10.5px] ${
                        selectedReceiptTxn.aiDetectedAmount && Math.abs(selectedReceiptTxn.aiDetectedAmount - selectedReceiptTxn.amount) > 0.01
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {selectedReceiptTxn.aiDetectedAmount && Math.abs(selectedReceiptTxn.aiDetectedAmount - selectedReceiptTxn.amount) > 0.01
                          ? '⚠️ Berbeza Daripada Yuran'
                          : '✓ Padan Tepat'}
                      </span>
                    </div>
                  </div>
                  {selectedReceiptTxn.aiNotes && (
                    <div className="pt-1.5 border-t border-purple-200/50 text-[10px] text-purple-900 font-medium leading-relaxed">
                      <span className="font-extrabold text-purple-950">Catatan/Ringkasan AI:</span> {selectedReceiptTxn.aiNotes}
                    </div>
                  )}
                </div>
              )}

              {/* Receipt Image Display */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Lampiran Bukti Bayaran:</span>
                  {selectedReceiptTxn.receiptAttachment && (
                    <a 
                      href={selectedReceiptTxn.receiptAttachment} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-600 hover:underline font-extrabold flex items-center gap-1"
                    >
                      <span>Buka Skrin Penuh</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </h4>

                {selectedReceiptTxn.receiptAttachment ? (
                  <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-slate-900/5 p-2 flex items-center justify-center overflow-hidden max-h-[320px]">
                    <img 
                      src={selectedReceiptTxn.receiptAttachment} 
                      alt="Resit Bukti Bayaran" 
                      className="max-h-[300px] w-auto object-contain rounded-xl shadow-md"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center space-y-2">
                    <FileText size={32} className="mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-500">Tiada gambar resit bukti bayaran muat naik bagi transaksi ini.</p>
                    <p className="text-[10px] text-slate-400">Transaksi ini direkodkan secara langsung atau diproses melalui gerbang automatik FPX.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Verification Action */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                Tutup
              </button>

              {selectedReceiptTxn.approvalStatus === 'Pending' && (isAdminUtama || isBendahari) && (
                <button
                  onClick={() => handleApproveTransaction(selectedReceiptTxn)}
                  disabled={isApprovingReceipt}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isApprovingReceipt ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>Sahkan & Luluskan Transaksi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
