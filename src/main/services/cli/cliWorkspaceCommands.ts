import type {
  AppItem,
  JsonClipboardItem,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
  MixedOrderEntry,
  Workspace,
  WorkspaceGroupUpdate,
  WorkspaceGroupView,
  WorkspaceItem,
  WorkspaceRefInfo,
  WorkspaceItemUpdate,
} from '@common/types';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { appItemToWorkspaceItemBody } from '@common/utils/workspaceConverters';
import { isClipboardItem } from '@common/types/guards';
import { isValidGroupColor } from '@common/groupColors';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';

import { mainI18n } from '../mainI18n.js';

import {
  CliError,
  expectPositionals,
  optionFlag,
  optionInt,
  optionString,
  parseArgs,
} from './cliArgs.js';
import type { CliCandidate, ParsedArgs } from './cliArgs.js';
import {
  applyPatch,
  isTextOnlyClipboard,
  matchesGrep,
  previewClipboardText,
  readTextOption,
  resolveCliPath,
  resolveOne,
  validateAsDataItem,
} from './cliShared.js';
import type { ClipboardTextStore } from './cliShared.js';
import { checkCliSetEntries } from './cliSetCommands.js';
import { findLauncherEntry, launcherCandidate, resolveTargetFile } from './cliLauncherCommands.js';
import type { LauncherEntry, LauncherStore } from './cliLauncherCommands.js';

/**
 * qdl workspace … — ワークスペース（workspace.json）のワークスペース・グループ・アイテム
 */

