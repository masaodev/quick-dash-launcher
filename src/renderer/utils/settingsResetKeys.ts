import type { ParseKeys, TFunction } from 'i18next';
import { MAIN_WINDOW_DISPLAY_INDEX } from '@common/types';
import type { AppSettings } from '@common/types';

import { toWorkspacePositionOption } from './workspacePositionOptions';

/** 設定画面の左メニューのカテゴリ */
export type SettingsCategory = 'basic' | 'window' | 'backup' | 'bookmarkAutoImport';

/**
 * 「既定値に戻す」を置く枠（設定画面の見出し付きの節）
 *
 * 言語・起動ホットキー・ブックマーク自動取込の枠には置かない。
 * 言語は既定値（自動）に戻すと表示言語が急に変わり、選択欄 1 つなので戻すボタンが要らない。
 * ホットキーは利用者が意図して決めた値で、しかも hotkey は既定値が空なので、戻すと次回起動が初回起動扱いになる。
 * ブックマーク自動取込は自前の保存単位を持つ。
 */
export type ResettableSettingsSection =
  | 'system'
  | 'display'
  | 'mainWindow'
  | 'workspaceWindow'
  | 'detachedWindow'
  | 'windowOther'
  | 'backup';

/**
 * 枠ごとに「既定値に戻す」で戻す項目
 *
 * タブ構成（dataFileTabs 等）はアイテム管理で、ブックマーク自動取込はそのカテゴリで管理するので含めない。
 * 「複数タブを表示」（showDataFileTabs）も、戻すと作ったタブが急に見えなくなるので含めない。
 * 画面に出ない座標（最後に置いた場所）は、表示する場所と組で戻す。
 */
export const SETTINGS_RESET_KEYS: Record<
  ResettableSettingsSection,
  ReadonlyArray<keyof AppSettings>
> = {
  system: ['autoLaunch', 'cliEnabled', 'recordLaunchUsage'],
  display: ['showKeyboardHints', 'searchMemo', 'searchIgnoreWidth', 'searchIgnoreKana'],
  mainWindow: ['windowPositionMode', 'windowFixedPosition', 'windowWidth', 'windowHeight'],
  workspaceWindow: [
    'workspacePositionMode',
    'workspaceTargetDisplayIndex',
    'workspaceFixedPosition',
    'workspaceBackgroundTransparent',
    'workspaceOpacity',
    'workspaceVisibleOnAllDesktops',
  ],
  detachedWindow: ['detachedPositionMode', 'detachedVisibleOnAllDesktops'],
  windowOther: ['windowSnapEnabled', 'editModeWidth', 'editModeHeight'],
  backup: ['backupEnabled', 'backupRetention', 'backupIncludeClipboard'],
};

/**
 * 最後に置いた場所として覚えている座標
 *
 * 「最後に置いた場所」の間だけ使い、表示する場所を変えても残る。
 * 「既定値のままか」の判定に入れると、画面上は既定値なのに変えている扱いになるので外す。
 */
const SAVED_POSITION_KEYS: ReadonlySet<keyof AppSettings> = new Set<keyof AppSettings>([
  'windowFixedPosition',
  'workspaceFixedPosition',
]);

/** 枠の名前（見出しと同じ文言） */
const SECTION_HEADING_KEYS: Record<ResettableSettingsSection, ParseKeys> = {
  system: 'settings.system.heading',
  display: 'settings.display.heading',
  mainWindow: 'settings.windowPosition.heading',
  workspaceWindow: 'settings.workspace.heading',
  detachedWindow: 'settings.detached.heading',
  windowOther: 'settings.windowOther.heading',
  backup: 'settings.backup.heading',
};

/** 確認ダイアログの「何がどう変わるか」の 1 行 */
export interface SettingsResetChange {
  label: string;
  before: string;
  after: string;
}

/** 確認ダイアログに出す 1 行の作り方（幅と高さのように、複数の項目を 1 行にまとめるものがある） */
interface ResetRow {
  keys: ReadonlyArray<keyof AppSettings>;
  label: (t: TFunction) => string;
  format: (t: TFunction, settings: AppSettings) => string;
}

/** 項目名の末尾のコロン（「表示する場所:」）を外す */
function stripColon(text: string): string {
  return text.replace(/[:：]\s*$/, '');
}

function checkRow(key: keyof AppSettings, labelKey: ParseKeys): ResetRow {
  return {
    keys: [key],
    label: (t) => t(labelKey),
    format: (t, s) => (s[key] ? t('settings.reset.values.on') : t('settings.reset.values.off')),
  };
}

function sizeRow(
  widthKey: 'windowWidth' | 'editModeWidth',
  heightKey: 'windowHeight' | 'editModeHeight',
  labelKey: ParseKeys
): ResetRow {
  return {
    keys: [widthKey, heightKey],
    label: (t) => stripColon(t(labelKey)),
    format: (_t, s) => `${s[widthKey]} × ${s[heightKey]}`,
  };
}

