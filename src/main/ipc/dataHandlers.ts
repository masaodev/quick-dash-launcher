import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, shell, dialog } from 'electron';
import { minimatch } from 'minimatch';
import { dataLogger } from '@common/logger';

import { DataFile, RawDataLine, SimpleBookmarkItem } from '../../common/types';

// DIRディレクティブのオプション型定義
interface DirOptions {
  depth: number;
  types: 'file' | 'folder' | 'both';
  filter?: string;
  exclude?: string;
  prefix?: string;
  suffix?: string;
}

// DIRディレクティブのオプションを解析
/**
 * DIRディレクティブの文字列オプションを解析してDirOptionsオブジェクトに変換する
 * カンマ区切りのオプション文字列（depth=2, filter=*.pdf等）を解析し、構造化されたオプションに変換する
 *
 * @param parts - カンマ区切りのオプション文字列配列（最初の要素はディレクトリパス）
 * @returns 解析されたDirOptionsオブジェクト
 *
 * @example
 * const options = parseDirOptions(['C:\\docs', 'depth=2', 'filter=*.pdf', 'prefix=Doc: ']);
 * // { depth: 2, types: 'both', filter: '*.pdf', prefix: 'Doc: ' }
 */
function parseDirOptions(parts: string[]): DirOptions {
  const options: DirOptions = {
    depth: 0,
    types: 'both',
  };

  // オプションを解析
  for (let i = 1; i < parts.length; i++) {
    const option = parts[i].trim();
    const [key, value] = option.split('=').map((s) => s.trim());

    switch (key) {
      case 'depth':
        options.depth = parseInt(value, 10);
        break;
      case 'types':
        if (value === 'file' || value === 'folder' || value === 'both') {
          options.types = value;
        }
        break;
      case 'filter':
        options.filter = value;
        break;
      case 'exclude':
        options.exclude = value;
        break;
      case 'prefix':
        options.prefix = value;
        break;
      case 'suffix':
        options.suffix = value;
        break;
    }
  }

  return options;
}

// ファイル/フォルダーをCSV形式に変換
function processItemToCSV(
  itemPath: string,
  itemType: 'file' | 'folder',
  prefix?: string,
  suffix?: string
): string {
  let displayName = path.basename(itemPath);

  // プレフィックスが指定されている場合は追加
  if (prefix) {
    displayName = `${prefix}: ${displayName}`;
  }

  // サフィックスが指定されている場合は追加
  if (suffix) {
    displayName = `${displayName} (${suffix})`;
  }

  const extension = path.extname(itemPath).toLowerCase();

  // 実行可能ファイルの場合
  if (
    itemType === 'file' &&
    (extension === '.exe' || extension === '.bat' || extension === '.cmd')
  ) {
    return `${displayName},${itemPath},,${itemPath}`;
  }

  // フォルダーまたはその他のファイル
  return `${displayName},${itemPath},,${itemPath}`;
}

/**
 * ショートカットファイル（.lnk）を解析してCSV形式の行データに変換する
 * Electronのネイティブ機能を使用してショートカットの詳細を読み取り、
 * 表示名、ターゲットパス、引数、元のファイルパスを含むCSV行を生成する
 *
 * @param filePath - 解析対象のショートカットファイルのパス
 * @param prefix - 表示名に追加するプレフィックス（オプション）
 * @returns CSV形式の行データ。解析に失敗した場合はnull
 * @throws Error ショートカットファイルの読み込みに失敗した場合（ログに記録され、nullを返す）
 *
 * @example
 * ```typescript
 * const csvLine = processShortcutToCSV('C:\\Users\\Desktop\\MyApp.lnk', 'デスクトップ');
 * // 'デスクトップ: MyApp,C:\\Program Files\\MyApp\\app.exe,,C:\\Users\\Desktop\\MyApp.lnk'
 *
 * const csvLineWithArgs = processShortcutToCSV('C:\\shortcut.lnk');
 * // 'MyApp,C:\\Program Files\\MyApp\\app.exe,--config=default,C:\\shortcut.lnk'
 * ```
 */
