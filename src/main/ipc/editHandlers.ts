import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { LauncherItem } from '../../common/types';

interface UpdateItemRequest {
  sourceFile: 'data.txt' | 'data2.txt' | 'tempdata.txt';
  lineNumber: number;
  newItem: LauncherItem;
}

interface DeleteItemRequest {
  sourceFile: 'data.txt' | 'data2.txt' | 'tempdata.txt';
  lineNumber: number;
}

function createBackup(configFolder: string, fileName: string): void {
  const filePath = path.join(configFolder, fileName);
  const backupFolder = path.join(configFolder, 'backup');
  
  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }
  
  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${path.parse(fileName).name}_${timestamp}${path.parse(fileName).ext}`;
    const backupPath = path.join(backupFolder, backupFileName);
    fs.copyFileSync(filePath, backupPath);
  }
}

function formatItemToCSV(item: LauncherItem): string {
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  let csvLine = `${escapeCSV(item.name)},${escapeCSV(item.path)}`;
  
  if (item.args && item.args.trim()) {
    csvLine += `,${escapeCSV(item.args)}`;
  } else {
    csvLine += ',';
  }
  
  if (item.originalPath && item.originalPath.trim()) {
    csvLine += `,${escapeCSV(item.originalPath)}`;
  }
  
  return csvLine;
}

export async function updateItem(configFolder: string, request: UpdateItemRequest): Promise<void> {
  const { sourceFile, lineNumber, newItem } = request;
  const filePath = path.join(configFolder, sourceFile);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${sourceFile} does not exist`);
  }
  
  // Create backup
  createBackup(configFolder, sourceFile);
  
  // Read file contents
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new Error(`Invalid line number: ${lineNumber}`);
  }
  
  // Update the specific line
  lines[lineNumber - 1] = formatItemToCSV(newItem);
  
  // Write back to file
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

export async function deleteItems(configFolder: string, requests: DeleteItemRequest[]): Promise<void> {
  // Group requests by source file
  const fileGroups = new Map<string, DeleteItemRequest[]>();
  requests.forEach(request => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    fileGroups.get(request.sourceFile)!.push(request);
  });
  
  // Process each file
  for (const [sourceFile, fileRequests] of fileGroups) {
    const filePath = path.join(configFolder, sourceFile);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${sourceFile} does not exist, skipping`);
      continue;
    }
    
    // Create backup
    createBackup(configFolder, sourceFile);
    
    // Read file contents
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Sort line numbers in descending order to avoid index shifting issues
    const sortedRequests = fileRequests.sort((a, b) => b.lineNumber - a.lineNumber);
    
    // Remove lines
    for (const request of sortedRequests) {
      if (request.lineNumber >= 1 && request.lineNumber <= lines.length) {
        lines.splice(request.lineNumber - 1, 1);
      }
    }
    
    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  }
}

export async function batchUpdateItems(configFolder: string, requests: UpdateItemRequest[]): Promise<void> {
  // Group requests by source file
  const fileGroups = new Map<string, UpdateItemRequest[]>();
  requests.forEach(request => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    fileGroups.get(request.sourceFile)!.push(request);
  });
  
  // Process each file
  for (const [sourceFile, fileRequests] of fileGroups) {
    const filePath = path.join(configFolder, sourceFile);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${sourceFile} does not exist, skipping`);
      continue;
    }
    
    // Create backup
    createBackup(configFolder, sourceFile);
    
    // Read file contents
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Apply all updates for this file
    for (const request of fileRequests) {
      if (request.lineNumber >= 1 && request.lineNumber <= lines.length) {
        lines[request.lineNumber - 1] = formatItemToCSV(request.newItem);
      }
    }
    
    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  }
}

// Register IPC handlers
export function registerEditHandlers(configFolder: string): void {
  ipcMain.handle('update-item', async (_event, request: UpdateItemRequest) => {
    try {
      await updateItem(configFolder, request);
      return { success: true };
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  });
  
  ipcMain.handle('delete-items', async (_event, requests: DeleteItemRequest[]) => {
    try {
      await deleteItems(configFolder, requests);
      return { success: true };
    } catch (error) {
      console.error('Error deleting items:', error);
      throw error;
    }
  });
  
  ipcMain.handle('batch-update-items', async (_event, requests: UpdateItemRequest[]) => {
    try {
      await batchUpdateItems(configFolder, requests);
      return { success: true };
    } catch (error) {
      console.error('Error batch updating items:', error);
      throw error;
    }
  });
}