import i18next from 'i18next';
import type {
  AppItem,
  WindowInfo,
  SetItem,
  WindowItem,
  LauncherItem,
  ClipboardItem,
  DirOptionsForProcessing,
} from '@common/types';
import { isWindowInfo, isWindowItem, isClipboardItem, isSetItem } from '@common/types/guards';
import { PathUtils } from '@common/utils/pathUtils';
import { describeWindowMatch, isPathlessItem } from '@common/utils/itemWindowConversion';

import { setEntriesSummary } from './setEditing';

// 一覧を描く部品（LauncherItemList）が useTranslation で言語の切り替えに合わせて描き直すので、
// ここでは描くときの言語で i18next.t から引く
const t = i18next.t.bind(i18next);

interface MetaInfo {
  sourceFile?: string;
  id?: string;
  expandedFromId?: string;
  lineNumber?: number;
  expandedFrom?: string;
  expandedOptions?: DirOptionsForProcessing;
}

/** フォルダ取込の設定を 1 行で表す（例「深さ:2, タイプ:ファイルのみ, フィルター:*.pdf」） */
export function formatDirOptions(options: DirOptionsForProcessing): string {
  const parts: string[] = [
    t('dirOptions.summary.depth', {
      value: options.depth === -1 ? t('dirOptions.depths.unlimited') : options.depth,
    }),
    t('dirOptions.summary.types', { value: t(`dirOptions.typeOptions.${options.types}`) }),
  ];
  if (options.filter) parts.push(t('dirOptions.summary.filter', { value: options.filter }));
  if (options.exclude) parts.push(t('dirOptions.summary.exclude', { value: options.exclude }));
  if (options.prefix) parts.push(t('dirOptions.summary.prefix', { value: options.prefix }));
  if (options.suffix) parts.push(t('dirOptions.summary.suffix', { value: options.suffix }));
  return parts.join(t('dirOptions.summary.separator'));
}

/**
 * メタ情報（データファイル、ID、展開元IDなど）を文字列配列に追加
 */
function appendMetaInfo(lines: string[], meta: MetaInfo): void {
  const { sourceFile, id, expandedFromId, lineNumber, expandedFrom, expandedOptions } = meta;

  if (Object.values(meta).some(Boolean)) {
    lines.push('');
  }

  if (sourceFile) {
    lines.push(t('launcher.tooltip.dataFile', { value: sourceFile }));
  }

  if (id) {
    lines.push(t('launcher.tooltip.id', { value: id }));
  }

  if (expandedFromId) {
    lines.push(t('launcher.tooltip.expandedFromId', { value: expandedFromId }));
  }

  if (!id && !expandedFromId && lineNumber) {
    lines.push(t('launcher.tooltip.lineNumber', { value: lineNumber }));
  }

  if (expandedFrom) {
    lines.push(t('launcher.tooltip.expandedFrom', { value: expandedFrom }));
  }
  if (expandedOptions) {
    lines.push(t('launcher.tooltip.expandedOptions', { value: formatDirOptions(expandedOptions) }));
  }
}

/**
 * WindowInfo用のツールチップテキストを生成
 */
function getWindowInfoTooltip(win: WindowInfo): string {
  const lines: string[] = [];
  lines.push(t('launcher.tooltip.windowTitle', { value: win.title }));

  if (win.processName) {
    lines.push(t('launcher.tooltip.processName', { value: win.processName }));
  }

  if (win.executablePath) {
    lines.push(t('launcher.tooltip.executablePath', { value: win.executablePath }));
  }

  if (win.windowState) {
    const state =
      win.windowState === 'minimized' || win.windowState === 'maximized'
        ? win.windowState
        : 'normal';
    lines.push(
      t('launcher.tooltip.windowState', { value: t(`launcher.tooltip.windowStates.${state}`) })
    );
  }

  lines.push('');
  lines.push(t('launcher.tooltip.position', { x: win.x, y: win.y }));
  lines.push(t('launcher.tooltip.size', { width: win.width, height: win.height }));
  lines.push(t('launcher.tooltip.processId', { value: win.processId }));

  return lines.join('\n');
}

/**
 * SetItem用のツールチップテキストを生成
 */
