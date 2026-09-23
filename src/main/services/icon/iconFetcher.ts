import * as path from 'path';

import type { BrowserWindow } from 'electron';
import { iconLogger } from '@common/logger';
import type { LauncherItem } from '@common/types';
import { isIconFetchTarget } from '@common/constants';

import { CombinedProgressManager } from '../../utils/progressManager.js';
import { FaviconService } from '../faviconService.js';
import { IconFetchErrorService } from '../iconFetchErrorService.js';
import PathManager from '../../config/pathManager.js';
import { runWithConcurrency } from '../../utils/concurrency.js';
import {
  classifyIconTarget,
  getCachedIconCandidates,
  resolveShortcutPath,
  type IconFolders,
  type IconTargetItem,
} from '../../utils/iconCacheKeys.js';

import { readFirstExistingFileAsBase64 } from './iconFileCache.js';
import {
  extractCustomUriIcon,
  extractFileIconByExtension,
  extractIcon,
} from './fileIconExtractor.js';
import { extractUwpIcon } from './uwpIconExtractor.js';

// 同時実行数の上限（ファビコンはネットワークI/O、アイコン抽出は子プロセス起動を伴う）
const FAVICON_CONCURRENCY = 5;
const ICON_EXTRACT_CONCURRENCY = 4;
const CACHED_ICON_READ_CONCURRENCY = 16;

// FaviconServiceのインスタンスを保持
let faviconService: FaviconService;

/** アイコン取得・読み出しの対象アイテム（キー決定に必要な情報＋表示用の付随情報） */
export interface IconItem extends IconTargetItem {
  name?: string;
  customIcon?: string;
}

/** 指定されたURLのファビコンを取得する（FaviconServiceへの委譲） */
export async function fetchFavicon(
  url: string,
  faviconsFolder: string,
  forceRefresh = false
): Promise<string | null> {
  if (!faviconService) {
    faviconService = new FaviconService(faviconsFolder);
  }
  return faviconService.fetchFavicon(url, forceRefresh);
}

/** PathManagerからアイコンキャッシュのフォルダ群を取得する */
function getIconFolders(): IconFolders {
  return {
    favicons: PathManager.getFaviconsFolder(),
    icons: PathManager.getAppsFolder(),
    extensions: PathManager.getExtensionsFolder(),
  };
}

/** 複数のアイテムのキャッシュされたアイコンを一括で読み込む */
export async function loadCachedIcons(
  items: IconItem[],
  folders: IconFolders
): Promise<Record<string, string>> {
  const iconCache: Record<string, string> = {};

  const tasks = items.map((item) => async () => {
    try {
      // カスタムアイコンを最優先、なければ自動取得アイコンの候補を順に試す
      const candidates: string[] = [];
      if (item.customIcon) {
        candidates.push(path.join(PathManager.getCustomIconsFolder(), item.customIcon));
      }
      candidates.push(...getCachedIconCandidates(item, folders));

      const icon = await readFirstExistingFileAsBase64(candidates);
      if (icon) {
        iconCache[item.path] = icon;
      }
    } catch (error) {
      iconLogger.error({ itemPath: item.path, error }, 'キャッシュされたアイコンの読み込みに失敗');
    }
  });

  await runWithConcurrency(tasks, CACHED_ICON_READ_CONCURRENCY);
  return iconCache;
}

/** 進捗表示用テキストを生成 */
function getDisplayText(item: IconItem): string {
  return item.name ? `${item.name}\n${item.path}` : item.path;
}

/** エラー記録のないアイテムのみをフィルタリング */
async function filterItemsWithoutErrors(
  items: IconItem[],
  errorService: IconFetchErrorService,
  errorType: 'favicon' | 'icon'
): Promise<IconItem[]> {
  const errorKeys = new Set(
    (await errorService.getAllErrors())
      .filter((error) => error.type === errorType)
      .map((error) => error.key)
  );

  return items.filter((item) => {
    if (errorKeys.has(item.path)) {
      iconLogger.info({ path: item.path }, `Skipping ${errorType} fetch due to previous error`);
      return false;
    }
    return true;
  });
}

/**
 * アイテムタイプに応じてアイコンを取得し、キャッシュへ保存する（取得系の唯一の入口）
 *
 * どの取得方法を使うかは classifyIconTarget が決める。読み出し側の
 * getCachedIconCandidates も同じ判定を使っており、ここで独自に分岐すると
 * 保存先と読み出し先が食い違って「取得できているのに表示されない」状態になる。
 *
 * @param forceRefresh キャッシュを無視して取り直す（ファビコンのみ対象）
 */
async function fetchIconForItem(
  item: IconItem,
  folders: IconFolders,
  forceRefresh = false
): Promise<string | null> {
  switch (classifyIconTarget(item)) {
    case 'favicon':
      return fetchFavicon(item.path, folders.favicons, forceRefresh);

    case 'uwp':
      return extractUwpIcon(item.path, folders.icons);

    case 'shortcut':
      return extractIcon(resolveShortcutPath(item), folders.icons);

    case 'script':
      return extractFileIconByExtension(item.path, folders.extensions);

    case 'executable':
      return extractIcon(item.path, folders.icons);

    case 'customUri': {
      const icon = await extractCustomUriIcon(item.path, folders.icons);
      return icon || extractFileIconByExtension(item.path, folders.extensions);
    }

    case 'fileExtension':
      return extractFileIconByExtension(item.path, folders.extensions);

    case 'none':
      // folder / group / windowOperation / clipboard / layout はデフォルトアイコンを使用
      return null;
  }
}

