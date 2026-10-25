import { mulberry32 } from '../shared/area.js'
import {
  angDiff,
  forward,
  hypot,
  inBorder,
  wrapAngle,
} from '../shared/combat.js'
import {
  BORDER_BAND,
  BORDER_DPS,
  BOT_ROCKET_RECHARGE_MS,
  BOT_YAW_RATE,
  JOIN_SHIELD_MS,
  LEVELUP_CHOOSE_MS,
  MAX_LEVEL,
  MAX_PLANES,
  MINE_LIFETIME_MS,
  MINE_RADIUS,
  MINE_REFILL_MS,
  NOSE_OFFSET,
  PLANE_RADIUS,
  RESPAWN_MS,
  ROCKET_RADIUS,
  ROCKET_RECHARGE_MS,
  ROCKET_SPEED,
  ROCKET_SPREAD_RAD,
  ROCKET_TURN_RAD_PER_SEC,
  TICK_HZ,
  YAW_RATE,
} from '../shared/constants.js'
import {
  flightSpeed,
  guardChance,
  guardPrepMs,
  halfAngle,
  maxHpForLevel,
  mineRefillMs,
  mineStockMax,
  rocketRange,
  rocketRechargeMs,
  rocketStockMax,
  stepThrottle,
  trackRadius,
  triggerInterval,
  weaponDamage,
} from '../shared/formulas.js'
import { typeOf, xpGain, xpToNext } from '../shared/level.js'
import { PICK_STATS } from '../shared/protocol.js'
import { ABILITY_LIST, emptyAbilities, rollOffers } from '../shared/abilities.js'
import { emptyInput, rankPlanes } from '../shared/world.js'
import { botIntent } from './bots.js'
import { initPads, stepPads } from './pads.js'

const DT = 1 / TICK_HZ

function shuffle(list, rand) {
  const copy = list.map((p) => ({ x: p.x, y: p.y }))
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const swap = copy[i]
    copy[i] = copy[j]
    copy[j] = swap
  }
  return copy
}

export function createMatch({ code, source, seed, area, endRule, endValue, now, hostId }) {
  const numericSeed = seed >>> 0
  return {
    code,
    source,
    seed: numericSeed,
    area,
    endRule,
    endValue,
    mode: 'survival',
    hostId: hostId || null,
    phase: 'play',
    startedAt: now,
    endsAt: endRule === 'time' ? now + endValue * 1000 : null,
    players: new Map(),
    rockets: [],
    mines: [],
    pads: initPads(area, now),
    events: [],
    tick: 0,
    rng: mulberry32((numericSeed + 1) >>> 0),
    nextId: 1,
    spawnOrder: shuffle(area.spawns, mulberry32(numericSeed)),
    firstKill: false,
    winnerId: null,
    endedAt: null,
    emptySince: null,
    lobby: [],
  }
}

export function takeSpawn(room) {
  const living = [...room.players.values()].filter((p) => p.alive)
  for (const spot of room.spawnOrder) {
    if (living.every((p) => Math.hypot(p.x - spot.x, p.y - spot.y) > 48)) return spot
  }
  return room.spawnOrder[room.players.size % Math.max(1, room.spawnOrder.length)] || {
    x: room.area.w / 2,
    y: room.area.h / 2,
  }
}

