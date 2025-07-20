# API リファレンス

QuickDashLauncherで使用される主要なAPIの一覧です。

## データファイル関連 API

### loadDataFiles()
全てのdata*.txtファイルを読み込み、DIRディレクティブを展開してパースする

### loadRawDataFiles()
生データファイルを展開せずに読み込む（編集モード用）

### saveRawDataFiles()
生データファイルを直接保存する（編集モード用）

### registerItems()
新しいアイテムをデータファイルに登録する


## アイコン関連 API

### FaviconService.fetchFavicon()
ウェブサイトのファビコンを取得する

### extractIcon()
アプリケーションアイコンを抽出する

### extractCustomURIIcon()
カスタムURIスキーマのハンドラーアプリアイコンを抽出する

### loadCachedIcons()
キャッシュされたアイコンを一括読み込みする

### fetchFaviconsWithProgress()
複数URLのファビコンを逐次取得し、進捗状況をリアルタイム通知する

### extractIconsWithProgress()
複数アイテムのアイコンを逐次抽出し、進捗状況をリアルタイム通知する

## ウィンドウ制御 API

### WindowManager.setWindowPinState()
ウィンドウの固定状態を設定する

### WindowManager.getWindowPinState()
ウィンドウの固定状態を取得する

### WindowManager.setEditMode()
編集モードの状態を設定する（ウィンドウサイズとフォーカス制御）

### WindowManager.getEditMode()
編集モードの状態を取得する

## アイテム操作 API

### openItem()
ファイル、URL、アプリケーションを起動する

### openParentFolder()
エクスプローラーでアイテムの親フォルダを表示する

### isDirectory()
指定されたパスがディレクトリかどうかを判定する

## データ型定義

### LauncherItem
```typescript
interface LauncherItem {
  name: string;
  path: string;
  argument?: string;
  originalPath?: string;
}
```

### RawDataLine
```typescript
interface RawDataLine {
  type: 'directive' | 'item' | 'comment' | 'empty';
  content: string;
  line: number;
}
```

### IconProgress
アイコン取得処理の進捗状況を表すインターフェース
```typescript
interface IconProgress {
  type: 'favicon' | 'icon';           // 処理の種別
  current: number;                    // 現在処理完了したアイテム数
  total: number;                      // 処理対象の総アイテム数
  currentItem: string;                // 現在処理中のアイテム名またはURL
  errors: number;                     // エラーが発生したアイテム数
  startTime: number;                  // 処理開始時刻（ミリ秒）
  isComplete: boolean;                // 処理が完了したかどうか
}
```

### IconProgressState
アイコン取得進捗状態の管理用インターフェース
```typescript
interface IconProgressState {
  isActive: boolean;                  // 進捗処理がアクティブかどうか
  progress: IconProgress | null;      // 現在の進捗情報
}
```

## React カスタムフック

### useIconProgress()
アイコン取得進捗状態を管理するカスタムフック

```typescript
const useIconProgress = () => {
  const [progressState, setProgressState] = useState<IconProgressState>({
    isActive: false,
    progress: null,
  });

  // IPCイベントリスナーを自動設定
  // 進捗開始、更新、完了イベントを処理
  // 完了後3秒で自動的に非表示

  const resetProgress = () => void;

  return {
    progressState,    // 現在の進捗状態
    resetProgress,    // 進捗状態をリセット
  };
};
```

#### 使用例
```typescript
import { useIconProgress } from './hooks/useIconProgress';

const App: React.FC = () => {
  const { progressState } = useIconProgress();

  return (
    <div>
      {/* 他のコンポーネント */}
      {progressState.isActive && progressState.progress && (
        <IconProgressBar progress={progressState.progress} />
      )}
    </div>
  );
};
```

## 依存関係とライブラリ使用例

### 主要な依存関係

#### Electron
- **バージョン**: package.jsonで確認
- **用途**: デスクトップアプリケーションフレームワーク

#### React + TypeScript
- **用途**: UIフレームワークと型安全性

#### Vite
- **用途**: ビルドツールと開発サーバー
- **設定**: `vite.config.ts`

#### extract-file-icon
- **用途**: 実行ファイルからアイコンを抽出
- **使用例**:
```typescript
import { extractIcon } from 'extract-file-icon';

const iconBuffer = await extractIcon(exePath, 32); // 32x32ピクセル
const base64Icon = `data:image/png;base64,${iconBuffer.toString('base64')}`;
```

### Electron API 使用例

#### グローバルショートカット
```typescript
import { globalShortcut } from 'electron';

// 登録
globalShortcut.register('Ctrl+Alt+W', () => {
  // ウィンドウの表示/非表示を切り替え
});

// 解除
globalShortcut.unregister('Ctrl+Alt+W');
```

#### IPC通信
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

#### ファイルシステム操作
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

#### ウィンドウ管理
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

### ネットワーク関連

#### ファビコン取得
```typescript
import https from 'https';

const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
// HTTPSリクエストでファビコンをダウンロード
```

### セキュリティ注意事項
- `contextIsolation: true`を必ず設定
- `nodeIntegration: false`を維持
- プリロードスクリプトで必要なAPIのみを公開

### パフォーマンス考慮事項
- 大きなファイルの読み込みは非同期で実行
- アイコン抽出は必要時のみ実行（キャッシュを活用）

## 関連ドキュメント

- [IPCチャンネル詳細](../architecture/ipc-channels.md) - IPCチャンネルの詳細仕様
- [アーキテクチャ概要](../architecture/overview.md) - システム全体の構造