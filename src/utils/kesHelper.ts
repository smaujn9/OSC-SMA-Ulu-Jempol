import { CaseRecord } from '../types';
import { logoBase64 } from './logoBase64';

export function isDisiplinAuthorized(userDoc?: any): boolean {
  if (!userDoc) return false;
  if (userDoc.isSuperAdmin) return true;
  const role = (userDoc.role || '').toString().trim().toUpperCase();
  return role === 'ADMIN UTAMA' || role === 'GURU';
}

export function isAjkUser(userDoc?: any): boolean {
  return isDisiplinAuthorized(userDoc);
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
    const isHeading = /^(\d+[\.\)]|\b(Seksyen|Bahagian|Perkara)\b\s*\d+|[A-Z0-9\s]{3,}:|\b(Ringkasan|Kronologi|Impak|Kerugian|Tindakan|Cadangan|Latar Belakang|Rumusan|What|Who|When|Where|Why|How)\b)/i.test(trimmed) && trimmed.length < 90;

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

// 5W 1H Master Options for School Discipline
export const KATEGORI_DISIPLIN_OPTIONS = [
  'Ponteng (Sekolah / Kelas / Perhimpunan / Solat)',
  'Merokok / Membawa atau Menghisap Vape / E-Cigarette',
  'Tingkah Laku Jenayah (Pergaduhan / Mengugut / Memeras Ugut)',
  'Buli Fizikal / Buli Lisan / Buli Siber',
  'Kecurian / Mengambil Hak Milik Orang Lain',
  'Vandalisme / Kerosakan Harta Benda Sekolah',
  'Kurang Sopan / Biadab Terhadap Guru / Pengawas / Staf',
  'Salah Guna Telefon Pintar / Gajet / Media Sosial',
  'Tingkah Laku Lucah / Tidak Senonoh / Bahan Sumbang',
  'Kekemasan Diri / Pakaian Seragam / Rambut',
  'Membawa Barangan Larangan / Senjata Berbahaya',
  'Ingkar Arahan / Enggan Mengikuti Peraturan Sekolah',
  'Lain-lain Kesalahan Disiplin'
];

export const JENIS_KES_OPTIONS = KATEGORI_DISIPLIN_OPTIONS;

export const TAHAP_KESALAHAN_OPTIONS: ('Ringan' | 'Sederhana' | 'Berat')[] = [
  'Ringan',
  'Sederhana',
  'Berat'
];

export const SESI_WAKTU_OPTIONS = [
  'Waktu PdP / Pembelajaran Dalam Kelas',
  'Waktu Rehat / Kantin',
  'Sebelum Sesi Persekolahan / Perhimpunan Pagi',
  'Waktu Solat Zohor / Aktiviti Surau',
  'Waktu Selepas Tamat Sekolah / Menunggu Bas',
  'Waktu Aktiviti Kokurikulum / Sukan',
  'Waktu Kelas Tambahan / Prep Petang / Malam',
  'Kawasan Asrama (Bilik / Koridor / Dewan Makan)',
  'Lain-lain Waktu'
];

export const LOKASI_DISIPLIN_OPTIONS = [
  'Bilik Darjah / Kelas',
  'Tandas Murid (Lelaki / Perempuan)',
  'Kantin Sekolah',
  'Padang / Gelanggang Sukan',
  'Belakang Blok / Bangunan Sekolah',
  'Surau / Musolla Sekolah',
  'Dewan Sekolah / Dewan Terbuka',
  'Pintu Pagar Sekolah / Pondok Pengawal',
  'Makmal Sains / Komputer / Bengkel RBT',
  'Perpustakaan / Pusat Sumber',
  'Kawasan Asrama',
  'Luar Kawasan Sekolah / Semasa Perjalanan',
  'Lain-lain Lokasi'
];

export const PUNCA_DISIPLIN_OPTIONS = [
  'Pengaruh Rakan Sebaya',
  'Perselisihan Faham / Provokasi / Dendam',
  'Tekanan Emosi / Kemarahan / Masalah Peribadi',
  'Sengaja Mengingkari Peraturan / Sikap Acuh Tak Acuh',
  'Masalah Kekeluargaan / Kurang Pemantauan',
  'Ketagihan / Tabiat (Vape, Rokok, Telefon)',
  'Kekurangan Pemahaman / Tidak Sengaja',
  'Lain-lain Punca'
];

