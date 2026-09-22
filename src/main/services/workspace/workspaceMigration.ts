/**
 * ワークスペース設定ファイルの旧形式（v1: version なし）→ 2.0 変換
 *
 * ファイル I/O を持たない純粋関数。出力は「2.0 の形をした生オブジェクト」で、
 * 呼び出し側（WorkspaceFileStore）が通常の寛容パース（workspaceParser）に通して検証する。
 *
 * v1 → 2.0 の主な変換:
 * - id を 8 文字英数字に採番し直し、参照（groupId / parentGroupId / workspaceId / archivedGroupId /
 *   切り離しウィンドウのキー）を追随させる。固定 id 'default' のワークスペースも採番
 * - items: 判定済み type（url/file/app/…）→ 'item'、'windowOperation' → 'window'、
 *   path の疑似文字列 "[ウィンドウ操作: <title>]" → windowTitle、windowX/Y/Width/Height → x/y/width/height、
 *   clipboardDataRef/clipboardFormats/clipboardSavedAt → dataFileRef/formats/savedAt、layoutEntries → entries。
 *   originalName / label / icon は落とす
 * - groups: name → displayName（さらに古い形式）、color の CSS 変数名・生 hex → 色トークン、
 *   collapsed → UI 状態ファイルへ
 * - workspace-detached.json → UI 状態ファイルの detachedWindows
 */

import type { DetachedWindowState, WorkspaceUiStateFile } from '@common/types/json-workspace';
import {
  DEFAULT_WORKSPACE_DISPLAY_NAME,
  JSON_WORKSPACE_VERSION,
  WORKSPACE_ARCHIVE_SCHEMA_REF,
  WORKSPACE_SCHEMA_REF,
  WORKSPACE_UI_STATE_VERSION,
} from '@common/types/json-workspace';
import {
  GROUP_COLOR_HEX,
  getDefaultGroupColor,
  isGroupColorToken,
  isValidGroupColor,
} from '@common/groupColors';
import { generateUniqueId, isValidId } from '@common/utils/jsonParser';
import { stripIconFromLayoutEntries } from '@common/utils/dataConverters';
import { normalizeWindowTitleForProcessOnly } from '@common/utils/windowTitle';
import type { LayoutWindowEntry } from '@common/types/launcher';

type Raw = Record<string, unknown>;

export interface WorkspaceV1Input {
  /** workspace.json の内容（JSON.parse 済み） */
  main: unknown;
  /** workspace-archive.json の内容（無ければ undefined） */
  archive?: unknown;
  /** workspace-detached.json の内容（無ければ undefined） */
  detached?: unknown;
}

export interface WorkspaceV1MigrationOptions {
  /** 補完に使う現在時刻 */
  now: number;
  /** 既に使われている id（採番時に避ける） */
  reservedIds?: Set<string>;
}

export interface WorkspaceV1MigrationResult {
  /** 2.0 形式の workspace.json（生オブジェクト。寛容パースに通すこと） */
  main: Raw;
  /** 2.0 形式の workspace-archive.json */
  archive: Raw;
  /** workspace-ui-state.json */
  uiState: WorkspaceUiStateFile;
  /** 旧 id → 新 id */
  idMap: Map<string, string>;
}

