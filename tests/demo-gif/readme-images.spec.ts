import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { test, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { ConfigFileHelper } from '../e2e/helpers/config-file-helper';
import { TestUtils } from '../e2e/helpers/test-utils';

import { writeDemoData } from './demo-data';

/**
 * README の「使い方」に載せる画面イメージ（登録画面・管理画面）を撮る
 *
 * メインデモ GIF と同じデモデータ（demo-data.ts）で起動し、docs/images/readme-*.png に保存する。
 * 見比べ用の別案は test-results/readme-images/ に置く（README では使わない）。
 * 画面にパスが写るので、デモ用のフォルダを subst で空いているドライブ（S: など）に割り当て、
 * ユーザー名を含む %TEMP% のパスが写らないようにする（終わったら割り当てを外す）
 */

const IMAGE_DIR = path.join(process.cwd(), 'docs', 'images');
const ALT_DIR = path.join(process.cwd(), 'test-results', 'readme-images');
const DEMO_DIR = path.join(os.tmpdir(), 'qdl-demo-readme');

/** DEMO_DIR を空いているドライブに割り当て、そのルート（例: S:\）を返す */
function mapDemoDrive(): string {
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  for (const letter of ['S', 'T', 'Q', 'P', 'R', 'W']) {
    if (fs.existsSync(`${letter}:\\`)) continue;
    execFileSync('subst', [`${letter}:`, DEMO_DIR]);
    return `${letter}:\\`;
  }
  throw new Error('割り当てに使える空きドライブがありません');
}

function unmapDemoDrive(root: string): void {
  execFileSync('subst', [root.slice(0, 2), '/D']);
}

/** アニメーション・カーソルの点滅が落ち着いてから保存する */
async function shot(target: Page | Locator, file: string): Promise<void> {
  const page = 'page' in target ? target.page() : target;
  await page.waitForTimeout(500);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await target.screenshot({ path: file, animations: 'disabled' });
}

async function launch(configDir: string): Promise<{ app: ElectronApplication; main: Page }> {
  const app = await electron.launch({
    args: [path.join(process.cwd(), 'dist', 'main', 'main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_IS_DEV: '0',
      DISABLE_GLOBAL_HOTKEY: '1',
      SHOW_WINDOW_ON_STARTUP: '1',
      SKIP_SPLASH_WINDOW: '1',
      QUICK_DASH_CONFIG_DIR: configDir,
    },
  });
  let main: Page | undefined;
  for (let i = 0; !main && i < 40; i++) {
    main = app.windows().find((w) => w.url().includes('index.html'));
    if (!main) await new Promise((r) => setTimeout(r, 250));
  }
  if (!main) throw new Error('メインウィンドウが見つかりません');
  await main.waitForLoadState('networkidle');
  return { app, main };
}

/** アイコンを取得してから撮る（Web サイトのファビコン取得にネットワークを使う） */
async function fetchIcons(main: Page): Promise<void> {
  const notice = main.locator('.missing-icon-notice button', { hasText: '取得' });
  if (!(await notice.isVisible().catch(() => false))) return;
  await notice.click();
  await main
    .locator('button[aria-label="詳細を表示"]')
    .waitFor({ state: 'visible', timeout: 240000 });
  await main.locator('.progress-close-btn').click();
}

/** 撮るウィンドウの高さを変える（下の余白を詰めて撮るため）。ウィンドウはタイトルで探す */
async function resizeWindow(app: ElectronApplication, page: Page, height: number): Promise<void> {
  const title = await page.title();
  await app.evaluate(
    ({ BrowserWindow }, { t, h }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.isVisible() && w.getTitle() === t);
      if (!win) throw new Error(`ウィンドウが見つかりません: ${t}`);
      const [width] = win.getContentSize();
      win.setContentSize(width, h);
    },
    { t: title, h: height }
  );
}

test('README の画面イメージ', async () => {
  test.setTimeout(420000);
  const helper = ConfigFileHelper.createTempConfigDir('readme-images', 'demo');
  const demoRoot = mapDemoDrive();
  try {
    writeDemoData(helper.getConfigDir(), demoRoot);
    fs.rmSync(ALT_DIR, { recursive: true, force: true });
    await takeShots(helper.getConfigDir(), demoRoot);
  } finally {
    helper.cleanup();
    unmapDemoDrive(demoRoot);
  }
});

async function takeShots(configDir: string, demoRoot: string): Promise<void> {
  const { app, main } = await launch(configDir);
  try {
    await fetchIcons(main);
    const utils = new TestUtils(main);

    // 別案用: 検索中のメイン画面（リポジトリのプレビュー画像の素材。説明文は入れない）
    await main.mouse.move(5, 5);
    const input = main.locator('input[type="text"]').first();
    await input.fill('基本設計');
    await shot(main, path.join(ALT_DIR, 'main-search.png'));
    await input.fill('');

    // 登録画面（フォルダ取込）: 案件の設計書フォルダを、Excel だけ・旧版を除いて取り込むところ
    const register = await utils.openRegisterModal(app);
    const selects = register.locator('.register-modal select');
    await selects.nth(0).selectOption({ label: 'A：基幹刷新Prj' });
    await selects.nth(1).selectOption({ value: 'dir' });
    await register
      .locator('input[placeholder="ファイルパス、URL、またはカスタムURIを入力"]')
      .fill(path.join(demoRoot, 'A_基幹システム刷新'));
    await register.locator('.options-toggle', { hasText: 'フォルダ取り込みオプション' }).click();
    const dirOptions = register.locator('.dir-options');
    await dirOptions.waitFor({ state: 'visible' });
    await dirOptions.locator('select').nth(0).selectOption({ value: '-1' });
    await dirOptions.locator('select').nth(1).selectOption({ value: 'file' });
    await dirOptions.locator('input[placeholder="ワイルドカードパターン"]').fill('*.xlsx');
    await dirOptions.locator('input[placeholder="除外するパターン"]').fill('旧*');
    await dirOptions.locator('input[placeholder="アイテム名の前に付ける文字"]').fill('基幹刷新');
    await shot(register, path.join(ALT_DIR, 'register-dir-full.png'));
    await resizeWindow(app, register, 760);
    await shot(register, path.join(IMAGE_DIR, 'readme-register.png'));

    // 別案: 単一アイテム（名前にローマ字を添える例）
    await selects.nth(0).selectOption({ label: 'メイン' });
    await selects.nth(1).selectOption({ value: 'item' });
    await register.locator('.register-modal input').first().fill('勤怠（kintai）');
    await register
      .locator('input[placeholder="ファイルパス、URL、またはカスタムURIを入力"]')
      .fill('https://www.jobcan.ne.jp/');
    // フォルダ取込のときに開いたオプション設定は単一アイテムでも開いたままなので閉じる
    const optionsToggle = register.locator('.options-toggle', { hasText: '引数・アイコン' });
    if ((await optionsToggle.textContent())?.includes('▼')) await optionsToggle.click();
    await resizeWindow(app, register, 470);
    await shot(register, path.join(ALT_DIR, 'register-item.png'));
    await register.close();

    // 管理画面（アイテム管理）: 案件 A のタブ。フォルダ取込・URL・Teams のチャットが並ぶ
    const admin = await utils.openAdminWindow(app, 'edit');
    await admin.locator('.raw-item-row').first().waitFor({ state: 'visible' });
    await shot(admin, path.join(ALT_DIR, 'admin-main.png'));
    await admin.locator('.tab-dropdown .dropdown-trigger-btn').click();
    await admin.locator('.tab-dropdown .dropdown-item', { hasText: 'A：基幹刷新Prj' }).click();
    await admin.locator('.raw-item-row').first().waitFor({ state: 'visible' });
    await shot(admin, path.join(ALT_DIR, 'admin-a-full.png'));
    await resizeWindow(app, admin, 560);
    await shot(admin, path.join(IMAGE_DIR, 'readme-admin.png'));
  } finally {
    await app.close().catch(() => {});
  }
}
