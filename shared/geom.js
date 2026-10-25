import {
  MINE_FADE_FAR,
  MINE_FADE_NEAR,
  TRACK_ANGLE_BASE,
  TRACK_ANGLE_CAP,
  TRACK_ANGLE_PER_LEVEL,
  TRACK_RADIUS_BASE,
  TRACK_RADIUS_PER_LEVEL,
  ROCKET_RANGE_BASE,
  ROCKET_RANGE_PER_LEVEL,
} from './constants.js'

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

export function angDiff(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

/** Yaw 0 faces world +Y. */
export function forwardOf(yaw) {
  return { x: Math.sin(yaw), y: Math.cos(yaw) }
}

export function trackRadius(level) {
  return TRACK_RADIUS_BASE + TRACK_RADIUS_PER_LEVEL * (level - 1)
}

export function halfAngle(level) {
  return Math.min(TRACK_ANGLE_CAP, TRACK_ANGLE_BASE + TRACK_ANGLE_PER_LEVEL * (level - 1))
}

export function rocketRange(level) {
  return ROCKET_RANGE_BASE + ROCKET_RANGE_PER_LEVEL * (level - 1)
}

/** Hidden when far, solid when near. Opacity rises as distance falls. */
export function mineOpacity(distance) {
  const t = (MINE_FADE_FAR - distance) / (MINE_FADE_FAR - MINE_FADE_NEAR)
  return clamp(t, 0, 1)
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx
  const dy = ay - by
  return Math.hypot(dx, dy)
}

/** True when the segment from (x0,y0) to (x1,y1) comes within `r` of (cx,cy). */
export function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) t = clamp(((cx - x0) * dx + (cy - y0) * dy) / len2, 0, 1)
  const px = x0 + dx * t
  const py = y0 + dy * t
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

export function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w)
  const ny = clamp(cy, rect.y, rect.y + rect.h)
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

/**
 * Nose-up camera. Local plane stays centered; +forward is the top of the screen.
 * A future 3D renderer maps (x, y) to ground X/Z and keeps height at 0 inside the renderer only.
 */
export function worldToScreen(x, y, cam, viewW, viewH, zoom) {
  const dx = x - cam.x
  const dy = y - cam.y
  const c = Math.cos(cam.yaw)
  const s = Math.sin(cam.yaw)
  const right = dx * c - dy * s
  const forward = dx * s + dy * c
  return [viewW / 2 + right * zoom, viewH / 2 - forward * zoom]
}
