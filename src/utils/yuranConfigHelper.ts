import { ImageFeePackage } from '../types';

export interface AdditionalFeeAgePricing {
  dewasa?: { enabled: boolean; price: number };
  wargaEmas?: { enabled: boolean; price: number };
  kanakKanak?: { enabled: boolean; price: number };
}

export interface AdditionalFee {
  id: string;
  title: string;
  account: string;      // "Bank" or "Tunai"
  category: string;     // e.g. "Yuran Bulanan", "Sumbangan"
  price: number;
  feeType: 'Tahunan' | 'Bulanan';
  sessionYear?: string; // Sesi e.g., "2026/2027"
  months?: string[];    // e.g. ["Ogos 2026", "September 2026"]
  hasAgePricing: boolean;
  agePricing?: AdditionalFeeAgePricing;
  isCustomAmount?: boolean;
  assignedUids?: string[];
}

export interface YuranConfig {
  fpxCharge?: number; // Optional so we don't break old cached data
  fpxSurchargeMode?: boolean; // true = surcharge (caj tambahan), false = diserap (absorbed)
  enableManualPayment?: boolean; // true = aktif, false = dinyahaktifkan
  enableFPXPayment?: boolean;    // true = aktif, false = dinyahaktifkan
  enableMembershipRegistration?: boolean; // true = aktif, false = dinyahaktifkan
  manualBankName?: string;
  manualAccountName?: string;
  manualAccountNumber?: string;
  manualQrCodeUrl?: string;
  yuranKeahlian: {
    price: number;
  };
  yuranBulanan: {
    persatuan: number;
    khairat: number;
  };
  yuranPenggal: {
    persatuan: number;
    khairat: number;
    discount: number;
  };
  yuranTahunan: {
    persatuan: number;
    khairat: number;
    discount: number;
  };
  sesiList: {
    id: string; // e.g. "2026"
    name: string; // e.g. "Sesi 2026/2027"
    startMonth: number; // 1-indexed (1 to 12), e.g. 8 for August
    startYear: number; // e.g. 2026
  }[];
  additionalFees?: AdditionalFee[];
}

export const DEFAULT_YURAN_CONFIG: YuranConfig = {
  fpxCharge: 1.00,
  fpxSurchargeMode: true,
  enableManualPayment: true,
  enableFPXPayment: true,
  enableMembershipRegistration: true,
  manualBankName: "Bank Islam Malaysia Berhad (BIMB)",
  manualAccountName: "PIBG SEKOLAH MENENGAH AGAMA ULU JEMPOL",
  manualAccountNumber: "0505 8010 0123 45",
  manualQrCodeUrl: "",
  yuranKeahlian: {
    price: 30
  },
  yuranBulanan: {
    persatuan: 5,
    khairat: 5
  },
  yuranPenggal: {
    persatuan: 30,
    khairat: 30,
    discount: 5
  },
  yuranTahunan: {
    persatuan: 60,
    khairat: 60,
    discount: 20
  },
  sesiList: [
    {
      id: "2026",
      name: "Sesi 2026",
      startMonth: 1, // Bermula 1 Januari hingga 31 Disember
      startYear: 2026
    },
    {
      id: "2027",
      name: "Sesi 2027",
      startMonth: 1, // Bermula 1 Januari hingga 31 Disember
      startYear: 2027
    }
  ]
};

export const monthNamesMs = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

export const generate12Months = (startMonth: number, startYear: number) => {
  const months = [];
  let curMonth = startMonth;
  let curYear = startYear;
  
  for (let i = 0; i < 12; i++) {
    months.push({
      val: curMonth,
      year: curYear,
      name: `${monthNamesMs[curMonth - 1]} ${curYear}`
    });
    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }
  return months;
};

