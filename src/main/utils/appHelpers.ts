import * as fs from 'fs';

import PathManager from '../config/pathManager.js';

/**
 * デフォルトのdata.txtファイルを作成
 */
export function createDefaultDataFile(): void {
  const dataPath = PathManager.getDataFilePath();
  if (!fs.existsSync(dataPath)) {
    const defaultContent = `// Webサイト
GitHub,https://github.com/
Google マップ,https://www.google.co.jp/maps
//
// ローカルフォルダ
デスクトップ,shell:Desktop
ダウンロード,shell:Downloads
//
// アプリケーション
メモ帳,notepad.exe
`;
    fs.writeFileSync(dataPath, defaultContent, 'utf8');
  }
}
