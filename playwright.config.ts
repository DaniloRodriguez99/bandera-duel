import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1366, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run build:server && npm run start',
      url: 'http://127.0.0.1:2568/health',
      // Short, so a spec can watch the world disconnect someone standing still.
      env: { PORT: '2568', WORLD_IDLE_SECONDS: '12', ALLOWED_ORIGINS: 'http://127.0.0.1:5174,http://localhost:5174' },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npm run dev -w @bandera/client -- --port 5174',
      url: 'http://127.0.0.1:5174',
      env: { VITE_SERVER_URL: 'ws://127.0.0.1:2568' },
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
