import * as fs from 'fs';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { stripIconFromLayoutEntries } from '@common/utils/dataConverters';
import { generateUniqueId } from '@common/utils/jsonParser';
import {
  createEmptyWorkspaceArchiveFile,
  createEmptyWorkspaceFile,
  createWorkspaceParseContext,
  orderWorkspaceItemKeys,
  parseWorkspaceArchiveFileLenient,
  parseWorkspaceFileLenient,
  serializeWorkspaceArchiveFile,
  serializeWorkspaceFile,
} from '@common/utils/workspaceParser';
import type { InvalidWorkspaceEntries } from '@common/utils/workspaceParser';
import type {
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
  JsonArchivedWorkspaceItem,
  JsonWorkspaceItem,
  LauncherItemType,
  Workspace,
  WorkspaceGroup,
  WorkspaceItem,
} from '@common/types';
import { JSON_WORKSPACE_VERSION } from '@common/types';

import {
  detectExternalChange,
  rememberDataFileContent,
  writeDataFile,
} from '../dataFileTracker.js';
import type { LoadReportFile } from '../loadReportService.js';

import { isLegacyWorkspaceFile, migrateWorkspaceV1 } from './workspaceMigration.js';
import { coerceWorkspaceUiState, type WorkspaceUiStateStore } from './WorkspaceUiStateStore.js';

/**
 * workspace.json と workspace-archive.json のストア
 *
 * 2 ファイルを 1 つの論理データセットとして扱う（id の名前空間と参照が両ファイルにまたがるため）。
 *
 * 読み込みはキャッシュ: ディスクを読むのは reload()（起動時・メイン画面の F5）のときだけ。
 * 書き込みは楽観ロック: 前回読んだ/書いた内容と現在のファイルが違えば（QDL の外で編集されていれば）
 * 書かずに WorkspaceExternalChangeConflictError を投げる。
 * 壊れたファイル（JSON 構文エラー等）を読んだときは corrupted になり、書き込みをすべて拒否する
 * （空データで上書きして復旧不能にしないため）。
 *
 * データファイルと同じ dataFileTracker / writeDataFile を通すので、外部変更検知・変更前スナップショット・
 * last-load-report.json への記載が同じ仕組みで効く。
 */

/** 設定フォルダからの相対パス（トラッカーのキー・レポートのファイル名） */
export const WORKSPACE_FILE_KEY = 'workspace.json';
export const WORKSPACE_ARCHIVE_FILE_KEY = 'workspace-archive.json';

export class WorkspaceExternalChangeConflictError extends Error {
  constructor(fileKey: string) {
    super(
      `${fileKey} が QDL の外で変更されています。メイン画面で F5 を押して再読込してから操作してください`
    );
    this.name = 'WorkspaceExternalChangeConflictError';
  }
}

/** ファイルへの書き込み自体に失敗した（ディスク・権限など）。データはメモリ上に残っている */
export class WorkspaceWriteError extends Error {
  constructor(fileKey: string) {
    super(`${fileKey} の書き込みに失敗しました。ディスクの空き容量や権限を確認してください`);
    this.name = 'WorkspaceWriteError';
  }
}

/** 再読込（起動時・F5）の途中。読み終わる前に書くと再読込の結果で上書きされて消えるため拒否する */
export class WorkspaceReloadInProgressError extends Error {
  constructor() {
    super('ワークスペースを再読込中です。もう一度お試しください');
    this.name = 'WorkspaceReloadInProgressError';
  }
}

export class WorkspaceCorruptedError extends Error {
  constructor(fileKey: string) {
    super(
      `${fileKey} が壊れているため書き込めません。ファイルを修復してから F5 で再読込してください`
    );
    this.name = 'WorkspaceCorruptedError';
  }
}

export interface WorkspaceMainData {
  workspaces: Workspace[];
  groups: WorkspaceGroup[];
  items: WorkspaceItem[];
}

export interface WorkspaceArchiveData {
  groups: ArchivedWorkspaceGroup[];
  items: ArchivedWorkspaceItem[];
}

