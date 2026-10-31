import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SearchHistoryService } from './searchHistoryService';

describe('SearchHistoryService', () => {
  let dir: string;
  const historyPath = () => path.join(dir, 'search-history.json');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-history-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('履歴を版 "1.0" で書き、新しい順に読むこと', () => {
    const service = new SearchHistoryService(dir);
    service.addHistoryEntry('a');
    service.addHistoryEntry('b');

    const saved = JSON.parse(fs.readFileSync(historyPath(), 'utf8'));
    expect(saved.version).toBe('1.0');
    expect(service.loadHistory().map((e) => e.query)).toContain('a');
  });

  it('新しい版の QDL が書いたファイルは上書きしないこと', () => {
    const original = JSON.stringify({
      version: '2.0',
      entries: [{ query: 'old', timestamp: '2026-01-01T00:00:00.000Z' }],
    });
    fs.writeFileSync(historyPath(), original);

    const service = new SearchHistoryService(dir);
    service.addHistoryEntry('new');

    expect(fs.readFileSync(historyPath(), 'utf8')).toBe(original);
  });
});
