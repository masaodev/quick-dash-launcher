import * as fs from 'fs';
import * as path from 'path';

import { FileUtils } from '@common/utils/fileUtils';
import { generateId, serializeJsonDataFile } from '@common/utils/jsonParser';
import type { DataFileTab, JsonDataFile, JsonItem, SerializableClipboard } from '@common/types';
import { DEFAULT_DATA_FILE, JSON_DATA_VERSION, truncateClipboardPreview } from '@common/types';

import PathManager from '../config/pathManager.js';
import { writeDataFile } from '../services/dataFileTracker.js';
import { mainI18n } from '../services/mainI18n.js';

/**
 * サンプルのクリップボードアイテムを作る（clipboard-data/{id}.json も書き出す）
 * 書き出せなかったときは null を返し、サンプルから外す
 */
function createSampleClipboardItem(): JsonItem | null {
  const text = mainI18n.t('sampleData.greetingText');
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
    id: generateId(),
    type: 'clipboard',
    displayName: mainI18n.t('sampleData.greetingName'),
    dataFileRef: `clipboard-data/${id}.json`,
    savedAt,
    // 一覧のプレビューはほかの定型文と同じ長さで切る（本文はファイルに全部ある）
    preview: truncateClipboardPreview(text),
    formats: ['text'],
  };
}

/** 初回起動のお試し用の 2 つ目のタブ（Web）のデータファイル */
const SAMPLE_WEB_DATA_FILE = 'datafiles/data2.json';

function sampleItem(displayName: string, path: string): JsonItem {
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
 * @returns created: データファイルを作ったら true（既にあれば false）、splitWebTab: Web のアイテムを 2 つ目のデータファイルに分けたら true
 */
export function createDefaultDataFile(splitWebTab: boolean = false): {
  created: boolean;
  splitWebTab: boolean;
} {
  const dataPath = PathManager.getDataFilePath();
  if (fs.existsSync(dataPath)) return { created: false, splitWebTab: false };

  const mainItems: JsonItem[] = [
    sampleItem(mainI18n.t('sampleData.readme.name'), mainI18n.t('sampleData.readme.url')),
    sampleItem(mainI18n.t('sampleData.desktop'), 'shell:Desktop'),
    sampleItem(mainI18n.t('sampleData.downloads'), 'shell:Downloads'),
    sampleItem(mainI18n.t('sampleData.calculator'), 'calc.exe'),
    sampleItem(mainI18n.t('sampleData.notepad'), 'notepad.exe'),
  ];
  const webItems: JsonItem[] = [
    sampleItem(mainI18n.t('sampleData.google.name'), mainI18n.t('sampleData.google.url')),
    sampleItem(mainI18n.t('sampleData.maps.name'), mainI18n.t('sampleData.maps.url')),
    sampleItem(mainI18n.t('sampleData.weather.name'), mainI18n.t('sampleData.weather.url')),
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
  return { created: true, splitWebTab: split };
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