export function addPlane(room, opts) {
  const id = opts.id || `${opts.bot ? 'b' : 'p'}${room.nextId++}`
  const plane = {
    id,
    name: opts.name,
    bot: !!opts.bot,
    level: opts.level || 1,
    xp: 0,
    stars: 0,
    ranks: { hp: 0, speed: 0, damage: 0, shield: 0, trigger: 0, mine: 0 },
    x: opts.x,
    y: opts.y,
    yaw: opts.yaw || 0,
    throttle: opts.throttle ?? 0.65,
    hp: opts.hp ?? 100,
    maxHp: opts.maxHp ?? 100,
    kills: 0,
    deaths: 0,
    shield: 0,
    joinShieldUntil: (opts.now || 0) + JOIN_SHIELD_MS,
    buffs: { damageUntil: 0, immuneUntil: 0, speedUntil: 0 },
    alive: true,
    choosing: false,
    levelUpUntil: 0,
    shownType: typeOf(opts.level || 1),
    triggerMs: opts.bot ? 900 : 380,
    lastFire: (opts.now || 0) - 100000,
    lastSpeedStep: opts.now || 0,
    lastMineAt: opts.now || 0,
    mineStock: 2,
    mineNextAt: 0,
    rocketStock: 3,
    rocketNextAt: 0,
    mineHeld: false,
    input: emptyInput(),
    lastSeq: 0,
    prevX: opts.x,
    prevY: opts.y,
    respawnAt: 0,
    pityUsed: false,
    disconnected: false,
    disconnectAt: 0,
    avoidUntil: 0,
    avoidDir: 1,
    token: opts.token || null,
    joinedAt: opts.now || 0,
    shotsFired: 0,
    remove: false,
    abilities: emptyAbilities(),
    offers: [],
    guardNext: 0,
  }
  plane.triggerMs = triggerInterval(plane.level, plane.bot)
  plane.rocketStock = rocketStockMax(plane.level, plane.bot)
  plane.mineStock = mineStockMax(plane.level)
  plane.maxHp = maxHpForLevel(plane.level, 0)
  plane.hp = plane.maxHp
  room.players.set(id, plane)
  return plane
}

export function fillBots(room, now) {
  let guard = 0
  while (room.players.size < MAX_PLANES && guard < MAX_PLANES) {
    guard += 1
    const spot = takeSpawn(room)
    const names = new Set([...room.players.values()].filter((p) => p.bot).map((p) => p.name))
    let n = 1
    while (names.has(`Bot ${n}`)) n += 1
    addPlane(room, { name: `Bot ${n}`, bot: true, x: spot.x, y: spot.y, yaw: room.rng() * Math.PI * 2, now })
  }
}

export function evictLowestBot(room) {
  const bots = [...room.players.values()].filter((p) => p.bot)
  if (!bots.length) return null
  bots.sort((a, b) => a.level - b.level || a.kills - b.kills || a.name.localeCompare(b.name))
  room.players.delete(bots[0].id)
  return bots[0]
}

export function setInput(room, id, msg) {
  const plane = room.players.get(id)
  if (!plane || plane.bot || plane.disconnected) return
  if (typeof msg.seq !== 'number' || msg.seq <= plane.lastSeq) return
  if (![-1, 0, 1].includes(msg.yaw) || ![-1, 0, 1].includes(msg.speed)) return
  if (typeof msg.fire !== 'boolean' || typeof msg.mine !== 'boolean') return
  plane.lastSeq = msg.seq
  plane.input = { yaw: msg.yaw, speed: msg.speed, fire: msg.fire, mine: msg.mine }
}

function moveBody(_area, _x, _y, nx, ny) {
  return { x: nx, y: ny }
}

function chargeFrac(stock, max, nextAt, now, interval) {
  if (!max || stock >= max || !nextAt) return 1
  return Math.max(0, Math.min(1, 1 - (nextAt - now) / interval))
}

function refillStock(current, nextAt, max, now, interval) {
  if (current >= max) return { current, nextAt: 0 }
  let next = nextAt || now + interval
  let stock = current
  if (now >= next) {
    stock += 1
    next = stock < max ? now + interval : 0
  }
  return { current: stock, nextAt: next }
}

function refillMines(plane, now) {
  const max = mineStockMax(plane.level)
  const next = refillStock(plane.mineStock, plane.mineNextAt, max, now, mineRefillMs(plane.level))
  plane.mineStock = next.current
  plane.mineNextAt = next.nextAt
}

function refillRockets(plane, now) {
  const max = rocketStockMax(plane.level, plane.bot)
  const next = refillStock(plane.rocketStock, plane.rocketNextAt, max, now, rocketRechargeMs(plane.level, plane.bot))
  plane.rocketStock = next.current
  plane.rocketNextAt = next.nextAt
}

