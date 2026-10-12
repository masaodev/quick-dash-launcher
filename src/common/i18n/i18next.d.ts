import 'i18next';

import type { ja } from './locales/ja';

/** t() のキーを辞書（ja.ts）から型チェックする */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ja };
    returnNull: false;
  }
}
