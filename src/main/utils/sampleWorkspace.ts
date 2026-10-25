import { generateId } from '@common/utils/jsonParser';
import type {
  JsonWorkspaceClipboardItem,
  JsonWorkspaceFile,
  JsonWorkspaceGroup,
  JsonWorkspaceItem,
} from '@common/types';
import { JSON_WORKSPACE_VERSION } from '@common/types';

/** お試しの参照が指すメインウィンドウのアイテム */
export interface SampleRefTarget {
  /** データファイルのアイテムの id */
  id: string;
  /** メインウィンドウでの表示名 */
  mainDisplayName: string;
  /** ワークスペースでの表示名（メインウィンドウと同じなら付けない） */
  workspaceName: string;
}

/** お試しのワークスペースの文言（作るときの表示言語で決める） */
export interface SampleWorkspaceTexts {
  workspaceName: string;
  favoritesGroup: string;
  moreGroup: string;
  setName: string;
  setMemo: string;
  calculator: { path: string; label: string };
  notepad: { path: string; label: string };
  templateName: string;
  templateMemo: string;
  guide: { name: string; url: string; memo: string };
}

/** 定型文の保存データ（clipboard-data/{id}.json）を書いたあとの、アイテムに載せる分 */
export type SampleTemplateData = Pick<
  JsonWorkspaceClipboardItem,
  'dataFileRef' | 'savedAt' | 'preview' | 'formats'
>;

/**
 * 初回起動のお試しのワークスペースを組み立てる。
 * 「よく使う」にメインウィンドウのお試しを指す参照を、「便利な使い方」にワークスペースだけのアイテム
 * （セット・定型文・使い方）を入れる。定型文の保存データが無いときは定型文を外す
 */
export function buildSampleWorkspaceFile(
  refs: SampleRefTarget[],
  template: SampleTemplateData | null,
  texts: SampleWorkspaceTexts,
  now: number = Date.now()
): JsonWorkspaceFile {
  const workspaceId = generateId();
  const group = (displayName: string, color: string, order: number): JsonWorkspaceGroup => ({
    id: generateId(),
    displayName,
    color,
    order,
    createdAt: now,
    workspaceId,
  });
  const favorites = group(texts.favoritesGroup, 'primary', 0);
  const more = group(texts.moreGroup, 'teal', 1);
  const base = (groupId: string, order: number) => ({
    id: generateId(),
    workspaceId,
    groupId,
    order,
    addedAt: now,
  });

  const items: JsonWorkspaceItem[] = refs.map((ref, index) => ({
    ...base(favorites.id, index),
    type: 'ref',
    refItemId: ref.id,
    // メインウィンドウと同じ名前は、ワークスペースでの表示名にしない（付けるとメインの改名に追随しない）
    ...(ref.workspaceName !== ref.mainDisplayName ? { displayName: ref.workspaceName } : {}),
    lastKnownName: ref.mainDisplayName,
  }));

  const moreItems: JsonWorkspaceItem[] = [
    {
      ...base(more.id, 0),
      type: 'set',
      displayName: texts.setName,
      memo: texts.setMemo,
      entries: [
        { open: { path: texts.calculator.path }, label: texts.calculator.label },
        { open: { path: texts.notepad.path }, label: texts.notepad.label },
      ],
    },
  ];
  if (template) {
    moreItems.push({
      ...base(more.id, 0),
      type: 'clipboard',
      displayName: texts.templateName,
      memo: texts.templateMemo,
      ...template,
    });
  }
  moreItems.push({
    ...base(more.id, 0),
    type: 'item',
    displayName: texts.guide.name,
    memo: texts.guide.memo,
    path: texts.guide.url,
  });
  moreItems.forEach((item, index) => (item.order = index));

  return {
    version: JSON_WORKSPACE_VERSION,
    workspaces: [{ id: workspaceId, displayName: texts.workspaceName, order: 0, createdAt: now }],
    groups: [favorites, more],
    items: [...items, ...moreItems],
  };
}
