import * as fs from 'fs';
import * as path from 'path';

import { editLogger } from '@common/logger';

import { LauncherItem } from '../../common/types';
import { createSafeIpcHandler } from '../utils/ipcWrapper';
import { BackupService } from '../services/backupService.js';

import { notifyDataChanged } from './dataHandlers.js';

interface UpdateItemRequest {
  sourceFile: string;
  lineNumber: number;
  newItem: LauncherItem;
}

interface DeleteItemRequest {
  sourceFile: string;
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

  // 引数フィールドを追加
  if (item.args && item.args.trim()) {
    csvLine += `,${escapeCSV(item.args)}`;
  } else {
    csvLine += ',';
  }

  // カスタムアイコンフィールドを追加
  if (item.customIcon && item.customIcon.trim()) {
    csvLine += `,${escapeCSV(item.customIcon)}`;
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
  const lines = content.split(/\r\n|\n|\r/);

  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new Error(`Invalid line number: ${lineNumber}`);
  }

  // Update the specific line
  lines[lineNumber - 1] = formatItemToCSV(newItem);

  // Write back to file
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
}

export async function updateRawLine(
  configFolder: string,
  request: { sourceFile: string; lineNumber: number; newContent: string }
): Promise<void> {
  const { sourceFile, lineNumber, newContent } = request;
  const filePath = path.join(configFolder, sourceFile);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${sourceFile} does not exist`);
  }

  // Create backup
  await createBackup(configFolder, sourceFile);

  // Read file contents
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r\n|\n|\r/);

  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new Error(`Invalid line number: ${lineNumber}`);
  }

  // Update the specific line with raw content
  lines[lineNumber - 1] = newContent;

  // Write back to file
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
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
    const group = fileGroups.get(request.sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${request.sourceFile}`);
    }
    group.push(request);
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
    const lines = content.split(/\r\n|\n|\r/);

    // Sort line numbers in descending order to avoid index shifting issues
    const sortedRequests = fileRequests.sort((a, b) => b.lineNumber - a.lineNumber);

    // Remove lines
    for (const request of sortedRequests) {
      if (request.lineNumber >= 1 && request.lineNumber <= lines.length) {
        lines.splice(request.lineNumber - 1, 1);
      }
    }

    // Write back to file
    fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
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
    const group = fileGroups.get(request.sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${request.sourceFile}`);
    }
    group.push(request);
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
    const lines = content.split(/\r\n|\n|\r/);

    // Apply all updates for this file
    for (const request of fileRequests) {
      if (request.lineNumber >= 1 && request.lineNumber <= lines.length) {
        lines[request.lineNumber - 1] = formatItemToCSV(request.newItem);
      }
    }

    // Write back to file
    fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
  }
}

// Register IPC handlers
export function registerEditHandlers(configFolder: string): void {
  createSafeIpcHandler(
    'update-item',
    async (request: UpdateItemRequest) => {
      await updateItem(configFolder, request);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの更新'
  );

  createSafeIpcHandler(
    'update-raw-line',
    async (request: { sourceFile: string; lineNumber: number; newContent: string }) => {
      await updateRawLine(configFolder, request);
      notifyDataChanged();
      return { success: true };
    },
    '生データ行の更新'
  );

  createSafeIpcHandler(
    'delete-items',
    async (requests: DeleteItemRequest[]) => {
      await deleteItems(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの削除'
  );

  createSafeIpcHandler(
    'batch-update-items',
    async (requests: UpdateItemRequest[]) => {
      await batchUpdateItems(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの一括更新'
  );
}
