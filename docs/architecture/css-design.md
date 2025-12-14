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
    ├── AlertDialog.css          # 通知ダイアログ
    ├── BookmarkImport.css       # ブックマークインポート
    ├── ConfirmDialog.css        # 確認ダイアログ
    ├── EditMode.css             # 編集モード
    ├── FilePickerDialog.css     # ファイル選択ダイアログ
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
--color-primary-dark: #1976d2;      /* プライマリダーク */

--color-success: #28a745;           /* 成功・確定 */
--color-success-hover: #218838;     /* 成功ホバー */
--color-success-light: #4caf50;     /* 成功ライト */

--color-danger: #dc3545;            /* 危険・削除 */
--color-danger-hover: #c82333;      /* 危険ホバー */
--color-danger-light: #ff6b6b;      /* 危険ライト */

--color-warning: #ffc107;           /* 警告 */

--color-info: #2196f3;              /* 情報 */
--color-info-hover: #1976d2;        /* 情報ホバー */
--color-info-light: #42a5f5;        /* 情報ライト */

--color-secondary: #6c757d;         /* セカンダリ */
--color-secondary-hover: #5a6268;   /* セカンダリホバー */
```

#### グレースケール
```css
--color-white: #ffffff;
--color-gray-50: #fafafa;           /* 最も薄いグレー */
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
--bg-body: #f0f0f0;                 /* ページ全体の背景 */
--bg-app: #ffffff;                  /* アプリケーション背景 */
--bg-header: #f8f8f8;               /* ヘッダー背景 */
--bg-section: #f9f9f9;              /* セクション背景 */
--bg-selected: #e7f3ff;             /* 選択状態 */
--bg-hover: #f0f0f0;                /* ホバー状態 */
--bg-input-disabled: #f5f5f5;       /* 無効化入力フィールド */
--bg-edited: #fff3cd;               /* 編集済みの行 */
--bg-readonly: #f5f5f5;             /* 読み取り専用 */
--bg-warning-light: #fff3cd;        /* 警告（薄） */
--bg-danger-light: #fff5f5;         /* 危険（薄） */
--bg-info-light: #e3f2fd;           /* 情報（薄） */
--bg-table-container: #fafafa;      /* テーブルコンテナ */
```

#### テキストカラー
```css
--text-primary: #333;               /* メインテキスト */
--text-secondary: #555;             /* サブテキスト */
--text-muted: #666;                 /* 補助テキスト */
--text-disabled: #999;              /* 無効化テキスト */
--text-error: #e74c3c;              /* エラーメッセージ */
--text-success: #388e3c;            /* 成功テキスト */
--text-info: #6c757d;               /* 情報テキスト */
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

--font-size-xxs: 10px;              /* 最小フォント */
--font-size-xs: 11px;               /* 極小フォント */
--font-size-sm: 12px;               /* 小フォント */
--font-size-base: 14px;             /* 基本フォント */
--font-size-lg: 15px;               /* 大フォント */
--font-size-xl: 16px;               /* 特大フォント */
--font-size-2xl: 18px;              /* 見出し小 */
--font-size-3xl: 20px;              /* 見出し大 */

--line-height-tight: 1;             /* 密な行間 */
--line-height-normal: 1.4;          /* 通常の行間 */
--line-height-relaxed: 1.6;         /* ゆったりした行間 */
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

--focus-ring: 0 0 0 1px var(--color-primary);                /* フォーカスリング */
--focus-ring-wide: 0 0 0 2px rgba(0, 122, 204, 0.25);        /* 広いフォーカスリング */
--focus-ring-danger: 0 0 0 2px rgba(255, 107, 107, 0.25);    /* 危険フォーカスリング */

--transition-fast: all 0.1s;                     /* 高速トランジション */
--transition-normal: all 0.2s;                   /* 標準トランジション */
--transition-slow: all 0.3s;                     /* 低速トランジション */
--transition-width: width 0.3s ease;             /* 幅のトランジション */
```

### 6. Z-インデックス・寸法

```css
/* Z-インデックス */
--z-dropdown: 1000;                 /* ドロップダウンメニュー */
--z-modal: 2000;                    /* モーダル */

