/**
 * Windows操作アイテムのCSV形式からJSON形式への移行ユーティリティ
 *
 * 古いCSV形式のwindowディレクティブを新しいJSON形式に変換します。
 */

import { parseCSVLine, escapeCSV } from './csvParser';

/**
 * 古いCSV形式のwindowディレクティブをJSON形式に変換する
 *
 * @param line - 元のwindowディレクティブ行
 * @returns JSON形式に変換された行、またはすでにJSON形式の場合は元の行
 *
 * @example
 * // 古いCSV形式
 * const oldLine = 'window,表示名,Chrome,100,100,1920,1080,1,true';
 * const newLine = migrateWindowOperationLine(oldLine);
 * // 'window,{"name":"表示名","windowTitle":"Chrome","x":100,"y":100,"width":1920,"height":1080,"virtualDesktopNumber":1,"activateWindow":true}'
 */
export function migrateWindowOperationLine(line: string): string {
  const trimmedLine = line.trim();

  // windowディレクティブでない場合はそのまま返す
  if (!trimmedLine.startsWith('window,')) {
    return line;
  }

  const parts = parseCSVLine(trimmedLine);

  // すでにJSON形式の場合はそのまま返す
  if (parts[1] && parts[1].trim().startsWith('{')) {
    return line;
  }

  // 古いCSV形式の場合: window,表示名,ウィンドウタイトル,x,y,width,height,virtualDesktopNumber,activateWindow
  const name = parts[1] || '';
  const windowTitle = parts[2] || '';
  const x = parts[3] ? parseInt(parts[3], 10) : undefined;
  const y = parts[4] ? parseInt(parts[4], 10) : undefined;
  const width = parts[5] ? parseInt(parts[5], 10) : undefined;
  const height = parts[6] ? parseInt(parts[6], 10) : undefined;
  const virtualDesktopNumber = parts[7] ? parseInt(parts[7], 10) : undefined;
  const activateWindow = parts[8] === undefined ? undefined : parts[8] === 'true';

  // JSON形式で再構築
  const config: Record<string, string | number | boolean> = {
    name,
    windowTitle,
  };

  // オプションフィールドは値がある場合のみ追加
  if (x !== undefined) config.x = x;
  if (y !== undefined) config.y = y;
  if (width !== undefined) config.width = width;
  if (height !== undefined) config.height = height;
  if (virtualDesktopNumber !== undefined) config.virtualDesktopNumber = virtualDesktopNumber;
  if (activateWindow !== undefined) config.activateWindow = activateWindow;

  return `window,${escapeCSV(JSON.stringify(config))}`;
}

/**
 * データファイルの内容全体を変換する
 *
 * @param fileContent - データファイルの内容
 * @returns 変換後のデータファイルの内容
 */
export function migrateDataFileContent(fileContent: string): {
  content: string;
  migrated: boolean;
} {
  const lines = fileContent.split(/\r\n|\n|\r/);
  let migrated = false;
  const newLines: string[] = [];

  for (const line of lines) {
    const newLine = migrateWindowOperationLine(line);
    if (newLine !== line) {
      migrated = true;
    }
    newLines.push(newLine);
  }

  return {
    content: newLines.join('\n'),
    migrated,
  };
}
