import { describe, it, expect } from 'vitest';

import type { AppSettings } from './types';
import { clampSettingNumbers } from './settingRanges';

const base = {
  windowWidth: 600,
  windowHeight: 400,
  editModeWidth: 1000,
  editModeHeight: 800,
  workspaceOpacity: 100,
  backupRetention: 10,
} as AppSettings;

describe('clampSettingNumbers', () => {
  it('範囲の中なら同じオブジェクトを返すこと', () => {
    expect(clampSettingNumbers(base)).toBe(base);
  });

  it('範囲の外の値を端に寄せ、ほかの値は変えないこと', () => {
    const result = clampSettingNumbers({ ...base, windowWidth: 50, windowHeight: 99999 });
    expect(result.windowWidth).toBe(400);
    expect(result.windowHeight).toBe(1200);
    expect(result.editModeWidth).toBe(1000);
  });
});
