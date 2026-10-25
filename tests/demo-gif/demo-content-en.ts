import path from 'path';

import type { DemoContent, DemoItem } from './demo-data';

/**
 * デモデータの英語版（英語の README の GIF・画面イメージ用）
 *
 * 日本語版（demo-content-ja.ts）と同じ組み立てで、名前を英語にし、日本向けのサイトを海外でも
 * 通じるものに置き換えた。書き出しは demo-data.ts
 */

const item = (displayName: string, itemPath: string): DemoItem => ({
  type: 'item',
  displayName,
  path: itemPath,
});

const PROJECT_A_DIR = 'A_ERP Migration';
const PROJECT_B_DIR = 'B_Online Store Revamp';

/** 案件 A（ERP の移行）のフォルダに作るファイル */
const PROJECT_A_FILES: Record<string, string[]> = {
  '01_Proposal': [
    'Proposal_v2.pptx',
    'Estimate_v3.xlsx',
    'WBS.xlsx',
    'Team structure.pptx',
    'Contract_draft.docx',
  ],
  '02_Requirements': [
    'Requirements_v1.3.xlsx',
    'Business flow_Orders.pptx',
    'Business flow_Shipping.pptx',
    'Non-functional requirements.xlsx',
    'Glossary.xlsx',
    'Current system survey.docx',
  ],
  '03_Basic design': [
    'Basic design_Architecture.docx',
    'Basic design_Screen list.xlsx',
    'Basic design_Screens_Orders.xlsx',
    'Basic design_Screens_Shipping.xlsx',
    'Basic design_Screens_Billing.xlsx',
    'Basic design_Reports.xlsx',
    'Basic design_Database.xlsx',
    'Basic design_Interfaces.xlsx',
    'Basic design_Batch jobs.xlsx',
  ],
  '04_Detailed design': [
    'Detailed design_Order entry.xlsx',
    'Detailed design_Order inquiry.xlsx',
    'Detailed design_Shipping orders.xlsx',
    'Detailed design_Shipping results.xlsx',
    'Detailed design_Billing close.xlsx',
    'Detailed design_Invoices.xlsx',
    'Detailed design_Master data.xlsx',
    'Detailed design_Nightly batch.xlsx',
    'Table definitions.xlsx',
    'Code values.xlsx',
  ],
  '05_Testing': [
    'Unit test spec_Orders.xlsx',
    'Unit test spec_Shipping.xlsx',
    'Unit test spec_Billing.xlsx',
    'Integration test spec.xlsx',
    'System test plan.docx',
    'Test report.xlsx',
    'Defect log.xlsx',
  ],
  '06_Minutes': [
    '2026-08-04_Weekly meeting.docx',
    '2026-08-11_Weekly meeting.docx',
    '2026-08-18_Weekly meeting.docx',
    '2026-08-25_Weekly meeting.docx',
    '2026-09-01_Weekly meeting.docx',
    '2026-09-08_Weekly meeting.docx',
    '2026-09-15_Weekly meeting.docx',
    '2026-09-22_Weekly meeting.docx',
    '2026-09-29_Weekly meeting.docx',
    '2026-09-10_Basic design review.docx',
    '2026-09-24_Detailed design review.docx',
  ],
  '07_Migration': ['Migration plan.docx', 'Data migration steps.xlsx', 'Cutover rehearsal.xlsx'],
};

/** 案件 B（オンラインストアの改修）のフォルダに作るファイル */
const PROJECT_B_FILES: Record<string, string[]> = {
  '01_Estimate': ['Estimate_Store revamp.xlsx', 'Schedule.xlsx'],
  '02_Design': [
    'Screen flow.pptx',
    'Basic design_Cart.xlsx',
    'Basic design_Checkout.xlsx',
    'Basic design_Accounts.xlsx',
    'API spec.xlsx',
    'Database changes.xlsx',
  ],
  '03_Testing': ['Test spec_Cart.xlsx', 'Test spec_Checkout.xlsx', 'Load test results.xlsx'],
  '04_Minutes': [
    '2026-09-02_Kickoff.docx',
    '2026-09-09_Weekly meeting.docx',
    '2026-09-16_Weekly meeting.docx',
    '2026-09-23_Weekly meeting.docx',
    '2026-09-30_Weekly meeting.docx',
  ],
};

