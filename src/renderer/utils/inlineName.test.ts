import { describe, it, expect } from 'vitest';

import { resolveInlineName } from './inlineName';

describe('resolveInlineName', () => {
  it('前後の空白を除いた名前を返す', () => {
    expect(resolveInlineName('  新しい名前 ', '元の名前')).toBe('新しい名前');
  });

  it('空・空白だけなら null', () => {
    expect(resolveInlineName('', '元の名前')).toBeNull();
    expect(resolveInlineName('   ', '元の名前')).toBeNull();
  });

  it('前後の空白を除いて変わらないなら null', () => {
    expect(resolveInlineName('元の名前 ', '元の名前')).toBeNull();
  });
});
