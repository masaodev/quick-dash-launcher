import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import type { AppSettings } from '@common/types';

import {
  SETTINGS_RESET_KEYS,
  getSectionResetChanges,
  isSectionAtDefault,
  type ResettableSettingsSection,
} from './settingsResetKeys';

/** 文言キーをそのまま返す t（差し込みの number があれば「キー|値」） */
const t = ((key: string, options?: Record<string, unknown>) =>
  options?.number !== undefined ? `${key}|${options.number}` : key) as unknown as TFunction;

/** 戻す項目の既定値（main の SettingsService.DEFAULT_SETTINGS と同じ値） */
const defaults = {
  autoLaunch: true,
  cliEnabled: false,
  recordLaunchUsage: true,
  showKeyboardHints: true,
  searchMemo: false,
  windowPositionMode: 'cursorMonitorCenter',
  windowFixedPosition: null,
  windowWidth: 600,
  windowHeight: 400,
  workspacePositionMode: 'displayRight',
  workspaceTargetDisplayIndex: -1,
  workspaceFixedPosition: null,
  workspaceBackgroundTransparent: false,
  workspaceOpacity: 100,
  workspaceVisibleOnAllDesktops: true,
  detachedPositionMode: 'mainDisplay',
  detachedVisibleOnAllDesktops: true,
  windowSnapEnabled: true,
  editModeWidth: 1200,
  editModeHeight: 1000,
  backupEnabled: true,
  backupRetention: 10,
  backupIncludeClipboard: false,
} as AppSettings;

describe('SETTINGS_RESET_KEYS', () => {
  it('ホットキーを含まないこと（空に戻すと次回起動が初回起動扱いになる）', () => {
    for (const keys of Object.values(SETTINGS_RESET_KEYS)) {
      expect(keys).not.toContain('hotkey');
      expect(keys).not.toContain('itemSearchHotkey');
    }
  });

  it('言語を含まないこと（戻すと表示言語が急に変わる）', () => {
    for (const keys of Object.values(SETTINGS_RESET_KEYS)) {
      expect(keys).not.toContain('language');
    }
  });

  it('タブ構成とブックマーク自動取込を含まないこと（別カテゴリで管理する）', () => {
    for (const keys of Object.values(SETTINGS_RESET_KEYS)) {
      expect(keys).not.toContain('showDataFileTabs');
      expect(keys).not.toContain('dataFileTabs');
      expect(keys).not.toContain('dataFileLabels');
      expect(keys).not.toContain('defaultFileTab');
      expect(keys).not.toContain('bookmarkAutoImport');
    }
  });

  it('メタ情報（$schema・バージョン）を含まないこと', () => {
    for (const keys of Object.values(SETTINGS_RESET_KEYS)) {
      expect(keys).not.toContain('$schema');
      expect(keys).not.toContain('createdWithVersion');
      expect(keys).not.toContain('updatedWithVersion');
    }
  });

  it('枠の間で項目が重複しないこと', () => {
    const all = Object.values(SETTINGS_RESET_KEYS).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('タブ単位で戻していたころの項目が、すべてどれかの枠に入っていること', () => {
    const all = Object.values(SETTINGS_RESET_KEYS).flat();
    expect(new Set(all)).toEqual(new Set(Object.keys(defaults)));
  });
});

describe('isSectionAtDefault', () => {
  it('既定値のままなら true', () => {
    for (const section of Object.keys(SETTINGS_RESET_KEYS) as ResettableSettingsSection[]) {
      expect(isSectionAtDefault(section, defaults, defaults)).toBe(true);
    }
  });

  it('その枠の項目を変えていれば false で、ほかの枠は true のまま', () => {
    const settings = { ...defaults, workspaceOpacity: 85 };
    expect(isSectionAtDefault('workspaceWindow', settings, defaults)).toBe(false);
    expect(isSectionAtDefault('mainWindow', settings, defaults)).toBe(true);
  });

  it('覚えている座標だけが違うときは既定値のまま扱う（画面上は既定値なので）', () => {
    const settings = {
      ...defaults,
      workspaceFixedPosition: { x: 1200, y: 0 },
      windowFixedPosition: { x: 0, y: 300 },
    };
    expect(isSectionAtDefault('workspaceWindow', settings, defaults)).toBe(true);
    expect(isSectionAtDefault('mainWindow', settings, defaults)).toBe(true);
  });
});

describe('getSectionResetChanges', () => {
  it('変わる項目だけを「今 → 既定値」で返す', () => {
    const settings = {
      ...defaults,
      workspacePositionMode: 'displayLeft',
      workspaceOpacity: 85,
    } as AppSettings;
    const { changes, forgetsSavedPosition } = getSectionResetChanges(
      t,
      'workspaceWindow',
      settings,
      defaults
    );
    expect(changes).toEqual([
      {
        label: 'settings.workspace.position',
        before: 'settings.workspace.leftEdge',
        after: 'settings.workspace.rightEdge',
      },
      { label: 'settings.workspace.opacity', before: '85%', after: '100%' },
    ]);
    expect(forgetsSavedPosition).toBe(false);
  });

  it('幅と高さは 1 行にまとめる', () => {
    const settings = { ...defaults, windowWidth: 800 };
    const { changes } = getSectionResetChanges(t, 'mainWindow', settings, defaults);
    expect(changes).toEqual([
      { label: 'settings.windowSize.heading', before: '800 × 400', after: '600 × 400' },
    ]);
  });

  it('ディスプレイは番号を 1 から数えて出す', () => {
    const settings = { ...defaults, workspaceTargetDisplayIndex: 1 };
    const { changes } = getSectionResetChanges(t, 'workspaceWindow', settings, defaults);
    expect(changes).toEqual([
      {
        label: 'settings.workspace.displayLabel',
        before: 'settings.reset.values.display|2',
        after: 'settings.workspace.mainWindowDisplay',
      },
    ]);
  });

  it('覚えている座標が違えば、位置も忘れることを知らせる', () => {
    const settings = {
      ...defaults,
      windowPositionMode: 'fixed',
      windowFixedPosition: { x: 100, y: 50 },
    } as AppSettings;
    const { changes, forgetsSavedPosition } = getSectionResetChanges(
      t,
      'mainWindow',
      settings,
      defaults
    );
    expect(changes).toHaveLength(1);
    expect(forgetsSavedPosition).toBe(true);
  });

  it('オン・オフの項目は文言で出す', () => {
    const settings = { ...defaults, autoLaunch: false };
    const { changes } = getSectionResetChanges(t, 'system', settings, defaults);
    expect(changes).toEqual([
      {
        label: 'settings.system.autoLaunch',
        before: 'settings.reset.values.off',
        after: 'settings.reset.values.on',
      },
    ]);
  });
});