export const generatePackagesFromConfig = (config: YuranConfig, currentUserUid?: string | null): ImageFeePackage[] => {
  const defaultKeahlian: ImageFeePackage = {
    id: 'pkg-keahlian',
    name: 'Sumbangan PIBG / Pendaftaran Sesi Baharu',
    subtitle: 'Pendaftaran & keahlian PIBG',
    extraSubtitle: 'Sekolah Menengah Agama Ulu Jempol',
    price: config.yuranKeahlian.price,
    priceLabel: `RM${config.yuranKeahlian.price.toFixed(2)}`,
    isPaid: false,
    category: 'Keahlian' as const
  };

  const allPkgs: ImageFeePackage[] = [defaultKeahlian];

  config.sesiList.forEach((sesi) => {
    const months = generate12Months(sesi.startMonth, sesi.startYear);

    // Yuran Bulanan
    const totalBulanan = config.yuranBulanan.persatuan + config.yuranBulanan.khairat;
    const monthlyList = months.map((m) => ({
      id: `pkg-bulanan-${sesi.id}-${m.val.toString().padStart(2, '0')}`,
      name: `Yuran Bulanan - ${m.name}`,
      subtitle: 'Pembayaran bulanan biasa',
      extraSubtitle: `RM${totalBulanan.toFixed(2)} sebulan`,
      price: totalBulanan,
      priceLabel: `RM${totalBulanan.toFixed(2)}`,
      isPaid: false,
      category: 'Bulanan' as const,
      sessionYear: sesi.id,
      monthIndex: m.val,
      monthName: m.name,
      breakdown: {
        heartAmount: `RM${config.yuranBulanan.khairat.toFixed(2)}`,
        heartLabel: 'Khairat Kematian',
        usersAmount: `RM${config.yuranBulanan.persatuan.toFixed(2)}`,
        usersLabel: 'Yuran Persatuan'
      }
    }));

    // Yuran Perpenggal
    const totalPenggal = config.yuranPenggal.persatuan + config.yuranPenggal.khairat;
    const netPenggal = Math.max(0, totalPenggal - config.yuranPenggal.discount);
    const netPenggalPersatuan = Math.max(0, config.yuranPenggal.persatuan - config.yuranPenggal.discount);
    const penggalList: ImageFeePackage[] = [
      {
        id: `pkg-penggal-1-${sesi.id}`,
        name: `Penggal 1 (${months[0].name} - ${months[5].name})`,
        subtitle: 'Bayar 6 bulan pertama',
        extraSubtitle: `Diskaun RM${config.yuranPenggal.discount.toFixed(2)}`,
        price: netPenggal,
        priceLabel: `RM${netPenggal.toFixed(2)}`,
        isPaid: false,
        savingBadge: `Jimat RM${config.yuranPenggal.discount.toFixed(0)}`,
        category: 'Penggal' as const,
        sessionYear: sesi.id,
        penggalIndex: 1,
        breakdown: {
          heartAmount: `RM${config.yuranPenggal.khairat.toFixed(2)}`,
          heartLabel: 'Khairat Kematian',
          usersAmount: `RM${netPenggalPersatuan.toFixed(2)}`,
          usersLabel: 'Yuran Persatuan'
        }
      },
      {
        id: `pkg-penggal-2-${sesi.id}`,
        name: `Penggal 2 (${months[6].name} - ${months[11].name})`,
        subtitle: 'Bayar 6 bulan kedua',
        extraSubtitle: `Diskaun RM${config.yuranPenggal.discount.toFixed(2)}`,
        price: netPenggal,
        priceLabel: `RM${netPenggal.toFixed(2)}`,
        isPaid: false,
        savingBadge: `Jimat RM${config.yuranPenggal.discount.toFixed(0)}`,
        category: 'Penggal' as const,
        sessionYear: sesi.id,
        penggalIndex: 2,
        breakdown: {
          heartAmount: `RM${config.yuranPenggal.khairat.toFixed(2)}`,
          heartLabel: 'Khairat Kematian',
          usersAmount: `RM${netPenggalPersatuan.toFixed(2)}`,
          usersLabel: 'Yuran Persatuan'
        }
      }
    ];

    // Yuran PerTahun
    const totalTahunan = config.yuranTahunan.persatuan + config.yuranTahunan.khairat;
    const netTahunan = Math.max(0, totalTahunan - config.yuranTahunan.discount);
    const netTahunanPersatuan = Math.max(0, config.yuranTahunan.persatuan - config.yuranTahunan.discount);
    const tahunanPkg: ImageFeePackage = {
      id: `pkg-tahunan-${sesi.id}`,
      name: `Yuran Tahunan Sesi ${sesi.id}/${parseInt(sesi.id) + 1}`,
      subtitle: `${months[0].name} hingga ${months[11].name}`,
      extraSubtitle: `Diskaun RM${config.yuranTahunan.discount.toFixed(2)} setahun`,
      price: netTahunan,
      priceLabel: `RM${netTahunan.toFixed(2)} / tahun`,
      isPaid: false,
      savingBadge: `Jimat RM${config.yuranTahunan.discount.toFixed(0)}`,
      category: 'Tahunan' as const,
      sessionYear: sesi.id,
      breakdown: {
        heartAmount: `RM${config.yuranTahunan.khairat.toFixed(2)}`,
        heartLabel: 'Khairat Kematian',
        usersAmount: `RM${netTahunanPersatuan.toFixed(2)}`,
        usersLabel: 'Yuran Persatuan'
      }
    };

    allPkgs.push(...monthlyList, ...penggalList, tahunanPkg);
  });

  // Generate packages from custom additional fees
  if (config.additionalFees && Array.isArray(config.additionalFees)) {
    config.additionalFees.forEach((fee) => {
      // If the fee has a specific list of assigned uids, and a user is logged in,
      // and the user is NOT in that list, we should SKIP generating this package.
      if (fee.assignedUids && Array.isArray(fee.assignedUids) && fee.assignedUids.length > 0) {
        if (!currentUserUid || !fee.assignedUids.includes(currentUserUid)) {
          return;
        }
      }

      if (fee.feeType === 'Tahunan') {
        const sessYear = (fee.sessionYear || '2026').replace('Sesi ', '').split('/')[0].trim(); // e.g. "2026" from "Sesi 2026/2027"
        allPkgs.push({
          id: fee.id,
          name: fee.title,
          subtitle: `Yuran Tambahan Tahunan (Sesi ${fee.sessionYear})`,
          extraSubtitle: fee.hasAgePricing ? 'Perbezaan bayaran mengikut kategori umur' : fee.isCustomAmount ? 'Bayaran Ikut Suka' : undefined,
          price: fee.price,
          priceLabel: fee.isCustomAmount ? `RM${fee.price.toFixed(2)} (Ikut Suka)` : `RM${fee.price.toFixed(2)}`,
          isPaid: false,
          category: 'Tambahan',
          sessionYear: sessYear,
          isAdditional: true,
          hasAgePricing: fee.hasAgePricing,
          agePricing: fee.agePricing,
          selectedAgeQuantities: { dewasa: 0, wargaEmas: 0, kanakKanak: 0 },
          feeType: 'Tahunan',
          account: fee.account,
          realCategory: fee.category,
          isCustomAmount: fee.isCustomAmount,
          customCartAmount: fee.isCustomAmount ? fee.price : undefined
        });
      } else if (fee.feeType === 'Bulanan' && fee.months) {
        fee.months.forEach((m) => {
          // Parse month and year to match sessions
          // e.g. "Ogos 2026" -> sessionYear is 2026
          let sessYear = '2026';
          if (m.includes('2027')) {
            const firstHalf = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai'];
            const matchesFirstHalf = firstHalf.some(fh => m.startsWith(fh));
            sessYear = matchesFirstHalf ? '2026' : '2027';
          } else if (m.includes('2028')) {
            sessYear = '2027';
          }
          allPkgs.push({
            id: `${fee.id}-${m.replace(/\s+/g, '-')}`,
            name: `${fee.title} - ${m}`,
            subtitle: `Yuran Tambahan Bulanan`,
            extraSubtitle: fee.hasAgePricing ? 'Perbezaan bayaran mengikut kategori umur' : fee.isCustomAmount ? 'Bayaran Ikut Suka' : undefined,
            price: fee.price,
            priceLabel: fee.isCustomAmount ? `RM${fee.price.toFixed(2)} (Ikut Suka)` : `RM${fee.price.toFixed(2)}`,
            isPaid: false,
            category: 'Tambahan',
            sessionYear: sessYear,
            monthName: m,
            isAdditional: true,
            hasAgePricing: fee.hasAgePricing,
            agePricing: fee.agePricing,
            selectedAgeQuantities: { dewasa: 0, wargaEmas: 0, kanakKanak: 0 },
            feeType: 'Bulanan',
            account: fee.account,
            realCategory: fee.category,
            isCustomAmount: fee.isCustomAmount,
            customCartAmount: fee.isCustomAmount ? fee.price : undefined
          });
        });
      }
    });
  }

  return allPkgs;
};

