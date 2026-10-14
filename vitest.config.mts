import { resolve } from 'path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const MAIN_TESTS = ['src/main/**/*.{test,spec}.ts', 'tests/unit/main/**/*.{test,spec}.ts'];
const EXCLUDED = ['node_modules', 'dist', 'release', 'tests/e2e/**/*'];

export default defineConfig({
  plugins: [react()],

  test: {
    // main（Electron のメインプロセス）は node、それ以外（renderer・common）は jsdom で動かす
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          include: MAIN_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: [
            'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
          ],
          exclude: [...EXCLUDED, ...MAIN_TESTS],
          setupFiles: ['./tests/unit/setup.ts'],
        },
      },
    ],

    // テストから除外するファイル
    exclude: EXCLUDED,

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
      // 下回ったら test:coverage を失敗させる（2026-10 の実測値から小数点以下を切り捨てた値）
      thresholds: {
        branches: 64,
        functions: 75,
        lines: 73,
        statements: 73,
      },
    },

    // テストタイムアウト
    testTimeout: 10000,

    // レポーター設定
    reporters: ['verbose', 'html'],

    // 並列実行設定（デフォルトのスレッド数を使用）
    pool: 'threads',
  },

  resolve: {
    alias: {
      '@common': resolve(process.cwd(), './src/common'),
    },
  },

  // Electronのメインプロセス関連は除外
  define: {
    'process.env.NODE_ENV': '"test"',
  },
});
