# CSSデザインシステム使用ガイド

このガイドでは、QuickDashLauncherのCSSデザインシステムの実装方法とベストプラクティスを説明します。

## 実装方法

### 1. 新しいコンポーネントの作成

新しいUIコンポーネントを作成する際の手順：

1. **コンポーネントCSSファイルを作成**
   ```
   src/renderer/styles/components/MyComponent.css
   ```

2. **必要なスタイルをインポート**
   ```css
   /* MyComponent.css の最初に記載 */
   @import '../variables.css';
   @import '../common.css';
   ```

3. **CSS変数を使用してスタイルを定義**

**実装例：**

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

## 関連ドキュメント

- [CSSデザインシステム](css-design-system.md) - 変数とクラスの詳細
- [開発ガイド](../guides/development.md) - 全体的な開発ガイドライン
- [画面構成](../reference/screen-list.md) - UI仕様とスタイル適用例