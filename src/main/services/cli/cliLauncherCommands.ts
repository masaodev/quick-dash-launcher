import { DEFAULT_DATA_FILE } from '@common/types';
import type { DataFileTab, JsonItem } from '@common/types';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { mainI18n } from '../mainI18n.js';

import { CliError, expectPositionals, optionFlag, optionString, parseArgs } from './cliArgs.js';
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
import { normalizeDataFileName as normalizeFileName } from './cliTabCommands.js';
import { checkCliSetEntries, entryFromOptions } from './cliSetCommands.js';

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
  /** id を保ったまま別のデータファイルへ移す（内容も item に差し替える） */
  move(item: JsonItem, from: string, to: string): void;
  remove(id: string): Promise<void>;
  /** そのアイテムを指すワークスペースの参照の数（削除の結果で知らせる。無ければ数えない） */
  countWorkspaceRefs?(id: string): Promise<number>;
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
  /** クリップボードアイテムの実データ（テキストだけ） */
  clipboard: ClipboardTextStore;
}

const EDITABLE_TYPES = ['item', 'dir', 'set'] as const;
/** 検証のためだけに入れる実データの参照（保存するまで本物の参照は決まらない） */
const CHECK_DATA_REF = 'clipboard-data/CliCheck.json';
/** CLI で足せる・変えられる種類（クリップボードはテキストだけ） */
const ADDABLE_TYPES = [...EDITABLE_TYPES, 'clipboard'] as const;

export function itemName(item: JsonItem): string {
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

/** 候補・写した元として示す形（id・表示名・タブ） */
export function launcherCandidate(entry: LauncherEntry, tabs: DataFileTab[]): CliCandidate {
  return {
    id: entry.item.id,
    displayName: itemName(entry.item),
    location: [tabOf(entry.file, tabs) ?? entry.file],
  };
}

/** --file・--tab から書き込む先のデータファイルを決める（どちらも無ければ既定のデータファイル） */
export async function resolveTargetFile(
  ctx: Pick<LauncherCommandContext, 'store'>,
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
  const parsed = parseArgs(args, { values: ['file', 'tab', 'grep'], flags: ['with-text'] });
  expectPositionals(parsed, []);
  const withText = optionFlag(parsed, 'with-text');
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
  return entries
    .filter((e) => matchesGrep(grep, Object.values(e.item)))
    .map((e) => {
      const v = view(e, tabs);
      // テキストだけのクリップボードアイテムは、求められたら本文も返す（書き換える前に読むため）
      if (withText && e.item.type === 'clipboard' && isTextOnlyClipboard(e.item.formats)) {
        v.text = ctx.clipboard.read(e.item.dataFileRef);
      }
      return v;
    });
}

async function add(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: [
      'name',
      'path',
      'args',
      'memo',
      'file',
      'tab',
      'type',
      'item',
      'label',
      'text',
      'text-file',
    ],
    flags: ['dry-run'],
    allowSet: true,
  });
  expectPositionals(parsed, []);
  const type = optionString(parsed, 'type') ?? 'item';
  // 廃止したウィンドウ操作は、パスの無い単一アイテムの作り方を案内する
  if (type === 'window') throw new CliError('usage', mainI18n.t('cli.errors.windowTypeRemoved'));
  if (!(ADDABLE_TYPES as readonly string[]).includes(type)) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.badType', { types: ADDABLE_TYPES.join(' / '), type })
    );
  }
  if (type === 'set') return addSet(parsed, ctx);
  if (type === 'clipboard') return addClipboard(parsed, ctx);
  if (
    optionString(parsed, 'text') !== undefined ||
    optionString(parsed, 'text-file') !== undefined
  ) {
    throw new CliError('usage', mainI18n.t('cli.errors.textOnlyClipboard'));
  }
  if (optionString(parsed, 'item') !== undefined || optionString(parsed, 'label') !== undefined) {
    throw new CliError('usage', mainI18n.t('cli.errors.itemOnlySet'));
  }
  const name = optionString(parsed, 'name');
  const rawPath = optionString(parsed, 'path');
  if (type === 'dir' && name) throw new CliError('usage', mainI18n.t('cli.errors.dirHasNoName'));
  if (type !== 'dir' && !name) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  if (type === 'dir' && !rawPath) throw new CliError('usage', mainI18n.t('cli.errors.needPath'));
  // 単一アイテムは、--set window=… で対象ウィンドウを渡せば --path が無くてもよい（パスの無い単一アイテム）
  const setsWindow = parsed.sets.some(([key]) => key === 'window' || key === 'windowConfig');
  if (type === 'item' && !rawPath && !setsWindow)
    throw new CliError('usage', mainI18n.t('cli.errors.needPathOrWindow'));
  if (type !== 'item' && optionString(parsed, 'args') !== undefined) {
    throw new CliError('usage', mainI18n.t('cli.errors.argsOnlyItem'));
  }

  let itemPath: string | undefined = type === 'item' ? '' : undefined;
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
 * 2 行目からは qdl launcher set row add で足す
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
  if (setKeys.includes('entries')) checkCliSetEntries(merged.entries, entries);
  const item = validateAsDataItem(merged, setKeys);
  item.updatedAt = Date.now();
  const result = view({ item, file: targetFile }, await ctx.store.tabs());
  if (dryRun) return { dryRun: true, item: result };

  ctx.store.append(targetFile, item);
  ctx.changed(mainI18n.t('cli.changed.launcherAdded', { name: itemName(item) }));
  return result;
}

