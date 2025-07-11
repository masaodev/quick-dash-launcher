# 依存関係とAPI使用例

このドキュメントは、QuickDashLauncherで使用している外部ライブラリとElectron APIの使用方法を記録します。

## 主要な依存関係

### Electron
- **バージョン**: package.jsonで確認
- **用途**: デスクトップアプリケーションフレームワーク

### React + TypeScript
- **用途**: UIフレームワークと型安全性

### Vite
- **用途**: ビルドツールと開発サーバー
- **設定**: `vite.config.ts`

### extract-file-icon
- **用途**: 実行ファイルからアイコンを抽出
- **使用例**:
```typescript
import { extractIcon } from 'extract-file-icon';

const iconBuffer = await extractIcon(exePath, 32); // 32x32ピクセル
const base64Icon = `data:image/png;base64,${iconBuffer.toString('base64')}`;
```

## Electron API 使用例

### グローバルショートカット
```typescript
import { globalShortcut } from 'electron';

// 登録
globalShortcut.register('Ctrl+Alt+W', () => {
  // ウィンドウの表示/非表示を切り替え
});

// 解除
globalShortcut.unregister('Ctrl+Alt+W');
```

### IPC通信
```typescript
// メインプロセス
ipcMain.handle('channel-name', async (event, args) => {
  return result;
});

// プリロード
contextBridge.exposeInMainWorld('api', {
  channelName: (args) => ipcRenderer.invoke('channel-name', args)
});
```

### ファイルシステム操作
```typescript
import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';

// ユーザーデータディレクトリ
const configPath = path.join(app.getPath('userData'), 'config');

// ファイル読み込み
const data = await fs.readFile(filePath, 'utf-8');

// 外部プログラムで開く
shell.openPath(filePath);
shell.openExternal(url);
```

### ウィンドウ管理
```typescript
const mainWindow = new BrowserWindow({
  width: 479,
  height: 506,
  frame: false,
  alwaysOnTop: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
});

// フォーカスを失ったら非表示
mainWindow.on('blur', () => {
  if (!mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.hide();
  }
});
```

## ネットワーク関連

### ファビコン取得
```typescript
import https from 'https';

const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
// HTTPSリクエストでファビコンをダウンロード
```

## 注意事項

### セキュリティ
- `contextIsolation: true`を必ず設定
- `nodeIntegration: false`を維持
- プリロードスクリプトで必要なAPIのみを公開

### パフォーマンス
- 大きなファイルの読み込みは非同期で実行
- アイコン抽出は必要時のみ実行（キャッシュを活用）

## 更新履歴
- 2025-07-04: 初版作成