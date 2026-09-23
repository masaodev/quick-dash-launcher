import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as crypto from 'crypto';

import { shell } from 'electron';
import { iconLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { PathUtils } from '@common/utils/pathUtils';
import extractFileIcon from 'extract-file-icon';

import PathManager from '../../config/pathManager.js';
import { extractExtensionFromUri } from '../../utils/iconCacheKeys.js';

import { cacheAndConvertIcon, expandEnvironmentVariables } from './iconFileCache.js';
import { extractUwpIconByUriScheme } from './uwpIconExtractor.js';

const execFileAsync = promisify(execFile);

/** ショートカットファイル(.lnk)からアイコンを抽出してキャッシュに保存する */
async function extractShortcutIcon(lnkPath: string, iconsFolder: string): Promise<string | null> {
  try {
    // ファイルが存在するか確認
    if (!FileUtils.exists(lnkPath)) {
      iconLogger.error(`ショートカットファイルが見つかりません: ${lnkPath}`);
      return null;
    }

    // ショートカット専用のキャッシュファイル名を生成
    const shortcutName = path.basename(lnkPath, '.lnk');
    const lnkIconName = `${shortcutName}_lnk_icon.png`;
    const lnkIconPath = path.join(iconsFolder, lnkIconName);

    // ショートカットのアイコンがすでにキャッシュされているか確認
    const cachedIcon = FileUtils.readCachedBinaryAsBase64(lnkIconPath);
    if (cachedIcon) {
      iconLogger.info(`ショートカットのキャッシュアイコンを使用: ${lnkPath} -> ${lnkIconPath}`);
      return cachedIcon;
    }

    // 1. ショートカットの詳細を取得してカスタムアイコンパスをチェック
    iconLogger.info(`ショートカットの詳細情報を取得: ${lnkPath}`);

    const shortcutDetails = shell.readShortcutLink(lnkPath);

    // カスタムアイコンが設定されている場合、そのアイコンファイルを直接読み込み
    if (shortcutDetails.icon) {
      // 環境変数を展開
      const expandedIconPath = expandEnvironmentVariables(shortcutDetails.icon);

      if (FileUtils.exists(expandedIconPath)) {
        iconLogger.info(`カスタムアイコンファイルを発見: ${expandedIconPath}`);

        try {
          if (expandedIconPath.toLowerCase().endsWith('.ico')) {
            const result = cacheAndConvertIcon(extractFileIcon(expandedIconPath, 32), lnkIconPath);
            if (result) {
              iconLogger.info(
                `カスタムアイコンファイルからアイコンを抽出成功: ${expandedIconPath}`
              );
              return result;
            }
          }
        } catch (error) {
          iconLogger.error(
            { iconPath: expandedIconPath, error },
            'カスタムアイコンファイルの読み込みエラー'
          );
        }
      } else {
        iconLogger.warn(`カスタムアイコンファイルが見つからない: ${expandedIconPath}`);
      }
    }

    // 2. フォールバック：.lnkファイル自体からアイコンを抽出を試行
    iconLogger.info(`ショートカットファイル自体からアイコン抽出を開始: ${lnkPath}`);
    const shortcutIcon = cacheAndConvertIcon(extractFileIcon(lnkPath, 32), lnkIconPath);
    if (shortcutIcon) {
      iconLogger.info(`ショートカットファイルからアイコンを抽出成功: ${lnkPath}`);
      return shortcutIcon;
    }

    // 3. 最終フォールバック：ターゲットファイルからアイコンを抽出
    iconLogger.info(
      `ショートカットファイルからの抽出に失敗、ターゲットからの抽出を試行: ${lnkPath}`
    );

    if (shortcutDetails && shortcutDetails.target && FileUtils.exists(shortcutDetails.target)) {
      const targetIcon = await extractIcon(shortcutDetails.target, iconsFolder);
      if (targetIcon) {
        iconLogger.info(
          `ターゲットファイルからアイコンを抽出成功: ${lnkPath} -> ${shortcutDetails.target}`
        );
        return targetIcon;
      }
    }

    iconLogger.warn(`ショートカットとターゲットの両方からアイコン抽出に失敗: ${lnkPath}`);
    return null;
  } catch (error) {
    iconLogger.error({ lnkPath, error }, 'ショートカットアイコンの抽出に失敗しました');
    return null;
  }
}

/** 実行ファイルからアイコンを抽出してキャッシュに保存する */
export async function extractIcon(filePath: string, iconsFolder: string): Promise<string | null> {
  try {
    // カスタムURIスキーム（obsidian:// や ms-todo: 等）はファイルパスではないため専用経路に委譲する。
    // レイアウトアイテムのexecutablePathには起動用のURIが入り得るが、ここでファイルとして
    // 解決を試みるとwhere実行とlstatが毎回失敗し、読み込みのたびにログノイズが発生する。
    // フォールバック順はfetchIconForItem（customUriアイテム）と揃える
    if (PathUtils.isCustomUriScheme(filePath)) {
      const uriIcon = await extractCustomUriIcon(filePath, iconsFolder);
      return (
        uriIcon ?? (await extractFileIconByExtension(filePath, PathManager.getExtensionsFolder()))
      );
    }

    let resolvedPath = filePath;

    // ファイルが存在するか確認、存在しない場合はパスを解決
    if (!FileUtils.exists(filePath)) {
      // ファイルが見つからない場合、PATHから検索を試みる
      if (process.platform === 'win32' && !filePath.includes('\\') && !filePath.includes('/')) {
        iconLogger.info(`ファイル名のみが指定されています。PATHから検索を試みます: ${filePath}`);
        try {
          // shell経由のexecは"や&入りファイル名でコマンドインジェクションが起き得るため引数配列で渡す
          const { stdout } = await execFileAsync('where', [filePath], { encoding: 'utf8' });
          const paths = stdout.trim().split('\n');
          if (paths.length > 0 && paths[0]) {
            resolvedPath = paths[0].trim();
            iconLogger.info(`PATHからファイルを解決: ${filePath} -> ${resolvedPath}`);
          }
        } catch (error) {
          // PATHに存在しないのはデータ側の状態であり内部エラーではない
          iconLogger.warn({ filePath, error }, 'PATHからファイルを解決できません');
        }
      }

      // 解決後も見つからない場合はアイコンなしとして扱う
      // （アンインストール済みexe等、データ側の状態なのでwarnに留める）
      // シンボリックリンクの場合はlstatSyncを使用してリンク自体の存在をチェック
      try {
        fs.lstatSync(resolvedPath);
      } catch (error) {
        iconLogger.warn({ filePath, error }, 'ファイルが見つかりません');
        return null;
      }
    }

    // .lnkファイルの場合は専用関数を使用
    if (PathUtils.isShortcutFile(resolvedPath)) {
      iconLogger.info(`ショートカットファイルを検出、専用処理を実行: ${resolvedPath}`);
      return await extractShortcutIcon(resolvedPath, iconsFolder);
    }

    // シンボリックリンクの場合は実際のパスを解決
    let actualFilePath = resolvedPath;
    try {
      const stats = fs.lstatSync(resolvedPath);
      if (stats.isSymbolicLink()) {
        // readlinkSyncを使用してリンクターゲットを取得
        // (realpathSyncはWindowsAppsフォルダで権限エラーになる)
        actualFilePath = fs.readlinkSync(resolvedPath);
        iconLogger.info(`シンボリックリンクを解決: ${resolvedPath} -> ${actualFilePath}`);
      }
    } catch (error) {
      iconLogger.warn({ resolvedPath, error }, 'シンボリックリンクの解決に失敗、元のパスを使用');
    }

    // キャッシュ用ファイル名を生成（元のfilePathを使用してキャッシュキーを生成）
    const iconName = path.basename(filePath, path.extname(filePath)) + '_icon.png';
    const iconPath = path.join(iconsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    const cachedIcon = FileUtils.readCachedBinaryAsBase64(iconPath);
    if (cachedIcon) {
      return cachedIcon;
    }

    const result = cacheAndConvertIcon(extractFileIcon(actualFilePath, 32), iconPath);
    if (!result) {
      iconLogger.warn(`アイコンが抽出できませんでした: ${filePath}`);
    }
    return result;
  } catch (error) {
    iconLogger.error({ filePath, error }, 'アイコンの抽出に失敗しました');
    return null;
  }
}

/** カスタムURIスキームのハンドラーアプリからアイコンを抽出する */
export async function extractCustomUriIcon(
  uri: string,
  iconsFolder: string
): Promise<string | null> {
  try {
    const schemeMatch = uri.match(/^([^:]+):/);
    if (!schemeMatch) return null;

    const scheme = schemeMatch[1];
    const iconPath = path.join(iconsFolder, `uri_${scheme}_icon.png`);

    const cachedIcon = FileUtils.readCachedBinaryAsBase64(iconPath);
    if (cachedIcon) return cachedIcon;

    const handlerPath = await getUriSchemeHandler(scheme);
    if (handlerPath) {
      return cacheAndConvertIcon(extractFileIcon(handlerPath, 32), iconPath);
    }

    // レジストリから実行ファイルを解決できないスキームはUWPアプリの可能性がある
    // （UWPはPackagedCOM方式のため shell\open\command が存在しない）
    return await extractUwpIconByUriScheme(scheme, iconPath);
  } catch (error) {
    iconLogger.error({ uri, error }, 'カスタムURIアイコンの抽出に失敗しました');
    return null;
  }
}

/** ファイル拡張子に基づいてアイコンを抽出し、キャッシュに保存する */
export async function extractFileIconByExtension(
  filePath: string,
  extensionsFolder: string
): Promise<string | null> {
  try {
    let fileExtension: string;

    // URIスキーマの場合は特別処理
    if (filePath.includes('://')) {
      fileExtension = extractExtensionFromUri(filePath);
    } else {
      fileExtension = path.extname(filePath).toLowerCase();
    }

    if (!fileExtension) {
      iconLogger.info(`拡張子がありません: ${filePath}`);
      return null;
    }

    // 拡張子ベースのキャッシュファイル名を生成
    const extensionName = fileExtension.replace('.', '');
    const iconName = `ext_${extensionName}_icon.png`;
    const iconPath = path.join(extensionsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    const cachedIcon = FileUtils.readCachedBinaryAsBase64(iconPath);
    if (cachedIcon) {
      return cachedIcon;
    }

    const tempFilePath = createTempFileForExtension(extensionName);

    try {
      return cacheAndConvertIcon(extractFileIcon(tempFilePath, 32), iconPath);
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error) {
    iconLogger.error({ filePath, error }, '拡張子ベースのアイコン抽出に失敗しました');
    return null;
  }
}

async function getUriSchemeHandler(scheme: string): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    // スキーマからコロンとスラッシュを除去
    const cleanScheme = scheme.replace(/[:\\/]/g, '');

    // URIスキーム名として妥当な文字列のみ許可する（RFC 3986）。
    // インポート等で不正な文字列が混入した場合にレジストリ照会へ渡さない
    if (!/^[A-Za-z][A-Za-z0-9+.-]*$/.test(cleanScheme)) {
      iconLogger.warn({ scheme }, '不正なURIスキーム名のためレジストリ照会をスキップします');
      return null;
    }

    // レジストリからスキーマハンドラーを取得
    // （shell経由のexecは特殊文字でコマンドインジェクションが起き得るため引数配列で渡す）
    await execFileAsync('reg', ['query', `HKEY_CLASSES_ROOT\\${cleanScheme}`, '/ve'], {
      encoding: 'utf8',
    });

    // レジストリから実行ファイルパスを取得
    const { stdout: commandStdout } = await execFileAsync(
      'reg',
      ['query', `HKEY_CLASSES_ROOT\\${cleanScheme}\\shell\\open\\command`, '/ve'],
      { encoding: 'utf8' }
    );

    // 実行ファイルパスを抽出
    const matches = commandStdout.match(/"([^"]+\.exe)"|([^\s]+\.exe)/i);
    if (matches) {
      const exePath = matches[1] || matches[2];
      // 環境変数を展開
      const expandedPath = expandEnvironmentVariables(exePath);

      if (fs.existsSync(expandedPath)) {
        return expandedPath;
      }
    }

    return null;
  } catch {
    // レジストリエントリが存在しない場合はエラーになるが、これは正常
    return null;
  }
}

function createTempFileForExtension(extension: string): string {
  const tempDir = os.tmpdir();
  const tempFileName = `temp_icon_extract_${crypto.randomUUID()}.${extension}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  // 空のファイルを作成
  fs.writeFileSync(tempFilePath, '');

  return tempFilePath;
}