function getSetItemTooltip(
  setItem: SetItem,
  nameOf: (itemId: string) => string | undefined
): string {
  const lines: string[] = [t('launcher.tooltip.set', { count: setItem.entries.length })];
  // 旧グループのツールチップと同じく、中身の名前を出す（先頭 3 行）
  const summary = setEntriesSummary(setItem.entries, nameOf);
  if (summary) lines.push(summary);
  const placed = setItem.entries.filter((entry) => entry.placement).length;
  if (placed > 0) lines.push(t('launcher.tooltip.setPlaced', { count: placed }));
  appendMetaInfo(lines, {
    sourceFile: setItem.sourceFile,
    id: setItem.id,
    lineNumber: setItem.lineNumber,
  });
  return lines.join('\n');
}

/**
 * WindowItem用のツールチップテキストを生成
 */
function getWindowItemTooltip(windowItem: WindowItem): string {
  const lines: string[] = [];
  lines.push(t('launcher.tooltip.windowTitle', { value: windowItem.windowTitle }));
  lines.push('');

  if (windowItem.x !== undefined && windowItem.y !== undefined) {
    lines.push(t('launcher.tooltip.position', { x: windowItem.x, y: windowItem.y }));
  }
  if (windowItem.width !== undefined && windowItem.height !== undefined) {
    lines.push(t('launcher.tooltip.size', { width: windowItem.width, height: windowItem.height }));
  }
  if (windowItem.virtualDesktopNumber !== undefined) {
    lines.push(t('launcher.tooltip.virtualDesktop', { value: windowItem.virtualDesktopNumber }));
  }
  if (windowItem.activateWindow === false) {
    lines.push(t('launcher.tooltip.noActivate'));
  }

  appendMetaInfo(lines, {
    sourceFile: windowItem.sourceFile,
    id: windowItem.id,
    lineNumber: windowItem.lineNumber,
  });

  return lines.join('\n');
}

/**
 * LauncherItem用のツールチップテキストを生成
 */
function getLauncherItemTooltip(launcherItem: LauncherItem): string {
  const lines: string[] = [];
  // パスの無い単一アイテムは、パスの代わりに切り替える先のウィンドウを出す
  lines.push(
    isPathlessItem(launcherItem)
      ? t('launcher.tooltip.windowSwitchOnly', {
          target: describeWindowMatch(launcherItem.window),
        })
      : PathUtils.getFullPath(launcherItem)
  );

  appendMetaInfo(lines, {
    sourceFile: launcherItem.sourceFile,
    id: launcherItem.id,
    expandedFromId: launcherItem.expandedFromId,
    lineNumber: launcherItem.lineNumber,
    expandedFrom: launcherItem.expandedFrom,
    expandedOptions: launcherItem.expandedOptions,
  });

  return lines.join('\n');
}

/**
 * ClipboardItem用のツールチップテキストを生成
 */
function getClipboardItemTooltip(clipboardItem: ClipboardItem): string {
  const lines: string[] = [];
  const formatKeys = ['text', 'html', 'rtf', 'image', 'file'] as const;
  const formats = (clipboardItem.formats || [])
    .map((f) =>
      (formatKeys as readonly string[]).includes(f)
        ? t(`launcher.tooltip.clipboardFormatNames.${f as (typeof formatKeys)[number]}`)
        : f
    )
    .join(', ');
  lines.push(t('launcher.tooltip.clipboardFormats', { value: formats }));

  if (clipboardItem.preview) {
    const preview =
      clipboardItem.preview.length > 50
        ? clipboardItem.preview.substring(0, 50) + '...'
        : clipboardItem.preview;
    lines.push(t('launcher.tooltip.preview', { value: preview }));
  }

  if (clipboardItem.savedAt) {
    const date = new Date(clipboardItem.savedAt).toLocaleString(i18next.language);
    lines.push(t('launcher.tooltip.savedAt', { value: date }));
  }

  appendMetaInfo(lines, {
    sourceFile: clipboardItem.sourceFile,
    id: clipboardItem.id,
    lineNumber: clipboardItem.lineNumber,
  });

  return lines.join('\n');
}

/**
 * AppItem用のツールチップテキストを生成
 * アイテムタイプに応じて適切な生成関数を呼び出す
 */
export function getTooltipText(
  item: AppItem,
  nameOf: (itemId: string) => string | undefined = () => undefined
): string {
  if (isWindowInfo(item)) {
    return getWindowInfoTooltip(item);
  }

  if (isSetItem(item)) {
    return getSetItemTooltip(item, nameOf);
  }

  if (isWindowItem(item)) {
    return getWindowItemTooltip(item);
  }

  if (isClipboardItem(item)) {
    return getClipboardItemTooltip(item);
  }

  return getLauncherItemTooltip(item as LauncherItem);
}
