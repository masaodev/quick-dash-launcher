import fs from 'fs';
import path from 'path';

import { enContent } from './demo-content-en';
import { jaContent } from './demo-content-ja';

/**
 * README のデモ GIF・画面イメージ用のデータ（4 タブ。メインに約 80 件、案件のタブに 35〜50 件、ブックマークに 180〜220 件）
 *
 * 「仕事で開くものを全部ここに登録し、案件ごとのタブに整理して、名前の一部で探す」使い方を見せるため、
 * システム開発の案件フォルダ（フォルダ取込で中のファイルを丸ごと読み込む）・ブラウザのブックマーク・
 * アプリを並べる。フォルダとファイルは demoRoot の下に空のものを作り、アイコンが出るようにする。
 * 中身は言語ごとに demo-content-ja.ts（日本語の README 用）・demo-content-en.ts（英語の README 用）に書く。
 * 撮る言語は環境変数 DEMO_LANG（ja・en。既定は ja）で選ぶ
 */

export type DemoLang = 'ja' | 'en';

export type DemoItem =
  | { type: 'item'; displayName: string; path: string }
  | { type: 'dir'; path: string; options: Record<string, unknown> };

/** 1 つの言語のデモデータと、撮影で打つ言葉 */
export interface DemoContent {
  /** タブの名前（data.json〜data4.json の順） */
  tabs: string[];
  /** データファイルの名前（data.json〜data4.json の順。管理ウィンドウに出る） */
  dataFileLabels: string[];
  /** demoRoot の下に作る空のファイル（demoRoot からの相対パス。親のフォルダも作る） */
  files: string[];
  /** demoRoot の下に作る空のフォルダ */
  dirs: string[];
  /** タブごとのアイテム。メインタブは daily・案件の Teams・apps を重複を除いて並べる */
  parts: (root: string) => {
    daily: DemoItem[];
    projectA: DemoItem[];
    projectB: DemoItem[];
    bookmarks: DemoItem[];
    apps: DemoItem[];
  };
  /** メインデモ GIF で打つ言葉と、画面下の説明文（DEMO_CAPTIONS=1 のときだけ出す） */
  demo: {
    /** 最初の場面で打つ言葉（README の検索の例と同じ。quick で並び、quickRefine を足すと 1 件に絞れる） */
    quick: string;
    quickRefine: string;
    /** 種類の名前で並べ、↓ を listDown 回押して選ぶ（探して選ぶ場面） */
    list: string;
    listDown: number;
    /** 呼び名だけで 1 件に決まる（list で選んだのと同じものを、付けた呼び名で） */
    call: string;
    /** 案件のタブ（2 つ目のタブ）に Tab で移ってから、日付を打って議事録を出す */
    minutes: string;
    /** メインに無く、ブックマークにだけある（メインで 0 件になり、Tab で見に行く） */
    otherTab: string;
    captions: Record<'intro' | 'quick' | 'list' | 'call' | 'tabs' | 'minutes' | 'otherTab', string>;
  };
  /** ワークスペースのデモ GIF（アイテムは parts の displayName で指す） */
  workspace: {
    /** 最初から入れておくグループ（color は色トークン） */
    groups: { name: string; color: string; items: string[] }[];
    /** ランチャーで打ち、先頭の候補をワークスペースへドラッグする言葉 */
    search: string;
    /** ドラッグで入れる先で、後で切り離すグループ（groups の添字） */
    targetGroup: number;
  };
  /** README の画面イメージで入力するもの */
  shots: {
    /** 登録画面（フォルダ取込）。folder は demoRoot からの相対パス */
    dir: { tab: string; folder: string; filter: string; exclude: string; prefix: string };
    /** 登録画面（1 件） */
    item: { tab: string; name: string; url: string };
    /** 管理ウィンドウで開くタブ */
    adminTab: string;
  };
}

/** 環境変数 DEMO_LANG から撮る言語を決める */
export function demoLang(): DemoLang {
  return process.env.DEMO_LANG === 'en' ? 'en' : 'ja';
}

export function demoContent(lang: DemoLang): DemoContent {
  return lang === 'en' ? enContent : jaContent;
}

