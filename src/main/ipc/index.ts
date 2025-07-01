import { BrowserWindow } from 'electron';
import { setupDataHandlers } from './dataHandlers';
import { setupItemHandlers } from './itemHandlers';
import { setupConfigHandlers } from './configHandlers';
import { setupIconHandlers } from './iconHandlers';

export function setupIPCHandlers(
  configFolder: string,
  faviconsFolder: string,
  getMainWindow: () => BrowserWindow | null
) {
  setupDataHandlers(configFolder);
  setupItemHandlers(getMainWindow);
  setupConfigHandlers(configFolder);
  setupIconHandlers(faviconsFolder);
}