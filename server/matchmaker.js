import crypto from 'crypto'
import {
  KILL_TARGET_CHOICES,
  MATCH_TIME_CHOICES_SEC,
  MAX_PLAYERS,
  PUBLIC_COUNTDOWN_MS,
  PUBLIC_MATCH_SEC,
} from '@airclash/shared/constants.js'
import {
  addHumanToRoom,
  bindSocket,
  dropHuman,
  openRoom,
  pickOpenRoom,
  planeByToken,
  roomByCode,
  runningPublicWithSeat,
  unbindSocket,
} from './rooms.js'

const queue = []
let countdownUntil = 0
let timer = null

function id() {
  return crypto.randomBytes(8).toString('hex')
}

export function queueState() {
  const now = Date.now()
  return {
    t: 'queueState',
    pilots: queue.map((p) => ({ id: p.id, name: p.name, ready: p.ready })),
    countdownMs: countdownUntil > now ? countdownUntil - now : null,
    launching: false,
  }
}

function broadcast() {
  const msg = JSON.stringify(queueState())
  for (const pilot of queue) {
    if (pilot.sock.readyState === 1) pilot.sock.send(msg)
  }
}

export function enterQueue(sock, name) {
  leaveQueue(sock)
  const pilot = {
    id: id(),
    name: String(name || 'Pilot').slice(0, 16),
    ready: false,
    sock,
    token: crypto.randomBytes(16).toString('hex'),
  }
  sock.queueId = pilot.id
  sock.token = pilot.token
  sock.state = 'IN_QUEUE'
  queue.push(pilot)
  broadcast()
  ensureLoop()
  return pilot
}

export function leaveQueue(sock) {
  const idx = queue.findIndex((p) => p.sock === sock)
  if (idx >= 0) queue.splice(idx, 1)
  if (sock.state === 'IN_QUEUE') sock.state = 'OPEN'
  broadcast()
}

export function setReady(sock, on) {
  const pilot = queue.find((p) => p.sock === sock)
  if (!pilot) return
  pilot.ready = !!on
  broadcast()
}

