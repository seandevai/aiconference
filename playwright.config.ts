import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Gli e2e concedono crediti con il service role: leggono lo stesso .env.local dell'app.
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    // Camera e microfono finti di Chromium: la call parte senza dispositivi reali.
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
