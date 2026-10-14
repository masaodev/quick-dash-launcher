import type React from 'react';

/**
 * その場で名前を変える欄の確定値。前後の空白を除き、空か変わらないなら null（元の名前のまま）
 */
export function resolveInlineName(value: string, current: string): string | null {
  const name = value.trim();
  return name && name !== current ? name : null;
}

/** 名前を確定する Enter か（日本語入力の変換を確定する Enter は除く） */
export function isCommitEnter(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing;
}
