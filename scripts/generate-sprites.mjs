import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/public/assets')
fs.mkdirSync(out, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(body.length - 4)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function canvas(w, h) {
  const data = Buffer.alloc(w * h * 4)
  function set(x, y, r, g, b, a = 255) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    const sa = a / 255
    const da = data[i + 3] / 255
    const outA = sa + da * (1 - sa)
    if (outA <= 0) return
    data[i] = (r * sa + data[i] * da * (1 - sa)) / outA
    data[i + 1] = (g * sa + data[i + 1] * da * (1 - sa)) / outA
    data[i + 2] = (b * sa + data[i + 2] * da * (1 - sa)) / outA
    data[i + 3] = outA * 255
  }
  function circle(cx, cy, rad, col) {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) set(x, y, ...col)
      }
    }
  }
  function fill(x0, y0, x1, y1, col) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, ...col)
  }
  return { data, set, circle, fill, w, h }
}

function save(name, c) {
  fs.writeFileSync(path.join(out, name), png(c.w, c.h, c.data))
}

function poly(c, pts, col) {
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minY = Math.min(minY, p[1])
    maxY = Math.max(maxY, p[1])
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs = []
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[(i + 1) % pts.length]
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1)
        xs.push(x1 + t * (x2 - x1))
      }
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]); x <= xs[i + 1]; x++) c.set(x, y, ...col)
    }
  }
}

function plane(name, body, wing, accent) {
  const c = canvas(128, 128)
  poly(c, [[64, 8], [76, 36], [72, 108], [64, 118], [56, 108], [52, 36]], body)
  poly(c, [[58, 48], [10, 78], [16, 90], [60, 68]], wing)
  poly(c, [[70, 48], [118, 78], [112, 90], [68, 68]], wing)
  poly(c, [[56, 96], [28, 118], [36, 122], [60, 104]], wing)
  poly(c, [[72, 96], [100, 118], [92, 122], [68, 104]], wing)
  c.circle(64, 40, 7, accent)
  c.circle(64, 40, 3, [20, 28, 36])
  c.fill(60, 108, 68, 122, accent)
  save(name, c)
}

plane('plane-scout.png', [186, 214, 232], [92, 148, 186], [255, 255, 255])
plane('plane-falcon.png', [232, 196, 96], [176, 120, 48], [255, 244, 210])
plane('plane-hawk.png', [214, 96, 78], [140, 48, 42], [255, 220, 200])
plane('plane-condor.png', [168, 140, 230], [96, 70, 170], [236, 228, 255])
plane('plane-storm.png', [96, 196, 176], [36, 120, 108], [220, 255, 240])
plane('plane-apex.png', [230, 196, 90], [170, 120, 36], [255, 255, 255])
plane('plane-bot.png', [120, 128, 138], [70, 76, 86], [210, 90, 70])

{
  const c = canvas(48, 48)
  c.fill(22, 6, 26, 40, [255, 150, 60])
  c.circle(24, 36, 6, [255, 90, 40])
  c.circle(24, 10, 4, [255, 230, 180])
  save('rocket.png', c)
}
{
  const c = canvas(64, 64)
  c.circle(32, 34, 14, [40, 44, 52])
  c.circle(32, 34, 8, [255, 176, 48])
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    poly(c, [
      [32 + Math.cos(a) * 12, 34 + Math.sin(a) * 12],
      [32 + Math.cos(a + 0.18) * 28, 34 + Math.sin(a + 0.18) * 28],
      [32 + Math.cos(a - 0.18) * 28, 34 + Math.sin(a - 0.18) * 28],
    ], [230, 70, 54])
  }
  c.fill(30, 8, 34, 22, [90, 60, 40])
  c.circle(32, 8, 3, [255, 210, 80])
  save('mine.png', c)
}
{
  const c = canvas(96, 128)
  c.fill(44, 78, 52, 122, [92, 58, 32])
  poly(c, [[48, 8], [86, 70], [10, 70]], [36, 130, 62])
  poly(c, [[48, 28], [92, 96], [4, 96]], [52, 168, 78])
  c.circle(48, 18, 6, [180, 230, 160])
  save('tree.png', c)
}
{
  const c = canvas(96, 96)
  c.fill(16, 20, 80, 88, [70, 78, 96])
  c.fill(24, 28, 40, 48, [160, 200, 230])
  c.fill(52, 28, 68, 48, [160, 200, 230])
  save('building.png', c)
}
{
  const c = canvas(128, 128)
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = 64 + Math.cos(a) * 50
    const y = 64 + Math.sin(a) * 50
    c.circle(x, y, 4, [200, 210, 230, 220])
  }
  save('ring.png', c)
}
{
  const c = canvas(256, 256)
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const n = (x * 13 + y * 7) % 17
      const g = 70 + n
      c.set(x, y, 46, g, 42, 255)
    }
  }
  save('ground.png', c)
}

const icons = {
  'pickup-damage.png': [220, 70, 70],
  'pickup-immune.png': [120, 180, 255],
  'pickup-heal.png': [80, 200, 120],
  'pickup-speed.png': [255, 200, 60],
  'pickup-shield.png': [230, 230, 240],
}
for (const [name, col] of Object.entries(icons)) {
  const c = canvas(48, 48)
  c.circle(24, 24, 16, [...col, 255])
  c.circle(24, 24, 6, [255, 255, 255])
  save(name, c)
}

console.log('sprites written to', out)
