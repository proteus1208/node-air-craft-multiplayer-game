import { BORDER_BAND, JOIN_SHIELD_MS, SHIELD_BLINK_FAST_MS, SHIELD_BLINK_SLOW_MS } from '@airclash/shared/constants.js'
import { mineOpacity, worldToScreen } from '@airclash/shared/geom.js'

const TILE = 256

function loadImage(src) {
  const img = new Image()
  img.src = src
  return img
}

const FILES = [
  'plane-scout', 'plane-falcon', 'plane-hawk', 'plane-condor', 'plane-storm', 'plane-apex', 'plane-bot',
  'rocket', 'mine', 'tree', 'building', 'ring', 'ground',
  'pickup-damage', 'pickup-immune', 'pickup-heal', 'pickup-speed', 'pickup-shield',
]

/**
 * 2D nose-up view of a flat world.
 * Do not read a height from the frame. A Three.js replacement maps x,y to X,Z at height 0.
 */
export function createCanvasRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  const images = {}
  for (const name of FILES) images[name] = loadImage(`/assets/${name}.png`)
  images.ground = loadImage('/assets/ground.png?v=2')
  const vfx = []
  let seenEvents = -1

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = canvas.clientWidth || 800
    const h = canvas.clientHeight || 600
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { w, h }
  }

  function draw(frame) {
    const { w, h } = resize()
    const zoom = w < 700 ? 0.8 : 1
    const me = frame.me
    const cam = me ? { x: me.x, y: me.y, yaw: me.yaw } : { x: 0, y: 0, yaw: 0 }
    ctx.clearRect(0, 0, w, h)
    if (frame.area) {
      drawGround(ctx, images.ground, frame.area, cam, w, h, zoom)
    } else {
      drawSky(ctx, w, h)
    }
    if (frame.events && frame.eventStamp !== seenEvents) {
      seenEvents = frame.eventStamp
      for (const ev of frame.events) {
        const kind = ev.t || ev.type
        if (kind === 'blast' || kind === 'bomb' || kind === 'spark' || kind === 'death' || kind === 'hit') {
          const type = ev.kind === 'bomb' ? 'bomb' : kind === 'spark' ? 'spark' : kind === 'death' ? 'death' : 'blast'
          vfx.push({ ...ev, type, born: performance.now() })
        }
      }
    }
    for (const tree of frame.area?.trees || []) drawSprite(ctx, images.tree, tree.x, tree.y, 64, 86, 0, cam, w, h, zoom)
    for (const bonus of frame.bonuses || []) drawBonus(ctx, bonus, cam, w, h, zoom)
    for (const mine of frame.mines || []) {
      const alpha = me ? mineOpacity(Math.hypot(mine.x - me.x, mine.y - me.y)) : 1
      if (alpha <= 0.02) continue
      ctx.globalAlpha = alpha
      drawSprite(ctx, images.mine, mine.x, mine.y, 36, 36, 0, cam, w, h, zoom)
      ctx.globalAlpha = 1
    }
    for (const rocket of frame.rockets || []) {
      drawSprite(ctx, images.rocket, rocket.x, rocket.y, 22, 22, rocket.heading - cam.yaw, cam, w, h, zoom)
      puffSmoke(rocket, cam)
    }
    for (const plane of frame.planes || []) {
      if (!plane.alive && plane !== me) continue
      const bot = !!plane.bot
      const img = bot ? images['plane-bot'] : (images[`plane-${plane.type || 'scout'}`] || images['plane-scout'])
      const dw = bot ? 36 : 58
      const dh = bot ? 46 : 74
      const rot = plane.id === me?.id ? 0 : plane.yaw - cam.yaw
      if (plane.id === me?.id) {
        ctx.save()
        ctx.translate(w / 2, h / 2)
        if (img?.complete && img.naturalWidth) ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
        else {
          ctx.fillStyle = '#d7e6f2'
          ctx.beginPath()
          ctx.moveTo(0, -30)
          ctx.lineTo(8, 8)
          ctx.lineTo(26, 16)
          ctx.lineTo(8, 22)
          ctx.lineTo(0, 34)
          ctx.lineTo(-8, 22)
          ctx.lineTo(-26, 16)
          ctx.lineTo(-8, 8)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      } else {
        drawSprite(ctx, img, plane.x, plane.y, dw, dh, rot, cam, w, h, zoom)
      }
      if (plane.choosing) drawSprite(ctx, images.ring, plane.x, plane.y, 90, 90, -cam.yaw, cam, w, h, zoom)
      drawShield(ctx, plane, cam, w, h, zoom, frame.now)
      drawBar(ctx, plane, cam, w, h, zoom, plane.id === me?.id)
    }
    drawVfx(vfx, ctx, cam, w, h, zoom)
    if (frame.area && cam) drawFog(ctx, frame.area, cam, w, h)
    drawMinimap(ctx, frame, w, h)
  }

  function puffSmoke(rocket) {
    const last = rocket._smoke || 0
    if (Math.hypot(rocket.x - (rocket._sx || rocket.x), rocket.y - (rocket._sy || rocket.y)) < 18 && last) {
      rocket._sx = rocket.x
      rocket._sy = rocket.y
      return
    }
    rocket._sx = rocket.x
    rocket._sy = rocket.y
    if (vfx.length < 240) vfx.push({ type: 'smoke', x: rocket.x, y: rocket.y, born: performance.now() })
    rocket._smoke = last + 1
  }

  function destroy() {
    vfx.length = 0
  }

  return { draw, destroy }
}

