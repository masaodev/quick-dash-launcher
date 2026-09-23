import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { parseJsonDataFileLenient, serializeJsonDataFile } from '@common/utils/jsonParser';
import type { JsonItemIssue } from '@common/utils/jsonParser';
import type { AppItem, JsonItem } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

import { SettingsService } from '../settingsService.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { PathManager } from '../../config/pathManager.js';
import { showToastWindow } from '../overlayWindowService.js';
import { BackupService } from '../backupService.js';
import {
  detectExternalChange,
  rememberDataFileContent,
  writeDataFile,
} from '../dataFileTracker.js';
import {
  buildLoadReport,
  hasReportableIssues,
  formatLoadReportToast,
  writeLoadReport,
} from '../loadReportService.js';
import type { LoadReportFile, LoadTrigger } from '../loadReportService.js';
import { notifyWorkspaceChanged } from '../../ipc/notifications.js';

import {
  clearDataFileCorrupted,
  getCorruptedDataFiles,
  markDataFileCorrupted,
} from './corruptedDataFiles.js';
import { convertJsonItemToAppItems } from './jsonItemConverter.js';

/**
 * JSONファイルからAppItem配列を読み込む
 *
 * @param filePath - JSONファイルのパス
 * @param fileName - ファイル名（sourceFile用）
 * @param seenPaths - 重複チェック用のSet
 * @param tabIndex - タブインデックス（ログ用）
 * @returns AppItem配列
 */
