import { jsPDF } from 'jspdf';
import { AppUser } from '../context/AuthContext';
import { KewanganTransaction } from '../components/KewanganSection';
import { logoBase64 } from './logoBase64';

export const generateReceiptPdf = async (
  txn: KewanganTransaction,
  allUsers: AppUser[]
) => {
  // Create jsPDF instance with A4 dimensions (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Find Bendahari details
  const bendahari = allUsers?.find(u => u.role === 'Bendahari');
  const bendahariName = bendahari ? (bendahari.displayName || bendahari.nickname || "Muhammad Firdaus bin Abdul Hadi") : "Muhammad Firdaus bin Abdul Hadi";
  const bendahariPhone = bendahari ? (bendahari.phoneNumber || "+60 10-2345678") : "+60 10-2345678";
  const bendahariEmail = bendahari ? (bendahari.email || "smaujn9@gmail.com") : "smaujn9@gmail.com";

  // Find Payee/Member details (who made the payment)
  const payeeUser = allUsers?.find(u => u.email === txn.memberEmail);
  const payeeName = payeeUser ? (payeeUser.displayName || payeeUser.nickname || "Ahmad Ali bin Mustafa") : "Ahmad Ali bin Mustafa";
  
  // Construct dynamic address for the payee
  let payeeAddress = "Lot 123, Jalan Bahagia, 50000 Kuala Lumpur";
  if (payeeUser && (payeeUser.noRumah || payeeUser.address)) {
    const parts = [
      payeeUser.noRumah ? `No. Rumah ${payeeUser.noRumah}` : '',
      payeeUser.address || '',
      payeeUser.poskod || '',
      payeeUser.bandar || '',
      payeeUser.negeri || ''
    ].filter(Boolean);
    if (parts.length > 0) {
      payeeAddress = parts.join(', ');
    }
  }

  // Calculate Subtotal and FPX Fee
  let fpxCharge = 1.00;
  let fpxSurchargeMode = true;
  try {
    const cached = localStorage.getItem('tmf2_yuran_config');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed.fpxCharge === 'number') {
        fpxCharge = parsed.fpxCharge;
      }
      if (typeof parsed.fpxSurchargeMode === 'boolean') {
        fpxSurchargeMode = parsed.fpxSurchargeMode;
      }
    }
  } catch (e) {
    console.error("Gagal baca fpxCharge/fpxSurchargeMode:", e);
  }

  const isYuranPmt = txn.category && (
    txn.category.startsWith("Yuran") || 
    txn.category === "Khairat Kematian" ||
    txn.category === "Program" ||
    (txn.paidPackageIds && txn.paidPackageIds.length > 0)
  );

  let subtotal = txn.amount;
  let fpxFee = 0.00;
  let totalAmount = txn.amount;

  if (isYuranPmt) {
    fpxFee = fpxCharge;
    if (fpxSurchargeMode) {
      subtotal = txn.amount;
      totalAmount = txn.amount + fpxCharge;
    } else {
      subtotal = Math.max(0, txn.amount - fpxCharge);
      totalAmount = txn.amount;
    }
  }

  // 1. Draw "FROM" header text
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(9);
  pdf.setTextColor(29, 78, 216); // blue-700
  pdf.text('FROM', 15, 20);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(15);
  pdf.setTextColor(15, 23, 42); // slate-900 / dark
  pdf.text('Sekolah Menengah Agama Ulu Jempol', 15, 27);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105); // slate-600
  pdf.text('Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan', 15, 34);

  // 2. Load and add Association Logo (Top Right)
  if (logoBase64) {
    pdf.addImage(logoBase64, 'PNG', 160, 12, 35, 35);
  } else {
    // If loading image fails, draw a high quality fallback emblem
    pdf.setDrawColor(0, 15, 34);
    pdf.setFillColor(0, 15, 34);
    pdf.circle(177.5, 29.5, 12, 'FD');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('Helvetica', 'Bold');
    pdf.setFontSize(12);
    pdf.text('SMAUJ', 177.5, 31, { align: 'center' });
  }

  // 3. Receipt Title on the Right (below logo)
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(28);
  pdf.setTextColor(0, 15, 34); // deep navy
  pdf.text('RECEIPT', 195, 62, { align: 'right' });

  // 4. Draw "TO" section
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(9);
  pdf.setTextColor(29, 78, 216); // blue-700
  pdf.text('TO', 15, 71);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42); // slate-900
  pdf.text(payeeName, 15, 78);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(71, 85, 105); // slate-600
  // Handle multiline address beautifully
  const splitAddress = pdf.splitTextToSize(payeeAddress, 110);
  pdf.text(splitAddress, 15, 84);

  // 5. Draw Receipt Meta info on the right
  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Receipt #:', 140, 78);
  pdf.setFont('Helvetica', 'Bold');
  pdf.text(txn.voucherNo, 195, 78, { align: 'right' });

  pdf.setFont('Helvetica', 'Normal');
  pdf.text('Receipt Date:', 140, 84);
  pdf.setFont('Helvetica', 'Bold');
  pdf.text(txn.date, 195, 84, { align: 'right' });

  // 6. Draw Items Table
  const tableTopY = 105;
  
  // Table Header Background
  pdf.setFillColor(0, 15, 34); // deep navy
  pdf.rect(15, tableTopY, 180, 10, 'F');

  // Table Header Text
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('NO.', 20, tableTopY + 6.5, { align: 'center' });
  pdf.text('DESCRIPTION', 32, tableTopY + 6.5);
  pdf.text('UNIT PRICE', 145, tableTopY + 6.5, { align: 'right' });
  pdf.text('QTY', 162.5, tableTopY + 6.5, { align: 'center' });
  pdf.text('AMOUNT', 195, tableTopY + 6.5, { align: 'right' });

  // Clean description text
  let displayDesc = txn.description || "Yuran Persatuan";
  if (displayDesc.startsWith("Bayaran yuran (") && displayDesc.endsWith(")")) {
    displayDesc = displayDesc.replace("Bayaran yuran (", "").replace(")", "");
  }
  if (!displayDesc.toLowerCase().includes("yuran")) {
    displayDesc = `${txn.category || 'Yuran'} - ${displayDesc}`;
  }

  interface TableItem {
    no: string;
    description: string;
    unitPrice: number;
    qty: number;
    amount: number;
  }
  const items: TableItem[] = [];

  const isYuranBulanan = txn.category === "Yuran Bulanan" || txn.accountCredit === "Yuran Bulanan";
  const hasTahunanDiscount = isYuranBulanan && (txn.description?.includes("Tahun") || txn.description?.includes("Tahunan") || txn.notes?.includes("Tahunan"));
  const hasPenggalDiscount = isYuranBulanan && (txn.description?.includes("Penggal") || txn.notes?.includes("Penggal"));

  if (hasTahunanDiscount) {
    items.push({
      no: '1.',
      description: `Bayaran Yuran Persatuan (Pakej Tahunan Sesi ${txn.sessionYear || '2026'})`,
      unitPrice: 60.00,
      qty: 1,
      amount: 60.00
    });
    items.push({
      no: '2.',
      description: 'Diskaun Pembayaran Yuran Tahunan (RM20.00 - Tolak dari Persatuan)',
      unitPrice: -20.00,
      qty: 1,
      amount: -20.00
    });
  } else if (hasPenggalDiscount) {
    items.push({
      no: '1.',
      description: `Bayaran Yuran Persatuan (Pakej Perpenggal Sesi ${txn.sessionYear || '2026'})`,
      unitPrice: 25.00,
      qty: 1,
      amount: 25.00
    });
    items.push({
      no: '2.',
      description: 'Diskaun Pembayaran Yuran Perpenggal (RM5.00 - Tolak dari Persatuan)',
      unitPrice: -5.00,
      qty: 1,
      amount: -5.00
    });
  } else {
    items.push({
      no: '1.',
      description: displayDesc,
      unitPrice: subtotal,
      qty: 1,
      amount: subtotal
    });
  }

  let currentY = tableTopY + 10;
  items.forEach((item) => {
    const splitDesc: string[] = pdf.splitTextToSize(item.description, 100);
    const lineCount = splitDesc.length;
    const rowHeight = Math.max(10, 5 + (lineCount * 5));

    pdf.setFillColor(255, 255, 255);
    pdf.rect(15, currentY, 180, rowHeight, 'F');

    pdf.setDrawColor(226, 232, 240); // slate-200
    pdf.setLineWidth(0.3);
    pdf.line(15, currentY + rowHeight, 195, currentY + rowHeight);

    pdf.setFont('Helvetica', 'Normal');
    pdf.setFontSize(9.5);
    if (item.unitPrice < 0) {
      pdf.setTextColor(22, 163, 74); // green-600
    } else {
      pdf.setTextColor(15, 23, 42); // slate-900
    }

    const centerY = currentY + (rowHeight / 2) + 1.2;
    pdf.text(item.no, 20, centerY, { align: 'center' });

    let textY = currentY + 6;
    for (let i = 0; i < splitDesc.length; i++) {
      pdf.text(splitDesc[i], 32, textY);
      textY += 5;
    }

    const pricePrefix = item.unitPrice < 0 ? '-' : '';
    const absPrice = Math.abs(item.unitPrice);
    pdf.text(`${pricePrefix}RM ${absPrice.toFixed(2)}`, 145, centerY, { align: 'right' });
    pdf.text(String(item.qty), 162.5, centerY, { align: 'center' });
    pdf.text(`${pricePrefix}RM ${absPrice.toFixed(2)}`, 195, centerY, { align: 'right' });

    currentY += rowHeight;
  });

  // 7. Totals Block (Right-aligned below the table)
  let totalsY = currentY + 6;
  
  // Subtotal
  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Subtotal', 140, totalsY);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(subtotal.toFixed(2), 195, totalsY, { align: 'right' });

  // FPX Fee
  totalsY += 6;
  pdf.setFont('Helvetica', 'Normal');
  pdf.setTextColor(71, 85, 105);
  const feeLabel = fpxSurchargeMode ? `FPX Fee (Surcharge)` : `FPX Fee (Absorbed)`;
  pdf.text(feeLabel, 140, totalsY);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(fpxFee.toFixed(2), 195, totalsY, { align: 'right' });

  // Total Blue Box Band
  totalsY += 4;
  pdf.setFillColor(238, 242, 255); // indigo-50
  pdf.rect(120, totalsY, 75, 11, 'F');

  // Total text inside band
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(11);
  pdf.setTextColor(29, 78, 216); // blue-700
  pdf.text('Total Paid', 125, totalsY + 7);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(12);
  pdf.text(`RM ${totalAmount.toFixed(2)}`, 195, totalsY + 7, { align: 'right' });

  // 8. TERMS AND CONDITIONS (Bottom Left)
  const termsTopY = totalsY + 22;
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('TERMS AND CONDITIONS', 15, termsTopY);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  
  const bullets = [
    "Payment received with thanks.",
    "This receipt is valid as proof of payment to Sekolah Menengah Agama Ulu Jempol (SMAUJ).",
    "All payments made are non-refundable.",
    "Please keep this receipt for your records.",
    "For any enquiry regarding payment, please contact the school administration / treasurer."
  ];

  let bulletY = termsTopY + 5.5;
  bullets.forEach(b => {
    pdf.text(String.fromCharCode(149), 15, bulletY);
    // Wrap text so it doesn't overlap on the right
    const splitBullet = pdf.splitTextToSize(b, 105);
    pdf.text(splitBullet, 18, bulletY);
    bulletY += (splitBullet.length * 4.5);
  });

  // 9. STAMP (Bottom Right)
  const stampX = 128;
  const stampY = termsTopY + 5;
  const stampWidth = 65;
  const stampHeight = 15;

  pdf.setDrawColor(22, 163, 74); // green-600
  pdf.setLineWidth(1.2);
  pdf.roundedRect(stampX, stampY, stampWidth, stampHeight, 2, 2, 'D');

  pdf.setLineWidth(0.4);
  pdf.roundedRect(stampX + 1.2, stampY + 1.2, stampWidth - 2.4, stampHeight - 2.4, 1.5, 1.5, 'D');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(11);
  pdf.setTextColor(22, 163, 74); // green-600
  pdf.text('PAYMENT RECEIVED', stampX + (stampWidth / 2), stampY + (stampHeight / 2) + 1.5, { align: 'center' });

  // 10. FOOTER
  const footerY = 280;
  // Draw thin grey divider line
  pdf.setDrawColor(203, 213, 225); // slate-300
  pdf.setLineWidth(0.2);
  pdf.line(15, footerY, 195, footerY);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139); // slate-500
  
  // Combine phone and email in a single line to prevent overlap with right-aligned text
  pdf.text(`Tel: ${bendahariPhone}   |   Email: ${bendahariEmail}`, 15, footerY + 5);
  pdf.text('Sekolah Menengah Agama Ulu Jempol @ 2026', 195, footerY + 5, { align: 'right' });

  // Save the PDF
  const filename = `Resit_${txn.voucherNo}_SMAUJ.pdf`;
  pdf.save(filename);
};
