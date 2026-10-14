import { DEFAULT_DATA_FILE } from '@common/types';
import type { DataFileTab, JsonItem } from '@common/types';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { mainI18n } from '../mainI18n.js';

import { CliError, expectPositionals, optionFlag, optionString, parseArgs } from './cliArgs.js';
import type { CliCandidate, ParsedArgs } from './cliArgs.js';
import {
  applyPatch,
  matchesGrep,
  resolveCliPath,
  resolveOne,
  validateAsDataItem,
} from './cliShared.js';
import { entryFromOptions } from './cliSetCommands.js';

/**
 * qdl launcher item … — メイン画面のアイテム（datafiles/data*.json）
 */

export interface LauncherEntry {
  item: JsonItem;
  /** 設定フォルダからの相対パス（例: datafiles/data.json） */
  file: string;
  /** 読み込み時の検証で不正とされたか（不正でもファイル上には残っている） */
  invalid?: string;
}

/** メイン画面のアイテムの読み書き（本体の既存の処理を包む。テストでは差し替える） */
export interface LauncherStore {
  load(): Promise<LauncherEntry[]>;
  dataFiles(): string[];
  tabs(): Promise<DataFileTab[]>;
  append(file: string, item: JsonItem): void;
  replace(item: JsonItem): void;
  remove(id: string): Promise<void>;
  /** 見た目はファイルでも実体がフォルダなら、末尾に区切りを付ける（登録画面と同じ） */
  markFolder(path: string): Promise<string>;
  newId(used: Set<string>): string;
}

export interface LauncherCommandContext {
  store: LauncherStore;
  cwd: string;
  /** 書き込みの前に読み直す（外部変更の検知） */
  syncBeforeWrite(): Promise<void>;
  /** 書き込んだ後（画面への通知とトースト） */
  changed(message: string): void;
}

const EDITABLE_TYPES = ['item', 'dir', 'set', 'window'] as const;

function itemName(item: JsonItem): string {
  return 'displayName' in item && item.displayName
    ? item.displayName
    : 'path' in item
      ? item.path
      : item.id;
}

function tabOf(file: string, tabs: DataFileTab[]): string | null {
  return tabs.find((t) => t.files.includes(file))?.name ?? null;
}

function view(entry: LauncherEntry, tabs: DataFileTab[]): Record<string, unknown> {
  const { item } = entry;
  return {
    ...item,
    ...(item.type === 'item' ? { kind: detectItemTypeSync(item.path) } : {}),
    file: entry.file,
    tab: tabOf(entry.file, tabs),
    ...(entry.invalid ? { invalid: entry.invalid } : {}),
  };
}

function candidate(entry: LauncherEntry, tabs: DataFileTab[]): CliCandidate {
  return {
    id: entry.item.id,
    displayName: itemName(entry.item),
    location: [tabOf(entry.file, tabs) ?? entry.file],
  };
}

function normalizeFileName(name: string): string {
  const withDir =
    name.includes('/') || name.includes('\\') ? name.replace(/\\/g, '/') : `datafiles/${name}`;
  return withDir.endsWith('.json') ? withDir : `${withDir}.json`;
}

async function resolveTargetFile(
  ctx: LauncherCommandContext,
  file: string | undefined,
  tab: string | undefined
): Promise<string> {
  if (file && tab) throw new CliError('usage', mainI18n.t('cli.errors.fileAndTab'));
  const files = ctx.store.dataFiles();
  if (file) {
    const normalized = normalizeFileName(file);
    if (!files.includes(normalized)) {
      throw new CliError(
        'not_found',
        mainI18n.t('cli.errors.noDataFile', { file: normalized, files: files.join(', ') })
      );
    }
    return normalized;
  }
  if (tab) {
    const tabs = await ctx.store.tabs();
    const found = tabs.filter((t) => t.name === tab);
    if (found.length === 0) {
      throw new CliError(
        'not_found',
        mainI18n.t('cli.errors.noTab', { tab, tabs: tabs.map((x) => x.name).join(', ') })
      );
    }
    const target = found[0].files.find((f) => files.includes(f));
    if (!target) throw new CliError('not_found', mainI18n.t('cli.errors.tabHasNoFile', { tab }));
    return target;
  }
  return DEFAULT_DATA_FILE;
}

