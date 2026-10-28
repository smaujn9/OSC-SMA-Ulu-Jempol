import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logoBase64 } from './logoBase64';

export interface MembershipCardData {
  memberNo: string;
  name: string;
  role: string;
  noRumah: string;
  icNumber: string;
  phone?: string;
  email?: string;
  address?: string;
  statusKediaman?: string;
  registeredDate?: string;
  avatarUrl?: string;
}

/**
 * Helper to draw a rounded rectangle on Canvas context
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Load an image from URL or Base64 as HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Generate High-Resolution Membership Card on HTML5 Canvas
 */
export async function generateMembershipCardCanvas(
  data: MembershipCardData
): Promise<HTMLCanvasElement> {
  const width = 1050;
  const height = 650;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal memulakan Canvas Context.');

  // Enable high-quality anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Base Card Clipping with Rounded Corners
  drawRoundedRect(ctx, 0, 0, width, height, 36);
  ctx.clip();

  // 2. Rich Emerald-Teal Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#065f46');   // emerald-800
  bgGrad.addColorStop(0.5, '#0f766e'); // teal-700
  bgGrad.addColorStop(1, '#064e3b');   // deep emerald-900
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2b. Ambient Radial Highlights for Depth
  const radialGlow = ctx.createRadialGradient(width, 0, 50, width, 0, 480);
  radialGlow.addColorStop(0, 'rgba(52, 211, 153, 0.22)');
  radialGlow.addColorStop(1, 'rgba(52, 211, 153, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  const radialBottom = ctx.createRadialGradient(0, height, 40, 0, height, 420);
  radialBottom.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
  radialBottom.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = radialBottom;
  ctx.fillRect(0, 0, width, height);

  // 3. Security Geometric Wave & Watermark Pattern
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1.5;
  for (let i = -100; i < width + 200; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.bezierCurveTo(i + 150, height * 0.35, i - 100, height * 0.7, i + 80, height);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Large Watermark Shield Silhouette in Background
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.translate(width - 240, height * 0.5);
  ctx.rotate(-0.15);
  ctx.beginPath();
  ctx.moveTo(0, -180);
  ctx.lineTo(130, -110);
  ctx.lineTo(130, 60);
  ctx.quadraticCurveTo(130, 160, 0, 210);
  ctx.quadraticCurveTo(-130, 160, -130, 60);
  ctx.lineTo(-130, -110);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 5. Dual Border Frame
  ctx.save();
  drawRoundedRect(ctx, 3, 3, width - 6, height - 6, 34);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
  ctx.lineWidth = 4;
  ctx.stroke();

  drawRoundedRect(ctx, 9, 9, width - 18, height - 18, 30);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 6. Header Section (Logo + Association Name + Status Badge)
  // 6a. Logo
  const logoSize = 78;
  const logoX = 45;
  const logoY = 38;

  try {
    const logoImg = await loadImage(logoBase64);
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  } catch (e) {
    console.warn('Gagal muat naik logo ke Canvas:', e);
  }

  // 6b. Association Titles
  const textX = logoX + logoSize + 18;
  ctx.textAlign = 'left';

  // Category Tag
  ctx.font = 'bold 12px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0'; // emerald-200
  ctx.letterSpacing = '2px';
  ctx.fillText('KAD PENGENALAN DIGITAL WARGA SEKOLAH', textX, logoY + 16);

  // Main School Name
  ctx.font = '900 18px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '0px';
  ctx.fillText('Sekolah Menengah Agama Ulu Jempol (SMAUJ)', textX, logoY + 44);

  // Subtitle / Reg Number
  ctx.font = '600 12.5px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = '#d1fae5'; // emerald-100
  ctx.fillText('Kod Sekolah: NFT0001 | Batu Kikir, Negeri Sembilan', textX, logoY + 68);

  // 6c. "AKTIF" Status Pill Badge (Top Right)
  const badgeW = 124;
  const badgeH = 38;
  const badgeX = width - badgeW - 45;
  const badgeY = 46;

  ctx.save();
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 19);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Checkmark circle
  ctx.beginPath();
  ctx.arc(badgeX + 22, badgeY + badgeH / 2, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.font = 'bold 12px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('✓', badgeX + 22, badgeY + badgeH / 2 + 4);

  ctx.font = '900 13px "Inter", Arial, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('AKTIF', badgeX + 68, badgeY + badgeH / 2 + 5);
  ctx.restore();

  // 7. Divider Ribbon
  ctx.save();
  const divGrad = ctx.createLinearGradient(45, 132, width - 45, 132);
  divGrad.addColorStop(0, 'rgba(110, 231, 183, 0)');
  divGrad.addColorStop(0.2, 'rgba(110, 231, 183, 0.6)');
  divGrad.addColorStop(0.8, 'rgba(110, 231, 183, 0.6)');
  divGrad.addColorStop(1, 'rgba(110, 231, 183, 0)');
  ctx.fillStyle = divGrad;
  ctx.fillRect(45, 132, width - 90, 2);
  ctx.restore();

  // 8. Official Member Number Panel (Full-Width Glassmorphic Box)
  const panelX = 45;
  const panelY = 148;
  const panelW = width - 90;
  const panelH = 78;

  ctx.save();
  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 20);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('NOMBOR KEAHLIAN RASMI', panelX + 26, panelY + 28);

  // Big Monospace Member Number
  ctx.font = '900 28px "Courier New", Courier, monospace';
  ctx.letterSpacing = '3.5px';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.memberNo || 'SMAUJ-2026-SAH', panelX + 26, panelY + 62);

  // Right side of panel: Verification seal
  ctx.textAlign = 'right';
  ctx.font = '800 11px "Inter", Arial, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillStyle = '#6ee7b7';
  ctx.fillText('STATUS: SAH BERDAFTAR', panelX + panelW - 26, panelY + 36);

  ctx.font = '500 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.letterSpacing = '0px';
  ctx.fillText('PENGKALAN DATA RASMI', panelX + panelW - 26, panelY + 56);
  ctx.restore();

  // 9. Member Details Grid (Left & Center) + QR Code (Right)
  // Column 1 (Left): Nama Ahli, Jawatan, No. IC
  const col1X = 55;
  const row1Y = 270;
  const row2Y = 356;
  const row3Y = 442;
  const row4Y = 526;

  // Nama Ahli
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('NAMA AHLI', col1X, row1Y);

  ctx.font = '900 18px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '0.5px';
  const truncatedName = (data.name || 'WARGA SMAUJ').toUpperCase();
  ctx.fillText(truncatedName.length > 28 ? `${truncatedName.slice(0, 26)}...` : truncatedName, col1X, row1Y + 26);

  // Jawatan / Peranan
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('JAWATAN / PERANAN', col1X, row2Y);

  ctx.font = '800 16px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#d1fae5';
  ctx.fillText(data.role || 'Ahli Biasa', col1X, row2Y + 24);

  // No. Kad Pengenalan
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('NO. KAD PENGENALAN', col1X, row3Y);

  ctx.font = '900 16px "Courier New", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '1.5px';
  ctx.fillText(data.icNumber || '-', col1X, row3Y + 24);

  // Status Kediaman
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.letterSpacing = '1px';
  ctx.fillText('STATUS KEDIAMAN', col1X, row4Y);

  ctx.font = '800 15px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#ecfdf5';
  ctx.letterSpacing = '0px';
  const displayStatusKediaman = (data.statusKediaman || '').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik (Sendiri)';
  ctx.fillText(displayStatusKediaman, col1X, row4Y + 22);

  // Column 2 (Center): No. Rumah, Alamat, No. Tel
  const col2X = 460;

  // No. Rumah
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.letterSpacing = '1px';
  ctx.fillText('NO. KEDIAMAN', col2X, row1Y);

  ctx.font = '900 18px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.noRumah ? `No. ${data.noRumah}` : '-', col2X, row1Y + 26);

  // Alamat Taman
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('ALAMAT KEDIAMAN', col2X, row2Y);

  ctx.font = '700 14px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  const cleanAddr = data.address || (data.noRumah ? `Ulu Jempol, No. ${data.noRumah}` : 'Ulu Jempol, 72200 Batu Kikir');
  ctx.fillText(cleanAddr.length > 32 ? `${cleanAddr.slice(0, 30)}...` : cleanAddr, col2X, row2Y + 24);

  // No. Telefon
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('NO. TELEFON', col2X, row3Y);

  ctx.font = '800 15px "Courier New", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.phone || '-', col2X, row3Y + 24);

  // Tempoh Sah
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('STATUS TEMPOH', col2X, row4Y);

  ctx.font = '800 15px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#6ee7b7';
  ctx.fillText('Keahlian Sah (Aktif)', col2X, row4Y + 22);

  // Column 3 (Right): Real Scannable QR Code
  const qrBoxSize = 170;
  const qrBoxX = width - qrBoxSize - 55;
  const qrBoxY = 265;

  ctx.save();
  // White Rounded Background for QR Code
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Generate QR Code Data URL with verification payload
  const currentHost = typeof window !== 'undefined' ? window.location.origin : '';
  const qrVerifyUrl = `${currentHost}/daftar?ahli=${encodeURIComponent(data.memberNo || 'SMAUJ')}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(qrVerifyUrl, {
      margin: 1,
      width: 148,
      color: {
        dark: '#064e3b', // deep emerald QR dots
        light: '#ffffff'
      }
    });
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, qrBoxX + 11, qrBoxY + 11, 148, 148);
  } catch (err) {
    console.warn('Gagal menjana QR Code pada Canvas:', err);
  }
  ctx.restore();

  // Text below QR Code
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('IMBAS KOD QR', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize + 22);

  ctx.font = '500 10px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('Untuk Pengesahan Digital', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize + 38);
  ctx.restore();

  // 10. Bottom Microtext Security Strip
  const footerY = height - 36;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, footerY, width, 36);

  ctx.textAlign = 'center';
  ctx.font = 'bold 8.5px "Inter", Arial, sans-serif';
  ctx.letterSpacing = '0.8px';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(
    'KAD PENGENALAN DIGITAL RASMI SEKOLAH MENENGAH AGAMA ULU JEMPOL (SMAUJ) • JHEAINS NEGERI SEMBILAN • HAK CIPTA TERPELIHARA',
    width / 2,
    footerY + 22
  );
  ctx.restore();

  return canvas;
}

/**
 * 1. Download High-Definition Image (PNG) for Phone Gallery & Digital Storage
 */
export async function downloadMembershipCardImage(data: MembershipCardData): Promise<void> {
  const canvas = await generateMembershipCardCanvas(data);
  const safeMemberNo = (data.memberNo || 'SMAUJ-AHLI').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Kad_Pengenalan_SMAUJ_${safeMemberNo}.png`;

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            if (document.body.contains(link)) {
              document.body.removeChild(link);
            }
            URL.revokeObjectURL(url);
            resolve();
          }, 200);
        } else {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            if (document.body.contains(link)) {
              document.body.removeChild(link);
            }
            resolve();
          }, 100);
        }
      }, 'image/png', 1.0);
    } catch {
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        resolve();
      }, 100);
    }
  });
}

