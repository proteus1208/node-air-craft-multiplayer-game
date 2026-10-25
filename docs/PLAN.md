# Structure

The simulation never stores a height. Planes, rockets, mines, trees, and buildings are `{x, y}` plus yaw where they face a direction.

```
task/
  shared/     constants, XP, geometry, map seed, protocol names
  server/     http + ws, matchmaker, rooms, sim, bots, pads
  client/
    src/render/   createRenderer(canvas).draw(frame)
                  canvas2d.js is the current view
                  a Three.js view would implement the same draw(frame)
                  and map x,y onto X,Z with height 0 inside that file only
    src/screens/  training question, tasks, queue, match HUD
```

React does not compute hits. It sends yaw, speed, fire, and mine. The server ticks at 20 Hz and broadcasts one snapshot per room.

## Swap the view later

1. Add a renderer next to `canvas2d.js` that exports `createRenderer(canvas)`.
2. Pass it to the match screen instead of the canvas renderer.
3. Leave `shared/` and `server/` untouched. Do not add `z` to snapshots.
