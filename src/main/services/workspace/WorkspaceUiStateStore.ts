import type {
  DetachedWindowState,
  WorkspaceHintKey,
  WorkspaceUiStateFile,
  WorkspaceWindowState,
} from '@common/types';
import { WORKSPACE_UI_STATE_VERSION } from '@common/types';
import { isPinLevel, isRecord, isWorkspaceHintKey } from '@common/types/guards';

import { PathManager } from '../../config/pathManager.js';
import { JsonFileStore } from '../jsonFileStore.js';
import { isMonitorAnchor } from '../../utils/monitorAnchor.js';

/**
 * ワークスペースの UI 状態（config/workspace-ui-state.json）
 *
 * - メインのワークスペースウィンドウでのグループ折りたたみ
 * - 切り離しウィンドウの位置・ピン留め・折りたたみ
 *
 * workspace.json（AI が編集するデータ）から UI 状態を分離するためのストア。
 * 小さなファイルなので毎回ディスクを読み書きする。外部変更検知の対象外。
 */

const DEFAULT_DETACHED_BOUNDS: DetachedWindowState['bounds'] = {
  x: 0,
  y: 0,
  width: 380,
  height: 200,
};

function coerceBooleanRecord(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

function coerceDetachedWindowState(raw: unknown): DetachedWindowState | null {
  if (!isRecord(raw) || !isRecord(raw.bounds)) return null;
  const { x, y, width, height } = raw.bounds;
  if (![x, y, width, height].every((v) => typeof v === 'number')) return null;

  const state: DetachedWindowState = {
    collapsedStates: coerceBooleanRecord(raw.collapsedStates),
    bounds: { x: x as number, y: y as number, width: width as number, height: height as number },
  };
  if (isPinLevel(raw.pinMode)) {
    state.pinMode = raw.pinMode;
  }
  if (isMonitorAnchor(raw.anchor)) {
    state.anchor = raw.anchor;
  }
  return state;
}

/** ワークスペースウィンドウの状態の既定値（閉じていて、📌 は表示固定） */
export const DEFAULT_WORKSPACE_WINDOW_STATE: WorkspaceWindowState = { open: false, pinLevel: 1 };

function coerceWorkspaceWindowState(raw: unknown): WorkspaceWindowState | undefined {
  if (!isRecord(raw)) return undefined;
  const pinLevel = isPinLevel(raw.pinLevel)
    ? raw.pinLevel
    : DEFAULT_WORKSPACE_WINDOW_STATE.pinLevel;
  return { open: raw.open === true, pinLevel };
}

/** 生オブジェクトを WorkspaceUiStateFile に整える（欠けは空で補い、壊れた要素は捨てる） */
export function coerceWorkspaceUiState(raw: unknown): WorkspaceUiStateFile | null {
  if (!isRecord(raw)) return null;
  const detachedWindows: Record<string, DetachedWindowState> = {};
  if (isRecord(raw.detachedWindows)) {
    for (const [groupId, value] of Object.entries(raw.detachedWindows)) {
      const state = coerceDetachedWindowState(value);
      if (state) detachedWindows[groupId] = state;
    }
  }
  const workspaceWindow = coerceWorkspaceWindowState(raw.workspaceWindow);
  const shownHints = Array.isArray(raw.shownHints) ? raw.shownHints.filter(isWorkspaceHintKey) : [];
  return {
    version: WORKSPACE_UI_STATE_VERSION,
    collapsedGroups: coerceBooleanRecord(raw.collapsedGroups),
    detachedWindows,
    ...(workspaceWindow && { workspaceWindow }),
    ...(shownHints.length > 0 && { shownHints }),
  };
}

export function createEmptyWorkspaceUiState(): WorkspaceUiStateFile {
  return { version: WORKSPACE_UI_STATE_VERSION, collapsedGroups: {}, detachedWindows: {} };
}

export class WorkspaceUiStateStore {
  private readonly file: JsonFileStore<WorkspaceUiStateFile>;

  constructor(filePath: string = PathManager.getWorkspaceUiStateFilePath()) {
    this.file = new JsonFileStore(filePath, createEmptyWorkspaceUiState, coerceWorkspaceUiState);
  }

  exists(): boolean {
    return this.file.exists();
  }

  read(): WorkspaceUiStateFile {
    return this.file.read();
  }

  /** 全体を置き換える（移行時に使う） */
  replaceAll(state: WorkspaceUiStateFile): void {
    this.file.write(state);
  }

  // --- グループの折りたたみ（メインのワークスペースウィンドウ） ---

  getCollapsedGroups(): Record<string, boolean> {
    return this.read().collapsedGroups;
  }

  /** true のものだけ保存する（既定は展開） */
  setGroupsCollapsed(groupIds: string[], collapsed: boolean): void {
    const state = this.read();
    for (const id of groupIds) {
      if (collapsed) state.collapsedGroups[id] = true;
      else delete state.collapsedGroups[id];
    }
    this.file.write(state);
  }

  // --- ワークスペースウィンドウ ---

  getWorkspaceWindow(): WorkspaceWindowState {
    return this.read().workspaceWindow ?? { ...DEFAULT_WORKSPACE_WINDOW_STATE };
  }

  updateWorkspaceWindow(updates: Partial<WorkspaceWindowState>): void {
    const state = this.read();
    state.workspaceWindow = {
      ...(state.workspaceWindow ?? DEFAULT_WORKSPACE_WINDOW_STATE),
      ...updates,
    };
    this.file.write(state);
  }

  // --- 1 回だけ出す案内 ---

  /** まだ「わかった」を押していない案内なら true */
  isHintPending(key: WorkspaceHintKey): boolean {
    return !(this.read().shownHints ?? []).includes(key);
  }

  /** 「わかった」を押した案内として覚える（もう覚えていれば何もしない） */
  dismissHint(key: WorkspaceHintKey): void {
    const state = this.read();
    const shown = state.shownHints ?? [];
    if (shown.includes(key)) return;
    state.shownHints = [...shown, key];
    this.file.write(state);
  }

  // --- 切り離しウィンドウ ---

  getDetached(rootGroupId: string): DetachedWindowState | null {
    return this.read().detachedWindows[rootGroupId] ?? null;
  }

  listDetachedGroupIds(): string[] {
    return Object.keys(this.read().detachedWindows);
  }

  updateDetached(rootGroupId: string, updates: Partial<DetachedWindowState>): void {
    const state = this.read();
    const current = state.detachedWindows[rootGroupId] ?? {
      collapsedStates: {},
      bounds: { ...DEFAULT_DETACHED_BOUNDS },
    };
    state.detachedWindows[rootGroupId] = { ...current, ...updates };
    this.file.write(state);
  }

  /** ピン留めしていない切り離しウィンドウを、すべて表示固定にする（古い設定からの読み替え） */
  pinAllUnpinnedDetached(): number {
    const state = this.read();
    let count = 0;
    for (const detached of Object.values(state.detachedWindows)) {
      if (!detached.pinMode) {
        detached.pinMode = 1;
        count++;
      }
    }
    if (count > 0) this.file.write(state);
    return count;
  }

  removeDetached(rootGroupId: string): void {
    const state = this.read();
    if (!(rootGroupId in state.detachedWindows)) return;
    delete state.detachedWindows[rootGroupId];
    this.file.write(state);
  }

  /**
   * 存在しないグループの状態を捨てる（グループ削除・アーカイブ・再読込の後に呼ぶ）
   */
  pruneMissingGroups(existingGroupIds: Set<string>): void {
    const state = this.read();
    let changed = false;

    for (const id of Object.keys(state.collapsedGroups)) {
      if (!existingGroupIds.has(id)) {
        delete state.collapsedGroups[id];
        changed = true;
      }
    }
    for (const [rootId, detached] of Object.entries(state.detachedWindows)) {
      if (!existingGroupIds.has(rootId)) {
        delete state.detachedWindows[rootId];
        changed = true;
        continue;
      }
      for (const id of Object.keys(detached.collapsedStates)) {
        if (!existingGroupIds.has(id)) {
          delete detached.collapsedStates[id];
          changed = true;
        }
      }
    }

    if (changed) this.file.write(state);
  }
}
