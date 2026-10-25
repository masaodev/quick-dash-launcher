import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { BrowserInfo } from '@common/types';
import type { BookmarkAutoImportRule } from '@common/types/bookmarkAutoImport';

import BookmarkAutoImportRuleModal from './BookmarkAutoImportRuleModal';

const getBookmarksWithFolders = vi.fn();

function browser(id: 'chrome' | 'edge', installed: boolean): BrowserInfo {
  return {
    id,
    displayName: id === 'chrome' ? 'Google Chrome' : 'Microsoft Edge',
    installed,
    profiles: installed
      ? [{ id: 'Default', displayName: 'Default', bookmarkPath: `C:\\${id}\\Default\\Bookmarks` }]
      : [],
  };
}

function renderModal(browsers: BrowserInfo[], rule: BookmarkAutoImportRule | null = null) {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      detectInstalledBrowsers: vi.fn(async () => browsers),
      bookmarkAutoImportAPI: { getBookmarksWithFolders },
    },
  });
  render(
    <BookmarkAutoImportRuleModal
      rule={rule}
      dataFileTabs={[{ name: 'メイン', files: ['datafiles/data.json'] }]}
      dataFileLabels={{}}
      onSave={vi.fn(async () => true)}
      onCancel={vi.fn()}
    />
  );
}

beforeEach(() => {
  getBookmarksWithFolders.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('BookmarkAutoImportRuleModal の取込元', () => {
  it('新しいルールで Chrome が無い PC では、見つかったブラウザ（Edge）を取込元にする', async () => {
    renderModal([browser('chrome', false), browser('edge', true)]);
    await waitFor(() =>
      expect(getBookmarksWithFolders).toHaveBeenCalledWith('C:\\edge\\Default\\Bookmarks')
    );
  });

  it('Chrome があれば、新しいルールの取込元は Chrome のまま', async () => {
    renderModal([browser('chrome', true), browser('edge', true)]);
    await waitFor(() =>
      expect(getBookmarksWithFolders).toHaveBeenCalledWith('C:\\chrome\\Default\\Bookmarks')
    );
    expect(getBookmarksWithFolders).not.toHaveBeenCalledWith('C:\\edge\\Default\\Bookmarks');
  });
});
