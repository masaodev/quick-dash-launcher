import { ipcMain, app } from 'electron';

export function setupWindowHandlers(
  getWindowPinState: () => boolean,
  setWindowPinState: (pinState: boolean) => void,
  setEditMode: (editMode: boolean) => Promise<void>,
  getEditMode: () => boolean
) {
  ipcMain.handle('get-window-pin-state', () => {
    return getWindowPinState();
  });

  ipcMain.handle('set-window-pin-state', (_event, isPinned: boolean) => {
    setWindowPinState(isPinned);
  });

  ipcMain.handle('quit-app', () => {
    app.quit();
  });

  ipcMain.handle('set-edit-mode', async (_event, editMode: boolean) => {
    await setEditMode(editMode);
  });

  ipcMain.handle('get-edit-mode', () => {
    return getEditMode();
  });
}