function processShortcutToCSV(filePath: string, prefix?: string, suffix?: string): string | null {
  try {
    // Electron のネイティブ機能を使用してショートカットを読み取り
    const shortcutDetails = shell.readShortcutLink(filePath);

    if (shortcutDetails && shortcutDetails.target) {
      let displayName = path.basename(filePath, '.lnk');

      // プレフィックスが指定されている場合は追加
      if (prefix) {
        displayName = `${prefix}: ${displayName}`;
      }

      // サフィックスが指定されている場合は追加
      if (suffix) {
        displayName = `${displayName} (${suffix})`;
      }

      let line = `${displayName},${shortcutDetails.target}`;

      // 引数が存在する場合は追加
      if (shortcutDetails.args && shortcutDetails.args.trim()) {
        line += `,${shortcutDetails.args}`;
      } else {
        // 引数が空の場合でも空のフィールドを追加
        line += ',';
      }

      // 元のショートカットファイルのパスを追加
      line += `,${filePath}`;

      return line;
    }
  } catch (error) {
    dataLogger.error('ショートカットの読み込みに失敗', { filePath, error });
  }

  return null;
}

// 拡張されたディレクトリスキャン関数
/**
 * 指定されたディレクトリを再帰的にスキャンし、指定されたオプションに基づいてファイル/フォルダを抽出する
 * DIRディレクティブで使用される主要な機能で、深度制限、タイプフィルター、パターンマッチングに対応
 *
 * @param dirPath - スキャン対象のディレクトリパス
 * @param options - スキャンオプション（深度、タイプ、フィルター等）
 * @param options.depth - スキャンする最大深度（-1は無制限）
 * @param options.type - 対象タイプ（'file', 'dir', 'all'）
 * @param options.filter - ファイル名のフィルターパターン（minimatch形式）
 * @param options.prefix - 各アイテム名に付加するプレフィックス
 * @param currentDepth - 現在の再帰深度（内部使用、初期値は0）
 * @returns CSV形式でフォーマットされたアイテムリストの配列
 * @throws ディレクトリアクセス権限エラー、ファイルシステムエラー
 *
 * @example
 * const items = await scanDirectory('/home/user/documents', {
 *   depth: 2,
 *   type: 'file',
 *   filter: '*.pdf',
 *   prefix: 'Doc: '
 * });
 */
async function scanDirectory(
  dirPath: string,
  options: DirOptions,
  currentDepth = 0
): Promise<string[]> {
  const results: string[] = [];

  // 深さ制限チェック
  if (options.depth !== -1 && currentDepth > options.depth) {
    return results;
  }

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);

      // エラーハンドリング: アクセスできないファイル/フォルダーをスキップ
      let stat;
      try {
        stat = fs.statSync(itemPath);
      } catch (error) {
        dataLogger.warn('アイテムにアクセスできません', { itemPath, error });
        continue;
      }

      const isDirectory = stat.isDirectory();
      const itemName = path.basename(itemPath);

      // 除外パターンチェック
      if (options.exclude && minimatch(itemName, options.exclude)) {
        continue;
      }

      // フィルターパターンチェック
      if (options.filter && !minimatch(itemName, options.filter)) {
        // サブディレクトリの場合は、中身をスキャンする可能性があるのでスキップしない
        if (!isDirectory) {
          continue;
        }
      }

      // タイプによる処理
      if (isDirectory) {
        // フォルダーを結果に含める
        if (options.types === 'folder' || options.types === 'both') {
          // フィルターがない、またはフィルターにマッチする場合のみ追加
          if (!options.filter || minimatch(itemName, options.filter)) {
            results.push(processItemToCSV(itemPath, 'folder', options.prefix, options.suffix));
          }
        }

        // サブディレクトリをスキャン
        if (currentDepth < options.depth || options.depth === -1) {
          const subResults = await scanDirectory(itemPath, options, currentDepth + 1);
          results.push(...subResults);
        }
      } else {
        // ファイルを結果に含める
        if (options.types === 'file' || options.types === 'both') {
          // .lnkファイルの場合は特別処理
          if (path.extname(itemPath).toLowerCase() === '.lnk') {
            const processedShortcut = processShortcutToCSV(
              itemPath,
              options.prefix,
              options.suffix
            );
            if (processedShortcut) {
              results.push(processedShortcut);
            }
          } else {
            results.push(processItemToCSV(itemPath, 'file', options.prefix, options.suffix));
          }
        }
      }
    }
  } catch (error) {
    dataLogger.error('ディレクトリのスキャンに失敗', { dirPath, error });
  }

  return results;
}

/**
 * 設定フォルダからデータファイル（data.txt, data2.txt, tempdata.txt）を読み込み、DIRディレクティブを展開する
 * 各ファイルを順次読み込み、DIRディレクティブが含まれている場合は自動的にディレクトリスキャンを実行して展開する
 *
 * @param configFolder - 設定フォルダのパス
 * @returns 処理済みのデータファイル配列（ファイル名、内容、種別を含む）
 * @throws ファイル読み込みエラー、DIRディレクティブ処理エラー
 *
 * @example
 * const dataFiles = await loadDataFiles('/path/to/config');
 * // [{ fileName: 'data.txt', content: '...', type: 'main' }, ...]
 */
