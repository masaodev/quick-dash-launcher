import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { test, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

import { en } from '../../src/common/i18n/locales/en';
import { ja } from '../../src/common/i18n/locales/ja';
import { ConfigFileHelper } from '../e2e/helpers/config-file-helper';
import { TestUtils } from '../e2e/helpers/test-utils';

import { BACKDROP_BLEED } from './demo-backdrop';
import { demoContent, demoLang, writeDemoData, writeDemoWorkspace } from './demo-data';

/**
 * Microsoft Store の掲載に載せるスクリーンショットを撮る
 *
 * README の画面イメージと同じデモデータ（demo-data.ts）で起動し、test-results/store-screenshots/<言語>/ に保存する。
 * 環境変数 DEMO_LANG=en で英語の画面とデータで撮る。
 * Store の決まり: PNG、1366×768 以上。画像に宣伝の文字やロゴを足さない。大事なものは上 3 分の 2 に置く。
 * そこで、1366×768（論理ピクセル）の無地の枠を画面に敷き、その中にウィンドウを並べて、枠ごと ffmpeg（gdigrab）で撮る。
 * 画面にパスが写るので、デモ用のフォルダを subst で空いているドライブに割り当てる（readme-images.spec.ts と同じ）
 */

const LANG = demoLang();
const CONTENT = demoContent(LANG);
const MESSAGES = LANG === 'en' ? en : ja;
const OUT_DIR = path.join(process.cwd(), 'test-results', 'store-screenshots', LANG);
const DEMO_DIR = path.join(os.tmpdir(), LANG === 'en' ? 'qdl-demo-store-en' : 'qdl-demo-store');

/**
 * 撮る枠の大きさ（論理ピクセル）
 *
 * Store の下限は実際のピクセルで 1366×768。アプリを 150% の倍率で描かせて（RENDER_SCALE）、1728×972 で撮る。
 * 画面の表示倍率が 100% のままだと、ウィンドウが枠に対して小さく写るため。下限に届かないときは撮らずに止める（shotScene）
 */
const CANVAS = { width: 1152, height: 648 };
/** アプリを描かせる倍率（画面の表示倍率によらず同じ大きさで撮る） */
const RENDER_SCALE = 1.5;
/** Store が求める大きさの下限（実際のピクセル） */
const STORE_MIN = { width: 1366, height: 768 };
/** ウィンドウどうしの間 */
const GAP = 24;
const MAIN_TITLE = 'Quick Dash Launcher';
const WORKSPACE_TITLE = 'Workspace';

function mapDemoDrive(): string {
  fs.rmSync(DEMO_DIR, { recursive: true, force: true });
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

async function findWindow(app: ElectronApplication, title: string): Promise<Page> {
  for (let i = 0; i < 40; i++) {
    for (const win of app.windows()) {
      if ((await win.title().catch(() => '')) === title) return win;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`ウィンドウ「${title}」が見つかりません`);
}

/** ランチャーを出す（ほかのウィンドウを開くと隠れることがある） */
async function showMain(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }, t) => {
    const w = BrowserWindow.getAllWindows().find((bw) => bw.getTitle() === t);
    w?.show();
    w?.focus();
  }, MAIN_TITLE);
}

async function fetchIcons(main: Page): Promise<void> {
  const notice = main.locator('.missing-icon-notice button', {
    hasText: MESSAGES.launcher.missingIcons.fetch,
  });
  await notice.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (!(await notice.isVisible().catch(() => false))) return;
  await notice.click();
  await main
    .locator(`button[aria-label="${MESSAGES.common.showDetails}"]`)
    .waitFor({ state: 'visible', timeout: 240000 });
  await main.locator('.progress-close-btn').evaluate((el) => (el as HTMLElement).click());
}

/**
 * 枠の中にウィンドウを左から並べて撮る
 *
 * titles のウィンドウを、間を GAP 空けて横に並べ、まとめて枠の中央に置く（縦は上寄せ気味。大事なものを上 3 分の 2 に）。
 * 枠より大きいウィンドウは枠に収まる大きさに縮める。枠の後ろには無地のウィンドウを敷き、ほかのウィンドウを隠す
 */
