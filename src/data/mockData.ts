import { Post, FeeItem, Announcement, UpcomingEvent, BlogItem, ActiveMember } from '../types';

export const USER_AHMAD = {
  name: "Tetamu",
  get avatar() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tmf2_avatar') || "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc";
    }
    return "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc";
  },
  set avatar(val: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tmf2_avatar', val);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tmf2_avatar_changed'));
      }
    }
  },
  email: "",
  role: "Pelawat",
  get bio() {
    const defaultName = this.name || "Tetamu";
    return `Saya ${defaultName}, warga Sekolah Menengah Agama Ulu Jempol (SMAUJ), Batu Kikir, Negeri Sembilan. 👋`;
  },
  get cover() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tmf2_cover') || "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200";
    }
    return "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200";
  },
  set cover(val: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tmf2_cover', val);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tmf2_cover_changed'));
      }
    }
  },
  address: "",
  phone: "",
  joined: ""
};

export const INITIAL_FEES: FeeItem[] = [
  {
    id: "fee-1",
    name: "Sumbangan PIBG Sesi 2026/2027",
    category: "PIBG",
    amount: 50.00,
    dueDate: "2026-04-30",
    isPaid: false
  },
  {
    id: "fee-2",
    name: "Dana Kecemerlangan Peperiksaan SPM & SMA",
    category: "Akademik",
    amount: 40.00,
    dueDate: "2026-05-15",
    isPaid: false
  },
  {
    id: "fee-3",
    name: "Modul & Bahan Pembelajaran Bahasa Arab & Diniyyah",
    category: "Kurikulum Dini",
    amount: 35.00,
    dueDate: "2026-05-30",
    isPaid: false
  },
  {
    id: "fee-4",
    name: "Tabung Pembangunan Surau & Asrama SMAUJ",
    category: "Pembangunan",
    amount: 25.00,
    dueDate: "2026-06-30",
    isPaid: false
  }
];

export const INITIAL_POSTS: Post[] = [
  {
    id: "post-1",
    authorName: "Ustaz Pengetua SMAUJ",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    authorRole: "Pengetua",
    content: "Ahlan wa Sahlan ke Portal One Stop Centre Sekolah Menengah Agama Ulu Jempol (SMAUJ)! Portal rasmi ini dibangunkan untuk memudahcara urusan guru, staf, para ibu bapa, pelajar serta komuniti Ulu Jempol. Marilah kita bersama melahirkan generasi Ulul Albab yang berilmu, beriman dan beramal. 🕌✨",
    image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800",
    timestamp: "1 jam yang lalu",
    likes: ["Ustazah Halimah", "Hj. Razak PIBG", "Tetamu"],
    comments: [
      {
        id: "c-1",
        authorName: "Hj. Razak PIBG",
        authorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
        content: "Tahniah pihak pengurusan sekolah atas inisiatif digitalisasi yang sangat hebat ini. Memudahkan ibu bapa menyemak aktiviti dan yuran anak-anak.",
        timestamp: "45 minit yang lalu"
      },
      {
        id: "c-2",
        authorName: "Ustazah Halimah",
        authorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
        content: "Alhamdulillah, semoga SMAUJ terus cemerlang di peringkat daerah Jempol dan kebangsaan!",
        timestamp: "30 minit yang lalu"
      }
    ],
    isPinned: true
  },
  {
    id: "post-2",
    authorName: "Unit Bimbingan & Kaunseling SMAUJ",
    authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
    authorRole: "Guru Kaunselor",
    content: "Peringatan mesra untuk semua calon SPM dan Sijil Menengah Agama (SMA) 2026: Sesi motivasi dan teknik menjawab soalan akan bermula minggu hadapan di Dewan Al-Ghazali. Pastikan persediaan fizikal dan rohani mantap!",
    timestamp: "3 jam yang lalu",
    likes: ["Tetamu", "Ustazah Halimah"],
    comments: [
      {
        id: "c-3",
        authorName: "Tetamu",
        authorAvatar: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc",
        content: "Terima kasih Cikgu atas peringatan. Kami ibu bapa akan sentiasa beri sokongan.",
        timestamp: "2 jam yang lalu"
      }
    ]
  }
];

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-1",
    title: "Mesyuarat Agung Tahunan PIBG SMAUJ 2026",
    content: "Dijemput semua ibu bapa, penjaga dan guru hadir ke Mesyuarat Agung Tahunan PIBG Kali Ke-24 pada 18 April 2026 (Sabtu) jam 8.30 pagi di Dewan Al-Ghazali SMAUJ.",
    date: "18 April 2026",
    category: "PIBG"
  },
  {
    id: "ann-2",
    title: "Pendaftaran Kemasukan Murid Tingkatan 1 Sesi Baharu",
    content: "Pendaftaran murid baharu Tingkatan 1 SMAUJ kini dibuka secara dalam talian menerusi Portal One Stop Centre ini.",
    date: "25 Mac 2026",
    category: "Kemasukan"
  },
  {
    id: "ann-3",
    title: "Program Ihya' Ramadan & Iftor Jama'ie SMAUJ",
    content: "Sumbangan dan infaq bagi penyediaan iftor pelajar asrama dan aktiviti tadarus Quran dialu-alukan menerusi modul Sumbangan.",
    date: "15 Mac 2026",
    category: "Dakwah"
  }
];

