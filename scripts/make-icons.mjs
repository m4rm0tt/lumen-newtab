// Dessine les icônes de l'extension (16, 32, 48, 128 px) et les écrit en PNG, sans dépendance.
// node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const mixColor = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));

// Superellipse (squircle) façon icône macOS.
function insideSquircle(x, y, r = 0.5, n = 5) {
  const dx = Math.abs(x - 0.5) / r;
  const dy = Math.abs(y - 0.5) / r;
  return Math.pow(dx, n) + Math.pow(dy, n) <= 1;
}

function shade(x, y, size) {
  // Marge : l'icône occupe ~88 % du canevas, comme le recommande Chrome.
  const m = size <= 16 ? 0.0 : 0.06;
  const u = (x - m) / (1 - 2 * m);
  const v = (y - m) / (1 - 2 * m);
  if (u < 0 || v < 0 || u > 1 || v > 1 || !insideSquircle(u, v)) return [0, 0, 0, 0];
  const t = Math.min(1, Math.max(0, (u * 0.45 + v * 0.75)));
  const top = [92, 76, 252];
  const mid = [176, 74, 214];
  const bottom = [255, 140, 96];
  let c = t < 0.55 ? mixColor(top, mid, t / 0.55) : mixColor(mid, bottom, (t - 0.55) / 0.45);
  // Lumière : disque blanc + halo.
  const cx = 0.5;
  const cy = 0.46;
  const d = Math.hypot(u - cx, v - cy);
  const core = 0.17;
  const halo = Math.max(0, 1 - (d - core) / 0.3);
  c = mixColor(c, [255, 236, 220], Math.pow(halo, 2.2) * 0.55);
  if (d < core) c = mixColor([255, 255, 255], [255, 244, 232], d / core);
  // Reflet léger en haut.
  if (v < 0.5) c = mixColor(c, [255, 255, 255], (0.5 - v) * 0.12);
  return [...c, 255];
}

for (const size of SIZES) {
  const ss = 4; // suréchantillonnage pour l'anticrénelage
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [pr, pg, pb, pa] = shade((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, size);
          r += pr * pa;
          g += pg * pa;
          b += pb * pa;
          a += pa;
        }
      }
      const i = (y * size + x) * 4;
      buf[i] = a ? Math.round(r / a) : 0;
      buf[i + 1] = a ? Math.round(g / a) : 0;
      buf[i + 2] = a ? Math.round(b / a) : 0;
      buf[i + 3] = Math.round(a / (ss * ss));
    }
  }
  writeFileSync(new URL(`icon-${size}.png`, OUT), png(size, buf));
  console.log(`icons/icon-${size}.png`);
}
