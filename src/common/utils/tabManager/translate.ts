import i18next from 'i18next';

/** タブ構成の計算が返す文言（失敗の理由・既定の名前）を訳す関数 */
export type TabManagerTranslate = (key: string, options?: Record<string, unknown>) => string;

// 既定は画面（renderer）の i18next。main プロセスは別のインスタンス（mainI18n）で訳すので、
// main から使うときは setTabManagerTranslator で差し替える（CLI のタブ構成のコマンド）
let translate: TabManagerTranslate = (key, options) =>
  (i18next.t as unknown as TabManagerTranslate)(key, options);

export function setTabManagerTranslator(t: TabManagerTranslate): void {
  translate = t;
}

export function tabT(key: string, options?: Record<string, unknown>): string {
  return translate(key, options);
}
