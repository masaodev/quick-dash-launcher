import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

import { en } from './locales/en';
import { ja } from './locales/ja';
import { flattenMessages } from './messages';

/**
 * 用語集（docs/architecture/glossary.md）の「使わない表記」が辞書に出てこないことを確かめる
 *
 * 用語集の表は「| 日本語 | English | 使わない表記 | 意味 | コード上の名前 |」。
 * 「使わない表記」は「、」区切り。「（親の意味で）」のように文脈の注記が付いたものは機械で判定できないので飛ばす。
 * 日本語の表記は ja.ts に、英語（ASCII）の表記は en.ts に、それぞれ出てきたら失敗する。
 */

const GLOSSARY_PATH = path.resolve(__dirname, '../../../docs/architecture/glossary.md');

interface GlossaryRow {
  term: string;
  english: string;
  avoid: string[];
}

function parseGlossary(markdown: string): GlossaryRow[] {
  const rows: GlossaryRow[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 5 || cells[0] === '日本語' || cells[0].startsWith('---')) continue;
    const avoid = cells[2] === '—' ? [] : cells[2].split('、').map((v) => v.trim());
    rows.push({ term: cells[0], english: cells[1], avoid });
  }
  return rows;
}

/** 文脈の注記が付いた表記（機械で判定しない） */
function hasContextNote(variant: string): boolean {
  return /（.+）/.test(variant);
}

function isAscii(text: string): boolean {
  return /^[\x20-\x7e]+$/.test(text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const glossary = parseGlossary(fs.readFileSync(GLOSSARY_PATH, 'utf8'));
const jaMessages = flattenMessages(ja);
const enMessages = flattenMessages(en);

describe('用語集（glossary.md）', () => {
  it('用語の表を読めること', () => {
    expect(glossary.length).toBeGreaterThanOrEqual(30);
    for (const row of glossary) {
      expect(row.term, '日本語が空').not.toBe('');
      expect(row.english, `${row.term} の English が空`).not.toBe('');
    }
  });

  it('日本語の用語が重複していないこと', () => {
    const terms = glossary.map((row) => row.term);
    expect(terms.filter((term, i) => terms.indexOf(term) !== i)).toEqual([]);
  });

  it('使わない表記が辞書に出てこないこと', () => {
    const found: string[] = [];
    for (const row of glossary) {
      for (const variant of row.avoid) {
        if (!variant || hasContextNote(variant)) continue;
        if (isAscii(variant)) {
          const pattern = new RegExp(`\\b${escapeRegExp(variant)}\\b`, 'i');
          for (const [key, text] of Object.entries(enMessages)) {
            if (pattern.test(text)) found.push(`en.${key}: 「${variant}」→「${row.english}」`);
          }
        } else {
          for (const [key, text] of Object.entries(jaMessages)) {
            if (text.includes(variant)) found.push(`ja.${key}: 「${variant}」→「${row.term}」`);
          }
        }
      }
    }
    expect(found).toEqual([]);
  });
});
