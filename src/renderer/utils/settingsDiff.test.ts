import { describe, it, expect } from 'vitest';
import type { AppSettings } from '@common/types';

import { pickChangedSettings } from './settingsDiff';

const saved = {
  hotkey: 'Alt+Space',
  windowWidth: 600,
  dataFileTabs: [{ files: ['datafiles/data.json'], name: 'メイン' }],
} as unknown as AppSettings;

describe('pickChangedSettings（A3-258）', () => {
  it('値が変わった項目だけを返す', () => {
    expect(pickChangedSettings(saved, { ...saved, windowWidth: 800 })).toEqual({
      windowWidth: 800,
    });
  });

  it('配列・オブジェクトは中身が同じなら変わっていない扱い', () => {
    const edited = { ...saved, dataFileTabs: [{ files: ['datafiles/data.json'], name: 'メイン' }] };
    expect(pickChangedSettings(saved, edited)).toEqual({});
  });

  it('中身が違えば配列ごと返す', () => {
    const tabs = [{ files: ['datafiles/data.json'], name: '仕事' }];
    expect(pickChangedSettings(saved, { ...saved, dataFileTabs: tabs } as AppSettings)).toEqual({
      dataFileTabs: tabs,
    });
  });
});
