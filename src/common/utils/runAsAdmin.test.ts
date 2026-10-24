import { describe, expect, it } from 'vitest';

import { canRunAsAdmin, canSetRunAsAdmin, pickRunAsAdmin, shouldRunAsAdmin } from './runAsAdmin';

describe('canSetRunAsAdmin（登録・編集画面のパスの形で決める）', () => {
  it.each(['C:\\Tools\\tool.exe', 'notepad.exe', 'C:\\a\\Tool.lnk', 'C:\\a\\run.bat', 'run.cmd'])(
    '%s は付けられる',
    (path) => {
      expect(canSetRunAsAdmin(path)).toBe(true);
    }
  );

  it.each([
    'https://example.com/',
    'C:\\docs\\report.xlsx',
    'C:\\Projects',
    'shell:AppsFolder\\Microsoft.App!App',
    '',
  ])('%s は付けられない', (path) => {
    expect(canSetRunAsAdmin(path)).toBe(false);
  });
});

describe('pickRunAsAdmin', () => {
  it('true のときだけ書く', () => {
    expect(pickRunAsAdmin({ runAsAdmin: true })).toEqual({ runAsAdmin: true });
    expect(pickRunAsAdmin({ runAsAdmin: false })).toEqual({});
    expect(pickRunAsAdmin({})).toEqual({});
  });
});

describe('shouldRunAsAdmin', () => {
  it('設定があり、対象の種類のときだけ管理者として開く', () => {
    expect(shouldRunAsAdmin({ type: 'app', path: 'tool.exe', runAsAdmin: true })).toBe(true);
    expect(shouldRunAsAdmin({ type: 'app', path: 'tool.exe' })).toBe(false);
    // パスを URL に変えたなど、設定が残っていても対象外なら普通に開く
    expect(shouldRunAsAdmin({ type: 'url', path: 'https://a/', runAsAdmin: true })).toBe(false);
  });
});

describe('canRunAsAdmin', () => {
  it.each([
    ['C:\\Tools\\tool.exe'],
    ['notepad.exe'],
    ['C:\\Users\\me\\Desktop\\Tool.lnk'],
    ['C:\\scripts\\setup.bat'],
    ['C:\\scripts\\setup.cmd'],
  ])('アプリ（%s）は対象', (path) => {
    expect(canRunAsAdmin({ type: 'app', path })).toBe(true);
  });

  it('ストアアプリ（shell:AppsFolder）は対象外', () => {
    expect(canRunAsAdmin({ type: 'app', path: 'shell:AppsFolder\\Microsoft.App!App' })).toBe(false);
  });

  it('パスが空なら対象外', () => {
    expect(canRunAsAdmin({ type: 'app', path: '  ' })).toBe(false);
    expect(canRunAsAdmin({ type: 'app' })).toBe(false);
  });

  it.each(['url', 'customUri', 'file', 'folder', 'windowSwitch', 'clipboard', 'set'])(
    '%s は対象外',
    (type) => {
      expect(canRunAsAdmin({ type, path: 'C:\\Tools\\tool.exe' })).toBe(false);
    }
  );
});
