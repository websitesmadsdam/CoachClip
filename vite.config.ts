import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

type VercelConfig = { headers: { source: string; headers: { key: string; value: string }[] }[] };

// `vite preview` serves the production build with the same security headers as Vercel, so the
// E2E tests exercise the app under the real Content-Security-Policy.
const vercelConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf8')) as VercelConfig;
const securityHeaders = Object.fromEntries(vercelConfig.headers[0].headers.map(({ key, value }) => [key, value]));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    preview: {
      headers: securityHeaders,
    },
    test: {
      exclude: ['e2e/**/*', 'node_modules/**/*', 'dist/**/*'],
    },
  };
});
