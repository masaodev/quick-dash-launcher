/**
 * データファイルマイグレーションサービス
 *
 * CSV形式（data*.txt）からJSON形式（data*.json）への自動マイグレーションを行う
 */

import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  convertCsvToJsonDataFileWithSkip,
  convertCsvFileNameToJson,
} from '@common/utils/csvToJsonMigration';
import { serializeJsonDataFile } from '@common/utils/jsonParser';

import { PathManager } from '../config/pathManager.js';
import { SettingsService } from './settingsService.js';

/**
 * マイグレーション結果
 */
export interface MigrationResult {
  /** マイグレーションが実行されたか */
  migrated: boolean;
  /** 変換されたファイルのリスト */
  convertedFiles: string[];
  /** バックアップに移動されたファイルのリスト */
  backedUpFiles: string[];
  /** スキップされた行の情報 */
  skippedLines: Array<{
    file: string;
    lineNumber: number;
    content: string;
    error: string;
  }>;
  /** エラーが発生したファイル */
  errorFiles: Array<{
    file: string;
    error: string;
  }>;
}

/**
 * CSV→JSONマイグレーションを実行するサービス
 */
export class MigrationService {
  private static instance: MigrationService;
  private configFolder: string;

  private constructor() {
    this.configFolder = PathManager.getConfigFolder();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * マイグレーションが必要かどうかをチェック
   *
   * CSV形式のデータファイルが存在する場合にtrueを返す
   */
  public needsMigration(): boolean {
    return PathManager.hasCsvDataFiles();
  }

  /**
   * CSV→JSONマイグレーションを実行
   *
   * @returns マイグレーション結果
   */
  public async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      migrated: false,
      convertedFiles: [],
      backedUpFiles: [],
      skippedLines: [],
      errorFiles: [],
    };

    if (!this.needsMigration()) {
      logger.info('マイグレーション不要: CSV形式のデータファイルが見つかりません');
      return result;
    }

    logger.info('CSV→JSONマイグレーションを開始します');

    const csvFiles = PathManager.getCsvDataFiles();
    const backupFolder = PathManager.getBackupFolder();

    // バックアップフォルダが存在することを確認
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    // マイグレーション用のサブフォルダを作成（日時付き）
    const migrationTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const migrationBackupFolder = path.join(backupFolder, `migration-${migrationTimestamp}`);
    fs.mkdirSync(migrationBackupFolder, { recursive: true });

    for (const csvFileName of csvFiles) {
      try {
        await this.migrateFile(csvFileName, migrationBackupFolder, result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errorFiles.push({ file: csvFileName, error: errorMessage });
        logger.error({ error, csvFileName }, 'ファイルのマイグレーションに失敗しました');
      }
    }

    // settings.jsonを更新
    if (result.convertedFiles.length > 0) {
      await this.updateSettings(result.convertedFiles);
      result.migrated = true;
    }

    logger.info(
      {
        convertedCount: result.convertedFiles.length,
        backedUpCount: result.backedUpFiles.length,
        skippedLineCount: result.skippedLines.length,
        errorFileCount: result.errorFiles.length,
      },
      'CSV→JSONマイグレーションが完了しました'
    );

    return result;
  }

  /**
   * 単一のCSVファイルをJSONに変換
   */
  private async migrateFile(
    csvFileName: string,
    migrationBackupFolder: string,
    result: MigrationResult
  ): Promise<void> {
    const csvFilePath = path.join(this.configFolder, csvFileName);
    const jsonFileName = convertCsvFileNameToJson(csvFileName);
    const jsonFilePath = path.join(this.configFolder, jsonFileName);

    // JSONファイルが既に存在する場合はスキップ
    if (fs.existsSync(jsonFilePath)) {
      logger.warn(
        { csvFileName, jsonFileName },
        'JSONファイルが既に存在するためスキップします'
      );
      return;
    }

    // CSVファイルを読み込み
    const csvContent = FileUtils.safeReadTextFile(csvFilePath);
    if (csvContent === null) {
      throw new Error(`CSVファイルの読み込みに失敗しました: ${csvFilePath}`);
    }

    // JSON形式に変換
    const { data, skippedLines } = convertCsvToJsonDataFileWithSkip(csvContent);

    // スキップされた行を記録
    for (const skipped of skippedLines) {
      result.skippedLines.push({
        file: csvFileName,
        lineNumber: skipped.lineNumber,
        content: skipped.content,
        error: skipped.error,
      });
    }

    // JSONファイルを書き込み
    const jsonContent = serializeJsonDataFile(data);
    FileUtils.safeWriteTextFile(jsonFilePath, jsonContent);
    result.convertedFiles.push(jsonFileName);
    logger.info({ csvFileName, jsonFileName, itemCount: data.items.length }, 'ファイルを変換しました');

    // CSVファイルをバックアップフォルダに移動
    const backupPath = path.join(migrationBackupFolder, csvFileName);
    fs.renameSync(csvFilePath, backupPath);
    result.backedUpFiles.push(csvFileName);
    logger.info({ csvFileName, backupPath }, 'CSVファイルをバックアップに移動しました');
  }

  /**
   * settings.jsonのdataFileTabs/dataFileLabelsを更新
   */
  private async updateSettings(convertedFiles: string[]): Promise<void> {
    const settingsService = await SettingsService.getInstance();

    // dataFileTabsを更新
    const dataFileTabs = await settingsService.get('dataFileTabs');
    const updatedTabs = dataFileTabs.map((tab) => ({
      ...tab,
      files: tab.files.map((fileName) => {
        // .txtファイルで、対応するJSONファイルに変換された場合は更新
        if (fileName.endsWith('.txt')) {
          const jsonFileName = convertCsvFileNameToJson(fileName);
          if (convertedFiles.includes(jsonFileName)) {
            return jsonFileName;
          }
        }
        return fileName;
      }),
    }));
    await settingsService.set('dataFileTabs', updatedTabs);

    // dataFileLabelsを更新
    const dataFileLabels = await settingsService.get('dataFileLabels');
    const updatedLabels: Record<string, string> = {};

    for (const [fileName, label] of Object.entries(dataFileLabels)) {
      if (fileName.endsWith('.txt')) {
        const jsonFileName = convertCsvFileNameToJson(fileName);
        if (convertedFiles.includes(jsonFileName)) {
          // .txtから.jsonに変更
          updatedLabels[jsonFileName] = label;
        } else {
          // 変換されなかった場合はそのまま
          updatedLabels[fileName] = label;
        }
      } else {
        updatedLabels[fileName] = label;
      }
    }
    await settingsService.set('dataFileLabels', updatedLabels);

    // defaultFileTabも更新
    const defaultFileTab = await settingsService.get('defaultFileTab');
    if (defaultFileTab && defaultFileTab.endsWith('.txt')) {
      const jsonFileName = convertCsvFileNameToJson(defaultFileTab);
      if (convertedFiles.includes(jsonFileName)) {
        await settingsService.set('defaultFileTab', jsonFileName);
      }
    }

    logger.info('settings.jsonを更新しました');
  }
}

export default MigrationService;
