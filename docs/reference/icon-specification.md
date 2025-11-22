# アイコン仕様

QuickDashLauncherのアイコン処理に関する完全な仕様です。

## アイコンの保存先

アイコンは種類ごとに整理された専用のディレクトリに保存されます：

| アイコン種類 | 保存場所 | ファイル名形式 |
|-------------|---------|--------------|
| **ファビコン** | `%APPDATA%/quickdashlauncher/config/favicons/` | `{domain}_favicon_{size}.png` |
| **EXEアイコン** | `%APPDATA%/quickdashlauncher/config/icons/` | `{hash}_icon.png` |
| **カスタムURIアイコン** | `%APPDATA%/quickdashlauncher/config/icons/` | `uri_{schema}_icon.png` |
| **拡張子アイコン** | `%APPDATA%/quickdashlauncher/config/icons/extensions/` | `{extension}_icon.png` |

### ファイル名形式の詳細

#### ファビコン
```
{domain}_favicon_{size}.png
```
- **domain**: URLのドメイン部分（例: `github.com`）
- **size**: アイコンサイズ（`32` または `64`）
- **例**: `github.com_favicon_64.png`

#### カスタムURIアイコン
```
uri_{schema}_icon.png
```
- **schema**: URIスキーマ名（例: `obsidian`, `ms-excel`）
- **例**: `uri_obsidian_icon.png`

## アイコンサイズ

| 種類 | サイズ | 備考 |
|------|-------|------|
| **ファビコン（推奨）** | 64px | デフォルトサイズ |
| **ファビコン（互換）** | 32px | 後方互換性のため維持 |
| **EXEアイコン** | 32px | `extract-file-icon`ライブラリの制約 |
| **カスタムURIアイコン** | 32px | レジストリベースの取得 |
| **拡張子アイコン** | 32px | システムアイコン |

### 後方互換性

既存の32pxキャッシュも引き続き使用可能にするため、以下の順序でチェック：

1. 64pxファイルが存在するか確認
2. なければ32pxファイルを確認
3. どちらもなければ新規取得

## デフォルトアイコン（絵文字）

アイコンが取得できない場合は、アイテムの種類に応じた絵文字を使用：

| アイテム種類 | 絵文字 | 説明 |
|-------------|-------|------|
| **ファイル** | 📄 | 通常のファイル |
| **フォルダ** | 📁 | ディレクトリ |
| **ウェブ** | 🌐 | HTTP/HTTPS URL |
| **アプリケーション** | ⚙️ | 実行可能ファイル |
| **カスタムURI** | 🔗 | カスタムURIスキーマ |
| **グループ** | 📦 | グループアイテム |

## ファビコン取得仕様

### 取得順序

ファビコンは以下の順序で複数のソースを試行します：

#### 1. HTMLメタタグの解析

以下のタグを優先順に確認：

| 優先度 | タグ | 説明 |
|-------|------|------|
| 1 | `<link rel="icon" href="...">` | 標準的なファビコン指定 |
| 2 | `<link rel="shortcut icon" href="...">` | レガシーなファビコン指定 |
| 3 | `<link rel="apple-touch-icon" href="...">` | Appleデバイス向け高解像度アイコン |
| 4 | `<meta property="og:image" content="...">` | Open Graphプロトコルの画像 |

#### 2. 標準的な場所の確認

メタタグから取得できない場合、以下のパスを確認：

| 優先度 | パス | 説明 |
|-------|------|------|
| 1 | `/favicon.ico` | 最も一般的なファビコンパス |
| 2 | `/favicon.png` | PNG形式のファビコン |
| 3 | `/apple-touch-icon.png` | Appleデバイス向け（180px） |
| 4 | `/apple-touch-icon-precomposed.png` | Appleデバイス向け（180px、光沢効果なし） |
| 5 | `/icon.png` | 汎用アイコン |
| 6 | `/logo.png` | ロゴ画像 |

### 技術的な特徴

