import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAX_CELL_LENGTH = 45000;

const formatImageOrUrl = (url: any, label = 'Lampiran'): string => {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) {
    return `[${label} (Data Base64 Tersimpan)]`;
  }
  if (trimmed.length > 500 && !trimmed.includes(' ') && !trimmed.includes('/')) {
    return `[${label} (Data Base64)]`;
  }
  return formatValue(trimmed);
};

const formatValue = (val: any): any => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'YA' : 'TIDAK';
  if (typeof val === 'number') return val;
  if (typeof val === 'object') {
    if (val.seconds !== undefined) {
      // Firestore Timestamp
      return new Date(val.seconds * 1000).toLocaleString('ms-MY');
    }
    if (val instanceof Date) {
      return val.toLocaleString('ms-MY');
    }
    try {
      const jsonStr = JSON.stringify(val);
      if (jsonStr.length > MAX_CELL_LENGTH) {
        return jsonStr.slice(0, MAX_CELL_LENGTH) + '... [Dipendekkan]';
      }
      return jsonStr;
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // If it's a base64 data URI (image, signature, pdf), don't dump 50k+ characters into a spreadsheet cell
    if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) {
      return '[Lampiran Imej / Data Fail Base64]';
    }
    // Hard ceiling for Google Sheets 50,000 character cell limit
    if (trimmed.length > MAX_CELL_LENGTH) {
      return trimmed.slice(0, MAX_CELL_LENGTH) + '... [Dipendekkan kerana had saiz sel Google Sheets]';
    }
    return trimmed;
  }
  return String(val);
};

export interface ExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  totalTabs: number;
}

