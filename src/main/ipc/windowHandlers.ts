import { ipcMain } from 'electron';

export function setupWindowHandlers(
  getWindowPinState: () => boolean,
  setWindowPinState: (pinState: boolean) => void
) {
  ipcMain.handle('get-window-pin-state', () => {
    return getWindowPinState();
  });

  ipcMain.handle('set-window-pin-state', (event, isPinned: boolean) => {
    setWindowPinState(isPinned);
  });
}