function applyGrowth(plane) {
  const before = plane.maxHp
  plane.maxHp = maxHpForLevel(plane.level, plane.abilities.hull || 0)
  if (plane.maxHp > before) plane.hp = Math.min(plane.maxHp, plane.hp + (plane.maxHp - before))
  plane.triggerMs = triggerInterval(plane.level, plane.bot)
}

function grantAbility(room, plane, id) {
  if (!PICK_STATS.includes(id) || (plane.abilities[id] || 0) >= 5) return false
  plane.abilities[id] += 1
  if (id === 'hull') applyGrowth(plane)
  const name = ABILITY_LIST.find((row) => row.id === id)?.name || id
  room.events.push({ t: 'log', text: `${plane.name} learned ${name}` })
  return true
}

function tryOpenLevel(room, plane, now) {
  if (!plane.alive || plane.choosing || plane.level >= MAX_LEVEL) return
  const need = xpToNext(plane.level)
  if (need <= 0 || plane.xp < need) return
  plane.xp -= need
  plane.level += 1
  plane.stars += 1
  applyGrowth(plane)
  plane.offers = rollOffers(plane.abilities, room.rng)
  room.events.push({ t: 'levelUp', id: plane.id })
  room.events.push({ t: 'log', text: `${plane.name} reached level ${plane.level}` })
  if (plane.bot) {
    const pick = plane.offers[Math.floor(room.rng() * plane.offers.length)]
    if (pick) grantAbility(room, plane, pick)
    plane.offers = []
    plane.stars = Math.max(0, plane.stars - 1)
    plane.shownType = typeOf(plane.level)
    return
  }
  if (!plane.offers.length) {
    plane.shownType = typeOf(plane.level)
    return
  }
  plane.choosing = true
  plane.levelUpUntil = now + LEVELUP_CHOOSE_MS
}

function closeChoice(room, plane, now) {
  const before = plane.shownType
  plane.choosing = false
  plane.levelUpUntil = 0
  plane.shownType = typeOf(plane.level)
  if (plane.shownType !== before) room.events.push({ t: 'typeSwap', id: plane.id, type: plane.shownType })
  tryOpenLevel(room, plane, now)
}

function kill(room, victim, attacker, now) {
  if (!victim.alive) return
  victim.alive = false
  victim.hp = 0
  victim.deaths += 1
  victim.choosing = false
  victim.levelUpUntil = 0
  victim.respawnAt = now + RESPAWN_MS
  victim.buffs = { damageUntil: 0, immuneUntil: 0, speedUntil: 0 }
  if (!victim.bot) victim.reassign = true
  room.firstKill = true
  room.events.push({ t: 'death', id: victim.id, x: victim.x, y: victim.y })
  if (attacker && attacker.id !== victim.id) {
    attacker.kills += 1
    room.events.push({ t: 'log', text: `${attacker.name} downed ${victim.name}` })
    let gain = xpGain(victim.level)
    if (attacker.bot) gain *= 0.5
    attacker.xp += gain
    tryOpenLevel(room, attacker, now)
  }
}

function respawn(room, plane, now) {
  const spot = takeSpawn(room)
  plane.x = spot.x
  plane.y = spot.y
  plane.prevX = spot.x
  plane.prevY = spot.y
  plane.hp = plane.maxHp
  plane.alive = true
  plane.joinShieldUntil = now + JOIN_SHIELD_MS
  plane.pityUsed = false
  plane.buffs = { damageUntil: 0, immuneUntil: 0, speedUntil: 0 }
  plane.choosing = false
  plane.respawnAt = 0
}

