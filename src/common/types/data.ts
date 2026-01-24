/**
 * 生データ編集モードで使用される、データファイルの1行を表すインターフェース
 * 編集機能で各行の種別や元のデータファイルを管理するために使用される
 */
export interface RawDataLine {
  /** データファイル内の行番号（1から開始） */
  lineNumber: number;
  /** 行の内容（改行文字は含まない） */
  content: string;
  /** 行の種別（フォルダ取込アイテム、アイテム、コメント、空行） */
  type: 'directive' | 'item' | 'comment' | 'empty';
  /** 元のデータファイル */
  sourceFile: string;
  /** カスタムアイコンのファイル名（custom-iconsフォルダ内の相対パス、オプション） */
  customIcon?: string;
  /** JSONファイルから読み込んだ場合のアイテムID（ID保持用） */
  jsonItemId?: string;
}

/**
 * データファイルタブの設定項目
 */
export interface DataFileTab {
  /** データファイル名のリスト（例: ['data.json'], ['data2.json', 'data3.json']） */
  files: string[];
  /** タブに表示する名前（例: 'メイン', 'サブ1'） */
  name: string;
}
