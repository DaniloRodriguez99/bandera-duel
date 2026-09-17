import { createServer } from './app.js';
import { createShutdown } from './store/shutdown.js';
import { WorldRoom, characterStore } from './world-room.js';
const server = createServer();
const port = Number(process.env.PORT || 2567);
await server.listen(port, '0.0.0.0');
console.info(JSON.stringify({ event: 'listening', port }));
// Cloud Run kills the container about 10 s after SIGTERM: 8 s for the orderly path, and a hard
// exit shortly after in case something ignores its own timeout.
const DEADLINE_MS = 8000;
const shutdown = createShutdown({
  server,
  flush: () => WorldRoom.flushAll(),
  store: characterStore,
  deadline: DEADLINE_MS,
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  // `on`, not `once`: a second signal must not fall through to Node's default and kill the process
  // mid-write. It joins the shutdown already running instead.
  process.on(signal, () => {
    setTimeout(() => process.exit(1), DEADLINE_MS + 1500).unref();
    void shutdown().then((ok) => process.exit(ok ? 0 : 1));
  });
