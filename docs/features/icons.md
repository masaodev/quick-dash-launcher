# アイコンシステム

QuickDashLauncherのアイコン処理システムは、様々な種類のアイテム（ウェブサイト、アプリケーション、ファイル、カスタムURI）に対して適切なアイコンを取得・管理します。

## アイコンの保存先・形式

アイコンは種類ごとに専用のディレクトリに保存されます：

| アイコン種類 | 保存場所 | ファイル名形式 | サイズ |
|-------------|---------|--------------|-------|
| **ファビコン** | `%APPDATA%/quick-dash-launcher/config/favicons/` | `{domain}_favicon_{size}.png` | 64px（推奨）/ 32px（互換） |
| **EXEアイコン** | `%APPDATA%/quick-dash-launcher/config/icons/` | `{hash}_icon.png` | 32px |
| **カスタムURIアイコン** | `%APPDATA%/quick-dash-launcher/config/icons/` | `uri_{schema}_icon.png` | 32px |
| **拡張子アイコン** | `%APPDATA%/quick-dash-launcher/config/icons/extensions/` | `{extension}_icon.png` | 32px |

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

**保存場所:** `%APPDATA%/quick-dash-launcher/config/custom-icons/`

**ファイル名形式:** `{MD5ハッシュ}.png`（アイテム識別子からMD5ハッシュを生成）

**対応形式:** `.png`, `.jpg`, `.jpeg`, `.ico`, `.svg`

**設定方法:**
1. アイテム管理画面でアイテムを選択
2. コンテキストメニューから「カスタムアイコンを設定」を選択
3. 画像ファイルを選択

**データファイル指定方法:**
```
表示名,パス,引数,カスタムアイコンファイル名
MyApp,C:\MyApp\app.exe,,{hash}.png
```

