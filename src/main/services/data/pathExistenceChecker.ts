import * as fs from 'fs';

import type { PathExistenceStatus } from '@common/types/editableItem';

import { expandEnvironmentVariables } from '../icon/iconFileCache.js';

export interface CheckPathsOptions {
  /** 1 パスあたりの待ち時間の上限（ms）。応答しないネットワークパスで止まらないようにする */
  timeoutMs?: number;
  /** 同時に確認する数 */
  concurrency?: number;
  /** テスト用: 存在確認の実体（既定は fs.promises.access） */
  access?: (resolvedPath: string) => Promise<void>;
}

/**
 * パスが実在するかをまとめて確認する（アイテム管理の「リンク切れを確認」）
 *
 * - 環境変数（%VAR%）を展開して確認する
 * - 1 パスごとに時間切れを設け、応答が無いものは 'unknown'（リンク切れとは数えない）
 * - 同時実行数を絞り、メインプロセスを塞がない（同期の existsSync は使わない）
 */
export async function checkPathsExist(
  paths: string[],
  options: CheckPathsOptions = {}
): Promise<Record<string, PathExistenceStatus>> {
  const timeoutMs = options.timeoutMs ?? 3000;
  const concurrency = Math.max(1, options.concurrency ?? 8);
  const access = options.access ?? ((p: string) => fs.promises.access(p));

  const unique = [...new Set(paths)];
  const result: Record<string, PathExistenceStatus> = {};

  const checkOne = async (itemPath: string): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<PathExistenceStatus>((resolve) => {
      timer = setTimeout(() => resolve('unknown'), timeoutMs);
    });
    const probe = access(expandEnvironmentVariables(itemPath)).then(
      () => 'exists' as const,
      () => 'missing' as const
    );
    try {
      result[itemPath] = await Promise.race([probe, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (index < unique.length) {
      const current = unique[index++];
      await checkOne(current);
    }
  });
  await Promise.all(workers);

  return result;
}
