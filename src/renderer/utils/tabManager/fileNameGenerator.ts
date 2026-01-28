import { DataFileTab } from '@common/types';

/**
 * ファイル名とラベルの生成ロジック
 * すべて純粋関数として実装（副作用なし）
 */
export const FileNameGenerator = {
  /**
   * デフォルトのタブ名を生成
   * @param fileName - ファイル名（例: data.json, data2.json）
   * @returns デフォルトのタブ名（例: メイン、サブ1）
   *
   * @example
   * getDefaultTabName('data.json') // => 'メイン'
   * getDefaultTabName('data2.json') // => 'サブ1'
   * getDefaultTabName('data10.json') // => 'サブ9'
   */
  getDefaultTabName(fileName: string): string {
    if (fileName === 'data.json') {
      return 'メイン';
    }
    const match = fileName.match(/^data(\d+)\.json$/);
    if (match) {
      const num = parseInt(match[1]);
      return `サブ${num - 1}`;
    }
    return fileName;
  },

  /**
   * デフォルトのファイルラベルを生成
   * @param fileName - ファイル名
   * @param tabName - タブ名（省略時は紐づくタブから自動取得）
   * @param tabs - データファイルタブのリスト（tabName省略時に使用）
   * @returns ファイルラベル（例: メイン用データファイル）
   *
   * @example
   * getDefaultFileLabel('data.json', 'メイン') // => 'メイン用データファイル'
   * getDefaultFileLabel('data2.json', 'サブ1') // => 'サブ1用データファイル'
   * getDefaultFileLabel('data.json', undefined, tabs) // => タブから自動取得
   */
  getDefaultFileLabel(fileName: string, tabName?: string, tabs?: DataFileTab[]): string {
    // タブ名が指定されていない場合は、ファイルが紐づいている最初のタブ名を取得
    if (!tabName && tabs) {
      const linkedTab = tabs.find((tab) => tab.files.includes(fileName));
      tabName = linkedTab ? linkedTab.name : this.getDefaultTabName(fileName);
    } else if (!tabName) {
      tabName = this.getDefaultTabName(fileName);
    }
    return `${tabName}用データファイル`;
  },

  /**
   * 次に使用可能なファイル名を生成
   * @param existingFiles - 既存のファイル名リスト
   * @param pendingCreations - 作成予定のファイル名リスト
   * @returns 次の番号のファイル名（例: data2.json, data3.json）
   *
   * @example
   * getNextAvailableFileName(['data.json'], []) // => 'data2.json'
   * getNextAvailableFileName(['data.json', 'data2.json'], []) // => 'data3.json'
   * getNextAvailableFileName(['data.json', 'data3.json'], []) // => 'data4.json' (欠番は埋めない)
   * getNextAvailableFileName(['data.json'], ['data2.json']) // => 'data3.json'
   */
  getNextAvailableFileName(existingFiles: string[], pendingCreations: string[]): string {
    const allFiles = [...existingFiles, ...pendingCreations];
    const existingNumbers = allFiles
      .map((file) => {
        if (file === 'data.json') return 1;
        const match = file.match(/^data(\d+)\.json$/i);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    return `data${nextNumber}.json`;
  },

  /**
   * 重複しないラベルを生成（必要に応じて番号を付ける）
   * @param baseLabel - ベースとなるラベル
   * @param existingLabels - 既存のラベルのセット
   * @returns 重複しないラベル
   *
   * @example
   * generateUniqueLabel('メイン用データファイル', new Set()) // => 'メイン用データファイル'
   * generateUniqueLabel('メイン用データファイル', new Set(['メイン用データファイル'])) // => 'メイン用データファイル2'
   * generateUniqueLabel('メイン用データファイル', new Set(['メイン用データファイル', 'メイン用データファイル2'])) // => 'メイン用データファイル3'
   */
  generateUniqueLabel(baseLabel: string, existingLabels: Set<string>): string {
    if (!existingLabels.has(baseLabel)) {
      return baseLabel;
    }

    let counter = 2;
    while (existingLabels.has(`${baseLabel}${counter}`)) {
      counter++;
    }
    return `${baseLabel}${counter}`;
  },
};