export async function runLauncherItemCommand(
  verb: string | undefined,
  args: readonly string[],
  ctx: LauncherCommandContext
): Promise<unknown> {
  switch (verb) {
    case 'list':
      return list(args, ctx);
    case 'add':
      return add(args, ctx);
    case 'update':
      return update(args, ctx);
    case 'remove':
      return remove(args, ctx);
    default:
      throw new CliError(
        'usage',
        verb
          ? mainI18n.t('cli.errors.unknownVerb', { command: `launcher item ${verb}` })
          : mainI18n.t('cli.errors.missingVerb')
      );
  }
}

async function list(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['file', 'tab', 'grep'] });
  expectPositionals(parsed, []);
  const file = optionString(parsed, 'file');
  const tab = optionString(parsed, 'tab');
  const tabs = await ctx.store.tabs();
  let entries = await ctx.store.load();
  if (file || tab) {
    if (file && tab) throw new CliError('usage', mainI18n.t('cli.errors.fileAndTab'));
    const files = file
      ? [normalizeFileName(file)]
      : tabs.filter((t) => t.name === tab).flatMap((t) => t.files);
    if (tab && files.length === 0)
      throw new CliError('not_found', mainI18n.t('cli.errors.noTabSimple', { tab }));
    entries = entries.filter((e) => files.includes(e.file));
  }
  const grep = optionString(parsed, 'grep');
  return entries.filter((e) => matchesGrep(grep, Object.values(e.item))).map((e) => view(e, tabs));
}

async function add(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['name', 'path', 'args', 'memo', 'file', 'tab', 'type', 'item', 'label'],
    flags: ['dry-run'],
    allowSet: true,
  });
  expectPositionals(parsed, []);
  const type = optionString(parsed, 'type') ?? 'item';
  if (!(EDITABLE_TYPES as readonly string[]).includes(type)) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.badType', { types: EDITABLE_TYPES.join(' / '), type })
    );
  }
  if (type === 'set') return addSet(parsed, ctx);
  if (optionString(parsed, 'item') !== undefined || optionString(parsed, 'label') !== undefined) {
    throw new CliError('usage', mainI18n.t('cli.errors.itemOnlySet'));
  }
  const name = optionString(parsed, 'name');
  const rawPath = optionString(parsed, 'path');
  if (type === 'dir' && name) throw new CliError('usage', mainI18n.t('cli.errors.dirHasNoName'));
  if (type !== 'dir' && !name) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  if ((type === 'item' || type === 'dir') && !rawPath)
    throw new CliError('usage', mainI18n.t('cli.errors.needPath'));
  if (type !== 'item' && optionString(parsed, 'args') !== undefined) {
    throw new CliError('usage', mainI18n.t('cli.errors.argsOnlyItem'));
  }

  let itemPath: string | undefined;
  if (rawPath !== undefined) {
    itemPath = resolveCliPath(rawPath, ctx.cwd);
    if (type === 'item') itemPath = await ctx.store.markFolder(itemPath);
  }

  const targetFile = await resolveTargetFile(
    ctx,
    optionString(parsed, 'file'),
    optionString(parsed, 'tab')
  );
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const entries = await ctx.store.load();
  const id = ctx.store.newId(new Set(entries.map((e) => e.item.id)));

  const { merged, setKeys } = applyPatch(
    { id, type },
    {
      displayName: name,
      path: itemPath,
      args: optionString(parsed, 'args'),
      memo: optionString(parsed, 'memo'),
    },
    parsed
  );
  const item = validateAsDataItem(merged, setKeys);
  item.updatedAt = Date.now();
  const result = view({ item, file: targetFile }, await ctx.store.tabs());
  if (dryRun) return { dryRun: true, item: result };

  ctx.store.append(targetFile, item);
  ctx.changed(mainI18n.t('cli.changed.launcherAdded', { name: itemName(item) }));
  return result;
}

