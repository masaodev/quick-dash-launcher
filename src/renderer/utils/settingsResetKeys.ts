import type { TFunction } from 'i18next';
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
  basic: ['autoLaunch', 'cliEnabled', 'recordLaunchUsage', 'showKeyboardHints'],
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
    'workspacePositionMode',
    'workspaceTargetDisplayIndex',
    'workspacePositionX',
    'workspacePositionY',
    'workspaceVisibleOnAllDesktops',
    'detachedVisibleOnAllDesktops',
    'detachedPositionMode',
    'windowSnapEnabled',
  ],
  backup: ['backupEnabled', 'backupRetention', 'backupIncludeClipboard'],
};

/** 「既定値に戻す」に出すカテゴリ名と、戻らない項目の注記（無ければ空） */
export function getResetCategoryText(
  t: TFunction,
  category: ResettableSettingsCategory
): { label: string; note: string } {
  return {
    label: t(`settings.reset.categories.${category}`),
    note: category === 'basic' ? t('settings.reset.notes.basic') : '',
  };
}

export function isResettableCategory(
  category: SettingsCategory
): category is ResettableSettingsCategory {
  return category in SETTINGS_RESET_KEYS;
}