export const UPCOMING_EVENTS: UpcomingEvent[] = [
  {
    id: "evt-1",
    title: "Mesyuarat Agung PIBG SMAUJ Ke-24",
    location: "Dewan Al-Ghazali SMAUJ",
    date: "Sabtu, 18 April 2026",
    time: "8.30 pagi",
    day: "18",
    month: "APR",
    rawDate: "2026-04-18",
    rawEndDate: "2026-04-18",
    status: "rasmi"
  },
  {
    id: "evt-2",
    title: "Hari Anugerah Kecemerlangan Akademik & Sahsiah",
    location: "Dewan Utama SMAUJ",
    date: "Khamis, 14 Mei 2026",
    time: "9.00 pagi",
    day: "14",
    month: "MEI",
    rawDate: "2026-05-14",
    rawEndDate: "2026-05-14",
    status: "rasmi"
  },
  {
    id: "evt-3",
    title: "Kejohanan Sukan Tahunan SMAUJ",
    location: "Padang Sekolah SMAUJ",
    date: "Sabtu, 27 Jun 2026",
    time: "7.30 pagi",
    day: "27",
    month: "JUN",
    rawDate: "2026-06-27",
    rawEndDate: "2026-06-27",
    status: "rasmi"
  }
];

export const BLOG_POSTS: BlogItem[] = [
  {
    id: "blog-1",
    title: "Kejayaan Murid SMAUJ Merangkul Johan Tilawah & Tahfiz Peringkat Daerah",
    date: "10 Mac 2026",
    summary: "Pasukan hafazan dan qari SMAUJ telah mengharumkan nama sekolah dengan meraih kejayaan membanggakan dalam Majlis Tadarus Al-Quran Sekolah-Sekolah Menengah...",
    image: "https://images.unsplash.com/photo-1584697964190-705b89369e06?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: "blog-2",
    title: "Gotong-Royong MADANI: Keceriaan Surau, Asrama & Bilik Darjah SMAUJ",
    date: "22 Februari 2026",
    summary: "Kerjasama erat antara barisan guru, staf, ibu bapa PIBG dan para pelajar telah berjaya memperindah persekitaran sekolah selaras amalan sekolah lestari...",
    image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=400"
  }
];

export const ACTIVE_MEMBERS: ActiveMember[] = [
  {
    name: "Tetamu",
    avatar: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg?alt=media&token=429fd764-c3d9-44df-98c8-6307546354fc",
    role: "Warga SMAUJ",
    isOnline: true
  },
  {
    name: "Ustaz Pengetua",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    role: "Pengetua",
    isOnline: true
  },
  {
    name: "Ustazah Halimah",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
    role: "PK Pentadbiran",
    isOnline: true
  },
  {
    name: "Hj. Razak PIBG",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
    role: "YDP PIBG",
    isOnline: true
  },
  {
    name: "Cikgu Farid",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200",
    role: "PK HEM",
    isOnline: true
  },
  {
    name: "Puan Noraini",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200",
    role: "Guru / Penjaga",
    isOnline: true
  }
];