export const getPackagePrice = (p: ImageFeePackage): number => {
  if (p.isCustomAmount && p.customCartAmount !== undefined) {
    return p.customCartAmount;
  }
  if (p.category === 'Tambahan' && p.hasAgePricing) {
    const q = p.selectedAgeQuantities || { dewasa: 0, wargaEmas: 0, kanakKanak: 0 };
    const pricing = p.agePricing;
    let sum = 0;
    if (pricing?.dewasa?.enabled) sum += (q.dewasa || 0) * (pricing.dewasa.price || 0);
    if (pricing?.wargaEmas?.enabled) sum += (q.wargaEmas || 0) * (pricing.wargaEmas.price || 0);
    if (pricing?.kanakKanak?.enabled) sum += (q.kanakKanak || 0) * (pricing.kanakKanak.price || 0);
    return sum;
  }
  return p.price;
};

export function detectActiveSessionYear(config?: YuranConfig, refDate?: Date): string {
  const d = refDate || new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  
  if (config?.sesiList && config.sesiList.length > 0) {
    const active = config.sesiList.find(s => 
      (s.startYear === year && month >= s.startMonth) || 
      (s.startYear === year - 1 && month < s.startMonth)
    );
    if (active) return active.id;

    // Fallback: if earlier than first session, return first session
    if (year < config.sesiList[0].startYear || (year === config.sesiList[0].startYear && month < config.sesiList[0].startMonth)) {
      return config.sesiList[0].id;
    }
    // Fallback: if later than last session, return last session
    return config.sesiList[config.sesiList.length - 1].id;
  }
  return year.toString();
}

