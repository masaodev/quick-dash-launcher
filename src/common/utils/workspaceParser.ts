/**
 * ワークスペース設定ファイル（workspace.json / workspace-archive.json）の寛容パーサー
 *
 * jsonParser.ts の parseJsonDataFileLenient と同じ方針:
 * - JSON 構文エラーとルート構造の不正だけ throw する
 * - id の欠落・不正・重複は採番で補う（idAssigned）。旧 id → 新 id は idMap に残し、参照を追随させる
 * - 要素単位の不正は invalid として読み込みから外すが、生のまま返す（書き戻しで消さない）
 * - $schema / version / 既定ワークスペース / 宙に浮いた参照 は補正する（normalized）
 *
 * アイテム本体の検証はデータファイルの検証関数（validateJson*Item）を共用し、
 * 「データファイルでは通るがワークスペースでは通らない」食い違いを作らない。
 */

import type {
  JsonArchivedWorkspaceGroup,
  JsonArchivedWorkspaceItem,
  JsonWorkspace,
  JsonWorkspaceArchiveFile,
  JsonWorkspaceFile,
  JsonWorkspaceGroup,
  JsonWorkspaceItem,
} from '@common/types/json-workspace';
import {
  DEFAULT_WORKSPACE_DISPLAY_NAME,
  JSON_WORKSPACE_ITEM_TYPES,
  JSON_WORKSPACE_VERSION,
  WORKSPACE_ARCHIVE_SCHEMA_REF,
  WORKSPACE_SCHEMA_REF,
} from '@common/types/json-workspace';
import { getDefaultGroupColor, isValidGroupColor } from '@common/groupColors';
import { MAX_GROUP_DEPTH } from '@common/utils/groupTreeUtils';

import {
  generateUniqueId,
  isValidId,
  validateJsonClipboardItem,
  validateJsonGroupItem,
  validateJsonLauncherItem,
  validateJsonLayoutItem,
  validateJsonWindowItem,
} from './jsonParser';
import type { JsonItemIssue } from './jsonParser';
import { normalizeWindowTitleForProcessOnly } from './windowTitle';

/** 書き込み側の normalizeWorkspaceItemBody と同じ規則。読み込みでは normalized として報告する */
const WINDOW_TITLE_NORMALIZED_REASON =
  'windowTitle が空でプロセス名だけのため "*"（全一致）にしました';

// ============================================================
// 型
// ============================================================

type Section = NonNullable<JsonItemIssue['section']>;

/**
 * workspace.json と workspace-archive.json を横断するパース文脈
 *
 * id は両ファイルで 1 つの名前空間なので、reservedIds / idMap を共有する。
 * archive の参照解決（workspaceId / parentGroupId）には main で確定した id を使う。
 */
export interface WorkspaceParseContext {
  /** 使用済み id（両ファイル横断） */
  reservedIds: Set<string>;
  /** 採番し直した id の 旧 → 新（参照の追随に使う） */
  idMap: Map<string, string>;
  /** main で確定したワークスペース id */
  workspaceIds: Set<string>;
  /** main で確定したグループ id */
  groupIds: Set<string>;
  /**
   * 検証を通らなかったグループの id（生のまま保持している要素）。
   * これを指す参照は「存在しない」扱いにせず残す（グループを直せば元に戻るように）
   */
  invalidGroupIds: Set<string>;
  /** 既定ワークスペース id（order 最小）。main のパース後に確定 */
  defaultWorkspaceId: string;
  /** 補完に使う現在時刻 */
  now: number;
}

export function createWorkspaceParseContext(now: number = Date.now()): WorkspaceParseContext {
  return {
    reservedIds: new Set(),
    idMap: new Map(),
    workspaceIds: new Set(),
    groupIds: new Set(),
    invalidGroupIds: new Set(),
    defaultWorkspaceId: '',
    now,
  };
}

/** 検証を通らなかった要素（生のまま。書き戻し時に各配列の末尾へ付ける） */
export interface InvalidWorkspaceEntries {
  workspaces: unknown[];
  groups: unknown[];
  items: unknown[];
}