function drawSky(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#6ec8ea')
  sky.addColorStop(0.55, '#b7e3f2')
  sky.addColorStop(1, '#f6d7a2')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
}

function cloudHash(seed, x, y) {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

function drawClouds(ctx, cam, w, h, zoom, seed) {
  const cell = 820
  const minX = Math.floor((cam.x - 1600) / cell) * cell
  const minY = Math.floor((cam.y - 1600) / cell) * cell
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  for (let y = minY; y < cam.y + 1600; y += cell) {
    for (let x = minX; x < cam.x + 1600; x += cell) {
      const n = cloudHash(seed, x / cell, y / cell)
      const [sx, sy] = worldToScreen(x + (n % 240) - 80, y + ((n >>> 8) % 240) - 80, cam, w, h, zoom)
      ctx.beginPath()
      ctx.ellipse(sx, sy, 78, 26, 0, 0, Math.PI * 2)
      ctx.ellipse(sx + 34, sy + 4, 46, 20, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawGround(ctx, img, area, cam, w, h, zoom) {
  if (!img.complete) return
  const minX = Math.floor((cam.x - 900) / TILE) * TILE
  const minY = Math.floor((cam.y - 900) / TILE) * TILE
  for (let ty = minY; ty < cam.y + 900; ty += TILE) {
    for (let tx = minX; tx < cam.x + 900; tx += TILE) {
      const [ox, oy] = worldToScreen(tx, ty, cam, w, h, zoom)
      const [rx, ry] = worldToScreen(tx + TILE, ty, cam, w, h, zoom)
      const [ux, uy] = worldToScreen(tx, ty + TILE, cam, w, h, zoom)
      ctx.save()
      ctx.setTransform(
        (rx - ox) / TILE * (ctx.getTransform?.().a || 1),
        0,
        0,
        1,
        0,
        0,
      )
      ctx.restore()
      ctx.save()
      const dpr = (canvasDpr(ctx))
      ctx.setTransform(
        ((rx - ox) / TILE) * dpr,
        ((ry - oy) / TILE) * dpr,
        ((ux - ox) / TILE) * dpr,
        ((uy - oy) / TILE) * dpr,
        ox * dpr,
        oy * dpr,
      )
      ctx.drawImage(img, 0, 0, TILE, TILE)
      ctx.restore()
    }
  }
}

function canvasDpr(ctx) {
  const t = ctx.getTransform()
  return t.a || 1
}

function drawFog(ctx, area, cam, w, h) {
  const band = BORDER_BAND
  const ix = Math.max(0, band - cam.x, cam.x - (area.w - band))
  const iy = Math.max(0, band - cam.y, cam.y - (area.h - band))
  const out = Math.hypot(ix, iy)
  if (out <= 1) return
  const t = Math.min(1, out / 320)
  const fog = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.72)
  fog.addColorStop(0, `rgba(214, 224, 228, ${0.04 + t * 0.2})`)
  fog.addColorStop(0.55, `rgba(198, 208, 214, ${0.18 + t * 0.35})`)
  fog.addColorStop(1, `rgba(176, 186, 194, ${0.4 + t * 0.5})`)
  ctx.fillStyle = fog
  ctx.fillRect(0, 0, w, h)
}

function rect(ctx, x, y, rw, rh, cam, w, h, zoom) {
  const pts = [
    [x, y],
    [x + rw, y],
    [x + rw, y + rh],
    [x, y + rh],
  ].map(([px, py]) => worldToScreen(px, py, cam, w, h, zoom))
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
  ctx.closePath()
  ctx.fill()
}

function drawBonus(ctx, bonus, cam, w, h, zoom) {
  const [sx, sy] = worldToScreen(bonus.x, bonus.y, cam, w, h, zoom)
  if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) return
  const colors = {
    heal: '#3ddc7a',
    speed: '#ffd15a',
    shield: '#f4f7fb',
    damage: '#ff5d4a',
    immune: '#7eb6ff',
  }
  ctx.save()
  ctx.translate(sx, sy)
  ctx.fillStyle = colors[bonus.kind] || '#fff'
  ctx.strokeStyle = '#1b1408'
  ctx.lineWidth = 2
  ctx.beginPath()
  if (bonus.kind === 'heal') {
    ctx.moveTo(0, -12)
    ctx.lineTo(12, 0)
    ctx.lineTo(0, 12)
    ctx.lineTo(-12, 0)
  } else if (bonus.kind === 'speed') {
    ctx.moveTo(0, -14)
    ctx.lineTo(12, 6)
    ctx.lineTo(4, 6)
    ctx.lineTo(4, 14)
    ctx.lineTo(-4, 14)
    ctx.lineTo(-4, 6)
    ctx.lineTo(-12, 6)
  } else if (bonus.kind === 'shield') {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2
      const x = Math.cos(a) * 13
      const y = Math.sin(a) * 13
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  } else if (bonus.kind === 'damage') {
    ctx.moveTo(0, -14)
    ctx.lineTo(5, -4)
    ctx.lineTo(14, 0)
    ctx.lineTo(5, 4)
    ctx.lineTo(0, 14)
    ctx.lineTo(-5, 4)
    ctx.lineTo(-14, 0)
    ctx.lineTo(-5, -4)
  } else {
    ctx.arc(0, 0, 11, 0, Math.PI * 2)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawMinimap(ctx, frame, w, h) {
  const area = frame.area
  if (!area?.w || !area?.h) return
  const size = Math.min(220, Math.floor(Math.min(w, h) * 0.34))
  const pad = 14
  const x0 = w - size - pad
  const y0 = h - size - pad
  ctx.save()
  ctx.fillStyle = 'rgba(8, 12, 18, 0.78)'
  ctx.fillRect(x0, y0, size, size)
  ctx.strokeStyle = '#3d5168'
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1)
  const sx = (x) => x0 + (x / area.w) * size
  const sy = (y) => y0 + (y / area.h) * size
  for (const plane of frame.planes || []) {
    if (!plane.alive) continue
    ctx.fillStyle = plane.id === frame.me?.id ? '#e0b15a' : plane.bot ? '#8b939e' : '#f4f7fb'
    ctx.beginPath()
    ctx.arc(sx(plane.x), sy(plane.y), plane.id === frame.me?.id ? 3.5 : 2.4, 0, Math.PI * 2)
    ctx.fill()
    if (plane.id === frame.me?.id) {
      ctx.strokeStyle = '#e0b15a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx(plane.x), sy(plane.y))
      ctx.lineTo(sx(plane.x) + Math.sin(plane.yaw) * 8, sy(plane.y) + Math.cos(plane.yaw) * 8)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawSprite(ctx, img, x, y, dw, dh, rot, cam, w, h, zoom) {
  const [sx, sy] = worldToScreen(x, y, cam, w, h, zoom)
  if (sx < -120 || sy < -120 || sx > w + 120 || sy > h + 120) return
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(rot)
  if (img?.complete && img.naturalWidth) ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
  else {
    ctx.fillStyle = '#d7e2ef'
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh)
  }
  ctx.restore()
}

function drawShield(ctx, plane, cam, w, h, zoom, now) {
  if (!plane.joinShieldUntil || !now || now >= plane.joinShieldUntil) return
  const remaining = plane.joinShieldUntil - now
  const u = 1 - remaining / JOIN_SHIELD_MS
  const period = SHIELD_BLINK_SLOW_MS + (SHIELD_BLINK_FAST_MS - SHIELD_BLINK_SLOW_MS) * Math.min(1, Math.max(0, u))
  const phase = Math.floor((JOIN_SHIELD_MS - remaining) / (period / 2))
  if (phase % 2 === 1) return
  const [sx, sy] = worldToScreen(plane.x, plane.y, cam, w, h, zoom)
  ctx.save()
  ctx.strokeStyle = 'rgba(120, 220, 255, 0.9)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(sx, sy, 34, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawBar(ctx, plane, cam, w, h, zoom, self) {
  const [sx, sy] = worldToScreen(plane.x, plane.y, cam, w, h, zoom)
  const x = self ? w / 2 : sx
  const y = (self ? h / 2 : sy) - 48
  const width = 36
  const frac = Math.max(0, plane.hp / (plane.maxHp || 1))
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(x - width / 2, y, width, 4)
  ctx.fillStyle = frac >= 0.6 ? '#3ddc7a' : frac >= 0.3 ? '#e6c14a' : '#e15b4a'
  ctx.fillRect(x - width / 2, y, width * frac, 4)
  ctx.strokeStyle = plane.bot ? '#9aa4b2' : self ? '#e8c56b' : '#ffffff'
  ctx.strokeRect(x - width / 2, y, width, 4)
  ctx.fillStyle = ctx.strokeStyle
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${plane.bot ? 'BOT ' : ''}${plane.name}  Lv ${plane.level}`, x, y - 6)
}

function drawVfx(vfx, ctx, cam, w, h, zoom) {
  const now = performance.now()
  for (let i = vfx.length - 1; i >= 0; i--) {
    const p = vfx[i]
    const age = now - p.born
    const life = p.type === 'smoke' ? 400 : p.type === 'bomb' ? 360 : 280
    if (age > life) {
      vfx.splice(i, 1)
      continue
    }
    const [sx, sy] = worldToScreen(p.x, p.y, cam, w, h, zoom)
    const t = age / life
    ctx.beginPath()
    if (p.type === 'smoke') {
      ctx.fillStyle = `rgba(180,180,180,${0.45 * (1 - t)})`
      ctx.arc(sx, sy, 3 + 7 * t, 0, Math.PI * 2)
      ctx.fill()
    } else if (p.type === 'spark') {
      ctx.strokeStyle = `rgba(255,255,255,${1 - t})`
      ctx.moveTo(sx - 6, sy)
      ctx.lineTo(sx + 6, sy)
      ctx.stroke()
    } else {
      const radius = p.type === 'bomb' ? 10 + 36 * t : 6 + 22 * t
      ctx.strokeStyle = p.type === 'bomb' ? `rgba(255,220,120,${1 - t})` : `rgba(255,140,60,${1 - t})`
      ctx.lineWidth = 2
      ctx.arc(sx, sy, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}
