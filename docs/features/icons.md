# アイコンシステム

QuickDashLauncherのアイコン処理システムは、様々な種類のアイテム（ウェブサイト、アプリケーション、ファイル、カスタムURI）に対して適切なアイコンを取得・管理します。

## アイコンの保存先・形式

アイコンは種類ごとに専用のディレクトリに保存されます：

| アイコン種類 | 保存場所 | ファイル名形式 | サイズ |
|-------------|---------|--------------|-------|
| **ファビコン** | `%APPDATA%/quickdashlauncher/config/favicons/` | `{domain}_favicon_{size}.png` | 64px（推奨）/ 32px（互換） |
| **EXEアイコン** | `%APPDATA%/quickdashlauncher/config/icons/` | `{hash}_icon.png` | 32px |
| **カスタムURIアイコン** | `%APPDATA%/quickdashlauncher/config/icons/` | `uri_{schema}_icon.png` | 32px |
| **拡張子アイコン** | `%APPDATA%/quickdashlauncher/config/icons/extensions/` | `{extension}_icon.png` | 32px |

### ファイル名形式の詳細

**ファビコン:**
```
{domain}_favicon_{size}.png
例: github.com_favicon_64.png
```

**カスタムURIアイコン:**
```
uri_{schema}_icon.png
例: uri_obsidian_icon.png
```

### 後方互換性

既存の32pxキャッシュも引き続き使用可能にするため、以下の順序でチェック：
1. 64pxファイルが存在するか確認
2. なければ32pxファイルを確認
3. どちらもなければ新規取得

## デフォルトアイコン

アイコンが取得できない場合は、アイテムの種類に応じた絵文字を使用：

| アイテム種類 | 絵文字 |
|-------------|-------|
| ファイル | 📄 |
| フォルダ | 📁 |
| ウェブ | 🌐 |
| アプリケーション | ⚙️ |
| カスタムURI | 🔗 |
| グループ | 📦 |

---

## ファビコン取得

`FaviconService`クラスが複数のソースから高品質なファビコンを取得します。

### 使い方

**個別取得:**
1. アイテム管理画面（Ctrl+E）を開く
2. URLアイテムを選択
3. コンテキストメニューから「ファビコンを取得」を選択

**一括取得:**
ヘッダーの🔄ボタン → 「🎨 アイコン取得」を選択

### 取得順序

ファビコンは以下の順序で複数のソースを試行します：

#### 1. HTMLメタタグの解析

| 優先度 | タグ |
|-------|------|
| 1 | `<link rel="icon" href="...">` |
| 2 | `<link rel="shortcut icon" href="...">` |
| 3 | `<link rel="apple-touch-icon" href="...">` |
| 4 | `<meta property="og:image" content="...">` |

#### 2. 標準的な場所の確認

| 優先度 | パス |
|-------|------|
| 1 | `/favicon.ico` |
| 2 | `/favicon.png` |
| 3 | `/apple-touch-icon.png` |
| 4 | `/apple-touch-icon-precomposed.png` |
| 5 | `/icon.png` |
| 6 | `/logo.png` |

### 技術仕様

| 項目 | 値 |
|------|-----|
| デフォルト解像度 | 64px |
| HTML読み込みサイズ | 最初の5KBのみ |
| HTMLダウンロードタイムアウト | 10秒 |
| ファビコンダウンロードタイムアウト | 5秒 |

---

## カスタムURIアイコン

カスタムURIスキーマ（例: `obsidian://`、`ms-excel://`）のアイコンは、Windowsレジストリから関連付けられたアプリケーションを検索して取得します。

### 使い方

**個別取得:**
1. アイテム管理画面（Ctrl+E）を開く
2. カスタムURIアイテムを選択
3. コンテキストメニューから「アイコンを抽出」を選択

**一括取得:**
ヘッダーの🔄ボタン → 「🎨 アイコン取得」を選択

### 取得優先順位

| 優先度 | 取得方法 | 説明 |
|-------|---------|------|
| 1 | レジストリベース | Windowsレジストリからスキーマハンドラーアプリを検索 |
| 2 | 拡張子ベース | URIに対応する拡張子のアイコン（例: `ms-excel://` → `.xlsx`） |
| 3 | デフォルト | 🔗絵文字 |

### レジストリクエリプロセス

1. **スキーマ検出**: URIから`://`前のスキーマを抽出（`obsidian://vault/notes` → `obsidian`）
2. **レジストリ検索**: `HKEY_CLASSES_ROOT\[スキーマ]\shell\open\command`を照会
3. **実行ファイルパス抽出**: コマンド文字列からEXEパスを抽出
4. **環境変数展開**: `%PROGRAMFILES%`等を実際のパスに変換
5. **アイコン抽出**: `extract-file-icon`ライブラリで32pxアイコンを抽出

### 対応URIスキーマ例

| URIスキーマ | ハンドラーアプリ |
|------------|--------------|
| `obsidian://` | Obsidian.exe |
| `ms-excel://` | EXCEL.EXE |
| `vscode://` | Code.exe |
| `steam://` | steam.exe |
| `slack://` | slack.exe |

---

## アプリケーションアイコン

実行可能ファイルからアイコンを抽出します。

### 技術仕様

