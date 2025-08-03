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
    └── RegisterModal.css        # 登録モーダル
```

## CSS変数システム

### 1. カラーパレット

#### 基本色
```css
--color-primary: #0078d4;           /* メインカラー */
--color-primary-hover: #106ebe;     /* プライマリホバー */
--color-success: #28a745;           /* 成功・確定 */
--color-danger: #dc3545;            /* 危険・削除 */
--color-warning: #ffc107;           /* 警告 */
--color-info: #2196f3;              /* 情報 */
--color-secondary: #6c757d;         /* セカンダリ */
```

#### グレースケール
```css
--color-white: #ffffff;
--color-gray-100: #f8f8f8;          /* 極薄グレー */
--color-gray-200: #f5f5f5;          /* 薄グレー */
--color-gray-300: #f0f0f0;          /* ライトグレー */
--color-gray-400: #e0e0e0;          /* ミディアムグレー */
--color-gray-500: #ccc;             /* グレー */
--color-gray-600: #999;             /* ダークグレー */
--color-gray-700: #666;             /* より濃いグレー */
--color-gray-800: #555;             /* 濃いグレー */
--color-gray-900: #333;             /* 最も濃いグレー */
```

#### 背景色
```css
--bg-app: #ffffff;                  /* アプリケーション背景 */
--bg-header: #f8f8f8;               /* ヘッダー背景 */
--bg-section: #f9f9f9;              /* セクション背景 */
--bg-selected: #e7f3ff;             /* 選択状態 */
--bg-hover: #f0f0f0;                /* ホバー状態 */
--bg-input-disabled: #f5f5f5;       /* 無効化入力フィールド */
```

#### テキストカラー
```css
--text-primary: #333;               /* メインテキスト */
--text-secondary: #555;             /* サブテキスト */
--text-muted: #666;                 /* 補助テキスト */
--text-disabled: #999;              /* 無効化テキスト */
--text-error: #e74c3c;              /* エラーメッセージ */
```

### 2. スペーシング

```css
--spacing-xs: 4px;                  /* 最小間隔 */
--spacing-sm: 8px;                  /* 小間隔 */
--spacing-md: 12px;                 /* 中間隔 */
--spacing-lg: 16px;                 /* 大間隔 */
--spacing-xl: 20px;                 /* 特大間隔 */
--spacing-2xl: 24px;                /* 超大間隔 */
--spacing-3xl: 32px;                /* 最大間隔 */
```

### 3. タイポグラフィ

```css
--font-family: 'Meiryo', 'メイリオ', sans-serif;
--font-family-mono: monospace;

--font-size-xs: 11px;               /* 極小フォント */
--font-size-sm: 12px;               /* 小フォント */
--font-size-base: 14px;             /* 基本フォント */
--font-size-lg: 15px;               /* 大フォント */
--font-size-xl: 16px;               /* 特大フォント */
--font-size-2xl: 18px;              /* 見出し小 */
--font-size-3xl: 20px;              /* 見出し大 */
```

### 4. ボーダー・角丸

```css
--border-light: 1px solid #e0e0e0;  /* 薄ボーダー */
--border-normal: 1px solid #ccc;    /* 通常ボーダー */
--border-dark: 1px solid #999;      /* 濃ボーダー */

--border-radius-sm: 3px;            /* 小角丸 */
--border-radius: 4px;               /* 標準角丸 */
--border-radius-lg: 6px;            /* 大角丸 */
--border-radius-xl: 8px;            /* 特大角丸 */
```

### 5. シャドウ・エフェクト

```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);      /* 軽いシャドウ */
--shadow: 0 2px 8px rgba(0, 0, 0, 0.15);        /* 通常シャドウ */
--shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.15);    /* 大シャドウ */
--shadow-xl: 0 4px 16px rgba(0, 0, 0, 0.2);     /* 特大シャドウ */

--focus-ring: 0 0 0 1px var(--color-primary);    /* フォーカスリング */
--transition-normal: all 0.2s;                   /* 標準トランジション */
```

## 共通ユーティリティクラス

### ボタンクラス

#### .btn-base
基本的なボタンスタイル
```css
.btn-base {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--font-size-base);
  border: var(--border-normal);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: var(--transition-normal);
}
```

#### .btn-primary / .btn-secondary / .btn-danger
状態別ボタンスタイル

### レイアウトクラス

#### .flex-center
中央配置フレックスボックス
```css
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