/** WorkspaceService のうち CLI が使うもの（テストでは差し替える） */
export interface WorkspaceStore {
  loadWorkspaces(): Promise<Workspace[]>;
  createWorkspace(name: string): Promise<Workspace>;
  renameWorkspace(id: string, name: string): Promise<void>;
  /** 中のグループ・アイテムごと消す（CLI は空のワークスペースにだけ使う） */
  deleteWorkspace(id: string): Promise<void>;
  reorderWorkspaces(ids: string[]): Promise<void>;
  loadGroups(): Promise<WorkspaceGroupView[]>;
  /** アイテム（参照はメインウィンドウのアイテムの中身で埋めたもの） */
  loadItems(): Promise<WorkspaceItem[]>;
  addItem(item: AppItem, groupId?: string, workspaceId?: string): Promise<WorkspaceItem>;
  /** メインウィンドウのアイテム（id）を参照できるか（今のデータファイルにあり、フォルダ取込で展開したものでない） */
  canRef(itemId: string): Promise<boolean>;
  /** メインウィンドウのアイテム（id）を指す参照を足す。参照できなければ undefined */
  addRef(
    itemId: string,
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem | undefined>;
  /** 表示名を変える（参照ならワークスペースでの表示名。空ならメインウィンドウの表示名に戻す） */
  updateDisplayName(id: string, displayName: string): Promise<void>;
  /** 参照をコピーにする */
  convertToCopy(id: string): Promise<WorkspaceItem>;
  /**
   * コピーをメインウィンドウのデータファイルへ移し、参照に変える（画面の「メインウィンドウへ移して参照にする」と同じ）。
   * reused は、移す先に同じアイテムがあり、新しく作らずにそれを指したとき
   */
  moveToMain(
    id: string,
    file: string
  ): Promise<{ item: WorkspaceItem; file: string; tabName?: string; reused: boolean }>;
  /** アイテムをメインウィンドウのアイテムの参照にする（コピー → 参照・指し直し） */
  linkToMain(id: string, mainItemId: string): Promise<WorkspaceItem>;
  /** コピーと同じパス・引数のメインウィンドウのアイテム（id） */
  findLinkCandidates(id: string): Promise<string[]>;
  updateItem(id: string, update: WorkspaceItemUpdate): Promise<void>;
  removeItem(id: string): Promise<void>;
  moveItemToGroup(itemId: string, groupId: string): Promise<void>;
  /** groupId を省けるのは、移す先にグループが無いとき（「未分類」グループを作る） */
  moveItemToWorkspace(itemId: string, workspaceId: string, groupId?: string): Promise<void>;
  reorderMixed(parentGroupId: string | undefined, entries: MixedOrderEntry[]): Promise<void>;
  createGroup(
    name: string,
    color?: string,
    parentGroupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceGroupView>;
  updateGroup(id: string, updates: WorkspaceGroupUpdate): Promise<void>;
  /** サブグループと中のアイテムごと消す */
  deleteGroup(id: string): Promise<void>;
  /** 子孫のサブグループとアイテムごとアーカイブへ移す */
  archiveGroup(id: string): Promise<void>;
  loadArchivedGroups(): Promise<ArchivedWorkspaceGroup[]>;
  loadArchivedItems(): Promise<ArchivedWorkspaceItem[]>;
  /** アーカイブ済みのグループなら、そのワークスペースへ復元する（画面の「移動先を選んで復元」と同じ） */
  moveGroupToWorkspace(groupId: string, workspaceId: string): Promise<void>;
}

export interface WorkspaceCommandContext {
  store: WorkspaceStore;
  cwd: string;
  markFolder(path: string): Promise<string>;
  syncBeforeWrite(): Promise<void>;
  changed(message: string): void;
  /** グループを消す前に、そのグループの切り離しウィンドウを閉じる */
  beforeGroupRemoved(groupId: string): Promise<void>;
  /** クリップボードアイテムの実データ（テキストだけ） */
  clipboard: ClipboardTextStore;
  /** --from: 写す元のメイン画面のアイテム */
  launcher: LauncherStore;
  /** --from: データファイルの項目を、画面が持つ実行時の形にする（.lnk はリンク先を読む。フォルダ取込は undefined） */
  launcherAppItem(entry: LauncherEntry): Promise<AppItem | undefined>;
  /** --from: クリップボードアイテムの実データを複製し、新しい参照を返す（できなければ null） */
  duplicateClipboardData(dataFileRef: string): string | null;
}

/** 検証のためだけに入れる実データの参照（保存するまで本物の参照は決まらない） */
const CHECK_DATA_REF = 'clipboard-data/CliCheck.json';

interface Snapshot {
  workspaces: Workspace[];
  groups: WorkspaceGroupView[];
  items: WorkspaceItem[];
}

async function snapshot(store: WorkspaceStore): Promise<Snapshot> {
  const [workspaces, groups, items] = await Promise.all([
    store.loadWorkspaces(),
    store.loadGroups(),
    store.loadItems(),
  ]);
  return { workspaces, groups, items };
}

function groupPath(groupId: string | undefined, s: Snapshot): string[] {
  const names: string[] = [];
  let current = groupId ? s.groups.find((g) => g.id === groupId) : undefined;
  while (current) {
    names.unshift(current.displayName);
    const parentId: string | undefined = current.parentGroupId;
    current = parentId ? s.groups.find((g) => g.id === parentId) : undefined;
  }
  return names;
}

function workspaceName(id: string, s: Snapshot): string {
  return s.workspaces.find((w) => w.id === id)?.displayName ?? id;
}

function itemLocation(item: WorkspaceItem, s: Snapshot): string[] {
  return [workspaceName(item.workspaceId, s), ...groupPath(item.groupId, s)];
}

function groupLocation(group: WorkspaceGroupView, s: Snapshot): string[] {
  return [workspaceName(group.workspaceId, s), ...groupPath(group.id, s)];
}

function itemView(item: WorkspaceItem, s: Snapshot): Record<string, unknown> {
  // 実行時だけの情報（アイコン・起動種別）は落とし、起動種別は kind として返す
  const { icon: _icon, ...rest } = item as WorkspaceItem & { icon?: string; launcherType?: string };
  void _icon;
  const { launcherType, ...body } = rest as typeof rest & { launcherType?: string };
  return {
    ...body,
    ...(item.type === 'item' ? { kind: launcherType ?? detectItemTypeSync(item.path) } : {}),
    location: itemLocation(item, s),
  };
}

function groupView(group: WorkspaceGroupView, s: Snapshot): Record<string, unknown> {
  return {
    id: group.id,
    displayName: group.displayName,
    color: group.color,
    workspaceId: group.workspaceId,
    parentGroupId: group.parentGroupId ?? null,
    order: group.order,
    itemCount: s.items.filter((i) => i.groupId === group.id).length,
    subgroupCount: s.groups.filter((g) => g.parentGroupId === group.id).length,
    location: groupLocation(group, s),
  };
}

function findWorkspace(key: string, s: Snapshot): Workspace {
  return resolveOne(
    key,
    s.workspaces,
    mainI18n.t('cli.targets.workspace'),
    (w) => w.id,
    (w) => w.displayName,
    (w): CliCandidate => ({ id: w.id, displayName: w.displayName, location: [] })
  );
}

function findGroup(key: string, s: Snapshot, workspaceId?: string): WorkspaceGroupView {
  const groups = workspaceId ? s.groups.filter((g) => g.workspaceId === workspaceId) : s.groups;
  return resolveOne(
    key,
    groups,
    mainI18n.t('cli.targets.group'),
    (g) => g.id,
    (g) => g.displayName,
    (g): CliCandidate => ({ id: g.id, displayName: g.displayName, location: groupLocation(g, s) })
  );
}

function findItem(key: string, s: Snapshot): WorkspaceItem {
  return resolveOne(
    key,
    s.items,
    mainI18n.t('cli.targets.workspaceItem'),
    (i) => i.id,
    (i) => i.displayName,
    (i): CliCandidate => ({ id: i.id, displayName: i.displayName, location: itemLocation(i, s) })
  );
}

function defaultWorkspace(s: Snapshot): Workspace {
  const sorted = [...s.workspaces].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) throw new CliError('not_found', mainI18n.t('cli.errors.noWorkspace'));
  return sorted[0];
}

/**
 * --workspace と --group から置き場を決める。グループを指定したらそのワークスペースに従う
 *
 * 未分類は無いので、グループのあるワークスペースでは --group が要る。
 * グループが 1 つも無いワークスペースだけ groupId を返さず、足すときに「未分類」グループが作られる（A3-157）
 */
function resolvePlace(
  s: Snapshot,
  workspaceKey: string | undefined,
  groupKey: string | undefined
): { workspaceId: string; groupId?: string } {
  if (groupKey === '') throw new CliError('usage', mainI18n.t('cli.errors.groupEmpty'));
  const workspace = workspaceKey ? findWorkspace(workspaceKey, s) : undefined;
  if (groupKey === undefined) {
    const target = workspace ?? defaultWorkspace(s);
    if (s.groups.some((g) => g.workspaceId === target.id)) {
      throw new CliError(
        'usage',
        mainI18n.t('cli.errors.groupRequired', { workspace: target.displayName })
      );
    }
    return { workspaceId: target.id };
  }
  const group = findGroup(groupKey, s, workspace?.id);
  return { workspaceId: group.workspaceId, groupId: group.id };
}

/**
 * update で動かす先を決める。--workspace・--group が無いか、今いるワークスペースを --workspace で書いただけ
 * （--group なし）なら、今の場所のまま（グループのあるワークスペースで --group を求めない）
 */
function resolveUpdatePlace(
  s: Snapshot,
  current: { workspaceId: string; groupId?: string },
  workspaceKey: string | undefined,
  groupKey: string | undefined
): { workspaceId: string; groupId?: string } {
  const stay = { workspaceId: current.workspaceId, groupId: current.groupId };
  if (groupKey === undefined) {
    if (workspaceKey === undefined) return stay;
    if (findWorkspace(workspaceKey, s).id === current.workspaceId) return stay;
  }
  return resolvePlace(s, workspaceKey ?? (groupKey ? undefined : current.workspaceId), groupKey);
}

/**
 * 同じ親の中で position 番目（0 始まり）に置く。グループの中はサブグループとアイテムが同じ並び（画面の表示と同じ）
 *
 * @param groupId 省いたら、アイテムが今入っているグループ（足したときに作られた「未分類」グループなど）
 */
async function placeAt(
  store: WorkspaceStore,
  itemId: string,
  workspaceId: string,
  placeGroupId: string | undefined,
  position: number
): Promise<void> {
  const s = await snapshot(store);
  const groupId = placeGroupId ?? s.items.find((i) => i.id === itemId)?.groupId;
  const siblings: Array<MixedOrderEntry & { order: number }> = [
    ...s.items
      .filter((i) => i.workspaceId === workspaceId && i.groupId === groupId && i.id !== itemId)
      .map((i) => ({ kind: 'item' as const, id: i.id, order: i.order })),
    ...(groupId
      ? s.groups
          .filter((g) => g.parentGroupId === groupId)
          .map((g) => ({ kind: 'group' as const, id: g.id, order: g.order }))
      : []),
  ].sort((a, b) => a.order - b.order || (a.kind === 'group' ? -1 : 1));
  const index = Math.max(0, Math.min(position, siblings.length));
  siblings.splice(index, 0, { kind: 'item', id: itemId, order: -1 });
  await store.reorderMixed(
    groupId,
    siblings.map(({ kind, id }) => ({ kind, id }))
  );
}

export async function runWorkspaceCommand(
  noun: string | undefined,
  verb: string | undefined,
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  // ワークスペース自体は「もの」を挟まない（qdl workspace list|add|update|remove）
  const workspaceArgs = verb === undefined ? args : [verb, ...args];
  switch (noun) {
    case 'list': {
      const parsed = parseArgs(workspaceArgs, {});
      expectPositionals(parsed, []);
      const s = await snapshot(ctx.store);
      return sortedWorkspaces(s).map((w) => workspaceView(w, s));
    }
    case 'add':
      return addWorkspace(workspaceArgs, ctx);
    case 'update':
      return updateWorkspace(workspaceArgs, ctx);
    case 'remove':
      return removeWorkspace(workspaceArgs, ctx);
  }
  if (noun === 'item') {
    switch (verb) {
      case 'list':
        return listItems(args, ctx);
      case 'add':
        return addItem(args, ctx);
      case 'update':
        return updateItem(args, ctx);
      case 'remove':
        return removeItem(args, ctx);
      case 'convert':
        return convertItem(args, ctx);
      case 'move-to-main':
        return moveItemToMain(args, ctx);
    }
  }
  if (noun === 'group') {
    switch (verb) {
      case 'list':
        return listGroups(args, ctx);
      case 'add':
        return addGroup(args, ctx);
      case 'update':
        return updateGroup(args, ctx);
      case 'remove':
        return removeGroup(args, ctx);
      case 'archive':
        return archiveGroup(args, ctx);
    }
  }
  if (noun === 'archive') {
    switch (verb) {
      case 'list':
        return listArchive(args, ctx);
      case 'restore':
        return restoreArchive(args, ctx);
    }
    throw new CliError(
      'usage',
      verb
        ? mainI18n.t('cli.errors.unknownVerb', { command: `workspace archive ${verb}` })
        : mainI18n.t('cli.errors.missingArchiveVerb')
    );
  }
  if (noun !== 'item' && noun !== 'group') {
    throw new CliError(
      'usage',
      noun
        ? mainI18n.t('cli.errors.unknownCommand', { command: `workspace ${noun}` })
        : mainI18n.t('cli.errors.missingWorkspaceNoun')
    );
  }
  throw new CliError(
    'usage',
    verb
      ? mainI18n.t('cli.errors.unknownVerb', { command: `workspace ${noun} ${verb}` })
      : mainI18n.t('cli.errors.missingVerb')
  );
}

function sortedWorkspaces(s: Snapshot): Workspace[] {
  return [...s.workspaces].sort((a, b) => a.order - b.order);
}

function workspaceView(w: Workspace, s: Snapshot): Record<string, unknown> {
  return {
    id: w.id,
    displayName: w.displayName,
    order: w.order,
    groupCount: s.groups.filter((g) => g.workspaceId === w.id).length,
    itemCount: s.items.filter((i) => i.workspaceId === w.id).length,
  };
}

/** ワークスペースを position 番目（0 始まり）に置く。範囲の外は端に寄せる */
async function placeWorkspaceAt(
  store: WorkspaceStore,
  id: string,
  position: number
): Promise<void> {
  const ids = sortedWorkspaces(await snapshot(store))
    .map((w) => w.id)
    .filter((x) => x !== id);
  ids.splice(Math.max(0, Math.min(position, ids.length)), 0, id);
  await store.reorderWorkspaces(ids);
}

async function addWorkspace(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['name', 'position'], flags: ['dry-run'] });
  expectPositionals(parsed, []);
  const name = optionString(parsed, 'name');
  if (!name?.trim()) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  const position = optionInt(parsed, 'position');
  const dryRun = optionFlag(parsed, 'dry-run');
  if (dryRun) {
    return {
      dryRun: true,
      workspace: { id: null, displayName: name, ...(position !== undefined ? { position } : {}) },
    };
  }

  await ctx.syncBeforeWrite();
  const created = await ctx.store.createWorkspace(name);
  if (position !== undefined) await placeWorkspaceAt(ctx.store, created.id, position);
  ctx.changed(mainI18n.t('cli.changed.workspaceAdded', { name }));
  const after = await snapshot(ctx.store);
  return workspaceView(after.workspaces.find((w) => w.id === created.id) ?? created, after);
}

