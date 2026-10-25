import { PING_MS, PONG_TIMEOUT_MS } from '@airclash/shared/constants.js'
import { applyInput, applyPick, unbindSocket } from './rooms.js'
import { createPrivate, enterPlay, enterQueue, joinPrivate, leaveMatch, leaveQueue, resume, setReady } from './matchmaker.js'

const NAME = /^[\p{L}\p{N} _.'-]{1,16}$/u

function cleanName(name) {
  const s = String(name || '').trim().slice(0, 16)
  if (!NAME.test(s)) return null
  return s
}

export function attachWs(wss) {
  wss.on('connection', (sock) => {
    sock.state = 'OPEN'
    sock.lastPong = Date.now()
    sock.playerId = null
    const greetTimer = setTimeout(() => {
      if (sock.state === 'OPEN' && !sock.playerId) {
        try { sock.close() } catch { /* already gone */ }
      }
    }, 15000)

    sock.on('pong', () => {
      sock.lastPong = Date.now()
    })

    sock.on('message', (raw) => {
      if (raw.length > 2048) {
        sock.close()
        return
      }
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      handle(sock, msg)
    })

    sock.on('close', () => {
      clearTimeout(greetTimer)
      leaveQueue(sock)
      unbindSocket(sock)
    })
  })

  const beat = setInterval(() => {
    const now = Date.now()
    for (const sock of wss.clients) {
      if (now - (sock.lastPong || 0) > PONG_TIMEOUT_MS) {
        try { sock.terminate() } catch { /* ignore */ }
        continue
      }
      if (sock.readyState === 1) sock.ping()
    }
  }, PING_MS)
  beat.unref()
  wss.on('close', () => clearInterval(beat))
}

function send(sock, obj) {
  if (sock.readyState === 1) sock.send(JSON.stringify(obj))
}

function handle(sock, msg) {
  const t = msg?.t
  if (t === 'pong' || t === 'ping') {
    sock.lastPong = Date.now()
    return
  }
  if (sock.state === 'OPEN') {
    if (t === 'play') {
      const name = cleanName(msg.name)
      if (!name) return send(sock, { t: 'error', code: 'name' })
      enterPlay(sock, name)
      return
    }
    if (t === 'queue') {
      const name = cleanName(msg.name)
      if (!name) return send(sock, { t: 'error', code: 'name' })
      enterQueue(sock, name)
      return
    }
    if (t === 'create') {
      const name = cleanName(msg.name)
      if (!name) return send(sock, { t: 'error', code: 'name' })
      createPrivate(sock, { name, endRule: msg.endRule, endValue: msg.endValue })
      return
    }
    if (t === 'join') {
      const name = cleanName(msg.name)
      if (!name) return send(sock, { t: 'error', code: 'name' })
      const res = joinPrivate(sock, { code: msg.code, name })
      if (res?.error) send(sock, { t: 'error', code: res.error })
      return
    }
    if (t === 'resume') {
      const res = resume(sock, msg.token)
      if (res?.error) send(sock, { t: 'error', code: res.error })
      return
    }
    return send(sock, { t: 'error', code: 'bad_state' })
  }
  if (sock.state === 'IN_QUEUE') {
    if (t === 'ready') {
      setReady(sock, msg.on)
      return
    }
    if (t === 'leave') {
      leaveQueue(sock)
      return
    }
    return send(sock, { t: 'error', code: 'bad_state' })
  }
  if (sock.state === 'IN_MATCH' || sock.state === 'IN_ROOM') {
    if (t === 'input') {
      applyInput(sock, msg)
      return
    }
    if (t === 'pick') {
      applyPick(sock, msg.stat)
      return
    }
    if (t === 'leave') {
      leaveMatch(sock)
      return
    }
    return
  }
}
