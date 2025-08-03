import * as fs from 'fs';
import * as path from 'path';

import { ipcMain } from 'electron';
import { editLogger } from '@common/logger';

import { LauncherItem } from '../../common/types';
import { BackupService } from '../services/backupService.js';

interface UpdateItemRequest {
  sourceFile: 'data.txt' | 'data2.txt';
  lineNumber: number;
  newItem: LauncherItem;
}

interface DeleteItemRequest {
  sourceFile: 'data.txt' | 'data2.txt';
  lineNumber: number;
}

async function createBackup(configFolder: string, fileName: string): Promise<void> {
  const filePath = path.join(configFolder, fileName);
  const backupService = await BackupService.getInstance();
  await backupService.createBackup(filePath);
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
  await createBackup(configFolder, sourceFile);

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

export async function deleteItems(
  configFolder: string,
  requests: DeleteItemRequest[]
): Promise<void> {
  // Group requests by source file
  const fileGroups = new Map<string, DeleteItemRequest[]>();
  requests.forEach((request) => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    fileGroups.get(request.sourceFile)!.push(request);
  });

  // Process each file
  for (const [sourceFile, fileRequests] of fileGroups) {
    const filePath = path.join(configFolder, sourceFile);

    if (!fs.existsSync(filePath)) {
      editLogger.warn('ファイルが存在しません、スキップします', { sourceFile });
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

export async function batchUpdateItems(
  configFolder: string,
  requests: UpdateItemRequest[]
): Promise<void> {
  // Group requests by source file
  const fileGroups = new Map<string, UpdateItemRequest[]>();
  requests.forEach((request) => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    fileGroups.get(request.sourceFile)!.push(request);
  });

  // Process each file
  for (const [sourceFile, fileRequests] of fileGroups) {
    const filePath = path.join(configFolder, sourceFile);

    if (!fs.existsSync(filePath)) {
      editLogger.warn('ファイルが存在しません、スキップします', { sourceFile });
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
      editLogger.error('アイテムの更新に失敗', { error });
      throw error;
    }
  });

  ipcMain.handle('delete-items', async (_event, requests: DeleteItemRequest[]) => {
    try {
      await deleteItems(configFolder, requests);
      return { success: true };
    } catch (error) {
      editLogger.error('アイテムの削除に失敗', { error });
      throw error;
    }
  });

  ipcMain.handle('batch-update-items', async (_event, requests: UpdateItemRequest[]) => {
    try {
      await batchUpdateItems(configFolder, requests);
      return { success: true };
    } catch (error) {
      editLogger.error('アイテムの一括更新に失敗', { error });
      throw error;
    }
  });
}
