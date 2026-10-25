import { describe, it, expect, vi } from 'vitest';

vi.mock('./settingsService.js', () => ({ SettingsService: {} }));
vi.mock('./workspace/index.js', () => ({ WorkspaceService: {} }));

import {
  planLegacyFixedPosition,
  planLegacyWorkspacePosition,
  planRemovedWindowSettings,
} from './removedWindowSettings';

describe('planRemovedWindowSettings', () => {
  it('既定のまま（自動表示オフ・一緒に隠すオン）なら何も読み替えない', () => {
    expect(
      planRemovedWindowSettings({ autoShowWorkspace: false, hideDetachedWithMainWindow: true })
    ).toEqual({ pinUnpinnedDetached: false, openWorkspace: false });
  });

  it('一緒に隠さない設定だったら、切り離しウィンドウを表示固定にする', () => {
    expect(planRemovedWindowSettings({ hideDetachedWithMainWindow: false })).toEqual({
      pinUnpinnedDetached: true,
      openWorkspace: false,
    });
  });

  it('自動表示の設定だったら、ワークスペースを開いた状態にする', () => {
    expect(planRemovedWindowSettings({ autoShowWorkspace: true })).toEqual({
      pinUnpinnedDetached: false,
      openWorkspace: true,
    });
  });

  it('真偽値でない値は読み替えない', () => {
    expect(
      planRemovedWindowSettings({ autoShowWorkspace: 'true', hideDetachedWithMainWindow: 0 })
    ).toEqual({ pinUnpinnedDetached: false, openWorkspace: false });
  });
});

describe('planLegacyWorkspacePosition', () => {
  it('プライマリの左端・右端は、ディスプレイの左端・右端に読み替える', () => {
    expect(planLegacyWorkspacePosition('primaryLeft')).toBe('displayLeft');
    expect(planLegacyWorkspacePosition('primaryRight')).toBe('displayRight');
  });

  it('今の値は読み替えない', () => {
    expect(planLegacyWorkspacePosition('displayLeft')).toBeNull();
    expect(planLegacyWorkspacePosition('displayRight')).toBeNull();
    expect(planLegacyWorkspacePosition('fixed')).toBeNull();
  });
});

describe('planLegacyFixedPosition', () => {
  it('(0, 0) は「まだ置いていない」に読み替える', () => {
    expect(planLegacyFixedPosition(0, 0)).toBeNull();
  });

  it('それ以外の座標はそのまま引き継ぐ（負の数・片方だけ 0 も）', () => {
    expect(planLegacyFixedPosition(-1920, 100)).toEqual({ x: -1920, y: 100 });
    expect(planLegacyFixedPosition(0, 300)).toEqual({ x: 0, y: 300 });
    expect(planLegacyFixedPosition(1200, 0)).toEqual({ x: 1200, y: 0 });
  });

  it('数でない値・片方しかない値は「まだ置いていない」にする', () => {
    expect(planLegacyFixedPosition(undefined, undefined)).toBeNull();
    expect(planLegacyFixedPosition(100, undefined)).toBeNull();
    expect(planLegacyFixedPosition('100', 50)).toBeNull();
    expect(planLegacyFixedPosition(Number.NaN, 50)).toBeNull();
  });
});
