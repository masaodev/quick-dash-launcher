import { describe, expect, it } from 'vitest';

import {
  ADMIN_ITEM_COLUMNS,
  PATH_COLUMN_MIN_WIDTH,
  tableMinWidthOf,
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
  it('変えていなければ既定の幅、最小幅より狭い値は最小幅にする', () => {
    expect(columnWidthOf(column('name'), { visible: {}, widths: {} })).toBe(180);
    expect(columnWidthOf(column('name'), { visible: {}, widths: { name: 40 } })).toBe(100);
    expect(columnWidthOf(column('name'), { visible: {}, widths: { name: 240 } })).toBe(240);
  });

  it('幅を変えられない列は保存された幅を使わない', () => {
    expect(columnWidthOf(column('icon'), { visible: {}, widths: { icon: 300 } })).toBe(32);
  });

  it('パスと引数の列は、幅を決めていなければ残りの幅（null）、決めていればその幅（A3-184）', () => {
    expect(columnWidthOf(column('pathAndArgs'), { visible: {}, widths: {} })).toBeNull();
    expect(
      columnWidthOf(column('pathAndArgs'), { visible: {}, widths: { pathAndArgs: 300 } })
    ).toBe(300);
    expect(columnWidthOf(column('pathAndArgs'), { visible: {}, widths: { pathAndArgs: 50 } })).toBe(
      PATH_COLUMN_MIN_WIDTH
    );
  });

  it('表の最小幅は、選択・操作の列とパスの最低幅に、ほかの列の幅を足したもの', () => {
    expect(tableMinWidthOf([100, null, 50])).toBe(40 + 64 + PATH_COLUMN_MIN_WIDTH + 150);
  });

  it('パスと引数の列の幅も決まっていれば、最低幅は足さずに全部の幅を足す', () => {
    expect(tableMinWidthOf([100, 400, 50])).toBe(40 + 64 + 550);
  });
});
