import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppItem, WorkspaceItem } from '@common/types';

// ドロップ・貼り付け・CLI の --path で、ランチャーにパスの同じアイテムがあれば参照で足す（A3-256）

const service = {
  addRef: vi.fn(async (main: { id: string; displayName: string }) => ({
    id: 'Ws-ref',
    type: 'item',
    displayName: main.displayName,
    ref: { itemId: main.id, status: 'ok' },
  })),
  addItemFromPath: vi.fn(async (path: string) => ({
    id: 'Ws-copy',
    type: 'item',
    displayName: path.split('\\').pop(),
    path,
  })),
  addItem: vi.fn(async (item: AppItem) => ({
    id: 'Ws-item',
    type: 'item',
    displayName: 'displayName' in item ? item.displayName : '',
  })),
};

vi.mock('./WorkspaceService.js', () => ({
  WorkspaceService: { getInstance: async () => service },
}));
vi.mock('../mainI18n.js', () => ({ mainI18n: { t: (key: string) => key } }));
vi.mock('../../config/pathManager.js', () => ({ default: { getConfigFolder: () => 'C:\\cfg' } }));
vi.mock('../clipboardService.js', () => ({ ClipboardService: { getInstance: () => ({}) } }));
vi.mock('../settingsService.js', () => ({ SettingsService: {} }));
vi.mock('../data/dataFileLoader.js', () => ({ reloadConfigFiles: vi.fn() }));
vi.mock('../data/dataItemWriter.js', () => ({
  appendJsonItems: vi.fn(),
  updateItemMemoById: vi.fn(),
}));
vi.mock('../../ipc/notifications.js', () => ({ notifyDataChanged: vi.fn() }));

import { buildMainItemIndex, setMainItemIndex } from './workspaceRefResolver';
import {
  addAppItemToWorkspace,
  addPathToWorkspace,
  findSamePathMainItem,
} from './workspaceRefOperations';

const main: AppItem[] = [
  { id: 'Main0001', displayName: 'エディタ', path: 'C:\\Tools\\Editor.exe', type: 'app' },
  {
    id: 'Main0002',
    displayName: 'エディタ（別プロファイル）',
    path: 'C:\\Tools\\Editor.exe',
    args: '--profile work',
    type: 'app',
  },
  { id: 'Main0003', displayName: '資料フォルダ', path: 'C:\\Docs\\', type: 'folder' },
  { id: 'Main0004', displayName: '資料フォルダ（2 件目）', path: 'C:\\Docs', type: 'folder' },
  { id: 'Main0005', displayName: '社内ポータル', path: 'https://portal.example.com/', type: 'url' },
  {
    id: 'Main0006',
    displayName: '動画',
    path: 'https://video.example.com/watch?v=abcDEF',
    type: 'url',
  },
  // フォルダ取込で展開したアイテムは参照できない
  {
    displayName: 'a.txt',
    path: 'C:\\Expanded\\a.txt',
    type: 'file',
    isDirExpanded: true,
    expandedFromId: 'Dir00001',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  setMainItemIndex(buildMainItemIndex(main));
});

describe('findSamePathMainItem', () => {
  it('大文字小文字・末尾の区切り文字の違いは同じとみなす', async () => {
    expect((await findSamePathMainItem('c:\\tools\\editor.exe'))?.id).toBe('Main0001');
    expect((await findSamePathMainItem('C:\\Docs'))?.id).toBe('Main0003');
  });

  it('引数の無いものを探すと、引数付きのアイテムには当たらない。引数も比べる', async () => {
    expect((await findSamePathMainItem('C:\\Tools\\Editor.exe'))?.displayName).toBe('エディタ');
    expect((await findSamePathMainItem('C:\\Tools\\Editor.exe', '--profile work'))?.id).toBe(
      'Main0002'
    );
    expect(await findSamePathMainItem('C:\\Tools\\Editor.exe', '--other')).toBeUndefined();
  });

  it('同じパスが複数あれば、表の並びで最初のもの', async () => {
    expect((await findSamePathMainItem('C:\\Docs\\'))?.id).toBe('Main0003');
  });

  it('URL は末尾のスラッシュ・大文字小文字の違いを同じとみなす', async () => {
    expect((await findSamePathMainItem('https://Portal.example.com'))?.id).toBe('Main0005');
  });

  it('フォルダ取込で展開したアイテム・無いパスには当たらない', async () => {
    expect(await findSamePathMainItem('C:\\Expanded\\a.txt')).toBeUndefined();
    expect(await findSamePathMainItem('C:\\Nowhere\\b.txt')).toBeUndefined();
    expect(await findSamePathMainItem('  ')).toBeUndefined();
  });
  it('URL はスキームとホストだけ大文字小文字を区別せず、パス・クエリは区別する', async () => {
    expect((await findSamePathMainItem('HTTPS://VIDEO.example.com/watch?v=abcDEF'))?.id).toBe(
      'Main0006'
    );
    expect(await findSamePathMainItem('https://video.example.com/watch?v=ABCdef')).toBeUndefined();
  });
});

describe('addPathToWorkspace', () => {
  it('ランチャーに同じパスがあれば参照で足す', async () => {
    const r = await addPathToWorkspace('C:\\tools\\editor.exe', 'Gr1', 'Ws1');
    expect(r).toMatchObject({ linked: true, linkedBySamePath: true });
    expect(r.item.displayName).toBe('エディタ');
    expect(service.addRef).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Main0001' }),
      'Gr1',
      'Ws1'
    );
    expect(service.addItemFromPath).not.toHaveBeenCalled();
  });

  it('無ければ今までどおりパスから作る', async () => {
    const r = await addPathToWorkspace('C:\\Other\\memo.txt', 'Gr1', 'Ws1');
    expect(r).toMatchObject({ linked: false });
    expect(r.linkedBySamePath).toBeUndefined();
    expect(service.addItemFromPath).toHaveBeenCalledWith('C:\\Other\\memo.txt', 'Gr1', 'Ws1');
    expect(service.addRef).not.toHaveBeenCalled();
  });
});

describe('addAppItemToWorkspace の linkSamePath', () => {
  const url: AppItem = {
    displayName: 'https://portal.example.com',
    path: 'https://portal.example.com',
    type: 'url',
  };

  it('linkSamePath なら、id の無い URL でもランチャーに同じものがあれば参照で足す', async () => {
    const r = await addAppItemToWorkspace(url, 'Gr1', 'Ws1', { linkSamePath: true });
    expect(r).toMatchObject({ linked: true, linkedBySamePath: true });
    expect((r.item as WorkspaceItem).displayName).toBe('社内ポータル');
  });

  it('linkSamePath が無い・copy のときは今までどおりコピー', async () => {
    for (const options of [{}, { linkSamePath: true, copy: true }]) {
      vi.clearAllMocks();
      const r = await addAppItemToWorkspace(url, 'Gr1', 'Ws1', options);
      expect(r.linked).toBe(false);
      expect(service.addRef).not.toHaveBeenCalled();
      expect(service.addItem).toHaveBeenCalled();
    }
  });
});
