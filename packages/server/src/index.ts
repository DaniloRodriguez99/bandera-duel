import { createServer } from './app.js';
const server = createServer();
const port = Number(process.env.PORT || 2567);
await server.listen(port, '0.0.0.0');
console.info(JSON.stringify({ event: 'listening', port }));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void server.gracefullyShutdown(false).then(() => process.exit(0));
  });
