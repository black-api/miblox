// HeUi — a minimal PNG encoder (RGBA, 8-bit) used to generate launcher
// icons without pulling in an image dependency.

import zlib from 'node:zlib';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Encodes RGBA pixels as a PNG.
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgba width * height * 4 bytes
 * @returns {Buffer}
 */
export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Draws the default HeUi launcher icon: a faceted gem on a dark panel.
 * @param {number} size
 * @returns {Buffer} PNG bytes
 */
export function createGemIcon(size = 192) {
  const rgba = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (y * size + x) * 4;
    rgba[offset] = r;
    rgba[offset + 1] = g;
    rgba[offset + 2] = b;
    rgba[offset + 3] = a;
  };

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      // Rounded square background.
      const corner = size * 0.22;
      const qx = Math.max(Math.abs(dx) - (radius - corner), 0);
      const qy = Math.max(Math.abs(dy) - (radius - corner), 0);
      if (Math.hypot(qx, qy) <= corner) {
        set(x, y, 13, 16, 32, 255);
      }
    }
  }

  // The gem: a hexagon with a bright top facet.
  const gemWidth = size * 0.30;
  const gemHeight = size * 0.36;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - cx) / gemWidth;
      const dy = (y - cy) / gemHeight;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        // Cut the corners to make a gem silhouette.
        const cut = Math.abs(dx) + Math.abs(dy);
        if (cut <= 1.35) {
          const t = (dy + 1) / 2;
          const r = Math.round(255 - t * 40);
          const g = Math.round(77 + t * 120);
          const b = Math.round(109 + t * 60);
          set(x, y, r, g, b, 255);
          if (dy < -0.1 && Math.abs(dx) < 0.35) {
            set(x, y, 255, 255, 255, 220);
          }
        }
      }
    }
  }

  return encodePng(size, size, rgba);
}