async function updateWorkspace(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['name', 'position'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const name = optionString(parsed, 'name');
  const position = optionInt(parsed, 'position');
  if (name === undefined && position === undefined) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.needChanges', { options: '--name --position' })
    );
  }
  if (name !== undefined && !name.trim())
    throw new CliError('usage', mainI18n.t('cli.errors.emptyName'));
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const workspace = findWorkspace(key, s);
  const before = workspaceView(workspace, s);
  if (dryRun) {
    return {
      dryRun: true,
      before,
      changes: {
        ...(name !== undefined ? { displayName: name } : {}),
        ...(position !== undefined ? { position } : {}),
      },
    };
  }

  if (name !== undefined) await ctx.store.renameWorkspace(workspace.id, name);
  if (position !== undefined) await placeWorkspaceAt(ctx.store, workspace.id, position);
  ctx.changed(mainI18n.t('cli.changed.workspaceUpdated', { name: name ?? workspace.displayName }));
  const after = await snapshot(ctx.store);
  const updated = after.workspaces.find((w) => w.id === workspace.id) ?? workspace;
  return { before, workspace: workspaceView(updated, after) };
}

async function removeWorkspace(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const workspace = findWorkspace(key, s);
  const view = workspaceView(workspace, s);
  // 本体の削除は中身ごと消すので、CLI では空のものだけにする（グループの削除と同じ）
  if ((view.groupCount as number) > 0 || (view.itemCount as number) > 0) {
    throw new CliError(
      'conflict',
      mainI18n.t('cli.errors.workspaceNotEmpty', {
        name: workspace.displayName,
        groups: String(view.groupCount),
        items: String(view.itemCount),
      })
    );
  }
  if (s.workspaces.length <= 1) {
    throw new CliError('conflict', mainI18n.t('cli.errors.lastWorkspace'));
  }
  if (dryRun) return { dryRun: true, removed: view };
  await ctx.store.deleteWorkspace(workspace.id);
  ctx.changed(mainI18n.t('cli.changed.workspaceRemoved', { name: workspace.displayName }));
  return { removed: view };
}

