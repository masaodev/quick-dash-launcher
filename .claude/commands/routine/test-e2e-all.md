---
description: "全E2Eテストの実行と失敗分析"
allowed-tools: ["Task", "TodoWrite"]
---

# Test E2E All

e2e-test-runnerエージェントを使用して、全E2Eテストを実行します。

## 実行内容

このコマンドは `e2e-test-runner` エージェントを呼び出し、以下を自動実行します：

### 実行フロー

1. **E2Eテストの実行**
   - `npm run test:e2e` の実行
   - Playwright E2Eテストをヘッドレスモードで実行

2. **テスト結果の分析**
   - 成功/失敗したテストケースの集計
   - 失敗したテストの詳細分析

3. **失敗時の詳細調査**
   - スクリーンショットの確認
   - トレースファイルの解析
   - エラーメッセージの分析

4. **原因特定と修正案提示**
   - 失敗原因の特定（タイミング問題、セレクタ問題等）
   - 修正案の提示
   - デバッグ推奨アクション

## テスト対象

以下のE2Eテストが実行されます：

- `first-launch.spec.ts` - 初回起動セットアップ
- `basic-ui.spec.ts` - 基本UI（アイテム表示・選択・検索）
- `item-register.spec.ts` - アイテム登録・編集
- `item-management.spec.ts` - 管理画面での編集・削除・整列
- `multi-tab.spec.ts` - マルチタブ機能
- `settings.spec.ts` - 設定タブ
- `context-menu.spec.ts` - コンテキストメニュー
- `alert-dialog.spec.ts` - 通知ダイアログ
- `confirm-dialog.spec.ts` - 確認ダイアログ
- `group-item-register.spec.ts` - グループアイテム登録

## 出力形式

エージェントは以下の情報を提供します：

- **テスト結果サマリー**: 成功/失敗数、実行時間
- **失敗テスト詳細**: エラーメッセージ、スタックトレース
- **スクリーンショット分析**: 失敗時の画面状態
- **修正推奨**: 具体的な修正方法

## 使用方法

```
/test-e2e-all
```

内部的に以下のエージェントが実行されます：

```
Task tool with subagent_type="e2e-test-runner"
```

## 実行タイミング

- コミット・PR作成前（`commit-pr-full`で自動実行）
- 機能実装完了後
- リファクタリング後
- 週1回の定期メンテナンス

## 注意事項

- テスト実行には5-10分程度かかります
- **重要**: エージェントは1回のみテスト実行します（複数回実行しません）
- 失敗時は、エージェントの分析結果を確認してから修正してください
- e2e-test-runnerエージェントの詳細は `.claude/agents/e2e-test-runner.md` を参照

## デバッグ方法

テスト失敗時の詳細デバッグ：

```bash
# UI付きで実行
npm run test:e2e:headed

# デバッグモードで実行
npm run test:e2e:debug

# 特定のテストのみ実行
npm run test:e2e:single <test-name>
```
