/**
 * ワークスペースアイテムの変換ユーティリティ
 *
 * - AppItem（メイン画面のアイテム）→ ワークスペースアイテムの本体（追加時）
 * - WorkspaceItem ⇄ RegisterItem（編集モーダル）
 * - 表示用の文字列（ツールチップ・テキストコピー・トースト）
 *
 * ファイル形式（json-workspace.ts）はデータファイルと同じ語彙なので、変換はフィールド名の
 * 詰め替えではなく「メタ情報の付け外し」が中心になる。
 */

import type { TFunction } from 'i18next';

import type {
  AppItem,
  ClipboardItem,
  LauncherItem,
  SetItem,
  ToastItemType,
  WorkspaceItem,
  WorkspaceItemUpdate,
} from '../types';
import { isClipboardItem, isSetItem, isWindowInfo } from '../types/guards';
import type { SetEntry } from '../types/launcher';
import type { RegisterItem, RegisterSetEntry } from '../types/register';

import { windowInfoToPathlessItem } from './windowInfoConverter';
import {
  describeWindowMatch,
  hasItemWindowSwitch,
  isPathlessItem,
  itemWindowSwitchFields,
  pickItemWindowSwitch,
} from './itemWindowConversion.js';

/** undefined の値を持つキーを落とす（ファイルに `"args": undefined` のような穴を残さないため） */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ============================================================
// AppItem → ワークスペースアイテム本体（追加時）
// ============================================================

function launcherBody(item: LauncherItem): WorkspaceItemUpdate {
  return compact({
    type: 'item',
    displayName: item.displayName,
    path: item.path,
    args: item.args,
    originalPath: item.originalPath,
    customIcon: item.customIcon,
    ...pickItemWindowSwitch(item),
    memo: item.memo,
  });
}

function clipboardBody(item: ClipboardItem): WorkspaceItemUpdate {
  return compact({
    type: 'clipboard',
    displayName: item.displayName,
    dataFileRef: item.clipboardDataRef,
    savedAt: item.savedAt,
    preview: item.preview,
    formats: [...item.formats],
    customIcon: item.customIcon,
    memo: item.memo,
  });
}

function setBody(item: SetItem): WorkspaceItemUpdate {
  return compact({
    type: 'set',
    displayName: item.displayName,
    entries: item.entries.map((entry) => ({ ...entry })),
    launchMode: item.launchMode,
    customIcon: item.customIcon,
    memo: item.memo,
  });
}

/**
 * メイン画面のアイテムをワークスペースアイテムの本体に変換する（id・並び順・所属は呼び出し側が付ける）
 *
 * WindowInfo（ウィンドウ検索結果）は exe 名とタイトルだけのパスの無い単一アイテムにする。
 * 位置も記録したいときは呼び出し側で windowInfoToPathlessItem(info, { includePosition: true }) を通す
 */
export function appItemToWorkspaceItemBody(item: AppItem): WorkspaceItemUpdate {
  if (isWindowInfo(item)) {
    return launcherBody(windowInfoToPathlessItem(item));
  }
  if (isClipboardItem(item)) return clipboardBody(item);
  if (isSetItem(item)) return setBody(item);
  return launcherBody(item);
}

// ============================================================
// WorkspaceItem ⇄ RegisterItem（編集モーダル）
// ============================================================

/**
 * WorkspaceItem を RegisterItem に変換（編集モーダル用）
 */
export function workspaceItemToRegisterItem(item: WorkspaceItem): RegisterItem {
  switch (item.type) {
    case 'clipboard':
      return {
        displayName: item.displayName,
        path: '',
        type: 'clipboard',
        targetTab: '',
        itemCategory: 'clipboard',
        clipboardDataRef: item.dataFileRef,
        clipboardFormats: item.formats,
        clipboardSavedAt: item.savedAt,
        clipboardPreview: item.preview,
        customIcon: item.customIcon,
        memo: item.memo,
      };
    case 'set':
      return {
        displayName: item.displayName,
        path: '',
        type: 'app',
        targetTab: '',
        itemCategory: 'set',
        setEntries: item.entries.map((entry) => ({ ...entry })),
        setLaunchMode: item.launchMode,
        customIcon: item.customIcon,
        memo: item.memo,
      };
    case 'item':
      return {
        displayName: item.displayName,
        path: item.path,
        type: item.launcherType,
        args: item.args,
        icon: item.icon,
        targetTab: '',
        customIcon: item.customIcon,
        ...pickItemWindowSwitch(item),
        itemCategory: 'item',
        memo: item.memo,
      };
    case 'ref':
      // 元が見つからない参照は中身を持たない（編集画面には渡さない。型をそろえるための空のアイテム）
      return {
        displayName: item.displayName,
        path: '',
        type: 'file',
        targetTab: '',
        itemCategory: 'item',
      };
  }
}

/**
 * ワークスペースのアイテムを指す行を、パスを書いた行に置き換える（行の対象ウィンドウなどはそのまま残す）
 *
 * アイテムのウィンドウ切り替えは、セットを開いたときに使われる分だけを行へ写す。
 * - 行に対象ウィンドウも位置も無い: アイテムのウィンドウ切り替えで動いていたので、丸ごと写す。
 *   前面に出すかの既定がアイテム（出す）と行（出さない）で違うので、出すときは true を書く
 * - 行に位置だけある: パスの無い単一アイテムなら、探すウィンドウにアイテムの対象ウィンドウを使っていたので写す
 */
