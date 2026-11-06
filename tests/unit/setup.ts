import '@testing-library/jest-dom';

// React Testing Libraryのクリーンアップを自動化
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createI18nOptions, setFallbackT } from '@common/i18n';
import { I18N_RESOURCES, createI18n } from '@common/i18n/resources';

// 画面の部品は useTranslation で文言を引くので、テストでは日本語（正本）で初期化しておく
void i18next
  .use(initReactI18next)
  .init({ ...createI18nOptions('ja', I18N_RESOURCES), react: { useSuspense: false } });

// t を渡さない common の関数（解析）が使う、正本の言語の t
setFallbackT(createI18n('ja').t);

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
