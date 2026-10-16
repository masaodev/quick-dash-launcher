import type { DataFileTab, JsonItem, JsonSetItem, SetEntry } from '@common/types';

import { mainI18n } from '../mainI18n.js';

import {
  CliError,
  expectPositionals,
  optionFlag,
  optionInt,
  optionString,
  parseArgs,
} from './cliArgs.js';
import type { ParsedArgs } from './cliArgs.js';
import type { LauncherCommandContext, LauncherEntry } from './cliLauncherCommands.js';
import { resolveCliPath, resolveOne, validateAsDataItem } from './cliShared.js';

/**
 * qdl launcher set row … — メイン画面のセットの行
 *
 * 行に入れられるのは、開くもの（登録済みのアイテムか、パス）だけ。
 * 動かすウィンドウと位置は、画面の「ウィンドウを追加」「位置を更新」で付ける（CLI からは付けない）。
 */

/** セットの行から指せる種類（実行で開けるもの） */
const ENTRY_ITEM_TYPES = ['item', 'window'] as const;

function nameOf(item: JsonItem): string {
  return 'displayName' in item && item.displayName ? item.displayName : item.id;
}

function lastSegment(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

function tabOf(file: string, tabs: DataFileTab[]): string | null {
  return tabs.find((t) => t.files.includes(file))?.name ?? null;
}

/** 行の名前（アイテムの表示名 → 行の名前 → パスの最後 → ウィンドウのタイトル・exe 名） */
function entryName(entry: SetEntry, byId: Map<string, JsonItem>): string {
  const item = entry.itemId ? byId.get(entry.itemId) : undefined;
  if (item) return nameOf(item);
  if (entry.label) return entry.label;
  if (entry.open) return lastSegment(entry.open.path);
  return entry.window?.title ?? entry.window?.processName ?? entry.itemId ?? '';
}

function entryView(
  entry: SetEntry,
  index: number,
  byId: Map<string, JsonItem>
): Record<string, unknown> {
  const missing = entry.itemId !== undefined && !byId.has(entry.itemId);
  return {
    index,
    name: entryName(entry, byId),
    ...entry,
    ...(missing ? { missing: true } : {}),
  };
}

function indexById(entries: readonly LauncherEntry[]): Map<string, JsonItem> {
  return new Map(entries.map((e) => [e.item.id, e.item]));
}

function setResult(
  entry: LauncherEntry,
  set: JsonSetItem,
  all: readonly LauncherEntry[],
  tabs: DataFileTab[]
): Record<string, unknown> {
  const byId = indexById(all);
  return {
    set: {
      id: set.id,
      displayName: set.displayName,
      file: entry.file,
      tab: tabOf(entry.file, tabs),
    },
    entries: set.entries.map((e, i) => entryView(e, i, byId)),
  };
}

async function findSet(key: string, ctx: LauncherCommandContext): Promise<LauncherEntry> {
  const tabs = await ctx.store.tabs();
  const sets = (await ctx.store.load()).filter((e) => e.item.type === 'set');
  return resolveOne(
    key,
    sets,
    mainI18n.t('cli.targets.set'),
    (e) => e.item.id,
    (e) => nameOf(e.item),
    (e) => ({
      id: e.item.id,
      displayName: nameOf(e.item),
      location: [tabOf(e.file, tabs) ?? e.file],
    })
  );
}

/**
 * --item か --path（と --args）から行を作る。どちらも無ければ undefined
 *
 * セットの作成（launcher item add --type set）と行の追加で使う
 */
export async function entryFromOptions(
  parsed: ParsedArgs,
  ctx: LauncherCommandContext
): Promise<SetEntry | undefined> {
  const itemKey = optionString(parsed, 'item');
  const rawPath = optionString(parsed, 'path');
  const args = optionString(parsed, 'args');
  const label = optionString(parsed, 'label');
  if (itemKey !== undefined && rawPath !== undefined) {
    throw new CliError('usage', mainI18n.t('cli.errors.setItemAndPath'));
  }
  if (itemKey === undefined && rawPath === undefined) {
    if (args !== undefined || label !== undefined) {
      throw new CliError('usage', mainI18n.t('cli.errors.setNeedTarget'));
    }
    return undefined;
  }
  if (itemKey !== undefined) {
    if (args !== undefined) throw new CliError('usage', mainI18n.t('cli.errors.setArgsWithItem'));
    const tabs = await ctx.store.tabs();
    // 行にできる種類だけから探す（同じ名前のセットがあっても曖昧にしない）。id はどの種類でも当てて、種類の誤りを知らせる
    const all = await ctx.store.load();
    const byId = all.find((e) => e.item.id === itemKey);
    const target =
      byId ??
      resolveOne(
        itemKey,
        all.filter((e) => (ENTRY_ITEM_TYPES as readonly string[]).includes(e.item.type)),
        mainI18n.t('cli.targets.launcherItem'),
        (e) => e.item.id,
        (e) => nameOf(e.item),
        (e) => ({
          id: e.item.id,
          displayName: nameOf(e.item),
          location: [tabOf(e.file, tabs) ?? e.file],
        })
      );
    if (!(ENTRY_ITEM_TYPES as readonly string[]).includes(target.item.type)) {
      throw new CliError(
        'invalid',
        mainI18n.t('cli.errors.setItemType', {
          type: target.item.type,
          types: ENTRY_ITEM_TYPES.join(' / '),
        })
      );
    }
    return { itemId: target.item.id, ...(label ? { label } : {}) };
  }
  const path = await ctx.store.markFolder(resolveCliPath(rawPath as string, ctx.cwd));
  return {
    open: args ? { path, args } : { path },
    ...(label ? { label } : {}),
  };
}

/** 行に書けるキー（SetEntry） */
const SET_ENTRY_KEYS = new Set([
  'itemId',
  'open',
  'label',
  'window',
  'placement',
  'ifOpen',
  'activateWindow',
  'waitSeconds',
  'pinToAllDesktops',
]);

/**
 * --set entries=… で渡された行を確かめる（読み込みの検証は知らないキーを黙って捨て、空の行を通すため）
 *
 * @param all メイン画面のアイテム。渡すと itemId が実在し、行にできる種類かも確かめる（ワークスペースでは渡さない）
 */
export function checkCliSetEntries(raw: unknown, all?: readonly LauncherEntry[]): void {
  if (!Array.isArray(raw)) return;
  raw.forEach((row: unknown, index) => {
    if (typeof row !== 'object' || row === null) return;
    const record = row as Record<string, unknown>;
    const unknown = Object.keys(record).filter((key) => !SET_ENTRY_KEYS.has(key));
    if (unknown.length > 0) {
      throw new CliError(
        'invalid',
        mainI18n.t('cli.errors.setRowUnknownKeys', { index, keys: unknown.join(', ') })
      );
    }
    const open = record.open as { path?: unknown } | undefined;
    const window = record.window as { processName?: unknown; title?: unknown } | undefined;
    const hasTarget =
      (typeof record.itemId === 'string' && record.itemId !== '') ||
      (typeof open?.path === 'string' && open.path !== '') ||
      (typeof window?.processName === 'string' && window.processName !== '') ||
      (typeof window?.title === 'string' && window.title !== '');
    if (!hasTarget) {
      throw new CliError('invalid', mainI18n.t('cli.errors.setRowEmpty', { index }));
    }
    if (all && typeof record.itemId === 'string' && record.itemId !== '') {
      const target = all.find((e) => e.item.id === record.itemId);
      if (!target) {
        throw new CliError(
          'invalid',
          mainI18n.t('cli.errors.setRowItemNotFound', { index, id: record.itemId })
        );
      }
      if (!(ENTRY_ITEM_TYPES as readonly string[]).includes(target.item.type)) {
        throw new CliError(
          'invalid',
          mainI18n.t('cli.errors.setItemType', {
            type: target.item.type,
            types: ENTRY_ITEM_TYPES.join(' / '),
          })
        );
      }
    }
  });
}

export async function runLauncherSetCommand(
  noun: string | undefined,
  verb: string | undefined,
  args: readonly string[],
  ctx: LauncherCommandContext
): Promise<unknown> {
  if (noun !== 'row') {
    throw new CliError(
      'usage',
      noun
        ? mainI18n.t('cli.errors.unknownVerb', { command: `launcher set ${noun}` })
        : mainI18n.t('cli.errors.missingSetNoun')
    );
  }
  switch (verb) {
    case 'list':
      return list(args, ctx);
    case 'add':
      return add(args, ctx);
    case 'remove':
      return remove(args, ctx);
    default:
      throw new CliError(
        'usage',
        verb
          ? mainI18n.t('cli.errors.unknownVerb', { command: `launcher set row ${verb}` })
          : mainI18n.t('cli.errors.missingSetVerb')
      );
  }
}

async function list(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {});
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.setIdOrName')]);
  const found = await findSet(key, ctx);
  return setResult(
    found,
    found.item as JsonSetItem,
    await ctx.store.load(),
    await ctx.store.tabs()
  );
}

