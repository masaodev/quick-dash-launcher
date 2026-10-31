import type { DataFileTab } from '@common/types';
import { TabStructureEdits } from '@common/utils/tabManager';
import type { TabStructure, TabStructureEdit } from '@common/utils/tabManager';

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
import { resolveOne } from './cliShared.js';

/**
 * qdl launcher tab … — ランチャーのタブとデータファイルの構成（settings.json の dataFileTabs・dataFileLabels）
 *
 * 構成の計算はアイテム管理画面と同じ TabStructureEdits を使い、確定の順も同じにする
 * （新しいファイルを作る → 設定を保存する → 要らなくなったファイルを消す）。
 * 画面と違って確認を挟めないので、アイテムが入ったデータファイルを消すことになる操作は断る。
 */

export interface TabSettings {
  tabs: DataFileTab[];
  labels: Record<string, string>;
  defaultFileTab: string;
  showDataFileTabs: boolean;
}

/** タブ構成の読み書き（本体の既存の処理を包む。テストでは差し替える） */
export interface TabStore {
  load(): Promise<TabSettings>;
  /** datafiles/ にあるデータファイル（タブに入っていないものも含む） */
  filesOnDisk(): string[];
  /** データファイルごとのアイテム数 */
  countItems(): Promise<Map<string, number>>;
  createFile(fileName: string): void;
  /** 消したファイルを取り込み先にしていて、無効にした自動取込ルールの名前を返す */
  deleteFile(fileName: string): Promise<string[]>;
  save(structure: TabStructure): Promise<void>;
}

export interface TabCommandContext {
  store: TabStore;
  syncBeforeWrite(): Promise<void>;
  changed(message: string): void;
}

interface Snapshot {
  settings: TabSettings;
  counts: Map<string, number>;
}

async function snapshot(store: TabStore): Promise<Snapshot> {
  const [settings, counts] = await Promise.all([store.load(), store.countItems()]);
  return { settings, counts };
}

function structureOf(s: Snapshot): TabStructure {
  return { tabs: s.settings.tabs, labels: s.settings.labels };
}

export function normalizeDataFileName(name: string): string {
  const withDir =
    name.includes('/') || name.includes('\\') ? name.replace(/\\/g, '/') : `datafiles/${name}`;
  return withDir.endsWith('.json') ? withDir : `${withDir}.json`;
}

function fileView(file: string, structure: TabStructure, counts: Map<string, number>) {
  return { file, label: structure.labels[file] || file, itemCount: counts.get(file) ?? 0 };
}

function tabView(
  tab: DataFileTab,
  index: number,
  structure: TabStructure,
  s: Snapshot
): Record<string, unknown> {
  const files = tab.files.map((f) => fileView(f, structure, s.counts));
  return {
    index,
    name: tab.name,
    files,
    itemCount: files.reduce((sum, f) => sum + f.itemCount, 0),
    // 起動したときに開くタブ（既定のデータファイルを含むタブ）
    default: tab.files.includes(s.settings.defaultFileTab),
  };
}

/** タブを番号（0 始まり）か名前の完全一致で 1 つに絞る */
function findTab(key: string, tabs: DataFileTab[]): number {
  const indexed = tabs.map((tab, index) => ({ tab, index }));
  if (/^\d+$/.test(key.trim())) {
    const index = Number(key.trim());
    if (index < tabs.length) return index;
  }
  return resolveOne(
    key,
    indexed,
    mainI18n.t('cli.targets.tab'),
    (e) => String(e.index),
    (e) => e.tab.name,
    (e): CliCandidate => ({ id: String(e.index), displayName: e.tab.name, location: [] })
  ).index;
}

/** タブの中のデータファイルを、ファイル名（data3.json など）か名前（ラベル）で 1 つに絞る */
function findFileInTab(key: string, tab: DataFileTab, structure: TabStructure): string {
  const normalized = normalizeDataFileName(key);
  if (tab.files.includes(normalized)) return normalized;
  return resolveOne(
    key,
    tab.files,
    mainI18n.t('cli.targets.dataFile'),
    (f) => f,
    (f) => structure.labels[f] || f,
    (f): CliCandidate => ({ id: f, displayName: structure.labels[f] || f, location: [tab.name] })
  );
}

