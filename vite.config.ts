import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            lib: {
              entry: 'src/main/main.ts',
              formats: ['es']
            },
            rollupOptions: {
              external: ['electron', 'electron-store'],
              output: {
                format: 'es'
              }
            }
          }
        }
      },
      {
        entry: 'src/main/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist/main',
            lib: {
              entry: 'src/main/preload.ts',
              formats: ['cjs']
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs'
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false
  },
  server: {
    port: 9000
  },
  resolve: {
    alias: {
      '@common': resolve(__dirname, './src/common')
    }
  }
});