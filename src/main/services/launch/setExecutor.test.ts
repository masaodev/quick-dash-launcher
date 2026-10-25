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
vi.mock('../../utils/virtualDesktop/index.js', () => ({
  getDesktopCount: vi.fn(() => -1),
  getWindowDesktopNumber: vi.fn(() => -1),
}));
vi.mock('../overlayWindowService.js', () => ({
  getLayoutProgressWindow: vi.fn(),
  showLayoutProgressWindow: vi.fn(),
  showToastWindow: vi.fn(),
  markLayoutProgressFinished: vi.fn(),
}));
vi.mock('../mainI18n.js', () => ({ mainI18n: { t: (key: string) => key } }));

import { showToastWindow } from '../overlayWindowService.js';
import type { LaunchResult } from '../../utils/itemLauncher';

import {
  buildSetWindowConfig,
  executeLauncherItem,
  executeSet,
  notifyLauncherItemFailure,
  type ExecutableLauncherItem,
  type SetExecutorDeps,
} from './setExecutor';

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
    window: { title: '*Terminal*' },
    activateWindow: true,
  },
  miss1aaa: {
    id: 'miss1aaa',
    type: 'app',
    displayName: '消えたアプリ',
    path: 'C:/missing/tool.exe',
  },
  todo1aaa: {
    id: 'todo1aaa',
    type: 'windowSwitch',
    displayName: 'MS To Do',
    path: '',
    window: { processName: 'ApplicationFrameHost.exe', title: 'Microsoft To Do' },
    placement: { x: 10, y: 20, width: 300, height: 400 },
  },
};

