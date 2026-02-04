import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

const DEFAULT_APP_INFO = {
  version: '0.0.0',
  name: 'quick-dash-launcher',
  description: '',
  author: '',
  license: 'MIT',
  repository: 'https://github.com/masaodev/quick-dash-launcher',
};

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

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL_URL, (_event, url: string) => shell.openExternal(url));
}
