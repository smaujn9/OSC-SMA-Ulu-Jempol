import { QurbanRegistration } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export interface QurbanConfig {
  bhgLembuPrice: number;
  ekorLembuPrice: number;
  ekorKambingPrice: number;
  limitBhgLembu: number;
  limitEkorLembu: number;
  limitEkorKambing: number;
  managementFeeType?: 'percent' | 'fixed';
  managementFeePercent: number;
  managementFeeFixed?: number;
  ansuranMonthsOptions: number[];
  registrationLimit?: number;
  sessionYearOverride?: string;
  bannerVisibility?: 'all' | 'registered' | 'hide';
  catatanBorang?: string;
  adminSignatureUrl?: string;
}

export const DEFAULT_QURBAN_CONFIG: QurbanConfig = {
  bhgLembuPrice: 900,
  ekorLembuPrice: 6300,
  ekorKambingPrice: 1200,
  limitBhgLembu: 35,
  limitEkorLembu: 5,
  limitEkorKambing: 20,
  managementFeeType: 'percent',
  managementFeePercent: 5,
  managementFeeFixed: 45,
  ansuranMonthsOptions: [3, 5, 10],
  registrationLimit: 50,
  bannerVisibility: 'hide',
  catatanBorang: 'Sila pastikan maklumat peserta & akad adalah betul. Pendaftaran tertakluk kepada pengesahan urusetia.',
  adminSignatureUrl: ''
};

/**
 * Calculates management fee based on percentage or direct fixed RM value
 */
export function calculateQurbanFee(pakejPrice: number, config?: Partial<QurbanConfig>) {
  const feeType = config?.managementFeeType || 'percent';
  if (feeType === 'fixed') {
    const feeAmount = Number(config?.managementFeeFixed !== undefined ? config.managementFeeFixed : 45);
    return {
      feeType: 'fixed' as const,
      feeAmount,
      feePercent: 0,
      feeLabel: `RM ${feeAmount.toFixed(2)}`,
      displayNote: `+ RM ${feeAmount.toFixed(2)} caj pengurusan`,
      totalAmount: pakejPrice + feeAmount
    };
  } else {
    const feePercent = Number(config?.managementFeePercent !== undefined ? config.managementFeePercent : 5);
    const feeAmount = Math.round((pakejPrice * feePercent) / 100);
    return {
      feeType: 'percent' as const,
      feeAmount,
      feePercent,
      feeLabel: `${feePercent}%`,
      displayNote: `+ ${feePercent}% caj pengurusan`,
      totalAmount: pakejPrice + feeAmount
    };
  }
}

/**
 * Auto-detects the next Hijri session for Qurban & Aqiqah
 * e.g., if current date is after Aidiladha of the current year, returns next Hijri session (e.g. 1448H / 2027M)
 */
export function getAutoHijriQurbanSession(override?: string): { hijriYear: string; masihiYear: string; fullLabel: string } {
  if (override && override.trim()) {
    const parts = override.split('/');
    return {
      hijriYear: parts[0]?.trim() || override,
      masihiYear: parts[1]?.trim() || '',
      fullLabel: override
    };
  }

  const today = new Date();
  const year = today.getFullYear();
  
  // Aidiladha 1447H is approximately June 6, 2026.
  // If current date > June 10 2026, 1447H has concluded -> auto-detect next Hijri session 1448H / 2027M
  let hijri = 1447 + (year - 2026);
  let masihi = year;

  const aidiladhaCurrentYear = new Date(`${year}-06-10`);
  if (today > aidiladhaCurrentYear) {
    hijri += 1;
    masihi += 1;
  }

  const fullLabel = `${hijri}H / ${masihi}M`;
  return {
    hijriYear: `${hijri}H`,
    masihiYear: `${masihi}M`,
    fullLabel
  };
}

/**
 * Auto-cancellation check for registrations pending payment > 24 hours (FPX / Tunai)
 */
