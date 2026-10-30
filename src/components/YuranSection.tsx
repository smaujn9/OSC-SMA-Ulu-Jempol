import React, { useEffect } from 'react';
import { FeeItem, ImageFeePackage } from '../types';
import { 
  Check, CreditCard, ShieldCheck, Calendar, Info, Heart, Users, 
  ShoppingCart, ArrowRight, X, Award, User, HelpCircle, AlertCircle,
  Search, Plus, TrendingUp, FileText, MoreHorizontal, MessageCircle, Download,
  Coins, Clock, ShieldAlert, CheckCircle2, Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KewanganTransaction, INITIAL_TRANSACTIONS } from './KewanganSection';
import { generateReceiptPdf } from '../utils/receiptPdf';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';
import { cleanUndefined } from '../utils/firestoreUtils';
import { sendTelegramPaymentNotification } from '../utils/telegramHelper';
import { doc, updateDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  getPackagePrice, 
  YuranConfig, 
  getCategoryBadgeStyle, 
  detectActiveSessionYear,
  DEFAULT_YURAN_CONFIG,
  generate12Months,
  monthNamesMs,
  generatePackagesFromConfig
} from '../utils/yuranConfigHelper';

interface YuranSectionProps {
  fees: FeeItem[];
  onPayFees: (feeIds: string[], bankName: string) => void;
  packages: ImageFeePackage[];
  setPackages: React.Dispatch<React.SetStateAction<ImageFeePackage[]>>;
  cartPackageIds: string[];
  setCartPackageIds: React.Dispatch<React.SetStateAction<string[]>>;
  onOpenCart?: () => void;
  yuranConfig?: YuranConfig;
}

