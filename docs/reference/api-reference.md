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

### sortDataFiles()
データファイルをパスの昇順でソートする

## アイコン関連 API

### FaviconService.fetchFavicon()
ウェブサイトのファビコンを取得する

### extractIcon()
アプリケーションアイコンを抽出する

### extractCustomURIIcon()
カスタムURIスキーマのハンドラーアプリアイコンを抽出する

### loadCachedIcons()
キャッシュされたアイコンを一括読み込みする

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

## 関連ドキュメント

- [IPCチャンネル詳細](../architecture/ipc-channels.md) - IPCチャンネルの詳細仕様
- [アーキテクチャ概要](../architecture/overview.md) - システム全体の構造