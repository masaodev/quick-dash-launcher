# 開発ガイド

## 技術スタック

| 項目           | 技術                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| フロントエンド | React + TypeScript + Vite                                                       |
| バックエンド   | Electron（メインプロセス）                                                      |
| スタイリング   | CSS変数ベースのデザインシステム（[CSSデザイン](../architecture/css-design.md)） |
| パッケージング | electron-builder                                                                |
| テスト         | Playwright（E2E）+ Vitest（単体）                                               |

動作環境は Windows のみです。開発には Node.js 22.12.0 以上が必要です（`package.json` の `engines`）。

## 開発環境のセットアップ

### 開発モード用アイコン

v0.5.20以降、開発モード実行時には赤い「DEV」オーバーレイ付きアイコンが適用されます。これにより、本番環境と視覚的に区別できます。

**アイコンの仕組み**:

- 開発用アイコンは`assets/icon-dev.ico`、`assets/icon-dev.png`に配置済み
- `PathManager.getAppIconPath()`が環境に応じて`assets/`ディレクトリのアイコンを選択
- 全ウィンドウ（メイン、トレイ、スプラッシュ、ワークスペース、管理）に適用

**App User Model ID**:

- 開発モード用に異なるIDを設定（アイコンキャッシュ対策）
- 本番: `net.masaodev.quick-dash-launcher`
- 開発: `net.masaodev.quick-dash-launcher.dev`

### 多重起動

v0.5.3以降、開発時に複数のインスタンスを同時に起動できるようになりました。これにより、異なる設定やデータで並行開発・比較検証が可能です。

#### 利用可能なインスタンス

| コマンド           | ポート | ホットキー | 設定フォルダ                                | 用途                     |
| ------------------ | ------ | ---------- | ------------------------------------------- | ------------------------ |
| `npm run dev`      | 9001   | Ctrl+Alt+A | `%APPDATA%\dev-quick-dash-launcher\config`  | メイン開発環境           |
| `npm run dev2`     | 9002   | Ctrl+Alt+S | `%APPDATA%\dev2-quick-dash-launcher\config` | 比較検証用               |
| `npm run dev:test` | 9003   | Ctrl+Alt+T | `./tests/dev/full`                          | テストデータでの動作確認 |

#### 環境変数

インスタンスの動作は以下の環境変数で制御されます：

| 環境変数                | 説明                                         | 例                         |
| ----------------------- | -------------------------------------------- | -------------------------- |
| `APP_INSTANCE`          | インスタンス識別子（userDataパスに使用）     | `dev`, `dev2`              |
| `VITE_PORT`             | Vite開発サーバーのポート番号                 | `9001`, `9002`             |
| `HOTKEY`                | 起動ホットキー（設定ファイルを上書き）       | `Ctrl+Alt+A`, `Ctrl+Alt+S` |
| `QUICK_DASH_CONFIG_DIR` | 設定フォルダのパス（絶対パスまたは相対パス） | `./tests/dev/full`         |

#### 実装の仕組み

**1. 独立したuserDataパス**

`src/main/main.ts`で、`APP_INSTANCE`環境変数に基づいて各インスタンスが独立したuserDataパスを使用します。環境変数へのアクセスは`EnvConfig`クラス経由で行います：

```typescript
if (EnvConfig.hasAppInstance) {
  const appName = `${EnvConfig.appInstance}-quick-dash-launcher`;
  const userDataPath = path.join(app.getPath('appData'), appName);
  app.setPath('userData', userDataPath);
}
```

**2. ポート番号の環境変数対応**

`vite.config.mts`および`EnvConfig`クラス経由で、`VITE_PORT`環境変数からポート番号を読み込みます：

```typescript
// vite.config.mts
server: {
  port: Number(process.env.VITE_PORT) || 9000,
}

// EnvConfig経由（windowManager.tsなど）
const devServerUrl = EnvConfig.devServerUrl; // http://localhost:{VITE_PORT}
mainWindow.loadURL(devServerUrl);
```

**3. ホットキーの環境変数上書き**

