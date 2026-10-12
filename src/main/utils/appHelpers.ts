import * as fs from 'fs';

import { FileUtils } from '@common/utils/fileUtils';
import { generateId, serializeJsonDataFile } from '@common/utils/jsonParser';
import type { JsonDataFile, JsonItem, SerializableClipboard } from '@common/types';
import { JSON_DATA_VERSION } from '@common/types';

import PathManager from '../config/pathManager.js';
import { writeDataFile } from '../services/dataFileTracker.js';

/** サンプルの定型文（クリップボードアイテム） */
const SAMPLE_CLIPBOARD_TEXT = 'いつもお世話になっております。';

/**
 * サンプルのクリップボードアイテムを作る（clipboard-data/{id}.json も書き出す）
 * 書き出せなかったときは null を返し、サンプルから外す
 */
function createSampleClipboardItem(): JsonItem | null {
  const id = generateId();
  const savedAt = Date.now();
  const data: SerializableClipboard = {
    formats: ['text'],
    text: SAMPLE_CLIPBOARD_TEXT,
    savedAt,
    dataSize: Buffer.byteLength(SAMPLE_CLIPBOARD_TEXT, 'utf8'),
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
    displayName: '定型文: あいさつ（aisatsu）',
    dataFileRef: `clipboard-data/${id}.json`,
    savedAt,
    preview: SAMPLE_CLIPBOARD_TEXT,
    formats: ['text'],
  };
}

/**
 * デフォルトのデータファイルを作成（JSON形式）
 * 名前にローマ字を添える・クリップボードを、初回起動のサンプルで試せるようにする
 */
export function createDefaultDataFile(): void {
  const dataPath = PathManager.getDataFilePath();
  if (!fs.existsSync(dataPath)) {
    const items: JsonItem[] = [
      {
        id: generateId(),
        type: 'item',
        displayName: '使い方（README）',
        path: 'https://github.com/masaodev/quick-dash-launcher#readme',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: 'Google 検索（google）',
        path: 'https://www.google.com/',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: 'Google マップ（map）',
        path: 'https://www.google.co.jp/maps',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: '天気予報（tenki）',
        path: 'https://weathernews.jp/',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: 'デスクトップ（desktop）',
        path: 'shell:Desktop',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: 'ダウンロード（download）',
        path: 'shell:Downloads',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: '電卓（dentaku）',
        path: 'calc.exe',
      },
      {
        id: generateId(),
        type: 'item',
        displayName: 'メモ帳（memo）',
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
