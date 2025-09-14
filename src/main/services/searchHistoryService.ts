import * as path from 'path';
import { FileUtils } from '@common/utils/fileUtils';
import { SearchHistoryEntry } from '@common/types';

/**
 * 検索履歴の管理サービス
 * CSV形式での履歴ファイルの読み書きと履歴データの操作を提供する
 */
export class SearchHistoryService {
  private readonly historyFilePath: string;
  private readonly maxHistoryCount = 100;

  constructor(configFolder: string) {
    this.historyFilePath = path.join(configFolder, 'history.txt');
  }

  /**
   * 履歴ファイルから検索履歴を読み込む
   * @returns 検索履歴のエントリー配列（最新が先頭）
   */
  loadHistory(): SearchHistoryEntry[] {
    const content = FileUtils.safeReadTextFile(this.historyFilePath);
    if (!content) {
      return [];
    }

    const entries: SearchHistoryEntry[] = [];
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const [query, timestamp] = trimmedLine.split(',');
      if (query && timestamp) {
        entries.push({ query: query.trim(), timestamp: timestamp.trim() });
      }
    }

    // 最新が先頭になるようにソート
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * 検索履歴を履歴ファイルに保存する
   * @param entries 保存する検索履歴のエントリー配列
   */
  saveHistory(entries: SearchHistoryEntry[]): void {
    // 最新が先頭になるようにソートしてから上限まで制限
    const sortedEntries = entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, this.maxHistoryCount);

    const lines = sortedEntries.map(entry => `${entry.query},${entry.timestamp}`);
    const content = lines.join('\r\n');

    FileUtils.safeWriteTextFile(this.historyFilePath, content);
  }

  /**
   * 新しい検索履歴エントリーを追加する
   * 既存の同一クエリがある場合は、最新の実行時間で更新する
   * @param query 検索クエリ
   */
  addHistoryEntry(query: string): void {
    if (!query.trim()) return;

    const entries = this.loadHistory();
    const timestamp = new Date().toISOString();

    // 既存の同一クエリを削除
    const filteredEntries = entries.filter(entry => entry.query !== query.trim());

    // 新しいエントリーを先頭に追加
    filteredEntries.unshift({ query: query.trim(), timestamp });

    this.saveHistory(filteredEntries);
  }

  /**
   * 検索履歴をクリアする
   */
  clearHistory(): void {
    this.saveHistory([]);
  }
}