/** 呼ばれた順を記録する偽の部品。windows は「今開いているウィンドウ」（findWindow が探す） */
function makeDeps(windows: { hwnd: bigint; title: string; processName: string }[] = []) {
  const calls: string[] = [];
  const opened = [...windows];
  const deps: SetExecutorDeps = {
    launch: vi.fn(async (item): Promise<LaunchResult> => {
      calls.push(`launch:${item.path}`);
      // Obsidian は開くとすぐウィンドウが出る想定
      if (item.path.endsWith('Obsidian.exe')) {
        opened.push({ hwnd: 99n, title: 'note - Obsidian', processName: 'Obsidian.exe' });
      }
      // 「missing」を含むパスは開けない想定
      if (item.path.includes('missing')) return { success: false, error: '見つかりません' };
      return { success: true };
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
  it('行は指すアイテムの「常に管理者として実行」を開くときに渡し、UAC で「いいえ」なら失敗にせず飛ばす', async () => {
    const { deps } = makeDeps();
    vi.mocked(deps.launch).mockResolvedValueOnce({ success: false, error: '', cancelled: true });
    const admin: AppItem = {
      id: 'admin1aa',
      type: 'app',
      displayName: '管理ツール',
      path: 'C:/Tools/admin.exe',
      runAsAdmin: true,
    };
    const set: SetItem = {
      type: 'set',
      displayName: '管理者のセット',
      entries: [{ itemId: 'admin1aa' }, { itemId: 'gmail1aa' }],
    };
    const result = await executeSet(
      set,
      (id) => (id === 'admin1aa' ? admin : items[id]),
      deps,
      logger
    );
    expect(deps.launch).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'C:/Tools/admin.exe', runAsAdmin: true }),
      logger
    );
    expect(deps.launch).toHaveBeenCalledWith(
      expect.not.objectContaining({ runAsAdmin: true }),
      logger
    );
    expect(result.errorCount).toBe(0);
    expect(result.entries.find((e) => e.index === 0)).toMatchObject({
      success: true,
      skipped: true,
      adminCancelled: true,
    });
  });

  it('開けなかった行は、待たずにその理由で失敗にする（置き場所の有無によらない）', async () => {
    const { deps } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: '開けない',
      entries: [
        { itemId: 'miss1aaa' },
        {
          itemId: 'miss1aaa',
          window: { processName: 'tool.exe' },
          placement: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(result.errorCount).toBe(2);
    expect(result.entries.map((e) => e.error)).toEqual(['見つかりません', '見つかりません']);
    // 開けなかったのでウィンドウが出るのを待たない（500ms おきに探す待ちが無い）
    expect(deps.sleep).not.toHaveBeenCalledWith(500);
  });

  it('合うウィンドウが複数のデスクトップにあれば、置く先のデスクトップのものを動かす', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'a.png - ペイント', processName: 'mspaint.exe' },
      { hwnd: 2n, title: 'b.png - ペイント', processName: 'mspaint.exe' },
    ]);
    deps.desktopOf = (hwnd) => (hwnd === 2n ? 2 : 1);
    const set: SetItem = {
      type: 'set',
      displayName: 'デスクトップ 2',
      entries: [
        {
          window: { processName: 'mspaint.exe', title: '*' },
          placement: { x: 0, y: 0, width: 100, height: 100, virtualDesktopNumber: 2 },
        },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['place:2']);
  });

  it('置く先のデスクトップに合うウィンドウが無ければ、最初に見つかったものを動かす', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'a.png - ペイント', processName: 'mspaint.exe' },
      { hwnd: 2n, title: 'b.png - ペイント', processName: 'mspaint.exe' },
    ]);
    deps.desktopOf = () => 1;
    const set: SetItem = {
      type: 'set',
      displayName: 'デスクトップ 3',
      entries: [
        {
          window: { processName: 'mspaint.exe', title: '*' },
          placement: { x: 0, y: 0, width: 100, height: 100, virtualDesktopNumber: 3 },
        },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual(['place:1']);
  });

  it('今は無いデスクトップの行は、番号を外して位置だけ合わせ、失敗として知らせる', async () => {
    const { deps } = makeDeps([
      { hwnd: 1n, title: 'a.png - ペイント', processName: 'mspaint.exe' },
    ]);
    deps.desktopCount = () => 2;
    const set: SetItem = {
      type: 'set',
      displayName: '減らした後',
      entries: [
        {
          window: { processName: 'mspaint.exe', title: '*a.png*' },
          placement: { x: 0, y: 0, width: 100, height: 100, virtualDesktopNumber: 5 },
        },
      ],
    };
    const result = await executeSet(set, resolve, deps, logger);
    const applied = vi.mocked(deps.applyConfig).mock.calls[0][1];
    expect(applied.virtualDesktopNumber).toBeUndefined();
    expect(applied.x).toBe(0);
    expect(result.entries[0]).toMatchObject({ success: false, error: 'set.run.desktopNotFound' });
  });

  it('位置のある行は、activateWindow が true のときだけ前面に出す（既定は出さない）', async () => {
    // 同じウィンドウを 2 行で取り合わないよう、行ごとに別のウィンドウを用意する
    const { deps } = makeDeps(
      [1n, 2n, 3n].map((hwnd) => ({
        hwnd,
        title: 'a.png - ペイント',
        processName: 'mspaint.exe',
      }))
    );
    const entry = {
      window: { processName: 'mspaint.exe', title: '*a.png*' },
      placement: { x: 0, y: 0, width: 100, height: 100 },
    };
    const set: SetItem = {
      type: 'set',
      displayName: '前面',
      entries: [entry, { ...entry, activateWindow: true }, { ...entry, activateWindow: false }],
    };
    await executeSet(set, resolve, deps, logger);
    const activates = vi.mocked(deps.applyConfig).mock.calls.map((c) => c[1].activateWindow);
    expect(activates).toEqual([false, true, false]);
  });

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

  it('置き場所の無い行がアイテムを指すとき、アイテムのウィンドウ切り替えの位置・ピン止めも当てる', async () => {
    const { deps } = makeDeps([
      { hwnd: 1n, title: 'memo.txt - sakura', processName: 'sakura.exe' },
    ]);
    const withSwitch: Record<string, AppItem> = {
      memo1aaa: {
        id: 'memo1aaa',
        type: 'file',
        displayName: 'メモ',
        path: 'C:\\memo.txt',
        window: { processName: 'sakura.exe' },
        placement: { x: 10, y: 20 },
        activateWindow: false,
        pinToAllDesktops: true,
      },
    };
    const set: SetItem = { type: 'set', displayName: 'x', entries: [{ itemId: 'memo1aaa' }] };
    await executeSet(set, (id) => withSwitch[id], deps, logger);
    expect(deps.activate).toHaveBeenCalledWith(
      {
        title: '*',
        processName: 'sakura.exe',
        x: 10,
        y: 20,
        activateWindow: false,
        pinToAllDesktops: true,
      },
      'メモ',
      logger
    );
  });

  it('行の「全デスクトップに表示」は、位置のある行ではウィンドウ位置と一緒にピン止めを当てる', async () => {
    const { deps } = makeDeps([
      { hwnd: 1n, title: 'memo.txt - sakura', processName: 'sakura.exe' },
    ]);
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [
        {
          window: { processName: 'sakura.exe' },
          placement: { x: 10, y: 20, width: 300, height: 200 },
          pinToAllDesktops: true,
        },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(deps.applyConfig).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({ x: 10, y: 20, pinToAllDesktops: true }),
      expect.any(String),
      logger
    );
  });

  it('行の「全デスクトップに表示」は、位置の無い行でもピン止めを当てる（動かすだけの行・開く行）', async () => {
    const { deps } = makeDeps([
      { hwnd: 1n, title: 'memo.txt - sakura', processName: 'sakura.exe' },
      { hwnd: 2n, title: 'Windows Terminal', processName: 'WindowsTerminal.exe' },
    ]);
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [
        { window: { processName: 'sakura.exe' }, pinToAllDesktops: true },
        { itemId: 'term1aaa', window: { title: '*Terminal*' }, pinToAllDesktops: true },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(deps.activate).toHaveBeenCalledWith(
      { title: '*', processName: 'sakura.exe', pinToAllDesktops: true },
      expect.any(String),
      logger
    );
    expect(deps.activate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '*Terminal*', pinToAllDesktops: true }),
      'Windows Terminal',
      logger
    );
  });

  it('「全デスクトップに表示」の無い行は、ピン止めを当てない', async () => {
    const { deps } = makeDeps([
      { hwnd: 1n, title: 'memo.txt - sakura', processName: 'sakura.exe' },
    ]);
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [{ window: { processName: 'sakura.exe' }, placement: { x: 0, y: 0 } }],
    };
    await executeSet(set, resolve, deps, logger);
    expect(vi.mocked(deps.applyConfig).mock.calls[0][1]).not.toHaveProperty('pinToAllDesktops');
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

  it('前面に出さない行は、位置を当てて最大化する間の前面を控えて戻す（前面に出す行は控えない）', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'QDL_main', processName: 'WindowsTerminal.exe' },
      { hwnd: 2n, title: 'a.png - ペイント', processName: 'mspaint.exe' },
    ]);
    deps.holdForeground = (hwnd) => {
      calls.push(`hold:${hwnd}`);
      return () => calls.push(`release:${hwnd}`);
    };
    const set: SetItem = {
      type: 'set',
      displayName: '並べる',
      launchMode: 'sequential',
      entries: [
        {
          itemId: 'term1aaa',
          window: { processName: 'WindowsTerminal.exe' },
          placement: { x: 0, y: 0, width: 960, height: 1040, state: 'maximized' },
        },
        {
          window: { processName: 'mspaint.exe' },
          placement: { x: 0, y: 0, width: 960, height: 1040, state: 'maximized' },
          activateWindow: true,
        },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(calls).toEqual([
      'hold:1',
      'place:1',
      'maximize:1',
      'release:1',
      'place:2',
      'maximize:2',
    ]);
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

  it('同じ exe のウィンドウはあってタイトルだけ合わないときは、そう知らせて飛ばす', async () => {
    const { deps } = makeDeps([
      { hwnd: 6n, title: '別のタブ - Google Chrome', processName: 'chrome.exe' },
    ]);
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
      entries: [
        {
          window: { processName: 'chrome.exe', title: 'YouTube - Google Chrome' },
          placement: { x: 0, y: 0 },
        },
      ],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(result.entries[0]).toMatchObject({ success: true, skipped: true });
    expect(sent[sent.length - 1].entries[0].errorMessage).toBe('set.run.titleNotMatched');
  });

  it('同じ窓に当たる行が 2 つで窓が 1 つなら、2 行目は「開いていない」で飛ばす（タイトル違いとは出さない）', async () => {
    const { deps } = makeDeps([{ hwnd: 7n, title: 'メモ', processName: 'sticky.exe' }]);
    const sent: LayoutExecutionProgress[] = [];
    deps.progress = {
      show: vi.fn(async () => {}),
      send: vi.fn((_event, progress) => {
        sent.push(structuredClone(progress));
      }),
      onCancel: vi.fn(() => () => {}),
    };
    const row = { window: { processName: 'sticky.exe', title: 'メモ' }, placement: { x: 0, y: 0 } };
    const set: SetItem = { type: 'set', displayName: 'x', entries: [row, row] };
    await executeSet(set, resolve, deps, logger);
    const last = sent[sent.length - 1].entries;
    expect(last.map((e) => e.status)).toEqual(['success', 'skipped']);
    expect(last[1].errorMessage).toBe('set.run.notOpen');
  });

  it('ほかの行の窓だけが開いているときは、行の順番によらず「開いていない」で飛ばす', async () => {
    for (const order of [0, 1]) {
      const { deps } = makeDeps([{ hwnd: 8n, title: 'B - ペイント', processName: 'mspaint.exe' }]);
      const sent: LayoutExecutionProgress[] = [];
      deps.progress = {
        show: vi.fn(async () => {}),
        send: vi.fn((_event, progress) => {
          sent.push(structuredClone(progress));
        }),
        onCancel: vi.fn(() => () => {}),
      };
      const rowA = {
        window: { processName: 'mspaint.exe', title: 'A - ペイント' },
        placement: { x: 0, y: 0 },
      };
      const rowB = {
        window: { processName: 'mspaint.exe', title: 'B - ペイント' },
        placement: { x: 9, y: 9 },
      };
      const entries = order === 0 ? [rowA, rowB] : [rowB, rowA];
      await executeSet({ displayName: 'x', entries }, resolve, deps, logger);
      const last = sent[sent.length - 1].entries;
      const a = last[order === 0 ? 0 : 1];
      expect(a.status).toBe('skipped');
      expect(a.errorMessage).toBe('set.run.notOpen');
    }
  });

  it('位置を当てられなかったウィンドウは「動かせませんでした」で失敗にする', async () => {
    const { deps } = makeDeps([{ hwnd: 3n, title: 'admin', processName: 'mmc.exe' }]);
    deps.applyConfig = vi.fn(async () => ({
      activated: true,
      windowFound: true,
      positionNotApplied: true as const,
    }));
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [{ window: { processName: 'mmc.exe' }, placement: { x: 0, y: 0 } }],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(result.entries[0]).toMatchObject({ success: false, error: 'set.run.couldNotMove' });
  });

  it('記録した位置がどの画面にも入らなければ、主画面に収めて当てる', async () => {
    const { deps } = makeDeps([{ hwnd: 4n, title: 'メモ', processName: 'sticky.exe' }]);
    deps.screens = () => [
      {
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      },
    ];
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [
        {
          window: { processName: 'sticky.exe' },
          placement: { x: 3000, y: 0, width: 800, height: 600 },
        },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    expect(deps.applyConfig).toHaveBeenCalledWith(
      4n,
      expect.objectContaining({ x: 560, y: 220, width: 800, height: 600 }),
      expect.anything(),
      expect.anything()
    );
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
    deps.launch = vi.fn(async (item): Promise<LaunchResult> => {
      calls.push(`launch:${item.path}`);
      await gate;
      return { success: true };
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

describe('executeLauncherItem（単一アイテムをセットの 1 行として実行する）', () => {
  const terminal: ExecutableLauncherItem = {
    id: 'term2aaa',
    type: 'app',
    displayName: 'Windows Terminal',
    path: 'wt.exe',
    window: { processName: 'WindowsTerminal.exe' },
  };

  it('位置が無ければ、見つかったウィンドウを前面に出すだけで開かない（別のデスクトップなら切り替える）', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'QDL_main', processName: 'WindowsTerminal.exe' },
    ]);
    const result = await executeLauncherItem(terminal, deps, logger);
    expect(calls).toEqual(['activate:*:true']);
    expect(deps.activate).toHaveBeenCalledWith(
      { title: '*', processName: 'WindowsTerminal.exe', activateWindow: true },
      'Windows Terminal',
      logger,
      { followDesktop: true }
    );
    expect(result.successCount).toBe(1);
  });

  it('位置が無く見つからなければ、開くだけで待たない', async () => {
    const { deps, calls } = makeDeps();
    const result = await executeLauncherItem(terminal, deps, logger);
    expect(calls).toEqual(['activate:*:false', 'launch:wt.exe']);
    expect(deps.sleep).not.toHaveBeenCalled();
    expect(result.errorCount).toBe(0);
  });

  it('前面に出さない設定（activateWindow: false）とピン止めをウィンドウ操作に渡す', async () => {
    const { deps } = makeDeps([
      { hwnd: 1n, title: 'QDL_main', processName: 'WindowsTerminal.exe' },
    ]);
    await executeLauncherItem(
      { ...terminal, activateWindow: false, pinToAllDesktops: true },
      deps,
      logger
    );
    expect(deps.activate).toHaveBeenCalledWith(
      {
        title: '*',
        processName: 'WindowsTerminal.exe',
        activateWindow: false,
        pinToAllDesktops: true,
      },
      'Windows Terminal',
      logger,
      { followDesktop: true }
    );
  });

  it('位置があれば、見つかったウィンドウに位置を当てて前面に出す（進み具合の表示は出さない）', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'QDL_main', processName: 'WindowsTerminal.exe' },
    ]);
    deps.progress = { show: vi.fn(), send: vi.fn(), onCancel: vi.fn(() => () => {}) };
    const result = await executeLauncherItem(
      { ...terminal, placement: { x: 0, y: 0, width: 800, height: 600 }, pinToAllDesktops: true },
      deps,
      logger
    );
    expect(calls).toEqual(['place:1']);
    expect(deps.applyConfig).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({
        x: 0,
        width: 800,
        activateWindow: true,
        pinToAllDesktops: true,
      }),
      'Windows Terminal',
      logger,
      { followDesktop: true }
    );
    expect(deps.progress.show).not.toHaveBeenCalled();
    expect(deps.progress.send).not.toHaveBeenCalled();
    expect(result.successCount).toBe(1);
  });

  it('位置があり見つからなければ、開いてウィンドウが出るのを待ってから位置を当てる', async () => {
    const { deps, calls } = makeDeps();
    const result = await executeLauncherItem(
      {
        type: 'app',
        displayName: 'Obsidian',
        path: 'C:\\Apps\\Obsidian\\Obsidian.exe',
        window: { processName: 'Obsidian.exe' },
        placement: { x: 960, y: 0 },
      },
      deps,
      logger
    );
    expect(calls).toEqual(['launch:C:\\Apps\\Obsidian\\Obsidian.exe', 'place:99']);
    expect(result.errorCount).toBe(0);
  });

  it('ifOpen が openNew なら、開いていても開く', async () => {
    const { deps, calls } = makeDeps([
      { hwnd: 1n, title: 'QDL_main', processName: 'WindowsTerminal.exe' },
    ]);
    await executeLauncherItem({ ...terminal, ifOpen: 'openNew' }, deps, logger);
    expect(calls).toEqual(['launch:wt.exe']);
  });

  it('待ちきれなければ失敗にし、待った秒数をトーストで知らせる', async () => {
    const { deps } = makeDeps();
    const item: ExecutableLauncherItem = {
      ...terminal,
      placement: { x: 0, y: 0 },
      waitSeconds: 1,
    };
    const result = await executeLauncherItem(item, deps, logger);
    expect(result.entries).toEqual([
      { index: 0, name: 'Windows Terminal', success: false, error: 'layout.timedOut' },
    ]);
    vi.mocked(showToastWindow).mockClear();
    await notifyLauncherItemFailure(item, result);
    expect(showToastWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Windows Terminal',
        type: 'warning',
        message: 'set.run.itemWindowTimedOut',
      })
    );
  });

  it('うまくいったときはトーストを出さない', async () => {
    vi.mocked(showToastWindow).mockClear();
    await notifyLauncherItemFailure(terminal, {
      successCount: 1,
      errorCount: 0,
      cancelled: false,
      entries: [{ index: 0, name: 'Windows Terminal', success: true }],
    });
    expect(showToastWindow).not.toHaveBeenCalled();
  });

  it('管理者として実行で UAC の「いいえ」を押したときはトーストを出さない', async () => {
    vi.mocked(showToastWindow).mockClear();
    await notifyLauncherItemFailure(terminal, {
      successCount: 1,
      errorCount: 0,
      cancelled: false,
      entries: [
        { index: 0, name: 'Windows Terminal', success: true, skipped: true, adminCancelled: true },
      ],
    });
    expect(showToastWindow).not.toHaveBeenCalled();
  });

  it('同じアイテムを実行中にもう一度開いても重ねて開かない', async () => {
    const { deps, calls } = makeDeps();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    deps.launch = vi.fn(async (item): Promise<LaunchResult> => {
      calls.push(`launch:${item.path}`);
      await gate;
      return { success: true };
    });
    const first = executeLauncherItem(terminal, deps, logger);
    const second = await executeLauncherItem(terminal, deps, logger);
    expect(second.skipped).toBe(true);
    release();
    await first;
    expect(calls).toEqual(['activate:*:false', 'launch:wt.exe']);
  });
});