function tryFire(room, plane, now, forced = false) {
  if ((!forced && !plane.input.fire) || !plane.alive || plane.choosing) return false
  if (now < plane.joinShieldUntil) return false
  if (now - plane.lastFire < plane.triggerMs) return false
  if (plane.rocketStock < 1) return false
  const nose = forward(plane.yaw, NOSE_OFFSET)
  const spread = (room.rng() * 2 - 1) * ROCKET_SPREAD_RAD
  const heading = wrapAngle(plane.yaw + spread)
  const fuel = plane.abilities.fuel || 0
  const cone = plane.abilities.cone || 0
  const rocket = {
    id: `r${room.nextId++}`,
    ownerId: plane.id,
    x: plane.x + nose.x,
    y: plane.y + nose.y,
    heading,
    launchHeading: heading,
    traveled: 0,
    levelAtFire: plane.level,
    speed: ROCKET_SPEED + 28 * fuel,
    range: rocketRange(plane.level) + 70 * fuel,
    cone: Math.min(1.05, halfAngle(plane.level) + 0.08 * cone),
  }
  room.rockets.push(rocket)
  plane.rocketStock -= 1
  if (plane.rocketStock < rocketStockMax(plane.level, plane.bot) && !plane.rocketNextAt) {
    plane.rocketNextAt = now + rocketRechargeMs(plane.level, plane.bot)
  }
  plane.lastFire = now
  plane.shotsFired += 1
  return true
}

function tryGuard(room, plane, now) {
  const rank = plane.abilities.guard || 0
  if (rank < 1 || plane.choosing || now < plane.joinShieldUntil) return
  if (now < plane.guardNext) return
  plane.guardNext = now + guardPrepMs(rank)
  if (room.rng() > guardChance(rank)) return
  tryFire(room, plane, now, true)
}

function tryMine(room, plane, now) {
  if (!plane.input.mine) {
    plane.mineHeld = false
    return
  }
  if (plane.mineHeld) return
  if (!plane.alive || plane.choosing || now < plane.joinShieldUntil) return
  if (plane.mineStock < 1) {
    plane.mineHeld = true
    return
  }
  plane.mineHeld = true
  plane.mineStock -= 1
  if (plane.mineStock < mineStockMax(plane.level) && !plane.mineNextAt) {
    plane.mineNextAt = now + mineRefillMs(plane.level)
  }
  plane.lastMineAt = now
  const bloom = plane.abilities.bloom || 0
  room.mines.push({
    id: `m${room.nextId++}`,
    ownerId: plane.id,
    x: plane.x,
    y: plane.y,
    bornAt: now,
    radius: MINE_RADIUS + 4 * bloom,
    life: MINE_LIFETIME_MS + 2500 * bloom,
  })
}

function acquireTarget(room, rocket, now) {
  const half = rocket.cone ?? halfAngle(rocket.levelAtFire)
  const radius = trackRadius(rocket.levelAtFire)
  let best = null
  for (const plane of room.players.values()) {
    if (plane.id === rocket.ownerId || !plane.alive || plane.choosing) continue
    if (now < plane.joinShieldUntil) continue
    const dist = hypot(rocket.x, rocket.y, plane.x, plane.y)
    if (dist > radius) continue
    const aim = Math.atan2(plane.x - rocket.x, plane.y - rocket.y)
    const ang = Math.abs(angDiff(aim, rocket.heading))
    if (ang > half) continue
    if (Math.abs(angDiff(aim, rocket.launchHeading)) > half) continue
    if (!best || ang < best.ang - 1e-6 || (Math.abs(ang - best.ang) <= 1e-6 && dist < best.dist)) {
      best = { plane, ang, dist, aim }
    }
  }
  return best
}

function steerRocket(rocket, aim, dt) {
  const half = rocket.cone ?? halfAngle(rocket.levelAtFire)
  const maxTurn = ROCKET_TURN_RAD_PER_SEC * dt
  let next = rocket.heading + Math.max(-maxTurn, Math.min(maxTurn, angDiff(aim, rocket.heading)))
  if (Math.abs(angDiff(next, rocket.launchHeading)) > half) {
    const limited = rocket.launchHeading + Math.max(-half, Math.min(half, angDiff(next, rocket.launchHeading)))
    const stepped = rocket.heading + Math.max(-maxTurn, Math.min(maxTurn, angDiff(limited, rocket.heading)))
    next = Math.abs(angDiff(stepped, rocket.launchHeading)) <= half + 1e-4 ? stepped : rocket.heading
  }
  rocket.heading = wrapAngle(next)
}