export interface WorkspaceLenientParseResult {
  /** 検証済み・正規化済みのデータ（不正な要素は含まない） */
  data: JsonWorkspaceFile;
  invalid: InvalidWorkspaceEntries;
  issues: JsonItemIssue[];
  /** 採番・補正で内容が変わり、書き戻しが必要 */
  modified: boolean;
}

export interface WorkspaceArchiveLenientParseResult {
  data: JsonWorkspaceArchiveFile;
  invalid: Pick<InvalidWorkspaceEntries, 'groups' | 'items'>;
  issues: JsonItemIssue[];
  modified: boolean;
}

// ============================================================
// 内部ヘルパー
// ============================================================

/** issues と modified をまとめて扱う */
class IssueCollector {
  readonly issues: JsonItemIssue[] = [];
  modified = false;

  normalized(section: Section | undefined, index: number, reason: string, id?: string): void {
    this.issues.push({ index, kind: 'normalized', id, reason, ...(section && { section }) });
    this.modified = true;
  }

  idAssigned(section: Section, index: number, id: string, reason: string): void {
    this.issues.push({ index, kind: 'idAssigned', id, reason, section });
    this.modified = true;
  }

  invalid(section: Section, index: number, reason: string, id?: string): void {
    this.issues.push({ index, kind: 'invalid', id, reason, section });
  }
}

function parseRoot(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid JSON structure: root must be an object');
  }
  return parsed as Record<string, unknown>;
}

