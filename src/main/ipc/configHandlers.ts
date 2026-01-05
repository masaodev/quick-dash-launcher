import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, shell } from 'electron';
import { OPEN_CONFIG_FOLDER, GET_APP_INFO, OPEN_EXTERNAL_URL } from '@common/ipcChannels.js';

export function setupConfigHandlers(configFolder: string) {
  ipcMain.handle(OPEN_CONFIG_FOLDER, async () => {
    await shell.openPath(configFolder);
  });

  ipcMain.handle(GET_APP_INFO, async () => {
    try {
      // package.jsonのパスを取得（productionとdevelopmentで異なる）
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      return {
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description,
        author: packageJson.author,
        license: packageJson.license,
        repository:
          packageJson.repository?.url || 'https://github.com/masaodev/quick-dash-launcher',
      };
    } catch (error) {
      console.error('Failed to load app info:', error);
      return {
        version: '0.0.0',
        name: 'quick-dash-launcher',
        description: '',
        author: '',
        license: 'MIT',
        repository: 'https://github.com/masaodev/quick-dash-launcher',
      };
    }
  });

  ipcMain.handle(OPEN_EXTERNAL_URL, async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