async function shotScene(
  app: ElectronApplication,
  pages: Page[],
  name: string,
  sizes: Record<string, { width?: number; height?: number }> = {},
  overlay?: { file: string; width: number; height: number }
): Promise<void> {
  const titles = await Promise.all(pages.map((p) => p.title()));
  await pages[pages.length - 1].waitForTimeout(300);
  const rect = await app.evaluate(
    ({ BrowserWindow, screen }, { titles, canvas, gap, pad, sizes, extra }) => {
      const wins = titles.map((t) => {
        const w = BrowserWindow.getAllWindows().find((bw) => bw.isVisible() && bw.getTitle() === t);
        if (!w) throw new Error(`ウィンドウが見つかりません: ${t}`);
        return w;
      });
      const display = screen.getPrimaryDisplay();
      const scale = display.scaleFactor;
      const origin = {
        x: display.workArea.x + Math.round((display.workArea.width - canvas.width) / 2),
        y: display.workArea.y + Math.round((display.workArea.height - canvas.height) / 2),
      };
      const backdrop = new BrowserWindow({
        x: origin.x - pad,
        y: origin.y - pad,
        width: canvas.width + pad * 2,
        height: canvas.height + pad * 2,
        frame: false,
        resizable: false,
        focusable: false,
        skipTaskbar: true,
        backgroundColor: '#d5deea',
        show: false,
      });
      (globalThis as { __storeBackdrop?: { destroy(): void } }).__storeBackdrop = backdrop;
      // 背景は、撮るウィンドウ（screen-saver の段）より低い段（floating）の最前面に置く。同じ段に置くと、
      // 背景が撮るウィンドウの上に来ることがある。撮らないウィンドウは最前面を外して、背景の下に隠す
      for (const other of BrowserWindow.getAllWindows()) {
        if (!wins.includes(other)) other.setAlwaysOnTop(false);
      }
      backdrop.setAlwaysOnTop(true, 'floating');
      backdrop.show();
      backdrop.moveTop();

      const maxHeight = canvas.height - gap * 2;
      wins.forEach((w, i) => {
        const want = sizes[titles[i]] ?? {};
        const b = w.getBounds();
        const width = Math.min(want.width ?? b.width, canvas.width - gap * 2);
        const height = Math.min(want.height ?? b.height, maxHeight);
        if (width !== b.width || height !== b.height) w.setSize(width, height);
      });
      const bounds = wins.map((w) => w.getBounds());
      // extra は、後から画像で重ねるウィンドウ（右端に並べる。場所だけ空けておく）
      const total =
        bounds.reduce((sum, b) => sum + b.width, 0) +
        gap * (wins.length - 1) +
        (extra ? extra.width + gap : 0);
      let x = origin.x + Math.round((canvas.width - total) / 2);
      const placed: { x: number; y: number; width: number; height: number }[] = [];
      wins.forEach((w, i) => {
        const b = bounds[i];
        // 縦は中央より少し上（余りの 4 割を上に）
        const y = origin.y + Math.round((canvas.height - b.height) * 0.4);
        w.setPosition(x, y);
        placed.push({ x, y, width: b.width, height: b.height });
        x += b.width + gap;
        w.setAlwaysOnTop(true, 'screen-saver');
        w.moveTop();
      });
      wins[wins.length - 1].focus();
      const overlayAt = extra
        ? {
            x: Math.round((x - origin.x) * scale),
            y: Math.round((canvas.height - extra.height) * 0.4 * scale),
          }
        : null;
      return {
        placed,
        overlayAt,
        x: Math.round(origin.x * scale),
        y: Math.round(origin.y * scale),
        width: Math.round(canvas.width * scale),
        height: Math.round(canvas.height * scale),
      };
    },
    {
      titles,
      canvas: CANVAS,
      gap: GAP,
      pad: BACKDROP_BLEED,
      sizes,
      extra: overlay ? { width: overlay.width, height: overlay.height } : null,
    }
  );
  const file = path.join(OUT_DIR, `${name}.png`);
  if (rect.width < STORE_MIN.width || rect.height < STORE_MIN.height) {
    throw new Error(
      `撮る枠が ${rect.width}×${rect.height} で、Store の下限（1366×768）に届きません。RENDER_SCALE を上げてください`
    );
  }
  try {
    // ウィンドウを開いた直後は前へ出す指示が効かないことがあるので、少し待ってからもう一度前へ出す
    await pages[pages.length - 1].waitForTimeout(400);
    // 別のモニターにあったウィンドウは、1 回目の移動では倍率の換算がずれて枠の外に出ることがあるので、
    // 主モニターへ移った後にもう一度同じ位置へ置く
    await app.evaluate(
      ({ BrowserWindow }, { ts, placed }) => {
        ts.forEach((t, i) => {
          const w = BrowserWindow.getAllWindows().find((bw) => bw.getTitle() === t);
          w?.setBounds(placed[i]);
          w?.setAlwaysOnTop(true, 'screen-saver');
          w?.moveTop();
        });
      },
      { ts: titles, placed: rect.placed }
    );
    await pages[pages.length - 1].waitForTimeout(1000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-f',
      'gdigrab',
      '-draw_mouse',
      '0',
      '-offset_x',
      String(rect.x),
      '-offset_y',
      String(rect.y),
      '-video_size',
      `${rect.width}x${rect.height}`,
      '-i',
      'desktop',
      '-frames:v',
      '1',
      overlay ? `${file}.base.png` : file,
    ]);
    if (overlay && rect.overlayAt) {
      execFileSync('ffmpeg', [
        '-y',
        '-v',
        'error',
        '-i',
        `${file}.base.png`,
        '-i',
        overlay.file,
        '-filter_complex',
        `overlay=${rect.overlayAt.x}:${rect.overlayAt.y}`,
        '-frames:v',
        '1',
        file,
      ]);
      fs.rmSync(`${file}.base.png`);
    }
  } finally {
    await app.evaluate(({ BrowserWindow }, ts) => {
      for (const t of ts) {
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === t)
          ?.setAlwaysOnTop(false);
      }
      const g = globalThis as { __storeBackdrop?: { destroy(): void } };
      g.__storeBackdrop?.destroy();
      g.__storeBackdrop = undefined;
    }, titles);
  }
}

