import { describe, it, expect } from 'vitest';

import { resolveMainChildWindowSpec } from './mainChildWindowSpec';

describe('resolveMainChildWindowSpec', () => {
  it('新規登録は「アイテムの登録」', () => {
    const spec = resolveMainChildWindowSpec({
      kind: 'register',
      droppedPaths: [],
      editingItem: null,
    });
    expect(spec.title).toBe('アイテムの登録');
    expect(spec.size.width).toBeGreaterThan(0);
    expect(spec.size.height).toBeGreaterThan(0);
  });

  it('編集対象があれば「アイテムの編集」', () => {
    const spec = resolveMainChildWindowSpec({
      kind: 'register',
      droppedPaths: [],
      editingItem: {
        displayName: 'メモ帳',
        path: 'C:\\Windows\\notepad.exe',
        type: 'app',
        sourceFile: 'data.json',
        jsonItemId: 'id-1',
      },
    });
    expect(spec.title).toBe('アイテムの編集');
  });

  it('アイコン取得結果は専用のタイトルとサイズ', () => {
    const spec = resolveMainChildWindowSpec({ kind: 'iconProgressDetail', results: [] });
    expect(spec.title).toBe('アイコン取得結果');
    expect(spec.size).toEqual({ width: 760, height: 700 });
  });
});