/* 寸法 */
--input-height: 32px;               /* 入力フィールドの高さ */
--button-height: 32px;              /* ボタンの高さ */
--icon-size-sm: 24px;               /* 小アイコン */
--icon-size: 32px;                  /* 標準アイコン */
--scrollbar-width: 8px;             /* スクロールバーの幅 */
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

#### .btn-sm / .btn-lg
サイズバリエーション
```css
.btn-sm {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
  height: 28px;
}

.btn-lg {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-lg);
}
```

**注意**: サイズバリエーションは `-sm` / `-lg` サフィックスで統一されています。`-small` や `-large` は使用しません。

#### .action-btn
32x32ピクセルの正方形アクションボタン（ヘッダーのアイコンボタン用）
```css
.action-btn {
  width: var(--button-height);
  height: var(--button-height);
  border: var(--border-normal);
  background-color: var(--color-white);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: var(--font-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-normal);
}
```

**用途**: 登録ボタン、設定ボタン、更新ボタン、ピン留めボタンなど

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

#### 検索ボックスパターン
クリアボタン付き検索入力欄の共通パターン

```css
/* コンテナ */
.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

/* 入力フィールド */
.search-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-right: calc(var(--spacing-md) + 24px); /* クリアボタン分の余白 */
  font-size: var(--font-size-base);
  border: var(--border-normal);
  border-radius: var(--border-radius);
  outline: none;
  transition: var(--transition-normal);
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

/* クリアボタン */
.search-clear-button {
  position: absolute;
  right: var(--spacing-sm);
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%; /* 丸いボタン */
  font-size: 18px;
  font-weight: bold; /* 太字で視認性向上 */
  line-height: 1;
  color: var(--color-gray-600);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-normal);
}

.search-clear-button:hover {
  background-color: var(--color-gray-600);
  color: var(--color-white);
  transform: translateY(-50%) scale(1.1); /* ホバー時に拡大 */
}

.search-clear-button:active {
  background-color: var(--color-gray-700);
  transform: translateY(-50%) scale(0.95); /* クリック時に縮小 */
}
```

### 閉じる・削除ボタンクラス

#### .close-btn-base
×ボタンの基本スタイル（モーダル閉じるボタン、検索クリアボタンなど）

```css
.close-btn-base {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-normal);
}

.close-btn-base:hover {
  background-color: var(--color-gray-600);
  color: var(--color-white);
  transform: scale(1.1);
}

.close-btn-base:active {
  background-color: var(--color-gray-700);
  transform: scale(0.95);
}
```

#### .delete-btn-base
削除ボタンの基本スタイル（赤色の危険系ボタン）

```css
.delete-btn-base {
  background-color: var(--color-danger);
  border: 2px solid var(--color-white);
  color: var(--color-white);
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-normal);
}

.delete-btn-base:hover {
  background-color: var(--color-danger-hover);
  transform: scale(1.1);
}

.delete-btn-base:active {
  background-color: var(--color-danger-hover);
  transform: scale(0.95);
}
```

**用途別の実装例:**

| ボタン種類 | クラス名 | 用途 | サイズ | 色 |
|-----------|---------|------|--------|-----|
| `.search-clear-button` | 検索クリアボタン | ヘッダー、編集モード、ブックマークインポートの検索欄 | 24x24px | グレー |
| `.modal-close-btn` | モーダル閉じるボタン | アイコン取得進捗詳細モーダルのヘッダー | 32x32px | グレー |
| `.progress-close-btn` | 進捗バー閉じるボタン | アイコン取得進捗バー | 28x28px | グレー |
| `.workspace-item-delete-btn` | ワークスペース削除ボタン | ワークスペースアイテムカード | 24x24px | 赤色（削除系） |
| `.remove-group-item-btn` | グループアイテム削除ボタン | 登録モーダルのグループアイテムチップ | 20x20px | 赤色（削除系） |

**共通の特徴:**
- 丸いボタンデザイン（`border-radius: 50%`）
- 太字の×で視認性向上（`font-weight: bold`）
- ホバー時に背景色が変化してスケールアップ（`scale(1.1)`）
- クリック時のフィードバック（`scale(0.95)`に縮小）
- 削除系は赤色、その他はグレー色で用途を明確化
- 白い縁取りや影を追加してコントラスト向上（削除ボタン）

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
- **クラス名**: シンプルなケバブケース（ハイフン区切り）
  - 例: `.btn-primary`, `.modal-overlay`, `.form-group`, `.action-btn`

