---
description: "パス統一の分析と修正"
allowed-tools: ["Edit", "MultiEdit", "Read", "Grep", "Glob"]
---

# Refactor Import Paths

パス統一の分析と修正を行います。

## 実行内容

### 1. パス使用状況の分析
- 相対パスと絶対パスの使用状況調査
- インポート文のパス形式の統計
- ファイルパス指定の一貫性評価
- プロジェクト構造に適したパス形式の検討

### 2. パス形式の標準化方針決定
- プロジェクトの構造とビルドシステムを考慮
- 相対パス vs 絶対パス vs パスエイリアスの選択
- ディレクトリ階層に応じた最適なパス形式
- 保守性・可読性・移植性のバランス評価

### 3. パス統一の実行・修正
- 決定した方針に基づくパス形式の統一
- インポート文の一括修正
- ファイルパス指定の統一
- 設定ファイル（tsconfig.json等）の更新

### 4. パス設定の最適化
- TypeScriptパスマッピングの設定
- Webpack/Viteエイリアス設定の更新
- 相対パスの深いネストの解消
- IDEサポートの向上

## 実行手順

1. **分析フェーズ**: 現在のパス使用状況を調査
2. **方針決定フェーズ**: プロジェクトに最適なパス形式を決定
3. **設定フェーズ**: ビルドツール・IDEの設定更新
4. **修正フェーズ**: ソースコード内のパスを統一
5. **検証フェーズ**: ビルド・動作確認

## パス形式の比較

### 相対パス
```typescript
// メリット: 構造が分かりやすい
import { LauncherService } from '../services/LauncherService';
import { UserConfig } from '../../config/UserConfig';

// デメリット: 深いネスト、移動時の修正必要
import { Utils } from '../../../common/utils/Utils';
```

### 絶対パス（パスマッピング）
```typescript
// メリット: 常に一定、移動に強い
import { LauncherService } from '@/services/LauncherService';
import { UserConfig } from '@/config/UserConfig';
import { Utils } from '@/common/utils/Utils';

// 設定例（tsconfig.json）
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/renderer/components/*"],
      "@/services/*": ["src/main/services/*"]
    }
  }
}
```

### パスエイリアス
```typescript
// 機能別エイリアス
import { LauncherService } from '@services/LauncherService';
import { Button } from '@components/Button';
import { CONFIG } from '@config/constants';

// 設定例
{
  "paths": {
    "@services/*": ["src/main/services/*"],
    "@components/*": ["src/renderer/components/*"],
    "@config/*": ["src/config/*"],
    "@utils/*": ["src/common/utils/*"]
  }
}
```

## 推奨パス戦略

### プロジェクト規模別推奨

#### 小規模プロジェクト（~50ファイル）
- **相対パス中心**: `../`, `./`
- **深いネストのみエイリアス**: `@/`

#### 中規模プロジェクト（50-200ファイル）
- **機能別エイリアス**: `@components/`, `@services/`
- **共通処理は絶対パス**: `@/common/`

#### 大規模プロジェクト（200ファイル以上）
- **詳細なパスマッピング**: 機能・レイヤー別
- **チーム別エイリアス**: 担当範囲を明確化

## Electron特有の考慮事項

### プロセス別パス管理
```typescript
// Main Process
import { app } from 'electron';
import { LauncherService } from '@main/services/LauncherService';

// Renderer Process  
import { ipcRenderer } from 'electron';
import { LauncherWindow } from '@renderer/components/LauncherWindow';

// Shared/Common
import { LauncherItem } from '@shared/types/LauncherItem';
```

### リソースパス
```typescript
// 開発時 vs ビルド後の差異を考慮
const iconPath = isDev 
  ? path.join(__dirname, '../assets/icon.png')
  : path.join(process.resourcesPath, 'assets/icon.png');
```

## 設定ファイル更新例

### tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"],
      "@assets/*": ["src/assets/*"]
    }
  }
}
```

### vite.config.ts / webpack.config.js
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
});
```

## 注意事項

- 機能に影響しない範囲で統一を行います
- 統一前に必ずバックアップを取ることを推奨
- ビルドツールの設定更新が必要な場合があります
- IDEの設定・キャッシュのクリアが必要な場合があります
- チーム内での合意形成を重視します

## 使用方法

```
/refactor-import-paths $ARGUMENTS
```

引数として特定のディレクトリやファイルを指定できます。

### 例：
```
/refactor-import-paths
/refactor-import-paths src/renderer/
/refactor-import-paths --analyze-only  # 分析のみ実行
```