/** 計算の結果を確かめる。できない操作（最後のタブ・メインのデータファイルなど）は conflict */
function expectOk(edit: TabStructureEdit): Extract<TabStructureEdit, { ok: true }> {
  if (!edit.ok) throw new CliError('conflict', edit.reason);
  return edit;
}

/** アイテムが入ったデータファイルを消すことになる操作は断る（画面のように確認を挟めないため） */
function refuseDeletingItems(edit: Extract<TabStructureEdit, { ok: true }>, s: Snapshot): void {
  const nonEmpty = edit.filesToDelete.filter((f) => (s.counts.get(f) ?? 0) > 0);
  if (nonEmpty.length === 0) return;
  throw new CliError(
    'conflict',
    mainI18n.t('cli.errors.dataFileNotEmpty', {
      files: nonEmpty
        .map((f) =>
          mainI18n.t('cli.errors.dataFileNotEmptyEntry', {
            label: s.settings.labels[f] || f,
            file: f,
            count: s.counts.get(f) ?? 0,
          })
        )
        .join(mainI18n.t('common.listSeparator')),
    })
  );
}

/** タブを position 番目（0 始まり）へ。範囲の外は端に寄せる */
function moveTabTo(structure: TabStructure, from: number, position: number): TabStructure {
  const tabs = [...structure.tabs];
  const [tab] = tabs.splice(from, 1);
  tabs.splice(Math.max(0, Math.min(position, tabs.length)), 0, tab);
  return { ...structure, tabs };
}

/** 画面と同じ順で確定する。消せなかったファイルは警告として返す */
async function commit(
  ctx: TabCommandContext,
  edit: Extract<TabStructureEdit, { ok: true }>
): Promise<{ disabledRules: string[] }> {
  for (const fileName of edit.filesToCreate) ctx.store.createFile(fileName);
  await ctx.store.save(edit.structure);
  const disabledRules: string[] = [];
  for (const fileName of edit.filesToDelete) {
    disabledRules.push(...(await ctx.store.deleteFile(fileName)));
  }
  return { disabledRules };
}

function withRules(result: Record<string, unknown>, disabledRules: string[]) {
  return disabledRules.length > 0 ? { ...result, disabledAutoImportRules: disabledRules } : result;
}

export async function runLauncherTabCommand(
  verb: string | undefined,
  args: readonly string[],
  ctx: TabCommandContext
): Promise<unknown> {
  switch (verb) {
    case 'list':
      return list(args, ctx);
    case 'add':
      return addTab(args, ctx);
    case 'update':
      return updateTab(args, ctx);
    case 'remove':
      return removeTab(args, ctx);
    case 'file': {
      const [fileVerb, ...fileArgs] = args;
      switch (fileVerb) {
        case 'add':
          return addFile(fileArgs, ctx);
        case 'update':
          return updateFile(fileArgs, ctx);
        case 'remove':
          return removeFile(fileArgs, ctx);
      }
      throw new CliError(
        'usage',
        fileVerb
          ? mainI18n.t('cli.errors.unknownVerb', { command: `launcher tab file ${fileVerb}` })
          : mainI18n.t('cli.errors.missingTabFileVerb')
      );
    }
  }
  throw new CliError(
    'usage',
    verb
      ? mainI18n.t('cli.errors.unknownVerb', { command: `launcher tab ${verb}` })
      : mainI18n.t('cli.errors.missingTabVerb')
  );
}

