/**
 * アイコンキャッシュのキー決定ロジック
 *
 * 取得側（iconHandlers の fetchIconForItem）と読み出し側（getCachedIconCandidates）は
 * 同じ判定を使う必要がある。片方だけを変更すると、アイコンを取得できているのに
 * 別のキーを探しにいって表示されない、という食い違いが起きるため、
 * 判定と候補パスの組み立てをこのファイルへ集約している。
 */
import * as path from 'path';

import { iconLogger } from '@common/logger';
import { PathUtils } from '@common/utils/pathUtils';

/** アイコンキャッシュの保存先フォルダ群 */
export interface IconFolders {
  favicons: string;
  icons: string;
  extensions: string;
}

/** アイコンのキー決定に必要なアイテム情報 */
export interface IconTargetItem {
  type: string;
  path: string;
  originalPath?: string;
}

/**
 * アイコンの取得方法の分類
 *
 * - `favicon`: URLのファビコン
 * - `uwp`: 登録アプリ（shell:AppsFolder）
 * - `shortcut`: ショートカット（.lnk）
 * - `script`: スクリプト系（.bat / .cmd / .com）。拡張子ベースで共有する
 * - `executable`: その他の実行ファイル。ファイル名ベース
 * - `customUri`: カスタムURIスキーマ
 * - `fileExtension`: 通常のファイル。拡張子ベース
 * - `none`: 取得対象外（folder / group / windowOperation / clipboard / layout）
 */
export type IconTargetKind =
  'favicon' | 'uwp' | 'shortcut' | 'script' | 'executable' | 'customUri' | 'fileExtension' | 'none';

/** UWPアプリのAppIDかどうか */
const UWP_PATH_PREFIX = 'shell:AppsFolder\\';

/** スクリプト系拡張子（.bat, .cmd, .com）かどうか判定する */
export function isScriptExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.bat') || lower.endsWith('.cmd') || lower.endsWith('.com');
}

/** UWPアプリのAppIDからパッケージファミリー名を抽出する */
export function extractPackageFamilyName(appPath: string): string | null {
  return appPath.match(/shell:AppsFolder\\(.+)!/)?.[1] ?? null;
}

/**
 * アイテムのアイコン取得方法を判定する
 *
 * 取得側・読み出し側の双方がこの判定を共有する
 */
export function classifyIconTarget(item: IconTargetItem): IconTargetKind {
  if (item.type === 'url') return 'favicon';

  if (item.type === 'app') {
    if (item.path.startsWith(UWP_PATH_PREFIX)) return 'uwp';
    if (PathUtils.isShortcutFile(item.originalPath) || PathUtils.isShortcutFile(item.path)) {
      return 'shortcut';
    }
    if (isScriptExtension(item.path)) return 'script';
    return 'executable';
  }

  if (item.type === 'customUri') return 'customUri';
  if (item.type === 'file') return 'fileExtension';
  return 'none';
}

/**
 * ショートカットとして扱うパスを返す
 *
 * リンク先（originalPath）が .lnk ならそちらを優先する。
 * 取得側と読み出し側で同じパスからキャッシュ名を作るために使う
 */
export function resolveShortcutPath(item: IconTargetItem): string {
  return PathUtils.isShortcutFile(item.originalPath) ? item.originalPath! : item.path;
}

/** 拡張子アイコンのキャッシュパスを組み立てる */
export function getExtensionIconPath(extensionsFolder: string, ext: string): string {
  return path.join(extensionsFolder, `ext_${ext.replace('.', '')}_icon.png`);
}

/**
 * URIからファイル拡張子を抽出する
 *
 * 例: `ms-excel:ofe|ofc|u|https://.../Book%204.xlsx?web=1` → `.xlsx`
 */
export function extractExtensionFromUri(uri: string): string {
  try {
    // パイプ区切りの最後の部分（URL部分）を取得
    const parts = uri.split('|');
    const lastPart = parts[parts.length - 1];

    const decodedUrl = decodeURIComponent(lastPart);

    // パス部分からファイル名を抽出し、クエリとフラグメントを除去
    let fileName = decodedUrl.split('/').pop() || '';
    fileName = fileName.split('?')[0].split('#')[0];

    const extensionMatch = fileName.match(/\.[^.]+$/);
    return extensionMatch ? extensionMatch[0].toLowerCase() : '';
  } catch (error) {
    iconLogger.error({ uri, error }, 'URIから拡張子の抽出に失敗');
    return '';
  }
}

/**
 * キャッシュ済みアイコンの候補パスを優先順に返す
 *
 * 候補が空の場合はデフォルトアイコンを使う
 */
export function getCachedIconCandidates(item: IconTargetItem, folders: IconFolders): string[] {
  switch (classifyIconTarget(item)) {
    case 'favicon': {
      if (!item.path?.includes('://')) return [];
      const domain = new URL(item.path).hostname;
      return [
        path.join(folders.favicons, `${domain}_favicon_64.png`),
        path.join(folders.favicons, `${domain}_favicon_32.png`),
      ];
    }

    case 'uwp': {
      const packageFamilyName = extractPackageFamilyName(item.path);
      if (!packageFamilyName) return [];
      const safeName = packageFamilyName.replace(/[^a-zA-Z0-9._-]/g, '_');
      return [path.join(folders.icons, `uwp_${safeName}_icon.png`)];
    }

    case 'shortcut': {
      const shortcutName = path.basename(resolveShortcutPath(item), '.lnk');
      return [
        path.join(folders.icons, `${shortcutName}_lnk_icon.png`),
        path.join(folders.icons, `${shortcutName}_icon.png`),
      ];
    }

    case 'script': {
      const extensionName = path.extname(item.path).slice(1).toLowerCase();
      return [getExtensionIconPath(folders.extensions, extensionName)];
    }

    case 'executable': {
      if (!item.path) return [];
      const iconName = path.basename(item.path, path.extname(item.path)) + '_icon.png';
      return [path.join(folders.icons, iconName)];
    }

    case 'customUri': {
      if (!item.path) return [];
      const candidates: string[] = [];
      // スキーマベースのアイコンを優先
      const schemeMatch = item.path.match(/^([^:]+):/);
      if (schemeMatch) {
        candidates.push(path.join(folders.icons, `uri_${schemeMatch[1]}_icon.png`));
      }
      // 拡張子ベースにフォールバック
      const fileExtension = extractExtensionFromUri(item.path);
      if (fileExtension) {
        candidates.push(getExtensionIconPath(folders.extensions, fileExtension));
      }
      return candidates;
    }

    case 'fileExtension': {
      if (!item.path) return [];
      const fileExtension = path.extname(item.path).toLowerCase();
      return fileExtension ? [getExtensionIconPath(folders.extensions, fileExtension)] : [];
    }

    case 'none':
      return [];
  }
}
