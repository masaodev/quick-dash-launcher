import { detectItemTypeSync } from './itemTypeDetector';

/**
 * 「管理者として実行」できるアイテムかの判定（ランチャー・ワークスペース・本体で共通）
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

/**
 * 登録・編集画面で「常に管理者として実行」を付けられるパスか（パスの形だけで決める）
 *
 * 画面の種別はパス欄を離れるまで古いことがあるので、パスから判定し直す
 */
export function canSetRunAsAdmin(path: string): boolean {
  return canRunAsAdmin({ type: detectItemTypeSync(path), path });
}

/** 保存するときの runAsAdmin（true のときだけ書く。省略は false） */
export function pickRunAsAdmin(item: { runAsAdmin?: boolean }): { runAsAdmin?: true } {
  return item.runAsAdmin === true ? { runAsAdmin: true } : {};
}

/**
 * 開くときに管理者として実行するか（アイテムの設定「常に管理者として実行」）
 *
 * 設定が残っていても、対象外の種類（パスを URL に変えたなど）なら普通に開く
 */
export function shouldRunAsAdmin(item: {
  type: string;
  path?: string;
  runAsAdmin?: boolean;
}): boolean {
  return item.runAsAdmin === true && canRunAsAdmin(item);
}
