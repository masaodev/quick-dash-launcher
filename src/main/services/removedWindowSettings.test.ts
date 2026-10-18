import { describe, it, expect, vi } from 'vitest';

vi.mock('./settingsService.js', () => ({ SettingsService: {} }));
vi.mock('./workspace/index.js', () => ({ WorkspaceService: {} }));

import { planLegacyWorkspacePosition, planRemovedWindowSettings } from './removedWindowSettings';

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
