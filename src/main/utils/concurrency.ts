/**
 * 並列実行数を制限しながらタスクを実行する
 * @param tasks - 実行するタスクの配列
 * @param concurrency - 同時実行数の上限
 * @param shouldCancel - trueを返すと未実行のタスクをスキップして終了する
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  shouldCancel?: () => boolean
): Promise<void> {
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      if (shouldCancel?.()) return;
      const currentIndex = index++;
      await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext());
  await Promise.all(workers);
}