/**
 * セットを足す。最初の行は --item か --path（--args）で渡す（--set entries='[…]' でもよい）。
 * 2 行目からは qdl launcher set entry add で足す
 */
async function addSet(parsed: ParsedArgs, ctx: LauncherCommandContext): Promise<unknown> {
  const name = optionString(parsed, 'name');
  if (!name) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  const first = await entryFromOptions(parsed, ctx);
  if (first && parsed.sets.some(([key]) => key === 'entries')) {
    throw new CliError('usage', mainI18n.t('cli.errors.setEntriesTwice'));
  }
  if (!first && !parsed.sets.some(([key]) => key === 'entries')) {
    throw new CliError('usage', mainI18n.t('cli.errors.setNeedFirstEntry'));
  }

  const targetFile = await resolveTargetFile(
    ctx,
    optionString(parsed, 'file'),
    optionString(parsed, 'tab')
  );
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const entries = await ctx.store.load();
  const id = ctx.store.newId(new Set(entries.map((e) => e.item.id)));

  const { merged, setKeys } = applyPatch(
    { id, type: 'set' },
    {
      displayName: name,
      memo: optionString(parsed, 'memo'),
      entries: first ? [first] : undefined,
    },
    parsed
  );
  const item = validateAsDataItem(merged, setKeys);
  item.updatedAt = Date.now();
  const result = view({ item, file: targetFile }, await ctx.store.tabs());
  if (dryRun) return { dryRun: true, item: result };

  ctx.store.append(targetFile, item);
  ctx.changed(mainI18n.t('cli.changed.launcherAdded', { name: itemName(item) }));
  return result;
}

async function findEntry(key: string, ctx: LauncherCommandContext): Promise<LauncherEntry> {
  const tabs = await ctx.store.tabs();
  return resolveOne(
    key,
    await ctx.store.load(),
    mainI18n.t('cli.targets.launcherItem'),
    (e) => e.item.id,
    (e) => itemName(e.item),
    (e) => candidate(e, tabs)
  );
}

async function update(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['name', 'path', 'args', 'memo'],
    flags: ['dry-run'],
    allowSet: true,
  });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const entry = await findEntry(key, ctx);
  const current = entry.item;
  if (!(EDITABLE_TYPES as readonly string[]).includes(current.type)) {
    throw new CliError('invalid', mainI18n.t('cli.errors.typeNotEditable', { type: current.type }));
  }

  const rawPath = optionString(parsed, 'path');
  let itemPath: string | undefined;
  if (rawPath !== undefined) {
    itemPath = resolveCliPath(rawPath, ctx.cwd);
    if (current.type === 'item') itemPath = await ctx.store.markFolder(itemPath);
  }
  const fields = {
    displayName: optionString(parsed, 'name'),
    path: itemPath,
    args: optionString(parsed, 'args'),
    memo: optionString(parsed, 'memo'),
  };
  if (
    Object.values(fields).every((v) => v === undefined) &&
    parsed.sets.length === 0 &&
    parsed.unsets.length === 0
  ) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.needChanges', { options: '--name --path --args --memo --set --unset' })
    );
  }
  const { merged, setKeys } = applyPatch(
    current as unknown as Record<string, unknown>,
    fields,
    parsed
  );
  const item = validateAsDataItem(merged, setKeys);
  item.updatedAt = Date.now();
  const tabs = await ctx.store.tabs();
  const result = { before: view(entry, tabs), item: view({ item, file: entry.file }, tabs) };
  if (dryRun) return { dryRun: true, ...result };

  ctx.store.replace(item);
  ctx.changed(mainI18n.t('cli.changed.launcherUpdated', { name: itemName(item) }));
  return result;
}

async function remove(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const entry = await findEntry(key, ctx);
  const removed = view(entry, await ctx.store.tabs());
  if (dryRun) return { dryRun: true, removed };

  await ctx.store.remove(entry.item.id);
  ctx.changed(mainI18n.t('cli.changed.launcherRemoved', { name: itemName(entry.item) }));
  return { removed };
}
