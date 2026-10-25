# References

- Canvas camera math lives in `shared/geom.js` (`worldToScreen`). Nose-up means forward is screen-up.
- Segment-versus-circle tests decide air-mine hits so a fast plane cannot skip a mine between ticks.
- WebSocket protocol names are in `shared/protocol.js`. The server is authoritative; the browser sends intentions.
- Fast-paced multiplayer notes (snapshots, input, interpolation): Gabriel Gambetta, https://www.gabrielgambetta.com/client-server-game-architecture.html
- Public queue pattern is the ready-and-countdown feel of https://territorial.io/ — one Room object per match, not a new operating-system process.
- Renderer boundary: `client/src/render/createRenderer.js`. Three.js is not a dependency. A later renderer maps the flat world onto a ground plane.
