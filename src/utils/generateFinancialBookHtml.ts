import { KewanganTransaction } from '../components/KewanganSection';
import { YuranConfig, monthNamesMs, generate12Months, DEFAULT_YURAN_CONFIG } from './yuranConfigHelper';
import { AppUser, MembershipApplication } from '../context/AuthContext';
import { logoBase64 } from './logoBase64';

export function generateFinancialBookHtml(
  transactions: KewanganTransaction[],
  yuranConfig: YuranConfig,
  verificationData: any,
  fixedAssets: { id: string; name: string; val: number }[],
  liabilitiesList: { id: string; name: string; val: number }[],
  otherCurrentAssets: { id: string; name: string; val: number }[],
  otherLiabilities: { id: string; name: string; val: number }[],
  capitalList: { id: string; name: string; val: number }[],
  allUsers: AppUser[],
  filterYear: string,
  totals: { currentBank: number; currentTunai: number; balanceSemasa: number },
  allApplications?: MembershipApplication[]
): string {
  // Dapatkan maklumat sesi kewangan dari yuranConfig.sesiList (Pengurusan Sesi Kewangan)
  const sesiList = (yuranConfig?.sesiList && yuranConfig.sesiList.length > 0)
    ? yuranConfig.sesiList
    : DEFAULT_YURAN_CONFIG.sesiList;

  // Cari sesi yang sepadan dengan filterYear, atau sesi pertama / aktif
  const matchedSesi = (filterYear && filterYear !== "All")
    ? (sesiList.find(s => s.id === filterYear || s.name.includes(filterYear) || String(s.startYear) === filterYear)
       || sesiList.find(s => s.id === "2026")
       || sesiList[0])
    : (sesiList.find(s => s.id === "2026") || sesiList[0]);

  const startMonthNum = matchedSesi?.startMonth ?? 1;
  const startYearNum = matchedSesi?.startYear ?? (parseInt(filterYear) || 2026);
  const sessionMonths = generate12Months(startMonthNum, startYearNum);
  const startMonthObj = sessionMonths[0];
  const endMonthObj = sessionMonths[11];

  // Tarikh akhir tahun kewangan perakaunan
  const lastDayOfEndMonth = new Date(endMonthObj.year, endMonthObj.val, 0).getDate();
  const financialYearEnd = `${lastDayOfEndMonth} ${monthNamesMs[endMonthObj.val - 1]} ${endMonthObj.year}`;
  const financialYearStart = `1 ${monthNamesMs[startMonthObj.val - 1]} ${startMonthObj.year}`;
  const currentSessionLabel = matchedSesi?.name || (endMonthObj.year !== startYearNum ? `Sesi ${startYearNum}/${endMonthObj.year}` : `Sesi ${startYearNum}`);
  const sessionPeriodStr = `${financialYearStart} hingga ${financialYearEnd}`;
  const selectedYear = startYearNum;
  const effectiveFilterYear = (filterYear && filterYear !== "All") ? filterYear : (matchedSesi?.id || String(startYearNum));
  
  // Date format helpers
  const todayStr = new Date().toLocaleDateString('ms-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const todayTimeStr = new Date().toLocaleTimeString('ms-MY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // 1. Filter approved transactions for the selected session
  const approvedTxns = transactions.filter(t => t.approvalStatus === 'Approved');
  
  const getTxnSession = (txn: KewanganTransaction) => {
    if (txn.sessionYear) {
      const match = txn.sessionYear.match(/\d{4}/);
      if (match) return match[0];
      return txn.sessionYear;
    }
    if (!txn.date) return effectiveFilterYear;
    const parts = txn.date.split('-');
    if (parts.length < 2) return effectiveFilterYear;
    const txnYear = parseInt(parts[0]);
    return String(txnYear);
  };

  const currentSessionTxns = approvedTxns.filter(t => getTxnSession(t) === effectiveFilterYear);

  // Helper to categorize transaction into fund/tabung
  const getFundCategory = (txn: KewanganTransaction): string => {
    const cat = (txn.category || '').trim().toLowerCase();
    const desc = (txn.description || '').trim().toLowerCase();

    if (cat.includes('qurban') || cat.includes('aqiqah') || desc.includes('qurban') || desc.includes('aqiqah')) {
      return 'Qurban & Aqiqah';
    }
    if (cat.includes('van jenazah') || desc.includes('van jenazah')) {
      return 'Tabung Van Jenazah';
    }
    if ((cat.includes('kebajikan') && cat.includes('khairat')) || desc.includes('kebajikan & khairat') || desc.includes('kebajikan dan khairat') || cat.includes('khairat') || desc.includes('khairat')) {
      return 'Tabung Kebajikan & Khairat';
    }
    if (cat.includes('surau') || desc.includes('surau') || cat.includes('komuniti') || desc.includes('komuniti')) {
      return 'Tabung Surau & Komuniti';
    }
    if (cat.includes('fasiliti') || desc.includes('fasiliti') || cat.includes('taman')) {
      return 'Tabung Fasiliti & Taman';
    }
    if (cat.includes('kecemasan') || desc.includes('kecemasan') || cat.includes('bencana')) {
      return 'Tabung Kecemasan & Bencana';
    }
    if (cat.includes('pendidikan') || desc.includes('pendidikan') || desc.includes('pelajar') || cat.includes('pelajar') || desc.includes('tuisyen') || desc.includes('sekolah')) {
      return 'Tabung Pendidikan';
    }
    if (cat.includes('sumbangan am') || desc.includes('sumbangan am')) {
      return 'Tabung Sumbangan Am';
    }
    if (cat.includes('tambahan') || desc.includes('yuran tambahan')) {
      return 'Yuran Tambahan';
    }
    return 'Baki Am / Operasi';
  };

  // 2. Calculate dynamic Baki Awal (Bank + Tunai) and per-category/tabung breakdown
  let initialBank = 0;
  let initialTunai = 0;
  const initialFundBreakdown: { [key: string]: { bank: number; tunai: number; total: number } } = {};

  // Check if explicit Baki Bawa Hadapan transactions exist for current session
  const cfTxns = approvedTxns.filter(t => 
    t.category === "Baki Bawa Hadapan" && 
    getTxnSession(t) === effectiveFilterYear
  );

  if (cfTxns.length > 0) {
    cfTxns.forEach(t => {
      const isBank = t.accountDebit === "Bank";
      const isTunai = t.accountDebit === "Tunai";
      if (isBank) initialBank += t.amount;
      if (isTunai) initialTunai += t.amount;

      // Extract fund category from description (e.g. [Qurban Aqiqah], [Tabung Van Jenazah], (Am))
      const match = t.description?.match(/\[(.*?)\]/);
      let fundName = match ? match[1] : (t.description?.includes('(Am)') ? 'Baki Am (Operasi)' : 'Baki Am');
      if (fundName.toLowerCase().includes('qurban')) fundName = 'Qurban & Aqiqah';
      else if (fundName.toLowerCase().includes('van jenazah')) fundName = 'Tabung Van Jenazah';
      else if (fundName.toLowerCase().includes('kebajikan') || fundName.toLowerCase().includes('khairat')) fundName = 'Tabung Kebajikan & Khairat';
      else if (fundName.toLowerCase().includes('surau') || fundName.toLowerCase().includes('komuniti')) fundName = 'Tabung Surau & Komuniti';
      else if (fundName.toLowerCase().includes('fasiliti') || fundName.toLowerCase().includes('taman')) fundName = 'Tabung Fasiliti & Taman';
      else if (fundName.toLowerCase().includes('kecemasan') || fundName.toLowerCase().includes('bencana')) fundName = 'Tabung Kecemasan & Bencana';
      else if (fundName.toLowerCase().includes('pendidikan') || fundName.toLowerCase().includes('pelajar')) fundName = 'Tabung Pendidikan';
      else if (fundName.toLowerCase().includes('tambahan')) fundName = 'Yuran Tambahan';

      if (!initialFundBreakdown[fundName]) {
        initialFundBreakdown[fundName] = { bank: 0, tunai: 0, total: 0 };
      }
      if (isBank) initialFundBreakdown[fundName].bank += t.amount;
      if (isTunai) initialFundBreakdown[fundName].tunai += t.amount;
      initialFundBreakdown[fundName].total += t.amount;
    });
  } else {
    // Dynamically calculate from prior sessions
    approvedTxns.forEach(txn => {
      if (txn.category === "Baki Bawa Hadapan") return;
      const txnSession = getTxnSession(txn);
      if (parseInt(txnSession) < selectedYear) {
        const isDebitBank = txn.accountDebit === "Bank";
        const isCreditBank = txn.accountCredit === "Bank";
        const isDebitTunai = txn.accountDebit === "Tunai";
        const isCreditTunai = txn.accountCredit === "Tunai";

        if (isDebitBank) initialBank += txn.amount;
        if (isCreditBank) initialBank -= txn.amount;
        if (isDebitTunai) initialTunai += txn.amount;
        if (isCreditTunai) initialTunai -= txn.amount;

        const fName = getFundCategory(txn);
        if (fName !== 'Baki Am / Operasi') {
          if (!initialFundBreakdown[fName]) {
            initialFundBreakdown[fName] = { bank: 0, tunai: 0, total: 0 };
          }
          if (isDebitBank) { initialFundBreakdown[fName].bank += txn.amount; initialFundBreakdown[fName].total += txn.amount; }
          if (isCreditBank) { initialFundBreakdown[fName].bank -= txn.amount; initialFundBreakdown[fName].total -= txn.amount; }
          if (isDebitTunai) { initialFundBreakdown[fName].tunai += txn.amount; initialFundBreakdown[fName].total += txn.amount; }
          if (isCreditTunai) { initialFundBreakdown[fName].tunai -= txn.amount; initialFundBreakdown[fName].total -= txn.amount; }
        }
      }
    });

    let fundTotals = 0;
    Object.values(initialFundBreakdown).forEach(b => {
      if (b.total > 0) fundTotals += b.total;
    });
    const generalRemaining = (initialBank + initialTunai) - fundTotals;
    if (generalRemaining > 0) {
      initialFundBreakdown['Baki Am (Operasi)'] = { bank: generalRemaining, tunai: 0, total: generalRemaining };
    }
  }

  const bakiAwalTotal = initialBank + initialTunai;

  // 3. Category grouping for Receipts and Payments (Akaun Penerimaan & Pembayaran)
  const receipts: { [category: string]: number } = {};
  const payments: { [category: string]: number } = {};

  currentSessionTxns.forEach(txn => {
    // Ignore Baki Bawa Hadapan so it does not inflate current year receipts
    if (txn.category === "Baki Bawa Hadapan") return;

    // Ignore internal contra transfers in P&L, but they appear in Cash Flow / Receipts & Payments
    const isInternal = 
      (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
      (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
    
    if (isInternal) {
      // Contra transfers go to specific contra group if needed
      return;
    }

    // Receipts: when Bank or Tunai is debited (Inflow)
    if (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") {
      receipts[txn.category] = (receipts[txn.category] || 0) + txn.amount;
    }
    // Payments: when Bank or Tunai is credited (Outflow)
    else if (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai") {
      payments[txn.category] = (payments[txn.category] || 0) + txn.amount;
    }
  });

  // Sum total receipts and payments
  const totalReceiptsSum = Object.values(receipts).reduce((sum, v) => sum + v, 0);
  const totalPaymentsSum = Object.values(payments).reduce((sum, v) => sum + v, 0);

  // Dynamic Cash endings
  let finalBank = initialBank;
  let finalTunai = initialTunai;
  currentSessionTxns.forEach(txn => {
    if (txn.category === "Baki Bawa Hadapan") return;
    if (txn.accountDebit === "Bank") finalBank += txn.amount;
    if (txn.accountCredit === "Bank") finalBank -= txn.amount;
    if (txn.accountDebit === "Tunai") finalTunai += txn.amount;
    if (txn.accountCredit === "Tunai") finalTunai -= txn.amount;
  });

  const bakiAkhirTotal = finalBank + finalTunai;

  // Tabung / Fund Movement Data for Nota 6
  interface FundMovement {
    name: string;
    bakiAwal: number;
    inflow: number;
    outflow: number;
    bakiAkhir: number;
  }

  const allFundKeys = [
    'Qurban & Aqiqah',
    'Tabung Kebajikan & Khairat',
    'Tabung Van Jenazah',
    'Tabung Surau & Komuniti',
    'Tabung Fasiliti & Taman',
    'Tabung Kecemasan & Bencana',
    'Tabung Pendidikan',
    'Tabung Sumbangan Am',
    'Yuran Tambahan',
    ...Object.keys(initialFundBreakdown).filter(k => !k.includes('Baki Am'))
  ];

  const uniqueFundKeys = Array.from(new Set(allFundKeys));
  const fundMovements: FundMovement[] = [];

  uniqueFundKeys.forEach(fund => {
    const bakiAwal = Math.max(0, initialFundBreakdown[fund]?.total || 0);
    let inflow = 0;
    let outflow = 0;

    currentSessionTxns.forEach(txn => {
      if (txn.category === "Baki Bawa Hadapan") return;
      const isInternal = 
        (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
        (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
      if (isInternal) return;

      const fName = getFundCategory(txn);
      if (fName === fund) {
        if (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") {
          inflow += txn.amount;
        } else if (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai") {
          outflow += txn.amount;
        }
      }
    });

    const bakiAkhir = bakiAwal + inflow - outflow;
    if (bakiAwal > 0 || inflow > 0 || outflow > 0) {
      fundMovements.push({
        name: fund,
        bakiAwal,
        inflow,
        outflow,
        bakiAkhir
      });
    }
  });

  // Calculate Baki Am Operasi
  const fundBakiAwalTotal = fundMovements.reduce((sum, f) => sum + f.bakiAwal, 0);
  const amBakiAwal = Math.max(0, initialFundBreakdown['Baki Am (Operasi)']?.total ?? (bakiAwalTotal - fundBakiAwalTotal));
  let amInflow = 0;
  let amOutflow = 0;
  currentSessionTxns.forEach(txn => {
    if (txn.category === "Baki Bawa Hadapan") return;
    const isInternal = 
      (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") && 
      (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai");
    if (isInternal) return;

    const fName = getFundCategory(txn);
    if (fName === 'Baki Am / Operasi' || !uniqueFundKeys.includes(fName)) {
      if (txn.accountDebit === "Bank" || txn.accountDebit === "Tunai") {
        amInflow += txn.amount;
      } else if (txn.accountCredit === "Bank" || txn.accountCredit === "Tunai") {
        amOutflow += txn.amount;
      }
    }
  });

  fundMovements.push({
    name: 'Baki Am (Dana Operasi & Yuran Am)',
    bakiAwal: amBakiAwal,
    inflow: amInflow,
    outflow: amOutflow,
    bakiAkhir: amBakiAwal + amInflow - amOutflow
  });

  // 4. Calculate Income and Expenses based on Accrual Basis (Akaun Pendapatan & Perbelanjaan)
  const incomes: { [category: string]: number } = { ...receipts };
  const expenses: { [category: string]: number } = { ...payments };

  // Calculate Outstanding & Advance Fees for the Sesi
  let totalKeahlianOwed = 0;
  let totalPersatuanOwed = 0;
  let totalKhairatOwed = 0;
  let totalTambahanOwed = 0;

  let totalKeahlianAdvance = 0;
  let totalPersatuanAdvance = 0;
  let totalKhairatAdvance = 0;
  let totalTambahanAdvance = 0;

  // Track members details for Nota 2
  let membersWithArrearsCount = 0;
  const arrearsBuckets = {
    bucket1to3: { count: 0, amount: 0 },
    bucket4to6: { count: 0, amount: 0 },
    bucketOver6: { count: 0, amount: 0 }
  };

  const netBulananPersatuan = yuranConfig.yuranBulanan?.persatuan ?? 5;
  const netBulananKhairat = yuranConfig.yuranBulanan?.khairat ?? 5;

  const netPenggalPersatuan = yuranConfig.yuranPenggal?.persatuan === 25 
    ? 25 
    : (yuranConfig.yuranPenggal?.persatuan ?? 30) - (yuranConfig.yuranPenggal?.discount ?? 5);
  const netPenggalKhairat = yuranConfig.yuranPenggal?.khairat ?? 30;

  const netTahunanPersatuan = yuranConfig.yuranTahunan?.persatuan === 40 
    ? 40 
    : (yuranConfig.yuranTahunan?.persatuan ?? 60) - (yuranConfig.yuranTahunan?.discount ?? 20);
  const netTahunanKhairat = yuranConfig.yuranTahunan?.khairat ?? 60;

  const displayPenggalPersatuanFull = yuranConfig.yuranPenggal?.persatuan === 25 ? 30 : (yuranConfig.yuranPenggal?.persatuan ?? 30);
  const displayPenggalKhairatFull = yuranConfig.yuranPenggal?.khairat ?? 30;
  const displayPenggalDiscount = yuranConfig.yuranPenggal?.discount ?? 5;

  const displayTahunanPersatuanFull = yuranConfig.yuranTahunan?.persatuan === 40 ? 60 : (yuranConfig.yuranTahunan?.persatuan ?? 60);
  const displayTahunanKhairatFull = yuranConfig.yuranTahunan?.khairat ?? 60;
  const displayTahunanDiscount = yuranConfig.yuranTahunan?.discount ?? 20;

  const apps = allApplications || [];
  const payingUsers = allUsers.filter(u => {
    if (u.role === 'Pelawat' || u.role === 'Admin Utama') return false;
    
    // Check if approved in applications if apps is provided and not empty
    let isApproved = false;
    if (apps.length > 0) {
      isApproved = apps.some(app => app.uid === u.uid && (app.status === 'Diluluskan' || app.status === 'Diluluskan Keahlian'));
    } else {
      isApproved = u.approvalStatus === 'Approved' || u.approvalStatus === 'Diluluskan' || u.approvalStatus === 'Diluluskan Keahlian';
    }
    
    return isApproved && 
      u.membershipStatus !== 'Ditolak' &&
      u.membershipStatus !== 'Tidak Aktif' &&
      u.membershipStatus !== 'Dilucutkan Keahlian';
  });

  const activeCount = payingUsers.length;
  const ditolakCount = apps.length > 0
    ? allUsers.filter(u => apps.some(app => app.uid === u.uid && (app.status === 'Rejected' || app.status === 'Ditolak')) || u.membershipStatus === 'Ditolak' || u.approvalStatus === 'Rejected').length
    : allUsers.filter(u => u.membershipStatus === 'Ditolak' || u.approvalStatus === 'Rejected').length;

  const dilucutkanCount = allUsers.filter(u => 
    u.membershipStatus === 'Tidak Aktif' && u.approvalStatus === 'Dilucutkan' || 
    u.membershipStatus === 'Dilucutkan Keahlian' || 
    u.approvalStatus === 'Dilucutkan' || 
    u.membershipStatus === 'Dilucutkan'
  ).length;

  let totalTahunanDiscountCount = 0;
  let totalPenggal1DiscountCount = 0;
  let totalPenggal2DiscountCount = 0;

  payingUsers.forEach(user => {
    // Collect all paid package IDs from user document and approved transactions
    const userPaidIdsSet = new Set<string>(user.paidPackageIds || []);

    // Add package IDs from approved transactions belonging to this user
    approvedTxns.forEach(t => {
      if (t.memberEmail && user.email && t.memberEmail.toLowerCase() === user.email.toLowerCase()) {
        if (t.paidPackageIds && Array.isArray(t.paidPackageIds)) {
          t.paidPackageIds.forEach(id => userPaidIdsSet.add(id));
        }
      }
    });

    const userPaidIds = Array.from(userPaidIdsSet);
    let userArrearsCount = 0;
    let userArrearsAmount = 0;

    // Check Keahlian Fee
    const hasKeahlianPaid = userPaidIds.includes('pkg-keahlian');
    if (!hasKeahlianPaid) {
      const price = yuranConfig.yuranKeahlian.price;
      totalKeahlianOwed += price;
      userArrearsAmount += price;
      userArrearsCount += 1;
    }

    // Check Monthly / Penggal / Tahunan payments for current effectiveFilterYear
    const isYearPaid = userPaidIds.includes(`pkg-tahunan-${effectiveFilterYear}`);
    const isP1Paid = userPaidIds.includes(`pkg-penggal-1-${effectiveFilterYear}`);
    const isP2Paid = userPaidIds.includes(`pkg-penggal-2-${effectiveFilterYear}`);

    if (isYearPaid) {
      totalTahunanDiscountCount++;
    }
    if (isP1Paid) {
      totalPenggal1DiscountCount++;
    }
    if (isP2Paid) {
      totalPenggal2DiscountCount++;
    }

    const p1Months = sessionMonths.slice(0, 6).map(m => m.val);
    const p2Months = sessionMonths.slice(6, 12).map(m => m.val);
    const allMonthsList = sessionMonths.map(m => m.val);

    // Determine paid status of each of the 12 months in this session
    const paidMonthsMap = allMonthsList.map(m => {
      const isBulananPaid = userPaidIds.includes(`pkg-bulanan-${effectiveFilterYear}-${m.toString().padStart(2, '0')}`);
      const isPaidByP1 = isP1Paid && p1Months.includes(m);
      const isPaidByP2 = isP2Paid && p2Months.includes(m);
      return isYearPaid || isPaidByP1 || isPaidByP2 || isBulananPaid;
    });

    const unpaidMonthsIndices = allMonthsList.filter((m, idx) => !paidMonthsMap[idx]);

    let userPersatuanOwed = 0;
    let userKhairatOwed = 0;
    let sessionArrearsCount = 0;

    const pref = (user as any).yuranPreference || (user as any).yuranMode || (user as any).paymentMode || (user as any).paymentPreference || (user as any).kaedahBayaran || 'Bulanan';

    if (unpaidMonthsIndices.length === 0) {
      // Fully paid!
      userPersatuanOwed = 0;
      userKhairatOwed = 0;
      sessionArrearsCount = 0;
    } else if (unpaidMonthsIndices.length === 12 && pref === 'Tahunan') {
      // Paid absolutely nothing, and user prefers Tahunan package
      userPersatuanOwed = netTahunanPersatuan;
      userKhairatOwed = netTahunanKhairat;
      sessionArrearsCount = 1; // 1 annual package outstanding
    } else {
      // Check Penggal 1
      let p1PersatuanOwed = 0;
      let p1KhairatOwed = 0;
      let p1ArrearsCount = 0;

      if (!isP1Paid && !isYearPaid) {
        const unpaidP1Months = p1Months.filter(m => !userPaidIds.includes(`pkg-bulanan-${effectiveFilterYear}-${m.toString().padStart(2, '0')}`));
        if (unpaidP1Months.length > 0) {
          if (unpaidP1Months.length === 6 && pref === 'Penggal') {
            // No months paid in Penggal 1 and user prefers Penggal package
            p1PersatuanOwed = netPenggalPersatuan;
            p1KhairatOwed = netPenggalKhairat;
            p1ArrearsCount = 1; // 1 penggal outstanding
          } else {
            // Some months paid, so Penggal 1 package is disabled. Pay remaining months individually.
            p1PersatuanOwed = unpaidP1Months.length * netBulananPersatuan;
            p1KhairatOwed = unpaidP1Months.length * netBulananKhairat;
            p1ArrearsCount = unpaidP1Months.length;
          }
        }
      }

      // Check Penggal 2
      let p2PersatuanOwed = 0;
      let p2KhairatOwed = 0;
      let p2ArrearsCount = 0;

      if (!isP2Paid && !isYearPaid) {
        const unpaidP2Months = p2Months.filter(m => !userPaidIds.includes(`pkg-bulanan-${effectiveFilterYear}-${m.toString().padStart(2, '0')}`));
        if (unpaidP2Months.length > 0) {
          if (unpaidP2Months.length === 6 && pref === 'Penggal') {
            // No months paid in Penggal 2 and user prefers Penggal package
            p2PersatuanOwed = netPenggalPersatuan;
            p2KhairatOwed = netPenggalKhairat;
            p2ArrearsCount = 1; // 1 penggal outstanding
          } else {
            // Some months paid, so Penggal 2 package is disabled. Pay remaining months individually.
            p2PersatuanOwed = unpaidP2Months.length * netBulananPersatuan;
            p2KhairatOwed = unpaidP2Months.length * netBulananKhairat;
            p2ArrearsCount = unpaidP2Months.length;
          }
        }
      }

      userPersatuanOwed = p1PersatuanOwed + p2PersatuanOwed;
      userKhairatOwed = p1KhairatOwed + p2KhairatOwed;
      sessionArrearsCount = p1ArrearsCount + p2ArrearsCount;
    }

    totalPersatuanOwed += userPersatuanOwed;
    totalKhairatOwed += userKhairatOwed;
    userArrearsAmount += (userPersatuanOwed + userKhairatOwed);
    userArrearsCount += sessionArrearsCount;

    // Check Custom Additional Fees
    if (yuranConfig.additionalFees && Array.isArray(yuranConfig.additionalFees)) {
      yuranConfig.additionalFees.forEach(fee => {
        if (fee.assignedUids && Array.isArray(fee.assignedUids) && fee.assignedUids.length > 0) {
          if (!fee.assignedUids.includes(user.uid)) return;
        }

        if (fee.feeType === 'Tahunan') {
          const feeSess = (fee.sessionYear || '2026').replace('Sesi ', '').split('/')[0].trim();
          if (feeSess === effectiveFilterYear) {
            const isPaid = userPaidIds.includes(fee.id);
            if (!isPaid) {
              totalTambahanOwed += fee.price;
              userArrearsAmount += fee.price;
              userArrearsCount += 1;
            }
          }
        } else if (fee.feeType === 'Bulanan' && fee.months) {
          fee.months.forEach(mName => {
            let matchesSess = false;
            if (mName.includes('2026') && effectiveFilterYear === '2026') matchesSess = true;
            if (mName.includes('2027')) {
              const firstHalf = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai'];
              const isFirstHalf = firstHalf.some(fh => mName.startsWith(fh));
              if (isFirstHalf && effectiveFilterYear === '2026') matchesSess = true;
              if (!isFirstHalf && effectiveFilterYear === '2027') matchesSess = true;
            } else if (mName.includes('2028') && effectiveFilterYear === '2027') {
              matchesSess = true;
            }

            if (matchesSess) {
              const pkgId = `${fee.id}-${mName.replace(/\s+/g, '-')}`;
              const isPaid = userPaidIds.includes(pkgId);
              if (!isPaid) {
                totalTambahanOwed += fee.price;
                userArrearsAmount += fee.price;
                userArrearsCount += 1;
              }
            }
          });
        }
      });
    }

    // Aggregate bucket for Nota 2
    if (userArrearsAmount > 0) {
      membersWithArrearsCount++;
      if (userArrearsCount <= 3) {
        arrearsBuckets.bucket1to3.count++;
        arrearsBuckets.bucket1to3.amount += userArrearsAmount;
      } else if (userArrearsCount <= 6) {
        arrearsBuckets.bucket4to6.count++;
        arrearsBuckets.bucket4to6.amount += userArrearsAmount;
      } else {
        arrearsBuckets.bucketOver6.count++;
        arrearsBuckets.bucketOver6.amount += userArrearsAmount;
      }
    }

    // Calculate Advance Payments (Paid for future sessions)
    const futureYears = [selectedYear + 1, selectedYear + 2];
    futureYears.forEach(fy => {
      const yearLabel = String(fy);
      if (userPaidIds.includes(`pkg-tahunan-${yearLabel}`)) {
        totalPersatuanAdvance += yuranConfig.yuranTahunan.persatuan - yuranConfig.yuranTahunan.discount;
        totalKhairatAdvance += yuranConfig.yuranTahunan.khairat;
      }
      if (userPaidIds.includes(`pkg-penggal-1-${yearLabel}`)) {
        totalPersatuanAdvance += yuranConfig.yuranPenggal.persatuan - yuranConfig.yuranPenggal.discount;
        totalKhairatAdvance += yuranConfig.yuranPenggal.khairat;
      }
      if (userPaidIds.includes(`pkg-penggal-2-${yearLabel}`)) {
        totalPersatuanAdvance += yuranConfig.yuranPenggal.persatuan - yuranConfig.yuranPenggal.discount;
        totalKhairatAdvance += yuranConfig.yuranPenggal.khairat;
      }
      // Monthly advance check
      for (let mIdx = 1; mIdx <= 12; mIdx++) {
        if (userPaidIds.includes(`pkg-bulanan-${yearLabel}-${mIdx.toString().padStart(2, '0')}`)) {
          totalPersatuanAdvance += yuranConfig.yuranBulanan.persatuan;
          totalKhairatAdvance += yuranConfig.yuranBulanan.khairat;
        }
      }
    });
  });

  const totalOutstandingFees = totalKeahlianOwed + totalPersatuanOwed + totalKhairatOwed + totalTambahanOwed;
  const totalAdvanceFees = totalKeahlianAdvance + totalPersatuanAdvance + totalKhairatAdvance + totalTambahanAdvance;

  const kutipanKhairat = receipts["Khairat Kematian"] || 0;
  const totalKhairatSesiSemasa = kutipanKhairat + totalKhairatOwed;

  // Add outstanding fees as Income under Accrual Basis
  incomes["Yuran Tertunggak Sesi Semasa (Akruan)"] = totalOutstandingFees;

  const totalIncomeAccrual = Object.values(incomes).reduce((sum, v) => sum + v, 0);
  const totalExpenseAccrual = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  const surplusAccrual = totalIncomeAccrual - totalExpenseAccrual;

  // 5. Asset, Liabilities and Funds calculation
  const totalFixedAssetsVal = fixedAssets.reduce((sum, item) => sum + item.val, 0);
  const otherCurrentAssetsVal = otherCurrentAssets.reduce((sum, item) => sum + item.val, 0);

  const totalCurrentAssetsVal = bakiAkhirTotal + totalOutstandingFees + otherCurrentAssetsVal;
  const totalAssetsVal = totalFixedAssetsVal + totalCurrentAssetsVal;

  const liabilitiesVal = liabilitiesList.reduce((sum, item) => sum + item.val, 0);
  const otherLiabilitiesVal = otherLiabilities.reduce((sum, item) => sum + item.val, 0);
  const totalLiabilitiesVal = liabilitiesVal + totalAdvanceFees + otherLiabilitiesVal;

  const capitalListVal = capitalList.reduce((sum, item) => sum + item.val, 0) + bakiAwalTotal;
  const accumulatedFundsTotal = capitalListVal + surplusAccrual;

  const totalLiabilitiesAndFunds = totalLiabilitiesVal + accumulatedFundsTotal;
  const isBalanceSheetBalanced = Math.abs(totalAssetsVal - totalLiabilitiesAndFunds) < 0.01;

  // Map users names
  const pengerusiUser = allUsers.find(u => u.role === 'Pengerusi');
  const naibPengerusiUser = allUsers.find(u => u.role === 'Naib Pengerusi');
  const setiausahaUser = allUsers.find(u => u.role === 'Setiausaha');
  const naibSetiausahaUser = allUsers.find(u => u.role === 'Naib Setiausaha' || u.role === 'Penolong Setiausaha');
  const bendahariUser = allUsers.find(u => u.role === 'Bendahari');
  
  const ajkUsers = allUsers.filter(u => u.role === 'Ahli Jawatankuasa') || [];
  const ajk1User = ajkUsers[0];
  const ajk2User = ajkUsers[1];
  const ajk3User = ajkUsers[2];

  const juruAudits = allUsers.filter(u => u.role === 'Juru Audit') || [];
  const juruAudit1User = juruAudits[0];
  const juruAudit2User = juruAudits[1];

  const pengerusiName = pengerusiUser?.displayName || "Belum Dilantik";
  const naibPengerusiName = naibPengerusiUser?.displayName || "Belum Dilantik";
  const setiausahaName = setiausahaUser?.displayName || "Belum Dilantik";
  const naibSetiausahaName = naibSetiausahaUser?.displayName || "Belum Dilantik";
  const bendahariName = bendahariUser?.displayName || "Belum Dilantik";
  
  const ajk1Name = ajk1User?.displayName || "Belum Dilantik";
  const ajk2Name = ajk2User?.displayName || "Belum Dilantik";
  const ajk3Name = ajk3User?.displayName || "Belum Dilantik";

  const juruAudit1Name = juruAudit1User?.displayName || "Belum Dilantik";
  const juruAudit2Name = juruAudit2User?.displayName || "Belum Dilantik";

  const currentTreasurerName = verificationData?.preparedBy || verificationData?.treasurerName || bendahariName;
  const currentAuditStatus = verificationData?.auditStatus === "Approved" || (verificationData?.audited1Signed && verificationData?.audited2Signed) ? "REKOD TELAH DIAUDIT & DISAHKAN" : "MENUNGGU PENGAUDITAN JURUAUDIT DALAMAN";

  const juruAudit1PrintedName = verificationData?.audited1Signed && verificationData?.audited1By
    ? verificationData.audited1By
    : juruAudit1Name;

  const juruAudit2PrintedName = verificationData?.audited2Signed && verificationData?.audited2By
    ? verificationData.audited2By
    : juruAudit2Name;

  const preparedPrintedName = verificationData?.preparedSigned && verificationData?.preparedBy
    ? verificationData.preparedBy
    : currentTreasurerName;

  const setiausahaPrintedName = verificationData?.reviewedSigned && verificationData?.reviewedBy
    ? verificationData.reviewedBy
    : setiausahaName;

  const pengerusiPrintedName = verificationData?.authorizedSigned && verificationData?.authorizedBy
    ? verificationData.authorizedBy
    : pengerusiName;

  // FPX Surcharge mode label
  const isSurchargeMode = yuranConfig.fpxSurchargeMode ?? true;
  const fpxModeLabel = isSurchargeMode ? "Surcharge (Ditambah ke atas yuran)" : "Absorbed (Diserap dari yuran)";

  // Filter and calculate FPX Bayarcash transaction fees (Nota 7)
  const fpxTransactions = currentSessionTxns.filter(t => t.category === "Caj Perkhidmatan");
  const totalFpxKutipan = fpxTransactions
    .filter(t => t.accountDebit === "Bank" || t.accountDebit === "Tunai")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalFpxBayaran = fpxTransactions
    .filter(t => t.accountCredit === "Bank" || t.accountCredit === "Tunai")
    .reduce((sum, t) => sum + t.amount, 0);

  // Build HTML document
  return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <title>Buku Penyata Kewangan SMAUJ ${currentSessionLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      background-color: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Page-break utility and print style */
    .book-page {
      background-color: #ffffff;
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 20px auto;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    @media print {
      body {
        background-color: #ffffff;
        margin: 0;
      }
      .book-page {
        margin: 0;
        border: none;
        box-shadow: none;
        width: 210mm;
        height: 297mm;
        page-break-after: always;
        padding: 15mm;
      }
      .no-print {
        display: none !important;
      }
    }

    /* Print header button bar */
    .print-control-bar {
      max-width: 210mm;
      margin: 15px auto 0 auto;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    }

    .btn-print {
      background: #10b981;
      border: none;
      color: white;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }

    .btn-print:hover {
      background: #059669;
    }

    /* Typography Utilities */
    .font-mono {
      font-family: "JetBrains Mono", monospace;
    }

    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 800;
      letter-spacing: -0.025em;
    }

    /* Table styling standard */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 11px;
    }

    th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
    }

    td {
      border: 1px solid #e2e8f0;
      padding: 7px 12px;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .font-bold {
      font-weight: 700;
    }

    .border-double-bottom {
      border-bottom: 4px double #0f172a;
    }

    .border-top-thick {
      border-top: 2px solid #0f172a;
    }

    /* Decorative & structures */
    .cover-title {
      font-size: 26px;
      line-height: 1.2;
      text-transform: uppercase;
      margin-top: 30px;
    }

    .cover-subtitle {
      font-size: 14px;
      color: #475569;
      font-weight: 600;
      margin-top: 15px;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 0;
    }

    .page-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .page-header h2 {
      font-size: 16px;
      text-transform: uppercase;
    }

    .page-header span {
      font-size: 10px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
    }

    .page-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      font-weight: 600;
    }

    .page-body {
      flex-grow: 1;
    }

    /* Signature styling blocks */
    .sign-section {
      margin-top: 30px;
      display: grid;
      grid-cols: 2;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 30px;
    }

    .sign-block {
      border: 1px dashed #cbd5e1;
      padding: 15px;
      border-radius: 8px;
      background: #fafafb;
    }

    .signature-img {
      max-height: 60px;
      display: block;
      margin: 10px 0;
    }

    .placeholder-sign-line {
      height: 40px;
      border-bottom: 1px solid #94a3b8;
      margin: 10px 0;
    }

    .card-info {
      background-color: #f8fafc;
      border-left: 4px solid #0f172a;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 0 8px 8px 0;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 15px;
    }
  </style>
</head>
<body>

  <!-- PRINT BAR -->
  <div class="print-control-bar no-print">
    <div>
      <h3 style="color: white; font-size: 14px; font-weight: 800;">Buku Penyata Kewangan & Sumbangan SMAUJ</h3>
      <p style="font-size: 11px; opacity: 0.8; font-weight: 500; margin-top: 2px;">Format Rasmi standard A4 Portrait, lengkap cover depan & belakang.</p>
    </div>
    <button onclick="window.print()" class="btn-print">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
      <span>Cetak Buku Penyata</span>
    </button>
  </div>

  <!-- ==================== HALAMAN 1 — COVER ==================== -->
  <div class="book-page">
    <div class="page-body" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
      
      <!-- Larger Logo -->
      <img src="${logoBase64}" alt="Logo Sekolah" style="max-height: 180px; margin-bottom: 40px;" />

      <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 0.1em; color: #475569; text-transform: uppercase;">BUKU PENYATA KEWANGAN</h1>
      <h2 class="cover-title" style="margin-top: 15px; font-size: 24px;">SEKOLAH MENENGAH AGAMA ULU JEMPOL<br/>ULU JEMPOL, 72200 BATU KIKIR</h2>
      
      <p style="font-size: 12px; font-weight: 700; color: #64748b; margin-top: 8px;">Kod Sekolah: NFT6001 | PIBG & Pengurusan SMAUJ</p>

      <div class="cover-subtitle" style="width: 80%; margin-left: auto; margin-right: auto; margin-top: 40px;">
        BAGI TAHUN KEWANGAN BERAKHIR ${financialYearEnd.toUpperCase()}<br/>
        (${currentSessionLabel.toUpperCase()})
      </div>

      <div style="margin-top: 50px; font-size: 12px;">
        <p style="color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Disediakan Oleh:</p>
        <p style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 5px;">${currentTreasurerName}</p>
        <p style="font-size: 11px; font-weight: 700; color: #64748b;">Bendahari PIBG / SMAUJ</p>
      </div>

      <p style="font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 60px; text-transform: uppercase; letter-spacing: 0.05em;">
        Tarikh Cetakan: ${todayStr} @ ${todayTimeStr}
      </p>
    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 1</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 2 — ISI KANDUNGAN & MAKLUMAT AM ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Isi Kandungan & Maklumat Am</h2>
        <span>Halaman 2</span>
      </div>

      <h3 style="font-size: 13px; text-transform: uppercase; margin-bottom: 10px;">Isi Kandungan Buku Penyata</h3>
      <table style="margin-bottom: 25px;">
        <thead>
          <tr>
            <th style="width: 8%">No.</th>
            <th>Kandungan</th>
            <th style="width: 15%; text-align: center;">Halaman</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center font-bold">1</td>
            <td class="font-bold">Maklumat Am Persatuan & Senarai Jawatankuasa</td>
            <td class="text-center font-bold">2</td>
          </tr>
          <tr>
            <td class="text-center font-bold">2</td>
            <td>Akaun Penerimaan dan Pembayaran (Aliran Tunai Sebenar)</td>
            <td class="text-center font-bold">3</td>
          </tr>
          <tr>
            <td class="text-center font-bold">3</td>
            <td>Akaun Pendapatan dan Perbelanjaan (Untung Rugi)</td>
            <td class="text-center font-bold">4</td>
          </tr>
          <tr>
            <td class="text-center font-bold">4</td>
            <td>Penyata Kedudukan Kewangan (Kunci Kira-kira)</td>
            <td class="text-center font-bold">5</td>
          </tr>
          <tr>
            <td class="text-center font-bold">5</td>
            <td>Penyata Aliran Tunai (Pecahan Operasi & Pelaburan)</td>
            <td class="text-center font-bold">6</td>
          </tr>
          <tr>
            <td class="text-center font-bold">6</td>
            <td>Nota kepada Penyata Kewangan (Nota 1 hingga 5)</td>
            <td class="text-center font-bold">7</td>
          </tr>
          <tr>
            <td class="text-center font-bold">7</td>
            <td>Nota kepada Penyata Kewangan (Nota 6 hingga 9)</td>
            <td class="text-center font-bold">8</td>
          </tr>
          <tr>
            <td class="text-center font-bold">8</td>
            <td>Laporan Rasmi Juruaudit Dalaman</td>
            <td class="text-center font-bold">9</td>
          </tr>
          <tr>
            <td class="text-center font-bold">9</td>
            <td>Seksyen Pengesahan & Tandatangan Jawatankuasa</td>
            <td class="text-center font-bold">10</td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size: 13px; text-transform: uppercase; margin-bottom: 10px;">Maklumat Am Sekolah & PIBG</h3>
      <div class="card-info" style="font-size: 11px;">
        <p><strong>Nama Institusi:</strong> Sekolah Menengah Agama Ulu Jempol (SMAUJ)</p>
        <p><strong>Kod Sekolah:</strong> NFT6001</p>
        <p><strong>Alamat Surat-Menyurat:</strong> D/A Pejabat Sekolah, Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan</p>
        <p><strong>Bank Rasmi PIBG:</strong> Bank Islam Malaysia Berhad (Akaun: 05012010045678)</p>
        <p><strong>Sesi Tahun Kewangan semasa:</strong> ${sessionPeriodStr}</p>
        <p style="margin-top: 6px; border-top: 1px dashed #cbd5e1; padding-top: 6px; font-weight: 600;">
          <strong>Ringkasan Keahlian Semasa:</strong> 
          Ahli Aktif: <span style="color: #16a34a; font-weight: bold;">${activeCount} orang</span> | 
          Ahli Ditolak: <span style="color: #dc2626; font-weight: bold;">${ditolakCount} orang</span> | 
          Ahli Dilucutkan: <span style="color: #dc2626; font-weight: bold;">${dilucutkanCount} orang</span>
        </p>
      </div>

      <h3 style="font-size: 13px; text-transform: uppercase; margin-top: 15px; margin-bottom: 10px;">Senarai Ahli Jawatankuasa (AJK) Lengkap ${currentSessionLabel}</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 25%">Jawatan</th>
            <th>Nama Penuh Jawatankuasa</th>
            <th style="width: 30%">E-mel Berdaftar</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">Pengerusi</td>
            <td>${pengerusiName}</td>
            <td>${pengerusiUser?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Naib Pengerusi</td>
            <td>${naibPengerusiName}</td>
            <td>${naibPengerusiUser?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Setiausaha</td>
            <td>${setiausahaName}</td>
            <td>${setiausahaUser?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Penolong Setiausaha</td>
            <td>${naibSetiausahaName}</td>
            <td>${naibSetiausahaUser?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Bendahari</td>
            <td>${currentTreasurerName}</td>
            <td>${bendahariUser?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Ahli Jawatankuasa 1</td>
            <td>${ajk1Name}</td>
            <td>${ajk1User?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Ahli Jawatankuasa 2</td>
            <td>${ajk2Name}</td>
            <td>${ajk2User?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Ahli Jawatankuasa 3</td>
            <td>${ajk3Name}</td>
            <td>${ajk3User?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Juru Audit 1</td>
            <td>${juruAudit1Name}</td>
            <td>${juruAudit1User?.email || '-'}</td>
          </tr>
          <tr>
            <td class="font-bold">Juru Audit 2</td>
            <td>${juruAudit2Name}</td>
            <td>${juruAudit2User?.email || '-'}</td>
          </tr>
        </tbody>
      </table>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 2</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 3 — AKAUN PENERIMAAN DAN PEMBAYARAN ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Akaun Penerimaan & Pembayaran (Cash Basis)</h2>
        <span>Halaman 3</span>
      </div>

      <div style="font-size: 11px; margin-bottom: 15px; text-align: center;" class="font-bold">
        AKAUN PENERIMAAN DAN PEMBAYARAN BAGI TAHUN BERAKHIR ${financialYearEnd.toUpperCase()}<br/>
        (Berdasarkan Aliran Tunai Sebenar Keluar Masuk Sepanjang Tahun)
      </div>

      <div class="grid-2">
        <!-- Receipts Panel -->
        <div>
          <h4 style="font-size: 11px; text-transform: uppercase; background: #0f172a; color: white; padding: 6px 12px; border-radius: 6px 6px 0 0;">Penerimaan (Inflow)</h4>
          <table style="margin-top: 0; font-size: 10px;">
            <thead>
              <tr>
                <th>Butiran Penerimaan</th>
                <th style="width: 30%; text-align: right;">Jumlah (RM)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #f1f5f9;">
                <td class="font-bold">Baki Awal bawa ke hadapan (b/b):</td>
                <td class="text-right font-bold font-mono">${bakiAwalTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding-left: 15px; font-weight: 600; color: #475569;">Pecahan Mengikut Akaun:</td>
                <td></td>
              </tr>
              <tr>
                <td style="padding-left: 25px;">• Tunai di Bank</td>
                <td class="text-right font-mono">${initialBank.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding-left: 25px;">• Tunai di Tangan</td>
                <td class="text-right font-mono">${initialTunai.toFixed(2)}</td>
              </tr>
              ${Object.keys(initialFundBreakdown).length > 0 ? `
              <tr>
                <td style="padding-left: 15px; font-weight: 600; color: #475569; padding-top: 4px;">Pecahan Mengikut Tabung / Kategori Khusus:</td>
                <td></td>
              </tr>
              ${Object.entries(initialFundBreakdown).filter(([, b]) => b.total > 0).map(([cat, b]) => `
              <tr>
                <td style="padding-left: 25px; color: #334155;">• ${cat}</td>
                <td class="text-right font-mono text-slate-700">${b.total.toFixed(2)}</td>
              </tr>
              `).join('')}
              ` : ''}
              ${Object.keys(receipts).length === 0 ? `
              <tr>
                <td colspan="2" class="text-center text-slate-400">Tiada rekod penerimaan</td>
              </tr>` : Object.keys(receipts).map(cat => `
              <tr>
                <td>Kutipan ${cat}</td>
                <td class="text-right font-mono">${receipts[cat].toFixed(2)}</td>
              </tr>
              `).join('')}
              <tr class="border-top-thick">
                <td class="font-bold">JUMLAH KECIL PENERIMAAN</td>
                <td class="text-right font-bold font-mono">${(totalReceiptsSum).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Payments Panel -->
        <div>
          <h4 style="font-size: 11px; text-transform: uppercase; background: #0f172a; color: white; padding: 6px 12px; border-radius: 6px 6px 0 0;">Pembayaran (Outflow)</h4>
          <table style="margin-top: 0; font-size: 10px;">
            <thead>
              <tr>
                <th>Butiran Pembayaran</th>
                <th style="width: 30%; text-align: right;">Jumlah (RM)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(payments).length === 0 ? `
              <tr>
                <td colspan="2" class="text-center text-slate-400">Tiada rekod pembayaran</td>
              </tr>` : Object.keys(payments).map(cat => `
              <tr>
                <td>Bayaran ${cat}</td>
                <td class="text-right font-mono">${payments[cat].toFixed(2)}</td>
              </tr>
              `).join('')}
              <tr>
                <td class="font-bold" style="padding-top: 15px;">Baki hantar ke hadapan (h/b):</td>
                <td class="text-right font-bold font-mono" style="padding-top: 15px;">${bakiAkhirTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding-left: 20px;">- Tunai di Bank</td>
                <td class="text-right font-mono">${finalBank.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding-left: 20px;">- Tunai di Tangan</td>
                <td class="text-right font-mono">${finalTunai.toFixed(2)}</td>
              </tr>
              <tr class="border-top-thick">
                <td class="font-bold">JUMLAH KECIL PEMBAYARAN</td>
                <td class="text-right font-bold font-mono">${(totalPaymentsSum + bakiAkhirTotal).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Balance Check Table -->
      <table style="margin-top: 25px; font-size: 11px;">
        <tbody>
          <tr style="background: #f8fafc;" class="border-top-thick border-double-bottom">
            <td class="font-bold" style="font-size: 12px; text-transform: uppercase;">Kunci Aliran Tunai Seimbang (Penerimaan = Pembayaran + Baki Akhir)</td>
            <td class="text-right font-bold font-mono" style="font-size: 12px; width: 25%;">${(totalReceiptsSum + bakiAwalTotal).toFixed(2)}</td>
            <td class="text-right font-bold font-mono" style="font-size: 12px; width: 25%;">${(totalPaymentsSum + bakiAkhirTotal).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 10px; color: #64748b; margin-top: 20px; font-style: italic;">
        * Nota: Penyata ini menunjukkan kedudukan tunai fizikal yang dipegang dalam Akaun Maybank Persatuan serta tunai runcit yang diuruskan oleh Bendahari Kehormat.
      </div>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 3</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 4 — AKAUN PENDAPATAN DAN PERBELANJAAN ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Akaun Pendapatan & Perbelanjaan (Accrual Basis)</h2>
        <span>Halaman 4</span>
      </div>

      <div style="font-size: 11px; margin-bottom: 20px; text-align: center;" class="font-bold">
        AKAUN PENDAPATAN DAN PERBELANJAAN BAGI TAHUN BERAKHIR ${financialYearEnd.toUpperCase()}<br/>
        (Berdasarkan Standard Perakaunan Kelab & Persatuan Berdaftar Malaysia)
      </div>

      <table style="font-size: 11px;">
        <thead>
          <tr>
            <th>Butiran Kewangan</th>
            <th style="width: 20%; text-align: right;">Nota</th>
            <th style="width: 20%; text-align: right;">Jumlah (RM)</th>
          </tr>
        </thead>
        <tbody>
          <!-- INCOME SECTION -->
          <tr style="background: #f1f5f9;">
            <td class="font-bold" colspan="3">A. PENDAPATAN PERSATUAN</td>
          </tr>
          ${Object.keys(receipts).map(cat => `
          <tr>
            <td style="padding-left: 20px;">Kutipan ${cat}</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${receipts[cat].toFixed(2)}</td>
          </tr>
          `).join('')}
          <tr>
            <td style="padding-left: 20px; font-weight: 600; color: #2563eb;">Tambah: Yuran Layak Diterima Tertunggak (Tahun Semasa)</td>
            <td class="text-right font-bold" style="color: #2563eb;">Nota 2</td>
            <td class="text-right font-bold font-mono" style="color: #2563eb;">${totalOutstandingFees.toFixed(2)}</td>
          </tr>
          <tr style="background: #f8fafc;" class="font-bold">
            <td>JUMLAH PENDAPATAN (A)</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${totalIncomeAccrual.toFixed(2)}</td>
          </tr>

          <!-- EXPENSE SECTION -->
          <tr style="background: #f1f5f9; border-top: 2px solid #cbd5e1;">
            <td class="font-bold" colspan="3">B. PERBELANJAAN PERSATUAN</td>
          </tr>
          ${Object.keys(expenses).map(cat => `
          <tr>
            <td style="padding-left: 20px;">Bayaran ${cat}</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${expenses[cat].toFixed(2)}</td>
          </tr>
          `).join('')}
          <tr style="background: #f8fafc;" class="font-bold border-top-thick">
            <td>JUMLAH PERBELANJAAN (B)</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${totalExpenseAccrual.toFixed(2)}</td>
          </tr>

          <!-- SURPLUS / DEFICIT -->
          <tr style="background: #f0fdf4; border-top: 2px solid #10b981; font-size: 12px;" class="font-bold border-double-bottom">
            <td style="color: #15803d; text-transform: uppercase;">Lebihan / (Kurangan) Pendapatan Atas Perbelanjaan (A - B)</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono" style="color: #15803d;">${surplusAccrual.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 30px; font-size: 11px;">
        <h4 style="font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ulasan Kewangan ${currentSessionLabel}:</h4>
        <div class="card-info" style="font-size: 10px; margin-top: 5px;">
          ${verificationData.treasurerComment || "Penyata kewangan ini menunjukkan baki kewangan yang sihat dengan peningkatan kutipan yuran dan sumbangan ikhlas. Semua perbelanjaan diuruskan dengan berhemah demi kebajikan dan kejayaan murid Sekolah Menengah Agama Ulu Jempol."}
        </div>
      </div>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 4</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 5 — PENYATA KEDUDUKAN KEWANGAN (KUNCI KIRA-KIRA) ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Penyata Kedudukan Kewangan (Kunci Kira-kira)</h2>
        <span>Halaman 5</span>
      </div>

      <div style="font-size: 11px; margin-bottom: 25px; text-align: center;" class="font-bold">
        PENYATA KEDUDUKAN KEWANGAN PADA ${financialYearEnd.toUpperCase()}
      </div>

      <table style="font-size: 11px;">
        <thead>
          <tr>
            <th>Butiran Aset & Liabiliti</th>
            <th style="width: 20%; text-align: right;">Nota</th>
            <th style="width: 20%; text-align: right;">Jumlah (RM)</th>
            <th style="width: 20%; text-align: right;">Subjumlah (RM)</th>
          </tr>
        </thead>
        <tbody>
          <!-- ASSETS -->
          <tr style="background: #f1f5f9;">
            <td class="font-bold" colspan="4">1. ASET PERSATUAN</td>
          </tr>
          <tr>
            <td class="font-bold" style="padding-left: 10px;">Aset Bukan Semasa (Aset Tetap):</td>
            <td class="text-right">Nota 9</td>
            <td class="text-right font-mono">${totalFixedAssetsVal.toFixed(2)}</td>
            <td class="text-right font-mono">-</td>
          </tr>
          ${fixedAssets.map(item => `
          <tr>
            <td style="padding-left: 20px;">- ${item.name}</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${item.val.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          `).join('')}

          <tr>
            <td class="font-bold" style="padding-left: 10px; padding-top: 12px;">Aset Semasa:</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">-</td>
            <td class="text-right font-mono">-</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">- Tunai di Bank</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${finalBank.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">- Tunai di Tangan</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${finalTunai.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          <tr>
            <td style="padding-left: 20px; font-weight: 600;">- Yuran Tertunggak Ahli</td>
            <td class="text-right font-bold">Nota 2</td>
            <td class="text-right font-bold font-mono">${totalOutstandingFees.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          ${otherCurrentAssets.map(item => `
          <tr>
            <td style="padding-left: 20px;">- ${item.name}</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${item.val.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          `).join('')}

          <tr style="background: #f8fafc; font-weight: 700;">
            <td class="font-bold">JUMLAH ASET keseluruhan</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">-</td>
            <td class="text-right font-mono">${totalAssetsVal.toFixed(2)}</td>
          </tr>

          <!-- LIABILITIES & CAPITAL -->
          <tr style="background: #f1f5f9; border-top: 2px solid #cbd5e1;">
            <td class="font-bold" colspan="4">2. LIABILITI DAN DANA PERSATUAN</td>
          </tr>
          <tr>
            <td class="font-bold" style="padding-left: 10px;">Liabiliti Semasa:</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">-</td>
            <td class="text-right font-mono">-</td>
          </tr>
          ${liabilitiesList.map(item => `
          <tr>
            <td style="padding-left: 20px;">- ${item.name}</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${item.val.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          `).join('')}
          <tr>
            <td style="padding-left: 20px; font-weight: 600;">- Yuran Diterima Terdahulu (Sesi Depan)</td>
            <td class="text-right font-bold">Nota 4</td>
            <td class="text-right font-bold font-mono">${totalAdvanceFees.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          ${otherLiabilities.map(item => `
          <tr>
            <td style="padding-left: 20px;">- ${item.name}</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${item.val.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          `).join('')}

          <tr>
            <td class="font-bold" style="padding-left: 10px; padding-top: 12px;">Dana Terkumpul Persatuan:</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">-</td>
            <td class="text-right font-mono">-</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">- Baki Awal Dana Terkumpul</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${capitalListVal.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          <tr style="color: #16a34a;">
            <td style="padding-left: 20px; font-weight: 600;">- Tambah: Lebihan Bersih Sesi Semasa</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${surplusAccrual.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>

          <tr style="background: #f8fafc; font-weight: 700;" class="border-top-thick border-double-bottom">
            <td class="font-bold">JUMLAH LIABILITI DAN DANA TERKUMPUL</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">-</td>
            <td class="text-right font-mono">${totalLiabilitiesAndFunds.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Balanced Status Note -->
      <div style="margin-top: 25px; padding: 12px; background-color: ${isBalanceSheetBalanced ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isBalanceSheetBalanced ? '#bbf7d0' : '#fecaca'}; border-radius: 6px; font-size: 11px; font-weight: 700; color: ${isBalanceSheetBalanced ? '#166534' : '#991b1b'}; display: flex; align-items: center; justify-content: space-between;">
        <span>STATUS KUNCI KIRA-KIRA SEMASA:</span>
        <span class="font-mono">${isBalanceSheetBalanced ? 'KUNCI KIRA-KIRA ADALAH SEIMBANG (BALANCE)' : `PERHATIAN: SELISIH IMBANGAN RM ${Math.abs(totalAssetsVal - totalLiabilitiesAndFunds).toFixed(2)}`}</span>
      </div>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 5</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 6 — PENYATA ALIRAN TUNAI ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Penyata Aliran Tunai</h2>
        <span>Halaman 6</span>
      </div>

      <div style="font-size: 11px; margin-bottom: 25px; text-align: center;" class="font-bold">
        PENYATA ALIRAN TUNAI BAGI TAHUN BERAKHIR ${financialYearEnd.toUpperCase()}<br/>
        (Berdasarkan Kedudukan Aliran Aliran Tunai Operasi, Pelaburan & Pembiayaan)
      </div>

      <table style="font-size: 11px;">
        <thead>
          <tr>
            <th>Butiran Aliran Tunai</th>
            <th style="width: 25%; text-align: right;">Subjumlah (RM)</th>
            <th style="width: 25%; text-align: right;">Jumlah (RM)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f1f5f9;">
            <td class="font-bold" colspan="3">A. ALIRAN TUNAI DARIPADA AKTIVITI OPERASI</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">Lebihan Pendapatan Atas Perbelanjaan Sesi Semasa</td>
            <td class="text-right font-mono">${surplusAccrual.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          <tr>
            <td style="padding-left: 20px; color: #ef4444;">Tolak: Peningkatan Yuran Tertunggak Ahli (Belum Terima)</td>
            <td class="text-right font-mono" style="color: #ef4444;">(${(totalOutstandingFees).toFixed(2)})</td>
            <td class="text-right">-</td>
          </tr>
          <tr>
            <td style="padding-left: 20px; color: #16a34a;">Tambah: Peningkatan Yuran Diterima Terdahulu (Liabiliti Semasa)</td>
            <td class="text-right font-mono" style="color: #16a34a;">${totalAdvanceFees.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          <tr class="font-bold" style="background: #f8fafc;">
            <td>Tunai Bersih Diperoleh dari Aktiviti Operasi</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${(surplusAccrual - totalOutstandingFees + totalAdvanceFees).toFixed(2)}</td>
          </tr>

          <tr style="background: #f1f5f9; border-top: 2px solid #cbd5e1;">
            <td class="font-bold" colspan="3">B. ALIRAN TUNAI DARIPADA AKTIVITI PELABURAN</td>
          </tr>
          <tr>
            <td style="padding-left: 20px; color: #ef4444;">Tolak: Pembelian Aset Bukan Semasa (Aset Tetap Baru)</td>
            <td class="text-right font-mono" style="color: #ef4444;">(0.00)</td>
            <td class="text-right">-</td>
          </tr>
          <tr class="font-bold" style="background: #f8fafc;">
            <td>Tunai Bersih Digunakan dalam Aktiviti Pelaburan</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">0.00</td>
          </tr>

          <tr style="background: #f1f5f9; border-top: 2px solid #cbd5e1;">
            <td class="font-bold" colspan="3">C. KESAN KESELURUHAN & MERAPATKAN BAKI</td>
          </tr>
          <tr style="background: #f0fdf4; font-size: 11px;" class="font-bold">
            <td>PERUBAHAN BERSIH TUNAI SEBELUM BAKI AWAL (A + B)</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${(surplusAccrual - totalOutstandingFees + totalAdvanceFees).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding-left: 10px; font-weight: 600;">Tambah: Baki Awal Tunai pada ${financialYearStart}</td>
            <td class="text-right font-mono">${bakiAwalTotal.toFixed(2)}</td>
            <td class="text-right">-</td>
          </tr>
          <tr style="background: #f1f5f9; font-size: 12px;" class="font-bold border-double-bottom">
            <td style="text-transform: uppercase;">BAKI TUNAI PADA AKHIR TAHUN PERAKUAN (${financialYearEnd})</td>
            <td class="text-right">-</td>
            <td class="text-right font-mono">${bakiAkhirTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 6</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 7 — NOTA KEPADA PENYATA KEWANGAN (1-5) ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Nota Kepada Penyata Kewangan (Nota 1 - 5)</h2>
        <span>Halaman 7</span>
      </div>

      <div style="font-size: 11px; margin-bottom: 15px;" class="font-bold uppercase text-center">
        NOTA KEPADA PENYATA KEWANGAN BAGI TAHUN PERAKUAN BERAKHIR ${financialYearEnd}
      </div>

      <!-- NOTA 1 -->
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 1: Dasar Perakaunan Penting</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px; text-align: justify;">
          <strong>1.1 Asas Perakaunan:</strong> Penyata kewangan disediakan di bawah kos sejarah dan mematuhi standard perakaunan kelab & persatuan di Malaysia. Pendapatan diiktiraf berdasarkan asas akruan di mana yuran yang layak diterima bagi sesi semasa direkodkan sebagai pendapatan walaupun belum dikutip.<br/>
          <strong>1.2 Pengiktirafan Pendapatan Yuran:</strong> Yuran keahlian sekali sahaja diiktiraf semasa pendaftaran ahli baru. Yuran bulanan dikira sepanjang 12 bulan sesi. Khairat kematian dan yuran tambahan khas diiktiraf mengikut tempoh layak diterima.
        </p>
      </div>

      <!-- NOTA 2 -->
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 2: Yuran Layak Diterima Tertunggak Ahli</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px; line-height: 1.4;">
          Jumlah tunggakan yuran yang belum dijelaskan oleh ahli bagi ${currentSessionLabel}. Pengiraan berdasarkan kaedah pilihan bayaran ahli:<br/>
          &bull; <strong>Cara Bulanan</strong>: Kadar penuh RM120 setahun (RM10 sebulan)<br/>
          &bull; <strong>Cara Per Penggal</strong>: Kadar diskaun RM110 setahun (RM55 bagi Penggal 1 & RM55 bagi Penggal 2)<br/>
          &bull; <strong>Cara Tahunan terus</strong>: Kadar diskaun RM100 setahun terus
        </p>
        <table style="font-size: 10px; margin-top: 8px;">
          <thead>
            <tr>
              <th>Butiran Tunggakan ${currentSessionLabel}</th>
              <th style="width: 30%; text-align: right;">Jumlah (RM)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Yuran Keahlian (Pendaftaran Baru Belum Bayar)</td>
              <td class="text-right font-mono">${totalKeahlianOwed.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Yuran Persatuan (${currentSessionLabel} Tunggakan)</td>
              <td class="text-right font-mono">${totalPersatuanOwed.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Khairat Kematian (${currentSessionLabel} Tunggakan)</td>
              <td class="text-right font-mono">${totalKhairatOwed.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Yuran Tambahan Khas Sesi Semasa</td>
              <td class="text-right font-mono">${totalTambahanOwed.toFixed(2)}</td>
            </tr>
            <tr class="font-bold" style="background: #f8fafc;">
              <td>JUMLAH YURAN TERTUNGGAK AHLI (Aset Semasa)</td>
              <td class="text-right font-mono">${totalOutstandingFees.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Arrears Breakdowns -->
        <p style="font-size: 9px; color: #64748b; margin-top: 10px; font-weight: 600;">
          Pecahan Bilangan Ahli dan Tempoh Tunggakan:<br/>
          &bull; 1 hingga 3 bulan tunggakan: ${arrearsBuckets.bucket1to3.count} ahli (RM ${arrearsBuckets.bucket1to3.amount.toFixed(2)})<br/>
          &bull; 4 hingga 6 bulan tunggakan: ${arrearsBuckets.bucket4to6.count} ahli (RM ${arrearsBuckets.bucket4to6.amount.toFixed(2)})<br/>
          &bull; Lebih 6 bulan tunggakan: ${arrearsBuckets.bucketOver6.count} ahli (RM ${arrearsBuckets.bucketOver6.amount.toFixed(2)})
        </p>

        <!-- Ringkasan Statistik Keahlian Komuniti -->
        <p style="font-size: 9px; color: #0f172a; margin-top: 12px; font-weight: 700; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          Ringkasan Statistik Keahlian Komuniti:<br/>
          <span style="color: #16a34a;">&bull; Jumlah Ahli Aktif (Diluluskan): ${activeCount} orang</span><br/>
          <span style="color: #dc2626;">&bull; Jumlah Ahli Ditolak Keahlian: ${ditolakCount} orang</span><br/>
          <span style="color: #dc2626;">&bull; Jumlah Ahli Dilucutkan Keahlian: ${dilucutkanCount} orang</span>
        </p>
      </div>

      <!-- NOTA 3 -->
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 3: Yuran Lapuk & Hapus Kira</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px;">
          Persatuan mengamalkan dasar sifar yuran lapuk bagi sesi semasa. Setakat tarikh ${financialYearEnd}, tiada sebarang hapus kira yuran (yuran lapuk) yang dilakukan. Semua baki tertunggak dianggap boleh kutip.
        </p>
      </div>

      <!-- NOTA 4 -->
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 4: Yuran Diterima Terdahulu (Liabiliti Semasa)</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px;">
          Sebarang yuran yang dibayar awal oleh ahli untuk Sesi akan datang (${selectedYear + 1}/${selectedYear + 2}) diiktiraf sebagai Liabiliti Semasa. Jumlah kutipan terdahulu setakat ${financialYearEnd}: <strong>RM ${totalAdvanceFees.toFixed(2)}</strong>.
        </p>
      </div>

      <!-- NOTA 5 -->
      <div>
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 5: Struktur Yuran Berdaftar Persatuan</h4>
        <table>
          <thead>
            <tr>
              <th>Kategori Pembayaran</th>
              <th style="text-align: right;">Bahagian Persatuan (RM)</th>
              <th style="text-align: right;">Bahagian Khairat (RM)</th>
              <th style="text-align: right;">Kadar Penuh (RM)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Yuran Keahlian (Sekali sahaja)</td>
              <td class="text-right font-mono">${yuranConfig.yuranKeahlian.price.toFixed(2)}</td>
              <td class="text-right font-mono">0.00</td>
              <td class="text-right font-mono">${yuranConfig.yuranKeahlian.price.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Yuran Bulanan (Kadar Sebulan)</td>
              <td class="text-right font-mono">${yuranConfig.yuranBulanan.persatuan.toFixed(2)}</td>
              <td class="text-right font-mono">${yuranConfig.yuranBulanan.khairat.toFixed(2)}</td>
              <td class="text-right font-mono">${(yuranConfig.yuranBulanan.persatuan + yuranConfig.yuranBulanan.khairat).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Yuran Penggal (Pembayaran 6 Bulan)</td>
              <td class="text-right font-mono">${displayPenggalPersatuanFull.toFixed(2)}</td>
              <td class="text-right font-mono">${displayPenggalKhairatFull.toFixed(2)}</td>
              <td class="text-right font-mono" style="text-decoration: line-through;">${(displayPenggalPersatuanFull + displayPenggalKhairatFull).toFixed(2)}</td>
            </tr>
            <tr style="background: #f1f5f9;" class="font-bold">
              <td style="padding-left: 20px;">* Kadar selepas Diskaun RM ${displayPenggalDiscount.toFixed(2)}</td>
              <td class="text-right font-mono">${(displayPenggalPersatuanFull - displayPenggalDiscount).toFixed(2)}</td>
              <td class="text-right font-mono">${displayPenggalKhairatFull.toFixed(2)}</td>
              <td class="text-right font-mono">${(displayPenggalPersatuanFull + displayPenggalKhairatFull - displayPenggalDiscount).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Yuran Tahunan (Pembayaran 12 Bulan)</td>
              <td class="text-right font-mono">${displayTahunanPersatuanFull.toFixed(2)}</td>
              <td class="text-right font-mono">${displayTahunanKhairatFull.toFixed(2)}</td>
              <td class="text-right font-mono" style="text-decoration: line-through;">${(displayTahunanPersatuanFull + displayTahunanKhairatFull).toFixed(2)}</td>
            </tr>
            <tr style="background: #f1f5f9;" class="font-bold">
              <td style="padding-left: 20px;">* Kadar selepas Diskaun RM ${displayTahunanDiscount.toFixed(2)}</td>
              <td class="text-right font-mono">${(displayTahunanPersatuanFull - displayTahunanDiscount).toFixed(2)}</td>
              <td class="text-right font-mono">${displayTahunanKhairatFull.toFixed(2)}</td>
              <td class="text-right font-mono">${(displayTahunanPersatuanFull + displayTahunanKhairatFull - displayTahunanDiscount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 10px; color: #334155;">
          <h5 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">
            Ringkasan Insentif & Diskaun Sesi Semasa
          </h5>
          <p style="margin: 4px 0;">
            &bull; <strong>Sistem Bayaran Tahunan:</strong> ${totalTahunanDiscountCount} ahli menikmati diskaun RM ${displayTahunanDiscount.toFixed(2)} seorang (Jumlah: <strong>RM ${(totalTahunanDiscountCount * displayTahunanDiscount).toFixed(2)}</strong>)
          </p>
          <p style="margin: 4px 0;">
            &bull; <strong>Sistem Bayaran Penggal 1:</strong> ${totalPenggal1DiscountCount} ahli menikmati diskaun RM ${displayPenggalDiscount.toFixed(2)} seorang (Jumlah: <strong>RM ${(totalPenggal1DiscountCount * displayPenggalDiscount).toFixed(2)}</strong>)
          </p>
          <p style="margin: 4px 0;">
            &bull; <strong>Sistem Bayaran Penggal 2:</strong> ${totalPenggal2DiscountCount} ahli menikmati diskaun RM ${displayPenggalDiscount.toFixed(2)} seorang (Jumlah: <strong>RM ${(totalPenggal2DiscountCount * displayPenggalDiscount).toFixed(2)}</strong>)
          </p>
          <p style="margin: 8px 0 0 0; font-size: 11px; font-weight: 700; color: #1e3a8a; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
            JUMLAH DISKAUN DIALIRKAN KEPADA AHLI: RM ${((totalTahunanDiscountCount * displayTahunanDiscount) + ((totalPenggal1DiscountCount + totalPenggal2DiscountCount) * displayPenggalDiscount)).toFixed(2)}
          </p>
        </div>
      </div>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 7</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 8 — NOTA KEPADA PENYATA KEWANGAN (6-9) ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Nota Kepada Penyata Kewangan (Nota 6 - 9)</h2>
        <span>Halaman 8</span>
      </div>

      <!-- NOTA 6 -->
      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 6: Kedudukan Dana & Tabung Khas / Amanah (Baki Pembuka, Penerimaan, Perbelanjaan & Baki Akhir)</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px;">
          Pecahan baki pembuka bawa ke hadapan (b/b), pergerakan tunai semasa dan baki akhir bawa ke hadapan (h/b) mengikut tabung, kategori dan lejar khusus bagi ${currentSessionLabel}:
        </p>
        <table style="font-size: 10px; margin-top: 8px;">
          <thead>
            <tr>
              <th>Tabung / Kategori Dana Khusus</th>
              <th style="width: 18%; text-align: right;">Baki Pembuka (b/b) (RM)</th>
              <th style="width: 18%; text-align: right;">Penerimaan Sesi (RM)</th>
              <th style="width: 18%; text-align: right;">Perbelanjaan Sesi (RM)</th>
              <th style="width: 18%; text-align: right;">Baki Akhir (h/b) (RM)</th>
            </tr>
          </thead>
          <tbody>
            ${fundMovements.map(fm => `
            <tr>
              <td class="font-semibold">${fm.name}</td>
              <td class="text-right font-mono">${fm.bakiAwal.toFixed(2)}</td>
              <td class="text-right font-mono" style="${fm.inflow > 0 ? 'color: #16a34a;' : ''}">${fm.inflow.toFixed(2)}</td>
              <td class="text-right font-mono" style="${fm.outflow > 0 ? 'color: #ef4444;' : ''}">${fm.outflow.toFixed(2)}</td>
              <td class="text-right font-mono font-bold" style="${fm.bakiAkhir >= 0 ? 'color: #0f172a;' : 'color: #ef4444;'}">${fm.bakiAkhir.toFixed(2)}</td>
            </tr>
            `).join('')}
            <tr class="font-bold border-top-thick" style="background: #f1f5f9;">
              <td>JUMLAH KESELURUHAN DANA (SELARAS DENGAN PENYATA)</td>
              <td class="text-right font-mono">${bakiAwalTotal.toFixed(2)}</td>
              <td class="text-right font-mono" style="color: #16a34a;">${totalReceiptsSum.toFixed(2)}</td>
              <td class="text-right font-mono" style="color: #ef4444;">${totalPaymentsSum.toFixed(2)}</td>
              <td class="text-right font-mono" style="color: #1d4ed8;">${bakiAkhirTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- NOTA 7 -->
      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 7: Caj Perkhidmatan Gerbang Pembayaran FPX Bayarcash</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px;">
          Bayarcash mengenakan caj perkhidmatan RM ${(yuranConfig.fpxCharge ?? 1.00).toFixed(2)} bagi setiap urus niaga FPX dalam sistem.<br/>
          &bull; <strong>Mod Caj FPX Persatuan:</strong> ${fpxModeLabel}<br/>
          &bull; <strong>Caj per Transaksi:</strong> RM ${(yuranConfig.fpxCharge ?? 1.00).toFixed(2)}<br/>
          &bull; <strong>Surcharge Status:</strong> ${isSurchargeMode ? `Ahli membayar tambahan RM ${(yuranConfig.fpxCharge ?? 1.00).toFixed(2)} semasa pemprosesan bayaran.` : "Caj diserap dari dalam yuran oleh persatuan."}
        </p>
        <table style="font-size: 10px; margin-top: 8px;">
          <thead>
            <tr>
              <th style="width: 15%;">Tarikh & Masa</th>
              <th style="width: 15%;">No. Rujukan / Baucar</th>
              <th>Keterangan Transaksi</th>
              <th style="width: 20%;">Aliran Tunai</th>
              <th style="width: 15%; text-align: right;">Jumlah (RM)</th>
            </tr>
          </thead>
          <tbody>
            ${fpxTransactions.length > 0 ? fpxTransactions.map(t => {
              const isKutipan = t.accountDebit === "Bank" || t.accountDebit === "Tunai";
              const direction = isKutipan ? "MASUK (Kutipan Surcharge)" : "KELUAR (Caj Bayarcash)";
              const color = isKutipan ? "color: #16a34a;" : "color: #ef4444;";
              return `
              <tr>
                <td>${t.date} ${t.time || ''}</td>
                <td class="font-mono">${t.voucherNo || t.id}</td>
                <td>${t.description}</td>
                <td style="${color} font-weight: 600;">${direction}</td>
                <td class="text-right font-mono" style="${color}">${isKutipan ? '' : '-'}${t.amount.toFixed(2)}</td>
              </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="5" class="text-center text-slate-400" style="padding: 15px;">Tiada transaksi caj perkhidmatan FPX direkodkan untuk Sesi ini</td>
              </tr>
            `}
            <tr class="font-bold" style="background: #f8fafc;">
              <td colspan="4">JUMLAH KUTIPAN SURCHARGE FPX (HASIL)</td>
              <td class="text-right font-mono" style="color: #16a34a;">${totalFpxKutipan.toFixed(2)}</td>
            </tr>
            <tr class="font-bold" style="background: #f8fafc;">
              <td colspan="4">JUMLAH CAJ PERKHIDMATAN FPX DIBAYAR (BELANJA)</td>
              <td class="text-right font-mono" style="color: #ef4444;">-${totalFpxBayaran.toFixed(2)}</td>
            </tr>
            <tr class="font-bold" style="background: #f1f5f9; border-top: 2px solid #cbd5e1;">
              <td colspan="4">IMPAK BERSIH CAJ FPX KEPADA PERSATUAN</td>
              <td class="text-right font-mono">${(totalFpxKutipan - totalFpxBayaran).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- NOTA 8 -->
      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 8: Yuran Tambahan Khas Ahli Jawatankuasa</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px;">
          Senarai yuran tambahan khusus yang berdaftar dalam sistem:
        </p>
        <table style="font-size: 10px; margin-top: 8px;">
          <thead>
            <tr>
              <th>Tajuk Yuran Tambahan</th>
              <th>Jenis Tempoh</th>
              <th>Kategori Hasil</th>
              <th style="width: 25%; text-align: right;">Kadar Caj (RM)</th>
            </tr>
          </thead>
          <tbody>
            ${yuranConfig.additionalFees && yuranConfig.additionalFees.length > 0 ? yuranConfig.additionalFees.map(fee => `
            <tr>
              <td>${fee.title}</td>
              <td>${fee.feeType}</td>
              <td>${fee.category}</td>
              <td class="text-right font-mono">${fee.price.toFixed(2)}</td>
            </tr>
            `).join('') : `
            <tr>
              <td colspan="4" class="text-center text-slate-400">Tiada yuran tambahan berdaftar untuk Sesi ini</td>
            </tr>
            `}
          </tbody>
        </table>
      </div>

      <!-- NOTA 9 -->
      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">Nota 9: Senarai Aset Bukan Semasa (Aset Tetap)</h4>
        <p style="font-size: 10px; color: #475569; margin-top: 5px;">
          Persatuan mendaftarkan aset tetap berikut pada kos nilai pembelian asal:
        </p>
        <table style="font-size: 10px; margin-top: 8px;">
          <thead>
            <tr>
              <th>Nama Aset Komuniti</th>
              <th style="width: 30%; text-align: right;">Nilai Kos Pembelian (RM)</th>
            </tr>
          </thead>
          <tbody>
            ${fixedAssets.length > 0 ? fixedAssets.map(item => `
            <tr>
              <td>${item.name}</td>
              <td class="text-right font-mono">${item.val.toFixed(2)}</td>
            </tr>
            `).join('') : `
            <tr>
              <td colspan="2" class="text-center text-slate-400">Tiada aset bukan semasa berdaftar</td>
            </tr>
            `}
            <tr class="font-bold" style="background: #f8fafc;">
              <td>JUMLAH KESELURUHAN KOS ASET TETAP</td>
              <td class="text-right font-mono">${totalFixedAssetsVal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 8</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 9 — LAPORAN JURUAUDIT DALAMAN ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Laporan Juruaudit Dalaman</h2>
        <span>Halaman 9</span>
      </div>

      <div style="font-size: 13px; text-align: center; text-transform: uppercase; margin-bottom: 30px;" class="font-bold">
        LAPORAN JURUAUDIT DALAMAN SEKOLAH MENENGAH AGAMA ULU JEMPOL
      </div>

      <div style="font-size: 11px; line-height: 1.8; color: #334155;">
        <p><strong>Kepada Warga & Ahli PIBG Berdaftar,</strong><br/>
        Sekolah Menengah Agama Ulu Jempol, Batu Kikir, Negeri Sembilan</p>

        <p style="margin-top: 15px; text-align: justify;">
          Kami, yang bertandatangan di bawah, merupakan Juru Audit Dalaman yang dilantik untuk memeriksa dan mengaudit buku perakaunan serta Penyata Kewangan Sekolah Menengah Agama Ulu Jempol bagi tahun kewangan berakhir <strong>${financialYearEnd}</strong>.
        </p>

        <p style="margin-top: 15px; text-align: justify;">
          Kami telah memeriksa baucar-baucar pembayaran, resit kutipan yuran persekolahan dan sumbangan PIBG, penyata akaun bank rasmi, serta semua dokumen sokongan kewangan yang disediakan oleh Bendahari. Pemeriksaan dilakukan mengikut standard semakan audit kewangan institusi pendidikan.
        </p>

        <h4 style="font-size: 11px; text-transform: uppercase; margin-top: 20px; margin-bottom: 5px;">Ulasan & Komen Rasmi Juru Audit:</h4>
        <div class="card-info" style="font-size: 10px; margin-top: 5px; line-height: 1.5; font-style: italic;">
          ${verificationData.auditorComment || "Kami mendapati semua urusan kemasukan wang (sumbangan PIBG & program) dan aliran keluar (pembangunan, kebajikan pelajar & pengurusan) telah direkodkan dengan teratur dalam lejar umum. Tiada sebarang salah laku atau penyelewengan dikenal pasti."}
        </div>

        <p style="margin-top: 20px; text-align: justify;">
          <strong>Pendapat Audit Dalaman:</strong> Pada pendapat kami, Penyata Kewangan ini memberi gambaran yang benar dan saksama mengenai kedudukan kewangan Sekolah Menengah Agama Ulu Jempol bagi tahun berakhir ${financialYearEnd} serta aliran tunai yang seimbang.
        </p>

        <p style="margin-top: 15px;"><strong>Status Pemeriksaan Audit:</strong> <span class="font-bold" style="color: #10b981;">${currentAuditStatus}</span></p>
      </div>

      <div class="sign-section" style="margin-top: 40px;">
        <div class="sign-block">
          <p class="font-bold">JURUAUDIT DALAMAN 1</p>
          ${verificationData.audited1Signed && verificationData.audited1SignURL ? `
          <img src="${verificationData.audited1SignURL}" class="signature-img" alt="Tandatangan Juru Audit 1" />
          ` : `
          <div class="placeholder-sign-line"></div>
          `}
          <p class="font-bold" style="font-size: 11px; margin-top: 10px;">${juruAudit1PrintedName}</p>
          <p style="font-size: 9px; color: #64748b;">Juru Audit Dalaman 1 (PIBG / SMAUJ)</p>
          <p style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Tarikh: ${verificationData.audited1At || todayStr}</p>
        </div>

        <div class="sign-block">
          <p class="font-bold">JURUAUDIT DALAMAN 2</p>
          ${verificationData.audited2Signed && verificationData.audited2SignURL ? `
          <img src="${verificationData.audited2SignURL}" class="signature-img" alt="Tandatangan Juru Audit 2" />
          ` : `
          <div class="placeholder-sign-line"></div>
          `}
          <p class="font-bold" style="font-size: 11px; margin-top: 10px;">${juruAudit2PrintedName}</p>
          <p style="font-size: 9px; color: #64748b;">Juru Audit Dalaman 2 (PIBG / SMAUJ)</p>
          <p style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Tarikh: ${verificationData.audited2At || todayStr}</p>
        </div>
      </div>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 9</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 10 — PENGESAHAN & TANDATANGAN ==================== -->
  <div class="book-page">
    <div class="page-body">
      <div class="page-header">
        <h2>Pengesahan & Perakuan Pengurusan / PIBG</h2>
        <span>Halaman 10</span>
      </div>

      <div style="font-size: 11px; color: #334155; line-height: 1.8;">
        <p class="font-bold" style="text-transform: uppercase; margin-bottom: 10px;">Perakuan oleh Jawatankuasa:</p>
        <p style="text-align: justify;">
          Kami, bagi pihak Pengurusan dan Jawatankuasa PIBG Sekolah Menengah Agama Ulu Jempol, mengesahkan bahawa Penyata Kewangan yang terkandung dari halaman 1 hingga 10 ini adalah benar, lengkap dan disediakan mengikut buku rekod perakaunan institusi. Semua transaksi adalah sah dan diluluskan dalam Mesyuarat Pengurusan & PIBG.
        </p>
      </div>

      <div class="sign-section">
        <div class="sign-block">
          <p class="font-bold">DISEDIAKAN OLEH (BENDAHARI):</p>
          ${verificationData.preparedSigned && verificationData.preparedSignURL ? `
          <img src="${verificationData.preparedSignURL}" class="signature-img" alt="Tandatangan Bendahari" />
          ` : `
          <div class="placeholder-sign-line"></div>
          `}
          <p class="font-bold" style="font-size: 11px; margin-top: 10px;">${preparedPrintedName}</p>
          <p style="font-size: 9px; color: #64748b;">Bendahari PIBG / SMAUJ</p>
          <p style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Tarikh: ${verificationData.preparedAt || todayStr}</p>
        </div>

        <div class="sign-block">
          <p class="font-bold">DISEMAK OLEH (SETIAUSAHA):</p>
          ${verificationData.reviewedSigned && verificationData.reviewedSignURL ? `
          <img src="${verificationData.reviewedSignURL}" class="signature-img" alt="Tandatangan Setiausaha" />
          ` : `
          <div class="placeholder-sign-line"></div>
          `}
          <p class="font-bold" style="font-size: 11px; margin-top: 10px;">${setiausahaPrintedName}</p>
          <p style="font-size: 9px; color: #64748b;">Setiausaha PIBG / SMAUJ</p>
          <p style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Tarikh: ${verificationData.reviewedAt || todayStr}</p>
        </div>
      </div>

      <div class="sign-section" style="margin-top: 20px;">
        <div class="sign-block" style="grid-column: span 2;">
          <p class="font-bold">DILULUSKAN OLEH (PENGETUA / YDP PIBG):</p>
          ${verificationData.authorizedSigned && verificationData.authorizedSignURL ? `
          <img src="${verificationData.authorizedSignURL}" class="signature-img" alt="Tandatangan Pengerusi" style="max-height: 70px;" />
          ` : `
          <div class="placeholder-sign-line" style="height: 50px;"></div>
          `}
          <p class="font-bold" style="font-size: 11px; margin-top: 10px;">${pengerusiPrintedName}</p>
          <p style="font-size: 9px; color: #64748b;">Pengetua / YDP PIBG SMAUJ</p>
          <p style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Tarikh: ${verificationData.authorizedAt || todayStr}</p>
        </div>
      </div>

    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 10</span>
    </div>
  </div>

  <!-- ==================== HALAMAN 11 — MUKA BELAKANG (BACK COVER) ==================== -->
  <div class="book-page">
    <div class="page-body" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
      
      <!-- Small Logo -->
      <img src="${logoBase64}" alt="Logo Sekolah" style="max-height: 100px; margin-bottom: 30px;" />

      <h2 style="font-size: 16px; font-weight: 800; color: #334155; text-transform: uppercase;">SEKOLAH MENENGAH AGAMA ULU JEMPOL</h2>
      <p style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 5px;">ULU JEMPOL, 72200 BATU KIKIR, NEGERI SEMBILAN</p>
      
      <div style="width: 60px; height: 3px; background: #e2e8f0; margin: 30px 0;"></div>

      <p style="font-size: 11px; font-weight: 700; color: #475569; max-width: 80%; line-height: 1.6;">
        "Ilmu, Amal & Taqwa<br/>Membina Generasi Rabbani Berwawasan"
      </p>

      <div style="border-top: 1px dashed #cbd5e1; width: 80%; margin-top: 40px; padding-top: 20px; font-size: 10px; color: #64748b; line-height: 1.8;">
        <p>Dicetak secara automatik daripada Portal Rasmi Sekolah Menengah Agama Ulu Jempol</p>
        <p class="font-mono" style="font-size: 9px; margin-top: 5px; color: #94a3b8;">SYSTEM_DIGITAL_ID: BOOK_REPORT_${effectiveFilterYear}_SECURE_PRINT</p>
      </div>

      <p style="font-size: 9px; color: #94a3b8; font-weight: 700; margin-top: 60px; text-transform: uppercase;">
        &copy; 2026 Sekolah Menengah Agama Ulu Jempol. Hak Cipta Terpelihara.
      </p>
    </div>
    <div class="page-footer">
      <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL</span>
      <span>Halaman 11</span>
    </div>
  </div>

</body>
</html>`;
}
