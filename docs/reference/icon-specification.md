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

EXEファイルからアイコンを直接抽出します。

### 技術仕様

| 項目 | 値 |
|------|-----|
| **使用ライブラリ** | `extract-file-icon` |
| **抽出サイズ** | 32px |
| **対応形式** | `.exe`, `.dll` |

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

## 関連ドキュメント

- **[アイコンシステム](../manual/icon-system.md)** - アイコンシステムの使い方
- **[データファイル形式仕様](data-file-format.md)** - カスタムアイコンの指定方法