/** メインタブ。普段使うもの・案件の Teams のチャット・アプリを入れる（案件の資料は案件のタブにだけ置く。アプリタブは同じものの絞り込み用） */
function mainItems(parts: ReturnType<DemoContent['parts']>): DemoItem[] {
  const isChat = (it: DemoItem) => it.type === 'item' && it.path.includes('teams.microsoft.com');
  const all = [
    ...parts.daily,
    ...parts.projectA.filter(isChat),
    ...parts.projectB.filter(isChat),
    ...parts.apps,
  ];
  const seen = new Set<string>();
  return all.filter((it) => {
    const key = it.type === 'dir' ? `dir:${it.path}` : it.displayName;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * demoRoot にデモ用のフォルダとファイルを作り、configDir にデータとタブの名前・表示言語を書く
 *
 * タブの割り当ては tests/e2e/templates/demo/settings.json（data.json＝メイン、data2＝A、data3＝B、
 * data4＝ブックマーク）。アプリはメインにだけ入れ、タブは作らない。タブの名前と表示言語はここで上書きする
 */
export function writeDemoData(configDir: string, demoRoot: string, lang: DemoLang): void {
  const content = demoContent(lang);
  for (const file of content.files) {
    const full = path.join(demoRoot, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (!fs.existsSync(full)) fs.writeFileSync(full, '');
  }
  for (const dir of content.dirs) fs.mkdirSync(path.join(demoRoot, dir), { recursive: true });

  const parts = content.parts(demoRoot);
  const main = mainItems(parts);
  const files: [string, DemoItem[]][] = [
    ['data.json', main],
    ['data2.json', parts.projectA],
    ['data3.json', parts.projectB],
    ['data4.json', parts.bookmarks],
  ];
  const dataDir = path.join(configDir, 'datafiles');
  fs.mkdirSync(dataDir, { recursive: true });
  files.forEach(([name, items], fileIndex) => {
    const withIds = items.map((it, i) => ({
      id: `demo${fileIndex + 1}${String(i + 1).padStart(3, '0')}`,
      ...it,
    }));
    fs.writeFileSync(
      path.join(dataDir, name),
      JSON.stringify({ version: '1.0', items: withIds }, null, 2) + '\n'
    );
  });

  const settingsPath = path.join(configDir, 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  settings.language = lang;
  settings.dataFileTabs = files.map(([name], i) => ({
    files: [`datafiles/${name}`],
    name: content.tabs[i],
  }));
  settings.dataFileLabels = Object.fromEntries(
    files.map(([name], i) => [`datafiles/${name}`, content.dataFileLabels[i]])
  );
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * configDir の workspace.json を、ワークスペースのデモ GIF 用（content.workspace.groups）に書き換える
 *
 * ワークスペースは 1 つ（名前はメインタブと同じ）。アイテムはデモデータの同じ名前のアイテムのコピーで入れる
 */
export function writeDemoWorkspace(configDir: string, demoRoot: string, lang: DemoLang): void {
  const content = demoContent(lang);
  const parts = content.parts(demoRoot);
  const all = [...parts.daily, ...parts.projectA, ...parts.projectB];
  const createdAt = 1759449600000;
  const workspaceId = 'WsDemo01';
  const items = content.workspace.groups.flatMap((group, g) =>
    group.items.map((name, i) => {
      const found = all.find((it) => it.type === 'item' && it.displayName === name);
      if (!found || found.type !== 'item') throw new Error(`デモデータに「${name}」がありません`);
      return {
        id: `ItDemo${g}${i}`,
        type: 'item',
        displayName: found.displayName,
        path: found.path,
        workspaceId,
        groupId: `GrDemo0${g}`,
        order: i,
        addedAt: createdAt,
      };
    })
  );
  const workspace = {
    version: '2.0',
    workspaces: [{ id: workspaceId, displayName: content.tabs[0], order: 0, createdAt }],
    groups: content.workspace.groups.map((group, g) => ({
      id: `GrDemo0${g}`,
      displayName: group.name,
      color: group.color,
      order: g,
      createdAt,
      workspaceId,
    })),
    items,
  };
  fs.writeFileSync(
    path.join(configDir, 'workspace.json'),
    JSON.stringify(workspace, null, 2) + '\n'
  );
}