| 項目 | 仕様 |
|------|------|
| **デフォルト解像度** | 64px |
| **HTML読み込みサイズ** | 最初の5KBのみ（効率化） |
| **HTMLダウンロードタイムアウト** | 10秒 |
| **ファビコンダウンロードタイムアウト** | 5秒 |
| **エラーハンドリング** | 各ソースで失敗しても次のソースを試行 |
| **キャッシュ命名規則** | `{domain}_favicon_{size}.png` |

## カスタムURIアイコン取得仕様

### 取得優先順位

カスタムURIスキーマのアイコンは以下の順序で取得を試行：

| 優先度 | 取得方法 | 説明 |
|-------|---------|------|
| 1 | **レジストリベース** | Windowsレジストリからスキーマハンドラーアプリを検索 |
| 2 | **拡張子ベース** | URIに対応する拡張子のアイコン（例: `ms-excel://` → `.xlsx`） |
| 3 | **デフォルト** | 🔗絵文字 |

### レジストリクエリプロセス

カスタムURIアイコンの取得手順：

#### 1. スキーマ検出
URIから`://`前のスキーマを抽出

**例**: `obsidian://vault/notes` → `obsidian`

#### 2. レジストリ検索

以下のレジストリキーを照会：

```cmd
reg query "HKEY_CLASSES_ROOT\[スキーマ]" /ve
reg query "HKEY_CLASSES_ROOT\[スキーマ]\shell\open\command" /ve
```

**例**:
```cmd
reg query "HKEY_CLASSES_ROOT\obsidian" /ve
reg query "HKEY_CLASSES_ROOT\obsidian\shell\open\command" /ve
```

#### 3. 実行ファイルパス抽出

コマンド文字列から実行ファイルのパスを抽出

**例**:
```
"C:\Program Files\Obsidian\Obsidian.exe" "%1"
→ C:\Program Files\Obsidian\Obsidian.exe
```

#### 4. 環境変数展開

環境変数を実際のパスに変換

**例**:
```
%PROGRAMFILES%\Obsidian\Obsidian.exe
→ C:\Program Files\Obsidian\Obsidian.exe
```

#### 5. アイコン抽出

`extract-file-icon`ライブラリを使用して32pxアイコンを抽出

### 対応URIスキーマ例

| URIスキーマ | ハンドラーアプリ | アイコン |
|------------|--------------|--------|
| `obsidian://` | Obsidian.exe | Obsidianアプリアイコン |
| `ms-excel://` | EXCEL.EXE | Microsoft Excelアイコン |
| `vscode://` | Code.exe | Visual Studio Codeアイコン |
| `steam://` | steam.exe | Steamアイコン |
| `slack://` | slack.exe | Slackアイコン |
| `zoom://` | Zoom.exe | Zoomアイコン |

## 拡張子ベースのアイコン取得

ファイルアイテムは、拡張子に基づいてシステムから関連付けられたアイコンを取得します。

### 対応拡張子例

| 拡張子 | アイコン |
|-------|--------|
| `.txt` | メモ帳アイコン |
| `.pdf` | PDFリーダーアイコン |
| `.docx` | Microsoft Wordアイコン |
| `.xlsx` | Microsoft Excelアイコン |
| `.png` | 画像ビューアーアイコン |

## アプリケーションアイコン取得

実行可能ファイルからアイコンを抽出します。

### 技術仕様

| 項目 | 値 |
|------|-----|
| **使用ライブラリ** | `extract-file-icon` |
| **抽出サイズ** | 32px |
| **対応形式（直接抽出）** | `.exe`, `.lnk`, `.dll` |
| **対応形式（拡張子ベース）** | `.bat`, `.cmd`, `.com` |

### 処理方法の違い

#### .exe / .lnkファイル
実行ファイルまたはショートカットファイルから直接アイコンリソースを抽出します。

