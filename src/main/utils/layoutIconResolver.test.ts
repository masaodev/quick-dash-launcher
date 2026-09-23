import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LayoutWindowEntry } from '@common/types';

const extractIcon = vi.fn<(filePath: string, iconsFolder: string) => Promise<string | null>>();

vi.mock('../services/icon/fileIconExtractor.js', () => ({
  extractIcon: (filePath: string, iconsFolder: string) => extractIcon(filePath, iconsFolder),
}));

vi.mock('../config/pathManager.js', () => ({
  default: { getAppsFolder: () => 'C:\\icons\\apps' },
}));

vi.mock('@common/logger', () => ({
  itemLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { resolveLayoutEntryIcons } = await import('./layoutIconResolver');

/** テスト用のレイアウトエントリを作る */
function entry(partial: Partial<LayoutWindowEntry>): LayoutWindowEntry {
  return { windowTitle: 'window', ...partial } as LayoutWindowEntry;
}

describe('resolveLayoutEntryIcons', () => {
  beforeEach(() => {
    extractIcon.mockReset();
  });

  it('アイコン未設定のエントリだけを解決する', async () => {
    extractIcon.mockResolvedValue('data:image/png;base64,AAA');

    const result = await resolveLayoutEntryIcons([
      entry({ executablePath: 'ms-todo:' }),
      entry({ executablePath: 'C:\\has-icon.exe', icon: 'data:image/png;base64,EXISTING' }),
    ]);

    expect(extractIcon).toHaveBeenCalledTimes(1);
    expect(extractIcon).toHaveBeenCalledWith('ms-todo:', 'C:\\icons\\apps');
    expect(result.get('ms-todo:')).toBe('data:image/png;base64,AAA');
    expect(result.has('C:\\has-icon.exe')).toBe(false);
  });

  it('同一パスは重複して解決しない', async () => {
    extractIcon.mockResolvedValue('data:image/png;base64,AAA');

    const result = await resolveLayoutEntryIcons([
      entry({ executablePath: 'ms-todo:' }),
      entry({ executablePath: 'ms-todo:' }),
      entry({ executablePath: 'ms-todo:' }),
    ]);

    expect(extractIcon).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(1);
  });

  it('executablePathを持たないエントリは無視する', async () => {
    const result = await resolveLayoutEntryIcons([entry({}), entry({ executablePath: '' })]);

    expect(extractIcon).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('解決できなかったパスは結果に含めない', async () => {
    extractIcon.mockResolvedValue(null);

    const result = await resolveLayoutEntryIcons([entry({ executablePath: 'C:\\missing.exe' })]);

    expect(result.size).toBe(0);
  });

  it('一部が例外を投げても他のエントリの解決は続行する', async () => {
    extractIcon.mockImplementation(async (filePath) => {
      if (filePath === 'C:\\broken.exe') throw new Error('boom');
      return 'data:image/png;base64,OK';
    });

    const result = await resolveLayoutEntryIcons([
      entry({ executablePath: 'C:\\broken.exe' }),
      entry({ executablePath: 'C:\\fine.exe' }),
    ]);

    expect(result.has('C:\\broken.exe')).toBe(false);
    expect(result.get('C:\\fine.exe')).toBe('data:image/png;base64,OK');
  });

  it('同時実行数を4に制限する', async () => {
    let running = 0;
    let maxRunning = 0;
    extractIcon.mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return 'data:image/png;base64,OK';
    });

    const entries = Array.from({ length: 12 }, (_, i) =>
      entry({ executablePath: `C:\\app${i}.exe` })
    );
    const result = await resolveLayoutEntryIcons(entries);

    expect(result.size).toBe(12);
    expect(maxRunning).toBeLessThanOrEqual(4);
  });

  it('対象が無ければextractIconを呼ばない', async () => {
    const result = await resolveLayoutEntryIcons([]);

    expect(extractIcon).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});
