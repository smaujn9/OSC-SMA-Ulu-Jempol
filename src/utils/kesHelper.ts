import { CaseRecord } from '../types';
import { logoBase64 } from './logoBase64';

export function isAjkUser(userDoc?: any): boolean {
  if (!userDoc) return false;
  if (userDoc.isSuperAdmin) return true;
  
  const ajkRoles = [
    'Admin Utama',
    'Pengerusi',
    'Naib Pengerusi',
    'Setiausaha',
    'Penolong Setiausaha',
    'Naib Setiausaha',
    'Bendahari',
    'Penolong Bendahari',
    'Ahli Jawatankuasa',
    'Juru Audit',
    'Audit'
  ];
  
  return ajkRoles.includes(userDoc.role);
}

export function cleanSpeechTranscript(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // 1. Remove 3 or more consecutive identical words (e.g. "saya saya saya" -> "saya")
  // Keeps 2 consecutive identical words intact (e.g. "tiba tiba", "budak budak", "sama sama")
  cleaned = cleaned.replace(/\b([\w'-]+)(\s+\1){2,}\b/gi, '$1');

  // 2. Remove exact duplicate consecutive phrases of 3+ words (e.g. "pukul 10 malam pukul 10 malam")
  for (let len = 6; len >= 3; len--) {
    let pPrev = '';
    while (pPrev !== cleaned) {
      pPrev = cleaned;
      const regex = new RegExp(`\\b((?:[\\w'-]+\\s+){${len - 1}}[\\w'-]+)\\s+\\1\\b`, 'gi');
      cleaned = cleaned.replace(regex, '$1');
    }
  }

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

export function processKeteranganFormat(text: string): string {
  if (!text) return '';

  // 1. Remove markdown codeblocks
  let clean = text.replace(/^```(?:text|markdown)?\n?/gi, '').replace(/\n?```$/gi, '').trim();

  // 2. Remove all asterisks (*) completely so no words are bolded
  clean = clean.replace(/\*/g, '');

  // 3. Line by line formatting
  const lines = clean.split('\n');
  const processed = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    // Check if line is a Heading / Title (e.g. "1. Ringkasan Dan Kronologi Peristiwa")
    const isHeading = /^(\d+[\.\)]|\b(Seksyen|Bahagian|Perkara)\b\s*\d+|[A-Z0-9\s]{3,}:|\b(Ringkasan|Kronologi|Impak|Kerugian|Tindakan|Cadangan|Latar Belakang|Rumusan)\b)/i.test(trimmed) && trimmed.length < 90;

    if (isHeading) {
      // Capitalize Each Word (Title Case)
      return trimmed.replace(/\b[a-zA-Z\u00C0-\u024F]+/g, (word) => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      });
    } else {
      // Body paragraph: If it's all uppercase, convert to standard sentence case
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 10) {
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      }
      return trimmed;
    }
  });

  return processed.join('\n');
}

export const JENIS_KES_OPTIONS = [
  'Pencerobohan / Pecah Rumah',
  'Kecurian / Samun',
  'Mengintai / Gangguan Skodeng / Stalking',
  'Vandalisme / Kerosakan Harta Benda Awam & Persatuan',
  'Gangguan Ketenteraman / Bunyi Bising Melampau',
  'Sisa Pepejal / Pembuangan Sampah Haram',
  'Haiwan Liar / Peliharaan Berbahaya / Mengganggu',
  'Kemalangan / Keselamatan Jalan Raya Dalam Taman',
  'Pertikaian / Perbalahan Fizikal Antara Jiran',
  'Pencemaran Bau / Sisa Toksik / Longkang Tersumbat',
  'Syak Aktiviti Jenayah / Dadah / Ancam Keselamatan',
  'Kebakaran / Bencana Alam / Kecemasan Bangunan',
  'Lain-lain Kes Serius'
];

