import * as fs from 'fs';

import { FileUtils } from '@common/utils/fileUtils';
import { generateId, serializeJsonDataFile } from '@common/utils/jsonParser';
import type { JsonDataFile, JsonItem, SerializableClipboard } from '@common/types';
import { JSON_DATA_VERSION, PREVIEW_MAX_LENGTH } from '@common/types';

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
    preview:
      text.length <= PREVIEW_MAX_LENGTH ? text : `${text.substring(0, PREVIEW_MAX_LENGTH)}...`,
    formats: ['text'],
  };
}

/**
 * デフォルトのデータファイルを作成（JSON形式）
 * 名前にローマ字を添える・クリップボードを、初回起動のサンプルで試せるようにする。
 * 名前と URL は作るときの表示言語で決める（日本語は読みのローマ字を添え、日本向けのサイトにする）
 */
export function createDefaultDataFile(): void {
  const dataPath = PathManager.getDataFilePath();
  if (!fs.existsSync(dataPath)) {
    const items: JsonItem[] = [
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.readme.name'),
        path: mainI18n.t('sampleData.readme.url'),
      },
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.google.name'),
        path: mainI18n.t('sampleData.google.url'),
      },
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.maps.name'),
        path: mainI18n.t('sampleData.maps.url'),
      },
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.weather.name'),
        path: mainI18n.t('sampleData.weather.url'),
      },
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.desktop'),
        path: 'shell:Desktop',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.downloads'),
        path: 'shell:Downloads',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.calculator'),
        path: 'calc.exe',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: mainI18n.t('sampleData.notepad'),
        path: 'notepad.exe',
      },
    ];
    const clipboardItem = createSampleClipboardItem();
    if (clipboardItem) items.push(clipboardItem);

    const defaultData: JsonDataFile = {
      version: JSON_DATA_VERSION,
      items,
    };
    const content = serializeJsonDataFile(defaultData);
    writeDataFile(dataPath, content);
  }
}
