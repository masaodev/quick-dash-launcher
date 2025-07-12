---
description: "Reactコンポーネントの品質を分析"
allowed-tools: ["Read", "Grep", "Glob"]
---

# Component Analyze

Reactコンポーネントの品質と最適化の機会を分析します。

## 分析項目

1. **Props型定義の完成度**
   - TypeScriptインターフェースの完成度
   - オプショナルプロパティの適切な使用
   - デフォルト値の設定状況

2. **Hooks使用の最適化**
   - useEffectの依存配列の検証
   - 不要な再レンダリングの検出
   - カスタムHooksの活用機会

3. **パフォーマンス最適化**
   - useMemo, useCallbackの必要性
   - React.memoの適用候補
   - 重いコンポーネントの特定

4. **アクセシビリティ**
   - aria属性の使用状況
   - セマンティックHTMLの使用
   - キーボードナビゲーション対応

5. **コンポーネント設計**
   - 単一責任原則の遵守
   - 適切なコンポーネント分割
   - 再利用性の評価

## 使用方法

```
/component-analyze $ARGUMENTS
```

引数として特定のコンポーネントファイルまたはディレクトリを指定できます。

### 例：
```
/component-analyze src/components/LauncherWindow.tsx
/component-analyze src/components/
```