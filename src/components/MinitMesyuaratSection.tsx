import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  ArrowLeft, 
  Printer, 
  Trash2, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Check, 
  Loader2, 
  X, 
  PlusCircle, 
  FileCheck, 
  Users,
  Lock,
  Download,
  CheckCircle,
  HelpCircle,
  Edit2,
  Sparkles,
  Table
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { useAuth, AppUser } from '../context/AuthContext';
import { NotisPanggilan, Kehadiran } from '../types';
import { AssociationLogo } from './AssociationLogo';
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy,
  updateDoc
} from 'firebase/firestore';

interface MinitMesyuaratSectionProps {
  isMobile: boolean;
  onBack?: () => void;
}

interface AttendanceItem {
  name: string;
  role: string;
  status: 'Hadir' | 'Tidak Hadir' | 'Bersebab';
}

// Role ranking comparator: Pengerusi -> Naib Pengerusi -> Setiausaha -> Naib Setiausaha -> Bendahari -> Naib Bendahari -> AJK -> Juru Audit -> Ahli Biasa
export const getRoleRank = (roleStr: string): number => {
  const role = (roleStr || '').toLowerCase().trim();
  if (!role) return 99;

  // 1. Pengerusi / Presiden / Yang Dipertua
  if (
    (role.includes('pengerusi') || role.includes('presiden') || role.includes('yang dipertua')) &&
    !role.includes('naib') &&
    !role.includes('timbalan') &&
    !role.includes('penolong')
  ) {
    return 1;
  }

  // 2. Naib Pengerusi / Timbalan Pengerusi / Naib Presiden / Timbalan Yang Dipertua
  if (
    role.includes('naib pengerusi') ||
    role.includes('timbalan pengerusi') ||
    role.includes('naib presiden') ||
    role.includes('timbalan presiden') ||
    role.includes('timbalan yang dipertua')
  ) {
    return 2;
  }

  // 3. Setiausaha
  if (
    role.includes('setiausaha') &&
    !role.includes('naib') &&
    !role.includes('penolong') &&
    !role.includes('timbalan')
  ) {
    return 3;
  }

  // 4. Naib Setiausaha / Penolong Setiausaha
  if (
    role.includes('naib setiausaha') ||
    role.includes('penolong setiausaha') ||
    role.includes('timbalan setiausaha')
  ) {
    return 4;
  }

  // 5. Bendahari
  if (
    role.includes('bendahari') &&
    !role.includes('naib') &&
    !role.includes('penolong') &&
    !role.includes('timbalan')
  ) {
    return 5;
  }

  // 6. Naib Bendahari / Penolong Bendahari
  if (
    role.includes('naib bendahari') ||
    role.includes('penolong bendahari') ||
    role.includes('timbalan bendahari')
  ) {
    return 6;
  }

  // 7. AJK (Ahli Jawatankuasa / Biro / EXCO)
  if (
    role.startsWith('ajk') ||
    role.includes('ahli jawatankuasa') ||
    role.includes('jawatankuasa') ||
    role.includes('biro') ||
    role.includes('exco')
  ) {
    return 7;
  }

  // 8. Juru Audit / Juru andit / Juruaudit / Pemeriksa Kira-kira
  if (
    role.includes('audit') ||
    role.includes('andit') ||
    role.includes('pemeriksa kira')
  ) {
    return 8;
  }

  // 9. Ahli Biasa / Penduduk / Tetamu
  if (
    role.includes('ahli biasa') ||
    role.includes('penduduk') ||
    role.includes('ahli bersekutu') ||
    role.includes('ahli kehormat') ||
    role.includes('tetamu') ||
    role.includes('pelawat') ||
    role.includes('ahli')
  ) {
    return 9;
  }

  return 10;
};

export function sortAttendance<T extends Record<string, any>>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const roleA = (a.role || a.jawatan || a.peranan || '') as string;
    const roleB = (b.role || b.jawatan || b.peranan || '') as string;
    const rankA = getRoleRank(roleA);
    const rankB = getRoleRank(roleB);
    if (rankA !== rankB) return rankA - rankB;
    const nameA = (a.name || a.nama || '') as string;
    const nameB = (b.name || b.nama || '') as string;
    return nameA.localeCompare(nameB);
  });
}

interface PindaanItem {
  proposedBy: string;
  clause: string;
  original: string;
  amended: string;
  decision: string;
  actionBy: string;
}

interface SubPointTableRow {
  cells: string[];
}

interface SubPointTable {
  headers: string[];
  rows: SubPointTableRow[];
}

interface AgendaSubPoint {
  text: string;
  actionBy?: string;
  table?: SubPointTable | null;
}

interface AgendaItem {
  number: string;
  title: string;
  description: string;
  decision?: string;
  actionBy?: string;
  points?: AgendaSubPoint[];
  formatType?: 'default' | 'pindaan';
  pindaans?: PindaanItem[];
  conclusion?: string;
}

interface MinitDocument {
  id: string;
  type: 'agung_khas' | 'jawatankuasa';
  title: string;
  date: string;
  time: string;
  venue: string;
  chairperson: string;
  attendance: AttendanceItem[];
  agendas: AgendaItem[];
  preparedBy: string;
  preparedByRole: string;
  confirmedBy: string;
  confirmedByRole: string;
  createdAt?: any;
}

// Initial realistic seed minutes
const SEED_MINIT_DOCS: MinitDocument[] = [
  {
    id: 'minit-seed-001',
    type: 'agung_khas',
    title: 'Minit Mesyuarat Agung Tahunan PIBG Kali Ke-1, Sekolah Menengah Agama Ulu Jempol',
    date: '2026-03-15',
    time: '09:00 Pagi - 12:30 Tengah Hari',
    venue: 'Dewan Al-Ghazali, Sekolah Menengah Agama Ulu Jempol',
    chairperson: 'YDP PIBG / Pengetua SMAUJ',
    attendance: [
      { name: 'Ustaz Ahmad Fauzi bin Razak', role: 'Pengetua SMAUJ', status: 'Hadir' },
      { name: 'Hj. Ismail bin Hashim', role: 'Yang Dipertua PIBG', status: 'Hadir' },
      { name: 'Pn. Rohani binti Kassim', role: 'Naib Yang Dipertua PIBG', status: 'Hadir' },
      { name: 'Ustazah Noraini binti Sulaiman', role: 'Setiausaha PIBG', status: 'Hadir' },
      { name: 'En. Mohd Azlan bin Kassim', role: 'Bendahari PIBG', status: 'Hadir' },
      { name: 'En. Shahrul bin Mat', role: 'AJK Ibu Bapa', status: 'Hadir' },
      { name: 'Pn. Aminah binti Yusof', role: 'AJK Guru', status: 'Hadir' },
      { name: 'Ustaz Kamaruzzaman bin Alias', role: 'Guru Penolong Kanan Pentadbiran', status: 'Hadir' },
      { name: 'Ustazah Zaiton binti Omar', role: 'Guru Penolong Kanan HEM', status: 'Hadir' }
    ],
    agendas: [
      {
        number: '1.0',
        title: 'Perutusan Pengerusi & Pengetua',
        description: 'Pengetua merakamkan ucapan tahniah dan terima kasih kepada semua guru serta ibu bapa yang hadir. Beliau membentangkan visi dan halatuju kecemerlangan kurikulum diniyah, tahfiz dan akademik arus perdana SMAUJ.',
        decision: 'Ibu bapa dan guru sepakat menyokong program peningkatan prestasi akademik serta sahsiah murid SMAUJ.',
        actionBy: 'Semua Guru & Ibu Bapa'
      },
      {
        number: '2.0',
        title: 'Usul Utama: Penambahbaikan Prasarana Surau & Pusat Sumber Sekolah',
        description: 'Setiausaha membentangkan kertas kerja penaiktarafan pendingin hawa di Surau Al-Falah SMAUJ dan digitalisasi perpustakaan bagi kemudahan pelajar tahfiz dan SPM.',
        decision: 'Mesyuarat sebulat suara meluluskan peruntukan daripada Tabung Pembangunan Sekolah dan Sumbangan PIBG sebanyak RM12,000.',
        actionBy: 'AJK Pembangunan & Bendahari'
      },
      {
        number: '3.0',
        title: 'Usul Tambahan: Program Kecemerlangan SPM & Sijil Menengah Agama (SMA)',
        description: 'Guru Penolong Kanan Kurikulum membentangkan jadual kelas tambahan berfokus, modul latihan intensif serta kem motivasi pelajar tingkatan 4 dan 5.',
        decision: 'Program kecemerlangan diluluskan dengan peruntukan khas PIBG sebanyak RM5,000.',
        actionBy: 'Unit Kurikulum & Peperiksaan SMAUJ'
      },
      {
        number: '4.0',
        title: 'Penangguhan Mesyuarat',
        description: 'Mesyuarat ditangguhkan pada jam 12:30 tengah hari dengan bacaan Surah Al-Asr dan tasbih kaffarah.',
        decision: 'Mesyuarat ditutup secara rasmi.',
        actionBy: 'Setiausaha PIBG'
      }
    ],
    preparedBy: 'Ustazah Noraini binti Sulaiman',
    preparedByRole: 'Setiausaha PIBG SMAUJ',
    confirmedBy: 'Hj. Ismail bin Hashim',
    confirmedByRole: 'Yang Dipertua PIBG'
  },
  {
    id: 'minit-seed-002',
    type: 'jawatankuasa',
    title: 'Minit Mesyuarat Jawatankuasa Pengurusan Sekolah Bil. 2/2026, SMA Ulu Jempol',
    date: '2026-05-10',
    time: '02:30 Petang - 04:45 Petang',
    venue: 'Bilik Mesyuarat Ibnu Sina, SMA Ulu Jempol',
    chairperson: 'Ustaz Ahmad Fauzi bin Razak (Pengetua)',
    attendance: [
      { name: 'Ustaz Ahmad Fauzi bin Razak', role: 'Pengetua SMAUJ', status: 'Hadir' },
      { name: 'Ustaz Kamaruzzaman bin Alias', role: 'PK Pentadbiran', status: 'Hadir' },
      { name: 'Ustazah Zaiton binti Omar', role: 'PK Hal Ehwal Murid', status: 'Hadir' },
      { name: 'Ustaz Mohd Hafiz bin Zakaria', role: 'PK Kokurikulum', status: 'Hadir' },
      { name: 'Ustazah Noraini binti Sulaiman', role: 'Setiausaha Pengurusan', status: 'Hadir' },
      { name: 'En. Mohd Azlan bin Kassim', role: 'Bendahari / Kerani Kewangan', status: 'Hadir' },
      { name: 'Pn. Aminah binti Yusof', role: 'Kaunselor Sekolah', status: 'Hadir' },
      { name: 'Ustazah Sakinah binti Daud', role: 'Ketua Bidang Pendidikan Islam', status: 'Hadir' }
    ],
    agendas: [
      {
        number: '1.0',
        title: 'Ucapan Aluan Pengerusi',
        description: 'Pengetua mengalu-alukan kehadiran pengurusan sekolah ke mesyuarat pengurusan berkala. Beliau menekankan pemantauan disiplin murid dan kebajikan asrama.',
        decision: 'Semua unit pengurusan mengambil maklum halatuju kualiti sekolah berkualiti.',
        actionBy: 'Semua Pentadbir'
      },
      {
        number: '2.0',
        title: 'Membentang & Mengesahkan Minit Mesyuarat Lalu',
        description: 'Minit Mesyuarat Pengurusan Bil. 1/2026 dibentangkan untuk semakan.',
        decision: 'Minit mesyuarat disahkan sebulat suara tanpa sebarang pindaan.',
        actionBy: 'Setiausaha'
      },
      {
        number: '3.0',
        title: 'Laporan Kewangan & Sumbangan PIBG',
        description: 'Bendahari membentangkan kutipan sumbangan persekolahan dan agihan bantuan murid asnaf.',
        decision: 'Laporan kewangan diterima dan disahkan sebulat suara.',
        actionBy: 'Bendahari & Kerani Kewangan'
      },
      {
        number: '4.0',
        title: 'Hal-hal Lain & Penutup',
        description: 'Penyelaras Asrama memaklumkan gotong-royong bilik asrama dan dewan makan sempena persediaan peperiksaan.',
        decision: 'Gotong-royong asrama ditetapkan pada Sabtu ini.',
        actionBy: 'Warden & Pembantu Asrama'
      }
    ],
    preparedBy: 'En. Mohd Azlan bin Kassim',
    preparedByRole: 'Setiausaha Persatuan Penduduk',
    confirmedBy: 'En. Kamal bin Ibrahim',
    confirmedByRole: 'Pengerusi Persatuan Penduduk'
  }
];

