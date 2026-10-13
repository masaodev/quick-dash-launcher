import { resolve } from 'path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

import { cspPlugin } from './scripts/viteCspPlugin';

/** パスエイリアス（tsconfig.json の paths と合わせる） */
const ALIAS = { '@common': resolve(process.cwd(), './src/common') };

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/main.ts',
        vite: {
          resolve: {
            alias: ALIAS,
          },
          build: {
            outDir: 'dist/main',
            sourcemap: true,
            minify: false,
            lib: {
              entry: 'src/main/main.ts',
              formats: ['cjs'],
              fileName: () => 'main.js',
            },
            rollupOptions: {
              external: [
                'electron',
                'electron-store',
                'koffi',
                '@microsoft/dynwinrt',
                'extract-file-icon',
                'clipboard-files',
              ],
              output: {
                format: 'cjs',
                codeSplitting: false,
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
      {
        entry: 'src/main/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          resolve: {
            alias: ALIAS,
          },
          build: {
            outDir: 'dist/main',
            sourcemap: true,
            minify: false,
            lib: {
              entry: 'src/main/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js',
            },
            rollupOptions: {
              external: ['electron', 'koffi'],
              output: {
                format: 'cjs',
                codeSplitting: false,
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
    ]),
    renderer(),
    cspPlugin(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        splash: resolve(import.meta.dirname, 'splash.html'),
        workspace: resolve(import.meta.dirname, 'workspace.html'),
        overlay: resolve(import.meta.dirname, 'overlay.html'),
      },
    },
  },
  server: {
    port: Number(process.env.VITE_PORT) || 9000,
    // dev:test（tests/dev/full）と E2E（tests/e2e/configs/.temp）が実行中に書き込むので、監視から外す。
    // レンダラーは tests/ を import しない
    watch: { ignored: ['**/tests/**'] },
  },
  resolve: {
    alias: ALIAS,
  },
});
