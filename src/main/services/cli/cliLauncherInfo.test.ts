import { describe, it, expect } from 'vitest';

import { resolveAppExePath } from './cliLauncherInfo';

const TEMP = 'C:\\Users\\taro\\AppData\\Local\\Temp';

describe('resolveAppExePath', () => {
  it('インストーラー版は自分の exe をそのまま使う', () => {
    const exe = 'C:\\Program Files\\QuickDashLauncher\\QuickDashLauncher.exe';
    expect(resolveAppExePath(exe, {}, TEMP)).toBe(exe);
  });

  it('ポータブル版は展開前の exe を使う', () => {
    expect(
      resolveAppExePath(
        `${TEMP}\\3KEnV7Z\\QuickDashLauncher.exe`,
        { PORTABLE_EXECUTABLE_FILE: 'C:\\tools\\QuickDashLauncher.0.8.0.exe' },
        TEMP
      )
    ).toBe('C:\\tools\\QuickDashLauncher.0.8.0.exe');
  });

  it('ポータブル版の QDL から起動されたインストーラー版は、引き継いだ環境変数を使わない', () => {
    const exe = 'C:\\Program Files\\QuickDashLauncher\\QuickDashLauncher.exe';
    expect(
      resolveAppExePath(
        exe,
        { PORTABLE_EXECUTABLE_FILE: 'C:\\tools\\QuickDashLauncher.0.8.0.exe' },
        TEMP
      )
    ).toBe(exe);
  });
});
