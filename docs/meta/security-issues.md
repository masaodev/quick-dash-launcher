# セキュリティの課題と対策

## 1. コマンドインジェクションの脆弱性

### 現状の問題点

`src/main/ipc/iconHandlers.ts`で`exec`を使用したレジストリクエリが実装されており、ユーザー入力のサニタイズが不完全な状態です。これにより、悪意のある入力によってシステムコマンドが実行される可能性があります。

### 影響

- 任意のシステムコマンドの実行
- システムファイルへの不正アクセス
- 権限昇格の可能性

### 改善案

```typescript
// execFileを使用した安全な実装
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function queryRegistry(scheme: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('reg', [
      'query',
      `HKEY_CLASSES_ROOT\\${scheme}`,
      '/ve'
    ]);
    return stdout;
  } catch (error) {
    return null;
  }
}
```

## 2. 入力検証の不足

### 現状の問題点

- ファイルパスの検証が不十分
- URLの検証が簡易的すぎる
- ディレクトリトラバーサル攻撃の可能性

### 影響

- 意図しないファイルへのアクセス
- システムファイルの読み取り/書き込み
- 機密情報の漏洩

### 改善案

```typescript
// 入力検証ライブラリの導入
import { z } from 'zod';

const FilePathSchema = z.string().refine(
  (path) => {
    // パスの正規化
    const normalized = path.normalize(path);
    // 親ディレクトリへの参照をチェック
    return !normalized.includes('..');
  },
  { message: 'Invalid file path' }
);

const URLSchema = z.string().url();

// 使用例
function validateFilePath(path: string): string {
  return FilePathSchema.parse(path);
}
```

## 3. 機密情報の管理

### 現状の問題点

- 設定ファイルがプレーンテキストで保存
- APIキーや認証情報の保護が不十分
- ログに機密情報が含まれる可能性

### 改善案

```typescript
// 機密情報の暗号化
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class SecureStorage {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    // Windows Credential Managerから鍵を取得
    this.key = this.getOrCreateKey();
  }

  encrypt(text: string): EncryptedData {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(data: EncryptedData): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(data.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## 4. アクセス制御

### 現状の問題点

- ファイルアクセス権限のチェックが不十分
- ユーザー権限の考慮がない
- 管理者権限での実行を前提としている箇所がある

### 改善案

```typescript
// アクセス権限のチェック
import { access, constants } from 'fs/promises';

async function checkFileAccess(
  filePath: string,
  mode: number = constants.R_OK
): Promise<boolean> {
  try {
    await access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}

// 使用例
async function readFileSecurely(filePath: string): Promise<string | null> {
  // パス検証
  const validPath = validateFilePath(filePath);
  
  // アクセス権限チェック
  if (!await checkFileAccess(validPath, constants.R_OK)) {
    throw new AppError(
      'Access denied',
      'FILE_ACCESS_DENIED',
      'ファイルへのアクセスが拒否されました'
    );
  }
  
  // ファイル読み込み
  return await readFile(validPath, 'utf-8');
}
```

## 5. セキュリティヘッダーとCSP

### 現状の問題点

- Content Security Policy (CSP)が設定されていない
- セキュリティヘッダーが不足
- XSS攻撃への対策が不十分

### 改善案

```typescript
// Electronのセキュリティ設定
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    // 外部URLへのナビゲーションを防ぐ
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });

  // CSPの設定
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "connect-src 'self'"
        ].join('; ')
      }
    });
  });
});
```

## セキュリティチェックリスト

- [ ] すべての外部入力を検証
- [ ] SQLインジェクション対策（データベース使用時）
- [ ] XSS対策の実装
- [ ] CSRF対策の実装
- [ ] 機密情報の暗号化
- [ ] 最小権限の原則の適用
- [ ] セキュリティヘッダーの設定
- [ ] 定期的な依存関係の更新
- [ ] セキュリティ監査の実施

## 関連ドキュメント

- [コードレビュー要約](code-review-summary.md) - レビュー全体の要約
- [コード品質の課題と改善案](code-quality-issues.md) - コード品質の詳細
- [開発ガイド](../guides/development.md) - セキュアコーディングのガイドライン