async function listItems(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['workspace', 'group', 'grep'],
    flags: ['with-text'],
  });
  expectPositionals(parsed, []);
  const withText = optionFlag(parsed, 'with-text');
  const s = await snapshot(ctx.store);
  const workspaceKey = optionString(parsed, 'workspace');
  const workspace = workspaceKey ? findWorkspace(workspaceKey, s) : undefined;
  const groupKey = optionString(parsed, 'group');
  const group = groupKey ? findGroup(groupKey, s, workspace?.id) : undefined;
  const grep = optionString(parsed, 'grep');
  return s.items
    .filter((i) => !workspace || i.workspaceId === workspace.id)
    .filter((i) => groupKey === undefined || (group ? i.groupId === group.id : !i.groupId))
    .filter((i) => matchesGrep(grep, Object.values(i)))
    .map((i) => {
      const v = itemView(i, s);
      // テキストだけのクリップボードアイテムは、求められたら本文も返す（書き換える前に読むため）
      if (withText && i.type === 'clipboard' && isTextOnlyClipboard(i.formats)) {
        v.text = ctx.clipboard.read(i.dataFileRef);
      }
      return v;
    });
}

async function addItem(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: [
      'name',
      'path',
      'args',
      'memo',
      'group',
      'workspace',
      'position',
      'type',
      'text',
      'text-file',
      'from',
    ],
    flags: ['dry-run', 'copy'],
    allowSet: true,
  });
  expectPositionals(parsed, []);
  const from = optionString(parsed, 'from');
  if (from !== undefined) return addFromLauncher(parsed, from, ctx);
  if (optionFlag(parsed, 'copy')) {
    throw new CliError('usage', mainI18n.t('cli.errors.copyNeedsFrom'));
  }
  const type = optionString(parsed, 'type') ?? 'item';
  if (type === 'window') throw new CliError('usage', mainI18n.t('cli.errors.windowTypeRemoved'));
  if (type !== 'item' && type !== 'clipboard') {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.badType', { types: 'item / clipboard', type })
    );
  }
  if (type === 'clipboard') return addClipboardItem(parsed, ctx);
  if (
    optionString(parsed, 'text') !== undefined ||
    optionString(parsed, 'text-file') !== undefined
  ) {
    throw new CliError('usage', mainI18n.t('cli.errors.textOnlyClipboard'));
  }
  const name = optionString(parsed, 'name');
  const rawPath = optionString(parsed, 'path');
  if (!name) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  // --set window=… で対象ウィンドウを渡せば --path が無くてもよい（パスの無い単一アイテム）
  const setsWindow = parsed.sets.some(([key]) => key === 'window' || key === 'windowConfig');
  if (!rawPath && !setsWindow)
    throw new CliError('usage', mainI18n.t('cli.errors.needPathOrWindow'));
  const position = optionInt(parsed, 'position');
  const dryRun = optionFlag(parsed, 'dry-run');

  const itemPath = rawPath ? await ctx.markFolder(resolveCliPath(rawPath, ctx.cwd)) : '';
  // 中身はデータファイルの通常アイテムと同じ規則で検証する
  const { merged, setKeys } = applyPatch(
    { id: 'CliCheck', type: 'item' },
    {
      displayName: name,
      path: itemPath,
      args: optionString(parsed, 'args'),
      memo: optionString(parsed, 'memo'),
    },
    parsed
  );
  const checked = validateAsDataItem(merged, setKeys);

  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const place = resolvePlace(s, optionString(parsed, 'workspace'), optionString(parsed, 'group'));
  const preview = {
    ...checked,
    id: null,
    kind: detectItemTypeSync(itemPath),
    location: [workspaceName(place.workspaceId, s), ...groupPath(place.groupId, s)],
  };
  if (dryRun) return { dryRun: true, item: preview };

  const {
    id: _id,
    type: _type,
    updatedAt: _updatedAt,
    ...body
  } = checked as unknown as Record<string, unknown>;
  void _id;
  void _type;
  void _updatedAt;
  const added = await ctx.store.addItem(
    { ...(body as object), type: detectItemTypeSync(itemPath) } as AppItem,
    place.groupId,
    place.workspaceId
  );
  if (position !== undefined) {
    await placeAt(ctx.store, added.id, place.workspaceId, place.groupId, position);
  }
  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === added.id) ?? added;
  ctx.changed(mainI18n.t('cli.changed.workspaceItemAdded', { name: item.displayName }));
  return itemView(item, after);
}

/**
 * メイン画面のアイテムを足す（右クリックの「ワークスペースに追加」と同じ）。
 * 既定はメインウィンドウのアイテムを指す参照（--name はワークスペースでの表示名）。--copy なら写す（コピー）。
 * コピーでは、セットの行はメイン画面のアイテムを id で指したまま。クリップボードは実データを複製して自分のファイルを持たせる
 */
