---
description: "命名規則の分析と改善"
allowed-tools: ["Edit", "MultiEdit", "Read", "Grep", "Glob"]
---

# Refactor Variable Naming

命名規則の分析と改善を行います。

## 実行内容

### 1. 命名の分析・検出
- 分かりにくい変数・関数名の特定
- 一貫性のない命名パターンの検出
- 略語・省略形の過度な使用箇所
- TypeScript/JavaScript規約との乖離

### 2. 命名問題の分類
- **意味不明な名前**: `a`, `temp`, `data`など
- **略語の乱用**: `usr`, `mgr`, `ctrl`など
- **一貫性の欠如**: `getUserInfo`と`getUser`の混在
- **スコープに不適切**: グローバルスコープでの短い名前

### 3. 命名の改善・修正
- より説明的で意味のある名前に変更
- プロジェクト全体で一貫した命名パターンに統一
- 適切な長さと詳細レベルの調整
- TypeScript規約に準拠した命名

### 4. マジックナンバー・文字列の定数化
- ハードコードされた数値の特定
- マジック文字列の検出
- 意味のある定数名での定義
- 適切な場所への定数配置

## 実行手順

1. **検出フェーズ**: 問題のある命名を特定
2. **分析フェーズ**: 命名問題を分類・優先順位付け
3. **設計フェーズ**: 新しい命名規則と名前を設計
4. **修正フェーズ**: 実際に名前を変更・リファクタリング
5. **検証フェーズ**: 動作確認とテスト実行

## 命名規則ガイドライン

### 変数・関数名
- **boolean**: `is`, `has`, `can`, `should`で開始
- **関数**: 動詞で開始（`get`, `set`, `create`, `update`）
- **定数**: `UPPER_SNAKE_CASE`
- **プライベート**: `_`プレフィックス

### クラス・インターフェース
- **クラス**: `PascalCase`
- **インターフェース**: `PascalCase`（`I`プレフィックスは避ける）
- **型エイリアス**: `PascalCase`
- **ジェネリック**: `T`, `U`, `V`または説明的な名前

### ファイル・ディレクトリ
- **ファイル**: `kebab-case`または`camelCase`
- **コンポーネント**: `PascalCase`
- **ディレクトリ**: `kebab-case`

## 改善パターン例

### Before/After例

```typescript
// Before (問題のある命名)
const d = new Date();
const usr = getUserData();
function calc(x, y) { return x * 1.08; }

// After (改善された命名)
const currentDate = new Date();
const currentUser = getUserData();
function calculateTaxIncludedPrice(basePrice: number, taxRate: number) {
  return basePrice * TAX_RATE;
}
```

### マジックナンバーの定数化

```typescript
// Before
if (items.length > 10) { /* ... */ }
setTimeout(callback, 3000);

// After
const MAX_ITEMS_PER_PAGE = 10;
const NOTIFICATION_DELAY_MS = 3000;

if (items.length > MAX_ITEMS_PER_PAGE) { /* ... */ }
setTimeout(callback, NOTIFICATION_DELAY_MS);
```

## 命名の評価基準

### 良い命名の特徴
- **自己文書化**: コメントなしで意図が分かる
- **検索しやすい**: IDEで簡単に検索できる
- **発音しやすい**: チームで話し合いやすい
- **一貫性**: プロジェクト全体で統一されている

### 避けるべき命名
- **情報の重複**: `userUserName`
- **意味のない差異**: `data1`, `data2`
- **精神的マッピング**: `i`, `j`, `k`（ループ以外）
- **文脈無視**: `name`（何の名前？）

## 注意事項

- 機能に影響しない範囲で改名を行います
- 改名前に必ずバックアップを取ることを推奨
- 改名後は関連テストの実行を必須とします
- 大規模な改名は段階的に実施します
- 外部APIとの整合性を保持します

## 使用方法

```
/refactor-variable-naming $ARGUMENTS
```

引数として特定のディレクトリやファイルを指定できます。

### 例：
```
/refactor-variable-naming
/refactor-variable-naming src/renderer/components/
/refactor-variable-naming src/main/services/LauncherService.ts
```