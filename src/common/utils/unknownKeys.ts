/**
 * 新しい版の QDL が足した「知らない項目」を、書き戻しで消さないための処理
 *
 * 読み込みの検証（validateJson*Item・ワークスペースの寛容パース）は知っている項目だけを拾うので、
 * そのまま書き戻すと、新しい版で足した項目が古い版の 1 回の保存で消える。
 * そこで書き込む直前に、ディスク上の今の内容から「同じ id の要素が持っていた知らない項目」を
 * 書く内容に付け直す（src/main/services/dataFileTracker.ts の prepareDataFileContent）。
 *
 * - 対象は、ファイル直下・アイテム・グループ・ワークスペース（タブ）の直下の項目。
 *   options・window・entries[] のような入れ子の中は対象外（入れ子に項目を足すときは形式の版を上げる）
 * - 知っている項目は付け直さない（消した・空にした値を戻さないため）。
 *   廃止した項目も一覧に残す（旧形式からの変換で消した項目が戻らないように）
 * - 書く側に同じ項目があれば、書く側を優先する
 */

import type {
  JsonClipboardItem,
  JsonDataFile,
  JsonDirItem,
  JsonGroupItem,
  JsonLauncherItem,
  JsonLayoutItem,
  JsonSetItem,
} from '@common/types';
import type {
  JsonArchivedWorkspaceGroup,
  JsonArchivedWorkspaceItem,
  JsonWorkspace,
  JsonWorkspaceArchiveFile,
  JsonWorkspaceFile,
} from '@common/types/json-workspace';
import { isRecord } from '@common/types/guards';

/** どの種類のファイルか（知っている項目の一覧が違う） */
export type FileFormatKind = 'data' | 'workspace';

/** 廃止したウィンドウ操作（type: 'window'）だけが持っていた項目（読み込み時にパスの無い単一アイテムへ変換する） */
const LEGACY_WINDOW_ITEM_KEYS = [
  'windowTitle',
  'processName',
  'x',
  'y',
  'width',
  'height',
  'virtualDesktopNumber',
  'moveToActiveMonitorCenter',
] as const;

/** データファイルのアイテムの、知っている項目（全種別と旧形式の合併） */
const DATA_ITEM_KEYS = [
  'id',
  'type',
  'displayName',
  'memo',
  'updatedAt',
  // 単一アイテム
  'path',
  'args',
  'customIcon',
  'runAsAdmin',
  'autoImportRuleId',
  'window',
  'placement',
  'ifOpen',
  'activateWindow',
  'waitSeconds',
  'pinToAllDesktops',
  // フォルダ取込
  'options',
  // クリップボード
  'dataFileRef',
  'savedAt',
  'preview',
  'formats',
  // セット（旧ウィンドウ配置も entries）
  'entries',
  'launchMode',
  // 旧形式（読み込み時に変換する）
  'itemNames',
  'windowConfig',
  ...LEGACY_WINDOW_ITEM_KEYS,
] as const;

const DATA_FILE_KEYS = ['$schema', 'version', 'items'] as const;

/** ワークスペースのアイテムの、知っている項目（データファイルの語彙＋所属・並び順・参照・アーカイブ） */
const WORKSPACE_ITEM_KEYS = [
  ...DATA_ITEM_KEYS,
  'originalPath',
  'workspaceId',
  'groupId',
  'order',
  'addedAt',
  'archivedAt',
  'archivedGroupId',
  'refItemId',
  'lastKnownName',
  // 実行時にだけ持つ項目（ファイルには書かないが、念のため戻さない）
  'launcherType',
  'icon',
] as const;

const WORKSPACE_GROUP_KEYS = [
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
  // 旧形式（v1。2.0 への移行で変換する）
  'name',
  'collapsed',
] as const;

const WORKSPACE_KEYS = ['id', 'displayName', 'order', 'createdAt', 'name'] as const;

const WORKSPACE_FILE_KEYS = ['$schema', 'version', 'workspaces', 'groups', 'items'] as const;

// 型に項目を足したら、上の一覧にも足す（足し忘れると、消した値が次の保存で戻る）
type KeysOfUnion<T> = T extends unknown ? keyof T : never;
type AssertCovered<Keys, Listed extends readonly string[]> =
  Exclude<Keys, Listed[number]> extends never ? true : Exclude<Keys, Listed[number]>;
const dataItemKeysCovered: AssertCovered<
  KeysOfUnion<
    | JsonLauncherItem
    | JsonDirItem
    | JsonClipboardItem
    | JsonSetItem
    | JsonGroupItem
    | JsonLayoutItem
  >,
  typeof DATA_ITEM_KEYS
