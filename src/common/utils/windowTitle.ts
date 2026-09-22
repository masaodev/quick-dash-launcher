/**
 * ウィンドウ操作アイテムのタイトル指定に関する共通規則
 */

/** 全一致のワイルドカード（プロセス名だけで探すときのタイトル） */
export const ANY_WINDOW_TITLE = '*';

/**
 * 「タイトルが空でプロセス名だけ」の指定を全一致ワイルドカード "*" に正規化する
 *
 * 登録フォームは「タイトルまたはプロセス名」を許すが、保存形式では windowTitle が必須。
 * 空タイトルは完全一致で何にもマッチしないため、プロセス名だけで探す意図を "*" で表す。
 * データファイル・ワークスペースの書き込みと寛容な読み込み、旧形式の移行で同じ規則を使う。
 *
 * @returns 正規化が必要なら "*"、それ以外は undefined
 */
export function normalizeWindowTitleForProcessOnly(
  windowTitle: unknown,
  processName: unknown
): string | undefined {
  const titleEmpty = typeof windowTitle !== 'string' || windowTitle.trim() === '';
  const hasProcess = typeof processName === 'string' && processName.trim() !== '';
  return titleEmpty && hasProcess ? ANY_WINDOW_TITLE : undefined;
}
