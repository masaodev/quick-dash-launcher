# アイコン処理システム

## 保存先の分離 (2025-07-04更新)
- ファビコン: `%APPDATA%/quickdashlauncher/config/favicons/`
- EXEアイコン: `%APPDATA%/quickdashlauncher/config/icons/`
- カスタムURIアイコン: `%APPDATA%/quickdashlauncher/config/icons/` (uri_[スキーマ]_icon.png形式)
- 拡張子アイコン: `%APPDATA%/quickdashlauncher/config/icons/extensions/`

## 取得方法
- ウェブサイト: ファビコンをキャッシュ
  - 新しい`FaviconService`クラスでHTMLメタタグを解析し、複数ソースから取得
  - デフォルト64px（高解像度対応）、既存の32pxキャッシュとの互換性維持
  - 詳細は[ファビコン実装仕様](favicon-implementation.md)を参照
- アプリケーション: `extract-file-icon`を使用してアイコン抽出
- カスタムURI: **新機能** (2025-07-04追加)
  - **第1優先**: Windowsレジストリからスキーマハンドラーアプリケーションを検索し、そのアイコンを抽出
  - **第2優先**: ファイル拡張子ベースのアイコン取得（ms-excel:// → .xlsx）
  - **第3優先**: デフォルト絵文字（🔗）
  - 例: `obsidian://` → Obsidianアプリのアイコン、`ms-excel://` → Microsoft Excelのアイコン
- ファイル: ファイル拡張子ベースのアイコン取得
- デフォルト: 絵文字アイコン（📄ファイル、📁フォルダ、🌐ウェブ、⚙️アプリ、🔗カスタムURI）

## ボタン機能 (2025-07-04更新)
- 🌐 ファビコン取得: すべてのURLアイテムのファビコンを一括取得
- 🎨 全アイコンを抽出: EXE/ファイル/カスタムURIアイテムのアイコンを一括取得（URLを除く）
  - カスタムURIは**レジストリベースのアイコン取得**を優先実行

## カスタムURIアイコン抽出の技術詳細 (2025-07-04追加)

### レジストリクエリプロセス
1. **スキーマ検出**: URIから`://`前のスキーマを抽出（例: `obsidian://` → `obsidian`）
2. **レジストリ検索**: 
   ```cmd
   reg query "HKEY_CLASSES_ROOT\[スキーマ]" /ve
   reg query "HKEY_CLASSES_ROOT\[スキーマ]\shell\open\command" /ve
   ```
3. **実行ファイルパス抽出**: コマンドから`"path.exe"`または`path.exe`を抽出
4. **環境変数展開**: `%PROGRAMFILES%`等を実際のパスに変換
5. **ファイル存在確認**: 実行ファイルの存在を確認

### アイコン抽出とキャッシュ
- **抽出**: `extract-file-icon`ライブラリで32pxアイコンを抽出
- **キャッシュ**: `uri_[スキーマ]_icon.png`として保存
- **読み込み優先順位**: 
  1. キャッシュされたカスタムURIアイコン
  2. 拡張子ベースのアイコン
  3. デフォルト🔗絵文字

### 対応例
| URIスキーマ | ハンドラーアプリ | アイコン |
|------------|--------------|--------|
| `obsidian://` | Obsidian.exe | Obsidianアプリアイコン |
| `ms-excel://` | EXCEL.EXE | Microsoft Excelアイコン |
| `vscode://` | Code.exe | Visual Studio Codeアイコン |
| `steam://` | steam.exe | Steamアイコン |