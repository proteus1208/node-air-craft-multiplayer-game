import { MAX_LEVEL, XP_KILL_BASE, XP_KILL_PER_VICTIM_LEVEL } from './constants.js'

/** Airframe rows. typeOf returns the id of the highest row whose min level is still <= level. */
export const TYPE_TABLE = Object.freeze([
  { min: 1, id: 'scout', name: 'Scout' },
  { min: 5, id: 'falcon', name: 'Falcon' },
  { min: 10, id: 'hawk', name: 'Hawk' },
  { min: 15, id: 'condor', name: 'Condor' },
  { min: 20, id: 'storm', name: 'Storm' },
  { min: 25, id: 'apex', name: 'Apex' },
])

export function typeOf(level) {
  let id = TYPE_TABLE[0].id
  for (const row of TYPE_TABLE) {
    if (level >= row.min) id = row.id
  }
  return id
}

export function typeName(idOrLevel) {
  if (typeof idOrLevel === 'number') return typeName(typeOf(idOrLevel))
  const row = TYPE_TABLE.find((t) => t.id === idOrLevel)
  return row ? row.name : 'Scout'
}

/** XP still required to finish this level. Zero at the cap. */
export function xpToNext(level) {
  if (level >= MAX_LEVEL) return 0
  return 40 + 25 * level
}

/** XP granted to the killer. A level-1 victim is 100. A level-25 victim is 460. */
export function xpGain(victimLevel) {
  return XP_KILL_BASE + XP_KILL_PER_VICTIM_LEVEL * (victimLevel - 1)
}

/** Cumulative XP to arrive at `level` (level 1 is 0, level 5 is 410, level 25 is 8460). */
export function xpToReach(level) {
  return cumulativeXp(level)
}

export function cumulativeXp(level) {
  let sum = 0
  for (let l = 1; l < level; l++) sum += xpToNext(l)
  return sum
}
