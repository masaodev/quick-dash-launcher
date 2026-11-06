import React from 'react';
import type { SearchMode } from '@common/types';

import { normalizeForSearch, parseKeywords } from './dataParser';

/** 表示する文字列の中で、検索語に当たった範囲（[開始, 終わり) の UTF-16 の位置） */
export type MatchRange = [number, number];

/**
 * 表示する文字列のうち、検索語に当たった範囲を返す（重なる・隣り合う範囲はまとめる）
 *
 * 絞り込み（filterItems）と同じく、検索語と文字列の両方に normalizeForSearch をかけて比べる。
 * そろえた後の位置を元の文字列の位置に戻せるよう、1 文字ずつそろえる（半角カナの濁点のように
 * 2 文字が 1 文字になる組み合わせは、1 文字ずつだとそろわないので、その部分は当たらない）
 */
export function findMatchRanges(
  text: string,
  query: string,
  mode: SearchMode = 'normal'
): MatchRange[] {
  const normalizedQuery = mode === 'window' && query.startsWith('<') ? query.substring(1) : query;
  const keywords = parseKeywords(normalizedQuery);
  if (keywords.length === 0 || !text) return [];

  // そろえた文字列と、その各文字が元の文字列のどこから来たか
  let normalized = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < text.length;) {
    const codePoint = text.codePointAt(i) ?? 0;
    const length = codePoint > 0xffff ? 2 : 1;
    const piece = normalizeForSearch(text.slice(i, i + length));
    for (let k = 0; k < piece.length; k++) {
      starts.push(i);
      ends.push(i + length);
    }
    normalized += piece;
    i += length;
  }

  const ranges: MatchRange[] = [];
  for (const keyword of keywords) {
    let from = 0;
    for (;;) {
      const at = normalized.indexOf(keyword, from);
      if (at === -1) break;
      ranges.push([starts[at], ends[at + keyword.length - 1]]);
      from = at + 1;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: MatchRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

/** 当たった範囲を <mark> で囲んだ表示（当たらなければ文字列のまま） */
export function renderWithMatches(
  text: string,
  query: string,
  mode: SearchMode = 'normal'
): React.ReactNode {
  const ranges = findMatchRanges(text, query, mode);
  if (ranges.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start > pos) parts.push(text.slice(pos, start));
    parts.push(
      React.createElement('mark', { key: start, className: 'search-match' }, text.slice(start, end))
    );
    pos = end;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
}
