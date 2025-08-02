import '@testing-library/jest-dom';

// React Testing Libraryのクリーンアップを自動化
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

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
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
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
