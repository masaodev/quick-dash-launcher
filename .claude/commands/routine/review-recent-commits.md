---
description: "直近のコミットログを分析し品質チェック・ドキュメント反映確認"
allowed-tools: ["Bash", "Read", "Grep", "Glob", "Task", "TodoWrite", "AskUserQuestion"]
---

# Review Recent Commits

直近数日分のコミットログを取得し、各コミットの変更内容を分析して品質チェックとドキュメント反映を確認します。

## 実行内容

### 1. 対象期間の設定

デフォルトで直近3日分のコミットを対象とします。
引数で日数を指定することも可能です。

```bash
# 直近3日分（デフォルト）
/review-recent-commits

# 直近7日分
/review-recent-commits 7
```

### 2. コミットログの取得

```bash
# 直近N日分のコミット一覧を取得
!git log --since="N days ago" --oneline --no-merges

# 詳細情報も取得
!git log --since="N days ago" --pretty=format:"%h - %an, %ar : %s" --no-merges
```

**出力例:**
```
a1b2c3d - Claude Sonnet 4.5, 2 hours ago : feat: 検索モード切り替え機能を追加
e4f5g6h - Claude Sonnet 4.5, 1 day ago : fix: extract-file-iconをVite externalsに追加
i7j8k9l - Claude Sonnet 4.5, 2 days ago : refactor: コード品質改善とドキュメント更新
```

### 3. 各コミットの変更内容分析

各コミットについて、以下を確認：

```bash
# 変更されたファイル一覧
!git diff-tree --no-commit-id --name-only -r <commit-hash>

# 変更の統計（追加・削除行数）
!git show <commit-hash> --stat

# 変更内容の詳細
!git show <commit-hash>
```

**分析項目:**
- 変更されたファイル数
- 追加・削除された行数
- 変更の種類（新機能、バグ修正、リファクタリング等）
- 影響範囲（コア機能、UI、テスト、ドキュメント等）

### 4. 品質チェック（quality-checker）

全体のコード品質をチェック：

```
Task tool with subagent_type="quality-checker"
```

**チェック内容:**
- TypeScript型チェック
- ESLintチェック
- コード複雑度
- 命名規則
- 重複コード
- セキュリティリスク

**結果:**
- Critical/High/Medium/Low の優先度付きレポート
- 問題が検出された場合、該当コミットとの関連を分析

### 5. ドキュメント反映確認（documentation-updater）

変更内容に対するドキュメント更新の確認：

```
Task tool with subagent_type="documentation-updater"
```

**確認内容:**
- 新機能追加 → `docs/features/` の更新が必要か
- UI変更 → `docs/screens/` の更新が必要か
- 設定変更 → `docs/features/settings.md` の更新が必要か
- API変更 → `docs/architecture/ipc-channels.md` の更新が必要か

**結果:**
- 更新が必要なドキュメントのリスト
- 既に更新済みのドキュメント
- 更新が不足しているドキュメント

### 6. レポート生成

以下の形式でレポートを生成：

```markdown
## 直近N日分のコミット分析レポート

### 📊 サマリー
- 対象期間: YYYY-MM-DD 〜 YYYY-MM-DD
- コミット数: X件
- 変更ファイル数: Y件
- 追加行数: +ZZZ
- 削除行数: -ZZZ

### 📝 コミット一覧
1. [a1b2c3d] feat: 検索モード切り替え機能を追加 (2 hours ago)
   - 変更ファイル: 5件
   - +120 / -30 行
   - 影響: UI, 機能追加

2. [e4f5g6h] fix: extract-file-iconをVite externalsに追加 (1 day ago)
   - 変更ファイル: 1件
   - +2 / -0 行
   - 影響: ビルド設定

### ✅ 品質チェック結果
- **Critical**: 0件
- **High**: 1件 - 複雑度が高い関数が1つ検出
- **Medium**: 3件
- **Low**: 5件

### 📖 ドキュメント反映状況
- ✅ 更新済み: 3件
  - docs/features/workspace.md
  - docs/screens/main-window.md
  - docs/architecture/data-format.md
- ⚠️ 更新推奨: 1件
  - docs/features/keyboard-shortcuts.md（新しいショートカット追加）

### 🎯 推奨アクション
1. [High] SearchPanel.tsxの複雑度を削減（リファクタリング推奨）
2. [Medium] keyboard-shortcuts.mdを更新
3. [Low] 変数名の一貫性改善
```

