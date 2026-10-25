/** Every tuned number for Air Clash. Gameplay positions are x, y, and yaw only. */

export const TICK_HZ = 20
export const MAX_LEVEL = 25
export const MAX_PLANES = 20
export const MAX_PLAYERS = MAX_PLANES
export const BOT_FILL = MAX_PLANES

export const YAW_RATE = 1.8
export const BOT_YAW_RATE = YAW_RATE * 0.5

export const THROTTLE_START = 0.65
export const THROTTLE_STEP = 0.1
export const THROTTLE_MIN = 0.35
export const SPEED_STEP_MS = 180
export const SPEED_BASE = 160
export const SPEED_PER_RANK = 8

export const HP_BASE = 100
export const HP_PER_RANK = 20
export const HP_PER_LEVEL = 14
export const SPEED_PER_LEVEL = 6
export const DAMAGE_PER_LEVEL = 0.08
export const HULL_HP = 30

export const ROCKET_DAMAGE = 18
export const MINE_DAMAGE = 26
export const DAMAGE_PER_RANK = 0.12
export const BOT_DAMAGE_MULT = 0.28

export const ROCKET_STOCK_BASE = 3
export const ROCKET_STOCK_PER_LEVEL = 1
export const ROCKET_STOCK_CAP = 12
export const ROCKET_RECHARGE_MS = 1100
export const BOT_ROCKET_RECHARGE_MS = 2600
export const GUARD_PREP_SLOW_MS = 5000
export const GUARD_PREP_FAST_MS = 1000
export const GUARD_CHANCE_MIN = 0.1
export const GUARD_CHANCE_MAX = 0.5

export const BULLET_INTERVAL_MS = 380
export const BULLET_INTERVAL_STEP_MS = 30
export const BULLET_INTERVAL_MIN_MS = 180
export const BOT_TRIGGER_MS = 900
export const BOT_MINE_MS = 4000
export const BOT_MINE_BEHIND = 200
export const BOT_XP_MULT = 0.5
export const BOT_AVOID_MS = 600

export const MINE_STOCK_BASE = 2
export const MINE_REFILL_MS = 8000
export const MINE_LIFETIME_MS = 18000
export const MINE_FADE_FAR = 520
export const MINE_FADE_NEAR = 160

export const JOIN_SHIELD_MS = 4000
export const SHIELD_BLINK_SLOW_MS = 500
export const SHIELD_BLINK_FAST_MS = 70
export const LEVELUP_CHOOSE_MS = 12000
export const RESPAWN_MS = 3000

export const BORDER_BAND = 120
export const BORDER_DPS = 0.05
export const BORDER_HP_FRACTION_PER_SEC = BORDER_DPS
export const AREA_INSET = 160

export const TRACK_RADIUS_BASE = 180
export const TRACK_RADIUS_PER_LEVEL = 12
export const TRACK_ANGLE_BASE = 0.25
export const TRACK_ANGLE_PER_LEVEL = 0.03
export const TRACK_ANGLE_CAP = 1.05
export const ROCKET_RANGE_BASE = 420
export const ROCKET_RANGE_PER_LEVEL = 18
export const ROCKET_SPEED = 360
export const ROCKET_TURN_RAD_PER_SEC = 2.2
export const ROCKET_SPREAD_RAD = 0.04

export const PLANE_RADIUS = 18
export const ROCKET_RADIUS = 7
export const MINE_RADIUS = 16
export const NOSE_OFFSET = 28
export const PICKUP_RADIUS = 28

export const XP_KILL_BASE = 100
export const XP_KILL_PER_VICTIM_LEVEL = 15

export const TRAIN_AHEAD = 280
export const TRAIN_BEHIND = 220
export const TRAIN_YAW_RAD = (25 * Math.PI) / 180

export const PUBLIC_COUNTDOWN_MS = 15000
export const PUBLIC_LATE_JOIN_MS = 60000
export const PUBLIC_RETURN_MS = 12000
export const PUBLIC_MATCH_SEC = 300
export const MATCH_TIME_CHOICES_SEC = [180, 300, 600]
export const KILL_TARGET_CHOICES = [5, 10, 20]

export const PING_MS = 5000
export const PONG_TIMEOUT_MS = 15000
export const BACKPRESSURE_BYTES = 256 * 1024
export const MAX_INBOUND_BYTES = 2048
export const RESUME_GRACE_MS = 8000
export const EMPTY_ROOM_MS = 60000
export const HANDSHAKE_MS = 5000

export const BONUS_PHASE_OPEN_SEC = 30
export const BONUS_FILL_MS = 8000
export const BONUS_PITY_RADIUS = 400
export const BONUS_PITY_HP = 0.3
export const BUFF_DAMAGE_MS = 6000
export const BUFF_IMMUNE_MS = 2500
export const BUFF_SPEED_MS = 5000
export const BUFF_SPEED_MULT = 1.35
export const HEAL_AMOUNT = 40

export const AREA_W_MIN = 2200 * 1.5
export const AREA_W_MAX = 4200 * 1.5
export const AREA_H_MIN = 2200 * 1.5
export const AREA_H_MAX = 4200 * 1.5
export const BUILDING_MIN = 10
export const BUILDING_MAX = 18
export const BUILDING_SIDE_MIN = 80
export const BUILDING_SIDE_MAX = 220
export const BUILDING_GAP = 40
export const BUILDING_TRIES = 40
export const TREE_MIN = 60
export const TREE_MAX = 120
export const TREE_RADIUS = 28
export const TREE_BUILDING_PAD = 20
export const SPAWN_COUNT = 20
export const SPAWN_GAP = 240
export const SPAWN_GAP_MIN = 200
export const SPAWN_GAP_STEP = 40
export const SPAWN_INSET = 200
export const PAD_COUNT = 6
export const PAD_GAP = 300
export const PAD_SPAWN_GAP = 220

export const SMOKE_EVERY_PX = 18
export const SMOKE_POOL = 240
export const BLAST_POOL = 32
export const GROUND_TILE = 256
export const CULL_PX = 80

export const ZOOM_DESKTOP = 1
export const ZOOM_NARROW = 0.8
export const NARROW_PX = 400

export const DEFAULT_BINDS = {
  turnLeft: 'KeyJ',
  turnRight: 'KeyL',
  rocket: 'KeyI',
  mine: 'KeyK',
  speedUp: 'KeyW',
  speedDown: 'KeyS',
}

export const PREVIOUS_BINDS = {
  turnLeft: 'KeyA',
  turnRight: 'KeyD',
  rocket: 'KeyW',
  mine: 'KeyS',
  speedUp: 'KeyI',
  speedDown: 'KeyK',
}

export const BIND_LABELS = {
  turnLeft: 'turn left',
  turnRight: 'turn right',
  rocket: 'rocket',
  mine: 'mine',
  speedUp: 'faster',
  speedDown: 'slower',
}
