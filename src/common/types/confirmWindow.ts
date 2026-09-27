/**
 * 確認ウィンドウ（ワークスペースのグループの削除・アーカイブなど）の要求
 *
 * 以前はワークスペースウィンドウの中に確認ダイアログを描き、収まらないときはウィンドウを
 * 広げていた。今は開き元のウィンドウを動かさず、独立した子ウィンドウで確認する。
 */
export interface ConfirmWindowRequest {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 取り消せない操作（確認ボタンを赤くする） */
  danger?: boolean;
  /** 確認と一緒に選ばせるチェックボックス（例: グループ内のアイテムも削除する） */
  checkbox?: { label: string; checked: boolean };
}

/** 確認ウィンドウの結果（キャンセル・Escape・閉じたときは返らず null になる） */
export interface ConfirmWindowResult {
  confirmed: true;
  /** checkbox を出したときの最終的なチェック状態 */
  checkboxChecked: boolean;
}
