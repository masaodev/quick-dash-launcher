import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearFolderProbeCache,
  markKnownFolderPath,
  prefetchFolderProbes,
  refineItemType,
  withFolderMarker,
} from './folderPathProbe';

/** 指定したパスだけフォルダとして返す stat */
function statOf(folders: string[]) {
  return vi.fn(async (p: string) => {
    if (folders.includes(p)) return { isDirectory: () => true };
    if (p.endsWith('.txt')) return { isDirectory: () => false };
    throw new Error('ENOENT');
  });
}

/** 応答しない stat（割り当てたネットワークドライブが切れているときなど） */
const hangingStat = () => new Promise<{ isDirectory(): boolean }>(() => {});

beforeEach(() => {
  clearFolderProbeCache();
});

describe('refineItemType（読み込み時）', () => {
  it('ドット入りのフォルダ名をフォルダと判定する', async () => {
    const stat = statOf(['C:\\work\\j-gate3.0あああ']);
    expect(await refineItemType('C:\\work\\j-gate3.0あああ', undefined, { stat })).toBe('folder');
  });

  it('実在するファイルと存在しないパスはファイルのまま', async () => {
    const stat = statOf([]);
    expect(await refineItemType('C:\\work\\memo.txt', undefined, { stat })).toBe('file');
    expect(await refineItemType('C:\\work\\gone.v1', undefined, { stat })).toBe('file');
  });

  it('ネットワークパス・URL・見た目でファイル以外のものはディスクを見ない', async () => {
    const stat = statOf(['\\\\server\\share\\v1.2']);
    expect(await refineItemType('\\\\server\\share\\v1.2', undefined, { stat })).toBe('file');
    expect(await refineItemType('https://example.com/a.html', undefined, { stat })).toBe('url');
    expect(await refineItemType('C:\\work\\folder', undefined, { stat })).toBe('folder');
    expect(await refineItemType('C:\\tools\\app.exe', undefined, { stat })).toBe('app');
    expect(stat).not.toHaveBeenCalled();
  });

  it('時間切れは判定を変えず、同じパスは 2 回目から確かめない', async () => {
    const stat = vi.fn(hangingStat);
    const options = { stat, timeoutMs: 10 };
    expect(await refineItemType('Z:\\share\\v1.2', undefined, options)).toBe('file');
    expect(await refineItemType('Z:\\share\\v1.2', undefined, options)).toBe('file');
    expect(stat).toHaveBeenCalledTimes(1);
  });

  it('prefetchFolderProbes で確かめた結果を使う', async () => {
    const stat = statOf(['C:\\work\\a.b']);
    await prefetchFolderProbes(['C:\\work\\a.b', 'C:\\work\\a.b', 'C:\\work\\folder'], { stat });
    expect(stat).toHaveBeenCalledTimes(1);
    expect(await refineItemType('C:\\work\\a.b')).toBe('folder');
    expect(stat).toHaveBeenCalledTimes(1);
  });

  it('clearFolderProbeCache の後は確かめ直す', async () => {
    const stat = statOf(['C:\\work\\a.b']);
    await refineItemType('C:\\work\\a.b', undefined, { stat });
    clearFolderProbeCache();
    await refineItemType('C:\\work\\a.b', undefined, { stat });
    expect(stat).toHaveBeenCalledTimes(2);
  });
});

describe('withFolderMarker（登録・編集時）', () => {
  it('ドット入りのフォルダ名に末尾の区切り文字を付ける（ネットワークパスも対象）', async () => {
    const stat = statOf(['C:\\work\\j-gate3.0', '\\\\server\\share\\v1.2']);
    expect(await withFolderMarker('C:\\work\\j-gate3.0', { stat })).toBe('C:\\work\\j-gate3.0\\');
    expect(await withFolderMarker('\\\\server\\share\\v1.2', { stat })).toBe(
      '\\\\server\\share\\v1.2\\'
    );
  });

  it('ファイル・存在しないパス・時間切れはそのまま', async () => {
    const stat = statOf([]);
    expect(await withFolderMarker('C:\\work\\memo.txt', { stat })).toBe('C:\\work\\memo.txt');
    expect(await withFolderMarker('C:\\work\\gone.v1', { stat })).toBe('C:\\work\\gone.v1');
    expect(
      await withFolderMarker('\\\\server\\share\\v1.2', { stat: hangingStat, timeoutMs: 10 })
    ).toBe('\\\\server\\share\\v1.2');
  });

  it('見た目でフォルダ・アプリ・URL と分かるものと、末尾が区切り文字のものは確かめない', async () => {
    const stat = statOf([]);
    for (const p of ['C:\\work\\folder', 'C:\\tools\\app.lnk', 'https://a.b/c.d', 'C:\\a.b\\']) {
      expect(await withFolderMarker(p, { stat })).toBe(p);
    }
    expect(stat).not.toHaveBeenCalled();
  });

  it('スラッシュ区切りのパスにはスラッシュを付ける', async () => {
    const stat = statOf(['C:/work/v1.2']);
    expect(await withFolderMarker('C:/work/v1.2', { stat })).toBe('C:/work/v1.2/');
  });
});

describe('markKnownFolderPath', () => {
  it('見た目でファイルのパスにだけ区切り文字を付ける', () => {
    expect(markKnownFolderPath('C:\\work\\j-gate3.0')).toBe('C:\\work\\j-gate3.0\\');
    expect(markKnownFolderPath('C:\\work\\folder')).toBe('C:\\work\\folder');
    expect(markKnownFolderPath('C:\\work\\link.lnk')).toBe('C:\\work\\link.lnk');
  });
});
