/**
 * まとめて追加する入口（➕ のメニューと空のタブで共通。A3-172・A3-180）
 *
 * ブックマーク取込・アプリ取込は管理ウィンドウのアイテム管理で取込の画面を開く
 */
export function openBookmarkImport(): void {
  window.electronAPI.openEditWindowWithImportModal('bookmark');
}

export function openAppImport(): void {
  window.electronAPI.openEditWindowWithImportModal('app');
}
