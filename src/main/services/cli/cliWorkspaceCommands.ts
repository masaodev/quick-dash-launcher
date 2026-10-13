import type {
  AppItem,
  MixedOrderEntry,
  Workspace,
  WorkspaceGroupUpdate,
  WorkspaceGroupView,
  WorkspaceItem,
  WorkspaceItemUpdate,
} from '@common/types';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { isValidGroupColor } from '@common/groupColors';

import { mainI18n } from '../mainI18n.js';

import {
  CliError,
  expectPositionals,
  optionFlag,
  optionInt,
  optionString,
  parseArgs,
} from './cliArgs.js';
import type { CliCandidate } from './cliArgs.js';
import {
  applyPatch,
  matchesGrep,
  resolveCliPath,
  resolveOne,
  validateAsDataItem,
} from './cliShared.js';

/**
 * qdl workspace … — ワークスペース（workspace.json）のワークスペース・グループ・アイテム
 */

/** WorkspaceService のうち CLI が使うもの（テストでは差し替える） */
export interface WorkspaceStore {
  loadWorkspaces(): Promise<Workspace[]>;
  loadGroups(): Promise<WorkspaceGroupView[]>;
  loadItems(): Promise<WorkspaceItem[]>;
  addItem(item: AppItem, groupId?: string, workspaceId?: string): Promise<WorkspaceItem>;
  updateItem(id: string, update: WorkspaceItemUpdate): Promise<void>;
  removeItem(id: string): Promise<void>;
  moveItemToGroup(itemId: string, groupId?: string): Promise<void>;
  moveItemToWorkspace(itemId: string, workspaceId: string): Promise<void>;
  reorderMixed(parentGroupId: string | undefined, entries: MixedOrderEntry[]): Promise<void>;
  createGroup(
    name: string,
    color?: string,
    parentGroupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceGroupView>;
  updateGroup(id: string, updates: WorkspaceGroupUpdate): Promise<void>;
  deleteGroup(id: string, deleteItems: boolean): Promise<void>;
}

export interface WorkspaceCommandContext {
  store: WorkspaceStore;
  cwd: string;
  markFolder(path: string): Promise<string>;
  syncBeforeWrite(): Promise<void>;
  changed(message: string): void;
  /** グループを消す前に、そのグループの切り離しウィンドウを閉じる */
  beforeGroupRemoved(groupId: string): Promise<void>;
}

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
 */
function resolvePlace(
  s: Snapshot,
  workspaceKey: string | undefined,
  groupKey: string | undefined
): { workspaceId: string; groupId?: string } {
  const workspace = workspaceKey ? findWorkspace(workspaceKey, s) : undefined;
  if (groupKey === undefined || groupKey === '') {
    return { workspaceId: (workspace ?? defaultWorkspace(s)).id };
  }
  const group = findGroup(groupKey, s, workspace?.id);
  return { workspaceId: group.workspaceId, groupId: group.id };
}

/**
 * 同じ親の中で position 番目（0 始まり）に置く。グループの中はサブグループとアイテムが同じ並びで、
 * 未分類（グループ外）はアイテムだけの並び（画面の表示と同じ）
 */
async function placeAt(
  store: WorkspaceStore,
  itemId: string,
  workspaceId: string,
  groupId: string | undefined,
  position: number
): Promise<void> {
  const s = await snapshot(store);
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
  if (noun === 'list') {
    const parsed = parseArgs(verb === undefined ? args : [verb, ...args], {});
    expectPositionals(parsed, []);
    const s = await snapshot(ctx.store);
    return [...s.workspaces]
      .sort((a, b) => a.order - b.order)
      .map((w) => ({
        id: w.id,
        displayName: w.displayName,
        order: w.order,
        groupCount: s.groups.filter((g) => g.workspaceId === w.id).length,
        itemCount: s.items.filter((i) => i.workspaceId === w.id).length,
      }));
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
    }
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

async function listItems(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['workspace', 'group', 'grep'] });
  expectPositionals(parsed, []);
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
    .map((i) => itemView(i, s));
}

async function addItem(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['name', 'path', 'args', 'memo', 'group', 'workspace', 'position'],
    flags: ['dry-run'],
    allowSet: true,
  });
  expectPositionals(parsed, []);
  const name = optionString(parsed, 'name');
  const rawPath = optionString(parsed, 'path');
  if (!name) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  if (!rawPath) throw new CliError('usage', mainI18n.t('cli.errors.needPath'));
  const position = optionInt(parsed, 'position');
  const dryRun = optionFlag(parsed, 'dry-run');

  const itemPath = await ctx.markFolder(resolveCliPath(rawPath, ctx.cwd));
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

async function updateItem(args: readonly string[], ctx: WorkspaceCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['name', 'path', 'args', 'memo', 'group', 'workspace', 'position'],
    flags: ['dry-run'],
    allowSet: true,
  });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const current = findItem(key, s);
  if (current.type === 'clipboard' || current.type === 'layout') {
    throw new CliError('invalid', mainI18n.t('cli.errors.typeNotEditable', { type: current.type }));
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
        options: '--name --path --args --memo --set --unset --group --workspace --position',
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
  validateAsDataItem({ ...merged, id: 'CliCheck' }, setKeys);

  const place =
    groupKey !== undefined || workspaceKey !== undefined
      ? resolvePlace(s, workspaceKey ?? (groupKey ? undefined : current.workspaceId), groupKey)
      : { workspaceId: current.workspaceId, groupId: current.groupId };
  if (workspaceKey !== undefined && groupKey === undefined) {
    // ワークスペースだけ変えたら、移った先では未分類になる
    place.groupId = undefined;
  }

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
  if (place.workspaceId !== current.workspaceId)
    await ctx.store.moveItemToWorkspace(id, place.workspaceId);
  if (place.groupId !== (place.workspaceId !== current.workspaceId ? undefined : current.groupId)) {
    await ctx.store.moveItemToGroup(id, place.groupId);
  }
  if (position !== undefined)
    await placeAt(ctx.store, id, place.workspaceId, place.groupId, position);

  const after = await snapshot(ctx.store);
  const item = after.items.find((i) => i.id === id) ?? current;
  ctx.changed(mainI18n.t('cli.changed.workspaceItemUpdated', { name: item.displayName }));
  return { before, item: itemView(item, after) };
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
  await ctx.store.deleteGroup(group.id, false);
  ctx.changed(mainI18n.t('cli.changed.groupRemoved', { name: group.displayName }));
  return { removed: view };
}
