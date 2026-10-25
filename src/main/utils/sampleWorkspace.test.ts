import { describe, expect, it } from 'vitest';
import { parseWorkspaceFileLenient, serializeWorkspaceFile } from '@common/utils/workspaceParser';

import { buildSampleWorkspaceFile } from './sampleWorkspace';
import type { SampleRefTarget, SampleWorkspaceTexts } from './sampleWorkspace';

const texts: SampleWorkspaceTexts = {
  workspaceName: '既定',
  favoritesGroup: 'よく使う',
  moreGroup: '便利な使い方',
  setName: 'セット: 電卓とメモ帳',
  setMemo: 'セットのメモ',
  calculator: { path: 'calc.exe', label: '電卓' },
  notepad: { path: 'notepad.exe', label: 'メモ帳' },
  templateName: '定型文: メールテンプレート',
  templateMemo: '定型文のメモ',
  guide: { name: '📖 ワークスペースの使い方', url: 'https://example.com/', memo: '使い方のメモ' },
};

const refs: SampleRefTarget[] = [
  { id: 'Dt1Ab2Cd', mainDisplayName: '電卓（dentaku）', workspaceName: '電卓' },
  { id: 'Dt2Ab2Cd', mainDisplayName: 'Weather', workspaceName: 'Weather' },
];

const template = {
  dataFileRef: 'clipboard-data/Cb1Ab2Cd.json',
  savedAt: 1,
  preview: '〇〇様',
  formats: ['text' as const],
};

describe('buildSampleWorkspaceFile', () => {
  it('「よく使う」に参照、「便利な使い方」にセット・定型文・使い方を入れる', () => {
    const file = buildSampleWorkspaceFile(refs, template, texts, 100);

    expect(file.workspaces).toHaveLength(1);
    expect(file.groups.map((g) => [g.displayName, g.color, g.order])).toEqual([
      ['よく使う', 'primary', 0],
      ['便利な使い方', 'teal', 1],
    ]);
    const [favorites, more] = file.groups;
    const inGroup = (groupId: string) =>
      file.items.filter((item) => item.groupId === groupId).sort((a, b) => a.order - b.order);
    expect(inGroup(favorites.id).map((item) => item.type)).toEqual(['ref', 'ref']);
    expect(inGroup(more.id).map((item) => [item.type, item.displayName, item.order])).toEqual([
      ['set', 'セット: 電卓とメモ帳', 0],
      ['clipboard', '定型文: メールテンプレート', 1],
      ['item', '📖 ワークスペースの使い方', 2],
    ]);
  });

  it('参照は、メインウィンドウと違う名前のときだけワークスペースでの表示名を付ける', () => {
    const file = buildSampleWorkspaceFile(refs, template, texts);
    const [calc, weather] = file.items.filter((item) => item.type === 'ref');

    expect(calc).toMatchObject({
      refItemId: 'Dt1Ab2Cd',
      displayName: '電卓',
      lastKnownName: '電卓（dentaku）',
    });
    expect(weather).toMatchObject({ refItemId: 'Dt2Ab2Cd', lastKnownName: 'Weather' });
    expect(weather).not.toHaveProperty('displayName');
  });

  it('セットは電卓とメモ帳をパスで開く行を持つ', () => {
    const file = buildSampleWorkspaceFile(refs, template, texts);
    const set = file.items.find((item) => item.type === 'set');

    expect(set).toMatchObject({
      memo: 'セットのメモ',
      entries: [
        { open: { path: 'calc.exe' }, label: '電卓' },
        { open: { path: 'notepad.exe' }, label: 'メモ帳' },
      ],
    });
  });

  it('定型文の保存データが無いときは定型文を外し、並び順を詰める', () => {
    const file = buildSampleWorkspaceFile(refs, null, texts);
    const more = file.groups[1];

    expect(
      file.items.filter((item) => item.groupId === more.id).map((item) => [item.type, item.order])
    ).toEqual([
      ['set', 0],
      ['item', 1],
    ]);
  });

  it('書き出したファイルは、読み込みで直すところが無い', () => {
    const content = serializeWorkspaceFile(buildSampleWorkspaceFile(refs, template, texts));
    const parsed = parseWorkspaceFileLenient(content);

    expect(parsed.issues).toEqual([]);
    expect(parsed.invalid.items).toEqual([]);
    expect(parsed.data.items).toHaveLength(5);
    expect(parsed.data.groups).toHaveLength(2);
  });
});
