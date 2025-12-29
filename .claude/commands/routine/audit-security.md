---
description: "npm auditによるセキュリティ脆弱性チェック"
allowed-tools: ["Bash", "Read"]
---

# Audit Security

npm auditを実行して、依存パッケージのセキュリティ脆弱性を確認します。

## 実行内容

1. **セキュリティ監査の実行**
   ```bash
   !npm audit
   ```
   - 脆弱性の検出（Critical, High, Moderate, Low）
   - 影響を受けるパッケージの特定
   - 利用可能な修正の確認

2. **詳細レポートの取得**
   ```bash
   !npm audit --json
   ```
   - JSON形式で詳細情報を取得
   - 脆弱性のCVE番号、パッチバージョン等を確認

3. **自動修正の提案**
   ```bash
   # 自動修正可能な場合
   !npm audit fix

   # 破壊的変更を含む修正
   !npm audit fix --force
   ```

4. **重要度別の対応方針**
   - **Critical/High**: 即座に対応が必要
   - **Moderate**: 近日中に対応
   - **Low**: 次のメンテナンス時に対応

## 修正手順

1. `npm audit fix` で自動修正可能なものを適用
2. 自動修正不可の場合は手動でpackage.jsonを更新
3. テスト実行で動作確認
4. 問題なければコミット

## 注意事項

- `npm audit fix --force` は破壊的変更を含む可能性があるため注意
- 修正後は必ずE2Eテストと単体テストを実行
- 依存関係の更新により、ビルドが失敗する可能性あり

## 使用方法

```
/audit-security
```

## 実行タイミング

- 週1回の定期チェック
- デプロイ前の最終確認
- GitHub Dependabotアラート受信時
