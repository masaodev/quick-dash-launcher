import { describe, it, expect, vi } from 'vitest';
import type { Logger } from 'pino';
import type { AppItem, LayoutExecutionProgress, SetItem, WindowConfig } from '@common/types';

vi.mock('electron', () => ({ ipcMain: { once: vi.fn(), removeListener: vi.fn() } }));
vi.mock('@common/logger', () => ({
  itemLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../utils/windowActivator.js', () => ({
  applyWindowConfig: vi.fn(),
  tryActivateWindow: vi.fn(),
}));
vi.mock('../../utils/nativeWindowControl.js', () => ({
  findWindowHwndByTitle: vi.fn(),
  maximizeWindow: vi.fn(),
}));
vi.mock('../../utils/itemLauncher.js', () => ({ launchItem: vi.fn() }));
vi.mock('../overlayWindowService.js', () => ({
  getLayoutProgressWindow: vi.fn(),
  showLayoutProgressWindow: vi.fn(),
  showToastWindow: vi.fn(),
  markLayoutProgressFinished: vi.fn(),
  LONG_TOAST_DURATION_MS: 6000,
}));
vi.mock('../mainI18n.js', () => ({ mainI18n: { t: (key: string) => key } }));

import { buildSetWindowConfig, executeSet, type SetExecutorDeps } from './setExecutor';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;

const items: Record<string, AppItem> = {
  gmail1aa: {
    id: 'gmail1aa',
    type: 'url',
    displayName: 'Gmail',
    path: 'https://mail.google.com/',
  },
  term1aaa: {
    id: 'term1aaa',
    type: 'app',
    displayName: 'Windows Terminal',
    path: 'wt.exe',
    windowConfig: { title: '*Terminal*' },
  },
};

/** 呼ばれた順を記録する偽の部品。windows は「今開いているウィンドウ」（findWindow が探す） */
function makeDeps(windows: { hwnd: bigint; title: string; processName: string }[] = []) {
  const calls: string[] = [];
  const opened = [...windows];
  const deps: SetExecutorDeps = {
    launch: vi.fn(async (item) => {
      calls.push(`launch:${item.path}`);
      // Obsidian は開くとすぐウィンドウが出る想定
      if (item.path.endsWith('Obsidian.exe')) {
        opened.push({ hwnd: 99n, title: 'note - Obsidian', processName: 'Obsidian.exe' });
      }
    }),
    findWindow: vi.fn((config: WindowConfig, exclude?: ReadonlySet<bigint>) => {
      const found = opened.find(
        (w) =>
          !exclude?.has(w.hwnd) &&
          (!config.processName || w.processName.includes(config.processName)) &&
          (config.title === '*' || w.title.includes(config.title.replace(/\*/g, '')))
      );
      return found?.hwnd ?? null;
    }),
    applyConfig: vi.fn(async (hwnd: bigint | number) => {
      calls.push(`place:${hwnd}`);
      return { activated: true, windowFound: true };
    }),
    activate: vi.fn(async (config: WindowConfig | undefined) => {
      if (!config) return { activated: false, windowFound: false };
      const hit = deps.findWindow(config);
      calls.push(`activate:${config.title}:${hit !== null}`);
      return { activated: hit !== null, windowFound: hit !== null };
    }),
    maximize: vi.fn((hwnd: bigint) => {
      calls.push(`maximize:${hwnd}`);
      return true;
    }),
    sleep: vi.fn(async () => {}),
  };
  return { deps, calls };
}

const resolve = (id: string) => items[id];

