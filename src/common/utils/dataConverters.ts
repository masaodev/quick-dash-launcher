/**
 * データ変換ユーティリティ
 *
 * RawDataLine、RegisterItem、LauncherItem間の変換ロジックを提供します。
 * これらの変換ロジックは以前、複数のコンポーネントに重複していました。
 */

import type { RawDataLine, LauncherItem, DataFileTab } from '../types';

import { parseCSVLine, escapeCSV } from './csvParser';

/**
 * フォルダ取込アイテムのオプション型定義
 */
export interface DirOptions {
  depth: number;
  types: 'file' | 'folder' | 'both';
  filter?: string;
  exclude?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * RegisterModalで使用されるアイテム型
 */
export interface RegisterItem {
  name: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  targetTab: string;
  targetFile?: string;
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  customIcon?: string;
  itemCategory: 'item' | 'dir' | 'group';
  dirOptions?: DirOptions;
  groupItemNames?: string[];
}

/**
 * カンマ区切りのオプション文字列をDirOptionsオブジェクトに変換する
 *
 * @param optionsStr - カンマ区切りのオプション文字列（例: "depth=2,filter=*.pdf,prefix=Doc: "）
 * @returns 解析されたDirOptionsオブジェクト
 *
 * @example
 * const options = parseDirOptionsFromString("depth=2,filter=*.pdf,prefix=Doc: ");
 * // { depth: 2, types: 'both', filter: '*.pdf', prefix: 'Doc: ' }
 */
export function parseDirOptionsFromString(optionsStr: string): DirOptions {
  const dirOptions: DirOptions = {
    depth: 0,
    types: 'both',
  };

  if (!optionsStr) {
    return dirOptions;
  }

  const options = optionsStr.split(',');
  for (const option of options) {
    const [key, value] = option.split('=');
    if (key && value) {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();

      switch (trimmedKey) {
        case 'depth':
          dirOptions.depth = parseInt(trimmedValue, 10) || 0;
          break;
        case 'types':
          if (trimmedValue === 'file' || trimmedValue === 'folder' || trimmedValue === 'both') {
            dirOptions.types = trimmedValue;
          }
          break;
        case 'filter':
          dirOptions.filter = trimmedValue;
          break;
        case 'exclude':
          dirOptions.exclude = trimmedValue;
          break;
        case 'prefix':
          dirOptions.prefix = trimmedValue;
          break;
        case 'suffix':
          dirOptions.suffix = trimmedValue;
          break;
      }
    }
  }

  return dirOptions;
}

/**
 * DirOptionsオブジェクトをカンマ区切りのオプション文字列に変換する
 *
 * @param dirOptions - DirOptionsオブジェクト
 * @returns カンマ区切りのオプション文字列
 *
 * @example
 * const optionsStr = formatDirOptionsToString({ depth: 2, types: 'file', filter: '*.pdf' });
 * // "depth=2,types=file,filter=*.pdf"
 */
export function formatDirOptionsToString(dirOptions: DirOptions): string {
  const options: string[] = [];

  if (dirOptions.depth !== 0) {
    options.push(`depth=${dirOptions.depth}`);
  }
  if (dirOptions.types !== 'both') {
    options.push(`types=${dirOptions.types}`);
  }
  if (dirOptions.filter) {
    options.push(`filter=${dirOptions.filter}`);
  }
  if (dirOptions.exclude) {
    options.push(`exclude=${dirOptions.exclude}`);
  }
  if (dirOptions.prefix) {
    options.push(`prefix=${dirOptions.prefix}`);
  }
  if (dirOptions.suffix) {
    options.push(`suffix=${dirOptions.suffix}`);
  }

  return options.join(',');
}

/**
 * RawDataLineをRegisterItemに変換する
 *
 * @param line - 変換元のRawDataLine
 * @param tabs - 利用可能なデータファイルタブのリスト
 * @param detectItemType - アイテムタイプを検出する関数
 * @returns 変換されたRegisterItem
 */
export async function convertRawDataLineToRegisterItem(
  line: RawDataLine,
  tabs: DataFileTab[],
  detectItemType: (path: string) => Promise<LauncherItem['type']>
): Promise<RegisterItem> {
  const defaultTab = line.sourceFile || (tabs.length > 0 ? tabs[0].files[0] : 'data.txt');

  if (line.type === 'item') {
    // アイテム行の場合：名前,パス,引数,カスタムアイコン
    const parts = parseCSVLine(line.content);
    const name = parts[0] || '';
    const path = parts[1] || '';
    const args = parts[2] || '';
    const customIcon = parts[3] || '';

    const itemType = await detectItemType(path);

    return {
      name,
      path,
      type: itemType,
      args: args || undefined,
      targetTab: defaultTab,
      targetFile: line.sourceFile,
      folderProcessing: itemType === 'folder' ? 'folder' : undefined,
      customIcon: customIcon || line.customIcon,
      itemCategory: 'item',
    };
  } else if (line.type === 'directive') {
    // ディレクティブの種類を判定
    const trimmedContent = line.content.trim();

    if (trimmedContent.startsWith('group,')) {
      // グループアイテム行の場合：group,グループ名,アイテム1,アイテム2,...
      const parts = parseCSVLine(line.content);
      const groupName = parts[1] || '';
      const itemNames = parts.slice(2).filter((name) => name);

      return {
        name: groupName,
        path: '',
        type: 'app',
        targetTab: defaultTab,
        targetFile: line.sourceFile,
        itemCategory: 'group',
        groupItemNames: itemNames,
      };
    } else {
      // フォルダ取込アイテム行の場合：dir,パス,オプション
      const parts = parseCSVLine(line.content);
      const path = parts[1] || '';
      const optionsStr = parts.slice(2).join(',');

      const dirOptions = parseDirOptionsFromString(optionsStr);

      return {
        name: path,
        path,
        type: 'folder',
        targetTab: defaultTab,
        targetFile: line.sourceFile,
        folderProcessing: 'expand',
        dirOptions,
        itemCategory: 'dir',
      };
    }
  } else {
    // その他の場合（コメント、空行など）
    return {
      name: line.content || '',
      path: line.content || '',
      type: 'file',
      targetTab: defaultTab,
      targetFile: line.sourceFile,
      itemCategory: 'item',
    };
  }
}

/**
 * RegisterItemをRawDataLineに変換する
 *
 * @param item - 変換元のRegisterItem
 * @param originalLine - 元のRawDataLine（行番号などのメタ情報を保持）
 * @returns 変換されたRawDataLine
 */
export function convertRegisterItemToRawDataLine(
  item: RegisterItem,
  originalLine: RawDataLine
): RawDataLine {
  let newContent = '';
  let newType: RawDataLine['type'] = originalLine.type;

  if (item.itemCategory === 'dir') {
    // フォルダ取込アイテムの場合
    newType = 'directive';
    if (item.dirOptions) {
      const optionsStr = formatDirOptionsToString(item.dirOptions);
      newContent = optionsStr ? `dir,${item.path},${optionsStr}` : `dir,${item.path}`;
    } else {
      newContent = `dir,${item.path}`;
    }
  } else if (item.itemCategory === 'group') {
    // グループアイテムの場合：group,グループ名,アイテム1,アイテム2,...
    newType = 'directive';
    const itemNames = item.groupItemNames || [];
    newContent = `group,${item.name},${itemNames.join(',')}`;
  } else {
    // アイテム行の場合：名前,パス,引数,カスタムアイコン の形式
    // CSVエスケープを適用
    newType = 'item';
    const args = item.args || '';
    const customIcon = item.customIcon || '';

    if (customIcon) {
      newContent = `${escapeCSV(item.name)},${escapeCSV(item.path)},${escapeCSV(args)},${escapeCSV(customIcon)}`;
    } else {
      newContent = `${escapeCSV(item.name)},${escapeCSV(item.path)},${escapeCSV(args)}`;
    }
  }

  return {
    ...originalLine,
    content: newContent,
    type: newType,
  };
}

/**
 * LauncherItemをRawDataLineに変換する
 *
 * @param item - 変換元のLauncherItem
 * @param loadRawDataFiles - データファイルをロードする関数
 * @returns 変換されたRawDataLine
 */
export async function convertLauncherItemToRawDataLine(
  item: LauncherItem,
  loadRawDataFiles: () => Promise<RawDataLine[]>
): Promise<RawDataLine> {
  // フォルダ取込から展開されたアイテムの場合
  if (item.isDirExpanded && item.expandedFrom && item.lineNumber && item.sourceFile) {
    try {
      const rawLines = await loadRawDataFiles();
      const originalLine = rawLines.find(
        (line) => line.sourceFile === item.sourceFile && line.lineNumber === item.lineNumber
      );

      if (originalLine) {
        return originalLine;
      }
    } catch (err) {
      console.error('元のディレクティブ行の読み込みに失敗しました:', err);
    }

    // フォールバック: expandedOptionsを使用
    let content = `dir,${item.expandedFrom}`;
    if (item.expandedOptions) {
      content += `,${item.expandedOptions}`;
    }

    return {
      lineNumber: item.lineNumber || 1,
      content: content,
      type: 'directive',
      sourceFile: item.sourceFile || 'data.txt',
      customIcon: undefined,
    };
  }

  // 通常のアイテムの場合
  const parts = [item.name, item.path];
  if (item.args) {
    parts.push(item.args);
  }
  if (item.customIcon) {
    if (!item.args) {
      parts.push('');
    }
    parts.push(item.customIcon);
  }

  return {
    lineNumber: item.lineNumber || 1,
    content: parts.join(','),
    type: 'item',
    sourceFile: item.sourceFile || 'data.txt',
    customIcon: item.customIcon,
  };
}
