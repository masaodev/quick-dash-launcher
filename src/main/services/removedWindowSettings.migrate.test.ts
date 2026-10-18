import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  settings: {
    get: vi.fn(),
    set: vi.fn(),
    readRemovedKeys: vi.fn(),
    deleteRemovedKeys: vi.fn(),
  },
  workspace: {
    pinAllUnpinnedDetached: vi.fn(),
    saveWorkspaceWindowState: vi.fn(),
  },
}));

vi.mock('./settingsService.js', () => ({
  SettingsService: { getInstance: async () => mocks.settings },
}));
vi.mock('./workspace/index.js', () => ({
  WorkspaceService: { getInstance: async () => mocks.workspace },
}));
vi.mock('@common/logger', () => ({
  windowLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { migrateRemovedWindowSettings } from './removedWindowSettings';

describe('migrateRemovedWindowSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.get.mockResolvedValue('displayRight');
    mocks.settings.readRemovedKeys.mockResolvedValue({
      autoShowWorkspace: true,
      hideDetachedWithMainWindow: false,
    });
    mocks.workspace.pinAllUnpinnedDetached.mockResolvedValue(1);
    mocks.workspace.saveWorkspaceWindowState.mockResolvedValue(undefined);
  });

  it('読み替えをすべて保存できたら古いキーを消すこと', async () => {
    await migrateRemovedWindowSettings();
    expect(mocks.workspace.pinAllUnpinnedDetached).toHaveBeenCalled();
    expect(mocks.workspace.saveWorkspaceWindowState).toHaveBeenCalledWith({
      open: true,
      pinLevel: 1,
    });
    expect(mocks.settings.deleteRemovedKeys).toHaveBeenCalled();
  });

  it('保存に失敗したら古いキーを残す（次の起動でやり直す）こと', async () => {
    mocks.workspace.saveWorkspaceWindowState.mockRejectedValue(new Error('write failed'));
    await migrateRemovedWindowSettings();
    expect(mocks.settings.deleteRemovedKeys).not.toHaveBeenCalled();
  });

  it('表示位置の読み替えが失敗しても、消した設定の読み替えは進めること', async () => {
    mocks.settings.get.mockRejectedValue(new Error('read failed'));
    await migrateRemovedWindowSettings();
    expect(mocks.settings.deleteRemovedKeys).toHaveBeenCalled();
  });

  it('古いキーが無ければ何もしないこと', async () => {
    mocks.settings.readRemovedKeys.mockResolvedValue({});
    await migrateRemovedWindowSettings();
    expect(mocks.workspace.pinAllUnpinnedDetached).not.toHaveBeenCalled();
    expect(mocks.settings.deleteRemovedKeys).not.toHaveBeenCalled();
  });
});
