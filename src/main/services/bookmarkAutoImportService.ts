/**
 * ブックマーク自動取込サービス
 *
 * 事前登録されたルールに基づいてブラウザのブックマークを
 * データファイルに自動インポートする
 *
 * 同期方式: 該当ルールのアイテムを全削除→一括再登録
 */

import * as path from 'path';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { generateId, parseJsonDataFile, serializeJsonDataFile } from '@common/utils/jsonParser';
import { summarizeImportResults } from '@common/utils/bookmarkImportUtils';
import type { JsonLauncherItem, JsonDataFile } from '@common/types';
import type {
  BookmarkAutoImportRule,
  BookmarkAutoImportResult,
  BookmarkAutoImportSettings,
  BookmarkWithFolder,
} from '@common/types/bookmarkAutoImport';

import PathManager from '../config/pathManager.js';
import {
  detectInstalledBrowsers,
  parseBrowserBookmarksWithFolders,
} from '../ipc/bookmarkHandlers.js';
import { notifyDataChanged } from '../ipc/dataHandlers.js';

import { SettingsService } from './settingsService.js';
import { BackupService } from './backupService.js';
import { showToastWindow } from './toastWindowService.js';

/**
 * ブックマーク自動取込サービス
 */
export class BookmarkAutoImportService {
  /**
   * 起動時の自動実行
   */
  async executeOnStartup(): Promise<void> {
    try {
      const settingsService = await SettingsService.getInstance();
      const settings = await settingsService.get('bookmarkAutoImport');

      if (!settings?.autoRunOnStartup) {
        logger.info('ブックマーク自動取込: 起動時実行は無効です');
        return;
      }

      const enabledRules = settings.rules.filter((r) => r.enabled);
      if (enabledRules.length === 0) {
        logger.info('ブックマーク自動取込: 有効なルールがありません');
        return;
      }

      logger.info(
        { ruleCount: enabledRules.length },
        'ブックマーク自動取込: 起動時実行を開始します'
      );

      const results = await this.executeRules(enabledRules);
      const { totalImported, totalDeleted, hasError } = summarizeImportResults(results);

      // トースト通知
      if (totalImported > 0 || totalDeleted > 0) {
        await showToastWindow({
          itemType: 'bookmarkImport',
          displayName: 'ブックマーク取込',
          message: `${totalImported}件登録${totalDeleted > 0 ? `, ${totalDeleted}件削除` : ''}${hasError ? ' (一部エラーあり)' : ''}`,
          duration: 3000,
        });
      }

      logger.info(
        { totalImported, totalDeleted, hasError },
        'ブックマーク自動取込: 起動時実行が完了しました'
      );
    } catch (error) {
      logger.error({ error }, 'ブックマーク自動取込: 起動時実行でエラーが発生しました');
    }
  }

  /**
   * 全ルールを実行
   */
  async executeAllRules(): Promise<BookmarkAutoImportResult[]> {
    const settingsService = await SettingsService.getInstance();
    const settings = await settingsService.get('bookmarkAutoImport');
    const enabledRules = settings?.rules?.filter((r) => r.enabled) ?? [];

    if (enabledRules.length === 0) {
      return [];
    }

    return this.executeRules(enabledRules);
  }