async function addFromLauncher(
  parsed: ParsedArgs,
  from: string,
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  for (const option of ['path', 'args', 'memo', 'type', 'text', 'text-file']) {
    if (optionString(parsed, option) !== undefined) {
      throw new CliError('usage', mainI18n.t('cli.errors.fromOption', { option }));
    }
  }
  if (parsed.sets.length > 0) {
    throw new CliError('usage', mainI18n.t('cli.errors.fromOption', { option: 'set' }));
  }
  const name = optionString(parsed, 'name');
  if (name !== undefined && !name.trim()) {
    throw new CliError('usage', mainI18n.t('cli.errors.emptyName'));
  }
  const position = optionInt(parsed, 'position');
  const dryRun = optionFlag(parsed, 'dry-run');

  if (!dryRun) await ctx.syncBeforeWrite();
  const entry = await findLauncherEntry(from, ctx.launcher);
  const source = launcherCandidate(entry, await ctx.launcher.tabs());
  if (entry.item.type === 'dir') {
    throw new CliError('conflict', mainI18n.t('cli.errors.fromDir', { name: source.displayName }));
  }
  if (entry.item.type === 'wsgroup') {
    throw new CliError(
      'conflict',
      mainI18n.t('cli.errors.fromWsGroup', { name: source.displayName })
    );
  }
  if (entry.invalid) {
    throw new CliError(
      'invalid',
      mainI18n.t('cli.errors.fromInvalid', { name: source.displayName, reason: entry.invalid })
    );
  }
  const appItem = await ctx.launcherAppItem(entry);
  if (!appItem) {
    throw new CliError('conflict', mainI18n.t('cli.errors.fromDir', { name: source.displayName }));
  }
  const renamed = name ? ({ ...appItem, displayName: name.trim() } as AppItem) : appItem;
  const copy = optionFlag(parsed, 'copy');

  const s = await snapshot(ctx.store);
  const place = resolvePlace(s, optionString(parsed, 'workspace'), optionString(parsed, 'group'));
  // 参照（既定）。参照できるアイテムなら参照で足す。参照できなければ、画面と同じくコピーで足し、
  // 結果に fellBackToCopy を付けて知らせる（--dry-run も同じ形を返す）
  const mainId = entry.item.id;
  const refable = !copy && !!mainId && (await ctx.store.canRef(mainId));
  let fellBackToCopy = !copy && !refable;
  if (refable && mainId) {
    const location = [workspaceName(place.workspaceId, s), ...groupPath(place.groupId, s)];
    if (dryRun) {
      return {
        dryRun: true,
        item: {
          id: null,
          type: 'ref',
          refItemId: mainId,
          displayName: name?.trim() ?? source.displayName,
          location,
        },
        from: source,
      };
    }
    const added = await ctx.store.addRef(mainId, place.groupId, place.workspaceId);
    if (added) {
      if (name) await ctx.store.updateDisplayName(added.id, name.trim());
      if (position !== undefined) {
        await placeAt(ctx.store, added.id, place.workspaceId, place.groupId, position);
      }
      const after = await snapshot(ctx.store);
      const item = after.items.find((i) => i.id === added.id) ?? added;
      ctx.changed(mainI18n.t('cli.changed.workspaceItemAdded', { name: item.displayName }));
      return { ...itemView(item, after), from: source };
    }
    // 調べてから足すまでの間に参照できなくなった
    fellBackToCopy = true;
  }
  const fellBack = fellBackToCopy ? { fellBackToCopy: true } : {};
  if (dryRun) {
    return {
      dryRun: true,
      item: {
        ...appItemToWorkspaceItemBody(renamed),
        id: null,
        location: [workspaceName(place.workspaceId, s), ...groupPath(place.groupId, s)],
      },
      from: source,
      ...fellBack,
    };
  }

  // 画面と同じく、複製できなければ元の参照のまま足す
  const copiedRef = isClipboardItem(renamed)
    ? ctx.duplicateClipboardData(renamed.clipboardDataRef)
    : null;
  const toAdd = copiedRef ? ({ ...renamed, clipboardDataRef: copiedRef } as AppItem) : renamed;
  const added = await ctx.store.addItem(toAdd, place.groupId, place.workspaceId);
  if (position !== undefined) {
    await placeAt(ctx.store, added.id, place.workspaceId, place.groupId, position);
  }
  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === added.id) ?? added;
  ctx.changed(mainI18n.t('cli.changed.workspaceItemAdded', { name: item.displayName }));
  return { ...itemView(item, after), from: source, ...fellBack };
}

/**
 * テキストだけのクリップボードアイテムを足す（画面の「テキストを書く」と同じ）。本文は --text か --text-file
 */
async function addClipboardItem(
  parsed: ParsedArgs,
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const name = optionString(parsed, 'name');
  if (!name) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  for (const option of ['path', 'args']) {
    if (optionString(parsed, option) !== undefined) {
      throw new CliError('usage', mainI18n.t('cli.errors.clipboardOption', { option }));
    }
  }
  const text = readTextOption(
    optionString(parsed, 'text'),
    optionString(parsed, 'text-file'),
    ctx.cwd
  );
  if (text === undefined) throw new CliError('usage', mainI18n.t('cli.errors.needText'));
  const position = optionInt(parsed, 'position');
  const dryRun = optionFlag(parsed, 'dry-run');
  const { merged, setKeys } = applyPatch(
    {
      id: 'CliCheck',
      type: 'clipboard',
      ...previewClipboardText(text),
      dataFileRef: CHECK_DATA_REF,
    },
    { displayName: name, memo: optionString(parsed, 'memo') },
    parsed
  );
  // 検証が通ってから実データを保存する（断ったときに実データのファイルを残さない）
  const checked = validateAsDataItem(merged, setKeys) as JsonClipboardItem;

  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const place = resolvePlace(s, optionString(parsed, 'workspace'), optionString(parsed, 'group'));
  const location = [workspaceName(place.workspaceId, s), ...groupPath(place.groupId, s)];
  if (dryRun) {
    return { dryRun: true, item: { ...checked, id: null, dataFileRef: null, location } };
  }

  const saved = ctx.clipboard.save(text);
  const added = await ctx.store.addItem(
    {
      type: 'clipboard',
      displayName: checked.displayName,
      clipboardDataRef: saved.dataFileRef,
      savedAt: saved.savedAt,
      preview: saved.preview,
      formats: saved.formats,
      ...(checked.memo ? { memo: checked.memo } : {}),
      ...(checked.customIcon ? { customIcon: checked.customIcon } : {}),
    } as AppItem,
    place.groupId,
    place.workspaceId
  );
  if (position !== undefined) {
    await placeAt(ctx.store, added.id, place.workspaceId, place.groupId, position);
  }
  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === added.id) ?? added;
  ctx.changed(mainI18n.t('cli.changed.workspaceItemAdded', { name: item.displayName }));
  return itemView(item, after);
}

