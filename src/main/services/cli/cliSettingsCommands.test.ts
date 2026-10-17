import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings } from '@common/types';

import { CliError } from './cliArgs';
import { runSettingsCommand, WRITABLE_SETTING_KEYS } from './cliSettingsCommands';
import type { HotkeyKey, SettingsCommandContext, SettingsStore } from './cliSettingsCommands';

let settings: AppSettings;
let unavailable: Set<string>;
let registerFails: boolean;
let store: SettingsStore;
let ctx: SettingsCommandContext;

beforeEach(() => {
  settings = {
    language: 'auto',
    hotkey: 'Alt+Space',
    itemSearchHotkey: 'Ctrl+Alt+Space',
    windowWidth: 600,
    windowHeight: 400,
    autoLaunch: true,
    cliEnabled: true,
    defaultFileTab: 'datafiles/data.json',
    dataFileTabs: [
      { name: 'メイン', files: ['datafiles/data.json'] },
      { name: '仕事', files: ['datafiles/data2.json'] },
    ],
    workspaceOpacity: 100,
    workspacePositionMode: 'displayRight',
    workspaceTargetDisplayIndex: 0,
    windowPositionX: 0,
    showKeyboardHints: true,
  } as AppSettings;
  unavailable = new Set(['Ctrl+Shift+Esc']);
  registerFails = false;
  store = {
    load: async () => structuredClone(settings),
    displayCount: () => 2,
    validateHotkey: async (hotkey) =>
      hotkey.includes('+') ? { isValid: true } : { isValid: false, reason: '修飾キーが必要' },
    isHotkeyAvailable: (hotkey: string, key: HotkeyKey) => {
      const other = key === 'hotkey' ? settings.itemSearchHotkey : settings.hotkey;
      return hotkey !== other && !unavailable.has(hotkey);
    },
    changeHotkey: vi.fn(async (key: HotkeyKey, hotkey: string) => {
      settings[key] = hotkey;
      return !registerFails;
    }),
    save: vi.fn(async (partial: Partial<AppSettings>) => {
      settings = { ...settings, ...partial };
    }),
  };
  ctx = { store, changed: vi.fn() };
});

async function errorOf(promise: Promise<unknown>): Promise<CliError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error('失敗しなかった');
}

const run = (verb: string | undefined, ...args: string[]) => runSettingsCommand(verb, args, ctx);

describe('settings get', () => {
  it('キーを省くと全項目と変えられるキーを返す', async () => {
    const result = (await run('get')) as { settings: AppSettings; writable: string[] };
    expect(result.settings.hotkey).toBe('Alt+Space');
    expect(result.writable).toEqual(WRITABLE_SETTING_KEYS);
    expect(result.writable).not.toContain('autoLaunch');
  });

  it('1 項目の値と、変えられるかを返す', async () => {
    expect(await run('get', 'windowWidth')).toEqual({
      key: 'windowWidth',
      value: 600,
      writable: true,
    });
    expect(await run('get', 'autoLaunch')).toEqual({
      key: 'autoLaunch',
      value: true,
      writable: false,
    });
  });

  it('無いキーは not_found', async () => {
    expect((await errorOf(run('get', 'windowwidth'))).code).toBe('not_found');
  });

  it('キーを 2 つ渡すと usage', async () => {
    expect((await errorOf(run('get', 'hotkey', 'language'))).code).toBe('usage');
  });
});

