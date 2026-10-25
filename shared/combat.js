/** Circle tests used by the server sim and the local training tasks. 2D only. */

export function wrapAngle(a) {
  let x = a
  while (x > Math.PI) x -= Math.PI * 2
  while (x < -Math.PI) x += Math.PI * 2
  return x
}

export function angDiff(a, b) {
  return wrapAngle(a - b)
}

/** Yaw 0 faces world +Y. Positive yaw turns the nose toward world +X. */
export function forward(yaw, dist = 1) {
  return { x: Math.sin(yaw) * dist, y: Math.cos(yaw) * dist }
}

export function hypot(ax, ay, bx, by) {
  const dx = ax - bx
  const dy = ay - by
  return Math.hypot(dx, dy)
}

export function circleHitsAabb(cx, cy, r, rect) {
  const x = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
  const y = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
  const dx = cx - x
  const dy = cy - y
  return dx * dx + dy * dy < r * r
}

export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / len2))
  const px = x1 + dx * t
  const py = y1 + dy * t
  const ex = px - cx
  const ey = py - cy
  return ex * ex + ey * ey <= r * r
}

export function separateCircles(a, b, minDist) {
  let dx = b.x - a.x
  let dy = b.y - a.y
  let d = Math.hypot(dx, dy)
  if (d >= minDist) return null
  if (d < 1e-6) {
    dx = 1
    dy = 0
    d = 1
  }
  const overlap = minDist - d
  const nx = dx / d
  const ny = dy / d
  a.x -= nx * (overlap / 2)
  a.y -= ny * (overlap / 2)
  b.x += nx * (overlap / 2)
  b.y += ny * (overlap / 2)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function inBorder(x, y, area, band) {
  return x < band || y < band || x > area.w - band || y > area.h - band
}

export function clampCenter(x, y, area) {
  return {
    x: Math.max(0, Math.min(area.w, x)),
    y: Math.max(0, Math.min(area.h, y)),
  }
}

/**
 * Nose-up camera. Yaw 0 faces world +Y. Forward is drawn toward the top of the canvas.
 * A future 3D view maps the same (x, y) onto a flat ground plane and does not add height here.
 */
export function worldToScreen(worldX, worldY, cam, viewW, viewH, zoom) {
  const dx = worldX - cam.x
  const dy = worldY - cam.y
  const right = dx * Math.cos(cam.yaw) - dy * Math.sin(cam.yaw)
  const fwd = dx * Math.sin(cam.yaw) + dy * Math.cos(cam.yaw)
  return {
    x: viewW / 2 + right * zoom,
    y: viewH / 2 - fwd * zoom,
  }
}
