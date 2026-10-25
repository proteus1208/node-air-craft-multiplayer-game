import {
  AREA_W_MIN,
  AREA_W_MAX,
  AREA_H_MIN,
  AREA_H_MAX,
  AREA_INSET,
  BUILDING_MIN,
  BUILDING_MAX,
  BUILDING_SIDE_MIN,
  BUILDING_SIDE_MAX,
  BUILDING_GAP,
  BUILDING_TRIES,
  TREE_MIN,
  TREE_MAX,
  TREE_RADIUS,
  TREE_BUILDING_PAD,
  SPAWN_COUNT,
  SPAWN_GAP,
  SPAWN_GAP_MIN,
  SPAWN_GAP_STEP,
  SPAWN_INSET,
  PAD_COUNT,
  PAD_GAP,
  PAD_SPAWN_GAP,
} from './constants.js'
import { circleHitsAabb } from './combat.js'

/** Mulberry32. The stream is a pure function of the seed. */
export function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function range(rand, min, max) {
  return min + rand() * (max - min)
}

function irange(rand, min, maxInclusive) {
  return min + Math.floor(rand() * (maxInclusive - min + 1))
}

function rectsTooClose(a, b, gap) {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  )
}

function insideMargin(x, y, w, h, inset) {
  return x >= inset && y >= inset && x <= w - inset && y <= h - inset
}

function farFrom(points, x, y, gap) {
  for (const p of points) {
    const dx = p.x - x
    const dy = p.y - y
    if (dx * dx + dy * dy < gap * gap) return false
  }
  return true
}

function clearOfBuildings(buildings, x, y, pad) {
  for (const b of buildings) {
    if (circleHitsAabb(x, y, pad, b)) return false
  }
  return true
}

/**
 * Build a match map. Same seed always returns the same rectangles.
 * The object is {seed, w, h, buildings, trees, spawns, pads}. No height field.
 */
export function generateArea(seed) {
  const rand = mulberry32(seed >>> 0)
  const w = Math.round(range(rand, AREA_W_MIN, AREA_W_MAX))
  const h = Math.round(range(rand, AREA_H_MIN, AREA_H_MAX))
  const buildings = []

  const trees = []
  const treeCount = irange(rand, TREE_MIN, TREE_MAX)
  for (let i = 0; i < treeCount; i++) {
    for (let t = 0; t < 30; t++) {
      const x = Math.round(range(rand, AREA_INSET + TREE_RADIUS, w - AREA_INSET - TREE_RADIUS))
      const y = Math.round(range(rand, AREA_INSET + TREE_RADIUS, h - AREA_INSET - TREE_RADIUS))
      let hit = false
      for (const b of buildings) {
        const inflated = {
          x: b.x - TREE_BUILDING_PAD,
          y: b.y - TREE_BUILDING_PAD,
          w: b.w + TREE_BUILDING_PAD * 2,
          h: b.h + TREE_BUILDING_PAD * 2,
        }
        if (circleHitsAabb(x, y, TREE_RADIUS, inflated)) {
          hit = true
          break
        }
      }
      if (hit) continue
      trees.push({ x, y, r: TREE_RADIUS })
      break
    }
  }

  const spawns = []
  let gap = SPAWN_GAP
  while (spawns.length < SPAWN_COUNT && gap >= SPAWN_GAP_MIN) {
    let progressed = false
    for (let t = 0; t < 80 && spawns.length < SPAWN_COUNT; t++) {
      const x = Math.round(range(rand, SPAWN_INSET, w - SPAWN_INSET))
      const y = Math.round(range(rand, SPAWN_INSET, h - SPAWN_INSET))
      if (!farFrom(spawns, x, y, gap)) continue
      if (!clearOfBuildings(buildings, x, y, 36)) continue
      spawns.push({ x, y })
      progressed = true
    }
    if (!progressed || spawns.length < SPAWN_COUNT) gap -= SPAWN_GAP_STEP
  }
  let guard = 0
  while (spawns.length < SPAWN_COUNT && guard < 400) {
    guard++
    const col = spawns.length % 5
    const row = Math.floor(spawns.length / 5)
    const x = Math.round(SPAWN_INSET + ((w - SPAWN_INSET * 2) * (col + 0.5)) / 5)
    const y = Math.round(SPAWN_INSET + ((h - SPAWN_INSET * 2) * (row + 0.5)) / 4)
    if (!insideMargin(x, y, w, h, 80)) continue
    spawns.push({ x, y })
  }

  const pads = []
  for (let i = 0; i < PAD_COUNT; i++) {
    let placed = null
    for (let t = 0; t < 80; t++) {
      const x = Math.round(range(rand, AREA_INSET, w - AREA_INSET))
      const y = Math.round(range(rand, AREA_INSET, h - AREA_INSET))
      if (!farFrom(pads, x, y, PAD_GAP)) continue
      if (!farFrom(spawns, x, y, PAD_SPAWN_GAP)) continue
      if (!clearOfBuildings(buildings, x, y, 30)) continue
      placed = { x, y }
      break
    }
    if (!placed) {
      const x = Math.round(AREA_INSET + ((w - AREA_INSET * 2) * (i + 1)) / (PAD_COUNT + 1))
      const y = Math.round(h / 2 + ((i % 2 === 0 ? -1 : 1) * h) / 6)
      placed = { x: Math.max(AREA_INSET, Math.min(w - AREA_INSET, x)), y: Math.max(AREA_INSET, Math.min(h - AREA_INSET, y)) }
    }
    pads.push(placed)
  }

  return { seed: seed >>> 0, w, h, buildings, trees, spawns, pads }
}
