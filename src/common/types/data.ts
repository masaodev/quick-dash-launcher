/**
 * データファイルタブの設定項目
 */
export interface DataFileTab {
  /** データファイル名のリスト（例: ['data.json'], ['data2.json', 'data3.json']） */
  files: string[];
  /** タブに表示する名前（例: 'メイン', 'サブ1'） */
  name: string;
}
