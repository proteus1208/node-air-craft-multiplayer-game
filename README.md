# Air Clash

Survival dogfight for a phone or a laptop. No account. The world is flat: every plane has `x`, `y`, and `yaw`, and no altitude. The React canvas draws that state nose-up. A later Three.js view can replace `client/src/render` and map `(x, y)` onto ground X/Z with height fixed at 0 inside the renderer only.

## Run

```bash
cd task
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173). The game server listens on http://localhost:8787 and the dev client connects its WebSocket there.

Production, one process:

```bash
npm start
```

Then open http://localhost:8787 (or `PORT` if you set it).

## Play

1. The first screen asks if you want training. Yes runs four tasks. No goes to survival.
2. Play enters the public queue. Check Ready. The server opens a match on a new map and fills empty seats with bots.
3. Private room creates a code a friend can type.
4. Default keys: A/D turn, W rocket, S mine, I faster, K slower. Change them in Keys. The guide uses whatever you saved.

The border band costs 5% of max HP per second. A fresh spawn is shielded for 4 seconds and cannot fire. Rockets track only inside a cone, an area, and a range that grow with level, up to level 25.

## Layout

- `shared/` formulas and the map generator. No renderer imports.
- `server/` authoritative rooms, WebSocket, bots.
- `client/` React screens and one canvas renderer behind `createRenderer`.
- `docs/` rules, structure, references.
