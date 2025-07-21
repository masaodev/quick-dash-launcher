# カスタムURIアイコン

カスタムURIスキーマ（例: `obsidian://`、`ms-excel://`）のアイコンは、Windowsレジストリから関連付けられたアプリケーションを検索して取得します。

## 取得優先順位

1. **レジストリベースの取得**: Windowsレジストリからスキーマハンドラーアプリケーションを検索し、そのアイコンを抽出
2. **拡張子ベースの取得**: URIに対応する拡張子のアイコン（例: `ms-excel://` → `.xlsx`）
3. **デフォルトアイコン**: 🔗絵文字

## レジストリクエリプロセス

1. **スキーマ検出**: URIから`://`前のスキーマを抽出（例: `obsidian://` → `obsidian`）
2. **レジストリ検索**: 
   ```cmd
   reg query "HKEY_CLASSES_ROOT\[スキーマ]" /ve
   reg query "HKEY_CLASSES_ROOT\[スキーマ]\shell\open\command" /ve
   ```
3. **実行ファイルパス抽出**: コマンドから実行ファイルパスを抽出
4. **環境変数展開**: `%PROGRAMFILES%`等を実際のパスに変換
5. **アイコン抽出**: `extract-file-icon`で32pxアイコンを抽出

## 対応例

| URIスキーマ | ハンドラーアプリ | アイコン |
|------------|--------------|--------|
| `obsidian://` | Obsidian.exe | Obsidianアプリアイコン |
| `ms-excel://` | EXCEL.EXE | Microsoft Excelアイコン |
| `vscode://` | Code.exe | Visual Studio Codeアイコン |
| `steam://` | steam.exe | Steamアイコン |

## 関連ドキュメント

- [アイコンシステム](icon-system.md) - アイコンシステム全体の概要
- [ファビコン取得システム](icon-favicon.md) - ファビコン取得の詳細仕様