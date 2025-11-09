import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, shell } from 'electron';

export function setupConfigHandlers(configFolder: string) {
  ipcMain.handle('open-config-folder', async () => {
    await shell.openPath(configFolder);
  });

  ipcMain.handle('open-data-file', async () => {
    const dataPath = path.join(configFolder, 'data.txt');
    await shell.openPath(dataPath);
  });

  ipcMain.handle('get-app-info', async () => {
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

  ipcMain.handle('open-external-url', async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
