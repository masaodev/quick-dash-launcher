# フォルダ取込アイテム

フォルダ取込アイテムは、指定したディレクトリ内のファイルやフォルダを動的にインポートする機能です。

## データファイル形式

フォルダ取込アイテムの詳細な構文とオプションについては、**[データファイル形式仕様 - フォルダ取込アイテム行の詳細](../architecture/data-format.md#フォルダ取込アイテム行の詳細)** を参照してください。

## 使用例

### 基本的な使用
```
// Documents フォルダ直下の全てのファイルとフォルダをインポート
dir,C:\Users\Username\Documents
```

### 拡張子でフィルタリング
```
// PowerShellスクリプトのみをインポート
dir,C:\Scripts,filter=*.ps1

// 複数の拡張子を指定
dir,C:\Documents,filter=*.{doc,docx,pdf}
```

### サブディレクトリを含める
```
// 2階層下までの全てのファイルをインポート
dir,C:\Projects,depth=2,types=file

// 全てのサブディレクトリを再帰的にスキャン
dir,C:\Source,depth=-1
```

### 除外パターンの使用
```
// node_modulesフォルダを除外
dir,C:\Projects,exclude=node_modules,depth=2

// 一時ファイルを除外
dir,C:\Work,exclude=*.{tmp,temp,bak}
```

### プレフィックスの追加
```
// "Work: " プレフィックスを追加
dir,C:\WorkProjects,prefix=Work

// フィルターと組み合わせ
dir,C:\Tools,filter=*.exe,prefix=Tool
```

### サフィックスの追加
```
// " (Dev)" サフィックスを追加
dir,C:\Projects,suffix=Dev

// プレフィックスとサフィックスの組み合わせ
dir,C:\Tools,prefix=Work,suffix=Tool
# 結果: "Work: ToolName (Tool)"
```

### 複雑な組み合わせ
```
// Projectsフォルダから、node_modulesを除外し、
// .jsと.tsファイルのみを2階層下まで検索し、
// "Src: "プレフィックスと" (Dev)"サフィックスを追加
dir,C:\Projects,depth=2,types=file,filter=*.{js,ts},exclude=node_modules,prefix=Src,suffix=Dev
# 結果: "Src: filename.js (Dev)"
```

## 特殊な処理

### ショートカットファイル（.lnk）
`.lnk`ファイルは自動的に解析され、ターゲットのパスと引数が抽出されます。

### 実行可能ファイル
`.exe`、`.bat`、`.cmd`、`.com`ファイルは`app`タイプとして認識されます。

**注:** `.bat`、`.cmd`、`.com`ファイルは、アイコン取得時に拡張子ベースのアイコン取得方式が使用されます（ファイル自体にアイコンリソースがないため）。

## フォルダ取込アイテムの確認方法

メインウィンドウで、フォルダ取込から展開されたアイテムにマウスをホバーすると、ツールチップで以下の情報が確認できます：

- **取込元**: フォルダ取込アイテムの元ディレクトリパス
- **設定**: フォルダ取込時に指定されたオプション情報（深さ、タイプ、フィルター等）

### ツールチップの表示例

```
C:\Work\projects\myproject\readme.pdf

データ元: data.txt
行番号: 15
取込元: C:\Work\projects
設定: 深さ:2, タイプ:ファイルのみ, フィルター:*.pdf
```

この機能により、どのフォルダ取込アイテムから展開されたかを簡単に確認できます。

## 注意事項

1. **パフォーマンス**: 深い階層や大量のファイルを含むディレクトリをスキャンする場合、処理時間が長くなる可能性があります。
2. **アクセス権限**: アクセス権限のないディレクトリやファイルはスキップされます。
3. **重複**: 複数のフォルダ取込アイテムで同じファイルがインポートされた場合、パスベースで重複が除去されます。
4. **オプション値の制約**: `filter`、`exclude`、`prefix`、`suffix`オプションの値にカンマ（`,`）は使用できません。カンマはオプション区切り文字として予約されています。