/** 配列フィールドを取り出す。無ければ空配列として補い、配列以外なら throw */
function takeArray(obj: Record<string, unknown>, key: Section, issues: IssueCollector): unknown[] {
  const value = obj[key];
  if (value === undefined) {
    issues.normalized(key, -1, `${key} が無いため空の配列を補いました`);
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Invalid JSON structure: ${key} must be an array`);
  }
  return value;
}

function normalizeHeader(
  obj: Record<string, unknown>,
  schemaRef: string,
  issues: IssueCollector
): void {
  if (obj.$schema !== schemaRef) {
    issues.normalized(
      undefined,
      -1,
      obj.$schema === undefined
        ? `$schema が無いため "${schemaRef}" を補いました`
        : `$schema "${String(obj.$schema)}" を "${schemaRef}" に直しました`
    );
  }
  if (obj.version !== JSON_WORKSPACE_VERSION) {
    issues.normalized(
      undefined,
      -1,
      obj.version === undefined
        ? `version が無いため "${JSON_WORKSPACE_VERSION}" を補いました`
        : `version "${String(obj.version)}" を "${JSON_WORKSPACE_VERSION}" に直しました`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * id を確定する（欠落・不正・重複なら採番）
 *
 * 不正な文字列 id（旧形式の UUID など）は idMap に登録し、他要素からの参照を追随させる。
 * 有効 id の重複は最初の要素が id を保持し、2 件目以降は採番する（参照は最初の要素を指したまま）。
 */
function resolveId(
  raw: Record<string, unknown>,
  section: Section,
  index: number,
  ctx: WorkspaceParseContext,
  issues: IssueCollector
): string {
  const original = raw.id;
  if (isValidId(original) && !ctx.reservedIds.has(original)) {
    ctx.reservedIds.add(original);
    return original;
  }

  const id = generateUniqueId(ctx.reservedIds);
  ctx.reservedIds.add(id);

  if (original === undefined) {
    issues.idAssigned(section, index, id, 'id が無いため採番しました');
  } else if (!isValidId(original)) {
    issues.idAssigned(
      section,
      index,
      id,
      `id "${String(original)}" が不正なため採番し直しました（8 文字の英数字）`
    );
    if (typeof original === 'string' && original !== '' && !ctx.idMap.has(original)) {
      ctx.idMap.set(original, id);
    }
  } else {
    issues.idAssigned(section, index, id, `id "${original}" が重複しているため採番し直しました`);
  }
  return id;
}

function requireDisplayName(raw: Record<string, unknown>): string {
  if (typeof raw.displayName !== 'string' || raw.displayName === '') {
    throw new Error('displayName is required and must be a non-empty string');
  }
  return raw.displayName;
}

/** 数値フィールドを取り出す。無ければ既定値で補い normalized */
function numberOrDefault(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
  section: Section,
  index: number,
  id: string,
  issues: IssueCollector
): number {
  const value = raw[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value !== undefined) {
    throw new Error(`${key} must be a number`);
  }
  issues.normalized(section, index, `${key} が無いため ${fallback} を補いました`, id);
  return fallback;
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

/** 参照 id を idMap で追随させる */
function mapRef(ref: unknown, ctx: WorkspaceParseContext): string | undefined {
  if (typeof ref !== 'string' || ref === '') return undefined;
  return ctx.idMap.get(ref) ?? ref;
}

/** ワークスペースだけが持つメタキー（アイテム本体の検証前に外す） */
const ITEM_META_KEYS = [
  'workspaceId',
  'groupId',
  'order',
  'addedAt',
  'archivedAt',
  'archivedGroupId',
];

/**
 * 書き込み前のアイテム本体の正規化・検証（QDL 自身が書く経路でも、読み込みで invalid になるものを書かない）
 *
 * - ウィンドウ操作でタイトルが空・プロセス名だけのときは全一致ワイルドカード "*" にする（移行と同じ規則）
 * - 通常アイテムで path が変わらない編集では、呼び出し側が渡した originalPath（.lnk のリンク先）を保つ
 *
 * @throws 検証を通らないとき（displayName 欠落など）
 */
export function normalizeWorkspaceItemBody<T extends { type: JsonWorkspaceItem['type'] }>(
  body: T,
  id: string
): T {
  const raw = { ...(body as unknown as Record<string, unknown>) };
  if (raw.type === 'window') {
    const normalized = normalizeWindowTitleForProcessOnly(raw.windowTitle, raw.processName);
    if (normalized !== undefined) raw.windowTitle = normalized;
  }
  const validated = validateItemBody(raw, id);
  delete validated.id;
  delete validated.updatedAt;
  return validated as unknown as T;
}

/**
 * ワークスペースアイテムの本体（type 固有部分）をデータファイルの検証関数で検証する
 */
function validateItemBody(raw: Record<string, unknown>, id: string): Record<string, unknown> {
  const body: Record<string, unknown> = { ...raw, id };
  for (const key of ITEM_META_KEYS) delete body[key];

  switch (raw.type) {
    case 'item': {
      const item = validateJsonLauncherItem(body) as unknown as Record<string, unknown>;
      // 自動取込ルールはデータファイル専用。ワークスペースには持ち込まない
      delete item.autoImportRuleId;
      const originalPath = optionalString(raw, 'originalPath');
      return originalPath === undefined ? item : { ...item, originalPath };
    }
    case 'window':
      return validateJsonWindowItem(body) as unknown as Record<string, unknown>;
    case 'group':
      return validateJsonGroupItem(body) as unknown as Record<string, unknown>;
    case 'clipboard':
      return validateJsonClipboardItem(body) as unknown as Record<string, unknown>;
    case 'layout':
      return validateJsonLayoutItem(body) as unknown as Record<string, unknown>;
    default:
      throw new Error(
        `Unknown item type: ${String(raw.type)}（${JSON_WORKSPACE_ITEM_TYPES.join(' / ')} のいずれか）`
      );
  }
}

// ============================================================
// キー順を固定して出力するためのヘルパー
// ============================================================

const ITEM_TYPE_KEYS: Record<JsonWorkspaceItem['type'], string[]> = {
  item: ['path', 'args', 'originalPath', 'customIcon', 'windowConfig'],
  window: [
    'windowTitle',
    'processName',
    'x',
    'y',
    'width',
    'height',
    'moveToActiveMonitorCenter',
    'virtualDesktopNumber',
    'activateWindow',
    'pinToAllDesktops',
  ],
  group: ['itemNames'],
  clipboard: ['dataFileRef', 'savedAt', 'preview', 'formats', 'customIcon'],
  layout: ['entries', 'customIcon'],
};

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** アイテムを `id, type, displayName, <型固有>, memo, workspaceId, groupId, order, addedAt(, archived*)` の順に並べ替える */
export function orderWorkspaceItemKeys<T extends JsonWorkspaceItem | JsonArchivedWorkspaceItem>(
  item: T
): T {
  const src = item as unknown as Record<string, unknown>;
  return {
    ...pick(src, ['id', 'type', 'displayName']),
    ...pick(src, ITEM_TYPE_KEYS[item.type]),
    ...pick(src, [
      'memo',
      'workspaceId',
      'groupId',
      'order',
      'addedAt',
      'archivedAt',
      'archivedGroupId',
    ]),
  } as unknown as T;
}

function orderGroupKeys<T extends JsonWorkspaceGroup | JsonArchivedWorkspaceGroup>(group: T): T {
  return pick(group as unknown as Record<string, unknown>, [
    'id',
    'displayName',
    'color',
    'order',
    'createdAt',
    'workspaceId',
    'parentGroupId',
    'archivedAt',
    'originalOrder',
    'itemCount',
  ]) as unknown as T;
}

function orderWorkspaceKeys(ws: JsonWorkspace): JsonWorkspace {
  return pick(ws as unknown as Record<string, unknown>, [
    'id',
    'displayName',
    'order',
    'createdAt',
  ]) as unknown as JsonWorkspace;
}

// ============================================================
// 要素単位の検証
// ============================================================

type ParsedGroup<T extends JsonWorkspaceGroup> = {
  group: T;
  /** 参照解決前の生の参照 */
  rawWorkspaceId: unknown;
  rawParentGroupId: unknown;
  index: number;
};

type ParsedItem<T extends JsonWorkspaceItem> = {
  item: T;
  /** 元のオブジェクト（invalid として保持するときに使う） */
  raw: Record<string, unknown>;
  rawWorkspaceId: unknown;
  rawGroupId: unknown;
  rawArchivedGroupId?: unknown;
  index: number;
};

function parseWorkspaces(
  rawList: unknown[],
  ctx: WorkspaceParseContext,
  issues: IssueCollector,
  invalid: unknown[]
): JsonWorkspace[] {
  const result: JsonWorkspace[] = [];
  rawList.forEach((raw, index) => {
    if (!isRecord(raw)) {
      issues.invalid(
        'workspaces',
        index,
        `workspaces[${index}] はオブジェクトでないため削除しました`
      );
      issues.modified = true;
      return;
    }
    const id = resolveId(raw, 'workspaces', index, ctx, issues);
    try {
      const ws: JsonWorkspace = {
        id,
        displayName: requireDisplayName(raw),
        order: numberOrDefault(raw, 'order', index, 'workspaces', index, id, issues),
        createdAt: numberOrDefault(raw, 'createdAt', ctx.now, 'workspaces', index, id, issues),
      };
      result.push(ws);
    } catch (error) {
      issues.invalid(
        'workspaces',
        index,
        error instanceof Error ? error.message : String(error),
        id
      );
      invalid.push(raw);
    }
  });
  return result;
}

function parseGroupBase(
  raw: Record<string, unknown>,
  index: number,
  ctx: WorkspaceParseContext,
  issues: IssueCollector
): { group: JsonWorkspaceGroup; rawWorkspaceId: unknown; rawParentGroupId: unknown } {
  const id = resolveId(raw, 'groups', index, ctx, issues);
  const displayName = requireDisplayName(raw);

  let color: string;
  if (isValidGroupColor(raw.color)) {
    color = raw.color;
  } else {
    color = getDefaultGroupColor(0);
    issues.normalized(
      'groups',
      index,
      raw.color === undefined
        ? `color が無いため "${color}" を補いました`
        : `color "${String(raw.color)}" は色トークンでも 6 桁 hex でもないため "${color}" にしました`,
      id
    );
  }

  const group: JsonWorkspaceGroup = {
    id,
    displayName,
    color,
    order: numberOrDefault(raw, 'order', index, 'groups', index, id, issues),
    createdAt: numberOrDefault(raw, 'createdAt', ctx.now, 'groups', index, id, issues),
    workspaceId: '', // pass 2 で確定
  };
  return { group, rawWorkspaceId: raw.workspaceId, rawParentGroupId: raw.parentGroupId };
}

function parseItemBase(
  raw: Record<string, unknown>,
  index: number,
  ctx: WorkspaceParseContext,
  issues: IssueCollector
): ParsedItem<JsonWorkspaceItem> {
  const id = resolveId(raw, 'items', index, ctx, issues);
  const windowTitle = normalizeWindowTitleForProcessOnly(raw.windowTitle, raw.processName);
  if (raw.type === 'window' && windowTitle !== undefined) {
    raw = { ...raw, windowTitle };
    issues.normalized('items', index, WINDOW_TITLE_NORMALIZED_REASON, id);
  }
  const body = validateItemBody(raw, id);
  delete body.updatedAt;

  const item = {
    ...body,
    workspaceId: '', // pass 2 で確定
    order: numberOrDefault(raw, 'order', index, 'items', index, id, issues),
    addedAt: numberOrDefault(raw, 'addedAt', ctx.now, 'items', index, id, issues),
  } as unknown as JsonWorkspaceItem;

  return {
    item,
    raw,
    rawWorkspaceId: raw.workspaceId,
    rawGroupId: raw.groupId,
    rawArchivedGroupId: raw.archivedGroupId,
    index,
  };
}

/** workspaceId を解決する。無い・存在しないなら既定ワークスペースへ */
function resolveWorkspaceId(
  rawRef: unknown,
  section: Section,
  index: number,
  id: string,
  ctx: WorkspaceParseContext,
  issues: IssueCollector
): string {
  const mapped = mapRef(rawRef, ctx);
  if (mapped !== undefined && ctx.workspaceIds.has(mapped)) return mapped;

  issues.normalized(
    section,
    index,
    mapped === undefined
      ? 'workspaceId が無いため既定のワークスペースに入れました'
      : `workspaceId "${mapped}" のワークスペースが無いため既定のワークスペースに移しました`,
    id
  );
  return ctx.defaultWorkspaceId;
}

/** 任意の参照（groupId / parentGroupId）を解決する。存在しなければ undefined（外す） */
function resolveRef(
  rawRef: unknown,
  known: Set<string>,
  selfId: string,
  label: string,
  section: Section,
  index: number,
  ctx: WorkspaceParseContext,
  issues: IssueCollector
): string | undefined {
  if (rawRef === undefined) return undefined;
  const mapped = mapRef(rawRef, ctx);
  if (mapped !== undefined && mapped !== selfId && known.has(mapped)) return mapped;
  // 検証を通らなかったグループへの参照は外さない（直せば戻る。実行時は未分類として扱われる）
  if (mapped !== undefined && mapped !== selfId && ctx.invalidGroupIds.has(mapped)) return mapped;

  issues.normalized(
    section,
    index,
    mapped === undefined
      ? `${label} が文字列でないため外しました`
      : `${label} "${mapped}" のグループが無いため外しました`,
    selfId
  );
  return undefined;
}

/**
 * parentGroupId の循環と深さ超過（MAX_GROUP_DEPTH）を補正する
 *
 * 手編集で A→B→A のような循環を作るとレンダラーの祖先探索が止まらなくなるため、
 * 祖先を辿って循環・深さ超過を検出したグループは親を外してトップレベルにする。
 * groups は pass 2 で参照解決済みのもの（並びは元の配列順）。
 */
function breakGroupCycles(
  groups: JsonWorkspaceGroup[],
  indexes: number[],
  issues: IssueCollector
): void {
  const byId = new Map(groups.map((g) => [g.id, g]));
  groups.forEach((group, i) => {
    if (!group.parentGroupId) return;
    const visited = new Set<string>([group.id]);
    let current = group.parentGroupId;
    let depth = 1;
    let reason: string | undefined;
    while (current) {
      if (visited.has(current)) {
        reason = `parentGroupId が循環しているため親を外しました`;
        break;
      }
      if (depth > MAX_GROUP_DEPTH) {
        reason = `parentGroupId の入れ子が ${MAX_GROUP_DEPTH} 段を超えるため親を外しました`;
        break;
      }
      visited.add(current);
      const parent = byId.get(current);
      if (!parent) break; // 不正グループへの参照（resolveRef で残したもの）はここで打ち切る
      current = parent.parentGroupId ?? '';
      depth++;
    }
    if (reason) {
      delete group.parentGroupId;
      issues.normalized('groups', indexes[i], reason, group.id);
    }
  });
}

/**
 * 配列の各要素を検証する共通処理
 *
 * オブジェクトでない要素は削除し、parse が投げた要素は invalid として生のまま保持する
 * （書き戻し時に末尾へ付けるので、ファイルを直せば戻る）。
 *
 * @param onInvalid 保持した不正な要素に対する追加処理（参照を外さないための記録など）
 */
function parseEach<T>(
  rawList: unknown[],
  section: Section,
  issues: IssueCollector,
  invalid: unknown[],
  parse: (raw: Record<string, unknown>, index: number) => T,
  onInvalid?: (raw: Record<string, unknown>) => void
): T[] {
  const result: T[] = [];
  rawList.forEach((raw, index) => {
    if (!isRecord(raw)) {
      issues.invalid(section, index, `${section}[${index}] はオブジェクトでないため削除しました`);
      issues.modified = true;
      return;
    }
    try {
      result.push(parse(raw, index));
    } catch (error) {
      issues.invalid(
        section,
        index,
        error instanceof Error ? error.message : String(error),
        typeof raw.id === 'string' ? raw.id : undefined
      );
      invalid.push(raw);
      onInvalid?.(raw);
    }
  });
  return result;
}

/** 検証を通らなかったグループの id を記録する（そのグループへの参照を外さないため） */
function rememberInvalidGroupId(ctx: WorkspaceParseContext) {
  return (raw: Record<string, unknown>): void => {
    if (typeof raw.id === 'string' && raw.id !== '') ctx.invalidGroupIds.add(raw.id);
  };
}

/**
 * グループの workspaceId・parentGroupId を解決し、循環と深さ超過を補正する（pass 2）
 *
 * @param knownGroupIds parentGroupId として参照できるグループ
 */
function resolveGroups<T extends JsonWorkspaceGroup>(
  parsedGroups: ParsedGroup<T>[],
  knownGroupIds: Set<string>,
  ctx: WorkspaceParseContext,
  issues: IssueCollector
): T[] {
  const groups = parsedGroups.map(({ group, rawWorkspaceId, rawParentGroupId, index }) => {
    group.workspaceId = resolveWorkspaceId(rawWorkspaceId, 'groups', index, group.id, ctx, issues);
    const parentGroupId = resolveRef(
      rawParentGroupId,
      knownGroupIds,
      group.id,
      'parentGroupId',
      'groups',
      index,
      ctx,
      issues
    );
    if (parentGroupId !== undefined) group.parentGroupId = parentGroupId;
    return orderGroupKeys(group);
  });
  breakGroupCycles(
    groups,
    parsedGroups.map((g) => g.index),
    issues
  );
  return groups;
}

/**
 * アイテムの workspaceId・groupId を解決する（pass 2）
 *
 * @param knownGroupIds groupId として参照できるグループ
 */
function resolveItem<T extends JsonWorkspaceItem>(
  { item, rawWorkspaceId, rawGroupId, index }: ParsedItem<T>,
  knownGroupIds: Set<string>,
  ctx: WorkspaceParseContext,
  issues: IssueCollector
): T {
  item.workspaceId = resolveWorkspaceId(rawWorkspaceId, 'items', index, item.id, ctx, issues);
  const groupId = resolveRef(
    rawGroupId,
    knownGroupIds,
    item.id,
    'groupId',
    'items',
    index,
    ctx,
    issues
  );
  if (groupId !== undefined) item.groupId = groupId;
  return orderWorkspaceItemKeys(item);
}

// ============================================================
// workspace.json
// ============================================================

/**
 * workspace.json を寛容にパースする
 *
 * @throws JSON 構文エラー、または root/配列フィールドの構造が不正な場合
 */
export function parseWorkspaceFileLenient(
  content: string,
  ctx: WorkspaceParseContext = createWorkspaceParseContext()
): WorkspaceLenientParseResult {
  const obj = parseRoot(content);
  const issues = new IssueCollector();
  const invalid: InvalidWorkspaceEntries = { workspaces: [], groups: [], items: [] };

  normalizeHeader(obj, WORKSPACE_SCHEMA_REF, issues);
  const rawWorkspaces = takeArray(obj, 'workspaces', issues);
  const rawGroups = takeArray(obj, 'groups', issues);
  const rawItems = takeArray(obj, 'items', issues);

  // --- pass 1: 要素単位の検証と id の確定 ---
  const workspaces = parseWorkspaces(rawWorkspaces, ctx, issues, invalid.workspaces);
  if (workspaces.length === 0) {
    const id = generateUniqueId(ctx.reservedIds);
    ctx.reservedIds.add(id);
    workspaces.push({
      id,
      displayName: DEFAULT_WORKSPACE_DISPLAY_NAME,
      order: 0,
      createdAt: ctx.now,
    });
    issues.normalized(
      'workspaces',
      -1,
      'ワークスペースが 1 件も無いため既定のワークスペースを作りました',
      id
    );
  }
  for (const ws of workspaces) ctx.workspaceIds.add(ws.id);
  ctx.defaultWorkspaceId = [...workspaces].sort((a, b) => a.order - b.order)[0].id;

  const parsedGroups = parseEach(
    rawGroups,
    'groups',
    issues,
    invalid.groups,
    (raw, index): ParsedGroup<JsonWorkspaceGroup> => ({
      ...parseGroupBase(raw, index, ctx, issues),
      index,
    }),
    rememberInvalidGroupId(ctx)
  );
  for (const { group } of parsedGroups) ctx.groupIds.add(group.id);

  const parsedItems = parseEach(rawItems, 'items', issues, invalid.items, (raw, index) =>
    parseItemBase(raw, index, ctx, issues)
  );

  // --- pass 2: 参照の解決 ---
  const groups = resolveGroups(parsedGroups, ctx.groupIds, ctx, issues);
  const items = parsedItems.map((parsed) => resolveItem(parsed, ctx.groupIds, ctx, issues));

  if (invalid.workspaces.length + invalid.groups.length + invalid.items.length > 0) {
    // 不正な要素は書き戻し時に末尾へ寄るので内容が変わる
    issues.modified = true;
  }

  return {
    data: {
      $schema: WORKSPACE_SCHEMA_REF,
      version: JSON_WORKSPACE_VERSION,
      workspaces: workspaces.map(orderWorkspaceKeys),
      groups,
      items,
    },
    invalid,
    issues: issues.issues,
    modified: issues.modified,
  };
}

// ============================================================
// workspace-archive.json
// ============================================================

/**
 * workspace-archive.json を寛容にパースする
 *
 * main（workspace.json）のパースで確定した ctx を渡す。workspaceId は main のワークスペース、
 * parentGroupId は archive 内のグループ＋main のグループ、archivedGroupId は archive 内のグループで解決する。
 */
export function parseWorkspaceArchiveFileLenient(
  content: string,
  ctx: WorkspaceParseContext
): WorkspaceArchiveLenientParseResult {
  if (ctx.defaultWorkspaceId === '') {
    throw new Error('parseWorkspaceArchiveFileLenient は workspace.json のパース後に呼ぶこと');
  }
  const obj = parseRoot(content);
  const issues = new IssueCollector();
  const invalid = { groups: [] as unknown[], items: [] as unknown[] };

  normalizeHeader(obj, WORKSPACE_ARCHIVE_SCHEMA_REF, issues);
  const rawGroups = takeArray(obj, 'groups', issues);
  const rawItems = takeArray(obj, 'items', issues);

  const parsedGroups = parseEach(
    rawGroups,
    'groups',
    issues,
    invalid.groups,
    (raw, index): ParsedGroup<JsonArchivedWorkspaceGroup> => {
      const base = parseGroupBase(raw, index, ctx, issues);
      const id = base.group.id;
      const group: JsonArchivedWorkspaceGroup = {
        ...base.group,
        archivedAt: numberOrDefault(raw, 'archivedAt', ctx.now, 'groups', index, id, issues),
        originalOrder: numberOrDefault(
          raw,
          'originalOrder',
          base.group.order,
          'groups',
          index,
          id,
          issues
        ),
        itemCount: numberOrDefault(raw, 'itemCount', 0, 'groups', index, id, issues),
      };
      return { ...base, group, index };
    },
    rememberInvalidGroupId(ctx)
  );
  const archiveGroupIds = new Set(parsedGroups.map((g) => g.group.id));
  const knownGroupIds = new Set([...archiveGroupIds, ...ctx.groupIds]);

  const parsedItems = parseEach(
    rawItems,
    'items',
    issues,
    invalid.items,
    (raw, index): ParsedItem<JsonArchivedWorkspaceItem> => {
      const base = parseItemBase(raw, index, ctx, issues);
      if (typeof raw.archivedGroupId !== 'string' || raw.archivedGroupId === '') {
        throw new Error('archivedGroupId is required and must be a non-empty string');
      }
      const item = {
        ...base.item,
        archivedAt: numberOrDefault(
          raw,
          'archivedAt',
          ctx.now,
          'items',
          index,
          base.item.id,
          issues
        ),
        archivedGroupId: '', // pass 2 で確定
      } as JsonArchivedWorkspaceItem;
      return { ...base, item };
    }
  );

  const groups = resolveGroups(parsedGroups, knownGroupIds, ctx, issues);

  const items: JsonArchivedWorkspaceItem[] = [];
  for (const parsed of parsedItems) {
    const { item, rawArchivedGroupId, index, raw } = parsed;
    const archivedGroupId = mapRef(rawArchivedGroupId, ctx);
    if (archivedGroupId === undefined || !archiveGroupIds.has(archivedGroupId)) {
      // 所属するアーカイブグループが無い（グループが不正・削除済み）アイテムは画面から到達できない。
      // 消さずに invalid として保持し、グループを直せば戻るようにする
      issues.invalid(
        'items',
        index,
        `archivedGroupId "${String(rawArchivedGroupId)}" のアーカイブグループが無いため読み込みから外しました`,
        item.id
      );
      invalid.items.push(raw);
      continue;
    }
    item.archivedGroupId = archivedGroupId;
    items.push(resolveItem(parsed, knownGroupIds, ctx, issues));
  }

  if (invalid.groups.length + invalid.items.length > 0) {
    issues.modified = true;
  }

  return {
    data: {
      $schema: WORKSPACE_ARCHIVE_SCHEMA_REF,
      version: JSON_WORKSPACE_VERSION,
      groups,
      items,
    },
    invalid,
    issues: issues.issues,
    modified: issues.modified,
  };
}

// ============================================================
// シリアライズ・空ファイル
// ============================================================

/**
 * workspace.json を文字列にする。不正な要素（invalid）は各配列の末尾に生のまま付ける
 */
export function serializeWorkspaceFile(
  data: JsonWorkspaceFile,
  invalid: Partial<InvalidWorkspaceEntries> = {}
): string {
  const out = {
    $schema: data.$schema ?? WORKSPACE_SCHEMA_REF,
    version: data.version,
    workspaces: [...data.workspaces.map(orderWorkspaceKeys), ...(invalid.workspaces ?? [])],
    groups: [...data.groups.map(orderGroupKeys), ...(invalid.groups ?? [])],
    items: [...data.items.map(orderWorkspaceItemKeys), ...(invalid.items ?? [])],
  };
  return JSON.stringify(out, null, 2);
}

export function serializeWorkspaceArchiveFile(
  data: JsonWorkspaceArchiveFile,
  invalid: Partial<Pick<InvalidWorkspaceEntries, 'groups' | 'items'>> = {}
): string {
  const out = {
    $schema: data.$schema ?? WORKSPACE_ARCHIVE_SCHEMA_REF,
    version: data.version,
    groups: [...data.groups.map(orderGroupKeys), ...(invalid.groups ?? [])],
    items: [...data.items.map(orderWorkspaceItemKeys), ...(invalid.items ?? [])],
  };
  return JSON.stringify(out, null, 2);
}

/** 既定ワークスペース 1 件だけの空ファイルを作る */
export function createEmptyWorkspaceFile(
  workspaceId: string,
  now: number = Date.now()
): JsonWorkspaceFile {
  return {
    $schema: WORKSPACE_SCHEMA_REF,
    version: JSON_WORKSPACE_VERSION,
    workspaces: [
      { id: workspaceId, displayName: DEFAULT_WORKSPACE_DISPLAY_NAME, order: 0, createdAt: now },
    ],
    groups: [],
    items: [],
  };
}

export function createEmptyWorkspaceArchiveFile(): JsonWorkspaceArchiveFile {
  return {
    $schema: WORKSPACE_ARCHIVE_SCHEMA_REF,
    version: JSON_WORKSPACE_VERSION,
    groups: [],
    items: [],
  };
}