export interface WorkspaceFileStorePaths {
  main: string;
  archive: string;
  /** 旧形式の workspace-detached.json（移行で読んで削除する） */
  legacyDetached: string;
}

export interface WorkspaceFileStoreHooks {
  /** 旧形式からの移行前に全設定ファイルのスナップショットを作る（失敗したら移行しない） */
  createPreMigrationSnapshot: () => Promise<void>;
  /** 補完・移行に使う現在時刻 */
  now?: () => number;
}

export interface WorkspaceReloadResult {
  /** 前回の読み込み結果からデータが変わったか（画面の再取得が必要か） */
  changed: boolean;
}

/** 移行の要約（レポートの normalized として 1 行で載せる） */
const MIGRATION_REASON =
  '旧形式（version なし）から 2.0 に変換しました: id を 8 文字英数字に採番し直し、' +
  'ウィンドウ操作の座標名とクリップボード/レイアウトのフィールド名をデータファイルと揃え、' +
  'グループの折りたたみと切り離しウィンドウの状態を workspace-ui-state.json に移しました';

// ============================================================
// 実行時 ⇄ ファイル形式の変換
// ============================================================

/**
 * type: "item" の起動種別を path（ショートカットならリンク先）から判定する
 * データファイルの読み込み（directoryScanner.processShortcut）と同じ規則
 */
export function resolveLauncherType(item: {
  path: string;
  originalPath?: string;
}): LauncherItemType {
  const target = item.originalPath ?? item.path;
  if (item.originalPath && FileUtils.exists(target) && FileUtils.isDirectory(target)) {
    return 'folder';
  }
  const detected = detectItemTypeSync(target);
  return detected === 'clipboard' ? 'file' : detected;
}

function toRuntimeItem<T extends JsonWorkspaceItem>(
  item: T
): T & { launcherType?: LauncherItemType } {
  if (item.type === 'item') {
    return { ...item, launcherType: resolveLauncherType(item) };
  }
  return { ...item };
}