export default function MinitMesyuaratSection({ isMobile, onBack }: MinitMesyuaratSectionProps) {
  const { currentUserDoc, firebaseUser } = useAuth();
  
  // App States
  const [activeTab, setActiveTab] = useState<'agung_khas' | 'jawatankuasa'>('agung_khas');
  const [minutes, setMinutes] = useState<MinitDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinute, setSelectedMinute] = useState<MinitDocument | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // External data states for attendance syncing
  const [notices, setNotices] = useState<NotisPanggilan[]>([]);
  const [attendances, setAttendances] = useState<Kehadiran[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('');
  const [attendanceInputMethod, setAttendanceInputMethod] = useState<'notis' | 'manual'>('notis');

  // Form State
  const [formType, setFormType] = useState<'agung_khas' | 'jawatankuasa'>('jawatankuasa');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formVenue, setFormVenue] = useState('');
  const [formChairperson, setFormChairperson] = useState('');
  const [formAttendance, setFormAttendance] = useState<AttendanceItem[]>([]);
  const [formAgendas, setFormAgendas] = useState<AgendaItem[]>([
    { 
      number: '1.0', 
      title: 'Ucapan Aluan Pengerusi', 
      description: '', 
      decision: '', 
      actionBy: '',
      points: [{ text: 'Tuan Pengerusi mengucapkan ribuan terima kasih kepada semua yang hadir.', actionBy: '' }]
    }
  ]);
  const [formPreparedBy, setFormPreparedBy] = useState('');
  const [formPreparedByRole, setFormPreparedByRole] = useState('Setiausaha Persatuan Penduduk');
  const [formConfirmedBy, setFormConfirmedBy] = useState('');
  const [formConfirmedByRole, setFormConfirmedByRole] = useState('Pengerusi Persatuan Penduduk');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Assistant States
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAgendas, setAiAgendas] = useState<string[]>([
    'Ucapan Aluan Pengerusi',
    'Penangguhan mesyuarat pada jam 10:30 malam'
  ]);
  const [aiTranscript, setAiTranscript] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);

  const handleAddAiAgenda = () => {
    setAiAgendas(prev => {
      const next = [...prev];
      next.splice(next.length - 1, 0, '');
      return next;
    });
  };

  const handleRemoveAiAgenda = (index: number) => {
    if (aiAgendas.length <= 2) return;
    setAiAgendas(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateMinitWithAI = async () => {
    if (!aiTranscript.trim() || aiAgendas.some(a => !a.trim())) return;
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const res = await fetch('/api/minit/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agendaList: aiAgendas,
          transcript: aiTranscript
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Ralat pelayan (${res.status})`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.agendas)) {
        const mappedAgendas: AgendaItem[] = data.agendas.map((agenda: any) => ({
          number: agenda.number || '1.0',
          title: agenda.title || '',
          description: '',
          decision: '',
          actionBy: '',
          points: Array.isArray(agenda.points) 
            ? agenda.points.map((p: any) => ({
                text: p.text || '',
                actionBy: p.actionBy || ''
              }))
            : [{ text: '', actionBy: '' }],
          formatType: 'default',
          pindaans: [],
          conclusion: ''
        }));
        
        setFormAgendas(mappedAgendas);
        setShowAIAssistant(false);
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 5000);
      } else {
        throw new Error('Format maklum balas AI tidak sah.');
      }
    } catch (err: any) {
      console.error('Ralat Jana Minit AI:', err);
      setAiError(err.message || 'Gagal menghubungi pelayan AI.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Check if current user is admin/committe for edit/delete access
  const isSecretaryOrAdmin = currentUserDoc && [
    'Admin Utama', 'Setiausaha', 'Naib Setiausaha', 'Bendahari'
  ].includes(currentUserDoc.role);

  const allowedRoles = ['Admin Utama', 'Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Naib Setiausaha', 'Penolong Setiausaha', 'Bendahari'];
  const isMinitAllowed = currentUserDoc && (allowedRoles.includes(currentUserDoc.role) || currentUserDoc.isSuperAdmin);

  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local') return;

    const unsubNotices = onSnapshot(collection(db, 'notisPanggilan'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotisPanggilan));
      setNotices(data);
    }, (error) => {
      console.warn("Ralat memuatkan notisPanggilan dalam MinitMesyuaratSection:", error);
    });

    const unsubKehadiran = onSnapshot(collection(db, 'kehadiran'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kehadiran));
      setAttendances(data);
    }, (error) => {
      console.warn("Ralat memuatkan kehadiran dalam MinitMesyuaratSection:", error);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      setUsers(data);
    }, (error) => {
      console.warn("Ralat memuatkan users dalam MinitMesyuaratSection:", error);
    });

    return () => {
      unsubNotices();
      unsubKehadiran();
      unsubUsers();
    };
  }, [db, firebaseUser]);

  // Real-time listener for Firestore minitMesyuarat collection
  useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local' || !isMinitAllowed) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const minitCollection = collection(db, 'minitMesyuarat');
    const q = query(minitCollection, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let docsList: MinitDocument[] = [];
      snapshot.forEach((doc) => {
        docsList.push({ id: doc.id, ...doc.data() } as MinitDocument);
      });

      setMinutes(docsList);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, firebaseUser, isMinitAllowed]);

  // Filter based on active tab & search query
  const filteredMinutes = minutes.filter((doc) => {
    const matchesTab = doc.type === activeTab;
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.date.includes(searchQuery) ||
      doc.agendas.some(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || (a.description || '').toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  // Handle Attendance status cycle (Hadir -> Tidak Hadir -> Bersebab)
  const cycleAttendanceStatus = (index: number) => {
    const statuses: ('Hadir' | 'Tidak Hadir' | 'Bersebab')[] = ['Hadir', 'Tidak Hadir', 'Bersebab'];
    setFormAttendance(prev => prev.map((item, i) => {
      if (i === index) {
        const nextIdx = (statuses.indexOf(item.status) + 1) % statuses.length;
        return { ...item, status: statuses[nextIdx] };
      }
      return item;
    }));
  };

  // Dynamic Agendas management
  const addAgendaRow = () => {
    const nextNumber = `${formAgendas.length + 1}.0`;
    setFormAgendas(prev => [
      ...prev,
      { 
        number: nextNumber, 
        title: '', 
        description: '', 
        decision: '', 
        actionBy: '',
        points: [{ text: '', actionBy: '' }]
      }
    ]);
  };

  const removeAgendaRow = (index: number) => {
    if (formAgendas.length <= 1) return;
    const updated = formAgendas.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      number: `${i + 1}.0`
    }));
    setFormAgendas(updated);
  };

  const updateAgendaField = (index: number, field: keyof AgendaItem, value: any) => {
    setFormAgendas(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addSubPoint = (agendaIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        return {
          ...item,
          points: [...existingPoints, { text: '', actionBy: '' }]
        };
      }
      return item;
    }));
  };

  const removeSubPoint = (agendaIndex: number, pointIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        if (existingPoints.length <= 1) return item;
        return {
          ...item,
          points: existingPoints.filter((_, pIdx) => pIdx !== pointIndex)
        };
      }
      return item;
    }));
  };

  const updateSubPointField = (agendaIndex: number, pointIndex: number, field: 'text' | 'actionBy', value: string) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        // If points is empty, let's create a single entry
        const pts = existingPoints.length > 0 ? existingPoints : [{ text: '', actionBy: '' }];
        const updatedPoints = pts.map((pt, pIdx) => {
          if (pIdx === pointIndex) {
            return { ...pt, [field]: value };
          }
          return pt;
        });
        return {
          ...item,
          points: updatedPoints
        };
      }
      return item;
    }));
  };

  const addSubPointTable = (agendaIndex: number, pointIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points && item.points.length > 0 ? item.points : [{ text: '', actionBy: '' }];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex) {
            return {
              ...pt,
              table: {
                headers: ['', '', ''],
                rows: [
                  { cells: ['', '', ''] },
                  { cells: ['', '', ''] }
                ]
              }
            };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const removeSubPointTable = (agendaIndex: number, pointIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex) {
            return { ...pt, table: null };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const updateSubPointTableHeader = (agendaIndex: number, pointIndex: number, colIndex: number, value: string) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex && pt.table) {
            const newHeaders = pt.table.headers.map((h, cIdx) => cIdx === colIndex ? value : h);
            return {
              ...pt,
              table: {
                ...pt.table,
                headers: newHeaders
              }
            };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const updateSubPointTableCell = (agendaIndex: number, pointIndex: number, rowIndex: number, colIndex: number, value: string) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex && pt.table) {
            const newRows = pt.table.rows.map((row, rIdx) => {
              if (rIdx === rowIndex) {
                const newCells = row.cells.map((cell, cIdx) => cIdx === colIndex ? value : cell);
                return { cells: newCells };
              }
              return row;
            });
            return {
              ...pt,
              table: {
                ...pt.table,
                rows: newRows
              }
            };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const addSubPointTableColumn = (agendaIndex: number, pointIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex && pt.table) {
            return {
              ...pt,
              table: {
                headers: [...pt.table.headers, ''],
                rows: pt.table.rows.map(row => ({ cells: [...row.cells, ''] }))
              }
            };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const removeSubPointTableColumn = (agendaIndex: number, pointIndex: number, colIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex && pt.table) {
            if (pt.table.headers.length <= 1) return pt;
            return {
              ...pt,
              table: {
                headers: pt.table.headers.filter((_, cIdx) => cIdx !== colIndex),
                rows: pt.table.rows.map(row => ({
                  cells: row.cells.filter((_, cIdx) => cIdx !== colIndex)
                }))
              }
            };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const addSubPointTableRow = (agendaIndex: number, pointIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex && pt.table) {
            const colCount = pt.table.headers.length;
            return {
              ...pt,
              table: {
                ...pt.table,
                rows: [...pt.table.rows, { cells: Array(colCount).fill('') }]
              }
            };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const removeSubPointTableRow = (agendaIndex: number, pointIndex: number, rowIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPoints = item.points || [];
        const updatedPoints = existingPoints.map((pt, pIdx) => {
          if (pIdx === pointIndex && pt.table) {
            if (pt.table.rows.length <= 1) return pt;
            return {
              ...pt,
              table: {
                ...pt.table,
                rows: pt.table.rows.filter((_, rIdx) => rIdx !== rowIndex)
              }
            };
          }
          return pt;
        });
        return { ...item, points: updatedPoints };
      }
      return item;
    }));
  };

  const addPindaanRow = (agendaIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPindaans = item.pindaans || [];
        return {
          ...item,
          pindaans: [
            ...existingPindaans,
            { proposedBy: '', clause: '', original: '', amended: '', decision: 'Dipersetujui oleh majoriti ahli', actionBy: 'Setiausaha' }
          ]
        };
      }
      return item;
    }));
  };

  const removePindaanRow = (agendaIndex: number, pindaanIndex: number) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPindaans = item.pindaans || [];
        if (existingPindaans.length <= 1) return item;
        return {
          ...item,
          pindaans: existingPindaans.filter((_, pIdx) => pIdx !== pindaanIndex)
        };
      }
      return item;
    }));
  };

  const updatePindaanField = (agendaIndex: number, pindaanIndex: number, field: keyof PindaanItem, value: string) => {
    setFormAgendas(prev => prev.map((item, idx) => {
      if (idx === agendaIndex) {
        const existingPindaans = item.pindaans || [];
        const pts = existingPindaans.length > 0 ? existingPindaans : [
          { proposedBy: '', clause: '', original: '', amended: '', decision: 'Dipersetujui oleh majoriti ahli', actionBy: 'Setiausaha' }
        ];
        const updatedPindaans = pts.map((pt, pIdx) => {
          if (pIdx === pindaanIndex) {
            return { ...pt, [field]: value };
          }
          return pt;
        });
        return {
          ...item,
          pindaans: updatedPindaans
        };
      }
      return item;
    }));
  };

  const toggleAgendaFormat = (index: number, format: 'default' | 'pindaan') => {
    setFormAgendas(prev => prev.map((item, i) => {
      if (i === index) {
        const pindaans = item.pindaans && item.pindaans.length > 0 
          ? item.pindaans 
          : [{ proposedBy: '', clause: '', original: '', amended: '', decision: 'Dipersetujui oleh majoriti ahli', actionBy: 'Setiausaha' }];
        const conclusion = item.conclusion || 'Mesyuarat sebulat suara bersetuju dengan cadangan pindaan yang dibentangkan.';
        return {
          ...item,
          formatType: format,
          pindaans,
          conclusion
        };
      }
      return item;
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDate('');
    setFormTime('');
    setFormVenue('');
    setSelectedNoticeId('');
    setAttendanceInputMethod('notis');
    
    const pengerusiName = users.find(u => u.role === 'Pengerusi')?.displayName || users.find(u => u.role === 'Pengerusi')?.nickname || '';
    const setiausahaName = users.find(u => u.role === 'Setiausaha')?.displayName || users.find(u => u.role === 'Setiausaha')?.nickname || '';

    setFormChairperson(pengerusiName);
    setFormAttendance([]);
    setFormAgendas([
      { 
        number: '1.0', 
        title: 'Ucapan Aluan Pengerusi', 
        description: '', 
        decision: '', 
        actionBy: '',
        points: [{ text: 'Tuan Pengerusi mengucapkan ribuan terima kasih kepada semua yang hadir.', actionBy: '' }],
        formatType: 'default',
        pindaans: [],
        conclusion: ''
      }
    ]);
    setFormPreparedBy(setiausahaName);
    setFormPreparedByRole('Setiausaha Persatuan Penduduk');
    setFormConfirmedBy(pengerusiName);
    setFormConfirmedByRole('Pengerusi Persatuan Penduduk');

    // Reset AI Assistant States
    setShowAIAssistant(false);
    setAiAgendas([
      'Ucapan Aluan Pengerusi',
      'Penangguhan mesyuarat pada jam 10:30 malam'
    ]);
    setAiTranscript('');
    setAiError(null);
    setAiSuccess(false);
  };

  const handleNoticeSelection = (noticeId: string) => {
    setSelectedNoticeId(noticeId);
    if (!noticeId) return;

    const notice = notices.find(n => n.id === noticeId);
    if (!notice) return;

    const nonCommitteeRoles = ['Pelawat', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Penduduk', 'Tetamu'];
    
    const targetUsers = users.filter(user => {
      const isAJK = !nonCommitteeRoles.includes(user.role);
      const isNormalMember = user.role === 'Ahli Biasa';
      
      if (notice.type === 'agung_khas') {
        return isAJK || isNormalMember;
      } else {
        return isAJK;
      }
    });

    const activeNoticeAttendances = attendances.filter(a => a.noticeId === notice.id);

    const newAttendance: AttendanceItem[] = targetUsers.map(user => {
      const record = activeNoticeAttendances.find(a => a.userUid === user.uid);
      let status: 'Hadir' | 'Tidak Hadir' | 'Bersebab' = 'Tidak Hadir';
      
      if (record) {
        if (record.status === 'Hadir') status = 'Hadir';
        else if (record.status === 'Tidak Hadir') status = 'Tidak Hadir';
      }
      
      return {
        name: user.displayName || user.nickname || 'Ahli Tanpa Nama',
        role: user.role || 'Ahli Biasa',
        status: status
      };
    });

    // Also include any other attendees who submitted attendance for this notice
    activeNoticeAttendances.forEach(a => {
      if (!targetUsers.some(u => u.uid === a.userUid)) {
        const u = users.find(user => user.uid === a.userUid);
        let status: 'Hadir' | 'Tidak Hadir' | 'Bersebab' = 'Tidak Hadir';
        if (a.status === 'Hadir') status = 'Hadir';
        else if (a.status === 'Tidak Hadir') status = 'Tidak Hadir';

        newAttendance.push({
          name: a.userName || u?.displayName || u?.nickname || 'Penduduk',
          role: u?.role || a.userRole || 'Penduduk',
          status: status
        });
      }
    });

    setFormAttendance(sortAttendance(newAttendance));
  };

  const handleStartEdit = (doc: MinitDocument) => {
    setEditingId(doc.id);
    setFormType(doc.type);
    setFormTitle(doc.title);
    setFormDate(doc.date);
    setFormTime(doc.time);
    setFormVenue(doc.venue);
    setFormChairperson(doc.chairperson);
    setFormAttendance(sortAttendance(doc.attendance || []));
    setAttendanceInputMethod('manual');
    
    // Ensure each agenda has points array and amendment fields on-the-fly
    const parsedAgendas = doc.agendas.map(agenda => {
      let points: AgendaSubPoint[] = [];
      if (!agenda.points || agenda.points.length === 0) {
        points = [{ text: agenda.description || '', actionBy: agenda.actionBy || '', table: null }];
      } else {
        points = agenda.points.map(pt => ({
          text: pt.text || '',
          actionBy: pt.actionBy || '',
          table: pt.table && Array.isArray(pt.table.headers) && pt.table.headers.length > 0
            ? {
                headers: [...pt.table.headers],
                rows: (pt.table.rows || []).map((r: any) => ({
                  cells: Array.isArray(r?.cells) ? [...r.cells] : (Array.isArray(r) ? [...r] : [])
                }))
              }
            : null
        }));
      }
      return {
        ...agenda,
        points,
        formatType: agenda.formatType || 'default',
        pindaans: agenda.pindaans || [],
        conclusion: agenda.conclusion || ''
      };
    });
    
    setFormAgendas(parsedAgendas);
    setFormPreparedBy(doc.preparedBy);
    setFormPreparedByRole(doc.preparedByRole);
    setFormConfirmedBy(doc.confirmedBy);
    setFormConfirmedByRole(doc.confirmedByRole);
    setActiveTab(doc.type);
    setSelectedMinute(null);
    setShowAddForm(true);
  };

  const handleCreateMinutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate || !formTime || !formVenue.trim()) {
      alert("Sila isi semua maklumat mandatori mesyuarat.");
      return;
    }

    if (formAgendas.some(a => !a.title.trim())) {
      alert("Sila pastikan semua tajuk agenda diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Map formAgendas to ensure description fallback is in sync
      const formattedAgendas = formAgendas.map((agenda, idx) => {
        const points = (agenda.points || []).map(pt => ({
          text: pt.text || '',
          actionBy: pt.actionBy || '',
          table: pt.table && Array.isArray(pt.table.headers) && pt.table.headers.length > 0
            ? {
                headers: pt.table.headers.map(h => h || ''),
                rows: (pt.table.rows || []).map(r => ({
                  cells: (r.cells || []).map(c => c || '')
                }))
              }
            : null
        }));

        const isPindaan = formType === 'agung_khas' && idx > 0 && agenda.formatType === 'pindaan';
        
        let description = '';
        if (isPindaan) {
          const pindaans = agenda.pindaans || [];
          description = pindaans.map((p, pidx) => 
            `Cadangan Pindaan ${pidx + 1}\nDicadang oleh : ${p.proposedBy}\nFasal : ${p.clause}\nAsal : ${p.original}\nDipinda kepada : ${p.amended}\nKeputusan : ${p.decision}\nTindakan : ${p.actionBy}`
          ).join('\n\n');
          if (agenda.conclusion) {
            description += `\n\n${agenda.conclusion}`;
          }
        } else {
          description = points.map(p => p.text).filter(Boolean).join('\n');
        }

        return {
          number: agenda.number || '',
          title: agenda.title || '',
          description,
          decision: agenda.decision || '',
          actionBy: isPindaan ? 'Setiausaha' : (points[0]?.actionBy || agenda.actionBy || ''),
          points: points,
          formatType: isPindaan ? 'pindaan' : 'default',
          pindaans: isPindaan ? (agenda.pindaans || []).map(p => ({
            proposedBy: p.proposedBy || '',
            clause: p.clause || '',
            original: p.original || '',
            amended: p.amended || '',
            decision: p.decision || '',
            actionBy: p.actionBy || ''
          })) : [],
          conclusion: isPindaan ? (agenda.conclusion || '') : ''
        };
      });

      const newDoc: Omit<MinitDocument, 'id'> = {
        type: formType,
        title: formTitle,
        date: formDate,
        time: formTime,
        venue: formVenue,
        chairperson: formChairperson,
        attendance: sortAttendance(formAttendance).map(a => ({
          name: a.name || '',
          role: a.role || '',
          status: a.status || 'Hadir'
        })),
        agendas: formattedAgendas,
        preparedBy: formPreparedBy,
        preparedByRole: formPreparedByRole,
        confirmedBy: formConfirmedBy,
        confirmedByRole: formConfirmedByRole
      };

      if (editingId) {
        // Update existing document
        await updateDoc(doc(db, 'minitMesyuarat', editingId), {
          ...newDoc,
          updatedAt: serverTimestamp()
        });
        alert("Minit Mesyuarat berjaya dikemas kini!");
      } else {
        // Create new document
        await addDoc(collection(db, 'minitMesyuarat'), {
          ...newDoc,
          createdAt: serverTimestamp()
        });
        alert("Minit Mesyuarat berjaya disimpan!");
      }

      resetForm();
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed saving minit mesyuarat:", err);
      alert("Gagal menyimpan minit mesyuarat. Cuba lagi sekali.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (docId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ id: docId, title });
  };

  const confirmDeleteMinute = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'minitMesyuarat', deleteTarget.id));
      alert("Minit Mesyuarat berjaya dipadam!");
      if (selectedMinute?.id === deleteTarget.id) {
        setSelectedMinute(null);
      }
    } catch (err) {
      console.error("Gagal memadam:", err);
      alert("Ralat semasa memadam minit mesyuarat.");
    } finally {
      setDeleteTarget(null);
    }
  };

  // Native printer layout utility
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !selectedMinute) return;

    const meetingYear = new Date(selectedMinute.date).getFullYear();
    const getBil = () => {
      const match = selectedMinute.title.match(/Kali\s+Ke-(\d+)/i);
      if (match) return `BIL ${match[1]}/${meetingYear}`;
      const bilMatch = selectedMinute.title.match(/Bil\.?\s*(\d+)/i);
      if (bilMatch) return `BIL ${bilMatch[1]}/${meetingYear}`;
      return `BIL 1/${meetingYear}`;
    };

    const formattedDate = new Date(selectedMinute.date).toLocaleDateString('ms-MY', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    const sortedAttendanceList = sortAttendance(selectedMinute.attendance || []);
    const hadirList = sortedAttendanceList.filter(item => item.status === 'Hadir');
    const tidakHadirList = sortedAttendanceList.filter(item => item.status !== 'Hadir');

    const hadirCount = hadirList.length;
    const totalCount = sortedAttendanceList.length;

    const renderSingleAgendaPrintHtml = (agenda: AgendaItem, idx: number, totalCount: number) => {
      const X = idx + 1;
      const isFirst = (idx === 0);
      const isLast = (idx === totalCount - 1);
      const cleanTitle = (agenda.title || '').replace(/^\d+[\.\d]*\s*/, '').trim();
      
      let displayTitle = cleanTitle || `Agenda ${X}`;
      if (!displayTitle.endsWith(';') && !displayTitle.endsWith('.') && !displayTitle.endsWith(':')) {
        displayTitle += ';';
      }

      // Custom Proposed Amendments Format
      if (agenda.formatType === 'pindaan' && agenda.pindaans && agenda.pindaans.length > 0) {
        return `
          <div class="agenda-item" style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid; font-family: Arial, Helvetica, sans-serif;">
            <p style="font-size: 13px; font-weight: bold; margin: 20px 0 8px 0; color: #000; text-align: left;">
              ${X}. ${displayTitle}
            </p>
            <div style="margin-top: 6px;">
              ${agenda.pindaans.map((pindaan, pIdx) => `
                <div style="margin-left: 20px; margin-bottom: 12px; font-size: 13px; line-height: 1.5; color: #000; page-break-inside: avoid; break-inside: avoid; border: 1.5px solid #000; padding: 10px; border-radius: 4px; background-color: #f8fafc;">
                  <p style="margin: 0 0 6px 0; font-weight: bold; text-decoration: underline;">Cadangan Pindaan ${pIdx + 1}</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 0; border: none; font-size: 13px;">
                    <tr style="border: none;">
                      <td style="width: 140px; font-weight: bold; vertical-align: top; padding: 2px 0; border: none;">Dicadang oleh</td>
                      <td style="width: 15px; vertical-align: top; padding: 2px 0; border: none; text-align: center;">:</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none;">${pindaan.proposedBy || '-'}</td>
                    </tr>
                    <tr style="border: none;">
                      <td style="font-weight: bold; vertical-align: top; padding: 2px 0; border: none;">Fasal</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; text-align: center;">:</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none;">${pindaan.clause || '-'}</td>
                    </tr>
                    <tr style="border: none;">
                      <td style="font-weight: bold; vertical-align: top; padding: 2px 0; border: none;">Asal</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; text-align: center;">:</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; white-space: pre-wrap;">${pindaan.original || '-'}</td>
                    </tr>
                    <tr style="border: none;">
                      <td style="font-weight: bold; vertical-align: top; padding: 2px 0; border: none;">Dipinda kepada</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; text-align: center;">:</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; font-weight: bold; white-space: pre-wrap;">${pindaan.amended || '-'}</td>
                    </tr>
                    <tr style="border: none;">
                      <td style="font-weight: bold; vertical-align: top; padding: 2px 0; border: none;">Keputusan</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; text-align: center;">:</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none;">${pindaan.decision || '-'}</td>
                    </tr>
                    <tr style="border: none;">
                      <td style="font-weight: bold; vertical-align: top; padding: 2px 0; border: none;">Tindakan</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; text-align: center;">:</td>
                      <td style="vertical-align: top; padding: 2px 0; border: none; font-weight: bold; color: #dc2626;">${pindaan.actionBy || 'Setiausaha'}</td>
                    </tr>
                  </table>
                </div>
              `).join('')}
              
              ${agenda.conclusion ? `
                <div style="margin-left: 20px; margin-top: 10px; font-size: 13px; line-height: 1.5; color: #000; page-break-inside: avoid; break-inside: avoid;">
                  <table style="width: 100%; border-collapse: collapse; margin: 0; border: none;">
                    <tr style="border: none;">
                      <td style="width: 35px; font-weight: bold; vertical-align: top; padding: 0; border: none;">${X}.1</td>
                      <td style="vertical-align: top; padding: 0; border: none; font-weight: bold;">${agenda.conclusion}</td>
                    </tr>
                  </table>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Gather all paragraphs/points
      let ptsToRender: AgendaSubPoint[] = [];
      if (agenda.points && agenda.points.length > 0) {
        agenda.points.forEach(pt => {
          const hasTable = pt.table && Array.isArray(pt.table.headers) && pt.table.headers.length > 0;
          if ((pt.text && pt.text.trim()) || hasTable) {
            ptsToRender.push(pt);
          }
        });
      }
      
      if (ptsToRender.length === 0) {
        if (agenda.description && agenda.description.trim()) {
          const splitLines = agenda.description.split('\n').map(l => l.trim()).filter(Boolean);
          if (splitLines.length > 1) {
            splitLines.forEach(line => {
              ptsToRender.push({ text: line, actionBy: agenda.actionBy || '' });
            });
          } else {
            ptsToRender.push({ text: agenda.description.trim(), actionBy: agenda.actionBy || '' });
          }
        }
        if (agenda.decision && agenda.decision.trim()) {
          ptsToRender.push({ text: `Keputusan: ${agenda.decision.trim()}`, actionBy: agenda.actionBy || '' });
        }
      }

      if (ptsToRender.length === 0) {
        ptsToRender.push({ text: 'Tiada perbincangan khusus dicatatkan.', actionBy: agenda.actionBy || '' });
      }

      return `
        <div class="agenda-item" style="margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid; font-family: Arial, Helvetica, sans-serif;">
          <p style="font-size: 13px; font-weight: bold; margin: 20px 0 8px 0; color: #000; text-align: left;">
            ${X}. ${displayTitle}
          </p>
          <div style="margin-top: 6px;">
            ${ptsToRender.map((point, pIdx) => {
              const hasTable = point.table && Array.isArray(point.table.headers) && point.table.headers.length > 0;
              const tableHtml = hasTable && point.table ? `
                <table style="width: 100%; border-collapse: collapse; margin: ${point.text && point.text.trim() ? '8px 0 4px 0' : '0 0 4px 0'}; border: 1px solid #000; font-size: 12px;">
                  <thead>
                    <tr style="background-color: #f1f5f9;">
                      ${point.table.headers.map(hdr => `
                        <th style="border: 1px solid #000; padding: 6px 8px; text-align: left; font-weight: bold; color: #000;">${hdr || '-'}</th>
                      `).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${(point.table.rows || []).map(row => `
                      <tr>
                        ${(row.cells || []).map(cell => `
                          <td style="border: 1px solid #000; padding: 5px 8px; text-align: left; vertical-align: top; white-space: pre-wrap; color: #000;">${cell || ''}</td>
                        `).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '';

              return `
              <div style="margin-left: 20px; margin-bottom: 8px; font-size: 13px; line-height: 1.5; text-align: justify; color: #000; page-break-inside: avoid; break-inside: avoid;">
                <table style="width: 100%; border-collapse: collapse; margin: 0; border: none;">
                  <tr style="border: none;">
                    <td style="width: 35px; font-weight: normal; vertical-align: top; padding: 0; border: none; font-size: 13px;">${X}.${pIdx + 1}</td>
                    <td style="vertical-align: top; padding: 0; border: none; text-align: justify; font-size: 13px;">
                      ${point.text && point.text.trim() ? `<div style="white-space: pre-wrap; margin: 0; padding: 0;">${point.text}</div>` : ''}
                      ${tableHtml}
                      ${(!isFirst && !isLast && point.actionBy && point.actionBy.trim()) ? `<div style="text-align: right; font-weight: bold; font-size: 12px; margin-top: 2px; padding: 0; color: #000; white-space: normal;">Tindakan : ${point.actionBy}</div>` : ''}
                    </td>
                  </tr>
                </table>
              </div>
            `}).join('')}
            
            ${(!isFirst && !isLast && !agenda.points && agenda.actionBy && agenda.actionBy.trim() && ptsToRender.length === 1 && !ptsToRender[0].actionBy) ? `
              <div style="text-align: right; font-weight: bold; font-size: 12px; margin: 0; padding: 0; color: #000; page-break-inside: avoid; break-inside: avoid; text-transform: none; letter-spacing: normal; white-space: normal;">
                Tindakan : ${agenda.actionBy}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    };

    const totalAgendas = selectedMinute.agendas.length;
    let mainAgendasHtml = '';
    let finalBlockHtml = '';

    const signatureSectionHtml = `
      <div class="signature-section" style="margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; break-inside: avoid; font-size: 13px;">
        <div class="signature-box" style="width: 45%;">
          <p style="margin-bottom: 50px;">Disediakan oleh :</p>
          <p style="margin-bottom: 5px;">....................................................</p>
          <p style="font-weight: bold; margin: 0;">${selectedMinute.preparedBy}</p>
          <p style="margin: 0; color: #475569;">${selectedMinute.preparedByRole}</p>
        </div>
        <div class="signature-box" style="width: 45%;">
          <p style="margin-bottom: 50px;">Disahkan oleh :</p>
          <p style="margin-bottom: 5px;">....................................................</p>
          <p style="font-weight: bold; margin: 0;">${selectedMinute.confirmedBy}</p>
          <p style="margin: 0; color: #475569;">${selectedMinute.confirmedByRole}</p>
        </div>
      </div>
    `;

    if (totalAgendas > 1) {
      const priorAgendas = selectedMinute.agendas.slice(0, totalAgendas - 1);
      const lastAgenda = selectedMinute.agendas[totalAgendas - 1];

      mainAgendasHtml = priorAgendas.map((ag, idx) => renderSingleAgendaPrintHtml(ag, idx, totalAgendas)).join('');
      const lastAgendaHtml = renderSingleAgendaPrintHtml(lastAgenda, totalAgendas - 1, totalAgendas);

      finalBlockHtml = `
        <div class="last-section-wrapper" style="page-break-inside: avoid; break-inside: avoid;">
          ${lastAgendaHtml}
          ${signatureSectionHtml}
        </div>
      `;
    } else if (totalAgendas === 1) {
      const onlyAgendaHtml = renderSingleAgendaPrintHtml(selectedMinute.agendas[0], 0, totalAgendas);
      finalBlockHtml = `
        <div class="last-section-wrapper" style="page-break-inside: avoid; break-inside: avoid;">
          ${onlyAgendaHtml}
          ${signatureSectionHtml}
        </div>
      `;
    } else {
      finalBlockHtml = `
        <div class="last-section-wrapper" style="page-break-inside: avoid; break-inside: avoid;">
          ${signatureSectionHtml}
        </div>
      `;
    }

    const printContent = `
      <html>
        <head>
          <title>${selectedMinute.title}</title>
          <style>
            @media print {
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                margin: 1.8cm 2cm;
                size: A4 portrait;
              }
              .last-section-wrapper {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .signature-section {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .agenda-item {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              line-height: 1.5;
              padding: 20px;
              background-color: #ffffff;
            }
            
            .letterhead {
              text-align: center;
              line-height: 1.4;
              margin-bottom: 10px;
            }
            .letterhead h2 {
              font-size: 16px;
              font-weight: bold;
              margin: 0 0 4px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .letterhead .reg-num {
              font-size: 12px;
              font-weight: bold;
              margin: 0 0 4px 0;
            }
            .letterhead .address {
              font-size: 12px;
              margin: 0;
            }
            
            .divider {
              border: 0;
              border-top: 1.5px solid #000;
              margin: 15px 0 25px 0;
            }
            
            .doc-title {
              text-align: center;
              font-weight: bold;
              font-size: 14px;
              line-height: 1.5;
              margin-bottom: 30px;
              text-transform: uppercase;
            }
            
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 13px;
            }
            .meta-table td {
              padding: 4px 0;
              vertical-align: top;
            }
            
            .section-label {
              font-size: 13px;
              font-weight: bold;
              margin-top: 25px;
              margin-bottom: 8px;
            }
            
            .attendance-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            .attendance-table th, .attendance-table td {
              border: 1px solid #000;
              padding: 6px 10px;
              font-size: 12px;
              text-align: left;
            }
            .attendance-table th {
              font-weight: bold;
              text-align: center;
            }
            
            .attendance-table-hadir th {
              background-color: #bfe8ff !important;
            }
            .attendance-table-tidak-hadir th {
              background-color: #ffffff !important;
            }
            
            .signature-section {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
              page-break-inside: avoid;
              break-inside: avoid;
              font-size: 13px;
            }
            .signature-box {
              width: 45%;
            }
          </style>
        </head>
        <body>
          <!-- Organisation Letterhead -->
          <div class="letterhead">
            <div style="text-align: center; margin-bottom: 12px;">
              <div style="width: 75px; height: 75px; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: #064e3b; color: white; border-radius: 50%; font-weight: 900; font-size: 20px;">SMAUJ</div>
            </div>
            <h2>SEKOLAH MENENGAH AGAMA ULU JEMPOL<br>ULU JEMPOL, 72200 BATU KIKIR, NEGERI SEMBILAN</h2>
            <p class="reg-num">Kod Sekolah: NFT6001 | Portal Rasmi SMAUJ</p>
            <p class="address">D/A Pejabat Sekolah Menengah Agama Ulu Jempol<br>72200 Batu Kikir, Negeri Sembilan Darul Khusus</p>
          </div>
          
          <hr class="divider" />
          
          <!-- Document Title -->
          <div class="doc-title">
            ${selectedMinute.type === 'agung_khas' ? 'MINIT MESYUARAT AGUNG TAHUNAN PIBG' : 'MINIT MESYUARAT PENGURUSAN SEKOLAH'}<br>
            SEKOLAH MENENGAH AGAMA ULU JEMPOL<br>
            ${getBil()}
          </div>
          
          <!-- Meta Info Table -->
          <table class="meta-table">
            <tr>
              <td style="width: 18%; font-weight: bold;">Tarikh</td>
              <td style="width: 3%; font-weight: bold; text-align: center;">:</td>
              <td style="width: 79%;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Masa</td>
              <td style="font-weight: bold; text-align: center;">:</td>
              <td>${selectedMinute.time}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Tempat</td>
              <td style="font-weight: bold; text-align: center;">:</td>
              <td>${selectedMinute.venue}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Pengerusi</td>
              <td style="font-weight: bold; text-align: center;">:</td>
              <td>${selectedMinute.chairperson}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Pencatat Minit</td>
              <td style="font-weight: bold; text-align: center;">:</td>
              <td>${selectedMinute.preparedBy}${selectedMinute.preparedByRole ? ` (${selectedMinute.preparedByRole})` : ''}</td>
            </tr>
            <tr style="height: 10px;"></tr>
            <tr>
              <td style="font-weight: bold;">Kehadiran</td>
              <td style="font-weight: bold; text-align: center;">:</td>
              <td>${hadirCount} orang</td>
            </tr>
            <tr>
              <td style="font-weight: bold; white-space: nowrap;">
                ${selectedMinute.type === 'agung_khas' ? 'Jumlah Ahli' : 'Jumlah Ahli Jawatankuasa'}
              </td>
              <td style="font-weight: bold; text-align: center;">:</td>
              <td>${totalCount} orang</td>
            </tr>
          </table>
          
          <!-- Attendance Hadir Table -->
          <p class="section-label">
            ${selectedMinute.type === 'agung_khas' ? 'Senarai Ahli Yang Hadir :-' : 'Senarai Ahli Jawatankuasa Yang Hadir :'}
          </p>
          <table class="attendance-table attendance-table-hadir">
            <thead>
              <tr>
                <th style="width: 8%; text-align: center;">Bil.</th>
                <th style="width: 62%; text-align: left;">Nama</th>
                <th style="width: 30%; text-align: left;">Jawatan</th>
              </tr>
            </thead>
            <tbody>
              ${hadirList.map((item, idx) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}.</td>
                  <td>${item.name}</td>
                  <td>${item.role}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <!-- Attendance Tidak Hadir Table -->
          ${tidakHadirList.length > 0 ? `
            <p class="section-label">
              ${selectedMinute.type === 'agung_khas' ? 'Senarai Ahli Yang Tidak Hadir :-' : 'Senarai Ahli Jawatankuasa Yang Tidak Hadir :'}
            </p>
            <table class="attendance-table attendance-table-tidak-hadir">
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">Bil.</th>
                  <th style="width: 62%; text-align: left;">Nama</th>
                  <th style="width: 30%; text-align: left;">Jawatan</th>
                </tr>
              </thead>
              <tbody>
                ${tidakHadirList.map((item, idx) => `
                  <tr>
                    <td style="text-align: center;">${idx + 1}.</td>
                    <td>${item.name}</td>
                    <td>${item.role} (Tidak Hadir)</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          <div style="page-break-after: always;"></div>
          
          <!-- Discussions & Agendas -->
          <div style="margin-top: 20px;">
            ${mainAgendasHtml}
            ${finalBlockHtml}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Detail Overlay View */}
      <AnimatePresence>
        {selectedMinute && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end p-0 sm:p-4"
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-4xl bg-white shadow-2xl h-full flex flex-col sm:rounded-2xl overflow-hidden text-slate-800"
            >
              {/* Overlay Header */}
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <button 
                    onClick={() => setSelectedMinute(null)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <span className="text-[10px] font-black tracking-widest uppercase text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded">
                      {selectedMinute.type === 'agung_khas' ? 'Agung Khas' : 'Jawatankuasa'}
                    </span>
                    <h3 className="text-xs sm:text-sm font-black line-clamp-1 mt-0.5 uppercase tracking-wide">
                      Dokumen Minit Mesyuarat
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSecretaryOrAdmin && (
                    <>
                      <button 
                        onClick={() => handleStartEdit(selectedMinute)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 text-white"
                      >
                        <Edit2 size={13} className="stroke-[2.5]" />
                        <span>Edit Minit</span>
                      </button>
                      <button 
                        onClick={(e) => handleDeleteClick(selectedMinute.id, selectedMinute.title, e)}
                        className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-600 border border-rose-500/40 hover:border-rose-600 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 text-rose-300 hover:text-white"
                      >
                        <Trash2 size={13} className="stroke-[2.5]" />
                        <span>Padam Minit</span>
                      </button>
                    </>
                  )}
                  <button 
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 text-white"
                  >
                    <Printer size={13} className="stroke-[2.5]" />
                    <span>Cetak Minit</span>
                  </button>
                  <button 
                    onClick={() => setSelectedMinute(null)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Printable-style Container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-slate-50 font-sans">
                {/* Official White Page Document */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-12 space-y-8 max-w-3xl mx-auto min-h-[11in] relative">
                  
                  {/* Official Letterhead Simulation */}
                  <div className="text-center border-b-4 border-double border-slate-300 pb-5 space-y-1">
                    <div className="flex justify-center mb-2">
                      <AssociationLogo size={60} className="border-2 border-slate-200" />
                    </div>
                    <h1 className="font-black text-sm sm:text-base text-slate-950 tracking-wider uppercase">
                      SEKOLAH MENENGAH AGAMA ULU JEMPOL
                    </h1>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      KOD SEKOLAH: NFT6001 | ULU JEMPOL, 72200 BATU KIKIR, NEGERI SEMBILAN
                    </p>
                    <span className="inline-block border-2 border-emerald-800 text-emerald-800 text-[9px] font-black px-4 py-0.5 rounded mt-2 bg-emerald-50 uppercase tracking-wider">
                      {selectedMinute.type === 'agung_khas' ? 'MINIT MESYUARAT AGUNG TAHUNAN PIBG' : 'MINIT MESYUARAT PENGURUSAN SEKOLAH'}
                    </span>
                  </div>

                  {/* Document Title */}
                  <h2 className="text-center font-extrabold text-xs sm:text-sm text-slate-900 leading-relaxed uppercase tracking-wide border-b border-slate-100 pb-4">
                    {selectedMinute.title}
                  </h2>

                  {/* Meta Grid info boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-start gap-2.5">
                      <Calendar className="text-slate-400 shrink-0 mt-0.5" size={15} />
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Hari & Tarikh</span>
                        <span className="font-bold text-slate-800">
                          {new Date(selectedMinute.date).toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-start gap-2.5">
                      <Clock className="text-slate-400 shrink-0 mt-0.5" size={15} />
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Masa Kehadiran</span>
                        <span className="font-bold text-slate-800">{selectedMinute.time}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-start gap-2.5">
                      <MapPin className="text-slate-400 shrink-0 mt-0.5" size={15} />
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tempat Mesyuarat</span>
                        <span className="font-bold text-slate-800">{selectedMinute.venue}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-start gap-2.5">
                      <User className="text-slate-400 shrink-0 mt-0.5" size={15} />
                      <div>
                        <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase block">Dipengerusikan Oleh</span>
                        <span className="font-bold text-slate-800">{selectedMinute.chairperson}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Section */}
                  <div className="space-y-3">
                    <h3 className="font-black text-xs text-slate-900 border-l-4 border-slate-900 pl-2 uppercase tracking-wider">
                      1.0 Senarai Kehadiran Ahli Jawatankuasa
                    </h3>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-wider border-b border-slate-200">
                            <th className="py-2.5 px-3.5 text-center w-12">Bil</th>
                            <th className="py-2.5 px-4">Nama Jawatankuasa</th>
                            <th className="py-2.5 px-4">Peranan / Jawatan</th>
                            <th className="py-2.5 px-4 text-center w-28">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {sortAttendance(selectedMinute.attendance || []).map((member, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-4 font-bold text-slate-800">{member.name}</td>
                              <td className="py-2.5 px-4 font-semibold text-slate-500">{member.role}</td>
                              <td className="py-2.5 px-4 text-center">
                                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                  member.status === 'Hadir' 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' 
                                    : member.status === 'Bersebab' 
                                      ? 'bg-amber-50 text-amber-600 border border-amber-150' 
                                      : 'bg-rose-50 text-rose-600 border border-rose-150'
                                }`}>
                                  {member.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Discussion Agendas */}
                  <div className="space-y-4">
                    <h3 className="font-black text-xs text-slate-900 border-l-4 border-slate-900 pl-2 uppercase tracking-wider">
                      2.0 Perbincangan & Agenda Mesyuarat
                    </h3>

                    <div className="space-y-6 pt-2">
                      {selectedMinute.agendas.map((agenda, idx) => {
                        const isLast = (idx === selectedMinute.agendas.length - 1);
                        return (
                          <div key={idx} className="space-y-2 pb-5 border-b border-dashed border-slate-150 last:border-0 last:pb-0">
                            <h4 className="font-extrabold text-xs text-slate-950 flex gap-2">
                              <span>{agenda.number}</span>
                              <span>{agenda.title}</span>
                            </h4>

                            {agenda.formatType === 'pindaan' && agenda.pindaans && agenda.pindaans.length > 0 ? (
                              <div className="space-y-4 pl-6 mt-2">
                                <div className="space-y-4">
                                  {agenda.pindaans.map((pindaan, pIdx) => (
                                    <div key={pIdx} className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3 shadow-2xs">
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 uppercase tracking-wider">
                                          Cadangan Pindaan {pIdx + 1}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-xs text-slate-700">
                                        <div>
                                          <span className="font-black text-slate-400 text-[9px] uppercase tracking-wider block">Dicadang oleh</span>
                                          <span className="font-bold text-slate-900">{pindaan.proposedBy || '-'}</span>
                                        </div>
                                        <div>
                                          <span className="font-black text-slate-400 text-[9px] uppercase tracking-wider block">Fasal</span>
                                          <span className="font-bold text-slate-900">{pindaan.clause || '-'}</span>
                                        </div>
                                        <div className="md:col-span-2 bg-white border border-slate-150 rounded-lg p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-3xs">
                                          <div>
                                            <span className="font-black text-slate-400 text-[9px] uppercase tracking-wider block mb-0.5">Asal</span>
                                            <span className="font-semibold text-slate-800 whitespace-pre-wrap">{pindaan.original || '-'}</span>
                                          </div>
                                          <div>
                                            <span className="font-black text-indigo-500 text-[9px] uppercase tracking-wider block mb-0.5">Dipinda kepada</span>
                                            <span className="font-extrabold text-indigo-950 whitespace-pre-wrap">{pindaan.amended || '-'}</span>
                                          </div>
                                        </div>
                                        <div>
                                          <span className="font-black text-slate-400 text-[9px] uppercase tracking-wider block">Keputusan</span>
                                          <span className="font-bold text-slate-900">{pindaan.decision || '-'}</span>
                                        </div>
                                        <div>
                                          <span className="font-black text-slate-400 text-[9px] uppercase tracking-wider block">Tindakan</span>
                                          <span className="font-black text-rose-600 uppercase tracking-wide bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 text-[9px] inline-block">{pindaan.actionBy || 'Setiausaha'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {agenda.conclusion && (
                                  <div className="mt-3 flex gap-2.5 text-xs text-slate-700 leading-relaxed bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5">
                                    <span className="font-black text-indigo-600 bg-indigo-100 border border-indigo-150 rounded px-1.5 py-0.5 text-[9px] h-fit">
                                      {idx + 1}.1
                                    </span>
                                    <span className="whitespace-pre-wrap font-bold text-indigo-950">{agenda.conclusion}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                {agenda.points && agenda.points.length > 0 ? (
                                  <div className="space-y-3.5 pl-6 mt-1.5">
                                    {agenda.points.map((pt, ptIdx) => {
                                      const hasTable = pt.table && Array.isArray(pt.table.headers) && pt.table.headers.length > 0;
                                      return (
                                        <div key={ptIdx} className="space-y-2">
                                          <div className="flex gap-2 text-xs text-slate-700 leading-relaxed">
                                            <span className="font-bold text-slate-400 shrink-0">{idx + 1}.{ptIdx + 1}</span>
                                            <div className="flex-1 space-y-2 min-w-0">
                                              {(pt.text || !hasTable) && (
                                                <span className="whitespace-pre-wrap font-medium block">
                                                  {pt.text || 'Tiada perbincangan khusus dicatatkan.'}
                                                </span>
                                              )}
                                              {hasTable && pt.table && (
                                                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-3xs">
                                                  <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-extrabold">
                                                        {pt.table.headers.map((hdr, cIdx) => (
                                                          <th key={cIdx} className="py-2 px-3 border-r border-slate-200 last:border-r-0">
                                                            {hdr || `Kolum ${cIdx + 1}`}
                                                          </th>
                                                        ))}
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 bg-white">
                                                      {(pt.table.rows || []).map((row, rIdx) => (
                                                        <tr key={rIdx} className="hover:bg-slate-50/60">
                                                          {(row.cells || []).map((cell, cIdx) => (
                                                            <td key={cIdx} className="py-2 px-3 border-r border-slate-200 last:border-r-0 text-slate-700 font-medium whitespace-pre-wrap align-top">
                                                              {cell}
                                                            </td>
                                                          ))}
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          {(idx !== 0 && pt.actionBy) && (
                                            <div className="pl-6 flex items-center gap-2 text-[9px] font-black text-rose-600 uppercase tracking-wider">
                                              <span className="bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">Tindakan: {pt.actionBy}</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-xs text-slate-600 leading-relaxed pl-6 whitespace-pre-wrap font-medium">
                                      {agenda.description || 'Tiada perbincangan khusus dicatatkan.'}
                                    </p>

                                    {agenda.decision && (
                                      <div className="ml-6 mt-2 bg-slate-50 border-l-4 border-indigo-500 rounded-r-lg p-2.5 text-xs text-slate-700 font-medium">
                                        <span className="font-black text-slate-900 text-[10px] uppercase tracking-wider block mb-0.5">Keputusan / Persetujuan:</span>
                                        {agenda.decision}
                                      </div>
                                    )}

                                    {(idx !== 0 && agenda.actionBy) && (
                                      <div className="ml-6 mt-1.5 flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-wider">
                                        <span className="bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">Tindakan: {agenda.actionBy}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Document Signature Sign-off */}
                  <div className="grid grid-cols-2 gap-8 pt-10 border-t border-slate-200">
                    <div className="space-y-10">
                      <div className="text-xs space-y-1 text-slate-600">
                        <p>Disediakan oleh,</p>
                        <br /><br />
                        <span className="block font-mono text-[10px] text-slate-300 italic">Ditandatangani secara digital</span>
                        <strong className="block text-slate-800 text-xs tracking-wide">______________________________</strong>
                        <p className="font-extrabold text-slate-800 leading-none pt-1">{selectedMinute.preparedBy}</p>
                        <p className="text-[10px] font-bold text-slate-400">{selectedMinute.preparedByRole}</p>
                      </div>
                    </div>

                    <div className="space-y-10">
                      <div className="text-xs space-y-1 text-slate-600">
                        <p>Disahkan oleh,</p>
                        <br /><br />
                        <span className="block font-mono text-[10px] text-slate-300 italic">Ditandatangani secara digital</span>
                        <strong className="block text-slate-800 text-xs tracking-wide">______________________________</strong>
                        <p className="font-extrabold text-slate-800 leading-none pt-1">{selectedMinute.confirmedBy}</p>
                        <p className="text-[10px] font-bold text-slate-400">{selectedMinute.confirmedByRole}</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-rose-50 p-4 flex items-center gap-3 border-b border-rose-100">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-650 shrink-0">
                  <Trash2 size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                    Sahkan Pemadaman
                  </h3>
                  <p className="text-[10px] text-rose-500 font-extrabold uppercase tracking-wider leading-none mt-0.5">
                    Tindakan Tidak Boleh Diundur
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="ml-auto p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-100/50 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-3.5">
                <p className="text-xs text-slate-600 font-bold leading-relaxed">
                  Adakah anda pasti mahu memadam minit mesyuarat ini secara kekal dari pangkalan data?
                </p>
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-slate-800 font-extrabold text-xs">
                  {deleteTarget.title}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-slate-50 p-4 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-extrabold uppercase tracking-wider rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteMinute}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-xs hover:shadow-rose-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} className="stroke-[2.5]" />
                  <span>Padam Minit</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Section view content */}
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer shadow-3xs"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <FileCheck className="text-indigo-600 stroke-[2.5]" size={20} />
                Minit Mesyuarat Rasmi
              </h2>
              <p className="text-xs text-slate-400 font-bold">
                Pengurusan dan arkib minit mesyuarat Sekolah Menengah Agama Ulu Jempol (SMAUJ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {isSecretaryOrAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setFormType(activeTab);
                  setShowAddForm(true);
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>Tambah Minit</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-100 p-1 rounded-2xl flex max-w-md border border-slate-200/50">
          <button
            onClick={() => setActiveTab('agung_khas')}
            className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              activeTab === 'agung_khas' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Minit Agung Khas
          </button>
          <button
            onClick={() => setActiveTab('jawatankuasa')}
            className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              activeTab === 'jawatankuasa' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Minit Jawatankuasa
          </button>
        </div>

        {/* Search, Filter bar */}
        {!showAddForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari minit mengikut tajuk, tempat, tarikh, atau agenda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-600 text-slate-800 font-bold bg-slate-50/20"
              />
            </div>
          </div>
        )}

        {/* Adding Form Block */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                  {editingId ? "Modul Kemas Kini Data Setiausaha" : "Modul Kemasukan Data Setiausaha"}
                </span>
                <button 
                  onClick={() => { resetForm(); setShowAddForm(false); }}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateMinutes} className="p-4 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      {editingId ? "Kemas Kini Minit Mesyuarat" : "Rekod Minit Mesyuarat Baharu"}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold">
                      {editingId ? "Kemas kini butiran minit mesyuarat di bawah." : "Masukkan maklumat minit mesyuarat mengikut format rasmi persatuan."}
                    </p>
                  </div>
                  
                  {/* AI Minutes Assistant Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowAIAssistant(!showAIAssistant)}
                    className="self-start sm:self-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer bg-indigo-600"
                  >
                    <Sparkles size={14} className="animate-pulse text-yellow-300 fill-yellow-300" />
                    <span>{showAIAssistant ? "Tutup Pembantu AI" : "Susun Minit Dengan AI"}</span>
                  </button>
                </div>

                {/* AI Assistant Panel */}
                <AnimatePresence>
                  {showAIAssistant && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 space-y-4 shadow-3xs overflow-hidden"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                          <Sparkles size={16} className="text-indigo-600 fill-indigo-200" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Pembantu Transkripsi & Agenda AI (Setiausaha)
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Sediakan senarai agenda perbincangan, kemudian masukkan transkripsi suara atau nota mesyuarat yang panjang. AI akan menyusun ulasan, keputusan, dan menetapkan tindakan secara automatik untuk setiap agenda.
                          </p>
                        </div>
                      </div>

                      {/* AI Agendas List */}
                      <div className="space-y-2 border-t border-slate-150 pt-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Senarai Agenda Mesyuarat (AI)
                          </label>
                          <button
                            type="button"
                            onClick={handleAddAiAgenda}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Plus size={11} className="stroke-[3]" />
                            <span>Tambah Agenda</span>
                          </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {aiAgendas.map((agenda, index) => (
                            <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-3xs">
                              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 shrink-0 min-w-[75px] text-center">
                                Agenda {index + 1}
                              </span>
                              <input
                                type="text"
                                required
                                placeholder={
                                  index === 0 
                                    ? "Ucapan Aluan Pengerusi" 
                                    : index === aiAgendas.length - 1 
                                      ? "Penangguhan mesyuarat pada jam..." 
                                      : "Masukkan perkara agenda..."
                                }
                                value={agenda}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAiAgendas(prev => prev.map((item, i) => i === index ? val : item));
                                }}
                                className="flex-1 text-xs font-bold text-slate-800 bg-transparent border-none outline-hidden focus:ring-0 p-1 font-bold"
                              />
                              {aiAgendas.length > 2 && index !== 0 && index !== aiAgendas.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAiAgenda(index)}
                                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium italic">
                          * Agenda bermula dengan Agenda 1 iaitu "Ucapan Aluan Pengerusi" dan diakhiri dengan agenda terakhir iaitu "Penangguhan mesyuarat pada jam sekian sekian". Sila tambah atau kemas kini agenda di atas sebelum menjana.
                        </p>
                      </div>

                      {/* Transcript Input */}
                      <div className="space-y-1.5 border-t border-slate-150 pt-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          Teks Transkripsi / Catatan Perbincangan Mesyuarat <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={6}
                          required
                          placeholder="Masukkan transkripsi atau catatan mesyuarat yang panjang untuk dianalisa..."
                          value={aiTranscript}
                          onChange={(e) => setAiTranscript(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 bg-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* AI Actions */}
                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-150">
                        <button
                          type="button"
                          onClick={() => {
                            setAiAgendas(['Ucapan Aluan Pengerusi', 'Penangguhan mesyuarat pada jam 10:30 malam']);
                            setAiTranscript('');
                            setShowAIAssistant(false);
                            setAiError(null);
                          }}
                          className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Batal & Set Semula
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateMinitWithAI}
                          disabled={isGeneratingAI || !aiTranscript.trim() || aiAgendas.some(a => !a.trim())}
                          className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                          {isGeneratingAI ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Menganalisis & Menyusun...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} className="fill-white" />
                              <span>Jana AI Minit Mesyuarat</span>
                            </>
                          )}
                        </button>
                      </div>

                      {aiError && (
                        <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-150 p-2.5 rounded-lg mt-2">
                          ⚠️ Ralat: {aiError}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {aiSuccess && (
                  <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
                    <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                    <span>Minit mesyuarat telah berjaya dianalisis dan dimasukkan secara automatik ke dalam ruangan input agenda di bawah!</span>
                  </div>
                )}

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Tajuk Minit Mesyuarat <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Minit Mesyuarat Jawatankuasa Kali Ke-5/2026..."
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Tarikh <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Masa <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 08:30 Malam - 10:30 Malam"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Tempat / Lokasi <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Bilik Mesyuarat Balai Raya Komuniti"
                      value={formVenue}
                      onChange={(e) => setFormVenue(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Dipengerusikan Oleh <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formChairperson}
                      onChange={(e) => setFormChairperson(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* AJK Attendance Selection */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      Kaedah Kemasukan Senarai Kehadiran
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Pilih sama ada mahu memuatkan senarai kehadiran daripada Notis Panggilan sedia ada atau mengisi secara manual.
                    </p>
                  </div>

                  <div className="flex gap-2 bg-slate-100 p-1 rounded-xl max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceInputMethod('notis');
                      }}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        attendanceInputMethod === 'notis'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Pilih Notis Panggilan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceInputMethod('manual');
                      }}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        attendanceInputMethod === 'manual'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Isi Secara Manual
                    </button>
                  </div>

                  {attendanceInputMethod === 'notis' ? (
                    <div className="space-y-3.5 pt-2">
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Pilih Notis Panggilan Untuk Kehadiran
                        </label>
                        <select
                          value={selectedNoticeId}
                          onChange={(e) => handleNoticeSelection(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                        >
                          <option value="">-- Pilih Notis Panggilan --</option>
                          {notices
                            .filter(n => formType === 'agung_khas' ? n.type === 'agung_khas' : n.type === 'agung')
                            .map(notice => (
                              <option key={notice.id} value={notice.id}>
                                {notice.title} ({notice.meetingDate})
                              </option>
                            ))}
                        </select>
                      </div>

                      {formAttendance.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                              Senarai Kehadiran (Klik status untuk menukar)
                            </label>
                            <span className="text-[10px] text-indigo-600 font-bold">
                              {formAttendance.filter(a => a.status === 'Hadir').length} Hadir / {formAttendance.length} Jumlah
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                            {formAttendance.map((ajk, idx) => (
                              <div 
                                key={idx}
                                onClick={() => cycleAttendanceStatus(idx)}
                                className="bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{ajk.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 leading-none mt-0.5 truncate">{ajk.role}</p>
                                </div>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 select-none ${
                                  ajk.status === 'Hadir' 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' 
                                    : ajk.status === 'Bersebab' 
                                      ? 'bg-amber-50 text-amber-600 border border-amber-150' 
                                      : 'bg-rose-50 text-rose-600 border border-rose-150'
                                }`}>
                                  {ajk.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3.5 pt-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nonCommitteeRoles = ['Pelawat', 'Ahli Biasa', 'Ahli Bersekutu', 'Ahli Kehormat', 'Penduduk', 'Tetamu'];
                            const targetUsers = users.filter(user => {
                              const isAJK = !nonCommitteeRoles.includes(user.role);
                              const isNormalMember = user.role === 'Ahli Biasa';
                              if (formType === 'agung_khas') {
                                return isAJK || isNormalMember;
                              } else {
                                return isAJK;
                              }
                            });

                            const prepopulated = targetUsers.map(user => ({
                              name: user.displayName || user.nickname || 'Ahli Tanpa Nama',
                              role: user.role || 'Ahli Biasa',
                              status: 'Hadir' as const
                            }));

                            setFormAttendance(sortAttendance(prepopulated));
                          }}
                          className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 text-center"
                        >
                          Muat Ahli Mengikut Peranan ({formType === 'agung_khas' ? 'Semua Ahli' : 'AJK Sahaja'})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormAttendance(prev => [...prev, { name: '', role: 'Penduduk', status: 'Hadir' }]);
                          }}
                          className="px-3 py-2 bg-emerald-650 hover:bg-emerald-700 text-white bg-emerald-600 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 text-center flex items-center justify-center gap-1.5"
                        >
                          <Plus size={13} className="stroke-[3]" />
                          Tambah Ahli Manual
                        </button>
                      </div>

                      {formAttendance.length > 0 ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Senarai Kehadiran Manual (Klik status untuk menukar / Edit nama & jawatan)
                          </label>

                          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                            {formAttendance.map((ajk, idx) => (
                              <div 
                                key={idx}
                                className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between"
                              >
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    placeholder="Nama Ahli"
                                    required
                                    value={ajk.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormAttendance(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                                    }}
                                    className="border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-slate-50/30 focus:outline-hidden focus:border-indigo-500"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Jawatan (Contoh: Pengerusi, Ahli Biasa)"
                                    required
                                    value={ajk.role}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormAttendance(prev => prev.map((item, i) => i === idx ? { ...item, role: val } : item));
                                    }}
                                    className="border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-slate-50/30 focus:outline-hidden focus:border-indigo-500"
                                  />
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => cycleAttendanceStatus(idx)}
                                    className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase border cursor-pointer select-none min-w-24 text-center transition-all ${
                                      ajk.status === 'Hadir' 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                                        : ajk.status === 'Bersebab' 
                                          ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' 
                                          : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                    }`}
                                  >
                                    {ajk.status}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormAttendance(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                                    title="Hapus Ahli"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2">
                          <Users className="text-slate-300" size={28} />
                          <p className="text-xs text-slate-400 font-bold">Senarai kehadiran kosong.</p>
                          <p className="text-[11px] text-slate-400 font-medium">Sila tambah ahli secara manual atau klik "Muat Ahli Mengikut Peranan".</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Agenda Discussion Items Builder */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      Agenda Perbincangan & Keputusan <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addAgendaRow}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle size={12} />
                      <span>Tambah Agenda</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formAgendas.map((agenda, idx) => (
                      <div key={idx} className="bg-slate-50/50 border border-slate-200 p-4 rounded-2xl space-y-3 relative">
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-150 rounded-md px-2 py-0.5">
                            AGENDA {agenda.number}
                          </span>
                          {formAgendas.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAgendaRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-white rounded transition-colors cursor-pointer border border-transparent hover:border-slate-150"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div className="space-y-1 md:col-span-2 max-w-sm">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Tajuk Agenda <span className="text-rose-500">*</span></label>
                            <input
                              type="text"
                              required
                              placeholder="Contoh: Perutusan Pengerusi / Laporan Keselamatan..."
                              value={agenda.title}
                              onChange={(e) => updateAgendaField(idx, 'title', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                            />
                          </div>

                          {/* Format Selector for Special General Meeting starting from Agenda 2.0 */}
                          {activeTab === 'agung_khas' && idx > 0 && (
                            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">
                                Format Perbincangan Agenda {agenda.number}:
                              </span>
                              <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => toggleAgendaFormat(idx, 'default')}
                                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${
                                    (!agenda.formatType || agenda.formatType === 'default')
                                      ? 'bg-white text-indigo-600 shadow-xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Format Perenggan Biasa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleAgendaFormat(idx, 'pindaan')}
                                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${
                                    (agenda.formatType === 'pindaan')
                                      ? 'bg-white text-indigo-600 shadow-xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Format Pindaan Perlembagaan
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTab === 'agung_khas' && idx > 0 && agenda.formatType === 'pindaan' ? (
                            <div className="md:col-span-2 space-y-4 border-t border-slate-100 pt-3">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                                  Senarai Cadangan Pindaan Perlembagaan Pertubuhan
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addPindaanRow(idx)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                >
                                  <Plus size={11} />
                                  <span>Tambah Cadangan Pindaan</span>
                                </button>
                              </div>

                              <div className="space-y-4">
                                {(agenda.pindaans || [{ proposedBy: '', clause: '', original: '', amended: '', decision: 'Dipersetujui oleh majoriti ahli', actionBy: 'Setiausaha' }]).map((pindaan, pidx) => (
                                  <div key={pidx} className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-2xs relative">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5">
                                        Cadangan Pindaan {pidx + 1}
                                      </span>
                                      {((agenda.pindaans || []).length > 1) && (
                                        <button
                                          type="button"
                                          onClick={() => removePindaanRow(idx, pidx)}
                                          className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block">Dicadang oleh</label>
                                        <input
                                          type="text"
                                          required
                                          placeholder="Contoh: Azimah Binti Mohd Zainuddin"
                                          value={pindaan.proposedBy}
                                          onChange={(e) => updatePindaanField(idx, pidx, 'proposedBy', e.target.value)}
                                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block">Fasal</label>
                                        <input
                                          type="text"
                                          required
                                          placeholder="Contoh: 6(1)"
                                          value={pindaan.clause}
                                          onChange={(e) => updatePindaanField(idx, pidx, 'clause', e.target.value)}
                                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block">Asal</label>
                                        <textarea
                                          rows={2}
                                          required
                                          placeholder="Contoh: Bayaran masuk : RM 1.00"
                                          value={pindaan.original}
                                          onChange={(e) => updatePindaanField(idx, pidx, 'original', e.target.value)}
                                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block">Dipinda kepada</label>
                                        <textarea
                                          rows={2}
                                          required
                                          placeholder="Contoh: Bayaran masuk : RM 10.00"
                                          value={pindaan.amended}
                                          onChange={(e) => updatePindaanField(idx, pidx, 'amended', e.target.value)}
                                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block">Keputusan</label>
                                        <input
                                          type="text"
                                          required
                                          placeholder="Contoh: Dipersetujui oleh majoriti ahli"
                                          value={pindaan.decision}
                                          onChange={(e) => updatePindaanField(idx, pidx, 'decision', e.target.value)}
                                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block">Tindakan</label>
                                        <input
                                          type="text"
                                          required
                                          placeholder="Contoh: Setiausaha"
                                          value={pindaan.actionBy}
                                          onChange={(e) => updatePindaanField(idx, pidx, 'actionBy', e.target.value)}
                                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                                    {idx + 1}.1
                                  </span>
                                  <label className="text-[9px] font-black text-slate-400 uppercase block">Perenggan Penutup / Kesimpulan Agenda</label>
                                </div>
                                <textarea
                                  rows={2}
                                  required
                                  placeholder="Mesyuarat sebulat suara bersetuju dengan cadangan pindaan yang dibentangkan."
                                  value={agenda.conclusion || 'Mesyuarat sebulat suara bersetuju dengan cadangan pindaan yang dibentangkan.'}
                                  onChange={(e) => updateAgendaField(idx, 'conclusion', e.target.value)}
                                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                                />
                              </div>
                            </div>
                          ) : (
                            /* Sub-No Points List */
                            <div className="md:col-span-2 space-y-3.5 border-t border-slate-100 pt-3">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                  Senarai Sub-No / Perenggan
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addSubPoint(idx)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                >
                                  <Plus size={11} />
                                  <span>Tambah Sub-No</span>
                                </button>
                              </div>

                              <div className="space-y-3">
                                {(agenda.points || [{ text: '', actionBy: '' }]).map((pt, ptIdx) => {
                                  const hasTable = Boolean(pt.table && Array.isArray(pt.table.headers) && pt.table.headers.length > 0);
                                  return (
                                    <div key={ptIdx} className="bg-white border border-slate-250 p-3 rounded-xl space-y-3 shadow-2xs relative">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                                            {idx + 1}.{ptIdx + 1}
                                          </span>
                                          {!hasTable && (
                                            <button
                                              type="button"
                                              onClick={() => addSubPointTable(idx, ptIdx)}
                                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                            >
                                              <Table size={11} />
                                              <span>+ Tambah Jadual</span>
                                            </button>
                                          )}
                                        </div>
                                        {((agenda.points || []).length > 1) && (
                                          <button
                                            type="button"
                                            onClick={() => removeSubPoint(idx, ptIdx)}
                                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className={`${(idx === 0 || idx === formAgendas.length - 1) ? 'md:col-span-3' : 'md:col-span-2'} space-y-1`}>
                                          <label className="text-[9px] font-black text-slate-400 uppercase">Perbincangan / Ulasan / Keputusan</label>
                                          <textarea
                                            rows={2}
                                            required={!hasTable}
                                            placeholder="Tulis huraian perbincangan atau keputusan untuk perenggan ini..."
                                            value={pt.text}
                                            onChange={(e) => updateSubPointField(idx, ptIdx, 'text', e.target.value)}
                                            className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                                          />
                                        </div>
                                        {(idx !== 0 && idx !== formAgendas.length - 1) && (
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Tindakan</label>
                                            <input
                                              type="text"
                                              placeholder="Contoh: Setiausaha / Makluman"
                                              value={pt.actionBy}
                                              onChange={(e) => updateSubPointField(idx, ptIdx, 'actionBy', e.target.value)}
                                              className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {/* Interactive Table Builder for Sub-No */}
                                      {hasTable && pt.table && (
                                        <div className="border border-indigo-100 bg-slate-50/70 rounded-xl p-3 space-y-2.5">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <Table size={13} className="text-indigo-600" />
                                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                                                Jadual Data Sub-No {idx + 1}.{ptIdx + 1}
                                              </span>
                                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                                Baris Pertama = Tajuk Header
                                              </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => addSubPointTableColumn(idx, ptIdx)}
                                                className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                              >
                                                <Plus size={10} />
                                                <span>Tambah Kolum</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => addSubPointTableRow(idx, ptIdx)}
                                                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                              >
                                                <Plus size={10} />
                                                <span>Tambah Baris (Row)</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => removeSubPointTable(idx, ptIdx)}
                                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                                title="Padam Jadual"
                                              >
                                                <Trash2 size={10} />
                                                <span>Padam Jadual</span>
                                              </button>
                                            </div>
                                          </div>

                                          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-3xs">
                                            <table className="w-full border-collapse text-xs min-w-[450px]">
                                              <thead>
                                                <tr className="bg-indigo-50/70 border-b-2 border-indigo-100">
                                                  <th className="w-20 py-2 px-2.5 text-left text-[9px] font-black text-indigo-700 uppercase tracking-wider border-r border-indigo-100 bg-indigo-100/60">
                                                    Header
                                                  </th>
                                                  {pt.table.headers.map((headerText, colIdx) => (
                                                    <th key={colIdx} className="p-1.5 border-r border-indigo-100 last:border-r-0 min-w-[130px]">
                                                      <div className="flex items-center gap-1">
                                                        <input
                                                          type="text"
                                                          placeholder={`Tajuk Header ${colIdx + 1}`}
                                                          value={headerText}
                                                          onChange={(e) => updateSubPointTableHeader(idx, ptIdx, colIdx, e.target.value)}
                                                          className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-md px-2 py-1.5 text-xs font-extrabold text-slate-900 placeholder:font-medium placeholder:text-slate-400 focus:outline-hidden"
                                                        />
                                                        {pt.table!.headers.length > 1 && (
                                                          <button
                                                            type="button"
                                                            onClick={() => removeSubPointTableColumn(idx, ptIdx, colIdx)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0 cursor-pointer"
                                                            title={`Padam Kolum ${colIdx + 1}`}
                                                          >
                                                            <X size={12} />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </th>
                                                  ))}
                                                  <th className="w-10 bg-indigo-100/60"></th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-200">
                                                {pt.table.rows.map((row, rowIdx) => (
                                                  <tr key={rowIdx} className="hover:bg-slate-50/50">
                                                    <td className="py-2 px-2.5 text-[10px] font-black text-slate-400 uppercase border-r border-slate-200 bg-slate-50/60 whitespace-nowrap">
                                                      Baris {rowIdx + 1}
                                                    </td>
                                                    {pt.table!.headers.map((_, colIdx) => (
                                                      <td key={colIdx} className="p-1.5 border-r border-slate-200 last:border-r-0">
                                                        <input
                                                          type="text"
                                                          placeholder={`Data baris ${rowIdx + 1}, kolum ${colIdx + 1}...`}
                                                          value={row.cells[colIdx] || ''}
                                                          onChange={(e) => updateSubPointTableCell(idx, ptIdx, rowIdx, colIdx, e.target.value)}
                                                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:outline-hidden"
                                                        />
                                                      </td>
                                                    ))}
                                                    <td className="p-1.5 text-center bg-slate-50/30">
                                                      {pt.table!.rows.length > 1 && (
                                                        <button
                                                          type="button"
                                                          onClick={() => removeSubPointTableRow(idx, ptIdx, rowIdx)}
                                                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                          title={`Padam Baris ${rowIdx + 1}`}
                                                        >
                                                          <Trash2 size={12} />
                                                        </button>
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification box */}
                <div className="border-t border-slate-200 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Nama Penyedia Minit (Setiausaha)</label>
                      <input
                        type="text"
                        value={formPreparedBy}
                        onChange={(e) => setFormPreparedBy(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Nama Pengesah Minit (Pengerusi)</label>
                      <input
                        type="text"
                        value={formConfirmedBy}
                        onChange={(e) => setFormConfirmedBy(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Submitting Actions */}
                <div className="pt-4 flex justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => { resetForm(); setShowAddForm(false); }}
                    className="px-5 py-2.5 border border-slate-200 text-slate-700 text-xs font-extrabold uppercase tracking-wider rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>{editingId ? "Mengemas kini..." : "Menyimpan..."}</span>
                      </>
                    ) : (
                      <>
                        <FileCheck size={14} className="stroke-[3]" />
                        <span>{editingId ? "Kemas Kini Minit" : "Simpan Minit"}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minutes List Display */}
        {!showAddForm && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
                <Loader2 size={32} className="text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-400 font-bold">Memuatkan dokumen dari Firestore...</p>
              </div>
            ) : filteredMinutes.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-3xs max-w-md mx-auto flex flex-col items-center space-y-4 mt-6">
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner">
                  <FileText size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase">Tiada Dokumen Ditemui</h4>
                  <p className="text-xs text-slate-400 font-bold max-w-xs leading-relaxed">
                    Tiada rekod minit mesyuarat ditemui bagi carian anda atau kategori tab ini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMinutes.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedMinute(item)}
                    className="bg-white rounded-3xl border border-gray-150 p-5 shadow-3xs hover:border-indigo-200 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between h-56 group relative overflow-hidden"
                  >
                    {/* Background faint card badge */}
                    <div className="absolute right-[-15px] bottom-[-15px] opacity-5 text-slate-900 font-black text-8xl pointer-events-none uppercase">
                      {item.type === 'agung_khas' ? 'AK' : 'JK'}
                    </div>

                    <div className="space-y-3 relative z-10">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase border ${
                          item.type === 'agung_khas' 
                            ? 'bg-indigo-50 border-indigo-150 text-indigo-700' 
                            : 'bg-emerald-50 border-emerald-150 text-emerald-700'
                        }`}>
                          {item.type === 'agung_khas' ? 'Agung Khas' : 'Jawatankuasa'}
                        </span>

                        {isSecretaryOrAdmin && (
                          <div className="flex items-center gap-1 relative z-20">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(item);
                              }}
                              className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Minit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(item.id, item.title, e)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Padam Minit"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="font-black text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </h3>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-slate-100 relative z-10 text-[10px] text-slate-500 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>
                          {new Date(item.date).toLocaleDateString('ms-MY', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{item.venue}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                        <span>{item.agendas.length} AGENDA DIBINCANGKAN</span>
                        <span className="group-hover:translate-x-1 transition-transform inline-block">Buka &rarr;</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