/**
 * 2. Download Official Printable A4 PDF Certificate with Wallet Cut-Out Guide
 */
export async function downloadMembershipCardPdf(data: MembershipCardData): Promise<void> {
  // Generate high-resolution canvas first
  const canvas = await generateMembershipCardCanvas(data);
  const cardDataUrl = canvas.toDataURL('image/png', 1.0);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 18;

  // 1. Top Decorative Emerald Header Bar
  pdf.setFillColor(4, 120, 87); // #047857
  pdf.rect(0, 0, pageWidth, 5, 'F');

  // 2. Association Official Header (Letterhead)
  try {
    if (logoBase64) {
      pdf.addImage(logoBase64, 'PNG', margin, 12, 24, 24);
    }
  } catch (e) {
    console.warn('Gagal memuat naik logo ke PDF:', e);
  }

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42); // slate-900
  pdf.text('SEKOLAH MENENGAH AGAMA ULU JEMPOL (SMAUJ)', margin + 28, 19);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(71, 85, 105); // slate-600
  pdf.text('Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan Darul Khusus', margin + 28, 25);
  pdf.text('Kod Sekolah: NFT0001 | Emel: smaujn9@gmail.com', margin + 28, 30);

  // Horizontal Divider Line
  pdf.setDrawColor(226, 232, 240); // slate-200
  pdf.setLineWidth(0.5);
  pdf.line(margin, 39, pageWidth - margin, 39);

  // 3. Document Title
  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(14);
  pdf.setTextColor(4, 120, 87); // emerald-700
  pdf.text('PENGESAHAN PENDAFTARAN & KAD DIGITAL WARGA SEKOLAH', margin, 49);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(
    'Dokumen ini memperakui bahawa penama di bawah adalah warga berdaftar yang sah di SMAUJ.',
    margin,
    55
  );

  // 4. Centered Embedded Membership Card
  const cardW = 150; // mm
  const cardH = 92.8; // mm (maintains 1.615 ratio)
  const cardX = (pageWidth - cardW) / 2;
  const cardY = 64;

  pdf.addImage(cardDataUrl, 'PNG', cardX, cardY, cardW, cardH);

  // Cut-out Guide Dashed Border
  pdf.setDrawColor(148, 163, 184); // slate-400
  pdf.setLineWidth(0.3);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.roundedRect(cardX - 2, cardY - 2, cardW + 4, cardH + 4, 3, 3, 'S');

  // Dashed instruction text
  pdf.setFont('Helvetica', 'Oblique');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    '✂ Gunting mengikut garisan putus-putus di atas untuk simpanan dompet atau laminate kad fizikal anda.',
    pageWidth / 2,
    cardY + cardH + 7,
    { align: 'center' }
  );

  // Reset Dash Pattern
  pdf.setLineDashPattern([], 0);

  // 5. Member Details Particulars Table (Below Card)
  const tableY = cardY + cardH + 15;

  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.roundedRect(margin, tableY, pageWidth - margin * 2, 54, 3, 3, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(margin, tableY, pageWidth - margin * 2, 54, 3, 3, 'S');

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text('RINGKASAN MAKLUMAT AHLI BERDAFTAR', margin + 6, tableY + 8);

  const leftColX = margin + 6;
  const leftValX = margin + 46;
  const rightColX = margin + 92;
  const rightValX = margin + 132;

  pdf.setFontSize(8.5);

  // Row 1
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Nama Penuh:', leftColX, tableY + 17);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.name || '-', leftValX, tableY + 17);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('No. Keahlian:', rightColX, tableY + 17);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(4, 120, 87);
  pdf.text(data.memberNo || '-', rightValX, tableY + 17);

  // Row 2
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('No. Kad Pengenalan:', leftColX, tableY + 25);
  pdf.setFont('Helvetica', 'Normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.icNumber || '-', leftValX, tableY + 25);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Jawatan / Peranan:', rightColX, tableY + 25);
  pdf.setFont('Helvetica', 'Normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.role || 'Ahli Biasa', rightValX, tableY + 25);

  // Row 3
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('No. Rumah:', leftColX, tableY + 33);
  pdf.setFont('Helvetica', 'Normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.noRumah ? `No. ${data.noRumah}` : '-', leftValX, tableY + 33);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Status Keahlian:', rightColX, tableY + 33);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(16, 185, 129); // green
  pdf.text('AKTIF & SAH', rightValX, tableY + 33);

  // Row 4
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Alamat Kediaman:', leftColX, tableY + 41);
  pdf.setFont('Helvetica', 'Normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.address || 'Ulu Jempol, 72200 Batu Kikir, Negeri Sembilan', leftValX, tableY + 41);

  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Tarikh Pengeluaran:', rightColX, tableY + 41);
  pdf.setFont('Helvetica', 'Normal');
  pdf.setTextColor(15, 23, 42);
  const todayStr = new Date().toLocaleDateString('ms-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  pdf.text(todayStr, rightValX, tableY + 41);

  // Row 5
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('No. Telefon:', leftColX, tableY + 49);
  pdf.setFont('Helvetica', 'Normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.phone || '-', leftValX, tableY + 49);

  const pdfStatusKediaman = (data.statusKediaman || '').toLowerCase().includes('penyewa') ? 'Penyewa' : 'Pemilik (Sendiri)';
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Status Kediaman:', rightColX, tableY + 49);
  pdf.setFont('Helvetica', 'Bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(pdfStatusKediaman, rightValX, tableY + 49);

  // 6. Signatures and Verification Section
  const sigY = tableY + 62;

  pdf.setFont('Helvetica', 'Bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Disediakan Oleh:', margin + 6, sigY);
  pdf.text('Disahkan Oleh:', pageWidth - margin - 46, sigY);

  pdf.setFont('Helvetica', 'Normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Setiausaha PIBG / SMAUJ', margin + 6, sigY + 5);
  pdf.text('Pengetua / YDP SMAUJ', pageWidth - margin - 46, sigY + 5);

  // Signature dotted line
  pdf.setDrawColor(203, 213, 225);
  pdf.line(margin + 6, sigY + 20, margin + 50, sigY + 20);
  pdf.line(pageWidth - margin - 46, sigY + 20, pageWidth - margin, sigY + 20);

  pdf.setFontSize(7.5);
  pdf.text('(Tandatangan & Cop Rasmi)', margin + 6, sigY + 24);
  pdf.text('(Tandatangan & Cop Rasmi)', pageWidth - margin - 46, sigY + 24);

  // 7. Official Footer
  const footerPdfY = 286;
  pdf.setFont('Helvetica', 'Oblique');
  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    'Dokumen ini dicetak secara automatik daripada Portal Rasmi Sekolah Menengah Agama Ulu Jempol (SMAUJ).',
    pageWidth / 2,
    footerPdfY,
    { align: 'center' }
  );

  const safeMemberNo = (data.memberNo || 'SMAUJ-AHLI').replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`Kad_Pengenalan_SMAUJ_${safeMemberNo}.pdf`);
}
