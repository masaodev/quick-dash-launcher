import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AppSettings } from '@common/types';

import AdminSettingsBasicSection from './AdminSettingsBasicSection';

let distribution = 'installer';

// 表示に使う項目だけを持つ設定（節の「既定に戻す」は既定と同じ値なので出ない）
const settings = {
  language: 'auto',
  hotkey: 'Alt+Space',
  itemSearchHotkey: '',
  autoLaunch: true,
  cliEnabled: false,
  updateCheckEnabled: true,
  updateCheckIncludeBeta: false,
  recordLaunchUsage: true,
  searchMemo: false,
  searchIgnoreWidth: false,
  searchIgnoreKana: false,
  searchSortByUsage: false,
  launchInheritEnvironment: true,
} as unknown as AppSettings;

beforeEach(() => {
  distribution = 'installer';
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      getAppInfo: vi.fn(async () => ({ distribution })),
      getAutoLaunchStatus: vi.fn(async () => null),
      onSettingsChanged: () => () => undefined,
      validateHotkey: vi.fn(async () => ({ isValid: true })),
      setHotkeyRecording: vi.fn(async () => undefined),
    },
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'electronAPI');
});

function renderSection() {
  render(
    <AdminSettingsBasicSection
      editedSettings={settings}
      isLoading={false}
      handleSettingChange={vi.fn()}
      hotkeyValidation={{ isValid: true }}
      onHotkeyValidation={vi.fn()}
      onItemSearchHotkeyChange={vi.fn()}
      sectionReset={{ defaults: settings, onReset: vi.fn() }}
    />
  );
}

describe('AdminSettingsBasicSection の Quick Dash Launcher CLI の節', () => {
  it('ZIP 版・インストーラー版では「qdl コマンドを使えるようにする」のチェックボックスを出す', async () => {
    renderSection();
    expect(
      await screen.findByRole('checkbox', { name: 'qdl コマンドを使えるようにする' })
    ).toBeTruthy();
    expect(screen.queryByText(/アプリ実行エイリアス/)).toBeNull();
  });

  it('Store 版ではチェックボックスを出さず、そのまま使えることと止め方を出す', async () => {
    distribution = 'store';
    renderSection();
    expect(await screen.findByText(/qdl コマンドは、ターミナルでそのまま使えます/)).toBeTruthy();
    expect(screen.getByText(/アプリ実行エイリアス/)).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'qdl コマンドを使えるようにする' })).toBeNull();
  });
});
