import { describe, it, expect } from 'vitest';

import {
  autoLinkWindows,
  decideWindowMatch,
  matchesWindow,
  placementFromWindow,
  rerecordSetPlacements,
  type MatchableEntry,
  type MatchableWindow,
} from './setWindowMatching';

function win(over: Partial<MatchableWindow>): MatchableWindow {
  return { hwnd: 1, title: '', x: 0, y: 0, width: 800, height: 600, ...over };
}

const terminal = win({
  hwnd: 1,
  title: 'QDL_main',
  processName: 'WindowsTerminal.exe',
  executablePath: 'C:\\Program Files\\WindowsApps\\Terminal\\WindowsTerminal.exe',
});
const explorerA = win({
  hwnd: 2,
  title: 'ai-workspace',
  processName: 'explorer.exe',
  executablePath: 'C:\\Windows\\explorer.exe',
});
const explorerB = win({
  hwnd: 3,
  title: 'Downloads',
  processName: 'explorer.exe',
  executablePath: 'C:\\Windows\\explorer.exe',
});
const obsidian = win({
  hwnd: 4,
  title: 'TODOキャンパス - vault - Obsidian v1.9',
  processName: 'Obsidian.exe',
  executablePath: 'C:\\Users\\me\\AppData\\Local\\Programs\\Obsidian\\Obsidian.exe',
});
const sakura = win({
  hwnd: 5,
  title: '一時メモ.txt - sakura 2.4.1.2849',
  processName: 'sakura.exe',
  executablePath: 'C:\\Program Files\\sakura\\sakura.exe',
});
const minimized = win({
  hwnd: 6,
  title: '電卓',
  processName: 'CalculatorApp.exe',
  windowState: 'minimized',
});

describe('matchesWindow', () => {
  it('プロセス名は部分一致、タイトルはワイルドカードで比べる', () => {
    expect(matchesWindow({ processName: 'WindowsTerminal' }, terminal)).toBe(true);
    expect(matchesWindow({ processName: 'explorer.exe', title: 'ai-workspace' }, explorerA)).toBe(
      true
    );
    expect(matchesWindow({ processName: 'explorer.exe', title: 'ai-workspace' }, explorerB)).toBe(
      false
    );
    expect(matchesWindow({ title: '*Obsidian*' }, obsidian)).toBe(true);
  });

  it('見つけ方が空なら、どのウィンドウとも結び付けない', () => {
    expect(matchesWindow({}, terminal)).toBe(false);
  });
});

describe('autoLinkWindows', () => {
  it('開くものから推測して結び付け、URL の行と見つからない行を分ける', () => {
    const entries: MatchableEntry[] = [
      { index: 0, target: { kind: 'url', path: 'https://mail.google.com/' } },
      { index: 1, target: { kind: 'folder', path: 'C:\\Users\\me\\git\\ai-workspace' } },
      // 起動用の wt.exe と、実際にウィンドウを持つ WindowsTerminal.exe は別の exe なので結び付かない
      { index: 2, target: { kind: 'app', path: 'wt.exe' } },
      { index: 3, target: { kind: 'file', path: 'C:\\Users\\me\\一時メモ.txt' } },
    ];
    const result = autoLinkWindows(entries, [terminal, explorerA, explorerB, sakura, minimized]);

    expect(result.links.get(1)).toBe(explorerA);
    expect(result.links.get(3)).toBe(sakura);
    expect(result.unlinkedEntries).toEqual([
      { index: 0, reason: 'url' },
      { index: 2, reason: 'notFound' },
    ]);
    expect(result.unlinkedWindows).toEqual([terminal, explorerB]);
    expect(result.minimizedWindows).toEqual([minimized]);
  });

  it('見つけ方を持つ行はそれを優先し、1 つのウィンドウは 1 行とだけ結び付く', () => {
    const entries: MatchableEntry[] = [
      { index: 0, window: { processName: 'explorer.exe' }, target: { kind: 'none' } },
      { index: 1, window: { processName: 'explorer.exe' }, target: { kind: 'none' } },
      { index: 2, window: { processName: 'explorer.exe' }, target: { kind: 'none' } },
    ];
    const result = autoLinkWindows(entries, [explorerA, explorerB]);
    expect(result.links.get(0)).toBe(explorerA);
    expect(result.links.get(1)).toBe(explorerB);
    expect(result.unlinkedEntries).toEqual([{ index: 2, reason: 'notFound' }]);
  });

  it('exe のフルパスで結び付ける', () => {
    const entries: MatchableEntry[] = [
      {
        index: 0,
        target: { kind: 'app', path: 'c:/users/me/appdata/local/programs/obsidian/obsidian.exe' },
      },
    ];
    expect(autoLinkWindows(entries, [obsidian]).links.get(0)).toBe(obsidian);
  });
});

