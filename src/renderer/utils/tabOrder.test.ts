import { describe, it, expect } from 'vitest';

import { sortByTabOrder } from './tabOrder';

const tabs = [
  { name: 'メイン', files: ['datafiles/data.json', 'datafiles/data4.json'] },
  { name: 'ブックマーク', files: ['datafiles/data2.json'] },
];

describe('sortByTabOrder', () => {
  it('設定のタブの順に並べ、同じタブの中は今の並びのまま、タブの無いファイルは最後にする', () => {
    const items = [
      { name: 'a', file: 'datafiles/data2.json' },
      { name: 'b', file: 'datafiles/other.json' },
      { name: 'c', file: 'datafiles/data4.json' },
      { name: 'd', file: undefined },
      { name: 'e', file: 'datafiles/data.json' },
      { name: 'f', file: 'datafiles/data2.json' },
    ];
    expect(sortByTabOrder(items, tabs, (i) => i.file).map((i) => i.name)).toEqual([
      'c',
      'e',
      'a',
      'f',
      'b',
      'd',
    ]);
  });
});
