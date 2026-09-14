import { defineConfig } from 'vite';
export default defineConfig({
  envDir: '../..',
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
});
