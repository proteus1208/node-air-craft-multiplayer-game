import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import { attachWs } from './ws.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const clientDist = path.resolve(__dirname, '../client/dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (rel === '/') rel = '/index.html'
  const file = path.join(clientDist, path.normalize(rel))
  if (!file.startsWith(clientDist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const index = path.join(clientDist, 'index.html')
    if (fs.existsSync(index)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      fs.createReadStream(index).pipe(res)
      return
    }
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('Air Clash server is up. Run the client dev server or npm start after a build.')
    return
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}

export function start(port = PORT) {
  const server = http.createServer(serveStatic)
  const wss = new WebSocketServer({ server, path: '/ws' })
  attachWs(wss)
  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address()
      console.log(`Air Clash listening on http://localhost:${address.port}`)
      resolve({ server, wss, port: address.port })
    })
  })
}

const isMain = process.argv[1] && process.argv[1].endsWith('index.js')
if (isMain) start(PORT)
