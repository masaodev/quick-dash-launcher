import type { AdminItemColumnsSetting } from '@common/types';

import type { FilterableColumnId } from './adminItemFilters';
import type { SortColumn } from './editableItemOperations';

/**
 * アイテム管理の一覧の列（選択と操作の列は常に出すので含めない）
 *
 * 並び順はこの配列の順。見出し・行・列のメニューはここを見て描く。見出しの文言は itemManager.table.<id>
 */
export type AdminItemColumnId =
  | 'type'
  | 'icon'
  | 'name'
  | 'pathAndArgs'
  | 'memo'
  | 'source'
  | 'link'
  | 'lastLaunched'
  | 'launchCount'
  | 'updatedAt';

export interface AdminItemColumnDef {
  id: AdminItemColumnId;
  /** th・td に付けるクラス（既定の幅は CSS が持つ） */
  className: string;
  /** 見出しのクリックで並べ替える項目。並べ替えない列は undefined */
  sortColumn?: SortColumn;
  /** 見出しの ▾ で絞り込む列か（列の id が絞り込みの項目になる） */
  filterable?: boolean;
  /** 列のメニューで隠せるか */
  hideable: boolean;
  /** 設定が無いときに出すか */
  defaultVisible: boolean;
  /** ドラッグで幅を変えられるときの最小幅（px）。変えられない列は undefined */
  minWidth?: number;
  /** 既定の幅（px）。残りの幅を使う列（パスと引数）は undefined */
  defaultWidth?: number;
}

export const ADMIN_ITEM_COLUMNS: readonly AdminItemColumnDef[] = [
  {
    id: 'type',
    className: 'type-column',
    defaultWidth: 140,
    sortColumn: 'type',
    filterable: true,
    hideable: true,
    defaultVisible: true,
    minWidth: 80,
  },
  {
    id: 'icon',
    className: 'icon-column',
    defaultWidth: 32,
    hideable: true,
    defaultVisible: true,
  },
  {
    id: 'name',
    className: 'name-column',
    defaultWidth: 180,
    sortColumn: 'displayName',
    filterable: true,
    hideable: false,
    defaultVisible: true,
    minWidth: 100,
  },
  // 残りの幅を使う列なので、幅は変えない（ほかの列を広げると狭くなる）
  {
    id: 'pathAndArgs',
    className: 'content-column',
    sortColumn: 'pathAndArgs',
    filterable: true,
    hideable: false,
    defaultVisible: true,
  },
  {
    id: 'memo',
    className: 'memo-column',
    defaultWidth: 150,
    sortColumn: 'memo',
    filterable: true,
    hideable: true,
    defaultVisible: true,
    minWidth: 80,
  },
  // 手動登録か、どの自動取込ルールで入ったか
  {
    id: 'source',
    className: 'source-column',
    defaultWidth: 100,
    sortColumn: 'source',
    filterable: true,
    hideable: true,
    defaultVisible: true,
    minWidth: 70,
  },
  // 「リンク切れを確認」の結果。確認するまでは空なので既定では隠し、確認したときに出す
  {
    id: 'link',
    className: 'link-column',
    defaultWidth: 110,
    filterable: true,
    hideable: true,
    defaultVisible: false,
    minWidth: 60,
  },
  // 起動の記録（item-usage.json）。回数は既定では隠す
  {
    id: 'lastLaunched',
    className: 'last-launched-column',
    defaultWidth: 120,
    sortColumn: 'lastLaunched',
    filterable: true,
    hideable: true,
    defaultVisible: true,
    minWidth: 80,
  },
  {
    id: 'launchCount',
    className: 'launch-count-column',
    defaultWidth: 80,
    sortColumn: 'launchCount',
    hideable: true,
    defaultVisible: false,
    minWidth: 50,
  },
  {
    id: 'updatedAt',
    className: 'updated-at-column',
    defaultWidth: 120,
    sortColumn: 'updatedAt',
    filterable: true,
    hideable: true,
    defaultVisible: true,
    minWidth: 80,
  },
];

/** 選択と操作の列（常に出す）の数 */
export const FIXED_COLUMN_COUNT = 2;

export const EMPTY_COLUMNS_SETTING: AdminItemColumnsSetting = { visible: {}, widths: {} };

/** 設定ファイルの値を、使える形にそろえる（手で書いた値・古い版の値に備える） */
export function normalizeColumnsSetting(value: unknown): AdminItemColumnsSetting {
  if (!value || typeof value !== 'object') return EMPTY_COLUMNS_SETTING;
  const raw = value as { visible?: unknown; widths?: unknown };
  const visible: Record<string, boolean> = {};
  const widths: Record<string, number> = {};
  if (raw.visible && typeof raw.visible === 'object') {
    for (const [id, v] of Object.entries(raw.visible)) {
      if (typeof v === 'boolean') visible[id] = v;
    }
  }
  if (raw.widths && typeof raw.widths === 'object') {
    for (const [id, w] of Object.entries(raw.widths)) {
      if (typeof w === 'number' && Number.isFinite(w) && w > 0) widths[id] = Math.round(w);
    }
  }
  return { visible, widths };
}

/** 見出しの ▾ を出す列の id を、絞り込みの項目として返す */
export function filterColumnOf(column: AdminItemColumnDef): FilterableColumnId | null {
  return column.filterable ? (column.id as FilterableColumnId) : null;
}

export function isColumnVisible(
  column: AdminItemColumnDef,
  setting: AdminItemColumnsSetting
): boolean {
  if (!column.hideable) return true;
  return setting.visible[column.id] ?? column.defaultVisible;
}

/** 列の幅（px）。ドラッグで変えた幅、無ければ既定の幅。残りの幅を使う列は null */
export function columnWidthOf(
  column: AdminItemColumnDef,
  setting: AdminItemColumnsSetting
): number | null {
  if (column.defaultWidth === undefined) return null;
  const width = column.minWidth === undefined ? undefined : setting.widths[column.id];
  return width === undefined ? column.defaultWidth : Math.max(column.minWidth ?? 0, width);
}

/**
 * 選択・操作の列の幅（px）。表に CSS 変数 --checkbox-column-width・--actions-column-width として渡し、
 * CSS はその値で描く（表の最小幅の計算と CSS の幅がずれないよう、ここを正にする）
 */
export const CHECKBOX_COLUMN_WIDTH = 40;
export const ACTIONS_COLUMN_WIDTH = 64;
const FIXED_COLUMNS_WIDTH = CHECKBOX_COLUMN_WIDTH + ACTIONS_COLUMN_WIDTH;
/** パスと引数の列に残す最低の幅（px）。足りなければ一覧を横にスクロールする */
export const PATH_COLUMN_MIN_WIDTH = 180;

/** 一覧の表の最小幅（列が多くてもパスと引数の列が潰れないように） */
export function tableMinWidthOf(widths: Array<number | null>): number {
  return (
    FIXED_COLUMNS_WIDTH +
    PATH_COLUMN_MIN_WIDTH +
    widths.reduce<number>((sum, w) => sum + (w ?? 0), 0)
  );
}
