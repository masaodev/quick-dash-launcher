/**
 * 登録関連の型定義
 *
 * RegisterModal、フォルダ取込、ウィンドウ操作アイテムで使用される型定義を提供します。
 */

import type {
  WindowConfig,
  LauncherItem,
  WindowItemConfig,
  SetEntry,
  SetLaunchMode,
} from './launcher';
import type { JsonDirOptions } from './json-data';
import type { ClipboardFormat } from './clipboard';

/**
 * ウィンドウ操作アイテムの設定（登録・編集フォームで使う）
 *
 * ID で window アイテムを更新するときの WindowItemConfig と同じ形なので、別名として定義する。
 *
 * @see JsonWindowItem - JSON形式のウィンドウ操作アイテム
 */
export type WindowOperationConfig = WindowItemConfig;

/**
 * RegisterModalで使用されるアイテム型
 */
export interface RegisterItem {
  displayName: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  targetTab: string;
  targetFile?: string;
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  customIcon?: string;
  windowConfig?: WindowConfig;
  itemCategory: 'item' | 'dir' | 'window' | 'clipboard' | 'set';
  dirOptions?: JsonDirOptions;
  windowOperationConfig?: WindowOperationConfig;
  /** 自由記述メモ（オプション） */
  memo?: string;
  /** クリップボードデータファイルへの参照（clipboard専用、永続化済み） */
  clipboardDataRef?: string;
  /** クリップボードの保存フォーマット（clipboard専用） */
  clipboardFormats?: ClipboardFormat[];
  /** クリップボードの保存日時（clipboard専用） */
  clipboardSavedAt?: number;
  /** クリップボードのプレビュー（clipboard専用） */
  clipboardPreview?: string;
  /** クリップボードセッションID（clipboard専用、登録確定前の一時保存用） */
  clipboardSessionId?: string;
  /**
   * 「テキストを書く」で書いた本文（clipboard専用、未保存）。値があるときは保存時にテキストだけの実データとして保存し、
   * セッション・参照より優先する。保存済みの中身をそのまま使うときは undefined
   */
  clipboardText?: string;
  /** セットの行（set専用） */
  setEntries?: SetEntry[];
  /** セットの開き方（set専用） */
  setLaunchMode?: SetLaunchMode;
  /** 登録し直すときに引き継ぐ id（保存先のファイルを変えた編集。セットの行が id で指しているので変えない） */
  keepId?: string;
}
