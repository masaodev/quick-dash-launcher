import { randomUUID } from 'crypto';
import * as fs from 'fs';

import {
  app,
  BrowserWindow,
  dialog,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type {
  DataExportResult,
  DataImportApplyResult,
  DataImportInspectResult,
} from '@common/types';
import logger from '@common/logger';

import { EnvConfig } from '../config/envConfig.js';
import PathManager from '../config/pathManager.js';
import { BackupService } from '../services/backupService.js';
import {
  buildDataExport,
  collectExportFiles,
  defaultExportFileName,
} from '../services/dataExportService.js';
import {
  applyDataImport,
  DataImportApplyError,
  countCurrentItems,
  countImportItems,
  readDataImport,
  type DataImportContent,
} from '../services/dataImportService.js';
import { mainI18n } from '../services/mainI18n.js';
import { markAppQuitting } from '../utils/managedWindow.js';
import { getAppDistribution } from '../utils/appDistribution.js';
import { handleIpc } from '../utils/ipcWrapper';

/** 確かめ終わって、確認を待っている読み込み（確かめた中身をそのまま書くので、ファイルを読み直さない） */
let pendingImport: { token: string; content: DataImportContent } | null = null;

/** CLI が起動したときの印。再起動した QDL には付けない（スプラッシュを出すため） */
const CLI_LAUNCH_ARG = '--launched-by-cli';

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

  // 読み込み 1: ファイルを選んでもらい、書き込む前にすべて確かめて、確認に出す件数を返す
  handleIpc(
    IPC_CHANNELS.BACKUP_IMPORT_INSPECT,
    async (event): Promise<DataImportInspectResult | null> => {
      const parent = BrowserWindow.fromWebContents(event.sender);
      const options: OpenDialogOptions = {
        title: mainI18n.t('dataExport.importTitle'),
        filters: [
          { name: 'ZIP', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      };
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      const filePath = result.canceled ? undefined : result.filePaths[0];
      if (!filePath) return null;

      pendingImport = null;
      const read = readDataImport(new Uint8Array(await fs.promises.readFile(filePath)));
      if (!read.ok) {
        logger.warn({ filePath, problem: read.problem }, '読み込めないファイルを選びました');
        return { ok: false, filePath, problem: read.problem };
      }
      const { content } = read;
      const before = countCurrentItems(PathManager.getConfigFolder());
      const after = countImportItems(content);
      const token = randomUUID();
      pendingImport = { token, content };
      return {
        ok: true,
        token,
        filePath,
        summary: {
          exportedAt: content.manifest.exportedAt,
          appVersion: content.manifest.appVersion,
          distribution: content.manifest.distribution,
          fileCount: content.files.size,
          items: { before: before.items, after: after.items },
          workspaceItems: { before: before.workspaceItems, after: after.workspaceItems },
        },
      };
    }
  );

  // 読み込みをやめた: 展開した中身（最大 1GB）を次のインポートか終了まで持ち続けないよう捨てる
  handleIpc(IPC_CHANNELS.BACKUP_IMPORT_CANCEL, () => {
    pendingImport = null;
  });

  // 読み込み 2: 今のファイルをスナップショットに残してから置き換え、QDL を再起動する
  handleIpc(
    IPC_CHANNELS.BACKUP_IMPORT_APPLY,
    async (_e, token: string): Promise<DataImportApplyResult> => {
      if (!pendingImport || pendingImport.token !== token) {
        return { success: false, error: mainI18n.t('dataExport.importExpired') };
      }
      const { content } = pendingImport;
      pendingImport = null;
      const configFolder = PathManager.getConfigFolder();

      let snapshot: string | null;
      try {
        snapshot = await (
          await getService()
        ).createPreImportSnapshot(collectExportFiles(configFolder));
      } catch (error) {
        logger.error(
          { error },
          '読み込みの前のスナップショットを作れなかったので、読み込みをやめました'
        );
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }

      // ここから再起動までは同期で行う（ほかの処理が古い内容を書き戻さないように。
      // 終了時の保存も走らせないよう、quit ではなく exit で終わる）
      try {
        applyDataImport(configFolder, content);
      } catch (error) {
        const rolledBack = error instanceof DataImportApplyError && error.rolledBack;
        logger.error({ error, snapshot, rolledBack }, '読み込みの途中で失敗しました');
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: rolledBack
            ? mainI18n.t('dataExport.applyRolledBack', { error: message })
            : mainI18n.t('dataExport.applyFailed', { snapshot: snapshot ?? '-', error: message }),
        };
      }
      logger.info(
        { fileCount: content.files.size, snapshot },
        '書き出したデータを読み込みました。再起動します'
      );
      // 開発中は vite の開発サーバーが要るので再起動せずに終わる（起動し直しは手で行う）
      if (!EnvConfig.isDevelopment) {
        app.relaunch({ args: process.argv.slice(1).filter((arg) => arg !== CLI_LAUNCH_ARG) });
      }
      // exit では before-quit が来ないので、終わるところだと先に知らせる。知らせないと、閉じる切り離し
      // ウィンドウが「× で閉じた」と見なして、読み込んだばかりの workspace-ui-state.json から自分の記録を消す
      markAppQuitting();
      app.exit(0);
      return { success: true };
    }
  );
}
