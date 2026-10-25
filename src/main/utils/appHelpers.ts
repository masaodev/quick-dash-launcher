import * as fs from 'fs';
import * as path from 'path';

import { FileUtils } from '@common/utils/fileUtils';
import { generateId, serializeJsonDataFile } from '@common/utils/jsonParser';
import { serializeWorkspaceFile } from '@common/utils/workspaceParser';
import type {
  DataFileTab,
  JsonDataFile,
  JsonItem,
  JsonLauncherItem,
  SerializableClipboard,
} from '@common/types';
import { DEFAULT_DATA_FILE, JSON_DATA_VERSION, truncateClipboardPreview } from '@common/types';

import PathManager from '../config/pathManager.js';
import { writeDataFile } from '../services/dataFileTracker.js';
import { mainI18n } from '../services/mainI18n.js';

import { buildSampleWorkspaceFile } from './sampleWorkspace.js';
import type { SampleRefTarget, SampleTemplateData } from './sampleWorkspace.js';

/**
 * サンプルのクリップボードの保存データ（clipboard-data/{id}.json）を書き出し、アイテムに載せる分を返す
 * 書き出せなかったときは null を返し、サンプルから外す
 */
function writeSampleClipboardData(text: string): SampleTemplateData | null {
  const id = generateId();
  const savedAt = Date.now();
  const data: SerializableClipboard = {
    formats: ['text'],
    text: text,
    savedAt,
    dataSize: Buffer.byteLength(text, 'utf8'),
  };
  if (
    !FileUtils.safeWriteTextFile(
      PathManager.getClipboardDataFilePath(id),
      JSON.stringify(data, null, 2)
    )
  ) {
    return null;
  }
  return {
    dataFileRef: `clipboard-data/${id}.json`,
    savedAt,
    // 一覧のプレビューはほかの定型文と同じ長さで切る（本文はファイルに全部ある）
    preview: truncateClipboardPreview(text),
    formats: ['text'],
  };
}

/**
 * サンプルのクリップボードアイテムを作る（clipboard-data/{id}.json も書き出す）
 * 書き出せなかったときは null を返し、サンプルから外す
 */
function createSampleClipboardItem(): JsonItem | null {
  const data = writeSampleClipboardData(mainI18n.t('sampleData.greetingText'));
  if (!data) return null;
  return {
    id: generateId(),
    type: 'clipboard',
    displayName: mainI18n.t('sampleData.greetingName'),
    ...data,
  };
}

/** 初回起動のお試し用の 2 つ目のタブ（Web）のデータファイル */
const SAMPLE_WEB_DATA_FILE = 'datafiles/data2.json';

function sampleItem(displayName: string, path: string): JsonLauncherItem {
  return { id: generateId(), type: 'item', displayName, path };
}

function writeSampleDataFile(filePath: string, items: JsonItem[]): void {
  const data: JsonDataFile = { version: JSON_DATA_VERSION, items };
  writeDataFile(filePath, serializeJsonDataFile(data));
}

/**
 * デフォルトのデータファイルを作成（JSON形式）
 * 名前にローマ字を添える・クリップボードを、初回起動のサンプルで試せるようにする。
 * 名前と URL は作るときの表示言語で決める（日本語は読みのローマ字を添え、日本向けのサイトにする）
 *
 * 初回起動（splitWebTab）では、Web のアイテムを 2 つ目のデータファイル（SAMPLE_WEB_DATA_FILE）に分け、
 * タブの使い方を試せるようにする。そのファイルが既にあるときは分けない
 * @returns created: データファイルを作ったら true（既にあれば false）、splitWebTab: Web のアイテムを 2 つ目のデータファイルに分けたら true、
 *   refTargets: お試しのワークスペースの参照が指すアイテム（作ったときだけ）
 */