`src/main/services/hotkeyService.ts`で、`EnvConfig.customHotkey`が設定されている場合、設定ファイルの値を上書きします：

```typescript
const envHotkey = EnvConfig.customHotkey;
const hotkey = envHotkey || (await this.settingsService.get('hotkey'));
```

#### カスタムインスタンスの作成

独自のインスタンスを作成する場合は、環境変数を指定して起動します：

**PowerShellの例:**

```powershell
# カスタムポート・ホットキーで起動
$env:APP_INSTANCE="custom"; $env:VITE_PORT="9003"; $env:HOTKEY="Ctrl+Shift+Z"; npm run dev

# 特定のテストデータで起動
$env:QUICK_DASH_CONFIG_DIR="./tests/dev/full"; npm run dev
```

**Bashの例:**

```bash
# カスタムポート・ホットキーで起動
APP_INSTANCE=custom VITE_PORT=9003 HOTKEY=Ctrl+Shift+Z npm run dev

# 特定のテストデータで起動
QUICK_DASH_CONFIG_DIR=./tests/dev/full npm run dev
```

#### 注意事項

- 各インスタンスは完全に独立しており、設定・データファイル・キャッシュは共有されません
- ホットキーは必ず異なる値を指定してください（競合を避けるため）
- `HOTKEY`環境変数が設定されている場合、設定ファイルの値は無視されます
- インスタンスを停止する際は、各ターミナルで`Ctrl+C`を押してください

## 重要な実装詳細

### ウィンドウの動作

- フレームレスウィンドウ。サイズは設定の `windowWidth`×`windowHeight`（既定 600x400px）
- フォーカスが外れると非表示になる。DevTools を開いているとき・固定モードが「通常」以外のとき・初回設定中・モーダル表示中は例外
- 表示／非表示はグローバルホットキー（既定は未設定で、初回起動時に設定する）
- 表示時に検索ボックスをクリアしてフォーカスする
- 📌ボタンで固定モードを「通常 → 常に最前面 → 表示固定」の順に切り替える（`WindowPinMode`）。最前面になるのは「常に最前面」とモーダル表示中だけ
- アイテム管理は別の管理ウィンドウで開き、サイズは設定の `editModeWidth`×`editModeHeight`（既定 1200x1000px）

### データファイル形式

データファイル（data.json、data2.json）の詳細な形式仕様については、専用ドキュメントを参照してください：
**[データファイル形式仕様](../architecture/file-formats/data-format.md)**

**基本例:**
詳細な形式仕様については上記リンク先を参照してください。JSON形式でアイテムを管理しています。

