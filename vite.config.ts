import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path, { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    root: 'src', // Sets the project root to the src directory
    publicDir: '../public', // Adjusts public folder path relative to the new root
    build: {
      outDir: '../dist', // Directs the build output back out to the original root folder
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      // Use jsdom so React components can render in Node
      environment: 'jsdom',
      include: ['./**/*.test.{ts,tsx}'],
      globals: true,
      setupFiles: [],
    },
  };
});