function startPayload(room, plane) {
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

function launch(group) {
  const humans = group.map((p) => ({ id: p.id, name: p.name, token: p.token }))
  const room = openRoom({
    source: 'public',
    humans,
    endRule: 'time',
    endValue: PUBLIC_MATCH_SEC,
    hostId: humans[0].id,
  })
  for (const pilot of group) {
    const idx = queue.findIndex((q) => q.id === pilot.id)
    if (idx >= 0) queue.splice(idx, 1)
    const plane = room.match.players.get(pilot.id)
    pilot.sock.state = 'IN_MATCH'
    bindSocket(room, pilot.sock, plane)
    if (pilot.sock.readyState === 1) pilot.sock.send(JSON.stringify(startPayload(room, plane)))
  }
  countdownUntil = 0
  broadcast()
}

function pump() {
  const now = Date.now()
  const ready = queue.filter((p) => p.ready)
  while (ready.length >= MAX_PLAYERS) launch(ready.splice(0, MAX_PLAYERS))
  if (ready.length >= 2) {
    const wait = Number(process.env.AIRCLASH_COUNTDOWN_MS ?? PUBLIC_COUNTDOWN_MS)
    if (!countdownUntil) countdownUntil = now + wait
    if (now >= countdownUntil) launch(ready.splice(0, ready.length))
  } else countdownUntil = 0

  const late = queue.find((p) => p.ready)
  if (late) {
    const room = runningPublicWithSeat(now)
    if (room) {
      const plane = addHumanToRoom(room, { id: late.id, name: late.name, token: late.token })
      if (plane) {
        const idx = queue.findIndex((p) => p.id === late.id)
        if (idx >= 0) queue.splice(idx, 1)
        late.sock.state = 'IN_MATCH'
        bindSocket(room, late.sock, plane)
        if (late.sock.readyState === 1) late.sock.send(JSON.stringify(startPayload(room, plane)))
      }
    }
  }
  broadcast()
  if (!queue.length) {
    clearInterval(timer)
    timer = null
    countdownUntil = 0
  }
}

function ensureLoop() {
  if (!timer) {
    timer = setInterval(pump, 500)
    timer.unref()
  }
}

export function enterPlay(sock, name) {
  leaveQueue(sock)
  const token = crypto.randomBytes(16).toString('hex')
  const human = { id: id(), name: String(name || 'Pilot').slice(0, 16), token }
  let room = pickOpenRoom(null)
  let plane = room ? addHumanToRoom(room, human) : null
  if (!plane) {
    room = openRoom({
      source: 'public',
      humans: [human],
      endRule: 'free',
      endValue: 0,
      hostId: human.id,
    })
    plane = room.match.players.get(human.id)
  }
  sock.state = 'IN_MATCH'
  sock.token = token
  bindSocket(room, sock, plane)
  sock.send(JSON.stringify(startPayload(room, plane)))
  return room
}

export function leaveMatch(sock) {
  const room = roomByCode(sock.roomCode)
  const playerId = sock.playerId
  unbindSocket(sock)
  if (room && playerId) dropHuman(room, playerId)
  sock.state = 'OPEN'
  sock.playerId = null
  sock.roomCode = null
  if (sock.readyState === 1) sock.send(JSON.stringify({ t: 'left' }))
}

export function sendRoster(room) {
  const msg = JSON.stringify({
    t: 'roster',
    hostId: room.match.hostId,
    code: room.code,
    players: [...room.match.players.values()].filter((p) => !p.bot).map((p) => ({ id: p.id, name: p.name })),
    started: true,
  })
  for (const sock of room.sockets) {
    if (sock.readyState === 1) sock.send(msg)
  }
}

export function createPrivate(sock, { name, endRule, endValue }) {
  const rule = endRule === 'kills' ? 'kills' : 'time'
  const choices = rule === 'kills' ? KILL_TARGET_CHOICES : MATCH_TIME_CHOICES_SEC
  const value = choices.includes(Number(endValue)) ? Number(endValue) : choices[1]
  const token = crypto.randomBytes(16).toString('hex')
  const human = { id: id(), name: String(name || 'Pilot').slice(0, 16), token }
  const room = openRoom({
    source: 'private',
    humans: [human],
    endRule: rule,
    endValue: value,
    hostId: human.id,
  })
  const plane = room.match.players.get(human.id)
  sock.state = 'IN_MATCH'
  sock.token = token
  bindSocket(room, sock, plane)
  sock.send(JSON.stringify(startPayload(room, plane)))
  sendRoster(room)
  return room
}

export function joinPrivate(sock, { code, name }) {
  const room = roomByCode(code)
  if (!room) return { error: 'no_room' }
  if (room.match.phase !== 'play') return { error: 'over' }
  const token = crypto.randomBytes(16).toString('hex')
  const human = { id: id(), name: String(name || 'Pilot').slice(0, 16), token }
  const plane = addHumanToRoom(room, human)
  if (!plane) return { error: 'full' }
  sock.state = 'IN_MATCH'
  sock.token = token
  bindSocket(room, sock, plane)
  sock.send(JSON.stringify(startPayload(room, plane)))
  sendRoster(room)
  return { room, plane }
}

export function resume(sock, token) {
  const found = planeByToken(token)
  if (!found) return { error: 'expired' }
  const { room, plane } = found
  if (plane.disconnectAt && Date.now() - plane.disconnectAt > 8000 && !plane.alive && plane.respawnAt > Date.now() + 100000) {
    return { error: 'expired' }
  }
  sock.state = 'IN_MATCH'
  sock.token = plane.token
  bindSocket(room, sock, plane)
  sock.send(JSON.stringify(startPayload(room, plane)))
  return { room, plane }
}
