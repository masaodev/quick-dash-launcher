import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DataFile } from '../../common/types';

const ws = require('windows-shortcuts');

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
          const shortcut = await new Promise<any>((resolve, reject) => {
            ws.query(filePath, (err: any, shortcut: any) => {
              if (err) reject(err);
              else resolve(shortcut);
            });
          });
          
          if (shortcut && shortcut.target) {
            const displayName = path.basename(file, '.lnk');
            let line = `${displayName},${shortcut.target}`;
            
            // 引数が存在する場合は追加
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