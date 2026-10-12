import '@testing-library/jest-dom';

// React Testing Libraryのクリーンアップを自動化
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createI18nOptions } from '@common/i18n';

// 画面の部品は useTranslation で文言を引くので、テストでは日本語（正本）で初期化しておく
void i18next
  .use(initReactI18next)
  .init({ ...createI18nOptions('ja'), react: { useSuspense: false } });

afterEach(() => {
  cleanup();
});

// モックオブジェクトの設定
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Electron関連のモック
global.window = Object.assign(global.window || {}, {
  // Electronのpreloadスクリプトでexposeされる可能性のあるAPIをモック
  electronAPI: {
    // 必要に応じてここにElectronAPIのモックを追加
  },
});

// console.errorを一時的に無効化（React 18の厳格モードでの警告を抑制）
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
