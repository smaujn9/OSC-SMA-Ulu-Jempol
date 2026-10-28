import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, AppUser, MembershipApplication } from '../context/AuthContext';
import { LoginLog } from '../types';
import { getTelegramConfig, saveTelegramConfig, fetchTelegramUpdates } from '../utils/telegramHelper';
import { exportAllDataToGoogleSheets } from '../utils/googleSheetsExport';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { YuranConfig, DEFAULT_YURAN_CONFIG, generate12Months, monthNamesMs, detectActiveSessionYear } from '../utils/yuranConfigHelper';
import { QurbanConfig, DEFAULT_QURBAN_CONFIG } from '../utils/qurbanHelper';
import AdminPushNotificationSection from './AdminPushNotificationSection';
import WhatsAppKuiriModal from './WhatsAppKuiriModal';
import { Send, Settings, RefreshCw, FileSpreadsheet, ExternalLink, Link2, MessageCircle, Heart, Copy, Fingerprint, LogIn, History } from 'lucide-react';
import { 
  Users, UserCheck, UserX, Shield, Search, Filter, ArrowUpDown, 
  ChevronLeft, ChevronRight, Check, X, Clock, Trash2, Award, 
  MapPin, Calendar, Edit, FileText, AlertCircle, Database, HelpCircle,
  ChevronDown, ChevronUp, Printer, CreditCard, ToggleLeft, ToggleRight, Power, AlertTriangle, Wallet,
  Sparkles, Eye, EyeOff, Cpu, Key, CheckCircle2, Save, UserPlus, Loader2, Mail
} from 'lucide-react';
import { downloadMembershipCardPdf, downloadMembershipCardImage, MembershipCardData } from '../utils/membershipCardHelper';
import { sendMembershipApprovalEmail } from '../utils/notificationHelper';

interface AdminSectionProps {
  isMobile?: boolean;
  onBack?: () => void;
  onNavigateToUrusQurban?: () => void;
}

const getDynamicAge = (enteredAgeStr: string, baseYear: number | undefined): string => {
  if (!enteredAgeStr || enteredAgeStr === '-') return enteredAgeStr || '-';
  const enteredAge = parseInt(enteredAgeStr, 10);
  if (isNaN(enteredAge)) return enteredAgeStr;
  
  const currentYear = new Date().getFullYear();
  const finalBaseYear = baseYear || 2026;
  const ageDiff = currentYear - finalBaseYear;
  
  return ageDiff > 0 ? (enteredAge + ageDiff).toString() : enteredAgeStr;
};

