# 開発ガイド

## 重要な実装詳細

### ウィンドウの動作
- フレームレスウィンドウ（479x506px）常に最前面
- DevToolsが開いていない限りブラー時に非表示（固定化時・編集モード時は例外）
- Alt+Spaceグローバルホットキーで表示/非表示（デフォルト、設定で変更可能）
- 表示時に検索ボックスが自動クリア＆フォーカス
- 📌ボタンでウィンドウ固定化可能（固定中はフォーカスアウトしても非表示にならない）
- 編集モード時のウィンドウ自動拡大（1000x700px）と復元機能

### データファイル形式

データファイル（data.txt、data2.txt）の詳細な形式仕様については、専用ドキュメントを参照してください：
**[データファイル形式仕様](../architecture/data-format.md)**

**基本例:**
```
// コメント行は//で開始
表示名,URLまたはパス
アプリ名,C:\path\to\app.exe,オプション引数
dir,C:\folder\path  // フォルダ取込アイテム
```

### データ読み込みと重複排除

#### タブ単位の重複排除（v0.4.2以降）

データ読み込み処理（`src/main/ipc/dataHandlers.ts`の`loadDataFiles()`関数）では、タブ単位で重複排除が行われます。

**実装方法：**
1. `SettingsService`から`dataFileTabs`設定を読み込む
2. `sourceFile → tabIndex` のマップを作成
3. 各データファイル処理時に、そのファイルが属するタブIndexを取得
4. タブ別の`Set<string>`で重複チェック
5. 重複判定キー: `${name}|${path}|${args}`

**重複排除ルール：**
- **同一タブ内**: 重複するアイテムは1つのみ読み込む
- **異なるタブ間**: 重複するアイテムを両方とも読み込む
- **タブに属さないファイル**: 独立したタブ（tabIndex = -1）として扱う

**実装例：**
```typescript
// sourceFile → tabIndex のマップを作成
const fileToTabMap = new Map<string, number>();
dataFileTabs.forEach((tab, index) => {
  tab.files.forEach(fileName => {
    fileToTabMap.set(fileName, index);
  });
});

// タブ別の重複チェック
const seenPathsByTab = new Map<number, Set<string>>();
for (const fileName of dataFiles) {
  const tabIndex = fileToTabMap.get(fileName) ?? -1;
  if (!seenPathsByTab.has(tabIndex)) {
    seenPathsByTab.set(tabIndex, new Set<string>());
  }
  const seenPaths = seenPathsByTab.get(tabIndex)!;
  // 重複チェック...
}
```

#### 管理画面の重複削除

管理画面（`EditModeView.tsx`）の整列・重複削除機能は、選択中のタブのみを対象に処理します：

1. 現在選択中のタブに属するファイルを特定
2. そのタブの行のみを抽出して整列・重複削除
3. 保存時に他タブの行と結合

これにより、タブ間で独立した重複管理が可能になります。

### アイテムタイプの検出
- URL: `://`を含む
- カスタムURI: 非http(s)スキーマ（obsidian://, ms-excel://）
- アプリ: .exe, .bat, .cmd, .com, .lnk拡張子
- フォルダ: 拡張子なしまたはスラッシュで終わる
- ファイル: その他すべて

### 検索の実装
- 大文字小文字を区別しないインクリメンタルサーチ
- スペース区切りキーワードでAND検索
- 表示名のみでフィルタリング

## コード品質向上のガイドライン

### リファクタリングの原則
1. **DRY（Don't Repeat Yourself）**: 同じロジックの重複を避ける
2. **単一責任の原則**: 1つの関数は1つの責任のみ持つ
3. **関数の小型化**: 理解しやすいサイズに関数を分割
4. **命名の明確化**: 関数名と変数名で処理内容を明確に表現

### 共通処理の抽出手順
1. **重複コードの特定**: 同様の処理が複数箇所にないか定期的に確認
2. **共通部分の抽出**: 重複している処理を独立した関数として分離
3. **関数の統合**: 抽出した共通関数を各箇所で使用するよう修正
4. **動作確認**: ビルドとテストで機能が維持されることを検証

### パフォーマンス最適化
- **バンドルサイズ**: 不要なコードの削除でアプリケーションサイズを最適化
- **処理の一貫性**: 同じデータに対して常に同じ処理を適用
- **エラーハンドリング**: 1箇所での修正が全体に反映される設計

## 実装パターンとベストプラクティス

### Electronアプリケーション パターン

#### サービスクラスの設計
メインプロセスの主要機能はサービスクラスで実装されています（`src/main/services/`）:

- **SettingsService**: アプリケーション設定の読み書き・管理
- **HotkeyService**: グローバルホットキーの登録・変更
- **BackupService**: データファイルの自動バックアップ
- **AutoLaunchService**: Windows起動時の自動起動設定
- **FaviconService**: ファビコン・アイコンの取得・キャッシュ管理
- **SearchHistoryService**: 検索履歴の保存・読み込み

**設計パターン:**
- すべてシングルトンパターンで実装
- `getInstance()`メソッドでインスタンスを取得
- 各サービスは単一責任の原則に従う
- IPCハンドラーから呼び出される

