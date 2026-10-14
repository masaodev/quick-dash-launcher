import { describe, it, expect } from 'vitest';

import type { EditableJsonItem, JsonSetItem } from '../types';

import {
  convertEditableJsonItemToRegisterItem,
  convertRegisterItemToJsonItem,
} from './dataConverters';

describe('dataConverters のセット', () => {
  const layout: JsonSetItem = {
    id: 'Lay0ut01',
    type: 'set',
    displayName: '作業レイアウト',
    entries: [{ window: { title: 'メモ帳' }, placement: { x: 0, y: 0, width: 800, height: 600 } }],
    launchMode: 'parallel',
    customIcon: 'layout-icon.png',
    memo: 'メモ',
  };
  const editable: EditableJsonItem = {
    item: layout,
    displayText: '',
    meta: { sourceFile: 'datafiles/data.json', lineNumber: 0, isValid: true },
  };
  const tabs = [{ name: 'メイン', files: ['datafiles/data.json'] }];

  it('編集用に変換してもカスタムアイコンを保つ', () => {
    const registerItem = convertEditableJsonItemToRegisterItem(editable, tabs);

    expect(registerItem.customIcon).toBe('layout-icon.png');
  });

  it('編集用に変換して戻しても、カスタムアイコンが消えない', () => {
    const registerItem = convertEditableJsonItemToRegisterItem(editable, tabs);
    const saved = convertRegisterItemToJsonItem(registerItem, layout.id);

    expect(saved).toMatchObject({
      id: layout.id,
      type: 'set',
      displayName: layout.displayName,
      entries: layout.entries,
      launchMode: 'parallel',
      customIcon: 'layout-icon.png',
      memo: 'メモ',
    });
  });
});
