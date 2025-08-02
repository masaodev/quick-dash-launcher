import { resolve } from 'path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  test: {
    // テスト環境設定
    environment: 'jsdom',

    // テストファイルのパターン
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],

    // テストから除外するファイル
    exclude: ['node_modules', 'dist', 'release', 'tests/e2e/**/*'],

    // セットアップファイル
    setupFiles: ['./tests/unit/setup.ts'],

    // グローバル変数の設定
    globals: true,

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'release/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.config.js',
        'src/main/**/*', // Electronメインプロセスは除外
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },

    // テストタイムアウト
    testTimeout: 10000,

    // レポーター設定
    reporters: ['verbose', 'html'],

    // 並列実行設定
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
      },
    },
  },

  resolve: {
    alias: {
      '@common': resolve(process.cwd(), './src/common'),
      '@': resolve(process.cwd(), './src'),
    },
  },

  // Electronのメインプロセス関連は除外
  define: {
    'process.env.NODE_ENV': '"test"',
  },
});
