import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BookmarkAutoImportRule } from '@common/types';

const settingsState = vi.hoisted(() => ({
  calls: [] as string[],
  rules: [] as BookmarkAutoImportRule[],
}));
const writeDataFile = vi.hoisted(() => vi.fn(() => true));

vi.mock('../config/pathManager.js', () => ({
  default: { getConfigFolder: () => 'C:\\qdl-test-config' },
}));
vi.mock('../ipc/notifications.js', () => ({ notifyDataChanged: vi.fn() }));
vi.mock('./bookmarkReader.js', () => ({
  detectInstalledBrowsers: vi.fn(async () => [
    { id: 'chrome', installed: true, profiles: [{ id: 'Default', bookmarkPath: 'x' }] },
  ]),
  parseBrowserBookmarksWithFolders: vi.fn(async () => [
    { displayName: 'Example', url: 'https://example.com/', folderPath: 'bookmark_bar' },
  ]),
}));
vi.mock('./dataFileTracker.js', () => ({ writeDataFile }));
vi.mock('./overlayWindowService.js', () => ({ showToastWindow: vi.fn() }));
vi.mock('./settingsService.js', () => ({
  SettingsService: {
    isSettingsFileReadable: () => true,
    getInstance: async () => ({
      reloadFromDisk: () => settingsState.calls.push('reload'),
      get: async () => {
        settingsState.calls.push('get');
        return { autoRunOnStartup: false, rules: settingsState.rules };
      },
      set: async () => settingsState.calls.push('set'),
    }),
  },
}));
vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { BookmarkAutoImportService } from './bookmarkAutoImportService';

function rule(targetFile: string): BookmarkAutoImportRule {
  return {
    id: 'rule0001',
    name: 'テスト',
    enabled: true,
    browserId: 'chrome',
    profileIds: [],
    folderPaths: [],
    folderFilterMode: 'include',
    includeSubfolders: true,
    urlPattern: '',
    namePattern: '',
    targetFile,
    prefix: '',
    suffix: '',
    folderNameMode: 'none',
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('BookmarkAutoImportService（A3-258）', () => {
  beforeEach(() => {
    settingsState.calls = [];
    writeDataFile.mockClear();
  });

  it.each(['data2.json', '../workspace.json', 'datafiles/../settings.json', 'workspace.json'])(
    '取込先が datafiles/ 直下の .json でない %s は、書かずに失敗にする',
    async (targetFile) => {
      settingsState.rules = [rule(targetFile)];
      const service = new BookmarkAutoImportService();
      const result = await service.executeRule(rule(targetFile));
      expect(result.success).toBe(false);
      expect(writeDataFile).not.toHaveBeenCalled();
    }
  );

  it('実行結果をルールに書く前に、settings.json を読み直す（外で直したルールを古い写しで消さない）', async () => {
    settingsState.rules = [rule('datafiles/data.json')];
    const service = new BookmarkAutoImportService();
    const result = await service.executeRule(rule('datafiles/data.json'));
    expect(result.success).toBe(true);
    expect(writeDataFile).toHaveBeenCalledTimes(1);
    const reload = settingsState.calls.lastIndexOf('reload');
    const set = settingsState.calls.lastIndexOf('set');
    expect(reload).toBeGreaterThanOrEqual(0);
    expect(set).toBeGreaterThan(reload);
    expect(settingsState.calls.slice(reload, set)).toContain('get');
  });
});