**使用例:**
```typescript
// AutoLaunchServiceの使用例
const autoLaunchService = AutoLaunchService.getInstance();
await autoLaunchService.setAutoLaunch(true); // 自動起動を有効化
const status = autoLaunchService.getAutoLaunchStatus(); // 現在の状態を取得
```

#### IPCハンドラーの構造化
- 機能ごとにハンドラーを分離（`src/main/ipc/`）
- 各ハンドラーは単一責任の原則に従う
- サービスクラスを呼び出して処理を実行
- 型安全性のため`src/common/types.ts`で共有型を定義

#### プロセス間通信のベストプラクティス
```typescript
// メインプロセス側
ipcMain.handle('channel-name', async (event, args) => {
  try {
    // 処理
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in channel-name:', error);
    return { success: false, error: error.message };
  }
});

// レンダラー側（preload経由）
const result = await window.api.channelName(args);
```

#### ファイルパスの処理
- 開発/本番環境の違いを考慮
- `app.isPackaged`を使用して環境を判定
- パスは常に絶対パスで処理

#### 設定ファイルの場所の管理
設定ファイルやアイコンキャッシュなどの保存場所は`PathManager`クラスで一元管理されています。

**デフォルトの動作:**
- Windows: `%APPDATA%\quick-dash-launcher\config`
- 環境変数 `QUICK_DASH_CONFIG_DIR` で任意の場所に変更可能

**テスト時のパス管理:**
```typescript
import { PathTestHelper } from '../../src/test/helpers/pathTestHelper';

describe('My Test', () => {
  let pathHelper: PathTestHelper;

  beforeEach(() => {
    pathHelper = new PathTestHelper();
    pathHelper.setup('my-test'); // 一時フォルダを作成
  });

  afterEach(() => {
    pathHelper.cleanup(); // 一時フォルダを削除
  });

  it('should work', () => {
    // テストコード
  });
});
```

**開発時のカスタムパス使用:**
```bash
# 開発用の設定を別フォルダで管理
QUICK_DASH_CONFIG_DIR=./dev-config npm run dev

# 本番環境の設定をテスト
QUICK_DASH_CONFIG_DIR=./prod-config npm run dev
```

### React + TypeScript パターン

#### 状態管理
- 小規模な状態は`useState`で管理
- グローバル状態は必要に応じてContextを使用

#### 型定義
- インターフェースは`I`プレフィックスを使用
- 型は`src/common/types.ts`で一元管理

### CSS開発パターン

#### デザインシステムの使用
QuickDashLauncherではCSS変数ベースの統一されたデザインシステムを採用しています。

詳細な命名規則・ベストプラクティスは **[CSSデザインシステム](../architecture/css-design.md)** を参照してください。

**基本ルール:**
- ハードコード値の使用禁止（色、サイズ、間隔など）
- 必ずvariables.cssで定義された変数を使用
- 共通クラス（common.css）を積極的に活用

**新しいコンポーネントのスタイル作成手順:**
1. `src/renderer/styles/components/`に新しいCSSファイルを作成
2. CSS変数のみを使用してスタイルを記述
3. 共通クラスで対応できる部分は再利用
4. コンポーネントファイルでCSSをインポート

```css
/* 良い例 */
.my-component {
  padding: var(--spacing-lg);
  background-color: var(--bg-section);
  border: var(--border-light);
  color: var(--text-primary);
}

/* 悪い例 */
.my-component {
  padding: 16px;
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  color: #333;
}
```

**詳細情報:**
- [CSSデザインシステム](../architecture/css-design.md) - 完全なガイドラインと使用方法

### パフォーマンス最適化パターン

#### アイコンのキャッシュ
- ファビコンは`%APPDATA%/quick-dash-launcher/config/favicons/`にキャッシュ
- ダウンロード前にキャッシュの存在を確認

#### 検索の最適化
- 大文字小文字を区別しないインクリメンタルサーチ
- フィルタリングはレンダラー側でリアルタイム実行

## UIコンポーネント構造

### 主要コンポーネント
- **App.tsx**: メインアプリケーションコンポーネント
- **SearchBox.tsx**: 検索入力フィールド
- **ActionButtons.tsx**: アクションボタンコンテナ
- **SettingsDropdown.tsx**: 設定関連機能のドロップダウンメニュー
- **FileTabBar.tsx**: ファイルタブの切り替え
- **ItemList.tsx**: アイテムリスト表示
- **RegisterModal.tsx**: ドラッグ&ドロップ登録用モーダル
- **EditableRawItemList.tsx**: 編集モード用のデータ編集テーブル
  - パスと引数列でパス＋引数を統合表示・編集
  - アイテム行：パス＋引数の組み合わせ（例：`notepad.exe`, `https://github.com/`）
  - フォルダ取込アイテム：フォルダパス＋オプション（例：`C:\Users\Documents filter:*.txt`）
  - 編集時の自動CSV形式変換機能

### ダイアログコンポーネント
ネイティブダイアログ（`window.alert()`, `window.confirm()`, `dialog.showOpenDialog()`）の代替として、カスタムReactコンポーネントを使用しています。

