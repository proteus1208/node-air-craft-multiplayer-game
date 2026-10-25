/** Message names and the allow-lists the server checks. */

export const MSG = Object.freeze({
  QUEUE: 'queue',
  READY: 'ready',
  MATCH_START: 'matchStart',
  CREATE: 'create',
  JOIN: 'join',
  WELCOME: 'welcome',
  START: 'start',
  INPUT: 'input',
  PICK: 'pick',
  SNAP: 'snap',
  RESUME: 'resume',
  HEARTBEAT: 'heartbeat',
  LEAVE: 'leave',
  ROSTER: 'roster',
  QUEUE_STATE: 'queueState',
  ERROR: 'error',
})

export const STATES = Object.freeze({
  OPEN: 'OPEN',
  IN_QUEUE: 'IN_QUEUE',
  IN_ROOM: 'IN_ROOM',
  IN_MATCH: 'IN_MATCH',
})

export { ABILITY_IDS as PICK_STATS } from './abilities.js'

export const OPEN_MESSAGES = Object.freeze(['queue', 'create', 'join', 'resume', 'heartbeat'])
export const QUEUE_MESSAGES = Object.freeze(['ready', 'leave', 'heartbeat'])
export const ROOM_MESSAGES = Object.freeze(['start', 'leave', 'heartbeat'])
export const MATCH_MESSAGES = Object.freeze(['input', 'pick', 'leave', 'queue', 'heartbeat'])

export function validName(name) {
  if (typeof name !== 'string') return false
  const s = name.trim()
  if (s.length < 1 || s.length > 16) return false
  return /^[\p{L}\p{N} ]+$/u.test(s)
}

export function clampName(name) {
  return String(name || '').trim().slice(0, 16)
}