function weaponHit(room, victim, attacker, kind, x, y, now) {
  if (now < victim.joinShieldUntil || victim.choosing || now < victim.buffs.immuneUntil) {
    room.events.push({ t: 'spark', x, y })
    return
  }
  const blastKind = kind === 'mine' ? 'bomb' : 'rocket'
  if (victim.shield > 0) {
    victim.shield = 0
    room.events.push({ t: 'blast', x, y, kind: blastKind })
    return
  }
  const doubled = attacker && now < attacker.buffs.damageUntil
  const dmg = weaponDamage(
    kind,
    attacker ? attacker.level : 1,
    attacker ? attacker.bot : false,
    doubled,
  )
  victim.hp -= dmg
  room.events.push({ t: 'hit', x, y, id: victim.id, kind })
  room.events.push({ t: 'blast', x, y, kind: blastKind })
  if (victim.hp <= 0) kill(room, victim, attacker, now)
}

function moveRockets(room, now) {
  const keep = []
  for (const rocket of room.rockets) {
    const target = acquireTarget(room, rocket, now)
    if (target) steerRocket(rocket, target.aim, DT)
    const step = (rocket.speed || ROCKET_SPEED) * DT
    const nx = rocket.x + Math.sin(rocket.heading) * step
    const ny = rocket.y + Math.cos(rocket.heading) * step
    rocket.traveled += step
    if (rocket.traveled >= (rocket.range || rocketRange(rocket.levelAtFire))) {
      room.events.push({ t: 'blast', x: rocket.x, y: rocket.y, kind: 'puff' })
      continue
    }
    if (nx < -600 || ny < -600 || nx > room.area.w + 600 || ny > room.area.h + 600) {
      room.events.push({ t: 'blast', x: rocket.x, y: rocket.y, kind: 'puff' })
      continue
    }
    rocket.x = nx
    rocket.y = ny
    keep.push(rocket)
  }
  room.rockets = keep
}

function collide(room, now) {
  const deadRockets = new Set()
  const deadMines = new Set()
  const rockets = room.rockets

  for (let i = 0; i < rockets.length; i++) {
    if (deadRockets.has(rockets[i].id)) continue
    for (let j = i + 1; j < rockets.length; j++) {
      if (deadRockets.has(rockets[j].id)) continue
      if (hypot(rockets[i].x, rockets[i].y, rockets[j].x, rockets[j].y) > ROCKET_RADIUS * 2) continue
      deadRockets.add(rockets[i].id)
      deadRockets.add(rockets[j].id)
      room.events.push({
        t: 'blast',
        x: (rockets[i].x + rockets[j].x) / 2,
        y: (rockets[i].y + rockets[j].y) / 2,
        kind: 'rocket',
      })
    }
  }

  for (const rocket of rockets) {
    if (deadRockets.has(rocket.id)) continue
    for (const mine of room.mines) {
      if (deadMines.has(mine.id)) continue
      if (hypot(rocket.x, rocket.y, mine.x, mine.y) > ROCKET_RADIUS + MINE_RADIUS) continue
      deadRockets.add(rocket.id)
      deadMines.add(mine.id)
      room.events.push({ t: 'blast', x: mine.x, y: mine.y, kind: 'bomb' })
      room.events.push({ t: 'blast', x: rocket.x, y: rocket.y, kind: 'rocket' })
    }
  }

  for (const rocket of rockets) {
    if (deadRockets.has(rocket.id)) continue
    for (const plane of room.players.values()) {
      if (!plane.alive || plane.id === rocket.ownerId) continue
      if (hypot(rocket.x, rocket.y, plane.x, plane.y) > ROCKET_RADIUS + PLANE_RADIUS) continue
      deadRockets.add(rocket.id)
      const owner = room.players.get(rocket.ownerId) || null
      weaponHit(room, plane, owner, 'rocket', rocket.x, rocket.y, now)
      break
    }
  }

  room.rockets = rockets.filter((rocket) => !deadRockets.has(rocket.id))

  for (const plane of room.players.values()) {
    if (!plane.alive) continue
    for (const mine of room.mines) {
      if (deadMines.has(mine.id) || mine.ownerId === plane.id) continue
      if (!segmentHits(plane.prevX, plane.prevY, plane.x, plane.y, mine.x, mine.y, mine.radius || MINE_RADIUS)) continue
      deadMines.add(mine.id)
      const owner = room.players.get(mine.ownerId) || null
      weaponHit(room, plane, owner, 'mine', mine.x, mine.y, now)
    }
  }
  room.mines = room.mines.filter((mine) => !deadMines.has(mine.id))
}