export function getCategoryBadgeStyle(category: string = ''): string {
  const cat = category.trim().toLowerCase();

  if (cat.includes('penggal') || cat.includes('perpenggal')) {
    // Perpenggal -> Emerald / Green theme
    return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  } else if (cat.includes('tahunan')) {
    // Tahunan -> Teal theme
    return 'bg-teal-100 text-teal-900 border-teal-300';
  } else if (cat.includes('khairat')) {
    // Khairat Kematian -> Rose / Red theme
    return 'bg-rose-100 text-rose-800 border-rose-300';
  } else if (cat.includes('bulanan')) {
    // Yuran Bulanan -> Amber / Gold theme
    return 'bg-amber-100 text-amber-900 border-amber-300';
  } else if (cat.includes('keahlian')) {
    // Yuran Keahlian -> Indigo / Purple theme
    return 'bg-indigo-100 text-indigo-900 border-indigo-300';
  } else if (cat.includes('van jenazah')) {
    // Tabung Van Jenazah -> Emerald theme
    return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  } else if (cat.includes('kebajikan') && cat.includes('khairat')) {
    // Tabung Kebajikan & Khairat -> Teal theme
    return 'bg-teal-100 text-teal-900 border-teal-300';
  } else if (cat.includes('surau') || cat.includes('komuniti')) {
    // Tabung Surau & Komuniti -> Lime / Green theme
    return 'bg-lime-100 text-lime-900 border-lime-300';
  } else if (cat.includes('fasiliti') || cat.includes('taman')) {
    // Tabung Fasiliti & Taman -> Amber theme
    return 'bg-amber-100 text-amber-900 border-amber-300';
  } else if (cat.includes('kecemasan') || cat.includes('bencana')) {
    // Tabung Kecemasan & Bencana -> Red theme
    return 'bg-rose-100 text-rose-900 border-rose-300';
  } else if (cat.includes('pendidikan') || cat.includes('pelajar')) {
    // Tabung Pendidikan -> Blue / Indigo theme
    return 'bg-blue-100 text-blue-900 border-blue-300';
  } else if (cat.includes('sumbangan') || cat.includes('derma') || cat.includes('tabung')) {
    // Tabung Sumbangan Am -> Cyan theme
    return 'bg-cyan-100 text-cyan-900 border-cyan-300';
  } else if (cat.includes('sewaan')) {
    // Sewaan Dewan / Tapak -> Cyan / Sky theme
    return 'bg-sky-100 text-sky-900 border-sky-300';
  } else if (cat.includes('pindahan') || cat.includes('kontra')) {
    // Kontra / Pindahan -> Violet theme
    return 'bg-violet-100 text-violet-900 border-violet-300';
  } else if (cat.includes('tambahan') || cat.includes('caj') || cat.includes('perkhidmatan')) {
    // Yuran Tambahan / Caj Perkhidmatan -> Fuchsia theme
    return 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300';
  } else {
    // Default fallback -> Blue theme
    return 'bg-blue-100 text-blue-900 border-blue-300';
  }
}

