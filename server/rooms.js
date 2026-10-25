import crypto from 'crypto'
import { generateArea } from '@airclash/shared/area.js'
import { EMPTY_ROOM_MS, MAX_PLAYERS, TICK_HZ } from '@airclash/shared/constants.js'
import {
  addPlane,
  createMatch,
  evictLowestBot,
  fillBots,
  pickStat,
  setInput,
  snapshot,
  stepRoom,
  takeSpawn,
} from './sim.js'

const rooms = new Map()

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return rooms.has(s) ? makeCode() : s
}

export function listRooms() {
  return [...rooms.values()]
}

export function roomByCode(code) {
  return rooms.get(String(code || '').toUpperCase()) || null
}

export function openRoom({ source, humans, endRule, endValue, hostId }) {
  const seed = crypto.randomBytes(4).readUInt32BE(0)
  const area = generateArea(seed)
  const code = makeCode()
  const now = Date.now()
  const match = createMatch({
    code,
    source,
    seed,
    area,
    endRule,
    endValue,
    now,
    hostId: hostId || humans[0]?.id,
  })
  for (const human of humans) {
    const spot = takeSpawn(match)
    addPlane(match, {
      id: human.id,
      name: human.name,
      token: human.token,
      bot: false,
      x: spot.x,
      y: spot.y,
      now,
    })
  }
  fillBots(match, now)
  const room = { code, match, sockets: new Set(), timer: null, emptyAt: 0 }
  rooms.set(code, room)
  room.timer = setInterval(() => step(room), 1000 / TICK_HZ)
  room.timer.unref()
  return room
}

function step(room) {
  const now = Date.now()
  stepRoom(room.match, now)
  relocateLoners(room)
  if (!rooms.has(room.code)) return
  balance(room)
  if (!rooms.has(room.code)) return
  const payload = JSON.stringify(snapshot(room.match, now))
  for (const sock of room.sockets) {
    if (sock.readyState !== 1) continue
    if (sock.bufferedAmount > 262144) continue
    sock.send(payload)
  }
  if (room.sockets.size === 0) {
    if (!room.emptyAt) room.emptyAt = now
    if (now - room.emptyAt > EMPTY_ROOM_MS) destroyRoom(room.code)
  } else room.emptyAt = 0
}

export function destroyRoom(code) {
  const room = rooms.get(code)
  if (!room) return
  clearInterval(room.timer)
  rooms.delete(code)
}

export function humanCount(room) {
  let n = 0
  for (const plane of room.match.players.values()) if (!plane.bot && !plane.remove) n += 1
  return n
}

export function pickOpenRoom(exceptCode) {
  const open = []
  for (const room of rooms.values()) {
    if (room.code === exceptCode) continue
    if (room.match.source !== 'public' || room.match.phase !== 'play') continue
    if (humanCount(room) >= MAX_PLAYERS) continue
    open.push(room)
  }
  if (!open.length) return null
  const fullest = Math.max(...open.map(humanCount))
  const tied = open.filter((room) => humanCount(room) === fullest)
  return tied[Math.floor(Math.random() * tied.length)]
}

export function balance(room) {
  if (!room || !rooms.has(room.code)) return
  if (humanCount(room) === 0) {
    destroyRoom(room.code)
    return
  }
  while (room.match.players.size > MAX_PLAYERS) {
    if (!evictLowestBot(room.match)) break
  }
  fillBots(room.match, Date.now())
}

function matchStartPayload(room, plane) {
  return {
    t: 'matchStart',
    playerId: plane.id,
    token: plane.token,
    roomCode: room.code,
    seed: room.match.area.seed,
    area: room.match.area,
    endRule: room.match.endRule,
    endValue: room.match.endValue,
    youAreHost: room.match.hostId === plane.id,
  }
}

function relocateLoners(room) {
  if (!rooms.has(room.code)) return
  const humans = [...room.match.players.values()].filter((plane) => !plane.bot && !plane.remove)
  for (const plane of humans) {
    if (!plane.reassign) continue
    plane.reassign = false
    if (humans.length > 1) continue
    const target = pickOpenRoom(room.code)
    if (!target) continue
    const sock = [...room.sockets].find((item) => item.playerId === plane.id) || null
    room.match.players.delete(plane.id)
    if (sock) room.sockets.delete(sock)
    destroyRoom(room.code)
    while (target.match.players.size >= MAX_PLAYERS) {
      if (!evictLowestBot(target.match)) break
    }
    const spot = takeSpawn(target.match)
    plane.x = spot.x
    plane.y = spot.y
    plane.prevX = spot.x
    plane.prevY = spot.y
    target.match.players.set(plane.id, plane)
    if (sock && sock.readyState === 1) {
      bindSocket(target, sock, plane)
      sock.send(JSON.stringify(matchStartPayload(target, plane)))
    }
    return
  }
}

export function dropHuman(room, playerId) {
  if (!room) return
  room.match.players.delete(playerId)
  balance(room)
}

export function bindSocket(room, sock, plane) {
  sock.roomCode = room.code
  sock.playerId = plane.id
  sock.token = plane.token
  plane.disconnected = false
  plane.disconnectAt = 0
  room.sockets.add(sock)
}

export function unbindSocket(sock) {
  const room = roomByCode(sock.roomCode)
  if (!room) return
  room.sockets.delete(sock)
  const plane = room.match.players.get(sock.playerId)
  if (plane && !plane.bot) {
    plane.disconnected = true
    plane.disconnectAt = Date.now()
    plane.input = { yaw: 0, speed: 0, fire: false, mine: false }
  }
}

export function planeByToken(token) {
  for (const room of rooms.values()) {
    for (const plane of room.match.players.values()) {
      if (plane.token === token && !plane.bot) return { room, plane }
    }
  }
  return null
}

export function applyInput(sock, msg) {
  const room = roomByCode(sock.roomCode)
  if (!room) return
  setInput(room.match, sock.playerId, msg)
}

export function applyPick(sock, stat) {
  const room = roomByCode(sock.roomCode)
  if (!room) return
  pickStat(room.match, sock.playerId, stat, Date.now())
}

export function addHumanToRoom(room, human) {
  const match = room.match
  if (match.phase !== 'play') return null
  const humans = [...match.players.values()].filter((p) => !p.bot)
  if (humans.length >= MAX_PLAYERS) return null
  if (match.players.size >= MAX_PLAYERS) evictLowestBot(match)
  if (match.players.size >= MAX_PLAYERS) return null
  const now = Date.now()
  const spot = takeSpawn(match)
  return addPlane(match, {
    id: human.id,
    name: human.name,
    token: human.token,
    bot: false,
    x: spot.x,
    y: spot.y,
    now,
  })
}

export function runningPublicWithSeat(now) {
  for (const room of rooms.values()) {
    if (room.match.source !== 'public' || room.match.phase !== 'play') continue
    if (!room.match.endsAt || room.match.endsAt - now < 60000) continue
    const humans = [...room.match.players.values()].filter((p) => !p.bot).length
    if (humans >= MAX_PLAYERS) continue
    return room
  }
  return null
}
