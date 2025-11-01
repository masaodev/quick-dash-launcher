# はじめに

QuickDashLauncherへようこそ！このガイドでは、プロジェクトの基本的な情報とセットアップ方法を説明します。

## プロジェクト概要

QuickDashLauncherは、グローバルホットキー（Ctrl+Alt+W）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

## 主要機能

- **グローバルホットキー**: Ctrl+Alt+Wで即座にランチャーを呼び出し（設定画面でカスタマイズ可能）
- **ウィンドウ固定化**: 📌ボタンでウィンドウを固定し、フォーカスアウトしても非表示にならない
- **アイコン表示**: アプリケーション、ファイル、URLのアイコンを自動取得・表示
- **タブ切り替え**: メインタブと一時タブでアイテムを分類管理
- **リアルタイム検索**: 入力に応じてアイテムをリアルタイムフィルタリング
- **ドラッグ&ドロップ登録**: ファイルやフォルダをドラッグ&ドロップで簡単登録
- **生データ編集モード**: Ctrl+Eで編集モードに切り替え、data.txt、data2.txt、tempdata.txtを直接編集。2つの編集方法を提供：①セル編集（クリック/📝ボタン）で素早い修正、②詳細編集ボタン（✏️）でRegisterModalを使った包括的編集（アイテム種別の選択、フォルダ処理・フォルダ取込オプション等も設定可能）。🔤整列ボタンで種類→パスと引数→名前の順にデータを自動整理。編集モード時はウィンドウサイズが自動拡大（1000x700px）し、フォーカスアウトでも非表示にならない。全ての変更（追加・編集・削除）は保存ボタンクリックまで確定されず、誤操作時も保存前なら元に戻せる
- **フォルダ取込アイテム**: フォルダ内のファイル・フォルダを柔軟にインポート（フィルター、プレフィックス、深さ制御対応）
- **アプリケーション設定**: ウィンドウサイズ、ホットキー、起動オプション等の詳細設定

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Electron (メインプロセス)
- **開発環境**: Windows
- **パッケージング**: electron-builder

## セットアップ

### 前提条件

- Node.js (最新LTS版推奨)
- npm
- Windows環境

### インストール

```bash
git clone [repository-url]
cd quick-dash-launcher
npm install
```

### 開発開始

```bash
npm run dev
```

これでViteデベロップメントサーバーが起動し、ホットリロード付きで開発できます。

## データファイルの記述方法

QuickDashLauncherでは、データファイル（data.txt、data2.txt）内のアイテムを以下の2つに分類します：

### **1. 単一アイテム**
個別に定義される静的なランチャーアイテム

**記述形式:**
```
表示名,実行先[,引数][,カスタムアイコン]
```

**例:**
```
Notepad++,C:\Program Files\Notepad++\notepad++.exe
GitHub,https://github.com
プロジェクトフォルダ,C:\Users\Documents\Projects
重要な資料,C:\Users\Documents\important.pdf
Visual Studio,C:\Program Files\Microsoft Visual Studio\devenv.exe,/rootsuffix Exp
PowerShell,powershell.exe,-ExecutionPolicy Bypass -File script.ps1
Netflix,https://www.netflix.com/browse,,7439edeb.png
```

- 実行先の内容（URL、実行ファイル、フォルダ等）による区別はなし
- システムが自動的にタイプを判定して適切に処理
- 第3項目は実行時の引数（オプション）
- 第4項目はカスタムアイコンのファイル名（オプション）

### **2. フォルダ取込アイテム**
指定フォルダの内容を動的にインポートする機能

**記述形式:**
```
dir,ディレクトリパス[,オプション1=値1][,オプション2=値2]...
```

**基本例:**
```
dir,C:\Tools
dir,C:\Projects,depth=1,types=file
dir,C:\Scripts,filter=*.ps1,prefix=Script
```

詳細な仕様については [フォルダ取込アイテム仕様](../manual/folder-import-item.md) を参照してください。

### **主な違い**
- **単一アイテム**: 1行 = 1つのランチャーアイテム
- **フォルダ取込アイテム**: 1行 = 複数のランチャーアイテムを動的生成

## 制約事項

1. **Windows専用アプリケーション** - クロスプラットフォーム非対応
2. **テストフレームワーク**: Playwright（E2E）+ Vitest（ユニット）導入済み

## 次のステップ

- [開発ガイド](development.md) - 詳細な開発情報
- [ビルドとデプロイ](build-and-deploy.md) - ビルドシステムとデプロイ方法
- [アイテム管理](../manual/item-management.md) - 編集モードの使い方
- [アイコンシステム](../manual/icon-system.md) - アイコン機能の詳細
- [アプリケーション設定](../manual/app-settings.md) - ホットキーや表示設定のカスタマイズ