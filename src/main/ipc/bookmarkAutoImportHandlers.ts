/**
 * ブックマーク自動取込のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type {
  BookmarkAutoImportRule,
  BookmarkAutoImportSettings,
  BookmarkFolder,
  BookmarkWithFolder,
  BookmarkAutoImportResult,
} from '@common/types/bookmarkAutoImport';

import { SettingsService } from '../services/settingsService.js';
import { BookmarkAutoImportService } from '../services/bookmarkAutoImportService.js';

import {
  parseBrowserBookmarkFolders,
  parseBrowserBookmarksWithFolders,
} from './bookmarkHandlers.js';

const autoImportService = new BookmarkAutoImportService();

/**
 * ブックマーク自動取込のIPCハンドラーを登録する
 */
export function setupBookmarkAutoImportHandlers(): void {
  // 設定の取得
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_SETTINGS,
    async (): Promise<BookmarkAutoImportSettings> => {
      const settingsService = await SettingsService.getInstance();
      return await settingsService.get('bookmarkAutoImport');
    }
  );

  // 設定の保存
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_SAVE_SETTINGS,
    async (_event, settings: BookmarkAutoImportSettings): Promise<void> => {
      const settingsService = await SettingsService.getInstance();
      await settingsService.set('bookmarkAutoImport', settings);
    }
  );

  // 単一ルールの実行
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_RULE,
    async (_event, rule: BookmarkAutoImportRule): Promise<BookmarkAutoImportResult> => {
      return await autoImportService.executeRule(rule);
    }
  );

  // 全ルールの実行
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_ALL,
    async (): Promise<BookmarkAutoImportResult[]> => {
      return await autoImportService.executeAllRules();
    }
  );

  // ルールのプレビュー
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_PREVIEW_RULE,
    async (_event, rule: BookmarkAutoImportRule): Promise<BookmarkWithFolder[]> => {
      return await autoImportService.previewRule(rule);
    }
  );

  // ルールに紐づくアイテムの削除
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_DELETE_RULE_ITEMS,
    async (_event, ruleId: string, targetFile: string): Promise<number> => {
      return await autoImportService.deleteItemsByRuleId(ruleId, targetFile);
    }
  );

  // フォルダ構造の取得
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_FOLDERS,
    async (_event, bookmarkPath: string): Promise<BookmarkFolder[]> => {
      return await parseBrowserBookmarkFolders(bookmarkPath);
    }
  );

  // フォルダパス付きブックマーク一覧の取得
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_BOOKMARKS_WITH_FOLDERS,
    async (_event, bookmarkPath: string): Promise<BookmarkWithFolder[]> => {
      return await parseBrowserBookmarksWithFolders(bookmarkPath);
    }
  );
}