export function computeAllPaidPackageIds(packages: ImageFeePackage[], directPaidIds: Set<string>): Set<string> {
  const result = new Set<string>(directPaidIds);

  const sessions = Array.from(new Set(packages.map(p => p.sessionYear).filter((s): s is string => !!s)));

  for (const sessionYear of sessions) {
    const sessionPkgs = packages.filter(p => p.sessionYear === sessionYear);
    const tahunan = sessionPkgs.find(p => p.category === 'Tahunan');
    const penggal1 = sessionPkgs.find(p => p.category === 'Penggal' && p.penggalIndex === 1);
    const penggal2 = sessionPkgs.find(p => p.category === 'Penggal' && p.penggalIndex === 2);
    
    const bulananPkgs = sessionPkgs.filter(p => p.category === 'Bulanan');
    const p1MonthlyPkgs = bulananPkgs.slice(0, 6);
    const p2MonthlyPkgs = bulananPkgs.slice(6, 12);

    const isTahunanPaid = tahunan && result.has(tahunan.id);
    const isP1Paid = penggal1 && result.has(penggal1.id);
    const isP2Paid = penggal2 && result.has(penggal2.id);

    // 1. If Tahunan is paid -> Penggal 1, Penggal 2, and all 12 Bulanan are paid
    if (isTahunanPaid) {
      if (penggal1) result.add(penggal1.id);
      if (penggal2) result.add(penggal2.id);
      bulananPkgs.forEach(m => result.add(m.id));
    }

    // 2. If Penggal 1 is paid -> all P1 months are paid
    if (isP1Paid) {
      p1MonthlyPkgs.forEach(m => result.add(m.id));
    }

    // 3. If Penggal 2 is paid -> all P2 months are paid
    if (isP2Paid) {
      p2MonthlyPkgs.forEach(m => result.add(m.id));
    }

    // 4. Check if all P1 months paid -> mark P1 paid
    if (p1MonthlyPkgs.length > 0 && p1MonthlyPkgs.every(m => result.has(m.id))) {
      if (penggal1) result.add(penggal1.id);
    }

    // 5. Check if all P2 months paid -> mark P2 paid
    if (p2MonthlyPkgs.length > 0 && p2MonthlyPkgs.every(m => result.has(m.id))) {
      if (penggal2) result.add(penggal2.id);
    }

    // 6. Check if all 12 months paid or both P1 & P2 paid -> mark Tahunan paid
    if ((bulananPkgs.length > 0 && bulananPkgs.every(m => result.has(m.id))) || (penggal1 && penggal2 && result.has(penggal1.id) && result.has(penggal2.id))) {
      if (tahunan) result.add(tahunan.id);
    }
  }

  return result;
}