/** 変えたセットを検証して書き込む（--dry-run なら書き込まない） */
async function save(
  found: LauncherEntry,
  entries: SetEntry[],
  dryRun: boolean,
  message: string,
  ctx: LauncherCommandContext
): Promise<unknown> {
  const item = validateAsDataItem({ ...found.item, entries }, []) as JsonSetItem;
  item.updatedAt = Date.now();
  const result = setResult(
    { ...found, item },
    item,
    await ctx.store.load(),
    await ctx.store.tabs()
  );
  if (dryRun) return { dryRun: true, ...result };
  ctx.store.replace(item);
  ctx.changed(message);
  return result;
}

async function add(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['item', 'path', 'args', 'label', 'position'],
    flags: ['dry-run'],
  });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.setIdOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const found = await findSet(key, ctx);
  const entry = await entryFromOptions(parsed, ctx);
  if (!entry) throw new CliError('usage', mainI18n.t('cli.errors.setNeedTarget'));

  const current = (found.item as JsonSetItem).entries;
  const position = optionInt(parsed, 'position') ?? current.length;
  if (position < 0 || position > current.length) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.setBadPosition', { max: current.length, value: position })
    );
  }
  const entries = [...current.slice(0, position), entry, ...current.slice(position)];
  const name = entryName(entry, indexById(await ctx.store.load()));
  return save(
    found,
    entries,
    dryRun,
    mainI18n.t('cli.changed.setEntryAdded', { set: nameOf(found.item), name }),
    ctx
  );
}

async function remove(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key, rawIndex] = expectPositionals(parsed, [
    mainI18n.t('cli.args.setIdOrName'),
    mainI18n.t('cli.args.entryIndex'),
  ]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const found = await findSet(key, ctx);
  const current = (found.item as JsonSetItem).entries;
  const index = /^\d+$/.test(rawIndex) ? Number(rawIndex) : NaN;
  if (!(index >= 0 && index < current.length)) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.setBadIndex', { max: current.length - 1, value: rawIndex })
    );
  }
  if (current.length === 1) throw new CliError('conflict', mainI18n.t('cli.errors.setLastEntry'));
  const name = entryName(current[index], indexById(await ctx.store.load()));
  const entries = current.filter((_, i) => i !== index);
  return save(
    found,
    entries,
    dryRun,
    mainI18n.t('cli.changed.setEntryRemoved', { set: nameOf(found.item), name }),
    ctx
  );
}
