import { BORDER_BAND, BOT_AVOID_MS, BOT_MINE_BEHIND, BOT_MINE_MS } from '@airclash/shared/constants.js'
import { angDiff, forward, inBorder, circleHitsAabb } from '@airclash/shared/combat.js'
import { halfAngle, trackRadius } from '@airclash/shared/formulas.js'

function nearestLiving(room, plane, attack) {
  let best = null
  let bestD = Infinity
  for (const other of room.players.values()) {
    if (other.id === plane.id || !other.alive) continue
    if (attack && other.choosing) continue
    const d = Math.hypot(other.x - plane.x, other.y - plane.y)
    if (d < bestD) {
      bestD = d
      best = other
    }
  }
  return best
}

function buildingAhead(area, plane) {
  const ahead = forward(plane.yaw, 90)
  const x = plane.x + ahead.x
  const y = plane.y + ahead.y
  return area.buildings.some((b) => circleHitsAabb(x, y, 12, b))
}

function someoneBehind(room, plane) {
  for (const other of room.players.values()) {
    if (other.id === plane.id || !other.alive || other.choosing) continue
    const dx = other.x - plane.x
    const dy = other.y - plane.y
    const fwd = dx * Math.sin(plane.yaw) + dy * Math.cos(plane.yaw)
    if (fwd < 0 && Math.hypot(dx, dy) <= BOT_MINE_BEHIND) return true
  }
  return false
}

/** Yaw, fire, and mine intentions. Trigger speed stays on plane.triggerMs (900ms for bots). */
export function botIntent(room, plane, now) {
  let yaw = 0
  if (inBorder(plane.x, plane.y, room.area, BORDER_BAND)) {
    const aim = Math.atan2(room.area.w / 2 - plane.x, room.area.h / 2 - plane.y)
    const d = angDiff(aim, plane.yaw)
    yaw = d > 0.05 ? 1 : d < -0.05 ? -1 : 0
  } else if (now < plane.avoidUntil) {
    yaw = plane.avoidDir
  } else if (buildingAhead(room.area, plane)) {
    plane.avoidDir = room.rng() < 0.5 ? -1 : 1
    plane.avoidUntil = now + BOT_AVOID_MS
    yaw = plane.avoidDir
  } else {
    const target = nearestLiving(room, plane, true)
    if (target) {
      const aim = Math.atan2(target.x - plane.x, target.y - plane.y)
      const d = angDiff(aim, plane.yaw)
      if (d > 0.04) yaw = 1
      else if (d < -0.04) yaw = -1
    }
  }

  let fire = false
  const target = nearestLiving(room, plane, true)
  if (target && now >= plane.joinShieldUntil && now - plane.lastFire >= plane.triggerMs) {
    const dist = Math.hypot(target.x - plane.x, target.y - plane.y)
    const aim = Math.atan2(target.x - plane.x, target.y - plane.y)
    const ang = Math.abs(angDiff(aim, plane.yaw))
    if (dist <= trackRadius(plane.level) && ang <= halfAngle(plane.level)) fire = true
  }

  let mine = false
  if (now >= plane.joinShieldUntil && now - plane.lastMineAt >= BOT_MINE_MS && someoneBehind(room, plane)) {
    mine = true
  }

  return { yaw, speed: 0, fire, mine }
}