export async function checkAndCancelExpiredQurbanRegistrations(registrations: QurbanRegistration[]) {
  if (!db || !registrations || registrations.length === 0) return;
  
  const now = Date.now();
  for (const reg of registrations) {
    // Only check active registrations that are not already cancelled or fully confirmed/paid or under review
    if (
      reg.statusPendaftaran === 'Batal' || 
      reg.statusPendaftaran === 'DITAMATKAN' || 
      reg.statusPendaftaran === 'Disahkan' || 
      reg.statusPendaftaran === 'DISEMAK' ||
      (reg.monthsPaid != null && reg.monthsPaid > 0) || 
      reg.paymentStatus === 'Selesai' ||
      reg.paymentStatus === 'Deposit Dibayar' ||
      reg.paymentStatus === 'Dalam Semakan'
    ) {
      continue;
    }

    const createdTime = new Date(reg.createdAt).getTime();
    const elapsedTimeHours = (now - createdTime) / (1000 * 60 * 60);

    // If more than 24 hours passed and deposit is still unpaid
    if (elapsedTimeHours >= 24) {
      try {
        await updateDoc(doc(db, 'qurbanRegistrations', reg.id), {
          statusPendaftaran: 'Batal',
          paymentStatus: 'Terbatal',
          pembatalanReason: 'Pembatalan automatik: Tempoh bayaran deposit 24 jam telah tamat.',
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn(`Ralat auto-batal qurban registration ${reg.id}:`, e);
      }
    }
  }
}

/**
 * Print / Download A4 Portrait PDF Form for Qurban & Aqiqah Registration
 * Fits compactly onto exactly 1 A4 page
 */
export function printQurbanRegistrationPdf(reg: QurbanRegistration, config?: QurbanConfig) {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) return;

  const createdDateStr = reg.createdAt 
    ? new Date(reg.createdAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  const catatanText = config?.catatanBorang || DEFAULT_QURBAN_CONFIG.catatanBorang || '';
  const adminSigUrl = config?.adminSignatureUrl || '';

  const participantsHtml = Array.from({ length: 7 }).map((_, idx) => {
    const pName = reg.senaraiPeserta[idx] || '';
    return `
      <tr class="border-b border-gray-300 text-[10px]">
        <td class="py-0.5 px-2 font-bold text-center w-6 border-r border-gray-300">${idx + 1}.</td>
        <td class="py-0.5 px-2 ${pName ? 'font-extrabold text-gray-900' : 'text-gray-400 italic'}">${pName || '_______________________________________________________'}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="utf-8"/>
  <title>Borang Pendaftaran Qurban & Aqiqah - ${reg.namaPenuh}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 portrait;
      margin: 5mm 8mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .page-canvas {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body class="p-4">

  <!-- Action Bar -->
  <div class="no-print max-w-2xl mx-auto mb-3 flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
    <div class="text-xs font-bold text-gray-700">Pratinjau Borang Pendaftaran A4 Portrait</div>
    <button onclick="window.print()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-2">
      🖨️ CETAK / MUAT TURUN PDF
    </button>
  </div>

  <!-- A4 Document Canvas -->
  <div class="page-canvas max-w-[210mm] mx-auto bg-white border border-gray-300 p-5 shadow-md text-slate-900 rounded-sm text-[11px] leading-tight">
    
    <!-- HEADER -->
    <div class="text-center border-b-2 border-emerald-800 pb-2 mb-2">
      <div class="flex items-center justify-center gap-3">
        <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo" class="w-10 h-10 object-cover rounded-full" />
        <div>
          <h1 class="text-[11px] font-black tracking-widest text-emerald-900 uppercase">PERSATUAN TAMAN MUSYTARI FASA 2 BATU KIKIR NEGERI SEMBILAN</h1>
          <h2 class="text-sm font-black text-slate-900 tracking-tight uppercase">BORANG PENYERTAAN IBADAH QURBAN & AQIQAH ${reg.sessionYear}</h2>
          <p class="text-[9px] text-slate-500 font-semibold">Batu Kikir, Negeri Sembilan &bull; PPM-001-05-28092026 &bull; No. Rujukan: ${reg.id}</p>
        </div>
      </div>
    </div>

    ${reg.statusPendaftaran === 'DITAMATKAN' || reg.statusPendaftaran === 'DISEMAK' ? `
    <div class="mb-2 p-1.5 border rounded-md text-center ${reg.statusPendaftaran === 'DITAMATKAN' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-amber-50 border-amber-300 text-amber-800'}">
      <span class="font-extrabold uppercase text-[10px] tracking-wide">
        ⚠️ STATUS PENDAFTARAN: 
        <span class="underline font-black">${reg.statusPendaftaran === 'DITAMATKAN' ? 'DITAMATKAN / TAMAT TEMPOH' : 'DISEMAK SEKETIKA'}</span>
      </span>
    </div>
    ` : ''}

    <!-- SECTIONS 1 & 2: JENIS PENYERTAAN & PAKEJ -->
    <div class="grid grid-cols-2 gap-2 mb-2">
      <!-- Section 1 -->
      <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
        <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">1. JENIS PENYERTAAN</h3>
        <div class="grid grid-cols-2 gap-1 text-[10px] font-bold">
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" ${reg.jenisPenyertaan === 'Qurban Sunat' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
            <span>Qurban Sunat</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" ${reg.jenisPenyertaan === 'Qurban Wajib' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
            <span>Qurban Wajib</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" ${reg.jenisPenyertaan === 'Aqiqah Sunat' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
            <span>Aqiqah Sunat</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" ${reg.jenisPenyertaan === 'Aqiqah Wajib' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
            <span>Aqiqah Wajib</span>
          </label>
        </div>
      </div>

      <!-- Section 2 -->
      <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
        <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">2. JENIS PAKEJ</h3>
        <div class="space-y-0.5 text-[10px] font-bold">
          <label class="flex items-center gap-1">
            <input type="checkbox" ${reg.pakejPilihan === '1 BHG LEMBU' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
            <span>1 BHG. LEMBU - RM ${reg.pakejPrice.toFixed(2)}</span>
          </label>
          <label class="flex items-center gap-1">
            <input type="checkbox" ${reg.pakejPilihan === '1 EKOR LEMBU' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
            <span>1 EKOR LEMBU - RM ${reg.pakejPrice.toFixed(2)}</span>
          </label>
          <label class="flex items-center gap-1">
            <input type="checkbox" ${reg.pakejPilihan === '1 EKOR KAMBING' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
            <span>1 EKOR KAMBING - RM ${reg.pakejPrice.toFixed(2)}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- SECTION 3: MAKLUMAT PENDAFTAR -->
    <div class="border border-slate-300 p-2 rounded-md mb-2 bg-slate-50/30">
      <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">3. MAKLUMAT PENDAFTAR</h3>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        <div><span class="font-bold text-slate-500">Nama Penuh:</span> <span class="font-extrabold text-slate-900 uppercase">${reg.namaPenuh}</span></div>
        <div><span class="font-bold text-slate-500">No. K/P:</span> <span class="font-extrabold text-slate-900">${reg.noIC}</span></div>
        <div><span class="font-bold text-slate-500">No. Telefon:</span> <span class="font-extrabold text-slate-900">${reg.noTelefon}</span></div>
        <div><span class="font-bold text-slate-500">Emel:</span> <span class="font-extrabold text-slate-900">${reg.emel || '-'}</span></div>
        <div class="col-span-2"><span class="font-bold text-slate-500">Alamat:</span> <span class="font-extrabold text-slate-900">${reg.alamat}</span></div>
      </div>
    </div>

    <!-- SECTION 4: NAMA PESERTA -->
    <div class="border border-slate-300 p-2 rounded-md mb-2">
      <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">4. NAMA PESERTA / PENAMA</h3>
      <table class="w-full border border-slate-300">
        <tbody>
          ${participantsHtml}
        </tbody>
      </table>
    </div>

    <!-- SECTION 5 & 6: PENGURUSAN DAGING & PEMBAYARAN -->
    <div class="grid grid-cols-2 gap-2 mb-2">
      <!-- Section 5 -->
      <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
        <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">5. PILIHAN PENGURUSAN DAGING</h3>
        <div class="space-y-0.5 text-[10px] font-bold">
          <label class="flex items-center gap-1">
            <input type="checkbox" ${reg.pilihanDaging === 'Mahu Ambil Daging' ? 'checked' : ''} disabled class="w-3 h-3" />
            <span>Mahu Ambil Daging</span>
          </label>
          <label class="flex items-center gap-1">
            <input type="checkbox" ${reg.pilihanDaging === 'Tidak Mahu Daging' ? 'checked' : ''} disabled class="w-3 h-3" />
            <span>Tidak Mahu Daging (Infaq Penuh)</span>
          </label>
          <label class="flex items-center gap-1">
            <input type="checkbox" ${reg.pilihanDaging === 'Simpan Daging' ? 'checked' : ''} disabled class="w-3 h-3" />
            <span>Simpan Daging (Kos RM50/sehari)</span>
          </label>
        </div>
      </div>

      <!-- Section 6 -->
      <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
        <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">6. BENTUK PEMBAYARAN</h3>
        <div class="space-y-0.5 text-[10px] font-bold">
          <div class="flex gap-3">
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.caraPembayaran === 'Tunai' ? 'checked' : ''} disabled class="w-3 h-3" />
              <span>Tunai</span>
            </label>
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.caraPembayaran === 'Online Transfer' ? 'checked' : ''} disabled class="w-3 h-3" />
              <span>Online / FPX</span>
            </label>
          </div>
          <div class="text-[10px] text-slate-700">
            Mode: <span class="font-extrabold text-emerald-800">${reg.opsiBayaran === 'Penuh' ? 'Bayar Terus (Penuh)' : `Ansuran (${reg.tempohAnsuranBulan || 3} Bulan)`}</span>
          </div>
          <div class="text-[10px] text-slate-700">
            Jumlah Keseluruhan: <span class="font-black text-slate-900">RM ${reg.totalAmount.toFixed(2)}</span>
          </div>
          <div class="text-[9px] text-slate-500">
            Tarikh Daftar: <span class="font-bold">${createdDateStr}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTIONS 7, 8, 9: LAFAZ AKAD (IJAB, PERINCIAN, QABUL) -->
    <div class="border border-emerald-300 bg-emerald-50/30 p-2 rounded-md mb-2 space-y-1 text-[10px]">
      <div>
        <h3 class="font-black text-emerald-950 uppercase text-[10px]">7. LAFAZ AKAD (IJAB)</h3>
        <p class="text-slate-800 italic leading-tight">
          "Saya dengan ini menyerahkan wang sebanyak <strong class="underline">RM ${reg.totalAmount.toFixed(2)}</strong> bagi pihak saya / penama-penama tersebut untuk ibadah Qurban / Aqiqah bagi tahun <strong class="underline">${reg.sessionYear}</strong> serta Mewakilkan (Wakalad) kepada Pihak Jawatankuasa Persatuan Taman Musytari Fasa 2 Batu Kikir Negeri Sembilan untuk menguruskan pembelian, penyembelihan dan pengagihan daging qurban/aqiqah tersebut mengikut hukum syarak."
        </p>
      </div>

      <div class="border-t border-emerald-200 pt-1">
        <h3 class="font-black text-emerald-950 uppercase text-[9px]">8. PERINCIAN LAFAZ AKAD</h3>
        <p class="text-[9px] text-slate-700 font-semibold">
          Ijab (Penyerta) &rarr; Wakalah (Persatuan/Panitia) &rarr; Pembelian & Penyembelihan &rarr; Pengagihan Daging
        </p>
      </div>

      <div class="border-t border-emerald-200 pt-1">
        <h3 class="font-black text-emerald-950 uppercase text-[9px]">9. JAWAB LAFAZ AKAD (QABUL)</h3>
        <p class="text-slate-800 italic leading-tight">
          "Kami Pihak Jawatankuasa Persatuan Taman Musytari Fasa 2 Batu Kikir Negeri Sembilan menerima wakalah dan amanah ini untuk menguruskan ibadah qurban/aqiqah Tuan/Puan mengikut syariat Islam."
        </p>
      </div>
    </div>

    <!-- SECTION 10 & 11: BAYARAN & TERMA -->
    <div class="grid grid-cols-2 gap-2 mb-2 text-[9px]">
      <div class="border border-slate-300 p-2 rounded-md">
        <h3 class="font-black text-emerald-900 uppercase mb-0.5">10. MAKLUMAT BANK</h3>
        <p class="font-bold text-slate-800">PERSATUAN TAMAN MUSYTARI FASA 2 BATU KIKIR NEGERI SEMBILAN</p>
        <p class="text-slate-600">Bank Islam / Maybank: <strong class="text-slate-900 font-extrabold">5562 1234 5678</strong></p>
        <p class="text-slate-500 italic mt-0.5">*Caj pengurusan (${reg.managementFeeType === 'fixed' || (reg.managementFeeAmount && !reg.managementFeePercent) ? `RM ${(reg.managementFeeAmount || 0).toFixed(2)}` : `${reg.managementFeePercent ?? config?.managementFeePercent ?? 5}%`}) termasuk untuk pengurusan & pengagihan.</p>
      </div>

      <div class="border border-slate-300 p-2 rounded-md">
        <h3 class="font-black text-emerald-900 uppercase mb-0.5">11. TERMA & SYARAT</h3>
        <ol class="list-decimal list-inside space-y-0.5 text-slate-700">
          <li>Pendaftaran tertakluk kepada kuota yang ditetapkan.</li>
          <li>Bayaran deposit / tunai mesti dilunaskan dalam tempoh 24 jam.</li>
          <li>Sekiranya deposit gagal dilunaskan dalam 24 jam, pendaftaran terbatal automatik.</li>
        </ol>
      </div>
    </div>

    <!-- CATATAN URUSETIA / SYARAT KHAS -->
    ${catatanText ? `
    <div class="border border-amber-300 bg-amber-50/50 p-2 rounded-md mb-2 text-[10px]">
      <h3 class="font-black text-amber-900 uppercase mb-0.5">CATATAN URUSETIA / SYARAT KHAS:</h3>
      <p class="text-slate-800 font-medium whitespace-pre-line">${catatanText}</p>
    </div>
    ` : ''}

    <!-- SIGNATURES -->
    <div class="grid grid-cols-2 gap-4 pt-2 border-t border-slate-300 text-[10px]">
      <div class="text-center">
        <div class="h-10 border-b border-slate-400 mb-1 flex items-center justify-center">
          ${(reg as any).signatureUrl ? `<img src="${(reg as any).signatureUrl}" class="max-h-10 object-contain" alt="Tandatangan Pendaftar" />` : ''}
        </div>
        <p class="font-extrabold text-slate-900 uppercase">${reg.namaPenuh}</p>
        <p class="text-[9px] text-slate-500">Tandatangan Pendaftar (Tarikh: ${createdDateStr})</p>
      </div>

      <div class="text-center">
        <div class="h-10 border-b border-slate-400 mb-1 flex items-center justify-center text-[9px] text-slate-400 italic">
          ${adminSigUrl ? `<img src="${adminSigUrl}" class="max-h-10 object-contain" alt="Cop/Tandatangan Urusetia" />` : '[ Cop / Tandatangan Urusetia ]'}
        </div>
        <p class="font-extrabold text-slate-900 uppercase">Pihak Urusetia PTMF2</p>
        <p class="text-[9px] text-slate-500">Tandatangan & Cop Urusetia</p>
      </div>
    </div>

  </div>
</body>
</html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Print / Download Batch A4 Portrait PDF Forms for multiple Qurban & Aqiqah Registrations
 */
export function printAllQurbanRegistrationsPdf(registrations: QurbanRegistration[], config?: QurbanConfig) {
  if (!registrations || registrations.length === 0) {
    alert("Tiada pendaftaran untuk dicetak.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=850,height=1000');
  if (!printWindow) return;

  const catatanText = config?.catatanBorang || DEFAULT_QURBAN_CONFIG.catatanBorang || '';
  const adminSigUrl = config?.adminSignatureUrl || '';

  const formsHtml = registrations.map((reg, index) => {
    const createdDateStr = reg.createdAt 
      ? new Date(reg.createdAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });

    const participantsHtml = Array.from({ length: 7 }).map((_, idx) => {
      const pName = reg.senaraiPeserta[idx] || '';
      return `
        <tr class="border-b border-gray-300 text-[10px]">
          <td class="py-0.5 px-2 font-bold text-center w-6 border-r border-gray-300">${idx + 1}.</td>
          <td class="py-0.5 px-2 ${pName ? 'font-extrabold text-gray-900' : 'text-gray-400 italic'}">${pName || '_______________________________________________________'}</td>
        </tr>
      `;
    }).join('');

    return `
    <div class="page-canvas max-w-[210mm] mx-auto bg-white border border-gray-300 p-5 shadow-md text-slate-900 rounded-sm text-[11px] leading-tight ${index < registrations.length - 1 ? 'mb-8' : ''}">
      
      <!-- HEADER -->
      <div class="text-center border-b-2 border-emerald-800 pb-2 mb-2">
        <div class="flex items-center justify-center gap-3">
          <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0663661842.firebasestorage.app/o/20260702_222139_0000%20(1).png?alt=media&token=608e3ede-5bc4-4f53-b850-e44f82422085" alt="Logo" class="w-10 h-10 object-cover rounded-full" />
          <div>
            <h1 class="text-[11px] font-black tracking-widest text-emerald-900 uppercase">SEKOLAH MENENGAH AGAMA ULU JEMPOL</h1>
            <h2 class="text-sm font-black text-slate-900 tracking-tight uppercase">BORANG PENYERTAAN IBADAH QURBAN & AQIQAH ${reg.sessionYear}</h2>
            <p class="text-[9px] text-slate-500 font-semibold">Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan &bull; No. Rujukan: ${reg.id}</p>
          </div>
        </div>
      </div>

      ${reg.statusPendaftaran === 'DITAMATKAN' || reg.statusPendaftaran === 'DISEMAK' ? `
      <div class="mb-2 p-1.5 border rounded-md text-center ${reg.statusPendaftaran === 'DITAMATKAN' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-amber-50 border-amber-300 text-amber-800'}">
        <span class="font-extrabold uppercase text-[10px] tracking-wide">
          ⚠️ STATUS PENDAFTARAN: 
          <span class="underline font-black">${reg.statusPendaftaran === 'DITAMATKAN' ? 'DITAMATKAN / TAMAT TEMPOH' : 'DISEMAK SEKETIKA'}</span>
        </span>
      </div>
      ` : ''}

      <!-- SECTIONS 1 & 2: JENIS PENYERTAAN & PAKEJ -->
      <div class="grid grid-cols-2 gap-2 mb-2">
        <!-- Section 1 -->
        <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
          <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">1. JENIS PENYERTAAN</h3>
          <div class="grid grid-cols-2 gap-1 text-[10px] font-bold">
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" ${reg.jenisPenyertaan === 'Qurban Sunat' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
              <span>Qurban Sunat</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" ${reg.jenisPenyertaan === 'Qurban Wajib' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
              <span>Qurban Wajib</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" ${reg.jenisPenyertaan === 'Aqiqah Sunat' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
              <span>Aqiqah Sunat</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" ${reg.jenisPenyertaan === 'Aqiqah Wajib' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
              <span>Aqiqah Wajib</span>
            </label>
          </div>
        </div>

        <!-- Section 2 -->
        <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
          <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">2. JENIS PAKEJ</h3>
          <div class="space-y-0.5 text-[10px] font-bold">
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.pakejPilihan === '1 BHG LEMBU' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
              <span>1 BHG. LEMBU - RM ${reg.pakejPrice.toFixed(2)}</span>
            </label>
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.pakejPilihan === '1 EKOR LEMBU' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
              <span>1 EKOR LEMBU - RM ${reg.pakejPrice.toFixed(2)}</span>
            </label>
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.pakejPilihan === '1 EKOR KAMBING' ? 'checked' : ''} disabled class="w-3 h-3 text-emerald-600 rounded" />
              <span>1 EKOR KAMBING - RM ${reg.pakejPrice.toFixed(2)}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- SECTION 3: MAKLUMAT PENDAFTAR -->
      <div class="border border-slate-300 p-2 rounded-md mb-2 bg-slate-50/30">
        <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">3. MAKLUMAT PENDAFTAR</h3>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          <div><span class="font-bold text-slate-500">Nama Penuh:</span> <span class="font-extrabold text-slate-900 uppercase">${reg.namaPenuh}</span></div>
          <div><span class="font-bold text-slate-500">No. K/P:</span> <span class="font-extrabold text-slate-900">${reg.noIC}</span></div>
          <div><span class="font-bold text-slate-500">No. Telefon:</span> <span class="font-extrabold text-slate-900">${reg.noTelefon}</span></div>
          <div><span class="font-bold text-slate-500">Emel:</span> <span class="font-extrabold text-slate-900">${reg.emel || '-'}</span></div>
          <div class="col-span-2"><span class="font-bold text-slate-500">Alamat:</span> <span class="font-extrabold text-slate-900">${reg.alamat}</span></div>
        </div>
      </div>

      <!-- SECTION 4: NAMA PESERTA -->
      <div class="border border-slate-300 p-2 rounded-md mb-2">
        <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">4. NAMA PESERTA / PENAMA</h3>
        <table class="w-full border border-slate-300">
          <tbody>
            ${participantsHtml}
          </tbody>
        </table>
      </div>

      <!-- SECTION 5 & 6: PENGURUSAN DAGING & PEMBAYARAN -->
      <div class="grid grid-cols-2 gap-2 mb-2">
        <!-- Section 5 -->
        <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
          <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">5. PILIHAN PENGURUSAN DAGING</h3>
          <div class="space-y-0.5 text-[10px] font-bold">
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.pilihanDaging === 'Mahu Ambil Daging' ? 'checked' : ''} disabled class="w-3 h-3" />
              <span>Mahu Ambil Daging</span>
            </label>
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.pilihanDaging === 'Tidak Mahu Daging' ? 'checked' : ''} disabled class="w-3 h-3" />
              <span>Tidak Mahu Daging (Infaq Penuh)</span>
            </label>
            <label class="flex items-center gap-1">
              <input type="checkbox" ${reg.pilihanDaging === 'Simpan Daging' ? 'checked' : ''} disabled class="w-3 h-3" />
              <span>Simpan Daging (Kos RM50/sehari)</span>
            </label>
          </div>
        </div>

        <!-- Section 6 -->
        <div class="border border-slate-300 p-2 rounded-md bg-slate-50/50">
          <h3 class="text-[10px] font-black text-emerald-900 uppercase border-b border-slate-200 pb-0.5 mb-1">6. BENTUK PEMBAYARAN</h3>
          <div class="space-y-0.5 text-[10px] font-bold">
            <div class="flex gap-3">
              <label class="flex items-center gap-1">
                <input type="checkbox" ${reg.caraPembayaran === 'Tunai' ? 'checked' : ''} disabled class="w-3 h-3" />
                <span>Tunai</span>
              </label>
              <label class="flex items-center gap-1">
                <input type="checkbox" ${reg.caraPembayaran === 'Online Transfer' ? 'checked' : ''} disabled class="w-3 h-3" />
                <span>Online / FPX</span>
              </label>
            </div>
            <div class="text-[10px] text-slate-700">
              Mode: <span class="font-extrabold text-emerald-800">${reg.opsiBayaran === 'Penuh' ? 'Bayar Terus (Penuh)' : `Ansuran (${reg.tempohAnsuranBulan || 3} Bulan)`}</span>
            </div>
            <div class="text-[10px] text-slate-700">
              Jumlah Keseluruhan: <span class="font-black text-slate-900">RM ${reg.totalAmount.toFixed(2)}</span>
            </div>
            <div class="text-[9px] text-slate-500">
              Tarikh Daftar: <span class="font-bold">${createdDateStr}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTIONS 7, 8, 9: LAFAZ AKAD (IJAB, PERINCIAN, QABUL) -->
      <div class="border border-emerald-300 bg-emerald-50/30 p-2 rounded-md mb-2 space-y-1 text-[10px]">
        <div>
          <h3 class="font-black text-emerald-950 uppercase text-[10px]">7. LAFAZ AKAD (IJAB)</h3>
          <p class="text-slate-800 italic leading-tight">
            "Saya dengan ini menyerahkan wang sebanyak <strong class="underline">RM ${reg.totalAmount.toFixed(2)}</strong> bagi pihak saya / penama-penama tersebut untuk ibadah Qurban / Aqiqah bagi tahun <strong class="underline">${reg.sessionYear}</strong> serta Mewakilkan (Wakalad) kepada Pihak Jawatankuasa Sekolah Menengah Agama Ulu Jempol untuk menguruskan pembelian, penyembelihan dan pengagihan daging qurban/aqiqah tersebut mengikut hukum syarak."
          </p>
        </div>

        <div class="border-t border-emerald-200 pt-1">
          <h3 class="font-black text-emerald-950 uppercase text-[9px]">8. PERINCIAN LAFAZ AKAD</h3>
          <p class="text-[9px] text-slate-700 font-semibold">
            Ijab (Penyerta) &rarr; Wakalah (Persatuan/Panitia) &rarr; Pembelian & Penyembelihan &rarr; Pengagihan Daging
          </p>
        </div>

        <div class="border-t border-emerald-200 pt-1">
          <h3 class="font-black text-emerald-950 uppercase text-[9px]">9. JAWAB LAFAZ AKAD (QABUL)</h3>
          <p class="text-slate-800 italic leading-tight">
            "Kami Pihak Jawatankuasa Sekolah Menengah Agama Ulu Jempol menerima wakalah dan amanah ini untuk menguruskan ibadah qurban/aqiqah Tuan/Puan mengikut syariat Islam."
          </p>
        </div>
      </div>

      <!-- SECTION 10 & 11: BAYARAN & TERMA -->
      <div class="grid grid-cols-2 gap-2 mb-2 text-[9px]">
        <div class="border border-slate-300 p-2 rounded-md">
          <h3 class="font-black text-emerald-900 uppercase mb-0.5">10. MAKLUMAT BANK</h3>
          <p class="font-bold text-slate-800">SEKOLAH MENENGAH AGAMA ULU JEMPOL / PIBG</p>
          <p class="text-slate-600">Bank Islam / Maybank: <strong class="text-slate-900 font-extrabold">5562 1234 5678</strong></p>
          <p class="text-slate-500 italic mt-0.5">*Caj pengurusan (${reg.managementFeeType === 'fixed' || (reg.managementFeeAmount && !reg.managementFeePercent) ? `RM ${(reg.managementFeeAmount || 0).toFixed(2)}` : `${reg.managementFeePercent ?? config?.managementFeePercent ?? 5}%`}) termasuk untuk pengurusan & pengagihan.</p>
        </div>

        <div class="border border-slate-300 p-2 rounded-md">
          <h3 class="font-black text-emerald-900 uppercase mb-0.5">11. TERMA & SYARAT</h3>
          <ol class="list-decimal list-inside space-y-0.5 text-slate-700">
            <li>Pendaftaran tertakluk kepada kuota yang ditetapkan.</li>
            <li>Bayaran deposit / tunai mesti dilunaskan dalam tempoh 24 jam.</li>
            <li>Sekiranya deposit gagal dilunaskan dalam 24 jam, pendaftaran terbatal automatik.</li>
          </ol>
        </div>
      </div>

      <!-- CATATAN URUSETIA / SYARAT KHAS -->
      ${catatanText ? `
      <div class="border border-amber-300 bg-amber-50/50 p-2 rounded-md mb-2 text-[10px]">
        <h3 class="font-black text-amber-900 uppercase mb-0.5">CATATAN URUSETIA / SYARAT KHAS:</h3>
        <p class="text-slate-800 font-medium whitespace-pre-line">${catatanText}</p>
      </div>
      ` : ''}

      <!-- SIGNATURES -->
      <div class="grid grid-cols-2 gap-4 pt-2 border-t border-slate-300 text-[10px]">
        <div class="text-center">
          <div class="h-10 border-b border-slate-400 mb-1 flex items-center justify-center">
            ${(reg as any).signatureUrl ? `<img src="${(reg as any).signatureUrl}" class="max-h-10 object-contain" alt="Tandatangan Pendaftar" />` : ''}
          </div>
          <p class="font-extrabold text-slate-900 uppercase">${reg.namaPenuh}</p>
          <p class="text-[9px] text-slate-500">Tandatangan Pendaftar (Tarikh: ${createdDateStr})</p>
        </div>

        <div class="text-center">
          <div class="h-10 border-b border-slate-400 mb-1 flex items-center justify-center text-[9px] text-slate-400 italic">
            ${adminSigUrl ? `<img src="${adminSigUrl}" class="max-h-10 object-contain" alt="Cop/Tandatangan Urusetia" />` : '[ Cop / Tandatangan Urusetia ]'}
          </div>
          <p class="font-extrabold text-slate-900 uppercase">Pihak Urusetia SMAUJ</p>
          <p class="text-[9px] text-slate-500">Tandatangan & Cop Urusetia</p>
        </div>
      </div>

    </div>
    `;
  }).join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="utf-8"/>
  <title>Cetak Semakan Borang Pendaftaran Qurban & Aqiqah (${registrations.length} Borang)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 portrait;
      margin: 5mm 8mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .page-canvas {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        page-break-after: always;
        break-after: page;
        margin-bottom: 0 !important;
      }
    }
  </style>
</head>
<body class="p-4">

  <!-- Action Bar -->
  <div class="no-print max-w-2xl mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
    <div class="text-xs font-bold text-gray-700">Jumlah Borang Cetakan Kelompok: <span class="text-emerald-700 font-extrabold">${registrations.length} Borang A4</span></div>
    <button onclick="window.print()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-2">
      🖨️ CETAK SEMUA BORANG (${registrations.length})
    </button>
  </div>

  ${formsHtml}

</body>
</html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