> = true;
const dataFileKeysCovered: AssertCovered<keyof JsonDataFile, typeof DATA_FILE_KEYS> = true;
const workspaceItemKeysCovered: AssertCovered<
  KeysOfUnion<JsonArchivedWorkspaceItem>,
  typeof WORKSPACE_ITEM_KEYS
> = true;
const workspaceGroupKeysCovered: AssertCovered<
  keyof JsonArchivedWorkspaceGroup,
  typeof WORKSPACE_GROUP_KEYS
> = true;
const workspaceKeysCovered: AssertCovered<keyof JsonWorkspace, typeof WORKSPACE_KEYS> = true;
const workspaceFileKeysCovered: AssertCovered<
  keyof JsonWorkspaceFile | keyof JsonWorkspaceArchiveFile,
  typeof WORKSPACE_FILE_KEYS
> = true;
void [
  dataItemKeysCovered,
  dataFileKeysCovered,
  workspaceItemKeysCovered,
  workspaceGroupKeysCovered,
  workspaceKeysCovered,
  workspaceFileKeysCovered,
];

interface FormatKeys {
  file: ReadonlySet<string>;
  /** 配列の名前 → その要素の知っている項目 */
  sections: Record<string, ReadonlySet<string>>;
}

const FORMAT_KEYS: Record<FileFormatKind, FormatKeys> = {
  data: {
    file: new Set(DATA_FILE_KEYS),
    sections: { items: new Set(DATA_ITEM_KEYS) },
  },
  workspace: {
    file: new Set(WORKSPACE_FILE_KEYS),
    sections: {
      workspaces: new Set(WORKSPACE_KEYS),
      groups: new Set(WORKSPACE_GROUP_KEYS),
      items: new Set(WORKSPACE_ITEM_KEYS),
    },
  },
};

/** 付け直す元（ディスク上の今の内容を JSON.parse したもの） */
export interface UnknownKeySources {
  /** 書く先のファイルの今の内容。ファイル直下の知らない項目はここからだけ取る */
  target: unknown;
  /**
   * 要素が移ってくるかもしれないほかのファイル（データファイル同士、workspace.json と workspace-archive.json）。
   * 同じ id が書く先にもあれば、書く先を優先する
   */
  others?: readonly unknown[];
}

function unknownEntries(
  source: Record<string, unknown>,
  known: ReadonlySet<string>
): [string, unknown][] {
  return Object.entries(source).filter(([key]) => !known.has(key));
}

/** 配列の名前ごとに、id → 知らない項目 */
function collectSectionExtras(
  kind: FileFormatKind,
  files: readonly unknown[]
): Map<string, Map<string, [string, unknown][]>> {
  const result = new Map<string, Map<string, [string, unknown][]>>();
  for (const [section, known] of Object.entries(FORMAT_KEYS[kind].sections)) {
    const byId = new Map<string, [string, unknown][]>();
    for (const file of files) {
      if (!isRecord(file) || !Array.isArray(file[section])) continue;
      for (const element of file[section] as unknown[]) {
        if (!isRecord(element) || typeof element.id !== 'string') continue;
        // 同じ id が重なったら先に見たもの（書く先のファイル・配列の前の方）を使う
        if (byId.has(element.id)) continue;
        const extras = unknownEntries(element, known);
        if (extras.length > 0) byId.set(element.id, extras);
      }
    }
    result.set(section, byId);
  }
  return result;
}

function addMissing(target: Record<string, unknown>, extras: [string, unknown][]): boolean {
  let added = false;
  for (const [key, value] of extras) {
    if (Object.prototype.hasOwnProperty.call(target, key)) continue;
    target[key] = value;
    added = true;
  }
  return added;
}

/**
 * 書く内容に、ディスク上の今の内容が持っていた知らない項目を付け直す
 *
 * next はその場で書き換える（知らない項目は要素の最後に並ぶ）。
 *
 * @param kind - ファイルの種類
 * @param next - これから書く内容（JSON.parse したもの）
 * @param sources - 付け直す元
 * @returns 1 つでも付け直したら true
 */
export function restoreUnknownKeys(
  kind: FileFormatKind,
  next: unknown,
  sources: UnknownKeySources
): boolean {
  if (!isRecord(next)) return false;
  const keys = FORMAT_KEYS[kind];
  let restored = false;

  if (isRecord(sources.target)) {
    restored = addMissing(next, unknownEntries(sources.target, keys.file)) || restored;
  }

  const extrasBySection = collectSectionExtras(kind, [sources.target, ...(sources.others ?? [])]);
  for (const [section, byId] of extrasBySection) {
    if (byId.size === 0 || !Array.isArray(next[section])) continue;
    for (const element of next[section] as unknown[]) {
      if (!isRecord(element) || typeof element.id !== 'string') continue;
      const extras = byId.get(element.id);
      if (extras) restored = addMissing(element, extras) || restored;
    }
  }
  return restored;
}
