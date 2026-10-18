import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ Menu: { buildFromTemplate: vi.fn() } }));
vi.mock('../services/mainI18n.js', () => ({ mainI18n: { t: (key: string) => key } }));

import { isPinLevel, levelToPinMode, nextPinLevelFromMenu, pinModeToLevel } from './pinMenu';

describe('pinMenu', () => {
  it('メインウィンドウのピンモードと段階を行き来できる', () => {
    expect(pinModeToLevel('normal')).toBe(0);
    expect(pinModeToLevel('stayVisible')).toBe(1);
    expect(pinModeToLevel('alwaysOnTop')).toBe(2);
    expect(levelToPinMode(0)).toBe('normal');
    expect(levelToPinMode(1)).toBe('stayVisible');
    expect(levelToPinMode(2)).toBe('alwaysOnTop');
  });

  it('メニューの「表示固定」は、オフならオン、オン（常に最前面を含む）ならなしにする', () => {
    expect(nextPinLevelFromMenu(0, 'stayVisible')).toBe(1);
    expect(nextPinLevelFromMenu(1, 'stayVisible')).toBe(0);
    expect(nextPinLevelFromMenu(2, 'stayVisible')).toBe(0);
  });

  it('メニューの「常に最前面」は、オフなら常に最前面、オンなら表示固定に戻す', () => {
    expect(nextPinLevelFromMenu(0, 'alwaysOnTop')).toBe(2);
    expect(nextPinLevelFromMenu(1, 'alwaysOnTop')).toBe(2);
    expect(nextPinLevelFromMenu(2, 'alwaysOnTop')).toBe(1);
  });

  it('段階として受け付けるのは 0・1・2 だけ', () => {
    expect(isPinLevel(0)).toBe(true);
    expect(isPinLevel(2)).toBe(true);
    expect(isPinLevel(3)).toBe(false);
    expect(isPinLevel('1')).toBe(false);
  });
});
