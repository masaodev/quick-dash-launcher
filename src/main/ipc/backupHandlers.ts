import * as fs from 'fs';

import { app, BrowserWindow, dialog, type SaveDialogOptions } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { DataExportResult } from '@common/types';
import logger from '@common/logger';

import PathManager from '../config/pathManager.js';
import { BackupService } from '../services/backupService.js';
import { buildDataExport, defaultExportFileName } from '../services/dataExportService.js';
import { mainI18n } from '../services/mainI18n.js';
import { getAppDistribution } from '../utils/appDistribution.js';
import { handleIpc } from '../utils/ipcWrapper';

export function setupBackupHandlers(): void {
  const getService = () => BackupService.getInstance();

  handleIpc(IPC_CHANNELS.BACKUP_LIST_SNAPSHOTS, async () => (await getService()).listSnapshots());

  handleIpc(IPC_CHANNELS.BACKUP_RESTORE_SNAPSHOT, async (_e, timestamp: string) =>
    (await getService()).restoreSnapshot(timestamp)
  );

  handleIpc(IPC_CHANNELS.BACKUP_DELETE_SNAPSHOT, async (_e, timestamp: string) =>
    (await getService()).deleteSnapshot(timestamp)
  );

  handleIpc(IPC_CHANNELS.BACKUP_GET_STATUS, async () => (await getService()).getStatus());

  // 一括エクスポート: 保存先を選んでもらい、設定フォルダの中身を zip 1 つにして書く
  handleIpc(IPC_CHANNELS.BACKUP_EXPORT_ALL, async (event): Promise<DataExportResult | null> => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const now = new Date();
    const options: SaveDialogOptions = {
      title: mainI18n.t('dataExport.exportTitle'),
      defaultPath: defaultExportFileName(now),
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    };
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;

    const { zip, manifest } = buildDataExport(PathManager.getConfigFolder(), {
      appVersion: app.getVersion(),
      distribution: getAppDistribution(),
      exportedAt: now,
    });
    // 途中で失敗しても壊れた zip を残さないよう、隣に書いてから置き換える
    const tempPath = `${result.filePath}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, zip);
      await fs.promises.rename(tempPath, result.filePath);
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true });
      throw error;
    }
    logger.info(
      { filePath: result.filePath, fileCount: manifest.files.length, size: zip.length },
      'データをすべて書き出しました'
    );
    return { filePath: result.filePath, fileCount: manifest.files.length };
  });
}
