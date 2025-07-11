# QuickDashLauncher

QuickDashLauncherは、グローバルホットキー（Ctrl+Alt+W）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーションです。

## 主な機能

- 🚀 **グローバルホットキー**: Ctrl+Alt+Wでどこからでも即座に起動
- 🔍 **インクリメンタルサーチ**: リアルタイムで絞り込み検索
- 📁 **多様なアイテムタイプ**: URL、アプリ、ファイル、フォルダに対応
- 🎨 **自動アイコン取得**: Webサイトのファビコンやアプリアイコンを自動表示
- 📝 **メイン/一時タブ**: よく使うアイテムと一時的なアイテムを分けて管理

## インストール

### 必要環境
- Windows 10以降
- Node.js 18以降（開発時）

### リリース版のインストール
1. [Releases](https://github.com/yourusername/quick-dash-launcher/releases)から最新版をダウンロード
2. インストーラー（.exe）を実行
3. インストール完了後、自動的に起動します

### ソースからのビルド
```bash
# リポジトリのクローン
git clone https://github.com/yourusername/quick-dash-launcher.git
cd quick-dash-launcher

# 依存関係のインストール
npm install

# アプリケーションの実行
npm run start

# インストーラーの作成
npm run dist
```

## 使い方

### 基本的な使い方
1. **Ctrl+Alt+W**を押してランチャーを表示
2. 検索ボックスにキーワードを入力
3. **Enter**で選択したアイテムを起動
4. **Shift+Enter**で親フォルダを開く

### データファイルの編集
アイテムは`%APPDATA%/quickdashlauncher/config/`内のテキストファイルで管理されています。

#### ファイル形式
```
// コメント行
Google,https://www.google.com
メモ帳,C:\Windows\System32\notepad.exe
ドキュメント,C:\Users\YourName\Documents
```

### キーボードショートカット
- **Ctrl+Alt+W**: ランチャーの表示/非表示
- **↑↓**: アイテムの選択
- **Enter**: アイテムを開く
- **Shift+Enter**: 親フォルダを開く
- **Ctrl+Enter**: 新しいタブで開く（Webサイトの場合）
- **Tab**: メイン/一時タブの切り替え
- **Escape**: ランチャーを閉じる
- **Ctrl+数字**: 対応する番号のアイテムを起動

## 設定

### データファイルの場所
- メインデータ: `data.txt`, `data2.txt`, `data3.txt`...
- 一時データ: `temp.txt`
- ファビコンキャッシュ: `favicons/`フォルダ

### カスタマイズ
複数のデータファイルを作成して、カテゴリごとにアイテムを管理できます。
すべての`data*.txt`ファイルは自動的に読み込まれ、マージされます。

## トラブルシューティング

### ランチャーが起動しない
- タスクマネージャーで既存のプロセスを確認
- システムトレイのアイコンをダブルクリック

### ホットキーが効かない
- 他のアプリケーションとの競合を確認
- 管理者権限で実行してみる

### アイコンが表示されない
- ファビコン取得ボタンを手動でクリック
- `%APPDATA%/quickdashlauncher/config/favicons/`の権限を確認

## 開発者向け情報

詳細な開発情報は[CLAUDE.md](./CLAUDE.md)を参照してください。

## ライセンス

[ライセンス情報を記載]

## 貢献

プルリクエストを歓迎します！詳細は`.cursor/rules/remote-integration.md`を参照してください。