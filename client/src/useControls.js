import { useEffect, useRef } from 'react'

export function useControls(binds, touch) {
  const held = useRef(new Set())
  const bindsRef = useRef(binds)
  bindsRef.current = binds

  useEffect(() => {
    const down = (e) => {
      held.current.add(e.code)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    }
    const up = (e) => held.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const read = useRef(() => ({ yaw: 0, speed: 0, fire: false, mine: false }))
  read.current = () => {
    const map = bindsRef.current
    const t = touch.current
    let yaw = 0
    let speed = 0
    if (held.current.has(map.turnLeft) || t.left) yaw -= 1
    if (held.current.has(map.turnRight) || t.right) yaw += 1
    if (held.current.has(map.speedUp) || t.faster) speed += 1
    if (held.current.has(map.speedDown) || t.slower) speed -= 1
    return {
      yaw: Math.max(-1, Math.min(1, yaw)),
      speed: Math.max(-1, Math.min(1, speed)),
      fire: held.current.has(map.rocket) || !!t.rocket,
      mine: held.current.has(map.mine) || !!t.mine,
    }
  }
  return read
}
