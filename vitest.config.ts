import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Carica .env.local: i test in tests/db leggono URL e chiavi di Supabase locale.
    env: loadEnv('test', process.cwd(), ''),
    // I test sul DB condividono utenti e tabelle: niente parallelismo fra file.
    fileParallelism: false,
  },
});