#### .bat / .cmd / .comファイル
これらのファイルはテキストファイルのため、アイコンリソースを持ちません。
代わりに、ファイル拡張子に基づいてWindowsのシステム関連付けからアイコンを取得します。

**処理フロー:**
1. ファイル拡張子を検出（`.bat`, `.cmd`, `.com`）
2. `extractFileIconByExtension`関数を呼び出し
3. Windowsレジストリから拡張子に関連付けられたアイコンを取得
4. `extensions/`フォルダにキャッシュ

### パス解決機能

アイコン抽出時には、以下の高度なパス解決機能を提供します：

#### 1. ファイル名のみ指定時のPATH解決

ファイル名のみが指定され、パスが含まれない場合（`\`や`/`を含まない）、Windows環境変数`PATH`から実行ファイルを検索します。

**処理フロー:**
1. ファイルの存在確認（指定されたパスで直接アクセス）
2. ファイルが見つからない場合、Windows `where` コマンドを実行
3. 検索結果の最初のパスを使用してアイコンを抽出

**例:**
```
入力: notepad.exe
検索: where "notepad.exe"
結果: C:\Windows\System32\notepad.exe
→ 解決されたパスからアイコンを抽出
```

**制限事項:**
- Windows専用機能（`where`コマンド使用）
- PATH環境変数に含まれるディレクトリのみが検索対象

#### 2. シンボリックリンクの解決

シンボリックリンク（またはジャンクション）が指定された場合、実際のターゲットファイルを解決してアイコンを抽出します。

**処理フロー:**
1. `fs.lstatSync()`でファイル属性を確認
2. シンボリックリンクの場合、`fs.readlinkSync()`でターゲットパスを取得
3. 解決されたターゲットパスからアイコンを抽出

**例:**
```
入力: C:\Users\AppData\Local\Microsoft\WindowsApps\Code.exe（シンボリックリンク）
解決: C:\Program Files\Microsoft VS Code\Code.exe
→ 実際のEXEファイルからアイコンを抽出
```

**WindowsAppsフォルダ対応:**
- Windows 10/11の`WindowsApps`フォルダは特殊な権限設定のため、`fs.realpathSync()`では権限エラーが発生する
- `fs.readlinkSync()`を使用することで、権限エラーを回避してシンボリックリンクを解決

**制限事項:**
- リンクターゲットが存在しない場合、元のパスでアイコン抽出を試行
- 解決に失敗した場合でも処理を継続（エラー時は元のパスを使用）

## カスタムアイコン

ユーザーが手動で指定するカスタムアイコン機能もサポートします。

### 保存場所

```
custom-icons/
```

プロジェクトルートからの相対パス

### 対応形式

- `.png`
- `.jpg` / `.jpeg`
- `.ico`
- `.svg`

### データファイル指定方法

```
表示名,パス,引数,カスタムアイコンファイル名
```

**例**:
```
MyApp,C:\MyApp\app.exe,,custom-icon.png
```

詳細は **[データファイル形式仕様](data-file-format.md#カスタムアイコンの処理)** を参照してください。

## アイコン取得API

### fetchIconsCombined

ファビコンとアイコンを統合的に一括取得する統合API。

**シグネチャ:**
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

**パラメータ:**
- `urls`: ファビコンを取得するURL配列
- `items`: アイコンを抽出するアイテム配列
- `faviconsFolder`: ファビコン保存先ディレクトリ
- `iconsFolder`: アイコン保存先ディレクトリ
- `extensionsFolder`: 拡張子アイコン保存先ディレクトリ

**戻り値:**
- `favicons`: URLをキーとするファビコンパスのマップ
- `icons`: アイテムIDをキーとするアイコンパスのマップ

**特徴:**
- ファビコン取得とアイコン抽出を順次実行
- `CombinedProgressManager`を使用して統合進捗管理
- 各フェーズの進捗をリアルタイム通知
- アイテム名とパス/URLを両方表示（改行区切り）
- エラー発生時も処理を継続し、詳細を記録

### CombinedProgressManager

複数フェーズの進捗を統合管理するクラス。

**コンストラクタ:**
```typescript
constructor(
  phaseTypes: ('favicon' | 'icon')[],
  phaseTotals: number[],
  window: BrowserWindow | null
)
```

**パラメータ:**
- `phaseTypes`: 各フェーズの種別配列
- `phaseTotals`: 各フェーズの総アイテム数配列
- `window`: 進捗イベントを送信するウィンドウ

**メソッド:**
- `start()`: 処理開始イベントを送信
- `startPhase(phaseIndex: number)`: 指定フェーズの開始
- `update(displayText: string, isError?: boolean, errorMessage?: string)`: アイテム処理結果の記録（displayTextは「名前\nパス」形式）
- `completePhase()`: 現在のフェーズ完了
- `completeAll()`: 全体完了イベントを送信

## アイコン進捗型定義

### IconProgressResult

個別のアイコン処理結果を表す型。

```typescript
interface IconProgressResult {
  /** アイテム名またはURL */
  itemName: string;
  /** 成功したかどうか */
  success: boolean;
  /** エラーメッセージ（失敗時のみ） */
  errorMessage?: string;
  /** 処理の種別（ファビコン取得またはアイコン抽出） */
  type: 'favicon' | 'icon';
}
```

**変更点（v1.x.x）:**
- `type`フィールドを追加：処理種別を識別可能に

### IconPhaseProgress

単一フェーズの進捗情報を表す型。

```typescript
interface IconPhaseProgress {
  /** 処理の種別（ファビコン取得またはアイコン抽出） */
  type: 'favicon' | 'icon';
  /** 現在処理完了したアイテム数 */
  current: number;
  /** 処理対象の総アイテム数 */
  total: number;
  /** 現在処理中のアイテム名またはURL */
  currentItem: string;
  /** エラーが発生したアイテム数 */
  errors: number;
  /** 処理開始時刻（ミリ秒） */
  startTime: number;
  /** 処理が完了したかどうか */
  isComplete: boolean;
  /** 処理結果の詳細リスト */
  results?: IconProgressResult[];
}
```

**新規追加（v1.x.x）:**
複数フェーズの進捗を管理するために新規追加された型。

### IconProgress

アイコン取得処理の統合進捗状況を表す型。

```typescript
interface IconProgress {
  /** 現在のフェーズ番号（1から開始） */
  currentPhase: number;
  /** 総フェーズ数 */
  totalPhases: number;
  /** 各フェーズの進捗情報 */
  phases: IconPhaseProgress[];
  /** 全体の処理が完了したかどうか */
  isComplete: boolean;
  /** 全体の処理開始時刻（ミリ秒） */
  startTime: number;
}
```

**変更点（v1.x.x）:**
- 単一フェーズから複数フェーズ管理に変更
- `type`, `current`, `total`, `currentItem`, `errors`は`phases`配列内に移動
- `currentPhase`, `totalPhases`, `phases`フィールドを追加

### IconProgressState

React コンポーネント内での進捗状態管理用の型。

```typescript
interface IconProgressState {
  /** 進捗処理がアクティブかどうか */
  isActive: boolean;
  /** 現在の進捗情報 */
  progress: IconProgress | null;
}
```

## 削除されたAPI

以下のAPIは統合APIに置き換えられ、削除されました：

### fetchFaviconsWithProgress（削除）

**理由:** `fetchIconsCombined`に統合され、複数フェーズの進捗を一元管理するため。

### extractIconsWithProgress（削除）

**理由:** `fetchIconsCombined`に統合され、複数フェーズの進捗を一元管理するため。

## 関連ドキュメント

- **[アイコンシステム](../manual/icon-system.md)** - アイコンシステムの使い方
- **[アイコン進捗表示](../manual/icon-progress.md)** - 統合進捗表示の詳細
- **[データファイル形式仕様](data-file-format.md)** - カスタムアイコンの指定方法
