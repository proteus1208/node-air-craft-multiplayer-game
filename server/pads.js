import {
  BONUS_FILL_MS,
  BONUS_PHASE_OPEN_SEC,
  BONUS_PITY_HP,
  BONUS_PITY_RADIUS,
  BUFF_DAMAGE_MS,
  BUFF_IMMUNE_MS,
  BUFF_SPEED_MS,
  HEAL_AMOUNT,
  PICKUP_RADIUS,
} from '@airclash/shared/constants.js'

export function initPads(area, now) {
  return area.pads.map((p, i) => ({
    padId: i,
    x: p.x,
    y: p.y,
    kind: null,
    emptySince: now,
    bonusId: 0,
  }))
}

function weighted(rand, table) {
  let sum = 0
  for (const row of table) sum += row[1]
  let r = rand() * sum
  for (const [kind, weight] of table) {
    r -= weight
    if (r <= 0) return kind
  }
  return table[table.length - 1][0]
}

function rollKind(room, fullTable) {
  const early = [
    ['heal', 30],
    ['speed', 25],
  ]
  const late = [
    ['heal', 30],
    ['speed', 25],
    ['shield', 20],
    ['damage', 15],
    ['immune', 10],
  ]
  let kind = weighted(room.rng, fullTable ? late : early)
  const has = (name) => room.pads.some((pad) => pad.kind === name)
  if ((kind === 'damage' && has('damage')) || (kind === 'immune' && has('immune'))) {
    kind = weighted(room.rng, [
      ['heal', 30],
      ['speed', 25],
      ['shield', 20],
    ])
  }
  return kind
}

function findPity(room, pad) {
  for (const plane of room.players.values()) {
    if (!plane.alive || plane.pityUsed) continue
    if (plane.maxHp <= 0 || plane.hp / plane.maxHp >= BONUS_PITY_HP) continue
    if (Math.hypot(plane.x - pad.x, plane.y - pad.y) <= BONUS_PITY_RADIUS) return plane
  }
  return null
}

function applyBonus(plane, kind, now) {
  if (kind === 'heal') plane.hp = Math.min(plane.maxHp, plane.hp + HEAL_AMOUNT)
  else if (kind === 'speed') plane.buffs.speedUntil = now + BUFF_SPEED_MS
  else if (kind === 'damage') plane.buffs.damageUntil = now + BUFF_DAMAGE_MS
  else if (kind === 'immune') plane.buffs.immuneUntil = now + BUFF_IMMUNE_MS
  else if (kind === 'shield') plane.shield = 1
}

export function stepPads(room, now) {
  const fullTable = room.firstKill || now - room.startedAt >= BONUS_PHASE_OPEN_SEC * 1000
  let oldest = null
  for (const pad of room.pads) {
    if (pad.kind) continue
    if (now - pad.emptySince < BONUS_FILL_MS) continue
    if (!oldest || pad.emptySince < oldest.emptySince) oldest = pad
  }
  if (oldest) {
    const pity = findPity(room, oldest)
    const kind = pity ? 'heal' : rollKind(room, fullTable)
    if (pity) pity.pityUsed = true
    oldest.kind = kind
    oldest.bonusId = room.nextId++
  }

  for (const plane of room.players.values()) {
    if (!plane.alive) continue
    for (const pad of room.pads) {
      if (!pad.kind) continue
      if (Math.hypot(plane.x - pad.x, plane.y - pad.y) > PICKUP_RADIUS + 36 * (plane.abilities?.magnet || 0)) continue
      applyBonus(plane, pad.kind, now)
      room.events.push({ t: 'pickup', id: plane.id, kind: pad.kind, x: pad.x, y: pad.y })
      room.events.push({ t: 'log', text: `${plane.name} grabbed ${pad.kind}` })
      pad.kind = null
      pad.emptySince = now
    }
  }
}