function segmentHits(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / len2))
  const px = x1 + dx * t
  const py = y1 + dy * t
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

function checkEnd(room, now) {
  if (room.phase !== 'play') return
  let done = false
  if (room.endRule === 'time' && room.endsAt != null && now >= room.endsAt) done = true
  if (room.endRule === 'kills') {
    let top = 0
    for (const plane of room.players.values()) top = Math.max(top, plane.kills)
    if (top >= room.endValue) done = true
  }
  if (!done) return
  room.phase = 'end'
  room.endedAt = now
  const ranking = rankPlanes([...room.players.values()])
  room.winnerId = ranking[0] ? ranking[0].id : null
  room.events.push({ t: 'winner', id: room.winnerId })
}

export function pickStat(room, playerId, stat, now) {
  const plane = room.players.get(playerId)
  if (!plane || plane.bot || !plane.alive) return false
  if (!plane.choosing || now >= plane.levelUpUntil || plane.stars < 1) return false
  if (!plane.offers?.includes(stat)) return false
  if (!grantAbility(room, plane, stat)) return false
  plane.stars -= 1
  plane.offers = []
  closeChoice(room, plane, now)
  return true
}

export function stepRoom(room, now) {
  if (room.phase !== 'play') return
  room.tick += 1
  room.events = []

  for (const plane of room.players.values()) {
    if (plane.disconnected && now >= plane.disconnectAt + 8000) {
      if (plane.alive) {
        plane.alive = false
        plane.hp = 0
        plane.deaths += 1
        room.events.push({ t: 'death', id: plane.id, x: plane.x, y: plane.y })
      }
      plane.remove = true
      continue
    }
    if (!plane.alive) {
      if (!plane.disconnected && plane.respawnAt && now >= plane.respawnAt) respawn(room, plane, now)
      continue
    }
    if (plane.choosing && plane.levelUpUntil && now >= plane.levelUpUntil) closeChoice(room, plane, now)
    refillMines(plane, now)
    refillRockets(plane, now)
    if (plane.choosing) {
      plane.input = emptyInput()
      continue
    }
    if (plane.bot) plane.input = botIntent(room, plane, now)
    else if (plane.disconnected) plane.input = emptyInput()
    if (plane.choosing) continue
    const throttle = stepThrottle(plane.throttle, plane.input.speed, plane.lastSpeedStep, now)
    plane.throttle = throttle.throttle
    plane.lastSpeedStep = throttle.lastAt
    const yawRate = plane.bot ? BOT_YAW_RATE : YAW_RATE
    plane.yaw = wrapAngle(plane.yaw + plane.input.yaw * yawRate * DT)
    tryGuard(room, plane, now)
    tryFire(room, plane, now)
    tryMine(room, plane, now)
  }

  for (const plane of [...room.players.values()]) {
    if (plane.remove) room.players.delete(plane.id)
  }

  for (const plane of room.players.values()) {
    if (!plane.alive) continue
    plane.prevX = plane.x
    plane.prevY = plane.y
    if (plane.choosing) continue
    const fast = now < plane.buffs.speedUntil
    const speed = flightSpeed(plane.level, plane.throttle, fast, plane.abilities.burn || 0)
    if (plane.abilities.mend) plane.hp = Math.min(plane.maxHp, plane.hp + plane.abilities.mend * 4 * DT)
    const step = forward(plane.yaw, speed * DT)
    const next = moveBody(room.area, plane.x, plane.y, plane.x + step.x, plane.y + step.y, PLANE_RADIUS)
    plane.x = next.x
    plane.y = next.y
  }

  for (const plane of room.players.values()) {
    if (!plane.alive || plane.choosing || now < plane.joinShieldUntil) continue
    if (!inBorder(plane.x, plane.y, room.area, BORDER_BAND)) continue
    plane.hp -= BORDER_DPS * plane.maxHp * DT
    if (plane.hp <= 0) kill(room, plane, null, now)
  }

  room.mines = room.mines.filter((mine) => now - mine.bornAt < (mine.life || MINE_LIFETIME_MS))
  moveRockets(room, now)
  collide(room, now)
  stepPads(room, now)
  checkEnd(room, now)
}

