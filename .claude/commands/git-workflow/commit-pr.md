---
description: "変更のコミット・プッシュ・PR作成（3モード対応）"
allowed-tools: ["Bash", "TodoWrite", "Task", "AskUserQuestion"]
---

# Commit PR

変更をコミット・プッシュし、プルリクエストを作成するコマンドです。
3つのモードから選択できます。

## モード選択

コマンド実行時に、以下の3つのモードから選択してください：

### 1. simple（シンプル）
- **承認**: なし（自動実行）
- **品質チェック**: なし
- **用途**: 小さな変更を素早くPR化

### 2. interactive（標準）
- **承認**: あり
- **品質チェック**: なし
- **用途**: 通常の開発フロー

### 3. full（完全）
- **承認**: あり
- **品質チェック**: あり（quality-checker, documentation-updater, e2e-test-runner）
- **用途**: 重要な変更、リリース前

---

## 実行フロー

### 共通フロー（全モード）

#### 1. 現在の状態確認
```bash
!git status
!git diff
!git log --oneline -10
```

#### 2. コミットメッセージとPR内容の作成
- 変更内容を分析
- プロジェクトの規則に従ってコミットメッセージを自動生成
- PR概要を自動生成

### モード別フロー

#### simple モード

3. **コミット実行（承認なし）**
   ```bash
   !git add .
   !git commit -m "..."
   ```

4. **プッシュ実行**
   ```bash
   !git push -u origin <current-branch>
   ```

5. **PR作成**
   ```bash
   !gh pr create --title "..." --body "..."
   ```

---

#### interactive モード

3. **ユーザー確認**
   - コミットメッセージを表示
   - PR内容を表示
   - 実行の承認を求める

4. **承認後、コミット・プッシュ・PR作成**
   ```bash
   !git add .
   !git commit -m "..."
   !git push -u origin <current-branch>
   !gh pr create --title "..." --body "..."
   ```

---

#### full モード

3. **品質チェック（quality-checker）**
   ```
   Task tool with subagent_type="quality-checker"
   ```
   - TypeScript型チェック
   - ESLintチェック
   - コード複雑度、命名規則、重複コード、セキュリティ
   - **Critical問題がある場合**: コミット前に修正を促す

4. **ドキュメント更新（documentation-updater）**
   ```
   Task tool with subagent_type="documentation-updater"
   ```
   - 変更内容の分析
   - 関連ドキュメントの特定と更新

5. **E2Eテスト実行（e2e-test-runner）**
   ```
   Task tool with subagent_type="e2e-test-runner"
   ```
   - Playwright E2Eテストの実行
   - 失敗時の詳細分析

6. **ユーザー確認**
   - コミットメッセージを表示
   - PR内容を表示
   - 品質チェック結果のサマリーを表示
   - 実行の承認を求める

7. **承認後、コミット・プッシュ・PR作成**
   ```bash
   !git add .
   !git commit -m "..."
   !git push -u origin <current-branch>
   !gh pr create --title "..." --body "..."
   ```

---

## コミットメッセージフォーマット

プロジェクトの規則に従って以下の形式で生成します：

```
<type>: <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**type:**
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント
- `test`: テスト
- `chore`: その他

---

## PR概要フォーマット

```markdown
## Summary
<1-3 bullet points>

## Test plan
- [ ] 動作確認項目1
- [ ] 動作確認項目2
- [ ] E2Eテスト実行（fullモード時）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## 使用方法

### モード指定なし（対話選択）
```bash
/commit-pr
```
→ モード選択プロンプトが表示されます

### モード指定あり
```bash
/commit-pr simple
/commit-pr interactive
/commit-pr full
```

---

## 注意事項

### simple モード
- ユーザー承認なしで自動実行されます
- 小さな変更のみに使用してください
- 慎重な確認が必要な場合は interactive または full を使用

### full モード
- 品質チェック・テスト実行に時間がかかります（5-10分程度）
- Critical問題がある場合、コミット前に修正が必要です
- リリース前や重要な変更時に使用してください

### Git操作の安全性
- NEVER run destructive git commands (force push, hard reset) unless explicitly requested
- NEVER skip hooks (--no-verify, --no-gpg-sign)
- NEVER amend commits unless ALL conditions are met (see CLAUDE.md)
- If commit fails due to pre-commit hook, fix the issue and create a NEW commit

---

## トラブルシューティング

### コミットが失敗する
- pre-commit フックのエラーを確認
- エラーを修正してから再度実行

### プッシュが失敗する
- リモートブランチが存在しない場合は `-u` フラグで upstream 設定
- リモートが最新の場合は pull してからpush

### PR作成が失敗する
- GitHub CLIが認証済みか確認: `gh auth status`
- リモートにブランチがプッシュ済みか確認

### 品質チェックで Critical 問題（full モード）
1. quality-checker のレポートを確認
2. 問題を修正
3. 再度 `/commit-pr full` を実行
