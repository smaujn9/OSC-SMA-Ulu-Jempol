import React, { useState, useMemo } from 'react';
import { useAuth, MembershipApplication, AppUser } from '../context/AuthContext';
import WhatsAppKuiriModal from './WhatsAppKuiriModal';
import { 
  Search, Clock, Check, X, FileText, Printer, MessageCircle, ExternalLink, 
  ChevronUp, ChevronDown, Edit, Loader2, ArrowUpDown, CreditCard, Download,
  AlertCircle, HelpCircle, Mail, Users
} from 'lucide-react';
import { sendMembershipApprovalEmail } from '../utils/notificationHelper';

interface KelulusanAhliSectionProps {
  onBack?: () => void;
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

export default function KelulusanAhliSection({ onBack }: KelulusanAhliSectionProps) {
  const { 
    currentUserDoc, 
    allUsers, 
    allApplications, 
    approveApplication, 
    rejectApplication, 
    queryApplication,
    updateApplicationStatus 
  } = useAuth();

  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appSortOption, setAppSortOption] = useState<'default' | 'name_asc' | 'name_desc' | 'house_asc' | 'house_desc' | 'member_asc' | 'member_desc' | 'date_desc' | 'date_asc'>('default');
  const [appPenyewaOnly, setAppPenyewaOnly] = useState<boolean>(false);
  const [appKuiriOnly, setAppKuiriOnly] = useState<boolean>(false);
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});
  
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
  
  const [snackbar, setSnackbar] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    actionType: 'approve' | 'reject';
    targetAppId?: string;
    targetUid?: string;
    onConfirm?: () => void;
  } | null>(null);

  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const [selectedAppType, setSelectedAppType] = useState<string>('Ahli Biasa');
  const [rejectionRemarks, setRejectionRemarks] = useState<string>('');
  const [downloadingAppId, setDownloadingAppId] = useState<string | null>(null);
  const [sendingEmailAppId, setSendingEmailAppId] = useState<string | null>(null);

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
        triggerSnackbar(`Emel pengesahan kelulusan pendaftaran warga berjaya dihantar ke ${targetEmail}!`, 'success');
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


  const triggerSnackbar = (msg: string, type: 'success' | 'error') => {
    setSnackbar({ show: true, msg, type });
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const toggleAppExpand = (appId: string) => {
    setExpandedApps(prev => ({
      ...prev,
      [appId]: !prev[appId]
    }));
  };

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

  // Setiausaha, Penolong Setiausaha, Bendahari, Pengerusi, Naib Pengerusi and Admin Utama can manage/approve applications
  const canEdit = currentUserDoc && (
    ['Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari', 'Pengerusi', 'Naib Pengerusi'].includes(currentUserDoc.role) ||
    currentUserDoc.isSuperAdmin === true
  );

  const handleSaveStatus = async () => {
    if (!statusEditApp) return;
    setIsSavingStatus(true);
    try {
      await updateApplicationStatus(statusEditApp.id, statusEditApp.uid, selectedStatus, selectedType);
      if (selectedStatus === 'Diluluskan Keahlian' || selectedStatus === 'Diluluskan') {
        triggerSnackbar('Status pendaftaran warga berjaya diluluskan, notifikasi push & emel kelulusan dihantar!', 'success');
      } else {
        triggerSnackbar('Status pendaftaran warga berjaya dikemaskini!', 'success');
      }
      setStatusEditApp(null);
    } catch (err: any) {
      triggerSnackbar(err.message || 'Gagal mengemaskini status.', 'error');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleApproveClick = (app: MembershipApplication) => {
    setSelectedAppType('Ahli Biasa');
    setConfirmDialog({
      show: true,
      title: 'Meluluskan Permohonan Warga',
      message: `Sila pilih jenis warga untuk meluluskan permohonan daripada ${app.name}:`,
      actionType: 'approve',
      targetAppId: app.id,
      targetUid: app.uid
    });
  };

  const handleRejectClick = (app: MembershipApplication) => {
    setRejectionRemarks('');
    setConfirmDialog({
      show: true,
      title: 'Menolak Permohonan Warga',
      message: `Sila masukkan ulasan atau sebab penolakan permohonan ${app.name}:`,
      actionType: 'reject',
      targetAppId: app.id,
      targetUid: app.uid
    });
  };

  const handleConfirmDialogAction = async () => {
    if (!confirmDialog || isProcessingAction) return;

    if (confirmDialog.actionType === 'approve') {
      setIsProcessingAction(true);
      try {
        await approveApplication(confirmDialog.targetAppId!, confirmDialog.targetUid!, selectedAppType);
        triggerSnackbar('Permohonan berjaya diluluskan, notifikasi push & emel rasmi dihantar!', 'success');
        setConfirmDialog(null);
      } catch (err: any) {
        triggerSnackbar(err.message || 'Gagal meluluskan permohonan.', 'error');
      } finally {
        setIsProcessingAction(false);
      }
      return;
    }

    if (confirmDialog.actionType === 'reject') {
      if (!rejectionRemarks.trim()) {
        triggerSnackbar('Sila masukkan ulasan penolakan.', 'error');
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
  };

  const combinedApplications = useMemo(() => {
    const list: MembershipApplication[] = [];
    const seenEmails = new Set<string>();
    const seenUids = new Set<string>();

    allApplications.forEach((app) => {
      if (!app.name && !app.uid && !app.email) return;
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

  const approvalSummary = useMemo(() => {
    let totalApproved = 0;
    let mapApproved = 0;
    let totalKuiri = 0;

    combinedApplications.forEach((app) => {
      const applicantUser = allUsers.find((u) => u.uid === app.uid);
      const houseRaw = String(app.noRumah || applicantUser?.noRumah || '').trim();
      const isRumah001 = houseRaw === '001' || houseRaw === '1';
      const statusVal = app.status || '';

      if (statusVal === 'Diluluskan' || statusVal === 'Diluluskan Keahlian') {
        totalApproved++;
        if (!isRumah001) {
          mapApproved++;
        }
      } else if (
        statusVal.toLowerCase().includes('kuiri') ||
        statusVal === 'Perlu Kemaskini'
      ) {
        totalKuiri++;
      }
    });

    return { totalApproved, mapApproved, totalKuiri };
  }, [combinedApplications, allUsers]);

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
          const statusA = a.status === 'Pending' ? 1 : 0;
          const statusB = b.status === 'Pending' ? 1 : 0;
          if (statusA !== statusB) {
            return statusB - statusA;
          }
          return timeB - timeA;
        }
      }
    });
  }, [combinedApplications, appSearchQuery, appSortOption, appPenyewaOnly, appKuiriOnly, allUsers]);

  const handlePrintDaftarAhli = () => {
    if (filteredApplications.length === 0) {
      alert('Tiada data permohonan keahlian untuk dicetak pada masa ini.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Sila benarkan tetingkap timbul (pop-ups) untuk mencetak buku daftar warga ini.');
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
  <title>Buku Rekod Daftar Warga Sekolah | SMAUJ</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
    
    body {
      font-family: 'Hanken Grotesk', sans-serif;
      background-color: #faf9fb;
      color: #1b1c1e;
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
  <div class="w-[297mm] mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-lg min-h-[210mm] flex flex-col justify-between print:m-0 print:rounded-none print:shadow-none print:border-none">
    
    <div class="no-print flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
      <h1 class="text-sm font-bold text-slate-800">Pratinjau Cetakan Buku Daftar Warga (Landscape)</h1>
      <button onclick="window.print()" class="px-5 py-2 bg-slate-800 text-white text-xs font-black rounded-lg hover:bg-slate-700 transition-all cursor-pointer">
        CETAK SEKARANG
      </button>
    </div>

    <div class="space-y-6 flex-1">
      <div class="flex justify-between items-start gap-4">
        <div class="flex items-center gap-4">
          <div>
            <p class="text-[10px] font-black tracking-widest uppercase opacity-75">BUKU REKOD DAFTAR WARGA SEKOLAH</p>
            <h1 class="text-lg font-black leading-tight tracking-tight">SEKOLAH MENENGAH AGAMA ULU JEMPOL</h1>
            <p class="text-xs font-bold text-slate-500">Batu Kikir, Negeri Sembilan</p>
          </div>
        </div>

        <div class="flex gap-4 text-right">
          <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-center min-w-[80px]">
            <p class="text-[8px] font-black text-slate-400 uppercase">DIJUMPAI</p>
            <p class="text-base font-black">${totalApp}</p>
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

      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800 text-white text-[9px] font-black uppercase tracking-wider border-b border-slate-700">
              <th class="px-3 py-2 text-center w-[40px]">Bil.</th>
              <th class="px-3 py-2 w-[110px]">No. ID Warga</th>
              <th class="px-3 py-2">Nama Penuh Pemohon</th>
              <th class="px-3 py-2 w-[110px]">No. Kad Pengenalan</th>
              <th class="px-3 py-2 w-[100px]">No. Telefon</th>
              <th class="px-3 py-2">Alamat & No. Rumah</th>
              <th class="px-3 py-2 text-center w-[90px]">Kediaman</th>
              <th class="px-3 py-2 text-center w-[100px]">Jenis Warga</th>
              <th class="px-3 py-2 text-center w-[100px]">Tarikh Lulus</th>
              <th class="px-3 py-2 text-center w-[90px]">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${tableRowsHtml || noRows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-8 pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
      <div>
        <p class="font-bold">Tarikh Cetakan: <span class="text-slate-800 font-extrabold">${todayDate}</span></p>
      </div>

      <div class="flex gap-20">
        <div class="text-center w-[180px]">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Disediakan Oleh</p>
          <div class="border-b border-slate-400 w-full mx-auto my-2"></div>
          <p class="font-extrabold text-slate-800 uppercase text-[10px]">${setiausahaName}</p>
          <p class="text-[9px] text-slate-400 font-bold">Setiausaha PTMF2</p>
        </div>

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

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-xs max-w-md mx-auto my-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
          <X className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Akses Ditolak</h2>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Halaman Kelulusan Warga ini terhad untuk pentadbir sekolah/persatuan (Setiausaha, Penolong Setiausaha, Bendahari, Pengerusi, dan Admin Utama) sahaja.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Kembali ke Utama
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-hidden">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 sm:pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Kelulusan Warga Baru</h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5 sm:mt-1">
            Urus, semak dan sahkan permohonan warga baru secara berpusat. (Akses: Setiausaha / Naib Setiausaha)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl truncate">
              {appSearchQuery || appPenyewaOnly || appKuiriOnly ? `${filteredApplications.length} drp ` : ''}{combinedApplications.length} Permohonan{appPenyewaOnly ? ' (Penyewa)' : ''}{appKuiriOnly ? ' (Kuiri)' : ''}
            </span>
            <span
              className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl truncate"
              title="Rumah 001 (Admin Utama) dikecualikan daripada Peta 3D (Lot 121–232)"
            >
              {approvalSummary.mapApproved} Lot Peta Lulus {approvalSummary.totalApproved > approvalSummary.mapApproved ? `(+${approvalSummary.totalApproved - approvalSummary.mapApproved} Admin 001)` : ''}
            </span>
          </div>
          <button
            onClick={handlePrintDaftarAhli}
            className="p-2 sm:p-2.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 rounded-xl cursor-pointer transition-all border border-slate-200 flex items-center justify-center shadow-xs shrink-0"
            title="Cetak Buku Daftar Warga"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Search & Quick Sort Filter Row */}
      {combinedApplications.length > 0 && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama pemohon, IC, no telefon, no rumah, no ID warga..."
              value={appSearchQuery}
              onChange={(e) => setAppSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-24 py-3 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-xs"
            />
            {appSearchQuery && (
              <button
                onClick={() => setAppSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-800 text-[10px] px-2 py-1.5 rounded-lg font-black uppercase tracking-wider cursor-pointer transition-colors"
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
              <span>No. ID Warga</span>
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
        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-2">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 mx-auto shadow-sm">
            <FileText size={20} />
          </div>
          <p className="text-xs font-bold text-slate-700">Tiada permohonan pendaftaran warga dihantar lagi.</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">Apabila warga atau penjaga menghantar borang pendaftaran, ia akan dipaparkan di sini.</p>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-2">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 mx-auto shadow-sm">
            <Search size={20} />
          </div>
          <p className="text-xs font-bold text-slate-700">Tiada permohonan yang sepadan.</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">Sila tukar kata kunci carian anda.</p>
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
                      {effectiveNickname ? effectiveNickname.slice(0,2) : (app.name ? app.name.slice(0,2) : 'WG')}
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
                            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">No. ID Warga: {memberNo}</span>
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
                        title="Lihat Profil Warga"
                      >
                        <ExternalLink size={13} className="sm:w-3.5 sm:h-3.5" />
                      </button>


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
                          title="Kemaskini Status Warga"
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

      {/* Snackbar Notification */}
      {snackbar.show && (
        <div className={`fixed bottom-5 right-5 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-5 ${
          snackbar.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {snackbar.type === 'success' ? <Check size={18} /> : <X size={18} />}
          {snackbar.msg}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className={`text-lg font-extrabold tracking-tight ${
              confirmDialog.actionType === 'reject' ? 'text-rose-600' : 'text-indigo-600'
            }`}>
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {confirmDialog.message}
            </p>
            
            {confirmDialog.actionType === 'approve' && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenis Keahlian (Akan disahkan)</label>
                <select
                  value={selectedAppType}
                  onChange={(e) => setSelectedAppType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="GURU">GURU (Warga Pendidik)</option>
                  <option value="MURID">MURID (Pelajar SMAUJ)</option>
                  <option value="IBU BAPA">IBU BAPA (Penjaga Pelajar)</option>
                  <option value="ADMIN UTAMA">ADMIN UTAMA (Pentadbir)</option>
                  <option value="Ahli Biasa">Ahli Biasa</option>
                </select>
              </div>
            )}
            
            {confirmDialog.actionType === 'reject' && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Sebab Penolakan / Ulasan</label>
                <textarea
                  rows={3}
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  placeholder="Cth: Tidak menetap di kawasan PTMF2, dokumen tidak lengkap..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={isProcessingAction}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDialogAction}
                disabled={isProcessingAction}
                className={`px-5 py-2 text-sm font-extrabold text-white rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 ${
                  confirmDialog.actionType === 'reject' 
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                {isProcessingAction && <Loader2 className="animate-spin" size={14} />}
                <span>{isProcessingAction ? 'Memproses...' : 'Sahkan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Edit Modal */}
      {statusEditApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900 border-b border-slate-100 pb-2">
              Kemaskini Status Warga
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Status Baru</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Dalam Proses Semakan">Dalam Proses Semakan (Pending)</option>
                  <option value="Diluluskan Keahlian">Diluluskan Warga (Aktif)</option>
                  <option value="Ditolak Keahlian">Ditolak Permohonan Warga</option>
                  <option value="Dilucutkan Keahlian">Dilucutkan Status Warga</option>
                  <option value="Dinyahaktifkan Keahlian">Dinyahaktifkan Status Warga</option>
                </select>
              </div>

              {(selectedStatus === 'Diluluskan Keahlian' || selectedStatus === 'Diluluskan') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Jenis Warga</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="GURU">GURU (Warga Pendidik)</option>
                    <option value="MURID">MURID (Pelajar SMAUJ)</option>
                    <option value="IBU BAPA">IBU BAPA (Penjaga Pelajar)</option>
                    <option value="ADMIN UTAMA">ADMIN UTAMA (Pentadbir)</option>
                    <option value="Ahli Biasa">Warga Biasa</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => setStatusEditApp(null)}
                disabled={isSavingStatus}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveStatus}
                disabled={isSavingStatus}
                className="px-5 py-2 text-sm font-extrabold text-white rounded-xl shadow-sm transition-all bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingStatus ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
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
