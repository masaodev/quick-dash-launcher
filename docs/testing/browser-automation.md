# ブラウザ自動操作ガイド

Claude Codeから QuickDashLauncher を操作してテストする方法を説明します。

## 概要

**重要**: QuickDashLauncherをテストする際は、**Electron MCP（electron-playwright）**を使用してください。Chrome MCP（claude-in-chrome）ではElectronアプリケーションを操作できません。

Electron MCP（Playwright MCPサーバー）を使用することで、Claude CodeがQuickDashLauncherの画面を直接操作できます。これにより、以下が可能になります：

- 画面のスナップショット取得・確認
- ボタンクリック、テキスト入力などのUI操作
- タブ切り替え、アイテム選択の動作確認
- スクリーンショット撮影によるビジュアル確認

## セットアップ

### 1. Electron MCPサーバーのセットアップ

プロジェクト内の`.mcp.json`に設定が含まれています：

```json
{
  "mcpServers": {
    "electron-playwright": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--cdp-endpoint",
        "http://localhost:9222"
      ],
      "env": {}
    }
  }
}
```

### 2. アプリケーションの起動

リモートデバッグポートを有効にしてアプリケーションを起動します：

```bash
npm run dev:test
```

**重要**: `npm run dev:test`では以下の設定が有効になります：
- リモートデバッグポート: `9222`
- テストデータ: `tests/dev/full/`
- ウィンドウ自動表示: 有効
- ホットキー: `Ctrl+Alt+T`

## Claude Codeからの操作方法

### 基本的な操作フロー

1. **画面の状態確認**
   ```
   QuickDashLauncherの現在の画面を確認してください
   ```

2. **要素のクリック**
   ```
   「仕事」タブをクリックしてください
   ```

3. **スクリーンショット撮影**
   ```
   現在の画面のスクリーンショットを撮ってください
   ```

### 使用可能なMCPツール

#### browser_snapshot
画面の現在の状態をアクセシビリティツリー形式で取得します。

**用途**:
- 画面に何が表示されているか確認
- クリック可能な要素の特定
- タブの状態確認

**例**:
```
現在の画面の状態を確認してください
```

#### browser_click
要素をクリックします。

**用途**:
- ボタンクリック
- タブ切り替え
- アイテム選択

**例**:
```
「プライベート」タブをクリックしてください
```

#### browser_type
テキストボックスに文字を入力します。

**用途**:
- 検索ボックスへの入力
- フォーム入力

**例**:
```
検索ボックスに「GitHub」と入力してください
```

#### browser_take_screenshot
画面のスクリーンショットを撮影します。

**用途**:
- ビジュアル確認
- バグ報告用の画像取得

**例**:
```
現在の画面のスクリーンショットを撮影してください
```

#### browser_tabs
ブラウザタブの操作を行います。

**用途**:
- タブ一覧の確認
- タブ切り替え

**例**:
```
開いているタブの一覧を表示してください
タブ0に切り替えてください
```

## 実際の操作例

### 例1: タブ切り替えとアイテム確認

```
ユーザー: 「仕事」タブに切り替えて、表示されているアイテムを確認してください

Claude Code:
1. browser_snapshot で現在の画面を確認
2. browser_click で「仕事」タブをクリック
3. browser_snapshot で仕事タブの内容を確認
4. 「GitHub Projects、Notion、Slack、Teamsなど8件のアイテムが表示されています」と報告
```

### 例2: 検索機能のテスト

```
ユーザー: 検索ボックスに「GitHub」と入力して、結果を確認してください

Claude Code:
1. browser_snapshot で検索ボックスを特定
2. browser_type で「GitHub」と入力
3. browser_snapshot で検索結果を確認
4. browser_take_screenshot でスクリーンショット撮影
5. 検索結果を報告
```

### 例3: 新規アイテム登録フロー

```
ユーザー: 新規アイテムを登録する手順を確認してください

Claude Code:
1. browser_click で「➕」ボタンをクリック
2. browser_tabs で管理画面タブに切り替え
3. browser_snapshot でアイテム管理画面を確認
4. 登録フローを報告
```

## トラブルシューティング

### ポート9222が使用中

**症状**: アプリケーションが起動しない、または接続できない

**対処法**:
```bash
# Windows
taskkill //F //IM electron.exe

# 再起動
npm run dev:test
```

### MCPツールが認識されない

**症状**: Claude Codeがブラウザ操作ツールを使用できない

**対処法**:
1. Claude Codeを再起動
2. `.mcp.json`の設定を確認
3. `npx @playwright/mcp@latest`が実行可能か確認

### タイムアウトエラー

**症状**: `TimeoutError: locator.click: Timeout 5000ms exceeded`

**原因**:
- 要素がまだ読み込まれていない
- 要素が表示されていない
- 別の操作中

**対処法**:
- 少し待ってから再試行
- browser_snapshot で現在の状態を確認
- 画面をリロードしてから再試行

## 制限事項

- **本番環境では使用不可**: リモートデバッグは開発モードでのみ有効
- **セキュリティ**: ポート9222は外部からアクセスできないようにファイアウォールで保護してください
- **パフォーマンス**: リモートデバッグは若干のオーバーヘッドがあります

## 関連ドキュメント

- [テストガイド](./README.md)
- [開発ガイド](../setup/development.md)
- [テストデータセット](../../tests/dev/full/README.md)
