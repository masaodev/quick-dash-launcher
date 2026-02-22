import type {
  AppItem,
  WindowInfo,
  GroupItem,
  WindowItem,
  LauncherItem,
  ClipboardItem,
} from '@common/types';
import { isWindowInfo, isGroupItem, isWindowItem, isClipboardItem } from '@common/types/guards';
import { PathUtils } from '@common/utils/pathUtils';

interface MetaInfo {
  sourceFile?: string;
  id?: string;
  expandedFromId?: string;
  lineNumber?: number;
  expandedFrom?: string;
  expandedOptions?: string;
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
    lines.push(`データファイル: ${sourceFile}`);
  }

  if (id) {
    lines.push(`ID: ${id}`);
  }

  if (expandedFromId) {
    lines.push(`展開元ID: ${expandedFromId}`);
  }

  if (!id && !expandedFromId && lineNumber) {
    lines.push(`行番号: ${lineNumber}`);
  }

  if (expandedFrom) {
    lines.push(`取込元: ${expandedFrom}`);
  }
  if (expandedOptions) {
    lines.push(`設定: ${expandedOptions}`);
  }
}

/**
 * WindowInfo用のツールチップテキストを生成
 */
function getWindowInfoTooltip(win: WindowInfo): string {
  const lines: string[] = [];
  lines.push(`ウィンドウタイトル: ${win.title}`);

  if (win.processName) {
    lines.push(`プロセス名: ${win.processName}`);
  }

  if (win.executablePath) {
    lines.push(`実行ファイルパス: ${win.executablePath}`);
  }

  if (win.windowState) {
    const stateLabels: Record<string, string> = {
      minimized: '最小化',
      maximized: '最大化',
      normal: '通常',
    };
    lines.push(`状態: ${stateLabels[win.windowState] || '通常'}`);
  }

  lines.push('');
  lines.push(`位置: (${win.x}, ${win.y})`);
  lines.push(`サイズ: ${win.width}x${win.height}`);
  lines.push(`プロセスID: ${win.processId}`);

  return lines.join('\n');
}

/**
 * GroupItem用のツールチップテキストを生成
 */
function getGroupItemTooltip(groupItem: GroupItem): string {
  const lines: string[] = [];
  lines.push(`グループ: ${groupItem.itemNames.join(', ')}`);

  appendMetaInfo(lines, {
    sourceFile: groupItem.sourceFile,
    id: groupItem.id,
    lineNumber: groupItem.lineNumber,
  });

  return lines.join('\n');
}

/**
 * WindowItem用のツールチップテキストを生成
 */
function getWindowItemTooltip(windowItem: WindowItem): string {
  const lines: string[] = [];
  lines.push(`ウィンドウタイトル: ${windowItem.windowTitle}`);
  lines.push('');

  if (windowItem.x !== undefined && windowItem.y !== undefined) {
    lines.push(`位置: (${windowItem.x}, ${windowItem.y})`);
  }
  if (windowItem.width !== undefined && windowItem.height !== undefined) {
    lines.push(`サイズ: ${windowItem.width}x${windowItem.height}`);
  }
  if (windowItem.virtualDesktopNumber !== undefined) {
    lines.push(`仮想デスクトップ: ${windowItem.virtualDesktopNumber}`);
  }
  if (windowItem.activateWindow === false) {
    lines.push(`アクティブ化: しない`);
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
  lines.push(PathUtils.getFullPath(launcherItem));

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
  const formatLabels: Record<string, string> = {
    text: 'テキスト',
    html: 'HTML',
    rtf: 'RTF',
    image: '画像',
    file: 'ファイル',
  };
  const formats = (clipboardItem.formats || []).map((f) => formatLabels[f] || f).join(', ');
  lines.push(`フォーマット: ${formats}`);

  if (clipboardItem.preview) {
    const preview =
      clipboardItem.preview.length > 50
        ? clipboardItem.preview.substring(0, 50) + '...'
        : clipboardItem.preview;
    lines.push(`プレビュー: ${preview}`);
  }

  if (clipboardItem.savedAt) {
    const date = new Date(clipboardItem.savedAt).toLocaleString('ja-JP');
    lines.push(`保存日時: ${date}`);
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
export function getTooltipText(item: AppItem): string {
  if (isWindowInfo(item)) {
    return getWindowInfoTooltip(item);
  }

  if (isGroupItem(item)) {
    return getGroupItemTooltip(item);
  }

  if (isWindowItem(item)) {
    return getWindowItemTooltip(item);
  }

  if (isClipboardItem(item)) {
    return getClipboardItemTooltip(item);
  }

  return getLauncherItemTooltip(item as LauncherItem);
}