function expandWorkspaceEntry(
  entry: SetEntry,
  item: Extract<WorkspaceItem, { type: 'item' }>
): RegisterSetEntry | undefined {
  const pathless = isPathlessItem(item);
  // 開くものも対象ウィンドウも無いアイテムは、置き換えても何もしない行になるので、そのまま残す
  if (!pathless && !item.path.trim()) return undefined;
  const { itemId: _itemId, ...rest } = entry;
  const result: RegisterSetEntry = { ...rest, expandedFrom: item.displayName };
  if (!pathless)
    result.open = item.args ? { path: item.path, args: item.args } : { path: item.path };
  result.label ??= item.displayName;
  if (!entry.window && hasItemWindowSwitch(item)) {
    if (!entry.placement) {
      const { activateWindow, ...itemSwitch } = pickItemWindowSwitch(item);
      Object.assign(result, itemSwitch);
      if (activateWindow !== false) result.activateWindow = true;
    } else if (pathless) {
      result.window = { ...item.window };
    }
  }
  return result;
}

/**
 * ワークスペースのセットの行を、メインウィンドウのセットの行にする（メインウィンドウへ登録するとき）
 *
 * メインウィンドウのセットは行の itemId をデータファイルのアイテムからしか探さないので、ワークスペースの
 * アイテムを指す行はそのままでは「アイテムが見つかりません」になる。そうした行は、指す先のパス・引数を
 * 行に書いた行に置き換え、expandedFrom に元のアイテムの名前を付ける。ワークスペースで開くときと同じく
 * ワークスペースのアイテムを先に探すので、データファイルのアイテムを指す行は id のまま残る
 */
export function expandWorkspaceSetEntries(
  entries: readonly SetEntry[],
  workspaceItems: readonly WorkspaceItem[]
): RegisterSetEntry[] {
  const byId = new Map<string, WorkspaceItem>();
  for (const item of workspaceItems) byId.set(item.id, item);
  return entries.map((entry) => {
    const item = entry.itemId ? byId.get(entry.itemId) : undefined;
    // 参照を指す行は、指す先のメインウィンドウのアイテムの id にする（メインウィンドウにあるのでそのまま開ける）
    if (item?.ref?.status === 'ok') return { ...entry, itemId: item.ref.itemId };
    const expanded = item?.type === 'item' ? expandWorkspaceEntry(entry, item) : undefined;
    return expanded ?? { ...entry };
  });
}

/** 画面の中だけで使う印を除いて、保存する行にする */
export function toSavedSetEntries(entries: readonly RegisterSetEntry[]): SetEntry[] {
  return entries.map(({ expandedFrom: _expandedFrom, ...entry }) => entry);
}

/**
 * RegisterItem をアイテム更新（置き換え）に変換する
 *
 * その種別が持つフィールドだけを返すので、別種別への変更でも古いフィールドは残らない。
 */
export function registerItemToWorkspaceItemUpdate(registerItem: RegisterItem): WorkspaceItemUpdate {
  const memo = registerItem.memo || undefined;

  switch (registerItem.itemCategory) {
    case 'clipboard':
      return compact({
        type: 'clipboard',
        displayName: registerItem.displayName,
        dataFileRef: registerItem.clipboardDataRef ?? '',
        savedAt: registerItem.clipboardSavedAt ?? Date.now(),
        preview: registerItem.clipboardPreview,
        formats: [...(registerItem.clipboardFormats ?? [])],
        customIcon: registerItem.customIcon,
        memo,
      });
    case 'set':
      return compact({
        type: 'set',
        displayName: registerItem.displayName,
        entries: toSavedSetEntries(registerItem.setEntries ?? []),
        launchMode: registerItem.setLaunchMode,
        customIcon: registerItem.customIcon,
        memo,
      });
    default:
      return compact({
        type: 'item',
        displayName: registerItem.displayName,
        path: registerItem.path,
        args: registerItem.args || undefined,
        customIcon: registerItem.customIcon,
        ...itemWindowSwitchFields(registerItem),
        memo,
      });
  }
}

// ============================================================
// 表示用
// ============================================================

/**
 * アイテムの「中身」を 1 行で表す（ツールチップ・テキストコピー用）
 *
 * 旧形式ではこれを path に保存していたが、2.0 では表示時にここで組み立てる。
 */
export function describeWorkspaceItem(item: WorkspaceItem, t: TFunction): string {
  switch (item.type) {
    case 'item':
      // パスの無い単一アイテムは、パスの代わりに切り替える先のウィンドウを出す
      return isPathlessItem(item)
        ? t('launcher.tooltip.windowSwitchOnly', { target: describeWindowMatch(item.window) })
        : item.path;
    case 'clipboard':
      return item.preview
        ? t('workspace.describe.clipboardWithPreview', { preview: item.preview })
        : t('workspace.describe.clipboard');
    case 'set':
      return t('workspace.describe.set', { count: item.entries.length });
    case 'ref':
      return item.ref.status === 'unsupported'
        ? t('workspace.ref.unsupported')
        : t('workspace.ref.missing');
  }
}

/** 起動トーストに渡す種別（通常アイテムは path から判定した種別） */
export function toToastItemType(item: WorkspaceItem): ToastItemType {
  switch (item.type) {
    case 'item':
      return item.launcherType;
    case 'ref':
      return 'file';
    default:
      return item.type;
  }
}
