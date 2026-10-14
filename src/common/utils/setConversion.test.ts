import { describe, it, expect } from 'vitest';

import type { JsonGroupItem, JsonLayoutItem } from '../types/json-data';

import { convertGroupToSet, convertLayoutToSet, toPartialMatchTitle } from './setConversion';

describe('toPartialMatchTitle', () => {
  it('前後に * を付ける（付いている側は付けない）', () => {
    expect(toPartialMatchTitle('Microsoft To Do')).toBe('*Microsoft To Do*');
    expect(toPartialMatchTitle('*TODOキャンパス*')).toBe('*TODOキャンパス*');
    expect(toPartialMatchTitle('title*')).toBe('*title*');
    expect(toPartialMatchTitle('*')).toBe('*');
  });
});

describe('convertGroupToSet', () => {
  const group: JsonGroupItem = {
    id: 'g1g1g1g1',
    type: 'group',
    displayName: '朝の準備',
    itemNames: ['Gmail', 'メモ.txt', '消したアイテム'],
    memo: 'メモ',
    updatedAt: 100,
  };

  it('名前を id か行の中のパスに置き換え、見つからない名前は名前だけの行で残す', () => {
    const result = convertGroupToSet(
      group,
      (name) => {
        if (name === 'Gmail') return { itemId: 'a1a1a1a1' };
        if (name === 'メモ.txt') return { open: { path: 'C:\\docs\\メモ.txt' } };
        return undefined;
      },
      'sequential'
    );
    expect(result).toEqual({
      id: 'g1g1g1g1',
      type: 'set',
      displayName: '朝の準備',
      entries: [
        { itemId: 'a1a1a1a1' },
        { open: { path: 'C:\\docs\\メモ.txt' }, label: 'メモ.txt' },
        { label: '消したアイテム' },
      ],
      memo: 'メモ',
      updatedAt: 100,
    });
  });

  it('並列起動の設定なら launchMode を parallel にする', () => {
    expect(convertGroupToSet(group, () => undefined, 'parallel').launchMode).toBe('parallel');
  });
});

describe('convertLayoutToSet', () => {
  it('アプリを起動するエントリは開くもの付き、起動しないエントリは並べるだけの行にする', () => {
    const layout: JsonLayoutItem = {
      id: 'l1l1l1l1',
      type: 'layout',
      displayName: 'TODO用',
      customIcon: 'icon.png',
      entries: [
        {
          windowTitle: 'ai-workspace',
          processName: 'WindowsTerminal.exe',
          executablePath: 'wt.exe',
          args: '-p "Git Bash"',
          x: 0,
          y: 0,
          width: 960,
          height: 1040,
          virtualDesktopNumber: 2,
          launchApp: true,
        },
        {
          windowTitle: '付箋',
          processName: 'ApplicationFrameHost.exe',
          executablePath: 'C:\\Windows\\System32\\ApplicationFrameHost.exe',
          x: 1600,
          y: 0,
          width: 320,
          height: 400,
          launchApp: false,
        },
      ],
    };
    expect(convertLayoutToSet(layout)).toEqual({
      id: 'l1l1l1l1',
      type: 'set',
      displayName: 'TODO用',
      launchMode: 'parallel',
      customIcon: 'icon.png',
      entries: [
        {
          open: { path: 'wt.exe', args: '-p "Git Bash"' },
          label: 'ai-workspace',
          window: { processName: 'WindowsTerminal.exe', title: '*ai-workspace*' },
          placement: { x: 0, y: 0, width: 960, height: 1040, virtualDesktopNumber: 2 },
        },
        {
          label: '付箋',
          window: { processName: 'ApplicationFrameHost.exe', title: '*付箋*' },
          placement: { x: 1600, y: 0, width: 320, height: 400 },
        },
      ],
    });
  });
});
