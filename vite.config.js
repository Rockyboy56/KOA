import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'assets',
  base: '/KOA/',
  server: { port: 3000 },
  build: { outDir: 'dist' }
});
