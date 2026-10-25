import { describe, it, expect } from 'vitest';
import { createI18n } from '@common/i18n';

import { setUsageWarning } from './setUsageWarning';

describe('setUsageWarning（A3-79 #6）', () => {
  const t = createI18n('ja').t;

  it('使っているセットが無ければ null', () => {
    expect(setUsageWarning([], t)).toBeNull();
  });

  it('2 件までは名前を並べ、それより多ければ「ほか N 件」にまとめる', () => {
    expect(setUsageWarning(['仕事'], t)).toBe(
      'セット「仕事」で使っています。削除すると、セットのその行は開けなくなります（行は残ります）。'
    );
    expect(setUsageWarning(['朝の準備', '仕事', '夜'], t)).toContain(
      'セット「朝の準備」、「仕事」ほか 1 件で使っています。'
    );
  });
});
