import { ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DataFile } from '../../common/types';

async function scanDirectoryForShortcuts(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      // ディレクトリはスキップ
      if (fs.statSync(filePath).isDirectory()) {
        continue;
      }
      
      // .lnkファイル（Windowsショートカット）を処理
      if (path.extname(file).toLowerCase() === '.lnk') {
        try {
          // Electron のネイティブ機能を使用してショートカットを読み取り
          const shortcutDetails = shell.readShortcutLink(filePath);
          
          if (shortcutDetails && shortcutDetails.target) {
            const displayName = path.basename(file, '.lnk');
            let line = `${displayName},${shortcutDetails.target}`;
            
            // 引数が存在する場合は追加
            if (shortcutDetails.args && shortcutDetails.args.trim()) {
              line += `,${shortcutDetails.args}`;
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

async function loadDataFiles(configFolder: string): Promise<DataFile[]> {
  const files: DataFile[] = [];
  const dataFiles = ['data.txt', 'data2.txt', 'tempdata.txt'];
  
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // dirディレクティブを処理
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
}

async function saveTempData(configFolder: string, content: string): Promise<void> {
  const tempDataPath = path.join(configFolder, 'tempdata.txt');
  fs.writeFileSync(tempDataPath, content, 'utf8');
}

export function setupDataHandlers(configFolder: string) {
  ipcMain.handle('get-config-folder', () => configFolder);
  
  ipcMain.handle('load-data-files', async () => {
    return await loadDataFiles(configFolder);
  });
  
  ipcMain.handle('save-temp-data', async (_event, content: string) => {
    return await saveTempData(configFolder, content);
  });
}