describe('settings set', () => {
  it('数値を変えて保存し、トーストを出す', async () => {
    const result = await run('set', 'windowWidth', '800');
    expect(result).toEqual({ key: 'windowWidth', before: 600, after: 800 });
    expect(store.save).toHaveBeenCalledWith({ windowWidth: 800 });
    expect(ctx.changed).toHaveBeenCalledOnce();
  });

  it('--dry-run では保存しない', async () => {
    const result = await run('set', 'language', 'en', '--dry-run');
    expect(result).toEqual({ dryRun: true, key: 'language', before: 'auto', after: 'en' });
    expect(store.save).not.toHaveBeenCalled();
    expect(ctx.changed).not.toHaveBeenCalled();
  });

  it('同じ値なら保存せず unchanged を返す', async () => {
    expect(await run('set', 'showKeyboardHints', 'true')).toEqual({
      key: 'showKeyboardHints',
      before: true,
      after: true,
      unchanged: true,
    });
    expect(store.save).not.toHaveBeenCalled();
  });

  it('真偽値は true / false だけ', async () => {
    await run('set', 'showKeyboardHints', 'false');
    expect(settings.showKeyboardHints).toBe(false);
    expect((await errorOf(run('set', 'showKeyboardHints', 'yes'))).code).toBe('invalid');
  });

  it('範囲の外・整数でない値は invalid', async () => {
    expect((await errorOf(run('set', 'windowWidth', '399'))).code).toBe('invalid');
    expect((await errorOf(run('set', 'workspaceOpacity', '101'))).code).toBe('invalid');
    expect((await errorOf(run('set', 'windowHeight', '1.5'))).code).toBe('invalid');
    expect(store.save).not.toHaveBeenCalled();
  });

  it('座標は負の数も受け付ける', async () => {
    await run('set', 'windowPositionX', '-1920');
    expect(settings.windowPositionX).toBe(-1920);
  });

  it('選択肢の外は invalid（古い primaryLeft も選ばせない）', async () => {
    expect((await errorOf(run('set', 'language', 'fr'))).code).toBe('invalid');
    expect((await errorOf(run('set', 'workspacePositionMode', 'primaryLeft'))).code).toBe(
      'invalid'
    );
  });

  it('ディスプレイの番号は接続している数まで', async () => {
    await run('set', 'workspaceTargetDisplayIndex', '1');
    expect(settings.workspaceTargetDisplayIndex).toBe(1);
    expect((await errorOf(run('set', 'workspaceTargetDisplayIndex', '2'))).code).toBe('invalid');
  });

  it('起動時のタブは、タブに入っているデータファイルで指す', async () => {
    await run('set', 'defaultFileTab', 'data2.json');
    expect(settings.defaultFileTab).toBe('datafiles/data2.json');
    expect((await errorOf(run('set', 'defaultFileTab', 'data9'))).code).toBe('not_found');
  });

  it('読むだけの項目は usage で断る', async () => {
    for (const key of ['autoLaunch', 'cliEnabled', 'dataFileTabs']) {
      expect((await errorOf(run('set', key, 'false'))).code).toBe('usage');
    }
    expect(store.save).not.toHaveBeenCalled();
  });

  it('無いキーは not_found、値が無ければ usage', async () => {
    expect((await errorOf(run('set', 'nope', '1'))).code).toBe('not_found');
    expect((await errorOf(run('set', 'windowWidth'))).code).toBe('usage');
  });

  it('操作が無い・知らない操作は usage', async () => {
    expect((await errorOf(run(undefined))).code).toBe('usage');
    expect((await errorOf(run('reset'))).code).toBe('usage');
  });
});

describe('settings set（ホットキー）', () => {
  it('画面と同じ処理で変える（save は使わない）', async () => {
    const result = await run('set', 'hotkey', 'Ctrl+Alt+Q');
    expect(result).toEqual({ key: 'hotkey', before: 'Alt+Space', after: 'Ctrl+Alt+Q' });
    expect(store.changeHotkey).toHaveBeenCalledWith('hotkey', 'Ctrl+Alt+Q');
    expect(store.save).not.toHaveBeenCalled();
  });

  it('形式が正しくなければ invalid', async () => {
    expect((await errorOf(run('set', 'hotkey', 'Q'))).code).toBe('invalid');
  });

  it('使用中・もう一方と同じなら conflict（dry-run でも）', async () => {
    expect((await errorOf(run('set', 'hotkey', 'Ctrl+Shift+Esc', '--dry-run'))).code).toBe(
      'conflict'
    );
    expect((await errorOf(run('set', 'itemSearchHotkey', 'Alt+Space'))).code).toBe('conflict');
    expect(store.changeHotkey).not.toHaveBeenCalled();
  });

  it('ランチャーのキーは空にできず、ウィンドウ検索は空で無効にできる', async () => {
    expect((await errorOf(run('set', 'hotkey', ''))).code).toBe('invalid');
    await run('set', 'itemSearchHotkey', '');
    expect(store.changeHotkey).toHaveBeenCalledWith('itemSearchHotkey', '');
  });

  it('登録に失敗したら元のキーに戻して conflict', async () => {
    registerFails = true;
    expect((await errorOf(run('set', 'hotkey', 'Ctrl+Alt+Q'))).code).toBe('conflict');
    expect(store.changeHotkey).toHaveBeenLastCalledWith('hotkey', 'Alt+Space');
    expect(settings.hotkey).toBe('Alt+Space');
    expect(ctx.changed).not.toHaveBeenCalled();
  });
});
