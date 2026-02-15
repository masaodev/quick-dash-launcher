/**
 * 登録アプリ（UWP/MSIX）のアイコン取得テストスクリプト
 *
 * 使い方:
 *   npx tsx src/test/manual/testUwpIconExtract.ts
 *
 * Get-StartApps で取得した登録アプリ一覧に対し、
 * extractUwpIcon と同等のロジック（マニフェストベース）でアイコン取得を試み、
 * 成功/失敗の原因を一覧表示する。
 */
/* eslint-disable no-console -- 手動テスト用スクリプト */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// --- Get-StartApps から登録アプリを取得 ---

interface StartAppEntry {
  Name: string;
  AppID: string;
}

function isFilePathAppId(appId: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(appId) || appId.startsWith('{') || appId.startsWith('\\\\');
}

function getRegisteredApps(): { name: string; appPath: string }[] {
  const output = execSync(
    'powershell.exe -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-StartApps | ConvertTo-Json -Compress"',
    { encoding: 'utf8', timeout: 15000 }
  );
  const parsed: StartAppEntry[] = JSON.parse(output.trim());
  const results: { name: string; appPath: string }[] = [];

  for (const entry of parsed) {
    if (!entry.Name || !entry.AppID) continue;
    if (isFilePathAppId(entry.AppID)) continue;
    if (entry.AppID.includes('://')) continue;

    results.push({
      name: entry.Name,
      appPath: `shell:AppsFolder\\${entry.AppID}`,
    });
  }
  return results;
}

// --- マニフェストベースのロジック（iconHandlers.ts と同等） ---

type FailReason =
  | 'NO_EXCLAMATION_IN_APPID'
  | 'APPX_PACKAGE_NOT_FOUND'
  | 'MANIFEST_NO_LOGO_PATH'
  | 'NO_ICON_FILE_FOUND'
  | 'ICON_FILE_EMPTY'
  | 'POWERSHELL_ERROR';

interface DiagResult {
  name: string;
  appPath: string;
  success: boolean;
  failReason?: FailReason;
  detail?: string;
  iconFile?: string;
  iconSize?: number;
}

function extractPackageFamilyName(appPath: string): string | null {
  const match = appPath.match(/shell:AppsFolder\\(.+)!/);
  return match?.[1] ?? null;
}

/** ベース名・拡張子でフィルタし、scaleの小さい順にソートする */
function filterAndSortByScale(
  files: string[],
  baseName: string,
  ext: string,
  excludeVariants: boolean
): string[] {
  return files
    .filter(
      (f) =>
        f.startsWith(baseName) &&
        f.endsWith(ext) &&
        (!excludeVariants || (!f.includes('contrast-') && !f.includes('_altform-')))
    )
    .sort((a, b) => {
      const scaleA = parseInt(a.match(/scale-(\d+)/)?.[1] ?? '999');
      const scaleB = parseInt(b.match(/scale-(\d+)/)?.[1] ?? '999');
      return scaleA - scaleB;
    });
}

/** マニフェストのロゴパスから実際のアイコンファイルを探す（iconHandlers.ts の findIconFromManifestLogo と同等） */
function findIconFromManifestLogo(installLocation: string, logoPaths: string[]): string | null {
  for (const logoRelPath of logoPaths) {
    const fullPath = path.join(installLocation, logoRelPath);

    if (fs.existsSync(fullPath)) return fullPath;

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) continue;

    const baseName = path.basename(logoRelPath, path.extname(logoRelPath));
    const ext = path.extname(logoRelPath);
    const files = fs.readdirSync(dir);

    const preferred = filterAndSortByScale(files, baseName, ext, true);
    if (preferred.length > 0) return path.join(dir, preferred[0]);

    const fallback = filterAndSortByScale(files, baseName, ext, false);
    if (fallback.length > 0) return path.join(dir, fallback[0]);
  }
  return null;
}