| 項目 | 値 |
|------|-----|
| 使用ライブラリ | `extract-file-icon` |
| 抽出サイズ | 32px |
| 対応形式（直接抽出） | `.exe`, `.lnk`, `.dll` |
| 対応形式（拡張子ベース） | `.bat`, `.cmd`, `.com` |

### パス解決機能

**ファイル名のみ指定時のPATH解決:**
```
入力: notepad.exe
検索: where "notepad.exe"
結果: C:\Windows\System32\notepad.exe
```

**シンボリックリンクの解決:**
WindowsAppsフォルダ等のシンボリックリンクを自動解決してアイコンを抽出。

---

## 拡張子アイコン

ファイルアイテムは、拡張子に基づいてシステムから関連付けられたアイコンを取得します。

| 拡張子 | アイコン |
|-------|--------|
| `.txt` | メモ帳アイコン |
| `.pdf` | PDFリーダーアイコン |
| `.docx` | Microsoft Wordアイコン |
| `.xlsx` | Microsoft Excelアイコン |

---

## カスタムアイコン

ユーザーが手動で指定するカスタムアイコン機能もサポートします。

**保存場所:** `custom-icons/`（プロジェクトルートからの相対パス）

**対応形式:** `.png`, `.jpg`, `.jpeg`, `.ico`, `.svg`

**データファイル指定方法:**
```
表示名,パス,引数,カスタムアイコンファイル名
MyApp,C:\MyApp\app.exe,,custom-icon.png
```

詳細は[データファイル形式仕様](../architecture/data-format.md#カスタムアイコンの処理)を参照。

---

## 一括取得機能

### アクセス方法
メインウィンドウのヘッダーにある🔄ボタンをクリックしてドロップダウンメニューを開き、アイコン取得オプションを選択します。

### 🎨 アイコン取得（現在のタブ）
**現在表示中のタブ**のアイコンが未設定のアイテムのみを対象に、アイコンを一括で取得します。

**処理内容:**
- URLアイテム → ファビコンを取得
- EXE/ファイル/カスタムURIアイテム → アイコンを抽出
- フォルダ/グループ → 除外（処理対象外）

### 🎨 アイコン取得（全タブ）
**すべてのタブ**のアイコンが未設定のアイテムを対象に、アイコンを一括で取得します。

---

## 進捗表示機能

アイコン取得処理の進行状況をリアルタイムで確認できる統合進捗表示機能を提供します。

### 統合進捗バー

**主な特徴:**
- **フェーズ管理**: ファビコン取得 + アイコン抽出を統合管理
- **非モーダル設計**: メイン画面下部に表示され、他の操作を継続可能
- **リアルタイム更新**: 各アイテム処理完了時に即座に進捗を更新
- **自動非表示**: 処理完了後3秒で自動的に非表示

### 詳細モーダル

進捗バーをクリックすると詳細情報を表示：
- フェーズごとの進捗（成功・失敗件数）
- エラー一覧（アイテム名、パス/URL、エラーメッセージ）
- 経過時間・推定残り時間

### 表示例

**処理中:**
```
[▓▓▓▓▓▓░░░░] 60% - フェーズ 1/2
ファビコン取得中: 12/20
```

**完了時:**
```
✓ アイコン取得完了
```

---

## API仕様

### fetchIconsCombined

ファビコンとアイコンを統合的に一括取得する統合API。

```typescript
async function fetchIconsCombined(
  urls: string[],
  items: IconItem[],
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
): Promise<{
  favicons: Record<string, string | null>;
  icons: Record<string, string | null>;
}>
```

### CombinedProgressManager

複数フェーズの進捗を統合管理するクラス。

```typescript
constructor(
  phaseTypes: ('favicon' | 'icon')[],
  phaseTotals: number[],
  window: BrowserWindow | null
)
```

**メソッド:**
- `start()`: 処理開始イベントを送信
- `startPhase(phaseIndex: number)`: 指定フェーズの開始
- `update(displayText: string, isError?: boolean, errorMessage?: string)`: 進捗更新
- `completePhase()`: 現在のフェーズ完了
- `completeAll()`: 全体完了イベントを送信

### 型定義

```typescript
interface IconProgress {
  currentPhase: number;      // 現在のフェーズ番号（1から開始）
  totalPhases: number;       // 総フェーズ数
  phases: IconPhaseProgress[];
  isComplete: boolean;
  startTime: number;
}

interface IconPhaseProgress {
  type: 'favicon' | 'icon';
  current: number;
  total: number;
  currentItem: string;
  errors: number;
  startTime: number;
  isComplete: boolean;
  results?: IconProgressResult[];
}
```

---

## トラブルシューティング

### ファビコンが取得できない場合

1. **ネットワーク接続を確認**
   - プロキシ設定
   - ファイアウォール

2. **サイトの設定を確認**
   - robots.txtによるブロック
   - CORSポリシー

3. **キャッシュをクリア**
   - `%APPDATA%/quickdashlauncher/config/favicons/`のファイルを削除

### エラーの種類

| エラー種類 | 説明 | タイムアウト |
|-----------|------|------------|
| HTMLダウンロード | ページの取得失敗 | 10秒 |
| ファビコンダウンロード | アイコンの取得失敗 | 5秒 |
| HTTPエラー | サーバーエラー（4xx, 5xx） | - |
| ネットワークエラー | DNS、SSL証明書など | - |

これらのエラー情報は、進捗モーダルのエラー一覧で確認できます。