export function snapshot(room, now) {
  const ranked = rankPlanes([...room.players.values()])
  return {
    t: 'snap',
    tick: room.tick,
    now,
    players: ranked.map((plane) => ({
      id: plane.id,
      name: plane.name,
      bot: plane.bot,
      type: plane.shownType,
      level: plane.level,
      xp: Math.round(plane.xp),
      xpNext: xpToNext(plane.level),
      stars: plane.stars,
      x: Math.round(plane.x),
      y: Math.round(plane.y),
      yaw: Math.round(wrapAngle(plane.yaw) * 1000) / 1000,
      throttle: plane.throttle,
      hp: Math.max(0, Math.round(plane.hp * 10) / 10),
      maxHp: plane.maxHp,
      kills: plane.kills,
      deaths: plane.deaths,
      shield: plane.shield,
      joinShieldUntil: plane.joinShieldUntil,
      triggerMs: plane.triggerMs,
      buffs: {
        damage: Math.max(0, plane.buffs.damageUntil - now),
        immune: Math.max(0, plane.buffs.immuneUntil - now),
        speed: Math.max(0, plane.buffs.speedUntil - now),
      },
      alive: plane.alive,
      choosing: plane.choosing,
      levelUpUntil: plane.levelUpUntil,
      mineStock: plane.mineStock,
      mineMax: mineStockMax(plane.level),
      mineCharge: chargeFrac(plane.mineStock, mineStockMax(plane.level), plane.mineNextAt, now, mineRefillMs(plane.level)),
      rocketStock: plane.rocketStock,
      rocketMax: rocketStockMax(plane.level, plane.bot),
      rocketCharge: chargeFrac(plane.rocketStock, rocketStockMax(plane.level, plane.bot), plane.rocketNextAt, now, rocketRechargeMs(plane.level, plane.bot)),
      speed: flightSpeed(plane.level, plane.throttle, now < plane.buffs.speedUntil, plane.abilities.burn || 0),
      abilities: plane.abilities,
      offers: plane.offers,
    })),
    rockets: room.rockets.map((rocket) => ({
      id: rocket.id,
      owner: rocket.ownerId,
      x: Math.round(rocket.x),
      y: Math.round(rocket.y),
      heading: Math.round(rocket.heading * 1000) / 1000,
      level: rocket.levelAtFire,
    })),
    mines: room.mines.map((mine) => ({
      id: mine.id,
      owner: mine.ownerId,
      x: Math.round(mine.x),
      y: Math.round(mine.y),
    })),
    bonuses: room.pads
      .filter((pad) => pad.kind)
      .map((pad) => ({ id: pad.bonusId, kind: pad.kind, x: pad.x, y: pad.y })),
    match: {
      phase: room.phase,
      endsAt: room.endsAt,
      killTarget: room.endRule === 'kills' ? room.endValue : null,
      endRule: room.endRule,
      endValue: room.endValue,
      ranking: ranked.map((plane) => plane.id),
      winnerId: room.winnerId,
    },
    events: room.events,
  }
}
