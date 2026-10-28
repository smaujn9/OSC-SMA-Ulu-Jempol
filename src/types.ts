export type SchoolRole = 'ADMIN UTAMA' | 'GURU' | 'MURID' | 'IBU BAPA' | 'TETAMU';

export interface BenefitItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface BenefitsConfig {
  items: BenefitItem[];
}

export interface Comment {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorUid?: string;
  content: string;
  timestamp: string;
}

export interface Post {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorUid?: string;
  authorRole?: string;
  content: string;
  image?: string;
  timestamp: string;
  likes: string[]; // List of user names/IDs who liked this post
  comments: Comment[];
  isPinned?: boolean;
  scope?: 'Awam' | 'Ahli Jawatankuasa';
}

export interface FeeItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  datePaid?: string;
}

export interface ImageFeePackage {
  id: string;
  name: string;
  subtitle: string;
  extraSubtitle?: string;
  price: number;
  priceLabel: string;
  isPaid: boolean;
  savingBadge?: string;
  category: 'Keahlian' | 'Bulanan' | 'Penggal' | 'Tahunan' | 'Tambahan';
  sessionYear?: string;
  monthIndex?: number; // e.g. 8 for August
  monthName?: string;
  penggalIndex?: number; // 1 or 2
  breakdown?: {
    heartAmount: string;
    heartLabel: string;
    usersAmount: string;
    usersLabel: string;
  };
  // Extra fields for additional fees
  isAdditional?: boolean;
  hasAgePricing?: boolean;
  agePricing?: {
    dewasa?: { enabled: boolean; price: number };
    wargaEmas?: { enabled: boolean; price: number };
    kanakKanak?: { enabled: boolean; price: number };
  };
  selectedAgeQuantities?: {
    dewasa: number;
    wargaEmas: number;
    kanakKanak: number;
  };
  feeType?: 'Tahunan' | 'Bulanan';
  months?: string[];
  account?: string;
  realCategory?: string;
  isCustomAmount?: boolean;
  customCartAmount?: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  category: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  time: string;
  day: string;
  month: string;
  status?: 'draf' | 'rasmi';
  rawDate?: string;
  rawEndDate?: string;
  startTime?: string;
  endTime?: string;
  isFromKertasKerja?: boolean;
  kertasKerjaId?: string;
}

export interface BlogItem {
  id: string;
  title: string;
  date: string;
  summary: string;
  image: string;
}

export interface ActiveMember {
  uid?: string;
  name: string;
  avatar: string;
  role: string;
  isOnline: boolean;
  bio?: string;
  cover?: string;
  email?: string;
  address?: string;
  phone?: string;
  displayName?: string;
  nickname?: string;
  joined?: string;
  icNumber?: string;
  noRumah?: string;
  statusKediaman?: string;
  memberNo?: string;
}

export interface AppNotification {
  id: string;
  text: string;
  time: string;
  type: 'announcement' | 'blog' | 'general' | 'chat';
  relatedId?: string;
}

export interface NotisPanggilan {
  id: string;
  type: 'agung_khas' | 'agung'; // agung_khas = Mesyuarat Agung Khas (All AJK + All Members), agung = Mesyuarat Agung (AJK only)
  title: string;
  referenceNo: string;
  dateOfNotice: string;
  meetingDate: string;
  meetingTime: string;
  meetingVenue: string;
  agenda: string[];
  signatureName: string;
  signatureRole: string;
  isTick: boolean;
  createdAt: string;
  signatureData?: string;
}

export interface Kehadiran {
  id: string;
  noticeId: string;
  noticeTitle?: string;
  userUid: string;
  userName: string;
  userEmail: string;
  userRole: string;
  status: 'Hadir' | 'Tidak Hadir';
  reason?: string;
  updatedAt: string;
}

export interface KertasKerjaKos {
  perkara: string;
  jumlah: number;
}

export interface KertasKerjaSumberKewangan {
  perkara: string;
  jumlah: number;
}

export interface KertasKerjaJadualAktiviti {
  tarikh: string;
  masa: string;
  aktiviti: string;
}

export interface KertasKerjaAJK {
  jawatan: string;
  tugas: string;
  nama: string;
  uid: string;
}

