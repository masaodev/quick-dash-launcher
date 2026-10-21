import i18next from 'i18next';

import type { ColumnFilters, FilterableColumnId, TextFilter } from './adminItemFilters';

function describeText(filter: TextFilter): string {
  if (filter.mode === 'empty') return i18next.t('itemManager.columnFilter.empty');
  if (filter.mode === 'nonEmpty') return i18next.t('itemManager.columnFilter.nonEmpty');
  return i18next.t('itemManager.columnFilter.containsValue', { text: filter.text.trim() });
}

/**
 * ツールバーの下のチップに出す、1 つの列の絞り込みの文言（例:「種類: 単一アイテム（URL）」）
 *
 * @param ruleNames ルール id → ルール名（取込元の絞り込みにルールを選んだとき）
 */
export function describeColumnFilter(
  column: FilterableColumnId,
  filters: ColumnFilters,
  ruleNames: Map<string, string>
): string {
  const columnLabel = i18next.t(`itemManager.table.${column}`);
  const value = (() => {
    switch (column) {
      case 'type':
        return (filters.type ?? [])
          .map((key) => i18next.t(`itemManager.columnFilter.types.${key}`))
          .join(i18next.t('common.listSeparator'));
      case 'name':
      case 'pathAndArgs':
      case 'memo': {
        const filter = filters[column];
        return filter ? describeText(filter) : '';
      }
      case 'source': {
        const source = filters.source;
        if (source === 'manual-only') return i18next.t('autoImportFilter.manualOnly');
        if (source === 'auto-import-only') return i18next.t('autoImportFilter.autoImportOnly');
        return (source && ruleNames.get(source)) ?? i18next.t('autoImportFilter.unknownRule');
      }
      case 'link':
        return filters.link ? i18next.t(`itemManager.columnFilter.link.${filters.link}`) : '';
      case 'lastLaunched':
        return filters.lastLaunched
          ? i18next.t(`itemManager.columnFilter.lastLaunched.${filters.lastLaunched}`)
          : '';
      case 'updatedAt':
        return filters.updatedAt
          ? i18next.t(`itemManager.columnFilter.updatedAt.${filters.updatedAt}`)
          : '';
    }
  })();
  return i18next.t('itemManager.columnFilter.chip', { column: columnLabel, value });
}
