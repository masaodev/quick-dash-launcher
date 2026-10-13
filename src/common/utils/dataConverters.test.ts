import { describe, it, expect } from 'vitest';

import type { EditableJsonItem, JsonLayoutItem } from '../types';

import {
  convertEditableJsonItemToRegisterItem,
  convertRegisterItemToJsonItem,
} from './dataConverters';

describe('dataConverters のレイアウト', () => {
  const layout: JsonLayoutItem = {
    id: 'Lay0ut01',
    type: 'layout',
    displayName: '作業レイアウト',
    entries: [{ windowTitle: 'メモ帳', launchApp: false, x: 0, y: 0, width: 800, height: 600 }],
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
      type: 'layout',
      displayName: layout.displayName,
      entries: layout.entries,
      customIcon: 'layout-icon.png',
      memo: 'メモ',
    });
  });
});
