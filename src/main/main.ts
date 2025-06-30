import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, shell, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// import Store from 'electron-store'; // Reserved for future use
import { LauncherItem, DataFile } from '../common/types';
const ws = require('windows-shortcuts');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
// const store = new Store(); // Reserved for future use

const HOTKEY = 'Ctrl+Alt+W';
const CONFIG_FOLDER = path.join(app.getPath('userData'), 'config');
const ICONS_FOLDER = path.join(CONFIG_FOLDER, 'icons');
const FAVICONS_FOLDER = path.join(CONFIG_FOLDER, 'favicons');
const SCHEMES_FOLDER = path.join(ICONS_FOLDER, 'schemes');
const BACKUP_FOLDER = path.join(CONFIG_FOLDER, 'backup');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 479,
    height: 506,
    center: true,
    alwaysOnTop: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:9000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }
  
  // デバッグ用：開発者ツールを開く
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.hide();
      }
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '表示',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '終了',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('QuickDashLauncher');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerGlobalShortcut() {
  const ret = globalShortcut.register(HOTKEY, () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('window-shown');
      }
    }
  });

  if (!ret) {
    console.log('ホットキーの登録に失敗しました');
  }
}

function ensureDirectories() {
  const dirs = [CONFIG_FOLDER, ICONS_FOLDER, FAVICONS_FOLDER, SCHEMES_FOLDER, BACKUP_FOLDER];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function createDefaultDataFile() {
  const dataPath = path.join(CONFIG_FOLDER, 'data.txt');
  if (!fs.existsSync(dataPath)) {
    const defaultContent = `// Webサイト
GitHub,https://github.com/
Google マップ,https://www.google.co.jp/maps

// ローカルフォルダ
デスクトップ,shell:Desktop
ダウンロード,shell:Downloads

// アプリケーション
メモ帳,notepad.exe
`;
    fs.writeFileSync(dataPath, defaultContent, 'utf8');
  }
}

function backupDataFiles() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
  const files = ['data.txt', 'data2.txt', 'tempdata.txt'];
  
  files.forEach(file => {
    const sourcePath = path.join(CONFIG_FOLDER, file);
    if (fs.existsSync(sourcePath)) {
      const backupPath = path.join(BACKUP_FOLDER, `${file}.${timestamp}`);
      fs.copyFileSync(sourcePath, backupPath);
    }
  });
}