describe('executeSet', () => {
  it('名前だけ残した行（旧グループで見つからなかった名前）は、参照先が見つからないとして失敗し、残りは続ける', async () => {
    const { deps, calls } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: '旧グループ',
      entries: [{ label: '消したアイテム' }, { itemId: 'gmail1aa' }],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['launch:https://mail.google.com/']);
    expect(result.entries[0]).toEqual({
      index: 0,
      name: '消したアイテム',
      success: false,
      error: 'set.errors.itemNotFound',
    });
    expect(result.successCount).toBe(1);
  });

  it('置き場所の無い行は、ウィンドウ設定があれば前面に出し、無ければ開く', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'Windows Terminal', processName: 'WindowsTerminal.exe' },
    ]);
    const set: SetItem = {
      type: 'set',
      displayName: '朝の準備',
      entries: [{ itemId: 'gmail1aa' }, { itemId: 'term1aaa' }],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['launch:https://mail.google.com/', 'activate:*Terminal*:true']);
    expect(result.successCount).toBe(2);
  });

  it('同じアプリのウィンドウが 2 つあり、見つけ方が同じ行が 2 つあると、別々のウィンドウを動かす', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: '文字コード表', processName: 'charmap.exe' },
      { hwnd: 2n, title: '文字コード表', processName: 'charmap.exe' },
    ]);
    const set: SetItem = {
      type: 'set',
      displayName: '並べる',
      entries: [
        { window: { processName: 'charmap.exe' }, placement: { x: 0, y: 0 } },
        {
          window: { processName: 'charmap.exe', title: '文字コード表' },
          placement: { x: 500, y: 0 },
        },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['place:1', 'place:2']);
  });

  it('置き場所のある行は、開いていれば開き直さず位置を合わせ、最大化も当てる', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'QDL_main', processName: 'WindowsTerminal.exe' },
    ]);
    const set: SetItem = {
      type: 'set',
      displayName: '並べる',
      entries: [
        {
          itemId: 'term1aaa',
          window: { processName: 'WindowsTerminal.exe' },
          placement: { x: 0, y: 0, width: 960, height: 1040, state: 'maximized' },
        },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['place:1', 'maximize:1']);
  });

  it('無ければ開いてウィンドウが出るのを待ってから位置を合わせる', async () => {
    const { deps, calls } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: '並べる',
      entries: [
        {
          open: { path: 'C:\\Apps\\Obsidian\\Obsidian.exe' },
          window: { processName: 'Obsidian.exe' },
          placement: { x: 960, y: 0, width: 960, height: 520 },
        },
      ],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['launch:C:\\Apps\\Obsidian\\Obsidian.exe', 'place:99']);
    expect(result.errorCount).toBe(0);
  });

  it('待ちきれなければその行だけ失敗にし、ほかの行は続ける', async () => {
    const { deps } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: '並べる',
      launchMode: 'parallel',
      entries: [
        {
          open: { path: 'C:\\Apps\\never.exe' },
          window: { processName: 'never.exe' },
          placement: { x: 0, y: 0, width: 100, height: 100 },
          waitSeconds: 1,
        },
        { itemId: 'gmail1aa' },
      ],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(result.entries).toEqual([
      { index: 0, name: 'never.exe', success: false, error: 'layout.timedOut' },
      { index: 1, name: 'Gmail', success: true },
    ]);
  });

  it('参照先が無い行は失敗、動かすだけでウィンドウが開いていない行は失敗にせず飛ばす', async () => {
    const { deps } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: '壊れた',
      entries: [
        { itemId: 'missing1', label: '消したアイテム' },
        { window: { processName: 'sticky.exe' }, placement: { x: 0, y: 0 } },
        { window: { processName: 'sticky.exe' } },
      ],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(result.entries).toEqual([
      { index: 0, name: '消したアイテム', success: false, error: 'set.errors.itemNotFound' },
      { index: 1, name: 'sticky.exe', success: true, skipped: true },
      { index: 2, name: 'sticky.exe', success: true, skipped: true },
    ]);
    expect(result.errorCount).toBe(1);
  });

  it('飛ばした行は、進み具合の表示に skipped と理由で出す', async () => {
    const { deps } = makeDeps();
    const sent: LayoutExecutionProgress[] = [];
    deps.progress = {
      show: vi.fn(async () => {}),
      send: vi.fn((_event, progress) => {
        sent.push(structuredClone(progress));
      }),
      onCancel: vi.fn(() => () => {}),
    };
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [{ window: { processName: 'sticky.exe' }, placement: { x: 0, y: 0 } }],
    };
    await executeSet(set, resolve, deps, logger);
    const last = sent[sent.length - 1].entries[0];
    expect(last.status).toBe('skipped');
    expect(last.errorMessage).toBe('set.run.notOpen');
  });

  it('順番に開くときは、行の間で待つ', async () => {
    const { deps } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: '順番',
      entries: [{ itemId: 'gmail1aa' }, { itemId: 'gmail1aa' }, { itemId: 'gmail1aa' }],
    };
    await executeSet(set, resolve, deps, logger);
    expect(deps.sleep).toHaveBeenCalledTimes(2);
  });

  it('同じセットを実行中にもう一度開いても重ねて開かず、終わればまた開ける', async () => {
    const { deps, calls } = makeDeps();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    deps.launch = vi.fn(async (item) => {
      calls.push(`launch:${item.path}`);
      await gate;
    });
    const set: SetItem = {
      id: 'set1aaaa',
      type: 'set',
      displayName: '朝',
      entries: [{ itemId: 'gmail1aa' }],
    };
    const first = executeSet(set, resolve, deps, logger);
    const second = await executeSet(set, resolve, deps, logger);
    expect(second.skipped).toBe(true);
    release();
    await first;
    expect(calls).toEqual(['launch:https://mail.google.com/']);
    const third = await executeSet(set, resolve, deps, logger);
    expect(third.skipped).toBeUndefined();
  });

  it('見つかったが前面に出すのを断られても、開き直さない', async () => {
    const { deps, calls } = makeDeps();
    deps.activate = vi.fn(async () => ({ activated: false, windowFound: true }));
    const set: SetItem = { type: 'set', displayName: 'x', entries: [{ itemId: 'term1aaa' }] };
    const result = await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual([]);
    expect(result.successCount).toBe(1);
  });

  it('位置の無い動かすだけの行は、開いていれば前面に出して成功にする', async () => {
    const { deps, calls } = makeDeps([{ hwnd: 5n, title: 'メモ', processName: 'sticky.exe' }]);
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [{ window: { processName: 'sticky.exe' } }],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['activate:*:true']);
    expect(result.successCount).toBe(1);
  });
  it('進み具合の表示に送れなくても、終わりを送り、次の実行を止めない', async () => {
    const { deps } = makeDeps([{ hwnd: 1n, title: 'x', processName: 'sticky.exe' }]);
    const sent: string[] = [];
    let removed = false;
    deps.progress = {
      show: vi.fn(async () => {}),
      send: vi.fn((event: string) => {
        sent.push(event);
        if (event === 'update') throw new Error('send failed');
      }),
      onCancel: vi.fn(() => () => {
        removed = true;
      }),
    };
    const set: SetItem = {
      id: 'set2bbbb',
      type: 'set',
      displayName: 'x',
      entries: [{ window: { processName: 'sticky.exe' }, placement: { x: 0, y: 0 } }],
    };
    await expect(executeSet(set, resolve, deps, logger)).rejects.toThrow('send failed');
    expect(sent).toContain('complete');
    expect(removed).toBe(true);
    deps.progress = undefined;
    const again = await executeSet(set, resolve, deps, logger);
    expect(again.skipped).toBeUndefined();
  });
});

describe('buildSetWindowConfig', () => {
  const launch = (path: string) => ({
    name: 'x',
    launch: { type: 'app' as const, path, displayName: 'x' },
  });
  it('開くものが exe なら exe 名で探し、.lnk などは推測しない', () => {
    const placement = { placement: { x: 0, y: 0 } };
    expect(buildSetWindowConfig(placement, launch('C:/Apps/Foo.exe'))?.processName).toBe('Foo.exe');
    expect(buildSetWindowConfig(placement, launch('C:/Apps/Foo.lnk'))).toBeUndefined();
    expect(
      buildSetWindowConfig(placement, launch('shell:AppsFolder/Microsoft.X_8wekyb3d8bbwe!App'))
    ).toBeUndefined();
  });
});
