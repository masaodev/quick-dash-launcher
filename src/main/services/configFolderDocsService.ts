import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  JSON_DATA_SCHEMA_REF,
  SETTINGS_SCHEMA_REF,
  WORKSPACE_ARCHIVE_SCHEMA_REF,
  WORKSPACE_SCHEMA_REF,
} from '@common/types';

import { PathManager } from '../config/pathManager.js';

/**
 * 設定フォルダを直接編集する人・AI 向けの補助ファイルを起動時に配置する
 *
 * - config/schemas/*.schema.json: 同梱 JSON Schema。データファイル・settings.json の
 *   `$schema` が相対パスで参照する。アプリの版と一致させるため、内容が違えば上書きする
 * - config/README.md: 作業指示。雛形 assets/config-readme.md のプレースホルダを埋めて生成する
 *
 * どちらも QDL が生成するファイルなので、利用者の編集は次回起動で消える。
 */

/** 同梱スキーマのファイル名（assets/schemas/ と config/schemas/ で共通。$schema の参照先と一致させる） */
export const SCHEMA_FILE_NAMES = [
  path.basename(JSON_DATA_SCHEMA_REF),
  path.basename(SETTINGS_SCHEMA_REF),
  path.basename(WORKSPACE_SCHEMA_REF),
  path.basename(WORKSPACE_ARCHIVE_SCHEMA_REF),
];

/** README 雛形のファイル名（assets/ 直下） */
export const CONFIG_README_TEMPLATE_NAME = 'config-readme.md';

export interface ConfigReadmeVariables {
  /** 設定フォルダの絶対パス */
  configDir: string;
  /** アプリのバージョン（例: 0.7.29） */
  appVersion: string;
}

/**
 * 内容が違うときだけ書き込む（毎回の起動で mtime が動かないように）
 *
 * @returns 書き込んだら true
 */
function writeIfChanged(filePath: string, content: string): boolean {
  const current = FileUtils.safeReadTextFile(filePath);
  if (current === content) return false;
  if (!FileUtils.safeWriteTextFile(filePath, content)) {
    logger.warn({ filePath }, '設定フォルダの補助ファイルを書き込めませんでした');
    return false;
  }
  return true;
}

/**
 * 同梱スキーマを config/schemas/ にコピーする
 *
 * @returns 書き込んだ（新規作成または更新した）ファイル名
 */
export function syncBundledSchemas(assetsFolder: string, schemasFolder: string): string[] {
  const written: string[] = [];
  fs.mkdirSync(schemasFolder, { recursive: true });

  for (const fileName of SCHEMA_FILE_NAMES) {
    const content = FileUtils.safeReadTextFile(path.join(assetsFolder, 'schemas', fileName));
    if (content === null) {
      logger.warn({ fileName }, '同梱スキーマが見つかりません');
      continue;
    }
    if (writeIfChanged(path.join(schemasFolder, fileName), content)) {
      written.push(fileName);
    }
  }
  return written;
}

/**
 * README 雛形のプレースホルダ（{{CONFIG_DIR}}・{{APP_VERSION}}）を埋める
 */
export function renderConfigReadme(template: string, variables: ConfigReadmeVariables): string {
  return template
    .split('{{CONFIG_DIR}}')
    .join(variables.configDir)
    .split('{{APP_VERSION}}')
    .join(variables.appVersion);
}

/**
 * config/README.md を生成する
 *
 * @returns 書き込んだら true（内容が同じなら false）
 */
export function writeConfigReadme(
  assetsFolder: string,
  readmePath: string,
  variables: ConfigReadmeVariables
): boolean {
  const template = FileUtils.safeReadTextFile(path.join(assetsFolder, CONFIG_README_TEMPLATE_NAME));
  if (template === null) {
    logger.warn('README 雛形（assets/config-readme.md）が見つかりません');
    return false;
  }
  return writeIfChanged(readmePath, renderConfigReadme(template, variables));
}

/**
 * 起動時に呼ぶ: スキーマのコピーと README の生成をまとめて行う
 *
 * 失敗しても起動は止めない（補助ファイルなので）。
 */
export function installConfigFolderDocs(appVersion: string): void {
  try {
    const assetsFolder = PathManager.getAssetsFolder();
    const written = syncBundledSchemas(assetsFolder, PathManager.getSchemasFolder());
    const readmeWritten = writeConfigReadme(assetsFolder, PathManager.getConfigReadmePath(), {
      configDir: PathManager.getConfigFolder(),
      appVersion,
    });
    if (written.length > 0 || readmeWritten) {
      logger.info(
        { schemas: written, readme: readmeWritten },
        '設定フォルダの補助ファイルを更新しました'
      );
    }
  } catch (error) {
    logger.error({ error }, '設定フォルダの補助ファイルの配置に失敗しました');
  }
}
