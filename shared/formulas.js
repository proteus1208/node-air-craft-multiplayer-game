import {
  TRACK_RADIUS_BASE,
  TRACK_RADIUS_PER_LEVEL,
  TRACK_ANGLE_BASE,
  TRACK_ANGLE_PER_LEVEL,
  TRACK_ANGLE_CAP,
  ROCKET_RANGE_BASE,
  ROCKET_RANGE_PER_LEVEL,
  MINE_FADE_FAR,
  MINE_FADE_NEAR,
  JOIN_SHIELD_MS,
  SHIELD_BLINK_SLOW_MS,
  SHIELD_BLINK_FAST_MS,
  SPEED_BASE,
  SPEED_PER_RANK,
  HP_BASE,
  HP_PER_RANK,
  HP_PER_LEVEL,
  SPEED_PER_LEVEL,
  DAMAGE_PER_LEVEL,
  HULL_HP,
  ROCKET_DAMAGE,
  MINE_DAMAGE,
  DAMAGE_PER_RANK,
  BOT_DAMAGE_MULT,
  BULLET_INTERVAL_MS,
  BULLET_INTERVAL_STEP_MS,
  BULLET_INTERVAL_MIN_MS,
  BOT_TRIGGER_MS,
  MINE_STOCK_BASE,
  ROCKET_STOCK_BASE,
  ROCKET_STOCK_PER_LEVEL,
  ROCKET_STOCK_CAP,
  ROCKET_RECHARGE_MS,
  BOT_ROCKET_RECHARGE_MS,
  MINE_REFILL_MS,
  GUARD_PREP_SLOW_MS,
  GUARD_PREP_FAST_MS,
  GUARD_CHANCE_MIN,
  GUARD_CHANCE_MAX,
  BUFF_SPEED_MULT,
  THROTTLE_MIN,
  THROTTLE_STEP,
  SPEED_STEP_MS,
} from './constants.js'
import { ABILITY_CAP } from './abilities.js'

export function trackRadius(level) {
  return TRACK_RADIUS_BASE + TRACK_RADIUS_PER_LEVEL * (level - 1)
}

export function halfAngle(level) {
  return Math.min(TRACK_ANGLE_CAP, TRACK_ANGLE_BASE + TRACK_ANGLE_PER_LEVEL * (level - 1))
}

export function rocketRange(level) {
  return ROCKET_RANGE_BASE + ROCKET_RANGE_PER_LEVEL * (level - 1)
}

/** Opacity of a mine from this client's plane. At MINE_FADE_FAR and beyond the sprite is skipped. */
export function mineOpacity(distance) {
  const t = (MINE_FADE_FAR - distance) / (MINE_FADE_FAR - MINE_FADE_NEAR)
  return Math.max(0, Math.min(1, t))
}

/**
 * Blink period for the join shield. Early in the 4s the blink is slow.
 * The ring stays visible for half of `period` and hidden for the other half.
 */
export function shieldBlinkPeriod(remainingMs) {
  const u = 1 - remainingMs / JOIN_SHIELD_MS
  return SHIELD_BLINK_SLOW_MS + (SHIELD_BLINK_FAST_MS - SHIELD_BLINK_SLOW_MS) * u
}

export function shieldBlinkOn(remainingMs, nowMs) {
  if (remainingMs <= 0) return false
  const period = Math.max(1, shieldBlinkPeriod(remainingMs))
  return nowMs % period < period / 2
}

export function growthTier(level) {
  return Math.floor((Math.max(1, level) - 1) / 3)
}

export function maxHpFor(rank) {
  return HP_BASE + HP_PER_RANK * rank
}

export function maxHpForLevel(level, hull = 0) {
  return HP_BASE + HP_PER_LEVEL * (Math.max(1, level) - 1) + HULL_HP * hull
}

export function speedCeiling(rank) {
  return SPEED_BASE + SPEED_PER_RANK * rank
}

export function flightSpeed(level, throttle, fast, burn = 0) {
  let s = (SPEED_BASE + SPEED_PER_LEVEL * (Math.max(1, level) - 1)) * (1 + 0.05 * burn) * throttle
  if (fast) s *= BUFF_SPEED_MULT
  return s
}

export function triggerInterval(level, bot) {
  if (bot) return BOT_TRIGGER_MS
  return Math.max(BULLET_INTERVAL_MIN_MS, BULLET_INTERVAL_MS - 50 * growthTier(level))
}

export function mineStockMax(level) {
  return MINE_STOCK_BASE + growthTier(level)
}

/** Loaded rockets. The cap grows one step every three levels. */
export function rocketStockMax(level, bot = false) {
  const human = Math.min(ROCKET_STOCK_CAP, ROCKET_STOCK_BASE + growthTier(level))
  return bot ? Math.max(1, Math.ceil(human / 2)) : human
}

export function rocketRechargeMs(level, bot = false) {
  if (bot) return BOT_ROCKET_RECHARGE_MS
  return Math.max(450, ROCKET_RECHARGE_MS - 120 * growthTier(level))
}

export function mineRefillMs(level) {
  return Math.max(3200, MINE_REFILL_MS - 700 * growthTier(level))
}

export function weaponDamage(kind, level, bot, doubled) {
  const base = kind === 'mine' ? MINE_DAMAGE : ROCKET_DAMAGE
  let d = base * (1 + DAMAGE_PER_LEVEL * (Math.max(1, level) - 1))
  if (bot) d *= BOT_DAMAGE_MULT
  if (doubled) d *= 2
  return d
}

export function guardPrepMs(rank) {
  if (rank <= 0) return GUARD_PREP_SLOW_MS
  const t = (rank - 1) / (ABILITY_CAP - 1)
  return GUARD_PREP_SLOW_MS + (GUARD_PREP_FAST_MS - GUARD_PREP_SLOW_MS) * t
}

export function guardChance(rank) {
  if (rank <= 0) return 0
  const t = (rank - 1) / (ABILITY_CAP - 1)
  return GUARD_CHANCE_MIN + (GUARD_CHANCE_MAX - GUARD_CHANCE_MIN) * t
}

/** Apply at most one throttle step per SPEED_STEP_MS. `dir` is -1, 0, or +1. */
export function stepThrottle(throttle, dir, lastAt, now) {
  if (!dir) return { throttle, lastAt, stepped: false }
  if (now - lastAt < SPEED_STEP_MS) return { throttle, lastAt, stepped: false }
  const next = Math.min(1, Math.max(THROTTLE_MIN, Math.round((throttle + dir * THROTTLE_STEP) * 100) / 100))
  return { throttle: next, lastAt: now, stepped: next !== throttle }
}