describe('パスの無い単一アイテム', () => {
  const todo: ExecutableLauncherItem = {
    id: 'todo2aaa',
    type: 'windowSwitch',
    displayName: 'MS To Do',
    path: '',
    window: { processName: 'ApplicationFrameHost.exe', title: 'Microsoft To Do' },
  };
  const todoWindow = {
    hwnd: 5n,
    title: 'Microsoft To Do',
    processName: 'ApplicationFrameHost.exe',
  };

  it('開いていれば切り替えるだけで、何も開かない（前面に出すかは設定どおり）', async () => {
    const { deps, calls } = makeDeps([todoWindow]);
    const result = await executeLauncherItem({ ...todo, activateWindow: false }, deps, logger);
    expect(calls).toEqual(['activate:Microsoft To Do:true']);
    expect(deps.activate).toHaveBeenCalledWith(
      { title: 'Microsoft To Do', processName: 'ApplicationFrameHost.exe', activateWindow: false },
      'MS To Do',
      logger,
      { followDesktop: true }
    );
    expect(deps.launch).not.toHaveBeenCalled();
    expect(result.entries).toEqual([{ index: 0, name: 'MS To Do', success: true }]);
  });

  it('開いていなければ何も開かずに飛ばし、情報のトーストで知らせる', async () => {
    const { deps } = makeDeps();
    const result = await executeLauncherItem(todo, deps, logger);
    expect(deps.launch).not.toHaveBeenCalled();
    expect(result.entries).toEqual([{ index: 0, name: 'MS To Do', success: true, skipped: true }]);
    vi.mocked(showToastWindow).mockClear();
    await notifyLauncherItemFailure(todo, result);
    expect(showToastWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'MS To Do',
        itemType: 'windowSwitch',
        type: 'info',
        message: 'set.run.itemNotOpen',
      })
    );
  });

  it('ウィンドウ位置があれば、開いているウィンドウに当てる。開いていなければ待たずに飛ばす', async () => {
    const placed = { ...todo, placement: { x: 0, y: 0, width: 800, height: 600 } };
    const open = makeDeps([todoWindow]);
    await executeLauncherItem(placed, open.deps, logger);
    expect(open.calls).toEqual(['place:5']);

    const closed = makeDeps();
    const result = await executeLauncherItem(placed, closed.deps, logger);
    expect(closed.deps.launch).not.toHaveBeenCalled();
    expect(closed.deps.sleep).not.toHaveBeenCalledWith(500);
    expect(result.entries[0].skipped).toBe(true);
  });

  it('セットの行が指したとき、行に探す条件が無ければアイテムの対象ウィンドウを借りる（開くものは無い）', async () => {
    const { deps, calls } = makeDeps([todoWindow]);
    const set: SetItem = {
      type: 'set',
      displayName: 'TODOset',
      entries: [
        { itemId: 'todo1aaa' },
        { itemId: 'todo1aaa', placement: { x: 1, y: 2, width: 3, height: 4 } },
      ],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(deps.launch).not.toHaveBeenCalled();
    // 位置の無い行はアイテムの設定（ウィンドウ位置も含む）で前面に出し、位置のある行は行の位置を当てる
    expect(deps.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Microsoft To Do',
        processName: 'ApplicationFrameHost.exe',
        x: 10,
        width: 300,
      }),
      'MS To Do',
      logger
    );
    expect(calls).toContain('place:5');
    expect(result.errorCount).toBe(0);
  });

  it('セットの行が指して開いていなければ、失敗にせず飛ばす（廃止したウィンドウ操作から変換したものも同じ）', async () => {
    const { deps } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: 'TODOset',
      entries: [{ itemId: 'todo1aaa', placement: { x: 1, y: 2 } }],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(deps.launch).not.toHaveBeenCalled();
    expect(result.entries).toEqual([{ index: 0, name: 'MS To Do', success: true, skipped: true }]);
  });

  it('位置の無い行が指して開いていなくても、失敗にせず飛ばす', async () => {
    const { deps } = makeDeps();
    const set: SetItem = {
      type: 'set',
      displayName: 'TODOset',
      entries: [{ itemId: 'todo1aaa' }],
    };
    const result = await executeSet(set, resolve, deps, logger);
    expect(deps.launch).not.toHaveBeenCalled();
    expect(result.entries).toEqual([{ index: 0, name: 'MS To Do', success: true, skipped: true }]);
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

  it('行に探す条件が無ければ、パスの無い単一アイテムの対象ウィンドウを借りる', () => {
    const resolved = {
      name: 'MS To Do',
      itemWindow: { processName: 'ApplicationFrameHost.exe', title: 'Microsoft To Do' },
    };
    expect(buildSetWindowConfig({ placement: { x: 1, y: 2 } }, resolved)).toMatchObject({
      title: 'Microsoft To Do',
      processName: 'ApplicationFrameHost.exe',
      x: 1,
      y: 2,
    });
    // 行に条件があれば行のものを使う
    expect(
      buildSetWindowConfig(
        { window: { processName: 'other.exe' }, placement: { x: 1, y: 2 } },
        resolved
      )
    ).toMatchObject({ title: '*', processName: 'other.exe' });
  });
});

