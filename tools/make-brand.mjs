// Builds web-ready brand files from the originals in assets/brand/.
// Run after replacing any brand image:  node tools/make-brand.mjs
//
// - Removes the dark background behind the logo (color-to-alpha) so it sits
//   cleanly on any site background. The logo itself is not redrawn or recolored.
// - Writes the trimmed logos to src/assets/brand/ (Astro optimizes them to AVIF/WebP).
// - Writes favicons, app icons, and the 1200x630 social image to public/.
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';

const SRC = 'assets/brand';
const OUT_ASSETS = 'src/assets/brand';
const OUT_PUBLIC = 'public';
const SITE_BG = { r: 11, g: 15, b: 20 }; // --bg #0B0F14

await mkdir(OUT_ASSETS, { recursive: true });

/** Average color of the image border = the background to remove. */
function borderColor(data, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  const add = (x, y) => { const i = (y * w + x) * 3; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  return [r / n, g / n, b / n];
}

/** Color-to-alpha: un-blends every pixel from the background color. */
async function removeBackground(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const bg = borderColor(data, w, h);
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    let a = 0;
    for (let c = 0; c < 3; c++) {
      const v = data[p * 3 + c], k = bg[c];
      const ac = v > k ? (v - k) / (255 - k) : (k - v) / k;
      if (ac > a) a = ac;
    }
    // Ignore compression noise in the dark background.
    a = a < 0.08 ? 0 : Math.min(1, (a - 0.08) / 0.92);
    for (let c = 0; c < 3; c++) {
      const k = bg[c];
      const v = a > 0 ? (data[p * 3 + c] - k) / a + k : 0;
      out[p * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    out[p * 4 + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } });
}

async function trimmed(img, pad = 8) {
  const buf = await img.png().toBuffer();
  return sharp(buf)
    .trim({ threshold: 1 })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// Logos with transparent background
const horizontal = await trimmed(await removeBackground(`${SRC}/logo-horizontal.png`));
await writeFile(`${OUT_ASSETS}/logo-horizontal.png`, horizontal);

const markBuf = await trimmed(await removeBackground(`${SRC}/logo-mark.png`), 6);
const markMeta = await sharp(markBuf).metadata();
const side = Math.max(markMeta.width, markMeta.height);
const mark = await sharp(markBuf)
  .resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await writeFile(`${OUT_ASSETS}/logo-mark.png`, mark);

// Icons: the mark on the site background, with a little breathing room
async function icon(size, padRatio = 0.1) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const m = await sharp(mark).resize(inner, inner).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...SITE_BG, alpha: 1 } } })
    .composite([{ input: m, gravity: 'center' }])
    .png()
    .toBuffer();
}
await writeFile(`${OUT_PUBLIC}/apple-touch-icon.png`, await icon(180));
await writeFile(`${OUT_PUBLIC}/icon-192.png`, await icon(192));
await writeFile(`${OUT_PUBLIC}/icon-512.png`, await icon(512));
await writeFile(`${OUT_PUBLIC}/icon-maskable-512.png`, await icon(512, 0.2));

// favicon.ico with 16, 32, 48 px PNG frames
const frames = await Promise.all([16, 32, 48].map((s) => icon(s, 0.02)));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((f, i) => {
  const s = [16, 32, 48][i], e = 6 + i * 16;
  header.writeUInt8(s, e); header.writeUInt8(s, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(f.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += f.length;
});
await writeFile(`${OUT_PUBLIC}/favicon.ico`, Buffer.concat([header, ...frames]));
await writeFile(`${OUT_PUBLIC}/favicon-32.png`, frames[1]);

// Social share image (Open Graph / Twitter): 1200x630
await sharp(`${SRC}/og-banner.png`)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(`${OUT_PUBLIC}/og-image.jpg`);

console.log('Brand files written.');