  /**
   * 単一ルールを実行
   */
  async executeRule(rule: BookmarkAutoImportRule): Promise<BookmarkAutoImportResult> {
    const startTime = Date.now();

    try {
      // ブラウザの検出
      const browsers = await detectInstalledBrowsers();
      const browser = browsers.find((b) => b.id === rule.browserId);

      if (!browser || !browser.installed) {
        return {
          success: false,
          importedCount: 0,
          deletedCount: 0,
          errorMessage: `ブラウザ ${rule.browserId} が見つかりません`,
          executedAt: startTime,
        };
      }

      // 対象プロファイルの決定
      const targetProfiles =
        rule.profileIds.length === 0
          ? browser.profiles
          : browser.profiles.filter((p) => rule.profileIds.includes(p.id));

      if (targetProfiles.length === 0) {
        return {
          success: false,
          importedCount: 0,
          deletedCount: 0,
          errorMessage: 'ブックマークが見つかりません（プロファイルなし）',
          executedAt: startTime,
        };
      }

      // 全プロファイルからブックマークを収集
      let allBookmarks: BookmarkWithFolder[] = [];
      for (const profile of targetProfiles) {
        try {
          const bookmarks = await parseBrowserBookmarksWithFolders(profile.bookmarkPath);
          allBookmarks.push(...bookmarks);
        } catch (error) {
          logger.warn(
            { error, profileId: profile.id },
            'ブックマークの読み込みに失敗しました（スキップ）'
          );
        }
      }

      // フィルタ適用
      allBookmarks = this.applyFilters(allBookmarks, rule);

      // データファイルの読み込み・更新
      const configFolder = PathManager.getConfigFolder();
      const dataFilePath = path.join(configFolder, rule.targetFile);

      // バックアップ
      if (FileUtils.exists(dataFilePath)) {
        const backupService = await BackupService.getInstance();
        await backupService.createBackup(dataFilePath);
      }

      // データファイルの読み込み
      let jsonData: JsonDataFile = { version: '1.0', items: [] };
      const existingContent = FileUtils.safeReadTextFile(dataFilePath);
      if (existingContent) {
        try {
          jsonData = parseJsonDataFile(existingContent);
        } catch {
          logger.warn({ dataFilePath }, 'JSONファイルのパースに失敗、新規作成します');
        }
      }

      // autoImportRuleId === rule.id のアイテムを全削除
      const beforeCount = jsonData.items.length;
      jsonData.items = jsonData.items.filter((item) => {
        if (item.type !== 'item') return true;
        return (item as JsonLauncherItem).autoImportRuleId !== rule.id;
      });
      const deletedCount = beforeCount - jsonData.items.length;

      // 新しいアイテムを作成して追加
      const now = Date.now();
      for (const bookmark of allBookmarks) {
        const displayName = this.buildDisplayName(bookmark, rule);
        const newItem: JsonLauncherItem = {
          id: generateId(),
          type: 'item',
          displayName,
          path: bookmark.url,
          autoImportRuleId: rule.id,
          updatedAt: now,
        };
        jsonData.items.push(newItem);
      }

      // データファイルの保存
      const content = serializeJsonDataFile(jsonData);
      FileUtils.safeWriteTextFile(dataFilePath, content);

      // UI更新通知
      notifyDataChanged();

      const result: BookmarkAutoImportResult = {
        success: true,
        importedCount: allBookmarks.length,
        deletedCount,
        executedAt: startTime,
      };

      // ルールの実行結果を更新
      await this.updateRuleResult(rule.id, result);

      logger.info(
        { ruleId: rule.id, ruleName: rule.name, importedCount: allBookmarks.length, deletedCount },
        'ブックマーク自動取込: ルール実行完了'
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'ブックマーク自動取込でエラーが発生しました';
      logger.error({ error, ruleId: rule.id }, 'ブックマーク自動取込: ルール実行エラー');

      const result: BookmarkAutoImportResult = {
        success: false,
        importedCount: 0,
        deletedCount: 0,
        errorMessage,
        executedAt: startTime,
      };

      await this.updateRuleResult(rule.id, result);
      return result;
    }
  }

  /**
   * ルールのプレビュー（マッチするブックマーク一覧を返す）
   */
  async previewRule(rule: BookmarkAutoImportRule): Promise<BookmarkWithFolder[]> {
    const browsers = await detectInstalledBrowsers();
    const browser = browsers.find((b) => b.id === rule.browserId);

    if (!browser || !browser.installed) {
      return [];
    }

    const targetProfiles =
      rule.profileIds.length === 0
        ? browser.profiles
        : browser.profiles.filter((p) => rule.profileIds.includes(p.id));

    let allBookmarks: BookmarkWithFolder[] = [];
    for (const profile of targetProfiles) {
      try {
        const bookmarks = await parseBrowserBookmarksWithFolders(profile.bookmarkPath);
        allBookmarks.push(...bookmarks);
      } catch {
        // スキップ
      }
    }

    const filtered = this.applyFilters(allBookmarks, rule);

    // プレビューでもdisplayName変換を適用
    return filtered.map((bookmark) => ({
      ...bookmark,
      displayName: this.buildDisplayName(bookmark, rule),
    }));
  }

  /**
   * フィルタの適用
   */
  private applyFilters(
    bookmarks: BookmarkWithFolder[],
    rule: BookmarkAutoImportRule
  ): BookmarkWithFolder[] {
    let filtered = bookmarks;

    // フォルダフィルタ
    if (rule.folderPaths.length > 0) {
      const matchesFolder = (folderPath: string, filterPath: string): boolean => {
        if (rule.includeSubfolders) {
          return folderPath === filterPath || folderPath.startsWith(filterPath + '/');
        }
        return folderPath === filterPath;
      };

      if (rule.folderFilterMode === 'include') {
        filtered = filtered.filter((b) =>
          rule.folderPaths.some((fp) => matchesFolder(b.folderPath, fp))
        );
      } else {
        filtered = filtered.filter(
          (b) => !rule.folderPaths.some((fp) => matchesFolder(b.folderPath, fp))
        );
      }
    }

    // URLパターンフィルタ
    if (rule.urlPattern) {
      try {
        const urlRegex = new RegExp(rule.urlPattern, 'i');
        filtered = filtered.filter((b) => urlRegex.test(b.url));
      } catch {
        logger.warn({ urlPattern: rule.urlPattern }, '無効なURLパターンです');
      }
    }

    // 名前パターンフィルタ
    if (rule.namePattern) {
      try {
        const nameRegex = new RegExp(rule.namePattern, 'i');
        filtered = filtered.filter((b) => nameRegex.test(b.displayName));
      } catch {
        logger.warn({ namePattern: rule.namePattern }, '無効な名前パターンです');
      }
    }

    return filtered;
  }

  /**
   * 複数ルールを順次実行
   */
  private async executeRules(rules: BookmarkAutoImportRule[]): Promise<BookmarkAutoImportResult[]> {
    const results: BookmarkAutoImportResult[] = [];

    for (const rule of rules) {
      const result = await this.executeRule(rule);
      results.push(result);
    }

    return results;
  }

  /**
   * ブックマークのdisplayNameを生成（フォルダ名付与・接頭辞・接尾辞）
   */
  private buildDisplayName(bookmark: BookmarkWithFolder, rule: BookmarkAutoImportRule): string {
    let name = bookmark.displayName;

    // フォルダ名付与
    if (rule.folderNameMode !== 'none' && bookmark.folderPath) {
      let folderLabel = '';
      switch (rule.folderNameMode) {
        case 'parent':
          folderLabel = bookmark.folderPath.split('/').pop() || '';
          break;
        case 'fullPath':
          folderLabel = bookmark.folderPath;
          break;
        case 'relativePath': {
          const parts = bookmark.folderPath.split('/');
          folderLabel = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
          break;
        }
      }
      if (folderLabel) {
        name = `[${folderLabel}] ${name}`;
      }
    }

    // 接頭辞・接尾辞
    if (rule.prefix) name = rule.prefix + name;
    if (rule.suffix) name = name + rule.suffix;

    return name;
  }

  /**
   * ルールの実行結果をsettings.jsonに反映
   */
  private async updateRuleResult(ruleId: string, result: BookmarkAutoImportResult): Promise<void> {
    try {
      const settingsService = await SettingsService.getInstance();
      const settings = (await settingsService.get(
        'bookmarkAutoImport'
      )) as BookmarkAutoImportSettings;

      if (!settings?.rules) return;

      const ruleIndex = settings.rules.findIndex((r) => r.id === ruleId);
      if (ruleIndex === -1) return;

      settings.rules[ruleIndex].lastExecutedAt = result.executedAt;
      settings.rules[ruleIndex].lastResult = result;

      await settingsService.set('bookmarkAutoImport', settings);
    } catch (error) {
      logger.warn({ error, ruleId }, 'ルール実行結果の保存に失敗しました');
    }
  }
}
