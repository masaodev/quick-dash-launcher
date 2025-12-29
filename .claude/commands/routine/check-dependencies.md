---
description: "依存関係の更新確認と推奨アクション提示"
allowed-tools: ["Bash", "Read"]
---

# Check Dependencies

npmパッケージの依存関係を確認し、更新が必要なパッケージを特定します。

## 実行内容

1. **outdatedパッケージの確認**
   ```bash
   !npm outdated
   ```
   - 現在のバージョン、最新バージョン、希望バージョンを表示
   - メジャー、マイナー、パッチ更新の分類

2. **package.jsonの確認**
   ```bash
   !cat package.json | grep -A 50 '"dependencies"'
   !cat package.json | grep -A 50 '"devDependencies"'
   ```

3. **更新推奨の提示**
   - **パッチ更新**: 安全に更新可能（バグフィックス）
   - **マイナー更新**: 後方互換性あり（新機能追加）
   - **メジャー更新**: 破壊的変更の可能性あり（慎重に検討）

4. **更新コマンドの提案**
   ```bash
   # 例: パッチ更新のみ
   !npm update

   # 例: 特定パッケージの更新
   !npm install <package-name>@latest
   ```

## 注意事項

- メジャー更新は破壊的変更を含む可能性があるため、CHANGELOG確認を推奨
- 更新前にブランチを切り、テストを実行してから統合
- package-lock.jsonも更新されるため、コミット時に含める

## 使用方法

```
/check-dependencies
```

## 実行タイミング

- 週1回の定期チェック
- リリース前のメンテナンス
- セキュリティアップデート確認時
