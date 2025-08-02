---
description: "ESLintによるチェック・修正とコードフォーマット"
allowed-tools: ["Bash", "Edit", "MultiEdit"]
---

# Check ESLint

ESLintによるコード規約チェック・自動修正とPrettierによるフォーマットを行います。

## 実行内容

1. **ESLintによるコード規約チェック**
   ```bash
   !npm run lint
   ```

2. **ESLintの自動修正**
   ```bash
   !npm run lint:fix
   ```

3. **コードフォーマット**
   ```bash
   !npm run format
   ```

4. **エラー発生時の対応**
   - ESLintエラーが残っている場合は、手動修正を実行
   - エラー箇所を特定し、コード規約に従って修正
   - 修正後、再度lintチェックを実行して確認

## 注意事項

- 自動修正前に必ずGitでコミットしておくことを推奨
- 大きな変更が発生する可能性があるため、実行前に確認

## 使用方法

```
/check-eslint
```