describe('decideWindowMatch', () => {
  it('その exe のウィンドウが 1 つなら exe 名だけ', () => {
    expect(decideWindowMatch(obsidian, [obsidian, terminal])).toEqual({
      processName: 'Obsidian.exe',
    });
  });

  it('同じ exe が 2 つ以上なら、タイトルも保存する', () => {
    const second = win({ ...terminal, hwnd: 9, title: 'ai-workspace' });
    expect(decideWindowMatch(terminal, [terminal, second])).toEqual({
      processName: 'WindowsTerminal.exe',
      title: 'QDL_main',
    });
  });

  it('エクスプローラーとストアアプリは、1 つでもタイトルを保存する', () => {
    expect(decideWindowMatch(explorerA, [explorerA])).toEqual({
      processName: 'explorer.exe',
      title: 'ai-workspace',
    });
    const sticky = win({ title: '付箋', processName: 'ApplicationFrameHost.exe' });
    expect(decideWindowMatch(sticky, [sticky])).toEqual({
      processName: 'ApplicationFrameHost.exe',
      title: '付箋',
    });
  });
});

describe('placementFromWindow', () => {
  it('位置・大きさ・仮想デスクトップ・最大化を写す', () => {
    expect(
      placementFromWindow(
        win({ x: -7, y: 0, width: 974, height: 1047, desktopNumber: 2, windowState: 'maximized' })
      )
    ).toEqual({
      x: -7,
      y: 0,
      width: 974,
      height: 1047,
      virtualDesktopNumber: 2,
      state: 'maximized',
    });
  });
});

describe('rerecordSetPlacements', () => {
  it('置き場所のある行だけ取り直し、見つからない行は前の位置のまま', () => {
    const entries = [
      {
        itemId: 'a',
        window: { processName: 'Obsidian.exe' },
        placement: { x: 0, y: 0, width: 10, height: 10 },
      },
      { itemId: 'b' },
      { window: { processName: 'gone.exe' }, placement: { x: 1, y: 1, width: 1, height: 1 } },
    ];
    const moved = win({ ...obsidian, x: 960, y: 0, width: 960, height: 1040 });
    const result = rerecordSetPlacements(entries, [moved]);
    expect(result.changed).toBe(1);
    expect(result.notFound).toBe(1);
    expect(result.entries[0].placement).toEqual({ x: 960, y: 0, width: 960, height: 1040 });
    expect(result.entries[1]).toBe(entries[1]);
    expect(result.entries[2]).toBe(entries[2]);
  });

  it('今の仮想デスクトップ番号が取れないときは、前の番号を残す', () => {
    const entries = [
      {
        window: { processName: 'Obsidian.exe' },
        placement: { x: 0, y: 0, width: 10, height: 10, virtualDesktopNumber: 2 },
      },
    ];
    const moved = win({ ...obsidian, x: 5, y: 0, width: 10, height: 10, desktopNumber: -1 });
    expect(rerecordSetPlacements(entries, [moved]).entries[0].placement?.virtualDesktopNumber).toBe(
      2
    );
  });
});
