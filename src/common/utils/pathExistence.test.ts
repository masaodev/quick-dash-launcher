import { describe, it, expect } from 'vitest';

import { isPathExistenceCheckable } from './pathExistence';

describe('isPathExistenceCheckable', () => {
  it('ローカルのファイル・フォルダのパスは確認対象にすること', () => {
    expect(isPathExistenceCheckable('C:\\Program Files\\App\\app.exe')).toBe(true);
    expect(isPathExistenceCheckable('C:\\Users\\me\\Documents')).toBe(true);
    expect(isPathExistenceCheckable('\\\\server\\share\\file.txt')).toBe(true);
    expect(isPathExistenceCheckable('%APPDATA%\\tool\\tool.exe')).toBe(true);
    expect(isPathExistenceCheckable('C:/work/notes.md')).toBe(true);
  });

  it('URL・カスタム URI・shell: は対象外にすること', () => {
    expect(isPathExistenceCheckable('https://github.com/')).toBe(false);
    expect(isPathExistenceCheckable('obsidian://open?vault=x')).toBe(false);
    expect(isPathExistenceCheckable('ms-todo:')).toBe(false);
    expect(isPathExistenceCheckable('shell:Desktop')).toBe(false);
    expect(isPathExistenceCheckable('shell:AppsFolder\\App')).toBe(false);
  });

  it('裸のコマンド名と空は対象外にすること', () => {
    expect(isPathExistenceCheckable('notepad.exe')).toBe(false);
    expect(isPathExistenceCheckable('calc.exe')).toBe(false);
    expect(isPathExistenceCheckable('')).toBe(false);
    expect(isPathExistenceCheckable('   ')).toBe(false);
    expect(isPathExistenceCheckable(undefined)).toBe(false);
  });
});
