import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const onSave = vi.fn(async (_rule: BookmarkAutoImportRule, _destination: unknown) => true);
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
      onSave={onSave}
      onCancel={vi.fn()}
    />
  );
  return { onSave };
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

  it('Chrome が無く、見つかったブラウザにプロファイルが無くても、取込元はそのブラウザにする', async () => {
    const { onSave } = renderModal([
      browser('chrome', false),
      { ...browser('edge', true), profiles: [] },
    ]);
    await screen.findByRole('option', { name: 'Microsoft Edge' });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ browserId: 'edge', profileIds: [] });
  });

  it('Chrome があれば、新しいルールの取込元は Chrome のまま', async () => {
    renderModal([browser('chrome', true), browser('edge', true)]);
    await waitFor(() =>
      expect(getBookmarksWithFolders).toHaveBeenCalledWith('C:\\chrome\\Default\\Bookmarks')
    );
    expect(getBookmarksWithFolders).not.toHaveBeenCalledWith('C:\\edge\\Default\\Bookmarks');
  });
});
