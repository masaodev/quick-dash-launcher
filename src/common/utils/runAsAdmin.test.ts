import { describe, expect, it } from 'vitest';

import { canRunAsAdmin } from './runAsAdmin';

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
