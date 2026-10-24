import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setExtensionlessFileMemoStorage } from './extensionlessFileMemo';
import {
  applyExtensionlessFileMemo,
  beginLoadProbeSession,
  clearFolderProbeCache,
  endLoadProbeSession,
  getPathKind,
  markKnownFolderPath,
  noteLaunchedPath,
  prefetchFolderProbes,
  refineItemType,
  withFolderMarker,
} from './folderPathProbe';

/** 指定したパスだけフォルダ・ファイルとして返す stat（.txt は常にファイル） */
function statOf(folders: string[], files: string[] = []) {
  return vi.fn(async (p: string) => {
    if (folders.includes(p)) return { isDirectory: () => true };
    if (files.includes(p) || p.endsWith('.txt')) return { isDirectory: () => false };
    throw new Error('ENOENT');
  });
}

/** 応答しない stat（割り当てたネットワークドライブが切れているときなど） */
const hangingStat = () => new Promise<{ isDirectory(): boolean }>(() => {});

/** メモの保存先（テストではメモリ上） */
let saved: string[] = [];
const writes = vi.fn();

function useMemo(initial: string[] = []): void {
  saved = [...initial];
  writes.mockClear();
  setExtensionlessFileMemoStorage({
    read: () => saved,
    write: (paths) => {
      saved = paths;
      writes(paths);
    },
  });
}

const HOSTS = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

beforeEach(() => {
  clearFolderProbeCache();
  endLoadProbeSession(null);
  useMemo();
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

  it('アプリ・URL と分かるものと、末尾が区切り文字のものは確かめない', async () => {
    const stat = statOf([]);
    for (const p of ['C:\\tools\\app.lnk', 'https://a.b/c.d', 'C:\\a.b\\', 'shell:Downloads']) {
      expect(await withFolderMarker(p, { stat })).toBe(p);
    }
    expect(stat).not.toHaveBeenCalled();
  });

  it('拡張子の無いパスは確かめ、ファイルならメモに残す（パスはそのまま）', async () => {
    const stat = statOf(['C:\\work\\folder'], [HOSTS, '\\\\server\\share\\README']);
    expect(await withFolderMarker(HOSTS, { stat })).toBe(HOSTS);
    expect(await withFolderMarker('C:\\work\\folder', { stat })).toBe('C:\\work\\folder');
    expect(await withFolderMarker('\\\\server\\share\\README', { stat })).toBe(
      '\\\\server\\share\\README'
    );
    expect(saved).toEqual([
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
      '\\\\server\\share\\README',
    ]);
  });

  it('メモにあったパスがフォルダ・存在しないと分かったらメモから外す', async () => {
    useMemo([HOSTS, 'C:\\work\\gone']);
    const stat = statOf([HOSTS]);
    await withFolderMarker(HOSTS, { stat });
    await withFolderMarker('C:\\work\\gone', { stat });
    expect(saved).toEqual([]);
  });

  it('時間切れのときはメモを変えない', async () => {
    useMemo([HOSTS]);
    await withFolderMarker(HOSTS, { stat: hangingStat, timeoutMs: 10 });
    expect(saved).toEqual([HOSTS]);
    expect(writes).not.toHaveBeenCalled();
  });

  it('スラッシュ区切りのパスにはスラッシュを付ける', async () => {
    const stat = statOf(['C:/work/v1.2']);
    expect(await withFolderMarker('C:/work/v1.2', { stat })).toBe('C:/work/v1.2/');
  });
});