const RESET_ROWS: Record<ResettableSettingsSection, ReadonlyArray<ResetRow>> = {
  system: [
    checkRow('autoLaunch', 'settings.system.autoLaunch'),
    checkRow('cliEnabled', 'settings.system.cli'),
    checkRow('recordLaunchUsage', 'settings.system.recordLaunchUsage'),
  ],
  display: [
    checkRow('showKeyboardHints', 'settings.display.keyboardHints'),
    checkRow('searchMemo', 'settings.display.searchMemo'),
    checkRow('searchIgnoreWidth', 'settings.display.searchIgnoreWidth'),
    checkRow('searchIgnoreKana', 'settings.display.searchIgnoreKana'),
  ],
  mainWindow: [
    {
      keys: ['windowPositionMode'],
      label: (t) => stripColon(t('settings.windowPosition.label')),
      format: (t, s) => t(`settings.windowPosition.${s.windowPositionMode}`),
    },
    sizeRow('windowWidth', 'windowHeight', 'settings.windowSize.heading'),
  ],
  workspaceWindow: [
    {
      keys: ['workspacePositionMode'],
      label: (t) => stripColon(t('settings.workspace.position')),
      format: (t, s) =>
        t(`settings.workspace.${toWorkspacePositionOption(s.workspacePositionMode).text}`),
    },
    {
      keys: ['workspaceTargetDisplayIndex'],
      label: (t) => t('settings.workspace.displayLabel'),
      format: (t, s) =>
        s.workspaceTargetDisplayIndex === MAIN_WINDOW_DISPLAY_INDEX
          ? t('settings.workspace.mainWindowDisplay')
          : t('settings.reset.values.display', { number: s.workspaceTargetDisplayIndex + 1 }),
    },
    checkRow('workspaceBackgroundTransparent', 'settings.workspace.backgroundTransparent'),
    {
      keys: ['workspaceOpacity'],
      label: (t) => t('settings.workspace.opacity'),
      format: (_t, s) => `${s.workspaceOpacity}%`,
    },
    checkRow('workspaceVisibleOnAllDesktops', 'settings.workspace.visibleOnAllDesktops'),
  ],
  detachedWindow: [
    {
      keys: ['detachedPositionMode'],
      label: (t) => stripColon(t('settings.detached.position')),
      format: (t, s) => t(`settings.detached.${s.detachedPositionMode}`),
    },
    checkRow('detachedVisibleOnAllDesktops', 'settings.detached.visibleOnAllDesktops'),
  ],
  windowOther: [
    checkRow('windowSnapEnabled', 'settings.windowOther.windowSnap'),
    sizeRow('editModeWidth', 'editModeHeight', 'settings.windowOther.adminWindowSize'),
  ],
  backup: [
    checkRow('backupEnabled', 'settings.backup.enabled'),
    {
      keys: ['backupRetention'],
      label: (t) => stripColon(t('settings.backup.retention')),
      format: (t, s) => `${s.backupRetention} ${t('settings.backup.retentionUnit')}`,
    },
    checkRow('backupIncludeClipboard', 'settings.backup.includeClipboard'),
  ],
};

function differs(settings: AppSettings, defaults: AppSettings, key: keyof AppSettings): boolean {
  return settings[key] !== defaults[key];
}

/** 枠の項目がすべて既定値のままか（覚えている座標は見ない） */
export function isSectionAtDefault(
  section: ResettableSettingsSection,
  settings: AppSettings,
  defaults: AppSettings
): boolean {
  return SETTINGS_RESET_KEYS[section]
    .filter((key) => !SAVED_POSITION_KEYS.has(key))
    .every((key) => !differs(settings, defaults, key));
}

/** 既定値に戻すと何がどう変わるか（既定値と同じ項目は出さない） */
export function getSectionResetChanges(
  t: TFunction,
  section: ResettableSettingsSection,
  settings: AppSettings,
  defaults: AppSettings
): { changes: SettingsResetChange[]; forgetsSavedPosition: boolean } {
  const changes = RESET_ROWS[section]
    .filter((row) => row.keys.some((key) => differs(settings, defaults, key)))
    .map((row) => ({
      label: row.label(t),
      before: row.format(t, settings),
      after: row.format(t, defaults),
    }));
  const forgetsSavedPosition = SETTINGS_RESET_KEYS[section].some(
    (key) => SAVED_POSITION_KEYS.has(key) && differs(settings, defaults, key)
  );
  return { changes, forgetsSavedPosition };
}

/** 「既定値に戻す」に出す枠の名前と、戻らない項目の注記（無ければ空） */
export function getResetSectionText(
  t: TFunction,
  section: ResettableSettingsSection
): { label: string; note: string } {
  return {
    label: t(SECTION_HEADING_KEYS[section]),
    note: section === 'display' ? t('settings.reset.notes.display') : '',
  };
}
