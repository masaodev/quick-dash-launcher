import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { parseJsonDataFileLenient, serializeJsonDataFile } from '@common/utils/jsonParser';
import type { JsonItemIssue } from '@common/utils/jsonParser';
import {
  convertLegacyWindowConfigs,
  hasLegacyWindowConfig,
} from '@common/utils/itemWindowConversion';
import { isJsonLauncherItem } from '@common/types';
import type { AppItem, DataFileTab, JsonDataFile, JsonItem } from '@common/types';
import { isLauncherItem, isRecord, isWindowInfo } from '@common/types/guards';

import { SettingsService } from '../settingsService.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { PathManager } from '../../config/pathManager.js';
import { mainI18n } from '../mainI18n.js';
import { LONG_TOAST_DURATION_MS, showToastWindow } from '../overlayWindowService.js';
import { BackupService } from '../backupService.js';
import {
  detectExternalChange,
  rememberDataFileContent,
  writeDataFile,
} from '../dataFileTracker.js';
import { buildLoadReport, formatLoadReportToast } from '../loadReportService.js';
import type { LoadReport, LoadReportFile, LoadTrigger } from '../loadReportService.js';
import { notifyWorkspaceChanged } from '../../ipc/notifications.js';
import { buildMainItemIndex, setMainItemIndex } from '../workspace/workspaceRefResolver.js';
import {
  beginLoadProbeSession,
  endLoadProbeSession,
  prefetchFolderProbes,
  type LoadProbeMode,
} from '../../utils/folderPathProbe.js';

