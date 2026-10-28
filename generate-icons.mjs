import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_ICON = path.join(__dirname, 'public', 'icon.png');
const OUTPUT_DIR = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512];

async function generateStandardIcons() {
  console.log('🎨 Generating standard icons...');
  for (const size of SIZES) {
    const buf = await sharp(SOURCE_ICON)
      .resize(size, size, { fit: 'contain', background: { r: 250, g: 248, b: 245, alpha: 1 } })
      .png({ quality: 75, compressionLevel: 9, palette: true, colors: 128 })
      .toBuffer();

    // Write icon-{size}.png and icon-{size}x{size}.png
    fs.writeFileSync(path.join(OUTPUT_DIR, `icon-${size}.png`), buf);
    fs.writeFileSync(path.join(OUTPUT_DIR, `icon-${size}x${size}.png`), buf);

    // Apple touch icons
    if ([152, 167, 180].includes(size)) {
      fs.writeFileSync(path.join(OUTPUT_DIR, `apple-touch-icon-${size}.png`), buf);
    }
  }
  // Default apple-touch-icon.png
  const apple180 = fs.readFileSync(path.join(OUTPUT_DIR, 'apple-touch-icon-180.png'));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'apple-touch-icon.png'), apple180);
}

async function generateMaskableIcons() {
  console.log('🎭 Generating maskable icons...');
  const maskableSizes = [192, 512];
  for (const size of maskableSizes) {
    const innerSize = Math.round(size * 0.8);
    const padding = Math.round((size - innerSize) / 2);

    const resizedBuffer = await sharp(SOURCE_ICON)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 250, g: 248, b: 245, alpha: 1 } })
      .png({ quality: 75, compressionLevel: 9, palette: true, colors: 128 })
      .toBuffer();

    const maskableBuf = await sharp(resizedBuffer)
      .extend({
        top: padding,
        bottom: size - innerSize - padding,
        left: padding,
        right: size - innerSize - padding,
        background: { r: 250, g: 248, b: 245, alpha: 1 }
      })
      .png({ quality: 75, compressionLevel: 9, palette: true, colors: 128 })
      .toBuffer();

    fs.writeFileSync(path.join(OUTPUT_DIR, `icon-maskable-${size}.png`), maskableBuf);
    fs.writeFileSync(path.join(OUTPUT_DIR, `icon-${size}x${size}-maskable.png`), maskableBuf);
  }
}

async function generateFavicon() {
  console.log('🌐 Generating favicon.ico...');
  const sizes = [16, 32, 48];
  const buffers = [];
  for (const size of sizes) {
    const buf = await sharp(SOURCE_ICON)
      .resize(size, size, { fit: 'contain', background: { r: 250, g: 248, b: 245, alpha: 0 } })
      .png()
      .toBuffer();
    buffers.push({ size, buffer: buf });
  }

  const numImages = buffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;

  let dataOffset = headerSize + dirSize;
  const dirEntries = [];
  const imageDataParts = [];

  for (const { size, buffer } of buffers) {
    dirEntries.push({
      width: size === 256 ? 0 : size,
      height: size === 256 ? 0 : size,
      dataSize: buffer.length,
      dataOffset: dataOffset
    });
    imageDataParts.push(buffer);
    dataOffset += buffer.length;
  }

  const totalSize = dataOffset;
  const ico = Buffer.alloc(totalSize);

  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(numImages, 4);

  for (let i = 0; i < dirEntries.length; i++) {
    const entry = dirEntries[i];
    const offset = headerSize + i * dirEntrySize;
    ico.writeUInt8(entry.width, offset);
    ico.writeUInt8(entry.height, offset + 1);
    ico.writeUInt8(0, offset + 2);
    ico.writeUInt8(0, offset + 3);
    ico.writeUInt16LE(1, offset + 4);
    ico.writeUInt16LE(32, offset + 6);
    ico.writeUInt32LE(entry.dataSize, offset + 8);
    ico.writeUInt32LE(entry.dataOffset, offset + 12);
  }

  let currentOffset = headerSize + dirSize;
  for (const buf of imageDataParts) {
    buf.copy(ico, currentOffset);
    currentOffset += buf.length;
  }

  const faviconPath = path.join(OUTPUT_DIR, 'favicon.ico');
  fs.writeFileSync(faviconPath, ico);
  console.log('  ✅ favicon.ico created');
}

async function main() {
  await generateStandardIcons();
  await generateMaskableIcons();
  await generateFavicon();
  console.log('✨ All icons generated successfully!');
}

main().catch(console.error);

