import type { JsonItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { generateUniqueId } from '@common/utils/jsonParser';

import { withEditedMemo } from './adminItemDisplay';
import { parseCsvDetailed, stringifyCsv } from './csv';
import { refreshEditableItem, reorderItemNumbers, toEditableItem } from './editableItemOperations';

/**
 * アイテムの CSV の列（見出しは表示言語によらずこの名前。取り込みは見出しの名前で列を探す）
 *
 * - dataFile: データファイル（設定フォルダからの相対パス。例 datafiles/data.json）
 * - type: item・dir・set・clipboard
 * - updatedAt: 書き出しのときだけ出す（取り込みでは読まない）
 */
export const ITEM_CSV_COLUMNS = [
  'id',
  'dataFile',
  'type',
  'displayName',
  'path',
  'args',
  'memo',
  'updatedAt',
] as const;
type CsvColumn = (typeof ITEM_CSV_COLUMNS)[number];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 更新日を Excel でも読める「2026-10-21 03:15」の形にする（手元の時刻） */
function formatCsvDate(time?: number): string {
  if (!time) return '';
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Excel が数式として読む書き出し（= + - @ で始まる値）。' を前に付けて文字のまま読ませる
 *
 * もとから ' の後に = + - @ が続く値（'-- メモ など）にも付ける。付けないと、取り込みで外す ' と区別できない
 */
const FORMULA_START = /^'*[=+\-@]/;

function protectFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** protectFormula で付けた ' を 1 つ外す */
function unprotectFormula(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

function rowOf(item: EditableJsonItem): Record<CsvColumn, string> {
  const json = item.item;
  return {
    id: json.id,
    dataFile: item.meta.sourceFile,
    type: json.type,
    displayName: 'displayName' in json ? json.displayName || '' : '',
    path: json.type === 'item' || json.type === 'dir' ? json.path || '' : '',
    args: json.type === 'item' ? json.args || '' : '',
    memo: json.memo ?? '',
    updatedAt: formatCsvDate(json.updatedAt),
  };
}

/**
 * アイテムを CSV にする（files の順に、各ファイルの中は渡した順）
 *
 * @param files 書き出すデータファイル（タブの順）
 */
export function itemsToCsv(items: EditableJsonItem[], files: readonly string[]): string {
  const rows: string[][] = [[...ITEM_CSV_COLUMNS]];
  for (const file of files) {
    for (const item of items) {
      if (item.meta.sourceFile !== file) continue;
      const row = rowOf(item);
      rows.push(ITEM_CSV_COLUMNS.map((column) => protectFormula(row[column])));
    }
  }
  return stringifyCsv(rows);
}

export type CsvImportErrorCode =
  | 'noIdColumn'
  | 'unclosedQuote'
  | 'controlChars'
  | 'notFound'
  | 'duplicateId'
  | 'nameRequired'
  | 'pathRequired'
  | 'typeNotAddable'
  | 'unknownDataFile';

export interface CsvImportError {
  /** CSV の行番号（見出しが 1 行目） */
  line: number;
  code: CsvImportErrorCode;
  /** 問題の値（id・種類・データファイルなど） */
  value?: string;
}

/** 取り込みでは変えない列（書き換えても捨てる） */
export type CsvIgnoredColumn = 'type' | 'dataFile' | 'displayName' | 'path' | 'args';

/** 取り込みでは変えない値が書かれていた行（ほかの列は取り込む） */
export interface CsvIgnoredValues {
  /** CSV の行番号（見出しが 1 行目） */
  line: number;
  /** 行の名前（名前が無ければパス） */
  name: string;
  columns: CsvIgnoredColumn[];
}

export interface CsvImportPlan {
  updates: Array<{ before: EditableJsonItem; after: JsonItem }>;
  additions: Array<{ dataFile: string; item: JsonItem }>;
  unchangedCount: number;
  errors: CsvImportError[];
  ignored: CsvIgnoredValues[];
}

/** id の無い行で足せる種類（ほかの種類は CSV の列だけでは作れない） */
const ADDABLE_TYPES = new Set(['', 'item', 'dir']);

/** 名前・パス・引数に入れない文字（改行・タブなどの制御文字。画面からは入れられない） */
// eslint-disable-next-line no-control-regex -- 制御文字そのものを探す
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function sameItem(a: JsonItem, b: JsonItem): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 確認の画面に出す行の名前（名前が無い種別はパス） */
function itemLabel(item: JsonItem): string {
  if ('displayName' in item && item.displayName) return item.displayName;
  return 'path' in item && item.path ? item.path : item.id;
}

/**
 * 取り込む CSV と今のアイテムを比べて、変える・足す行を決める（まだ何も変えない）
 *
 * - id が一致する行は名前・パス・引数・メモを CSV の値にする（CSV に無い列は変えない）。種類・データファイル・更新日は変えない
 * - id が空の行は新しいアイテムとして足す。データファイルが空なら defaultFile に入れる
 * - CSV に無いアイテムは消さない
 * - 見出しより列が少ない行は、足りない列を変えない（行末のカンマが消えた行で、引数・メモを消さないため）
 * - 引用符が閉じないまま終わった CSV は何も取り込まない（後ろの行が 1 つのセルに入ってしまうため）
 * - 名前・パス・引数を改行・タブなどの制御文字を含む値に変える行は取り込まない
 * - 変えない列（種別・データファイル、種別に無い名前・パス・引数）に書かれた値は捨て、ignored で知らせる
 *
 * @param knownFiles 足す先にできるデータファイル
 */
export function planCsvImport(
  text: string,
  workingItems: EditableJsonItem[],
  knownFiles: readonly string[],
  defaultFile: string
): CsvImportPlan {
  const plan: CsvImportPlan = {
    updates: [],
    additions: [],
    unchangedCount: 0,
    errors: [],
    ignored: [],
  };
  const { rows, unclosedQuoteRow } = parseCsvDetailed(text);
  if (unclosedQuoteRow !== undefined) {
    plan.errors.push({ line: unclosedQuoteRow, code: 'unclosedQuote' });
    return plan;
  }
  const header = (rows[0] ?? []).map((name) => name.trim());
  const indexOf = (column: CsvColumn) => header.indexOf(column);
  if (indexOf('id') === -1) {
    plan.errors.push({ line: 1, code: 'noIdColumn' });
    return plan;
  }

  const byId = new Map(workingItems.map((item) => [item.item.id, item]));
  const usedIds = new Set(byId.keys());
  const seen = new Set<string>();
  const files = new Set(knownFiles);

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    if (cells.every((cell) => cell.trim() === '')) return;
    /** その列が CSV にあれば値、無ければ undefined（変えない）。行がその列まで届いていなければ変えない */
    const get = (column: CsvColumn): string | undefined => {
      const i = indexOf(column);
      return i === -1 || i >= cells.length ? undefined : unprotectFormula(cells[i]);
    };
    const id = (get('id') ?? '').trim();
    const type = get('type')?.trim();
    const dataFileCell = get('dataFile')?.trim();
    const name = get('displayName')?.trim();
    const itemPath = get('path')?.trim();
    const args = get('args')?.trim();
    const memo = get('memo');
    /** 制御文字を含む値に変えようとしているか（今の値と同じなら問わない） */
    const hasControlChars = (value: string | undefined, current?: string) =>
      value !== undefined && value !== current && CONTROL_CHARS.test(value);

    if (id) {
      if (seen.has(id)) {
        plan.errors.push({ line, code: 'duplicateId', value: id });
        return;
      }
      seen.add(id);
      const before = byId.get(id);
      if (!before) {
        plan.errors.push({ line, code: 'notFound', value: id });
        return;
      }
      const current = before.item;
      const hasName = 'displayName' in current;
      const hasPath = current.type === 'item' || current.type === 'dir';
      const hasArgs = current.type === 'item';
      if (
        ('displayName' in current && hasControlChars(name, current.displayName)) ||
        ((current.type === 'item' || current.type === 'dir') &&
          hasControlChars(itemPath, current.path)) ||
        (current.type === 'item' && hasControlChars(args, current.args ?? ''))
      ) {
        plan.errors.push({ line, code: 'controlChars' });
        return;
      }
      const ignoredColumns: CsvIgnoredColumn[] = [];
      if (type && type !== current.type) ignoredColumns.push('type');
      if (dataFileCell && dataFileCell !== before.meta.sourceFile) ignoredColumns.push('dataFile');
      if (name && !hasName) ignoredColumns.push('displayName');
      if (itemPath && !hasPath) ignoredColumns.push('path');
      if (args && !hasArgs) ignoredColumns.push('args');

      let after: JsonItem = current;
      if (name !== undefined && 'displayName' in after) {
        if (!name) {
          plan.errors.push({ line, code: 'nameRequired' });
          return;
        }
        after = { ...after, displayName: name };
      }
      if (itemPath !== undefined && (after.type === 'item' || after.type === 'dir')) {
        // パスの無い単一アイテム（切り替えるだけ）はパスが空のままでよい
        if (
          !itemPath &&
          (after.type === 'dir' || before.item.type !== 'item' || before.item.path)
        ) {
          plan.errors.push({ line, code: 'pathRequired' });
          return;
        }
        after = { ...after, path: itemPath };
      }
      if (args !== undefined && after.type === 'item') {
        if (args) after = { ...after, args };
        else {
          const { args: _removed, ...rest } = after;
          after = rest;
        }
      }
      if (memo !== undefined) after = withEditedMemo(after, memo);
      if (ignoredColumns.length > 0) {
        plan.ignored.push({ line, name: itemLabel(current), columns: ignoredColumns });
      }
      if (sameItem(after, before.item)) plan.unchangedCount++;
      else plan.updates.push({ before, after });
      return;
    }

    const newType = type ?? '';
    if (!ADDABLE_TYPES.has(newType)) {
      plan.errors.push({ line, code: 'typeNotAddable', value: newType });
      return;
    }
    const dataFile = dataFileCell || defaultFile;
    if (!files.has(dataFile)) {
      plan.errors.push({ line, code: 'unknownDataFile', value: dataFile });
      return;
    }
    if (!itemPath) {
      plan.errors.push({ line, code: 'pathRequired' });
      return;
    }
    if (
      hasControlChars(itemPath) ||
      (newType !== 'dir' && (hasControlChars(name) || hasControlChars(args)))
    ) {
      plan.errors.push({ line, code: 'controlChars' });
      return;
    }
    if (newType === 'dir') {
      const ignoredColumns: CsvIgnoredColumn[] = [];
      if (name) ignoredColumns.push('displayName');
      if (args) ignoredColumns.push('args');
      if (ignoredColumns.length > 0) {
        plan.ignored.push({ line, name: itemPath, columns: ignoredColumns });
      }
    }
    const newId = generateUniqueId(usedIds);
    usedIds.add(newId);
    const base = { id: newId, updatedAt: Date.now() };
    let item: JsonItem;
    if (newType === 'dir') {
      item = { ...base, type: 'dir', path: itemPath };
    } else {
      if (!name) {
        plan.errors.push({ line, code: 'nameRequired' });
        return;
      }
      item = {
        ...base,
        type: 'item',
        displayName: name,
        path: itemPath,
        ...(args ? { args } : {}),
      };
    }
    if (memo !== undefined) item = withEditedMemo(item, memo);
    plan.additions.push({ dataFile, item });
  });

  return plan;
}

/** 取り込みの計画を作業中の一覧に当てる（変えた行は差し替え、足す行はそのファイルの先頭に置く） */
export function applyCsvImportPlan(
  workingItems: EditableJsonItem[],
  plan: CsvImportPlan
): EditableJsonItem[] {
  const updated = new Map(plan.updates.map(({ before, after }) => [before.item.id, after]));
  const replaced = workingItems.map((item) => {
    const after = updated.get(item.item.id);
    return after ? refreshEditableItem(item, after) : item;
  });
  const added = plan.additions.map(({ dataFile, item }) => toEditableItem(item, dataFile));
  return reorderItemNumbers([...added, ...replaced]);
}