import {
  clearDataFileCorrupted,
  getCorruptedDataFiles,
  markDataFileCorrupted,
} from './corruptedDataFiles.js';
import { convertJsonItemToAppItems } from './jsonItemConverter.js';
import {
  buildGroupNameResolver,
  convertLegacySetItems,
  hasLegacySetItems,
} from './setMigration.js';

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
): Promise<{
  items: AppItem[];
  report: LoadReportFile;
  previousContent: string | null;
  /** 読み終えた時点のファイルの内容（書き戻したらその内容。読めなければ null） */
  content: string | null;
}> {
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
    report.error = mainI18n.t('dataErrors.fileUnreadable');
    return { items, report, previousContent: null, content: null };
  }

  // 前回読んだ／書いた内容と違えば外部（人・AI）で編集されている。
  // 壊れていても記憶する（毎回の読込で変更前スナップショットを作り続けないため。
  // 修復されれば内容が変わるので、そのとき改めて検知できる）
  const previousContent = detectExternalChange(fileName, content);
  report.externallyChanged = previousContent !== null;
  rememberDataFileContent(fileName, content);

  let parsed;
  try {
    parsed = parseJsonDataFileLenient(content, {
      reservedIds: knownIds,
      t: mainI18n.t,
    });
    clearDataFileCorrupted(fileName);
  } catch (error) {
    dataLogger.error({ error, filePath }, 'JSONファイルのパースに失敗しました');
    markDataFileCorrupted(fileName);
    report.status = 'corrupted';
    report.error = error instanceof Error ? error.message : String(error);
    return { items, report, previousContent, content };
  }

  report.issues = parsed.issues;
  logParseIssues(fileName, parsed.issues);

  // 採番・補正があれば 1 回だけ書き戻す（次回以降は同じ id で読める）
  let currentContent = content;
  if (parsed.modified) {
    const serialized = serializeJsonDataFile(parsed.data);
    report.rewritten = writeDataFile(filePath, serialized);
    if (report.rewritten) currentContent = serialized;
  }

  for (const item of parsed.data.items) {
    knownIds.add(item.id);
  }

  // 不正なアイテムは items 配列上には残る（書き戻しで消さないため）ので、検証済みの参照で除外する
  const validItemSet = new Set<JsonItem>(parsed.validItems);

  // ドット入りのフォルダ名を見分けるディスク確認を、変換の前にまとめて並行で済ませる
  await prefetchFolderProbes(
    parsed.validItems.filter(isJsonLauncherItem).map((jsonItem) => jsonItem.path)
  );

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
        reason: mainI18n.t('dataErrors.convertFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }

  return { items, report, previousContent, content: currentContent };
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
 * 設定フォルダからデータファイル（data.json等）を読み込み、AppItem配列とファイル別の結果を返す
 * フォルダ取込アイテムの展開、.lnkファイルの解析、重複チェック、ソートを全て実行する
 *
 * レポートの書き出し・トースト・スナップショットは行わない（reloadConfigFiles() の役目）。
 * 読むたびに外部変更の検知用の「前回の内容」を更新するので、結果の externallyChanged を
 * 捨てる呼び出し方をしない（捨てると以後の読み込みで外部変更として検知されない）。
 */
async function loadDataFilesWithReport(configFolder: string): Promise<DataFilesLoadResult> {
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
  // 旧形式の変換で読み直さないよう、読み込んだ内容を残しておく
  const loadedFiles: Array<{ filePath: string; content: string | null }> = [];

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
    loadedFiles.push({ filePath, content: result.content });
    if (result.previousContent !== null) {
      externallyChanged.push({ relativePath: fileName, content: result.previousContent });
    }
  }

  // 旧形式（グループ・ウィンドウ配置、単一アイテムの windowConfig）を変換したら、変換後の内容で読み直す（2 回目は変換するものが無い）
  if (await migrateLegacyItemsInDataFiles(loadedFiles, items)) {
    const again = await loadDataFilesWithReport(configFolder);
    // 1 回目で見つけた外部変更・採番などは 2 回目では消えている（前回の内容を覚え直した）ので、足して返す
    const changedFiles = new Set(externallyChanged.map((f) => f.relativePath));
    for (const report of again.fileReports) {
      const first = fileReports.find((r) => r.file === report.file);
      if (!first) continue;
      if (changedFiles.has(report.file)) report.externallyChanged = true;
      // issues は 2 回目のものを使う（1 回目は変換前の旧グループを「不正」と数えているので、足すと二重になる）
      report.rewritten = report.rewritten || first.rewritten;
    }
    return {
      ...again,
      externallyChanged: [
        ...externallyChanged,
        ...again.externallyChanged.filter((f) => !changedFiles.has(f.relativePath)),
      ],
    };
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

/**
 * データファイルの中の旧形式を新しい形に変換して書き戻す（読み込み時に 1 回だけ）
 *
 * - グループ・ウィンドウ配置 → セット。グループの名前は、読み込んだ全タブのアイテムから解決する（旧来の実行と同じ範囲）
 * - 単一アイテムの windowConfig → ウィンドウ切り替えの新しいキー（window・placement など）
 * - 廃止したウィンドウ操作（type: 'window'）→ パスの無い単一アイテム（id は変えない）
 *
 * 戻せない変換なので、書き換える前に全設定ファイルのスナップショットを 1 回だけ残す（セットへの変換が要れば
 * _pre-set-migration、windowConfig・ウィンドウ操作だけなら _pre-window-migration）。スナップショットを作れなければ変換しない
 *
 * @param loadedFiles - 読み込んだデータファイルのパスと、読み終えた時点の内容（読めなければ null）
 * @returns 書き換えたファイルがあれば true
 */
async function migrateLegacyItemsInDataFiles(
  loadedFiles: readonly { filePath: string; content: string | null }[],
  loadedItems: readonly AppItem[]
): Promise<boolean> {
  const targets: { filePath: string; raw: Record<string, unknown> & { items: unknown[] } }[] = [];
  let unreadable = false;
  for (const { filePath, content } of loadedFiles) {
    if (content === null) {
      // 有るのに読めない（ロック・権限）ファイルも、壊れたファイルと同じく変換を待たせる
      if (FileUtils.exists(filePath)) unreadable = true;
      continue;
    }
    try {
      const raw: unknown = JSON.parse(content);
      if (
        isRecord(raw) &&
        Array.isArray(raw.items) &&
        (hasLegacySetItems(raw.items) || hasLegacyWindowConfig(raw.items))
      ) {
        targets.push({ filePath, raw: raw as Record<string, unknown> & { items: unknown[] } });
      }
    } catch {
      // 壊れたファイルは通常の読み込みが報告する
      unreadable = true;
    }
  }
  if (targets.length === 0) return false;
  // 読めないファイルがあると、そのファイルのアイテムを指すグループの名前を解決できず、名前だけの行に変えてしまう。直るまで待つ
  // （windowConfig・ウィンドウ操作は読み込みの検証がその場で新しい形に直すので、待っている間も動きは変わらない）
  if (unreadable) {
    dataLogger.warn('読めないデータファイルがあるので、旧形式からの変換を保留します');
    return false;
  }

  const settingsService = await SettingsService.getInstance();
  const parallel = await settingsService.getLegacyParallelGroupLaunch();
  const resolveName = buildGroupNameResolver(loadedItems);
  const conversions = targets
    .map(({ filePath, raw }) => {
      const sets = convertLegacySetItems(
        raw.items,
        resolveName,
        parallel ? 'parallel' : 'sequential'
      );
      const windows = convertLegacyWindowConfigs(sets.items);
      return {
        filePath,
        raw,
        items: windows.items,
        setsChanged: sets.changed,
        changed: sets.changed || windows.changed,
      };
    })
    .filter(({ changed }) => changed);
  // 変換できるものが無い（壊れた旧アイテムだけ）なら、スナップショットも作らない（読み込みのたびに増えるのを防ぐ）
  if (conversions.length === 0) return false;

  const needsSetMigration = conversions.some(({ setsChanged }) => setsChanged);
  try {
    const backupService = await BackupService.getInstance();
    if (needsSetMigration) {
      await backupService.createPreSetMigrationSnapshot();
    } else {
      await backupService.createPreWindowMigrationSnapshot();
    }
  } catch (error) {
    dataLogger.error(
      { error },
      '旧形式からの変換前のスナップショットを作れなかったので、変換しません'
    );
    return false;
  }

  let rewritten = false;
  for (const { filePath, raw, items } of conversions) {
    const data = { ...raw, items } as unknown as JsonDataFile;
    if (writeDataFile(filePath, serializeJsonDataFile(data))) {
      rewritten = true;
      dataLogger.info({ filePath }, '旧形式のアイテムを新しい形に変換しました');
    }
  }
  return rewritten;
}

let reloadInFlight: Promise<AppItem[]> | null = null;

/** 読み込みのきっかけごとの、パスの種類の確かめ方（folderPathProbe） */
const LOAD_PROBE_MODES: Record<LoadTrigger, LoadProbeMode> = {
  explicit: 'recheck',
  full: 'rebuild',
  internal: 'normal',
};

/** メイン画面のアイテムのうち、パスを持つ起動アイテムのパス */
function collectLauncherPaths(items: AppItem[]): string[] {
  return items.filter(isLauncherItem).map((item) => item.path);
}

/** ワークスペース（アーカイブを含む）のアイテムのパス（ショートカットはリンク先も） */
/** タブの設定（読めなければ空。タブの名前は参照アイテムのツールチップに出すだけなので、止めない） */
async function readDataFileTabs(): Promise<DataFileTab[]> {
  try {
    const settingsService = await SettingsService.getInstance();
    return await settingsService.get('dataFileTabs');
  } catch {
    return [];
  }
}

async function collectWorkspaceItemPaths(service: WorkspaceService): Promise<string[]> {
  const items = [...(await service.loadItems()), ...(await service.loadArchivedItems())];
  return items.flatMap((item) => {
    const { path: itemPath, originalPath } = item as { path?: unknown; originalPath?: unknown };
    return [itemPath, originalPath].filter((p): p is string => typeof p === 'string');
  });
}

let lastLoadReport: LoadReport | null = null;

/** 直近の reloadConfigFiles() の読み込みレポート（CLI の reload が結果を返すのに使う） */
export function getLastLoadReport(): LoadReport | null {
  return lastLoadReport;
}

/**
 * 設定ファイル群（データファイル + ワークスペース）をディスクから読み直す（起動時・メイン画面の F5・完全リフレッシュ）
 *
 * データファイルとワークスペースの読み込み結果を 1 つのレポートにまとめ、
 * 外部変更があれば変更前スナップショットを 1 つ作る。ワークスペースの内容が変わっていれば
 * ワークスペース画面にも再取得を通知する。
 *
 * @param trigger 読み込みのきっかけ。internal（変更通知・画面内の一覧取得）は先行の再読込の結果を共有する
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
  // 起動時・F5・完全リフレッシュはディスクの今の状態で判定し直す
  // （アプリ内の変更に伴う再読込では覚えた結果を使う）
  await beginLoadProbeSession(LOAD_PROBE_MODES[trigger]);
  let data: Awaited<ReturnType<typeof loadDataFilesWithReport>>;
  try {
    data = await loadDataFilesWithReport(configFolder);
  } catch (error) {
    endLoadProbeSession(null);
    throw error;
  }

  // ワークスペースの参照アイテムが指す先の表を作り直す（ワークスペースを読み直す前に。参照の名前の控えに使う）
  setMainItemIndex(buildMainItemIndex(data.items, await readDataFileTabs()));

  // ワークスペースも同じタイミングで読み直す（読めなくてもデータファイルの表示は止めない）
  let workspaceRefsChanged = false;
  let workspaceReports: LoadReportFile[] = [];
  let workspaceExternal: Array<{ relativePath: string; content: string }> = [];
  let workspaceChanged = false;
  let workspaceCorrupted = false;
  let workspacePaths: string[] | null = null;
  try {
    const workspaceService = await WorkspaceService.getInstance();
    workspaceChanged = (await workspaceService.reload()).changed;
    const consumed = workspaceService.consumeLoadReports();
    workspaceReports = consumed.files;
    workspaceExternal = consumed.externallyChanged;
    workspaceCorrupted = workspaceService.isCorrupted();
    workspacePaths = await collectWorkspaceItemPaths(workspaceService);
    // 参照アイテムがあれば、メインウィンドウのアイテムの変更を画面に反映させる（最後に見た表示名も控え直す）
    workspaceRefsChanged = await workspaceService.syncRefs();
  } catch (error) {
    dataLogger.error({ error }, 'ワークスペースファイルの再読込に失敗しました');
  }

  // すべて読めたときだけ、どこからも消えたパスの拡張子なしファイルのメモを捨てる
  const allFilesOk =
    workspacePaths !== null &&
    !workspaceCorrupted &&
    getCorruptedDataFiles().length === 0 &&
    [...data.fileReports, ...workspaceReports].every((f) => f.status === 'ok');
  endLoadProbeSession(
    allFilesOk ? [...collectLauncherPaths(data.items), ...(workspacePaths ?? [])] : null
  );

  // 外部変更があれば、変更前の内容を戻し先としてスナップショットに残す
  const preChangeSnapshot = await snapshotExternalChanges([
    ...data.externallyChanged,
    ...workspaceExternal,
  ]);

  // CLI の reload・check が返せるよう、直近の結果を覚えておく
  const report = buildLoadReport([...data.fileReports, ...workspaceReports], preChangeSnapshot);
  lastLoadReport = report;
  const flattenedGroupIds = workspaceReports.flatMap((f) =>
    f.issues.filter((i) => i.code === 'groupFlattened').map((i) => i.id)
  );
  if (flattenedGroupIds.length > 0) {
    dataLogger.warn(
      { groupIds: flattenedGroupIds },
      'ワークスペースのグループを最上位へ移しました（深すぎる・循環）'
    );
  }

  // 破損ファイルがあった場合は無通知でアイテムが消えたように見えないよう警告する
  const corruptedFiles = [
    ...getCorruptedDataFiles(),
    ...workspaceReports.filter((f) => f.status !== 'ok').map((f) => f.file),
  ];
  if (corruptedFiles.length > 0 || workspaceCorrupted) {
    showToastWindow({
      message: mainI18n.t('dataErrors.configLoadFailed', { files: corruptedFiles.join(', ') }),
      type: 'error',
      duration: LONG_TOAST_DURATION_MS,
    }).catch((error) => {
      dataLogger.error({ error }, '破損警告トーストの表示に失敗しました');
    });
  }

  // スキップ・採番・グループの最上位への移動があったときだけ知らせる（毎回の読込では出さない）
  const issueToast = formatLoadReportToast(report);
  if (issueToast) {
    showToastWindow({
      message: issueToast,
      type: 'warning',
      duration: LONG_TOAST_DURATION_MS,
    }).catch((error) => {
      dataLogger.error({ error }, '読込結果トーストの表示に失敗しました');
    });
  }

  if (workspaceChanged || workspaceRefsChanged) {
    notifyWorkspaceChanged();
  }

  return data.items;
}
