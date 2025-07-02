import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

async function fetchFavicon(url: string, faviconsFolder: string): Promise<string | null> {
  try {
    const domain = new URL(url).hostname;
    const faviconPath = path.join(faviconsFolder, `${domain}_favicon_32.png`);
    
    // ファビコンがすでにキャッシュされているか確認
    if (fs.existsSync(faviconPath)) {
      const cachedFavicon = fs.readFileSync(faviconPath);
      const base64 = cachedFavicon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }
    
    // 新しいファビコンを取得
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    const response = await fetch(faviconUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // キャッシュに保存
    fs.writeFileSync(faviconPath, Buffer.from(buffer));
    
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('ファビコンの取得に失敗しました:', error);
    return null;
  }
}

async function extractIcon(filePath: string, faviconsFolder: string): Promise<string | null> {
  try {
    // ファイルが存在するか確認
    if (!fs.existsSync(filePath)) {
      console.error('ファイルが見つかりません:', filePath);
      return null;
    }
    
    // キャッシュ用ファイル名を生成
    const iconName = path.basename(filePath, path.extname(filePath)) + '_icon.png';
    const iconPath = path.join(faviconsFolder, iconName);
    
    // アイコンがすでにキャッシュされているか確認
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }
    
    // アイコンを抽出
    const iconExtractor = require('@bitdisaster/exe-icon-extractor');
    const iconBuffer = iconExtractor.extractIcon(filePath, 'large');
    
    if (iconBuffer) {
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

async function extractFileIconByExtension(filePath: string, faviconsFolder: string): Promise<string | null> {
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
    const iconPath = path.join(faviconsFolder, iconName);
    
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

function extractExtensionFromUri(uri: string): string {
  try {
    // URIからファイル名部分を抽出
    // 例: ms-excel:ofe|ofc|u|https://...Book%204.xlsx -> .xlsx
    
    // パイプ区切りの最後の部分（URL部分）を取得
    const parts = uri.split('|');
    const lastPart = parts[parts.length - 1];
    
    // URLデコードしてファイル名を取得
    const decodedUrl = decodeURIComponent(lastPart);
    
    // パス部分からファイル名を抽出
    const fileName = decodedUrl.split('/').pop() || '';
    
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

async function loadCachedIcons(items: any[], faviconsFolder: string): Promise<Record<string, string>> {
  const iconCache: Record<string, string> = {};
  
  for (const item of items) {
    try {
      let iconPath: string | null = null;
      
      // URLの場合、ファビコンをスキップ（ボタン押下時のみ取得）
      if (item.type === 'url' && item.path && item.path.includes('://')) {
        continue;
      } else if (item.type === 'app' && item.path && item.path.endsWith('.exe')) {
        // .exeファイルの場合、アイコンをチェック
        const iconName = path.basename(item.path, '.exe') + '_icon.png';
        const exeIconPath = path.join(faviconsFolder, iconName);
        if (fs.existsSync(exeIconPath)) {
          iconPath = exeIconPath;
        }
      } else if ((item.type === 'file' || item.type === 'uri') && item.path) {
        // ファイルまたはURIの場合、拡張子ベースのアイコンをチェック
        let fileExtension: string;
        
        if (item.path.includes('://')) {
          // URIスキーマの場合
          fileExtension = extractExtensionFromUri(item.path);
        } else {
          // 通常のファイルパスの場合
          fileExtension = path.extname(item.path).toLowerCase();
        }
        
        if (fileExtension) {
          const extensionName = fileExtension.replace('.', '');
          const extensionIconPath = path.join(faviconsFolder, `ext_${extensionName}_icon.png`);
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

export function setupIconHandlers(faviconsFolder: string) {
  ipcMain.handle('fetch-favicon', async (_event, url: string) => {
    return await fetchFavicon(url, faviconsFolder);
  });
  
  ipcMain.handle('extract-icon', async (_event, filePath: string) => {
    return await extractIcon(filePath, faviconsFolder);
  });
  
  ipcMain.handle('extract-file-icon-by-extension', async (_event, filePath: string) => {
    return await extractFileIconByExtension(filePath, faviconsFolder);
  });
  
  ipcMain.handle('load-cached-icons', async (_event, items: any[]) => {
    return await loadCachedIcons(items, faviconsFolder);
  });
}