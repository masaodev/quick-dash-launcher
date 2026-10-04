import { describe, it, expect } from 'vitest';

import { isValidDataFileName } from './dataFileName';

describe('isValidDataFileName', () => {
  it.each(['datafiles/data.json', 'datafiles/data2.json', 'datafiles/work.json'])(
    '%s は受け付ける',
    (fileName) => {
      expect(isValidDataFileName(fileName)).toBe(true);
    }
  );

  it.each([
    '../settings.json',
    'datafiles/../settings.json',
    'datafiles/sub/data.json',
    'datafiles\\data.json',
    'datafiles/..\\settings.json',
    'datafiles/C:x.json',
    'datafiles/data.txt',
    'datafiles/.json',
    'data.json',
    'settings.json',
    'C:/Windows/data.json',
    '',
  ])('%s は受け付けない', (fileName) => {
    expect(isValidDataFileName(fileName)).toBe(false);
  });

  it('文字列以外は受け付けない', () => {
    expect(isValidDataFileName(undefined)).toBe(false);
    expect(isValidDataFileName(null)).toBe(false);
    expect(isValidDataFileName(1)).toBe(false);
  });
});
