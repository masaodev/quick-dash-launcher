/**
 * クリップボードアイテム関連の型定義
 *
 * クリップボードの内容（テキスト、HTML、RTF、画像）を保存・復元する機能で使用される型を定義
 */

/**
 * シリアライズ可能なクリップボードデータ
 * clipboard-data/{id}.json に保存される実データ
 */
export interface SerializableClipboard {
  /** 利用可能なフォーマットのリスト */
  formats: ClipboardFormat[];
  /** テキストデータ */
  text?: string;
  /** HTMLデータ */
  html?: string;
  /** RTFデータ */
  rtf?: string;
  /** 画像データ（Base64エンコード） */
  imageBase64?: string;
  /** ファイルパス（参照用のみ、復元は非対応） */
  filePaths?: string[];
  /** 保存日時（timestamp） */
  savedAt: number;
  /** データサイズ（bytes） */
  dataSize: number;
}

/**
 * クリップボードデータのフォーマット
 */
export type ClipboardFormat = 'text' | 'html' | 'rtf' | 'image' | 'file';

/**
 * クリップボードキャプチャ結果の共通フィールド
 */
interface ClipboardCaptureResultBase {
  success: boolean;
  preview?: string;
  formats?: ClipboardFormat[];
  dataSize?: number;
  error?: string;
}

/**
 * クリップボードキャプチャ結果（ファイル保存済み）
 */
export interface ClipboardCaptureResult extends ClipboardCaptureResultBase {
  dataFileRef?: string;
  savedAt?: number;
}

/**
 * クリップボードセッションキャプチャ結果（メモリ上に一時保持）
 */
export interface ClipboardSessionCaptureResult extends ClipboardCaptureResultBase {
  sessionId?: string;
  capturedAt?: number;
}

/**
 * セッションコミット結果
 */
export interface ClipboardSessionCommitResult {
  /** 成功したかどうか */
  success: boolean;
  /** データファイルへの参照（clipboard-data/{id}.json） */
  dataFileRef?: string;
  /** 保存日時 */
  savedAt?: number;
  /** エラーメッセージ */
  error?: string;
}

/**
 * クリップボード復元結果
 */
export interface ClipboardRestoreResult {
  /** 成功したかどうか */
  success: boolean;
  /** 復元されたフォーマット */
  restoredFormats?: ClipboardFormat[];
  /** エラーメッセージ */
  error?: string;
}

/**
 * クリップボードプレビュー情報
 */
export interface ClipboardPreview {
  /** プレビューテキスト */
  preview: string;
  /** 利用可能なフォーマット */
  formats: ClipboardFormat[];
  /** データサイズ（bytes） */
  dataSize: number;
  /** 保存日時 */
  savedAt: number;
  /** 画像の場合のサムネイル（Base64） */
  imageThumbnail?: string;
}

/**
 * 現在のクリップボード状態
 */
export interface CurrentClipboardState {
  /** 内容があるかどうか */
  hasContent: boolean;
  /** 利用可能なフォーマット */
  formats: ClipboardFormat[];
  /** プレビューテキスト */
  preview?: string;
  /** 画像のサムネイル（Base64） */
  imageThumbnail?: string;
  /** 推定データサイズ */
  estimatedSize?: number;
}

/** 画像データの最大サイズ（10MB） */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** プレビューテキストの最大長 */
export const PREVIEW_MAX_LENGTH = 100;

/** サムネイル画像の最大幅 */
export const THUMBNAIL_MAX_WIDTH = 200;

/** サムネイル画像の最大高さ */
export const THUMBNAIL_MAX_HEIGHT = 150;
