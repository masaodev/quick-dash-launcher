import * as fs from 'fs';
import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { isValidDataFileName } from '@common/utils/dataFileName';
import { serializeJsonDataFile, createEmptyJsonDataFile } from '@common/utils/jsonParser';
import { DEFAULT_DATA_FILE } from '@common/types';

import { SettingsService } from '../settingsService.js';
import { clipboardDataRefsInFile, releaseClipboardData } from '../clipboardDataUsage.js';
import { forgetDataFile, writeDataFile } from '../dataFileTracker.js';
import { mainI18n } from '../mainI18n.js';
import { notifyDataChanged } from '../../ipc/notifications.js';

/**
 * データファイルそのものの作成・削除（アイテム管理のタブ構成の操作と CLI の launcher tab が使う）
 */

export interface CreateDataFileResult {
  success: boolean;
  error?: string;
  alreadyExists?: boolean;
}

export interface DeleteDataFileResult {
  success: boolean;
  error?: string;
  /** 取り込み先が消えたので無効にした自動取込ルールの名前 */
  disabledRules?: string[];
}

/** 空のデータファイルを作る。既にあれば作らない */
export function createDataFile(configFolder: string, fileName: string): CreateDataFileResult {
  if (!isValidDataFileName(fileName)) {
    dataLogger.warn({ fileName }, 'データファイル名が不正なため作成しません');
    return { success: false, error: mainI18n.t('dataFile.invalidName') };
  }

  const filePath = path.join(configFolder, fileName);
  dataLogger.info(`create-data-file called: ${fileName} at ${filePath}`);

  if (FileUtils.exists(filePath)) {
    dataLogger.warn(`File already exists: ${filePath}`);
    return { success: false, error: mainI18n.t('dataFile.alreadyExists'), alreadyExists: true };
  }

  try {
    const emptyData = serializeJsonDataFile(createEmptyJsonDataFile());
    writeDataFile(filePath, emptyData);
    dataLogger.info(`File created successfully: ${filePath}`);
    // 編集画面は読み込み時のハッシュ表を持つので、ファイル構成の変化も知らせる
    notifyDataChanged();
    return { success: true };
  } catch (error) {
    dataLogger.error({ error, filePath }, 'Failed to create file');
    return {
      success: false,
      error: mainI18n.t('dataFile.createFailed', { error: String(error) }),
    };
  }
}

/** データファイルを消す（メインのデータファイルは消さない）。取り込み先にしていた自動取込ルールは無効にする */
export async function deleteDataFile(
  configFolder: string,
  fileName: string
): Promise<DeleteDataFileResult> {
  if (fileName === DEFAULT_DATA_FILE) {
    return { success: false, error: mainI18n.t('dataFile.cannotDeleteMain') };
  }
  if (!isValidDataFileName(fileName)) {
    dataLogger.warn({ fileName }, 'データファイル名が不正なため削除しません');
    return { success: false, error: mainI18n.t('dataFile.invalidName') };
  }

  const filePath = path.join(configFolder, fileName);

  try {
    const dataRefs = clipboardDataRefsInFile(filePath);
    await fs.promises.unlink(filePath);
    forgetDataFile(fileName);
    releaseClipboardData(configFolder, dataRefs);

    // 削除されたファイルを targetFile に持つ自動取込ルールを無効化
    const settingsService = await SettingsService.getInstance();
    const autoImportSettings = await settingsService.get('bookmarkAutoImport');
    const rulesToDisable =
      autoImportSettings?.rules?.filter((r) => r.targetFile === fileName && r.enabled) ?? [];

    if (rulesToDisable.length > 0) {
      for (const rule of rulesToDisable) {
        rule.enabled = false;
      }
      await settingsService.set('bookmarkAutoImport', autoImportSettings);
      dataLogger.info(
        { disabledRules: rulesToDisable.map((r) => r.name), fileName },
        'データファイル削除に伴い自動取込ルールを無効化しました'
      );
    }

    notifyDataChanged();
    return { success: true, disabledRules: rulesToDisable.map((r) => r.name) };
  } catch (error) {
    return {
      success: false,
      error: mainI18n.t('dataFile.deleteFailed', { error: String(error) }),
    };
  }
}
