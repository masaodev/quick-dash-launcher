import { Worker } from 'worker_threads';

import { iconLogger } from '@common/logger';

/**
 * extract-file-icon をメインのスレッドではなく専用のワーカースレッドで呼ぶ
 *
 * extract-file-icon（0.3.2）は呼ばれるたびに CoInitializeEx(COINIT_MULTITHREADED) を呼び、成否を見ずに
 * CoUninitialize() を呼ぶ。Electron のメインのスレッドは STA で初期化済みなので CoInitializeEx は失敗して
 * 数が増えず、CoUninitialize で数だけが減る。アイコンを何度も取り出すと OLE の初期化が外れ、
 * Windows のドラッグ＆ドロップが効かなくなる（A3-181）。ワーカーのスレッドでは初期化と後始末が釣り合う。
 * 取り出しの間メインのスレッドが止まらない効果もある
 */

/** ワーカーで動かすコード（main.js 1 本に束ねているので、別ファイルにせず文字列で渡す） */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
const extractFileIcon = require(workerData.modulePath);
parentPort.on('message', ({ id, filePath, size }) => {
  try {
    const buffer = extractFileIcon(filePath, size);
    parentPort.postMessage({ id, buffer: buffer && buffer.length > 0 ? buffer : null });
  } catch (error) {
    parentPort.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
`;

interface WorkerResponse {
  id: number;
  buffer?: Uint8Array | null;
  error?: string;
}

interface Pending {
  resolve: (buffer: Buffer) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

/** 待っている要求をすべて失敗にし、次の要求でワーカーを作り直す */
function failAll(error: Error): void {
  worker = null;
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;

  const created = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { modulePath: require.resolve('extract-file-icon') },
  });
  // 待っている要求が無いときにアプリの終了を妨げない
  created.unref();
  created.on('message', (message: WorkerResponse) => {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(message.error));
      return;
    }
    // 転送で Uint8Array になるので Buffer に戻す。空は「取り出せなかった」として空の Buffer を返す
    const data = message.buffer;
    entry.resolve(
      data ? Buffer.from(data.buffer, data.byteOffset, data.byteLength) : Buffer.alloc(0)
    );
  });
  created.on('error', (error) => {
    iconLogger.error({ error }, 'アイコン取り出しのワーカーでエラーが起きました');
    if (worker === created) failAll(error instanceof Error ? error : new Error(String(error)));
  });
  created.on('exit', (code) => {
    if (worker !== created) return;
    if (code !== 0) iconLogger.warn({ code }, 'アイコン取り出しのワーカーが終了しました');
    // 呼び出し元はログに残すだけで画面には出さないので、内部向けの英語にする
    failAll(new Error(`icon worker exited (${code})`));
  });
  worker = created;
  return created;
}

/**
 * ファイルのアイコンを PNG で取り出す（extract-file-icon と同じ結果。取り出せないときは空の Buffer）
 */
export function extractFileIconInWorker(filePath: string, size: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ id, filePath, size });
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