async function loadJsonDataFile(
  filePath: string,
  fileName: string,
  seenPaths: Set<string>,
  tabIndex: number,
  knownIds: Set<string>
): Promise<{ items: AppItem[]; report: LoadReportFile; previousContent: string | null }> {
  const items: AppItem[] = [];
  const report: LoadReportFile = {
    file: fileName,
    status: 'ok',
    accepted: 0,
    issues: [],
    externallyChanged: false,
    rewritten: false,
  };
  const content = FileUtils.safeReadTextFile(filePath);

  if (content === null) {
    dataLogger.warn({ filePath }, 'JSONファイルが読み込めませんでした');
    report.status = 'unreadable';
    report.error = 'ファイルを読み込めませんでした';
    return { items, report, previousContent: null };
  }

  // 前回読んだ／書いた内容と違えば外部（人・AI）で編集されている。
  // 壊れていても記憶する（毎回の読込で変更前スナップショットを作り続けないため。
  // 修復されれば内容が変わるので、そのとき改めて検知できる）
  const previousContent = detectExternalChange(fileName, content);
  report.externallyChanged = previousContent !== null;
  rememberDataFileContent(fileName, content);

  let parsed;
  try {
    parsed = parseJsonDataFileLenient(content, { reservedIds: knownIds });
    clearDataFileCorrupted(fileName);
  } catch (error) {
    dataLogger.error({ error, filePath }, 'JSONファイルのパースに失敗しました');
    markDataFileCorrupted(fileName);
    report.status = 'corrupted';
    report.error = error instanceof Error ? error.message : String(error);
    return { items, report, previousContent };
  }

  report.issues = parsed.issues;
  logParseIssues(fileName, parsed.issues);

  // 採番・補正があれば 1 回だけ書き戻す（次回以降は同じ id で読める）
  if (parsed.modified) {
    report.rewritten = writeDataFile(filePath, serializeJsonDataFile(parsed.data));
  }

  for (const item of parsed.data.items) {
    knownIds.add(item.id);
  }

  // 不正なアイテムは items 配列上には残る（書き戻しで消さないため）ので、検証済みの参照で除外する
  const validItemSet = new Set<JsonItem>(parsed.validItems);

  for (let i = 0; i < parsed.data.items.length; i++) {
    const jsonItem = parsed.data.items[i];
    if (!validItemSet.has(jsonItem)) continue;

    try {
      const appItems = await convertJsonItemToAppItems(jsonItem, fileName, i, seenPaths, tabIndex);
      items.push(...appItems);
      report.accepted++;
    } catch (error) {
      dataLogger.error(
        { error, fileName, itemIndex: i, itemId: jsonItem.id },
        'JSONアイテムの変換に失敗しました'
      );
      report.issues.push({
        index: i,
        kind: 'invalid',
        id: jsonItem.id,
        reason: `変換に失敗: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return { items, report, previousContent };
}

/**
 * 外部変更を検知したファイルの「変更前の内容」をスナップショットに残す
 *
 * @returns 作成したスナップショットのフォルダ名。対象なし・無効・失敗時は null
 */
export async function snapshotExternalChanges(
  externallyChanged: Array<{ relativePath: string; content: string }>
): Promise<string | null> {
  if (externallyChanged.length === 0) return null;

  dataLogger.info(
    { files: externallyChanged.map((f) => f.relativePath) },
    'QDL 外で変更されたデータファイルを検知しました'
  );
  try {
    const backupService = await BackupService.getInstance();
    return await backupService.createPreExternalChangeSnapshot(externallyChanged);
  } catch (error) {
    dataLogger.error({ error }, '変更前スナップショットの作成に失敗しました');
    return null;
  }
}

/**
 * 寛容パースで見つかった問題をログに出す
 */
export function logParseIssues(fileName: string, issues: JsonItemIssue[]): void {
  for (const issue of issues) {
    const context = { fileName, index: issue.index, id: issue.id, reason: issue.reason };
    if (issue.kind === 'invalid') {
      dataLogger.warn(context, '不正なアイテムをスキップしました');
    } else {
      dataLogger.info(context, 'アイテムを補正しました');
    }
  }
}

/** データファイル群の読み込み結果（レポート・スナップショットは呼び出し側が扱う） */
export interface DataFilesLoadResult {
  items: AppItem[];
  fileReports: LoadReportFile[];
  externallyChanged: Array<{ relativePath: string; content: string }>;
}

/**
 * 設定フォルダからデータファイル（data.json等）を読み込み、AppItem配列に変換する
 * フォルダ取込アイテムの展開、.lnkファイルの解析、重複チェック、ソートを全て実行する
 *
 * 純粋な読み込みで、レポートの書き出し・トースト・スナップショットは行わない
 * （それらは reloadConfigFiles() の役目。グループ起動などの内部利用ではレポートを上書きしない）
 *
 * @param configFolder - 設定フォルダのパス
 * @returns AppItem配列（LauncherItemとGroupItemの両方を含む）
 */
export async function loadDataFiles(configFolder: string): Promise<AppItem[]> {
  const { items } = await loadDataFilesWithReport(configFolder);
  return items;
}

/**
 * データファイル群を読み込み、ファイル別の結果も返す
 */
export async function loadDataFilesWithReport(configFolder: string): Promise<DataFilesLoadResult> {
  const items: AppItem[] = [];

  // タブ設定を読み込んで、データファイル → tabIndex のマップを作成
  let fileToTabMap: Map<string, number>;
  try {
    const settingsService = await SettingsService.getInstance();
    const dataFileTabs = await settingsService.get('dataFileTabs');

    // データファイル → tabIndex のマップを作成
    fileToTabMap = new Map<string, number>();
    dataFileTabs.forEach((tab, index) => {
      tab.files.forEach((fileName) => {
        fileToTabMap.set(fileName, index);
      });
    });

    dataLogger.info(
      { tabCount: dataFileTabs.length, mappedFiles: Array.from(fileToTabMap.keys()) },
      'タブ設定を読み込みました'
    );
  } catch (error) {
    dataLogger.warn({ error }, 'タブ設定の読み込みに失敗。全ファイルを独立したタブとして扱います');
    fileToTabMap = new Map<string, number>();
  }

  // タブ別の重複チェック用Set
  const seenPathsByTab = new Map<number, Set<string>>();

  const autoDetectedFiles = PathManager.getDataFiles();

  // dataFileTabsで明示的に指定されたファイルを収集し、重複を排除
  const allFiles = Array.from(new Set([...fileToTabMap.keys(), ...autoDetectedFiles]));

  // ファイル横断で id の重複を検知するための集合
  const knownIds = new Set<string>();
  const fileReports: LoadReportFile[] = [];
  const externallyChanged: Array<{ relativePath: string; content: string }> = [];

  for (const fileName of allFiles) {
    const tabIndex = fileToTabMap.get(fileName) ?? -1;

    if (!seenPathsByTab.has(tabIndex)) {
      seenPathsByTab.set(tabIndex, new Set<string>());
    }
    const seenPaths = seenPathsByTab.get(tabIndex)!;

    const filePath = path.join(configFolder, fileName);

    // JSON形式のデータファイルを読み込み
    const result = await loadJsonDataFile(filePath, fileName, seenPaths, tabIndex, knownIds);
    items.push(...result.items);
    fileReports.push(result.report);
    if (result.previousContent !== null) {
      externallyChanged.push({ relativePath: fileName, content: result.previousContent });
    }
  }

  // displayNameでソート
  items.sort((a, b) => {
    const aName = isWindowInfo(a) ? a.title : a.displayName;
    const bName = isWindowInfo(b) ? b.title : b.displayName;
    return aName.localeCompare(bName, 'ja');
  });

  // 統計情報をログ出力
  const itemCountByTab = new Map<number, number>();
  items.forEach((item) => {
    const sourceFile = isWindowInfo(item) ? undefined : item.sourceFile;
    const tabIndex = fileToTabMap.get(sourceFile || '') ?? -1;
    itemCountByTab.set(tabIndex, (itemCountByTab.get(tabIndex) || 0) + 1);
  });
  dataLogger.info(
    { totalItems: items.length, itemCountByTab: Object.fromEntries(itemCountByTab) },
    'データ読み込み完了（タブ別統計）'
  );

  return { items, fileReports, externallyChanged };
}

let reloadInFlight: Promise<AppItem[]> | null = null;

/**
 * 設定ファイル群（データファイル + ワークスペース）をディスクから読み直す（起動時・メイン画面の F5）
 *
 * データファイルとワークスペースの読み込み結果を 1 つの last-load-report.json にまとめ、
 * 外部変更があれば変更前スナップショットを 1 つ作る。ワークスペースの内容が変わっていれば
 * ワークスペース画面にも再取得を通知する。
 *
 * @param trigger internal（変更通知・画面内の一覧取得）なら、報告することがあるときだけレポートを書く
 * @returns メイン画面に表示するアイテム
 */
export function reloadConfigFiles(
  configFolder: string,
  trigger: LoadTrigger = 'explicit'
): Promise<AppItem[]> {
  // 変更通知の再読込は先行の結果を共有する（連打・重複を 1 回に）。
  // 起動時・F5 は「今のファイルを読んでレポートを更新する」約束なので、先行があれば完了後に改めて読む
  if (reloadInFlight && trigger === 'internal') return reloadInFlight;
  const previous = reloadInFlight?.catch(() => undefined) ?? Promise.resolve();
  const tracked: Promise<AppItem[]> = previous
    .then(() => reloadConfigFilesInternal(configFolder, trigger))
    .finally(() => {
      if (reloadInFlight === tracked) reloadInFlight = null;
    });
  reloadInFlight = tracked;
  return tracked;
}

async function reloadConfigFilesInternal(
  configFolder: string,
  trigger: LoadTrigger
): Promise<AppItem[]> {
  const data = await loadDataFilesWithReport(configFolder);

  // ワークスペースも同じタイミングで読み直す（読めなくてもデータファイルの表示は止めない）
  let workspaceReports: LoadReportFile[] = [];
  let workspaceExternal: Array<{ relativePath: string; content: string }> = [];
  let workspaceChanged = false;
  let workspaceCorrupted = false;
  try {
    const workspaceService = await WorkspaceService.getInstance();
    workspaceChanged = (await workspaceService.reload()).changed;
    const consumed = workspaceService.consumeLoadReports();
    workspaceReports = consumed.files;
    workspaceExternal = consumed.externallyChanged;
    workspaceCorrupted = workspaceService.isCorrupted();
  } catch (error) {
    dataLogger.error({ error }, 'ワークスペースファイルの再読込に失敗しました');
  }

  // 外部変更があれば、変更前の内容を戻し先としてスナップショットに残す
  const preChangeSnapshot = await snapshotExternalChanges([
    ...data.externallyChanged,
    ...workspaceExternal,
  ]);

  // 直接編集した人・AI が結果を確認できるようレポートを残す
  // （内部の再読込では、クリーンな結果で起動時・F5 の記録を潰さない）
  const fileReports = [...data.fileReports, ...workspaceReports];
  const report = buildLoadReport(fileReports, preChangeSnapshot);
  if (trigger === 'explicit' || hasReportableIssues(fileReports)) {
    writeLoadReport(report);
  }

  // 破損ファイルがあった場合は無通知でアイテムが消えたように見えないよう警告する
  const corruptedFiles = [
    ...getCorruptedDataFiles(),
    ...workspaceReports.filter((f) => f.status !== 'ok').map((f) => f.file),
  ];
  if (corruptedFiles.length > 0 || workspaceCorrupted) {
    showToastWindow({
      message: `設定ファイルの読み込みに失敗しました（破損の可能性）: ${corruptedFiles.join(', ')}`,
      type: 'error',
      duration: 6000,
    }).catch((error) => {
      dataLogger.error({ error }, '破損警告トーストの表示に失敗しました');
    });
  }

  // スキップ・採番があったときだけ知らせる（毎回の読込では出さない）
  const issueToast = formatLoadReportToast(report);
  if (issueToast) {
    showToastWindow({ message: issueToast, type: 'warning', duration: 6000 }).catch((error) => {
      dataLogger.error({ error }, '読込結果トーストの表示に失敗しました');
    });
  }

  if (workspaceChanged) {
    notifyWorkspaceChanged();
  }

  return data.items;
}