**JSON Schema の再生成:** データファイル・設定ファイルの型（`src/common/types/json-data.ts`・`settings.ts`）を変えたら `npm run schema:generate` で `assets/schemas/*.schema.json` を再生成してコミットしてください。単体テスト（`tests/unit/schemas.test.ts`）が生成結果とコミット済みファイルの一致を検証しており、忘れると落ちます。詳細は [ファイル形式一覧の「AI・手動編集」](../architecture/file-formats/README.md#ai手動編集)。

### データ読み込みと重複排除

#### タブ単位の重複排除（v0.4.2以降）

データ読み込み処理（`src/main/services/data/dataFileLoader.ts`の`loadDataFiles()`関数）では、タブ単位で重複排除が行われます。

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
  tab.files.forEach((fileName) => {
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

管理画面の「🧰 ツール ▼ 重複を削除」（`AdminItemManagerView.tsx` → `useAdminItemEditing.dedupeFile`）は、選択中のデータファイルのみを対象に処理します：

1. 現在選択中のデータファイルのアイテムを抽出
2. 種類と表示テキストが同じアイテムのうち、ファイル内で後にあるものを除く（`editableItemOperations.dedupeFileItems`）
3. 他のデータファイルのアイテムには触れない。結果は未保存の変更として扱い、保存で確定

整列（並べ替えて保存する機能）は v0.7.34 で廃止しました。メイン画面は常に表示名の昇順で表示するため、ファイル内の並びは見た目に影響しません。

### アイテムタイプの検出

判定は `src/common/utils/itemTypeDetector.ts`。パスの文字列から次の順で決める。

- URL: `://` を含み、スキーマが `http`・`https`・`ftp`
- カスタムURI: それ以外のスキーマ（`obsidian://`、`ms-excel:` など）
- アプリ: `shell:AppsFolder\` で始まる、または拡張子が `.exe`・`.bat`・`.cmd`・`.com`・`.lnk`
- フォルダ: `shell:` で始まる、拡張子がない、または `/`・`\` で終わる
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

**共通化した処理の置き場所（新しく書く前に確認する）:**

- アイコン取得: `src/main/services/iconService.ts` の `getIconForItem()`（アイコン用 IPC とワークスペースの IPC が共用）
- アイテムの起動: `src/main/utils/itemLauncher.ts`（URL・ファイル・アプリ・カスタムURI。`itemHandlers.ts` と `workspaceHandlers.ts` が共用）
- ウィンドウの検索・アクティブ化・位置とサイズの設定: `src/main/utils/windowActivator.ts`
- 登録・編集フォームの部品: `src/renderer/components/WindowConfigEditor.tsx`（ウィンドウ設定）と `CustomIconEditor.tsx`（カスタムアイコン）。`RegisterItemForm.tsx` とワークスペースのアイテム編集が使う

### パフォーマンス最適化

- **バンドルサイズ**: 不要なコードの削除でアプリケーションサイズを最適化
- **処理の一貫性**: 同じデータに対して常に同じ処理を適用
- **エラーハンドリング**: 1箇所での修正が全体に反映される設計

### PRの自動チェック

PRとmainへのpushで、GitHub Actions（`.github/workflows/ci.yml`）が型チェック（`npm run type-check`）・lint（`npm run lint`）・単体テスト（`vitest run`）を実行します。JSON Schemaの再生成漏れも `tests/unit/schemas.test.ts` のドリフト検知で失敗として出ます。E2Eは対象外なので、リリース前にローカルで `npm run test:e2e` を実行してください。

### 依存関係管理

#### Dependabotによる自動更新

v0.5.7以降、Dependabotを導入して依存関係の自動更新を実現しています。

**設定ファイル:** `.github/dependabot.yml`

**自動更新の対象:**

- npm依存関係（package.json）
- GitHub Actions（ワークフローファイル）

**更新スケジュール:**

- **npm依存関係**: 毎週月曜日 9:00 JST（Asia/Tokyo）
- **GitHub Actions**: 毎週月曜日 9:00 JST（Asia/Tokyo）

**依存関係のグループ化:**
Dependabotは依存関係を以下のグループに分けてPRを作成します：

1. **production-major** - 本番依存関係のメジャーバージョンアップ
2. **production-minor-patch** - 本番依存関係のマイナー・パッチ更新
3. **development** - 開発依存関係の更新
4. **GitHub Actions** - CI/CDワークフローの更新

**PR数の制限:**

- npm依存関係: 最大10件のPR
- GitHub Actions: 最大5件のPR

**セキュリティアップデート:**
脆弱性が検出された場合、即座にPRが作成されます。

**運用フロー:**

1. 毎週月曜日にDependabotが依存関係をチェック
2. 更新可能なパッケージがあればPRを自動作成
3. PR内容をレビュー（CHANGELOGや破壊的変更を確認）
4. 問題なければマージ
5. テストが自動実行され、品質が確認される

**注意事項:**

- メジャーバージョンアップは慎重にテスト
- 破壊的変更がある場合は手動で対応
- E2Eテストを実行して動作確認

## 実装パターンとベストプラクティス

### Electronアプリケーション パターン

#### サービスクラスの設計

メインプロセスの処理本体は `src/main/services/` に置く。層の分担と構成は[システム概要](../architecture/overview.md#主要な責務の分担)を参照。

**設計パターン:**

- 状態を持つサービスはシングルトンで、`getInstance()` で取得する
- 状態を持たない処理は関数を直接エクスポートするモジュールにする（アイコン取得など）
- IPCハンドラーから呼び出し、ハンドラー側にはロジックを置かない
- 各サービスは単一責任の原則に従い、重複したロジックは一箇所に集約する

**使用例:**

```typescript
// シングルトンの例（AutoLaunchService）
const autoLaunchService = AutoLaunchService.getInstance();
await autoLaunchService.setAutoLaunch(true); // 自動起動を有効化
const status = autoLaunchService.getAutoLaunchStatus(); // 現在の状態を取得

// 関数エクスポートの例（services/iconService.ts）
import { getIconForItem } from '../services/iconService.js';
const icon = await getIconForItem(filePath, itemType);
```

#### IPCハンドラーの構造化

- 機能ごとにハンドラーを分離（`src/main/ipc/`）
- 各ハンドラーは単一責任の原則に従う
- サービスクラスを呼び出して処理を実行
- 型安全性のため共有型は`src/common/types/`（`index.ts`から再エクスポート）、チャンネル名は`src/common/ipcChannels.ts`の`IPC_CHANNELS`で定義

#### プロセス間通信のベストプラクティス

チャンネル名は文字列を直書きせず `IPC_CHANNELS` を使い、レンダラーにはプリロードで `window.electronAPI` として公開した関数だけを見せる。設計の詳細は[IPCチャンネル](../architecture/ipc-channels.md)を参照。

```typescript
// メインプロセス側（src/main/ipc/*Handlers.ts）
ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key?: keyof AppSettings) => {
  const settingsService = await SettingsService.getInstance();
  return key ? settingsService.get(key) : settingsService.getAll();
});

// プリロード（src/main/preload.ts）
getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

// レンダラー側
const settings = await window.electronAPI.getSettings();
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

**多重起動時のuserDataパス:**
`APP_INSTANCE`環境変数が設定されている場合、インスタンスごとに独立したuserDataパスが使用されます：

- `npm run dev`: `%APPDATA%\dev-quick-dash-launcher\config`
- `npm run dev2`: `%APPDATA%\dev2-quick-dash-launcher\config`
- カスタム: `%APPDATA%\{APP_INSTANCE}-quick-dash-launcher\config`

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
- 複雑な状態ロジックはカスタムフックに抽出

#### カスタムフックによる責務分離

大きなコンポーネントは、関連する状態とロジックをカスタムフックに分離してください：

**ワークスペース機能の例:**

```typescript
// データ管理フック（切り離しウィンドウでは対象グループの id を渡す）
const { items, groups, workspaces, activeWorkspaceId, loadAllDataWithLoading } =
  useWorkspaceData(detachedGroupId);

// アクション統合フック（データ変更後に呼ぶコールバックを渡す）
const actions = useWorkspaceActions(() => {
  loadAllDataWithLoading();
});

// ネイティブドラッグ&ドロップフック（グループで処理されなかったドロップを受ける）
useNativeDragDrop(handleNativeFileDrop);
```

**カスタムフック作成のガイドライン:**

- 単一責任の原則に従う（データ管理、アクション処理、UI状態など）
- 関連するロジックをグループ化
- 再利用可能な形で設計
- JSDocで目的と使用例を明記

**参考実装:**

- `src/renderer/hooks/workspace/useWorkspaceData.ts` - データ読み込みと状態管理
- `src/renderer/hooks/workspace/useWorkspaceActions.ts` - アクション処理の統合
- `src/renderer/hooks/useNativeDragDrop.ts` - ネイティブドラッグ&ドロップ処理
- `src/renderer/hooks/useClipboardPaste.ts` - クリップボードからのペースト処理
- `src/renderer/hooks/useCollapsibleSections.ts` - 折りたたみ状態管理
- `src/renderer/hooks/workspace/useWorkspaceItemGroups.ts` - アイテムグループ化ロジック
- `src/renderer/hooks/workspace/useWorkspaceResize.ts` - ワークスペースウィンドウのサイズ変更処理
- `src/renderer/hooks/useFileOperations.ts` - ファイルパスの取り出しとアイテム追加の共通処理（ドロップ処理とクリップボードのペーストが共用）

#### 型定義とガード関数

- 型は`src/common/types/`で機能別に分割管理（v0.5.20で再編成）
- 型アサーションの代わりに型ガード関数を使用（`src/common/types/guards.ts`）

**型ガード関数の使用例:**

```typescript
import { isLauncherItem } from '@common/types/guards';

// 型アサーション（非推奨）
const item = data as LauncherItem;

// 型ガード関数（推奨）
if (isLauncherItem(data)) {
  // ここではdataはLauncherItem型として扱われる
  console.log(data.path);
}
```

型定義ファイルは `src/common/types/` に機能別に分かれている（一覧はディレクトリを参照）。新しい型は該当ドメインのファイルに追加し、`index.ts` から再エクスポートする。

### CSS開発パターン

スタイルの規約（CSS 変数・共通クラス・命名・ファイル構成・値の直書き禁止）は **[CSSデザインシステム](../architecture/css-design.md)**、コンポーネントの命名と `Button` コンポーネントの使い分けは **[UIコンポーネント](../architecture/ui-components.md)** を正とする。ここには重ねて書かない。

### パフォーマンス最適化パターン

#### アイコンのキャッシュ

- ファビコンは`%APPDATA%/quick-dash-launcher/config/icon-cache/favicons/`にキャッシュ
- ダウンロード前にキャッシュの存在を確認

#### 検索の最適化

- 大文字小文字を区別しないインクリメンタルサーチ
- フィルタリングはレンダラー側でリアルタイム実行

## UIコンポーネント構造

### 主要コンポーネント

#### メインウィンドウ

- **App.tsx**: メインアプリケーションコンポーネント
- **LauncherSearchBox.tsx**: 検索入力フィールド
- **LauncherActionButtons.tsx**: アクションボタンコンテナ
- **LauncherSettingsDropdown.tsx**: 設定関連機能のドロップダウンメニュー
- **LauncherFileTabBar.tsx**: ファイルタブの切り替え
- **LauncherItemList.tsx**: アイテムリスト表示
- **RegisterModal.tsx**: ドラッグ&ドロップ登録用モーダル
  - **RegisterItemForm.tsx**: アイテム 1 件分の入力フォーム（**WindowConfigEditor.tsx**・**CustomIconEditor.tsx** を含む）

#### 管理ウィンドウ（アイテム管理タブ）

- **AdminItemManagerView.tsx**: アイテム管理のビュー
- **AdminItemManagerList.tsx**: データ編集テーブル

#### ワークスペースウィンドウ

- **WorkspaceApp.tsx**: ワークスペースアプリケーションコンポーネント
  - データ管理、アクション処理、ドラッグ&ドロップを個別のフックに分離
- **WorkspaceHeader.tsx**: ヘッダーコンポーネント（タイトル、展開/折りたたみ、ピン留めボタン）
- **WorkspaceGroupedList.tsx**: グループ化されたアイテムリスト
  - グループ化ロジックは `useWorkspaceItemGroups` に分離
- **WorkspaceGroupHeader.tsx**: グループヘッダー（名前編集、色変更、折りたたみ、削除）

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
- 🗂️ ワークスペースを表示
- ─── (区切り線)
- 🚪 アプリを終了

## デバッグ

### DevToolsの開き方

開発モードでは、以下の方法でDevToolsを開くことができます：

**管理ウィンドウ:**

- `Ctrl+Shift+I` で開発者ツールを開く（開発モードのみ）

**メインウィンドウ:**

- コードを直接編集して `mainWindow.webContents.openDevTools()` を追加する方法もありますが、通常は管理ウィンドウのDevToolsで十分です

> **注意**: v0.4.4以降、開発モードでの自動DevTools起動は削除されました。必要な場合は上記の方法で手動で開いてください。

### ウィンドウ検索機能のデバッグ

ウィンドウ検索機能のトラブルシューティングには、専用のデバッグツールを使用できます。

**ウィンドウデバッグツール（debug-windows.mjs）:**

```bash
# 基本的な使い方
npm run debug:windows

# 全仮想デスクトップのウィンドウを取得
npm run debug:windows -- --all-desktops

# 除外されたウィンドウも表示
npm run debug:windows -- --show-excluded

# 実行パスも表示
npm run debug:windows -- --show-paths

# ファイルに出力
npm run debug:windows -- --all-desktops --show-excluded --output debug.txt
```

**機能:**

- ウィンドウ一覧の取得と確認
- 除外ルールの動作確認（プロセス名・クラス名の組み合わせ）
- 各ウィンドウのプロセス名・クラス名・実行パスの確認
- システムウィンドウの除外動作の検証

**詳細:** `scripts/README.md` を参照

### デバッグ時の問題

#### 白い/空白のウィンドウ

- DevToolsコンソールでエラーを確認（`Ctrl+Shift+I`で開く）
- Viteデベロップメントサーバーが起動しているか確認（開発モード時）
- プロダクションモードでindex.htmlパスが正しいか確認

#### ウィンドウが検索で表示されない

1. **除外ルールで除外されていないか確認**

   ```bash
   npm run debug:windows -- --show-excluded
   ```

2. **全デスクトップを取得しているか確認**

   ```bash
   npm run debug:windows -- --all-desktops
   ```

3. **クローキング状態を確認**
   - 他の仮想デスクトップにあるウィンドウは`DWM_CLOAKED_SHELL`フラグでクローキングされている
   - `--all-desktops`オプションで取得可能

### よくあるビルドの問題

- TypeScript設定の`@common`パスエイリアスがVite設定と一致しているか確認
- ビルド出力が正しいディレクトリ構造になっているか確認
- Electronのファイルパスがビルド/開発モードで適切に処理されているか確認

## ファイル入出力処理

### データフォーマットの処理

データファイルはJSON形式で管理されています。詳細な形式仕様については、**[データファイル形式仕様](../architecture/file-formats/data-format.md)** を参照してください。

## UI/UXガイドライン

### ユーザーインターフェースの一貫性

#### 検索インターフェース

- **クリアボタン**: メイン画面の検索ボックス・アイテム管理の検索・アプリ取込の検索は、入力があるときだけ「×」（`.search-clear-button`）を表示し、クリックで入力を消す。新しく検索欄を作るときもこの形にそろえる
- **リアルタイム検索**: 入力と同時に結果をフィルタリング
- **キーボードナビゲーション**: 矢印キー、Enterキーでの操作

#### フォーカス管理

- **自動フォーカス**: メインウィンドウの表示時に検索ボックスへ、検索欄を持つモーダル（ウィンドウ選択・レイアウト取得・グループのアイテム選択）やワークスペースのフィルタ欄は表示時にその欄へフォーカスする
- **フォーカス維持**: メイン画面の検索ボックスは、クリアボタンを押した後もフォーカスを保つ

### アクセシビリティ

- **aria-label**: クリアボタンに「検索をクリア」ラベルを設定
- **キーボードアクセス**: Tabキーでフォーカス移動が可能

### 視覚的フィードバック

- **ホバーエフェクト**: クリアボタンのホバー時に背景色変更
- **クリックフィードバック**: アクティブ状態の視覚的表現
- **統一されたデザイン**: CSSデザインシステムの変数を使用した一貫したスタイル

## 関連ドキュメント

- [アイテム管理](../screens/admin-window.md#6-アイテム管理の詳細) - 編集モードの操作方法と技術実装
- [CSSデザインシステム](../architecture/css-design.md) - 統一されたスタイル管理システム
- [ビルドとデプロイ](build-deploy.md) - ビルドシステムと配布方法
- [テストガイド](../testing/README.md) - テストの実行方法
- [アイコンシステム](../features/icons.md) - アイコン取得・管理システム
- [フォルダ取込](../screens/register-modal.md#12-フォルダ取込アイテムの詳細) - フォルダ内容のインポート機能
