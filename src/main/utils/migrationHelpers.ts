/**
 * データファイル移行ヘルパー
 *
 * アプリケーション起動時にデータファイルの形式を最新版に移行します。
 */

import * as fs from 'fs';
import * as path from 'path';

import { dataLogger } from '@common/logger';
import { migrateDataFileContent } from '@common/utils/windowOperationMigration';

import PathManager from '../config/pathManager.js';

/**
 * Windows操作アイテムのCSV形式からJSON形式への移行を実行
 *
 * すべてのデータファイル（data.txt, data2.txt, ...）を読み込んで、
 * 古いCSV形式のwindowディレクティブをJSON形式に変換します。
 */
export function migrateWindowOperationFormat(): void {
  try {
    const configFolder = PathManager.getConfigFolder();
    const dataFiles = PathManager.getDataFiles();

    let totalMigrated = 0;

    for (const fileName of dataFiles) {
      const filePath = path.join(configFolder, fileName);

      // ファイルが存在しない場合はスキップ
      if (!fs.existsSync(filePath)) {
        continue;
      }

      // ファイルを読み込む
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // 移行処理を実行
      const result = migrateDataFileContent(fileContent);

      // 変更があった場合のみファイルを更新
      if (result.migrated) {
        fs.writeFileSync(filePath, result.content, 'utf-8');
        totalMigrated++;
        dataLogger.info({ fileName }, 'Windows操作アイテムをJSON形式に移行しました');
      }
    }

    if (totalMigrated > 0) {
      dataLogger.info(
        { totalMigrated },
        `${totalMigrated}個のデータファイルでWindows操作アイテムをJSON形式に移行しました`
      );
    }
  } catch (error) {
    dataLogger.error({ error }, 'Windows操作アイテムの移行処理でエラーが発生しました');
  }
}
