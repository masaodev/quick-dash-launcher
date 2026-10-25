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

import { migrateRemovedWindowSettings, REMOVED_FIXED_POSITION_KEYS } from './removedWindowSettings';

/** settings.json に残っている古いキー */
let raw: Record<string, unknown>;

describe('migrateRemovedWindowSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.get.mockResolvedValue('displayRight');
    raw = {
      autoShowWorkspace: true,
      hideDetachedWithMainWindow: false,
    };
    // 渡されたキーのうち、ファイルに残っているものだけを返す（本物の readRemovedKeys と同じ）
    mocks.settings.readRemovedKeys.mockImplementation(async (keys: readonly string[]) =>
      Object.fromEntries(keys.filter((key) => key in raw).map((key) => [key, raw[key]]))
    );
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
    raw = {};
    await migrateRemovedWindowSettings();
    expect(mocks.workspace.pinAllUnpinnedDetached).not.toHaveBeenCalled();
    expect(mocks.settings.set).not.toHaveBeenCalled();
    expect(mocks.settings.deleteRemovedKeys).not.toHaveBeenCalled();
  });

  it('固定位置の古い X・Y を新しいキーに移し、古いキーを消すこと', async () => {
    raw = {
      windowPositionX: -1920,
      windowPositionY: 100,
      workspacePositionX: 0,
      workspacePositionY: 0,
    };
    await migrateRemovedWindowSettings();
    expect(mocks.settings.set).toHaveBeenCalledWith('windowFixedPosition', { x: -1920, y: 100 });
    expect(mocks.settings.set).toHaveBeenCalledWith('workspaceFixedPosition', null);
    expect(mocks.settings.deleteRemovedKeys).toHaveBeenCalledWith(REMOVED_FIXED_POSITION_KEYS);
  });

  it('固定位置の読み替えを保存できなければ、古いキーを残すこと', async () => {
    raw = { windowPositionX: 100, windowPositionY: 50 };
    mocks.settings.set.mockRejectedValue(new Error('write failed'));
    await migrateRemovedWindowSettings();
    expect(mocks.settings.deleteRemovedKeys).not.toHaveBeenCalledWith(REMOVED_FIXED_POSITION_KEYS);
  });
});