const teams = (name: string, user: string): DemoItem =>
  item(`Chat: ${name}`, `https://teams.microsoft.com/l/chat/0/0?users=${user}@example.com`);

function dailyItems(root: string): DemoItem[] {
  return [
    item('Timesheet', 'https://www.workday.com/'),
    item('Expenses', 'https://www.expensify.com/'),
    item('Intranet', 'https://www.microsoft.com/en-us/microsoft-365/sharepoint/collaboration'),
    item('Outlook (web)', 'https://outlook.office.com/'),
    item('Google Calendar', 'https://calendar.google.com/'),
    item('Gmail', 'https://mail.google.com/'),
    item('Google Drive', 'https://drive.google.com/'),
    item('Slack', 'https://slack.com/'),
    item('Zoom', 'https://zoom.us/'),
    item('DeepL Translator', 'https://www.deepl.com/translator'),
    item('ChatGPT', 'https://chatgpt.com/'),
    item('Claude', 'https://claude.ai/'),
    item('GitHub', 'https://github.com/'),
    item('Weather', 'https://weather.com/'),
    item('Google Maps', 'https://www.google.com/maps'),
    item('Weekly reports folder', path.join(root, 'Weekly reports')),
    item(
      'Weekly report template',
      path.join(root, 'Weekly reports', 'Weekly report template.docx')
    ),
    item('Work notes', path.join(root, 'Work notes.txt')),
    item('Downloads', 'shell:Downloads'),
    item('Desktop', 'shell:Desktop'),
    item('Documents', 'shell:Documents'),
    item('Shared drive (company)', path.join(root, 'Shared drive')),
    item('A: ERP Migration folder', path.join(root, PROJECT_A_DIR)),
    item('B: Store Revamp folder', path.join(root, PROJECT_B_DIR)),
    teams('Alex (manager)', 'alex'),
    teams('Jordan (HR)', 'jordan'),
    teams('Dev team', 'dev-all'),
    item('Excel', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE'),
    item('Outlook', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE'),
    item('VS Code', '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe'),
    item('Notepad', 'notepad.exe'),
    item('Calculator', 'calc.exe'),
    item('Remote Desktop', 'mstsc.exe'),
    item('Windows Settings', 'ms-settings:'),
  ];
}

function projectAItems(root: string): DemoItem[] {
  const dir = path.join(root, PROJECT_A_DIR);
  return [
    { type: 'dir', path: dir, options: { depth: -1, types: 'file', prefix: 'ERP' } },
    item('A: Project folder', dir),
    item('A: Minutes folder', path.join(dir, '06_Minutes')),
    item('A: Issues (Jira)', 'https://www.atlassian.com/software/jira'),
    item('A: Source code (GitHub)', 'https://github.com/'),
    item('A: Wiki (Confluence)', 'https://www.atlassian.com/software/confluence'),
    item('A: Test environment', 'https://aws.amazon.com/console/'),
    teams('A: ERP Migration team', 'erp-prj'),
    teams('A: Taylor (client PM)', 'taylor'),
  ];
}

function projectBItems(root: string): DemoItem[] {
  const dir = path.join(root, PROJECT_B_DIR);
  return [
    { type: 'dir', path: dir, options: { depth: -1, types: 'file', prefix: 'Store' } },
    item('B: Project folder', dir),
    item('B: Issues (Redmine)', 'https://www.redmine.org/'),
    item('B: Staging', 'https://www.shopify.com/'),
    item('B: Figma designs', 'https://www.figma.com/'),
    teams('B: Store Revamp team', 'store-prj'),
    teams('B: Morgan (client contact)', 'morgan'),
  ];
}

function bookmarkItems(): DemoItem[] {
  const sites: [string, string][] = [
    ['MDN Web Docs', 'https://developer.mozilla.org/'],
    ['Stack Overflow', 'https://stackoverflow.com/'],
    ['DEV Community', 'https://dev.to/'],
    ['Medium', 'https://medium.com/'],
    ['TypeScript docs', 'https://www.typescriptlang.org/docs/'],
    ['React docs', 'https://react.dev/'],
    ['Node.js docs', 'https://nodejs.org/en/docs'],
    ['Python docs', 'https://docs.python.org/3/'],
    ['Java API docs', 'https://docs.oracle.com/en/java/javase/21/docs/api/'],
    ['Spring Boot', 'https://spring.io/projects/spring-boot'],
    ['PostgreSQL docs', 'https://www.postgresql.org/docs/'],
    ['MySQL reference', 'https://dev.mysql.com/doc/'],
    ['Oracle Database', 'https://docs.oracle.com/'],
    ['AWS Management Console', 'https://aws.amazon.com/console/'],
    ['Azure portal', 'https://portal.azure.com/'],
    ['Google Cloud console', 'https://console.cloud.google.com/'],
    ['Docker Hub', 'https://hub.docker.com/'],
    ['Kubernetes docs', 'https://kubernetes.io/docs/'],
    ['Terraform', 'https://www.terraform.io/'],
    ['GitHub Actions docs', 'https://docs.github.com/actions'],
    ['npm', 'https://www.npmjs.com/'],
    ['PyPI', 'https://pypi.org/'],
    ['Maven Central', 'https://central.sonatype.com/'],
    ['regex101', 'https://regex101.com/'],
    ['JSON Formatter', 'https://jsonformatter.org/'],
    ['Base64 decode', 'https://www.base64decode.org/'],
    ['Diffchecker', 'https://www.diffchecker.com/'],
    ['UUID generator', 'https://www.uuidgenerator.net/'],
    ['crontab.guru', 'https://crontab.guru/'],
    ['Can I use', 'https://caniuse.com/'],
    ['draw.io', 'https://app.diagrams.net/'],
    ['Mermaid Live Editor', 'https://mermaid.live/'],
    ['PlantUML', 'https://plantuml.com/'],
    ['Figma', 'https://www.figma.com/'],
    ['Miro', 'https://miro.com/'],
    ['Notion', 'https://www.notion.so/'],
    ['Trello', 'https://trello.com/'],
    ['Jira', 'https://www.atlassian.com/software/jira'],
    ['Confluence', 'https://www.atlassian.com/software/confluence'],
    ['Redmine', 'https://www.redmine.org/'],
    ['SonarCloud', 'https://sonarcloud.io/'],
    ['Sentry', 'https://sentry.io/'],
    ['Datadog', 'https://www.datadoghq.com/'],
    ['Postman', 'https://www.postman.com/'],
    ['Swagger Editor', 'https://editor.swagger.io/'],
    ['OWASP', 'https://owasp.org/'],
    ['CVE database', 'https://www.cve.org/'],
    ['Public holidays', 'https://www.timeanddate.com/holidays/'],
    ['World clock', 'https://www.timeanddate.com/worldclock/'],
    ['Google Translate', 'https://translate.google.com/'],
    ['DeepL', 'https://www.deepl.com/translator'],
    ['Wikipedia', 'https://en.wikipedia.org/'],
    ['YouTube', 'https://www.youtube.com/'],
    ['Amazon', 'https://www.amazon.com/'],
    ['eBay', 'https://www.ebay.com/'],
    ['Best Buy', 'https://www.bestbuy.com/'],
    ['Yelp', 'https://www.yelp.com/'],
    ['BBC News', 'https://www.bbc.com/news'],
    ['Reuters', 'https://www.reuters.com/'],
    ['The Verge', 'https://www.theverge.com/'],
    ['Ars Technica', 'https://arstechnica.com/'],
    ['TechCrunch', 'https://techcrunch.com/'],
    ['Hacker News', 'https://news.ycombinator.com/'],
    ['Product Hunt', 'https://www.producthunt.com/'],
    ['Google Analytics', 'https://analytics.google.com/'],
    ['Google Search Console', 'https://search.google.com/search-console'],
    ['Canva', 'https://www.canva.com/'],
    ['Unsplash', 'https://unsplash.com/'],
    ['Google Fonts', 'https://fonts.google.com/'],
    ['Font Awesome', 'https://fontawesome.com/'],
    ['Speedtest', 'https://www.speedtest.net/'],
    ['Docker docs', 'https://docs.docker.com/'],
    ['Git docs', 'https://git-scm.com/doc'],
    ['Visual Studio Code docs', 'https://code.visualstudio.com/docs'],
    ['Electron docs', 'https://www.electronjs.org/docs/latest/'],
    ['Vite', 'https://vite.dev/'],
    ['Playwright', 'https://playwright.dev/'],
    ['Vitest', 'https://vitest.dev/'],
    ['ESLint', 'https://eslint.org/'],
    ['Prettier', 'https://prettier.io/'],
    ['Tailwind CSS', 'https://tailwindcss.com/'],
    ['Next.js', 'https://nextjs.org/'],
    ['Vue.js', 'https://vuejs.org/'],
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
    item('Notepad', 'notepad.exe'),
    item('Calculator', 'calc.exe'),
    item('Paint', 'mspaint.exe'),
    item('Command Prompt', 'cmd.exe'),
    item('PowerShell', 'powershell.exe'),
    item('File Explorer', 'explorer.exe'),
    item('Task Manager', 'taskmgr.exe'),
    item('Remote Desktop', 'mstsc.exe'),
    item('Control Panel', 'control.exe'),
    item('Windows Settings', 'ms-settings:'),
    item('WordPad', 'write.exe'),
    item('Character Map', 'charmap.exe'),
    item('Resource Monitor', 'resmon.exe'),
    item('Event Viewer', 'eventvwr.msc'),
  ];
}

/** 案件フォルダの中身を demoRoot からの相対パスの一覧にする */
const filesOf = (dir: string, tree: Record<string, string[]>): string[] =>
  Object.entries(tree).flatMap(([sub, files]) => files.map((f) => path.join(dir, sub, f)));

export const enContent: DemoContent = {
  tabs: ['Main', 'A: ERP Migration', 'B: Store Revamp', 'Bookmarks', 'Apps'],
  dataFileLabels: [
    'Main',
    'A: ERP Migration',
    'B: Online Store Revamp',
    'Browser bookmarks',
    'Apps',
  ],
  files: [
    ...filesOf(PROJECT_A_DIR, PROJECT_A_FILES),
    ...filesOf(PROJECT_B_DIR, PROJECT_B_FILES),
    path.join('Weekly reports', 'Weekly report template.docx'),
    'Work notes.txt',
  ],
  dirs: ['Shared drive'],
  parts: (root) => ({
    daily: dailyItems(root),
    projectA: projectAItems(root),
    projectB: projectBItems(root),
    bookmarks: bookmarkItems(),
    apps: appItems(),
  }),
  demo: {
    search: 'bas des',
    refine: ' scr',
    minutes: '09-30',
    chat: 'cha ale',
    otherTab: 'TypeS',
    captions: {
      intro: 'Open folders, files, websites, and apps from one place',
      tabs: 'Organize projects, bookmarks, and apps into tabs',
      search: 'Type part of a name to narrow the list',
      refine: 'Add words separated by spaces to narrow it further',
      open: 'Select one and press Enter to open it',
      minutes: 'Type a date to find meeting minutes right away',
      chat: 'Open Teams chats from here too',
      otherTab: 'Press Tab to jump to matches in another tab',
    },
  },
  workspace: {
    groups: [
      {
        name: 'Daily',
        color: 'primary',
        items: ['Timesheet', 'Expenses', 'Outlook (web)', 'Chat: Alex (manager)'],
      },
      {
        name: 'A: ERP Migration',
        color: 'success',
        items: ['A: Project folder', 'A: Issues (Jira)', 'Chat: A: ERP Migration team'],
      },
      {
        name: 'B: Store Revamp',
        color: 'warning',
        items: ['B: Project folder', 'B: Figma designs', 'Chat: B: Store Revamp team'],
      },
    ],
    search: 'wi c',
    targetGroup: 1,
  },
  shots: {
    dir: {
      tab: 'A: ERP Migration',
      folder: PROJECT_A_DIR,
      filter: '*.xlsx',
      exclude: 'Old*',
      prefix: 'ERP',
    },
    item: { tab: 'Main', name: 'Timesheet', url: 'https://intranet.example.com/timesheet' },
    adminTab: 'A: ERP Migration',
  },
};
