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
              external: ['electron', 'electron-store', 'koffi', 'extract-file-icon'],
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        splash: resolve(__dirname, 'splash.html'),
        workspace: resolve(__dirname, 'workspace.html'),
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
