import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.banderaduel.app',
  appName: 'Bandera Duel',
  webDir: 'dist',
  server: { hostname: 'localhost', androidScheme: 'https' },
  android: { backgroundColor: '#101b21', allowMixedContent: process.env.VITE_ANDROID_DEBUG === 'true' },
};
export default config;
