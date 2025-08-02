---
description: "コメント・ドキュメントの分析と整理"
allowed-tools: ["Edit", "MultiEdit", "Read", "Grep", "Glob"]
---

# Refactor Code Comments

コメント・ドキュメントの分析と整理を行います。

## 実行内容

### 1. 既存コメントの分析・評価
- 古い・不正確なコメントの特定
- 冗長なコメントの検出
- コードと一致しないコメントの発見
- コメントの品質・有用性の評価

### 2. 不要コメントの削除
- 明らかすぎる説明コメントの除去
- 古いコード片やデバッグコメントの削除
- TODO/FIXMEの整理と分類
- 自己説明的なコードに対する冗長コメントの除去

### 3. 必要コメントの追加・改善
- 複雑なロジックへの説明コメント追加
- APIドキュメント（JSDoc）の充実
- 型定義・インターフェースのドキュメント化
- 設計意図・制約事項の説明追加

### 4. ドキュメント構造の最適化
- JSDocフォーマットの統一
- パラメータ・戻り値の詳細説明
- 使用例・サンプルコードの追加
- 関連リンク・参考資料の整備

## 実行手順

1. **分析フェーズ**: 既存コメント・ドキュメントの品質評価
2. **整理フェーズ**: 不要・不正確なコメントの除去
3. **補完フェーズ**: 必要なコメント・ドキュメントの追加
4. **統一フェーズ**: フォーマット・スタイルの統一
5. **検証フェーズ**: ドキュメントの正確性確認

## コメント分類と対応

### 削除対象のコメント
```typescript
// Bad: 明らかすぎる
let count = 0; // カウンターを0で初期化

// Bad: 古い情報
// TODO: バージョン1.0でこの機能を追加 (既に追加済み)

// Bad: コードと不一致
// ユーザー名を取得
function getUserId() { return user.id; }
```

### 改善・追加対象のコメント
```typescript
// Good: 複雑なロジックの説明
/**
 * ホットキーの組み合わせを正規化する
 * Ctrl+Alt+W → ctrl+alt+w (小文字化、順序統一)
 */
function normalizeHotkey(combination: string): string { /* ... */ }

// Good: 制約・注意事項
/**
 * @param filePath 絶対パスである必要があります
 * @throws {Error} ファイルが存在しない場合
 */
function readConfigFile(filePath: string): Config { /* ... */ }
```

## JSDocガイドライン

### 基本構造
```typescript
/**
 * 関数の概要説明
 * 
 * 詳細説明（必要に応じて）
 * 
 * @param paramName - パラメータの説明
 * @returns 戻り値の説明
 * @throws エラーの説明
 * @example
 * ```typescript
 * const result = functionName(value);
 * ```
 */
```

### インターフェース・型定義
```typescript
/**
 * ランチャーアイテムの設定情報
 */
interface LauncherItem {
  /** アイテムの一意識別子 */
  id: string;
  
  /** 表示名 */
  name: string;
  
  /** 実行パス（絶対パスまたは相対パス） */
  path: string;
  
  /** アイコンファイルのパス（オプション） */
  iconPath?: string;
}
```

## TODO/FIXMEの管理

### 分類基準
- **TODO**: 将来的な機能追加・改善
- **FIXME**: 既知のバグ・問題
- **HACK**: 一時的な回避策
- **NOTE**: 重要な注意事項

### 整理方法
```typescript
// Good: 具体的で追跡可能
// TODO(v2.0): アイコンキャッシュ機能の実装 (#123)
// FIXME: WindowsでCtrl+Alt+Wが効かない場合がある (#456)

// Bad: 曖昧
// TODO: これを修正
// FIXME: バグあり
```

## ドキュメント品質基準

### 良いコメント・ドキュメント
- **目的明確**: なぜそのコードが必要か
- **制約説明**: 制限事項・注意点
- **使用例**: 具体的な使い方
- **最新性**: コードと一致している

### 避けるべきコメント
- **明らか**: コードを読めば分かる内容
- **冗長**: 必要以上に詳しい説明
- **古い**: 現在のコードと矛盾
- **感情的**: 愚痴・不満の記載

## 注意事項

- 機能に影響しない範囲で整理を行います
- 重要な設計判断の背景は残すことを推奨
- 外部APIやライブラリの使用理由は保持
- チーム内での命名規則・コメント規則に従います

## 使用方法

```
/refactor-code-comments $ARGUMENTS
```

引数として特定のディレクトリやファイルを指定できます。

### 例：
```
/refactor-code-comments
/refactor-code-comments src/renderer/components/
/refactor-code-comments src/main/services/LauncherService.ts
```