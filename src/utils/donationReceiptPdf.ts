import { jsPDF } from 'jspdf';
import { AppUser } from '../context/AuthContext';
import { logoBase64 } from './logoBase64';

export interface DonationReceiptData {
  receiptNo: string;
  transactionId?: string;
  date: string;
  time: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorHouseNo?: string;
  fundType: string;
  amount: number;
  paymentMethod: string;
  bankName?: string;
  notes?: string;
}

export const generateDonationReceiptPdf = async (
  data: DonationReceiptData,
  allUsers?: AppUser[],
  autoDownload: boolean = true
): Promise<jsPDF> => {
  // Cipta instance jsPDF bersaiz A4 (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Maklumat Bendahari
  const bendahari = allUsers?.find(u => u.role === 'Bendahari');
  const bendahariName = bendahari ? (bendahari.displayName || bendahari.nickname || "Muhammad Firdaus bin Abdul Hadi") : "Muhammad Firdaus bin Abdul Hadi";
  const bendahariPhone = bendahari ? (bendahari.phoneNumber || "+60 10-2345678") : "+60 10-2345678";
  const bendahariEmail = bendahari ? (bendahari.email || "smaujn9@gmail.com") : "smaujn9@gmail.com";

  // 1. HEADER & BACKGROUND DECORATION
  // Bar atas warna hijau zamrud (Emerald) khas untuk tabung sumbangan
  pdf.setFillColor(16, 149, 106); // Emerald-600
  pdf.rect(0, 0, 210, 8, 'F');

  // Sub-bar aksen emas
  pdf.setFillColor(217, 119, 6); // Amber-600
  pdf.rect(0, 8, 210, 1.5, 'F');

  // Muat naik Logo Persatuan
  try {
    if (logoBase64 && logoBase64.startsWith('data:image')) {
      pdf.addImage(logoBase64, 'PNG', 15, 14, 24, 24);
    }
  } catch (err) {
    console.warn("Gagal memaparkan logo persatuan dalam resit sumbangan:", err);
  }

  // Maklumat Sekolah (Header Kiri)
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42); // slate-900
  pdf.text('SEKOLAH MENENGAH AGAMA ULU JEMPOL', 43, 19);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105); // slate-600
  pdf.text('Persatuan Ibu Bapa & Guru (PIBG) SMAUJ', 43, 24);
  pdf.text('Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan Darul Khusus', 43, 28.5);
  pdf.text(`Emel: smaujn9@gmail.com  |  Tel: ${bendahariPhone}`, 43, 33);

  // KOTAK TAJUK RESIT (Header Kanan)
  pdf.setFillColor(240, 253, 244); // Emerald-50
  pdf.setDrawColor(187, 247, 208); // Emerald-200
  pdf.setLineWidth(0.5);
  pdf.roundedRect(138, 14, 57, 23, 2, 2, 'FD');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(11);
  pdf.setTextColor(16, 120, 80); // Emerald-800
  pdf.text('RESIT RASMI SUMBANGAN', 166.5, 20.5, { align: 'center' });

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(74, 90, 80);
  pdf.text('(AKTA PERTUBUHAN 1966)', 166.5, 24.5, { align: 'center' });

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`NO: ${data.receiptNo}`, 166.5, 31, { align: 'center' });

  // Garis Pemisah Header
  pdf.setDrawColor(226, 232, 240); // slate-200
  pdf.setLineWidth(0.4);
  pdf.line(15, 42, 195, 42);

  // 2. MAKLUMAT RESIT & PENDERMA (2 KOLUM)
  const metaY = 48;

  // Kolum Kiri: Maklumat Penderma
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(15, metaY, 86, 32, 2, 2, 'FD');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text('DITERIMA DARIPADA (PENDERMA):', 19, metaY + 6);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  const splitDonorName = pdf.splitTextToSize(data.donorName || 'Hamba Allah', 78);
  pdf.text(splitDonorName, 19, metaY + 11.5);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  let donorYOffset = metaY + 17;
  if (data.donorHouseNo) {
    pdf.text(`No. Rumah: ${data.donorHouseNo}`, 19, donorYOffset);
    donorYOffset += 4.5;
  }
  if (data.donorPhone) {
    pdf.text(`No. Telefon: ${data.donorPhone}`, 19, donorYOffset);
    donorYOffset += 4.5;
  }
  if (data.donorEmail) {
    pdf.text(`Emel: ${data.donorEmail}`, 19, donorYOffset);
  }

  // Kolum Kanan: Butiran Transaksi
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(109, metaY, 86, 32, 2, 2, 'FD');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text('BUTIRAN TRANSAKSI:', 113, metaY + 6);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8);
  pdf.setTextColor(51, 65, 85);

  pdf.text('Tarikh Sumbangan:', 113, metaY + 12);
  pdf.setFont('Helvetica', 'Bold');
  pdf.text(data.date, 155, metaY + 12);

  pdf.setFont('Helvetica', 'Normal');
  pdf.text('Masa Transaksi:', 113, metaY + 17);
  pdf.setFont('Helvetica', 'Bold');
  pdf.text(data.time || '12:00', 155, metaY + 17);

  pdf.setFont('Helvetica', 'Normal');
  pdf.text('Kaedah Bayaran:', 113, metaY + 22);
  pdf.setFont('Helvetica', 'Bold');
  pdf.text(data.paymentMethod + (data.bankName ? ` (${data.bankName})` : ''), 155, metaY + 22);

  pdf.setFont('Helvetica', 'Normal');
  pdf.text('Status:', 113, metaY + 27);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(16, 149, 106);
  pdf.text('BERJAYA & DISAHKAN', 155, metaY + 27);

  // 3. JADUAL SUMBANGAN & TABUNG
  const tableY = metaY + 38;

  // Header Jadual
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(15, tableY, 180, 8, 'F');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('BIL', 20, tableY + 5.5);
  pdf.text('KETERANGAN TABUNG SUMBANGAN', 32, tableY + 5.5);
  pdf.text('JENIS / PERUNTUKAN', 125, tableY + 5.5);
  pdf.text('JUMLAH (RM)', 190, tableY + 5.5, { align: 'right' });

  // Isi Jadual (Row)
  const rowY = tableY + 8;
  pdf.setFillColor(255, 255, 255);
  pdf.rect(15, rowY, 180, 20, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.line(15, rowY + 20, 195, rowY + 20);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('1.', 20, rowY + 7);

  pdf.setFont('Helvetica', 'Bold');
  pdf.text(data.fundType, 32, rowY + 7);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Sumbangan ikhlas untuk kemaslahatan pendidikan & murid SMAUJ', 32, rowY + 12);
  if (data.notes) {
    const splitNotes = pdf.splitTextToSize(`Catatan / Hajat: "${data.notes}"`, 85);
    pdf.text(splitNotes, 32, rowY + 16);
  }

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text('Infaq / Sedekah', 125, rowY + 7);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`RM ${data.amount.toFixed(2)}`, 190, rowY + 7, { align: 'right' });

  // 4. KOTAK JUMLAH KESELURUHAN
  const totalBoxY = rowY + 24;
  pdf.setFillColor(240, 253, 244); // Emerald-50
  pdf.setDrawColor(187, 247, 208); // Emerald-200
  pdf.roundedRect(120, totalBoxY, 75, 16, 2, 2, 'FD');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(9);
  pdf.setTextColor(16, 120, 80);
  pdf.text('JUMLAH SUMBANGAN DITERIMA:', 124, totalBoxY + 6.5);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(13);
  pdf.setTextColor(16, 149, 106);
  pdf.text(`RM ${data.amount.toFixed(2)}`, 190, totalBoxY + 12.5, { align: 'right' });

  // 5. PERAKUAN & PESANAN PENGHARGAAN
  const noteBoxY = totalBoxY + 22;
  pdf.setFillColor(254, 252, 232); // amber-50
  pdf.setDrawColor(254, 240, 138); // amber-200
  pdf.roundedRect(15, noteBoxY, 180, 24, 2, 2, 'FD');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(146, 64, 14); // amber-800
  pdf.text('UCAPAN PENGHARGAAN & TERIMA KASIH DARI PIBG / SEKOLAH', 20, noteBoxY + 6);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8);
  pdf.setTextColor(113, 63, 18);
  const appreciationMsg = 
    "Pihak pengurusan Sekolah Menengah Agama Ulu Jempol dan PIBG merakamkan setinggi-tinggi penghargaan dan terima kasih atas sumbangan ikhlas anda. Sumbangan ini akan dimanfaatkan sebaiknya bagi pembangunan prasarana sekolah, surau, kebajikan murid tahfiz dan kecemerlangan akademik. Semoga Allah SWT memberkati dan melipatgandakan rezeki anda sekeluarga.";
  const splitMsg = pdf.splitTextToSize(appreciationMsg, 170);
  pdf.text(splitMsg, 20, noteBoxY + 11.5);

  // 6. SYARAT-SYARAT & PENGESAHAN (2 BAHAGIAN BAWAH)
  const bottomY = noteBoxY + 30;

  // Kiri: Terma Resit Sumbangan
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('PERINGATAN & TERMA:', 15, bottomY);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  const terms = [
    "Sumbangan ini adalah pemberian ikhlas / sukarela dan bukan bayaran yuran rasmi persatuan.",
    "Resit ini adalah dokumen sah pengakuan penerimaan sumbangan oleh Bendahari Persatuan.",
    "Sumbangan yang telah disahkan penerimaannya tidak boleh dituntut semula (non-refundable).",
    "Sebarang pertanyaan atau semakan lejar tabung boleh dirujuk terus kepada pihak Bendahari."
  ];

  let termLineY = bottomY + 5;
  terms.forEach(t => {
    pdf.text(String.fromCharCode(149), 15, termLineY);
    const splitT = pdf.splitTextToSize(t, 100);
    pdf.text(splitT, 18, termLineY);
    termLineY += (splitT.length * 3.8);
  });

  // Kanan: Cop & Tandatangan Digital Bendahari
  const stampBoxX = 130;
  const stampBoxY = bottomY;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(stampBoxX, stampBoxY, 65, 36, 2, 2, 'FD');

  // Cop bulat hijau "SUMBANGAN DITERIMA"
  pdf.setDrawColor(16, 149, 106);
  pdf.setLineWidth(1);
  pdf.roundedRect(stampBoxX + 4, stampBoxY + 4, 57, 10, 1.5, 1.5, 'D');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(16, 149, 106);
  pdf.text('SUMBANGAN DITERIMA & DISAHKAN', stampBoxX + 32.5, stampBoxY + 10.5, { align: 'center' });

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Disahkan secara digital oleh:', stampBoxX + 5, stampBoxY + 19);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text(bendahariName, stampBoxX + 5, stampBoxY + 24);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Bendahari PIBG / SMAUJ', stampBoxX + 5, stampBoxY + 28);
  pdf.text(`Tarikh Cetakan: ${new Date().toLocaleDateString('ms-MY')}`, stampBoxX + 5, stampBoxY + 32);

  // 7. FOOTER HALAMAN
  const footerY = 282;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(15, footerY, 195, footerY);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text(`Sekolah Menengah Agama Ulu Jempol (NFT6001) @ ${new Date().getFullYear()}`, 15, footerY + 5);
  pdf.text('Dokumen ini dijana secara automatik oleh Portal Rasmi SMAUJ', 195, footerY + 5, { align: 'right' });

  // Muat turun fail jika diminta
  if (autoDownload) {
    const filename = `Resit_Sumbangan_${data.receiptNo}_SMAUJ.pdf`;
    pdf.save(filename);
  }

  return pdf;
};
