import type { AppSettings } from '@common/types';

/** 設定画面の左メニューのカテゴリ */
export type SettingsCategory = 'basic' | 'window' | 'backup' | 'bookmarkAutoImport';

/** 「既定値に戻す」を置くカテゴリ（ブックマーク自動取込は自前の保存単位を持つので対象外） */
export type ResettableSettingsCategory = Extract<SettingsCategory, 'basic' | 'window' | 'backup'>;

/**
 * カテゴリごとに「既定値に戻す」で戻す項目
 *
 * ホットキー（hotkey / itemSearchHotkey）は含めない。利用者が意図して決めた値で、
 * しかも hotkey は既定値が空なので、戻すと次回起動が初回起動扱いになるから。
 * タブ構成（dataFileTabs 等）はアイテム管理で、ブックマーク自動取込はそのカテゴリで管理するので含めない。
 * 「複数タブを表示」（showDataFileTabs）も、戻すと作ったタブが急に見えなくなるので含めない。
 */
export const SETTINGS_RESET_KEYS: Record<
  ResettableSettingsCategory,
  ReadonlyArray<keyof AppSettings>
> = {
  basic: ['autoLaunch', 'cliEnabled', 'parallelGroupLaunch', 'showKeyboardHints'],
  window: [
    'windowWidth',
    'windowHeight',
    'editModeWidth',
    'editModeHeight',
    'windowPositionMode',
    'windowPositionX',
    'windowPositionY',
    'workspaceOpacity',
    'workspaceBackgroundTransparent',
    'autoShowWorkspace',
    'workspacePositionMode',
    'workspaceTargetDisplayIndex',
    'workspacePositionX',
    'workspacePositionY',
    'workspaceVisibleOnAllDesktops',
    'detachedVisibleOnAllDesktops',
    'hideDetachedWithMainWindow',
    'windowSnapEnabled',
  ],
  backup: ['backupEnabled', 'backupRetention', 'backupIncludeClipboard'],
};

/** 確認ダイアログに出すカテゴリ名 */
export const SETTINGS_RESET_LABELS: Record<ResettableSettingsCategory, string> = {
  basic: '基本設定',
  window: 'ウィンドウ',
  backup: 'バックアップ',
};

/** 確認ダイアログに添える、戻らない項目の注記 */
export const SETTINGS_RESET_NOTES: Partial<Record<ResettableSettingsCategory, string>> = {
  basic: 'ホットキーは変更しません。',
};

export function isResettableCategory(
  category: SettingsCategory
): category is ResettableSettingsCategory {
  return category in SETTINGS_RESET_KEYS;
}