app.whenReady().then(() => {
  ensureDirectories();
  createDefaultDataFile();
  backupDataFiles();
  
  createWindow();
  createTray();
  registerGlobalShortcut();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Function to scan directory for shortcuts
async function scanDirectoryForShortcuts(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      // Skip directories
      if (fs.statSync(filePath).isDirectory()) {
        continue;
      }
      
      // Process .lnk files (Windows shortcuts)
      if (path.extname(file).toLowerCase() === '.lnk') {
        try {
          const shortcut = await new Promise<any>((resolve, reject) => {
            ws.query(filePath, (err: any, shortcut: any) => {
              if (err) reject(err);
              else resolve(shortcut);
            });
          });
          
          if (shortcut && shortcut.target) {
            const displayName = path.basename(file, '.lnk');
            let line = `${displayName},${shortcut.target}`;
            
            // Add arguments if present
            if (shortcut.args && shortcut.args.trim()) {
              line += `,${shortcut.args}`;
            }
            
            results.push(line);
          }
        } catch (error) {
          console.error(`Error reading shortcut ${filePath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return results;
}

// IPC handlers
ipcMain.handle('get-config-folder', () => CONFIG_FOLDER);

ipcMain.handle('load-data-files', async () => {
  const files: DataFile[] = [];
  const dataFiles = ['data.txt', 'data2.txt', 'tempdata.txt'];
  
  for (const fileName of dataFiles) {
    const filePath = path.join(CONFIG_FOLDER, fileName);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Process dir directives
      const lines = content.split('\n');
      const processedLines: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('dir,')) {
          const dirPath = trimmedLine.substring(4).trim();
          if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
            try {
              const shortcuts = await scanDirectoryForShortcuts(dirPath);
              processedLines.push(...shortcuts);
            } catch (error) {
              console.error(`Error scanning directory ${dirPath}:`, error);
            }
          }
        } else {
          processedLines.push(line);
        }
      }
      
      content = processedLines.join('\n');
      files.push({ name: fileName, content });
    }
  }
  
  return files;
});

ipcMain.handle('save-temp-data', async (_event, content: string) => {
  const tempDataPath = path.join(CONFIG_FOLDER, 'tempdata.txt');
  fs.writeFileSync(tempDataPath, content, 'utf8');
});

ipcMain.handle('open-item', async (_event, item: LauncherItem) => {
  try {
    console.log(`アイテムを起動中: ${item.displayName} (${item.type})`);
    console.log(`パス: ${item.path}`);
    if (item.args) {
      console.log(`引数: ${item.args}`);
    }
    
    if (item.type === 'url') {
      await shell.openExternal(item.path);
    } else if (item.type === 'file' || item.type === 'folder') {
      await shell.openPath(item.path);
    } else if (item.type === 'app') {
      if (item.args) {
        const { spawn } = await import('child_process');
        spawn(item.path, item.args.split(' '), { detached: true });
      } else {
        await shell.openPath(item.path);
      }
    } else if (item.type === 'uri') {
      await shell.openExternal(item.path);
    }
    
    if (mainWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    console.error('アイテムの起動に失敗しました:', error);
    console.error('失敗したアイテム:', {
      displayName: item.displayName,
      type: item.type,
      path: item.path,
      args: item.args || 'なし'
    });
  }
});

ipcMain.handle('open-parent-folder', async (_event, item: LauncherItem) => {
  try {
    if (item.type === 'file' || item.type === 'folder') {
      await shell.showItemInFolder(item.path);
    }
    
    if (mainWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    console.error('親フォルダの表示に失敗しました:', error);
  }
});

ipcMain.handle('open-config-folder', async () => {
  await shell.openPath(CONFIG_FOLDER);
});

ipcMain.handle('open-data-file', async () => {
  const dataPath = path.join(CONFIG_FOLDER, 'data.txt');
  await shell.openPath(dataPath);
});

ipcMain.handle('fetch-favicon', async (_event, url: string) => {
  try {
    const domain = new URL(url).hostname;
    const faviconPath = path.join(FAVICONS_FOLDER, `${domain}_favicon_32.png`);
    
    // Check if favicon is already cached
    if (fs.existsSync(faviconPath)) {
      const cachedFavicon = fs.readFileSync(faviconPath);
      const base64 = cachedFavicon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }
    
    // Fetch new favicon
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    const response = await fetch(faviconUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Save to cache
    fs.writeFileSync(faviconPath, Buffer.from(buffer));
    
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('ファビコンの取得に失敗しました:', error);
    return null;
  }
});

ipcMain.handle('extract-icon', async (_event, filePath: string) => {
  try {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error('ファイルが見つかりません:', filePath);
      return null;
    }
    
    // Generate cache filename
    const iconName = path.basename(filePath, path.extname(filePath)) + '_icon.png';
    const iconPath = path.join(FAVICONS_FOLDER, iconName);
    
    // Check if icon is already cached
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }
    
    // Extract icon
    const iconExtractor = require('@bitdisaster/exe-icon-extractor');
    const iconBuffer = iconExtractor.extractIcon(filePath, 'large');
    
    if (iconBuffer) {
      // Save to cache
      fs.writeFileSync(iconPath, iconBuffer);
      
      // Convert to base64 data URL
      const base64 = iconBuffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    }
    
    return null;
  } catch (error) {
    console.error('アイコンの抽出に失敗しました:', error);
    return null;
  }
});