---

## 使用方法

### デフォルト（直近3日分）
```bash
/review-recent-commits
```

### 日数指定
```bash
/review-recent-commits 7   # 直近7日分
/review-recent-commits 1   # 直近1日分
```

---

## 実行タイミング

### 推奨頻度
- **毎週月曜日**: 先週の変更を振り返り
- **リリース前**: リリース候補の最終チェック
- **長期休暇後**: 複数日分の変更を一括レビュー

### 使用シーン
1. **週次レビュー**: チームで1週間の変更を振り返る
2. **品質確認**: 最近のコミットで品質が低下していないか確認
3. **ドキュメント整合性**: ドキュメントが最新のコードと一致しているか確認
4. **技術的負債の早期発見**: 品質問題を早期に検出

---

## 出力例

```bash
$ /review-recent-commits 3

📊 直近3日分のコミットを分析中...

取得したコミット: 5件
- a1b2c3d: feat: 検索モード切り替え機能を追加
- e4f5g6h: fix: extract-file-iconをVite externalsに追加
- i7j8k9l: refactor: コード品質改善とドキュメント更新
- m1n2o3p: feat: 管理ウィンドウに行複製機能を追加
- q4r5s6t: docs: キーボードショートカットドキュメント更新

🔍 品質チェック実行中...
→ quality-checker エージェント起動

✅ 品質チェック完了
- Critical: 0件
- High: 1件

📖 ドキュメント確認中...
→ documentation-updater エージェント起動

✅ ドキュメント確認完了
- 更新済み: 4件
- 更新推奨: 1件

📋 レポート生成完了
```

---

## 他のコマンドとの違い

| コマンド | タイミング | 対象 | 用途 |
|---------|-----------|------|------|
| **review-recent-commits** | 事後 | 直近のコミット | 過去の変更を振り返り |
| `/sync-and-validate` | 事前 | mainブランチ最新 | リモート同期・総合検証 |
| `/commit-pr full` | 事前 | 現在の変更 | コミット前の品質チェック |
| `/quality-check-all` | 随時 | 現在のコード全体 | コード全体の品質確認 |

**review-recent-commits の特徴:**
- ✅ コミット単位で変更を追跡
- ✅ 過去の変更に対する事後チェック
- ✅ ドキュメント更新漏れの検出
- ✅ 週次レビューに最適

---

## 注意事項

### 対象コミット
- マージコミットは除外されます（`--no-merges`）
- 指定された期間内のコミットのみが対象
- リモートブランチではなく、ローカルブランチのコミットを分析

### 実行時間
- コミット数が多い場合、品質チェックに時間がかかります（5-10分程度）
- 軽量チェックが必要な場合は `/quality-check-all` を使用

### 結果の解釈
- **Critical/High問題**: 早急に対応が必要
- **ドキュメント更新推奨**: 次回のコミット時に反映
- コミット後の事後チェックなので、必要に応じて追加コミットで修正

---

## トラブルシューティング

### コミットが見つからない
```bash
# 期間を広げて確認
/review-recent-commits 7

# または手動でコミット確認
git log --since="3 days ago" --oneline
```

### 品質チェックでCritical問題
1. レポートで該当コミットを確認
2. `/refactor` でリファクタリング
3. 修正をコミット

### ドキュメント更新漏れ
1. レポートで更新が必要なドキュメントを確認
2. 手動またはdocumentation-updaterで更新
3. ドキュメント更新をコミット

---

## 実装フロー

```
1. 日数指定の確認（デフォルト: 3日）
   ↓
2. git log で直近N日分のコミット取得
   ↓
3. 各コミットの詳細情報収集
   - 変更ファイル
   - 追加・削除行数
   - コミットメッセージ分析
   ↓
4. quality-checker 実行
   - 現在のコードベース全体をチェック
   ↓
5. documentation-updater 実行
   - 変更内容とドキュメントの整合性確認
   ↓
6. レポート生成・表示
   - サマリー
   - 問題リスト
   - 推奨アクション
```

---

## 参考

関連コマンド:
- `/sync-and-validate` - リモート最新取得・総合検証
- `/quality-check-all` - 総合品質チェック
- `/commit-pr full` - 品質チェック付きコミット・PR
