import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as extractFileIcon from 'extract-file-icon';

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
    const fileExtension = path.extname(filePath).toLowerCase();
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
    
    // extract-file-iconを使用してアイコンを取得
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
    console.error('拡張子ベースのアイコン抽出に失敗しました:', error);
    return null;
  }
}

async function loadCachedIcons(items: any[], faviconsFolder: string): Promise<Record<string, string>> {
  const iconCache: Record<string, string> = {};
  
  for (const item of items) {
    try {
      let iconPath: string | null = null;
      
      if (item.type === 'url' && item.path && item.path.includes('://')) {
        // URLの場合、ファビコンをチェック
        const domain = new URL(item.path).hostname;
        const faviconPath = path.join(faviconsFolder, `${domain}_favicon_32.png`);
        if (fs.existsSync(faviconPath)) {
          iconPath = faviconPath;
        }
      } else if (item.type === 'app' && item.path && item.path.endsWith('.exe')) {
        // .exeファイルの場合、アイコンをチェック
        const iconName = path.basename(item.path, '.exe') + '_icon.png';
        const exeIconPath = path.join(faviconsFolder, iconName);
        if (fs.existsSync(exeIconPath)) {
          iconPath = exeIconPath;
        }
      } else if (item.type === 'file' && item.path) {
        // ファイルの場合、拡張子ベースのアイコンをチェック
        const fileExtension = path.extname(item.path).toLowerCase();
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