export type SchoolRole = 'ADMIN UTAMA' | 'ADMIN' | 'GURU' | 'MURID' | 'IBU BAPA' | 'KPM/JPN/NAZIR/PPD' | 'TETAMU';

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
  status: 'Dalam Siasatan' | 'Dirujuk Kaunseling / HEM' | 'Dirujuk PDRM' | 'Selesai' | 'Arsip';
  createdAt: string;
  updatedAt?: string;

  // 5W 1H Discipline Specific Fields
  // WHAT: Apa kesalahan & tahap kesalahan
  whatPerincian?: string;
  tahapKesalahan?: 'Ringan' | 'Sederhana' | 'Berat';

  // WHO: Siapa yang terlibat
  namaMurid?: string;
  kelasMurid?: string;
  noPelajar?: string;
  saksiKejadian?: string;
  pihakTerlibatLain?: string;

  // WHEN: Bila berlaku
  sesiKejadian?: string;

  // WHERE: Di mana berlaku
  lokasiKejadian?: string;
  lokasiPerincian?: string;

  // WHY: Mengapa berlaku / punca
  puncaKejadian?: string;
  sebabPerincian?: string;

  // HOW: Bagaimana berlaku & tindakan diambil
  kronologiKejadian?: string;
  tindakanAwalGuru?: string;
}

