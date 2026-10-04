import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain, shell } from 'electron';
import logger from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

const DEFAULT_APP_INFO = {
  version: '0.0.0',
  name: 'quick-dash-launcher',
  description: '',
  author: '',
  license: 'MIT',
  repository: 'https://github.com/masaodev/quick-dash-launcher',
};

/** 画面から外部で開いてよい URL のスキーム（アイテムの起動は別経路で、カスタム URI も開く） */
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

function isAllowedExternalUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * 開いてよいフォルダなら絶対パスを返す（存在しない・フォルダでない・相対パスなら null）
 *
 * ドライブ直下のアイテムの親は「C:」の形で届くので「C:\」にしてから確かめる
 * （「C:」のままだと相対パス扱いになる）
 */
async function resolveExistingFolder(folderPath: unknown): Promise<string | null> {
  if (typeof folderPath !== 'string') return null;
  const normalized = /^[a-zA-Z]:$/.test(folderPath) ? `${folderPath}\\` : folderPath;
  if (!path.isAbsolute(normalized)) return null;
  const stat = await fs.stat(normalized).catch(() => null);
  return stat?.isDirectory() ? normalized : null;
}

export function setupConfigHandlers(configFolder: string): void {
  ipcMain.handle(IPC_CHANNELS.OPEN_CONFIG_FOLDER, () => shell.openPath(configFolder));

  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, async () => {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8').catch(() => null);
    if (!content) return DEFAULT_APP_INFO;

    const pkg = JSON.parse(content);
    return {
      version: pkg.version,
      name: pkg.name,
      description: pkg.description,
      author: pkg.author,
      license: pkg.license,
      repository: pkg.repository?.url || DEFAULT_APP_INFO.repository,
    };
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL_URL, async (_event, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      logger.warn({ url }, 'http・https 以外の URL は外部で開きません');
      return;
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_FOLDER, async (_event, folderPath: string) => {
    const folder = await resolveExistingFolder(folderPath);
    if (!folder) {
      logger.warn({ folderPath }, '存在するフォルダではないので開きません');
      return;
    }
    const error = await shell.openPath(folder);
    if (error) {
      logger.error({ folderPath: folder, error }, 'フォルダを開けませんでした');
    }
  });
}
