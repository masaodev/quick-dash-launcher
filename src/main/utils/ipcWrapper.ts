import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import logger from '@common/logger';
import type { IpcInvokeArgs, IpcInvokeChannel, IpcInvokeResult } from '@common/types/ipcInvokeMap';

/**
 * invoke のハンドラーを登録する。引数と戻り値の型は対応表（IpcInvokeMap）から取るので、
 * preload の ipcInvoke とずれるとコンパイルで気づける。ipcMain.handle を直接使わずにこれを使う
 */
export function handleIpc<C extends IpcInvokeChannel>(
  channel: C,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: IpcInvokeArgs<C>
  ) => IpcInvokeResult<C> | Promise<IpcInvokeResult<C>>
): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as IpcInvokeArgs<C>)));
}

/**
 * エラーハンドリング付きIPCハンドラーを作成するユーティリティ関数
 * 全てのIPCハンドラーで共通のエラーハンドリングパターンを統一し、
 * ログ出力とエラー処理を標準化する
 */
export function createSafeIpcHandler<C extends IpcInvokeChannel>(
  channel: C,
  handler: (...args: IpcInvokeArgs<C>) => Promise<IpcInvokeResult<C>>,
  loggerContext: string
): void {
  handleIpc(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error({ channel, error }, `${loggerContext}に失敗`);
      throw error;
    }
  });
}