/**
 * ファビコン取得とアイコン抽出を統合して実行する
 *
 * @param progressWindow 進捗の通知先。nullを渡すと進捗を送らない（バックグラウンド補完用）
 */
export async function fetchIconsCombined(
  urlItems: IconItem[],
  items: IconItem[],
  folders: IconFolders,
  forceRefresh: boolean = false,
  progressWindow: BrowserWindow | null = null
): Promise<{ favicons: Record<string, string | null>; icons: Record<string, string | null> }> {
  const errorService = await IconFetchErrorService.getInstance();

  if (forceRefresh) {
    await errorService.clearAllErrors();
  }

  // エラー記録のないアイテムをフィルタリング
  const filteredUrlItems = forceRefresh
    ? urlItems
    : await filterItemsWithoutErrors(urlItems, errorService, 'favicon');
  const filteredItems = forceRefresh
    ? items
    : await filterItemsWithoutErrors(items, errorService, 'icon');

  // フェーズ設定
  const phaseTypes: ('favicon' | 'icon')[] = [];
  const phaseTotals: number[] = [];

  if (filteredUrlItems.length > 0) {
    phaseTypes.push('favicon');
    phaseTotals.push(filteredUrlItems.length);
  }
  if (filteredItems.length > 0) {
    phaseTypes.push('icon');
    phaseTotals.push(filteredItems.length);
  }

  const progress = new CombinedProgressManager(phaseTypes, phaseTotals, progressWindow);
  progress.start();

  // 各フェーズ共通の処理（フェーズ内は同時実行数を制限して並列化）
  async function processPhase(
    items: IconItem[],
    errorType: 'favicon' | 'icon',
    fetchFn: (item: IconItem) => Promise<string | null>,
    notFoundMsg: string,
    fallbackMsg: string,
    concurrency: number
  ): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    const failedEntries: { key: string; type: 'favicon' | 'icon'; errorMessage: string }[] = [];

    const tasks = items.map((item) => async () => {
      const displayText = getDisplayText(item);
      try {
        const result = await fetchFn(item);
        results[item.path] = result;

        if (result) {
          progress.update(displayText);
        } else {
          failedEntries.push({ key: item.path, type: errorType, errorMessage: notFoundMsg });
          progress.update(displayText, true, notFoundMsg);
        }
      } catch (error) {
        iconLogger.error({ path: item.path, error }, `${errorType} fetch error`);
        results[item.path] = null;
        const errorMsg = error instanceof Error ? error.message : fallbackMsg;
        failedEntries.push({ key: item.path, type: errorType, errorMessage: errorMsg });
        progress.update(displayText, true, errorMsg);
      }
    });

    await runWithConcurrency(tasks, concurrency);

    // エラーは1回のストア書き込みでまとめて記録
    await errorService.recordErrors(failedEntries);

    if (items.length > 0) progress.completePhase();
    return results;
  }

  const faviconResults = await processPhase(
    filteredUrlItems,
    'favicon',
    (item) => fetchIconForItem(item, folders, forceRefresh),
    'ファビコンが見つかりませんでした',
    'ファビコン取得に失敗しました',
    FAVICON_CONCURRENCY
  );

  const iconResults = await processPhase(
    filteredItems,
    'icon',
    (item) => fetchIconForItem(item, folders, forceRefresh),
    'アイコンが見つかりませんでした',
    'アイコン抽出に失敗しました',
    ICON_EXTRACT_CONCURRENCY
  );

  progress.completeAll();
  return { favicons: faviconResults, icons: iconResults };
}

/**
 * 渡されたアイテムのアイコンを取得する（進捗通知なし）
 *
 * メインウィンドウの一括取得の対象外にあるアイテム（ワークスペース専用のアイテム等）を
 * 補完するために用意している。取得できなかったアイテムはIconFetchErrorServiceに
 * 記録されるため、繰り返し呼び出しても同じアイテムを毎回取得し直すことはない。
 *
 * @returns 取得できたアイコンのみを含む path → dataURL のマップ
 */
export async function ensureIcons(
  items: IconItem[],
  folders: IconFolders
): Promise<Record<string, string>> {
  const targets = items.filter((item) => isIconFetchTarget(item.type));
  if (targets.length === 0) return {};

  const { favicons, icons } = await fetchIconsCombined(
    targets.filter((item) => item.type === 'url'),
    targets.filter((item) => item.type !== 'url'),
    folders,
    false,
    null
  );

  const resolved: Record<string, string> = {};
  for (const [itemPath, icon] of [...Object.entries(favicons), ...Object.entries(icons)]) {
    if (icon) resolved[itemPath] = icon;
  }

  iconLogger.info(
    { requested: targets.length, resolved: Object.keys(resolved).length },
    'Ensured missing icons'
  );
  return resolved;
}

/**
 * アイテムタイプに応じて適切なアイコンを取得（統合API）
 *
 * urlのファビコン、UWPアプリ、スクリプト系の扱いを含めて fetchIconForItem に委譲するため、
 * 呼び出し側でタイプごとに取得関数を選び分ける必要はない。
 */
export async function getIconForItem(
  filePath: string,
  itemType: LauncherItem['type'],
  originalPath?: string
): Promise<string | null> {
  return fetchIconForItem({ type: itemType, path: filePath, originalPath }, getIconFolders());
}