export default function AdminSection({ isMobile = false, onBack, onNavigateToUrusQurban }: AdminSectionProps) {
  const { 
    currentUserDoc, 
    allUsers, 
    allApplications, 
    auditLogs, 
    roleLogs,
    loginLogs,
    approveApplication, 
    rejectApplication, 
    queryApplication,
    changeUserRole, 
    deleteUserDoc,
    deleteApplication,
    updateApplicationStatus,
    resequenceMemberNumbers,
    googleDriveToken,
    setGoogleDriveToken,
    connectGoogleDrive,
    logAction
  } = useAuth();

  const isSuperAdmin = currentUserDoc?.role === 'Admin Utama' || currentUserDoc?.role === 'ADMIN UTAMA' || currentUserDoc?.isSuperAdmin === true || currentUserDoc?.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my';
  const isManagementAdmin = isSuperAdmin || ['Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi', 'GURU', 'Guru'].includes(currentUserDoc?.role || '');
  // Pengerusi, Setiausaha dan peranan bukan Admin Utama hanya dibenarkan melihat tab Permohonan Keahlian sahaja
  const isPermohonanOnlyRole = !isSuperAdmin;
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'permohonan' | 'pengguna' | 'login_logs' | 'audit_logs'>(() => {
    if (!isSuperAdmin) {
      return 'permohonan';
    }
    return 'dashboard';
  });

  useEffect(() => {
    if (isPermohonanOnlyRole && activeTab !== 'permohonan') {
      setActiveTab('permohonan');
    }
  }, [isPermohonanOnlyRole, activeTab]);

  // Yuran / Payment Config State
  const [yuranConfig, setYuranConfig] = useState<YuranConfig>(() => {
    try {
      const saved = localStorage.getItem('tmf2_yuran_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_YURAN_CONFIG;
  });
  const [isUpdatingPaymentConfig, setIsUpdatingPaymentConfig] = useState(false);

  // Qurban Config State
  const [qurbanConfig, setQurbanConfig] = useState<QurbanConfig>(DEFAULT_QURBAN_CONFIG);
  const [editBhgLembuPrice, setEditBhgLembuPrice] = useState<number>(900);
  const [editEkorLembuPrice, setEditEkorLembuPrice] = useState<number>(6300);
  const [editEkorKambingPrice, setEditEkorKambingPrice] = useState<number>(1200);
  const [editLimitBhgLembu, setEditLimitBhgLembu] = useState<number>(35);
  const [editLimitEkorLembu, setEditLimitEkorLembu] = useState<number>(5);
  const [editLimitEkorKambing, setEditLimitEkorKambing] = useState<number>(20);
  const [editBannerVisibility, setEditBannerVisibility] = useState<'all' | 'registered' | 'hide'>('hide');
  const [editManagementFeeType, setEditManagementFeeType] = useState<'percent' | 'fixed'>('percent');
  const [editManagementFeePercent, setEditManagementFeePercent] = useState<number>(5);
  const [editManagementFeeFixed, setEditManagementFeeFixed] = useState<number>(45);
  const [isSavingQurbanConfig, setIsSavingQurbanConfig] = useState<boolean>(false);

  // Edit Bank Info & QR manual
  const [editBankName, setEditBankName] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editQrCodeUrl, setEditQrCodeUrl] = useState('');
  const [isSavingBankInfo, setIsSavingBankInfo] = useState(false);

  // Kelebihan Ahli Config State
  const [benefitsConfig, setBenefitsConfig] = useState<any[]>([]);
  const [isSavingBenefits, setIsSavingBenefits] = useState(false);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system', 'yuranConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as YuranConfig;
        setYuranConfig(data);
        try {
          localStorage.setItem('tmf2_yuran_config', JSON.stringify(data));
        } catch (e) {}
        setEditBankName(data.manualBankName || '');
        setEditAccountName(data.manualAccountName || '');
        setEditAccountNumber(data.manualAccountNumber || '');
        setEditQrCodeUrl(data.manualQrCodeUrl || '');
      }
    }, (err) => {
      console.warn("Ralat muat yuranConfig di AdminSection:", err);
    });

    const unsubQurban = onSnapshot(doc(db, 'system', 'qurbanConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as QurbanConfig;
        setQurbanConfig(data);
        if (data.bhgLembuPrice !== undefined) setEditBhgLembuPrice(data.bhgLembuPrice);
        if (data.ekorLembuPrice !== undefined) setEditEkorLembuPrice(data.ekorLembuPrice);
        if (data.ekorKambingPrice !== undefined) setEditEkorKambingPrice(data.ekorKambingPrice);
        if (data.limitBhgLembu !== undefined) setEditLimitBhgLembu(data.limitBhgLembu);
        if (data.limitEkorLembu !== undefined) setEditLimitEkorLembu(data.limitEkorLembu);
        if (data.limitEkorKambing !== undefined) setEditLimitEkorKambing(data.limitEkorKambing);
        if (data.bannerVisibility !== undefined) setEditBannerVisibility(data.bannerVisibility);
        if (data.managementFeeType !== undefined) setEditManagementFeeType(data.managementFeeType);
        if (data.managementFeePercent !== undefined) setEditManagementFeePercent(data.managementFeePercent);
        if (data.managementFeeFixed !== undefined) setEditManagementFeeFixed(data.managementFeeFixed);
      }
    }, (err) => {
      console.warn("Ralat muat qurbanConfig di AdminSection:", err);
    });

    const unsubBenefits = onSnapshot(doc(db, 'system', 'benefitsConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.items) {
          setBenefitsConfig(data.items);
        }
      } else {
        // Set default if not exists
        setBenefitsConfig([
          {
            id: "item1",
            title: "Sumbangan Kebajikan & Musibah",
            description: "Sokongan kewangan tunai segera dan bantuan logistik sekiranya ahli atau keluarga ditimpa bencana (seperti kebakaran, ribut, kerosakan rumah yang serius, atau kecemasan perubatan kritikal).",
            icon: "Heart",
            color: "rose"
          },
          {
            id: "item2",
            title: "Khairat Kematian PTMF2",
            description: "Pemberian khairat kematian tunai kepada waris ahli bagi mengurangkan beban kos pengurusan jenazah serta pengebumian sekiranya berlaku kematian ahli berdaftar atau tanggungan serumah.",
            icon: "Users",
            color: "indigo"
          },
          {
            id: "item3",
            title: "Kawalan Keselamatan & Kejiranan",
            description: "Pembiayaan langsung bagi sistem kawalan keselamatan berpalang, rondaan berkala pihak rukun tetangga, selenggara CCTV komuniti, dan kolaborasi pantas bersama pihak berkuasa tempatan (PDRM).",
            icon: "ShieldCheck",
            color: "blue"
          },
          {
            id: "item4",
            title: "Gotong-Royong & Kebersihan Awam",
            description: "Sumbangan digunakan untuk menyelenggara taman permainan kanak-kanak, padang, surau, kitar semula, landskap kejiranan, serta penganjuran gotong-royong berkala bagi menjamin persekitaran yang sihat.",
            icon: "Check",
            color: "emerald"
          }
        ]);
      }
    }, (err) => {
      console.warn("Ralat muat benefitsConfig di AdminSection:", err);
    });

    return () => {
      unsub();
      unsubQurban();
      unsubBenefits();
    };
  }, []);

  const handleSaveQurbanConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin && currentUserDoc?.role !== 'Setiausaha' && currentUserDoc?.role !== 'Bendahari') {
      triggerSnackbar('Anda tidak mempunyai kebenaran untuk mengubah tetapan Qurban.', 'error');
      return;
    }
    setIsSavingQurbanConfig(true);
    try {
      await setDoc(doc(db, 'system', 'qurbanConfig'), {
        bhgLembuPrice: Number(editBhgLembuPrice),
        ekorLembuPrice: Number(editEkorLembuPrice),
        ekorKambingPrice: Number(editEkorKambingPrice),
        limitBhgLembu: Number(editLimitBhgLembu),
        limitEkorLembu: Number(editLimitEkorLembu),
        limitEkorKambing: Number(editLimitEkorKambing),
        bannerVisibility: editBannerVisibility,
        managementFeeType: editManagementFeeType,
        managementFeePercent: Number(editManagementFeePercent),
        managementFeeFixed: Number(editManagementFeeFixed),
        ansuranMonthsOptions: [3, 5, 10],
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserDoc?.displayName || 'Admin'
      }, { merge: true });

      const feeLogText = editManagementFeeType === 'fixed' ? `RM${editManagementFeeFixed}` : `${editManagementFeePercent}%`;
      await logAction('Kemaskini Tetapan Qurban & Aqiqah', `Harga: RM${editBhgLembuPrice}/RM${editEkorLembuPrice}/RM${editEkorKambingPrice}, Caj Pengurusan: ${feeLogText}, Kuota: ${editLimitBhgLembu} bhg lembu, ${editLimitEkorLembu} ekor lembu, ${editLimitEkorKambing} ekor kambing, Banner: ${editBannerVisibility}`);
      triggerSnackbar('Tetapan Qurban & Aqiqah berjaya disimpan!', 'success');
    } catch (err: any) {
      console.error("Ralat simpan qurbanConfig:", err);
      triggerSnackbar('Gagal menyimpan tetapan Qurban.', 'error');
    } finally {
      setIsSavingQurbanConfig(false);
    }
  };

  const handleTogglePaymentMethod = async (type: 'manual' | 'fpx') => {
    if (!isSuperAdmin && currentUserDoc?.role !== 'Setiausaha' && currentUserDoc?.role !== 'Bendahari') {
      triggerSnackbar('Anda tidak mempunyai kebenaran untuk mengubah tetapan mod pembayaran.', 'error');
      return;
    }
    setIsUpdatingPaymentConfig(true);
    try {
      const snap = await getDoc(doc(db, 'system', 'yuranConfig'));
      const latestData = snap.exists() ? (snap.data() as YuranConfig) : yuranConfig;
      
      const currentStatus = type === 'manual' 
        ? latestData.enableManualPayment !== false 
        : latestData.enableFPXPayment !== false;
      
      const newStatus = !currentStatus;
      const fieldKey = type === 'manual' ? 'enableManualPayment' : 'enableFPXPayment';

      await setDoc(doc(db, 'system', 'yuranConfig'), {
        [fieldKey]: newStatus
      }, { merge: true });

      setYuranConfig(prev => {
        const updated = { ...prev, [fieldKey]: newStatus };
        try {
          localStorage.setItem('tmf2_yuran_config', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      const label = type === 'manual' ? 'Pembayaran Manual' : 'Pembayaran FPX';
      const statusStr = newStatus ? 'DIAKTIFKAN (ON)' : 'DINYAHAKTIFKAN (OFF)';

      await logAction('Kemaskini Tetapan Pembayaran', `${label} telah ${statusStr}`);
      triggerSnackbar(`Tetapan ${label} berjaya diubah ke ${statusStr}!`, 'success');
    } catch (err: any) {
      console.error("Ralat kemaskini tetapan pembayaran:", err);
      triggerSnackbar('Gagal mengemaskini tetapan pembayaran.', 'error');
    } finally {
      setIsUpdatingPaymentConfig(false);
    }
  };

  const [isUpdatingRegistrationConfig, setIsUpdatingRegistrationConfig] = useState(false);

  const handleToggleRegistration = async () => {
    if (!isSuperAdmin) {
      triggerSnackbar('Hanya Admin Utama yang dibenarkan untuk mengubah tetapan pendaftaran keahlian.', 'error');
      return;
    }
    setIsUpdatingRegistrationConfig(true);
    try {
      const currentStatus = yuranConfig.enableMembershipRegistration !== false;
      const updatedStatus = !currentStatus;

      await setDoc(doc(db, 'system', 'yuranConfig'), {
        enableMembershipRegistration: updatedStatus
      }, { merge: true });

      const statusStr = updatedStatus ? 'DIAKTIFKAN (ON)' : 'DINYAHAKTIFKAN (OFF)';
      await logAction('Kemaskini Tetapan Pendaftaran Keahlian', `Pendaftaran Keahlian telah ${statusStr}`);
      triggerSnackbar(`Pendaftaran Keahlian berjaya ${updatedStatus ? 'diaktifkan (ON)' : 'dinyahaktifkan (OFF)'}!`, 'success');
    } catch (err: any) {
      console.error("Ralat kemaskini tetapan pendaftaran keahlian:", err);
      triggerSnackbar('Gagal mengemaskini tetapan pendaftaran keahlian.', 'error');
    } finally {
      setIsUpdatingRegistrationConfig(false);
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // limit to 1MB
        triggerSnackbar('Fail QR gambar melebihi had saiz 1MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setEditQrCodeUrl(reader.result as string);
        triggerSnackbar('Gambar QR berjaya dipilih! Klik "Simpan Maklumat Bank" di bawah untuk mengemaskini.', 'success');
      };
      reader.onerror = () => {
        triggerSnackbar('Ralat membaca fail gambar QR.', 'error');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBankInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin && currentUserDoc?.role !== 'Setiausaha' && currentUserDoc?.role !== 'Bendahari') {
      triggerSnackbar('Anda tidak mempunyai kebenaran untuk mengubah tetapan maklumat bank.', 'error');
      return;
    }
    setIsSavingBankInfo(true);
    try {
      await setDoc(doc(db, 'system', 'yuranConfig'), {
        manualBankName: editBankName.trim(),
        manualAccountName: editAccountName.trim(),
        manualAccountNumber: editAccountNumber.trim(),
        manualQrCodeUrl: editQrCodeUrl
      }, { merge: true });

      await logAction('Kemaskini Maklumat Bank Persatuan', `Bank: ${editBankName}, No Akaun: ${editAccountNumber}`);
      triggerSnackbar('Maklumat bank persatuan berjaya disimpan!', 'success');
    } catch (err: any) {
      console.error("Ralat simpan maklumat bank:", err);
      triggerSnackbar('Gagal menyimpan maklumat bank.', 'error');
    } finally {
      setIsSavingBankInfo(false);
    }
  };

  // OpenRouter AI Vision State
  const [openRouterKey, setOpenRouterKey] = useState<string>('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');
  const [openRouterModel, setOpenRouterModel] = useState<string>('google/gemini-2.5-flash');
  const [showOpenRouterKey, setShowOpenRouterKey] = useState<boolean>(false);
  const [isSavingOpenRouter, setIsSavingOpenRouter] = useState<boolean>(false);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system', 'openrouterConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.apiKey) setOpenRouterKey(data.apiKey);
        if (data.modelName) setOpenRouterModel(data.modelName);
      }
    }, (err) => {
      console.warn("Ralat muat openrouterConfig:", err);
    });
    return () => unsub();
  }, []);

  const handleSaveBenefitsConfig = async () => {
    if (!isSuperAdmin && currentUserDoc?.role !== 'Setiausaha' && currentUserDoc?.role !== 'Bendahari' && currentUserDoc?.role !== 'Admin Utama') {
      triggerSnackbar('Anda tidak mempunyai kebenaran untuk mengubah tetapan Kelebihan Ahli.', 'error');
      return;
    }
    setIsSavingBenefits(true);
    try {
      await setDoc(doc(db, 'system', 'benefitsConfig'), {
        items: benefitsConfig,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserDoc?.displayName || 'Admin'
      }, { merge: true });

      await logAction('Kemaskini Kelebihan & Faedah Ahli', `Telah mengemaskini maklumat manfaat keahlian.`);
      triggerSnackbar('Maklumat Kelebihan & Faedah Ahli berjaya disimpan!', 'success');
    } catch (err: any) {
      console.error("Ralat simpan benefitsConfig:", err);
      triggerSnackbar('Gagal menyimpan tetapan Kelebihan Ahli.', 'error');
    } finally {
      setIsSavingBenefits(false);
    }
  };

  const handleSaveOpenRouterConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin && currentUserDoc?.role !== 'Setiausaha' && currentUserDoc?.role !== 'Bendahari' && currentUserDoc?.role !== 'Admin Utama') {
      triggerSnackbar('Anda tidak mempunyai kebenaran untuk mengubah tetapan AI OpenRouter.', 'error');
      return;
    }
    setIsSavingOpenRouter(true);
    try {
      await setDoc(doc(db, 'system', 'openrouterConfig'), {
        apiKey: openRouterKey.trim(),
        modelName: openRouterModel.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserDoc?.displayName || 'Admin'
      }, { merge: true });

      await logAction('Kemaskini OpenRouter AI Vision', `Model: ${openRouterModel}`);
      triggerSnackbar('Tetapan OpenRouter AI Vision berjaya disimpan!', 'success');
    } catch (err: any) {
      console.error("Ralat simpan openrouterConfig:", err);
      triggerSnackbar('Gagal menyimpan tetapan OpenRouter.', 'error');
    } finally {
      setIsSavingOpenRouter(false);
    }
  };

  // Telegram States
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isDetectingTelegram, setIsDetectingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ msg: string; type: 'success' | 'error' | 'idle' }>({ msg: '', type: 'idle' });

  // Google Sheets Export States
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<{ id: string; url: string; totalTabs?: number } | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  // Proactively verify cached Google OAuth token on mount or change and clear if expired
  useEffect(() => {
    let isMounted = true;
    const verifyGoogleToken = async () => {
      if (!googleDriveToken) return;
      try {
        const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(googleDriveToken)}`);
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) {
            console.warn("Token Google telah tamat tempoh (401/400). Mengosongkan token luput.");
            if (isMounted) {
              setGoogleDriveToken(null);
              localStorage.removeItem('tmf2_google_drive_token');
              localStorage.removeItem('tmf2_google_drive_token_time');
            }
          }
        }
      } catch (err) {
        // Network errors or offline, ignore
      }
    };
    verifyGoogleToken();
    return () => { isMounted = false; };
  }, [googleDriveToken, setGoogleDriveToken]);

  const handleExportToGoogleSheets = async () => {
    setIsExportingSheets(true);
    setSheetsError(null);
    setSheetsResult(null);
    try {
      let activeToken = googleDriveToken;
      if (!activeToken) {
        activeToken = await connectGoogleDrive();
      }
      
      if (!activeToken) {
        throw new Error("Sila sambungkan akaun Google anda terlebih dahulu untuk meneruskan eksport.");
      }

      let result: any;
      try {
        result = await exportAllDataToGoogleSheets(activeToken);
      } catch (exportErr: any) {
        // Detect 401 UNAUTHENTICATED or expired access token
        const isAuthError = exportErr?.status === 401 ||
                            exportErr?.isAuthError === true ||
                            exportErr?.message?.includes('401') ||
                            exportErr?.message?.includes('UNAUTHENTICATED');

        if (isAuthError) {
          console.warn("Token Google dikesan telah tamat tempoh (401). Meminta pengguna memperbaharui kebenaran Google...");
          setGoogleDriveToken(null);
          localStorage.removeItem('tmf2_google_drive_token');
          localStorage.removeItem('tmf2_google_drive_token_time');

          triggerSnackbar('Sesi Google telah tamat tempoh. Sila sambung semula akaun Google anda...', 'error');
          activeToken = await connectGoogleDrive();
          if (!activeToken) {
            throw new Error("Sesi Google telah tamat tempoh. Sila sambungkan semula akaun Google anda dan berikan kebenaran untuk meneruskan eksport.");
          }
          // Retry immediately with the fresh token
          result = await exportAllDataToGoogleSheets(activeToken);
        } else {
          throw exportErr;
        }
      }

      setSheetsResult({ id: result.spreadsheetId, url: result.spreadsheetUrl, totalTabs: result.totalTabs });
      
      await logAction('Eksport Google Sheets', `Mengeksport pangkalan data persatuan ke Google Sheets (${result.spreadsheetId})`);
      triggerSnackbar('Pangkalan data berjaya dieksport ke Google Sheets!', 'success');
    } catch (err: any) {
      console.error("Gagal eksport Google Sheets:", err);
      if (err?.status === 401 || err?.message?.includes('401') || err?.message?.includes('UNAUTHENTICATED')) {
        setGoogleDriveToken(null);
        localStorage.removeItem('tmf2_google_drive_token');
        localStorage.removeItem('tmf2_google_drive_token_time');
      }
      setSheetsError(err.message || "Ralat semasa mengeksport data.");
      triggerSnackbar('Gagal mengeksport data ke Google Sheets.', 'error');
    } finally {
      setIsExportingSheets(false);
    }
  };

  const handleReconnectGoogle = async () => {
    setIsExportingSheets(true);
    setSheetsError(null);
    try {
      setGoogleDriveToken(null);
      localStorage.removeItem('tmf2_google_drive_token');
      localStorage.removeItem('tmf2_google_drive_token_time');
      const freshToken = await connectGoogleDrive();
      if (freshToken) {
        triggerSnackbar('Akaun Google berjaya disambungkan semula!', 'success');
      }
    } catch (err: any) {
      triggerSnackbar('Penyambungan semula akaun Google dibatalkan atau gagal.', 'error');
    } finally {
      setIsExportingSheets(false);
    }
  };

  useEffect(() => {
    async function loadTelegramConfig() {
      const config = await getTelegramConfig();
      if (config.chatId) setTelegramChatId(config.chatId);
      if (config.botToken) setTelegramBotToken(config.botToken);
    }
    loadTelegramConfig();
  }, []);

  const handleSaveTelegramChatId = async () => {
    try {
      await saveTelegramConfig(telegramChatId.trim(), telegramBotToken.trim());
      setTelegramStatus({ msg: 'Konfigurasi Telegram berjaya disimpan!', type: 'success' });
      setSnackbar({ show: true, msg: 'Konfigurasi Telegram dikemaskini!', type: 'success' });
    } catch (err: any) {
      setTelegramStatus({ msg: err.message || 'Gagal menyimpan konfigurasi Telegram.', type: 'error' });
    }
  };

  const handleDetectTelegramChatId = async () => {
    setIsDetectingTelegram(true);
    setTelegramStatus({ msg: 'Mencari mesej baharu dari Telegram bot...', type: 'idle' });
    try {
      const updateInfo = await fetchTelegramUpdates(telegramBotToken.trim());
      if (updateInfo) {
        setTelegramChatId(updateInfo.chatId);
        setTelegramStatus({ 
          msg: `Berjaya dikesan! Chat ID: ${updateInfo.chatId} daripada @${updateInfo.username}`, 
          type: 'success' 
        });
        setSnackbar({ show: true, msg: 'Chat ID dikesan secara automatik!', type: 'success' });
      } else {
        setTelegramStatus({ 
          msg: 'Tiada mesej baharu dijumpai. Pastikan anda telah menghantar mesej (seperti /start) kepada bot terlebih dahulu.', 
          type: 'error' 
        });
      }
    } catch (err: any) {
      setTelegramStatus({ msg: 'Ralat mengesan Chat ID dari Telegram.', type: 'error' });
    } finally {
      setIsDetectingTelegram(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramChatId || !telegramBotToken) {
      setTelegramStatus({ msg: 'Sila masukkan Token Bot dan Chat ID terlebih dahulu.', type: 'error' });
      return;
    }
    setIsTestingTelegram(true);
    setTelegramStatus({ msg: 'Menghantar mesej ujian...', type: 'idle' });
    try {
      const testText = `🔔 *UJIAN SISTEM ADUAN* 🔔\n\nHantaran ujian ini mengesahkan bahawa integrasi Telegram bot telah berjaya dikonfigurasikan untuk Persatuan Taman Musytari Fasa 2 Batu Kikir Negeri Sembilan!`;
      const res = await fetch(`https://api.telegram.org/bot${telegramBotToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: testText,
          parse_mode: 'Markdown'
        })
      });
      const data = await res.json();
      if (data.ok) {
        setTelegramStatus({ msg: 'Mesej ujian berjaya dihantar ke Telegram!', type: 'success' });
      } else {
        setTelegramStatus({ msg: `Gagal: ${data.description}`, type: 'error' });
      }
    } catch (err) {
      setTelegramStatus({ msg: 'Ralat semasa menghantar mesej ujian.', type: 'error' });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // Status Edit states
  const [statusEditApp, setStatusEditApp] = useState<MembershipApplication | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('Ahli Biasa');
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);

  // WhatsApp & Kuiri Template Modal states
  const [whatsAppKuiriModalApp, setWhatsAppKuiriModalApp] = useState<MembershipApplication | null>(null);
  const [isWhatsAppKuiriModalOpen, setIsWhatsAppKuiriModalOpen] = useState<boolean>(false);

  const handleKuiriClick = (app: MembershipApplication) => {
    setWhatsAppKuiriModalApp(app);
    setIsWhatsAppKuiriModalOpen(true);
  };

  const handleConfirmKuiri = async (app: MembershipApplication, remarks: string, kuiriItems: string[]) => {
    await queryApplication(app.id, app.uid, remarks, kuiriItems);
    triggerSnackbar('Status permohonan berjaya ditukar kepada KUIRI & dihantar!', 'success');
  };

  // Accordion expanded states for applications list
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});

  const toggleAppExpand = (appId: string) => {
    setExpandedApps(prev => ({
      ...prev,
      [appId]: !prev[appId]
    }));
  };

  // Popup & Alert states
  const [snackbar, setSnackbar] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    actionType: 'approve' | 'reject' | 'role' | 'delete' | 'delete_app' | 'resequence';
    targetAppId?: string;
    targetUid?: string;
    extraData?: any;
    onConfirm?: () => void;
  } | null>(null);

  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [downloadingAppId, setDownloadingAppId] = useState<string | null>(null);
  const [sendingEmailAppId, setSendingEmailAppId] = useState<string | null>(null);

  // Form states for dialog inputs
  const [selectedAppType, setSelectedAppType] = useState<string>('Ahli Biasa');
  const [rejectionRemarks, setRejectionRemarks] = useState<string>('');
  const [newRoleInput, setNewRoleInput] = useState<string>('Ahli Biasa');
  const [roleReasonInput, setRoleReasonInput] = useState<string>('');

  // Table filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appSortOption, setAppSortOption] = useState<'default' | 'name_asc' | 'name_desc' | 'house_asc' | 'house_desc' | 'member_asc' | 'member_desc' | 'date_desc' | 'date_asc'>('default');
  const [appPenyewaOnly, setAppPenyewaOnly] = useState<boolean>(false);
  const [appKuiriOnly, setAppKuiriOnly] = useState<boolean>(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [membershipTypeFilter, setMembershipTypeFilter] = useState('');
  const [membershipStatusFilter, setMembershipStatusFilter] = useState('');
  const [statusKediamanFilter, setStatusKediamanFilter] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Sorting
  const [sortField, setSortField] = useState<keyof AppUser>('displayName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Login Logs Table filters & pagination
  const [loginSearchQuery, setLoginSearchQuery] = useState('');
  const [loginStatusFilter, setLoginStatusFilter] = useState<'all' | 'appointed' | 'not_appointed'>('all');
  const [loginRoleFilter, setLoginRoleFilter] = useState('');
  const [loginCurrentPage, setLoginCurrentPage] = useState(1);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const handleCopyUid = (uid: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    triggerSnackbar(`UID Berjaya Disalin: ${uid}`, 'success');
    setTimeout(() => setCopiedUid(null), 2500);
  };

  const filteredLoginLogs = useMemo(() => {
    return (loginLogs || []).filter((log) => {
      // Status filter
      if (loginStatusFilter === 'appointed' && !log.isAppointedMember) return false;
      if (loginStatusFilter === 'not_appointed' && log.isAppointedMember) return false;

      // Role filter
      if (loginRoleFilter && log.role !== loginRoleFilter) return false;

      // Search query
      if (loginSearchQuery.trim()) {
        const q = loginSearchQuery.toLowerCase();
        const matchName = log.displayName?.toLowerCase().includes(q);
        const matchEmail = log.email?.toLowerCase().includes(q);
        const matchUid = log.uid?.toLowerCase().includes(q);
        const matchNoRumah = log.noRumah?.toLowerCase().includes(q);
        const matchMemberNo = log.memberNo?.toLowerCase().includes(q);
        const matchPhone = log.phoneNumber?.toLowerCase().includes(q);
        return !!(matchName || matchEmail || matchUid || matchNoRumah || matchMemberNo || matchPhone);
      }
      return true;
    });
  }, [loginLogs, loginStatusFilter, loginRoleFilter, loginSearchQuery]);

  const loginItemsPerPage = 10;
  const totalLoginPages = Math.max(1, Math.ceil(filteredLoginLogs.length / loginItemsPerPage));
  const paginatedLoginLogs = useMemo(() => {
    const start = (loginCurrentPage - 1) * loginItemsPerPage;
    return filteredLoginLogs.slice(start, start + loginItemsPerPage);
  }, [filteredLoginLogs, loginCurrentPage]);

  const loginStats = useMemo(() => {
    const total = (loginLogs || []).length;
    const uniqueUids = new Set((loginLogs || []).map(l => l.uid)).size;
    const appointedCount = (loginLogs || []).filter(l => l.isAppointedMember).length;
    const notAppointedCount = (loginLogs || []).filter(l => !l.isAppointedMember).length;
    return { total, uniqueUids, appointedCount, notAppointedCount };
  }, [loginLogs]);

  const handlePrintLoginLogs = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      triggerSnackbar('Gagal membuka tingkap cetakan. Sila benarkan popup browser.', 'error');
      return;
    }
    
    const rows = filteredLoginLogs.map((log, index) => `
      <tr>
        <td style="text-align: center; padding: 6px 8px; border: 1px solid #cbd5e1;">${index + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">${log.displayName || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${log.email || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 10px;">${log.uid || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${log.isAppointedMember ? '<span style="color: #047857; font-weight: bold;">Ahli Dilantik</span>' : '<span style="color: #d97706; font-weight: bold;">Belum Dilantik</span>'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${log.role || 'Pelawat'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${log.noRumah || '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${formatTimestamp(log.timestamp)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rekod Log Masuk Pengguna - PTMF2</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 20px; }
            h2 { text-align: center; margin-bottom: 2px; text-transform: uppercase; }
            p.sub { text-align: center; font-size: 10px; color: #64748b; margin-top: 0; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
            th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: left; text-transform: uppercase; font-size: 9px; }
            @media print {
              @page { size: landscape; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <h2>Rekod Log Masuk Pengguna Sistem Komuniti PTMF2</h2>
          <p class="sub">Dicetak pada: ${new Date().toLocaleString('ms-MY')} | Jumlah Rekod: ${filteredLoginLogs.length}</p>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">No</th>
                <th>Nama Pengguna</th>
                <th>Emel Google</th>
                <th>UID Firebase Tetap</th>
                <th style="text-align: center;">Status Keahlian</th>
                <th style="text-align: center;">Role</th>
                <th style="text-align: center;">No. Rumah</th>
                <th>Tarikh & Masa Log</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Trigger snackbar helper
  const triggerSnackbar = (msg: string, type: 'success' | 'error') => {
    setSnackbar({ show: true, msg, type });
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Check if current user has edit permission (Admin Utama, Setiausaha, Bendahari, Pengerusi)
  const canEdit = isManagementAdmin;

  // Handle saving modified status
  const handleSaveStatus = async () => {
    if (!statusEditApp) return;
    setIsSavingStatus(true);
    try {
      await updateApplicationStatus(statusEditApp.id, statusEditApp.uid, selectedStatus, selectedType);
      if (selectedStatus === 'Diluluskan Keahlian' || selectedStatus === 'Diluluskan') {
        triggerSnackbar('Status keahlian berjaya diluluskan & notifikasi push dihantar!', 'success');
      } else {
        triggerSnackbar('Status keahlian berjaya dikemaskini!', 'success');
      }
      setStatusEditApp(null);
    } catch (err: any) {
      triggerSnackbar(err.message || 'Gagal mengemaskini status.', 'error');
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Handle Application Approval
  const handleApproveClick = (app: MembershipApplication) => {
    setSelectedAppType('Ahli Biasa');
    setConfirmDialog({
      show: true,
      title: 'Meluluskan Permohonan Keahlian',
      message: `Sila pilih jenis keahlian untuk meluluskan permohonan daripada ${app.name}:`,
      actionType: 'approve',
      targetAppId: app.id,
      targetUid: app.uid
    });
  };

  // Handle Application Rejection
  const handleRejectClick = (app: MembershipApplication) => {
    setRejectionRemarks('');
    setConfirmDialog({
      show: true,
      title: 'Menolak Permohonan Keahlian',
      message: `Sila masukkan ulasan atau sebab penolakan permohonan ${app.name}:`,
      actionType: 'reject',
      targetAppId: app.id,
      targetUid: app.uid
    });
  };

  const handleSendApprovalEmail = async (app: MembershipApplication, applicantUser: AppUser | undefined) => {
    const targetEmail = app.email || applicantUser?.email;
    if (!targetEmail || !targetEmail.trim()) {
      triggerSnackbar('Tiada alamat emel ditemui untuk pemohon ini.', 'error');
      return;
    }

    try {
      setSendingEmailAppId(app.id);
      const memberNo = app.memberNo || applicantUser?.memberNo || 'PTMF2-2026-AHLI';
      const name = app.name || applicantUser?.displayName || 'Ahli Persatuan';

      const result = await sendMembershipApprovalEmail({
        email: targetEmail.trim(),
        name,
        memberNo,
        icNumber: app.icNumber || applicantUser?.icNumber,
        noRumah: app.noRumah || applicantUser?.noRumah,
        address: app.address || applicantUser?.address,
        membershipType: applicantUser?.membershipType || (app.status === 'Diluluskan' ? 'Ahli Biasa' : 'Ahli Biasa'),
        statusKediaman: (applicantUser?.statusKediaman || app.statusKediaman || 'Pemilik').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik (Sendiri)',
        approvedBy: currentUserDoc?.displayName || currentUserDoc?.role || 'Setiausaha PTMF2',
        uid: app.uid || applicantUser?.uid
      });

      if (result.success) {
        triggerSnackbar(`Emel pengesahan kelulusan keahlian berjaya dihantar ke ${targetEmail}!`, 'success');
      } else {
        triggerSnackbar(result.error || 'Gagal menghantar emel kelulusan.', 'error');
      }
    } catch (err: any) {
      console.error('Ralat hantar emel kelulusan:', err);
      triggerSnackbar(err.message || 'Gagal menghantar emel kelulusan.', 'error');
    } finally {
      setSendingEmailAppId(null);
    }
  };

  const handleDownloadMemberCard = async (app: MembershipApplication, applicantUser: AppUser | undefined, type: 'pdf' | 'png') => {
    try {
      setDownloadingAppId(app.id);
      const cardData: MembershipCardData = {
        memberNo: app.memberNo || applicantUser?.memberNo || 'PTMF2-AHLI',
        name: app.name || applicantUser?.displayName || 'Ahli Persatuan',
        role: applicantUser?.role || 'Ahli Biasa',
        noRumah: app.noRumah || applicantUser?.noRumah || '',
        icNumber: app.icNumber || applicantUser?.icNumber || '',
        phone: app.phone || applicantUser?.phoneNumber || '',
        email: app.email || applicantUser?.email || '',
        address: app.address || applicantUser?.address || '',
        statusKediaman: (applicantUser?.statusKediaman || app.statusKediaman || 'Pemilik').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik (Sendiri)',
        avatarUrl: applicantUser?.photoURL || undefined
      };

      if (type === 'pdf') {
        await downloadMembershipCardPdf(cardData);
        triggerSnackbar(`Sijil & kad keahlian rasmi bagi ${app.name} berjaya dimuat turun (PDF)!`, 'success');
      } else {
        await downloadMembershipCardImage(cardData);
        triggerSnackbar(`Gambar kad keahlian rasmi bagi ${app.name} berjaya dimuat turun (PNG)!`, 'success');
      }
    } catch (err: any) {
      console.error('Ralat muat turun kad keahlian:', err);
      triggerSnackbar('Gagal memuat turun kad keahlian: ' + (err?.message || 'Sila cuba lagi.'), 'error');
    } finally {
      setDownloadingAppId(null);
    }
  };

  // Handle Role Change
  const handleRoleChangeClick = (user: AppUser) => {
    setNewRoleInput(user.role);
    setRoleReasonInput('');
    setConfirmDialog({
      show: true,
      title: 'Kemaskini Role Pengguna',
      message: `Sila pilih role baharu dan masukkan sebab pengubahan untuk ${user.displayName || user.email || 'Pengguna'}:`,
      actionType: 'role',
      targetUid: user.uid
    });
  };

  // Handle User Deletion
  const handleDeleteClick = (user: AppUser) => {
    setConfirmDialog({
      show: true,
      title: 'Padam Rekod Pengguna',
      message: `Adakah anda pasti untuk memadam rekod pengguna ${user.displayName || user.email}? Tindakan ini akan turut memadam rekod permohonan keahlian yang berkaitan secara automatik.`,
      actionType: 'delete',
      targetUid: user.uid,
      extraData: { email: user.email, name: user.displayName || user.nickname || 'Pengguna' }
    });
  };

  // Handle Membership Application Deletion directly
  const handleDeleteApplicationClick = (app: MembershipApplication) => {
    setConfirmDialog({
      show: true,
      title: 'Padam Rekod Permohonan',
      message: `Adakah anda pasti untuk memadam rekod permohonan keahlian daripada ${app.name} (${app.email || 'Tiada Emel'})?`,
      actionType: 'delete_app',
      targetAppId: app.id,
      targetUid: app.uid,
      extraData: { email: app.email }
    });
  };

  // Unified Handler for Confirming Actions with real-time state access
  const handleConfirmDialogAction = async () => {
    if (!confirmDialog || isProcessingAction) return;

    if (confirmDialog.actionType === 'reject') {
      if (!rejectionRemarks.trim()) {
        triggerSnackbar('Sila masukkan sebab penolakan.', 'error');
        return;
      }
      setIsProcessingAction(true);
      try {
        await rejectApplication(confirmDialog.targetAppId!, confirmDialog.targetUid!, rejectionRemarks.trim());
        triggerSnackbar('Permohonan telah ditolak.', 'success');
        setConfirmDialog(null);
      } catch (err: any) {
        triggerSnackbar(err.message || 'Gagal menolak permohonan.', 'error');
      } finally {
        setIsProcessingAction(false);
      }
      return;
    }

    if (confirmDialog.actionType === 'approve') {
      setIsProcessingAction(true);
      try {
        await approveApplication(confirmDialog.targetAppId!, confirmDialog.targetUid!, selectedAppType);
        triggerSnackbar('Permohonan berjaya diluluskan & notifikasi push dihantar!', 'success');
        setConfirmDialog(null);
      } catch (err: any) {
        triggerSnackbar(err.message || 'Gagal meluluskan permohonan.', 'error');
      } finally {
        setIsProcessingAction(false);
      }
      return;
    }

    if (confirmDialog.actionType === 'role') {
      if (!roleReasonInput.trim()) {
        triggerSnackbar('Sila masukkan sebab perubahan role.', 'error');
        return;
      }
      setIsProcessingAction(true);
      try {
        await changeUserRole(confirmDialog.targetUid!, newRoleInput, roleReasonInput.trim());
        triggerSnackbar('Role pengguna berjaya dikemaskini!', 'success');
        setConfirmDialog(null);
      } catch (err: any) {
        triggerSnackbar(err.message || 'Gagal menukar role.', 'error');
      } finally {
        setIsProcessingAction(false);
      }
      return;
    }

    if (confirmDialog.actionType === 'delete') {
      setIsProcessingAction(true);
      try {
        await deleteUserDoc(confirmDialog.targetUid!, confirmDialog.extraData?.email);
        triggerSnackbar('Rekod pengguna & permohonan keahlian berjaya dipadam.', 'success');
        setConfirmDialog(null);
      } catch (err: any) {
        triggerSnackbar(err.message || 'Gagal memadam rekod pengguna.', 'error');
      } finally {
        setIsProcessingAction(false);
      }
      return;
    }

    if (confirmDialog.actionType === 'delete_app') {
      setIsProcessingAction(true);
      try {
        await deleteApplication(confirmDialog.targetAppId!, confirmDialog.extraData?.email, confirmDialog.targetUid);
        triggerSnackbar('Borang permohonan keahlian berjaya dipadam.', 'success');
        setConfirmDialog(null);
      } catch (err: any) {
        triggerSnackbar(err.message || 'Gagal memadam permohonan.', 'error');
      } finally {
        setIsProcessingAction(false);
      }
      return;
    }

    if (confirmDialog.actionType === 'resequence') {
      setIsProcessingAction(true);
      try {
        const res = await resequenceMemberNumbers();
        triggerSnackbar(`Nombor ahli berjaya disusun semula (${res.updatedCount} ahli dikemaskini)!`, 'success');
        setConfirmDialog(null);
      } catch (err: any) {
        triggerSnackbar(err.message || 'Gagal menyusun semula nombor ahli.', 'error');
      } finally {
        setIsProcessingAction(false);
      }
      return;
    }
  };

  // Handle Resequence Member Numbers Click
  const handleResequenceClick = () => {
    setConfirmDialog({
      show: true,
      title: 'Susun Semula No. Ahli Berurutan',
      message: 'Adakah anda pasti untuk menyusun semula nombor ahli semua ahli berdaftar bermula PTMF2-2026-0001, PTMF2-2026-0002, PTMF2-2026-0003 dan seterusnya secara berturutan (+1)?',
      actionType: 'resequence'
    });
  };

  // STATISTICS CALCULATIONS
  const stats = {
    totalPelawat: allUsers.filter(u => u.membershipType === 'Tiada' || u.role === 'Pelawat' || u.role === 'Tetamu').length,
    totalAhliBiasa: allUsers.filter(u => u.membershipType === 'Ahli Biasa').length,
    totalAhliBersekutu: allUsers.filter(u => u.membershipType === 'Ahli Bersekutu').length,
    totalAhliKehormat: allUsers.filter(u => u.membershipType === 'Ahli Kehormat').length,
    totalAjk: allUsers.filter(u => ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Ahli Jawatankuasa'].includes(u.role)).length,
    pendingApps: allApplications.filter(a => {
      const st = (a.status || '').toLowerCase().trim();
      return st === 'pending' || st === 'menunggu kelulusan' || st === 'menunggu';
    }).length,
    approvedApps: allApplications.filter(a => {
      const st = (a.status || '').toLowerCase().trim();
      return st === 'diluluskan' || st === 'approved' || st === 'diluluskan keahlian';
    }).length,
    rejectedApps: allApplications.filter(a => {
      const st = (a.status || '').toLowerCase().trim();
      return st === 'rejected' || st === 'ditolak';
    }).length,
    totalRegistered: allUsers.length
  };

  // DATA PROCESSING FOR USERS TABLE
  const handleSort = (field: keyof AppUser) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredUsers = allUsers.filter(user => {
    const query = searchQuery.toLowerCase();
    const nameMatch = (user.displayName || '').toLowerCase().includes(query);
    const nicknameMatch = (user.nickname || '').toLowerCase().includes(query);
    const emailMatch = (user.email || '').toLowerCase().includes(query);
    const icMatch = (user.icNumber || '').includes(query);
    const noRumahMatch = (user.noRumah || '').toLowerCase().includes(query);
    
    const roleMatch = !roleFilter || user.role === roleFilter;
    const mTypeMatch = !membershipTypeFilter || user.membershipType === membershipTypeFilter;
    const mStatusMatch = !membershipStatusFilter || user.membershipStatus === membershipStatusFilter;
    const isUserPenyewa = (user.statusKediaman || '').toLowerCase().includes('penyewa');
    const statusKediamanMatch = !statusKediamanFilter || (
      statusKediamanFilter === 'Penyewa' ? isUserPenyewa : !isUserPenyewa
    );

    return (nameMatch || nicknameMatch || emailMatch || icMatch || noRumahMatch) &&
           roleMatch && mTypeMatch && mStatusMatch && statusKediamanMatch;
  });

  // Apply sorting
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination bounds
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage) || 1;
  const paginatedUsers = sortedUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // DATA PROCESSING FOR MEMBERSHIP APPLICATIONS
  const combinedApplications = useMemo(() => {
    const list: MembershipApplication[] = [];
    const seenEmails = new Set<string>();
    const seenUids = new Set<string>();

    allApplications.forEach((app) => {
      const emailLower = (app.email || '').toLowerCase().trim();
      if (emailLower) {
        if (seenEmails.has(emailLower)) return;
        seenEmails.add(emailLower);
      }
      if (app.uid) {
        if (seenUids.has(app.uid)) return;
        seenUids.add(app.uid);
      }
      list.push(app);
    });

    return list;
  }, [allApplications]);

  const filteredApplications = useMemo(() => {
    return combinedApplications.filter(app => {
      const applicantUser = allUsers.find(u => u.uid === app.uid);
      const isPenyewa = (applicantUser?.statusKediaman || app.statusKediaman || '').toLowerCase().includes('penyewa');

      // Tapis jika butang Pilihan Pantas 'Penyewa' diaktifkan
      if (appPenyewaOnly && !isPenyewa) return false;

      // Tapis jika butang Pilihan Pantas 'Kuiri' diaktifkan
      if (appKuiriOnly) {
        const isKuiri = (app.status || '').toLowerCase().includes('kuiri') ||
          (applicantUser?.approvalStatus || '').toLowerCase().includes('kuiri') ||
          (applicantUser?.membershipStatus || '').toLowerCase().includes('kuiri') ||
          app.status === 'Perlu Kemaskini';
        if (!isKuiri) return false;
      }

      if (!appSearchQuery.trim()) return true;
      const query = appSearchQuery.toLowerCase().trim();
      const nameMatch = (app.name || '').toLowerCase().includes(query);
      const nicknameMatch = (app.nickname || '').toLowerCase().includes(query);
      const icMatch = (app.icNumber || '').toLowerCase().includes(query);
      const phoneMatch = (app.phone || '').toLowerCase().includes(query);
      const emailMatch = (app.email || '').toLowerCase().includes(query);
      const noRumahMatch = (app.noRumah || '').toLowerCase().includes(query);
      const addressMatch = (app.address || '').toLowerCase().includes(query);
      const statusMatch = (app.status || '').toLowerCase().includes(query);
      
      // Check if No. Ahli (Member No.) matches
      const memberNoMatch = applicantUser?.memberNo ? applicantUser.memberNo.toLowerCase().includes(query) : false;
      const statusKediamanMatch = (applicantUser?.statusKediaman || app.statusKediaman || '').toLowerCase().includes(query);

      return nameMatch || nicknameMatch || icMatch || phoneMatch || emailMatch || noRumahMatch || addressMatch || statusMatch || memberNoMatch || statusKediamanMatch;
    }).sort((a, b) => {
      const applicantUserA = allUsers.find(u => u.uid === a.uid);
      const applicantUserB = allUsers.find(u => u.uid === b.uid);
      const memberNoA = a.memberNo || applicantUserA?.memberNo || '';
      const memberNoB = b.memberNo || applicantUserB?.memberNo || '';

      const nameA = (a.name || a.nickname || '').trim().toLowerCase();
      const nameB = (b.name || b.nickname || '').trim().toLowerCase();

      // Helper to parse numeric part of house number for natural numeric sorting
      const parseHouseNum = (str?: string) => {
        if (!str) return 999999;
        const num = parseInt(str.replace(/\D/g, ''), 10);
        return isNaN(num) ? 999999 : num;
      };

      // Helper to parse numeric part of member number (e.g. PTMF2-2026-0031 -> 31)
      const parseMemberNum = (str?: string) => {
        if (!str) return 999999;
        const match = str.match(/(\d+)$/);
        if (match) return parseInt(match[1], 10);
        const num = parseInt(str.replace(/\D/g, ''), 10);
        return isNaN(num) ? 999999 : num;
      };

      const timeA = a.submittedAt?.seconds ? a.submittedAt.seconds * 1000 : (a.submittedAt ? new Date(a.submittedAt).getTime() : 0);
      const timeB = b.submittedAt?.seconds ? b.submittedAt.seconds * 1000 : (b.submittedAt ? new Date(b.submittedAt).getTime() : 0);

      switch (appSortOption) {
        case 'name_asc':
          return nameA.localeCompare(nameB, 'ms');
        case 'name_desc':
          return nameB.localeCompare(nameA, 'ms');
        case 'house_asc': {
          const hA = parseHouseNum(a.noRumah);
          const hB = parseHouseNum(b.noRumah);
          if (hA !== hB) return hA - hB;
          return (a.noRumah || '').localeCompare(b.noRumah || '', 'ms');
        }
        case 'house_desc': {
          const hA = parseHouseNum(a.noRumah);
          const hB = parseHouseNum(b.noRumah);
          if (hA !== hB) return hB - hA;
          return (b.noRumah || '').localeCompare(a.noRumah || '', 'ms');
        }
        case 'member_asc': {
          if (!memberNoA && memberNoB) return 1;
          if (memberNoA && !memberNoB) return -1;
          const mA = parseMemberNum(memberNoA);
          const mB = parseMemberNum(memberNoB);
          if (mA !== mB) return mA - mB;
          return memberNoA.localeCompare(memberNoB);
        }
        case 'member_desc': {
          if (!memberNoA && memberNoB) return 1;
          if (memberNoA && !memberNoB) return -1;
          const mA = parseMemberNum(memberNoA);
          const mB = parseMemberNum(memberNoB);
          if (mA !== mB) return mB - mA;
          return memberNoB.localeCompare(memberNoA);
        }
        case 'date_asc':
          return timeA - timeB;
        case 'date_desc':
          return timeB - timeA;
        case 'default':
        default: {
          // Prioritize Pending applications at the very top (new applications)
          const statusA = a.status === 'Pending' ? 1 : 0;
          const statusB = b.status === 'Pending' ? 1 : 0;
          if (statusA !== statusB) {
            return statusB - statusA; // Pending (1) comes before others (0)
          }
          // Then sort newly submitted applications first (submittedAt descending)
          return timeB - timeA;
        }
      }
    });
  }, [combinedApplications, appSearchQuery, appSortOption, appPenyewaOnly, appKuiriOnly, allUsers]);

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Tiada data';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleString('ms-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrintDaftarAhli = () => {
    if (filteredApplications.length === 0) {
      alert('Tiada data permohonan keahlian untuk dicetak pada masa ini.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Sila benarkan tetingkap timbul (pop-ups) untuk mencetak buku daftar ahli ini.');
      return;
    }

    const todayDate = new Date().toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const setiausaha = allUsers?.find(u => u.role === 'Setiausaha');
    const setiausahaName = setiausaha ? (setiausaha.displayName || setiausaha.nickname || setiausaha.name || "Setiausaha") : "Setiausaha";

    const pengerusi = allUsers?.find(u => u.role === 'Pengerusi') || allUsers?.find(u => u.role === 'Admin Utama');
    const pengerusiName = pengerusi ? (pengerusi.displayName || pengerusi.nickname || pengerusi.name || "Pengerusi") : "Pengerusi";

    const totalApp = filteredApplications.length;
    const totalApproved = filteredApplications.filter(a => a.status === 'Diluluskan' || a.status === 'Diluluskan Keahlian').length;
    const totalPending = filteredApplications.filter(a => a.status === 'Pending').length;

    const tableRowsHtml = filteredApplications.map((app, idx) => {
      const applicantUser = allUsers.find(u => u.uid === app.uid);
      const memberNo = applicantUser?.memberNo || "-";
      const membershipType = applicantUser?.membershipType || (app.status === 'Diluluskan' ? 'Ahli Biasa' : '-');
      
      const approvedAtRaw = applicantUser?.approvedAt || app.reviewedAt;
      const approvedAtFormatted = approvedAtRaw
        ? new Date(approvedAtRaw.seconds ? approvedAtRaw.seconds * 1000 : approvedAtRaw).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
        : "-";

      let displayStatus = 'Draf / Baru';
      let statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      if (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian') {
        displayStatus = 'Diluluskan';
        statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (app.status === 'Rejected' || app.status === 'Ditolak' || app.status === 'Ditolak Keahlian') {
        displayStatus = 'Ditolak';
        statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
      }

      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-low';

      return `
        <tr class="${rowBg} border-b border-outline-variant/10 text-[10px] text-on-surface hover:bg-slate-50">
          <td class="px-3 py-2 text-center font-bold text-primary/75">${idx + 1}</td>
          <td class="px-3 py-2 font-mono font-extrabold text-primary">${memberNo}</td>
          <td class="px-3 py-2 font-extrabold text-slate-900 uppercase leading-tight">${app.name}</td>
          <td class="px-3 py-2 font-mono font-bold text-slate-700">${app.icNumber}</td>
          <td class="px-3 py-2 font-semibold text-slate-700">${app.phone}</td>
          <td class="px-3 py-2 font-medium text-slate-600 leading-tight max-w-[200px] truncate" title="${app.noRumah}, ${app.address}">${app.noRumah}, ${app.address}</td>
          <td class="px-3 py-2 text-center">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${(applicantUser?.statusKediaman || app.statusKediaman || '').toLowerCase().includes('penyewa') ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}">
              ${(applicantUser?.statusKediaman || app.statusKediaman || '').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik'}
            </span>
          </td>
          <td class="px-3 py-2 text-center font-bold text-slate-800">${membershipType}</td>
          <td class="px-3 py-2 text-center font-bold text-slate-600">${approvedAtFormatted}</td>
          <td class="px-3 py-2 text-center">
            <span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${statusColor}">
              ${displayStatus}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const noRows = `
      <tr>
        <td colspan="10" class="px-4 py-8 text-center text-slate-400 italic font-semibold bg-white">Tiada permohonan keahlian ditemui.</td>
      </tr>
    `;

    const htmlContent = `
<!DOCTYPE html>
<html class="light" lang="ms">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>Buku Rekod Daftar Ahli Persatuan | PTMF2</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            "on-tertiary-fixed-variant": "#613f1c",
            "surface-container-low": "#f5f3f6",
            "on-secondary-fixed": "#261a00",
            "inverse-on-surface": "#f2f0f3",
            "on-secondary": "#ffffff",
            "on-surface-variant": "#43474d",
            "surface": "#faf9fb",
            "surface-container-high": "#e9e8ea",
            "surface-container-highest": "#e3e2e5",
            "surface-bright": "#faf9fb",
            "inverse-surface": "#2f3033",
            "tertiary-fixed-dim": "#eebd90",
            "on-error-container": "#93000a",
            "on-error": "#ffffff",
            "primary": "#000f22",
            "on-primary-fixed-variant": "#314865",
            "surface-container-lowest": "#ffffff",
            "on-tertiary-fixed": "#2d1600",
            "outline": "#74777e",
            "on-secondary-fixed-variant": "#5b4300",
            "error-container": "#ffdad6",
            "tertiary-fixed": "#ffdcbe",
            "on-primary-fixed": "#001c37",
            "on-primary": "#ffffff",
            "outline-variant": "#c4c6ce",
            "on-tertiary": "#ffffff",
            "background": "#faf9fb",
            "surface-variant": "#e3e2e5",
            "secondary-fixed-dim": "#fabd00",
            "on-primary-container": "#768dad",
            "surface-container": "#efedf0",
            "secondary": "#785900",
            "primary-fixed": "#d2e4ff",
            "error": "#ba1a1a",
            "tertiary-container": "#381d00",
            "on-tertiary-container": "#ae835a",
            "on-surface": "#1b1c1e",
            "secondary-fixed": "#ffdf9e",
            "inverse-primary": "#b0c8eb",
            "on-secondary-container": "#6c5000",
            "secondary-container": "#fdc003",
            "tertiary": "#1a0b00",
            "surface-dim": "#dbd9dc",
            "primary-fixed-dim": "#b0c8eb",
            "surface-tint": "#49607e",
            "primary-container": "#0a2540",
            "on-background": "#1b1c1e"
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
    
    body {
      font-family: 'Hanken Grotesk', sans-serif;
      background-color: #faf9fb;
      color: #1b1c1e;
      -webkit-font-smoothing: antialiased;
    }
    
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined';
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
    }

    @page {
      size: A4 landscape;
      margin: 0;
    }

    @media print {
      body {
        padding: 0 !important;
        margin: 0 !important;
        background-color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body class="p-4 md:p-8 bg-background min-h-screen">
  <!-- Container constraints to A4 landscape dimensions on screen, natural fit in print -->
  <div class="w-[297mm] mx-auto bg-white p-6 md:p-8 rounded-2xl border border-outline-variant/30 shadow-lg min-h-[210mm] flex flex-col justify-between print:m-0 print:rounded-none print:shadow-none print:border-none">
    
    <!-- Top Action Row (Hidden during print) -->
    <div class="no-print flex justify-between items-center mb-6 pb-4 border-b border-outline-variant/30">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">print</span>
        <h1 class="text-sm font-bold text-primary">Pratinjau Cetakan Buku Daftar Ahli (Landscape)</h1>
      </div>
      <button onclick="window.print()" class="px-5 py-2 bg-primary text-white text-xs font-black rounded-lg hover:bg-slate-800 transition-all shadow-xs cursor-pointer flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px]">print</span>
        CETAK SEKARANG
      </button>
    </div>

    <!-- MAIN LANDSCAPE CONTENT -->
    <div class="space-y-6 flex-1">
      
      <!-- HEADER CARD -->
      <div class="flex justify-between items-start gap-4">
        <!-- Association Logo and Identity -->
        <div class="flex items-center gap-4">
          <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo Persatuan" style="width: 60px; height: 60px; object-fit: cover;" class="rounded-full shadow-sm bg-white" />
          <div>
            <p class="text-[10px] font-black text-primary tracking-widest uppercase opacity-75">BUKU REKOD DAFTAR AHLI PERSATUAN</p>
            <h1 class="text-lg font-black text-primary leading-tight tracking-tight">PERSATUAN PENDUDUK TAMAN MUSTARI FASA 2</h1>
            <p class="text-xs font-bold text-slate-500">Batu Kikir, Negeri Sembilan &bull; PPM-001-05-28092026</p>
          </div>
        </div>

        <!-- Quick Summary Stats Card -->
        <div class="flex gap-4 text-right">
          <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-center min-w-[80px]">
            <p class="text-[8px] font-black text-slate-400 uppercase">DIJUMPAI</p>
            <p class="text-base font-black text-primary">${totalApp}</p>
          </div>
          <div class="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 text-center min-w-[80px]">
            <p class="text-[8px] font-black text-emerald-600 uppercase">LULUS</p>
            <p class="text-base font-black text-emerald-800">${totalApproved}</p>
          </div>
          <div class="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-center min-w-[80px]">
            <p class="text-[8px] font-black text-amber-600 uppercase">SEMAKAN</p>
            <p class="text-base font-black text-amber-800">${totalPending}</p>
          </div>
        </div>
      </div>

      <!-- TABLE CONTAINER -->
      <div class="border border-outline-variant/30 rounded-xl overflow-hidden bg-white shadow-xs">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-primary text-white text-[9px] font-black uppercase tracking-wider border-b border-outline-variant/20">
              <th class="px-3 py-2 text-center w-[40px]">Bil.</th>
              <th class="px-3 py-2 w-[110px]">No. Ahli</th>
              <th class="px-3 py-2">Nama Penuh Pemohon</th>
              <th class="px-3 py-2 w-[110px]">No. Kad Pengenalan</th>
              <th class="px-3 py-2 w-[100px]">No. Telefon</th>
              <th class="px-3 py-2">Alamat & No. Rumah</th>
              <th class="px-3 py-2 text-center w-[90px]">Kediaman</th>
              <th class="px-3 py-2 text-center w-[100px]">Jenis Keahlian</th>
              <th class="px-3 py-2 text-center w-[100px]">Tarikh Lulus</th>
              <th class="px-3 py-2 text-center w-[90px]">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            ${tableRowsHtml || noRows}
          </tbody>
        </table>
      </div>

    </div>

    <!-- SIGNATURES AND FOOTER MODULE -->
    <div class="mt-8 pt-6 border-t border-outline-variant/20 flex justify-between items-end text-xs text-slate-500">
      <div>
        <p class="font-bold">Tarikh Cetakan: <span class="text-slate-800 font-extrabold">${todayDate}</span></p>
        <p class="text-[10px] text-slate-400 mt-1">Dicetak melalui Portal Pengurusan Komuniti PTMF2. Hakcipta Terpelihara &copy; 2026.</p>
      </div>

      <div class="flex gap-20">
        <!-- Setiausaha Signature -->
        <div class="text-center w-[180px]">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Disediakan Oleh</p>
          <div class="border-b border-slate-400 w-full mx-auto my-2"></div>
          <p class="font-extrabold text-slate-800 uppercase text-[10px]">${setiausahaName}</p>
          <p class="text-[9px] text-slate-400 font-bold">Setiausaha PTMF2</p>
        </div>

        <!-- Pengerusi Signature -->
        <div class="text-center w-[180px]">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Disahkan Oleh</p>
          <div class="border-b border-slate-400 w-full mx-auto my-2"></div>
          <p class="font-extrabold text-slate-800 uppercase text-[10px]">${pengerusiName}</p>
          <p class="text-[9px] text-slate-400 font-bold">Pengerusi PTMF2</p>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ==========================================
  // WHATSAPP REPORT STATISTICS & CALCULATIONS
  // ==========================================
  
  // Determine active session year dynamically
  const whatsappCurrentRealDate = new Date();
  const whatsappActiveSessionYear = detectActiveSessionYear(yuranConfig, whatsappCurrentRealDate);

  const whatsappCurYear = whatsappCurrentRealDate.getFullYear();
  const whatsappCurMonth = whatsappCurrentRealDate.getMonth() + 1; // 1-indexed

  // Generate the 12 months for this session
  const activeSesiObj = (yuranConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList).find(s => s.id === whatsappActiveSessionYear)
    || (yuranConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList)[0];
  const generated12 = generate12Months(activeSesiObj.startMonth, activeSesiObj.startYear);
  const whatsappSessionMonths = generated12.map(m => ({
    name: monthNamesMs[m.val - 1],
    year: m.year,
    index: m.val,
    label: m.name
  }));

  // Filter elapsed months in the active session up to now
  let whatsappElapsedMonths = whatsappSessionMonths.filter(m => {
    if (m.year < whatsappCurYear) return true;
    if (m.year === whatsappCurYear && m.index <= whatsappCurMonth) return true;
    return false;
  });

  if (whatsappElapsedMonths.length === 0) {
    // If none are elapsed (e.g. testing before start of session), default to the first month for testing and demonstration
    whatsappElapsedMonths = [whatsappSessionMonths[0]];
  }

  const isUserMonthPaid = (userPaidPackageIds: string[] | undefined, sessionYear: string, monthIndex: number) => {
    if (!userPaidPackageIds) return false;
    // Tahunan package
    if (userPaidPackageIds.includes(`pkg-tahunan-${sessionYear}`)) return true;
    
    // Penggal packages
    const sesi = (yuranConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList).find(s => s.id === sessionYear);
    const months = sesi ? generate12Months(sesi.startMonth, sesi.startYear) : generate12Months(1, parseInt(sessionYear) || 2026);
    const p1 = months.slice(0, 6).map(m => m.val);
    const p2 = months.slice(6, 12).map(m => m.val);

    if (p1.includes(monthIndex) && userPaidPackageIds.includes(`pkg-penggal-1-${sessionYear}`)) return true;
    if (p2.includes(monthIndex) && userPaidPackageIds.includes(`pkg-penggal-2-${sessionYear}`)) return true;
    // Bulanan package
    const monthlyPkgId = `pkg-bulanan-${sessionYear}-${monthIndex.toString().padStart(2, '0')}`;
    return userPaidPackageIds.includes(monthlyPkgId);
  };

  // 1. Approved members (ahli yang diluluskan) - based on approved applications from "Senarai Permohonan Keahlian"
  const approvedMembers = allUsers.filter(u => 
    allApplications.some(app => app.uid === u.uid && (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian'))
  );
  const approvedMembersCount = approvedMembers.length;

  // 2. Keahlian Fee Paid count
  const paidKeahlianCount = approvedMembers.filter(u => u.paidPackageIds && u.paidPackageIds.includes('pkg-keahlian')).length;
  const keahlianPercent = approvedMembersCount > 0 ? Math.round((paidKeahlianCount / approvedMembersCount) * 100) : 0;

  // 3. Persatuan Fee Paid (up to current month and previous months are fully paid)
  const paidPersatuanCount = approvedMembers.filter(u => {
    const unpaidMonths = whatsappElapsedMonths.filter(m => !isUserMonthPaid(u.paidPackageIds, whatsappActiveSessionYear, m.index));
    return unpaidMonths.length === 0;
  }).length;
  const persatuanPercent = approvedMembersCount > 0 ? Math.round((paidPersatuanCount / approvedMembersCount) * 100) : 0;

  // 4. Sesi Semasa Payment Percentage (Overall months paid for the 12 months)
  const totalExpectedMonths = approvedMembersCount * 12;
  const totalPaidMonthsCount = approvedMembers.reduce((sum, u) => {
    const all12Months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
    return sum + all12Months.filter(mIdx => isUserMonthPaid(u.paidPackageIds, whatsappActiveSessionYear, mIdx)).length;
  }, 0);
  const sessionPaymentPercent = totalExpectedMonths > 0 ? Math.round((totalPaidMonthsCount / totalExpectedMonths) * 100) : 0;

  // 5. Unpaid houses list
  const unpaidHouseList = approvedMembers
    .map(u => {
      const hasPaidKeahlian = u.paidPackageIds && u.paidPackageIds.includes('pkg-keahlian');
      const unpaidMonths = whatsappElapsedMonths.filter(m => !isUserMonthPaid(u.paidPackageIds, whatsappActiveSessionYear, m.index));

      if (!hasPaidKeahlian || unpaidMonths.length > 0) {
        return {
          noRumah: u.noRumah || 'Tiada No Rumah',
          displayName: u.displayName || u.nickname || 'Penduduk',
          unpaidKeahlian: !hasPaidKeahlian,
          unpaidMonths: unpaidMonths.map(m => m.name), // e.g. ["Ogos", "September"]
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Group / unique by noRumah to prevent duplication
  const uniqueUnpaidHousesMap = new Map<string, typeof unpaidHouseList[0]>();
  unpaidHouseList.forEach(item => {
    const key = item.noRumah;
    const existing = uniqueUnpaidHousesMap.get(key);
    if (!existing) {
      uniqueUnpaidHousesMap.set(key, item);
    } else {
      existing.unpaidKeahlian = existing.unpaidKeahlian && item.unpaidKeahlian;
      existing.unpaidMonths = existing.unpaidMonths.filter(m => item.unpaidMonths.includes(m));
    }
  });

  const finalUnpaidHouses = Array.from(uniqueUnpaidHousesMap.values()).filter(item => 
    item.unpaidKeahlian || item.unpaidMonths.length > 0
  );

  const handleShareToWhatsApp = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const sessionName = whatsappActiveSessionYear === '2026' ? 'Sesi 2026/2027' : 'Sesi 2027/2028';

    let msg = `📊 *LAPORAN STATUS PEMBAYARAN YURAN PERSATUAN PTMF2* 📊\n`;
    msg += `*Sesi Semasa:* ${sessionName}\n`;
    msg += `*Tarikh Laporan:* ${dateStr}\n\n`;

    msg += `📈 *STATISTIK KESELURUHAN (Ahli Diluluskan: ${approvedMembersCount} orang)*\n`;
    msg += `• *Peratus Kutipan Yuran Sesi:* ${sessionPaymentPercent}%\n`;
    msg += `• *Yuran Keahlian (Pendaftaran):* ${keahlianPercent}% telah bayar (${paidKeahlianCount}/${approvedMembersCount})\n`;
    msg += `• *Yuran Persatuan (Lunas sehingga bulan semasa):* ${persatuanPercent}% lunas (${paidPersatuanCount}/${approvedMembersCount})\n\n`;

    msg += `🏠 *SENARAI NO RUMAH BELUM LUNAS KEAHLIAN / PERSATUAN SEMASA:*\n`;

    if (finalUnpaidHouses.length === 0) {
      msg += `✅ Syabas! Semua ahli telah melunaskan yuran keahlian dan persatuan sesi semasa.\n`;
    } else {
      finalUnpaidHouses.forEach((item, idx) => {
        msg += `${idx + 1}. *No. Rumah: ${item.noRumah}*\n`;
        const issues = [];
        if (item.unpaidKeahlian) {
          issues.push(`Yuran Keahlian ❌`);
        }
        if (item.unpaidMonths.length > 0) {
          issues.push(`Yuran Persatuan (${item.unpaidMonths.join(', ')}) ❌`);
        }
        msg += `   ↳ Status: ${issues.join(' | ')}\n`;
      });
    }

    msg += `\n*Nota:* Sila selesaikan tunggakan yuran anda dengan kadar segera menerusi Portal Pengurusan Komuniti PTMF2. Terima kasih atas kerjasama semua penduduk! 🙏🏼`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 text-white px-6 py-6 shadow-xs border-b border-indigo-950/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              {isMobile && onBack && (
                <button
                  onClick={onBack}
                  className="bg-indigo-800/40 hover:bg-indigo-800/60 text-white p-1.5 rounded-lg border border-indigo-700/50 transition-colors mr-1 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <span className="bg-indigo-500/30 text-indigo-300 font-extrabold text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-indigo-500/40 uppercase">Panel Admin</span>
              {isSuperAdmin ? (
                <span className="bg-amber-500/30 text-amber-300 font-extrabold text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-amber-500/40 uppercase">Akses Penuh</span>
              ) : (
                <span className="bg-emerald-500/30 text-emerald-300 font-extrabold text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/40 uppercase">
                  {currentUserDoc?.role || 'Pengurusan'}: Permohonan Keahlian
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight mt-1">Sistem Pengurusan Komuniti PTMF2</h1>
            <p className="text-xs text-indigo-200 font-medium mt-0.5">
              {isPermohonanOnlyRole
                ? 'Semak, tapis, luluskan, tolak dan urus senarai permohonan keahlian persatuan.' 
                : 'Pantau statistik, urus permohonan keahlian, semak audit log, dan kemaskini hak akses pengguna.'}
            </p>
          </div>
          
          {/* Quick Tab Selectors */}
          <div className="flex gap-1 bg-indigo-950/50 p-1 rounded-xl border border-indigo-850 w-full md:w-auto">
            {!isPermohonanOnlyRole && (
              <button 
                onClick={() => { setActiveTab('dashboard'); setCurrentPage(1); }}
                className={`flex-1 px-1 py-1.5 md:px-3.5 md:py-2 rounded-lg font-black text-[9px] sm:text-[10px] md:text-xs transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-200 hover:bg-indigo-900/40'}`}
              >
                Dashboard
              </button>
            )}
            <button 
              onClick={() => { setActiveTab('permohonan'); setCurrentPage(1); }}
              className={`flex-1 px-1 py-1.5 md:px-3.5 md:py-2 rounded-lg font-black text-[9px] sm:text-[10px] md:text-xs transition-all cursor-pointer relative ${activeTab === 'permohonan' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-200 hover:bg-indigo-900/40'}`}
            >
              Permohonan Keahlian
              {stats.pendingApps > 0 && (
                <span className="absolute -top-1.5 -right-1.5 md:-top-1 md:-right-1 bg-rose-500 text-white font-extrabold text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse border border-indigo-900">
                  {stats.pendingApps}
                </span>
              )}
            </button>
            {!isPermohonanOnlyRole && (
              <>
                <button 
                  onClick={() => { setActiveTab('pengguna'); setCurrentPage(1); }}
                  className={`flex-1 px-1 py-1.5 md:px-3 md:py-2 rounded-lg font-black text-[9px] sm:text-[10px] md:text-xs transition-all cursor-pointer ${activeTab === 'pengguna' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-200 hover:bg-indigo-900/40'}`}
                >
                  Pengguna
                </button>
                <button 
                  onClick={() => { setActiveTab('login_logs'); setLoginCurrentPage(1); }}
                  className={`flex-1 px-1 py-1.5 md:px-3 md:py-2 rounded-lg font-black text-[9px] sm:text-[10px] md:text-xs transition-all cursor-pointer relative ${activeTab === 'login_logs' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-200 hover:bg-indigo-900/40'}`}
                >
                  Log Masuk
                  {loginLogs.length > 0 && (
                    <span className="ml-1 bg-indigo-500/50 text-white font-extrabold text-[8px] px-1.5 py-0.2 rounded-full hidden sm:inline-block">
                      {loginLogs.length}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => { setActiveTab('audit_logs'); setCurrentPage(1); }}
                  className={`flex-1 px-1 py-1.5 md:px-3 md:py-2 rounded-lg font-black text-[9px] sm:text-[10px] md:text-xs transition-all cursor-pointer ${activeTab === 'audit_logs' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-200 hover:bg-indigo-900/40'}`}
                >
                  Audit Log
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Content Body */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-6">

        {/* ----------------- TAB 1: DASHBOARD STATS ----------------- */}
        {activeTab === 'dashboard' && !isPermohonanOnlyRole && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Bento Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-indigo-100 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pelawat (Bukan Ahli)</span>
                <span className="text-3xl font-black text-indigo-950 mt-1.5">{stats.totalPelawat}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-1">Akaun melawat portal</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-emerald-100 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ahli Biasa</span>
                <span className="text-3xl font-black text-emerald-600 mt-1.5">{stats.totalAhliBiasa}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-1">Ahli muktamad berdaftar</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-sky-100 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ahli Bersekutu</span>
                <span className="text-3xl font-black text-sky-600 mt-1.5">{stats.totalAhliBersekutu}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-1">Ahli luar/bukan pemilik</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-purple-100 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ahli Kehormat</span>
                <span className="text-3xl font-black text-purple-600 mt-1.5">{stats.totalAhliKehormat}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-1">Tokoh khas dilantik</p>
              </div>
              <div className="bg-indigo-950 text-white p-4 rounded-2xl border border-indigo-900 shadow-xs flex flex-col justify-between col-span-2 md:col-span-1">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Jumlah Pengguna</span>
                <span className="text-3xl font-black text-amber-400 mt-1.5">{stats.totalRegistered}</span>
                <p className="text-[9px] text-indigo-200 font-medium mt-1">Berdaftar dengan Google</p>
              </div>
            </div>

            {/* Sub-grid for Applications status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-amber-50 border border-amber-150 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">Menunggu Kelulusan</span>
                  <span className="text-2xl font-black text-amber-900 mt-0.5">{stats.pendingApps}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  <Clock size={18} className="animate-spin duration-3000" />
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">Diluluskan</span>
                  <span className="text-2xl font-black text-emerald-900 mt-0.5">{stats.approvedApps}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <UserCheck size={18} />
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-150 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider block">Ditolak</span>
                  <span className="text-2xl font-black text-rose-900 mt-0.5">{stats.rejectedApps}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
                  <UserX size={18} />
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider block">Ahli Jawatankuasa</span>
                  <span className="text-2xl font-black text-indigo-900 mt-0.5">{stats.totalAjk}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Shield size={18} />
                </div>
              </div>
            </div>

            {/* PUSH NOTIFICATION MANAGEMENT SECTION */}
            <AdminPushNotificationSection currentUserDoc={currentUserDoc} triggerSnackbar={triggerSnackbar} />

            {/* Welcome widget or tips */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Database size={16} className="text-indigo-600" />
                Struktur Pangkalan Data Realtime (Firestore)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aplikasi ini dihubungkan secara terus dengan Cloud Firestore. Sebarang perubahan maklumat, status keahlian, hantaran borang, permohonan keahlian, dan audit log akan diselaraskan serta merta ke semua skrin pengguna yang aktif tanpa memerlukan muat semula halaman.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-slate-500 font-mono text-[10px]">
                <div className="bg-slate-55 p-2 rounded-lg border border-slate-100">📂 users/ (Profil pengguna, role & status)</div>
                <div className="📂 membershipApplications/ (Borang kelulusan)">📂 membershipApplications/ (Salinan borang keahlian)</div>
                <div className="📂 auditLogs/ (Audit log aksi penting)">📂 auditLogs/ (Audit trail tindakan admin/sistem)</div>
                <div className="📂 roles/ (Rekod pertukaran role)">📂 roles/ (Log perubahan role pengguna)</div>
                <div className="📂 settings/ (Ketetapan & parameter sistem)">📂 settings/ (Ketetapan real-time persatuan)</div>
              </div>
            </div>

            {/* Setting Pendaftaran Keahlian Card (Admin Utama) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm">Kawalan Pendaftaran Keahlian (Daftar Ahli)</h3>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-full border border-indigo-100 uppercase tracking-wider">
                        Admin Utama
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">Kawalan kebenaran pendaftaran keahlian baharu persatuan pada ikon Daftar Ahli.</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3.5">
                {yuranConfig.enableMembershipRegistration === false && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-black">Pendaftaran Keahlian Sedang Dinyahaktifkan (OFF)!</p>
                      <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                        Pengguna dan penduduk tidak akan dapat mengisi borang pendaftaran keahlian baharu sehingga anda mengaktifkannya semula.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">Status Pendaftaran Keahlian:</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        yuranConfig.enableMembershipRegistration !== false 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {yuranConfig.enableMembershipRegistration !== false ? 'AKTIF (ON)' : 'TUTUP / OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {yuranConfig.enableMembershipRegistration !== false 
                        ? 'Ikon "Daftar Ahli" aktif dan borang pendaftaran boleh diisi oleh pengguna.' 
                        : 'Borang pendaftaran keahlian ditutup buat sementara waktu.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleRegistration}
                    disabled={isUpdatingRegistrationConfig || !isSuperAdmin}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs ${
                      !isSuperAdmin
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : yuranConfig.enableMembershipRegistration !== false
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                    }`}
                    title={!isSuperAdmin ? 'Hanya Admin Utama sahaja dibenarkan' : 'Tukar Status Pendaftaran'}
                  >
                    {isUpdatingRegistrationConfig ? (
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="animate-spin" />
                        <span>Mengemaskini...</span>
                      </span>
                    ) : yuranConfig.enableMembershipRegistration !== false ? (
                      <>
                        <ToggleRight size={18} />
                        <span>Nyahaktifkan (OFF)</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={18} />
                        <span>Aktifkan (ON)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Setting Pembayaran Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Setting Pembayaran (Mod Bayaran Yuran)</h3>
                    <p className="text-[11px] text-slate-500">Kawalan pengaktifan kaedah pembayaran manual dan perbankan dalam talian FPX untuk penduduk.</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3.5">
                {/* Notice if both are turned off */}
                {yuranConfig.enableManualPayment === false && yuranConfig.enableFPXPayment === false && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-black">Kedua-dua Mod Pembayaran Dinyahaktifkan!</p>
                      <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                        Penduduk akan melihat nota penutupan sementara sistem di troli bayaran dan tidak dapat melakukan checkout sehingga salah satu mod diaktifkan semula.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* FPX Payment Switch */}
                  <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    yuranConfig.enableFPXPayment !== false 
                      ? 'bg-slate-50/80 border-slate-200/80' 
                      : 'bg-rose-50/40 border-rose-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded tracking-wide uppercase">FPX</span>
                        <span className="font-extrabold text-slate-900 text-xs">Pembayaran FPX (Dalam Talian)</span>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        yuranConfig.enableFPXPayment !== false 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {yuranConfig.enableFPXPayment !== false ? 'AKTIF (ON)' : 'TUTUP (OFF)'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Membolehkan penduduk membuat bayaran yuran secara terus menggunakan perbankan FPX (automatik disahkan tanpa semakan manual).
                    </p>

                    <button
                      type="button"
                      disabled={isUpdatingPaymentConfig}
                      onClick={() => handleTogglePaymentMethod('fpx')}
                      className={`w-full py-2 px-3 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                        yuranConfig.enableFPXPayment !== false
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Power size={14} />
                      <span>{yuranConfig.enableFPXPayment !== false ? 'Nyahaktifkan FPX (OFF)' : 'Aktifkan FPX (ON)'}</span>
                    </button>
                  </div>

                  {/* Manual Payment Switch */}
                  <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    yuranConfig.enableManualPayment !== false 
                      ? 'bg-slate-50/80 border-slate-200/80' 
                      : 'bg-rose-50/40 border-rose-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-indigo-600" />
                        <span className="font-extrabold text-slate-900 text-xs">Pembayaran Manual (Resit Bukti)</span>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        yuranConfig.enableManualPayment !== false 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {yuranConfig.enableManualPayment !== false ? 'AKTIF (ON)' : 'TUTUP (OFF)'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Membolehkan penduduk membuat pindahan bank/CDM dan memuat naik resit transaksi untuk disahkan oleh Bendahari/Admin.
                    </p>

                    <button
                      type="button"
                      disabled={isUpdatingPaymentConfig}
                      onClick={() => handleTogglePaymentMethod('manual')}
                      className={`w-full py-2 px-3 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                        yuranConfig.enableManualPayment !== false
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Power size={14} />
                      <span>{yuranConfig.enableManualPayment !== false ? 'Nyahaktifkan Manual (OFF)' : 'Aktifkan Manual (ON)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tetapan & Urus Pendaftaran Qurban & Aqiqah */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Heart size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Tetapan Harga, Ansuran & Limit Qurban & Aqiqah</h3>
                    <p className="text-[11px] text-slate-500">Tetapkan harga pakej, kuota limit pendaftaran dan urus pendaftar peserta Qurban & Aqiqah.</p>
                  </div>
                </div>

                {onNavigateToUrusQurban && (
                  <button
                    type="button"
                    onClick={onNavigateToUrusQurban}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-100 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Users size={14} />
                    <span>Urus Pendaftaran Qurban & Aqiqah</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveQurbanConfig} className="space-y-4 pt-1">
                <div className="space-y-3">
                  <span className="text-[10px] font-black tracking-widest text-emerald-800 uppercase bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                    Tetapan Harga Pakej (RM)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                        Harga 1 Bhg Lembu (RM):
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editBhgLembuPrice}
                        onChange={e => setEditBhgLembuPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                        Harga 1 Ekor Lembu (RM):
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editEkorLembuPrice}
                        onChange={e => setEditEkorLembuPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                        Harga 1 Ekor Kambing (RM):
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editEkorKambingPrice}
                        onChange={e => setEditEkorKambingPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Tetapan Caj Pengurusan: Peratus (%) atau Nilai RM Terus */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black tracking-widest text-emerald-800 uppercase bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                      Tetapan Caj Pengurusan (Peratus % atau Nilai RM)
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold italic">
                      * Pilih kaedah pengiraan caj pengurusan sama ada ikut peratus atau nilai RM terus
                    </span>
                  </div>

                  {/* Pilihan Mod Caj Pengurusan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      editManagementFeeType === 'percent'
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="managementFeeType"
                        value="percent"
                        checked={editManagementFeeType === 'percent'}
                        onChange={() => setEditManagementFeeType('percent')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-slate-900 block">
                          Kira Mengikut Peratusan (%)
                        </span>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Caj pengurusan dikira mengikut kadar peratus (%) daripada harga pakej.
                        </p>
                      </div>
                    </label>

                    <label className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      editManagementFeeType === 'fixed'
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="managementFeeType"
                        value="fixed"
                        checked={editManagementFeeType === 'fixed'}
                        onChange={() => setEditManagementFeeType('fixed')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-slate-900 block">
                          Nilai Tetap Ringgit (Nilai RM Terus)
                        </span>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Caj pengurusan ditetapkan pada nilai RM terus tanpa mengira harga pakej.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Input mengikut Pilihan */}
                  <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
                    {editManagementFeeType === 'percent' ? (
                      <div className="space-y-1.5 max-w-sm">
                        <label className="text-[11px] font-extrabold text-slate-700 block uppercase">
                          Kadar Caj Pengurusan (%):
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="0"
                            max="100"
                            step="0.5"
                            value={editManagementFeePercent}
                            onChange={e => setEditManagementFeePercent(Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 pr-8 text-xs border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 bg-white"
                            placeholder="Contoh: 5"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                            %
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          Cth: Masukkan 5 untuk 5% caj daripada harga setiap pakej.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-w-sm">
                        <label className="text-[11px] font-extrabold text-slate-700 block uppercase">
                          Nilai Caj Pengurusan Terus (RM):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                            RM
                          </span>
                          <input
                            type="number"
                            required
                            min="0"
                            step="1"
                            value={editManagementFeeFixed}
                            onChange={e => setEditManagementFeeFixed(Math.max(0, Number(e.target.value)))}
                            className="w-full pl-10 pr-3 py-2 text-xs border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 bg-white"
                            placeholder="Contoh: 50"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          Cth: Masukkan 50 untuk mengenakan caj tetap RM 50.00 terus.
                        </span>
                      </div>
                    )}

                    {/* Ringkasan Simulasi Kiraan */}
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-2">
                        Simulasi Pengiraan Harga Keseluruhan (Pakej + Caj Pengurusan):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        {/* 1 Bhg Lembu */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-extrabold text-slate-500 block">1 Bhg Lembu</span>
                          <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                            RM {editBhgLembuPrice.toFixed(2)} +{' '}
                            <span className="text-amber-700 font-bold">
                              {editManagementFeeType === 'fixed'
                                ? `RM ${editManagementFeeFixed.toFixed(2)}`
                                : `RM ${Math.round((editBhgLembuPrice * editManagementFeePercent) / 100).toFixed(2)} (${editManagementFeePercent}%)`}
                            </span>
                          </div>
                          <div className="text-xs font-black text-emerald-800 mt-1 pt-1 border-t border-slate-100">
                            Jumlah: RM {(editBhgLembuPrice + (editManagementFeeType === 'fixed' ? editManagementFeeFixed : Math.round((editBhgLembuPrice * editManagementFeePercent) / 100))).toFixed(2)}
                          </div>
                        </div>

                        {/* 1 Ekor Lembu */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-extrabold text-slate-500 block">1 Ekor Lembu</span>
                          <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                            RM {editEkorLembuPrice.toFixed(2)} +{' '}
                            <span className="text-amber-700 font-bold">
                              {editManagementFeeType === 'fixed'
                                ? `RM ${editManagementFeeFixed.toFixed(2)}`
                                : `RM ${Math.round((editEkorLembuPrice * editManagementFeePercent) / 100).toFixed(2)} (${editManagementFeePercent}%)`}
                            </span>
                          </div>
                          <div className="text-xs font-black text-emerald-800 mt-1 pt-1 border-t border-slate-100">
                            Jumlah: RM {(editEkorLembuPrice + (editManagementFeeType === 'fixed' ? editManagementFeeFixed : Math.round((editEkorLembuPrice * editManagementFeePercent) / 100))).toFixed(2)}
                          </div>
                        </div>

                        {/* 1 Ekor Kambing */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-extrabold text-slate-500 block">1 Ekor Kambing</span>
                          <div className="text-[11px] font-semibold text-slate-700 mt-0.5">
                            RM {editEkorKambingPrice.toFixed(2)} +{' '}
                            <span className="text-amber-700 font-bold">
                              {editManagementFeeType === 'fixed'
                                ? `RM ${editManagementFeeFixed.toFixed(2)}`
                                : `RM ${Math.round((editEkorKambingPrice * editManagementFeePercent) / 100).toFixed(2)} (${editManagementFeePercent}%)`}
                            </span>
                          </div>
                          <div className="text-xs font-black text-emerald-800 mt-1 pt-1 border-t border-slate-100">
                            Jumlah: RM {(editEkorKambingPrice + (editManagementFeeType === 'fixed' ? editManagementFeeFixed : Math.round((editEkorKambingPrice * editManagementFeePercent) / 100))).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black tracking-widest text-indigo-800 uppercase bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                      Had Limit / Kuota Peserta Mengikut Kategori
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold italic">
                      * Letakkan nilai 0 jika pendaftaran tidak dibuka bagi kategori tersebut
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Kuota 1 Bhg Lembu (Bahagian):
                        </label>
                        {Number(editLimitBhgLembu) === 0 ? (
                          <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Tidak Dibuka
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Dibuka ({editLimitBhgLembu} Bhg)
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editLimitBhgLembu}
                        onChange={e => setEditLimitBhgLembu(Math.max(0, Number(e.target.value)))}
                        className={`w-full px-3 py-2 text-xs border rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-indigo-500 ${
                          Number(editLimitBhgLembu) === 0 ? 'bg-slate-50 border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Cth: 35 bahagian. <strong className="text-slate-600">Nilai 0 = Tidak dibuka pendaftarannya</strong>
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Kuota 1 Ekor Lembu (Ekor):
                        </label>
                        {Number(editLimitEkorLembu) === 0 ? (
                          <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Tidak Dibuka
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Dibuka ({editLimitEkorLembu} Ekor)
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editLimitEkorLembu}
                        onChange={e => setEditLimitEkorLembu(Math.max(0, Number(e.target.value)))}
                        className={`w-full px-3 py-2 text-xs border rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-indigo-500 ${
                          Number(editLimitEkorLembu) === 0 ? 'bg-slate-50 border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Cth: 5 ekor lembu penuh. <strong className="text-slate-600">Nilai 0 = Tidak dibuka pendaftarannya</strong>
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Kuota 1 Ekor Kambing (Ekor):
                        </label>
                        {Number(editLimitEkorKambing) === 0 ? (
                          <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Tidak Dibuka
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Dibuka ({editLimitEkorKambing} Ekor)
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editLimitEkorKambing}
                        onChange={e => setEditLimitEkorKambing(Math.max(0, Number(e.target.value)))}
                        className={`w-full px-3 py-2 text-xs border rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-indigo-500 ${
                          Number(editLimitEkorKambing) === 0 ? 'bg-slate-50 border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Cth: 20 ekor kambing. <strong className="text-slate-600">Nilai 0 = Tidak dibuka pendaftarannya</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tetapan Paparan Banner Pendaftaran Qurban & Aqiqah */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-black tracking-widest text-emerald-900 uppercase bg-emerald-100/70 px-2.5 py-0.5 rounded border border-emerald-300">
                    Tetapan Paparan Banner Pendaftaran Qurban & Aqiqah (Bayar Yuran)
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className={`p-3 rounded-xl border text-xs font-bold flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                      editBannerVisibility === 'all'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="bannerVisibility"
                          value="all"
                          checked={editBannerVisibility === 'all'}
                          onChange={() => setEditBannerVisibility('all')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-extrabold text-[11px]">Paparkan Kepada Semua</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Banner pendaftaran dipaparkan kepada semua pengguna portal.
                      </span>
                    </label>

                    <label className={`p-3 rounded-xl border text-xs font-bold flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                      editBannerVisibility === 'registered'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="bannerVisibility"
                          value="registered"
                          checked={editBannerVisibility === 'registered'}
                          onChange={() => setEditBannerVisibility('registered')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-extrabold text-[11px]">Hanya User Yang Daftar</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Paparkan banner hanya kepada pengguna yang sudah mendaftar peserta Qurban.
                      </span>
                    </label>

                    <label className={`p-3 rounded-xl border text-xs font-bold flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                      editBannerVisibility === 'hide'
                        ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="bannerVisibility"
                          value="hide"
                          checked={editBannerVisibility === 'hide'}
                          onChange={() => setEditBannerVisibility('hide')}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <span className="font-extrabold text-[11px]">Sembunyikan Banner (Hide)</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Sembunyikan banner Pendaftaran Qurban & Aqiqah sepenuhnya.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSavingQurbanConfig}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingQurbanConfig ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        <span>Simpan Tetapan Qurban</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Konfigurasi Akaun Bank & QR Manual */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Konfigurasi Akaun Bank & QR Manual</h3>
                  <p className="text-[11px] text-slate-500">Kemaskini maklumat bank persatuan dan kod QR yang dipaparkan kepada penduduk semasa pembayaran manual.</p>
                </div>
              </div>

              <form onSubmit={handleSaveBankInfo} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block uppercase tracking-wider">
                      Nama Bank / Jenis Bank <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editBankName}
                      onChange={(e) => setEditBankName(e.target.value)}
                      placeholder="Contoh: Bank Islam / Maybank"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block uppercase tracking-wider">
                      Nama Pemegang Akaun <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editAccountName}
                      onChange={(e) => setEditAccountName(e.target.value)}
                      placeholder="Contoh: PERSATUAN TAMAN MUSYTARI FASA 2"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 block uppercase tracking-wider">
                      Nombor Akaun Bank <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editAccountNumber}
                      onChange={(e) => setEditAccountNumber(e.target.value)}
                      placeholder="Contoh: 5562 1234 5678"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] font-extrabold text-slate-700 block uppercase tracking-wider">
                    Muat Naik Gambar QR Pembayaran (Contoh: DuitNow QR)
                  </label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div className="md:col-span-3">
                      <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-300 bg-slate-50/50 rounded-2xl p-4 text-center transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQrUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <Save className="h-5 w-5 text-slate-400" />
                          <p className="text-[10px] font-black text-slate-700">Pilih fail QR gambar</p>
                          <p className="text-[9px] text-slate-400">Format PNG/JPG/JPEG, Maksimum saiz fail 1MB</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-200 rounded-2xl aspect-square relative group">
                      {editQrCodeUrl ? (
                        <>
                          <img
                            src={editQrCodeUrl}
                            alt="QR Preview"
                            className="h-24 w-24 object-contain rounded-lg border border-slate-100 bg-white"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditQrCodeUrl('');
                              triggerSnackbar('Gambar QR dipadam. Sila klik Simpan untuk mengemaskini.', 'success');
                            }}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-xs cursor-pointer transition-all active:scale-90"
                            title="Buang QR"
                          >
                            <X size={10} strokeWidth={3} />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Tiada QR</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSavingBankInfo}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingBankInfo ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        <span>Simpan Maklumat Bank</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* OpenRouter AI Vision Configuration Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Setting AI Vision OpenRouter (Pengecaman Resit)</h3>
                    <p className="text-[11px] text-slate-500">Konfigurasi API Key & Model OpenRouter untuk menyemak resit bayaran manual penduduk secara automatik.</p>
                  </div>
                </div>
                <span className="text-[10px] font-black bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200 flex items-center gap-1">
                  <Cpu size={12} />
                  <span>{openRouterModel || 'google/gemini-2.5-flash-lite'}</span>
                </span>
              </div>

              <form onSubmit={handleSaveOpenRouterConfig} className="border-t border-slate-100 pt-4 space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* API Key Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Key size={13} className="text-purple-600" />
                      <span>OpenRouter API Key:</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showOpenRouterKey ? 'text' : 'password'}
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        required
                        className="w-full pl-3 pr-10 py-2.5 text-xs border border-slate-200 rounded-xl font-mono text-slate-900 bg-slate-50/50 focus:outline-hidden focus:border-purple-500 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showOpenRouterKey ? "Sembunyikan Kunci" : "Paparkan Kunci"}
                      >
                        {showOpenRouterKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Model Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Cpu size={13} className="text-purple-600" />
                      <span>Model AI Penjanaan & Vision OpenRouter:</span>
                    </label>
                    <input
                      type="text"
                      value={openRouterModel}
                      onChange={(e) => setOpenRouterModel(e.target.value)}
                      placeholder="google/gemini-2.5-flash"
                      required
                      className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl font-mono text-slate-900 bg-slate-50/50 focus:outline-hidden focus:border-purple-500 focus:bg-white transition-all"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">Model disyorkan: <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-bold">google/gemini-2.5-flash</code> (atau <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-bold">google/gemini-2.5-flash-lite</code>)</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span>Wajib untuk pengesahan resit bayaran (Scan Resit Vision) & berfungsi sebagai sandaran (fallback) automatik jika GEMINI_API_KEY gagal.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingOpenRouter}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-100 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isSavingOpenRouter ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Simpan Tetapan AI Vision</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Google Sheets Integration Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Integrasi & Eksport Google Sheets</h3>
                  <p className="text-[11px] text-slate-500">Salurkan data lengkap daripada pangkalan data secara langsung ke helaian Google Sheets.</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Data daripada Firebase akan diselaraskan & dieksport secara terus ke satu fail Google Sheet simpanan khas persatuan (<code className="bg-slate-100 text-emerald-800 font-mono px-1 py-0.5 rounded text-[10px]">1RarqkSZzIT5032uKbRTBsK6BtFu8YQjyUuvPpf0m1NQ</code>) mengandungi 25 tab berasingan yang lengkap merangkumi seluruh modul sistem (termasuk Maklumat Ahli, Kewangan, Qurban & Ansuran, Kunci Kira-Kira, Dokumen, Log Masuk, Pertukaran Peranan, dan Tetapan Sistem).
                </p>

                {/* Connection Status / Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleExportToGoogleSheets}
                    disabled={isExportingSheets}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
                      isExportingSheets 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                    }`}
                  >
                    {isExportingSheets ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Sedang Mengeksport Data...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={14} />
                        {googleDriveToken ? 'Eksport Data Sekarang' : 'Sambung Google & Eksport'}
                      </>
                    )}
                  </button>

                  {googleDriveToken && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Akaun Google Bersambung
                      </span>
                      <button
                        type="button"
                        onClick={handleReconnectGoogle}
                        disabled={isExportingSheets}
                        className="text-[11px] text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Tukar atau sambung semula akaun Google"
                      >
                        <RefreshCw size={11} className={isExportingSheets ? "animate-spin" : ""} />
                        <span>Tukar / Sambung Semula</span>
                      </button>
                    </div>
                  )}

                  <a
                    href="https://docs.google.com/spreadsheets/d/1RarqkSZzIT5032uKbRTBsK6BtFu8YQjyUuvPpf0m1NQ/edit?gid=0#gid=0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  >
                    <span>Pautan Google Sheet Backup</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                {/* Success Results Banner */}
                {sheetsResult && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-150 rounded-xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-black">
                      <Check size={16} className="text-emerald-600" />
                      Eksport Berjaya Dijalankan!
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      Pangkalan data Firebase telah berjaya dieksport dan diselaraskan ke dalam {sheetsResult.totalTabs || 25} tab Google Sheet rasmi persatuan.
                    </p>
                    <a
                      href={sheetsResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg border border-emerald-200 transition-colors cursor-pointer mt-1"
                    >
                      Buka Google Sheet Rasmi Persatuan
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Error Banner */}
                {sheetsError && (
                  <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-800">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-extrabold text-rose-900">Ralat Eksport Google Sheets:</p>
                        <p className="text-[11px] leading-relaxed text-rose-700">{sheetsError}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setSheetsError(null);
                        setGoogleDriveToken(null);
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem('tmf2_google_drive_token');
                          localStorage.removeItem('tmf2_google_drive_token_time');
                        }
                        await handleExportToGoogleSheets();
                      }}
                      className="shrink-0 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} />
                      <span>Sambung Semula & Cuba Lagi</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp Broadcast Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <MessageCircle size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Hebahan Laporan Yuran WhatsApp</h3>
                  <p className="text-[11px] text-slate-500">Hebahan laporan peratusan yuran dan senarai rumah tertunggak terus ke WhatsApp kumpulan jawatankuasa penduduk.</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-800">Sesi Semasa: <span className="text-indigo-600">{whatsappActiveSessionYear === '2026' ? 'Sesi 2026/2027' : 'Sesi 2027/2028'}</span></p>
                    <p>• Ahli Diluluskan: <span className="font-extrabold text-slate-800">{approvedMembersCount}</span> orang</p>
                    <p>• Kutipan Sesi Semasa: <span className="font-extrabold text-slate-800">{sessionPaymentPercent}%</span></p>
                  </div>
                  <div className="space-y-1.5">
                    <p>• Bayar Yuran Keahlian: <span className="font-extrabold text-emerald-600">{keahlianPercent}%</span> ({paidKeahlianCount}/{approvedMembersCount} ahli)</p>
                    <p>• Lunas Yuran Persatuan (Bulan Semasa): <span className="font-extrabold text-emerald-600">{persatuanPercent}%</span> ({paidPersatuanCount}/{approvedMembersCount} ahli)</p>
                    <p>• Rumah Belum Selesai Yuran: <span className="font-extrabold text-rose-500">{finalUnpaidHouses.length}</span> rumah</p>
                  </div>
                </div>

                {finalUnpaidHouses.length > 0 && (
                  <div className="space-y-1.5 bg-rose-50/50 p-3 rounded-xl border border-rose-100/40 text-[11px] text-slate-600">
                    <p className="font-extrabold text-rose-800">Pratinjau Rumah Tertunggak:</p>
                    <div className="max-h-24 overflow-y-auto divide-y divide-slate-100 font-mono">
                      {finalUnpaidHouses.slice(0, 5).map((item, index) => (
                        <div key={index} className="py-1 flex justify-between">
                          <span>🏠 No. {item.noRumah} ({item.displayName})</span>
                          <span className="text-rose-600">
                            {item.unpaidKeahlian ? 'Keahlian' : ''}
                            {item.unpaidKeahlian && item.unpaidMonths.length > 0 ? ' & ' : ''}
                            {item.unpaidMonths.length > 0 ? 'Persatuan' : ''}
                          </span>
                        </div>
                      ))}
                      {finalUnpaidHouses.length > 5 && (
                        <div className="py-1 text-slate-400 italic text-center">...dan {finalUnpaidHouses.length - 5} rumah lagi</div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleShareToWhatsApp}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
                >
                  <MessageCircle size={14} />
                  Kongsi Laporan ke WhatsApp
                </button>
              </div>
            </div>

            {/* Telegram Config Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Integrasi Bot Telegram Aduan</h3>
                  <p className="text-[11px] text-slate-500">Konfigurasikan sasaran hantaran mesej aduan penduduk secara automatik.</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Telegram Bot Token
                      </label>
                      <input 
                        type="text" 
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        placeholder="Contoh: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                        className="w-full bg-white border border-slate-200 text-slate-800 font-mono text-[11px] px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Telegram Chat ID (ID Kumpulan / Personal)
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          placeholder="Contoh: -100123456789 atau 12345678"
                          className="flex-1 bg-white border border-slate-200 text-slate-800 font-mono text-[11px] px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
                        />
                        <button
                          onClick={handleSaveTelegramChatId}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {telegramStatus.msg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    telegramStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                    telegramStatus.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-100' :
                    'bg-slate-50 text-slate-800 border border-slate-100 animate-pulse'
                  }`}>
                    {telegramStatus.type === 'success' && <Check size={14} className="shrink-0 text-emerald-600" />}
                    {telegramStatus.type === 'error' && <AlertCircle size={14} className="shrink-0 text-rose-600" />}
                    {telegramStatus.type === 'idle' && <Settings size={14} className="shrink-0 text-indigo-600 animate-spin" />}
                    <span>{telegramStatus.msg}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleDetectTelegramChatId}
                    disabled={isDetectingTelegram}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200"
                    title="Bot akan mencari Chat ID dari pesanan /start terbaharu"
                  >
                    <RefreshCw size={13} className={isDetectingTelegram ? 'animate-spin' : ''} />
                    Kesan Chat ID Automatik
                  </button>

                  <button
                    onClick={handleTestTelegram}
                    disabled={isTestingTelegram || !telegramChatId}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={13} className={isTestingTelegram ? 'animate-bounce' : ''} />
                    Hantar Ujian
                  </button>
                </div>

                <div className="bg-amber-50/70 border border-amber-100 p-3.5 rounded-xl space-y-2">
                  <p className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">💡 Bagaimana cara mendapatkan Chat ID?</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[10px] leading-relaxed">
                    <li>Hantar mesej bertulis <span className="font-bold text-slate-800">/start</span> ke bot Telegram anda (<a href="https://t.me/TMF2_AduanBot" target="_blank" rel="noreferrer" className="text-indigo-600 font-extrabold hover:underline">@TMF2_AduanBot</a>).</li>
                    <li>Seterusnya, tekan butang <span className="font-bold text-slate-800">Kesan Chat ID Automatik</span> di atas untuk mengesan Chat ID secara langsung.</li>
                    <li>Atau, masukkan ID kumpulan Telegram jika ingin menyalurkan aduan ke dalam group (pastikan bot telah dimasukkan ke group & diberikan akses admin).</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Kelebihan & Faedah Ahli Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Heart size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Setting Kelebihan & Faedah Ahli</h3>
                  <p className="text-[11px] text-slate-500">Urus senarai kelebihan dan manfaat yang dipaparkan dalam modal "Kelebihan & Faedah Ahli".</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                {benefitsConfig.map((item, index) => (
                  <div key={item.id || index} className="p-4 border border-slate-100 rounded-xl bg-slate-50 space-y-3 relative group">
                    <button
                      onClick={() => {
                        const newConfig = benefitsConfig.filter((_, i) => i !== index);
                        setBenefitsConfig(newConfig);
                      }}
                      className="absolute top-3 right-3 p-1.5 bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Padam Kelebihan"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Tajuk Kelebihan</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const newConfig = [...benefitsConfig];
                            newConfig[index].title = e.target.value;
                            setBenefitsConfig(newConfig);
                          }}
                          className="w-full bg-white border border-slate-200 text-slate-800 text-[11px] px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Tema Warna & Ikon (Opsional)</label>
                        <div className="flex gap-2">
                          <select
                            value={item.color}
                            onChange={(e) => {
                              const newConfig = [...benefitsConfig];
                              newConfig[index].color = e.target.value;
                              setBenefitsConfig(newConfig);
                            }}
                            className="flex-1 bg-white border border-slate-200 text-slate-800 text-[11px] px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-rose-500"
                          >
                            <option value="rose">Merah (Rose)</option>
                            <option value="indigo">Biru Gelap (Indigo)</option>
                            <option value="blue">Biru (Blue)</option>
                            <option value="emerald">Hijau (Emerald)</option>
                            <option value="amber">Kuning (Amber)</option>
                            <option value="purple">Ungu (Purple)</option>
                          </select>
                          <select
                            value={item.icon}
                            onChange={(e) => {
                              const newConfig = [...benefitsConfig];
                              newConfig[index].icon = e.target.value;
                              setBenefitsConfig(newConfig);
                            }}
                            className="flex-1 bg-white border border-slate-200 text-slate-800 text-[11px] px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-rose-500"
                          >
                            <option value="Heart">Heart</option>
                            <option value="Users">Users</option>
                            <option value="ShieldCheck">Shield</option>
                            <option value="Check">Check</option>
                            <option value="Award">Award</option>
                            <option value="Gift">Gift</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Keterangan / Deskripsi</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => {
                            const newConfig = [...benefitsConfig];
                            newConfig[index].description = e.target.value;
                            setBenefitsConfig(newConfig);
                          }}
                          rows={2}
                          className="w-full bg-white border border-slate-200 text-slate-800 text-[11px] px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => {
                      setBenefitsConfig([
                        ...benefitsConfig,
                        {
                          id: `item${Date.now()}`,
                          title: 'Kelebihan Baru',
                          description: 'Keterangan kelebihan baru...',
                          icon: 'Award',
                          color: 'indigo'
                        }
                      ]);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    Tambah Kelebihan
                  </button>
                  <button
                    onClick={handleSaveBenefitsConfig}
                    disabled={isSavingBenefits}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-100 transition-all flex items-center gap-1.5"
                  >
                    {isSavingBenefits ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Simpan Kelebihan Ahli
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: MEMBERSHIP APPLICATIONS ----------------- */}
        {activeTab === 'permohonan' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">Senarai Permohonan Keahlian</h2>
                <p className="text-[11px] text-slate-500">Urus dan luluskan borang pendaftaran yang dihantar oleh penduduk.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-xs px-3 py-1 rounded-xl">
                  {appSearchQuery || appPenyewaOnly || appKuiriOnly ? `${filteredApplications.length} daripada ` : ''}{combinedApplications.length} Permohonan Dijumpai{appPenyewaOnly ? ' (Penyewa)' : ''}{appKuiriOnly ? ' (Kuiri)' : ''}
                </span>
                <button
                  onClick={handlePrintDaftarAhli}
                  className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 rounded-xl cursor-pointer transition-all border border-slate-250 flex items-center justify-center shadow-xs"
                  title="Cetak Buku Daftar Ahli (A4 Landscape)"
                >
                  <Printer size={15} />
                </button>
              </div>
            </div>

            {/* Application Search & Quick Sort Filter Row */}
            {combinedApplications.length > 0 && (
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Cari nama pemohon, IC, no telefon, no rumah, no ahli..."
                    value={appSearchQuery}
                    onChange={(e) => setAppSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-24 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
                  />
                  {appSearchQuery && (
                    <button
                      onClick={() => setAppSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                {/* Quick Sort Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                  <span className="text-slate-400 font-bold shrink-0">Pilihan Pantas:</span>
                  <button
                    type="button"
                    onClick={() => setAppSortOption(appSortOption === 'name_asc' ? 'name_desc' : 'name_asc')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      appSortOption.startsWith('name')
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>Nama</span>
                    {appSortOption === 'name_asc' && '↑'}
                    {appSortOption === 'name_desc' && '↓'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppSortOption(appSortOption === 'house_asc' ? 'house_desc' : 'house_asc')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      appSortOption.startsWith('house')
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>No. Rumah</span>
                    {appSortOption === 'house_asc' && '↑'}
                    {appSortOption === 'house_desc' && '↓'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppSortOption(appSortOption === 'member_asc' ? 'member_desc' : 'member_asc')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      appSortOption.startsWith('member')
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>No. Keahlian</span>
                    {appSortOption === 'member_asc' && '↑'}
                    {appSortOption === 'member_desc' && '↓'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppPenyewaOnly(!appPenyewaOnly)}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      appPenyewaOnly
                        ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs ring-1 ring-amber-300 font-extrabold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                    title="Tapis hanya pemohon kategori Penyewa"
                  >
                    <span>Penyewa</span>
                    {appPenyewaOnly && (
                      <span className="text-[8px] bg-amber-200 text-amber-900 px-1 py-0.5 rounded-sm font-black uppercase">
                        Aktif
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppKuiriOnly(!appKuiriOnly)}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      appKuiriOnly
                        ? 'bg-orange-100 text-orange-900 border-orange-300 shadow-xs ring-1 ring-orange-300 font-extrabold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                    title="Tapis hanya permohonan berstatus Kuiri"
                  >
                    <span>Kuiri</span>
                    {appKuiriOnly && (
                      <span className="text-[8px] bg-orange-200 text-orange-900 px-1 py-0.5 rounded-sm font-black uppercase">
                        Aktif
                      </span>
                    )}
                  </button>
                  {(appSortOption !== 'default' || appPenyewaOnly || appKuiriOnly) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAppSortOption('default');
                        setAppPenyewaOnly(false);
                        setAppKuiriOnly(false);
                      }}
                      className="px-2 py-1 text-slate-400 hover:text-slate-600 underline font-semibold cursor-pointer shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}

            {combinedApplications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-12 text-center space-y-2">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                  <FileText size={20} />
                </div>
                <p className="text-xs font-bold text-slate-700">Tiada permohonan keahlian dihantar lagi.</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">Apabila pelawat menghantar borang di bahagian Daftar Ahli, borang akan disenaraikan di sini untuk diluluskan.</p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-12 text-center space-y-2">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                  <Search size={20} />
                </div>
                <p className="text-xs font-bold text-slate-700">Tiada permohonan yang sepadan.</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">Cuba cari nama, no. ahli atau kad pengenalan yang berlainan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredApplications.map((app) => {
                  const applicantUser = allUsers.find(u => u.uid === app.uid);
                  const memberNo = applicantUser?.memberNo;
                  const isExpanded = !!expandedApps[app.id];
                  const effectiveNickname = (app.nickname || applicantUser?.nickname || '').trim();
                  const statusKediamanVal = (applicantUser?.statusKediaman || app.statusKediaman || '').toLowerCase();
                  const isPenyewa = statusKediamanVal.includes('penyewa');

                  return (
                    <div 
                      key={app.id} 
                      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isExpanded 
                          ? 'border-indigo-200 ring-2 ring-indigo-50/50 p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 shadow-sm' 
                          : 'border-slate-150 p-3 sm:p-4 hover:border-slate-200 hover:shadow-sm'
                      }`}
                    >
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div 
                          className="flex items-center gap-3 cursor-pointer select-none flex-1 w-full"
                          onClick={() => toggleAppExpand(app.id)}
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-black text-slate-600 border border-slate-200 uppercase shrink-0">
                            {effectiveNickname ? effectiveNickname.slice(0,2) : (app.name ? app.name.slice(0,2) : 'AH')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <h3 className="font-extrabold text-slate-900 text-sm uppercase truncate">{app.name}</h3>
                              {effectiveNickname ? (
                                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                  Panggilan: {effectiveNickname}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                                  Panggilan: Belum Diisi
                                </span>
                              )}
                              {isPenyewa ? (
                                <span className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                  🔑 PENYEWA
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  🏠 Pemilik
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500 font-mono font-bold">IC: {app.icNumber}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] text-slate-500 font-bold">Rumah: {app.noRumah}</span>
                              {memberNo && (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian') && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">No. Ahli: {memberNo}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 w-full sm:w-auto sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
                          {/* Status Badge */}
                          <div className="shrink-0">
                            {(() => {
                              const statusVal = app.status;
                              let label = (app.reviewedAt && (statusVal === 'Pending' || statusVal === 'Dalam Proses Semakan')) ? 'Semakan Semula' : 'Dalam Proses Semakan';
                              let bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
                              let icon = <Clock size={11} className="shrink-0" />;

                              if (statusVal === 'Diluluskan' || statusVal === 'Diluluskan Keahlian') {
                                label = 'Diluluskan';
                                bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                icon = <Check size={11} className="shrink-0" />;
                              } else if (statusVal === 'Kuiri' || statusVal === 'Kuiri Permohonan') {
                                label = 'Kuiri Permohonan';
                                bgClass = 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold';
                                icon = <AlertCircle size={11} className="text-amber-700 shrink-0" />;
                              } else if (statusVal === 'Rejected' || statusVal === 'Ditolak' || statusVal === 'Ditolak Keahlian') {
                                label = 'Ditolak';
                                bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
                                icon = <X size={11} className="shrink-0" />;
                              } else if (statusVal === 'Dilucutkan Keahlian' || statusVal === 'Dinyahaktifkan Keahlian') {
                                label = statusVal;
                                bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
                                icon = <X size={11} className="shrink-0" />;
                              }

                              return (
                                <span className={`${bgClass} font-extrabold text-[9px] sm:text-[10px] uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg flex items-center gap-1 border shrink-0`}>
                                  {icon} {label}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Action Icon Buttons & Accordion Chevron */}
                          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto sm:ml-0 flex-wrap">
                            {/* WhatsApp Button with Templates */}
                            {app.phone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleKuiriClick(app);
                                }}
                                className="p-1 sm:p-1.5 bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 rounded-lg cursor-pointer transition-colors border border-green-200 flex items-center justify-center shrink-0"
                                title="Hantar Template WhatsApp & Kuiri"
                              >
                                <MessageCircle size={13} className="sm:w-3.5 sm:h-3.5" />
                              </button>
                            )}

                            {/* View Profile Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetMember = {
                                  ...(applicantUser || {}),
                                  uid: app.uid || applicantUser?.uid,
                                  name: app.name || applicantUser?.displayName || 'Ahli',
                                  displayName: applicantUser?.displayName || app.name || 'Ahli',
                                  nickname: app.nickname || applicantUser?.nickname || '',
                                  email: app.email || applicantUser?.email || '',
                                  phone: app.phone || applicantUser?.phoneNumber || '',
                                  phoneNumber: app.phone || applicantUser?.phoneNumber || '',
                                  address: app.address || applicantUser?.address || '',
                                  noRumah: app.noRumah || applicantUser?.noRumah || '',
                                  icNumber: app.icNumber || applicantUser?.icNumber || '',
                                  statusKediaman: app.statusKediaman || applicantUser?.statusKediaman || '',
                                  role: applicantUser?.role || 'Ahli Biasa',
                                  memberNo: app.memberNo || applicantUser?.memberNo || '',
                                  avatar: applicantUser?.uploadedProfileImageUrl || applicantUser?.photoURL || applicantUser?.googleProfileImageUrl,
                                  photoURL: applicantUser?.uploadedProfileImageUrl || applicantUser?.photoURL || applicantUser?.googleProfileImageUrl,
                                  cover: applicantUser?.uploadedCoverImageUrl || applicantUser?.coverURL,
                                };
                                const viewProfileEvent = new CustomEvent('tmf2_view_profile', { detail: targetMember });
                                window.dispatchEvent(viewProfileEvent);
                              }}
                              className="p-1 sm:p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg cursor-pointer transition-colors border border-blue-200 flex items-center justify-center shrink-0"
                              title="Lihat Profil Ahli"
                            >
                              <ExternalLink size={13} className="sm:w-3.5 sm:h-3.5" />
                            </button>

                            {/* Member Card PDF Button */}
                            {(app.status === 'Approved' || app.status === 'Diluluskan' || app.memberNo || applicantUser?.memberNo) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadMemberCard(app, applicantUser, 'pdf');
                                }}
                                disabled={downloadingAppId === app.id}
                                className="p-1 sm:p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg cursor-pointer transition-colors border border-emerald-200 flex items-center justify-center disabled:opacity-50 shrink-0"
                                title="Muat Turun Sijil & Kad Keahlian Rasmi (PDF A4)"
                              >
                                {downloadingAppId === app.id ? <Loader2 size={13} className="animate-spin sm:w-3.5 sm:h-3.5" /> : <CreditCard size={13} className="sm:w-3.5 sm:h-3.5" />}
                              </button>
                            )}

                            {/* Send Approval Email Button */}
                            {(app.status === 'Approved' || app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian' || memberNo) && (app.email || applicantUser?.email) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendApprovalEmail(app, applicantUser);
                                }}
                                disabled={sendingEmailAppId === app.id}
                                className="p-1 sm:p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer transition-colors border border-indigo-200 flex items-center justify-center disabled:opacity-50 shrink-0"
                                title={`Hantar / Hantar Semula Emel Kelulusan Rasmi ke ${app.email || applicantUser?.email}`}
                              >
                                {sendingEmailAppId === app.id ? <Loader2 size={13} className="animate-spin sm:w-3.5 sm:h-3.5" /> : <Mail size={13} className="sm:w-3.5 sm:h-3.5" />}
                              </button>
                            )}

                            {/* Edit Status Button */}
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStatusEditApp(app);
                                  const currentStatusMapped = app.status === 'Pending' ? 'Dalam Proses Semakan' :
                                                              app.status === 'Diluluskan' ? 'Diluluskan Keahlian' :
                                                              app.status === 'Rejected' ? 'Ditolak Keahlian' : app.status;
                                  setSelectedStatus(currentStatusMapped);
                                  setSelectedType(applicantUser?.membershipType || 'Ahli Biasa');
                                }}
                                className="p-1 sm:p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors border border-slate-200 shrink-0"
                                title="Kemaskini Status Keahlian"
                              >
                                <Edit size={13} className="sm:w-3.5 sm:h-3.5" />
                              </button>
                            )}

                            {/* Expand / Collapse Chevron Button */}
                            <button
                              onClick={() => toggleAppExpand(app.id)}
                              className="p-1 sm:p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors shrink-0"
                              title={isExpanded ? 'Tutup Maklumat' : 'Buka Maklumat'}
                            >
                              {isExpanded ? <ChevronUp size={15} className="sm:w-4 sm:h-4" /> : <ChevronDown size={15} className="sm:w-4 sm:h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Nama Panggilan</span>
                              {effectiveNickname ? (
                                <p className="font-extrabold text-indigo-900 text-xs mt-0.5">
                                  <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg">
                                    {effectiveNickname}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-slate-400 font-bold text-xs italic bg-slate-50 border border-slate-200/70 px-2.5 py-1 rounded-lg inline-block">
                                  Belum Diisi
                                </p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">No. Telefon & Emel</span>
                              <p className="font-bold text-slate-800">{app.phone || '-'}</p>
                              <p className="text-slate-500 font-semibold truncate">{app.email || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Alamat Penuh</span>
                              <p className="font-semibold text-slate-700 leading-tight">{app.address}, {app.poskod}, {app.bandar}, {app.negeri}</p>
                            </div>
                            {(() => {
                              const statusKediamanVal = applicantUser?.statusKediaman || app.statusKediaman || '';
                              const isPenyewa = statusKediamanVal.toLowerCase().includes('penyewa');
                              const familyMembers = (applicantUser?.senaraiAhliKeluarga && Array.isArray(applicantUser.senaraiAhliKeluarga) && applicantUser.senaraiAhliKeluarga.length > 0)
                                ? applicantUser.senaraiAhliKeluarga
                                : (app.senaraiAhliKeluarga && Array.isArray(app.senaraiAhliKeluarga) && app.senaraiAhliKeluarga.length > 0)
                                  ? app.senaraiAhliKeluarga
                                  : [];
                              const displayIsiRumah = applicantUser?.bilanganIsiRumah || app.bilanganIsiRumah || (familyMembers.length > 0 ? familyMembers.length + 1 : 1);
                              const displayTanggungan = applicantUser?.bilanganTanggungan ?? app.bilanganTanggungan ?? familyMembers.length;

                              return (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kediaman & Isi Rumah</span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-slate-500 font-bold text-xs">Status:</span>
                                    {isPenyewa ? (
                                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                                        🔑 Penyewa
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                                        🏠 Pemilik (Sendiri)
                                      </span>
                                    )}
                                  </div>
                                  {isPenyewa && (
                                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2 text-[11px] text-amber-900 font-semibold space-y-0.5 mt-1">
                                      <p>Pemilik Rumah: <span className="font-bold">{applicantUser?.namaPemilikRumah || app.namaPemilikRumah || '-'}</span></p>
                                      <p>No. Tel Pemilik: <span className="font-bold">{applicantUser?.noTelPemilikRumah || app.noTelPemilikRumah || '-'}</span></p>
                                    </div>
                                  )}
                                  <p className="text-slate-500 font-semibold">Isi Rumah: <span className="font-bold text-slate-800">{displayIsiRumah} Orang</span></p>
                                  <p className="text-slate-500 font-semibold">Tanggungan Sekolah/IPTA: <span className="font-bold text-slate-800">{displayTanggungan} Orang</span></p>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Family members display or unentered notice */}
                          {(() => {
                            const familyMembers = (applicantUser?.senaraiAhliKeluarga && Array.isArray(applicantUser.senaraiAhliKeluarga) && applicantUser.senaraiAhliKeluarga.length > 0)
                              ? applicantUser.senaraiAhliKeluarga
                              : (app.senaraiAhliKeluarga && Array.isArray(app.senaraiAhliKeluarga) && app.senaraiAhliKeluarga.length > 0)
                                ? app.senaraiAhliKeluarga
                                : [];

                            if (familyMembers.length > 0) {
                              return (
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">
                                      Ahli Keluarga Tinggal Serumah
                                    </span>
                                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                      {familyMembers.length} Orang
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {familyMembers.map((member, i) => {
                                      let subYear = 2026;
                                      if (app.submittedAt) {
                                        if ((app.submittedAt as any).seconds) {
                                          subYear = new Date((app.submittedAt as any).seconds * 1000).getFullYear();
                                        } else {
                                          const d = new Date(app.submittedAt as any);
                                          if (!isNaN(d.getTime())) {
                                            subYear = d.getFullYear();
                                          }
                                        }
                                      }
                                      const baseYear = member.baseYear || subYear;
                                      return (
                                        <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] flex justify-between items-center shadow-2xs">
                                          <span className="font-bold text-slate-800 uppercase">{member.nama}</span>
                                          <span className="text-slate-500 font-semibold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                                            {member.hubungan} ({getDynamicAge(member.umur, baseYear)} Thn)
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div 
                                className="bg-amber-50/70 p-3.5 rounded-xl border border-dashed border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                                title="Ahli Keluarga Tinggal Serumuh Belum Diisi"
                                aria-label="Ahli Keluarga Tinggal Serumuh Belum Diisi"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                                    <Users size={16} />
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block">
                                      Ahli Keluarga Tinggal Serumah
                                    </span>
                                    <p className="font-extrabold text-amber-950 text-xs mt-0.5">
                                      Ahli Keluarga Tinggal Serumah Belum Diisi
                                      <span className="sr-only">Ahli Keluarga Tinggal Serumuh Belum Diisi</span>
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100/90 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300 self-start sm:self-auto">
                                  Belum Diisi
                                </span>
                              </div>
                            );
                          })()}

                          {(app.reviewedAt || app.remarks) && (
                            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-800 space-y-1 font-medium">
                              {app.reviewedBy && <p>Disemak oleh: <span className="font-bold">{app.reviewedBy}</span> pada {formatTimestamp(app.reviewedAt)}</p>}
                              {app.remarks && <p>Catatan / Sebab: <span className="italic font-bold">"{app.remarks}"</span></p>}
                            </div>
                          )}

                          {(app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian' || app.status === 'Approved') && (
                            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-100 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                              <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                                <Check size={14} className="text-emerald-600 shrink-0" />
                                <span>Keahlian telah diluluskan rasmi. {(app.email || applicantUser?.email) ? `(Emel: ${app.email || applicantUser?.email})` : '(Tiada emel)'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {(app.email || applicantUser?.email) && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendApprovalEmail(app, applicantUser)}
                                    disabled={sendingEmailAppId === app.id}
                                    className="px-3.5 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                                    title="Hantar / Hantar Semula Notis Emel Kelulusan Rasmi kepada ahli"
                                  >
                                    {sendingEmailAppId === app.id ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                                    <span>{sendingEmailAppId === app.id ? 'Menghantar Emel...' : 'Hantar Semula Emel Kelulusan'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {(app.status === 'Pending' || app.status === 'Kuiri') && (
                            <div className="flex flex-wrap justify-end items-center gap-2 pt-2 border-t border-slate-100">
                              {canEdit ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleKuiriClick(app)}
                                    className="px-4 py-2 bg-amber-50 text-amber-900 text-xs font-black rounded-lg border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs hover:scale-[1.01]"
                                    title="Pilih butang KUIRI untuk maklumkan pemohon item pendaftaran yang masih gagal melalui WhatsApp dan benarkan pemohon kemaskini borang"
                                  >
                                    <HelpCircle size={14} className="text-amber-700" />
                                    Kuiri
                                  </button>
                                  <button
                                    onClick={() => handleRejectClick(app)}
                                    className="px-4 py-2 bg-white text-rose-600 text-xs font-bold rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    Tolak Permohonan
                                  </button>
                                  <button
                                    onClick={() => handleApproveClick(app)}
                                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                                  >
                                    Sahkan & Luluskan
                                  </button>
                                </>
                              ) : (
                                <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg">
                                  Akses Kelulusan Terhad
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 3: USER MANAGEMENT & ROLES ----------------- */}
        {activeTab === 'pengguna' && !isPermohonanOnlyRole && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">Pengurusan Profil Pengguna & Hak Akses</h2>
                <p className="text-[11px] text-slate-500">Senarai semua pengguna berdaftar Google. Tapis mengikut role, status keahlian, dan kemaskini hak sistem.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {canEdit && (
                  <button
                    onClick={handleResequenceClick}
                    className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                    title="Susun semula semua nombor ahli berdaftar mengikut turutan PTMF2-2026-0001, PTMF2-2026-0002..."
                  >
                    <RefreshCw size={13} className="text-indigo-600" />
                    Susun Semula No. Ahli
                  </button>
                )}
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-xs px-3 py-1.5 rounded-xl block shrink-0">
                  {filteredUsers.length} Pengguna Terpilih
                </span>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-150/80 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                {/* Search query input */}
                <div className="flex-1 relative">
                  <Search size={16} className="text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Cari nama, email, IC, no rumah..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                
                {/* Reset button if filter is active */}
                {(roleFilter || membershipTypeFilter || membershipStatusFilter || statusKediamanFilter || searchQuery) && (
                  <button
                    onClick={() => {
                      setRoleFilter('');
                      setMembershipTypeFilter('');
                      setMembershipStatusFilter('');
                      setStatusKediamanFilter('');
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-350 text-xs font-bold text-slate-500 cursor-pointer transition-colors bg-white hover:bg-slate-50"
                  >
                    Reset Tapisan
                  </button>
                )}
              </div>

              {/* Advanced select filters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Role Sistem</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Semua Role</option>
                    {['ADMIN UTAMA', 'GURU', 'MURID', 'IBU BAPA', 'TETAMU', 'Pengerusi', 'Setiausaha', 'Bendahari', 'Ahli Jawatankuasa', 'Ahli Biasa'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Jenis Keahlian</label>
                  <select
                    value={membershipTypeFilter}
                    onChange={(e) => { setMembershipTypeFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Semua Jenis</option>
                    {['Tiada', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status Keahlian</label>
                  <select
                    value={membershipStatusFilter}
                    onChange={(e) => { setMembershipStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Semua Status</option>
                    {['Belum Berdaftar', 'Menunggu Kelulusan', 'Aktif', 'Digantung', 'Ditolak', 'Tamat'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status Kediaman</label>
                  <select
                    value={statusKediamanFilter}
                    onChange={(e) => { setStatusKediamanFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Semua Kediaman</option>
                    <option value="Pemilik">Pemilik (Sendiri)</option>
                    <option value="Penyewa">Penyewa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modern Data Table */}
            <div className="bg-white rounded-2xl border border-slate-150/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">
                      <th className="p-4">Foto / Nama Penuh</th>
                      <th className="p-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('noRumah')}>
                        No Rumah <ArrowUpDown size={10} className="inline ml-1" />
                      </th>
                      <th className="p-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('icNumber')}>
                        No IC <ArrowUpDown size={10} className="inline ml-1" />
                      </th>
                      <th className="p-4">No Telefon</th>
                      <th className="p-4">Status Kediaman</th>
                      <th className="p-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('membershipType')}>
                        Jenis / Status Keahlian <ArrowUpDown size={10} className="inline ml-1" />
                      </th>
                      <th className="p-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('role')}>
                        Role Sistem <ArrowUpDown size={10} className="inline ml-1" />
                      </th>
                      <th className="p-4">Login Terakhir</th>
                      <th className="p-4 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 italic font-medium">Tiada pengguna ditemui padanan tapisan.</td>
                      </tr>
                    ) : (
                      paginatedUsers.map((user) => (
                        <tr key={user.uid} className="hover:bg-slate-50/50 font-bold transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={user.uploadedProfileImageUrl || user.photoURL || user.googleProfileImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"} 
                                alt={user.displayName || 'Photo'}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200/60"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <p className="text-slate-900 uppercase leading-tight font-extrabold">{user.displayName || 'Pengguna Tanpa Nama'}</p>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{user.email || 'Tiada e-mel'}</p>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {user.nickname && <span className="inline-block bg-indigo-50 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">Gelar: {user.nickname}</span>}
                                  <div 
                                    onClick={(e) => handleCopyUid(user.uid, e)}
                                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-slate-600 hover:text-indigo-900 cursor-pointer"
                                    title="Klik untuk salin UID Firebase"
                                  >
                                    <Fingerprint size={9} className="text-indigo-600 shrink-0" />
                                    <span>UID: {user.uid ? (user.uid.length > 10 ? `${user.uid.slice(0, 6)}...${user.uid.slice(-4)}` : user.uid) : '-'}</span>
                                    <Copy size={8} className="text-slate-400" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-700">{user.noRumah || <span className="text-slate-350">-</span>}</td>
                          <td className="p-4 text-slate-700 font-mono text-[10px]">{user.icNumber || <span className="text-slate-350">-</span>}</td>
                          <td className="p-4 text-slate-700 font-semibold">{user.phoneNumber || <span className="text-slate-350">-</span>}</td>
                          <td className="p-4">
                            {(() => {
                              const matchedApp = allApplications.find(a => a.uid === user.uid || (user.email && a.email && a.email.toLowerCase() === user.email.toLowerCase()) || (user.icNumber && a.icNumber && a.icNumber === user.icNumber));
                              const statusVal = user.statusKediaman || matchedApp?.statusKediaman;
                              if (!statusVal) return <span className="text-slate-350">-</span>;
                              const isPenyewa = statusVal.toLowerCase().includes('penyewa');
                              return (
                                <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-black ${isPenyewa ? 'bg-amber-50 text-amber-700 border border-amber-150' : 'bg-teal-50 text-teal-700 border border-teal-150'}`}>
                                  {isPenyewa ? 'Penyewa' : 'Pemilik'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] uppercase font-black whitespace-nowrap ${user.membershipType !== 'Tiada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-slate-100 text-slate-500'}`}>
                                  {user.membershipType}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[7.5px] uppercase font-black whitespace-nowrap ${
                                  user.membershipStatus === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                                  user.membershipStatus === 'Menunggu Kelulusan' ? 'bg-amber-50 text-amber-700 border border-amber-150' :
                                  user.membershipStatus === 'Digantung' ? 'bg-rose-50 text-rose-700 border border-rose-150' :
                                  'bg-slate-100 text-slate-400'
                                }`}>
                                  {user.membershipStatus}
                                </span>
                              </div>
                              {/* Status Lantikan Indicator */}
                              {(user.approvalStatus === 'Approved' && user.membershipStatus === 'Aktif') ? (
                                <span className="text-[7.5px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100 uppercase">
                                  ✓ Ahli Dilantik {user.memberNo ? `(${user.memberNo})` : ''}
                                </span>
                              ) : (
                                <span className="text-[7.5px] font-black text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-100 uppercase">
                                  ⏳ Belum Dilantik Ahli
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {(() => {
                              const r = (user.role || 'TETAMU').toUpperCase();
                              if (r === 'ADMIN UTAMA' || user.isSuperAdmin) {
                                return (
                                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md text-[8.5px] uppercase font-black whitespace-nowrap inline-flex items-center gap-1 shadow-2xs">
                                    <Shield size={10} className="text-indigo-600" /> ADMIN UTAMA
                                  </span>
                                );
                              }
                              if (r === 'GURU') {
                                return (
                                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md text-[8.5px] uppercase font-black whitespace-nowrap inline-flex items-center gap-1">
                                    🎓 GURU
                                  </span>
                                );
                              }
                              if (r === 'MURID') {
                                return (
                                  <span className="bg-sky-50 border border-sky-200 text-sky-700 px-2 py-0.5 rounded-md text-[8.5px] uppercase font-black whitespace-nowrap inline-flex items-center gap-1">
                                    🎒 MURID
                                  </span>
                                );
                              }
                              if (r === 'IBU BAPA') {
                                return (
                                  <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md text-[8.5px] uppercase font-black whitespace-nowrap inline-flex items-center gap-1">
                                    👨‍👩‍👦 IBU BAPA
                                  </span>
                                );
                              }
                              if (r === 'TETAMU' || r === 'PELAWAT') {
                                return (
                                  <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-[8.5px] uppercase font-black whitespace-nowrap inline-flex items-center gap-1">
                                    👤 TETAMU
                                  </span>
                                );
                              }
                              return (
                                <span className="bg-slate-100 border text-slate-700 px-1.5 py-0.5 rounded-md text-[8px] uppercase font-black whitespace-nowrap">
                                  {user.role}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-4 text-slate-500 font-medium whitespace-nowrap">{formatTimestamp(user.lastLoginAt)}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {/* WhatsApp Button */}
                              {user.phoneNumber && (
                                <a
                                  href={`https://wa.me/${user.phoneNumber.replace(/\\D/g, '').startsWith('0') ? '6' + user.phoneNumber.replace(/\\D/g, '') : user.phoneNumber.replace(/\\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer transition-colors"
                                  title="Hubungi melalui WhatsApp"
                                >
                                  <MessageCircle size={14} />
                                </a>
                              )}
                              {/* User Profile Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const viewProfileEvent = new CustomEvent('tmf2_view_profile', { detail: user });
                                  window.dispatchEvent(viewProfileEvent);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                title="Lihat Profil Ahli"
                              >
                                <ExternalLink size={14} />
                              </button>
                              {/* Change Role Button (Super Admin only, unless modifying self) */}
                              {isSuperAdmin && !user.isSuperAdmin && (
                                <button
                                  onClick={() => handleRoleChangeClick(user)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                                  title="Tukar Role"
                                >
                                  <Edit size={14} />
                                </button>
                              )}
                              {/* Delete Button (Admin Utama or Setiausaha, cannot delete super admins) */}
                              {canEdit && !user.isSuperAdmin && (
                                <button
                                  onClick={() => handleDeleteClick(user)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Padam Pengguna"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              {user.isSuperAdmin && (
                                <span className="text-[10px] text-amber-600 font-extrabold italic bg-amber-50 px-2 py-0.5 rounded border border-amber-150 uppercase flex items-center gap-1">
                                  <Shield size={10} /> Kebal
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="bg-slate-50 border-t border-slate-150 px-4 py-3 flex justify-between items-center text-slate-500 font-bold">
                <span className="text-[11px]">Halaman {currentPage} daripada {totalPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={`p-1.5 rounded-lg border cursor-pointer transition-all ${currentPage === 1 ? 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed' : 'border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-600'}`}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={`p-1.5 rounded-lg border cursor-pointer transition-all ${currentPage === totalPages ? 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed' : 'border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-600'}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB: LOGIN LOGS (REKOD LOG MASUK PENGGUNA) ----------------- */}
        {activeTab === 'login_logs' && !isPermohonanOnlyRole && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Header & Print/Export */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <LogIn size={18} className="text-indigo-600" />
                  Rekod Log Masuk Pengguna & UID Tetap Firebase
                </h2>
                <p className="text-[11px] text-slate-500">
                  Simpanan log bagi setiap pengguna yang log masuk ke dalam portal, sama ada sudah dilantik ahli atau belum dilantik, bersama UID unik Firebase yang kekal bagi setiap emel.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-xs px-3 py-1 rounded-xl">
                  {filteredLoginLogs.length} Rekod Log
                </span>
                <button
                  onClick={handlePrintLoginLogs}
                  className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 rounded-xl cursor-pointer transition-all border border-slate-200 flex items-center justify-center shadow-xs"
                  title="Cetak Senarai Log Masuk (A4 Landscape)"
                >
                  <Printer size={15} />
                </button>
              </div>
            </div>

            {/* Quick Stats Bento Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jumlah Log Sesi</span>
                <span className="text-2xl sm:text-3xl font-black text-indigo-950 mt-1">{loginStats.total}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-0.5">Semua rekod log masuk</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pengguna / UID Unik</span>
                <span className="text-2xl sm:text-3xl font-black text-indigo-600 mt-1">{loginStats.uniqueUids}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-0.5">Emel & UID tetap berbeza</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ahli Dilantik</span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{loginStats.appointedCount}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-0.5">Ahli Biasa/AJK/Admin</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Belum Dilantik</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">{loginStats.notAppointedCount}</span>
                <p className="text-[9px] text-slate-500 font-medium mt-0.5">Pelawat / Menunggu Kelulusan</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-150/80 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search size={16} className="text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Cari nama pengguna, emel Google, UID Firebase, no. rumah, no. telefon..."
                    value={loginSearchQuery}
                    onChange={(e) => { setLoginSearchQuery(e.target.value); setLoginCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-xl pl-10 pr-24 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  {loginSearchQuery && (
                    <button
                      onClick={() => setLoginSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-wider cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                {(loginStatusFilter !== 'all' || loginRoleFilter || loginSearchQuery) && (
                  <button
                    onClick={() => {
                      setLoginStatusFilter('all');
                      setLoginRoleFilter('');
                      setLoginSearchQuery('');
                      setLoginCurrentPage(1);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-350 text-xs font-bold text-slate-500 cursor-pointer transition-colors bg-white hover:bg-slate-50"
                  >
                    Reset Tapisan
                  </button>
                )}
              </div>

              {/* Status & Role Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status Lantikan Ahli</label>
                  <select
                    value={loginStatusFilter}
                    onChange={(e) => { setLoginStatusFilter(e.target.value as any); setLoginCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="all">Semua Pengguna (Dilantik & Belum Dilantik)</option>
                    <option value="appointed">🟢 Ahli Sudah Dilantik Sahaja</option>
                    <option value="not_appointed">🟠 Belum Dilantik Ahli (Pelawat / Menunggu)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Role Sistem Pengguna</label>
                  <select
                    value={loginRoleFilter}
                    onChange={(e) => { setLoginRoleFilter(e.target.value); setLoginCurrentPage(1); }}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-slate-700"
                  >
                    <option value="">Semua Role</option>
                    {['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Ahli Jawatankuasa', 'Ahli Kehormat', 'Ahli Biasa', 'Ahli Bersekutu', 'Juru Audit', 'Pelawat'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Login Logs Table */}
            <div className="bg-white rounded-2xl border border-slate-150/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">
                      <th className="p-4">Pengguna / Emel</th>
                      <th className="p-4">UID Firebase (Tetap)</th>
                      <th className="p-4 text-center">Status Keahlian</th>
                      <th className="p-4 text-center">Role</th>
                      <th className="p-4 text-center">No. Rumah</th>
                      <th className="p-4">Waktu Log Masuk</th>
                      <th className="p-4 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedLoginLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400 italic font-medium">
                          <History size={24} className="mx-auto mb-2 text-slate-300" />
                          Tiada rekod log masuk dijumpai dengan tapisan semasa.
                        </td>
                      </tr>
                    ) : (
                      paginatedLoginLogs.map((log) => {
                        const matchingUser = allUsers.find(u => u.uid === log.uid);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 font-bold transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={log.photoURL || matchingUser?.uploadedProfileImageUrl || matchingUser?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                                  alt={log.displayName || 'Avatar'}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200/60 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0">
                                  <p className="text-slate-900 uppercase leading-tight font-extrabold truncate max-w-[160px] sm:max-w-[200px]">
                                    {log.displayName || 'Pengguna Google'}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate max-w-[160px] sm:max-w-[200px]">
                                    {log.email || 'Tiada e-mel'}
                                  </p>
                                  {log.memberNo && (
                                    <span className="inline-block bg-emerald-50 text-emerald-700 text-[8px] font-black px-1.5 py-0.2 rounded mt-0.5">
                                      No Ahli: {log.memberNo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div 
                                onClick={(e) => handleCopyUid(log.uid, e)}
                                className="group inline-flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                                title="Klik untuk salin UID Firebase"
                              >
                                <Fingerprint size={12} className="text-indigo-600 shrink-0" />
                                <span className="font-mono text-[10px] text-slate-700 group-hover:text-indigo-900 font-bold">
                                  {log.uid ? (log.uid.length > 12 ? `${log.uid.slice(0, 8)}...${log.uid.slice(-4)}` : log.uid) : '-'}
                                </span>
                                <Copy size={10} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              {log.isAppointedMember ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] uppercase font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Ahli Dilantik ({log.membershipStatus || 'Aktif'})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] uppercase font-black bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Belum Dilantik ({log.role === 'Pelawat' ? 'Pelawat' : 'Menunggu'})
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <span className="bg-slate-100 border text-slate-700 px-2 py-0.5 rounded-md text-[8.5px] uppercase font-black whitespace-nowrap">
                                {log.role || 'Pelawat'}
                              </span>
                            </td>
                            <td className="p-4 text-center text-slate-700 font-bold">
                              {log.noRumah || matchingUser?.noRumah || <span className="text-slate-350">-</span>}
                            </td>
                            <td className="p-4">
                              <div className="space-y-0.5">
                                <p className="text-slate-700 text-[11px] font-semibold whitespace-nowrap">
                                  {formatTimestamp(log.timestamp)}
                                </p>
                                <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded uppercase font-extrabold">
                                  {log.loginMethod || 'Google Sign-In'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={(e) => handleCopyUid(log.uid, e)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                                  title="Salin UID Tetap"
                                >
                                  <Copy size={13} />
                                </button>
                                {(log.phoneNumber || matchingUser?.phoneNumber) && (
                                  <a
                                    href={`https://wa.me/${(log.phoneNumber || matchingUser?.phoneNumber || '').replace(/\D/g, '').startsWith('0') ? '6' + (log.phoneNumber || matchingUser?.phoneNumber || '').replace(/\D/g, '') : (log.phoneNumber || matchingUser?.phoneNumber || '').replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer transition-colors"
                                    title="Hubungi melalui WhatsApp"
                                  >
                                    <MessageCircle size={13} />
                                  </a>
                                )}
                                {matchingUser && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const viewProfileEvent = new CustomEvent('tmf2_view_profile', { detail: matchingUser });
                                      window.dispatchEvent(viewProfileEvent);
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                    title="Lihat Profil Ahli"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Login Logs Pagination */}
              <div className="bg-slate-50 border-t border-slate-150 px-4 py-3 flex justify-between items-center text-slate-500 font-bold">
                <span className="text-[11px]">Halaman {loginCurrentPage} daripada {totalLoginPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={loginCurrentPage === 1}
                    onClick={() => setLoginCurrentPage(prev => Math.max(1, prev - 1))}
                    className={`p-1.5 rounded-lg border cursor-pointer transition-all ${loginCurrentPage === 1 ? 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed' : 'border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-600'}`}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={loginCurrentPage === totalLoginPages}
                    onClick={() => setLoginCurrentPage(prev => Math.min(totalLoginPages, prev + 1))}
                    className={`p-1.5 rounded-lg border cursor-pointer transition-all ${loginCurrentPage === totalLoginPages ? 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed' : 'border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-600'}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 4: AUDIT LOGS ----------------- */}
        {activeTab === 'audit_logs' && !isPermohonanOnlyRole && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">Rekod Audit Log Sistem & Perubahan Role</h2>
                <p className="text-[11px] text-slate-500">Log tindakan penting yang dilakukan oleh pentadbir atau perubahan automatik dari sistem.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: General System Audit Logs */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-3 shadow-xs">
                <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2 mb-1">
                  <FileText size={14} className="text-indigo-600" />
                  Audit Log Tindakan ({auditLogs.length})
                </h3>

                <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                  {auditLogs.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-6">Tiada audit log sistem dijumpai.</p>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="bg-slate-55 p-3 rounded-xl border border-slate-100 flex justify-between items-start text-[11px] font-semibold">
                        <div className="space-y-0.5">
                          <span className="bg-indigo-50 border text-indigo-700 px-1.5 py-0.5 rounded text-[8px] uppercase font-black">{log.action}</span>
                          <p className="text-slate-800 mt-1 font-bold leading-tight">{log.description}</p>
                          <p className="text-slate-450 text-[10px] mt-0.5 font-medium">Oleh: <span className="font-bold text-slate-600">{log.performedBy}</span></p>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium shrink-0 ml-2">{formatTimestamp(log.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Roles Log Audit */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-3 shadow-xs">
                <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2 mb-1">
                  <Shield size={14} className="text-amber-600" />
                  Audit Log Perubahan Role ({roleLogs.length})
                </h3>

                <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                  {roleLogs.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-6">Tiada pertukaran role direkodkan lagi.</p>
                  ) : (
                    roleLogs.map((log) => (
                      <div key={log.id} className="bg-amber-50/30 p-3 rounded-xl border border-amber-100 flex flex-col gap-1.5 text-[11px] font-semibold">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-slate-900 font-extrabold uppercase leading-none">{log.userName}</p>
                            <div className="flex items-center gap-1 mt-1 text-[9px] font-black">
                              <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded">{log.oldRole}</span>
                              <span>➔</span>
                              <span className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded">{log.newRole}</span>
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium">{formatTimestamp(log.timestamp)}</span>
                        </div>
                        
                        <div className="bg-white/80 p-2 rounded-lg border border-amber-50 text-[10px] text-slate-600 space-y-0.5 font-medium leading-relaxed">
                          <p>Pengubah: <span className="font-bold text-slate-800">{log.changedBy}</span></p>
                          <p>Sebab: <span className="font-bold text-slate-800 italic">"{log.reason}"</span></p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ----------------- DIALOG BOXES & POPUPS ----------------- */}

      {/* Confirmation & Choice Dialog Box */}
      {confirmDialog && confirmDialog.show && (
        <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-100 shadow-xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                confirmDialog.actionType === 'delete' ? 'bg-rose-50 text-rose-600' :
                confirmDialog.actionType === 'approve' ? 'bg-emerald-50 text-emerald-600' :
                'bg-indigo-50 text-indigo-600'
              }`}>
                {confirmDialog.actionType === 'delete' ? <Trash2 size={20} /> : <Award size={20} />}
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="font-black text-slate-900 text-sm">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>

            {/* Approve Extra UI */}
            {confirmDialog.actionType === 'approve' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pilih Jenis Keahlian:</label>
                <select
                  value={selectedAppType}
                  onChange={(e) => setSelectedAppType(e.target.value)}
                  className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="Ahli Biasa">Ahli Biasa : (Pemilik / Penyewa)</option>
                  <option value="Ahli Bersekutu">Ahli Bersekutu : (Ahli Akademik/NGO/Ahli Kelab Persatuan)</option>
                  <option value="Ahli Kehormat">Ahli Kehormat : (Tokoh/Penasihat)</option>
                </select>
              </div>
            )}

            {/* Reject Extra UI */}
            {confirmDialog.actionType === 'reject' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sebab Penolakan (Wajib):</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: No Kad Pengenalan tidak tepat atau tidak menetap di fasa ini."
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 focus:outline-hidden resize-none"
                />
              </div>
            )}

            {/* Role Extra UI */}
            {confirmDialog.actionType === 'role' && (
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pilih Role Baharu:</label>
                  <select
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden"
                  >
                    {['ADMIN UTAMA', 'GURU', 'MURID', 'IBU BAPA', 'TETAMU', 'Pengerusi', 'Setiausaha', 'Bendahari', 'Ahli Jawatankuasa', 'Ahli Biasa'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sebab Perubahan (Wajib):</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dilantik sebagai Setiausaha dalam MAT 2026."
                    value={roleReasonInput}
                    onChange={(e) => setRoleReasonInput(e.target.value)}
                    className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-black text-slate-500 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDialogAction}
                disabled={isProcessingAction}
                className={`px-4 py-2 rounded-xl text-xs font-black text-white cursor-pointer transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmDialog.actionType === 'delete' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' :
                  confirmDialog.actionType === 'reject' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' :
                  'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {isProcessingAction && <Loader2 className="animate-spin" size={14} />}
                <span>
                  {isProcessingAction 
                    ? (confirmDialog.actionType === 'role' ? 'Mengemaskini Role...' : confirmDialog.actionType === 'delete' ? 'Memadam...' : confirmDialog.actionType === 'approve' ? 'Meluluskan...' : 'Memproses...') 
                    : 'Sahkan Tindakan'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Custom Status Edit Modal */}
      {statusEditApp && (
        <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Edit size={16} className="text-indigo-600" />
                Kemaskini Status Keahlian
              </h3>
              <button 
                onClick={() => setStatusEditApp(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                disabled={isSavingStatus}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600 font-semibold">
                <p className="uppercase font-extrabold text-slate-800 text-[10px] tracking-wider mb-1">Butiran Pemohon</p>
                <p>Nama: <span className="font-bold text-indigo-950 uppercase">{statusEditApp.name}</span></p>
                <p>Kad Pengenalan: <span className="font-bold">{statusEditApp.icNumber}</span></p>
                <p>Status Semasa: <span className="font-bold text-indigo-700 uppercase">{statusEditApp.status}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pilih Status Baharu:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                  }}
                  disabled={isSavingStatus}
                  className="w-full bg-slate-55 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="Dalam Proses Semakan">Dalam Proses Semakan</option>
                  <option value="Kuiri">Kuiri Permohonan (Perlu Kemaskini)</option>
                  <option value="Diluluskan Keahlian">Diluluskan Keahlian</option>
                  <option value="Ditolak Keahlian">Ditolak Keahlian</option>
                  <option value="Dilucutkan Keahlian">Dilucutkan Keahlian</option>
                  <option value="Dinyahaktifkan Keahlian">Dinyahaktifkan Keahlian</option>
                </select>
              </div>

              {/* If "Diluluskan Keahlian" is selected, show Type selection */}
              {(selectedStatus === 'Diluluskan' || selectedStatus === 'Diluluskan Keahlian') && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jenis Keahlian:</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    disabled={isSavingStatus}
                    className="w-full bg-slate-55 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-hidden"
                  >
                    <option value="Ahli Biasa">Ahli Biasa : (Pemilik / Penyewa)</option>
                    <option value="Ahli Bersekutu">Ahli Bersekutu : (Ahli Akademik/NGO/Ahli Kelab Persatuan)</option>
                    <option value="Ahli Kehormat">Ahli Kehormat : (Tokoh/Penasihat)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setStatusEditApp(null)}
                disabled={isSavingStatus}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-black text-slate-500 cursor-pointer transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveStatus}
                disabled={isSavingStatus}
                className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-indigo-150"
              >
                {isSavingStatus ? 'Sila tunggu...' : 'Simpan Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar alerts */}
      {snackbar.show && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg border text-xs font-extrabold flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          snackbar.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-150' : 'bg-rose-50 text-rose-800 border-rose-150'
        }`}>
          {snackbar.type === 'success' ? <Check size={16} className="text-emerald-500 font-extrabold" /> : <X size={16} className="text-rose-500 font-extrabold" />}
          {snackbar.msg}
        </div>
      )}

      {/* WhatsApp & Kuiri Template Modal */}
      <WhatsAppKuiriModal
        isOpen={isWhatsAppKuiriModalOpen}
        onClose={() => {
          setIsWhatsAppKuiriModalOpen(false);
          setWhatsAppKuiriModalApp(null);
        }}
        application={whatsAppKuiriModalApp}
        onConfirmKuiri={handleConfirmKuiri}
        canEdit={canEdit}
      />

    </div>
  );
}