export async function compressAndConvertToBase64(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function printCaseReportPdf(caseRecord: CaseRecord) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Sila benarkan pop-up window di pelayar anda untuk mencetak Laporan Kes.');
    return;
  }

  const hasGambarBukti = Boolean(caseRecord.buktiGambarUrl);
  const hasKeteranganSiasatan = Boolean(caseRecord.keteranganSiasatan);
  const hasSelesaiSection = Boolean(caseRecord.keteranganSelesai || caseRecord.buktiSelesaiUrl);
  const hasPage2Content = hasGambarBukti || hasKeteranganSiasatan || hasSelesaiSection;

  const html = `
    <!DOCTYPE html>
    <html lang="ms">
    <head>
      <meta charset="UTF-8">
      <title>Laporan Kes Keselamatan - ${caseRecord.caseNo}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background-color: #ffffff !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
          .report-page {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
        .page-break-before {
          page-break-before: always;
          break-before: page;
        }
        .page-break-inside-avoid {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        body { font-family: 'Arial', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-100 p-4 sm:p-6 text-slate-800">
      <div class="no-print mb-4 max-w-4xl mx-auto flex justify-between items-center bg-white p-3 rounded-xl shadow-md border border-slate-200">
        <div>
          <h2 class="font-bold text-slate-800 text-xs">Dokumen Laporan Aduan / Kes Disiplin & Kebajikan SMAUJ (Format A4 Portrait)</h2>
          <p class="text-[10px] text-slate-500">No. Rujukan: ${caseRecord.caseNo}${hasPage2Content ? ' • (Laporan & Lampiran 2 Muka Surat)' : ' • (Laporan Ringkas 1 Muka Surat)'}</p>
        </div>
        <button onclick="window.print()" class="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-2">
          🖨️ Cetak / Muat Turun PDF (A4)
        </button>
      </div>

      <div class="report-page max-w-4xl mx-auto bg-white border border-slate-300 p-6 sm:p-8 shadow-lg rounded-sm text-xs leading-normal">
        
        <!-- ================= PAGE 1: MUKA SURAT UTAMA ================= -->
        <div class="page-1-container flex flex-col justify-between">
          <div>
            <!-- Header Letterhead -->
            <div class="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
              <div class="flex items-center gap-3">
                <img src="${logoBase64}" alt="Logo Sekolah" class="w-12 h-12 object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
                <div>
                  <h1 class="font-black text-xs uppercase tracking-wide text-slate-900">SEKOLAH MENENGAH AGAMA ULU JEMPOL</h1>
                  <p class="text-[9px] text-slate-600 font-medium">Kod Sekolah: NFT6001 | Portal Pengurusan Sekolah & PIBG</p>
                  <p class="text-[9px] text-slate-500">Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan Darul Khusus</p>
                </div>
              </div>
              <div class="text-right">
                <span class="inline-block px-2 py-0.5 bg-slate-900 text-white font-black text-[9px] rounded uppercase tracking-wider mb-0.5">
                  DOKUMEN RASMI SEKOLAH
                </span>
                <p class="font-mono text-slate-800 font-bold text-xs">No. Kes: ${caseRecord.caseNo}</p>
                <p class="text-[9px] text-slate-500">Tarikh Daftar: ${new Date(caseRecord.createdAt).toLocaleDateString('ms-MY')}</p>
              </div>
            </div>

            <!-- Title -->
            <div class="text-center my-3">
              <h2 class="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 inline-block pb-0.5">
                LAPORAN REKOD KES KOMUNITI & KESELAMATAN
              </h2>
              <p class="text-[9px] text-slate-500 font-medium mt-0.5">
                Borang Catatan Rasmi Ahli Jawatankuasa Untuk Rekod Simpanan Persatuan & Rujukan Pihak Berkuasa
              </p>
            </div>

            <!-- Table Grid Details -->
            <div class="grid grid-cols-2 gap-2 mb-3 bg-slate-50 p-3 border border-slate-200 rounded-lg text-[10px]">
              <div>
                <span class="font-bold text-slate-400 uppercase block text-[9px]">Pengadu (AJK Persatuan)</span>
                <p class="font-extrabold text-slate-800 text-[11px]">${caseRecord.pengaduName}</p>
                <span class="inline-block px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[8px] font-bold rounded mt-0.5">${caseRecord.pengaduRole}</span>
              </div>
              <div>
                <span class="font-bold text-slate-400 uppercase block text-[9px]">Penerima Kes / Pihak Terlibat</span>
                <p class="font-extrabold text-slate-800 text-[11px]">${caseRecord.penerimaName || 'Tidak dinyatakan'}</p>
                <p class="text-slate-600 font-semibold text-[9px]">No. Rumah: ${caseRecord.penerimaHouseNo || '-'}</p>
              </div>
              <div>
                <span class="font-bold text-slate-400 uppercase block text-[9px]">Tarikh & Masa Kejadian</span>
                <p class="font-bold text-slate-800">${caseRecord.tarikhKes} (Masa: ${caseRecord.masaKes})</p>
              </div>
              <div>
                <span class="font-bold text-slate-400 uppercase block text-[9px]">Jenis Kes</span>
                <p class="font-extrabold text-rose-700">${caseRecord.jenisKes}</p>
              </div>
              <div class="col-span-2 border-t border-slate-200 pt-1.5">
                <span class="font-bold text-slate-400 uppercase block text-[9px]">Laporan Polis (PDRM)</span>
                <p class="font-bold text-slate-800">
                  ${caseRecord.isPoliceReport ? `YA - Dilaporkan di: ${caseRecord.balaiPolis || 'Balai Polis'}${caseRecord.noRepotPolis ? ` (No. Repot: ${caseRecord.noRepotPolis})` : ''}` : 'TIDAK / Dalam Tindakan Dalaman Persatuan'}
                </p>
              </div>
            </div>

            <!-- Keterangan Kes & Kronologi -->
            <div class="mb-3">
              <h3 class="font-black text-[10px] uppercase text-slate-800 tracking-wider mb-1 border-b border-slate-200 pb-0.5">
                Keterangan & Kronologi Kes
              </h3>
              <div class="p-3 bg-white border border-slate-200 rounded-lg whitespace-pre-wrap leading-snug text-slate-700 text-[10px] font-normal min-h-[60px]">
                ${caseRecord.keterangan}
              </div>
            </div>

            <!-- Perakuan & Legal Statement -->
            <div class="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-[9px] text-amber-900 leading-tight mb-3">
              <p class="font-bold mb-0.5">PERAKUAN PENGESAHAN MAKLUMAT:</p>
              <p>
                Semua maklumat dan keterangan yang dicatatkan di dalam laporan ini adalah benar. Sebarang penyataan palsu adalah tertakluk kepada tindakan di bawah <strong>Seksyen 182 Kanun Keseksaan (Akta 574)</strong> dan <strong>Seksyen 233 Akta Komunikasi dan Multimedia 1998 (Akta 588)</strong>.
              </p>
            </div>
          </div>

          <div>
            <!-- Signatures Row -->
            <div class="grid grid-cols-2 gap-6 border-t border-slate-300 pt-3 mt-2">
              <div class="text-center">
                <p class="text-[9px] font-bold text-slate-500 uppercase mb-1">Tandatangan Pengadu (AJK)</p>
                <div class="h-16 border border-dashed border-slate-300 rounded flex items-center justify-center p-1 mb-1 bg-slate-50">
                  ${caseRecord.pengaduSignatureUrl ? `<img src="${caseRecord.pengaduSignatureUrl}" alt="Tandatangan Pengadu" class="max-h-14 object-contain" />` : '<span class="text-slate-400 italic text-[9px]">Tiada Tandatangan</span>'}
                </div>
                <p class="font-bold text-slate-900 text-[10px] border-b border-slate-300 inline-block px-3 pb-0.5">${caseRecord.pengaduName}</p>
                <p class="text-[9px] text-slate-500 font-medium">${caseRecord.pengaduRole}</p>
              </div>

              <div class="text-center">
                <p class="text-[9px] font-bold text-slate-500 uppercase mb-1">Tandatangan Penerima Kes / Pihak Terlibat</p>
                <div class="h-16 border border-dashed border-slate-300 rounded flex items-center justify-center p-1 mb-1 bg-slate-50">
                  ${caseRecord.penerimaSignatureUrl ? `<img src="${caseRecord.penerimaSignatureUrl}" alt="Tandatangan Penerima" class="max-h-14 object-contain" />` : '<span class="text-slate-400 italic text-[9px]">Tiada Tandatangan</span>'}
                </div>
                <p class="font-bold text-slate-900 text-[10px] border-b border-slate-300 inline-block px-3 pb-0.5">${caseRecord.penerimaName || 'Saksi / Penerima'}</p>
                <p class="text-[9px] text-slate-500 font-medium">No. Rumah: ${caseRecord.penerimaHouseNo || '-'}</p>
              </div>
            </div>

            <div class="mt-4 text-center text-[8px] text-slate-400 border-t border-slate-100 pt-2">
              Dokumen ini dijana secara digital oleh Portal Rasmi Sekolah Menengah Agama Ulu Jempol (SMAUJ) • Cetakan Rasmi
            </div>
          </div>
        </div>

        <!-- ================= PAGE 2: GAMBAR BUKTI & SIASATAN (JIKA ADA) ================= -->
        ${hasPage2Content ? `
          <div class="page-break-before pt-4 mt-6">
            <div class="flex border-b border-slate-200 pb-2 mb-4 justify-between items-center text-[9px] text-slate-500 font-bold">
              <span>SEKOLAH MENENGAH AGAMA ULU JEMPOL — LAMPIRAN BUKTI & PERKEMBANGAN KES (MUKA SURAT 2)</span>
              <span>No. Kes: ${caseRecord.caseNo}</span>
            </div>

            ${hasGambarBukti ? `
              <div class="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span class="text-[10px] font-bold text-slate-600 uppercase block mb-1.5">Gambar Bukti / Kejadian Rasmi:</span>
                <img src="${caseRecord.buktiGambarUrl}" alt="Bukti Gambar Kes" class="max-h-72 rounded border border-slate-300 object-contain mx-auto" />
              </div>
            ` : ''}

            ${hasKeteranganSiasatan ? `
              <div class="mb-4">
                <h3 class="font-black text-xs uppercase text-amber-800 tracking-wider mb-1.5 border-b border-amber-200 pb-1 flex items-center justify-between">
                  <span>Keterangan Semasa Siasatan AJK</span>
                  <span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[8px] font-bold rounded">STATUS: DALAM SIASATAN</span>
                </h3>
                <div class="p-3 bg-amber-50/50 border border-amber-200 rounded-lg whitespace-pre-wrap leading-relaxed text-slate-800 text-[10px] font-normal">
                  ${caseRecord.keteranganSiasatan}
                </div>
              </div>
            ` : ''}

            ${hasSelesaiSection ? `
              <div class="mb-4">
                <h3 class="font-black text-xs uppercase text-emerald-800 tracking-wider mb-1.5 border-b border-emerald-200 pb-1 flex items-center justify-between">
                  <span>Keterangan & Bukti Selepas Selesai Siasatan</span>
                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-bold rounded">STATUS: SELESAI</span>
                </h3>
                ${caseRecord.keteranganSelesai ? `
                  <div class="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg whitespace-pre-wrap leading-relaxed text-slate-800 text-[10px] font-normal mb-3">
                    ${caseRecord.keteranganSelesai}
                  </div>
                ` : ''}
                ${caseRecord.buktiSelesaiUrl ? `
                  <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span class="text-[10px] font-bold text-slate-600 uppercase block mb-1.5">Gambar / Bukti Penyelesaian Kes:</span>
                    <img src="${caseRecord.buktiSelesaiUrl}" alt="Bukti Penyelesaian" class="max-h-72 rounded border border-slate-300 object-contain mx-auto" />
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        ` : ''}

      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