export interface KertasKerja {
  id: string;
  tajuk: string;
  tarikh: string;
  pengenalan: string;
  objektif: string[];
  pelaksanaan: {
    tarikh: string;
    masa: string;
    tempatBerkumpul: string;
    destinasi: string;
    tarikhMula?: string;
    tarikhTamat?: string;
    masaMula?: string;
    masaTamat?: string;
  };
  kumpulanSasar: string;
  anggaranKos: KertasKerjaKos[];
  jumlahKos: number;
  sumberKewangan: KertasKerjaSumberKewangan[];
  jumlahPendapatan: number;
  penganjur: string;
  jadualAktiviti: KertasKerjaJadualAktiviti[];
  strategiPelaksanaan: string;
  kawalanPenyeliaan: string;
  ahliJawatanKuasa: string;
  bendahariProgramUid?: string;
  bendahariProgramNama?: string;
  senaraiAhliJawatanKuasa: KertasKerjaAJK[];
  penutup: string;
  disediakanOleh: { nama: string; jawatan: string; tandatangan?: string; uid?: string; tarikh?: string };
  disemakOleh: { nama: string; jawatan: string; tandatangan?: string; uid?: string; tarikh?: string };
  disahkanOleh: { nama: string; jawatan: string; tandatangan?: string; uid?: string; tarikh?: string };
  belanjaBendahariProgram?: { nama: string; tandatangan?: string; uid?: string; tarikh?: string };
  belanjaBendahariPersatuan?: { nama: string; tandatangan?: string; uid?: string; tarikh?: string };
  belanjaPengerusi?: { nama: string; tandatangan?: string; uid?: string; tarikh?: string };
  status: 'Draf' | 'Lulus' | 'Ditolak' | 'Selesai';
  createdAt: string;
  updatedAt: string;
}

export interface PerbelanjaanProgram {
  id: string;
  kertasKerjaId: string;
  kertasKerjaTajuk?: string;
  tarikhSemasa: string;
  masaSemasa: string;
  butiranPengeluaran: string;
  jumlah: number;
  kaedahBayaran: string;
  resitUrl?: string;
  catatan: string;
  createdBy: string;
  createdAt: string;
}

export interface QurbanRegistrationInstallment {
  monthIndex: number; // 1..totalMonths
  monthName: string;  // e.g. "Bulan 1 (Deposit)", "Bulan 2", etc.
  amount: number;
  status: 'Belum Bayar' | 'Dalam Semakan' | 'Lulus' | 'Tolak';
  paidAt?: string;
  transactionId?: string;
  paymentMethod?: 'Tunai' | 'FPX' | 'Manual';
}

export interface QurbanRegistration {
  id: string;
  userUid: string;
  userEmail: string;
  userName: string;
  sessionYear: string; // e.g. "1448H / 2027M"
  
  // Form Step 1:
  jenisPenyertaan: 'Qurban Sunat' | 'Qurban Wajib' | 'Aqiqah Sunat' | 'Aqiqah Wajib';
  pakejPilihan: '1 BHG LEMBU' | '1 EKOR LEMBU' | '1 EKOR KAMBING';
  pakejPrice: number;
  managementFeeType?: 'percent' | 'fixed';
  managementFeePercent?: number; // e.g. 5%
  managementFeeFixed?: number;   // e.g. RM 50
  managementFeeAmount: number;
  totalAmount: number;
  
  // Form Step 2:
  namaPenuh: string;
  noIC: string;
  noTelefon: string;
  emel?: string;
  alamat: string;
  
  // Form Step 3:
  senaraiPeserta: string[];
  
  pilihanDaging: 'Mahu Ambil Daging' | 'Tidak Mahu Daging' | 'Simpan Daging';
  opsiBayaran: 'Penuh' | 'Ansuran';
  caraPembayaran: 'Tunai' | 'Online Transfer' | 'Manual Transfer';
  tempohAnsuranBulan?: number; // e.g. 3, 5, or 10
  resitUrl?: string;
  
  // Status tracking:
  statusPendaftaran: 'Dalam Proses' | 'Disahkan' | 'Batal' | 'Tamat Tempoh' | 'DITAMATKAN' | 'DISEMAK';
  paymentStatus: 'Belum Bayar' | 'Deposit Dibayar' | 'Ansuran Berjalan' | 'Selesai' | 'Dalam Semakan' | 'Terbatal';
  
  // Cash deadline (24 hours for Tunai):
  cashDeadline?: string;
  cashVerifiedAt?: string;
  cashVerifiedBy?: string;
  
  // Installment breakdown:
  depositAmount: number;
  monthlyAmount?: number;
  totalMonths?: number;
  monthsPaid: number;
  installmentPayments?: QurbanRegistrationInstallment[];
  
  createdAt: string;
  updatedAt: string;
}

export interface LoginLog {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role: string;
  membershipType: string;
  membershipStatus: string;
  approvalStatus: string;
  isAppointedMember: boolean;
  memberNo?: string | null;
  noRumah?: string | null;
  phoneNumber?: string | null;
  loginMethod: string;
  userAgent?: string;
  timestamp: any;
}

export interface CaseRecord {
  id: string;
  caseNo: string;
  pengaduUid: string;
  pengaduName: string;
  pengaduRole: string;
  penerimaName: string;
  penerimaHouseNo: string;
  tarikhKes: string;
  masaKes: string;
  jenisKes: string;
  isPoliceReport: boolean;
  balaiPolis?: string;
  noRepotPolis?: string;
  keterangan: string;
  buktiGambarUrl?: string;
  keteranganSiasatan?: string;
  keteranganSelesai?: string;
  buktiSelesaiUrl?: string;
  pengaduSignatureUrl?: string;
  penerimaSignatureUrl?: string;
  status: 'Dalam Siasatan' | 'Dirujuk PDRM' | 'Selesai' | 'Arsip';
  createdAt: string;
  updatedAt?: string;
}

