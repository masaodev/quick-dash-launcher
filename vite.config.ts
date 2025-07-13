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
            },
          },
          build: {
            outDir: 'dist/main',
            lib: {
              entry: 'src/main/main.ts',
              formats: ['cjs'],
              fileName: () => 'main.js',
            },
            rollupOptions: {
              external: ['electron', 'electron-store'],
              output: {
                format: 'cjs',
                inlineDynamicImports: true,
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
            },
          },
          build: {
            outDir: 'dist/main',
            lib: {
              entry: 'src/main/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js',
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                inlineDynamicImports: true,
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
  },
  server: {
    port: 9000,
  },
  resolve: {
    alias: {
      '@common': resolve(process.cwd(), './src/common'),
    },
  },
});
