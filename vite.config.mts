import { resolve } from 'path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/main.ts',
        vite: {
          resolve: {
            alias: {
              '@common': resolve(process.cwd(), './src/common'),
              '@main': resolve(process.cwd(), './src/main'),
              '@renderer': resolve(process.cwd(), './src/renderer'),
              '@test': resolve(process.cwd(), './src/test'),
            },
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
            alias: {
              '@common': resolve(process.cwd(), './src/common'),
              '@main': resolve(process.cwd(), './src/main'),
              '@renderer': resolve(process.cwd(), './src/renderer'),
              '@test': resolve(process.cwd(), './src/test'),
            },
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
  },
  resolve: {
    alias: {
      '@common': resolve(process.cwd(), './src/common'),
      '@main': resolve(process.cwd(), './src/main'),
      '@renderer': resolve(process.cwd(), './src/renderer'),
      '@test': resolve(process.cwd(), './src/test'),
    },
  },
});