#### 命名規則の統一ガイドライン

プロジェクト全体で以下の命名パターンに統一されています：

**ボタンクラス**:
- 基本形: `.btn-{variant}` （例: `.btn-primary`, `.btn-danger`）
- サイズバリエーション: `.btn-{variant}-sm` または `.btn-{variant}-lg`
  - ✅ 正: `.btn-danger-sm`, `.btn-primary-lg`
  - ❌ 誤: `.btn-danger-small`, `.btn-primary-large`

**アクションボタン**:
- `.action-btn` : 32x32ピクセルの正方形アイコンボタン（メインウィンドウヘッダー用）
- `.section-action-button` : 横長テキスト付きボタン（管理ウィンドウのセクション内用）

**コンポーネント要素**:
- パターン: `.{component}-{element}` （例: `.modal-overlay`, `.item-icon`）
- 状態クラス: `.{component}.{state}` （例: `.item.selected`, `.btn-primary.disabled`）

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

## 命名規則の変更履歴

### Phase 4.2 (2025-12) - CSS命名規則の統一

プロジェクト全体のCSS命名規則を調査し、不整合を修正しました。

**修正内容**:

1. **アクションボタンの命名整理**
   - `.action-btn` : 32x32正方形アイコンボタン（メインウィンドウヘッダー用、`common.css`で定義）
   - `.section-action-button` : 横長テキストボタン（管理ウィンドウ用、`AdminWindow.css`で定義）
   - 紛らわしかった `.action-button` は削除済み

2. **サイズバリエーションの統一**
   - 変更前: `AdminWindow.css`で `.btn-secondary-small`, `.btn-danger-small` を使用
   - 変更後: `.btn-secondary-sm`, `.btn-danger-sm` に統一（`common.css`の`.btn-sm`に合わせる）
   - 影響範囲: 1つのコンポーネント（SettingsTab）

**結果**: 全てのCSSクラス名が一貫したハイフン区切り命名規則に統一され、保守性が向上しました。

### Phase 4.5 (2025-12-14) - ×ボタンスタイルの統一

全画面の×ボタン（削除ボタン、検索クリアボタン、モーダル閉じるボタン）のスタイルを統一しました。

**修正内容**:

1. **共通デザインパターンの確立**
   - 丸いボタンデザイン（`border-radius: 50%`）に統一
   - 太字の×で視認性向上（`font-weight: bold`）
   - ホバー時に背景色が変化してスケールアップ（`scale(1.1)`）
   - クリック時のフィードバック（`scale(0.95)`に縮小）
   - 削除系は赤色、その他はグレー色で用途を明確化

2. **修正したCSSクラス**
   - `.workspace-item-delete-btn` - ワークスペースアイテムの削除ボタン
   - `.remove-group-item-btn` - 登録モーダルのグループアイテム削除ボタン
   - `.search-clear-button` - ヘッダー、編集モード、ブックマークインポートの検索クリアボタン
   - `.progress-close-btn` - アイコン取得進捗バーの閉じるボタン
   - `.modal-close-btn` - アイコン取得進捗詳細モーダルの閉じるボタン

3. **影響範囲**
   - 7つのCSSファイル（WorkspaceWindow.css、RegisterModal.css、Header.css、BookmarkImport.css、EditMode.css、IconProgress.css、IconProgressDetailModal.css）
   - UX改善: ボタンが押せることをより明確に伝達、操作時の視覚的フィードバックを追加

**結果**: 全画面で統一された×ボタンのデザインパターンが確立され、ユーザビリティが向上しました。

---

## まとめ

このCSSデザインシステムにより、QuickDashLauncherは：

- **一貫したUI体験**を提供
- **効率的な開発プロセス**を実現
- **容易なメンテナンス**を可能にする
- **将来の機能拡張**に柔軟に対応

新しい機能や修正を行う際は、このドキュメントを参照して統一されたスタイルを維持してください。