/**
 * テキストだけのクリップボードアイテムを足す（画面の「テキストを書く」と同じ）。本文は --text か --text-file
 */
async function addClipboard(parsed: ParsedArgs, ctx: LauncherCommandContext): Promise<unknown> {
  const name = optionString(parsed, 'name');
  if (!name) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  for (const option of ['path', 'args', 'item', 'label']) {
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
    { id, type: 'clipboard', ...previewClipboardText(text), dataFileRef: CHECK_DATA_REF },
    { displayName: name, memo: optionString(parsed, 'memo') },
    parsed
  );
  // 検証が通ってから実データを保存する（断ったときに実データのファイルを残さない）
  const checked = validateAsDataItem(merged, setKeys);
  const tabs = await ctx.store.tabs();
  if (dryRun) {
    return {
      dryRun: true,
      item: { ...view({ item: checked, file: targetFile }, tabs), dataFileRef: null },
    };
  }
  const item = { ...checked, ...ctx.clipboard.save(text), updatedAt: Date.now() } as JsonItem;
  ctx.store.append(targetFile, item);
  ctx.changed(mainI18n.t('cli.changed.launcherAdded', { name: itemName(item) }));
  return view({ item, file: targetFile }, tabs);
}

/** メイン画面のアイテムを id か表示名の完全一致で 1 件に絞る（ワークスペースの --from でも使う） */
export async function findLauncherEntry(key: string, store: LauncherStore): Promise<LauncherEntry> {
  const tabs = await store.tabs();
  return resolveOne(
    key,
    await store.load(),
    mainI18n.t('cli.targets.launcherItem'),
    (e) => e.item.id,
    (e) => itemName(e.item),
    (e) => launcherCandidate(e, tabs)
  );
}

function findEntry(key: string, ctx: LauncherCommandContext): Promise<LauncherEntry> {
  return findLauncherEntry(key, ctx.store);
}

