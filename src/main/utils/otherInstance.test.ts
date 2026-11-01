import { describe, it, expect } from 'vitest';

import { findOtherRunningExe } from './otherInstance';

const ownExe = 'C:\\Program Files\\QuickDashLauncher\\QuickDashLauncher.exe';
const zipExe = 'D:\\tools\\QuickDashLauncher\\QuickDashLauncher.exe';
const reader = (content: string) => () => content;

describe('findOtherRunningExe', () => {
  it('記録された exe が自分と違えば、その場所を返す', () => {
    expect(
      findOtherRunningExe('C:\\data', ownExe, reader(JSON.stringify({ exePath: zipExe })))
    ).toBe(zipExe);
  });

  it('記録された exe が自分と同じなら null（大文字・小文字の違いは同じとみなす）', () => {
    const content = JSON.stringify({ exePath: ownExe.toLowerCase() });
    expect(findOtherRunningExe('C:\\data', ownExe, reader(content))).toBeNull();
  });

  it('BOM 付きでも読む', () => {
    const content = '\uFEFF' + JSON.stringify({ exePath: zipExe });
    expect(findOtherRunningExe('C:\\data', ownExe, reader(content))).toBe(zipExe);
  });

  it('ファイルが無い・壊れている・exePath が無いときは null', () => {
    const missing = () => {
      throw new Error('ENOENT');
    };
    expect(findOtherRunningExe('C:\\data', ownExe, missing)).toBeNull();
    expect(findOtherRunningExe('C:\\data', ownExe, reader('{'))).toBeNull();
    expect(findOtherRunningExe('C:\\data', ownExe, reader('{"version":"1"}'))).toBeNull();
  });
});
