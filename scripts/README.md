# Scripts

開発用のユーティリティスクリプト集

## ウィンドウデバッグツール

### debug-windows.mjs

ウィンドウ検索機能のデバッグと動作確認用ツール。

**用途:**
- ウィンドウ一覧の取得と確認
- 除外ルールの動作確認
- プロセス名・クラス名・実行パスの確認
- トラブルシューティング

**使い方:**

```bash
# 基本的な使い方（現在のデスクトップのみ）
node scripts/debug-windows.mjs

# npmコマンド経由
npm run debug:windows

# 全仮想デスクトップのウィンドウを取得
npm run debug:windows -- --all-desktops

# 除外されたウィンドウも表示
npm run debug:windows -- --show-excluded

# 実行パスも表示
npm run debug:windows -- --show-paths

# ファイルに出力
npm run debug:windows -- --all-desktops --show-excluded --output debug-output.txt

# すべてのオプションを使用
npm run debug:windows -- --all-desktops --show-excluded --show-paths --output debug.txt
```

**オプション:**

| オプション | 説明 |
|-----------|------|
| `--all-desktops` | 全仮想デスクトップのウィンドウを取得 |
| `--show-excluded` | 除外されたウィンドウも表示 |
| `--show-paths` | 実行パス（exeのフルパス）も表示 |
| `--output <file>` | 結果をファイルに保存 |

**出力例:**

```
================================================================================
ウィンドウデバッグツール
================================================================================

取得範囲: 全仮想デスクトップ
✓ 表示されるウィンドウ: 17個
✗ 除外されるウィンドウ: 2個

================================================================================
表示されるウィンドウ:
================================================================================

[1] Google Chrome
  プロセス名: chrome.exe
  クラス名:   Chrome_WidgetWin_1

[2] Visual Studio Code
  プロセス名: Code.exe
  クラス名:   Chrome_WidgetWin_1

...

================================================================================
除外されたウィンドウ:
================================================================================

[1] Windows 入力エクスペリエンス
  プロセス名: TextInputHost.exe
  クラス名:   Windows.UI.Core.CoreWindow
  除外理由:   Windows 入力エクスペリエンス

[2] Program Manager
  プロセス名: explorer.exe
  クラス名:   Progman
  除外理由:   デスクトップ壁紙（Program Manager）

================================================================================
除外ルール（プロセス名とクラス名の両方が一致する必要あり）:
================================================================================

[1] Windows 入力エクスペリエンス
  プロセス名: TextInputHost.exe
  クラス名:   Windows.UI.Core.CoreWindow

[2] Windowsシェルエクスペリエンス
  プロセス名: ShellExperienceHost.exe
  クラス名:   Windows.UI.Core.CoreWindow

[3] デスクトップ壁紙（Program Manager）
  プロセス名: explorer.exe
  クラス名:   Progman
```

## トラブルシューティング

### ウィンドウが表示されない場合

1. **除外ルールで除外されていないか確認**
   ```bash
   npm run debug:windows -- --show-excluded
   ```

2. **全デスクトップを取得しているか確認**
   ```bash
   npm run debug:windows -- --all-desktops
   ```

3. **クローキング状態を確認**
   - 他の仮想デスクトップにあるウィンドウはクローキングされている
   - `--all-desktops`オプションで取得可能

### 除外ルールの追加方法

`src/main/utils/nativeWindowControl.ts`の`EXCLUDED_WINDOWS`配列に追加：

```typescript
const EXCLUDED_WINDOWS = [
  {
    processName: 'YourApp.exe',
    className: 'YourWindowClass',
    description: 'あなたのアプリの説明',
  },
];
```

**注意**: プロセス名とクラス名の**両方**が一致する必要があります（誤検知防止）。