async function list(args: readonly string[], ctx: TabCommandContext): Promise<unknown> {
  expectPositionals(parseArgs(args, {}), []);
  const s = await snapshot(ctx.store);
  const structure = structureOf(s);
  const inTabs = new Set(s.settings.tabs.flatMap((t) => t.files));
  return {
    showDataFileTabs: s.settings.showDataFileTabs,
    tabs: s.settings.tabs.map((tab, index) => tabView(tab, index, structure, s)),
    // datafiles/ にあって、どのタブにも入っていないファイル（tab file add --existing で入れられる）
    unassignedFiles: ctx.store
      .filesOnDisk()
      .filter((f) => !inTabs.has(f))
      .map((f) => fileView(f, structure, s.counts)),
  };
}

async function addTab(args: readonly string[], ctx: TabCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['name', 'label', 'position'], flags: ['dry-run'] });
  expectPositionals(parsed, []);
  const name = optionString(parsed, 'name');
  if (!name?.trim()) throw new CliError('usage', mainI18n.t('cli.errors.needName'));
  const position = optionInt(parsed, 'position');
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const label =
    optionString(parsed, 'label')?.trim() ||
    mainI18n.t('itemManager.tabStructure.defaultNames.fileForTab', { tab: name.trim() });
  const added = expectOk(
    TabStructureEdits.addTab(structureOf(s), name, ctx.store.filesOnDisk(), label)
  );
  const last = added.structure.tabs.length - 1;
  const edit =
    position === undefined
      ? added
      : { ...added, structure: moveTabTo(added.structure, last, position) };
  const index = position === undefined ? last : Math.max(0, Math.min(position, last));
  const tab = tabView(edit.structure.tabs[index], index, edit.structure, s);
  // タブの表示がオフだと、足したタブは画面に出ない（オンにするのは設定で）
  const result = { tab, ...(s.settings.showDataFileTabs ? {} : { tabsHidden: true }) };
  if (dryRun) return { dryRun: true, ...result };

  await commit(ctx, edit);
  ctx.changed(mainI18n.t('cli.changed.tabAdded', { name: name.trim() }));
  return result;
}