describe('拡張子の無いファイルのメモ（読み込み時）', () => {
  it('メモにあるパスはファイル、無いパスは今までどおりフォルダ（ディスクは読まない）', async () => {
    useMemo([HOSTS]);
    const stat = statOf([]);
    expect(await refineItemType(HOSTS, undefined, { stat })).toBe('file');
    expect(await refineItemType('C:\\work\\folder', undefined, { stat })).toBe('folder');
    expect(applyExtensionlessFileMemo(HOSTS)).toBe('file');
    expect(applyExtensionlessFileMemo(`${HOSTS}\\`)).toBe('folder');
    expect(stat).not.toHaveBeenCalled();
  });

  it('普通の読み込み（normal）はディスクを読まず、データに無いパスのメモを捨てる', async () => {
    useMemo([HOSTS, 'C:\\old\\removed']);
    const stat = statOf([], [HOSTS]);
    await beginLoadProbeSession('normal', { stat });
    await prefetchFolderProbes([HOSTS], { stat });
    expect(await refineItemType(HOSTS, undefined, { stat })).toBe('file');
    endLoadProbeSession([HOSTS]);
    expect(stat).not.toHaveBeenCalled();
    expect(saved).toEqual([HOSTS]);
  });

  it('大文字・小文字の違うパスも同じものとして照合し、刈り込みでも残す', async () => {
    useMemo([HOSTS]);
    const upper = HOSTS.toUpperCase();
    expect(applyExtensionlessFileMemo(upper)).toBe('file');
    endLoadProbeSession([upper]);
    expect(saved).toEqual([HOSTS]);
    expect(writes).not.toHaveBeenCalled();
  });

  it('読めなかったファイルがあるとき（null）はメモを捨てない', async () => {
    useMemo([HOSTS, 'C:\\old\\removed']);
    await beginLoadProbeSession('normal');
    await refineItemType(HOSTS);
    endLoadProbeSession(null);
    expect(saved).toEqual([HOSTS, 'C:\\old\\removed']);
  });

  it('F5（recheck）はメモにあるドライブ文字のパスだけ確かめ直す', async () => {
    useMemo([HOSTS, 'C:\\work\\now-folder', '\\\\server\\share\\README']);
    const stat = statOf(['C:\\work\\now-folder'], [HOSTS]);
    await beginLoadProbeSession('recheck', { stat });
    expect(stat).toHaveBeenCalledTimes(2);
    expect(saved).toEqual([HOSTS, '\\\\server\\share\\README']);
    // 拡張子の無いほかのパスは確かめない
    await prefetchFolderProbes(['C:\\work\\other'], { stat });
    expect(await refineItemType('C:\\work\\other', undefined, { stat })).toBe('folder');
    expect(stat).toHaveBeenCalledTimes(2);
  });

  it('「アイコンをすべて取り直す」（rebuild）は拡張子の無いドライブ文字のパスをすべて確かめてメモを作り直す', async () => {
    useMemo(['C:\\old\\removed', 'C:\\work\\now-folder']);
    const stat = statOf(['C:\\work\\now-folder', 'C:\\work\\folder'], [HOSTS]);
    await beginLoadProbeSession('rebuild', { stat });
    const paths = [HOSTS, 'C:\\work\\folder', 'C:\\work\\now-folder', '\\\\server\\share\\x'];
    await prefetchFolderProbes(paths, { stat });
    expect(await refineItemType(HOSTS, undefined, { stat })).toBe('file');
    expect(await refineItemType('C:\\work\\folder', undefined, { stat })).toBe('folder');
    expect(await refineItemType('C:\\work\\now-folder', undefined, { stat })).toBe('folder');
    expect(await refineItemType('\\\\server\\share\\x', undefined, { stat })).toBe('folder');
    endLoadProbeSession(paths);
    // ネットワークパスは確かめない
    expect(stat).toHaveBeenCalledTimes(3);
    expect(saved).toEqual([HOSTS]);
  });

  it('「アイコンをすべて取り直す」で時間切れのパスは、前のメモを残す', async () => {
    useMemo(['Z:\\share\\README']);
    const options = { stat: hangingStat, timeoutMs: 10 };
    await beginLoadProbeSession('rebuild', options);
    expect(await refineItemType('Z:\\share\\README', undefined, options)).toBe('file');
    endLoadProbeSession(['Z:\\share\\README']);
    expect(saved).toEqual(['Z:\\share\\README']);
  });
});

describe('noteLaunchedPath（起動時）', () => {
  it('拡張子の無いパスを確かめてメモに残す', async () => {
    const stat = statOf([], [HOSTS]);
    await noteLaunchedPath(HOSTS, { stat });
    expect(saved).toEqual([HOSTS]);
  });

  it('拡張子つき・末尾が区切り文字のパスは確かめない', async () => {
    const stat = statOf([]);
    await noteLaunchedPath('C:\\work\\memo.txt', { stat });
    await noteLaunchedPath('C:\\work\\folder\\', { stat });
    expect(stat).not.toHaveBeenCalled();
  });
});

describe('getPathKind', () => {
  it('フォルダ・ファイル・存在しないを返し、時間切れは存在しない扱い', async () => {
    const stat = statOf(['C:\\work'], [HOSTS]);
    expect(await getPathKind('C:\\work', { stat })).toBe('folder');
    expect(await getPathKind(HOSTS, { stat })).toBe('file');
    expect(await getPathKind('C:\\gone', { stat })).toBe('missing');
    expect(await getPathKind('Z:\\x', { stat: hangingStat, timeoutMs: 10 })).toBe('missing');
  });
});

describe('markKnownFolderPath', () => {
  it('見た目でファイルのパスにだけ区切り文字を付ける', () => {
    expect(markKnownFolderPath('C:\\work\\j-gate3.0')).toBe('C:\\work\\j-gate3.0\\');
    expect(markKnownFolderPath('C:\\work\\folder')).toBe('C:\\work\\folder');
    expect(markKnownFolderPath('C:\\work\\link.lnk')).toBe('C:\\work\\link.lnk');
  });
});
