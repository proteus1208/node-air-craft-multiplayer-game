import { DEFAULT_BINDS, PREVIOUS_BINDS } from '@airclash/shared/constants.js'

const STORAGE = 'airclash-binds'

function sameBinds(a, b) {
  return Object.keys(DEFAULT_BINDS).every((key) => a[key] === b[key])
}

export function loadBinds() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || '{}')
    if (!raw.turnLeft || sameBinds(raw, PREVIOUS_BINDS)) return { ...DEFAULT_BINDS }
    return { ...DEFAULT_BINDS, ...raw }
  } catch {
    return { ...DEFAULT_BINDS }
  }
}

export function saveBinds(binds) {
  localStorage.setItem(STORAGE, JSON.stringify(binds))
}

export function keyLabel(code) {
  if (!code) return '…'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Arrow')) return code.slice(5)
  if (code === 'Space') return 'Space'
  return code
}

export function guideLine(binds) {
  return `${keyLabel(binds.turnLeft)}/${keyLabel(binds.turnRight)} turn · ${keyLabel(binds.rocket)} rocket · ${keyLabel(binds.mine)} mine · ${keyLabel(binds.speedUp)}/${keyLabel(binds.speedDown)} speed`
}
