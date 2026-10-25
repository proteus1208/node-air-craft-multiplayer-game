import test from 'node:test'
import assert from 'node:assert/strict'
import { xpToNext, xpToReach, typeOf } from '@airclash/shared/level.js'
import { generateArea } from '@airclash/shared/area.js'
import { mineOpacity } from '@airclash/shared/geom.js'
import { addPlane, createMatch, setInput, stepRoom } from '../sim.js'
import { BOT_TRIGGER_MS, HP_BASE, THROTTLE_MIN } from '@airclash/shared/constants.js'

const spawns = Array.from({ length: 8 }, (_, i) => ({ x: 400 + i * 10, y: 400 }))
const pads = Array.from({ length: 6 }, (_, i) => ({ x: 800 + i * 40, y: 800 }))

function arena() {
  return {
    seed: 1,
    w: 2000,
    h: 2000,
    buildings: [],
    trees: [],
    spawns,
    pads,
  }
}

function room() {
  return createMatch({
    code: 'TEST',
    source: 'private',
    seed: 1,
    area: arena(),
    endRule: 'time',
    endValue: 300,
    now: 0,
  })
}

function pilot(match, opts) {
  const plane = addPlane(match, { x: 500, y: 500, now: 0, ...opts })
  plane.joinShieldUntil = 0
  plane.throttle = opts.throttle ?? 0
  return plane
}

test('level curve reaches 410 XP at level 5 and caps at 25', () => {
  assert.equal(xpToNext(1), 65)
  assert.equal(xpToReach(5), 410)
  assert.equal(xpToReach(25), 8460)
  assert.equal(xpToNext(25), 0)
  assert.equal(typeOf(1), 'scout')
  assert.equal(typeOf(5), 'falcon')
  assert.equal(typeOf(25), 'apex')
})

test('generateArea is a pure function of the seed', () => {
  assert.deepEqual(generateArea(42), generateArea(42))
  assert.equal(generateArea(42).spawns.length, 20)
  assert.equal(generateArea(42).pads.length, 6)
})

test('mine opacity is 0 far away and 1 up close', () => {
  assert.equal(mineOpacity(520), 0)
  assert.equal(mineOpacity(160), 1)
  assert.ok(mineOpacity(340) > 0.4 && mineOpacity(340) < 0.6)
})

test('a rocket damages the plane in front and not the shooter', () => {
  const match = room()
  const a = pilot(match, { id: 'a', name: 'A', x: 500, y: 500 })
  const b = pilot(match, { id: 'b', name: 'B', x: 500, y: 680 })
  const hp = b.hp
  setInput(match, a.id, { seq: 1, yaw: 0, speed: 0, fire: true, mine: false })
  for (let i = 1; i <= 40; i++) stepRoom(match, i * 50)
  assert.ok(b.hp < hp)
  assert.equal(a.hp, HP_BASE)
})

test('a mine hurts a plane whose path crosses it and ignores the owner', () => {
  const match = room()
  const owner = pilot(match, { id: 'o', name: 'O', x: 200, y: 200 })
  const other = pilot(match, { id: 'q', name: 'Q', x: 500, y: 590, throttle: THROTTLE_MIN })
  match.mines.push({ id: 'm', ownerId: owner.id, x: 500, y: 600, bornAt: 0 })
  const ownerHp = owner.hp
  const otherHp = other.hp
  stepRoom(match, 50)
  assert.ok(other.hp < otherHp)
  assert.equal(owner.hp, ownerHp)
})

test('the border costs about 5 percent max HP per second', () => {
  const match = room()
  const p = pilot(match, { id: 'p', name: 'P', x: 40, y: 1000 })
  for (let i = 1; i <= 20; i++) stepRoom(match, i * 50)
  const lost = HP_BASE - p.hp
  assert.ok(lost > 4 && lost < 8, `lost ${lost}`)
})

test('bots cannot fire faster than the trigger interval', () => {
  const match = room()
  pilot(match, { id: 'bot', name: 'Bot 1', bot: true, x: 500, y: 500 })
  const dummy = pilot(match, { id: 'd', name: 'D', x: 500, y: 620 })
  dummy.hp = 500
  dummy.maxHp = 500
  const start = dummy.hp
  for (let i = 1; i <= 10; i++) stepRoom(match, i * 50)
  assert.ok(dummy.hp < start)
  const mid = dummy.hp
  for (let i = 11; i <= 16; i++) stepRoom(match, i * 50)
  assert.equal(dummy.hp, mid)
  assert.ok(BOT_TRIGGER_MS >= 900)
})

test('overlapping planes lose no HP', () => {
  const match = room()
  const a = pilot(match, { id: 'a', name: 'A', x: 500, y: 500 })
  const b = pilot(match, { id: 'b', name: 'B', x: 510, y: 500 })
  stepRoom(match, 50)
  assert.equal(a.hp, HP_BASE)
  assert.equal(b.hp, HP_BASE)
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 30)
})

test('level-up and join shield take no damage', () => {
  const match = room()
  const a = pilot(match, { id: 'a', name: 'A', x: 500, y: 500 })
  const b = pilot(match, { id: 'b', name: 'B', x: 500, y: 680 })
  b.choosing = true
  b.levelUpUntil = 100000
  const hp = b.hp
  setInput(match, a.id, { seq: 1, yaw: 0, speed: 0, fire: true, mine: false })
  for (let i = 1; i <= 40; i++) stepRoom(match, i * 50)
  assert.equal(b.hp, hp)
  assert.equal(b.choosing, true)

  const shielded = room()
  const c = pilot(shielded, { id: 'c', name: 'C', x: 500, y: 500 })
  const d = pilot(shielded, { id: 'd', name: 'D', x: 500, y: 680 })
  d.joinShieldUntil = 100000
  setInput(shielded, c.id, { seq: 1, yaw: 0, speed: 0, fire: true, mine: false })
  for (let i = 1; i <= 40; i++) stepRoom(shielded, i * 50)
  assert.equal(d.hp, HP_BASE)
  assert.equal(shielded.rockets.length, 0)
})
