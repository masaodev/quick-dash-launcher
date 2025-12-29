---
description: "対話型リファクタリング（命名・複雑度・重複・パス・ファイル分割・コメント）"
allowed-tools: ["Edit", "Read", "Grep", "Glob", "Bash", "AskUserQuestion", "TodoWrite"]
---

# Refactor

コードベースのリファクタリングを対話型で実行します。
6つのリファクタリングタイプから選択できます。

## リファクタリングタイプ

コマンド実行時に、以下から選択してください：

### 1. variable-naming（命名規則）
変数・関数・クラス名の一貫性をチェックし、改善します。

**チェック項目:**
- camelCase vs snake_case の混在
- 略語の統一（btn vs button, num vs number）
- 意味のある名前（x, data, temp などの曖昧な名前）
- TypeScript/React の命名規則準拠

**例:**
```typescript
// Before
const btn_click = () => {}
const UserData = []
let x = 10

// After
const handleButtonClick = () => {}
const userData = []
let itemCount = 10
```

---

### 2. complex-functions（複雑な関数の分割）
循環的複雑度が高い関数を特定し、分割します。

**検出基準:**
- 循環的複雑度 > 10
- 関数の行数 > 50行
- ネストレベル > 3

**例:**
```typescript
// Before: 複雑な関数（100行、複雑度15）
function processData(data) {
  if (data) {
    for (let item of data) {
      if (item.type === 'A') {
        // 処理1...
      } else if (item.type === 'B') {
        // 処理2...
      }
    }
  }
}

// After: 分割された関数
function processData(data) {
  if (!data) return
  data.forEach(processItem)
}

function processItem(item) {
  if (item.type === 'A') return processTypeA(item)
  if (item.type === 'B') return processTypeB(item)
}
```

---

### 3. duplicate-code（重複コードの統合）
類似コードブロックを検出し、共通関数に統合します。

**検出基準:**
- 3行以上の類似コード
- 複数ファイルで繰り返される処理

**例:**
```typescript
// Before: 重複コード
function saveUser(user) {
  const data = JSON.stringify(user)
  localStorage.setItem('user', data)
}

function saveSettings(settings) {
  const data = JSON.stringify(settings)
  localStorage.setItem('settings', data)
}

// After: 共通化
function saveToLocalStorage(key, value) {
  const data = JSON.stringify(value)
  localStorage.setItem(key, data)
}
```

---

### 4. import-paths（インポートパスの統一）
相対パス/絶対パスの混在を解消し、エイリアスを使用します。

**チェック項目:**
- `../../` の連続使用
- エイリアス（`@common/*`）の未使用
- インポート順序の統一

**例:**
```typescript
// Before
import { Item } from '../../../common/types'
import { Button } from '../../components/Button'

// After
import { Item } from '@common/types'
import { Button } from '@/components/Button'
```

---

### 5. large-files（大きなファイルの分割）
500行を超えるファイルを特定し、適切に分割します。

**分割基準:**
- 1ファイル > 500行
- 複数の責任を持つファイル
- 関連性の低いコードの混在

**分割方針:**
- コンポーネントごとに分割
- ロジックをhooksやutilsに分離
- 型定義を別ファイルに分離

---

### 6. code-comments（コメント・ドキュメントの整理）
不足・過剰・陳腐化したコメントを整理します。

**チェック項目:**
- 複雑な関数にコメントが不足
- コードと一致しない古いコメント
- 自明なコードへの冗長なコメント
- JSDocの不足（public関数）

**例:**
```typescript
// Before
// ユーザーを取得
function getUser() {
  return users.filter(u => u.active)  // アクティブなユーザーのみ
}

// After
/**
 * アクティブなユーザーのみを取得します
 * @returns アクティブユーザーの配列
 */
function getActiveUsers() {
  return users.filter(u => u.active)
}
```

---

## 実行フロー

### 1. リファクタリングタイプの選択
AskUserQuestion で6つから選択します。

### 2. 検出フェーズ
選択されたタイプに応じて、対象コードを検出：
- Grep/Glob で対象ファイルを検索
- Read で内容を確認
- 問題箇所をリストアップ

### 3. 分析フェーズ
検出された問題を分析：
- 優先度付け（Critical/High/Medium/Low）
- 影響範囲の確認
- 修正案の作成

### 4. 設計フェーズ
リファクタリング計画を作成：
- どのファイルをどう変更するか
- 影響を受ける他のファイルは？
- テストは必要か？

### 5. 実行フェーズ
ユーザー確認後、リファクタリングを実行：
- Edit/MultiEdit でコード修正
- 段階的に変更（一度に全部変えない）
- 各ステップで動作確認

### 6. 検証フェーズ
リファクタリング後の確認：
- TypeScript型チェック（`npm run type-check`）
- ESLint実行（`npm run lint`）
- ビルド確認（`npm run build`）
- 必要に応じてテスト実行

---

## 使用方法

### タイプ選択（対話型）
```bash
/refactor
```
→ 6つのタイプから選択プロンプトが表示されます

### タイプ指定
```bash
/refactor variable-naming
/refactor complex-functions
/refactor duplicate-code
/refactor import-paths
/refactor large-files
/refactor code-comments
```

---

## ベストプラクティス

### リファクタリング前
- ✅ Gitでコミット（変更前の状態を保存）
- ✅ 影響範囲を確認
- ✅ テストが通ることを確認

### リファクタリング中
- ✅ 小さな変更を積み重ねる
- ✅ 各ステップで動作確認
- ✅ 型エラーが出たらすぐ修正

### リファクタリング後
- ✅ 型チェック・ESLint実行
- ✅ ビルド確認
- ✅ E2Eテスト実行（重要な変更の場合）
- ✅ コミット・PR作成

---

## 注意事項

### 安全性
- 一度に大量の変更をしない
- 各ファイル修正後に型チェックを実行
- 動作確認を怠らない

### スコープ
- 関連ファイルをすべて修正する
- 中途半端な状態で終わらない
- 一貫性を保つ

### パフォーマンス
- 大規模なリファクタリングは複数回に分ける
- 1回のPRで変更するファイルは10-15個まで
- レビュー可能な単位で分割

---

## トラブルシューティング

### 型エラーが大量に発生
- 段階的に戻す
- 1ファイルずつ修正する
- 型定義を先に修正

### ビルドが失敗
- インポートパスの確認
- 循環参照の確認
- 未使用変数の削除

### テストが失敗
- リファクタリングでロジックを変えていないか確認
- テストコードも更新が必要な場合あり

---

## 参考

プロジェクトのコーディング規約：
- **命名規則**: TypeScript/React標準に準拠
- **インポートパス**: `@common/*`, `@/` エイリアス使用
- **ファイルサイズ**: 100-150行を目安（最大500行）
- **関数サイズ**: 1関数30-50行を目安
- **複雑度**: 循環的複雑度10以下を推奨