async function updateItem(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['name', 'path', 'args', 'memo', 'group', 'workspace', 'position', 'text', 'text-file'],
    flags: ['dry-run'],
    allowSet: true,
  });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const text = readTextOption(
    optionString(parsed, 'text'),
    optionString(parsed, 'text-file'),
    ctx.cwd
  );
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const current = findItem(key, s);
  if (current.ref) {
    return updateRefItem(parsed, current as WorkspaceItem & { ref: WorkspaceRefInfo }, s, ctx);
  }
  if (text !== undefined && current.type !== 'clipboard') {
    throw new CliError('usage', mainI18n.t('cli.errors.textOnlyClipboard'));
  }
  if (current.type === 'clipboard') {
    for (const option of ['path', 'args']) {
      if (optionString(parsed, option) !== undefined) {
        throw new CliError('usage', mainI18n.t('cli.errors.clipboardOption', { option }));
      }
    }
    // 画像・HTML・RTF を含むものは、本文を書き換えると中身が欠けるので断る（名前・メモ・移動はできる）
    if (text !== undefined && !isTextOnlyClipboard(current.formats)) {
      throw new CliError(
        'conflict',
        mainI18n.t('cli.errors.clipboardNotText', { formats: current.formats.join(', ') })
      );
    }
  }

  const rawPath = optionString(parsed, 'path');
  let itemPath: string | undefined;
  if (rawPath !== undefined) {
    if (current.type !== 'item')
      throw new CliError('usage', mainI18n.t('cli.errors.noPath', { type: current.type }));
    itemPath = await ctx.markFolder(resolveCliPath(rawPath, ctx.cwd));
  }
  const fields = {
    displayName: optionString(parsed, 'name'),
    path: itemPath,
    args: optionString(parsed, 'args'),
    memo: optionString(parsed, 'memo'),
    // 本文を変えたら、実データは新しいファイルに保存して参照を差し替える（画面と同じ）
    ...(text !== undefined ? previewClipboardText(text) : {}),
  };
  const groupKey = optionString(parsed, 'group');
  const workspaceKey = optionString(parsed, 'workspace');
  const position = optionInt(parsed, 'position');
  const changesBody =
    Object.values(fields).some((v) => v !== undefined) ||
    parsed.sets.length > 0 ||
    parsed.unsets.length > 0;
  if (
    !changesBody &&
    groupKey === undefined &&
    workspaceKey === undefined &&
    position === undefined
  ) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.needChanges', {
        options:
          '--name --path --args --memo --text --text-file --set --unset --group --workspace --position',
      })
    );
  }

  // 本文: 実行時の情報と所属・並び順を除いた今の内容に当て、データファイルと同じ規則で検証する
  const {
    icon: _icon,
    launcherType: _lt,
    id,
    order: _order,
    addedAt: _addedAt,
    groupId: _g,
    workspaceId: _w,
    ...body
  } = current as WorkspaceItem & { icon?: string; launcherType?: string };
  void _icon;
  void _lt;
  void _order;
  void _addedAt;
  void _g;
  void _w;
  const { merged, setKeys } = applyPatch(body as Record<string, unknown>, fields, parsed);
  if (current.type === 'set') {
    if (fields.path !== undefined || fields.args !== undefined) {
      throw new CliError('usage', mainI18n.t('cli.errors.setNoPathArgs'));
    }
    // 行の itemId はワークスペースのアイテムも指せるので、ここでは実在までは確かめない
    if (setKeys.includes('entries')) checkCliSetEntries(merged.entries);
  }
  validateAsDataItem({ ...merged, id: 'CliCheck' }, setKeys);
  if (text !== undefined && !dryRun) Object.assign(merged, ctx.clipboard.save(text));

  const place = resolveUpdatePlace(s, current, workspaceKey, groupKey);

  const before = itemView(current, s);
  if (dryRun) {
    return {
      dryRun: true,
      before,
      item: {
        ...merged,
        id,
        location: [workspaceName(place.workspaceId, s), ...groupPath(place.groupId, s)],
      },
    };
  }

  if (changesBody) await ctx.store.updateItem(id, merged as unknown as WorkspaceItemUpdate);
  if (place.workspaceId !== current.workspaceId) {
    await ctx.store.moveItemToWorkspace(id, place.workspaceId, place.groupId);
  } else if (place.groupId !== undefined && place.groupId !== current.groupId) {
    await ctx.store.moveItemToGroup(id, place.groupId);
  }
  if (position !== undefined)
    await placeAt(ctx.store, id, place.workspaceId, place.groupId, position);

  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === id) ?? current;
  ctx.changed(mainI18n.t('cli.changed.workspaceItemUpdated', { name: item.displayName }));
  return { before, item: itemView(item, after) };
}

/**
 * 参照アイテムを変える。中身（パス・メモなど）はメインウィンドウのアイテムのものなので、変えられるのは
 * ワークスペースでの表示名（--name。"" でメインウィンドウの表示名に戻す）と置き場所だけ
 */
async function updateRefItem(
  parsed: ParsedArgs,
  current: WorkspaceItem & { ref: WorkspaceRefInfo },
  s: Snapshot,
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  for (const option of ['path', 'args', 'memo', 'text', 'text-file']) {
    if (optionString(parsed, option) !== undefined) {
      throw new CliError(
        'conflict',
        mainI18n.t('cli.errors.refBody', { option, id: current.ref.itemId })
      );
    }
  }
  if (parsed.sets.length > 0 || parsed.unsets.length > 0) {
    throw new CliError(
      'conflict',
      mainI18n.t('cli.errors.refBody', { option: 'set', id: current.ref.itemId })
    );
  }
  const name = optionString(parsed, 'name');
  const groupKey = optionString(parsed, 'group');
  const workspaceKey = optionString(parsed, 'workspace');
  const position = optionInt(parsed, 'position');
  if (
    name === undefined &&
    groupKey === undefined &&
    workspaceKey === undefined &&
    position === undefined
  ) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.needChanges', { options: '--name --group --workspace --position' })
    );
  }
  const place = resolveUpdatePlace(s, current, workspaceKey, groupKey);

  const before = itemView(current, s);
  if (optionFlag(parsed, 'dry-run')) {
    return {
      dryRun: true,
      before,
      item: {
        ...before,
        ...(name !== undefined && {
          displayName: name.trim() || current.ref.mainDisplayName || current.displayName,
        }),
        location: [workspaceName(place.workspaceId, s), ...groupPath(place.groupId, s)],
      },
    };
  }
  const id = current.id;
  if (name !== undefined) await ctx.store.updateDisplayName(id, name);
  if (place.workspaceId !== current.workspaceId) {
    await ctx.store.moveItemToWorkspace(id, place.workspaceId, place.groupId);
  } else if (place.groupId !== undefined && place.groupId !== current.groupId) {
    await ctx.store.moveItemToGroup(id, place.groupId);
  }
  if (position !== undefined)
    await placeAt(ctx.store, id, place.workspaceId, place.groupId, position);
  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === id) ?? current;
  ctx.changed(mainI18n.t('cli.changed.workspaceItemUpdated', { name: item.displayName }));
  return { before, item: itemView(item, after) };
}

