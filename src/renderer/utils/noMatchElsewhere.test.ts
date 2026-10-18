import { describe, it, expect } from 'vitest';
import type { AppItem, DataFileTab, LauncherItem, WindowInfo } from '@common/types';

import { findNoMatchElsewhere } from './noMatchElsewhere';

const item = (displayName: string, sourceFile: string): LauncherItem =>
  ({
    displayName,
    path: `https://example.com/${displayName}`,
    type: 'url',
    sourceFile,
  }) as LauncherItem;

const win = (title: string, desktopNumber: number): WindowInfo =>
  ({ hwnd: title.length, title, desktopNumber }) as unknown as WindowInfo;

const tabs: DataFileTab[] = [
  { name: 'メイン', files: ['data.json'] },
  { name: 'ブックマーク全件', files: ['data2.json'] },
];

const mainItems: AppItem[] = [item('りんご', 'data.json'), item('東方', 'data2.json')];

const base = {
  searchMode: 'normal' as const,
  searchQuery: '東方',
  mainItems,
  dataFileTabs: tabs,
  showDataFileTabs: true,
  activeTab: 'data.json',
  windowList: [] as WindowInfo[],
  showDesktopTabs: false,
  activeDesktopTab: 0,
};

describe('findNoMatchElsewhere（通常の検索）', () => {
  it('他のタブに合うアイテムがあれば otherTab', () => {
    expect(findNoMatchElsewhere(base)).toBe('otherTab');
  });

  it('どのタブにも無ければ null', () => {
    expect(findNoMatchElsewhere({ ...base, searchQuery: 'みかん' })).toBeNull();
  });

  it('タブ表示が OFF なら他のファイルにあっても null', () => {
    expect(findNoMatchElsewhere({ ...base, showDataFileTabs: false })).toBeNull();
  });

  it('タブが 1 つなら null', () => {
    expect(findNoMatchElsewhere({ ...base, dataFileTabs: [tabs[0]] })).toBeNull();
  });

  it('どのタブにも入っていないファイルのアイテムは数えない', () => {
    const items = [item('東方', 'data9.json')];
    expect(findNoMatchElsewhere({ ...base, mainItems: items })).toBeNull();
  });

  it('検索語が空なら null', () => {
    expect(findNoMatchElsewhere({ ...base, searchQuery: '  ' })).toBeNull();
  });
});

describe('findNoMatchElsewhere（ウィンドウ検索）', () => {
  const windowBase = {
    ...base,
    searchMode: 'window' as const,
    searchQuery: 'chrome',
    windowList: [win('chrome', 2)],
    showDesktopTabs: true,
    activeDesktopTab: 1,
  };

  it('他のデスクトップのタブに合うウィンドウがあれば otherTab', () => {
    expect(findNoMatchElsewhere(windowBase)).toBe('otherTab');
  });

  it('「すべて」のタブで 0 件なら、通常の検索に合うアイテムが無い限り null', () => {
    expect(findNoMatchElsewhere({ ...windowBase, activeDesktopTab: 0 })).toBeNull();
  });

  it('デスクトップのタブを出していなければ otherTab にしない', () => {
    expect(findNoMatchElsewhere({ ...windowBase, showDesktopTabs: false })).toBeNull();
  });

  it('ウィンドウはどこにも無く、通常の検索に合うアイテムがあれば normalSearch', () => {
    expect(findNoMatchElsewhere({ ...windowBase, searchQuery: '東方', windowList: [] })).toBe(
      'normalSearch'
    );
  });

  it('タブ表示が OFF なら通常の検索は今のファイルだけを見る', () => {
    expect(
      findNoMatchElsewhere({
        ...windowBase,
        searchQuery: '東方',
        windowList: [],
        showDataFileTabs: false,
      })
    ).toBeNull();
  });
});