export const exportAllDataToGoogleSheets = async (token: string): Promise<ExportResult> => {
  // Safe fetch helper to ensure no single missing collection halts the export
  const safeGetDocs = async (collName: string) => {
    try {
      return await getDocs(collection(db, collName));
    } catch (err) {
      console.warn(`Peringatan: Gagal memuatkan koleksi '${collName}':`, err);
      return { docs: [] } as any;
    }
  };

  // 1. Fetch all Firestore datasets in parallel
  const [
    usersSnap,
    applicationsSnap,
    qurbanSnap,
    kewanganSnap,
    vouchersSnap,
    balanceSheetSnap,
    feesSnap,
    complaintsSnap,
    casesSnap,
    notisSnap,
    kehadiranSnap,
    minitSnap,
    kertasKerjaSnap,
    perbelanjaanProgramSnap,
    suratSnap,
    eventsSnap,
    announcementsSnap,
    postsSnap,
    programReportsSnap,
    blogsSnap,
    foldersSnap,
    loginLogsSnap,
    rolesSnap,
    auditLogsSnap
  ] = await Promise.all([
    safeGetDocs('users'),
    safeGetDocs('membershipApplications'),
    safeGetDocs('qurbanRegistrations'),
    safeGetDocs('kewanganTransactions'),
    safeGetDocs('paymentVouchers'),
    safeGetDocs('kewanganBalanceSheet'),
    safeGetDocs('fees'),
    safeGetDocs('complaints'),
    safeGetDocs('cases'),
    safeGetDocs('notisPanggilan'),
    safeGetDocs('kehadiran'),
    safeGetDocs('minitMesyuarat'),
    safeGetDocs('kertasKerja'),
    safeGetDocs('perbelanjaanProgram'),
    safeGetDocs('surat_rasmi'),
    safeGetDocs('events'),
    safeGetDocs('announcements'),
    safeGetDocs('posts'),
    safeGetDocs('programReports'),
    safeGetDocs('blogs'),
    safeGetDocs('folders'),
    safeGetDocs('loginLogs'),
    safeGetDocs('roles'),
    safeGetDocs('auditLogs')
  ]);

  // Fetch system configs if available
  let yuranConfigData: any = null;
  let qurbanConfigData: any = null;
  let benefitsConfigData: any = null;
  try {
    const [ycSnap, qcSnap, bcSnap] = await Promise.all([
      getDoc(doc(db, 'system', 'yuranConfig')).catch(() => null),
      getDoc(doc(db, 'system', 'qurbanConfig')).catch(() => null),
      getDoc(doc(db, 'system', 'benefitsConfig')).catch(() => null)
    ]);
    if (ycSnap && ycSnap.exists()) yuranConfigData = ycSnap.data();
    if (qcSnap && qcSnap.exists()) qurbanConfigData = qcSnap.data();
    if (bcSnap && bcSnap.exists()) benefitsConfigData = bcSnap.data();
  } catch (sysErr) {
    console.warn("Peringatan: Gagal membaca tetapan system:", sysErr);
  }

  // 2. Build User quick-lookup map
  const usersMap = new Map<string, any>();
  usersSnap.docs.forEach(docSnap => {
    const d = docSnap.data();
    const uid = d.uid || docSnap.id;
    if (uid) {
      usersMap.set(uid, { ...d, uid });
    }
  });

  // ==========================================
  // TAB 1: Daftar Pengguna
  // ==========================================
  const usersHeader = [
    'UID', 'No. Ahli', 'Nama Penuh', 'Gelar / Panggilan', 'E-mel', 'No Telefon', 
    'No Kad Pengenalan', 'No Rumah', 'Alamat Penuh', 'Poskod', 'Bandar', 'Negeri', 
    'Status Kediaman', 'Nama Pemilik Rumah', 'No Tel Pemilik', 'Bil. Isi Rumah', 'Bil. Tanggungan', 
    'Peranan Sistem', 'Jenis Keahlian', 'Status Keahlian', 'Status Kelulusan', 'Status Super Admin',
    'Jawatan Persatuan', 'Jabatan / Bahagian', 'Pekerjaan Utama', 'Butiran Pekerjaan 1', 
    'Pekerjaan Kedua', 'Bandar Kediaman', 'Kampung Halaman', 'Tarikh Diluluskan', 
    'Tarikh Mendaftar', 'Log Masuk Terakhir', 'Senarai Ahli Keluarga', 'Pakej Dibayar', 
    'Pakej Tambahan Dipilih', 'Status / Catatan Kuiri', 'Senarai Item Kuiri'
  ];

  const usersRows = usersSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const uid = d.uid || docSnap.id;
    const isPenyewa = (d.statusKediaman || '').toLowerCase().includes('penyewa');
    const senaraiKeluargaStr = Array.isArray(d.senaraiAhliKeluarga)
      ? d.senaraiAhliKeluarga.map((k: any) => `${k.nama} (${k.hubungan || 'Keluarga'}, ${k.umur || '-'} Thn)`).join('; ')
      : '';
    const kuiriItemsStr = Array.isArray(d.kuiriItems) ? d.kuiriItems.join('; ') : '';
    const paidPackagesStr = Array.isArray(d.paidPackageIds) ? d.paidPackageIds.join(', ') : '';
    const tambahanStr = Array.isArray(d.selectedTambahanIds) ? d.selectedTambahanIds.join(', ') : '';

    return [
      formatValue(uid),
      formatValue(d.memberNo || '-'),
      formatValue(d.displayName || d.name),
      formatValue(d.nickname),
      formatValue(d.email),
      formatValue(d.phoneNumber || d.phone),
      formatValue(d.icNumber),
      formatValue(d.noRumah),
      formatValue(d.address),
      formatValue(d.poskod),
      formatValue(d.bandar),
      formatValue(d.negeri),
      formatValue(d.statusKediaman ? (isPenyewa ? 'Penyewa' : 'Pemilik (Sendiri)') : 'Pemilik (Sendiri)'),
      formatValue(d.namaPemilikRumah),
      formatValue(d.noTelPemilikRumah),
      d.bilanganIsiRumah !== undefined ? Number(d.bilanganIsiRumah) : '',
      d.bilanganTanggungan !== undefined ? Number(d.bilanganTanggungan) : '',
      formatValue(d.role || 'Ahli Biasa'),
      formatValue(d.membershipType || 'Ahli Biasa'),
      formatValue(d.membershipStatus || 'Aktif'),
      formatValue(d.approvalStatus || 'Diluluskan'),
      d.isSuperAdmin ? 'YA' : 'TIDAK',
      formatValue(d.associationRole),
      formatValue(d.department),
      formatValue(d.jobRole1 || d.pekerjaan),
      formatValue(d.jobDetails1),
      formatValue(d.jobRole2),
      formatValue(d.residenceCity),
      formatValue(d.hometown),
      formatValue(d.approvedAt),
      formatValue(d.createdAt || d.joined || d.registeredAt),
      formatValue(d.lastLoginAt),
      formatValue(senaraiKeluargaStr),
      formatValue(paidPackagesStr),
      formatValue(tambahanStr),
      formatValue(d.kuiriRemarks),
      formatValue(kuiriItemsStr)
    ];
  });

  // ==========================================
  // TAB 2: Borang Permohonan Keahlian
  // ==========================================
  const appsHeader = [
    'ID Permohonan', 'UID Pemohon', 'Nama Pemohon', 'Gelar / Panggilan', 'No. Ahli', 'E-mel', 
    'No Kad Pengenalan', 'No Telefon', 'No Rumah', 'Alamat Penuh', 'Poskod', 'Bandar', 'Negeri', 
    'Status Kediaman', 'Nama Pemilik', 'No Tel Pemilik', 'Bil Isi Rumah', 'Bil Tanggungan', 
    'Senarai Keluarga (Nama, Hubungan, Umur)', 'Jenis Keahlian Dimohon', 'Status Permohonan', 
    'Tarikh Mohon', 'Disemak Oleh', 'Tarikh Disemak', 'Catatan / Ulasan', 'Senarai Item Kuiri Diperlukan'
  ];

  const appsRows = applicationsSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const user = d.uid ? usersMap.get(d.uid) : null;
    const memberNo = d.memberNo || (user ? user.memberNo : '') || '-';
    const isPenyewa = (d.statusKediaman || '').toLowerCase().includes('penyewa');
    const senaraiKeluargaStr = Array.isArray(d.senaraiAhliKeluarga)
      ? d.senaraiAhliKeluarga.map((k: any) => `${k.nama} (${k.hubungan || 'Keluarga'}, ${k.umur || '-'} Thn)`).join('; ')
      : '';
    const kuiriStr = Array.isArray(d.kuiriItems) ? d.kuiriItems.join('; ') : '';

    return [
      formatValue(d.id || docSnap.id),
      formatValue(d.uid),
      formatValue(d.name),
      formatValue(d.nickname),
      formatValue(memberNo),
      formatValue(d.email),
      formatValue(d.icNumber),
      formatValue(d.phone),
      formatValue(d.noRumah),
      formatValue(d.address),
      formatValue(d.poskod),
      formatValue(d.bandar),
      formatValue(d.negeri),
      formatValue(d.statusKediaman ? (isPenyewa ? 'Penyewa' : 'Pemilik (Sendiri)') : 'Pemilik (Sendiri)'),
      formatValue(d.namaPemilikRumah),
      formatValue(d.noTelPemilikRumah),
      d.bilanganIsiRumah !== undefined ? Number(d.bilanganIsiRumah) : '',
      d.bilanganTanggungan !== undefined ? Number(d.bilanganTanggungan) : '',
      formatValue(senaraiKeluargaStr),
      formatValue(d.membershipType || (user ? user.membershipType : 'Ahli Biasa')),
      formatValue(d.status || 'Pending'),
      formatValue(d.submittedAt || d.createdAt),
      formatValue(d.reviewedBy),
      formatValue(d.reviewedAt),
      formatValue(d.rejectionRemarks || d.remarks),
      formatValue(kuiriStr)
    ];
  });

  // ==========================================
  // TAB 3: Pendaftaran Qurban & Aqiqah
  // ==========================================
  const qurbanHeader = [
    'ID Pendaftaran', 'UID Pengguna', 'Sesi Tahun', 'Nama Pemohon', 'Emel', 'No IC', 'No Telefon', 
    'Alamat Kediaman', 'Jenis Penyertaan', 'Pakej Pilihan', 'Harga Pakej (RM)', 'Caj Pengurusan (%)', 
    'Caj Pengurusan (RM)', 'Jumlah Keseluruhan (RM)', 'Senarai Peserta / Penama Akad', 'Pilihan Daging', 
    'Opsi Bayaran', 'Cara Pembayaran', 'Tempoh Ansuran (Bulan)', 'Deposit (RM)', 'Ansuran Bulanan (RM)', 
    'Jumlah Bulan Keseluruhan', 'Bulan Telah Dibayar', 'Status Pendaftaran', 'Status Bayaran', 
    'Had Masa Bayaran Tunai (24 Jam)', 'Pengesah Bayaran Tunai', 'Tarikh Disahkan Tunai', 
    'Tarikh Daftar', 'Tarikh Kemaskini'
  ];

  const qurbanRows = qurbanSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const pesertaStr = Array.isArray(d.senaraiPeserta) ? d.senaraiPeserta.join(', ') : '';
    return [
      formatValue(d.id || docSnap.id),
      formatValue(d.userUid),
      formatValue(d.sessionYear),
      formatValue(d.namaPenuh || d.userName),
      formatValue(d.emel || d.userEmail),
      formatValue(d.noIC),
      formatValue(d.noTelefon),
      formatValue(d.alamat),
      formatValue(d.jenisPenyertaan),
      formatValue(d.pakejPilihan),
      d.pakejPrice !== undefined ? Number(d.pakejPrice) : '',
      d.managementFeePercent !== undefined ? Number(d.managementFeePercent) : 5,
      d.managementFeeAmount !== undefined ? Number(d.managementFeeAmount) : '',
      d.totalAmount !== undefined ? Number(d.totalAmount) : '',
      formatValue(pesertaStr),
      formatValue(d.pilihanDaging),
      formatValue(d.opsiBayaran),
      formatValue(d.caraPembayaran),
      d.tempohAnsuranBulan !== undefined ? Number(d.tempohAnsuranBulan) : '',
      d.depositAmount !== undefined ? Number(d.depositAmount) : '',
      d.monthlyAmount !== undefined ? Number(d.monthlyAmount) : '',
      d.totalMonths !== undefined ? Number(d.totalMonths) : (d.tempohAnsuranBulan !== undefined ? Number(d.tempohAnsuranBulan) : 1),
      d.monthsPaid !== undefined ? Number(d.monthsPaid) : '',
      formatValue(d.statusPendaftaran),
      formatValue(d.paymentStatus),
      formatValue(d.cashDeadline),
      formatValue(d.cashVerifiedBy),
      formatValue(d.cashVerifiedAt),
      formatValue(d.createdAt),
      formatValue(d.updatedAt)
    ];
  });

  // ==========================================
  // TAB 4: Jadual Ansuran Qurban (NEW TAB)
  // ==========================================
  const qurbanInstallmentsHeader = [
    'ID Ansuran Rekod', 'ID Pendaftaran Qurban', 'Nama Peserta', 'No Telefon', 'Sesi Tahun', 
    'Pakej & Jenis', 'Peringkat Ansuran', 'Amaun Ansuran (RM)', 'Status Bayaran', 
    'Kaedah Bayaran', 'ID Transaksi Berkaitan', 'Tarikh Bayaran Disahkan'
  ];

  const qurbanInstallmentsRows: any[] = [];
  qurbanSnap.docs.forEach(docSnap => {
    const d = docSnap.data();
    const regId = d.id || docSnap.id;
    const installments = d.installmentPayments;
    if (Array.isArray(installments) && installments.length > 0) {
      installments.forEach((inst: any, idx: number) => {
        qurbanInstallmentsRows.push([
          formatValue(`${regId}-M${inst.monthIndex || idx + 1}`),
          formatValue(regId),
          formatValue(d.namaPenuh || d.userName),
          formatValue(d.noTelefon),
          formatValue(d.sessionYear),
          formatValue(`${d.jenisPenyertaan} (${d.pakejPilihan})`),
          formatValue(inst.monthName || `Bulan ${inst.monthIndex || idx + 1}`),
          inst.amount !== undefined ? Number(inst.amount) : '',
          formatValue(inst.status || 'Belum Bayar'),
          formatValue(inst.paymentMethod || d.caraPembayaran || '-'),
          formatValue(inst.transactionId || '-'),
          formatValue(inst.paidAt || '')
        ]);
      });
    }
  });

  // ==========================================
  // TAB 5: Transaksi Kewangan & Ledger
  // ==========================================
  const kewanganHeader = [
    'ID Transaksi', 'No Baucar', 'Tarikh', 'Masa', 'Akaun Debit', 'Akaun Kredit', 
    'Jenis Transaksi', 'Jumlah (RM)', 'Kategori', 'Butiran / Penerangan', 'Direkod Oleh', 
    'Status Kelulusan', 'Diluluskan Oleh', 'Tarikh Kelulusan', 'E-mel Pembayar / Ahli', 
    'Pakej Berkaitan', 'Pengesahan AI Vision', 'Jumlah Dikesan AI (RM)', 'Status Keyakinan AI', 
    'Catatan AI Vision', 'Catatan Tambahan', 'Sesi Tahun', 'Pautan Resit / Bukti', 'Pautan Invois / Lampiran'
  ];

  const kewanganRows = kewanganSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const packagesStr = Array.isArray(d.paidPackageIds) ? d.paidPackageIds.join(', ') : '';
    return [
      formatValue(d.id || docSnap.id),
      formatValue(d.voucherNo),
      formatValue(d.date),
      formatValue(d.time),
      formatValue(d.accountDebit),
      formatValue(d.accountCredit),
      formatValue(
        d.type || (
          d.category === 'Baki Bawa Hadapan'
            ? 'Baki Bawa Hadapan'
            : (d.category === 'Pindahan Wang (Kontra)' || ((d.accountDebit === 'Bank' || d.accountDebit === 'Tunai') && (d.accountCredit === 'Bank' || d.accountCredit === 'Tunai')))
              ? 'Pindahan Kontra'
              : (d.accountDebit === 'Bank' || d.accountDebit === 'Tunai' || d.accountDebit?.includes('100') || d.accountDebit?.toLowerCase().includes('bank'))
                ? 'Pendapatan'
                : 'Perbelanjaan'
        )
      ),
      d.amount !== undefined ? Number(d.amount) : '',
      formatValue(d.category),
      formatValue(d.description),
      formatValue(d.recordedBy),
      formatValue(d.approvalStatus || 'Approved'),
      formatValue(d.approvedBy),
      formatValue(d.approvedDate),
      formatValue(d.memberEmail),
      formatValue(packagesStr),
      d.aiVerified ? 'YA' : 'TIDAK',
      d.aiDetectedAmount !== undefined && d.aiDetectedAmount !== null ? Number(d.aiDetectedAmount) : '',
      formatValue(d.aiConfidence),
      formatValue(d.aiNotes),
      formatValue(d.notes),
      formatValue(d.sessionYear),
      formatImageOrUrl(d.receiptUrl || d.receiptAttachment || d.proofUrl || '', 'Pautan Resit'),
      formatImageOrUrl(d.invoiceAttachment || '', 'Pautan Invois')
    ];
  });

  // ==========================================
  // TAB 6: Baucar Pembayaran
  // ==========================================
  const vouchersHeader = [
    'ID Baucar (No PV)', 'Nama Persatuan', 'No Pendaftaran Persatuan', 'Bank Persatuan', 
    'Nama Akaun Bank Persatuan', 'No Akaun Bank Persatuan', 'Nama Penerima Bayaran', 
    'E-mel Penerima', 'Bank Penerima', 'No Akaun Penerima', 'Jumlah Baucar (RM)', 
    'Butiran Pembayaran', 'Kategori', 'Tarikh Baucar', 'Masa', 'Akaun Debit', 'Akaun Kredit', 
    'ID Transaksi Ledger', 'Status Tandatangan Bendahari', 'Nama Bendahari Bertandatangan', 
    'Tarikh Sain Bendahari', 'Status Tandatangan Pengerusi', 'Nama Pengerusi Bertandatangan', 
    'Tarikh Sain Pengerusi', 'Status Tandatangan Penerima', 'Nama Penerima Bertandatangan', 
    'Tarikh Sain Penerima', 'Pecahan Item (Itemized)', 'Catatan Tambahan', 'Tarikh Dicipta'
  ];

  const vouchersRows = vouchersSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const itemsFormatted = Array.isArray(d.items)
      ? d.items.map((it: any) => `${it.description || 'Item'}: RM ${Number(it.amount || 0).toFixed(2)}`).join('; ')
      : '';
    return [
      formatValue(d.id || docSnap.id),
      formatValue(d.associationName),
      formatValue(d.associationNo),
      formatValue(d.bankName),
      formatValue(d.bankAccountName),
      formatValue(d.bankAccountNumber),
      formatValue(d.payeeName),
      formatValue(d.payeeEmail),
      formatValue(d.payeeBankName),
      formatValue(d.payeeBankAccountNumber),
      d.amount !== undefined ? Number(d.amount) : '',
      formatValue(d.description),
      formatValue(d.category),
      formatValue(d.date),
      formatValue(d.time),
      formatValue(d.accountDebit),
      formatValue(d.accountCredit),
      formatValue(d.txnId),
      d.sigTreasurer ? 'TELAH DITANDATANGANI' : 'BELUM',
      formatValue(d.sigTreasurerName),
      formatValue(d.sigTreasurerAt),
      d.sigChairman ? 'TELAH DITANDATANGANI' : 'BELUM',
      formatValue(d.sigChairmanName),
      formatValue(d.sigChairmanAt),
      d.sigReceiver ? 'TELAH DITANDATANGANI' : 'BELUM',
      formatValue(d.sigReceiverName),
      formatValue(d.sigReceiverAt),
      formatValue(itemsFormatted),
      formatValue(d.catatan),
      formatValue(d.createdAt)
    ];
  });

  // ==========================================
  // TAB 7: Kunci Kira-Kira & Aset (NEW TAB)
  // ==========================================
  const balanceSheetHeader = [
    'ID Item', 'Nama Perkara / Item', 'Kategori Kunci Kira-Kira', 'Nilai / Amaun Semasa (RM)', 'Status / Penerangan'
  ];

  const balanceSheetTypeLabels: Record<string, string> = {
    'fixed-assets': 'Aset Bukan Semasa (Aset Tetap)',
    'current-assets': 'Aset Semasa',
    'liabilities': 'Liabiliti Bukan Semasa',
    'other-liabilities': 'Liabiliti Semasa',
    'capital': 'Dana Terkumpul & Modal'
  };

  const balanceSheetRows = balanceSheetSnap.docs.map(docSnap => {
    const d = docSnap.data();
    return [
      formatValue(docSnap.id),
      formatValue(d.name),
      formatValue(balanceSheetTypeLabels[d.type] || d.type || 'Lain-lain'),
      d.val !== undefined ? Number(d.val) : 0,
      formatValue(d.notes || d.description || '-')
    ];
  });

  // ==========================================
  // TAB 8: Rekod Yuran Penduduk
  // ==========================================
  const feesHeader = [
    'ID Rekod Yuran', 'Nama Yuran / Penduduk', 'Kategori Yuran', 'Jumlah (RM)', 
    'Tarikh Akhir Bayar', 'Status Bayaran', 'Tarikh Bayaran', 'No Rumah Penduduk', 
    'No Kad Pengenalan', 'E-mel Pembayar', 'UID Pengguna', 'Tahun Sesi'
  ];

  const feesRows = feesSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const uid = d.userId || d.uid;
    const user = uid ? usersMap.get(uid) : null;
    return [
      formatValue(d.id || docSnap.id),
      formatValue(d.name || (user ? user.displayName || user.name : '')),
      formatValue(d.category),
      d.amount !== undefined ? Number(d.amount) : '',
      formatValue(d.dueDate),
      d.isPaid ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR',
      formatValue(d.datePaid),
      formatValue(user?.noRumah || d.noRumah || '-'),
      formatValue(user?.icNumber || d.icNumber || '-'),
      formatValue(user?.email || d.email || '-'),
      formatValue(uid),
      formatValue(d.sessionYear)
    ];
  });

  // ==========================================
  // TAB 9: Aduan & Cadangan Penduduk
  // ==========================================
  const complaintsHeader = [
    'ID Aduan', 'Nama Pengadu', 'E-mel', 'No Telefon', 'No Rumah', 
    'Kategori Aduan', 'Butiran Aduan', 'Status Aduan', 'Tindakan / Maklum Balas Admin', 
    'Tarikh Aduan', 'Masa / Timestamp', 'Pautan Lampiran Gambar'
  ];

  const complaintsRows = complaintsSnap.docs.map(docSnap => {
    const d = docSnap.data();
    return [
      formatValue(docSnap.id),
      formatValue(d.nama),
      formatValue(d.email),
      formatValue(d.phone),
      formatValue(d.noRumah),
      formatValue(d.category || 'Umum'),
      formatValue(d.details),
      formatValue(d.status),
      formatValue(d.adminResponse || d.resolution || '-'),
      formatValue(d.createdAt),
      formatValue(d.timestamp),
      formatImageOrUrl(d.imageUrl || d.lampiranUrl || '', 'Lampiran Aduan')
    ];
  });

  // ==========================================
  // TAB 10: Pengurusan Kes & Keselamatan
  // ==========================================
  const casesHeader = [
    'ID Kes (Doc ID)', 'No Kes Rujukan', 'Nama Pengadu', 'Peranan Pengadu', 'UID Pengadu', 
    'Nama Penerima / OKT', 'No Rumah Penerima', 'Tarikh Kejadian Kes', 'Masa Kejadian', 
    'Jenis Keselamatan / Kes', 'Ada Laporan Polis?', 'Balai Polis Rujukan', 'No Repot Polis', 
    'Keterangan Kes', 'Keterangan Siasatan / Perkembangan', 'Keterangan Penyelesaian', 
    'Status Kes', 'Pautan Bukti Gambar Kes', 'Pautan Bukti Selesai', 
    'Tandatangan Pengadu', 'Tandatangan Penerima', 'Tarikh Dicipta', 'Tarikh Kemaskini'
  ];

  const casesRows = casesSnap.docs.map(docSnap => {
    const d = docSnap.data();
    return [
      formatValue(docSnap.id),
      formatValue(d.caseNo),
      formatValue(d.pengaduName),
      formatValue(d.pengaduRole),
      formatValue(d.pengaduUid),
      formatValue(d.penerimaName),
      formatValue(d.penerimaHouseNo),
      formatValue(d.tarikhKes),
      formatValue(d.masaKes),
      formatValue(d.jenisKes),
      d.isPoliceReport ? 'YA' : 'TIDAK',
      formatValue(d.balaiPolis),
      formatValue(d.noRepotPolis),
      formatValue(d.keterangan),
      formatValue(d.keteranganSiasatan),
      formatValue(d.keteranganSelesai),
      formatValue(d.status),
      formatImageOrUrl(d.buktiGambarUrl, 'Bukti Gambar Kes'),
      formatImageOrUrl(d.buktiSelesaiUrl, 'Bukti Selesai'),
      d.pengaduSignatureUrl ? 'ADA' : 'TIADA',
      d.penerimaSignatureUrl ? 'ADA' : 'TIADA',
      formatValue(d.createdAt),
      formatValue(d.updatedAt)
    ];
  });

  // ==========================================
  // TAB 11: Notis Panggilan Mesyuarat
  // ==========================================
  const notisHeader = [
    'ID Notis', 'Jenis Mesyuarat', 'Tajuk Mesyuarat', 'No Rujukan Notis', 'Tarikh Dikeluarkan Notis', 
    'Tarikh Mesyuarat', 'Masa Mesyuarat', 'Tempat Mesyuarat', 'Senarai Agenda', 
    'Dikeluarkan Oleh (Nama)', 'Jawatan Pengeluar Notis', 'Pengesahan Tandatangan Digital', 'Tarikh Cipta'
  ];

  const notisRows = notisSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const agendaStr = Array.isArray(d.agenda) ? d.agenda.join('; ') : '';
    return [
      formatValue(docSnap.id),
      formatValue(d.type === 'agung_khas' ? 'Mesyuarat Agung Khas' : 'Mesyuarat Agung / AJK'),
      formatValue(d.title),
      formatValue(d.referenceNo),
      formatValue(d.dateOfNotice),
      formatValue(d.meetingDate),
      formatValue(d.meetingTime),
      formatValue(d.meetingVenue),
      formatValue(agendaStr),
      formatValue(d.signatureName),
      formatValue(d.signatureRole),
      d.isTick ? 'DISAHKAN DIGITAL' : 'DRAF',
      formatValue(d.createdAt)
    ];
  });

  // ==========================================
  // TAB 12: Kehadiran Mesyuarat
  // ==========================================
  const kehadiranHeader = [
    'ID Rekod Kehadiran', 'ID Notis Mesyuarat', 'Tajuk Mesyuarat', 'UID Pengguna', 
    'Nama Ahli', 'No Rumah', 'No Telefon', 'Emel Ahli', 'Peranan Ahli', 
    'Status Kehadiran', 'Sebab Tidak Hadir', 'Tarikh Kemaskini Rekod'
  ];

  const kehadiranRows = kehadiranSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const user = d.userUid ? usersMap.get(d.userUid) : null;
    return [
      formatValue(docSnap.id),
      formatValue(d.noticeId),
      formatValue(d.noticeTitle),
      formatValue(d.userUid),
      formatValue(d.userName || user?.displayName || user?.name),
      formatValue(user?.noRumah || '-'),
      formatValue(user?.phoneNumber || user?.phone || '-'),
      formatValue(d.userEmail || user?.email),
      formatValue(d.userRole || user?.role),
      formatValue(d.status),
      formatValue(d.reason),
      formatValue(d.updatedAt)
    ];
  });

  // ==========================================
  // TAB 13: Minit Mesyuarat
  // ==========================================
  const minitHeader = [
    'ID Minit', 'Jenis Mesyuarat', 'Tajuk Minit', 'No Rujukan Notis Berkaitan', 'Tarikh Mesyuarat', 
    'Masa', 'Tempat', 'Pengerusi Mesyuarat', 'Pencatat Minit', 'Disediakan Oleh', 'Disahkan Oleh', 
    'Bilangan Ahli Hadir', 'Senarai Nama Hadir', 'Bilangan Tidak Hadir', 'Senarai Nama Tidak Hadir', 
    'Bilangan Agenda Dibincangkan', 'Pautan PDF Minit', 'Tarikh Cipta'
  ];

  const minitRows = minitSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const attendance = Array.isArray(d.attendance) ? d.attendance : [];
    const hadirList = attendance.filter((a: any) => a.status === 'Hadir').map((a: any) => a.name);
    const tidakHadirList = attendance.filter((a: any) => a.status === 'Tidak Hadir').map((a: any) => a.name);
    const agendaCount = Array.isArray(d.agendas) ? d.agendas.length : 0;

    return [
      formatValue(docSnap.id),
      formatValue(d.type === 'agung_khas' ? 'Mesyuarat Agung Khas' : 'Mesyuarat Jawatankuasa'),
      formatValue(d.title),
      formatValue(d.noticeRefNo || d.referenceNo || '-'),
      formatValue(d.date),
      formatValue(d.time),
      formatValue(d.venue),
      formatValue(d.chairperson),
      formatValue(d.recorder || d.pencatatMinit || '-'),
      formatValue(d.preparedBy ? `${d.preparedBy} (${d.preparedByRole || ''})` : ''),
      formatValue(d.confirmedBy ? `${d.confirmedBy} (${d.confirmedByRole || ''})` : ''),
      hadirList.length,
      formatValue(hadirList.join('; ')),
      tidakHadirList.length,
      formatValue(tidakHadirList.join('; ')),
      agendaCount,
      formatValue(d.pdfUrl || ''),
      formatValue(d.createdAt)
    ];
  });

  // ==========================================
  // TAB 14: Kertas Kerja Program
  // ==========================================
  const kertasKerjaHeader = [
    'ID Kertas Kerja', 'Tajuk Program', 'Penganjur', 'Objektif Program', 'Tarikh Pelaksanaan', 
    'Tarikh Mula', 'Tarikh Tamat', 'Masa Pelaksanaan', 'Tempat Berkumpul', 'Destinasi Program', 
    'Kumpulan Sasar', 'Jumlah Anggaran Kos (RM)', 'Jumlah Anggaran Pendapatan (RM)', 
    'Disediakan Oleh', 'Disemak Oleh', 'Disahkan Oleh', 'Bendahari Program', 
    'Status Belanja Bendahari Program', 'Status Belanja Bendahari Persatuan', 
    'Status Belanja Pengerusi', 'Status Kertas Kerja', 'Tarikh Cipta', 'Tarikh Kemaskini'
  ];

  const kertasKerjaRows = kertasKerjaSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const objektifStr = Array.isArray(d.objektif) ? d.objektif.join('; ') : formatValue(d.objektif);
    return [
      formatValue(docSnap.id),
      formatValue(d.tajuk),
      formatValue(d.penganjur),
      formatValue(objektifStr),
      formatValue(d.pelaksanaan?.tarikh || d.tarikh),
      formatValue(d.pelaksanaan?.tarikhMula),
      formatValue(d.pelaksanaan?.tarikhTamat),
      formatValue(d.pelaksanaan?.masa || d.pelaksanaan?.masaMula || ''),
      formatValue(d.pelaksanaan?.tempatBerkumpul),
      formatValue(d.pelaksanaan?.destinasi),
      formatValue(d.kumpulanSasar),
      d.jumlahKos !== undefined ? Number(d.jumlahKos) : '',
      d.jumlahPendapatan !== undefined ? Number(d.jumlahPendapatan) : '',
      formatValue(d.disediakanOleh?.nama ? `${d.disediakanOleh.nama} (${d.disediakanOleh.jawatan || ''})` : ''),
      formatValue(d.disemakOleh?.nama ? `${d.disemakOleh.nama} (${d.disemakOleh.jawatan || ''})` : ''),
      formatValue(d.disahkanOleh?.nama ? `${d.disahkanOleh.nama} (${d.disahkanOleh.jawatan || ''})` : ''),
      formatValue(d.bendahariProgramNama),
      d.belanjaBendahariProgram?.nama ? 'DISAHKAN' : 'BELUM',
      d.belanjaBendahariPersatuan?.nama ? 'DISAHKAN' : 'BELUM',
      d.belanjaPengerusi?.nama ? 'DISAHKAN' : 'BELUM',
      formatValue(d.status),
      formatValue(d.createdAt),
      formatValue(d.updatedAt)
    ];
  });

  // ==========================================
  // TAB 15: Perbelanjaan Program
  // ==========================================
  const perbelanjaanHeader = [
    'ID Perbelanjaan', 'ID Kertas Kerja', 'Tajuk Program / Kertas Kerja', 'Tarikh Perbelanjaan', 
    'Masa', 'Butiran Pengeluaran / Barang', 'Jumlah Pengeluaran (RM)', 'Kaedah Bayaran', 
    'Catatan / Tujuan', 'Direkod Oleh', 'Pautan Resit Belanja', 'Tarikh Cipta'
  ];

  const perbelanjaanRows = perbelanjaanProgramSnap.docs.map(docSnap => {
    const d = docSnap.data();
    return [
      formatValue(docSnap.id),
      formatValue(d.kertasKerjaId),
      formatValue(d.kertasKerjaTajuk),
      formatValue(d.tarikhSemasa),
      formatValue(d.masaSemasa),
      formatValue(d.butiranPengeluaran),
      d.jumlah !== undefined ? Number(d.jumlah) : '',
      formatValue(d.kaedahBayaran),
      formatValue(d.catatan),
      formatValue(d.createdBy),
      formatImageOrUrl(d.resitUrl, 'Resit Belanja'),
      formatValue(d.createdAt)
    ];
  });

  // ==========================================
  // TAB 16: Surat Rasmi Persatuan
  // ==========================================
  const suratHeader = [
    'ID Surat', 'No Rujukan Surat', 'Tarikh Surat', 'Nama Penerima', 'Jawatan Penerima', 
    'Alamat Penerima', 'Tajuk Surat', 'Slogan Rasmi', 'Nama Pengirim', 'Jawatan Pengirim', 
    'Salinan Kepada (s.k.)', 'Dicipta Oleh', 'Pautan PDF Surat', 'Tarikh Cipta'
  ];

  const suratRows = suratSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const skStr = Array.isArray(d.sk) ? d.sk.join('; ') : formatValue(d.sk || '-');
    return [
      formatValue(docSnap.id),
      formatValue(d.noRujukan),
      formatValue(d.tarikh),
      formatValue(d.penerimaNama),
      formatValue(d.penerimaJawatan),
      formatValue(d.penerimaAlamat),
      formatValue(d.tajuk),
      formatValue(d.slogan),
      formatValue(d.pengirimNama),
      formatValue(d.pengirimJawatan),
      formatValue(skStr),
      formatValue(d.createdByNama || d.createdByEmail),
      formatValue(d.pdfUrl),
      formatValue(d.createdAt)
    ];
  });

  // ==========================================
  // TAB 17: Takwim Acara
  // ==========================================
  const eventsHeader = [
    'ID Acara', 'Tajuk Acara / Program', 'Lokasi Acara', 'Tarikh Acara', 'Masa Mula', 
    'Masa Tamat', 'Hari', 'Bulan', 'Status Acara', 'Sumber Acara', 'ID Kertas Kerja Berkaitan', 'Tarikh Tamat'
  ];

  const eventsRows = eventsSnap.docs.map(docSnap => {
    const d = docSnap.data();
    return [
      formatValue(d.id || docSnap.id),
      formatValue(d.title),
      formatValue(d.location),
      formatValue(d.date || d.rawDate),
      formatValue(d.startTime || d.time),
      formatValue(d.endTime),
      formatValue(d.day),
      formatValue(d.month),
      formatValue(d.status || 'rasmi'),
      d.isFromKertasKerja ? 'DARI KERTAS KERJA' : 'ACARA MANUAL',
      formatValue(d.kertasKerjaId || ''),
      formatValue(d.rawEndDate || '')
    ];
  });

  // ==========================================
  // TAB 18: Pengumuman Komuniti
  // ==========================================
  const announcementsHeader = [
    'ID Pengumuman', 'Tajuk Pengumuman', 'Kandungan Pengumuman', 'Kategori Pengumuman', 
    'Penulis / Dicipta Oleh', 'Tarikh Pengumuman', 'Tarikh Kemaskini'
  ];

  const announcementsRows = announcementsSnap.docs.map(docSnap => {
    const d = docSnap.data();
    return [
      formatValue(d.id || docSnap.id),
      formatValue(d.title),
      formatValue(d.content),
      formatValue(d.category),
      formatValue(d.author || d.createdBy || 'Pengurusan Persatuan'),
      formatValue(d.date),
      formatValue(d.updatedAt || d.createdAt)
    ];
  });

  // ==========================================
  // TAB 19: Siaran Komuniti
  // ==========================================
  const postsHeader = [
    'ID Siaran (Post ID)', 'Nama Penulis', 'Peranan Penulis', 'Kandungan Siaran', 
    'Skop Hebahan', 'Jumlah Suka (Likes)', 'Senarai Nama Suka', 'Jumlah Komen', 
    'Status Disemat (Pinned)', 'Pautan Gambar Siaran', 'Tarikh & Masa Siaran'
  ];

  const postsRows = postsSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const likesCount = Array.isArray(d.likes) ? d.likes.length : 0;
    const likesList = Array.isArray(d.likes) ? d.likes.join(', ') : '';
    const commentsCount = Array.isArray(d.comments) ? d.comments.length : 0;
    return [
      formatValue(docSnap.id),
      formatValue(d.authorName),
      formatValue(d.authorRole),
      formatValue(d.content),
      formatValue(d.scope || 'Awam'),
      likesCount,
      formatValue(likesList),
      commentsCount,
      d.isPinned ? 'YA' : 'TIDAK',
      formatImageOrUrl(d.image || '', 'Gambar Siaran'),
      formatValue(d.timestamp)
    ];
  });

  // ==========================================
  // TAB 20: Laporan Program & Buletin
  // ==========================================
  const reportsHeader = [
    'ID Rekod', 'Jenis Laporan', 'Tajuk Laporan / Buletin', 'Kandungan / Ringkasan', 
    'Tarikh Laporan', 'Penulis / Dicipta Oleh', 'ID Kertas Kerja Berkaitan', 'Pautan Gambar / Cover'
  ];

  const reportsRows = [
    ...programReportsSnap.docs.map(docSnap => {
      const d = docSnap.data();
      return [
        formatValue(docSnap.id),
        'Laporan Program',
        formatValue(d.title || d.kertasKerjaTajuk),
        formatValue(d.laporanRingkas || d.ringkasan),
        formatValue(d.tarikh || d.createdAt),
        formatValue(d.penulis || d.createdBy),
        formatValue(d.kertasKerjaId || ''),
        formatImageOrUrl(d.coverImage || d.image || '', 'Cover Laporan')
      ];
    }),
    ...blogsSnap.docs.map(docSnap => {
      const d = docSnap.data();
      return [
        formatValue(docSnap.id),
        'Buletin Komuniti',
        formatValue(d.title),
        formatValue(d.summary),
        formatValue(d.date),
        'Pengurusan Persatuan',
        '',
        formatImageOrUrl(d.image || '', 'Gambar Buletin')
      ];
    })
  ];

  // ==========================================
  // TAB 21: Pengurusan Dokumen & Arkib (NEW TAB)
  // ==========================================
  const foldersHeader = [
    'ID Folder', 'Nama Folder', 'Status Folder', 'Bilangan Fail / Dokumen', 
    'Senarai Fail (Nama & Saiz)', 'Pautan Google Drive Folder', 'Dicipta Oleh', 'Tarikh Cipta'
  ];

  const foldersRows = foldersSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const files = Array.isArray(d.files) ? d.files : [];
    const filesStr = files.map((f: any) => `${f.name || 'Fail'} (${f.size ? (f.size / 1024).toFixed(1) + ' KB' : '-'})`).join('; ');
    return [
      formatValue(docSnap.id),
      formatValue(d.name),
      formatValue(d.status || 'Aktif'),
      files.length,
      formatValue(filesStr),
      formatValue(d.driveFolderId ? `https://drive.google.com/drive/folders/${d.driveFolderId}` : ''),
      formatValue(d.createdBy || 'Admin'),
      formatValue(d.createdAt)
    ];
  });

  // ==========================================
  // TAB 22: Log Masuk Pengguna (NEW TAB)
  // ==========================================
  const loginLogsHeader = [
    'ID Log', 'UID Pengguna', 'Nama Pengguna', 'E-mel Pengguna', 'No. Ahli', 
    'No. Rumah', 'No. Telefon', 'Peranan Sistem', 'Jenis Keahlian', 'Status Keahlian', 
    'Status Kelulusan', 'Status Ahli Dilantik', 'Kaedah Log Masuk', 'Peranti & Pelayar (User Agent)', 'Tarikh & Masa Log Masuk'
  ];

  const loginLogsRows = loginLogsSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const user = d.uid ? usersMap.get(d.uid) : null;
    return [
      formatValue(docSnap.id),
      formatValue(d.uid),
      formatValue(d.displayName || user?.displayName || user?.name),
      formatValue(d.email || user?.email),
      formatValue(d.memberNo || user?.memberNo || '-'),
      formatValue(d.noRumah || user?.noRumah || '-'),
      formatValue(d.phoneNumber || user?.phoneNumber || user?.phone || '-'),
      formatValue(d.role || user?.role),
      formatValue(d.membershipType || user?.membershipType),
      formatValue(d.membershipStatus || user?.membershipStatus),
      formatValue(d.approvalStatus || user?.approvalStatus),
      d.isAppointedMember ? 'YA' : 'TIDAK',
      formatValue(d.loginMethod || 'Google'),
      formatValue(d.userAgent || '-'),
      formatValue(d.timestamp)
    ];
  });

  // ==========================================
  // TAB 23: Log Pertukaran Peranan (NEW TAB)
  // ==========================================
  const rolesHeader = [
    'ID Log Peranan', 'UID Pengguna', 'Nama Pengguna', 'Peranan Asal (Lama)', 
    'Peranan Baharu', 'Sebab Pertukaran Peranan', 'Ditukar Oleh', 'Tarikh & Masa Pertukaran'
  ];

  const rolesRows = rolesSnap.docs.map(docSnap => {
    const d = docSnap.data();
    return [
      formatValue(docSnap.id),
      formatValue(d.userId),
      formatValue(d.userName),
      formatValue(d.oldRole),
      formatValue(d.newRole),
      formatValue(d.reason),
      formatValue(d.changedBy),
      formatValue(d.timestamp)
    ];
  });

  // ==========================================
  // TAB 24: Log Audit Sistem
  // ==========================================
  const auditHeader = [
    'ID Log Audit', 'UID Pengguna Terlibat', 'Nama Pengguna Terlibat', 
    'Tindakan Dilakukan', 'Keterangan Penuh Tindakan', 'Dilakukan Oleh (Pelaksana)', 'Tarikh & Masa Tindakan'
  ];

  const auditRows = auditLogsSnap.docs.map(docSnap => {
    const d = docSnap.data();
    const user = d.uid ? usersMap.get(d.uid) : null;
    return [
      formatValue(docSnap.id),
      formatValue(d.uid),
      formatValue(user ? user.displayName || user.name : '-'),
      formatValue(d.action),
      formatValue(d.description),
      formatValue(d.performedBy),
      formatValue(d.timestamp || d.createdAt)
    ];
  });

  // ==========================================
  // TAB 25: Tetapan & Konfigurasi Sistem (NEW TAB)
  // ==========================================
  const configHeader = [
    'Modul / Kategori Tetapan', 'Perkara / Parameter', 'Nilai / Penetapan Semasa', 'Penerangan / Catatan'
  ];

  const configRows: any[] = [];
  if (yuranConfigData) {
    configRows.push(['Yuran Keahlian', 'Kadar Yuran Pendaftaran Ahli Baru', `RM ${yuranConfigData.yuranKeahlian?.price ?? 50}`, 'Dikenakan sekali semasa pendaftaran']);
    configRows.push(['Yuran Bulanan', 'Kadar Yuran Bulanan Penduduk', `RM ${yuranConfigData.yuranBulanan?.price ?? 50}`, 'Kutipan yuran bulanan biasa']);
    configRows.push(['Yuran Penggal', 'Kadar Yuran Penggal (6 Bulan)', `RM ${yuranConfigData.yuranPenggal?.price ?? 270}`, 'Pakej bayaran 6 bulan berturut']);
    configRows.push(['Yuran Tahunan', 'Kadar Yuran Tahunan (12 Bulan)', `RM ${yuranConfigData.yuranTahunan?.price ?? 500}`, 'Pakej bayaran setahun dengan penjimatan']);
    configRows.push(['Akaun Bank Persatuan', 'Nama Bank Persatuan', yuranConfigData.manualBankName || 'Maybank', 'Akaun bank rasmi persatuan']);
    configRows.push(['Akaun Bank Sekolah / PIBG', 'Nama Pemegang Akaun', yuranConfigData.manualAccountName || 'PIBG Sekolah Menengah Agama Ulu Jempol', 'Nama pada penyata bank']);
    configRows.push(['Akaun Bank Persatuan', 'Nombor Akaun Bank', yuranConfigData.manualAccountNumber || '-', 'Nombor akaun untuk pindahan wang']);
    configRows.push(['Akaun Bank Persatuan', 'URL Kod QR DuitNow', formatImageOrUrl(yuranConfigData.manualQrCodeUrl, 'Kod QR DuitNow') || '-', 'Pautan imej kod QR rasmi']);
    
    if (Array.isArray(yuranConfigData.additionalFees) && yuranConfigData.additionalFees.length > 0) {
      yuranConfigData.additionalFees.forEach((af: any, idx: number) => {
        configRows.push(['Yuran Tambahan', `${af.name || `Pakej Tambahan ${idx + 1}`}`, `RM ${af.price || 0}`, af.subtitle || 'Yuran khas penduduk']);
      });
    }
  }

  if (qurbanConfigData) {
    configRows.push(['Qurban & Aqiqah', 'Harga 1 Bahagian Lembu', `RM ${qurbanConfigData.bhgLembuPrice ?? 900}`, 'Harga bersih satu bahagian lembu']);
    configRows.push(['Qurban & Aqiqah', 'Harga 1 Ekor Lembu Penuh', `RM ${qurbanConfigData.ekorLembuPrice ?? 6300}`, 'Harga bersih satu ekor lembu']);
    configRows.push(['Qurban & Aqiqah', 'Harga 1 Ekor Kambing', `RM ${qurbanConfigData.ekorKambingPrice ?? 1200}`, 'Harga bersih seekor kambing']);
    configRows.push(['Qurban & Aqiqah', 'Had Kuota Bahagian Lembu', qurbanConfigData.limitBhgLembu === 0 ? '0 (Tidak Dibuka)' : `${qurbanConfigData.limitBhgLembu ?? 35} bahagian`, 'Kapasiti maksimum yang dibuka']);
    configRows.push(['Qurban & Aqiqah', 'Had Kuota Ekor Lembu', qurbanConfigData.limitEkorLembu === 0 ? '0 (Tidak Dibuka)' : `${qurbanConfigData.limitEkorLembu ?? 5} ekor`, 'Kapasiti maksimum lembu hidup']);
    configRows.push(['Qurban & Aqiqah', 'Had Kuota Ekor Kambing', qurbanConfigData.limitEkorKambing === 0 ? '0 (Tidak Dibuka)' : `${qurbanConfigData.limitEkorKambing ?? 20} ekor`, 'Kapasiti maksimum kambing hidup']);
    const feeDesc = qurbanConfigData.managementFeeType === 'fixed'
      ? `Nilai Tetap RM ${(qurbanConfigData.managementFeeFixed ?? 45).toFixed(2)}`
      : `Kadar ${qurbanConfigData.managementFeePercent ?? 5}%`;
    configRows.push(['Qurban & Aqiqah', 'Kadar Caj Pengurusan', feeDesc, 'Caj pengurusan & pengagihan bagi setiap pendaftaran']);
    configRows.push(['Qurban & Aqiqah', 'Status Paparan Banner', qurbanConfigData.bannerVisibility || 'hide', 'Tetapan paparan di papan pemuka']);
  }

  if (benefitsConfigData && Array.isArray(benefitsConfigData.items)) {
    benefitsConfigData.items.forEach((item: any, idx: number) => {
      configRows.push(['Kelebihan & Kebajikan Ahli', item.title || `Faedah ${idx + 1}`, 'Aktif', item.description || '-']);
    });
  }

  // 3. Target the official Google Spreadsheet
  const TARGET_SPREADSHEET_ID = '1RarqkSZzIT5032uKbRTBsK6BtFu8YQjyUuvPpf0m1NQ';
  const TARGET_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit?gid=0#gid=0`;

  // Fetch metadata of target spreadsheet to check existing pages/sheets
  const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SPREADSHEET_ID}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!metaResponse.ok) {
    const errText = await metaResponse.text();
    if (metaResponse.status === 401) {
      const authErr: any = new Error(`Sesi kebenaran Google telah tamat tempoh (401 UNAUTHENTICATED). Sila sambungkan semula akaun Google.`);
      authErr.status = 401;
      authErr.isAuthError = true;
      throw authErr;
    }
    if (metaResponse.status === 403 || metaResponse.status === 404) {
      throw new Error(`Gagal mengakses Google Sheet sasaran (${TARGET_SPREADSHEET_ID}). Sila pastikan anda mempunyai kebenaran akses ke fail Google Sheet ini. (${errText})`);
    }
    throw new Error(`Gagal membaca maklumat Google Sheet: ${metaResponse.statusText} (${errText})`);
  }

  const spreadsheetData = await metaResponse.json();
  const sheetsInfo = (spreadsheetData.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId,
    title: s.properties?.title
  }));
  const existingSheetTitles = sheetsInfo.map((s: { sheetId: number; title: string }) => s.title);

  // List of all 25 tabs in logical order
  const requiredSheetTitles = [
    'Daftar Pengguna',
    'Borang Permohonan Keahlian',
    'Pendaftaran Qurban & Aqiqah',
    'Jadual Ansuran Qurban',
    'Transaksi Kewangan',
    'Baucar Pembayaran',
    'Kunci Kira-Kira & Aset',
    'Rekod Yuran Penduduk',
    'Aduan & Cadangan Penduduk',
    'Pengurusan Kes & Keselamatan',
    'Notis Panggilan Mesyuarat',
    'Kehadiran Mesyuarat',
    'Minit Mesyuarat',
    'Kertas Kerja Program',
    'Perbelanjaan Program',
    'Surat Rasmi Persatuan',
    'Takwim Acara',
    'Pengumuman Komuniti',
    'Siaran Komuniti',
    'Laporan Program & Buletin',
    'Pengurusan Dokumen & Arkib',
    'Log Masuk Pengguna',
    'Log Pertukaran Peranan',
    'Log Audit Sistem',
    'Tetapan & Konfigurasi Sistem'
  ];

  // Check missing pages/sheets and create ONLY if they do not exist
  const missingTitles = requiredSheetTitles.filter(t => !existingSheetTitles.includes(t));
  
  // Find default empty sheet like "Sheet1" or "Helaian1" to delete later if needed
  const defaultSheetNames = ['Sheet1', 'Sheet 1', 'Helaian1', 'Helaian 1'];
  const defaultSheetsToDelete = sheetsInfo.filter((s: { sheetId: number; title: string }) => 
    defaultSheetNames.includes(s.title) && !requiredSheetTitles.includes(s.title)
  );

  const requests: any[] = [];

  // Add missing required sheets
  if (missingTitles.length > 0) {
    missingTitles.forEach(title => {
      requests.push({
        addSheet: {
          properties: { title }
        }
      });
    });
  }

  // Delete default blank sheet(s) if we have required sheets
  if (defaultSheetsToDelete.length > 0) {
    defaultSheetsToDelete.forEach((s: { sheetId: number; title: string }) => {
      requests.push({
        deleteSheet: {
          sheetId: s.sheetId
        }
      });
    });
  }

  if (requests.length > 0) {
    const batchUpdateSheetsResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SPREADSHEET_ID}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });

    if (!batchUpdateSheetsResponse.ok) {
      const errText = await batchUpdateSheetsResponse.text();
      console.warn("Peringatan mengemaskini senarai helaian Google Sheet (diabaikan jika helaian telah sedia ada):", errText);
    }
  }

  // Clear existing content on all required sheets so old data is completely replaced by new data
  try {
    const rangesToClear = requiredSheetTitles.map(t => `'${t}'!A1:ZZ10000`);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SPREADSHEET_ID}/values:batchClear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ranges: rangesToClear })
    });
  } catch (clearErr) {
    console.warn("Ralat membersihkan data lama (diabaikan):", clearErr);
  }

  // 4. Batch update values to each of the 25 Sheets
  const valueRanges = [
    {
      range: "'Daftar Pengguna'!A1",
      values: [usersHeader, ...usersRows]
    },
    {
      range: "'Borang Permohonan Keahlian'!A1",
      values: [appsHeader, ...appsRows]
    },
    {
      range: "'Pendaftaran Qurban & Aqiqah'!A1",
      values: [qurbanHeader, ...qurbanRows]
    },
    {
      range: "'Jadual Ansuran Qurban'!A1",
      values: [qurbanInstallmentsHeader, ...qurbanInstallmentsRows]
    },
    {
      range: "'Transaksi Kewangan'!A1",
      values: [kewanganHeader, ...kewanganRows]
    },
    {
      range: "'Baucar Pembayaran'!A1",
      values: [vouchersHeader, ...vouchersRows]
    },
    {
      range: "'Kunci Kira-Kira & Aset'!A1",
      values: [balanceSheetHeader, ...balanceSheetRows]
    },
    {
      range: "'Rekod Yuran Penduduk'!A1",
      values: [feesHeader, ...feesRows]
    },
    {
      range: "'Aduan & Cadangan Penduduk'!A1",
      values: [complaintsHeader, ...complaintsRows]
    },
    {
      range: "'Pengurusan Kes & Keselamatan'!A1",
      values: [casesHeader, ...casesRows]
    },
    {
      range: "'Notis Panggilan Mesyuarat'!A1",
      values: [notisHeader, ...notisRows]
    },
    {
      range: "'Kehadiran Mesyuarat'!A1",
      values: [kehadiranHeader, ...kehadiranRows]
    },
    {
      range: "'Minit Mesyuarat'!A1",
      values: [minitHeader, ...minitRows]
    },
    {
      range: "'Kertas Kerja Program'!A1",
      values: [kertasKerjaHeader, ...kertasKerjaRows]
    },
    {
      range: "'Perbelanjaan Program'!A1",
      values: [perbelanjaanHeader, ...perbelanjaanRows]
    },
    {
      range: "'Surat Rasmi Persatuan'!A1",
      values: [suratHeader, ...suratRows]
    },
    {
      range: "'Takwim Acara'!A1",
      values: [eventsHeader, ...eventsRows]
    },
    {
      range: "'Pengumuman Komuniti'!A1",
      values: [announcementsHeader, ...announcementsRows]
    },
    {
      range: "'Siaran Komuniti'!A1",
      values: [postsHeader, ...postsRows]
    },
    {
      range: "'Laporan Program & Buletin'!A1",
      values: [reportsHeader, ...reportsRows]
    },
    {
      range: "'Pengurusan Dokumen & Arkib'!A1",
      values: [foldersHeader, ...foldersRows]
    },
    {
      range: "'Log Masuk Pengguna'!A1",
      values: [loginLogsHeader, ...loginLogsRows]
    },
    {
      range: "'Log Pertukaran Peranan'!A1",
      values: [rolesHeader, ...rolesRows]
    },
    {
      range: "'Log Audit Sistem'!A1",
      values: [auditHeader, ...auditRows]
    },
    {
      range: "'Tetapan & Konfigurasi Sistem'!A1",
      values: [configHeader, ...configRows]
    }
  ];

  const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SPREADSHEET_ID}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: valueRanges
    })
  });

  if (!updateResponse.ok) {
    const errText = await updateResponse.text();
    if (updateResponse.status === 401) {
      const authErr: any = new Error(`Sesi kebenaran Google telah tamat tempoh (401 UNAUTHENTICATED). Sila sambungkan semula akaun Google.`);
      authErr.status = 401;
      authErr.isAuthError = true;
      throw authErr;
    }
    throw new Error(`Gagal memuatkan data ke Google Sheet: ${updateResponse.statusText} (${errText})`);
  }

  return {
    spreadsheetId: TARGET_SPREADSHEET_ID,
    spreadsheetUrl: TARGET_SPREADSHEET_URL,
    totalTabs: requiredSheetTitles.length
  };
};