/**
 * 参照とコピーを行き来する（--to copy | ref）。参照にするときの指す先は --from（id か表示名）。
 * 省略すると、パスと引数が同じメインウィンドウのアイテムが 1 件だけあればそれ
 */
async function convertItem(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['to', 'from'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const to = optionString(parsed, 'to');
  if (to !== 'copy' && to !== 'ref') {
    throw new CliError('usage', mainI18n.t('cli.errors.convertTo', { to: to ?? '' }));
  }
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const current = findItem(key, s);
  const before = itemView(current, s);

  if (to === 'copy') {
    if (!current.ref) throw new CliError('conflict', mainI18n.t('cli.errors.notRef'));
    if (current.ref.status !== 'ok')
      throw new CliError('conflict', mainI18n.t('cli.errors.refMissing'));
    if (dryRun) return { dryRun: true, before, to };
    const converted = await ctx.store.convertToCopy(current.id);
    const after = await snapshot(ctx.store);
    const item = after.items.find((i) => i.id === current.id) ?? converted;
    ctx.changed(mainI18n.t('workspace.ref.convertedToCopy', { name: item.displayName }));
    return { before, item: itemView(item, after) };
  }

  const from = optionString(parsed, 'from');
  let mainId: string;
  if (from !== undefined) {
    const entry = await findLauncherEntry(from, ctx.launcher);
    if (entry.item.type === 'wsgroup') {
      throw new CliError('conflict', mainI18n.t('cli.errors.fromWsGroup', { name: from }));
    }
    if (!entry.item.id || entry.item.type === 'dir') {
      throw new CliError('conflict', mainI18n.t('cli.errors.fromDir', { name: from }));
    }
    mainId = entry.item.id;
  } else {
    const candidates = await ctx.store.findLinkCandidates(current.id);
    if (candidates.length !== 1) {
      throw new CliError(
        candidates.length === 0 ? 'not_found' : 'ambiguous',
        mainI18n.t('cli.errors.noLinkCandidate', { count: candidates.length })
      );
    }
    mainId = candidates[0];
  }
  if (dryRun) return { dryRun: true, before, to, refItemId: mainId };
  const linked = await ctx.store.linkToMain(current.id, mainId);
  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === current.id) ?? linked;
  ctx.changed(mainI18n.t('workspace.ref.linked', { name: item.displayName }));
  return { before, item: itemView(item, after) };
}

/**
 * コピーをメインウィンドウへ移し、ワークスペース側を参照に変える（画面の「🚀 メインウィンドウへ移して参照にする」と同じ）。
 * 移す先は --file か --tab（無ければ既定のデータファイル）。参照・元が見つからない参照は conflict
 */
async function moveItemToMain(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['file', 'tab'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const file = await resolveTargetFile(
    { store: ctx.launcher },
    optionString(parsed, 'file'),
    optionString(parsed, 'tab')
  );
  const s = await snapshot(ctx.store);
  const current = findItem(key, s);
  if (current.type === 'ref' || current.ref) {
    throw new CliError('conflict', mainI18n.t('cli.errors.alreadyInMain'));
  }
  const before = itemView(current, s);
  if (dryRun) return { dryRun: true, before, file };

  const result = await ctx.store.moveToMain(current.id, file);
  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === current.id) ?? result.item;
  const name = item.displayName;
  const tab = result.tabName;
  ctx.changed(
    result.reused
      ? tab !== undefined
        ? mainI18n.t('workspace.ref.linkedToSameInMain', { name, tab })
        : mainI18n.t('workspace.ref.linkedToSameInMainNoTab', { name })
      : tab !== undefined
        ? mainI18n.t('workspace.ref.movedToMain', { name, tab })
        : mainI18n.t('workspace.ref.movedToMainNoTab', { name })
  );
  return { before, item: itemView(item, after), file: result.file, reused: result.reused };
}

async function removeItem(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const item = findItem(key, s);
  const removed = itemView(item, s);
  if (dryRun) return { dryRun: true, removed };
  await ctx.store.removeItem(item.id);
  ctx.changed(mainI18n.t('cli.changed.workspaceItemRemoved', { name: item.displayName }));
  return { removed };
}

async function listGroups(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['workspace', 'grep'] });
  expectPositionals(parsed, []);
  const s = await snapshot(ctx.store);
  const workspaceKey = optionString(parsed, 'workspace');
  const workspace = workspaceKey ? findWorkspace(workspaceKey, s) : undefined;
  const grep = optionString(parsed, 'grep');
  return s.groups
    .filter((g) => !workspace || g.workspaceId === workspace.id)
    .filter((g) => matchesGrep(grep, [g.displayName]))
    .map((g) => groupView(g, s));
}

function checkColor(color: string | undefined): void {
  if (color !== undefined && !isValidGroupColor(color)) {
    throw new CliError('invalid', mainI18n.t('cli.errors.badColor', { color }));
  }
}

async function addGroup(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['name', 'color', 'parent', 'workspace'],
    flags: ['dry-run'],
  });
  expectPositionals(parsed, []);
  const name = optionString(parsed, 'name');
  if (!name?.trim()) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  const color = optionString(parsed, 'color');
  checkColor(color);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const workspaceKey = optionString(parsed, 'workspace');
  const workspace = workspaceKey ? findWorkspace(workspaceKey, s) : undefined;
  const parentKey = optionString(parsed, 'parent');
  const parent = parentKey ? findGroup(parentKey, s, workspace?.id) : undefined;
  const workspaceId = parent?.workspaceId ?? workspace?.id ?? defaultWorkspace(s).id;
  if (dryRun) {
    return {
      dryRun: true,
      group: {
        id: null,
        displayName: name,
        color: color ?? null,
        location: [workspaceName(workspaceId, s), ...groupPath(parent?.id, s), name],
      },
    };
  }
  let created: WorkspaceGroupView;
  try {
    created = await ctx.store.createGroup(name, color, parent?.id, workspaceId);
  } catch (error) {
    // 深さの超過など
    throw new CliError('invalid', (error as Error).message);
  }
  ctx.changed(mainI18n.t('cli.changed.groupAdded', { name }));
  const after = await snapshot(ctx.store);
  return groupView(after.groups.find((g) => g.id === created.id) ?? created, after);
}