export default function YuranSection({ 
  fees, 
  onPayFees, 
  packages, 
  setPackages, 
  cartPackageIds, 
  setCartPackageIds,
  onOpenCart,
  yuranConfig: propYuranConfig
}: YuranSectionProps) {
  const { currentUserDoc, allUsers, firebaseUser } = useAuth();

  const [transactions, setTransactions] = React.useState<KewanganTransaction[]>(() => {
    const saved = localStorage.getItem('tmf2_kewangan_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  // Yuran Tambahan subscription & selection logic
  const [yuranConfig, setYuranConfig] = React.useState<YuranConfig | null>(() => {
    try {
      const cached = localStorage.getItem('tmf2_yuran_config');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const [benefitsConfig, setBenefitsConfig] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'system', 'yuranConfig'), (docSnap) => {
      if (docSnap.exists()) {
        setYuranConfig(docSnap.data() as YuranConfig);
      }
    }, (error) => {
      console.warn("Ralat akses system/yuranConfig di YuranSection:", error);
    });

    const unsubBenefits = onSnapshot(doc(db, 'system', 'benefitsConfig'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().items) {
        setBenefitsConfig(docSnap.data().items);
      } else {
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
            title: "Khairat Kematian & Kebajikan SMAUJ",
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
          },
          {
            id: "item5",
            title: "Insentif Kecemerlangan Pendidikan",
            description: "Saguhati dan hadiah wang tunai tahunan khas untuk anak-anak ahli persatuan yang memperoleh keputusan akademik gemilang dalam peperiksaan awam (SPM, STPM, Sijil Agama, dll).",
            icon: "Award",
            color: "amber"
          },
          {
            id: "item6",
            title: "Program Sukaneka & Hubungan Kejiranan",
            description: "Diskaun penuh atau penyertaan percuma bagi sebarang program sukaneka tahunan, sambutan perayaan (Hari Raya, Merdeka), kursus, kem kepimpinan remaja, dan aktiviti riadah kejiranan.",
            icon: "HelpCircle",
            color: "violet"
          }
        ]);
      }
    }, (error) => {
      console.warn("Ralat akses system/benefitsConfig di YuranSection:", error);
    });

    return () => {
      unsub();
      unsubBenefits();
    };
  }, [db, firebaseUser]);

  React.useEffect(() => {
    if (!db || !firebaseUser || firebaseUser.uid === 'guest_local') return;
    const unsub = onSnapshot(collection(db, 'kewanganTransactions'), (snapshot) => {
      const txns: KewanganTransaction[] = [];
      snapshot.forEach((docSnap) => {
        txns.push(docSnap.data() as KewanganTransaction);
      });
      if (txns.length > 0) {
        setTransactions(txns);
      }
    }, (error) => {
      console.warn("Ralat akses kewanganTransactions di YuranSection:", error);
    });
    return () => unsub();
  }, [db, firebaseUser]);


  const userEmail = currentUserDoc?.email || firebaseUser?.email || '';
  const userPendingTxns = React.useMemo(() => {
    if (!userEmail) return [];
    return transactions.filter(t => 
      t.memberEmail && 
      t.memberEmail.toLowerCase() === userEmail.toLowerCase() && 
      t.approvalStatus === 'Pending'
    );
  }, [transactions, userEmail]);

  const pendingPackageIds = React.useMemo(() => {
    return Array.from(new Set(userPendingTxns.flatMap(t => t.paidPackageIds || [])));
  }, [userPendingTxns]);

  const handleToggleFeeSelection = async (feeId: string) => {
    if (!currentUserDoc?.uid) return;
    try {
      const currentSelected = currentUserDoc.selectedTambahanIds || [];
      let newSelected: string[];
      if (currentSelected.includes(feeId)) {
        newSelected = currentSelected.filter(id => id !== feeId);
      } else {
        newSelected = [...currentSelected, feeId];
      }
      const userRef = doc(db, 'users', currentUserDoc.uid);
      await updateDoc(userRef, {
        selectedTambahanIds: newSelected
      });
    } catch (error) {
      console.error("Ralat mengemaskini pilihan yuran tambahan:", error);
    }
  };

  // Admin Manual Payment states
  const [showAdminManualModal, setShowAdminManualModal] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>("");
  const [selectedManualPackageIds, setSelectedManualPackageIds] = React.useState<string[]>([]);
  const [manualTambahanAmounts, setManualTambahanAmounts] = React.useState<Record<string, number>>({});
  const [manualDebitAccount, setManualDebitAccount] = React.useState<'Tunai' | 'Bank'>('Tunai');
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [proofPreview, setProofPreview] = React.useState<string | null>(null);
  const [uploadingManual, setUploadingManual] = React.useState<boolean>(false);
  const [adminManualError, setAdminManualError] = React.useState<string | null>(null);
  const [adminManualSuccess, setAdminManualSuccess] = React.useState<boolean>(false);

  const isUserAdminOrTreasurer = currentUserDoc?.role === 'Admin Utama' || currentUserDoc?.role === 'ADMIN UTAMA' || currentUserDoc?.isSuperAdmin === true || currentUserDoc?.email?.toLowerCase() === 'g-59129199@moe-dl.edu.my' || currentUserDoc?.role === 'Bendahari';
  const selectedMemberDoc = allUsers?.find(u => u.uid === selectedMemberId);
  const memberPaidPackageIds = selectedMemberDoc?.paidPackageIds || [];
  
  const getPaidAmountForPackage = (pkgId: string, email: string) => {
    if (!email) return 0;
    return transactions
      .filter(t => t.memberEmail === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(pkgId))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  };

  const manualTotalAmount = packages
    .filter(p => selectedManualPackageIds.includes(p.id))
    .reduce((sum, p) => {
      if (p.category === 'Tambahan') {
        const customAmt = manualTambahanAmounts[p.id];
        if (customAmt !== undefined) return sum + customAmt;
        const paidSoFar = getPaidAmountForPackage(p.id, selectedMemberDoc?.email || '');
        return sum + Math.max(0, getPackagePrice(p) - paidSoFar);
      }
      return sum + getPackagePrice(p);
    }, 0);

  const resetManualForm = () => {
    setSelectedMemberId("");
    setSelectedManualPackageIds([]);
    setManualTambahanAmounts({});
    setManualDebitAccount('Tunai');
    setProofFile(null);
    setProofPreview(null);
    setUploadingManual(false);
    setAdminManualError(null);
    setAdminManualSuccess(false);
  };

  const handleToggleManualPackage = (pkgId: string) => {
    setSelectedManualPackageIds(prev => {
      const isCurrentlySelected = prev.includes(pkgId);
      if (isCurrentlySelected) {
        setManualTambahanAmounts(prevAmounts => {
          const updated = { ...prevAmounts };
          delete updated[pkgId];
          return updated;
        });
        return prev.filter(id => id !== pkgId);
      } else {
        const pkg = packages.find(p => p.id === pkgId);
        if (pkg && pkg.category === 'Tambahan') {
          const paidSoFar = getPaidAmountForPackage(pkgId, selectedMemberDoc?.email || '');
          const remaining = Math.max(0, getPackagePrice(pkg) - paidSoFar);
          setManualTambahanAmounts(prevAmounts => ({
            ...prevAmounts,
            [pkgId]: remaining
          }));
        }
        return [...prev, pkgId];
      }
    });
  };

  const handleSubmitManualPayment = async () => {
    if (!selectedMemberId) {
      setAdminManualError("Sila pilih ahli terlebih dahulu.");
      return;
    }
    if (selectedManualPackageIds.length === 0) {
      setAdminManualError("Sila pilih sekurang-kurangnya satu yuran.");
      return;
    }

    setUploadingManual(true);
    setAdminManualError(null);

    try {
      let downloadUrl = "";
      // 1. Upload proof file to Firebase Storage if available
      if (proofFile) {
        const fileExtension = proofFile.name.split('.').pop() || 'png';
        const storagePath = `proofs/manual_pay_${selectedMemberId}_${Date.now()}.${fileExtension}`;
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, proofFile);
        downloadUrl = await getDownloadURL(fileRef);
      }

      // 2. Update user's paidPackageIds in Firestore
      const packagesToAddToPaid: string[] = [];
      const selectedPkgs = packages.filter(p => selectedManualPackageIds.includes(p.id));
      for (const p of selectedPkgs) {
        if (p.category !== 'Tambahan') {
          packagesToAddToPaid.push(p.id);
        } else {
          const originalPrice = getPackagePrice(p);
          const paidSoFar = getPaidAmountForPackage(p.id, selectedMemberDoc?.email || '');
          const payNow = manualTambahanAmounts[p.id] !== undefined 
            ? manualTambahanAmounts[p.id] 
            : Math.max(0, originalPrice - paidSoFar);
          if (paidSoFar + payNow >= originalPrice) {
            packagesToAddToPaid.push(p.id);
          }
        }
      }

      const updatedPaidIds = Array.from(new Set([...memberPaidPackageIds, ...packagesToAddToPaid]));
      await updateDoc(doc(db, 'users', selectedMemberId), {
        paidPackageIds: updatedPaidIds
      });

      // 3. Add transactions to kewanganTransactions in Firestore as "Duit Tunai Masuk"
      const dateStr = new Date().toISOString().split('T')[0]; // "2026-06-27"
      const timeStr = new Date().toTimeString().slice(0, 5);  // "12:00"

      const targetMemberEmail = selectedMemberDoc?.email || "";

      for (let i = 0; i < selectedPkgs.length; i++) {
        const p = selectedPkgs[i];
        const isKeahlian = p.category === 'Keahlian';

        if (isKeahlian) {
          const nextIdNum = transactions.length + i + 1;
          const txnId = `TXN-2026-M-${String(nextIdNum).padStart(4, '0')}`;
          const vchId = `VCH-2026-M-${String(nextIdNum).padStart(4, '0')}`;

          const newTxn: KewanganTransaction = {
            id: txnId,
            voucherNo: vchId,
            date: dateStr,
            time: timeStr,
            accountDebit: manualDebitAccount,
            accountCredit: "Yuran Keahlian",
            amount: p.price,
            description: `Bayaran ${manualDebitAccount} Manual Yuran Keahlian (${p.name}) oleh ${selectedMemberDoc?.displayName || selectedMemberDoc?.nickname || 'Ahli'}`,
            category: "Yuran Keahlian",
            recordedBy: `${currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin'} (Manual)`,
            approvalStatus: "Approved",
            approvedDate: dateStr,
            approvedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
            receiptAttachment: downloadUrl,
            notes: `Bayaran secara manual (${manualDebitAccount}) yang didaftarkan oleh Admin Utama / Bendahari.`,
            memberEmail: targetMemberEmail,
            paidPackageIds: [p.id],
            auditTrail: [
              { 
                time: `${dateStr} ${timeStr}`, 
                user: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin', 
                action: `Merekod yuran manual secara ${manualDebitAccount} (Lulus)` 
              }
            ]
          };

          await setDoc(doc(db, 'kewanganTransactions', txnId), cleanUndefined(newTxn));
        } else {
          // It's a Yuran Bulanan/Penggal/Tahunan or Tambahan package
          let yuranAmount = 0;
          let khairatAmount = 0;

          let configObj: any = null;
          try {
            const cached = localStorage.getItem('tmf2_yuran_config');
            if (cached) {
              configObj = JSON.parse(cached);
            }
          } catch (e) {
            console.error(e);
          }

          const isTambahan = p.category === 'Tambahan';
          const isTahunan = !isTambahan && (p.category === 'Tahunan' || p.name.includes('PerTahun') || p.name.includes('Tahunan') || p.name.includes('12 Bulan'));
          const isPenggal = !isTambahan && (p.category === 'Penggal' || p.name.includes('Perpenggal') || p.name.includes('Penggal') || p.name.includes('6 Bulan'));
          const isBulanan = !isTambahan && (p.category === 'Bulanan' || p.name.includes('Bulanan'));

          if (isTambahan) {
            const customAmt = manualTambahanAmounts[p.id];
            yuranAmount = customAmt !== undefined ? customAmt : Math.max(0, getPackagePrice(p) - getPaidAmountForPackage(p.id, targetMemberEmail));
          } else if (isTahunan) {
            khairatAmount = configObj?.yuranTahunan?.khairat ?? 60;
            yuranAmount = Math.max(0, p.price - khairatAmount);
          } else if (isPenggal) {
            khairatAmount = configObj?.yuranPenggal?.khairat ?? 30;
            yuranAmount = Math.max(0, p.price - khairatAmount);
          } else if (isBulanan) {
            khairatAmount = configObj?.yuranBulanan?.khairat ?? 5;
            yuranAmount = Math.max(0, p.price - khairatAmount);
          } else {
            if (p.breakdown) {
              yuranAmount = parseFloat(p.breakdown.usersAmount.replace(/[^0-9.]/g, '')) || 0;
              khairatAmount = parseFloat(p.breakdown.heartAmount.replace(/[^0-9.]/g, '')) || 0;
            } else {
              yuranAmount = p.price;
            }
          }

          if (yuranAmount > 0) {
            const nextIdNum1 = transactions.length + (i * 2) + 1;
            const txnId1 = `TXN-2026-M-${String(nextIdNum1).padStart(4, '0')}`;
            const vchId1 = `VCH-2026-M-${String(nextIdNum1).padStart(4, '0')}`;

            const creditAcc = isTambahan ? (p.realCategory || "Yuran Tambahan") : (p.realCategory || "Yuran Bulanan");

            const newTxn1: KewanganTransaction = {
              id: txnId1,
              voucherNo: vchId1,
              date: dateStr,
              time: timeStr,
              accountDebit: manualDebitAccount,
              accountCredit: creditAcc,
              amount: yuranAmount,
              description: `Bayaran ${manualDebitAccount} Manual ${creditAcc} (${p.name}) oleh ${selectedMemberDoc?.displayName || selectedMemberDoc?.nickname || 'Ahli'}`,
              category: creditAcc,
              recordedBy: `${currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin'} (Manual)`,
              approvalStatus: "Approved",
              approvedDate: dateStr,
              approvedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
              receiptAttachment: downloadUrl,
              notes: `Bayaran secara manual (${manualDebitAccount}) yang didaftarkan oleh Admin Utama / Bendahari.`,
              memberEmail: targetMemberEmail,
              paidPackageIds: [p.id],
              sessionYear: p.sessionYear,
              auditTrail: [
                { 
                  time: `${dateStr} ${timeStr}`, 
                  user: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin', 
                  action: `Merekod yuran manual secara ${manualDebitAccount} (Lulus)` 
                }
              ]
            };

            await setDoc(doc(db, 'kewanganTransactions', txnId1), cleanUndefined(newTxn1));
          }

          if (khairatAmount > 0) {
            const nextIdNum2 = transactions.length + (i * 2) + 2;
            const txnId2 = `TXN-2026-M-${String(nextIdNum2).padStart(4, '0')}`;
            const vchId2 = `VCH-2026-M-${String(nextIdNum2).padStart(4, '0')}`;

            const newTxn2: KewanganTransaction = {
              id: txnId2,
              voucherNo: vchId2,
              date: dateStr,
              time: timeStr,
              accountDebit: manualDebitAccount,
              accountCredit: "Khairat Kematian",
              amount: khairatAmount,
              description: `Bayaran ${manualDebitAccount} Manual Khairat Kematian (${p.name}) oleh ${selectedMemberDoc?.displayName || selectedMemberDoc?.nickname || 'Ahli'}`,
              category: "Khairat Kematian",
              recordedBy: `${currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin'} (Manual)`,
              approvalStatus: "Approved",
              approvedDate: dateStr,
              approvedBy: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin',
              receiptAttachment: downloadUrl,
              notes: `Bayaran secara manual (${manualDebitAccount}) yang didaftarkan oleh Admin Utama / Bendahari.`,
              memberEmail: targetMemberEmail,
              paidPackageIds: [p.id],
              sessionYear: p.sessionYear,
              auditTrail: [
                { 
                  time: `${dateStr} ${timeStr}`, 
                  user: currentUserDoc?.displayName || currentUserDoc?.nickname || 'Admin', 
                  action: `Merekod yuran manual secara ${manualDebitAccount} (Lulus)` 
                }
              ]
            };

            await setDoc(doc(db, 'kewanganTransactions', txnId2), cleanUndefined(newTxn2));
          }
        }
      }



      // Hantar Notifikasi ke Telegram bagi Bayaran Manual oleh Admin/Bendahari
      try {
        const totalPaidAmount = (selectedPkgs || []).reduce((sum, p) => {
          const amt = p.category === 'Tambahan' ? (manualTambahanAmounts[p.id] ?? getPackagePrice(p)) : getPackagePrice(p);
          return sum + amt;
        }, 0);

        const itemsList = (selectedPkgs || []).map(p => ({
          name: p.name,
          category: p.category,
          amount: p.category === 'Tambahan' ? (manualTambahanAmounts[p.id] ?? getPackagePrice(p)) : getPackagePrice(p),
          sessionYear: p.sessionYear
        }));

        await sendTelegramPaymentNotification({
          payerName: selectedMemberDoc?.displayName || selectedMemberDoc?.nickname || 'Ahli',
          payerEmail: selectedMemberDoc?.email || '',
          payerPhone: selectedMemberDoc?.phoneNumber || '',
          paymentMethod: `Bayaran Manual (${manualDebitAccount})`,
          totalAmount: totalPaidAmount,
          approvalStatus: 'Approved',
          items: itemsList,
          receiptUrl: downloadUrl,
          notes: `Bayaran manual direkod oleh ${currentUserDoc?.displayName || 'Admin/Bendahari'}`,
          recordedBy: `${currentUserDoc?.displayName || 'Admin'} (Pentadbir/Bendahari)`
        });
      } catch (tgErr) {
        console.error("Ralat hantar notifikasi Telegram di YuranSection:", tgErr);
      }

      setAdminManualSuccess(true);
      setTimeout(() => {
        setShowAdminManualModal(false);
        resetManualForm();
      }, 2000);

    } catch (err: any) {
      console.error("Ralat mendaftar bayaran manual:", err);
      setAdminManualError(err.message || "Gagal mendaftar bayaran manual. Sila cuba lagi.");
    } finally {
      setUploadingManual(false);
    }
  };

  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [showKelebihanModal, setShowKelebihanModal] = React.useState(false);
  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = React.useState(false);
  const [showLainnyaModal, setShowLainnyaModal] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const effectiveConfig = propYuranConfig || yuranConfig || DEFAULT_YURAN_CONFIG;

  const [sessionYearMode, setSessionYearMode] = React.useState<'auto' | '2026' | '2027'>(() => {
    return (localStorage.getItem('tmf2_session_year_mode') as 'auto' | '2026' | '2027') || 'auto';
  });

  const currentRealDate = new Date();
  const dynamicAutoSession = detectActiveSessionYear(effectiveConfig, currentRealDate);
  const isAutoAfterJuly2027 = dynamicAutoSession === '2027';

  const activeSessionYear = sessionYearMode === 'auto'
    ? dynamicAutoSession
    : sessionYearMode;

  const activeSesi = (effectiveConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList).find(s => s.id === activeSessionYear) 
    || (effectiveConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList)[0];

  const activeSessionMonths = generate12Months(activeSesi.startMonth, activeSesi.startYear);
  const sessionDisplayLabel = activeSesi ? activeSesi.name.replace(/^Sesi\s+/i, '') : (activeSessionYear === '2026' ? '2026/2027' : '2027/2028');
  const monthsRangeLabel = `${activeSessionMonths[0].name} - ${activeSessionMonths[11].name}`;

  const getSessionMonthsList = (sId: string) => {
    const s = (effectiveConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList).find(item => item.id === sId) 
      || { id: sId, name: `Sesi ${sId}`, startMonth: 1, startYear: parseInt(sId) || 2026 };
    return generate12Months(s.startMonth, s.startYear).map(m => ({
      name: monthNamesMs[m.val - 1],
      year: m.year.toString(),
      index: m.val
    }));
  };

  const getSessionPenggalMonths = (sYear: string) => {
    const sesi = (effectiveConfig.sesiList || DEFAULT_YURAN_CONFIG.sesiList).find(s => s.id === sYear);
    const months = sesi ? generate12Months(sesi.startMonth, sesi.startYear) : generate12Months(1, parseInt(sYear) || 2026);
    return {
      p1: months.slice(0, 6).map(m => m.val),
      p2: months.slice(6, 12).map(m => m.val)
    };
  };

  const isMonthPaidInSession = (sessionYear: string, monthIndex: number) => {
    const tahunanPkg = packages.find(p => p.sessionYear === sessionYear && p.category === 'Tahunan');
    if (tahunanPkg?.isPaid) return true;

    const { p1: p1Months, p2: p2Months } = getSessionPenggalMonths(sessionYear);
    const isP1 = p1Months.includes(monthIndex);
    const isP2 = p2Months.includes(monthIndex);
    if (isP1) {
      const penggal1 = packages.find(p => p.sessionYear === sessionYear && p.category === 'Penggal' && p.penggalIndex === 1);
      if (penggal1?.isPaid) return true;
    }
    if (isP2) {
      const penggal2 = packages.find(p => p.sessionYear === sessionYear && p.category === 'Penggal' && p.penggalIndex === 2);
      if (penggal2?.isPaid) return true;
    }

    const monthlyPkg = packages.find(p => p.sessionYear === sessionYear && p.category === 'Bulanan' && p.monthIndex === monthIndex);
    return !!monthlyPkg?.isPaid;
  };

  const months2026List = getSessionMonthsList('2026');
  const months2027List = getSessionMonthsList('2027');

  const currentMonths = getSessionMonthsList(activeSessionYear);
  const activeMonthsPaid = currentMonths.filter(m => isMonthPaidInSession(activeSessionYear, m.index)).length;
  const activeProgressPercent = Math.round((activeMonthsPaid / 12) * 100);

  const paidMonthsCount2026 = months2026List.filter(m => isMonthPaidInSession('2026', m.index)).length;
  const progressPercent2026 = Math.round((paidMonthsCount2026 / 12) * 100);

  const paidMonthsCount2027 = months2027List.filter(m => isMonthPaidInSession('2027', m.index)).length;
  const progressPercent2027 = Math.round((paidMonthsCount2027 / 12) * 100);

  const hasUnpaidSesiLama = activeSessionYear === '2027' && packages.some(p => p.sessionYear === '2026' && p.category === 'Bulanan' && !p.isPaid);
  const unpaidSesiLamaBulanan = activeSessionYear === '2027'
    ? packages.filter(p => p.sessionYear === '2026' && p.category === 'Bulanan' && !p.isPaid)
    : [];

  const currentSessionPackages = packages.filter(p => 
    p.category === 'Keahlian' || p.sessionYear === activeSessionYear
  );

  const filteredTambahanPackages = currentSessionPackages.filter(p => p.category === 'Tambahan');

  const endMonthObj = activeSessionMonths[11];
  const lastDay = endMonthObj ? new Date(endMonthObj.year, endMonthObj.val, 0).getDate() : 30;
  const sahHinggaText = endMonthObj ? `Sah hingga ${lastDay} ${monthNamesMs[endMonthObj.val - 1]} ${endMonthObj.year}` : 'Sah hingga 30 September 2027';

  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('tmf2_kewangan_transactions');
      if (saved) {
        try {
          setTransactions(JSON.parse(saved));
        } catch (e) {
          // ignore
        }
      }
    };
    window.addEventListener('tmf2_transactions_updated', handleSync);
    return () => {
      window.removeEventListener('tmf2_transactions_updated', handleSync);
    };
  }, []);

  // Auto clear toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Baseline display values calculated from actual database records & user approved transactions
  const memberEmailClean = (currentUserDoc?.email || firebaseUser?.email || '').toLowerCase().trim();

  // 1. Direct paid package IDs for the current user
  const directPaidPackageIds = new Set<string>(currentUserDoc?.paidPackageIds || []);
  if (memberEmailClean) {
    transactions.forEach(t => {
      if (t.memberEmail && t.memberEmail.toLowerCase().trim() === memberEmailClean && t.approvalStatus === 'Approved') {
        if (t.paidPackageIds && Array.isArray(t.paidPackageIds)) {
          t.paidPackageIds.forEach(id => directPaidPackageIds.add(id));
        }
      }
    });
  }

  // Directly paid packages (excluding implied parent/child packages)
  const directlyPaidPackages = packages.filter(p => directPaidPackageIds.has(p.id));

  // Approved transactions belonging to the current user
  const userApprovedTxns = React.useMemo(() => {
    if (!memberEmailClean) return [];
    return transactions.filter(t => 
      t.approvalStatus === 'Approved' &&
      t.category !== 'Caj Perkhidmatan' &&
      !!t.memberEmail &&
      t.memberEmail.toLowerCase().trim() === memberEmailClean
    );
  }, [transactions, memberEmailClean]);

  // A. Total Pembayaran: Total amount paid across approved transactions or directly paid packages
  // ONLY include Yuran Keahlian, Yuran Tahunan, Yuran Bulanan, Yuran Perpenggal (and Khairat Kematian)
  const directlyPaidPkgTotal = directlyPaidPackages
    .filter(p => ['Keahlian', 'Bulanan', 'Penggal', 'Tahunan'].includes(p.category))
    .reduce((sum, p) => sum + p.price, 0);
    
  const userApprovedTxnTotal = userApprovedTxns
    .filter(t => {
      const cat = (t.category || '').toLowerCase();
      return cat.includes('keahlian') || cat.includes('bulanan') || cat.includes('penggal') || cat.includes('tahunan') || cat.includes('khairat');
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
    
  const totalPembayaranValue = userApprovedTxnTotal > 0 ? userApprovedTxnTotal : directlyPaidPkgTotal;

  // B. Total Yuran Bulanan: Total amount paid for monthly/penggal/tahunan packages
  const bulananPkgsTotal = directlyPaidPackages
    .filter(p => p.category === 'Bulanan' || p.category === 'Penggal' || p.category === 'Tahunan')
    .reduce((sum, p) => sum + p.price, 0);
    
  const bulananTxnsTotal = userApprovedTxns
    .filter(t => {
      const cat = (t.category || '').toLowerCase();
      return cat.includes('bulanan') || cat.includes('penggal') || cat.includes('tahunan');
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
    
  const totalYuranBulananValue = userApprovedTxns.length > 0 ? bulananTxnsTotal : bulananPkgsTotal;

  // C. Total Khairat Kematian: Total contributed to Khairat Kematian
  const khairatTxnsTotal = userApprovedTxns
    .filter(t => t.category === 'Khairat Kematian' || t.accountCredit === 'Khairat Kematian' || (t.description || '').toLowerCase().includes('khairat'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);
    
  const khairatPkgsTotal = directlyPaidPackages.reduce((sum, p) => {
    if (p.category === 'Bulanan') return sum + (yuranConfig?.yuranBulanan?.khairat ?? 5);
    if (p.category === 'Penggal') return sum + (yuranConfig?.yuranPenggal?.khairat ?? 30);
    if (p.category === 'Tahunan') return sum + (yuranConfig?.yuranTahunan?.khairat ?? 60);
    return sum;
  }, 0);
  
  const totalKhairatKematianValue = userApprovedTxns.length > 0 ? khairatTxnsTotal : khairatPkgsTotal;

  const isRejectedOrRevoked = currentUserDoc?.membershipStatus === 'Ditolak' || 
                              currentUserDoc?.membershipStatus === 'Tidak Aktif' || 
                              currentUserDoc?.approvalStatus === 'Rejected' || 
                              currentUserDoc?.approvalStatus === 'Dilucutkan';

  // Selected packages inside cart
  const selectedPackages = packages.filter(p => cartPackageIds.includes(p.id));
  const subTotal = selectedPackages.reduce((sum, p) => sum + getPackagePrice(p), 0);
  const fpxFee = selectedPackages.length > 0 ? (yuranConfig?.fpxCharge ?? 1.00) : 0.00;
  const hasQurbanInCart = selectedPackages.some(p => p.realCategory === 'Qurban & Aqiqah' || p.id.startsWith('qurban-cart-'));
  const hasOtherTambahanInCart = selectedPackages.some(p => p.category === 'Tambahan' && p.realCategory !== 'Qurban & Aqiqah' && !p.id.startsWith('qurban-cart-'));
  const isFpxSurcharge = hasQurbanInCart && !hasOtherTambahanInCart
    ? false
    : (hasOtherTambahanInCart ? true : (yuranConfig?.fpxSurchargeMode ?? true));
  const cartTotal = selectedPackages.length > 0
    ? (isFpxSurcharge ? subTotal + fpxFee : subTotal)
    : 0.00;

  const allYuranTransactions = transactions
    .filter(t => {
      if (t.category === 'Caj Perkhidmatan') return false;
      const cat = (t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      // Asingkan / jangan paparkan sebarang rekod sumbangan atau tabung di Sejarah Transaksi Yuran
      if (cat.includes('sumbangan') || cat.startsWith('tabung ') || cat.includes('van jenazah') || desc.includes('sumbangan')) {
        return false;
      }
      return !!t.memberEmail && t.memberEmail.toLowerCase().trim() === memberEmailClean;
    })
    .sort((a, b) => {
      // First sort by date, then by time, then by id descending (latest first)
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = (b.time || '').localeCompare(a.time || '');
      if (timeCompare !== 0) return timeCompare;
      return (b.id || '').localeCompare(a.id || '');
    });

  const currentSessionTransactions = allYuranTransactions.filter(t => {
    return t.sessionYear === activeSessionYear ||
           t.date.includes(activeSessionYear) || 
           t.description.includes(activeSessionYear) || 
           t.voucherNo.includes(activeSessionYear);
  });

  // Calculate totals paid and currently selected in cart for Keahlian vs Bulanan/Penggal/Tahunan (representing membership vs monthly fees)
  const keahlianTotalPaid = directlyPaidPackages
    .filter(p => p.category === 'Keahlian')
    .reduce((sum, p) => sum + p.price, 0);

  const keahlianTotalInCart = selectedPackages
    .filter(p => p.category === 'Keahlian')
    .reduce((sum, p) => sum + p.price, 0);

  const keahlianDisplayTotal = keahlianTotalPaid + keahlianTotalInCart;

  const bulananTotalPaid = directlyPaidPackages
    .filter(p => p.category === 'Bulanan' || p.category === 'Penggal' || p.category === 'Tahunan')
    .reduce((sum, p) => sum + p.price, 0);

  const bulananTotalInCart = selectedPackages
    .filter(p => p.category === 'Bulanan' || p.category === 'Penggal' || p.category === 'Tahunan')
    .reduce((sum, p) => sum + p.price, 0);

  const bulananDisplayTotal = bulananTotalPaid + bulananTotalInCart;

  const handleTogglePackage = (pkgId: string) => {
    const isAdding = !cartPackageIds.includes(pkgId);
    if (isAdding) {
      const pkg = packages.find(p => p.id === pkgId);
      if (pkg) {
        if (pkg.category === 'Keahlian') {
          if (keahlianDisplayTotal + pkg.price > 50) {
            setToastMessage("Had limit pembayaran yuran keahlian ialah RM50! Lebih daripada itu, sila ke Peti Sumbangan.");
            return;
          }
        } else if (pkg.category === 'Bulanan' || pkg.category === 'Penggal' || pkg.category === 'Tahunan') {
          if (bulananDisplayTotal + pkg.price > 120) {
            setToastMessage("Had limit pembayaran Yuran Bulanan ialah RM120! Lebih daripada itu, sila ke Peti Sumbangan.");
            return;
          }
        }
      }
    }

    setCartPackageIds(prev => 
      prev.includes(pkgId) 
        ? prev.filter(id => id !== pkgId) 
        : [...prev, pkgId]
    );
  };

  const updatePackageAgeQuantity = (pkgId: string, ageGroup: 'dewasa' | 'wargaEmas' | 'kanakKanak', count: number) => {
    setPackages(prev => prev.map(p => {
      if (p.id === pkgId) {
        const selectedAgeQuantities = p.selectedAgeQuantities || { dewasa: 0, wargaEmas: 0, kanakKanak: 0 };
        const updatedQuantities = {
          ...selectedAgeQuantities,
          [ageGroup]: count
        };
        return {
          ...p,
          selectedAgeQuantities: updatedQuantities
        };
      }
      return p;
    }));
  };

  const handleStartPayment = () => {
    if (cartPackageIds.length === 0) return;
    onOpenCart?.();
  };

  const activePackages = packages.filter(p => p.isPaid || cartPackageIds.includes(p.id) || pendingPackageIds.includes(p.id));
  
  const isPackageDisabled = (pkg: ImageFeePackage) => {
    if (isRejectedOrRevoked) return true;
    if (pkg.isPaid) return true;
    if (pendingPackageIds.includes(pkg.id)) return true;
    
    if (!pkg.sessionYear) return false;

    const sessionActivePkgs = activePackages.filter(p => p.sessionYear === pkg.sessionYear);
    const hasTahunanActive = sessionActivePkgs.some(p => p.category === 'Tahunan');
    const activePenggals = sessionActivePkgs.filter(p => p.category === 'Penggal').map(p => p.penggalIndex);
    const activeMonths = sessionActivePkgs.filter(p => p.category === 'Bulanan').map(p => p.monthIndex);

    if (pkg.category === 'Tahunan') {
      return activeMonths.length > 0 || activePenggals.length > 0;
    }
    
    if (pkg.category === 'Penggal') {
      if (hasTahunanActive) return true;
      const { p1: p1Months, p2: p2Months } = getSessionPenggalMonths(pkg.sessionYear);
      const penggalMonths = pkg.penggalIndex === 1 ? p1Months : p2Months;
      return activeMonths.some(m => m && penggalMonths.includes(m));
    }
    
    if (pkg.category === 'Bulanan') {
      if (hasTahunanActive) return true;
      const { p1: p1Months, p2: p2Months } = getSessionPenggalMonths(pkg.sessionYear);
      const isPenggal1 = pkg.monthIndex && p1Months.includes(pkg.monthIndex);
      if (isPenggal1 && activePenggals.includes(1)) return true;
      const isPenggal2 = pkg.monthIndex && p2Months.includes(pkg.monthIndex);
      if (isPenggal2 && activePenggals.includes(2)) return true;
    }
    
    return false;
  };

  const isManualPackageDisabled = (pkg: ImageFeePackage) => {
    const isPaid = memberPaidPackageIds.includes(pkg.id);
    if (isPaid) return true;
    
    if (!pkg.sessionYear) return false;

    // Active packages for this manual flow = packages that are already paid by the member OR currently selected in the manual form
    const manualActivePackages = packages.filter(p => 
      memberPaidPackageIds.includes(p.id) || selectedManualPackageIds.includes(p.id)
    );

    const sessionActivePkgs = manualActivePackages.filter(p => p.sessionYear === pkg.sessionYear);
    const hasTahunanActive = sessionActivePkgs.some(p => p.category === 'Tahunan');
    const activePenggals = sessionActivePkgs.filter(p => p.category === 'Penggal').map(p => p.penggalIndex);
    const activeMonths = sessionActivePkgs.filter(p => p.category === 'Bulanan').map(p => p.monthIndex);

    if (pkg.category === 'Tahunan') {
      return activeMonths.length > 0 || activePenggals.length > 0;
    }
    
    if (pkg.category === 'Penggal') {
      if (hasTahunanActive) return true;
      const { p1: p1Months, p2: p2Months } = getSessionPenggalMonths(pkg.sessionYear);
      const penggalMonths = pkg.penggalIndex === 1 ? p1Months : p2Months;
      return activeMonths.some(m => m && penggalMonths.includes(m));
    }
    
    if (pkg.category === 'Bulanan') {
      if (hasTahunanActive) return true;
      const { p1: p1Months, p2: p2Months } = getSessionPenggalMonths(pkg.sessionYear);
      const isPenggal1 = pkg.monthIndex && p1Months.includes(pkg.monthIndex);
      if (isPenggal1 && activePenggals.includes(1)) return true;
      const isPenggal2 = pkg.monthIndex && p2Months.includes(pkg.monthIndex);
      if (isPenggal2 && activePenggals.includes(2)) return true;
    }
    
    return false;
  };

  const handleQuickAddAll = () => {
    // Only add Tahunan and Keahlian of the active session to prevent duplicate session charging
    const targetPkgs = packages
      .filter(p => p.category === 'Keahlian' || p.sessionYear === activeSessionYear)
      .filter(p => !p.isPaid && (p.category === 'Tahunan' || p.category === 'Keahlian'));
      
    if (targetPkgs.length === 0) {
      setToastMessage("Tiada pakej tahunan/keahlian untuk ditambah!");
      return;
    }

    let candidateIds = [...cartPackageIds];
    let keahlianExceeded = false;
    let bulananExceeded = false;

    for (const pkg of targetPkgs) {
      if (!candidateIds.includes(pkg.id)) {
        if (pkg.category === 'Keahlian') {
          const currentKeahlianTotalInCandidate = packages
            .filter(p => candidateIds.includes(p.id) && p.category === 'Keahlian')
            .reduce((sum, p) => sum + p.price, 0);
          if (keahlianTotalPaid + currentKeahlianTotalInCandidate + pkg.price > 50) {
            keahlianExceeded = true;
          } else {
            candidateIds.push(pkg.id);
          }
        } else {
          const currentBulananTotalInCandidate = packages
            .filter(p => candidateIds.includes(p.id) && (p.category === 'Bulanan' || p.category === 'Penggal' || p.category === 'Tahunan'))
            .reduce((sum, p) => sum + p.price, 0);
          if (bulananTotalPaid + currentBulananTotalInCandidate + pkg.price > 120) {
            bulananExceeded = true;
          } else {
            candidateIds.push(pkg.id);
          }
        }
      }
    }

    if (candidateIds.length === cartPackageIds.length) {
      if (keahlianExceeded || bulananExceeded) {
        setToastMessage("Tidak dapat ditambah kerana melebihi had limit! Sila ke Peti Sumbangan.");
      } else {
        setToastMessage("Pakej sudah berada di troli!");
      }
      return;
    }

    setCartPackageIds(candidateIds);
    if (keahlianExceeded || bulananExceeded) {
      setToastMessage("Pakej ditambah, tetapi sebahagian dihalang kerana melebihi had limit!");
    } else {
      setToastMessage("Pakej dimasukkan ke troli!");
    }
  };

  // Reset to default baseline state (helpful for testing)
  const handleResetFees = () => {
    localStorage.removeItem('tmf2_yuran_packages');
    const basePkgs = generatePackagesFromConfig(effectiveConfig, currentUserDoc?.uid);
    setPackages(basePkgs);
    setCartPackageIds([]);
    setToastMessage("Pakej yuran berjaya diselaraskan!");
  };



  return (
    <div className="w-full space-y-6 px-1 lg:px-4 py-2 pb-24 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. GREETING HEADER */}
      <div className="flex justify-between items-center bg-white/40 p-1.5 rounded-2xl">
        <div>
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest block">Selamat Datang 👋</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">Yuran & Sumbangan PIBG</h1>
          <p className="text-xs text-slate-500 font-bold mt-0.5 uppercase tracking-wide">Sekolah Menengah Agama Ulu Jempol</p>
        </div>
      </div>

      {isRejectedOrRevoked && (
        <div className="bg-rose-50 border border-rose-200 rounded-[24px] p-5.5 text-slate-800 space-y-3.5 animate-fadeIn shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle size={20} className="stroke-[2.5]" />
            </div>
            <div className="space-y-0.5">
              <h2 className="font-extrabold text-xs text-rose-950 uppercase tracking-widest">
                Akses Pembayaran Sekat (Keahlian Ditolak / Dilucutkan)
              </h2>
              <p className="text-[10px] text-rose-500 font-extrabold uppercase tracking-wider">
                Status Keahlian semasa anda: <span className="underline font-black">{currentUserDoc?.membershipStatus || currentUserDoc?.approvalStatus}</span>
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
            Sejajar dengan dasar keselamatan persatuan, akaun penduduk yang berstatus <strong>Ditolak</strong> atau <strong>Dilucutkan</strong> keahlian adalah <strong>disekat (disabled)</strong> daripada membuat sebarang bayaran yuran baru. Semua progress tracker, status yuran, dan keupayaan pembayaran dibekukan sepenuhnya di Menu Bayar Yuran ini.
          </p>
        </div>
      )}

      {/* THREE COLUMN GRID ON DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMN 1: Pakej Yuran & Actions (col-span-5) */}
        <div className="lg:col-span-5 space-y-5 order-2 lg:order-1">
          {/* 3. LIST OF FEES SECTION */}
          <div className="space-y-4">
            {/* --- DYNAMIC ROUNDED ACTION BUTTONS BAR --- */}
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-2xs p-4 hidden lg:flex justify-between items-center gap-1 select-none">
              {/* INFO */}
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
              >
                <div className="w-13 h-13 rounded-full flex items-center justify-center transition-all duration-300 bg-cyan-500 hover:bg-cyan-600 hover:scale-105 hover:shadow-md hover:shadow-cyan-100 text-white shadow-xs">
                  <Info size={18} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-cyan-600 transition-colors">
                  Info
                </span>
              </button>

              {/* KELEBIHAN */}
              <button
                type="button"
                onClick={() => setShowKelebihanModal(true)}
                className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
              >
                <div className="w-13 h-13 rounded-full bg-violet-500 hover:bg-violet-600 hover:scale-105 hover:shadow-md hover:shadow-indigo-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                  <Award size={18} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-violet-600 transition-colors text-center">
                  Kelebihan
                </span>
              </button>

              {/* NILAI LIMIT */}
              <button
                type="button"
                onClick={() => setShowLimitModal(true)}
                className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
              >
                <div className="w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 hover:scale-105 hover:shadow-md hover:shadow-emerald-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                  <TrendingUp size={18} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-emerald-600 transition-colors">
                  Nilai Limit
                </span>
              </button>

              {/* TRANSAKSI */}
              <button
                type="button"
                onClick={() => setShowTransactionsModal(true)}
                className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
              >
                <div className="w-13 h-13 rounded-full bg-blue-500 hover:bg-blue-600 hover:scale-105 hover:shadow-md hover:shadow-blue-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                  <FileText size={16} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-blue-600 transition-colors">
                  Transaksi
                </span>
              </button>

              {/* ADMIN */}
              {isUserAdminOrTreasurer && (
                <button
                  type="button"
                  onClick={() => setShowAdminManualModal(true)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
                >
                  <div className="w-13 h-13 rounded-full bg-slate-800 hover:bg-slate-900 hover:scale-105 hover:shadow-md hover:shadow-slate-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheck size={18} className="stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-slate-800 transition-colors">
                    Admin
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {currentSessionPackages.length > 0 ? (
                <>
                  {/* 1. YURAN KEAHLIAN (SEKALI BAYAR) - KHAS PENDAFTARAN SEUMUR HIDUP */}
                  {currentSessionPackages.filter(p => p.category === 'Keahlian').map((pkg) => {
                    const isSelected = cartPackageIds.includes(pkg.id);
                    const isPending = pendingPackageIds.includes(pkg.id);
                    const isDisabled = isPackageDisabled(pkg);

                    return (
                      <div key={pkg.id} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-100" />
                            <h3 className="font-extrabold text-xs text-indigo-950 uppercase tracking-widest">
                              Yuran Pendaftaran Warga
                            </h3>
                          </div>
                          <span className="bg-indigo-100/90 text-indigo-800 border border-indigo-200 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                            Sekali Seumur Hidup
                          </span>
                        </div>

                        <div 
                          className="bg-gradient-to-br from-indigo-50/95 via-purple-50/50 to-white rounded-[22px] border-2 border-indigo-200/90 hover:border-indigo-300 shadow-xs p-4.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all animate-fadeIn"
                        >
                          {/* Left side: Icon & Title metadata */}
                          <div className="flex items-start gap-3.5 flex-1">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-md shadow-indigo-200">
                              <User size={20} className="stroke-[2.5]" />
                            </div>

                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-black text-indigo-950 text-[13.5px] leading-tight">
                                  {pkg.name}
                                </h4>
                                <span className="bg-indigo-100/80 text-indigo-700 text-[8.5px] font-black px-2 py-0.5 rounded-md border border-indigo-200 uppercase tracking-wide">
                                  Sekali Sahaja
                                </span>
                              </div>
                              <p className="text-indigo-900/70 text-[10.5px] font-bold leading-normal">
                                {pkg.subtitle}
                              </p>
                              {pkg.extraSubtitle && (
                                <p className="text-indigo-600/70 text-[10px] font-semibold leading-normal">
                                  {pkg.extraSubtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right side: Price Tag & Button actions */}
                          <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-0 border-indigo-100/70">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-indigo-700 text-sm tracking-tight">
                                {pkg.priceLabel}
                              </span>
                            </div>

                            {!pkg.isPaid && (
                              <div className="md:order-last block mt-1 text-left">
                                {isPending ? (
                                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                    Status: Belum Disahkan
                                  </span>
                                ) : (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                    Status: Belum Dibayar
                                  </span>
                                )}
                              </div>
                            )}

                            {pkg.isPaid ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-2xs cursor-not-allowed"
                              >
                                <Check size={11} className="stroke-[3]" />
                                <span>Selesai Dibayar</span>
                              </button>
                            ) : isPending ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-2xs cursor-not-allowed opacity-90"
                                title="Bayaran telah dibuat dan sedang menunggu pengesahan"
                              >
                                <Clock size={11} className="stroke-[2.5]" />
                                <span>Belum Disahkan</span>
                              </button>
                            ) : isDisabled ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-1.5 bg-slate-50 text-slate-400 border border-slate-200 font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-2xs cursor-not-allowed opacity-70"
                              >
                                <span>Tidak Tersedia</span>
                              </button>
                            ) : isSelected ? (
                              <button
                                type="button"
                                onClick={() => handleTogglePackage(pkg.id)}
                                className="px-4 py-1.5 bg-indigo-100 text-indigo-800 border-2 border-indigo-300 font-extrabold text-[10px] rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Check size={11} className="stroke-[3]" />
                                <span>Ditambah</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePackage(pkg.id)}
                                className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                              >
                                <span>+ Tambah</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* 2. PILIHAN YURAN PER SESI (3 PILIHAN: TAHUNAN / BULANAN / PENGGAL) */}
                  <div className="space-y-3.5 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200/80 pt-4 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                        <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest">
                          Pilihan Yuran Sesi {sessionDisplayLabel}
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-full w-fit">
                        Pilih salah satu: Tahunan, Bulanan, atau Penggal
                      </span>
                    </div>

                    {/* PILIHAN 1: YURAN TAHUNAN */}
                    {currentSessionPackages.filter(p => p.category === 'Tahunan').map((pkg) => {
                      const isSelected = cartPackageIds.includes(pkg.id);
                      const isPending = pendingPackageIds.includes(pkg.id);
                      const isDisabled = isPackageDisabled(pkg);

                      return (
                        <div 
                          key={pkg.id} 
                          className="bg-white rounded-[20px] border border-amber-200/80 shadow-sm p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-amber-300 transition-all animate-fadeIn"
                        >
                          {/* Left side: Icon & Title metadata */}
                          <div className="flex items-start gap-3.5 flex-1">
                            <div className="p-3 rounded-2xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 border border-amber-100">
                              <Calendar size={18} className="stroke-[2.5]" />
                            </div>

                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-slate-900 text-[13px] leading-tight">
                                  {pkg.name}
                                </h4>
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                  Pilihan 1 • Tahunan
                                </span>
                              </div>
                              <p className="text-slate-400 text-[10px] font-bold leading-normal">
                                {pkg.subtitle}
                              </p>
                              {pkg.extraSubtitle && (
                                <p className="text-slate-400 text-[10px] font-bold leading-normal">
                                  {pkg.extraSubtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right side: Price Tag & Button actions */}
                          <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-0 border-slate-50">
                            <div className="flex items-center gap-2">
                              {pkg.savingBadge && (
                                <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0">
                                  {pkg.savingBadge}
                                </span>
                              )}
                              <span className="font-extrabold text-slate-800 text-[13px] tracking-tight">
                                {pkg.priceLabel}
                              </span>
                            </div>

                            {pkg.isPaid ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-2xs cursor-not-allowed"
                              >
                                <Check size={11} className="stroke-[3]" />
                                <span>Selesai Dibayar</span>
                              </button>
                            ) : isPending ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-2xs cursor-not-allowed opacity-90"
                                title="Bayaran telah dibuat dan sedang menunggu pengesahan"
                              >
                                <Clock size={11} className="stroke-[2.5]" />
                                <span>Belum Disahkan</span>
                              </button>
                            ) : isDisabled ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-1.5 bg-slate-50 text-slate-400 border border-slate-200 font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-2xs cursor-not-allowed opacity-70"
                              >
                                <span>Tidak Tersedia</span>
                              </button>
                            ) : isSelected ? (
                              <button
                                type="button"
                                onClick={() => handleTogglePackage(pkg.id)}
                                className="px-4 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 font-extrabold text-[10px] rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Check size={11} className="stroke-[3]" />
                                <span>Ditambah</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePackage(pkg.id)}
                                className="px-4 py-1.5 bg-[#3f3ebd] hover:bg-[#3433a3] text-white font-extrabold text-[10px] rounded-xl flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                              >
                                <span>+ Tambah</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* 3.5 UNPAID MONTHS FROM PAST SESSION (TUNGGAKAN BULANAN SESI LEPAS) */}
                    {activeSessionYear === '2027' && unpaidSesiLamaBulanan.length > 0 && (
                      <div className="bg-rose-50/50 rounded-[20px] border border-rose-200 shadow-2xs p-4.5 flex flex-col gap-4 hover:border-rose-300 transition-all animate-fadeIn">
                        <div className="flex items-start gap-3.5 flex-1">
                          <div className="p-3 rounded-2xl flex items-center justify-center shrink-0 bg-rose-100 text-rose-600">
                            <AlertCircle size={18} className="stroke-[2.5]" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <h4 className="font-extrabold text-rose-900 text-[13px] leading-tight">Yuran Bulanan Sesi Lepas Belum Dibayar (Sesi 2026/2027)</h4>
                            <p className="text-rose-500 text-[10px] font-bold leading-normal">
                              Anda mempunyai yuran bulanan tertunggak dari sesi lepas. Sesi lepas hanya boleh dibayar secara bulanan.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-3 border-t border-rose-100">
                          {unpaidSesiLamaBulanan.map(pkg => {
                            const isSelected = cartPackageIds.includes(pkg.id);
                            const isPending = pendingPackageIds.includes(pkg.id);
                            const isDisabled = isPackageDisabled(pkg);
                            return (
                              <button
                                key={pkg.id}
                                disabled={isDisabled || isPending}
                                onClick={() => handleTogglePackage(pkg.id)}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-bold text-left transition-colors ${
                                  pkg.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed opacity-80' :
                                  isPending ? 'bg-amber-50 border-amber-300 text-amber-800 cursor-not-allowed opacity-90' :
                                  isDisabled ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60' :
                                  isSelected ? 'bg-rose-100 border-rose-300 text-rose-800 shadow-inner cursor-pointer' :
                                  'bg-white border-slate-200 text-slate-600 hover:border-rose-500 hover:text-rose-600 cursor-pointer'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  pkg.isPaid ? 'bg-emerald-500 border-emerald-500' :
                                  isPending ? 'bg-amber-100 border-amber-300' :
                                  isDisabled ? 'bg-slate-200 border-slate-300' :
                                  isSelected ? 'bg-rose-600 border-rose-600' :
                                  'bg-white border-slate-300'
                                }`}>
                                  {pkg.isPaid && <Check size={12} className="text-white stroke-[3]" />}
                                  {isPending && <Clock size={10} className="text-amber-700 stroke-[2.5]" />}
                                  {!pkg.isPaid && !isPending && isSelected && !isDisabled && <Check size={12} className="text-white stroke-[3]" />}
                                </div>
                                <span className="flex-1 truncate">{pkg.monthName || pkg.name}</span>
                                {isPending && <span className="text-[8px] font-extrabold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">Belum Disahkan</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* PILIHAN 2: YURAN BULANAN */}
                    {currentSessionPackages.filter(p => p.category === 'Bulanan').length > 0 && (
                      <div className="bg-white rounded-[20px] border border-blue-200/80 shadow-sm p-4.5 flex flex-col gap-4 hover:border-blue-300 transition-all animate-fadeIn">
                        <div className="flex items-start gap-3.5 flex-1">
                          <div className="p-3 rounded-2xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 border border-blue-100">
                            <Calendar size={18} className="stroke-[2.5]" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-slate-900 text-[13px] leading-tight">Yuran Bulanan Sesi {sessionDisplayLabel}</h4>
                              <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                Pilihan 2 • Bulanan
                              </span>
                            </div>
                            <p className="text-slate-400 text-[10px] font-bold leading-normal">Pilih bulan ({monthsRangeLabel})</p>
                            <div className="bg-[#fcfbfe] border border-[#ebe7fe] rounded-2xl p-3 flex justify-between items-center mt-3 text-[10px] gap-2">
                              <div className="flex-1 flex items-center gap-2.5">
                                <div className="bg-rose-50 p-1.5 rounded-xl text-rose-500">
                                  <Heart size={13} fill="currentColor" className="stroke-none" />
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-800 block text-[10px]">RM5.00</span>
                                  <span className="text-slate-400 text-[9px] font-bold block">Khairat Kematian</span>
                                </div>
                              </div>
                              <div className="h-6 border-r border-[#ebe7fe]" />
                              <div className="flex-1 flex items-center gap-2.5 pl-2">
                                <div className="bg-indigo-50 p-1.5 rounded-xl text-indigo-500">
                                  <Users size={13} className="stroke-[2.5]" />
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-800 block text-[10px]">RM5.00</span>
                                  <span className="text-slate-400 text-[9px] font-bold block">Yuran Persatuan</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-3 border-t border-slate-50">
                          {currentSessionPackages.filter(p => p.category === 'Bulanan').map(pkg => {
                            const isSelected = cartPackageIds.includes(pkg.id);
                            const isPending = pendingPackageIds.includes(pkg.id);
                            const isDisabled = isPackageDisabled(pkg);
                            return (
                              <button
                                key={pkg.id}
                                disabled={isDisabled || isPending}
                                onClick={() => handleTogglePackage(pkg.id)}
                                title={
                                  pkg.isPaid ? 'Yuran bulan ini telah selesai dibayar' :
                                  isPending ? 'Bayaran bulan ini sedang menunggu pengesahan' :
                                  isDisabled ? 'Bulan ini tidak tersedia (telah diliputi bayaran penggal/tahunan)' :
                                  'Klik untuk pilih bayaran bulanan'
                                }
                                className={`flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-bold text-left transition-colors ${
                                  pkg.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed opacity-80' :
                                  isPending ? 'bg-amber-50 border-amber-300 text-amber-800 cursor-not-allowed opacity-90' :
                                  isDisabled ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60' :
                                  isSelected ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-inner cursor-pointer' :
                                  'bg-white border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 cursor-pointer'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  pkg.isPaid ? 'bg-emerald-500 border-emerald-500' :
                                  isPending ? 'bg-amber-100 border-amber-300' :
                                  isDisabled ? 'bg-slate-200 border-slate-300' :
                                  isSelected ? 'bg-blue-600 border-blue-600' :
                                  'bg-white border-slate-300'
                                }`}>
                                  {pkg.isPaid && <Check size={12} className="text-white stroke-[3]" />}
                                  {isPending && <Clock size={10} className="text-amber-700 stroke-[2.5]" />}
                                  {!pkg.isPaid && !isPending && isSelected && !isDisabled && <Check size={12} className="text-white stroke-[3]" />}
                                </div>
                                <span className="flex-1 truncate">{pkg.monthName || pkg.name}</span>
                                {pkg.isPaid && <span className="text-[8px] font-extrabold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded shrink-0">Selesai Dibayar</span>}
                                {isPending && <span className="text-[8px] font-extrabold text-amber-700 bg-amber-100 px-1 py-0.5 rounded shrink-0">Belum Disahkan</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* PILIHAN 3: YURAN PER PENGGAL */}
                    {currentSessionPackages.filter(p => p.category === 'Penggal').length > 0 && (
                      <div className="bg-white rounded-[20px] border border-emerald-200/80 shadow-sm p-4.5 flex flex-col gap-4 hover:border-emerald-300 transition-all animate-fadeIn">
                        <div className="flex items-start gap-3.5 flex-1">
                          <div className="p-3 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <Calendar size={18} className="stroke-[2.5]" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-slate-900 text-[13px] leading-tight">Yuran Per Penggal Sesi {sessionDisplayLabel}</h4>
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                Pilihan 3 • Per Penggal
                              </span>
                            </div>
                            <p className="text-slate-400 text-[10px] font-bold leading-normal">Bayaran setiap 6 bulan</p>
                            <span className="inline-block bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider mt-1">
                              Jimat RM5
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                          {currentSessionPackages.filter(p => p.category === 'Penggal').map(pkg => {
                            const isSelected = cartPackageIds.includes(pkg.id);
                            const isPending = pendingPackageIds.includes(pkg.id);
                            const isDisabled = isPackageDisabled(pkg);
                            return (
                              <button
                                key={pkg.id}
                                disabled={isDisabled || isPending}
                                onClick={() => handleTogglePackage(pkg.id)}
                                title={
                                  pkg.isPaid ? 'Yuran penggal ini telah selesai dibayar' :
                                  isPending ? 'Bayaran penggal ini sedang menunggu pengesahan' :
                                  isDisabled ? 'Penggal ini tidak tersedia (sebahagian bulan telah dibayar/dipilih)' :
                                  'Klik untuk pilih bayaran per penggal'
                                }
                                className={`flex items-center gap-3 p-3.5 rounded-xl border text-[11px] font-bold text-left transition-colors ${
                                  pkg.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed opacity-80' :
                                  isPending ? 'bg-amber-50 border-amber-300 text-amber-800 cursor-not-allowed opacity-90' :
                                  isDisabled ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60' :
                                  isSelected ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-inner cursor-pointer' :
                                  'bg-white border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-700 cursor-pointer'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                  pkg.isPaid ? 'bg-emerald-500 border-emerald-500' :
                                  isPending ? 'bg-amber-100 border-amber-300' :
                                  isDisabled ? 'bg-slate-200 border-slate-300' :
                                  isSelected ? 'bg-emerald-600 border-emerald-600' :
                                  'bg-white border-slate-300'
                                }`}>
                                  {pkg.isPaid && <Check size={14} className="text-white stroke-[3]" />}
                                  {isPending && <Clock size={12} className="text-amber-700 stroke-[2.5]" />}
                                  {!pkg.isPaid && !isPending && isSelected && !isDisabled && <Check size={14} className="text-white stroke-[3]" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="block text-slate-800 text-xs font-bold">{pkg.name}</span>
                                    {pkg.isPaid && <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">Selesai Dibayar</span>}
                                    {isPending && <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">Belum Disahkan</span>}
                                  </div>
                                  <span className="block text-[10px] text-slate-400 mt-1 font-semibold">{pkg.priceLabel}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* YURAN TAMBAHAN SECTION */}
                  {filteredTambahanPackages.length > 0 && (
                    <div className="space-y-4 bg-amber-50/60 p-6 rounded-[24px] border border-amber-200 mt-6 animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                          <Coins size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-[#3f3ebd] text-sm uppercase tracking-wider">
                            Yuran Tambahan Khusus
                          </h4>
                          <p className="text-slate-500 text-[10px] font-bold">
                            Yuran khusus yang dikonfigurasikan oleh pentadbir bagi sesi ini
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        {filteredTambahanPackages.map((pkg) => {
                          const isSelected = cartPackageIds.includes(pkg.id);
                          const isPending = pendingPackageIds.includes(pkg.id);
                          const isDisabled = pkg.isPaid || isPending;
                          
                          return (
                            <div 
                              key={pkg.id} 
                              className={`rounded-[20px] border p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-xs bg-white ${
                                isSelected ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'
                              }`}
                            >
                              <div className="flex items-start gap-3.5 flex-1">
                                <div className="p-3 rounded-2xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
                                  <Coins size={18} className="stroke-[2.5]" />
                                </div>

                                <div className="space-y-1 flex-1">
                                  <h4 className="font-extrabold text-slate-900 text-[13px] leading-tight font-sans">
                                    {pkg.name}
                                  </h4>
                                  <p className="text-slate-400 text-[10px] font-bold leading-normal font-sans">
                                    {pkg.subtitle}
                                  </p>

                                  {pkg.isCustomAmount && (() => {
                                    const email = currentUserDoc?.email || '';
                                    const totalPaid = transactions
                                      .filter(t => t.memberEmail === email && t.approvalStatus === 'Approved' && t.category !== 'Caj Perkhidmatan' && t.paidPackageIds?.includes(pkg.id))
                                      .reduce((sum, t) => sum + (t.amount || 0), 0);
                                    const remaining = Math.max(0, pkg.price - totalPaid);
                                    return (
                                      <div className="text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600 font-semibold space-y-1 mt-1.5 w-full max-w-sm">
                                        <p className="text-[9px] text-[#3f3ebd] uppercase font-black tracking-wide">Status Bayaran Ikut Suka:</p>
                                        <div className="flex justify-between">
                                          <span>Jumlah Diperlukan:</span>
                                          <span className="font-extrabold text-slate-800">RM {pkg.price.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-emerald-600">
                                          <span>Telah Dibayar:</span>
                                          <span className="font-extrabold">RM {totalPaid.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-rose-600 border-t border-dashed border-slate-200 pt-1 mt-1 font-bold">
                                          <span>Baki Diperlukan:</span>
                                          <span className="font-extrabold">RM {remaining.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  {pkg.hasAgePricing && (
                                    <div className="text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600 font-semibold space-y-1 mt-1.5 w-full max-w-sm font-mono">
                                      <p className="text-[9px] text-slate-400 uppercase font-black">Kadar Bayaran:</p>
                                      {pkg.agePricing?.dewasa?.enabled && (
                                        <div className="flex justify-between">
                                          <span>Dewasa:</span>
                                          <span>RM {pkg.agePricing.dewasa.price.toFixed(2)}</span>
                                        </div>
                                      )}
                                      {pkg.agePricing?.wargaEmas?.enabled && (
                                        <div className="flex justify-between">
                                          <span>Warga Emas:</span>
                                          <span>RM {pkg.agePricing.wargaEmas.price.toFixed(2)}</span>
                                        </div>
                                      )}
                                      {pkg.agePricing?.kanakKanak?.enabled && (
                                        <div className="flex justify-between">
                                          <span>Kanak-Kanak / Bayi:</span>
                                          <span>RM {pkg.agePricing.kanakKanak.price.toFixed(2)}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right side: pricing & button */}
                              <div className="flex flex-col items-end gap-3.5 shrink-0 md:pl-4">
                                <div className="text-right">
                                  {pkg.hasAgePricing ? (
                                    (() => {
                                      const price = getPackagePrice(pkg);
                                      return (
                                        <div className="space-y-0.5 font-sans">
                                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider block mb-1">
                                            Harga Kuantiti Pilihan
                                          </span>
                                          <span className="text-sm font-black text-slate-900">
                                            RM {price.toFixed(2)}
                                          </span>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <span className="text-sm font-black text-slate-900 font-sans">
                                      {pkg.priceLabel}
                                    </span>
                                  )}
                                </div>

                                {pkg.isPaid ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100 font-sans">
                                    <Check size={14} className="stroke-[3]" /> Telah Dibayar
                                  </span>
                                ) : isPending ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-300 font-sans">
                                    <Clock size={14} className="stroke-[2.5]" /> Belum Disahkan
                                  </span>
                                ) : (
                                  <div className="flex flex-col gap-2.5 w-full sm:w-auto font-sans">
                                    {pkg.hasAgePricing && (
                                      <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100/70">
                                        {pkg.agePricing?.dewasa?.enabled && (
                                          <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-700">
                                            <span>Dewasa</span>
                                            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 shadow-3xs p-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const curr = pkg.selectedAgeQuantities?.dewasa || 0;
                                                  if (curr > 0) {
                                                    updatePackageAgeQuantity(pkg.id, 'dewasa', curr - 1);
                                                  }
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold transition-all cursor-pointer"
                                              >
                                                -
                                              </button>
                                              <span className="w-5 text-center font-black text-xs text-slate-800">
                                                {pkg.selectedAgeQuantities?.dewasa || 0}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const curr = pkg.selectedAgeQuantities?.dewasa || 0;
                                                  updatePackageAgeQuantity(pkg.id, 'dewasa', curr + 1);
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold transition-all cursor-pointer"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {pkg.agePricing?.wargaEmas?.enabled && (
                                          <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-700">
                                            <span>Warga Emas</span>
                                            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 shadow-3xs p-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const curr = pkg.selectedAgeQuantities?.wargaEmas || 0;
                                                  if (curr > 0) {
                                                    updatePackageAgeQuantity(pkg.id, 'wargaEmas', curr - 1);
                                                  }
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold transition-all cursor-pointer"
                                              >
                                                -
                                              </button>
                                              <span className="w-5 text-center font-black text-xs text-slate-800">
                                                {pkg.selectedAgeQuantities?.wargaEmas || 0}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const curr = pkg.selectedAgeQuantities?.wargaEmas || 0;
                                                  updatePackageAgeQuantity(pkg.id, 'wargaEmas', curr + 1);
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold transition-all cursor-pointer"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {pkg.agePricing?.kanakKanak?.enabled && (
                                          <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-700">
                                            <span>Kanak-Kanak</span>
                                            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 shadow-3xs p-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const curr = pkg.selectedAgeQuantities?.kanakKanak || 0;
                                                  if (curr > 0) {
                                                    updatePackageAgeQuantity(pkg.id, 'kanakKanak', curr - 1);
                                                  }
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold transition-all cursor-pointer"
                                              >
                                                -
                                              </button>
                                              <span className="w-5 text-center font-black text-xs text-slate-800">
                                                {pkg.selectedAgeQuantities?.kanakKanak || 0}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const curr = pkg.selectedAgeQuantities?.kanakKanak || 0;
                                                  updatePackageAgeQuantity(pkg.id, 'kanakKanak', curr + 1);
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold transition-all cursor-pointer"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      disabled={pkg.hasAgePricing && getPackagePrice(pkg) === 0}
                                      onClick={() => handleTogglePackage(pkg.id)}
                                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-3xs cursor-pointer text-center ${
                                        isSelected 
                                          ? 'bg-amber-600 text-white hover:bg-amber-700' 
                                          : 'bg-white border border-slate-200 text-slate-800 hover:border-amber-400 hover:bg-amber-50/20'
                                      } ${(pkg.hasAgePricing && getPackagePrice(pkg) === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      {isSelected ? 'Keluarkan' : 'Pilih Pakej'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-[24px] border border-dashed border-slate-200 p-8 text-center text-slate-400 font-extrabold text-xs space-y-2 animate-fadeIn">
                  <AlertCircle size={24} className="mx-auto text-slate-300 stroke-[2.5]" />
                  <p>Tiada pakej yuran dijumpai</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Summary & Progress (col-span-3) */}
        <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-6 order-1 lg:order-2">
          
          {/* 2. RINGKASAN YURAN CARD */}
          <div className={`bg-[#3f3ebd] text-white rounded-[24px] p-6 shadow-xl relative overflow-hidden ${isRejectedOrRevoked ? 'opacity-40 grayscale-xs pointer-events-none select-none' : ''}`}>
            <div className="flex items-center gap-1.5 opacity-90">
              <h3 className="font-extrabold text-sm tracking-wide">Ringkasan Yuran</h3>
              <Info size={14} className="stroke-[2.5]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-y-6 gap-x-4 mt-6 border-t border-white/10 pt-5">
              {/* Card Item 1 */}
              <div className="space-y-1">
                <div className="text-white/80">
                  <CreditCard size={18} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-wider block mt-1">Total Pembayaran</span>
                <span className="text-lg lg:text-xl font-black tracking-tight text-white block">
                  RM{totalPembayaranValue.toFixed(2)}
                </span>
              </div>

              {/* Card Item 2 */}
              <div className="space-y-1">
                <div className="text-white/80">
                  <Calendar size={18} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-wider block mt-1">Total Yuran Bulanan</span>
                <span className="text-lg lg:text-xl font-black tracking-tight text-white block">
                  RM{totalYuranBulananValue.toFixed(2)}
                </span>
              </div>

              {/* Card Item 3 */}
              <div className="space-y-1">
                <div className="text-white/80">
                  <ShieldCheck size={18} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-wider block mt-1">Total Khairat Kematian</span>
                <span className="text-lg lg:text-xl font-black tracking-tight text-white block">
                  RM{totalKhairatKematianValue.toFixed(2)}
                </span>
              </div>

              {/* Card Item 4 */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-white/80">
                  <Award size={18} className="stroke-[2.5]" />
                  <span className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Status Warga</span>
                </div>
                <div className="mt-1">
                  {currentUserDoc?.membershipStatus === 'Aktif' ? (
                    <span className="bg-[#10b981] text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                      Warga Aktif
                    </span>
                  ) : currentUserDoc?.membershipStatus === 'Menunggu Kelulusan' ? (
                    <span className="bg-amber-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                      Menunggu
                    </span>
                  ) : currentUserDoc?.membershipStatus === 'Ditolak' || currentUserDoc?.approvalStatus === 'Rejected' ? (
                    <span className="bg-rose-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                      Ditolak
                    </span>
                  ) : currentUserDoc?.approvalStatus === 'Dilucutkan' || currentUserDoc?.membershipStatus === 'Tidak Aktif' ? (
                    <span className="bg-red-700 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                      Dilucutkan
                    </span>
                  ) : (
                    <span className="bg-slate-500/40 text-slate-200 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                      Bukan Warga
                    </span>
                  )}
                </div>
                {currentUserDoc?.membershipStatus === 'Aktif' ? (
                  <span className="text-[9px] text-white/50 block font-bold mt-1">{sahHinggaText}</span>
                ) : currentUserDoc?.membershipStatus === 'Menunggu Kelulusan' ? (
                  <span className="text-[9px] text-white/50 block font-bold mt-1">Menunggu Kelulusan</span>
                ) : currentUserDoc?.membershipStatus === 'Ditolak' || currentUserDoc?.approvalStatus === 'Rejected' ? (
                  <span className="text-[9px] text-white/50 block font-bold mt-1">Permohonan Ditolak</span>
                ) : currentUserDoc?.approvalStatus === 'Dilucutkan' || currentUserDoc?.membershipStatus === 'Tidak Aktif' ? (
                  <span className="text-[9px] text-white/50 block font-bold mt-1">Status Dilucutkan</span>
                ) : (
                  <span className="text-[9px] text-white/50 block font-bold mt-1">Sila daftar warga</span>
                )}
              </div>
            </div>
          </div>

          {/* --- DYNAMIC ROUNDED ACTION BUTTONS BAR (MOBILE ONLY) --- */}
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-2xs p-4 flex lg:hidden justify-between items-center gap-1 select-none">
            {/* INFO */}
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
            >
              <div className="w-13 h-13 rounded-full flex items-center justify-center transition-all duration-300 bg-cyan-500 hover:bg-cyan-600 hover:scale-105 hover:shadow-md hover:shadow-cyan-100 text-white shadow-xs">
                <Info size={18} className="stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-cyan-600 transition-colors">
                Info
              </span>
            </button>

            {/* KELEBIHAN */}
            <button
              type="button"
              onClick={() => setShowKelebihanModal(true)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
            >
              <div className="w-13 h-13 rounded-full bg-violet-500 hover:bg-violet-600 hover:scale-105 hover:shadow-md hover:shadow-indigo-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                <Award size={18} className="stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-violet-600 transition-colors text-center">
                Kelebihan
              </span>
            </button>

            {/* NILAI LIMIT */}
            <button
              type="button"
              onClick={() => setShowLimitModal(true)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
            >
              <div className="w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 hover:scale-105 hover:shadow-md hover:shadow-emerald-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                <TrendingUp size={18} className="stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-emerald-600 transition-colors">
                Nilai Limit
              </span>
            </button>

            {/* TRANSAKSI */}
            <button
              type="button"
              onClick={() => setShowTransactionsModal(true)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
            >
              <div className="w-13 h-13 rounded-full bg-blue-500 hover:bg-blue-600 hover:scale-105 hover:shadow-md hover:shadow-blue-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                <FileText size={16} className="stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-blue-600 transition-colors">
                Transaksi
              </span>
            </button>

            {/* ADMIN */}
            {isUserAdminOrTreasurer && (
              <button
                type="button"
                onClick={() => setShowAdminManualModal(true)}
                className="flex flex-col items-center gap-1.5 group cursor-pointer flex-1"
              >
                <div className="w-13 h-13 rounded-full bg-slate-800 hover:bg-slate-900 hover:scale-105 hover:shadow-md hover:shadow-slate-100 transition-all duration-300 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck size={18} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-600 tracking-tight group-hover:text-slate-800 transition-colors">
                  Admin
                </span>
              </button>
            )}
          </div>

          {/* 3.5 STATUS KEAHLIAN CARD */}
          <div className={`bg-gradient-to-br from-[#f3f4ff] to-[#f8f7ff] rounded-[24px] border border-[#3f3ebd]/15 shadow-sm p-6 flex items-center justify-between gap-6 ${isRejectedOrRevoked ? 'opacity-40 grayscale-xs pointer-events-none select-none' : ''}`}>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-widest">Status Pembayaran Yuran Keahlian</h3>
                <p className="text-slate-400 text-[10px] font-bold mt-0.5">Yuran Sekali Bayar Seumur Hidup</p>
              </div>
              <div className="flex items-center gap-2">
                {packages.find(p => p.category === 'Keahlian')?.isPaid ? (
                  <>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                      <Check size={16} className="stroke-[3]" />
                    </div>
                    <span className="text-xs font-black text-slate-900">SUDAH DIBAYAR</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-50 text-rose-600">
                      <X size={16} className="stroke-[3]" />
                    </div>
                    <span className="text-xs font-black text-slate-900">BELUM DIBAYAR</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 4. PROGRESS PEMBAYARAN CARD */}
          <div className={`bg-gradient-to-br from-[#f3f4ff] to-[#f8f7ff] rounded-[24px] border border-[#3f3ebd]/15 shadow-sm p-6 flex flex-col gap-6 ${isRejectedOrRevoked ? 'opacity-40 grayscale-xs pointer-events-none select-none' : ''}`}>
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-widest">Progress Pembayaran</h3>
                  <p className="text-slate-400 text-[10px] font-bold mt-0.5">Sesi Semasa ({sessionDisplayLabel})</p>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-white/80 rounded-full h-2 overflow-hidden border border-[#3f3ebd]/10">
                    <motion.div 
                      className="bg-[#3f3ebd] h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${activeProgressPercent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-500 tracking-wider">
                    <span>{activeMonthsPaid} / 12 BULAN</span>
                    <span>{activeProgressPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Circular Ring SVG */}
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-[#3f3ebd]/10"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-[#3f3ebd]"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 26}
                    initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - activeProgressPercent / 100) }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-black text-slate-800 text-[11px]">{activeProgressPercent}%</span>
              </div>
            </div>
            
            {/* BULAN SENARAI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 pt-4 border-t border-[#3f3ebd]/10">
              {(activeSessionYear === '2026' ? months2026List : months2027List).map((m) => {
                const isPaid = isMonthPaidInSession(activeSessionYear as '2026' | '2027', m.index);
                return (
                  <div key={`${m.name}-${m.year}`} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${isPaid ? 'bg-[#3f3ebd] border-[#3f3ebd] text-white' : 'bg-white/80 border-[#3f3ebd]/15'}`}>
                      {isPaid && <Check size={10} className="stroke-[3]" />}
                    </div>
                    <span className={`text-[10px] font-bold ${isPaid ? 'text-slate-800 font-extrabold' : 'text-slate-500 font-semibold'}`}>
                      {m.name} <span className="font-medium text-slate-400">({m.year})</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4.5 PROGRESS PEMBAYARAN SESI LEPAS CARD */}
          {activeSessionYear === '2027' && hasUnpaidSesiLama && (
            <div className={`bg-rose-50/25 rounded-[24px] border border-rose-200/60 shadow-xs p-6 flex flex-col gap-6 animate-fadeIn ${isRejectedOrRevoked ? 'opacity-40 grayscale-xs pointer-events-none select-none' : ''}`}>
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-extrabold text-rose-900 text-xs uppercase tracking-widest">Progress Sesi Lepas</h3>
                    <p className="text-rose-500/80 text-[10px] font-bold mt-0.5">Sesi 2026/2027 (Tertunggak)</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-rose-100">
                      <motion.div 
                        className="bg-rose-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent2026}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-extrabold text-rose-500 tracking-wider">
                      <span>{paidMonthsCount2026} / 12 BULAN</span>
                      <span>{progressPercent2026}%</span>
                    </div>
                  </div>
                </div>

                {/* Circular Ring SVG */}
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      className="stroke-rose-100"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="32"
                      cy="32"
                      r="26"
                      className="stroke-rose-500"
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 26}
                      initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - progressPercent2026 / 100) }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-black text-rose-800 text-[11px]">{progressPercent2026}%</span>
                </div>
              </div>
              
              {/* BULAN SENARAI SESI LEPAS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 pt-4 border-t border-rose-100">
                {months2026List.map((m) => {
                  const isPaid = isMonthPaidInSession('2026', m.index);
                  return (
                    <div key={`${m.name}-${m.year}-past`} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${isPaid ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-rose-200'}`}>
                        {isPaid && <Check size={10} className="stroke-[3]" />}
                      </div>
                      <span className={`text-[10px] font-bold ${isPaid ? 'text-slate-800 font-extrabold' : 'text-rose-400 font-semibold'}`}>
                        {m.name} <span className="font-medium text-slate-400">({m.year})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* COLUMN 3: Sejarah Transaksi (col-span-4) */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6 order-3">
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-50 text-[#3f3ebd] p-2.5 rounded-xl">
                  <FileText size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-widest">Sejarah Transaksi</h3>
                  <p className="text-slate-400 text-[9px] font-bold mt-0.5">Rekod Pembayaran Yuran</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-[#3f3ebd] bg-indigo-50 px-2.5 py-0.5 rounded-full">
                {currentSessionTransactions.length} Rekod
              </span>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {currentSessionTransactions.length > 0 ? (
                currentSessionTransactions.map((txn) => (
                    <div key={txn.id} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100/80 flex justify-between items-start gap-3 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all duration-300">
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] font-black text-slate-800 block truncate leading-tight">
                          {txn.description.replace('Bayaran yuran (', '').replace(') oleh Ahmad', '')}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold block">
                          {txn.date} • {txn.time}
                        </span>
                        <span className="text-[8px] font-mono text-slate-400 block font-semibold uppercase tracking-wider">
                          Ref: {txn.voucherNo}
                        </span>
                        <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full border inline-block mt-0.5 shadow-3xs ${getCategoryBadgeStyle(txn.category)}`}>
                          {txn.category}
                        </span>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="text-right">
                          <span className="font-black text-[#3f3ebd] block text-xs">
                            RM{txn.amount.toFixed(2)}
                          </span>
                          {txn.approvalStatus === 'Approved' ? (
                            <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block">
                              Berjaya
                            </span>
                          ) : txn.approvalStatus === 'Rejected' ? (
                            <span className="text-[8px] font-extrabold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block">
                              Ditolak
                            </span>
                          ) : (
                            <span className="text-[8px] font-extrabold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block">
                              Belum Disahkan
                            </span>
                          )}
                        </div>
                        {txn.approvalStatus === 'Approved' && (
                          <button
                            onClick={async () => {
                              try {
                                await generateReceiptPdf(txn, allUsers || []);
                              } catch (e) {
                                console.error(e);
                                alert("Gagal memuat turun resit.");
                              }
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors shadow-xs"
                            title="Muat turun Resit PDF"
                          >
                            <Download size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <AlertCircle size={24} className="mx-auto text-slate-300 stroke-[2.5]" />
                  <p className="text-[10px] font-bold">Tiada rekod bayaran yuran dijumpai.</p>
                </div>
              )}
            </div>

            <div className="text-center text-[9px] text-slate-400 font-semibold bg-amber-50 rounded-xl p-2.5 border border-amber-100 leading-relaxed">
              💡 Transaksi baru akan direkodkan secara automatik ke dalam buku akaun Kewangan dengan aliran masuk {"(Yuran -> Bank)"}.
            </div>
          </div>
        </div>

      </div>

      {/* 5. TROLI ANDA FLOATING / STICKY FOOTER */}
      <AnimatePresence>
        {cartPackageIds.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="sticky bottom-4 z-40 bg-[#3f3ebd] text-white rounded-[24px] p-4.5 shadow-2xl flex items-center justify-between gap-4 border border-white/10"
          >
            {/* Left Section: Shopping Cart Icon + Items info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative bg-white/10 p-3 rounded-2xl shrink-0 text-white flex items-center justify-center">
                <ShoppingCart size={18} className="stroke-[2.5]" />
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#3f3ebd] shadow-sm">
                  {cartPackageIds.length}
                </span>
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-white/90">Troli Anda</h4>
                <div className="space-y-0.5 mt-1 max-h-12 overflow-y-auto pr-1">
                  {selectedPackages.map(p => (
                    <div key={p.id} className="flex justify-between items-center text-[9px] text-white/70 font-semibold gap-4 truncate">
                      <span>1x {p.name}</span>
                      <span className="font-extrabold text-white">RM{getPackagePrice(p).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Section: Total count and check action */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-[9px] text-white/60 font-bold uppercase tracking-wider block">Jumlah</span>
                <span className="text-base lg:text-lg font-black tracking-tight block">
                  RM{cartTotal.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartPayment}
                className="bg-white hover:bg-slate-50 text-[#3f3ebd] font-black text-[11px] px-4 py-2.5 rounded-xl flex items-center gap-1 shadow-lg transition-all cursor-pointer"
              >
                <span>Lihat Troli</span>
                <ArrowRight size={12} className="stroke-[3]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FLOATING TOAST FEEDBACK --- */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-extrabold text-xs px-5 py-3 rounded-full shadow-xl flex items-center gap-2 border border-slate-800"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- NILAI LIMIT MODAL --- */}
      <AnimatePresence>
        {showLimitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden text-slate-800 p-6 space-y-5 border border-slate-100"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 text-[#3f3ebd] p-2 rounded-xl">
                    <TrendingUp size={18} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950">Had & Nilai Limit</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Tetapan had transaksi rasmi persatuan</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLimitModal(false)}
                  className="bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <X size={14} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Meter 1: Yuran Keahlian Limit */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-800 text-[11px] uppercase tracking-wider">Yuran Keahlian</span>
                    <span className="font-mono font-black text-[#3f3ebd]">
                      RM{keahlianDisplayTotal.toFixed(2)} / RM50.00
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#3f3ebd] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (keahlianDisplayTotal / 50) * 100)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Digunakan: {Math.round((keahlianDisplayTotal / 50) * 100)}%</span>
                    <span>Baki Had: RM{Math.max(0, 50 - keahlianDisplayTotal).toFixed(2)}</span>
                  </div>
                  <p className="text-[9.5px] text-slate-500 font-bold leading-normal pt-1.5 border-t border-slate-200/40">
                    Had limit pembayaran ialah RM50 untuk yuran keahlian.
                  </p>
                </div>

                {/* Meter 2: Yuran Bulanan Limit */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-800 text-[11px] uppercase tracking-wider">Yuran Bulanan & Tahunan</span>
                    <span className="font-mono font-black text-emerald-600">
                      RM{bulananDisplayTotal.toFixed(2)} / RM120.00
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (bulananDisplayTotal / 120) * 100)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Digunakan: {Math.round((bulananDisplayTotal / 120) * 100)}%</span>
                    <span>Baki Had: RM{Math.max(0, 120 - bulananDisplayTotal).toFixed(2)}</span>
                  </div>
                  <p className="text-[9.5px] text-slate-500 font-bold leading-normal pt-1.5 border-t border-slate-200/40">
                    Had limit pembayaran ialah RM120 untuk Yuran Bulanan (bulanan/penggal/tahunan).
                  </p>
                </div>

                {/* Peti Sumbangan Highlight Panel */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Heart size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-amber-950 text-xs">Peti Sumbangan Komuniti</h4>
                    <p className="text-[10px] text-amber-900/80 font-bold leading-relaxed">
                      Lebih daripada had tersebut, sila ke <strong>Peti Sumbangan</strong> persatuan untuk menyalurkan tajaan atau sumbangan ikhlas demi kebaikan bersama.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLimitModal(false);
                        window.dispatchEvent(new CustomEvent('tmf2_switch_view', { detail: 'sumbangan' }));
                      }}
                      className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black transition-all cursor-pointer shadow-2xs"
                    >
                      <Heart size={11} className="fill-white" />
                      <span>Salurkan ke Halaman Sumbangan (/sumbangan)</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer shadow-md"
              >
                Faham & Tutup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- TRANSAKSI MODAL --- */}
      <AnimatePresence>
        {showTransactionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden text-slate-800 p-6 space-y-5 border border-slate-100"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                    <FileText size={18} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950">Sejarah Transaksi</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Resit rasmi pembayaran terdahulu</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTransactionsModal(false)}
                  className="bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <X size={14} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-3 pr-1 text-xs">
                {allYuranTransactions.length > 0 ? (
                  allYuranTransactions.map((txn) => (
                    <div key={txn.id} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100/80 flex justify-between items-center gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-800 block truncate leading-tight">
                          {txn.description.replace('Bayaran yuran (', '').replace(') oleh Ahmad', '')}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold block">
                          {txn.date} • {txn.time}
                        </span>
                        <span className="text-[8px] font-mono text-slate-400 block font-bold">
                          REF: {txn.voucherNo}
                        </span>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="text-right">
                          <span className="font-black text-slate-950 block text-xs">RM{txn.amount.toFixed(2)}</span>
                          {txn.approvalStatus === 'Approved' ? (
                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block">
                              Berjaya
                            </span>
                          ) : txn.approvalStatus === 'Rejected' ? (
                            <span className="text-[8px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block">
                              Ditolak
                            </span>
                          ) : (
                            <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block">
                              Belum Disahkan
                            </span>
                          )}
                        </div>
                        {txn.approvalStatus === 'Approved' && (
                          <button
                            onClick={async () => {
                              try {
                                await generateReceiptPdf(txn, allUsers || []);
                              } catch (e) {
                                console.error(e);
                                alert("Gagal memuat turun resit.");
                              }
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors shadow-xs"
                            title="Muat turun Resit PDF"
                          >
                            <Download size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs font-bold bg-slate-50/50">
                    Tiada rekod bayaran yuran dijumpai.
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-400 font-semibold bg-amber-50 rounded-xl p-2.5 border border-amber-100">
                💡 Sila rujuk email anda untuk salinan resit PDF rasmi persatuan.
              </div>

              <button
                type="button"
                onClick={() => setShowTransactionsModal(false)}
                className="w-full py-3 bg-[#3f3ebd] hover:bg-[#3433a3] text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup Sejarah
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- LAINNYA MODAL --- */}
      <AnimatePresence>
        {showLainnyaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden text-slate-800 p-6 space-y-4.5 border border-slate-100"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100 text-amber-600 p-2 rounded-xl">
                    <MoreHorizontal size={18} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950">Menu Tambahan</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Pilihan sokongan & utiliti persatuan</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLainnyaModal(false)}
                  className="bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <X size={14} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-left">
                {/* 1. Hubungi Bendahari */}
                <div className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="font-extrabold text-slate-800 text-[11px]">Bantuan & Sokongan Bendahari</h4>
                    <p className="text-[9px] text-slate-400 font-bold leading-normal">Ada soalan mengenai caruman atau akaun yuran?</p>
                  </div>
                  <a
                    href="https://wa.me/60123456789"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] px-3.5 py-2 rounded-xl shrink-0 text-center"
                  >
                    WhatsApp
                  </a>
                </div>

                {/* 2. Kelebihan Ahli Persatuan */}
                <div className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100 space-y-2">
                  <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Kelebihan Ahli Berdaftar</h4>
                  <ul className="space-y-1 text-[9.5px] text-slate-500 font-bold">
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                      <span>Sumbangan Khairat Kematian ahli sehingga RM2,000</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                      <span>Kemudahan penggunaan Dewan Al-Ghazali SMAUJ</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                      <span>Sumbangan kebajikan kecemasan & musibah</span>
                    </li>
                  </ul>
                </div>

                {/* 2.5 Simulasi Sesi Sistem */}
                <div className="p-3.5 rounded-2xl bg-[#f5f3ff] border border-[#ddd6fe] space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-[#5c3ea1] text-[11px] uppercase tracking-wider">Simulasi Sesi Sistem</h4>
                    <span className="text-[9px] font-black text-[#7c3aed] bg-[#ede9fe] px-2 py-0.5 rounded-md uppercase">
                      Sesi: {sessionDisplayLabel}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold leading-normal">
                    Ubah tahun sesi sistem secara manual untuk menguji kelakuan bil tunggakan sesi lepas atau status automatik.
                  </p>
                  <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setSessionYearMode('2026');
                        localStorage.setItem('tmf2_session_year_mode', '2026');
                      }}
                      className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        activeSessionYear === '2026' && sessionYearMode !== 'auto'
                          ? 'bg-white text-[#7c3aed] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Sesi 2026/2027
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionYearMode('2027');
                        localStorage.setItem('tmf2_session_year_mode', '2027');
                      }}
                      className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        activeSessionYear === '2027' && sessionYearMode !== 'auto'
                          ? 'bg-white text-[#7c3aed] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Sesi 2027/2028
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionYearMode('auto');
                        localStorage.setItem('tmf2_session_year_mode', 'auto');
                      }}
                      className={`px-3 py-1.5 text-[9px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        sessionYearMode === 'auto'
                          ? 'bg-[#7c3aed] text-white shadow-2xs'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      Auto {isAutoAfterJuly2027 ? '(2027)' : '(2026)'}
                    </button>
                  </div>
                </div>

                {/* 3. Reset Area */}
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="font-extrabold text-rose-800 text-[10px]">Atur Semula Segala Rekod</h4>
                    <p className="text-[8.5px] text-rose-400 font-bold">Padam semua memori pelayar & mulakan simulasi baharu.</p>
                  </div>
                  <button
                    onClick={() => {
                      handleResetFees();
                      setShowLainnyaModal(false);
                      setToastMessage("Rekod pembayaran telah di-reset!");
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] px-3 py-1.5 rounded-lg tracking-wider uppercase shrink-0"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLainnyaModal(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer text-center"
              >
                Tutup Menu
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* INFO MODAL */}
      <AnimatePresence>
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfoModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-[24px] shadow-2xl p-5 border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
                  <Info size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Informasi Yuran</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Panduan ringkas sistem sumbangan & yuran SMAUJ</p>
                </div>
              </div>

              <div className="overflow-y-auto pr-2 space-y-4 pb-2">
                <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2 border border-slate-100">
                  <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5"><CreditCard size={14} className="text-cyan-500"/> Cara Pembayaran</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Anda boleh memilih yuran yang ingin dibayar dari senarai, dan tekan butang <strong className="text-slate-700">Tambahkan</strong>. Buka troli untuk melihat rumusan dan tekan butang <strong className="text-slate-700">Selesaikan Bayaran</strong>. Pembayaran boleh dilakukan melalui FPX (bank tempatan) secara selamat.
                  </p>
                </div>

                <div className="bg-indigo-50/50 rounded-2xl p-3.5 space-y-2 border border-indigo-100/50">
                  <h4 className="font-black text-indigo-900 text-xs flex items-center gap-1.5"><User size={14} className="text-indigo-500"/> Yuran Keahlian PIBG</h4>
                  <p className="text-[10px] text-indigo-600/80 font-medium leading-relaxed">
                    Dibayar sekali sahaja seumur hidup semasa pendaftaran. Ini menjadikan anda ahli berdaftar secara rasmi di bawah naungan PIBG SMAUJ.
                  </p>
                </div>

                <div className="bg-violet-50/50 rounded-2xl p-3.5 space-y-2 border border-violet-100/50">
                  <h4 className="font-black text-violet-900 text-xs flex items-center gap-1.5"><Calendar size={14} className="text-violet-500"/> Kiraan Sesi & Yuran</h4>
                  <p className="text-[10px] text-violet-600/80 font-medium leading-relaxed">
                    <strong className="text-violet-800">Sesi Tahunan:</strong> Dikira selama 12 bulan mengikut tetapan sesi semasa (cth: {monthsRangeLabel}).<br/><br/>
                    <strong className="text-violet-800">Tahunan/Bulanan/Penggal:</strong> Anda boleh memilih untuk membayar secara setahun (diskaun diberikan), atau dibayar secara bulanan mahupun setiap 6 bulan (penggal) mengikut keselesaan bajet anda.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  Faham & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* KELEBIHAN MODAL */}
      <AnimatePresence>
        {showKelebihanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKelebihanModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl p-5 border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 shrink-0 border-b border-slate-50 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                    <Award size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Kelebihan & Faedah Ahli</h3>
                    <p className="text-[10px] text-slate-500 font-bold">Kebajikan warga Sekolah Menengah Agama Ulu Jempol</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKelebihanModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto pr-1.5 space-y-3.5 pb-2 scrollbar-thin">
                {benefitsConfig.map((item, idx) => {
                  let IconComponent = Heart;
                  if (item.icon === 'Users') IconComponent = Users;
                  else if (item.icon === 'ShieldCheck') IconComponent = ShieldCheck;
                  else if (item.icon === 'Check') IconComponent = Check;
                  else if (item.icon === 'Award') IconComponent = Award;
                  else if (item.icon === 'HelpCircle') IconComponent = HelpCircle;
                  else if (item.icon === 'Gift') IconComponent = Gift;

                  const colorStyles: Record<string, string> = {
                    rose: 'bg-rose-50/70 border-rose-100 text-rose-600 bg-rose-100 text-rose-950 text-rose-900/80',
                    indigo: 'bg-indigo-50/70 border-indigo-100 text-indigo-600 bg-indigo-100 text-indigo-950 text-indigo-900/80',
                    blue: 'bg-blue-50/70 border-blue-100 text-blue-600 bg-blue-100 text-blue-950 text-blue-900/80',
                    emerald: 'bg-emerald-50/70 border-emerald-100 text-emerald-600 bg-emerald-100 text-emerald-950 text-emerald-900/80',
                    amber: 'bg-amber-50/70 border-amber-100 text-amber-600 bg-amber-100 text-amber-950 text-amber-900/80',
                    violet: 'bg-violet-50/70 border-violet-100 text-violet-600 bg-violet-100 text-violet-950 text-violet-900/80',
                    purple: 'bg-purple-50/70 border-purple-100 text-purple-600 bg-purple-100 text-purple-950 text-purple-900/80',
                  };

                  const theme = item.color || 'indigo';

                  return (
                    <div key={item.id || idx} className={`bg-${theme}-50/70 border border-${theme}-100 p-3.5 rounded-2xl flex gap-3`}>
                      <div className={`w-8 h-8 rounded-full bg-${theme}-100 text-${theme}-600 flex items-center justify-center shrink-0 mt-0.5`}>
                        <IconComponent size={16} className="stroke-[2.5]" />
                      </div>
                      <div className="space-y-1">
                        <h4 className={`font-extrabold text-${theme}-950 text-xs`}>{item.title}</h4>
                        <p className={`text-[10.5px] text-${theme}-900/80 font-bold leading-relaxed`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKelebihanModal(false)}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer text-center"
                >
                  Tutup Faedah Ahli
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating WhatsApp Button */}
      <a
        href={`https://wa.me/60102537234?text=${encodeURIComponent(`Assalamualaikum, saya ${currentUserDoc?.displayName || currentUserDoc?.nickname || '[Nama Penuh]'}, pemilik rumah no ${currentUserDoc?.noRumah || '[No Rumah]'} ingin bertanyakan soalan.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 md:bottom-6 right-6 z-50 flex items-center gap-2 p-3.5 md:px-4.5 md:py-3.5 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-extrabold rounded-full shadow-2xl hover:shadow-green-200 transition-all cursor-pointer group"
        id="floating-whatsapp-btn"
      >
        <MessageCircle size={18} className="stroke-[2.5]" />
        <span className="hidden md:inline text-xs">Hubungi Kami</span>
      </a>

      {/* Admin Manual Payment Modal */}
      <AnimatePresence>
        {showAdminManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!uploadingManual) {
                  setShowAdminManualModal(false);
                  resetManualForm();
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-[24px] shadow-2xl p-5 border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 shrink-0 border-b border-slate-50 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white">
                    <ShieldCheck size={20} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Rekod Manual Yuran Ahli</h3>
                    <p className="text-[10px] text-slate-500 font-bold">Menu Khas Admin Utama & Bendahari</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!uploadingManual) {
                      setShowAdminManualModal(false);
                      resetManualForm();
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
                  disabled={uploadingManual}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto pr-1.5 space-y-4 pb-4 scrollbar-thin flex-1">
                {/* Error Banner */}
                {adminManualError && (
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex gap-2 text-rose-800 text-xs font-bold leading-relaxed">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                    <span>{adminManualError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {adminManualSuccess && (
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex gap-2 text-emerald-800 text-xs font-bold leading-relaxed animate-pulse">
                    <Check size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                    <span>Pendaftaran yuran manual berjaya direkodkan sebagai Duit Tunai Masuk!</span>
                  </div>
                )}

                {/* 1. Select Member */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Pilih Ahli Terdaftar *</label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => {
                      setSelectedMemberId(e.target.value);
                      setSelectedManualPackageIds([]);
                      setAdminManualError(null);
                      setAdminManualSuccess(false);
                    }}
                    disabled={uploadingManual || adminManualSuccess}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 font-bold bg-slate-50 text-slate-800 cursor-pointer"
                  >
                    <option value="">-- Sila Pilih Ahli --</option>
                    {allUsers && allUsers.map((user) => (
                      <option key={user.uid} value={user.uid}>
                        {user.displayName || user.nickname || user.email || 'Ahli Tanpa Nama'} {user.noRumah ? `(No ${user.noRumah})` : `(${user.role})`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedMemberId && (
                  <>
                    {/* 2. Choose Yuran Packages */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-700 block">Pilih Yuran yang Dibayar *</label>
                        <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                          Sesi {activeSessionYear}
                        </span>
                      </div>

                      {/* Displaying available Packages */}
                      <div className="space-y-2.5 max-h-52 overflow-y-auto p-1.5 border border-slate-100 rounded-xl bg-slate-50/50 scrollbar-thin">
                        
                        {/* Keahlian Package */}
                        {packages.filter(p => p.category === 'Keahlian').map((p) => {
                          const isPaid = memberPaidPackageIds.includes(p.id);
                          const isSelected = selectedManualPackageIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                if (!isPaid && !uploadingManual && !adminManualSuccess) {
                                  handleToggleManualPackage(p.id);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                                isPaid 
                                  ? 'bg-emerald-50/40 border-emerald-100 opacity-60 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-indigo-100/80 border-indigo-300 ring-2 ring-indigo-200 cursor-pointer shadow-xs'
                                    : 'bg-gradient-to-r from-indigo-50/70 to-purple-50/40 border-indigo-200 hover:border-indigo-300 cursor-pointer'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-[10.5px] font-black text-indigo-950 leading-tight">{p.name}</h4>
                                  <span className="text-[7.5px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded uppercase">
                                    Sekali Sahaja
                                  </span>
                                </div>
                                <p className="text-[9px] text-indigo-900/70 font-bold mt-0.5">{p.subtitle}</p>
                              </div>
                              <div className="shrink-0 text-right flex items-center gap-2">
                                <span className="text-[10px] font-black text-indigo-700">{p.priceLabel}</span>
                                {isPaid ? (
                                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded-md uppercase">Selesai</span>
                                ) : (
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-300 bg-white'
                                  }`}>
                                    {isSelected && <Check size={10} className="stroke-[3]" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Tahunan Package */}
                        {packages.filter(p => p.category === 'Tahunan' && p.sessionYear === activeSessionYear).map((p) => {
                          const isPaid = memberPaidPackageIds.includes(p.id);
                          const isSelected = selectedManualPackageIds.includes(p.id);
                          const isDisabled = isManualPackageDisabled(p);
                          if (isDisabled && !isPaid) return null;
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                if (!isPaid && !uploadingManual && !adminManualSuccess) {
                                  handleToggleManualPackage(p.id);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                                isPaid 
                                  ? 'bg-emerald-50/40 border-emerald-100 opacity-60 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-indigo-50/70 border-indigo-200 cursor-pointer shadow-xs'
                                    : 'bg-white border-slate-150 hover:border-slate-300 cursor-pointer'
                              }`}
                            >
                              <div className="min-w-0">
                                <h4 className="text-[10.5px] font-extrabold text-slate-900 leading-tight">{p.name}</h4>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{p.subtitle} • <span className="text-emerald-600">{p.savingBadge}</span></p>
                              </div>
                              <div className="shrink-0 text-right flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-700">{p.priceLabel}</span>
                                {isPaid ? (
                                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded-md uppercase">Selesai</span>
                                ) : (
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isSelected && <Check size={10} className="stroke-[3]" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Penggal Packages */}
                        {packages.filter(p => p.category === 'Penggal' && p.sessionYear === activeSessionYear).map((p) => {
                          const isPaid = memberPaidPackageIds.includes(p.id);
                          const isSelected = selectedManualPackageIds.includes(p.id);
                          const isDisabled = isManualPackageDisabled(p);
                          if (isDisabled && !isPaid) return null;
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                if (!isPaid && !uploadingManual && !adminManualSuccess) {
                                  handleToggleManualPackage(p.id);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                                isPaid 
                                  ? 'bg-emerald-50/40 border-emerald-100 opacity-60 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-indigo-50/70 border-indigo-200 cursor-pointer shadow-xs'
                                    : 'bg-white border-slate-150 hover:border-slate-300 cursor-pointer'
                              }`}
                            >
                              <div className="min-w-0">
                                <h4 className="text-[10.5px] font-extrabold text-slate-900 leading-tight">{p.name}</h4>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{p.subtitle} • <span className="text-emerald-600">{p.savingBadge}</span></p>
                              </div>
                              <div className="shrink-0 text-right flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-700">{p.priceLabel}</span>
                                {isPaid ? (
                                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded-md uppercase">Selesai</span>
                                ) : (
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isSelected && <Check size={10} className="stroke-[3]" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Bulanan Packages */}
                        {packages.filter(p => p.category === 'Bulanan' && p.sessionYear === activeSessionYear).map((p) => {
                          const isPaid = memberPaidPackageIds.includes(p.id);
                          const isSelected = selectedManualPackageIds.includes(p.id);
                          const isDisabled = isManualPackageDisabled(p);
                          if (isDisabled && !isPaid) return null;
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                if (!isPaid && !uploadingManual && !adminManualSuccess) {
                                  handleToggleManualPackage(p.id);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                                isPaid 
                                  ? 'bg-emerald-50/40 border-emerald-100 opacity-60 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-indigo-50/70 border-indigo-200 cursor-pointer shadow-xs'
                                    : 'bg-white border-slate-150 hover:border-slate-300 cursor-pointer'
                              }`}
                            >
                              <div className="min-w-0">
                                <h4 className="text-[10.5px] font-extrabold text-slate-900 leading-tight">{p.name}</h4>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{p.subtitle}</p>
                              </div>
                              <div className="shrink-0 text-right flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-700">{p.priceLabel}</span>
                                {isPaid ? (
                                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded-md uppercase">Selesai</span>
                                ) : (
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isSelected && <Check size={10} className="stroke-[3]" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Yuran Tambahan Packages */}
                        {packages.filter(p => p.category === 'Tambahan' && p.sessionYear === activeSessionYear).map((p) => {
                          const paidSoFar = selectedMemberDoc ? getPaidAmountForPackage(p.id, selectedMemberDoc.email || '') : 0;
                          const originalPrice = getPackagePrice(p);
                          const remaining = Math.max(0, originalPrice - paidSoFar);
                          
                          const isPaid = memberPaidPackageIds.includes(p.id) || remaining <= 0;
                          const isSelected = selectedManualPackageIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isPaid 
                                  ? 'bg-emerald-50/40 border-emerald-100 opacity-60 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-indigo-50/70 border-indigo-200'
                                    : 'bg-white border-slate-150 hover:border-slate-300 cursor-pointer'
                              }`}
                              onClick={(e) => {
                                if (isPaid || uploadingManual || adminManualSuccess) return;
                                const target = e.target as HTMLElement;
                                if (target.tagName === 'INPUT' || target.closest('.input-container')) return;
                                handleToggleManualPackage(p.id);
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="text-[10.5px] font-extrabold text-slate-900 leading-tight">{p.name}</h4>
                                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">{p.subtitle || 'Yuran Tambahan'}</p>
                                  {paidSoFar > 0 && (
                                    <p className="text-[9px] text-emerald-600 font-bold mt-0.5">Telah dibayar: RM{paidSoFar.toFixed(2)}</p>
                                  )}
                                </div>
                                <div className="shrink-0 text-right flex items-center gap-2">
                                  <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-slate-700">
                                      RM{originalPrice.toFixed(2)}
                                    </span>
                                    {remaining > 0 && remaining !== originalPrice && (
                                      <span className="text-[9px] font-bold text-amber-600">Baki: RM{remaining.toFixed(2)}</span>
                                    )}
                                  </div>
                                  {isPaid ? (
                                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded-md uppercase">Selesai</span>
                                  ) : (
                                    <div 
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                        isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleManualPackage(p.id);
                                      }}
                                    >
                                      {isSelected && <Check size={10} className="stroke-[3]" />}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Editable input field for custom payment amount if selected and not fully paid */}
                              {isSelected && !isPaid && (
                                <div className="mt-2.5 pt-2.5 border-t border-indigo-100/50 input-container">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Amaun Bayaran</span>
                                      <span className="text-[9px] text-indigo-500 font-medium">Baki perlu bayar: RM{remaining.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-400">RM</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={remaining}
                                        value={manualTambahanAmounts[p.id] !== undefined ? manualTambahanAmounts[p.id] : remaining}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          setManualTambahanAmounts(prev => ({
                                            ...prev,
                                            [p.id]: val
                                          }));
                                        }}
                                        className="w-24 border border-slate-200 rounded-lg p-1.5 text-xs font-black text-slate-800 bg-white text-right focus:outline-hidden focus:border-indigo-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>



                    {/* Total Summary */}
                    {selectedManualPackageIds.length > 0 && (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center shrink-0">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Jumlah Tunai</span>
                          <span className="text-xs text-slate-500 font-bold">{selectedManualPackageIds.length} pakej dipilih</span>
                        </div>
                        <span className="text-lg font-black text-slate-800">RM{manualTotalAmount.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Akaun Masuk Lejar Umum (Debit Account Selection) */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <label className="text-xs font-black text-slate-800 block">Akaun Masuk di Lejar Umum (Debit) *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={uploadingManual || adminManualSuccess}
                          onClick={() => setManualDebitAccount('Tunai')}
                          className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            manualDebitAccount === 'Tunai'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <Coins size={14} />
                          <span>Tunai (Tunai Sahaja)</span>
                        </button>
                        <button
                          type="button"
                          disabled={uploadingManual || adminManualSuccess}
                          onClick={() => setManualDebitAccount('Bank')}
                          className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            manualDebitAccount === 'Bank'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <CreditCard size={14} />
                          <span>Bank (Bank Sahaja)</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. Proof of Payment Upload */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">Bukti Pembayaran (Gambar / PDF) (Pilihan)</label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        disabled={uploadingManual || adminManualSuccess}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setProofFile(file);
                            if (file.type.startsWith('image/')) {
                              setProofPreview(URL.createObjectURL(file));
                            } else {
                              setProofPreview(null);
                            }
                          }
                        }}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-dashed border-slate-200 p-2 rounded-xl"
                      />

                      {proofPreview && (
                        <div className="relative mt-2 border border-slate-100 rounded-2xl overflow-hidden max-w-xs shadow-xs mx-auto">
                          <img src={proofPreview} alt="Pratonton Bukti" className="h-32 w-auto object-cover mx-auto" />
                          <button
                            type="button"
                            onClick={() => {
                              setProofFile(null);
                              setProofPreview(null);
                            }}
                            className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600 active:scale-95 transition-colors shadow-sm"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div className="pt-4 mt-2 border-t border-slate-100 shrink-0 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminManualModal(false);
                    resetManualForm();
                  }}
                  disabled={uploadingManual}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                {selectedMemberId && selectedManualPackageIds.length > 0 && !adminManualSuccess && (
                  <button
                    type="button"
                    onClick={handleSubmitManualPayment}
                    disabled={uploadingManual}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    {uploadingManual ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Merekod...</span>
                      </>
                    ) : (
                      <span>Sahkan Bayaran</span>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

