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

/**
 * メタ情報（データファイル、行番号など）を文字列配列に追加
 * 各ツールチップで共通して使用される処理を集約
 */
function appendMetaInfo(
  lines: string[],
  sourceFile?: string,
  lineNumber?: number,
  expandedFrom?: string,
  expandedOptions?: string
): void {
  // 空行を追加してメタ情報を分離
  if (sourceFile || lineNumber || expandedFrom || expandedOptions) {
    lines.push('');
  }

  if (sourceFile) {
    lines.push(`データファイル: ${sourceFile}`);
  }
  if (lineNumber) {
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
    const stateText =
      win.windowState === 'minimized'
        ? '最小化'
        : win.windowState === 'maximized'
          ? '最大化'
          : '通常';
    lines.push(`状態: ${stateText}`);
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

  appendMetaInfo(lines, groupItem.sourceFile, groupItem.lineNumber);

  return lines.join('\n');
}

/**
 * WindowItem用のツールチップテキストを生成
 */
function getWindowItemTooltip(windowItem: WindowItem): string {
  const lines: string[] = [];
  lines.push(`ウィンドウタイトル: ${windowItem.windowTitle}`);

  // 空行
  lines.push('');

  // 位置・サイズ情報
  if (windowItem.x !== undefined && windowItem.y !== undefined) {
    lines.push(`位置: (${windowItem.x}, ${windowItem.y})`);
  }
  if (windowItem.width !== undefined && windowItem.height !== undefined) {
    lines.push(`サイズ: ${windowItem.width}x${windowItem.height}`);
  }

  // 仮想デスクトップ情報
  if (windowItem.virtualDesktopNumber !== undefined) {
    lines.push(`仮想デスクトップ: ${windowItem.virtualDesktopNumber}`);
  }

  // アクティブ化フラグ
  if (windowItem.activateWindow === false) {
    lines.push(`アクティブ化: しない`);
  }

  appendMetaInfo(lines, windowItem.sourceFile, windowItem.lineNumber);

  return lines.join('\n');
}

/**
 * LauncherItem用のツールチップテキストを生成
 */
function getLauncherItemTooltip(launcherItem: LauncherItem): string {
  const lines: string[] = [];

  // パス情報（最初に表示）
  lines.push(PathUtils.getFullPath(launcherItem));

  appendMetaInfo(
    lines,
    launcherItem.sourceFile,
    launcherItem.lineNumber,
    launcherItem.expandedFrom,
    launcherItem.expandedOptions
  );

  return lines.join('\n');
}

/**
 * ClipboardItem用のツールチップテキストを生成
 */
function getClipboardItemTooltip(clipboardItem: ClipboardItem): string {
  const lines: string[] = [];

  // フォーマット情報
  const formatLabels: Record<string, string> = {
    text: 'テキスト',
    html: 'HTML',
    rtf: 'RTF',
    image: '画像',
    file: 'ファイル',
  };
  const formats = (clipboardItem.formats || []).map((f) => formatLabels[f] || f).join(', ');
  lines.push(`フォーマット: ${formats}`);

  // プレビュー
  if (clipboardItem.preview) {
    const preview =
      clipboardItem.preview.length > 50
        ? clipboardItem.preview.substring(0, 50) + '...'
        : clipboardItem.preview;
    lines.push(`プレビュー: ${preview}`);
  }

  // 保存日時
  if (clipboardItem.savedAt) {
    const date = new Date(clipboardItem.savedAt).toLocaleString('ja-JP');
    lines.push(`保存日時: ${date}`);
  }

  appendMetaInfo(lines, clipboardItem.sourceFile, clipboardItem.lineNumber);

  return lines.join('\n');
}

/**
 * AppItem用のツールチップテキストを生成
 * アイテムタイプに応じて適切な生成関数を呼び出す
 */
export function getTooltipText(item: AppItem): string {
  // WindowInfoの場合
  if (isWindowInfo(item)) {
    return getWindowInfoTooltip(item);
  }

  // タイプ別処理
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
