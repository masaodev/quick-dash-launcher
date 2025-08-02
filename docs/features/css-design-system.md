# CSSデザインシステム

QuickDashLauncherでは、統一されたデザインシステムを実現するため、CSS変数（カスタムプロパティ）ベースのアーキテクチャを採用しています。

## 概要

### 設計原則
- **統一性**: 全てのUIコンポーネントで一貫したスタイルを使用
- **保守性**: 色やサイズの変更を一箇所で管理
- **拡張性**: 新しいコンポーネントを簡単にデザインシステムに統合
- **再利用性**: 共通のスタイルパターンを再利用可能なクラスとして提供

### ファイル構成

```
src/renderer/styles/
├── index.css                    # グローバルリセット・ベーススタイル
├── variables.css                # CSS変数定義（色・サイズ・間隔など）
├── common.css                   # 共通ユーティリティクラス
└── components/                  # コンポーネント別スタイル
    ├── AdminWindow.css          # 管理ウィンドウ
    ├── BookmarkImport.css       # ブックマークインポート
    ├── EditMode.css             # 編集モード
    ├── Header.css               # ヘッダー
    ├── HotkeyInput.css          # ホットキー入力
    ├── IconProgress.css         # アイコン進捗バー
    ├── ItemList.css             # アイテムリスト
    ├── Modal.css                # モーダル共通
    ├── RegisterModal.css        # 登録モーダル
    └── SettingsModal.css        # 設定モーダル
```

## CSS変数システム

### カラーパレット

基本色とグレースケール、用途別の色が定義されています：

```css
/* 基本色 */
--color-primary: #0078d4;           /* メインカラー */
--color-primary-hover: #106ebe;     /* プライマリホバー */
--color-success: #28a745;           /* 成功・確定 */
--color-danger: #dc3545;            /* 危険・削除 */

/* グレースケール */
--color-white: #ffffff;
--color-gray-50: #f8f9fa;
--color-gray-900: #212529;
--color-black: #000000;

/* 用途別カラー */
--bg-app: #ffffff;                  /* アプリケーション背景 */
--text-primary: #212529;            /* 主要テキスト */
--border-light: 1px solid #dee2e6;  /* 軽いボーダー */
```

### スペーシングとサイズ

一貫した間隔とサイズのシステム：

```css
/* スペーシング */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;

/* フォントサイズ */
--font-size-xs: 11px;
--font-size-sm: 12px;
--font-size-base: 14px;
--font-size-lg: 16px;
--font-size-xl: 18px;

/* ボーダー半径 */
--border-radius-sm: 2px;
--border-radius-base: 4px;
--border-radius-lg: 8px;
```

### その他のスタイル定義

```css
/* シャドウ */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-base: 0 2px 4px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.15);

/* フォント */
--font-family-base: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
--font-family-mono: Consolas, Monaco, 'Courier New', monospace;

/* アニメーション */
--transition-fast: 150ms ease-in-out;
--transition-base: 200ms ease-in-out;
--transition-slow: 300ms ease-in-out;
```

## 共通ユーティリティクラス

### ボタンスタイル

```css
.btn-base               /* 基本ボタンスタイル */
.btn-primary            /* プライマリボタン */
.btn-success            /* 成功ボタン */
.btn-danger             /* 削除・危険ボタン */
.btn-icon               /* アイコンボタン */
```

### テキストスタイル

```css
.text-secondary         /* セカンダリテキスト */
.text-muted             /* ミューテッドテキスト */
.text-danger            /* エラーテキスト */
.text-success           /* 成功テキスト */
.text-center            /* 中央揃え */
.text-ellipsis          /* テキスト省略 */
```

### レイアウト

```css
.flex-center            /* Flexbox中央揃え */
.flex-between           /* 両端揃え */
.flex-wrap              /* フレックスラップ */
.gap-sm                 /* 小さい間隔 */
.gap-md                 /* 中間隔 */
.gap-lg                 /* 大きい間隔 */
```

### その他

```css
.scrollable             /* スクロール可能エリア */
.no-select              /* テキスト選択無効 */
.hidden                 /* 非表示 */
.disabled               /* 無効状態 */
```

## 使用方法

詳細な使用方法とベストプラクティスについては、[CSSデザインシステム使用ガイド](css-design-guide.md)を参照してください。

## 関連ドキュメント

- [CSSデザインシステム使用ガイド](css-design-guide.md) - 実装方法とベストプラクティス
- [開発ガイド](../guides/development.md) - 全体的な開発ガイドライン
- [画面構成](../reference/screen-list.md) - UI仕様とスタイル適用例