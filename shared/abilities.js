/** Star picks. Each one caps at 5. Level-up shows six of these at random. */

export const ABILITY_CAP = 5

export const ABILITY_LIST = Object.freeze([
  { id: 'guard', name: 'Auto Guard', hint: 'Tries to fire a rocket for you. Up to 50% success, and the wait drops from 5s to 1s.' },
  { id: 'hull', name: 'HP Rise', hint: 'A thicker hull on top of the HP you gain every level.' },
  { id: 'cone', name: 'Hawk Eye', hint: 'Rockets can curve farther off their launch line.' },
  { id: 'fuel', name: 'Hot Fuel', hint: 'Rockets fly faster and reach farther.' },
  { id: 'bloom', name: 'Spiky Mines', hint: 'Mines grow wider and stay in the air longer.' },
  { id: 'burn', name: 'Afterburn', hint: 'A higher top speed on top of each level.' },
  { id: 'mend', name: 'Field Mend', hint: 'The airframe slowly patches itself while you fly.' },
  { id: 'magnet', name: 'Snack Magnet', hint: 'Bonus boxes count from farther away.' },
])

export const ABILITY_IDS = Object.freeze(ABILITY_LIST.map((row) => row.id))

export function emptyAbilities() {
  return Object.fromEntries(ABILITY_IDS.map((id) => [id, 0]))
}

export function rollOffers(abilities, rand) {
  const pool = ABILITY_IDS.filter((id) => (abilities[id] || 0) < ABILITY_CAP)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const swap = pool[i]
    pool[i] = pool[j]
    pool[j] = swap
  }
  return pool.slice(0, 6)
}
