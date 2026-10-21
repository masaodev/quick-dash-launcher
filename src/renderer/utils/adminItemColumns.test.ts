import { describe, expect, it } from 'vitest';

import {
  ADMIN_ITEM_COLUMNS,
  columnWidthOf,
  isColumnVisible,
  normalizeColumnsSetting,
} from './adminItemColumns';

const column = (id: string) => ADMIN_ITEM_COLUMNS.find((c) => c.id === id)!;

describe('normalizeColumnsSetting', () => {
  it('設定が無い・形が違うときは空にする', () => {
    expect(normalizeColumnsSetting(undefined)).toEqual({ visible: {}, widths: {} });
    expect(normalizeColumnsSetting('x')).toEqual({ visible: {}, widths: {} });
  });

  it('真偽値でない表示・正の数でない幅は捨て、幅は整数にする', () => {
    expect(
      normalizeColumnsSetting({
        visible: { type: false, icon: 'no' },
        widths: { name: 180.6, type: -1, updatedAt: Number.NaN },
      })
    ).toEqual({ visible: { type: false }, widths: { name: 181 } });
  });
});

describe('isColumnVisible', () => {
  it('設定が無ければ既定に従い、あれば設定に従う', () => {
    expect(isColumnVisible(column('type'), { visible: {}, widths: {} })).toBe(true);
    expect(isColumnVisible(column('type'), { visible: { type: false }, widths: {} })).toBe(false);
  });

  it('隠せない列は設定で隠しても出す', () => {
    expect(isColumnVisible(column('name'), { visible: { name: false }, widths: {} })).toBe(true);
  });
});

describe('columnWidthOf', () => {
  it('変えていなければ null、最小幅より狭い値は最小幅にする', () => {
    expect(columnWidthOf(column('name'), { visible: {}, widths: {} })).toBeNull();
    expect(columnWidthOf(column('name'), { visible: {}, widths: { name: 40 } })).toBe(100);
    expect(columnWidthOf(column('name'), { visible: {}, widths: { name: 240 } })).toBe(240);
  });

  it('幅を変えられない列は保存された幅を使わない', () => {
    expect(
      columnWidthOf(column('pathAndArgs'), { visible: {}, widths: { pathAndArgs: 300 } })
    ).toBeNull();
  });
});
