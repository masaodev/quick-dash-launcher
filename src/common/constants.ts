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
  /** 全デスクトップに表示中のウィンドウを表示 */
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
 * グループに追加するアイテムを選ぶウィンドウ（グループの右クリック「メインウィンドウのアイテムから選ぶ」）の window.name 接頭辞
 * ワークスペースのレンダラーが window.open で開く子ウィンドウに `<接頭辞><groupId>` という名前を付け、
 * レンダラー側で追加先のグループを判定する
 */
export const WORKSPACE_PICKER_WINDOW_NAME_PREFIX = 'workspace-picker:';

/**
 * ワークスペースの参照が指すメインウィンドウのアイテムを選ぶウィンドウ（参照の「別のアイテムを指す」）の
 * window.name 接頭辞。`<接頭辞><itemId>`
 */
export const WORKSPACE_LINK_PICKER_WINDOW_NAME_PREFIX = 'workspace-link-picker:';

/**
 * 「メインウィンドウのアイテムとつなぐ」ウィンドウ（ワークスペースのタブの右クリック）の window.name 接頭辞。
 * `<接頭辞><workspaceId>`
 */
export const WORKSPACE_LINK_COPIES_WINDOW_NAME_PREFIX = 'workspace-link-copies:';

/**
 * グループに新しいアイテムを入力して追加するウィンドウ（グループの右クリック「新しく入力して追加」）の window.name 接頭辞
 * 編集ウィンドウと同じ中身を新規の形で描く。`<接頭辞><groupId>` から追加先のグループを判定する
 */
export const WORKSPACE_NEW_ITEM_WINDOW_NAME_PREFIX = 'workspace-new-item:';

/**
 * メイン画面が開く子ウィンドウ（アイテムの登録・編集、アイコン取得結果）の window.name 接頭辞
 * メインのレンダラーが window.open で開く子ウィンドウに `<接頭辞><requestId>` という名前を付け、
 * レンダラー側で requestId を取り出して表示内容（要求）をメインプロセスから受け取る
 */
export const MAIN_CHILD_WINDOW_NAME_PREFIX = 'main-child:';

/**
 * ワークスペースのアイテムをドラッグするときに、アイテムの JSON を載せる dataTransfer の型
 * メインウィンドウに落とすと、このアイテムを初期値にして登録画面を開く
 */
export const WORKSPACE_ITEM_DRAG_TYPE = 'workspaceItem';

/**
 * アイコン取得の対象になるアイテムタイプ
 * folder / group / windowOperation / clipboard / layout は
 * タイプ別のデフォルトアイコンを使うため取得対象外
 */
export function isIconFetchTarget(type: string): boolean {
  return type === 'url' || type === 'app' || type === 'file' || type === 'customUri';
}

/**
 * トーストの種類ごとの表示時間（ミリ秒）。独立トースト・UI 内トーストで共通
 *
 * 呼び出し側で数値を指定せず、文が長いものだけ `long` を付ける（docs/features/toast-notifications.md）
 */
export const TOAST_DURATION_MS = {
  success: 2500,
  info: 3000,
  warning: 4000,
  error: 6000,
} as const;

/** 長めのトースト（2 行以上・件数や名前の並び）で、種類の表示時間に足す時間（ミリ秒） */
export const TOAST_LONG_EXTRA_MS = 3000;

/** トーストの表示時間（ミリ秒）を種類と長さから決める */
export function toastDurationMs(
  type: keyof typeof TOAST_DURATION_MS,
  long: boolean = false
): number {
  return TOAST_DURATION_MS[type] + (long ? TOAST_LONG_EXTRA_MS : 0);
}