/** 実行時にだけ持つフィールドを落としてファイル形式に戻す */
function toJsonItem<T extends JsonWorkspaceItem>(
  item: T & { icon?: string; launcherType?: string }
): T {
  const { icon: _icon, launcherType: _launcherType, ...rest } = item;
  const json = rest as unknown as T;
  if (json.type === 'layout') {
    return orderWorkspaceItemKeys({ ...json, entries: stripIconFromLayoutEntries(json.entries) });
  }
  return orderWorkspaceItemKeys(json);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ============================================================
// ストア
// ============================================================

export class WorkspaceFileStore {
  private main: WorkspaceMainData = { workspaces: [], groups: [], items: [] };
  private archive: WorkspaceArchiveData = { groups: [], items: [] };
  private invalidMain: InvalidWorkspaceEntries = { workspaces: [], groups: [], items: [] };
  private invalidArchive: Pick<InvalidWorkspaceEntries, 'groups' | 'items'> = {
    groups: [],
    items: [],
  };
  private corruptedFiles = new Set<string>();
  private pendingReports: LoadReportFile[] = [];
  private pendingExternalChanges: Array<{ relativePath: string; content: string }> = [];
  private loaded = false;
  private reloadPromise: Promise<WorkspaceReloadResult> | null = null;

  constructor(
    private readonly paths: WorkspaceFileStorePaths,
    private readonly uiState: WorkspaceUiStateStore,
    private readonly hooks: WorkspaceFileStoreHooks
  ) {}

  private now(): number {
    return this.hooks.now?.() ?? Date.now();
  }

  // --- 読み込み ---

  /**
   * ディスクから読み直す（起動時・F5）
   *
   * 旧形式なら 2.0 に移行し、採番・補正があれば書き戻す。読み込み結果は consumeLoadReports() で取り出す。
   */
  reload(): Promise<WorkspaceReloadResult> {
    // 同時に呼ばれたら 1 回に集約する（F5 連打・変更通知との重複で途中経過を壊さない）
    if (this.reloadPromise) return this.reloadPromise;
    this.reloadPromise = this.reloadInternal().finally(() => {
      this.reloadPromise = null;
    });
    return this.reloadPromise;
  }

  private async reloadInternal(): Promise<WorkspaceReloadResult> {
    const before = this.loaded ? JSON.stringify([this.main, this.archive]) : null;
    this.pendingReports = [];
    this.pendingExternalChanges = [];

    const mainReport = this.newReport(WORKSPACE_FILE_KEY);
    const archiveReport = this.newReport(WORKSPACE_ARCHIVE_FILE_KEY);

    // 無ければ空ファイルを作る（既定ワークスペース 1 件）。
    // 「存在するのに読めない」（ロック・権限）は空で上書きせず unreadable にする
    let mainContent = this.readOrCreate(this.paths.main, mainReport, () =>
      serializeWorkspaceFile(createEmptyWorkspaceFile(generateUniqueId(new Set()), this.now()))
    );
    let archiveContent = this.readOrCreate(this.paths.archive, archiveReport, () =>
      serializeWorkspaceArchiveFile(createEmptyWorkspaceArchiveFile())
    );

    if (mainContent !== null) {
      this.trackExternalChange(WORKSPACE_FILE_KEY, mainContent, mainReport);
    }
    if (archiveContent !== null) {
      this.trackExternalChange(WORKSPACE_ARCHIVE_FILE_KEY, archiveContent, archiveReport);
    }

    // JSON として読めるかを先に確認する（旧形式判定のため）
    let mainRaw: unknown;
    let archiveRaw: unknown;
    if (mainContent !== null) {
      try {
        mainRaw = JSON.parse(mainContent);
      } catch (error) {
        this.markCorrupted(mainReport, error);
      }
    }
    if (archiveContent !== null) {
      try {
        archiveRaw = JSON.parse(archiveContent);
      } catch (error) {
        this.markCorrupted(archiveReport, error);
      }
    }

    // 旧形式の main を archive が読めないまま 2.0 としてパースすると、version が付いて移行が二度と走らない。
    // archive を直すまで main も保留する
    if (
      mainReport.status === 'ok' &&
      archiveReport.status !== 'ok' &&
      isLegacyWorkspaceFile(mainRaw)
    ) {
      mainReport.status = 'unreadable';
      mainReport.error = `旧形式からの変換には ${WORKSPACE_ARCHIVE_FILE_KEY} も読める必要があります。先に直してください`;
      this.corruptedFiles.add(WORKSPACE_FILE_KEY);
    }

    // 旧形式 → 2.0
    if (
      mainReport.status === 'ok' &&
      archiveReport.status === 'ok' &&
      (isLegacyWorkspaceFile(mainRaw) || isLegacyWorkspaceFile(archiveRaw))
    ) {
      try {
        const migrated = await this.migrateLegacy(mainRaw, archiveRaw);
        mainContent = migrated.mainContent;
        archiveContent = migrated.archiveContent;
        for (const report of [mainReport, archiveReport]) {
          report.rewritten = true;
          report.issues.push({ index: -1, kind: 'normalized', reason: MIGRATION_REASON });
        }
      } catch (error) {
        logger.error({ error }, 'ワークスペースファイルの旧形式からの変換に失敗しました');
        const message = error instanceof Error ? error.message : String(error);
        for (const report of [mainReport, archiveReport]) {
          report.status = 'corrupted';
          report.error = `旧形式から 2.0 への変換に失敗しました: ${message}`;
          this.corruptedFiles.add(report.file);
        }
      }
    } else if (mainReport.status === 'ok') {
      this.importLegacyDetachedIfPresent();
    }

    // 寛容パース
    const ctx = createWorkspaceParseContext(this.now());
    if (mainReport.status === 'ok' && mainContent !== null) {
      try {
        const parsed = parseWorkspaceFileLenient(mainContent, ctx);
        mainReport.issues.push(...parsed.issues);
        mainReport.accepted = parsed.data.items.length;
        this.main = {
          workspaces: parsed.data.workspaces,
          groups: parsed.data.groups,
          items: parsed.data.items.map(toRuntimeItem) as WorkspaceItem[],
        };
        this.invalidMain = parsed.invalid;
        this.corruptedFiles.delete(WORKSPACE_FILE_KEY);
        if (parsed.modified) {
          mainReport.rewritten = writeDataFile(
            this.paths.main,
            serializeWorkspaceFile(parsed.data, parsed.invalid)
          );
        }
      } catch (error) {
        this.markCorrupted(mainReport, error);
      }
    }
    if (mainReport.status !== 'ok') {
      this.main = { workspaces: [], groups: [], items: [] };
      this.invalidMain = { workspaces: [], groups: [], items: [] };
    }

    if (archiveReport.status === 'ok' && mainReport.status === 'ok' && archiveContent !== null) {
      try {
        const parsed = parseWorkspaceArchiveFileLenient(archiveContent, ctx);
        archiveReport.issues.push(...parsed.issues);
        archiveReport.accepted = parsed.data.items.length;
        this.archive = {
          groups: parsed.data.groups,
          items: parsed.data.items.map(toRuntimeItem) as ArchivedWorkspaceItem[],
        };
        this.invalidArchive = parsed.invalid;
        this.corruptedFiles.delete(WORKSPACE_ARCHIVE_FILE_KEY);
        if (parsed.modified) {
          archiveReport.rewritten = writeDataFile(
            this.paths.archive,
            serializeWorkspaceArchiveFile(parsed.data, parsed.invalid)
          );
        }
      } catch (error) {
        this.markCorrupted(archiveReport, error);
      }
    }
    if (archiveReport.status !== 'ok' || mainReport.status !== 'ok') {
      this.archive = { groups: [], items: [] };
      this.invalidArchive = { groups: [], items: [] };
      if (mainReport.status !== 'ok' && archiveReport.status === 'ok') {
        // main が読めないと archive の参照を解決できないので、archive も読み込まない
        archiveReport.status = 'unreadable';
        archiveReport.error = `${WORKSPACE_FILE_KEY} が読めないため読み込みを保留しました`;
      }
      this.corruptedFiles.add(WORKSPACE_ARCHIVE_FILE_KEY);
    }

    // 存在しないグループの UI 状態を捨てる
    if (mainReport.status === 'ok') {
      const groupIds = new Set([
        ...this.main.groups.map((g) => g.id),
        ...this.archive.groups.map((g) => g.id),
      ]);
      this.uiState.pruneMissingGroups(groupIds);
    }

    this.pendingReports.push(mainReport, archiveReport);
    this.loaded = true;

    const after = JSON.stringify([this.main, this.archive]);
    return { changed: before !== null && before !== after };
  }

  /** 直近の reload() の結果（レポートと外部変更）を取り出す。取り出したら空になる */
  consumeLoadReports(): {
    files: LoadReportFile[];
    externallyChanged: Array<{ relativePath: string; content: string }>;
  } {
    const result = { files: this.pendingReports, externallyChanged: this.pendingExternalChanges };
    this.pendingReports = [];
    this.pendingExternalChanges = [];
    return result;
  }

  isCorrupted(): boolean {
    return this.corruptedFiles.size > 0;
  }

  /** 直近の reload() の結果がまだ consumeLoadReports() で取り出されていないか */
  hasPendingReports(): boolean {
    return this.pendingReports.length > 0;
  }

  /**
   * ファイルを読む。無ければ既定内容を書いて返す。存在するのに読めなければ unreadable にして null
   */
  private readOrCreate(
    filePath: string,
    report: LoadReportFile,
    createDefault: () => string
  ): string | null {
    if (!FileUtils.exists(filePath)) {
      const content = createDefault();
      if (!writeDataFile(filePath, content)) {
        report.status = 'unreadable';
        report.error = 'ファイルを作成できませんでした';
        this.corruptedFiles.add(report.file);
        return null;
      }
      report.rewritten = true;
      return content;
    }
    const content = FileUtils.safeReadTextFile(filePath);
    if (content === null) {
      logger.error({ filePath }, 'ワークスペースファイルを読み取れませんでした（ロック・権限）');
      report.status = 'unreadable';
      report.error = 'ファイルを読み込めませんでした';
      this.corruptedFiles.add(report.file);
    }
    return content;
  }

  private newReport(file: string): LoadReportFile {
    return {
      file,
      status: 'ok',
      accepted: 0,
      issues: [],
      externallyChanged: false,
      rewritten: false,
    };
  }

  private trackExternalChange(key: string, content: string, report: LoadReportFile): void {
    const previous = detectExternalChange(key, content);
    if (previous !== null) {
      report.externallyChanged = true;
      this.pendingExternalChanges.push({ relativePath: key, content: previous });
    }
    rememberDataFileContent(key, content);
  }

  private markCorrupted(report: LoadReportFile, error: unknown): void {
    logger.error({ error, file: report.file }, 'ワークスペースファイルのパースに失敗しました');
    report.status = 'corrupted';
    report.error = error instanceof Error ? error.message : String(error);
    this.corruptedFiles.add(report.file);
  }

  /**
   * 旧形式からの移行: スナップショット → 変換 → 書き込み → 旧 detached の削除
   */
  private async migrateLegacy(
    mainRaw: unknown,
    archiveRaw: unknown
  ): Promise<{ mainContent: string; archiveContent: string }> {
    const detachedContent = FileUtils.safeReadTextFile(this.paths.legacyDetached);
    let detachedRaw: unknown;
    if (detachedContent !== null) {
      try {
        detachedRaw = JSON.parse(detachedContent);
      } catch {
        logger.warn('workspace-detached.json を読めないため切り離しウィンドウの状態は移行しません');
      }
    }

    const now = this.now();
    const migrated = migrateWorkspaceV1(
      { main: mainRaw, archive: archiveRaw, detached: detachedRaw },
      { now }
    );

    // 変換結果を通常のパースに通してから書く（ここで問題が出るのは変換のバグ）
    const ctx = createWorkspaceParseContext(now);
    const parsedMain = parseWorkspaceFileLenient(JSON.stringify(migrated.main), ctx);
    const parsedArchive = parseWorkspaceArchiveFileLenient(JSON.stringify(migrated.archive), ctx);

    // 不可逆な形式変更なので backupEnabled に関係なく変更前を残す。失敗したら移行しない
    await this.hooks.createPreMigrationSnapshot();

    const mainContent = serializeWorkspaceFile(parsedMain.data, parsedMain.invalid);
    const archiveContent = serializeWorkspaceArchiveFile(parsedArchive.data, parsedArchive.invalid);
    if (!writeDataFile(this.paths.main, mainContent)) {
      throw new Error(`${WORKSPACE_FILE_KEY} の書き込みに失敗しました`);
    }
    if (!writeDataFile(this.paths.archive, archiveContent)) {
      throw new Error(`${WORKSPACE_ARCHIVE_FILE_KEY} の書き込みに失敗しました`);
    }

    // 移行時に採番し直した id に UI 状態のキーを追随させる（パースでさらに採番された分）
    const remap = (id: string) => ctx.idMap.get(id) ?? id;
    const uiState = migrated.uiState;
    uiState.collapsedGroups = Object.fromEntries(
      Object.entries(uiState.collapsedGroups).map(([id, v]) => [remap(id), v])
    );
    uiState.detachedWindows = Object.fromEntries(
      Object.entries(uiState.detachedWindows).map(([id, state]) => [
        remap(id),
        {
          ...state,
          collapsedStates: Object.fromEntries(
            Object.entries(state.collapsedStates).map(([k, v]) => [remap(k), v])
          ),
        },
      ])
    );
    if (isLegacyWorkspaceFile(mainRaw)) {
      this.uiState.replaceAll(uiState);
    } else {
      // archive だけが旧形式（部分復元など）。main の UI 状態は生きているので上書きしない
      const current = this.uiState.read();
      this.uiState.replaceAll({
        ...current,
        collapsedGroups: { ...uiState.collapsedGroups, ...current.collapsedGroups },
        detachedWindows: { ...uiState.detachedWindows, ...current.detachedWindows },
      });
    }

    if (detachedContent !== null) {
      try {
        fs.unlinkSync(this.paths.legacyDetached);
      } catch (error) {
        logger.warn({ error }, 'workspace-detached.json を削除できませんでした');
      }
    }

    logger.info(
      {
        workspaces: parsedMain.data.workspaces.length,
        groups: parsedMain.data.groups.length,
        items: parsedMain.data.items.length,
        archivedGroups: parsedArchive.data.groups.length,
        archivedItems: parsedArchive.data.items.length,
      },
      'ワークスペースファイルを旧形式から 2.0 に変換しました'
    );
    return { mainContent, archiveContent };
  }

  /**
   * 2.0 のファイルなのに旧 workspace-detached.json が残っている場合（バックアップからの部分復元など）、
   * UI 状態ファイルが無ければ取り込んで削除する
   */
  private importLegacyDetachedIfPresent(): void {
    if (this.uiState.exists()) return;
    const content = FileUtils.safeReadTextFile(this.paths.legacyDetached);
    if (content === null) return;
    try {
      const raw = JSON.parse(content) as { windows?: unknown };
      const state = coerceWorkspaceUiState({ detachedWindows: raw.windows });
      if (state) {
        this.uiState.replaceAll(state);
        fs.unlinkSync(this.paths.legacyDetached);
        logger.info('workspace-detached.json を workspace-ui-state.json に取り込みました');
      }
    } catch (error) {
      logger.warn({ error }, 'workspace-detached.json を取り込めませんでした');
    }
  }

  // --- 参照 ---

  get(key: 'workspaces'): Workspace[];
  get(key: 'groups'): WorkspaceGroup[];
  get(key: 'items'): WorkspaceItem[];
  get(key: 'workspaces' | 'groups' | 'items'): Workspace[] | WorkspaceGroup[] | WorkspaceItem[] {
    return clone(this.main[key]);
  }

  /** 両ファイルで使われている id（新規採番の reserved に使う） */
  allIds(): Set<string> {
    return new Set([
      ...this.main.workspaces.map((w) => w.id),
      ...this.main.groups.map((g) => g.id),
      ...this.main.items.map((i) => i.id),
      ...this.archive.groups.map((g) => g.id),
      ...this.archive.items.map((i) => i.id),
    ]);
  }

  /** 衝突しない新しい id */
  newId(): string {
    return generateUniqueId(this.allIds());
  }

  /** 既定ワークスペース（order 最小）の id */
  resolveDefaultWorkspaceId(): string {
    const sorted = [...this.main.workspaces].sort((a, b) => a.order - b.order);
    if (sorted.length === 0) {
      throw new WorkspaceCorruptedError(WORKSPACE_FILE_KEY);
    }
    return sorted[0].id;
  }

  /** アーカイブ側（マネージャーが get/set で扱えるアダプタ） */
  readonly archiveStore = {
    get: ((key: 'groups' | 'items') => clone(this.archive[key])) as {
      (key: 'groups'): ArchivedWorkspaceGroup[];
      (key: 'items'): ArchivedWorkspaceItem[];
    },
    set: (key: 'groups' | 'items', value: ArchivedWorkspaceGroup[] | ArchivedWorkspaceItem[]) => {
      this.updateArchive((archive) => {
        if (key === 'groups') archive.groups = value as ArchivedWorkspaceGroup[];
        else archive.items = value as ArchivedWorkspaceItem[];
      });
    },
  };

  // --- 更新（1 回の書き込み） ---

  set(key: 'workspaces', value: Workspace[]): void;
  set(key: 'groups', value: WorkspaceGroup[]): void;
  set(key: 'items', value: WorkspaceItem[]): void;
  set(
    key: 'workspaces' | 'groups' | 'items',
    value: Workspace[] | WorkspaceGroup[] | WorkspaceItem[]
  ): void {
    this.update((main) => {
      if (key === 'workspaces') main.workspaces = value as Workspace[];
      else if (key === 'groups') main.groups = value as WorkspaceGroup[];
      else main.items = value as WorkspaceItem[];
    });
  }

  /** workspace.json を 1 回の書き込みで更新する。mutate が false を返したら書かない */
  update(mutate: (main: WorkspaceMainData) => void | false): void {
    this.assertWritable(WORKSPACE_FILE_KEY, this.paths.main);
    const next = clone(this.main);
    if (mutate(next) === false) return;
    this.writeMain(next);
  }

  /** workspace-archive.json を 1 回の書き込みで更新する */
  updateArchive(mutate: (archive: WorkspaceArchiveData) => void): void {
    this.assertWritable(WORKSPACE_ARCHIVE_FILE_KEY, this.paths.archive);
    const next = clone(this.archive);
    mutate(next);
    this.writeArchive(next);
  }

  /**
   * 両ファイルをまとめて更新する（アーカイブ・復元）。書き込み前に両方の競合を確認する
   *
   * 2 回の書き込みはアトミックにできないので、要素を「受け取る側」を先に書く。
   * 2 回目（除去する側）が失敗しても要素は両方に残る（次の reload で重複 id として採番される）だけで、
   * 消えることはない
   */
  updateBoth(
    mutate: (main: WorkspaceMainData, archive: WorkspaceArchiveData) => void,
    writeFirst: 'main' | 'archive'
  ): void {
    this.assertWritable(WORKSPACE_FILE_KEY, this.paths.main);
    this.assertWritable(WORKSPACE_ARCHIVE_FILE_KEY, this.paths.archive);
    const nextMain = clone(this.main);
    const nextArchive = clone(this.archive);
    mutate(nextMain, nextArchive);
    if (writeFirst === 'archive') {
      this.writeArchive(nextArchive);
      this.writeMain(nextMain);
    } else {
      this.writeMain(nextMain);
      this.writeArchive(nextArchive);
    }
  }

  private assertWritable(key: string, filePath: string): void {
    // 2 ファイルは 1 つのデータセット。片方でも読めていなければ両方書かない
    // （読めなかった側を空のキャッシュで上書きしないため）
    if (!this.loaded || this.corruptedFiles.size > 0) {
      throw new WorkspaceCorruptedError([...this.corruptedFiles].join(', ') || key);
    }
    // 再読込の await 中（旧形式の移行）に書くと、移行の書き出しで上書きされて消える
    if (this.reloadPromise) {
      throw new WorkspaceReloadInProgressError();
    }
    const current = FileUtils.safeReadTextFile(filePath) ?? '';
    if (detectExternalChange(key, current) !== null) {
      throw new WorkspaceExternalChangeConflictError(key);
    }
  }

  private writeMain(next: WorkspaceMainData): void {
    const content = serializeWorkspaceFile(
      {
        version: JSON_WORKSPACE_VERSION,
        workspaces: next.workspaces,
        groups: next.groups,
        items: next.items.map((item) => toJsonItem(item)),
      },
      this.invalidMain
    );
    if (!writeDataFile(this.paths.main, content)) {
      throw new WorkspaceWriteError(WORKSPACE_FILE_KEY);
    }
    this.main = next;
  }

  private writeArchive(next: WorkspaceArchiveData): void {
    const content = serializeWorkspaceArchiveFile(
      {
        version: JSON_WORKSPACE_VERSION,
        groups: next.groups,
        items: next.items.map((item) => toJsonItem(item) as JsonArchivedWorkspaceItem),
      },
      this.invalidArchive
    );
    if (!writeDataFile(this.paths.archive, content)) {
      throw new WorkspaceWriteError(WORKSPACE_ARCHIVE_FILE_KEY);
    }
    this.archive = next;
  }
}
