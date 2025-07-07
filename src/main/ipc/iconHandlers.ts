import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

import { ipcMain } from 'electron';

import { FaviconService } from '../services/faviconService';

// FaviconServiceのインスタンスを保持
let faviconService: FaviconService;

const execAsync = promisify(exec);

async function fetchFavicon(url: string, faviconsFolder: string): Promise<string | null> {
  if (!faviconService) {
    faviconService = new FaviconService(faviconsFolder);
  }

  return await faviconService.fetchFavicon(url);
}

async function extractIcon(filePath: string, iconsFolder: string): Promise<string | null> {
  try {
    // ファイルが存在するか確認
    if (!fs.existsSync(filePath)) {
      console.error('ファイルが見つかりません:', filePath);
      return null;
    }

    // キャッシュ用ファイル名を生成
    const iconName = path.basename(filePath, path.extname(filePath)) + '_icon.png';
    const iconPath = path.join(iconsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    // アイコンを抽出
    const extractFileIcon = require('extract-file-icon');
    const iconBuffer = extractFileIcon(filePath, 32);

    if (iconBuffer && iconBuffer.length > 0) {
      // キャッシュに保存
      fs.writeFileSync(iconPath, iconBuffer);

      // base64データURLに変換
      const base64 = iconBuffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    return null;
  } catch (error) {
    console.error('アイコンの抽出に失敗しました:', error);
    return null;
  }
}

async function extractCustomUriIcon(uri: string, iconsFolder: string): Promise<string | null> {
  try {
    // URIスキーマを抽出
    const schemeMatch = uri.match(/^([^:]+):/);
    if (!schemeMatch) {
      return null;
    }

    const scheme = schemeMatch[1];

    // キャッシュファイル名を生成
    const iconName = `uri_${scheme}_icon.png`;
    const iconPath = path.join(iconsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    // レジストリからハンドラーアプリケーションを取得
    const handlerPath = await getUriSchemeHandler(scheme);
    if (!handlerPath) {
      return null;
    }

    // ハンドラーアプリケーションからアイコンを抽出
    const extractFileIcon = require('extract-file-icon');
    const iconBuffer = extractFileIcon(handlerPath, 32);

    if (iconBuffer && iconBuffer.length > 0) {
      // キャッシュに保存
      fs.writeFileSync(iconPath, iconBuffer);

      // base64データURLに変換
      const base64 = iconBuffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    return null;
  } catch (error) {
    console.error('カスタムURIアイコンの抽出に失敗しました:', error);
    return null;
  }
}

async function extractFileIconByExtension(
  filePath: string,
  extensionsFolder: string
): Promise<string | null> {
  try {
    let fileExtension: string;

    // URIスキーマの場合は特別処理
    if (filePath.includes('://')) {
      fileExtension = extractExtensionFromUri(filePath);
    } else {
      fileExtension = path.extname(filePath).toLowerCase();
    }

    if (!fileExtension) {
      console.log('拡張子がありません:', filePath);
      return null;
    }

    // 拡張子ベースのキャッシュファイル名を生成
    const extensionName = fileExtension.replace('.', '');
    const iconName = `ext_${extensionName}_icon.png`;
    const iconPath = path.join(extensionsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    // 拡張子に対応するダミーファイルを作成してアイコンを取得
    const tempFilePath = createTempFileForExtension(extensionName);

    try {
      // extract-file-iconを使用してアイコンを取得
      const extractFileIcon = require('extract-file-icon');
      const iconBuffer = extractFileIcon(tempFilePath, 32);

      if (iconBuffer && iconBuffer.length > 0) {
        // キャッシュに保存
        fs.writeFileSync(iconPath, iconBuffer);

        // base64データURLに変換
        const base64 = iconBuffer.toString('base64');
        return `data:image/png;base64,${base64}`;
      }
    } finally {
      // 一時ファイルを削除
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    return null;
  } catch (error) {
    console.error('拡張子ベースのアイコン抽出に失敗しました:', error);
    return null;
  }
}

async function getUriSchemeHandler(scheme: string): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    // スキーマからコロンとスラッシュを除去
    const cleanScheme = scheme.replace(/[:\\/]/g, '');

    // レジストリからスキーマハンドラーを取得
    const { stdout } = await execAsync(`reg query "HKEY_CLASSES_ROOT\\${cleanScheme}" /ve`, {
      encoding: 'utf8',
    });

    // レジストリから実行ファイルパスを取得
    const { stdout: commandStdout } = await execAsync(
      `reg query "HKEY_CLASSES_ROOT\\${cleanScheme}\\shell\\open\\command" /ve`,
      { encoding: 'utf8' }
    );

    // 実行ファイルパスを抽出
    const matches = commandStdout.match(/"([^"]+\.exe)"|([^\s]+\.exe)/i);
    if (matches) {
      const exePath = matches[1] || matches[2];
      // 環境変数を展開
      const expandedPath = exePath.replace(/%([^%]+)%/g, (_, envVar) => {
        return process.env[envVar] || _;
      });

      if (fs.existsSync(expandedPath)) {
        return expandedPath;
      }
    }

    return null;
  } catch (error) {
    // レジストリエントリが存在しない場合はエラーになるが、これは正常
    return null;
  }
}

function extractExtensionFromUri(uri: string): string {
  try {
    // URIからファイル名部分を抽出
    // 例: ms-excel:ofe|ofc|u|https://...Book%204.xlsx -> .xlsx
    // 例: ms-excel:ofe|ofc|u|https://...Book%204.xlsx?web=1 -> .xlsx

    // パイプ区切りの最後の部分（URL部分）を取得
    const parts = uri.split('|');
    const lastPart = parts[parts.length - 1];

    // URLデコードしてファイル名を取得
    const decodedUrl = decodeURIComponent(lastPart);

    // パス部分からファイル名を抽出
    let fileName = decodedUrl.split('/').pop() || '';

    // クエリパラメータとフラグメントを除去
    fileName = fileName.split('?')[0].split('#')[0];

    // 拡張子を抽出
    const extensionMatch = fileName.match(/\.[^.]+$/);
    return extensionMatch ? extensionMatch[0].toLowerCase() : '';
  } catch (error) {
    console.error('URIから拡張子の抽出に失敗:', error);
    return '';
  }
}

function createTempFileForExtension(extension: string): string {
  const os = require('os');
  const tempDir = os.tmpdir();
  const tempFileName = `temp_icon_extract_${Date.now()}.${extension}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  // 空のファイルを作成
  fs.writeFileSync(tempFilePath, '');

  return tempFilePath;
}

async function loadCachedIcons(
  items: any[],
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
): Promise<Record<string, string>> {
  const iconCache: Record<string, string> = {};

  for (const item of items) {
    try {
      let iconPath: string | null = null;

      // URLの場合、キャッシュされたファビコンをチェック
      if (item.type === 'url' && item.path && item.path.includes('://')) {
        const domain = new URL(item.path).hostname;
        // 新しい64pxファイルを優先的にチェック
        const faviconPath64 = path.join(faviconsFolder, `${domain}_favicon_64.png`);
        const faviconPath32 = path.join(faviconsFolder, `${domain}_favicon_32.png`);

        if (fs.existsSync(faviconPath64)) {
          iconPath = faviconPath64;
        } else if (fs.existsSync(faviconPath32)) {
          iconPath = faviconPath32;
        }
      } else if (item.type === 'app' && item.path && item.path.endsWith('.exe')) {
        // .exeファイルの場合、アイコンをチェック
        const iconName = path.basename(item.path, '.exe') + '_icon.png';
        const exeIconPath = path.join(iconsFolder, iconName);
        if (fs.existsSync(exeIconPath)) {
          iconPath = exeIconPath;
        }
      } else if (item.type === 'customUri' && item.path) {
        // カスタムURIの場合、まずスキーマベースのアイコンをチェック
        const schemeMatch = item.path.match(/^([^:]+):/);
        if (schemeMatch) {
          const scheme = schemeMatch[1];
          const uriIconPath = path.join(iconsFolder, `uri_${scheme}_icon.png`);
          if (fs.existsSync(uriIconPath)) {
            iconPath = uriIconPath;
          }
        }

        // スキーマベースのアイコンがない場合、拡張子ベースのアイコンをチェック
        if (!iconPath) {
          const fileExtension = extractExtensionFromUri(item.path);
          if (fileExtension) {
            const extensionName = fileExtension.replace('.', '');
            const extensionIconPath = path.join(extensionsFolder, `ext_${extensionName}_icon.png`);
            if (fs.existsSync(extensionIconPath)) {
              iconPath = extensionIconPath;
            }
          }
        }
      } else if (item.type === 'file' && item.path) {
        // ファイルの場合、拡張子ベースのアイコンをチェック
        const fileExtension = path.extname(item.path).toLowerCase();
        if (fileExtension) {
          const extensionName = fileExtension.replace('.', '');
          const extensionIconPath = path.join(extensionsFolder, `ext_${extensionName}_icon.png`);
          if (fs.existsSync(extensionIconPath)) {
            iconPath = extensionIconPath;
          }
        }
      }

      if (iconPath) {
        const iconBuffer = fs.readFileSync(iconPath);
        const base64 = iconBuffer.toString('base64');
        iconCache[item.path] = `data:image/png;base64,${base64}`;
      }
    } catch (error) {
      console.error(`Failed to load cached icon for ${item.path}:`, error);
    }
  }

  return iconCache;
}

export function setupIconHandlers(
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
) {
  ipcMain.handle('fetch-favicon', async (_event, url: string) => {
    return await fetchFavicon(url, faviconsFolder);
  });

  ipcMain.handle('extract-icon', async (_event, filePath: string) => {
    return await extractIcon(filePath, iconsFolder);
  });

  ipcMain.handle('extract-file-icon-by-extension', async (_event, filePath: string) => {
    return await extractFileIconByExtension(filePath, extensionsFolder);
  });

  ipcMain.handle('extract-custom-uri-icon', async (_event, uri: string) => {
    return await extractCustomUriIcon(uri, iconsFolder);
  });

  ipcMain.handle('load-cached-icons', async (_event, items: any[]) => {
    return await loadCachedIcons(items, faviconsFolder, iconsFolder, extensionsFolder);
  });
}