async function loadDataFiles(configFolder: string): Promise<DataFile[]> {
  const files: DataFile[] = [];
  const dataFiles = ['data.txt', 'data2.txt', 'tempdata.txt'];

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');

      // dirディレクティブを処理
      const lines = content.split(/\r\n|\n|\r/);
      const processedLines: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('dir,')) {
          // DIRディレクティブを解析
          const parts = trimmedLine
            .substring(4)
            .split(',')
            .map((s) => s.trim());
          const dirPath = parts[0];

          if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
            try {
              // オプションを解析
              const options = parseDirOptions(parts);

              // ディレクトリをスキャン
              const items = await scanDirectory(dirPath, options);
              processedLines.push(...items);
            } catch (error) {
              dataLogger.error('ディレクトリのスキャンに失敗', { dirPath, error });
            }
          }
        } else {
          // 直接指定された.lnkファイルを処理
          const parts = trimmedLine.split(',');
          if (parts.length >= 2) {
            const itemPath = parts[1].trim();
            if (itemPath.toLowerCase().endsWith('.lnk') && fs.existsSync(itemPath)) {
              const processedShortcut = processShortcutToCSV(itemPath);
              if (processedShortcut) {
                processedLines.push(processedShortcut);
                continue;
              }
            }
          }
          processedLines.push(line);
        }
      }

      content = processedLines.join('\r\n');
      files.push({ name: fileName, content });
    }
  }

  return files;
}

// 生データを読み込む（DIRディレクティブ展開なし）
async function loadRawDataFiles(configFolder: string): Promise<RawDataLine[]> {
  const rawLines: RawDataLine[] = [];
  const dataFiles = ['data.txt', 'data2.txt', 'tempdata.txt'] as const;

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      // 改行コードを正規化（CRLF、LF、CRのいずれにも対応）
      const lines = content.split(/\r\n|\n|\r/);

      lines.forEach((line, index) => {
        const lineType = detectLineType(line);
        rawLines.push({
          lineNumber: index + 1,
          content: line,
          type: lineType,
          sourceFile: fileName,
        });
      });
    }
  }

  return rawLines;
}

// 行のタイプを判定
function detectLineType(line: string): RawDataLine['type'] {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return 'empty';
  }

  if (trimmedLine.startsWith('//')) {
    return 'comment';
  }

  if (trimmedLine.startsWith('dir,')) {
    return 'directive';
  }

  return 'item';
}