async function updateTab(args: readonly string[], ctx: TabCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['name', 'position'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.tab')]);
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
  const index = findTab(key, s.settings.tabs);
  let edit = expectOk(
    name !== undefined
      ? TabStructureEdits.renameTab(structureOf(s), index, name)
      : { ok: true, structure: structureOf(s), filesToCreate: [], filesToDelete: [] }
  );
  let newIndex = index;
  if (position !== undefined) {
    edit = { ...edit, structure: moveTabTo(edit.structure, index, position) };
    newIndex = Math.max(0, Math.min(position, edit.structure.tabs.length - 1));
  }
  const before = tabView(s.settings.tabs[index], index, structureOf(s), s);
  const tab = tabView(edit.structure.tabs[newIndex], newIndex, edit.structure, s);
  if (dryRun) return { dryRun: true, before, tab };

  await commit(ctx, edit);
  ctx.changed(mainI18n.t('cli.changed.tabUpdated', { name: edit.structure.tabs[newIndex].name }));
  return { before, tab };
}

async function removeTab(args: readonly string[], ctx: TabCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.tab')]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const index = findTab(key, s.settings.tabs);
  const edit = expectOk(TabStructureEdits.deleteTab(structureOf(s), index));
  refuseDeletingItems(edit, s);
  const removed = tabView(s.settings.tabs[index], index, structureOf(s), s);
  // ほかのタブでも使っているファイルは残り、どこにも残らない空のファイルだけ消える
  const result = { removed, deletedFiles: edit.filesToDelete };
  if (dryRun) return { dryRun: true, ...result };

  const { disabledRules } = await commit(ctx, edit);
  ctx.changed(mainI18n.t('cli.changed.tabRemoved', { name: s.settings.tabs[index].name }));
  return withRules(result, disabledRules);
}

async function addFile(args: readonly string[], ctx: TabCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['label', 'existing'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.tab')]);
  const existingKey = optionString(parsed, 'existing');
  const label = optionString(parsed, 'label');
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const index = findTab(key, s.settings.tabs);
  const tabName = s.settings.tabs[index].name;

  let edit: Extract<TabStructureEdit, { ok: true }>;
  let fileName: string;
  if (existingKey !== undefined) {
    fileName = normalizeDataFileName(existingKey);
    if (!ctx.store.filesOnDisk().includes(fileName)) {
      throw new CliError(
        'not_found',
        mainI18n.t('cli.errors.noDataFile', {
          file: fileName,
          files: ctx.store.filesOnDisk().join(', '),
        })
      );
    }
    edit = expectOk(TabStructureEdits.addExistingFileToTab(structureOf(s), index, fileName));
    if (label?.trim())
      edit = expectOk(TabStructureEdits.renameFile(edit.structure, fileName, label));
  } else {
    const fileLabel =
      label?.trim() ||
      mainI18n.t('itemManager.tabStructure.defaultNames.fileForTab', { tab: tabName });
    edit = expectOk(
      TabStructureEdits.addNewFileToTab(structureOf(s), index, ctx.store.filesOnDisk(), fileLabel)
    );
    fileName = edit.filesToCreate[0];
  }
  const result = {
    file: { ...fileView(fileName, edit.structure, s.counts), created: existingKey === undefined },
    tab: tabView(edit.structure.tabs[index], index, edit.structure, s),
  };
  if (dryRun) return { dryRun: true, ...result };

  await commit(ctx, edit);
  ctx.changed(
    mainI18n.t('cli.changed.tabFileAdded', { label: edit.structure.labels[fileName], tab: tabName })
  );
  return result;
}

async function updateFile(args: readonly string[], ctx: TabCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { values: ['label'], flags: ['dry-run'] });
  const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.dataFile')]);
  const label = optionString(parsed, 'label');
  if (label === undefined) {
    throw new CliError('usage', mainI18n.t('cli.errors.needChanges', { options: '--label' }));
  }
  if (!label.trim()) throw new CliError('usage', mainI18n.t('cli.errors.emptyName'));
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const fileName = normalizeDataFileName(key);
  if (!s.settings.tabs.some((t) => t.files.includes(fileName))) {
    throw new CliError('not_found', mainI18n.t('cli.errors.fileNotInTabs', { file: fileName }));
  }
  const edit = expectOk(TabStructureEdits.renameFile(structureOf(s), fileName, label));
  const before = fileView(fileName, structureOf(s), s.counts);
  const file = fileView(fileName, edit.structure, s.counts);
  if (dryRun) return { dryRun: true, before, file };

  await commit(ctx, edit);
  ctx.changed(mainI18n.t('cli.changed.tabFileUpdated', { label: label.trim() }));
  return { before, file };
}

async function removeFile(args: readonly string[], ctx: TabCommandContext): Promise<unknown> {
  const parsed = parseArgs(args, { flags: ['dry-run'] });
  const [tabKey, fileKey] = expectPositionals(parsed, [
    mainI18n.t('cli.args.tab'),
    mainI18n.t('cli.args.dataFile'),
  ]);
  const dryRun = optionFlag(parsed, 'dry-run');
  if (!dryRun) await ctx.syncBeforeWrite();
  const s = await snapshot(ctx.store);
  const index = findTab(tabKey, s.settings.tabs);
  const tab = s.settings.tabs[index];
  const fileName = findFileInTab(fileKey, tab, structureOf(s));
  const edit = expectOk(TabStructureEdits.removeFileFromTab(structureOf(s), index, fileName));
  refuseDeletingItems(edit, s);
  const result = {
    removed: fileView(fileName, structureOf(s), s.counts),
    // ほかのタブでも使っていれば外すだけ。どこにも残らない空のファイルはディスクからも消す
    deleted: edit.filesToDelete.includes(fileName),
    tab: tabView(edit.structure.tabs[index], index, edit.structure, s),
  };
  if (dryRun) return { dryRun: true, ...result };

  const { disabledRules } = await commit(ctx, edit);
  ctx.changed(
    mainI18n.t('cli.changed.tabFileRemoved', {
      label: s.settings.labels[fileName] || fileName,
      tab: tab.name,
    })
  );
  return withRules(result, disabledRules);
}
