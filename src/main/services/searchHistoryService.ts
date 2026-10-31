import * as path from 'path';

import { FileUtils } from '@common/utils/fileUtils';
import { isNewerFormatVersion } from '@common/utils/formatVersion';
import { SearchHistoryEntry } from '@common/types';

/** search-history.json の形式の版 */
const SEARCH_HISTORY_VERSION = '1.0';

/**
 * 検索履歴ファイルのJSON形式
 */
interface SearchHistoryFile {
  version: string;
  entries: SearchHistoryEntry[];
}

/**
 * 検索履歴の管理サービス
 * JSON形式での履歴ファイルの読み書きと履歴データの操作を提供する
 */
export class SearchHistoryService {
  private readonly historyFilePath: string;
  private readonly maxHistoryCount = 100;

  constructor(configFolder: string) {
    this.historyFilePath = path.join(configFolder, 'search-history.json');
  }

  /**
   * timestampで降順ソート（最新が先頭）
   */
  private sortByTimestampDesc(entries: SearchHistoryEntry[]): SearchHistoryEntry[] {
    return [...entries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /** 履歴ファイルの版が、この QDL の扱える版より新しいか（無い・読めないなら false） */
  private isNewerFormatFile(): boolean {
    const content = FileUtils.safeReadTextFile(this.historyFilePath);
    if (!content) return false;
    try {
      const data = JSON.parse(content) as Partial<SearchHistoryFile> | null;
      return isNewerFormatVersion(data?.version, SEARCH_HISTORY_VERSION);
    } catch {
      return false;
    }
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

    // ファイル破損時に検索のたびIPCエラーになるのを防ぐ（履歴は消えても実害が小さい）
    let data: SearchHistoryFile;
    try {
      data = JSON.parse(content) as SearchHistoryFile;
    } catch {
      return [];
    }
    if (!Array.isArray(data.entries)) {
      return [];
    }

    return this.sortByTimestampDesc(data.entries);
  }

  /**
   * 検索履歴を履歴ファイルに保存する
   * @param entries 保存する検索履歴のエントリー配列
   */
  saveHistory(entries: SearchHistoryEntry[]): void {
    // 新しい版の QDL が書いたファイルは上書きしない（新しい版の形を壊さないため。履歴は残らないだけ）
    if (this.isNewerFormatFile()) return;
    const data: SearchHistoryFile = {
      version: SEARCH_HISTORY_VERSION,
      entries: this.sortByTimestampDesc(entries).slice(0, this.maxHistoryCount),
    };

    FileUtils.safeWriteTextFile(this.historyFilePath, JSON.stringify(data, null, 2));
  }

  /**
   * 新しい検索履歴エントリーを追加する
   * 既存の同一クエリがある場合は、最新の実行時間で更新する
   * @param query 検索クエリ
   */
  addHistoryEntry(query: string): void {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const entries = this.loadHistory();

    // 既存の同一クエリを削除して先頭に追加
    const newEntries = entries.filter((entry) => entry.query !== trimmedQuery);
    newEntries.unshift({ query: trimmedQuery, timestamp: new Date().toISOString() });

    this.saveHistory(newEntries);
  }

  /**
   * 検索履歴をクリアする
   */
  clearHistory(): void {
    this.saveHistory([]);
  }
}
