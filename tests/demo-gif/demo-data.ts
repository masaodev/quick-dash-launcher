import fs from 'fs';
import path from 'path';

/**
 * README のデモ GIF 用のデータ（5 タブ。メインに約 140 件、ブックマークに 90 件）
 *
 * 「仕事で開くものを全部ここに登録し、案件ごとのタブに整理して、名前の一部で探す」使い方を見せるため、
 * システム開発の案件フォルダ（フォルダ取込で中のファイルを丸ごと読み込む）・ブラウザのブックマーク・
 * アプリを並べる。フォルダとファイルは demoRoot の下に空のものを作り、アイコンが出るようにする
 */

type DemoItem =
  | { type: 'item'; displayName: string; path: string }
  | { type: 'dir'; path: string; options: Record<string, unknown> };

const item = (displayName: string, itemPath: string): DemoItem => ({
  type: 'item',
  displayName,
  path: itemPath,
});

/** 案件 A（基幹システム刷新）のフォルダに作るファイル */
const PROJECT_A_FILES: Record<string, string[]> = {
  '01_提案・見積': [
    '提案書_v2.pptx',
    '見積書_v3.xlsx',
    'WBS.xlsx',
    '体制図.pptx',
    '契約書_ドラフト.docx',
  ],
  '02_要件定義': [
    '要件定義書_v1.3.xlsx',
    '業務フロー_受注.pptx',
    '業務フロー_出荷.pptx',
    '非機能要件一覧.xlsx',
    '用語集.xlsx',
    '現行システム調査報告書.docx',
  ],
  '03_基本設計': [
    '基本設計書_方式設計.docx',
    '基本設計書_画面一覧.xlsx',
    '基本設計書_画面設計_受注.xlsx',
    '基本設計書_画面設計_出荷.xlsx',
    '基本設計書_画面設計_請求.xlsx',
    '基本設計書_帳票設計.xlsx',
    '基本設計書_DB設計.xlsx',
    '基本設計書_IF設計.xlsx',
    '基本設計書_バッチ設計.xlsx',
  ],
  '04_詳細設計': [
    '詳細設計書_受注登録.xlsx',
    '詳細設計書_受注照会.xlsx',
    '詳細設計書_出荷指示.xlsx',
    '詳細設計書_出荷実績.xlsx',
    '詳細設計書_請求締め.xlsx',
    '詳細設計書_請求書発行.xlsx',
    '詳細設計書_マスタ保守.xlsx',
    '詳細設計書_夜間バッチ.xlsx',
    'テーブル定義書.xlsx',
    'コード値一覧.xlsx',
  ],
  '05_テスト': [
    '単体テスト仕様書_受注.xlsx',
    '単体テスト仕様書_出荷.xlsx',
    '単体テスト仕様書_請求.xlsx',
    '結合テスト仕様書.xlsx',
    '総合テスト計画書.docx',
    'テスト結果報告書.xlsx',
    '障害管理表.xlsx',
  ],
  '06_議事録': [
    '2026-08-04_定例.docx',
    '2026-08-11_定例.docx',
    '2026-08-18_定例.docx',
    '2026-08-25_定例.docx',
    '2026-09-01_定例.docx',
    '2026-09-08_定例.docx',
    '2026-09-15_定例.docx',
    '2026-09-22_定例.docx',
    '2026-09-29_定例.docx',
    '2026-09-10_基本設計レビュー.docx',
    '2026-09-24_詳細設計レビュー.docx',
  ],
  '07_移行': ['移行計画書.docx', 'データ移行手順書.xlsx', '切替リハーサル手順.xlsx'],
};

/** 案件 B（EC サイト改修）のフォルダに作るファイル */
const PROJECT_B_FILES: Record<string, string[]> = {
  '01_見積': ['見積書_EC改修.xlsx', 'スケジュール.xlsx'],
  '02_設計': [
    '画面遷移図.pptx',
    '基本設計書_カート.xlsx',
    '基本設計書_決済.xlsx',
    '基本設計書_会員.xlsx',
    'API仕様書.xlsx',
    'DB変更一覧.xlsx',
  ],
  '03_テスト': ['テスト仕様書_カート.xlsx', 'テスト仕様書_決済.xlsx', '負荷テスト結果.xlsx'],
  '04_議事録': [
    '2026-09-02_キックオフ.docx',
    '2026-09-09_定例.docx',
    '2026-09-16_定例.docx',
    '2026-09-23_定例.docx',
    '2026-09-30_定例.docx',
  ],
};

const teams = (name: string, user: string): DemoItem =>
  item(`チャット: ${name}`, `https://teams.microsoft.com/l/chat/0/0?users=${user}@example.com`);

