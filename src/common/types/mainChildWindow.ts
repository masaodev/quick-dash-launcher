import type { EditingAppItem } from './editingItem';
import type { IconProgressResult } from './icon';

/**
 * メイン画面が独立した子ウィンドウで開く画面の要求
 *
 * 以前はメインウィンドウの中にモーダルを描き、ウィンドウを 850x1000 等に広げて中央へ
 * 動かしていた。今はメインウィンドウを動かさず、メインのレンダラーが window.open で開いた
 * 子ウィンドウに描画する。子ウィンドウは window.name から requestId を取り出し、
 * この要求をメインプロセスから受け取って表示内容を決める。
 */
export type MainChildWindowRequest = RegisterWindowRequest | IconProgressDetailWindowRequest;

/** アイテムの登録・編集ウィンドウ */
export interface RegisterWindowRequest {
  kind: 'register';
  /** ドロップされたファイル・URL（新規登録の初期値。なければ空配列） */
  droppedPaths: string[];
  /** 編集対象（新規登録なら null） */
  editingItem: EditingAppItem | null;
  /** 開いたときにメイン画面で選ばれていたタブ（保存先の初期値） */
  currentTab?: string;
}

/** アイコン取得結果の詳細ウィンドウ */
export interface IconProgressDetailWindowRequest {
  kind: 'iconProgressDetail';
  results: IconProgressResult[];
}

/**
 * 子ウィンドウでの操作結果（子ウィンドウ → メインプロセス → メイン画面へ中継）
 * メイン画面はこれを受けてトーストを出す。データの再読込は data-changed で別途行われる
 */
export interface MainChildWindowResult {
  kind: 'register';
  action: 'registered' | 'updated' | 'deleted';
}
