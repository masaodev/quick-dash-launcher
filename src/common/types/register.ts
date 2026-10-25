/**
 * 登録関連の型定義
 *
 * RegisterModal、フォルダ取込で使用される型定義を提供します。
 */

import type { ItemWindowSwitch, LauncherItem, SetEntry, SetLaunchMode } from './launcher';
import type { JsonDirOptions } from './json-data';
import type { ClipboardFormat } from './clipboard';

/** フォルダ取込のプレビューの結果の種類 */
export type DirPreviewStatus = 'ok' | 'notFound' | 'notFolder' | 'timeout' | 'cancelled';

/** フォルダ取込のプレビューに並べる 1 件（登録したときにメイン画面に並ぶもの） */
export interface DirPreviewItem {
  /** 頭・後ろに付ける文字を付けた表示名 */
  displayName: string;
  /** 頭・後ろに付ける文字を付ける前の名前（画面で付ける文字だけを入れ替えるのに使う） */
  baseName: string;
  isFolder: boolean;
  /** 選んだフォルダから見た、入っているフォルダ（直下なら空） */
  location: string;
  /** ショートカット（.lnk）のリンク先 */
  shortcutTarget?: string;
}

/** フォルダ取込のプレビューの結果 */
export interface DirPreviewResult {
  status: DirPreviewStatus;
  items: DirPreviewItem[];
  /** 上限まで見つけて走査をやめた（items のほかにもまだある） */
  truncated: boolean;
}

/** 登録・編集画面のパス欄の「選択」で選ぶもの */
export type ItemPathPickKind = 'file' | 'folder';

/**
 * RegisterModalで使用されるアイテム型
 *
 * 単一アイテムのウィンドウ切り替えは、保存形式と同じキー（window・placement・ifOpen・activateWindow・
 * waitSeconds・pinToAllDesktops）をそのまま持つ（ItemWindowSwitch）。単一アイテム以外では使わない
 */
export interface RegisterItem extends ItemWindowSwitch {
  displayName: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  /** 常に管理者として実行する（単一アイテムのアプリだけ） */
  runAsAdmin?: boolean;
  targetTab: string;
  targetFile?: string;
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  customIcon?: string;
  itemCategory: 'item' | 'dir' | 'clipboard' | 'set';
  dirOptions?: JsonDirOptions;
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
  /** 保存済みの参照の実データが見つからない（画面の中だけで使い、保存しない） */
  clipboardDataMissing?: boolean;
  /** セットの行（set専用） */
  setEntries?: SetEntry[];
  /** セットの開き方（set専用） */
  setLaunchMode?: SetLaunchMode;
  /** 登録し直すときに引き継ぐ id（保存先のファイルを変えた編集。セットの行が id で指しているので変えない） */
  keepId?: string;
}
