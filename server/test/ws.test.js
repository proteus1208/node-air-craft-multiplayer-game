import test from 'node:test'
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'
import { start } from '../index.js'

function once(ws, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), 4000)
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.t === type) {
        clearTimeout(timer)
        ws.off('message', onMsg)
        resolve(msg)
      }
    }
    ws.on('message', onMsg)
  })
}

test('play drops pilots into one shared room and refills a bot when one leaves', async () => {
  const { server, port } = await start(0)
  const open = () => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    ws.on('open', () => resolve(ws))
  })
  const a = await open()
  const b = await open()
  a.send(JSON.stringify({ t: 'play', name: 'Ada' }))
  const startA = await once(a, 'matchStart')
  b.send(JSON.stringify({ t: 'play', name: 'Ben' }))
  const startB = await once(b, 'matchStart')
  assert.equal(startA.roomCode, startB.roomCode)
  assert.equal(startA.area.seed, startB.area.seed)
  const snap = await once(b, 'snap')
  const planes = snap.players || snap.planes
  assert.equal(planes.length, 20)
  assert.equal(planes.filter((p) => !p.bot).length, 2)
  a.send(JSON.stringify({ t: 'leave' }))
  const after = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for refill')), 4000)
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString())
      const list = msg.players || msg.planes
      if (msg.t === 'snap' && list && list.filter((p) => !p.bot).length === 1 && list.length === 20) {
        clearTimeout(timer)
        b.off('message', onMsg)
        resolve(msg)
      }
    }
    b.on('message', onMsg)
  })
  assert.equal((after.players || after.planes).length, 20)
  a.close()
  b.close()
  await new Promise((resolve) => server.close(resolve))
})
