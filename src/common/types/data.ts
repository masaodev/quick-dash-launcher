/** メインデータファイルのデフォルト識別子 */
export const DEFAULT_DATA_FILE = 'datafiles/data.json';

/**
 * データファイルタブの設定項目
 */
export interface DataFileTab {
  /** データファイル名のリスト（例: ['datafiles/data.json'], ['datafiles/data2.json', 'datafiles/data3.json']） */
  files: string[];
  /** タブに表示する名前（例: 'メイン', 'サブ1'） */
  name: string;
}
