import * as fs from 'fs';

import { generateId, serializeJsonDataFile } from '@common/utils/jsonParser';
import type { JsonDataFile } from '@common/types';
import { JSON_DATA_SCHEMA_REF, JSON_DATA_VERSION } from '@common/types';

import PathManager from '../config/pathManager.js';
import { writeDataFile } from '../services/dataFileTracker.js';

/**
 * デフォルトのデータファイルを作成（JSON形式）
 */
export function createDefaultDataFile(): void {
  const dataPath = PathManager.getDataFilePath();
  if (!fs.existsSync(dataPath)) {
    const defaultData: JsonDataFile = {
      $schema: JSON_DATA_SCHEMA_REF,
      version: JSON_DATA_VERSION,
      items: [
        {
          id: generateId(),
          type: 'item',
          displayName: 'Google 検索',
          path: 'https://www.google.com/',
        },
        {
          id: generateId(),
          type: 'item',
          displayName: 'YouTube',
          path: 'https://www.youtube.com/',
        },
        {
          id: generateId(),
          type: 'item',
          displayName: 'Google マップ',
          path: 'https://www.google.co.jp/maps',
        },
        {
          id: generateId(),
          type: 'item',
          displayName: '天気予報',
          path: 'https://weathernews.jp/',
        },
        {
          id: generateId(),
          type: 'item',
          displayName: 'デスクトップ',
          path: 'shell:Desktop',
        },
        {
          id: generateId(),
          type: 'item',
          displayName: 'ダウンロード',
          path: 'shell:Downloads',
        },
        {
          id: generateId(),
          type: 'item',
          displayName: '電卓',
          path: 'calc.exe',
        },
        {
          id: generateId(),
          type: 'item',
          displayName: 'メモ帳',
          path: 'notepad.exe',
        },
      ],
    };
    const content = serializeJsonDataFile(defaultData);
    writeDataFile(dataPath, content);
  }
}
