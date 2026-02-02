/**
 * 編集可能なJSONアイテムの型定義
 *
 * RawDataLine型を廃止し、JSON構造を直接扱うための新しい型定義
 */

import type { JsonItem } from '@common/types';

/**
 * 編集可能なJSONアイテム
 *
 * JSON形式のアイテムと、表示・編集用のテキスト表現を持つ
 */
export interface EditableJsonItem {
  /** 元のJSONアイテム（実際のデータ構造） */
  item: JsonItem;

  /** 表示・編集用のテキスト表現（CSV風だが内部はJSON構造） */
  displayText: string;

  /** メタデータ */
  meta: {
    /** ソースファイル名（例: 'data.json', 'data-work.json'） */
    sourceFile: string;

    /** 0始まりの行番号（インデックス） */
    lineNumber: number;

    /** バリデーション状態 */
    isValid: boolean;

    /** バリデーションエラーメッセージ（エラーがある場合のみ） */
    validationError?: string;
  };
}

/**
 * loadEditableItemsの戻り値型
 */
export interface LoadEditableItemsResult {
  /** 読み込まれた編集可能アイテムの配列 */
  items: EditableJsonItem[];

  /** エラーメッセージ（エラーがある場合のみ） */
  error?: string;
}

/**
 * EditableJsonItemのバリデーション結果
 */
export interface ValidationResult {
  /** バリデーションが成功したかどうか */
  isValid: boolean;

  /** エラーメッセージ（エラーがある場合のみ） */
  error?: string;
}

/**
 * EditableJsonItemをバリデーションする
 *
 * @param item - バリデーション対象のJsonItem
 * @returns バリデーション結果
 */
export function validateEditableItem(item: JsonItem): ValidationResult {
  switch (item.type) {
    case 'item': {
      if (!item.displayName || !item.displayName.trim()) {
        return { isValid: false, error: 'displayNameが空です' };
      }
      if (!item.path || !item.path.trim()) {
        return { isValid: false, error: 'pathが空です' };
      }
      return { isValid: true };
    }

    case 'dir': {
      if (!item.path || !item.path.trim()) {
        return { isValid: false, error: 'dirのpathが空です' };
      }
      if (item.options) {
        if (item.options.depth !== undefined && item.options.depth < 0) {
          return { isValid: false, error: 'depthは0以上である必要があります' };
        }
        if (item.options.types && !['file', 'folder', 'both'].includes(item.options.types)) {
          return {
            isValid: false,
            error: 'typesはfile, folder, bothのいずれかである必要があります',
          };
        }
      }
      return { isValid: true };
    }

    case 'group': {
      if (!item.displayName || !item.displayName.trim()) {
        return { isValid: false, error: 'groupのdisplayNameが空です' };
      }
      if (!item.itemNames || item.itemNames.length === 0) {
        return { isValid: false, error: 'groupのitemNamesが空です' };
      }
      return { isValid: true };
    }

    case 'window': {
      if (!item.displayName || !item.displayName.trim()) {
        return { isValid: false, error: 'windowのdisplayNameが空です' };
      }
      if (!item.windowTitle || !item.windowTitle.trim()) {
        return { isValid: false, error: 'windowのwindowTitleが空です' };
      }
      return { isValid: true };
    }

    case 'clipboard': {
      if (!item.displayName || !item.displayName.trim()) {
        return { isValid: false, error: 'clipboardのdisplayNameが空です' };
      }
      if (!item.dataFileRef || !item.dataFileRef.trim()) {
        return { isValid: false, error: 'clipboardのdataFileRefが空です' };
      }
      if (!item.formats || item.formats.length === 0) {
        return { isValid: false, error: 'clipboardのformatsが空です' };
      }
      return { isValid: true };
    }

    default:
      return { isValid: false, error: `未知のアイテムタイプ: ${(item as JsonItem).type}` };
  }
}
