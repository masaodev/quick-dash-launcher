import { ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DataFile } from '../../common/types';

function processShortcutToCSV(filePath: string): string | null {
  try {
    // Electron のネイティブ機能を使用してショートカットを読み取り
    const shortcutDetails = shell.readShortcutLink(filePath);
    
    if (shortcutDetails && shortcutDetails.target) {
      const displayName = path.basename(filePath, '.lnk');
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
    console.error(`Error reading shortcut ${filePath}:`, error);
  }
  
  return null;
}

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
        const processedShortcut = processShortcutToCSV(filePath);
        if (processedShortcut) {
          results.push(processedShortcut);
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

interface RegisterItem {
  name: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  args?: string;
  targetTab: 'main' | 'temp';
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
}

async function registerItems(configFolder: string, items: RegisterItem[]): Promise<void> {
  // Group items by target tab
  const mainItems = items.filter(item => item.targetTab === 'main');
  const tempItems = items.filter(item => item.targetTab === 'temp');
  
  // Process main items
  if (mainItems.length > 0) {
    const dataPath = path.join(configFolder, 'data.txt');
    let existingContent = '';
    
    if (fs.existsSync(dataPath)) {
      existingContent = fs.readFileSync(dataPath, 'utf8');
    }
    
    const newLines = mainItems.map(item => {
      if (item.type === 'folder' && item.folderProcessing === 'expand') {
        return `dir,${item.path}`;
      } else {
        let line = `${item.name},${item.path}`;
        if (item.args) {
          line += `,${item.args}`;
        }
        return line;
      }
    });
    
    const updatedContent = existingContent ? existingContent.trim() + '\n' + newLines.join('\n') : newLines.join('\n');
    fs.writeFileSync(dataPath, updatedContent.trim(), 'utf8');
  }
  
  // Process temp items
  if (tempItems.length > 0) {
    const tempDataPath = path.join(configFolder, 'tempdata.txt');
    let existingContent = '';
    
    if (fs.existsSync(tempDataPath)) {
      existingContent = fs.readFileSync(tempDataPath, 'utf8');
    }
    
    const newLines = tempItems.map(item => {
      if (item.type === 'folder' && item.folderProcessing === 'expand') {
        return `dir,${item.path}`;
      } else {
        let line = `${item.name},${item.path}`;
        if (item.args) {
          line += `,${item.args}`;
        }
        return line;
      }
    });
    
    const updatedContent = existingContent ? existingContent.trim() + '\n' + newLines.join('\n') : newLines.join('\n');
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
      const lines = content.split('\n');
      
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
        .filter(line => line.trim() !== '')
        .join('\n');
      
      // Write sorted content back to file
      fs.writeFileSync(filePath, sortedContent, 'utf8');
      
      console.log(`Sorted ${fileName} successfully. Backup saved to ${backupPath}`);
    } catch (error) {
      console.error(`Error sorting ${fileName}:`, error);
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
}