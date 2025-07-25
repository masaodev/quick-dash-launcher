# プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Ctrl+Alt+W）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

## 主要機能

- **グローバルホットキー**: Ctrl+Alt+Wで即座にランチャーを呼び出し
- **ウィンドウ固定化**: 📌ボタンでウィンドウを固定し、フォーカスアウトしても非表示にならない
- **アイコン表示**: アプリケーション、ファイル、URLのアイコンを自動取得・表示
- **タブ切り替え**: メインタブと一時タブでアイテムを分類管理
- **リアルタイム検索**: 入力に応じてアイテムをリアルタイムフィルタリング
- **ドラッグ&ドロップ登録**: ファイルやフォルダをドラッグ&ドロップで簡単登録
- **アイテム管理機能**: Ctrl+Eでアイテム管理に切り替え、data.txt、data2.txt、tempdata.txtを直接編集。2つの編集方法を提供：①セル編集（クリック/📝ボタン）で素早い修正、②詳細編集ボタン（✏️）でRegisterModalを使った包括的編集（アイテム種別の選択、フォルダ処理・フォルダ取込オプション等も設定可能）。🔤整列ボタンで種類→パスと引数→名前の順にデータを自動整理。アイテム管理時はウィンドウサイズが自動拡大（1000x700px）し、フォーカスアウトでも非表示にならない。全ての変更（追加・編集・削除）は保存ボタンクリックまで確定されず、誤操作時も保存前なら元に戻せる
- **拡張フォルダ取込ディレクティブ**: フォルダ内のファイル・フォルダを柔軟にインポート（フィルター、プレフィックス、深さ制御対応）

## 主な技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Electron (メインプロセス)
- **スタイリング**: CSS変数ベースのデザインシステム
- **開発環境**: WSL2 + PowerShell（ビルド時）
- **パッケージング**: electron-builder

## 重要な制約事項

1. **Windows専用アプリケーション** - クロスプラットフォーム非対応
2. **WSL2環境でのビルド時**: PowerShellコマンドを使用する必要がある
3. **テストフレームワーク**: Playwright（E2E）+ Vitest（ユニット）を導入済み

## 関連ドキュメント

- [はじめに](getting-started.md) - セットアップとクイックスタート
- [開発ガイド](development.md) - 実装詳細とコード品質ガイドライン
- [ビルドとデプロイ](build-and-deploy.md) - ビルドシステムと配布方法