/** 旧形式（version を持たない）か */
export function isLegacyWorkspaceFile(raw: unknown): boolean {
  return isRecord(raw) && typeof raw.version !== 'string';
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsOf(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter(isRecord).map((r) => ({ ...r })) : [];
}

/** 旧形式の path 疑似文字列からウィンドウタイトルを取り出す */
// 旧コードは (.+) だったためタイトル空の "[ウィンドウ操作: ]" を復元できなかった。ここでは空も拾う
const WINDOW_OPERATION_PATH_PATTERN = /^\[ウィンドウ操作: (.*)\]$/;

/** 旧形式の判定済み type のうち、通常アイテムに畳むもの */
const LEGACY_LAUNCHER_TYPES = new Set(['url', 'file', 'folder', 'app', 'customUri']);

/**
 * 旧形式の色（CSS 変数名 / 生 hex / トークン）を色トークンまたは hex に変換する
 */
export function migrateGroupColor(raw: unknown, depth: number): string {
  if (isGroupColorToken(raw)) return raw;
  if (typeof raw === 'string') {
    const cssVar = raw.match(/^var\(--color-([a-z]+)\)$/)?.[1];
    if (cssVar && isGroupColorToken(cssVar)) return cssVar;

    const lower = raw.toLowerCase();
    for (const [token, hex] of Object.entries(GROUP_COLOR_HEX)) {
      if (hex === lower) return token;
    }
    if (isValidGroupColor(raw)) return raw;
  }
  return getDefaultGroupColor(depth);
}

/**
 * v1 → 2.0 変換
 */
export function migrateWorkspaceV1(
  input: WorkspaceV1Input,
  options: WorkspaceV1MigrationOptions
): WorkspaceV1MigrationResult {
  const { now } = options;
  const reserved = new Set(options.reservedIds ?? []);
  const idMap = new Map<string, string>();

  const main = isRecord(input.main) ? input.main : {};
  const archive = isRecord(input.archive) ? input.archive : {};
  const detached = isRecord(input.detached) ? input.detached : {};

  const workspaces = recordsOf(main.workspaces);
  const groups = recordsOf(main.groups);
  const items = recordsOf(main.items);
  const archivedGroups = recordsOf(archive.groups);
  const archivedItems = recordsOf(archive.items);

  // --- 前処理: さらに古い形式の吸収 ---
  for (const group of [...groups, ...archivedGroups]) {
    if (group.displayName === undefined && typeof group.name === 'string') {
      group.displayName = group.name;
    }
    delete group.name;
  }
  if (workspaces.length === 0) {
    // マルチワークスペース以前のファイル。旧コードと同じ固定 id で作り、下で採番される
    workspaces.push({
      id: 'default',
      displayName: DEFAULT_WORKSPACE_DISPLAY_NAME,
      order: 0,
      createdAt: now,
    });
  }
  const legacyDefaultWorkspaceId = String(
    [...workspaces].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))[0].id ?? 'default'
  );

  // --- id の採番（参照より先に全エンティティ分を確定する） ---
  const assignId = (entity: Raw): string => {
    const old = entity.id;
    let id: string;
    if (typeof old === 'string' && isValidId(old) && !reserved.has(old)) {
      id = old;
    } else {
      id = generateUniqueId(reserved);
    }
    reserved.add(id);
    if (typeof old === 'string' && old !== '' && !idMap.has(old)) {
      idMap.set(old, id);
    }
    entity.id = id;
    return id;
  };
  for (const entity of [...workspaces, ...groups, ...items, ...archivedGroups, ...archivedItems]) {
    assignId(entity);
  }
  const ref = (value: unknown): string | undefined =>
    typeof value === 'string' && value !== '' ? (idMap.get(value) ?? value) : undefined;

  // --- グループの深さ（デフォルト色の決定に使う。旧 id ベースで辿る） ---
  const parentByNewId = new Map<string, string | undefined>();
  for (const group of [...groups, ...archivedGroups]) {
    parentByNewId.set(group.id as string, ref(group.parentGroupId));
  }
  const depthOf = (groupId: string): number => {
    let depth = 0;
    let current = parentByNewId.get(groupId);
    const seen = new Set<string>([groupId]);
    while (current && !seen.has(current) && parentByNewId.has(current)) {
      depth++;
      seen.add(current);
      current = parentByNewId.get(current);
    }
    return depth;
  };

  const uiState: WorkspaceUiStateFile = {
    version: WORKSPACE_UI_STATE_VERSION,
    collapsedGroups: {},
    detachedWindows: {},
  };

  // --- workspaces ---
  const newWorkspaces = workspaces.map((ws) => ({
    id: ws.id,
    displayName: ws.displayName,
    order: ws.order,
    createdAt: ws.createdAt,
  }));

  // --- groups ---
  const convertGroup = (group: Raw): Raw => {
    const id = group.id as string;
    if (group.collapsed === true) {
      uiState.collapsedGroups[id] = true;
    }
    return {
      id,
      displayName: group.displayName,
      color: migrateGroupColor(group.color, depthOf(id)),
      order: group.order,
      createdAt: group.createdAt,
      workspaceId: ref(group.workspaceId) ?? ref(legacyDefaultWorkspaceId),
      parentGroupId: ref(group.parentGroupId),
    };
  };
  const newGroups = groups.map(convertGroup);

  // --- items ---
  const convertItem = (item: Raw): Raw => {
    const base: Raw = {
      id: item.id,
      displayName: item.displayName ?? item.originalName,
      memo: item.memo,
      workspaceId: ref(item.workspaceId) ?? ref(legacyDefaultWorkspaceId),
      groupId: ref(item.groupId),
      order: item.order,
      addedAt: item.addedAt,
    };
    const type = item.type;

    if (type === 'windowOperation') {
      const path = typeof item.path === 'string' ? item.path : '';
      const windowTitle = path.match(WINDOW_OPERATION_PATH_PATTERN)?.[1] ?? path;
      return {
        ...base,
        type: 'window',
        // 旧形式は「タイトルかプロセス名のどちらか」を許していた。全一致ワイルドカードで同じ意味にする
        windowTitle:
          normalizeWindowTitleForProcessOnly(windowTitle, item.processName) ?? windowTitle,
        processName: item.processName,
        x: item.windowX,
        y: item.windowY,
        width: item.windowWidth,
        height: item.windowHeight,
        moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
        virtualDesktopNumber: item.virtualDesktopNumber,
        activateWindow: item.activateWindow,
        pinToAllDesktops: item.pinToAllDesktops,
      };
    }
    if (type === 'group') {
      return { ...base, type: 'group', itemNames: item.itemNames ?? [] };
    }
    if (type === 'clipboard') {
      return {
        ...base,
        type: 'clipboard',
        dataFileRef: item.clipboardDataRef ?? item.dataFileRef,
        savedAt: item.clipboardSavedAt ?? item.savedAt ?? item.addedAt,
        preview: item.preview,
        formats: item.clipboardFormats ?? item.formats ?? [],
        customIcon: item.customIcon,
      };
    }
    if (type === 'layout') {
      const entries = Array.isArray(item.layoutEntries ?? item.entries)
        ? stripIconFromLayoutEntries((item.layoutEntries ?? item.entries) as LayoutWindowEntry[])
        : [];
      return { ...base, type: 'layout', entries, customIcon: item.customIcon };
    }
    if ((typeof type === 'string' && LEGACY_LAUNCHER_TYPES.has(type)) || type === 'item') {
      return {
        ...base,
        type: 'item',
        path: item.path,
        args: item.args,
        originalPath: item.originalPath,
        customIcon: item.customIcon,
        windowConfig: item.windowConfig,
      };
    }
    if (typeof item.path === 'string') {
      // 未知の type でも path があれば通常アイテムとして生かす
      return {
        ...base,
        type: 'item',
        path: item.path,
        args: item.args,
        originalPath: item.originalPath,
        customIcon: item.customIcon,
        windowConfig: item.windowConfig,
      };
    }
    // 変換できないものは生のまま返し、寛容パースで invalid にする（消さない）
    return { ...item, ...base };
  };
  const newItems = items.map(convertItem);

  // --- archive ---
  const newArchivedGroups = archivedGroups.map((group) => ({
    ...convertGroup(group),
    archivedAt: group.archivedAt,
    originalOrder: group.originalOrder,
    itemCount: group.itemCount,
  }));
  const newArchivedItems = archivedItems.map((item) => ({
    ...convertItem(item),
    archivedAt: item.archivedAt,
    archivedGroupId: ref(item.archivedGroupId),
  }));

  // --- detached → uiState.detachedWindows ---
  const windows = isRecord(detached.windows) ? detached.windows : {};
  const mainGroupIds = new Set(newGroups.map((g) => g.id as string));
  for (const [oldRootId, state] of Object.entries(windows)) {
    const rootId = ref(oldRootId);
    if (!rootId || !mainGroupIds.has(rootId) || !isRecord(state) || !isRecord(state.bounds))
      continue;
    const collapsedStates: Record<string, boolean> = {};
    if (isRecord(state.collapsedStates)) {
      for (const [oldId, collapsed] of Object.entries(state.collapsedStates)) {
        const newId = ref(oldId);
        if (newId && typeof collapsed === 'boolean') collapsedStates[newId] = collapsed;
      }
    }
    const converted: DetachedWindowState = {
      collapsedStates,
      bounds: state.bounds as DetachedWindowState['bounds'],
    };
    if (state.pinMode === 0 || state.pinMode === 1 || state.pinMode === 2) {
      converted.pinMode = state.pinMode;
    }
    uiState.detachedWindows[rootId] = converted;
  }

  return {
    main: {
      $schema: WORKSPACE_SCHEMA_REF,
      version: JSON_WORKSPACE_VERSION,
      workspaces: newWorkspaces,
      groups: newGroups,
      items: newItems,
    },
    archive: {
      $schema: WORKSPACE_ARCHIVE_SCHEMA_REF,
      version: JSON_WORKSPACE_VERSION,
      groups: newArchivedGroups,
      items: newArchivedItems,
    },
    uiState,
    idMap,
  };
}
