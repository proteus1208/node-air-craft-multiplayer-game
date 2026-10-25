/**
 * World state is strictly two-dimensional.
 * A plane is {x, y, yaw} plus combat fields. There is no z, altitude, or height.
 * A future Three.js view may place y onto Three.js Z and keep height at 0 inside that renderer only.
 */

/**
 * @typedef {Object} PlaneState
 * @property {string} id
 * @property {string} name
 * @property {boolean} bot
 * @property {string} type
 * @property {number} level
 * @property {number} xp
 * @property {number} stars
 * @property {number} x
 * @property {number} y
 * @property {number} yaw
 * @property {number} throttle
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} kills
 * @property {number} deaths
 * @property {number} shield
 * @property {number} joinShieldUntil
 * @property {number} triggerMs
 * @property {boolean} alive
 * @property {boolean} choosing
 */

/**
 * @typedef {Object} RocketState
 * @property {string} id
 * @property {string} ownerId
 * @property {number} x
 * @property {number} y
 * @property {number} heading
 * @property {number} launchHeading
 * @property {number} traveled
 * @property {number} levelAtFire
 */

/**
 * @typedef {Object} MineState
 * @property {string} id
 * @property {string} ownerId
 * @property {number} x
 * @property {number} y
 * @property {number} bornAt
 */

/**
 * @typedef {Object} AreaState
 * @property {number} seed
 * @property {number} w
 * @property {number} h
 * @property {{x:number,y:number,w:number,h:number}[]} buildings
 * @property {{x:number,y:number,r:number}[]} trees
 * @property {{x:number,y:number}[]} spawns
 * @property {{x:number,y:number}[]} pads
 */

export function rankPlanes(players) {
  return [...players].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills
    if (b.level !== a.level) return b.level - a.level
    if (a.deaths !== b.deaths) return a.deaths - b.deaths
    return String(a.name).localeCompare(String(b.name))
  })
}

export function emptyInput() {
  return { yaw: 0, speed: 0, fire: false, mine: false }
}