/** メインタブ。普段使うものに加えて、案件・アプリも全部入れる（案件タブ・アプリタブは同じものの絞り込み用） */
function mainItems(root: string): DemoItem[] {
  const all = [...dailyItems(root), ...projectAItems(root), ...projectBItems(root), ...appItems()];
  const seen = new Set<string>();
  return all.filter((it) => {
    const key = it.type === 'dir' ? `dir:${it.path}` : it.displayName;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dailyItems(root: string): DemoItem[] {
  return [
    item('勤怠システム', 'https://www.jobcan.ne.jp/'),
    item('経費精算', 'https://www.rakus.co.jp/rakurakuseisan/'),
    item('社内ポータル', 'https://www.microsoft.com/ja-jp/microsoft-365/sharepoint/collaboration'),
    item('Outlook（Web）', 'https://outlook.office.com/'),
    item('Google カレンダー', 'https://calendar.google.com/'),
    item('Gmail', 'https://mail.google.com/'),
    item('Google ドライブ', 'https://drive.google.com/'),
    item('Slack', 'https://slack.com/'),
    item('Zoom', 'https://zoom.us/'),
    item('翻訳（DeepL）', 'https://www.deepl.com/translator'),
    item('ChatGPT', 'https://chatgpt.com/'),
    item('Claude', 'https://claude.ai/'),
    item('GitHub', 'https://github.com/'),
    item('天気', 'https://weathernews.jp/'),
    item('乗換案内', 'https://transit.yahoo.co.jp/'),
    item('週報フォルダ', path.join(root, '週報')),
    item('週報テンプレート', path.join(root, '週報', '週報テンプレート.docx')),
    item('作業メモ', path.join(root, '作業メモ.txt')),
    item('ダウンロード', 'shell:Downloads'),
    item('デスクトップ', 'shell:Desktop'),
    item('ドキュメント', 'shell:Documents'),
    item('共有ドライブ（全社）', path.join(root, '共有ドライブ')),
    item('A：基幹刷新Prj フォルダ', path.join(root, 'A_基幹システム刷新')),
    item('B：EC改修Prj フォルダ', path.join(root, 'B_ECサイト改修')),
    teams('佐藤さん（上長）', 'sato'),
    teams('総務 鈴木さん', 'suzuki'),
    teams('開発部 全体', 'dev-all'),
    item('Excel', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE'),
    item('Outlook', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE'),
    item('VS Code', '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe'),
    item('メモ帳', 'notepad.exe'),
    item('電卓', 'calc.exe'),
    item('リモートデスクトップ', 'mstsc.exe'),
    item('Windows の設定', 'ms-settings:'),
  ];
}

function projectAItems(root: string): DemoItem[] {
  const dir = path.join(root, 'A_基幹システム刷新');
  return [
    { type: 'dir', path: dir, options: { depth: -1, types: 'file', prefix: '基幹刷新' } },
    item('A：案件フォルダ', dir),
    item('A：議事録フォルダ', path.join(dir, '06_議事録')),
    item('A：課題管理（Backlog）', 'https://backlog.com/ja/'),
    item('A：ソースコード（GitHub）', 'https://github.com/'),
    item('A：Wiki（Confluence）', 'https://www.atlassian.com/ja/software/confluence'),
    item('A：検証環境', 'https://aws.amazon.com/jp/console/'),
    teams('A：基幹刷新Prj チーム', 'kikan-prj'),
    teams('A：田中さん（顧客 PM）', 'tanaka'),
  ];
}

function projectBItems(root: string): DemoItem[] {
  const dir = path.join(root, 'B_ECサイト改修');
  return [
    { type: 'dir', path: dir, options: { depth: -1, types: 'file', prefix: 'EC改修' } },
    item('B：案件フォルダ', dir),
    item('B：課題管理（Redmine）', 'https://www.redmine.org/'),
    item('B：ステージング', 'https://www.shopify.com/jp'),
    item('B：Figma デザイン', 'https://www.figma.com/'),
    teams('B：EC改修Prj チーム', 'ec-prj'),
    teams('B：山本さん（顧客担当）', 'yamamoto'),
  ];
}

function bookmarkItems(): DemoItem[] {
  const sites: [string, string][] = [
    ['MDN Web Docs', 'https://developer.mozilla.org/ja/'],
    ['Stack Overflow', 'https://stackoverflow.com/'],
    ['Qiita', 'https://qiita.com/'],
    ['Zenn', 'https://zenn.dev/'],
    ['はてなブックマーク', 'https://b.hatena.ne.jp/'],
    ['TypeScript ドキュメント', 'https://www.typescriptlang.org/docs/'],
    ['React ドキュメント', 'https://ja.react.dev/'],
    ['Node.js ドキュメント', 'https://nodejs.org/ja'],
    ['Python ドキュメント', 'https://docs.python.org/ja/3/'],
    ['Java API ドキュメント', 'https://docs.oracle.com/javase/jp/21/docs/api/'],
    ['Spring Boot', 'https://spring.io/projects/spring-boot'],
    ['PostgreSQL 文書', 'https://www.postgresql.jp/document/'],
    ['MySQL リファレンス', 'https://dev.mysql.com/doc/'],
    ['Oracle Database', 'https://docs.oracle.com/'],
    ['AWS マネジメントコンソール', 'https://aws.amazon.com/jp/console/'],
    ['Azure ポータル', 'https://portal.azure.com/'],
    ['Google Cloud コンソール', 'https://console.cloud.google.com/'],
    ['Docker Hub', 'https://hub.docker.com/'],
    ['Kubernetes ドキュメント', 'https://kubernetes.io/ja/docs/'],
    ['Terraform', 'https://www.terraform.io/'],
    ['GitHub Actions ドキュメント', 'https://docs.github.com/ja/actions'],
    ['npm', 'https://www.npmjs.com/'],
    ['PyPI', 'https://pypi.org/'],
    ['Maven Central', 'https://central.sonatype.com/'],
    ['正規表現チェッカー（regex101）', 'https://regex101.com/'],
    ['JSON 整形（JSON Formatter）', 'https://jsonformatter.org/'],
    ['Base64 変換', 'https://www.base64decode.org/'],
    ['差分チェック（Diffchecker）', 'https://www.diffchecker.com/'],
    ['UUID 生成', 'https://www.uuidgenerator.net/'],
    ['Cron 式チェック（crontab.guru）', 'https://crontab.guru/'],
    ['Can I use', 'https://caniuse.com/'],
    ['draw.io', 'https://app.diagrams.net/'],
    ['Mermaid Live Editor', 'https://mermaid.live/'],
    ['PlantUML', 'https://plantuml.com/ja/'],
    ['Figma', 'https://www.figma.com/'],
    ['Miro', 'https://miro.com/'],
    ['Notion', 'https://www.notion.so/'],
    ['Backlog', 'https://backlog.com/ja/'],
    ['Jira', 'https://www.atlassian.com/ja/software/jira'],
    ['Confluence', 'https://www.atlassian.com/ja/software/confluence'],
    ['Redmine', 'https://www.redmine.org/'],
    ['SonarCloud', 'https://sonarcloud.io/'],
    ['Sentry', 'https://sentry.io/'],
    ['Datadog', 'https://www.datadoghq.com/ja/'],
    ['Postman', 'https://www.postman.com/'],
    ['Swagger Editor', 'https://editor.swagger.io/'],
    ['IPA（情報処理推進機構）', 'https://www.ipa.go.jp/'],
    ['JVN（脆弱性情報）', 'https://jvn.jp/'],
    ['祝日一覧（内閣府）', 'https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html'],
    ['郵便番号検索', 'https://www.post.japanpost.jp/zipcode/'],
    ['Google 翻訳', 'https://translate.google.com/'],
    ['DeepL', 'https://www.deepl.com/translator'],
    ['Wikipedia', 'https://ja.wikipedia.org/'],
    ['YouTube', 'https://www.youtube.com/'],
    ['Amazon', 'https://www.amazon.co.jp/'],
    ['楽天市場', 'https://www.rakuten.co.jp/'],
    ['ヨドバシ.com', 'https://www.yodobashi.com/'],
    ['価格.com', 'https://kakaku.com/'],
    ['食べログ', 'https://tabelog.com/'],
    ['Yahoo! ニュース', 'https://news.yahoo.co.jp/'],
    ['NHK ニュース', 'https://www3.nhk.or.jp/news/'],
    ['日経電子版', 'https://www.nikkei.com/'],
    ['ITmedia', 'https://www.itmedia.co.jp/'],
    ['Publickey', 'https://www.publickey1.jp/'],
    ['窓の杜', 'https://forest.watch.impress.co.jp/'],
    ['Gigazine', 'https://gigazine.net/'],
    ['Hacker News', 'https://news.ycombinator.com/'],
    ['Product Hunt', 'https://www.producthunt.com/'],
    ['Google マップ', 'https://www.google.co.jp/maps'],
    ['乗換案内', 'https://transit.yahoo.co.jp/'],
    ['Google Analytics', 'https://analytics.google.com/'],
    ['Google Search Console', 'https://search.google.com/search-console'],
    ['Canva', 'https://www.canva.com/'],
    ['Unsplash', 'https://unsplash.com/'],
    ['いらすとや', 'https://www.irasutoya.com/'],
    ['Google Fonts', 'https://fonts.google.com/'],
    ['Font Awesome', 'https://fontawesome.com/'],
    ['Speedtest', 'https://www.speedtest.net/'],
    ['Docker ドキュメント', 'https://docs.docker.com/'],
    ['Git ドキュメント', 'https://git-scm.com/doc'],
    ['Visual Studio Code ドキュメント', 'https://code.visualstudio.com/docs'],
    ['Electron ドキュメント', 'https://www.electronjs.org/ja/docs/latest/'],
    ['Vite', 'https://ja.vite.dev/'],
    ['Playwright', 'https://playwright.dev/'],
    ['Vitest', 'https://vitest.dev/'],
    ['ESLint', 'https://eslint.org/'],
    ['Prettier', 'https://prettier.io/'],
    ['Tailwind CSS', 'https://tailwindcss.com/'],
    ['Next.js', 'https://nextjs.org/'],
    ['Vue.js', 'https://ja.vuejs.org/'],
  ];
  return sites.map(([name, url]) => item(name, url));
}

function appItems(): DemoItem[] {
  const office = 'C:\\Program Files\\Microsoft Office\\root\\Office16\\';
  return [
    item('Excel', `${office}EXCEL.EXE`),
    item('Word', `${office}WINWORD.EXE`),
    item('PowerPoint', `${office}POWERPNT.EXE`),
    item('Outlook', `${office}OUTLOOK.EXE`),
    item('Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'),
    item('Microsoft Edge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'),
    item('Firefox', 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'),
    item('VS Code', '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe'),
    item('Git Bash', 'C:\\Program Files\\Git\\git-bash.exe'),
    item('PowerToys', 'C:\\Program Files\\PowerToys\\PowerToys.exe'),
    item('7-Zip', 'C:\\Program Files\\7-Zip\\7zFM.exe'),
    item('メモ帳', 'notepad.exe'),
    item('電卓', 'calc.exe'),
    item('ペイント', 'mspaint.exe'),
    item('コマンドプロンプト', 'cmd.exe'),
    item('PowerShell', 'powershell.exe'),
    item('エクスプローラー', 'explorer.exe'),
    item('タスクマネージャー', 'taskmgr.exe'),
    item('リモートデスクトップ', 'mstsc.exe'),
    item('コントロールパネル', 'control.exe'),
    item('Windows の設定', 'ms-settings:'),
    item('ワードパッド', 'write.exe'),
    item('文字コード表', 'charmap.exe'),
    item('リソースモニター', 'resmon.exe'),
    item('イベントビューアー', 'eventvwr.msc'),
  ];
}

/** 案件フォルダとファイル（中身は空）を作る */
function createProjectFiles(root: string): void {
  const write = (base: string, tree: Record<string, string[]>): void => {
    for (const [sub, files] of Object.entries(tree)) {
      fs.mkdirSync(path.join(base, sub), { recursive: true });
      for (const f of files) {
        const full = path.join(base, sub, f);
        if (!fs.existsSync(full)) fs.writeFileSync(full, '');
      }
    }
  };
  write(path.join(root, 'A_基幹システム刷新'), PROJECT_A_FILES);
  write(path.join(root, 'B_ECサイト改修'), PROJECT_B_FILES);
  fs.mkdirSync(path.join(root, '週報'), { recursive: true });
  fs.mkdirSync(path.join(root, '共有ドライブ'), { recursive: true });
  for (const f of ['週報/週報テンプレート.docx', '作業メモ.txt']) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) fs.writeFileSync(full, '');
  }
}

/**
 * demoRoot にデモ用のフォルダとファイルを作り、configDir の datafiles にデータを書く。メインタブの候補数を返す
 *
 * タブの割り当ては tests/e2e/templates/demo/settings.json（data.json＝メイン、data2＝A、data3＝B、
 * data4＝ブックマーク、data5＝アプリ）
 */
export function writeDemoData(configDir: string, demoRoot: string): number {
  createProjectFiles(demoRoot);
  const files: [string, DemoItem[]][] = [
    ['data.json', mainItems(demoRoot)],
    ['data2.json', projectAItems(demoRoot)],
    ['data3.json', projectBItems(demoRoot)],
    ['data4.json', bookmarkItems()],
    ['data5.json', appItems()],
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
  // メインタブの候補数（フォルダ取込は中のファイルが 1 件ずつ候補になる）
  const countFiles = (tree: Record<string, string[]>): number =>
    Object.values(tree).reduce((sum, list) => sum + list.length, 0);
  const main = files[0][1];
  const dirCount = main.filter((it) => it.type === 'dir').length;
  return main.length - dirCount + countFiles(PROJECT_A_FILES) + countFiles(PROJECT_B_FILES);
}