async function updateGroup(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['name', 'color', 'parent'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrGroupName')]);
  const name = optionString(parsed, 'name');
  const color = optionString(parsed, 'color');
  const parentKey = optionString(parsed, 'parent');
  if (name === undefined && color === undefined && parentKey === undefined) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.needChanges', { options: '--name --color --parent' })
    );
  }
  if (name !== undefined && !name.trim())
    throw new CliError('usage', mainI18n.t('cli.errors.emptyName'));
  checkColor(color);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const group = findGroup(key, s);
  const updates: WorkspaceGroupUpdate = {};
  if (name !== undefined) updates.displayName = name;
  if (color !== undefined) updates.color = color;
  if (parentKey !== undefined) {
    updates.parentGroupId =
      parentKey === '' ? undefined : findGroup(parentKey, s, group.workspaceId).id;
  }
  const before = groupView(group, s);
  if (dryRun) return { dryRun: true, before, changes: updates };
  try {
    await ctx.store.updateGroup(group.id, updates);
  } catch (error) {
    // 循環・深さの超過など
    throw new CliError('invalid', (error as Error).message);
  }
  ctx.changed(mainI18n.t('cli.changed.groupUpdated', { name: name ?? group.displayName }));
  const after = await snapshot(ctx.store);
  return { before, group: groupView(after.groups.find((g) => g.id === group.id) ?? group, after) };
}

async function removeGroup(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrGroupName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const group = findGroup(key, s);
  const view = groupView(group, s);
  if ((view.itemCount as number) > 0 || (view.subgroupCount as number) > 0) {
    throw new CliError(
      'conflict',
      mainI18n.t('cli.errors.groupNotEmpty', {
        name: group.displayName,
        items: String(view.itemCount),
        subgroups: String(view.subgroupCount),
      })
    );
  }
  if (dryRun) return { dryRun: true, removed: view };
  await ctx.beforeGroupRemoved(group.id);
  await ctx.store.deleteGroup(group.id);
  ctx.changed(mainI18n.t('cli.changed.groupRemoved', { name: group.displayName }));
  return { removed: view };
}

async function archiveGroup(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrGroupName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const group = findGroup(key, s);
  // サブグループの中身も一緒にしまうので、件数は子孫まで数える
  const ids = new Set([group.id, ...getDescendantGroupIds(group.id, s.groups)]);
  const archived = {
    ...groupView(group, s),
    itemCount: s.items.filter((i) => i.groupId && ids.has(i.groupId)).length,
    subgroupCount: ids.size - 1,
  };
  if (dryRun) return { dryRun: true, archived };
  // 画面と同じく、先に切り離しウィンドウを閉じる
  await ctx.beforeGroupRemoved(group.id);
  await ctx.store.archiveGroup(group.id);
  ctx.changed(mainI18n.t('cli.changed.groupArchived', { name: group.displayName }));
  return { archived };
}

interface ArchiveSnapshot {
  groups: ArchivedWorkspaceGroup[];
  items: ArchivedWorkspaceItem[];
  workspaces: Workspace[];
}

async function archiveSnapshot(store: WorkspaceStore): Promise<ArchiveSnapshot> {
  const [groups, items, workspaces] = await Promise.all([
    store.loadArchivedGroups(),
    store.loadArchivedItems(),
    store.loadWorkspaces(),
  ]);
  return { groups, items, workspaces };
}

/** アーカイブの単位（一緒にしまったサブグループを除く最上位のグループ） */
function archiveRoots(a: ArchiveSnapshot): ArchivedWorkspaceGroup[] {
  const ids = new Set(a.groups.map((g) => g.id));
  return a.groups.filter((g) => !g.parentGroupId || !ids.has(g.parentGroupId));
}

function archivedView(group: ArchivedWorkspaceGroup, a: ArchiveSnapshot): Record<string, unknown> {
  const ids = new Set([group.id, ...getDescendantGroupIds(group.id, a.groups)]);
  return {
    id: group.id,
    displayName: group.displayName,
    color: group.color,
    archivedAt: new Date(group.archivedAt).toISOString(),
    // 元のワークスペース（消えていれば null。復元すると既定のワークスペースへ戻る）
    workspace: a.workspaces.find((w) => w.id === group.workspaceId)?.displayName ?? null,
    itemCount: a.items.filter((i) => ids.has(i.archivedGroupId)).length,
    subgroups: a.groups.filter((g) => g.id !== group.id && ids.has(g.id)).map((g) => g.displayName),
  };
}

async function listArchive(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['grep'] });
  expectPositionals(parsed, []);
  const a = await archiveSnapshot(ctx.store);
  const grep = optionString(parsed, 'grep');
  return archiveRoots(a)
    .filter((g) => matchesGrep(grep, [g.displayName]))
    .map((g) => archivedView(g, a));
}

async function restoreArchive(
  args: readonly string[],
  ctx: WorkspaceCommandContext
): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['workspace'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrGroupName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const a = await archiveSnapshot(ctx.store);
  const group = resolveOne(
    key,
    archiveRoots(a),
    mainI18n.t('cli.targets.archivedGroup'),
    (g) => g.id,
    (g) => g.displayName,
    (g): CliCandidate => ({ id: g.id, displayName: g.displayName, location: [] })
  );
  const s = await snapshot(ctx.store);
  const workspaceKey = optionString(parsed, 'workspace');
  // 省略時は元のワークスペース。無くなっていれば既定のワークスペース
  const target = workspaceKey
    ? findWorkspace(workspaceKey, s)
    : (s.workspaces.find((w) => w.id === group.workspaceId) ?? defaultWorkspace(s));
  const before = archivedView(group, a);
  if (dryRun) return { dryRun: true, restoring: before, workspace: target.displayName };

  await ctx.store.moveGroupToWorkspace(group.id, target.id);
  ctx.changed(
    mainI18n.t('cli.changed.groupRestored', {
      name: group.displayName,
      workspace: target.displayName,
    })
  );
  const after = await snapshot(ctx.store);
  const restored = after.groups.find((g) => g.id === group.id);
  return { restored: restored ? groupView(restored, after) : before };
}
