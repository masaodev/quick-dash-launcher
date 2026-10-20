import { isJsonLauncherItem } from '@common/types';
import type { EditableJsonItem, PathExistenceStatus } from '@common/types/editableItem';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { describePathAndArgs } from './editableItemOperations';

/** 種類の絞り込みの選択肢（単一アイテムは URL とそれ以外に分ける） */
export const TYPE_FILTER_KEYS = ['itemUrl', 'itemOther', 'dir', 'set', 'clipboard'] as const;
export type TypeFilterKey = (typeof TYPE_FILTER_KEYS)[number];

/** 文字の列（名前・パスと引数・メモ）の絞り込み */
export type TextFilter =
  { mode: 'contains'; text: string } | { mode: 'empty' } | { mode: 'nonEmpty' };

/** 取込元: 手動登録のみ・自動取込のみ・ルールの id */
export type SourceFilter = 'manual-only' | 'auto-import-only' | (string & {});

/** リンク（「リンク切れを確認」の結果） */
export type LinkFilter = 'missing' | 'exists' | 'unknown';

/** 最終起動（「90 日以上起動していない」は記録の無い行も含める） */
export const LAST_LAUNCHED_FILTERS = ['within7', 'within30', 'notWithin90', 'never'] as const;
export type LastLaunchedFilter = (typeof LAST_LAUNCHED_FILTERS)[number];

/** 更新日 */
export const UPDATED_AT_FILTERS = ['within7', 'within30', 'olderThan365', 'none'] as const;
export type UpdatedAtFilter = (typeof UPDATED_AT_FILTERS)[number];

/**
 * 見出しの ▾ で付ける絞り込み（列ごと。無い列は絞り込まない）。条件どうしは AND
 */
export interface ColumnFilters {
  type?: TypeFilterKey[];
  name?: TextFilter;
  pathAndArgs?: TextFilter;
  memo?: TextFilter;
  source?: SourceFilter;
  link?: LinkFilter;
  lastLaunched?: LastLaunchedFilter;
  updatedAt?: UpdatedAtFilter;
}

export type FilterableColumnId = keyof ColumnFilters;

const DAY_MS = 24 * 60 * 60 * 1000;

export function typeFilterKeyOf(item: EditableJsonItem): TypeFilterKey {
  const jsonItem = item.item;
  if (jsonItem.type !== 'item') return jsonItem.type;
  const launcherType = item.meta.launcherType ?? detectItemTypeSync(jsonItem.path || '');
  return launcherType === 'url' || launcherType === 'customUri' ? 'itemUrl' : 'itemOther';
}

function nameOf(item: EditableJsonItem): string {
  return 'displayName' in item.item ? item.item.displayName || '' : '';
}

function matchesText(value: string, filter: TextFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.mode === 'empty') return value.trim().length === 0;
  if (filter.mode === 'nonEmpty') return value.trim().length > 0;
  const text = filter.text.trim().toLowerCase();
  return text.length === 0 || value.toLowerCase().includes(text);
}

export function matchesSource(item: EditableJsonItem, filter: SourceFilter | undefined): boolean {
  if (!filter) return true;
  const ruleId = isJsonLauncherItem(item.item) ? item.item.autoImportRuleId : undefined;
  if (filter === 'auto-import-only') return !!ruleId;
  if (filter === 'manual-only') return !ruleId;
  return ruleId === filter;
}

function matchesUpdatedAt(updatedAt: number | undefined, filter: UpdatedAtFilter, now: number) {
  if (filter === 'none') return !updatedAt;
  if (!updatedAt) return false;
  const age = now - updatedAt;
  if (filter === 'within7') return age <= 7 * DAY_MS;
  if (filter === 'within30') return age <= 30 * DAY_MS;
  return age >= 365 * DAY_MS;
}

function matchesLastLaunched(
  lastLaunchedAt: number | undefined,
  filter: LastLaunchedFilter,
  now: number
) {
  if (filter === 'never') return lastLaunchedAt === undefined;
  if (filter === 'notWithin90')
    return lastLaunchedAt === undefined || now - lastLaunchedAt >= 90 * DAY_MS;
  if (lastLaunchedAt === undefined) return false;
  return now - lastLaunchedAt <= (filter === 'within7' ? 7 : 30) * DAY_MS;
}

export interface FilterContext {
  /** リンクの確認結果（確認していない・対象外のパスは undefined） */
  linkStatusOf: (item: EditableJsonItem) => PathExistenceStatus | undefined;
  /** 起動の記録（記録が無ければ undefined） */
  lastLaunchedAtOf: (item: EditableJsonItem) => number | undefined;
  now: number;
}

export function matchesColumnFilters(
  item: EditableJsonItem,
  filters: ColumnFilters,
  context: FilterContext
): boolean {
  if (filters.type && filters.type.length > 0 && !filters.type.includes(typeFilterKeyOf(item))) {
    return false;
  }
  if (!matchesText(nameOf(item), filters.name)) return false;
  if (!matchesText(describePathAndArgs(item.item), filters.pathAndArgs)) return false;
  if (!matchesText(item.item.memo ?? '', filters.memo)) return false;
  if (!matchesSource(item, filters.source)) return false;
  if (filters.link && context.linkStatusOf(item) !== filters.link) return false;
  if (
    filters.lastLaunched &&
    !matchesLastLaunched(context.lastLaunchedAtOf(item), filters.lastLaunched, context.now)
  ) {
    return false;
  }
  if (filters.updatedAt && !matchesUpdatedAt(item.item.updatedAt, filters.updatedAt, context.now)) {
    return false;
  }
  return true;
}

/** 条件として意味のある値か（空の文字・空の種類は条件にしない） */
export function isActiveFilter<K extends FilterableColumnId>(
  column: K,
  value: ColumnFilters[K]
): boolean {
  if (value === undefined) return false;
  if (column === 'type') return (value as TypeFilterKey[]).length > 0;
  if (column === 'name' || column === 'pathAndArgs' || column === 'memo') {
    const text = value as TextFilter;
    return text.mode !== 'contains' || text.text.trim().length > 0;
  }
  return true;
}

/** かかっている条件の列（チップの並び順＝列の並び順） */
export function activeFilterColumns(filters: ColumnFilters): FilterableColumnId[] {
  const order: FilterableColumnId[] = [
    'type',
    'name',
    'pathAndArgs',
    'memo',
    'source',
    'link',
    'lastLaunched',
    'updatedAt',
  ];
  return order.filter((column) => isActiveFilter(column, filters[column]));
}