詳細は[データファイル形式仕様](../architecture/file-formats/data-format.md#カスタムアイコンの処理)を参照。

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
- `update(currentItem: string, incrementErrors?: boolean, errorMessage?: string)`: 進捗更新
- `completePhase()`: 現在のフェーズ完了（次のフェーズへ自動的に移行）
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

## ウィンドウアイコン取得

ウィンドウ検索機能では、開いているウィンドウから直接アイコンを取得して表示します。

### 取得方法

Windows APIを使用してウィンドウからアイコンハンドル（HICON）を取得し、GDI+でPNG base64に変換します。

**使用API:**
- `SendMessageW` (WM_GETICON): ウィンドウメッセージでアイコンを取得
- `GetClassLongPtrW` (GCLP_HICON): クラスアイコンを取得
- `GetWindowThreadProcessId`: プロセスIDを取得
- `OpenProcess`: プロセスハンドルを開く
- `QueryFullProcessImageNameW`: 実行ファイルパスを取得

### アイコン取得の優先順位

| 優先度 | 取得方法 | 説明 |
|-------|---------|------|
| 1 | WM_GETICON (ICON_BIG) | 大きいアイコン |
| 2 | WM_GETICON (ICON_SMALL2) | 小さいアイコン（32px） |
| 3 | WM_GETICON (ICON_SMALL) | 小さいアイコン（16px） |
| 4 | GetClassLongPtrW (GCLP_HICON) | クラスアイコン |

### 変換処理

**GDI+ による HICON → PNG base64 変換:**
1. GDI+を初期化（`GdiplusStartup`）
2. HICONからビットマップを作成（`GdipCreateBitmapFromHICON`）
3. 一時ファイルにPNG形式で保存（`GdipSaveImageToFile`）
4. ファイルを読み込んでbase64エンコード
5. GDI+リソースを解放（`GdipDisposeImage`, `GdiplusShutdown`）
6. 一時ファイルを削除

### メモリリーク対策

以下の対策を実装して、メモリリークを防止しています：

1. **GDI+ リソース解放**: `GdipDisposeImage`と`GdiplusShutdown`を必ず実行
2. **koffi callback 解放**: Windows API呼び出し後のコールバック解放処理
3. **一時ファイル削除**: 変換後のPNGファイルを確実に削除（try-finallyブロック）

### 実装詳細

**実装ファイル:**
- `src/main/utils/nativeWindowControl.ts`: `getWindowIcon()`, `convertIconToBase64()`, `getExecutablePathFromProcessId()`
- `src/main/ipc/windowSearchHandlers.ts`: アイコン取得処理の統合
- `src/common/types.ts`: `WindowInfo`型に`icon`, `executablePath`フィールドを追加

### 表示

ウィンドウ検索モード（検索欄で`<`を入力）で、各ウィンドウにアイコンが表示されます。アイコンが取得できない場合は、デフォルトの🪟絵文字を表示します。


### GDI+エラーハンドリング

ウィンドウアイコン取得処理では、詳細なエラーログを出力してトラブルシューティングを支援します。

#### GDI+ステータスコード一覧

| コード | 説明 | 主な原因 |
|-------|------|---------|
| 0 | Ok | 正常終了 |
| 1 | GenericError | 一般的なエラー |
| 2 | InvalidParameter | 無効なパラメータ（hIconが無効など） |
| 3 | OutOfMemory | メモリ不足 |
| 4 | ObjectBusy | オブジェクトがビジー状態 |
| 5 | InsufficientBuffer | バッファ不足 |
| 6 | NotImplemented | 未実装の機能 |
| 7 | Win32Error | Win32 APIエラー（ファイル保存失敗など） |
| 8 | WrongState | 不正な状態 |
| 9 | Aborted | 処理中断 |
| 10 | FileNotFound | ファイルが見つからない |
| 11 | ValueOverflow | 値のオーバーフロー |
| 12 | AccessDenied | アクセス拒否（権限不足） |
| 13 | UnknownImageFormat | 未知の画像形式 |
| 14 | FontFamilyNotFound | フォントファミリーが見つからない |
| 15 | FontStyleNotFound | フォントスタイルが見つからない |
| 16 | NotTrueTypeFont | TrueTypeフォントではない |
| 17 | UnsupportedGdiplusVersion | サポートされていないGDI+バージョン |
| 18 | GdiplusNotInitialized | GDI+が初期化されていない |
| 19 | PropertyNotFound | プロパティが見つからない |
| 20 | PropertyNotSupported | サポートされていないプロパティ |

#### エラーログの形式

エラーログには、ステータスコード番号と説明、関連する文脈情報が含まれます：

```
[convertIconToBase64] GdiplusStartup failed: status=3 (OutOfMemory), hIcon=12345678
[convertIconToBase64] GdipCreateBitmapFromHICON failed: status=2 (InvalidParameter), hIcon=12345678, bitmap=null
[convertIconToBase64] GdipSaveImageToFile failed: status=7 (Win32Error), path=C:\Users\...\icon_xxx.png
[convertIconToBase64] Unexpected error: hIcon=12345678, error=EACCES: permission denied
```

#### エラーログの読み方

**GdiplusStartup失敗の場合:**
- `status=3 (OutOfMemory)` → メモリ不足。他のアプリケーションを閉じてメモリを確保
- `status=17 (UnsupportedGdiplusVersion)` → システム更新が必要

**GdipCreateBitmapFromHICON失敗の場合:**
- `status=2 (InvalidParameter), bitmap=null` → ウィンドウのアイコンハンドルが無効
- 一部のアプリケーションは標準的なアイコンを提供しない場合があります

**GdipSaveImageToFile失敗の場合:**
- `status=7 (Win32Error)` → 一時フォルダへの書き込み権限を確認
- `status=12 (AccessDenied)` → ユーザー権限の確認が必要

**Unexpected error:**
- `error=EACCES` → ファイルシステムの権限問題
- `error=ENOSPC` → ディスク容量不足

#### トラブルシューティングへの活用

エラーログを確認することで、アイコン取得失敗の原因を特定できます：

1. **頻繁に同じステータスコードが出る場合**: システムレベルの問題（メモリ不足、権限問題など）
2. **特定のアプリケーションでのみ失敗**: そのアプリが標準的なアイコンを提供していない可能性
3. **一時的なエラー**: 再起動で解決する場合があります
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
   - `%APPDATA%/quick-dash-launcher/config/favicons/`のファイルを削除

### エラーの種類

| エラー種類 | 説明 | タイムアウト |
|-----------|------|------------|
| HTMLダウンロード | ページの取得失敗 | 10秒 |
| ファビコンダウンロード | アイコンの取得失敗 | 5秒 |
| HTTPエラー | サーバーエラー（4xx, 5xx） | - |
| ネットワークエラー | DNS、SSL証明書など | - |

これらのエラー情報は、進捗モーダルのエラー一覧で確認できます。
