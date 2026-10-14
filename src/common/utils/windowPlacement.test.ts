import { describe, it, expect } from 'vitest';

import { WINDOW_PLACEMENT_KEYS, pickWindowPlacement } from './windowPlacement';

describe('pickWindowPlacement', () => {
  it('9 項目だけを WINDOW_PLACEMENT_KEYS の順で写し、他の項目は落とすこと', () => {
    const picked = pickWindowPlacement({
      displayName: 'エディタ',
      windowTitle: '*',
      processName: 'code.exe',
      x: 10,
      width: 800,
      activateWindow: false,
    } as Parameters<typeof pickWindowPlacement>[0]);

    expect(Object.keys(picked)).toEqual([...WINDOW_PLACEMENT_KEYS]);
    expect(picked).toEqual({
      processName: 'code.exe',
      x: 10,
      y: undefined,
      width: 800,
      height: undefined,
      moveToActiveMonitorCenter: undefined,
      virtualDesktopNumber: undefined,
      activateWindow: false,
      pinToAllDesktops: undefined,
    });
  });
});