describe('進み具合の表示', () => {
  it('行ごとに今していること・exe 名とデスクトップ・アイコンを送る', async () => {
    const { deps } = makeDeps([{ hwnd: 1n, title: 'ai - Terminal', processName: 'wt.exe' }]);
    const sent: LayoutExecutionProgress[] = [];
    const loadIcons = vi.fn(async () => ({ 'C:/apps/Obsidian.exe': 'data:image/png;base64,AA' }));
    deps.progress = {
      show: vi.fn(async () => {}),
      send: vi.fn((_event, progress) => {
        sent.push(structuredClone(progress));
      }),
      onCancel: vi.fn(() => () => {}),
      loadIcons,
    };
    const set: SetItem = {
      type: 'set',
      displayName: 'x',
      entries: [
        { itemId: 'term1aaa', placement: { x: 0, y: 0 } },
        {
          open: { path: 'C:/apps/Obsidian.exe' },
          window: { processName: 'Obsidian.exe' },
          placement: { x: 0, y: 0, virtualDesktopNumber: 2 },
        },
        { window: { processName: 'sticky.exe' }, placement: { x: 0, y: 0 } },
        { open: { path: 'C:/apps/slow.exe' }, placement: { x: 0, y: 0 }, waitSeconds: 2 },
      ],
    };
    await executeSet(set, resolve, deps, logger);

    expect(deps.progress.show).toHaveBeenCalledWith(4);
    // アイコンを持たない行は、開くもののパスでキャッシュから引く（パスを書いた行・アイコンの無いアイテム）
    expect(loadIcons).toHaveBeenCalledWith([
      { type: 'app', path: 'wt.exe' },
      { type: 'app', path: 'C:/apps/Obsidian.exe' },
      { type: 'app', path: 'C:/apps/slow.exe' },
    ]);
    const first = sent[0].entries;
    expect(first.map((e) => e.statusText)).toEqual(Array(4).fill('set.progress.queued'));
    expect(first[1]).toMatchObject({
      icon: 'data:image/png;base64,AA',
      itemType: 'app',
      detail: 'Obsidian.exeset.progress.separatorset.progress.desktop',
    });
    expect(first[2]).toMatchObject({ itemType: 'windowSwitch', detail: 'sticky.exe' });
    expect(first[3].icon).toBeUndefined();

    // 待っている間は秒数を 1 秒ごとに出す
    const waiting = sent.filter((p) => p.entries[3].statusText === 'set.progress.waitingWindow');
    expect(waiting).toHaveLength(2);

    const last = sent[sent.length - 1].entries;
    expect(last.map((e) => [e.status, e.statusText])).toEqual([
      ['success', 'set.progress.placedExisting'],
      ['success', 'set.progress.placed'],
      ['skipped', 'set.progress.skipped'],
      ['failed', 'set.progress.failed'],
    ]);
    expect(last[3].errorMessage).toBe('layout.timedOut');
  });

  it('位置の無い行は、開いていたか開いたかを出す', async () => {
    const { deps } = makeDeps([{ hwnd: 1n, title: 'ai - Terminal', processName: 'wt.exe' }]);
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
      entries: [
        { itemId: 'term1aaa' },
        { itemId: 'gmail1aa' },
        // 位置のある行が 1 つあると進み具合を出す
        { window: { processName: 'sticky.exe' }, placement: { x: 0, y: 0 } },
      ],
    };
    await executeSet(set, resolve, deps, logger);
    const last = sent[sent.length - 1].entries;
    expect(last[0].statusText).toBe('set.progress.wasOpen');
    expect(last[1].statusText).toBe('set.progress.opened');
  });
});