async function update(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, {
    values: ['name', 'path', 'args', 'memo', 'file', 'tab', 'text', 'text-file'],
    flags: ['dry-run'],
    allowSet: true,
  });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const text = readTextOption(
    optionString(parsed, 'text'),
    optionString(parsed, 'text-file'),
    ctx.cwd
  );
  const fileKey = optionString(parsed, 'file');
  const tabKey = optionString(parsed, 'tab');
  const moving = fileKey !== undefined || tabKey !== undefined;
  // 移す先は書き込みの前に決める（無いタブ・ファイルは何も読み直さずに断る）
  const targetFile = moving ? await resolveTargetFile(ctx, fileKey, tabKey) : undefined;
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const entry = await findEntry(key, ctx);
  const current = entry.item;
  if (!(ADDABLE_TYPES as readonly string[]).includes(current.type)) {
    throw new CliError('invalid', mainI18n.t('cli.errors.typeNotEditable', { type: current.type }));
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
  if (
    current.type === 'set' &&
    (rawPath !== undefined || optionString(parsed, 'args') !== undefined)
  ) {
    // 黙って捨てて「変更しました」と返さない
    throw new CliError('usage', mainI18n.t('cli.errors.setNoPathArgs'));
  }
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
    // 本文を変えたら、実データは新しいファイルに保存して参照を差し替える（画面と同じ）
    ...(text !== undefined ? previewClipboardText(text) : {}),
  };
  const changesBody =
    Object.values(fields).some((v) => v !== undefined) ||
    parsed.sets.length > 0 ||
    parsed.unsets.length > 0;
  if (!changesBody && !moving) {
    throw new CliError(
      'usage',
      mainI18n.t('cli.errors.needChanges', {
        options: '--name --path --args --memo --text --text-file --set --unset --file --tab',
      })
    );
  }
  // --tab は、そのタブのどれかのファイルに既にあれば移さない（タブが複数のファイルを持つとき）
  const alreadyThere =
    targetFile === entry.file ||
    (tabKey !== undefined &&
      (await ctx.store.tabs()).some((t) => t.name === tabKey && t.files.includes(entry.file)));
  const moveTo = targetFile !== undefined && !alreadyThere ? targetFile : undefined;
  if (moveTo && current.type === 'item' && current.autoImportRuleId) {
    // 取込は取り込み先のファイルの中だけで入れ替えるので、移すと次の取込で同じものがまた足される
    throw new CliError('conflict', mainI18n.t('cli.errors.autoImportedNotMovable'));
  }
  const { merged, setKeys } = applyPatch(
    current as unknown as Record<string, unknown>,
    fields,
    parsed
  );
  if (current.type === 'set' && setKeys.includes('entries')) {
    checkCliSetEntries(merged.entries, await ctx.store.load());
  }
  const tabs = await ctx.store.tabs();
  const before = view(entry, tabs);
  if (!changesBody && !moveTo) {
    // 今と同じタブ・ファイルを指定しただけ。書き込まず、変えていないことを返す
    return { ...(dryRun ? { dryRun: true } : {}), unchanged: true, before, item: before };
  }
  let item = validateAsDataItem(merged, setKeys);
  if (text !== undefined && !dryRun) item = { ...item, ...ctx.clipboard.save(text) } as JsonItem;
  item.updatedAt = Date.now();
  const file = moveTo ?? entry.file;
  const result = {
    before,
    item: view({ item, file }, tabs),
    ...(moveTo ? { moved: { from: entry.file, to: moveTo } } : {}),
  };
  if (dryRun) return { dryRun: true, ...result };

  if (moveTo) {
    try {
      ctx.store.move(item, entry.file, moveTo);
    } catch (error) {
      // 破損ファイル・書き込みの失敗
      throw new CliError('unavailable', (error as Error).message);
    }
    ctx.changed(
      mainI18n.t('cli.changed.launcherMoved', {
        name: itemName(item),
        tab: tabOf(moveTo, tabs) ?? moveTo,
      })
    );
  } else {
    ctx.store.replace(item);
    ctx.changed(mainI18n.t('cli.changed.launcherUpdated', { name: itemName(item) }));
  }
  return result;
}

async function remove(args: readonly string[], ctx: LauncherCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const entry = await findEntry(key, ctx);
  const removed = view(entry, await ctx.store.tabs());
  // ワークスペースの参照は消さない（「元のアイテムが見つかりません」になる）。件数だけ返して知らせる
  const workspaceRefs = (await ctx.store.countWorkspaceRefs?.(entry.item.id)) ?? 0;
  const refs = workspaceRefs > 0 ? { workspaceRefs } : {};
  if (dryRun) return { dryRun: true, removed, ...refs };

  await ctx.store.remove(entry.item.id);
  ctx.changed(mainI18n.t('cli.changed.launcherRemoved', { name: itemName(entry.item) }));
  return { removed, ...refs };
}
