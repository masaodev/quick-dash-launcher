import { ipcMain, shell } from 'electron';
import * as path from 'path';

export function setupConfigHandlers(configFolder: string) {
  ipcMain.handle('open-config-folder', async () => {
    await shell.openPath(configFolder);
  });
  
  ipcMain.handle('open-data-file', async () => {
    const dataPath = path.join(configFolder, 'data.txt');
    await shell.openPath(dataPath);
  });
}