function diagnoseIconExtract(name: string, appPath: string): DiagResult {
  const base = { name, appPath };

  // 1. パッケージファミリー名の抽出
  const packageFamilyName = extractPackageFamilyName(appPath);
  if (!packageFamilyName) {
    return { ...base, success: false, failReason: 'NO_EXCLAMATION_IN_APPID', detail: appPath };
  }

  // 2. マニフェストからアイコンパスとインストール先を取得
  const packageName = packageFamilyName.split('_')[0];
  let lines: string[];
  try {
    const output = execSync(
      `powershell.exe -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $p = Get-AppxPackage -Name '${packageName}' | Select-Object -First 1; if ($p) { $m = Get-AppxPackageManifest -Package $p; $a = $m.Package.Applications.Application; if ($a -is [System.Array]) { $a = $a[0] }; $v = $a.VisualElements; Write-Output $p.InstallLocation; Write-Output $v.Square44x44Logo; Write-Output $v.Square150x150Logo }"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    lines = output.trim().split(/\r?\n/);
  } catch (error) {
    return {
      ...base,
      success: false,
      failReason: 'POWERSHELL_ERROR',
      detail: `packageName=${packageName}, error=${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const installLocation = lines[0]?.trim();
  if (!installLocation || !fs.existsSync(installLocation)) {
    return {
      ...base,
      success: false,
      failReason: 'APPX_PACKAGE_NOT_FOUND',
      detail: `packageName=${packageName}, installLocation=${installLocation || '(empty)'}`,
    };
  }

  // 3. ロゴパスの確認
  const logoPaths = [lines[1]?.trim(), lines[2]?.trim()].filter(Boolean);
  if (logoPaths.length === 0) {
    return {
      ...base,
      success: false,
      failReason: 'MANIFEST_NO_LOGO_PATH',
      detail: `installLocation=${installLocation}`,
    };
  }

  // 4. アイコンファイルの検索
  const iconPath = findIconFromManifestLogo(installLocation, logoPaths);
  if (!iconPath) {
    return {
      ...base,
      success: false,
      failReason: 'NO_ICON_FILE_FOUND',
      detail: `installLocation=${installLocation}, logoPaths=[${logoPaths.join(', ')}]`,
    };
  }

  // 5. アイコンファイルの読み込み
  const iconBuffer = fs.readFileSync(iconPath);
  if (iconBuffer.length === 0) {
    return { ...base, success: false, failReason: 'ICON_FILE_EMPTY', detail: iconPath };
  }

  return {
    ...base,
    success: true,
    iconFile: iconPath,
    iconSize: iconBuffer.length,
  };
}

// --- メイン ---

function main(): void {
  console.log('=== 登録アプリ アイコン取得テスト（マニフェストベース） ===\n');

  console.log('Get-StartApps から登録アプリを取得中...');
  const apps = getRegisteredApps();
  console.log(`対象アプリ数: ${apps.length}\n`);

  const results: DiagResult[] = [];
  for (const app of apps) {
    process.stdout.write(`  ${app.name} ... `);
    const result = diagnoseIconExtract(app.name, app.appPath);
    results.push(result);
    console.log(result.success ? 'OK' : `NG (${result.failReason})`);
  }

  // --- サマリー ---
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log('\n=== サマリー ===');
  console.log(`合計: ${results.length} / 成功: ${succeeded.length} / 失敗: ${failed.length}`);

  if (failed.length > 0) {
    const reasonCounts = new Map<string, DiagResult[]>();
    for (const r of failed) {
      const reason = r.failReason!;
      if (!reasonCounts.has(reason)) reasonCounts.set(reason, []);
      reasonCounts.get(reason)!.push(r);
    }

    console.log('\n--- 失敗理由別 ---');
    for (const [reason, items] of reasonCounts) {
      console.log(`\n[${reason}] (${items.length}件)`);
      for (const item of items) {
        console.log(`  - ${item.name}`);
        if (item.detail) console.log(`    ${item.detail}`);
      }
    }
  }

  // 結果をファイルに出力
  const outputPath = path.join(process.cwd(), 'uwp-icon-test-output.txt');
  const lines: string[] = [];
  lines.push('=== 登録アプリ アイコン取得テスト結果（マニフェストベース） ===');
  lines.push(`実行日時: ${new Date().toISOString()}`);
  lines.push(`合計: ${results.length} / 成功: ${succeeded.length} / 失敗: ${failed.length}`);
  lines.push('');
  for (const r of results) {
    if (r.success) {
      lines.push(`[OK] ${r.name} -> ${r.iconFile} (${r.iconSize} bytes)`);
    } else {
      lines.push(`[NG] ${r.name} | ${r.failReason} | ${r.detail ?? ''}`);
    }
  }
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log(`\n詳細結果: ${outputPath}`);
}

main();
