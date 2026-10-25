/**
 * メインプロセスの処理が失敗したときに、画面に出すエラー文を取り出す
 *
 * ipcRenderer.invoke は、メインプロセスで投げられた例外の文に
 * 「Error invoking remote method 'open-item': Error: 」を前に付けて投げ直す。
 * これは内部の文字なので、画面には元の文だけを出す。
 */
const IPC_PREFIX = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/;

export function ipcErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(IPC_PREFIX, '');
}
