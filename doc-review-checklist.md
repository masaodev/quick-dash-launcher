# ドキュメント検証チェックリスト

実行日時: 2026-02-20
修正完了: 2026-02-20

## 確認観点

### コードとの整合性
- コマンド・スクリプトが package.json と一致しているか
- ファイルパス・コンポーネント名が実在するか
- API・IPCチャンネル名が正しいか
- 機能説明が実装と一致しているか
- 廃止された機能・コードが残っていないか

### ドキュメント体系の整合性
- **screens/** - 画面単位の操作・UI仕様（主軸）、全画面網羅
- **features/** - 横断的機能のみ（複数画面にまたがる機能・概念）
- **参照方向** - screens → features → architecture（逆方向禁止）

---

## 1. セットアップ・開発 (setup/)

- [x] docs/setup/getting-started.md ✅ 修正済み
- [x] docs/setup/development.md ✅ 修正済み
- [x] docs/setup/build-deploy.md ✅ 修正済み

**修正内容:**
- getting-started.md: Node.js >=22.12.0 明記、clipboardタイプ追加
- development.md: App User Model ID修正、ウィンドウサイズ修正(600x400/1200x1000)、コンポーネント名更新、DEVアイコンパス修正、存在しないファイル参照削除
- build-deploy.md: ファビコンキャッシュパス修正(config/icon-cache/favicons/)

---

## 2. 画面ドキュメント (screens/)

- [x] docs/screens/README.md ✅ 修正済み
- [x] docs/screens/screen-transitions.md ✅ 修正済み
- [x] docs/screens/main-window.md ✅ 修正済み
- [x] docs/screens/admin-window.md ✅ 修正済み
- [x] docs/screens/workspace-window.md ✅ 修正済み
- [x] docs/screens/register-modal.md ✅ 修正済み
- [x] docs/screens/bookmark-import-modal.md ✅ 修正済み
- [x] docs/screens/group-item-selector-modal.md ✅ 修正済み
- [x] docs/screens/icon-progress-detail-modal.md ✅ 修正済み
- [x] docs/screens/dir-options-editor.md ✅ 修正済み
- [x] docs/screens/context-menu.md ✅ 修正済み
- [x] docs/screens/dialogs.md ✅ 修正済み
- [x] docs/screens/first-launch-setup.md ✅ 修正済み
- [x] docs/screens/hotkey-input.md ✅ 問題なし

**修正内容:**
- README.md: Ctrl+Alt+W→Ctrl+W、未記載モーダル8件追加
- screen-transitions.md: Mermaid図にMain⇔Workspace遷移追加、ショートカット修正
- main-window.md: 実行履歴検索モード削除、登録ボタンドロップダウン化反映、設定メニュー項目追加
- admin-window.md: タブ名修正、バックアップ設定削除、IPCチャンネル名修正
- workspace-window.md: フィルタ機能修正(キーワード検索+スコープ)、グループ操作をコンテキストメニュー方式に修正
- register-modal.md: clipboardタイプ追加、型名修正(app/customUri)、ウィンドウサイズ修正
- bookmark-import-modal.md: UI全面刷新反映(インポート元選択、プロファイル選択等)
- context-menu.md: clipboardタイプ追加、メモ表示メニュー追加
- dialogs.md: CSSコード例修正、CSS変数修正
- first-launch-setup.md: itemSearchHotkeyセクション追加
- group-item-selector-modal.md: ClipboardItem除外追加
- icon-progress-detail-modal.md: type必須フィールド追加、左ボーダー方式に修正
- dir-options-editor.md: JsonDirOptions型修正(オプショナル)、JSON形式に修正

---

## 3. 機能ドキュメント (features/)

- [x] docs/features/README.md ✅ 修正済み（変更なし - 逆方向参照なし確認済み）
- [x] docs/features/group-launch.md ✅ 修正済み
- [x] docs/features/icons.md ✅ 修正済み
- [x] docs/features/keyboard-shortcuts.md ✅ 修正済み
- [x] docs/features/toast-notifications.md ✅ 修正済み
- [x] docs/features/workspace.md ✅ 修正済み

**修正内容:**
- group-launch.md: 自動保存方式に修正、逆方向参照削除、アンカーリンク修正
- icons.md: 全アイコンパス修正(icon-cache/サブフォルダ)、ファイル名パターン修正、タイムアウト値修正
- keyboard-shortcuts.md: 2段階検索モード(normal|window)に修正、逆方向参照削除、settings.mdリンク修正
- toast-notifications.md: 表示位置修正(画面下部中央)、逆方向参照削除
- workspace.md: Ctrl+W修正、settings.mdリンク修正、逆方向参照削除

---

## 4. アーキテクチャ (architecture/)

- [x] docs/architecture/overview.md ✅ 修正済み
- [x] docs/architecture/checklist.md ✅ 問題なし
- [x] docs/architecture/component-naming.md ✅ 修正済み
- [x] docs/architecture/css-design.md ✅ 修正済み
- [x] docs/architecture/glossary.md ✅ 修正済み
- [x] docs/architecture/ipc-channels.md ✅ 修正済み
- [x] docs/architecture/ui-components.md ✅ 修正済み
- [x] docs/architecture/window-control.md ✅ 修正済み
- [x] docs/architecture/file-formats/README.md ✅ 修正済み
- [x] docs/architecture/file-formats/data-format.md ✅ 修正済み
- [x] docs/architecture/file-formats/settings-format.md ✅ 修正済み
- [x] docs/architecture/file-formats/workspace-format.md ✅ 修正済み

**修正内容:**
- overview.md: ExecutionHistoryService削除、サービス・ハンドラー追加(ClipboardService等)、型パス修正
- component-naming.md: Admin系コンポーネントプレフィックス一覧追加
- css-design.md: CSSファイル構成更新、.btn-sm高さ修正(34px)、存在しないクラス削除、breakpoint変数削除
- glossary.md: clipboardタイプ追加、廃止済み用語削除(RawDataLine等)、SearchMode修正(normal|window)
- ipc-channels.md: パラメータ定義修正、execution-history削除、クリップボード/バックアップ/自動取込チャンネル追加
- ui-components.md: .toolbar-button削除
- window-control.md: virtualDesktopディレクトリ構成反映、shouldHideOnBlur削除、リトライ間隔修正
- file-formats/README.md: settings.json修正、execution-history削除、スナップショットバックアップ反映
- data-format.md: datafiles/パス修正、icon-cache/パス修正、clipboardタイプ追加、WindowOperationItem削除
- settings-format.md: settings.json修正、デフォルト値修正、存在しない設定削除、新設定追加
- workspace-format.md: execution-history削除、clipboardタイプ追加、フィールド追加

---

## 5. テスト (testing/)

- [x] docs/testing/README.md ✅ 修正済み
- [x] docs/testing/browser-automation.md ✅ 問題なし
- [x] docs/testing/manual-checklist.md ✅ 修正済み

**修正内容:**
- README.md: ConfigFileHelper API修正、ファイルパス修正(datafiles/)、テンプレート追加
- manual-checklist.md: グループ起動間隔修正(100ms)、設定メニュー修正、トレイメニュー追加

---

## 6. その他

- [x] docs/README.md ✅ 修正済み

**修正内容:**
- README.md: settings.mdリンク削除

---

## サマリー

| カテゴリ | ファイル数 | 確認完了 | 修正済み | 問題なし |
|---------|-----------|---------|---------|---------|
| setup/ | 3 | 3 | 3 | 0 |
| screens/ | 14 | 14 | 13 | 1 |
| features/ | 6 | 6 | 5 | 1 |
| architecture/ | 12 | 12 | 11 | 1 |
| testing/ | 3 | 3 | 2 | 1 |
| その他 | 1 | 1 | 1 | 0 |
| **合計** | **39** | **39** | **35** | **4** |

問題なしファイル: hotkey-input.md, checklist.md, browser-automation.md, features/README.md

### 横断的問題の修正状況

| 問題 | 状態 |
|------|------|
| `clipboard`タイプが全体的に未反映 | ✅ 修正済み |
| `execution-history.json`/`ExecutionHistoryService`が実装に存在しない | ✅ 削除/修正済み |
| `SearchMode`の`history`モードが実装に存在しない | ✅ 修正済み(normal\|window) |
| features/→screens/への逆方向参照（体系ルール違反） | ✅ 修正済み |
| `settings.md`が存在しない（リンク切れ） | ✅ リンク削除/修正済み |
| 設定ファイル名`config.json`→`settings.json` | ✅ 修正済み |
| データファイルパスに`datafiles/`サブフォルダが未反映 | ✅ 修正済み |
| アイコン保存先パスに`icon-cache/`が未反映 | ✅ 修正済み |
| `Ctrl+Alt+W`→`Ctrl+W`（ワークスペーストグル） | ✅ 修正済み |