test('Store のスクリーンショット', async () => {
  test.setTimeout(420000);
  const helper = ConfigFileHelper.createTempConfigDir('store-screenshots', 'demo');
  const demoRoot = mapDemoDrive();
  try {
    writeDemoData(helper.getConfigDir(), demoRoot, LANG);
    writeDemoWorkspace(helper.getConfigDir(), demoRoot, LANG);
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    await takeShots(helper.getConfigDir(), demoRoot);
  } finally {
    helper.cleanup();
    unmapDemoDrive(demoRoot);
  }
});

async function takeShots(configDir: string, demoRoot: string): Promise<void> {
  const app = await electron.launch({
    args: [
      path.join(process.cwd(), 'dist', 'main', 'main.js'),
      `--force-device-scale-factor=${RENDER_SCALE}`,
    ],
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
  try {
    const main = await findWindow(app, MAIN_TITLE);
    await main.waitForLoadState('networkidle');
    await fetchIcons(main);
    const utils = new TestUtils(main);
    const input = main.locator('input[type="text"]').first();
    await main.mouse.move(5, 5);

    // 1. 名前の一部を打つと、登録したものだけが候補に出る
    await input.focus();
    await input.fill(CONTENT.demo.quick);
    await shotScene(app, [main], '01-search');

    // 2. タブで分ける（2 つ目のタブ＝案件のタブ）
    await input.fill('');
    await input.focus();
    await main.keyboard.press('Tab');
    await shotScene(app, [main], '02-tabs');
    // 最初のタブへ戻す（Shift+Tab はウィンドウ検索への切り替えで、開いているウィンドウの名前が写るので使わない）
    for (let i = 1; i < CONTENT.tabs.length; i++) await main.keyboard.press('Tab');

    // 3. ワークスペース（ランチャーの右に並べる）
    await main.evaluate(() => window.electronAPI.toggleWorkspaceWindow());
    const ws = await findWindow(app, WORKSPACE_TITLE);
    await ws.waitForLoadState('networkidle');
    await ws.locator('.workspace-group-header').first().waitFor({ state: 'visible' });
    // ワークスペースは、アプリを RENDER_SCALE で描かせると実際の位置が指定とずれる（モニターをまたぐ移動の換算）。
    // 枠も影も無いウィンドウなので、中身を直接撮り、ランチャーを撮った画像の右に重ねる
    const wsSize = { width: 384, height: 624 };
    await app.evaluate(
      ({ BrowserWindow }, { t, size }) => {
        BrowserWindow.getAllWindows()
          .find((bw) => bw.getTitle() === t)
          ?.setContentSize(size.width, size.height);
      },
      { t: WORKSPACE_TITLE, size: wsSize }
    );
    await ws.waitForTimeout(500);
    const wsShot = path.join(OUT_DIR, 'workspace-part.png');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await ws.screenshot({ path: wsShot, animations: 'disabled' });
    const wsView = ws.viewportSize() ?? wsSize;
    await showMain(app);
    await input.focus();
    await shotScene(app, [main], '05-workspace', {}, { file: wsShot, ...wsView });
    fs.rmSync(wsShot);
    await main.evaluate(() => window.electronAPI.toggleWorkspaceWindow());
    await showMain(app);
    await input.focus();

    // 4. 登録画面（1 件）: 長い URL に、いつもの呼び名を付ける
    const { dir, item } = CONTENT.shots;
    const pathInput = '.path-input-group input';
    const register = await utils.openRegisterModal(app);
    const selects = register.locator('.register-modal select');
    await selects.nth(0).selectOption({ label: item.tab });
    await selects.nth(1).selectOption({ value: 'item' });
    await register.locator('.register-modal input').first().fill(item.name);
    await register.locator(pathInput).fill(item.url);
    await shotScene(app, [register], '03-register-item', {
      [await register.title()]: { height: 540 },
    });

    // 5. 登録画面（フォルダ取込）: フォルダを登録すると、中のファイルが候補に並ぶ
    await selects.nth(0).selectOption({ label: dir.tab });
    await selects.nth(1).selectOption({ value: 'dir' });
    await register.locator(pathInput).fill(path.join(demoRoot, dir.folder));
    await register.locator('.options-toggle', { hasText: MESSAGES.register.dirOptions }).click();
    const dirOptions = register.locator('.dir-options');
    await dirOptions.waitFor({ state: 'visible' });
    await dirOptions.locator('select').nth(0).selectOption({ value: '-1' });
    await dirOptions.locator('select').nth(1).selectOption({ value: 'file' });
    const { filterPlaceholder, excludePlaceholder, prefixPlaceholder } = MESSAGES.dirOptions;
    await dirOptions.locator(`input[placeholder="${filterPlaceholder}"]`).fill(dir.filter);
    await dirOptions.locator(`input[placeholder="${excludePlaceholder}"]`).fill(dir.exclude);
    await dirOptions.locator(`input[placeholder="${prefixPlaceholder}"]`).fill(dir.prefix);
    const preview = register.getByTestId('dir-preview');
    await preview.locator('.dir-preview-btn').click();
    await preview.locator('.dir-preview-item').first().waitFor({ state: 'visible' });
    // オプションを畳み、フォルダのパスと「取り込まれるもの」が 1 画面に入るようにする
    await register.locator('.options-toggle', { hasText: MESSAGES.register.dirOptions }).click();
    await register.locator(pathInput).scrollIntoViewIfNeeded();
    await register.mouse.move(5, 5);
    await shotScene(app, [register], '04-register-dir', {
      [await register.title()]: { height: 600 },
    });
    await register.close();

    // 6. 管理ウィンドウ（アイテム管理）
    const admin = await utils.openAdminWindow(app, 'edit');
    await admin.locator('.raw-item-row').first().waitFor({ state: 'visible' });
    await admin.getByTestId('admin-tab').filter({ hasText: CONTENT.shots.adminTab }).click();
    await admin.locator('.raw-item-row').first().waitFor({ state: 'visible' });
    await shotScene(app, [admin], '06-admin', {
      [await admin.title()]: { width: 1100, height: 600 },
    });
  } finally {
    await app.close().catch(() => {});
  }
}
