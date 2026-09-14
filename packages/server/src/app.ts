import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import cors from 'cors';
import { DuelRoom, publicRooms } from './room.js';

export function createServer() {
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const accept = (origin: string | undefined) =>
    !origin ||
    allowed.includes(origin) ||
    (process.env.NODE_ENV !== 'production' &&
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):5173$/.test(origin));
  const server = new Server({
    transport: new WebSocketTransport({
      pingInterval: 2000,
      pingMaxRetries: 2,
      maxPayload: 4096,
      verifyClient: (info: { origin: string }) => accept(info.origin),
    }),
    greet: false,
    gracefullyShutdown: false,
    express: (app) => {
      app.use((req, res, next) => {
        if (!accept(req.headers.origin)) {
          res.status(403).json({ error: 'Origen no permitido' });
          return;
        }
        next();
      });
      app.use(cors({ origin: (origin, cb) => cb(null, accept(origin)) }));
      app.get('/rooms', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(publicRooms()); });
      app.get('/health', (_req, res) =>
        res.json({ ok: true, game: 'bandera-duel', version: '0.1.0' }),
      );
    },
  });
  server.define('duel', DuelRoom);
  return server;
}
