function socketUrl() {
  if (import.meta.env.DEV) return `ws://${location.hostname}:8787/ws`
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

export function createNet() {
  let ws = null
  let seq = 0
  const pending = []
  const listeners = new Set()

  function emit(msg) {
    for (const fn of listeners) fn(msg)
  }

  function connect() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return
    ws = new WebSocket(socketUrl())
    ws.onopen = () => {
      while (pending.length && ws.readyState === 1) ws.send(pending.shift())
    }
    ws.onmessage = (ev) => {
      try { emit(JSON.parse(ev.data)) } catch { /* ignore bad frames */ }
    }
    ws.onclose = () => emit({ t: 'closed' })
  }

  function send(obj) {
    const raw = JSON.stringify(obj)
    if (ws?.readyState === 1) ws.send(raw)
    else {
      pending.push(raw)
      connect()
    }
  }

  return {
    connect,
    on(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    play(name) { send({ t: 'play', name }) },
    leave() { send({ t: 'leave' }) },
    ready(on) { send({ t: 'ready', on }) },
    create(body) { send({ t: 'create', ...body }) },
    join(body) { send({ t: 'join', ...body }) },
    resume(token) { send({ t: 'resume', token }) },
    pick(stat) { send({ t: 'pick', stat }) },
    input(body) {
      seq += 1
      send({ t: 'input', seq, yaw: body.yaw || 0, speed: body.speed || 0, fire: !!body.fire, mine: !!body.mine })
    },
    close() { try { ws?.close() } catch { /* ignore */ } },
  }
}
