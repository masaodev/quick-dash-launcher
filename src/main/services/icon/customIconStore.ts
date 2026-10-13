import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

import { dialog } from 'electron';
import { iconLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

import PathManager from '../../config/pathManager.js';
import { mainI18n } from '../mainI18n.js';

/** カスタムアイコンとして受け付ける最大ファイルサイズ */
const MAX_CUSTOM_ICON_SIZE = 5 * 1024 * 1024; // 5MB

/** カスタムアイコンファイルを選択するダイアログを表示 */
export async function selectCustomIconFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: mainI18n.t('register.customIconPickerTitle'),
    filters: [
      { name: mainI18n.t('fileDialog.images'), extensions: ['png', 'jpg', 'jpeg', 'ico', 'svg'] },
      { name: mainI18n.t('fileDialog.allFiles'), extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  return result.canceled ? null : (result.filePaths[0] ?? null);
}

/** カスタムアイコンを保存し、ファイル名を返す */
export async function saveCustomIcon(
  sourceFilePath: string,
  itemIdentifier: string
): Promise<string> {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(mainI18n.t('iconErrors.sourceNotFound', { file: sourceFilePath }));
  }

  const stats = await fs.promises.stat(sourceFilePath);
  if (stats.size > MAX_CUSTOM_ICON_SIZE) {
    throw new Error(mainI18n.t('iconErrors.tooLarge', { max: 5 }));
  }

  const hash = crypto.createHash('md5').update(itemIdentifier).digest('hex').substring(0, 8);
  const customIconFileName = `${hash}.png`;
  const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);

  // 画像はコピーして保存する（将来的にリサイズ処理を追加予定）
  await fs.promises.copyFile(sourceFilePath, customIconPath);
  iconLogger.info(`カスタムアイコンを保存: ${itemIdentifier} -> ${customIconFileName}`);
  return customIconFileName;
}

/** カスタムアイコンを削除 */
export async function deleteCustomIcon(customIconFileName: string): Promise<void> {
  const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);

  if (fs.existsSync(customIconPath)) {
    await fs.promises.unlink(customIconPath);
    iconLogger.info(`カスタムアイコンを削除: ${customIconFileName}`);
  }
}

/** カスタムアイコンをbase64で取得 */
export function getCustomIcon(customIconFileName: string): string | null {
  const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);
  return FileUtils.readCachedBinaryAsBase64(customIconPath);
}
