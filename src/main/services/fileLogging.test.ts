import { describe, it, expect } from 'vitest';

import { formatConsoleLine } from './fileLogging';

describe('formatConsoleLine', () => {
  it('console の引数を、pino と同じ形の JSON 1 行にする', () => {
    const line = formatConsoleLine(
      50,
      ['起動時バックアップでエラー:', new Error('boom')],
      new Date(0)
    );
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 50,
      time: '1970-01-01T00:00:00.000Z',
      name: 'QuickDashLauncher',
      context: 'console',
    });
    expect(parsed.msg).toContain('起動時バックアップでエラー: Error: boom');
  });
});