export const TINDAKAN_AWAL_OPTIONS = [
  'Nasihat & Amaran Lisan',
  'Amaran Bertulis & Catatan Buku Rekod Disiplin',
  'Barang Rampasan Disita & Diserahkan ke Pejabat Disiplin',
  'Dirujuk ke Guru Kaunselor / Bilik Bimbingan & Kaunseling',
  'Dirujuk kepada Guru Disiplin / GPK Hal Ehwal Murid (HEM)',
  'Panggilan / Surat Makluman Rasmi kepada Ibu Bapa / Penjaga',
  'Perjanjian Berkelakuan Baik / Surat Aku Janji',
  'Kerja Amal / Khidmat Masyarakat Sekolah',
  'Gantung Persekolahan (Tindakan Tatatertib Kes Berat)',
  'Laporan kepada Pegawai Perhubungan Sekolah (Polis PDRM / PPS)'
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
    alert('Sila benarkan pop-up window di pelayar anda untuk mencetak Laporan Kes Disiplin.');
    return;
  }

  const hasGambarBukti = Boolean(caseRecord.buktiGambarUrl);
  const hasKeteranganSiasatan = Boolean(caseRecord.keteranganSiasatan);
  const hasSelesaiSection = Boolean(caseRecord.keteranganSelesai || caseRecord.buktiSelesaiUrl);
  const hasPage2Content = hasGambarBukti || hasKeteranganSiasatan || hasSelesaiSection;

  const namaMurid = caseRecord.namaMurid || caseRecord.penerimaName || 'Tidak Dinyatakan';
  const kelasMurid = caseRecord.kelasMurid || caseRecord.penerimaHouseNo || '-';
  const tahap = caseRecord.tahapKesalahan || 'Sederhana';
  const sesi = caseRecord.sesiKejadian || 'Waktu Persekolahan';
  const lokasi = caseRecord.lokasiKejadian || 'Kawasan Sekolah';
  const lokasiDet = caseRecord.lokasiPerincian ? ` (${caseRecord.lokasiPerincian})` : '';
  const punca = caseRecord.puncaKejadian || 'Dalam Siasatan';
  const tindakanAwal = caseRecord.tindakanAwalGuru || 'Nasihat dan Amaran Lisan';

  const html = `
    <!DOCTYPE html>
    <html lang="ms">
    <head>
      <meta charset="UTF-8">
      <title>Laporan Kes Disiplin - ${caseRecord.caseNo}</title>
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
          <h2 class="font-bold text-slate-800 text-xs">Dokumen Laporan Rasmi Kes Disiplin Murid (Format 5W 1H)</h2>
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
                  <p class="text-[9px] text-slate-600 font-medium">Kod Sekolah: NFT6001 | Unit Disiplin & Hal Ehwal Murid (HEM)</p>
                  <p class="text-[9px] text-slate-500">Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan Darul Khusus</p>
                </div>
              </div>
              <div class="text-right">
                <span class="inline-block px-2 py-0.5 bg-rose-900 text-white font-black text-[9px] rounded uppercase tracking-wider mb-0.5">
                  REKOD DISIPLIN RASMI
                </span>
                <p class="font-mono text-slate-800 font-bold text-xs">No. Kes: ${caseRecord.caseNo}</p>
                <p class="text-[9px] text-slate-500">Tarikh Daftar: ${new Date(caseRecord.createdAt).toLocaleDateString('ms-MY')}</p>
              </div>
            </div>

            <!-- Title -->
            <div class="text-center my-2.5">
              <h2 class="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 inline-block pb-0.5">
                BORANG LAPORAN KES SALAH LAKU & DISIPLIN MURID
              </h2>
              <p class="text-[9px] text-slate-600 font-bold mt-0.5">
                DOKUMENTASI SISTEMATIK BERDASARKAN PRINSIP 5W DAN 1H
              </p>
            </div>

            <!-- Top Summary Box -->
            <div class="grid grid-cols-2 gap-2 mb-3 bg-slate-50 p-2.5 border border-slate-200 rounded-lg text-[10px]">
              <div>
                <span class="font-bold text-slate-400 uppercase block text-[8px]">Guru / Pegawai Pelapor</span>
                <p class="font-extrabold text-slate-900 text-[11px]">${caseRecord.pengaduName}</p>
                <span class="inline-block px-1.5 py-0.2 bg-indigo-100 text-indigo-900 text-[8px] font-bold rounded mt-0.5">
                  ${caseRecord.pengaduRole}
                </span>
              </div>
              <div>
                <span class="font-bold text-slate-400 uppercase block text-[8px]">Status Tindakan Kes</span>
                <p class="font-extrabold text-rose-800 text-[11px]">${caseRecord.status || 'Dalam Siasatan'}</p>
                <span class="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[8px] font-bold rounded mt-0.5">
                  Tahap Kesalahan: ${tahap.toUpperCase()}
                </span>
              </div>
            </div>

            <!-- ================= THE 5W 1H GRID ================= -->
            <div class="space-y-2 mb-3">
              
              <!-- 1. WHAT (Apa Kesalahan) -->
              <div class="border border-slate-200 rounded-lg p-2.5 bg-white">
                <div class="flex items-center justify-between border-b border-slate-100 pb-1 mb-1.5">
                  <span class="font-black text-slate-900 text-[10px] tracking-wider uppercase">
                    1. WHAT — APA KESALAHAN YANG BERLAKU?
                  </span>
                  <span class="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-extrabold rounded">
                    Tahap: ${tahap}
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-[10px]">
                  <div class="col-span-1">
                    <span class="text-slate-400 font-bold block text-[8px]">Kategori Kesalahan:</span>
                    <p class="font-black text-rose-700">${caseRecord.jenisKes}</p>
                  </div>
                  <div class="col-span-2">
                    <span class="text-slate-400 font-bold block text-[8px]">Perincian Perlakuan:</span>
                    <p class="text-slate-700 font-medium">${caseRecord.whatPerincian || 'Sila rujuk keterangan kronologi kes di bahagian HOW.'}</p>
                  </div>
                </div>
              </div>

              <!-- 2. WHO (Siapa Terlibat) -->
              <div class="border border-slate-200 rounded-lg p-2.5 bg-white">
                <div class="border-b border-slate-100 pb-1 mb-1.5">
                  <span class="font-black text-slate-900 text-[10px] tracking-wider uppercase">
                    2. WHO — SIAPA YANG TERLIBAT & SAKSI KEJADIAN?
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">Nama Murid (Terlibat):</span>
                    <p class="font-extrabold text-slate-900 text-[11px]">${namaMurid}</p>
                  </div>
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">Kelas / Tingkatan:</span>
                    <p class="font-bold text-slate-800">${kelasMurid}</p>
                  </div>
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">No. Kad Pengenalan / Murid:</span>
                    <p class="font-mono text-slate-700">${caseRecord.noPelajar || '-'}</p>
                  </div>
                  <div class="col-span-2">
                    <span class="text-slate-400 font-bold block text-[8px]">Saksi Kejadian (Guru / Murid):</span>
                    <p class="text-slate-700 font-medium">${caseRecord.saksiKejadian || 'Tiada saksi khusus dinyatakan'}</p>
                  </div>
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">Pihak Lain Terlibat / Mangsa:</span>
                    <p class="text-slate-700 font-medium">${caseRecord.pihakTerlibatLain || 'Tiada'}</p>
                  </div>
                </div>
              </div>

              <!-- 3. WHEN & 4. WHERE (Bila & Di Mana) -->
              <div class="grid grid-cols-2 gap-2">
                <!-- WHEN -->
                <div class="border border-slate-200 rounded-lg p-2.5 bg-white">
                  <div class="border-b border-slate-100 pb-1 mb-1.5">
                    <span class="font-black text-slate-900 text-[10px] tracking-wider uppercase">
                      3. WHEN — BILA BERLAKU?
                    </span>
                  </div>
                  <div class="space-y-1 text-[10px]">
                    <div>
                      <span class="text-slate-400 font-bold block text-[8px]">Tarikh & Waktu Kejadian:</span>
                      <p class="font-bold text-slate-800">${caseRecord.tarikhKes} (${caseRecord.masaKes})</p>
                    </div>
                    <div>
                      <span class="text-slate-400 font-bold block text-[8px]">Sesi / Waktu Sekolah:</span>
                      <p class="text-slate-700 font-medium">${sesi}</p>
                    </div>
                  </div>
                </div>

                <!-- WHERE -->
                <div class="border border-slate-200 rounded-lg p-2.5 bg-white">
                  <div class="border-b border-slate-100 pb-1 mb-1.5">
                    <span class="font-black text-slate-900 text-[10px] tracking-wider uppercase">
                      4. WHERE — DI MANA BERLAKU?
                    </span>
                  </div>
                  <div class="space-y-1 text-[10px]">
                    <div>
                      <span class="text-slate-400 font-bold block text-[8px]">Lokasi Utama:</span>
                      <p class="font-bold text-slate-800">${lokasi}${lokasiDet}</p>
                    </div>
                    <div>
                      <span class="text-slate-400 font-bold block text-[8px]">Kawasan Kawalan:</span>
                      <p class="text-slate-700 font-medium">${caseRecord.lokasiPerincian ? caseRecord.lokasiPerincian : 'Kawasan Premis SMAUJ'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 5. WHY (Mengapa Berlaku / Punca) -->
              <div class="border border-slate-200 rounded-lg p-2.5 bg-white">
                <div class="border-b border-slate-100 pb-1 mb-1.5">
                  <span class="font-black text-slate-900 text-[10px] tracking-wider uppercase">
                    5. WHY — MENGAPA BERLAKU / PUNCA KEJADIAN?
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">Faktor Utama:</span>
                    <p class="font-bold text-slate-800">${punca}</p>
                  </div>
                  <div class="col-span-2">
                    <span class="text-slate-400 font-bold block text-[8px]">Huraian Motif / Latar Belakang:</span>
                    <p class="text-slate-700 font-medium">${caseRecord.sebabPerincian || 'Siasatan awal mendapati faktor di atas merupakan punca utama salah laku.'}</p>
                  </div>
                </div>
              </div>

              <!-- 6. HOW (Bagaimana Berlaku & Tindakan) -->
              <div class="border border-slate-200 rounded-lg p-2.5 bg-white">
                <div class="border-b border-slate-100 pb-1 mb-1.5">
                  <span class="font-black text-slate-900 text-[10px] tracking-wider uppercase">
                    6. HOW — BAGAIMANA BERLAKU & TINDAKAN DIAMBIL?
                  </span>
                </div>
                <div class="space-y-1.5 text-[10px]">
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">Tindakan Awal Guru / Pelapor:</span>
                    <p class="font-bold text-indigo-900 bg-indigo-50/50 p-1.5 rounded border border-indigo-100">${tindakanAwal}</p>
                  </div>
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">Kronologi Penuh Kejadian & Cara Dikesan:</span>
                    <div class="p-2 bg-slate-50 border border-slate-200 rounded whitespace-pre-wrap leading-snug text-slate-800 text-[9.5px]">
                      ${caseRecord.kronologiKejadian || caseRecord.keterangan}
                    </div>
                  </div>
                  <div>
                    <span class="text-slate-400 font-bold block text-[8px]">Rujukan Pegawai Perhubungan Sekolah / Polis (PDRM):</span>
                    <p class="font-bold text-slate-800">
                      ${caseRecord.isPoliceReport ? `YA - Dilaporkan di: ${caseRecord.balaiPolis || 'Balai Polis'}${caseRecord.noRepotPolis ? ` (No. Repot: ${caseRecord.noRepotPolis})` : ''}` : 'TIDAK (Tindakan Dalaman Disiplin & Bimbingan Kaunseling Sekolah)'}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            <!-- Perakuan & Legal Statement -->
            <div class="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-[8.5px] text-amber-900 leading-tight mb-2.5">
              <p class="font-bold mb-0.5">PERAKUAN GURU PELAPOR:</p>
              <p>
                Laporan ini direkodkan secara rasmi oleh Guru / Admin Utama yang bertugas tanpa sebarang niat prasangka, berpandukan Buku Peraturan Disiplin Murid Sekolah Menengah Agama Ulu Jempol dan Surat Pekeliling Ikhtisas Kementerian Pendidikan Malaysia.
              </p>
            </div>
          </div>

          <div>
            <!-- Signatures Row -->
            <div class="grid grid-cols-2 gap-6 border-t border-slate-300 pt-2.5 mt-1">
              <div class="text-center">
                <p class="text-[8.5px] font-bold text-slate-500 uppercase mb-1">Tandatangan Guru Pelapor</p>
                <div class="h-14 border border-dashed border-slate-300 rounded flex items-center justify-center p-1 mb-1 bg-slate-50">
                  ${caseRecord.pengaduSignatureUrl ? `<img src="${caseRecord.pengaduSignatureUrl}" alt="Tandatangan Pelapor" class="max-h-12 object-contain" />` : '<span class="text-slate-400 italic text-[8.5px]">Tiada Tandatangan</span>'}
                </div>
                <p class="font-bold text-slate-900 text-[9.5px] border-b border-slate-300 inline-block px-3 pb-0.5">${caseRecord.pengaduName}</p>
                <p class="text-[8.5px] text-slate-500 font-medium">${caseRecord.pengaduRole}</p>
              </div>

              <div class="text-center">
                <p class="text-[8.5px] font-bold text-slate-500 uppercase mb-1">Tandatangan Murid / Saksi / Penerima</p>
                <div class="h-14 border border-dashed border-slate-300 rounded flex items-center justify-center p-1 mb-1 bg-slate-50">
                  ${caseRecord.penerimaSignatureUrl ? `<img src="${caseRecord.penerimaSignatureUrl}" alt="Tandatangan Penerima" class="max-h-12 object-contain" />` : '<span class="text-slate-400 italic text-[8.5px]">Tiada Tandatangan</span>'}
                </div>
                <p class="font-bold text-slate-900 text-[9.5px] border-b border-slate-300 inline-block px-3 pb-0.5">${namaMurid}</p>
                <p class="text-[8.5px] text-slate-500 font-medium">Kelas: ${kelasMurid}</p>
              </div>
            </div>

            <div class="mt-2 text-center text-[7.5px] text-slate-400 border-t border-slate-100 pt-1.5">
              Dokumen ini dijana secara digital oleh Portal Rasmi Sekolah Menengah Agama Ulu Jempol (SMAUJ) • Modul Pengurusan Disiplin Sekolah
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
                <span class="text-[10px] font-bold text-slate-600 uppercase block mb-1.5">Gambar Barang Bukti / Tangkapan / Kejadian:</span>
                <img src="${caseRecord.buktiGambarUrl}" alt="Bukti Gambar Kes" class="max-h-72 rounded border border-slate-300 object-contain mx-auto" />
              </div>
            ` : ''}

            ${hasKeteranganSiasatan ? `
              <div class="mb-4">
                <h3 class="font-black text-xs uppercase text-amber-800 tracking-wider mb-1.5 border-b border-amber-200 pb-1 flex items-center justify-between">
                  <span>Catatan Semasa Siasatan Guru Disiplin / HEM</span>
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
                  <span>Keterangan Penyelesaian & Tindakan Bimbingan Kaunseling</span>
                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-bold rounded">STATUS: SELESAI</span>
                </h3>
                ${caseRecord.keteranganSelesai ? `
                  <div class="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg whitespace-pre-wrap leading-relaxed text-slate-800 text-[10px] font-normal mb-3">
                    ${caseRecord.keteranganSelesai}
                  </div>
                ` : ''}
                ${caseRecord.buktiSelesaiUrl ? `
                  <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span class="text-[10px] font-bold text-slate-600 uppercase block mb-1.5">Gambar / Surat Aku Janji / Bukti Selesai:</span>
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
