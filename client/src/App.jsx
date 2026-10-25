import { useEffect, useRef, useState } from 'react'
import { TRAIN_AHEAD, TRAIN_BEHIND, TRAIN_YAW_RAD, YAW_RATE, THROTTLE_MIN, THROTTLE_START, THROTTLE_STEP, SPEED_BASE } from '@airclash/shared/constants.js'
import { angDiff, forwardOf, segmentHitsCircle } from '@airclash/shared/geom.js'
import { ABILITY_LIST } from '@airclash/shared/abilities.js'
import { guideLine, keyLabel, loadBinds, saveBinds } from './binds.js'
import { createNet } from './net.js'
import { createRenderer } from './render/createRenderer.js'
import { useControls } from './useControls.js'

const ACTIONS = [
  ['turnLeft', 'Turn left'],
  ['turnRight', 'Turn right'],
  ['rocket', 'Rocket'],
  ['mine', 'Air mine'],
  ['speedUp', 'Faster'],
  ['speedDown', 'Slower'],
]

const SKIP_TRAIN = 'airclash-skip-train'

export default function App() {
  const [screen, setScreen] = useState(() => (localStorage.getItem(SKIP_TRAIN) === '1' ? 'menu' : 'ask'))
  const [binds, setBinds] = useState(loadBinds)
  const [showBinds, setShowBinds] = useState(false)
  const [listening, setListening] = useState(null)
  const [name, setName] = useState('Pilot')
  const [queue, setQueue] = useState(null)
  const [ready, setReady] = useState(false)
  const [snap, setSnap] = useState(null)
  const [area, setArea] = useState(null)
  const [meId, setMeId] = useState(null)
  const [error, setError] = useState('')
  const [endRule, setEndRule] = useState('time')
  const [endValue, setEndValue] = useState(300)
  const [code, setCode] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const netRef = useRef(null)
  const liveSnap = useRef(null)
  if (!netRef.current) netRef.current = createNet()

  useEffect(() => {
    const token = sessionStorage.getItem('airclash-token')
    if (!token) return undefined
    const net = netRef.current
    const off = net.on((msg) => {
      if (msg.t === 'matchStart') enterMatch(msg)
    })
    net.resume(token)
    return off
  }, [])

  useEffect(() => {
    const net = netRef.current
    return net.on((msg) => {
      if (msg.t === 'queueState') setQueue(msg)
      if (msg.t === 'matchStart') enterMatch(msg)
      if (msg.t === 'snap') {
        const next = { ...msg, planes: msg.players || msg.planes, over: msg.over || msg.match?.phase === 'over' }
        liveSnap.current = next
        setSnap(next)
      }
      if (msg.t === 'error') setError(msg.code || 'error')
    })
  }, [])

  function enterMatch(msg) {
    setArea(msg.area)
    setMeId(msg.playerId)
    setRoomCode(msg.roomCode || '')
    sessionStorage.setItem('airclash-token', msg.token)
    setScreen('match')
  }

  function patchBind(action, code) {
    const next = { ...binds }
    for (const key of Object.keys(next)) if (next[key] === code) next[key] = ''
    next[action] = code
    setBinds(next)
    saveBinds(next)
    setListening(null)
  }

  useEffect(() => {
    if (!listening) return undefined
    const onKey = (e) => {
      e.preventDefault()
      patchBind(listening, e.code)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listening, binds])

  return (
    <div className="app">
      {screen === 'ask' && (
        <section className="panel hero">
          <img className="mark" src="/assets/mark.jpg" alt="" />
          <h1>Air Clash</h1>
          <p className="muted">A short practice flight, or straight into the sky?</p>
          <div className="row">
            <button className="primary" onClick={() => setScreen('train')}>Train</button>
            <button className="ghost" onClick={() => { localStorage.setItem(SKIP_TRAIN, '1'); setScreen('menu') }}>Fly</button>
          </div>
        </section>
      )}
      {screen === 'train' && (
        <Train binds={binds} onDone={() => setScreen('menu')} onKeys={() => setShowBinds(true)} />
      )}
      {screen === 'menu' && (
        <section className="panel hero">
          <img className="mark" src="/assets/mark.jpg" alt="" />
          <h1>Air Clash</h1>
          <p className="muted">{guideLine(binds)}</p>
          <label>Name
            <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p className="warn">{error}</p>}
          <div className="row">
            <button className="primary" onClick={() => { setError(''); netRef.current.play(name || 'Pilot') }}>Play</button>
            <button className="ghost" onClick={() => setScreen('train')}>Train</button>
            <button className="ghost" onClick={() => setShowBinds(true)}>Keys</button>
          </div>
        </section>
      )}
      {screen === 'match' && area && (
        <Match
          binds={binds}
          net={netRef.current}
          snap={snap}
          area={area}
          meId={meId}
          roomCode={roomCode}
          liveSnap={liveSnap}
          onKeys={() => setShowBinds(true)}
          onLeave={() => { netRef.current.leave(); sessionStorage.removeItem('airclash-token'); setSnap(null); liveSnap.current = null; setScreen('menu') }}
        />
      )}
      {showBinds && (
        <div className="modal">
          <div className="panel">
            <h2>Keys</h2>
            <p className="muted">Click a row, then press the key you want. Guides use these names.</p>
            {ACTIONS.map(([action, label]) => (
              <div className="bind-row" key={action}>
                <span>{label}</span>
                <button className="ghost" onClick={() => setListening(action)}>
                  {listening === action ? 'Press a key' : keyLabel(binds[action])}
                </button>
              </div>
            ))}
            <div className="row"><button className="primary" onClick={() => setShowBinds(false)}>Done</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function Train({ binds, onDone, onKeys }) {
  const canvasRef = useRef(null)
  const touch = useRef({ left: false, right: false, rocket: false, mine: false, faster: false, slower: false })
  const readRef = useControls(binds, touch)
  const [task, setTask] = useState(0)
  const world = useRef({
    x: 800, y: 800, yaw: 0, throttle: THROTTLE_START,
    startYaw: 0, left: false, right: false,
    rockets: [], mines: [],
    speedUp: false, speedDown: false,
    trail: [],
    dummy: null,
  })

  const prompts = [
    `Press ${keyLabel(binds.turnLeft)} and ${keyLabel(binds.turnRight)}.`,
    `Press ${keyLabel(binds.rocket)}. A plane is ahead of you. Turning is held.`,
    `Press ${keyLabel(binds.mine)}. A plane is behind you.`,
    `Press ${keyLabel(binds.speedUp)} to fly faster and ${keyLabel(binds.speedDown)} to fly slower.`,
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = createRenderer(canvas)
    let raf = 0
    let last = performance.now()
    const area = { w: 1600, h: 1600, trees: [], buildings: [], pads: [] }
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const input = readRef.current()
      const w = world.current
      if (task !== 1) w.yaw += input.yaw * YAW_RATE * dt
      if (input.speed > 0) w.speedUp = true
      if (input.speed < 0) w.speedDown = true
      if (input.speed) w.throttle = Math.max(THROTTLE_MIN, Math.min(1, w.throttle + input.speed * THROTTLE_STEP * dt * 8))
      const f = forwardOf(w.yaw)
      w.x += f.x * SPEED_BASE * w.throttle * dt
      w.y += f.y * SPEED_BASE * w.throttle * dt
      w.trail.push({ x: w.x, y: w.y, yaw: w.yaw })
      if (w.trail.length > 80) w.trail.shift()
      if (angDiff(w.yaw, w.startYaw) > TRAIN_YAW_RAD) w.right = true
      if (angDiff(w.yaw, w.startYaw) < -TRAIN_YAW_RAD) w.left = true
      if (task === 1 && input.fire) {
        w.rockets.push({ x: w.x + f.x * 40, y: w.y + f.y * 40, heading: w.yaw, traveled: 0 })
      }
      if (task === 2 && input.mine) w.mines.push({ x: w.x, y: w.y })
      const ahead = { x: w.x + f.x * TRAIN_AHEAD, y: w.y + f.y * TRAIN_AHEAD, yaw: w.yaw }
      const behindX = w.x - f.x * TRAIN_BEHIND
      const behindY = w.y - f.y * TRAIN_BEHIND
      if (!w.dummy) w.dummy = { x: behindX, y: behindY }
      const prevDummyX = w.dummy.x
      const prevDummyY = w.dummy.y
      w.dummy.x = behindX
      w.dummy.y = behindY
      const behindSpot = { x: behindX, y: behindY, yaw: w.yaw }
      for (const r of w.rockets) {
        const rf = forwardOf(r.heading)
        r.x += rf.x * 360 * dt
        r.y += rf.y * 360 * dt
      }
      let hitFront = false
      if (task === 1) {
        hitFront = w.rockets.some((r) => Math.hypot(r.x - ahead.x, r.y - ahead.y) < 28)
      }
      let crossed = false
      if (task === 2) {
        crossed = w.mines.some((m) => segmentHitsCircle(prevDummyX, prevDummyY, w.dummy.x, w.dummy.y, m.x, m.y, 30))
      }
      const planes = [{
        id: 'me', name: 'You', bot: false, type: 'scout', level: 1, hp: 100, maxHp: 100, x: w.x, y: w.y, yaw: w.yaw, alive: true,
      }]
      if (task === 1) planes.push({ id: 'front', name: 'Target', bot: true, type: 'scout', level: 1, hp: 100, maxHp: 100, x: ahead.x, y: ahead.y, yaw: ahead.yaw, alive: true })
      if (task === 2) planes.push({ id: 'back', name: 'Tail', bot: true, type: 'scout', level: 1, hp: 100, maxHp: 100, x: behindSpot.x, y: behindSpot.y, yaw: behindSpot.yaw, alive: true })
      renderer.draw({
        area,
        me: planes[0],
        planes,
        rockets: w.rockets.map((r, i) => ({ id: i, ...r })),
        mines: w.mines.map((m, i) => ({ id: i, ...m, radius: 26 })),
        bonuses: [],
        events: [],
        eventStamp: 0,
        now: 0,
      })
      if (task === 0 && w.left && w.right) setTask(1)
      if (task === 1 && hitFront) setTask(2)
      if (task === 2 && crossed) setTask(3)
      if (task === 3 && w.speedUp && w.speedDown) setTask(4)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); renderer.destroy() }
  }, [task, binds, readRef])

  return (
    <div className="stage">
      <canvas ref={canvasRef} />
      <div className="hud">
        <div className="card">
          <strong>Training {Math.min(task + 1, 4)} / 4</strong>
          <p>{task >= 4 ? 'Training complete.' : prompts[task]}</p>
          <p className="muted">{guideLine(binds)}</p>
          <div className="row">
            <button className="ghost" onClick={onDone}>Menu</button>
            {task >= 4 && <button className="primary" onClick={onDone}>Continue</button>}
            <button className="ghost" onClick={onKeys}>Keys</button>
          </div>
        </div>
        <Pads touch={touch} lockTurn={task === 1} />
      </div>
    </div>
  )
}

function Match({ binds, net, snap, area, meId, roomCode, liveSnap, onKeys, onLeave }) {
  const canvasRef = useRef(null)
  const touch = useRef({ left: false, right: false, rocket: false, mine: false, faster: false, slower: false })
  const readRef = useControls(binds, touch)
  const snapRef = useRef(snap)
  snapRef.current = snap
  const [showChoice, setShowChoice] = useState(false)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = createRenderer(canvas)
    let raf = 0
    let last = performance.now()
    let pred = null
    let lastInput = ''
    let seenLog = -1
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const input = readRef.current()
      const key = JSON.stringify(input)
      if (key !== lastInput || input.yaw || input.speed || input.fire || input.mine) net.input(input)
      lastInput = key
      const current = liveSnap.current || snapRef.current
      const serverMe = current?.planes?.find((p) => p.id === meId)
      if (current && serverMe) {
        if (!pred || serverMe.choosing || !serverMe.alive) {
          pred = { x: serverMe.x, y: serverMe.y, yaw: serverMe.yaw }
        } else {
          pred.yaw += input.yaw * YAW_RATE * dt
          const speed = serverMe.speed || 0
          pred.x += Math.sin(pred.yaw) * speed * dt
          pred.y += Math.cos(pred.yaw) * speed * dt
          const follow = Math.min(1, dt * (input.yaw ? 2 : 10))
          pred.x += (serverMe.x - pred.x) * follow
          pred.y += (serverMe.y - pred.y) * follow
          if (!input.yaw) pred.yaw += angDiff(serverMe.yaw, pred.yaw) * Math.min(1, dt * 12)
        }
        const meDraw = { ...serverMe, x: pred.x, y: pred.y, yaw: pred.yaw }
        const planes = current.planes.map((p) => (p.id === meId ? meDraw : p))
        renderer.draw({
          area,
          me: meDraw,
          planes,
          rockets: current.rockets,
          mines: current.mines,
          bonuses: current.bonuses,
          events: current.events,
          eventStamp: current.now,
          now: current.now,
        })
        setShowChoice((prev) => (prev === !!serverMe.choosing ? prev : !!serverMe.choosing))
        if (current.now !== seenLog) {
          seenLog = current.now
          const lines = (current.events || []).filter((ev) => (ev.t || ev.type) === 'log').map((ev) => ev.text)
          if (lines.length) setLogs((prev) => [...lines.reverse(), ...prev].slice(0, 8))
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); renderer.destroy() }
  }, [area, liveSnap, meId, net, readRef])

  const me = snap?.planes?.find((p) => p.id === meId)
  const ranking = (snap?.match?.ranking || []).map((id) => snap.planes.find((p) => p.id === id)).filter(Boolean)
  const leader = ranking[0]
  const place = ranking.findIndex((p) => p.id === meId) + 1
  const remain = snap?.match?.endsAt ? Math.max(0, Math.ceil((snap.match.endsAt - snap.now) / 1000)) : null

  return (
    <div className="stage">
      <canvas ref={canvasRef} />
      <div className="hud">
        <div className="topbar">
          <div className="card">
            <Hp me={me} />
            <div className="muted">Lv {me?.level || 1} {me?.type || ''}</div>
            {roomCode && <div className="muted">Room {roomCode}</div>}
            <div className="bar"><span style={{ width: `${me ? (100 * me.xp) / (me.xpNext || 1) : 0}%` }} /></div>
            <Ammo me={me} />
            <Buffs me={me} />
            <div className="muted">{guideLine(binds)}</div>
            {me && snap.now < me.joinShieldUntil && <div className="warn">Shield — you cannot fire yet</div>}
            <div className="row">
              <button className="ghost" onClick={onKeys}>Keys</button>
              <button className="ghost" onClick={onLeave}>Leave</button>
            </div>
          </div>
          <div className="card">
            <div>Rank {place || '–'} of {ranking.length}</div>
            <div className="bar"><span style={{ width: `${leader ? (100 * (me?.kills || 0)) / Math.max(1, leader.kills) : 0}%`, background: '#e0b15a' }} /></div>
            <div className="rank">
              {ranking.map((p, i) => (
                <div key={p.id} className={p.id === meId ? 'me' : ''}>{i + 1}. {p.name} · {p.kills} kills · Lv {p.level}</div>
              ))}
            </div>
            {remain != null && <div>{Math.floor(remain / 60)}:{String(remain % 60).padStart(2, '0')}</div>}
            <ul className="log">
              {logs.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
            </ul>
          </div>
        </div>
        {showChoice && me && (
          <div className="choice">
            <strong>Level {me.level}. Pick one.</strong>
            <p className="muted">{Math.max(0, Math.ceil((me.levelUpUntil - snap.now) / 1000))}s. Wait, and you keep the star.</p>
            <div className="offers">
              {(me.offers || []).map((id) => {
                const info = ABILITY_LIST.find((row) => row.id === id)
                const rank = me.abilities?.[id] || 0
                return (
                  <button key={id} className="offer" onClick={() => net.pick(id)}>
                    <b>{info?.name || id}</b>
                    <span className="dots">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < rank ? 'on' : ''} />)}</span>
                    <small>{info?.hint}</small>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {snap?.over && (
          <div className="choice">
            <strong>{ranking[0] ? `${ranking[0].name} wins` : 'Match over'}</strong>
            <div className="row"><button className="primary" onClick={onLeave}>Back</button></div>
          </div>
        )}
        <Speedo me={me} />
      </div>
    </div>
  )
}

function Hp({ me }) {
  const pct = me ? Math.max(0, Math.min(100, (100 * me.hp) / (me.maxHp || 1))) : 0
  return (
    <div className="hp" aria-label="Health">
      <div className="track"><i style={{ width: `${pct}%` }} /></div>
      <b>{me ? `${Math.round(me.hp)} / ${me.maxHp}` : '—'}</b>
    </div>
  )
}

function Ammo({ me }) {
  if (!me) return null
  return (
    <div className="ammo">
      <PipRow kind="rocket" stock={me.rocketStock || 0} max={me.rocketMax || 0} charge={me.rocketCharge ?? 1} />
      <PipRow kind="mine" stock={me.mineStock || 0} max={me.mineMax || 0} charge={me.mineCharge ?? 1} />
    </div>
  )
}

function PipRow({ kind, stock, max, charge }) {
  return (
    <div className={`pips ${kind}`}>
      {Array.from({ length: Math.max(max, 1) }, (_, i) => {
        const on = i < stock
        const charging = !on && i === stock
        const period = Math.round(860 - 680 * Math.max(0, Math.min(1, charge)))
        return (
          <i
            key={i}
            className={on ? 'on' : charging ? 'charge' : ''}
            style={charging ? { animationDuration: `${period}ms` } : { opacity: on ? 1 : 0.28 }}
          />
        )
      })}
    </div>
  )
}

function Buffs({ me }) {
  if (!me?.buffs) return null
  const chips = []
  if (me.buffs.damage > 0) chips.push(['damage', 'Double'])
  if (me.buffs.speed > 0) chips.push(['speed', 'Boost'])
  if (me.buffs.immune > 0) chips.push(['immune', 'Ghost'])
  if (me.shield > 0) chips.push(['shield', 'Plate'])
  if (!chips.length) return null
  return (
    <div className="buffs">
      {chips.map(([kind, label]) => <span key={kind} className={kind}>{label}</span>)}
    </div>
  )
}

function Speedo({ me }) {
  const steps = []
  for (let t = THROTTLE_MIN; t <= 1.001; t += THROTTLE_STEP) steps.push(Number(t.toFixed(2)))
  const throttle = me?.throttle ?? THROTTLE_START
  return (
    <div className="speedo">
      <b>{Math.round(me?.speed || 0)}</b>
      <div className="speed-track">
        {steps.map((step) => <i key={step} className={throttle + 0.001 >= step ? 'on' : ''} />)}
      </div>
    </div>
  )
}

function Pads({ touch, lockTurn }) {
  function set(key, value) {
    if (lockTurn && (key === 'left' || key === 'right')) return
    touch.current[key] = value
  }
  const keys = lockTurn
    ? [['rocket', 'Rocket'], ['mine', 'Mine'], ['faster', 'Faster'], ['slower', 'Slower']]
    : [['left', 'Left'], ['right', 'Right'], ['rocket', 'Rocket'], ['mine', 'Mine'], ['faster', 'Faster'], ['slower', 'Slower']]
  return (
    <div className="pads">
      {keys.map(([key, label]) => (
        <button
          key={key}
          className="pad"
          onPointerDown={(e) => { e.preventDefault(); set(key, true) }}
          onPointerUp={() => set(key, false)}
          onPointerLeave={() => set(key, false)}
        >{label}</button>
      ))}
    </div>
  )
}
