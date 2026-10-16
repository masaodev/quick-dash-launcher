import { DEFAULT_DATA_FILE, DataFileTab } from '@common/types';

import { tabT } from './translate';
import { FileNameGenerator } from './fileNameGenerator';
import { TabValidator } from './tabValidator';
import { TabStateCalculator } from './tabStateCalculator';

/**
 * アイテム管理画面でタブ・データファイルの構成をその場で変えるための計算
 *
 * 設定画面のタブ管理（保存ボタンで確定）と違い、1 操作ごとに確定する。
 * ここでは新しい構成と、作る・消すデータファイルを計算するだけで、ファイル操作と保存は呼び出し側で行う。
 */

/** タブ構成とデータファイルの名前（ラベル） */
export interface TabStructure {
  tabs: DataFileTab[];
  labels: Record<string, string>;
}

export type TabStructureEdit =
  | {
      ok: true;
      structure: TabStructure;
      /** 新しく作るデータファイル */
      filesToCreate: string[];
      /** ディスクから消すデータファイル（どのタブにも残らないもの） */
      filesToDelete: string[];
    }
  | { ok: false; reason: string };

export type MoveDirection = -1 | 1;

function fail(reason: string): TabStructureEdit {
  return { ok: false, reason };
}

function done(
  structure: TabStructure,
  filesToCreate: string[] = [],
  filesToDelete: string[] = []
): TabStructureEdit {
  return { ok: true, structure, filesToCreate, filesToDelete };
}

function isValidTabIndex(tabs: DataFileTab[], tabIndex: number): boolean {
  return tabIndex >= 0 && tabIndex < tabs.length;
}

