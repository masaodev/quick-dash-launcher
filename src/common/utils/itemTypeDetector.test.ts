import { describe, it, expect, vi } from 'vitest';

import { detectItemTypeSync, detectItemType } from './itemTypeDetector';

describe('detectItemTypeSync', () => {
  it('標準URLスキーマはurlと判定する', () => {
    expect(detectItemTypeSync('https://example.com')).toBe('url');
    expect(detectItemTypeSync('http://example.com/path')).toBe('url');
    expect(detectItemTypeSync('ftp://files.example.com')).toBe('url');
  });

  it('スラッシュ付きの非標準スキーマはcustomUriと判定する', () => {
    expect(detectItemTypeSync('obsidian://advanced-uri?vault=test')).toBe('customUri');
    expect(detectItemTypeSync('vscode://file/c:/work')).toBe('customUri');
  });

  it('スラッシュなしのカスタムURIもcustomUriと判定する', () => {
    // folderと誤判定するとshell.openPathで起動しようとして失敗する
    expect(detectItemTypeSync('ms-todo:')).toBe('customUri');
    expect(detectItemTypeSync('ms-excel:ofe|u|https://example.com/Book.xlsx')).toBe('customUri');
    expect(detectItemTypeSync('mailto:test@example.com')).toBe('customUri');
  });

  it('shellパスは従来どおり判定する', () => {
    expect(detectItemTypeSync('shell:AppsFolder\\Microsoft.Todos_8wekyb3d8bbwe!App')).toBe('app');
    expect(detectItemTypeSync('shell:Downloads')).toBe('folder');
  });

  it('実行可能ファイルはappと判定する', () => {
    expect(detectItemTypeSync('C:\\Windows\\explorer.exe')).toBe('app');
    expect(detectItemTypeSync('wt.exe')).toBe('app');
    expect(detectItemTypeSync('C:\\Users\\test\\Proton VPN.lnk')).toBe('app');
    expect(detectItemTypeSync('script.bat')).toBe('app');
  });

  it('拡張子なし・セパレータ終わりはfolderと判定する', () => {
    expect(detectItemTypeSync('C:\\Users\\daido\\Downloads')).toBe('folder');
    expect(detectItemTypeSync('C:\\Users\\daido\\git\\')).toBe('folder');
    expect(detectItemTypeSync('M:\\')).toBe('folder');
  });

  it('その他の拡張子付きパスはfileと判定する', () => {
    expect(detectItemTypeSync('C:\\Users\\daido\\一時メモ.txt')).toBe('file');
    expect(detectItemTypeSync('C:\\work\\Book.xlsm')).toBe('file');
  });

  it('ドライブレターをカスタムURIと誤認しない', () => {
    expect(detectItemTypeSync('C:\\Windows')).toBe('folder');
    expect(detectItemTypeSync('D:\\data\\file.csv')).toBe('file');
  });
});

describe('detectItemType', () => {
  it('ディレクトリ判定がtrueならfolderを返す', async () => {
    const isDirectory = vi.fn().mockResolvedValue(true);
    await expect(detectItemType('C:\\Users\\daido\\Downloads', isDirectory)).resolves.toBe(
      'folder'
    );
    expect(isDirectory).toHaveBeenCalledOnce();
  });

  it('カスタムURIに対してはディレクトリ照会を行わない', async () => {
    const isDirectory = vi.fn().mockResolvedValue(false);
    await expect(detectItemType('ms-todo:', isDirectory)).resolves.toBe('customUri');
    await expect(detectItemType('obsidian://vault', isDirectory)).resolves.toBe('customUri');
    expect(isDirectory).not.toHaveBeenCalled();
  });

  it('shellパスに対してはディレクトリ照会を行わない', async () => {
    const isDirectory = vi.fn().mockResolvedValue(false);
    await expect(detectItemType('shell:Downloads', isDirectory)).resolves.toBe('folder');
    expect(isDirectory).not.toHaveBeenCalled();
  });

  it('ディレクトリ照会が失敗してもパスパターンで判定を続行する', async () => {
    const isDirectory = vi.fn().mockRejectedValue(new Error('access denied'));
    await expect(detectItemType('C:\\Windows\\explorer.exe', isDirectory)).resolves.toBe('app');
  });
});