export function createDefaultDataFile(splitWebTab: boolean = false): {
  created: boolean;
  splitWebTab: boolean;
  refTargets: SampleRefTarget[];
} {
  const dataPath = PathManager.getDataFilePath();
  if (fs.existsSync(dataPath)) return { created: false, splitWebTab: false, refTargets: [] };

  const desktop = sampleItem(mainI18n.t('sampleData.desktop'), 'shell:Desktop');
  const downloads = sampleItem(mainI18n.t('sampleData.downloads'), 'shell:Downloads');
  const calculator = sampleItem(mainI18n.t('sampleData.calculator'), 'calc.exe');
  const weather = sampleItem(
    mainI18n.t('sampleData.weather.name'),
    mainI18n.t('sampleData.weather.url')
  );
  const mainItems: JsonItem[] = [
    sampleItem(mainI18n.t('sampleData.readme.name'), mainI18n.t('sampleData.readme.url')),
    desktop,
    downloads,
    calculator,
    sampleItem(mainI18n.t('sampleData.notepad'), 'notepad.exe'),
  ];
  const webItems: JsonItem[] = [
    sampleItem(mainI18n.t('sampleData.google.name'), mainI18n.t('sampleData.google.url')),
    sampleItem(mainI18n.t('sampleData.maps.name'), mainI18n.t('sampleData.maps.url')),
    weather,
  ];
  const refTarget = (item: JsonLauncherItem, workspaceName: string): SampleRefTarget => ({
    id: item.id,
    mainDisplayName: item.displayName,
    workspaceName,
  });
  const refTargets = [
    refTarget(desktop, mainI18n.t('sampleData.workspace.names.desktop')),
    refTarget(downloads, mainI18n.t('sampleData.workspace.names.downloads')),
    refTarget(calculator, mainI18n.t('sampleData.workspace.names.calculator')),
    refTarget(weather, mainI18n.t('sampleData.workspace.names.weather')),
  ];
  const clipboardItem = createSampleClipboardItem();
  if (clipboardItem) mainItems.push(clipboardItem);

  const webPath = path.join(PathManager.getConfigFolder(), SAMPLE_WEB_DATA_FILE);
  const split = splitWebTab && !fs.existsSync(webPath);
  if (split) {
    writeSampleDataFile(webPath, webItems);
    writeSampleDataFile(dataPath, mainItems);
  } else {
    writeSampleDataFile(dataPath, [...mainItems, ...webItems]);
  }
  return { created: true, splitWebTab: split, refTargets };
}

/**
 * 初回起動のお試しのワークスペース（workspace.json）を作る。既にあれば作らない。
 * 参照はメインウィンドウのお試し（refTargets）を指す。名前は作るときの表示言語で決める
 * @returns 作ったら true
 */
export function createSampleWorkspaceFile(refTargets: SampleRefTarget[]): boolean {
  const workspacePath = PathManager.getWorkspaceFilePath();
  if (fs.existsSync(workspacePath)) return false;

  const t = mainI18n.t.bind(mainI18n);
  const file = buildSampleWorkspaceFile(
    refTargets,
    writeSampleClipboardData(t('sampleData.workspace.templateText')),
    {
      workspaceName: t('workspace.defaultWorkspaceName'),
      favoritesGroup: t('sampleData.workspace.favoritesGroup'),
      moreGroup: t('sampleData.workspace.moreGroup'),
      setName: t('sampleData.workspace.setName'),
      setMemo: t('sampleData.workspace.setMemo'),
      calculator: { path: 'calc.exe', label: t('sampleData.workspace.names.calculator') },
      notepad: { path: 'notepad.exe', label: t('sampleData.workspace.names.notepad') },
      templateName: t('sampleData.workspace.templateName'),
      templateMemo: t('sampleData.workspace.templateMemo'),
      guide: {
        name: t('sampleData.workspace.guide.name'),
        url: t('sampleData.workspace.guide.url'),
        memo: t('sampleData.workspace.guide.memo'),
      },
    }
  );
  return writeDataFile(workspacePath, serializeWorkspaceFile(file));
}

/**
 * 初回起動のタブ（「メイン」と、Web のアイテムを分けたときは「Web」）。名前は表示言語で決める
 */
export function createFirstLaunchTabs(splitWebTab: boolean): {
  dataFileTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
} {
  const tabs: DataFileTab[] = [
    { files: [DEFAULT_DATA_FILE], name: mainI18n.t('firstLaunch.defaultTabName') },
  ];
  if (splitWebTab) {
    tabs.push({ files: [SAMPLE_WEB_DATA_FILE], name: mainI18n.t('sampleData.webTabName') });
  }
  const dataFileLabels = Object.fromEntries(
    tabs.map((tab) => [
      tab.files[0],
      mainI18n.t('itemManager.tabStructure.defaultNames.fileForTab', { tab: tab.name }),
    ])
  );
  return { dataFileTabs: tabs, dataFileLabels };
}
