/**
 * 編集可能なJSONアイテムの型定義
 *
 * RawDataLine型を廃止し、JSON構造を直接扱うための新しい型定義
 */

import type { TFunction } from 'i18next';
import type { JsonItem, LauncherItem } from '@common/types';
import { hasItemWindowSwitch } from '@common/utils/itemWindowConversion';

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

    /**
     * 起動種別（type: "item" のみ。読み込み時にメイン画面と同じ判定で決める）
     *
     * ドット入りのフォルダ名はパスの文字列だけではファイルと区別できないため、ディスクで確かめた結果を渡す
     */
    launcherType?: LauncherItem['type'];
  };
}

/**
 * saveEditableItems が楽観ロックの競合（読み込み後の外部変更）で保存を拒否したときに
 * エラーメッセージへ付ける印。IPC 越しでもメッセージ文字列は残るので includes で判別する
 */
export const EXTERNAL_CHANGE_CONFLICT_MARKER = '[external-change]';

/**
 * loadEditableItemsの戻り値型
 */
export interface LoadEditableItemsResult {
  /** 読み込まれた編集可能アイテムの配列 */
  items: EditableJsonItem[];

  /**
   * 読み込み時のファイル内容ハッシュ（キー: 'datafiles/data.json' 形式）。
   * saveEditableItems に渡すと、読み込み後に QDL 外で変更されたファイルへの
   * 上書きを拒否する（楽観ロック）
   */
  fileHashes?: Record<string, string>;

  /** エラーメッセージ（エラーがある場合のみ） */
  error?: string;
}

/** パスの存在確認の結果。unknown は時間内に応答が無かった（ネットワークパスなど。リンク切れとは数えない） */
export type PathExistenceStatus = 'exists' | 'missing' | 'unknown';

/**
 * saveEditableItemsの戻り値型
 */
export interface SaveEditableItemsResult {
  /** 保存後のファイル内容ハッシュ。次回の保存で expectedHashes として渡す */
  fileHashes: Record<string, string>;
  /** 実際に書き換えたファイル（内容が変わらなかったファイルは書かない） */
  writtenFiles: string[];
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
 * @param t - エラーの文言を引く関数（main は mainI18n.t）
 * @returns バリデーション結果
 */
export function validateEditableItem(item: JsonItem, t: TFunction): ValidationResult {
  switch (item.type) {
    case 'item': {
      if (!item.displayName || !item.displayName.trim()) {
        return { isValid: false, error: t('validation.emptyField', { field: 'displayName' }) };
      }
      // パスの無い単一アイテム（対象ウィンドウだけ）は、開いているウィンドウへ切り替えるだけ
      if ((!item.path || !item.path.trim()) && !hasItemWindowSwitch(item)) {
        return { isValid: false, error: t('validation.pathOrWindowRequired') };
      }
      return { isValid: true };
    }

    case 'dir': {
      if (!item.path || !item.path.trim()) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'dir', field: 'path' }),
        };
      }
      if (item.options) {
        // -1 は無制限（登録画面の「無制限」）。それ未満の負の値だけを不正とする
        if (item.options.depth !== undefined && item.options.depth < -1) {
          return { isValid: false, error: t('validation.depthOutOfRange') };
        }
        if (item.options.types && !['file', 'folder', 'both'].includes(item.options.types)) {
          return {
            isValid: false,
            error: t('validation.invalidTypes'),
          };
        }
      }
      return { isValid: true };
    }

    case 'window': {
      if (!item.displayName || !item.displayName.trim()) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'window', field: 'displayName' }),
        };
      }
      if (!item.windowTitle || !item.windowTitle.trim()) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'window', field: 'windowTitle' }),
        };
      }
      return { isValid: true };
    }

    case 'clipboard': {
      if (!item.displayName || !item.displayName.trim()) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'clipboard', field: 'displayName' }),
        };
      }
      if (!item.dataFileRef || !item.dataFileRef.trim()) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'clipboard', field: 'dataFileRef' }),
        };
      }
      if (!item.formats || item.formats.length === 0) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'clipboard', field: 'formats' }),
        };
      }
      return { isValid: true };
    }

    case 'set': {
      if (!item.displayName || !item.displayName.trim()) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'set', field: 'displayName' }),
        };
      }
      if (!item.entries || item.entries.length === 0) {
        return {
          isValid: false,
          error: t('validation.emptyTypedField', { type: 'set', field: 'entries' }),
        };
      }
      return { isValid: true };
    }

    default:
      return {
        isValid: false,
        error: t('validation.unknownType', { type: String((item as JsonItem).type) }),
      };
  }
}