#### .flex-between
両端配置フレックスボックス
```css
.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

### フォームクラス

#### .form-base
基本的な入力フィールドスタイル
```css
.form-base {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-normal);
  border-radius: var(--border-radius);
  font-size: var(--font-size-base);
}
```

## 使用方法

### 1. 新しいコンポーネントの作成

新しいコンポーネントを作成する際は：

1. `src/renderer/styles/components/` にCSSファイルを作成
2. CSS変数を使用してスタイルを定義
3. 可能な限り共通クラスを活用
4. コンポーネントファイルでCSSをインポート

```tsx
// MyComponent.tsx
import React from 'react';
import '../styles/components/MyComponent.css';

const MyComponent = () => {
  return (
    <div className="my-component">
      <button className="btn-base btn-primary">
        アクション
      </button>
    </div>
  );
};
```

```css
/* MyComponent.css */
.my-component {
  padding: var(--spacing-lg);
  background-color: var(--bg-section);
  border: var(--border-light);
  border-radius: var(--border-radius-xl);
}

.my-component .custom-element {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}
```

### 2. 色の変更

デザインシステム全体の色を変更する場合：

1. `variables.css` の該当する変数を編集
2. 変更は全コンポーネントに自動適用

```css
/* variables.css */
:root {
  --color-primary: #0066cc; /* 青を変更 */
  --color-success: #22c55e; /* 緑を変更 */
}
```

### 3. 新しい変数の追加

新しいスタイル値が必要な場合：

1. `variables.css` に新しい変数を追加
2. 既存のパターンに従った命名規則を使用

```css
/* variables.css */
:root {
  /* 新しいカラーバリエーション */
  --color-accent: #ff6b35;
  --color-accent-hover: #e55a2b;
  
  /* 新しいスペーシング */
  --spacing-4xl: 48px;
  
  /* 新しいフォントウェイト */
  --font-weight-medium: 500;
  --font-weight-bold: 700;
}
```

## ベストプラクティス

### 1. 命名規則

- **変数名**: `--category-property-variant` 形式
  - 例: `--color-primary-hover`, `--spacing-lg`, `--border-radius-xl`
- **クラス名**: BEM記法またはシンプルなケバブケース
  - 例: `.btn-primary`, `.modal-overlay`, `.form-group`

### 2. 値の使用優先順位

1. **CSS変数を最優先**: 必ずvariables.cssの変数を使用
2. **共通クラスを活用**: 既存のユーティリティクラスがないか確認
3. **ハードコード値は禁止**: 直接的な色指定やサイズ指定は避ける

### 3. レスポンシブ対応

メディアクエリも変数化して統一：

```css
/* variables.css */
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
}

/* 使用例 */
@media (max-width: var(--breakpoint-sm)) {
  .responsive-element {
    font-size: var(--font-size-sm);
    padding: var(--spacing-sm);
  }
}
```

### 4. ダークモード準備

将来のダークモード対応を考慮した変数設計：

```css
/* variables.css */
:root {
  --theme-bg-primary: var(--bg-app);
  --theme-text-primary: var(--text-primary);
}

/* ダークモード用（将来実装時） */
[data-theme="dark"] {
  --theme-bg-primary: #1a1a1a;
  --theme-text-primary: #ffffff;
}
```

## トラブルシューティング

### よくある問題

1. **スタイルが適用されない**
   - CSS変数が正しく定義されているか確認
   - import文の順序を確認（variables.css → common.css → component.css）

2. **色が意図したものと違う**
   - ブラウザの開発者ツールで実際の変数値を確認
   - カスケードの優先順位を確認

3. **レスポンシブ対応がうまくいかない**
   - メディアクエリの書き方を確認
   - ブレークポイント変数を使用しているか確認

### デバッグ方法

```css
/* デバッグ用クラス */
.debug-vars {
  --debug-primary: var(--color-primary);
  --debug-spacing: var(--spacing-lg);
}

/* ブラウザ開発者ツールでComputed Styleを確認 */
```

## まとめ

このCSSデザインシステムにより、QuickDashLauncherは：

- **一貫したUI体験**を提供
- **効率的な開発プロセス**を実現
- **容易なメンテナンス**を可能にする
- **将来の機能拡張**に柔軟に対応

新しい機能や修正を行う際は、このドキュメントを参照して統一されたスタイルを維持してください。