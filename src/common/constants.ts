/**
 * アプリケーション全体で使用する定数
 */

/**
 * グループ起動時のアイテム間の待機時間（ミリ秒）
 * 各アイテムを順次起動する際、安定性のために適用される遅延
 */
export const GROUP_LAUNCH_DELAY_MS = 100;

/**
 * ブックマークファイルの最大サイズ（バイト）
 * これを超えるファイルは読み込まれない
 */
export const MAX_BOOKMARK_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * デスクトップタブのID定数
 */
export const DESKTOP_TAB = {
  /** すべてのウィンドウを表示 */
  ALL: 0,
  /** ピン止めされたウィンドウを表示 */
  PINNED: -2,
} as const;

/**
 * 切り離しウィンドウの window.name 接頭辞
 * ワークスペースのレンダラーが window.open で開く子ウィンドウに
 * `<接頭辞><groupId>` という名前を付け、メイン側の逆引きと
 * レンダラー側の groupId 取得の両方に使う
 */
export const DETACHED_WINDOW_NAME_PREFIX = 'detached-group:';

/**
 * ワークスペースアイテム編集ウィンドウの window.name 接頭辞
 * ワークスペースのレンダラーが window.open で開く子ウィンドウに
 * `<接頭辞><itemId>` という名前を付け、レンダラー側で編集対象を判定する
 */
export const WORKSPACE_EDITOR_WINDOW_NAME_PREFIX = 'workspace-editor:';

/**
 * ワークスペースの確認ウィンドウ（グループの削除・アーカイブ）の window.name 接頭辞
 * ワークスペースのレンダラーが window.open で開く子ウィンドウに `<接頭辞><requestId>` という名前を付け、
 * レンダラー側で requestId を取り出して表示内容（要求）をメインプロセスから受け取る
 */
export const WORKSPACE_CONFIRM_WINDOW_NAME_PREFIX = 'workspace-confirm:';

/**
 * メイン画面が開く子ウィンドウ（アイテムの登録・編集、アイコン取得結果）の window.name 接頭辞
 * メインのレンダラーが window.open で開く子ウィンドウに `<接頭辞><requestId>` という名前を付け、
 * レンダラー側で requestId を取り出して表示内容（要求）をメインプロセスから受け取る
 */
export const MAIN_CHILD_WINDOW_NAME_PREFIX = 'main-child:';

/**
 * アイコン取得の対象になるアイテムタイプ
 * folder / group / windowOperation / clipboard / layout は
 * タイプ別のデフォルトアイコンを使うため取得対象外
 */
export function isIconFetchTarget(type: string): boolean {
  return type === 'url' || type === 'app' || type === 'file' || type === 'customUri';
}
