import type { AppSettings } from '@common/types';

/** 設定画面の左メニューのカテゴリ */
export type SettingsCategory = 'basic' | 'window' | 'tabs' | 'backup' | 'bookmarkAutoImport';

/** 「既定値に戻す」を置くカテゴリ（タブ管理・ブックマーク自動取込は自前の保存単位を持つので対象外） */
export type ResettableSettingsCategory = Extract<SettingsCategory, 'basic' | 'window' | 'backup'>;

/**
 * カテゴリごとに「既定値に戻す」で戻す項目
 *
 * ホットキー（hotkey / itemSearchHotkey）は含めない。既定値が空で、空に戻すと
 * 次回起動が初回起動扱いになるうえ、利用者が意図して決めた値だから。
 * タブ構成（dataFileTabs 等）とブックマーク自動取込も、それぞれのカテゴリで管理するので含めない。
 */
export const SETTINGS_RESET_KEYS: Record<
  ResettableSettingsCategory,
  ReadonlyArray<keyof AppSettings>
> = {
  basic: ['autoLaunch', 'parallelGroupLaunch'],
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