// 生データを保存
async function saveRawDataFiles(configFolder: string, rawLines: RawDataLine[]): Promise<void> {
  // ファイル別にグループ化
  const fileGroups = new Map<string, RawDataLine[]>();
  rawLines.forEach((line) => {
    if (!fileGroups.has(line.sourceFile)) {
      fileGroups.set(line.sourceFile, []);
    }
    fileGroups.get(line.sourceFile)!.push(line);
  });

  // 各ファイルを保存
  for (const [fileName, lines] of fileGroups) {
    const filePath = path.join(configFolder, fileName);

    // バックアップを作成
    if (fs.existsSync(filePath)) {
      const backupFolder = path.join(configFolder, 'backup');
      if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${path.parse(fileName).name}_${timestamp}${path.parse(fileName).ext}`;
      const backupPath = path.join(backupFolder, backupFileName);
      fs.copyFileSync(filePath, backupPath);
    }

    // 行番号でソートして内容を結合
    const sortedLines = lines.sort((a, b) => a.lineNumber - b.lineNumber);
    const content = sortedLines.map((line) => line.content).join('\r\n');

    // ファイルに書き込み
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

async function saveTempData(configFolder: string, content: string): Promise<void> {
  const tempDataPath = path.join(configFolder, 'tempdata.txt');
  fs.writeFileSync(tempDataPath, content, 'utf8');
}

interface RegisterItem {
  name: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  args?: string;
  targetTab: 'main' | 'temp';
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  itemCategory: 'item' | 'dir';
  // DIRディレクティブオプション
  dirOptions?: {
    depth: number;
    types: 'file' | 'folder' | 'both';
    filter?: string;
    exclude?: string;
    prefix?: string;
    suffix?: string;
  };
}

/**
 * 複数のアイテムを設定ファイルに登録する（メインタブ/一時タブ対応）
 * 通常のアイテムとDIRディレクティブの両方に対応し、既存のファイル内容に追記する形で保存する
 *
 * @param configFolder - 設定フォルダのパス
 * @param items - 登録するアイテムの配列
 * @param items[].name - アイテム名
 * @param items[].type - アイテムタイプ（'file', 'app', 'url', 'folder'）
 * @param items[].path - アイテムのパスまたはURL
 * @param items[].args - コマンドライン引数（オプション）
 * @param items[].targetTab - 対象タブ（'main' | 'temp'）
 * @param items[].itemCategory - アイテムカテゴリ（'item' | 'dir'）
 * @param items[].dirOptions - DIRディレクティブオプション（DIRアイテムの場合）
 * @returns 処理完了のPromise
 * @throws ファイル書き込みエラー、DIRオプション処理エラー
 *
 * @example
 * await registerItems('/path/to/config', [
 *   { name: 'VSCode', type: 'app', path: 'code.exe', targetTab: 'main', itemCategory: 'item' },
 *   { name: 'Documents', type: 'folder', path: '/docs', targetTab: 'main', itemCategory: 'dir', dirOptions: {...} }
 * ]);
 */
async function registerItems(configFolder: string, items: RegisterItem[]): Promise<void> {
  // Group items by target tab
  const mainItems = items.filter((item) => item.targetTab === 'main');
  const tempItems = items.filter((item) => item.targetTab === 'temp');

  // Process main items
  if (mainItems.length > 0) {
    const dataPath = path.join(configFolder, 'data.txt');
    let existingContent = '';

    if (fs.existsSync(dataPath)) {
      existingContent = fs.readFileSync(dataPath, 'utf8');
    }

    const newLines = mainItems.map((item) => {
      if (item.itemCategory === 'dir') {
        let dirLine = `dir,${item.path}`;

        // DIRディレクティブオプションを追加
        if (item.dirOptions) {
          const options: string[] = [];

          // depth
          if (item.dirOptions.depth !== 0) {
            options.push(`depth=${item.dirOptions.depth}`);
          }

          // types
          if (item.dirOptions.types !== 'both') {
            options.push(`types=${item.dirOptions.types}`);
          }

          // filter
          if (item.dirOptions.filter) {
            options.push(`filter=${item.dirOptions.filter}`);
          }

          // exclude
          if (item.dirOptions.exclude) {
            options.push(`exclude=${item.dirOptions.exclude}`);
          }

          // prefix
          if (item.dirOptions.prefix) {
            options.push(`prefix=${item.dirOptions.prefix}`);
          }

          // suffix
          if (item.dirOptions.suffix) {
            options.push(`suffix=${item.dirOptions.suffix}`);
          }

          if (options.length > 0) {
            dirLine += ',' + options.join(',');
          }
        }

        return dirLine;
      } else {
        let line = `${item.name},${item.path}`;
        if (item.args) {
          line += `,${item.args}`;
        }
        return line;
      }
    });

    const updatedContent = existingContent
      ? existingContent.trim() + '\r\n' + newLines.join('\r\n')
      : newLines.join('\r\n');
    fs.writeFileSync(dataPath, updatedContent.trim(), 'utf8');
  }

  // Process temp items
  if (tempItems.length > 0) {
    const tempDataPath = path.join(configFolder, 'tempdata.txt');
    let existingContent = '';

    if (fs.existsSync(tempDataPath)) {
      existingContent = fs.readFileSync(tempDataPath, 'utf8');
    }

    const newLines = tempItems.map((item) => {
      if (item.itemCategory === 'dir') {
        let dirLine = `dir,${item.path}`;

        // DIRディレクティブオプションを追加
        if (item.dirOptions) {
          const options: string[] = [];

          // depth
          if (item.dirOptions.depth !== 0) {
            options.push(`depth=${item.dirOptions.depth}`);
          }

          // types
          if (item.dirOptions.types !== 'both') {
            options.push(`types=${item.dirOptions.types}`);
          }

          // filter
          if (item.dirOptions.filter) {
            options.push(`filter=${item.dirOptions.filter}`);
          }

          // exclude
          if (item.dirOptions.exclude) {
            options.push(`exclude=${item.dirOptions.exclude}`);
          }

          // prefix
          if (item.dirOptions.prefix) {
            options.push(`prefix=${item.dirOptions.prefix}`);
          }

          // suffix
          if (item.dirOptions.suffix) {
            options.push(`suffix=${item.dirOptions.suffix}`);
          }

          if (options.length > 0) {
            dirLine += ',' + options.join(',');
          }
        }

        return dirLine;
      } else {
        let line = `${item.name},${item.path}`;
        if (item.args) {
          line += `,${item.args}`;
        }
        return line;
      }
    });

    const updatedContent = existingContent
      ? existingContent.trim() + '\r\n' + newLines.join('\r\n')
      : newLines.join('\r\n');
    fs.writeFileSync(tempDataPath, updatedContent.trim(), 'utf8');
  }
}

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * データファイルを種類別に分離してパス順にソートし、バックアップを作成する
 * 各データファイル（data.txt, data2.txt, tempdata.txt）を読み込み、アイテムを種類→パス→名前の順でソートして保存する
 * 処理前に自動的にバックアップファイルを作成し、データの安全性を確保する
 *
 * @param configFolder - 設定フォルダのパス
 * @returns 処理完了のPromise
 * @throws ファイル操作エラー、バックアップ作成エラー
 *
 * @example
 * await sortDataFiles('/path/to/config');
 * // data.txt, data2.txt, tempdata.txtがソートされ、backup/フォルダにバックアップが作成される
 */
async function sortDataFiles(configFolder: string): Promise<void> {
  const dataFiles = ['data.txt', 'data2.txt', 'tempdata.txt'];
  const backupFolder = path.join(configFolder, 'backup');

  // Ensure backup folder exists
  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r\n|\n|\r/);

      // Separate dir directives and regular entries
      const dirLines: string[] = [];
      const regularLines: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('//')) {
          // Keep empty lines and comments as is
          regularLines.push(line);
        } else if (trimmedLine.startsWith('dir,')) {
          dirLines.push(line);
        } else {
          regularLines.push(line);
        }
      }

      // Sort regular entries by path (second field)
      const sortedRegularLines = regularLines.sort((a, b) => {
        const partsA = parseCSVLine(a.trim());
        const partsB = parseCSVLine(b.trim());

        // If either line doesn't have a path, maintain original order
        if (partsA.length < 2 || partsB.length < 2) {
          return 0;
        }

        const pathA = partsA[1].toLowerCase();
        const pathB = partsB[1].toLowerCase();

        return pathA.localeCompare(pathB, 'ja');
      });

      // Create backup
      const backupPath = path.join(backupFolder, `${fileName}_${timestamp}`);
      fs.copyFileSync(filePath, backupPath);

      // Combine dir lines at the top, then sorted regular lines
      const sortedContent = [...dirLines, ...sortedRegularLines]
        .filter((line) => line.trim() !== '')
        .join('\r\n');

      // Write sorted content back to file
      fs.writeFileSync(filePath, sortedContent, 'utf8');

      dataLogger.info('データファイルのソートが完了', { fileName, backupPath });
    } catch (error) {
      dataLogger.error('データファイルのソートに失敗', { fileName, error });
      throw error;
    }
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  if (current || inQuotes) {
    result.push(current.trim());
  }

  return result;
}

export function setupDataHandlers(configFolder: string) {
  ipcMain.handle('get-config-folder', () => configFolder);

  ipcMain.handle('load-data-files', async () => {
    return await loadDataFiles(configFolder);
  });

  ipcMain.handle('save-temp-data', async (_event, content: string) => {
    return await saveTempData(configFolder, content);
  });

  ipcMain.handle('register-items', async (_event, items: RegisterItem[]) => {
    return await registerItems(configFolder, items);
  });

  ipcMain.handle('is-directory', async (_event, filePath: string) => {
    return isDirectory(filePath);
  });

  ipcMain.handle('sort-data-files', async () => {
    return await sortDataFiles(configFolder);
  });

  ipcMain.handle('load-raw-data-files', async () => {
    return await loadRawDataFiles(configFolder);
  });

  ipcMain.handle('save-raw-data-files', async (_event, rawLines: RawDataLine[]) => {
    return await saveRawDataFiles(configFolder, rawLines);
  });

  ipcMain.handle('select-bookmark-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'ブックマークファイルを選択',
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('parse-bookmark-file', async (_event, filePath: string) => {
    try {
      const htmlContent = fs.readFileSync(filePath, 'utf8');

      // 簡易的なHTMLパーサーでブックマークを抽出
      const bookmarks: SimpleBookmarkItem[] = [];

      // <A>タグを正規表現で抽出
      const linkRegex = /<A\s+[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
      let match;
      let index = 0;

      while ((match = linkRegex.exec(htmlContent)) !== null) {
        const url = match[1];
        const name = match[2].trim();

        // URLが有効な場合のみ追加
        if (url && name && (url.startsWith('http://') || url.startsWith('https://'))) {
          bookmarks.push({
            id: `bookmark-${index}`,
            name: name,
            url: url,
            checked: false,
          });
          index++;
        }
      }

      return bookmarks;
    } catch (error) {
      dataLogger.error('ブックマークファイルのパースに失敗', { error });
      throw error;
    }
  });
}