/** 配列の要素を隣と入れ替えた新しい配列（端なら null） */
function swapWithNeighbor<T>(items: T[], index: number, direction: MoveDirection): T[] | null {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * 既存のラベルと重ならない、新しいファイルのラベル
 *
 * @param baseLabel 付けたい名前（取込画面で入力したものなど）。空なら「<タブ名>用データファイル」
 */
function uniqueDefaultLabel(
  labels: Record<string, string>,
  tabName: string,
  baseLabel?: string
): string {
  const used = new Set(Object.values(labels).filter((label) => label && label.trim() !== ''));
  return FileNameGenerator.generateUniqueLabel(
    baseLabel?.trim() || tabT('itemManager.tabStructure.defaultNames.fileForTab', { tab: tabName }),
    used
  );
}

/** 次に作るデータファイル名（タブに入っていないディスク上のファイルとも重ならないもの） */
function nextFileName(tabs: DataFileTab[], filesOnDisk: string[]): string {
  return FileNameGenerator.getNextAvailableFileName(
    tabs.flatMap((tab) => tab.files),
    filesOnDisk
  );
}

/** ほかのタブでも使われているファイルか */
export function isFileUsedInOtherTabs(
  tabs: DataFileTab[],
  tabIndex: number,
  fileName: string
): boolean {
  return TabValidator.isFileUsedInOtherTabs(fileName, tabIndex, tabs);
}

/** 新しいタブを末尾に足す。データファイルを 1 つ作って入れる（fileLabel はそのファイルの名前） */
export function addTab(
  structure: TabStructure,
  tabName: string,
  filesOnDisk: string[],
  fileLabel?: string
): TabStructureEdit {
  const fileName = nextFileName(structure.tabs, filesOnDisk);
  const name = tabName.trim() || FileNameGenerator.getDefaultTabName(fileName);
  return done(
    {
      tabs: [...structure.tabs, { name, files: [fileName] }],
      labels: {
        ...structure.labels,
        [fileName]: uniqueDefaultLabel(structure.labels, name, fileLabel),
      },
    },
    [fileName]
  );
}

export function renameTab(
  structure: TabStructure,
  tabIndex: number,
  tabName: string
): TabStructureEdit {
  if (!isValidTabIndex(structure.tabs, tabIndex))
    return fail(tabT('itemManager.tabStructure.errors.tabNotFound'));
  const name = tabName.trim();
  if (!name) return fail(tabT('itemManager.tabStructure.errors.tabNameRequired'));
  const tabs = [...structure.tabs];
  tabs[tabIndex] = { ...tabs[tabIndex], name };
  return done({ ...structure, tabs });
}

export function moveTab(
  structure: TabStructure,
  tabIndex: number,
  direction: MoveDirection
): TabStructureEdit {
  const tabs = swapWithNeighbor(structure.tabs, tabIndex, direction);
  if (!tabs) return fail(tabT('itemManager.tabStructure.errors.cannotMove'));
  return done({ ...structure, tabs });
}

/** タブを消せない理由（消せるなら null） */
export function getDeleteTabBlocker(tabs: DataFileTab[], tabIndex: number): string | null {
  if (!isValidTabIndex(tabs, tabIndex)) return tabT('itemManager.tabStructure.errors.tabNotFound');
  if (tabs.length <= 1) return tabT('itemManager.tabStructure.errors.lastTab');
  const tab = tabs[tabIndex];
  if (
    tab.files.includes(DEFAULT_DATA_FILE) &&
    !isFileUsedInOtherTabs(tabs, tabIndex, DEFAULT_DATA_FILE)
  ) {
    return tabT('itemManager.tabStructure.errors.mainTabDelete');
  }
  return null;
}

/** タブを消す。ほかのタブで使っていないデータファイルはディスクからも消す */
export function deleteTab(structure: TabStructure, tabIndex: number): TabStructureEdit {
  const blocker = getDeleteTabBlocker(structure.tabs, tabIndex);
  if (blocker) return fail(blocker);
  const filesToDelete = TabStateCalculator.getFilesToDeleteOnTabRemoval(
    tabIndex,
    [],
    structure.tabs
  );
  const labels = { ...structure.labels };
  for (const fileName of filesToDelete) delete labels[fileName];
  return done(
    { tabs: structure.tabs.filter((_, index) => index !== tabIndex), labels },
    [],
    filesToDelete
  );
}

/** 新しいデータファイルを作ってタブの末尾に入れる（fileLabel はそのファイルの名前） */
export function addNewFileToTab(
  structure: TabStructure,
  tabIndex: number,
  filesOnDisk: string[],
  fileLabel?: string
): TabStructureEdit {
  if (!isValidTabIndex(structure.tabs, tabIndex))
    return fail(tabT('itemManager.tabStructure.errors.tabNotFound'));
  const fileName = nextFileName(structure.tabs, filesOnDisk);
  const tab = structure.tabs[tabIndex];
  const tabs = [...structure.tabs];
  tabs[tabIndex] = { ...tab, files: [...tab.files, fileName] };
  return done(
    {
      tabs,
      labels: {
        ...structure.labels,
        [fileName]: uniqueDefaultLabel(structure.labels, tab.name, fileLabel),
      },
    },
    [fileName]
  );
}

/** ディスクにある既存のデータファイルをタブの末尾に入れる */
export function addExistingFileToTab(
  structure: TabStructure,
  tabIndex: number,
  fileName: string
): TabStructureEdit {
  if (!isValidTabIndex(structure.tabs, tabIndex))
    return fail(tabT('itemManager.tabStructure.errors.tabNotFound'));
  const tab = structure.tabs[tabIndex];
  const validation = TabValidator.canAddFileToTab(fileName, tab);
  if (!validation.valid)
    return fail(validation.reason || tabT('itemManager.tabStructure.errors.cannotAddFile'));
  const tabs = [...structure.tabs];
  tabs[tabIndex] = { ...tab, files: [...tab.files, fileName] };
  const labels = { ...structure.labels };
  const current = labels[fileName];
  if (!current || current.trim() === '' || current === fileName) {
    labels[fileName] = uniqueDefaultLabel(structure.labels, tab.name);
  }
  return done({ tabs, labels });
}

export function renameFile(
  structure: TabStructure,
  fileName: string,
  label: string
): TabStructureEdit {
  const name = label.trim();
  if (!name) return fail(tabT('itemManager.tabStructure.errors.fileNameRequired'));
  return done({ ...structure, labels: { ...structure.labels, [fileName]: name } });
}

export function moveFileInTab(
  structure: TabStructure,
  tabIndex: number,
  fileName: string,
  direction: MoveDirection
): TabStructureEdit {
  if (!isValidTabIndex(structure.tabs, tabIndex))
    return fail(tabT('itemManager.tabStructure.errors.tabNotFound'));
  const tab = structure.tabs[tabIndex];
  const files = swapWithNeighbor(tab.files, tab.files.indexOf(fileName), direction);
  if (!files) return fail(tabT('itemManager.tabStructure.errors.cannotMove'));
  const tabs = [...structure.tabs];
  tabs[tabIndex] = { ...tab, files };
  return done({ ...structure, tabs });
}

/** ファイルをタブから外せない（消せない）理由（外せるなら null） */
export function getRemoveFileBlocker(
  tabs: DataFileTab[],
  tabIndex: number,
  fileName: string
): string | null {
  const validation = TabValidator.canRemoveFileFromTab(fileName, tabIndex, tabs);
  if (!validation.valid)
    return validation.reason || tabT('itemManager.tabStructure.errors.cannotRemoveFile');
  if (fileName === DEFAULT_DATA_FILE && !isFileUsedInOtherTabs(tabs, tabIndex, fileName)) {
    return tabT('itemManager.tabStructure.errors.mainFileDelete');
  }
  return null;
}

/**
 * ファイルをタブから外す
 *
 * ほかのタブでも使っていれば外すだけ。どこでも使わなくなるならディスクからも消す。
 */
export function removeFileFromTab(
  structure: TabStructure,
  tabIndex: number,
  fileName: string
): TabStructureEdit {
  const blocker = getRemoveFileBlocker(structure.tabs, tabIndex, fileName);
  if (blocker) return fail(blocker);
  const usedElsewhere = isFileUsedInOtherTabs(structure.tabs, tabIndex, fileName);
  const tab = structure.tabs[tabIndex];
  const tabs = [...structure.tabs];
  tabs[tabIndex] = { ...tab, files: tab.files.filter((f) => f !== fileName) };
  const labels = { ...structure.labels };
  if (!usedElsewhere) delete labels[fileName];
  return done({ tabs, labels }, [], usedElsewhere ? [] : [fileName]);
}
