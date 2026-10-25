# Air Clash rules

Survival. Every plane is hostile to every other plane, including bots. Highest kills when the clock ends wins. Ties break by level, then by fewer deaths. A public match lasts 5 minutes. A private host can pick 3, 5, or 10 minutes, or first to 5, 10, or 20 kills.

## Controls

Keys are rebindable. The defaults are A and D to turn, W to fire a rocket, S to lay an air mine, I to fly faster, K to fly slower. The on-screen guide prints your keys.

The camera sits on your plane. The top of the screen is always the nose.

## Rocket

A rocket flies forward and steers only while an enemy is inside both a radius and a cone, and only if the turn stays inside that cone measured from the launch heading. Radius, cone, and path length are fixed from your level when you fire.

- Radius: `180 + 12 * (level - 1)`
- Half-angle: `min(1.05, 0.25 + 0.03 * (level - 1))` radians
- Range: `420 + 18 * (level - 1)`

## Air mine

The mine stays where you launch it. It damages a plane whose path crosses it. Your own mine does not hurt you. From far away it is invisible. It fades in as you approach (`MINE_FADE_FAR` 520, `MINE_FADE_NEAR` 160).

Two rockets that touch remove each other. A rocket that touches a mine removes both. The blast does not hurt nearby planes. Two planes that overlap are pushed apart and lose no HP.

## Level

Cap 25. A kill grants `100 + 15 * (victimLevel - 1)` XP. Leaving level L costs `40 + 25 * L`. On level-up you stop, become immune, and have 12 seconds to spend one star on max HP, speed ceiling, damage, a one-hit shield, a faster trigger, or mine stock. If the timer ends, you take off and keep the star. The airframe changes at levels 5, 10, 15, 20, and 25 when you take off: Scout, Falcon, Hawk, Condor, Storm, Apex.

## Join shield and border

For 4 seconds after you appear you take no hit and you cannot fire or lay a mine. The cyan ring blinks slowly, then faster, as that window ends. In the outer 120 units of the map you lose 5% of max HP per second.

## Bots

Empty seats fill until the room has 6 planes, and never past 8. Bots fire on a 900 ms trigger and deal 45% rocket damage. Neither number improves with their level. Killing them still grants XP, so you can level with no other human in the room.

## Bonuses

The server fills six pads. For the first 30 seconds, or until the first kill, pads roll heal or speed. After that the weights are heal 30, speed 25, shield 20, double damage 15, immunity 10. A plane under 30% HP gets one forced heal on a nearby pad per life.
