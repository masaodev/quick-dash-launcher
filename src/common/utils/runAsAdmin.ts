/**
 * 「管理者として実行」できるアイテムかの判定（メインウィンドウ・ワークスペース・本体で共通）
 *
 * 対象はアプリ（exe・.lnk・.bat/.cmd など、起動種別が app になるもの）だけ。
 * URL・フォルダ・ファイル・パスの無い単一アイテム・クリップボード・セットは対象外。
 * ストアアプリ（shell:AppsFolder\...）は Windows が管理者での起動を受け付けないので除く
 */
export function canRunAsAdmin(item: { type: string; path?: string }): boolean {
  if (item.type !== 'app') return false;
  const path = item.path?.trim() ?? '';
  return path !== '' && !/^shell:/i.test(path);
}