- **AlertDialog.tsx**: 通知・警告・エラー表示
  - 4つのタイプ: `info`, `error`, `warning`, `success`
  - ESCキーとEnterキーで閉じる
  - `data-testid`属性によるE2Eテスト対応
- **ConfirmDialog.tsx**: ユーザー確認ダイアログ
  - ESCキー（キャンセル）とEnterキー（確認）のサポート
  - `danger`モード: 破壊的操作時の警告スタイル
  - カスタマイズ可能なボタンテキスト
- **FilePickerDialog.tsx**: ファイル選択ダイアログ
  - Electronの`dialog.showOpenDialog()`をラップ
  - ファイルタイプフィルター（HTML、Image）
  - 統一されたUIでのファイル選択

### 設定メニュー
設定関連機能は⚙ボタンクリックで表示されるドロップダウンメニューに集約:
- ⚙️ 基本設定
- ✏️ アイテム管理
- ─── (区切り線)
- 🚪 アプリを終了

## 現在の制限事項とTODO

1. **最小限のエラーハンドリング** - エラーはコンソールにのみログ出力
2. **Windows専用パス** - クロスプラットフォーム非対応
3. **テストフレームワーク**: Playwright（E2E）+ Vitest（ユニット）導入済み

## デバッグ

### DevToolsの開き方

開発モードでは、以下の方法でDevToolsを開くことができます：

**管理ウィンドウ:**
- `Ctrl+Shift+I` で開発者ツールを開く（開発モードのみ）

**メインウィンドウ:**
- コードを直接編集して `mainWindow.webContents.openDevTools()` を追加する方法もありますが、通常は管理ウィンドウのDevToolsで十分です

> **注意**: v0.4.4以降、開発モードでの自動DevTools起動は削除されました。必要な場合は上記の方法で手動で開いてください。

### デバッグ時の問題

#### 白い/空白のウィンドウ
- DevToolsコンソールでエラーを確認（`Ctrl+Shift+I`で開く）
- Viteデベロップメントサーバーが起動しているか確認（開発モード時）
- プロダクションモードでindex.htmlパスが正しいか確認

### よくあるビルドの問題
- TypeScript設定の`@common`パスエイリアスがVite設定と一致しているか確認
- ビルド出力が正しいディレクトリ構造になっているか確認
- Electronのファイルパスがビルド/開発モードで適切に処理されているか確認

## ファイル入出力処理

### 改行コードの処理
- **ファイル保存時**: 常にCRLF（`\r\n`）で統一
- **ファイル読み込み時**: 正規表現`/\r\n|\n|\r/`で分割し、CRLF、LF、CRのいずれにも対応
- **対象関数**:
  - `loadRawDataFiles`: 生データファイルの読み込み
  - `saveRawDataFiles`: 生データファイルの保存（CRLF統一）
  - `loadDataFiles`: フォルダ取込アイテム展開時の読み込み
  - `registerItems`: 新規アイテム登録時の保存

### CSVフォーマットの処理
- **アイテム行**: `名前,パス[,引数][,カスタムアイコン]`
  - 引数とカスタムアイコンは省略可能
  - セル編集時は必要なフィールドのみ出力（末尾の無駄なカンマを防止）
- **フォルダ取込アイテム**: `dir,パス[,オプション...]`
  - オプションはカンマ区切りで複数指定可能

## UI/UXガイドライン

### ユーザーインターフェースの一貫性

#### 検索インターフェース
- **クリアボタン**: 全ての検索ボックスに統一されたクリア機能を提供
  - テキスト入力時に「×」ボタンを表示
  - クリックで入力内容をクリア、フォーカスを維持
  - 各画面で統一されたスタイルと動作
- **リアルタイム検索**: 入力と同時に結果をフィルタリング
- **キーボードナビゲーション**: 矢印キー、Enterキーでの操作

#### フォーカス管理
- **自動フォーカス**: ウィンドウ表示時、モーダル表示時に検索ボックスに自動フォーカス
- **フォーカス維持**: クリアボタンクリック後も検索ボックスにフォーカスを維持

### アクセシビリティ
- **aria-label**: クリアボタンに「検索をクリア」ラベルを設定
- **キーボードアクセス**: Tabキーでフォーカス移動が可能

### 視覚的フィードバック
- **ホバーエフェクト**: クリアボタンのホバー時に背景色変更
- **クリックフィードバック**: アクティブ状態の視覚的表現
- **統一されたデザイン**: CSSデザインシステムの変数を使用した一貫したスタイル

## 関連ドキュメント

- [アイテム管理](../features/item-management.md) - 編集モードの操作方法と技術実装
- [CSSデザインシステム](../architecture/css-design.md) - 統一されたスタイル管理システム
- [ビルドとデプロイ](build-deploy.md) - ビルドシステムと配布方法
- [テストガイド](../testing/README.md) - テストの実行方法
- [アイコンシステム](../features/icons.md) - アイコン取得・管理システム
- [フォルダ取込](../features/folder-import.md) - フォルダ内容のインポート機能