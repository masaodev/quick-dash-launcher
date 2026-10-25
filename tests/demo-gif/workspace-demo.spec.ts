import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { test, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { en } from '../../src/common/i18n/locales/en';
import { ja } from '../../src/common/i18n/locales/ja';
import { ConfigFileHelper } from '../e2e/helpers/config-file-helper';

import { demoContent, demoLang, writeDemoData, writeDemoWorkspace } from './demo-data';
import { OsMouse } from './os-mouse';
import type { Point } from './os-mouse';

/**
 * README のワークスペースのデモ GIF の素材（メインウィンドウとワークスペースを並べた範囲の動画）を撮る
 *
 * 1. メインウィンドウで打った候補を、ワークスペースのグループへドラッグして入れる
 * 2. メインウィンドウを閉じても、ワークスペースは残る
 * 3. グループをワークスペースの外へドラッグして、切り離しウィンドウにする
 * 4. 切り離しウィンドウの見出しをクリックして畳む（ウィンドウが縮む）
 *
 * データは demo-data.ts（メインデモと同じ）と、content.workspace のグループ。DEMO_LANG=en で英語。
 * ウィンドウをまたぐドラッグは Playwright のマウスでは起こせないので、OS のマウスを動かす（os-mouse.ts）。
 * 撮影中はマウスに触れず、撮る範囲（プライマリディスプレイの右上）に他の物を重ねないこと。
 * 録画と GIF への変換はメインデモと同じ（gdigrab → meta.json → scripts/make-demo-gif.mjs workspace）
 */

const LANG = demoLang();
const CONTENT = demoContent(LANG);
const MESSAGES = LANG === 'en' ? en : ja;
const NAME = LANG === 'en' ? 'workspace-en' : 'workspace';
const OUT_DIR = path.join(process.cwd(), 'test-results', 'demo-gif', NAME);
const DEMO_ROOT = path.join(os.tmpdir(), LANG === 'en' ? 'qdl-demo-en' : 'qdl-demo');
const TYPE_DELAY_MS = 120;
/** メインウィンドウとワークスペースの間の隙間（論理ピクセル） */
const GAP = 40;
/** 撮る範囲の周りの余白（論理ピクセル） */
const MARGIN = 16;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * ページのタイトルでウィンドウを探す（ワークスペースは about:blank で開いてから中身を書き込むので、
 * URL では見分けられない。タイトルはメイン＝QuickDashLauncher、ワークスペース＝Workspace）
 */
async function findWindow(app: ElectronApplication, title: string): Promise<Page> {
  for (let i = 0; i < 40; i++) {
    for (const win of app.windows()) {
      if ((await win.title().catch(() => '')) === title) return win;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`ウィンドウ「${title}」が見つかりません`);
}

/** タイトルで BrowserWindow を探し、内容の範囲（論理ピクセル）を返す */
async function contentBounds(app: ElectronApplication, title: string): Promise<Bounds> {
  for (let i = 0; i < 40; i++) {
    const bounds = await app.evaluate(({ BrowserWindow }, t) => {
      const w = BrowserWindow.getAllWindows().find((bw) => bw.isVisible() && bw.getTitle() === t);
      return w ? w.getContentBounds() : null;
    }, title);
    if (bounds) return bounds;
    await new Promise((r) => setTimeout(r, 250));
  }
  const seen = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((bw) => `${bw.getTitle()}(${bw.isVisible()})`)
  );
  throw new Error(`ウィンドウ「${title}」が見つかりません: ${seen.join(', ')}`);
}

/** 要素の中心を、画面の物理ピクセルで返す */
async function screenPoint(locator: Locator, win: Bounds, scale: number, dx = 0): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('要素が見えていません');
  return {
    x: (win.x + box.x + box.width / 2 + dx) * scale,
    y: (win.y + box.y + box.height / 2) * scale,
  };
}

test('ワークスペースのデモ', async () => {
  test.setTimeout(300000);
  const helper = ConfigFileHelper.createTempConfigDir('demo-gif-workspace', 'demo');
  writeDemoData(helper.getConfigDir(), DEMO_ROOT, LANG);
  writeDemoWorkspace(helper.getConfigDir(), DEMO_ROOT, LANG);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const app = await electron.launch({
    args: [path.join(process.cwd(), 'dist', 'main', 'main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_IS_DEV: '0',
      DISABLE_GLOBAL_HOTKEY: '1',
      SHOW_WINDOW_ON_STARTUP: '1',
      SKIP_SPLASH_WINDOW: '1',
      QUICK_DASH_CONFIG_DIR: helper.getConfigDir(),
    },
  });
  const mouse = await OsMouse.start();

  try {
    const main = await findWindow(app, 'QuickDashLauncher');
    await main.waitForLoadState('networkidle');

    // アイコンを取得してから撮る（Web サイトのファビコン取得にネットワークを使う）
    const notice = main.locator('.missing-icon-notice button', {
      hasText: MESSAGES.launcher.missingIcons.fetch,
    });
    if (await notice.isVisible().catch(() => false)) {
      await notice.click();
      await main
        .locator(`button[aria-label="${MESSAGES.common.showDetails}"]`)
        .waitFor({ state: 'visible', timeout: 240000 });
      // 取得の間にメインウィンドウが隠れることがあるので、表示によらず押せる DOM の click で閉じる
      await main.locator('.progress-close-btn').evaluate((el) => (el as HTMLElement).click());
    }

    // ワークスペースを開く
    const input = main.locator('input[type="text"]').first();
    await input.focus();
    await main.evaluate(() => window.electronAPI.toggleWorkspaceWindow());
    const ws = await findWindow(app, 'Workspace');
    await ws.waitForLoadState('networkidle');
    const groupName = CONTENT.workspace.groups[CONTENT.workspace.targetGroup].name;
    const targetHeader = ws.locator('.workspace-group-header', { hasText: groupName });
    await targetHeader.waitFor({ state: 'visible' });

    // メインウィンドウをワークスペースの左隣に寄せ、両方を最前面に固定する
    const wsBounds = await contentBounds(app, 'Workspace');
    const scale = await app.evaluate(
      ({ BrowserWindow, screen }, { ws, gap }) => {
        const w = BrowserWindow.getAllWindows().find((bw) => bw.getTitle() === 'QuickDashLauncher');
        if (!w) throw new Error('メインウィンドウが見つかりません');
        const b = w.getBounds();
        w.setPosition(ws.x - gap - b.width, ws.y + gap);
        w.show();
        for (const bw of BrowserWindow.getAllWindows()) {
          if (bw.isVisible()) bw.setAlwaysOnTop(true, 'screen-saver');
        }
        w.focus();
        return screen.getPrimaryDisplay().scaleFactor;
      },
      { ws: wsBounds, gap: GAP }
    );
    const mainBounds = await contentBounds(app, 'QuickDashLauncher');
    await input.focus();

    // 撮る範囲: メインウィンドウの左からワークスペースの右まで、ワークスペースの上からメインウィンドウの下まで
    const left = mainBounds.x - MARGIN;
    const top = wsBounds.y;
    const right = wsBounds.x + wsBounds.width;
    const bottom = mainBounds.y + mainBounds.height + MARGIN;
    const rect = {
      logicalWidth: right - left,
      x: Math.round(left * scale),
      y: Math.round(top * scale),
      width: Math.round((right - left) * scale),
      height: Math.round((bottom - top) * scale),
    };

    // 撮る範囲の後ろに無地のウィンドウを敷く（デスクトップの壁紙や他のアプリを写さない）。
    // 最前面には固定しない（後から開く切り離しウィンドウがこの上に出るように）
    await app.evaluate(
      ({ BrowserWindow }, b) => {
        const backdrop = new BrowserWindow({
          ...b,
          frame: false,
          resizable: false,
          focusable: false,
          skipTaskbar: true,
          backgroundColor: '#e4e8ee',
          show: false,
        });
        backdrop.show();
        backdrop.moveTop();
        const w = BrowserWindow.getAllWindows().find((bw) => bw.getTitle() === 'QuickDashLauncher');
        w?.focus();
      },
      { x: left, y: top, width: right - left, height: bottom - top }
    );
    await input.focus();

    // マウスはメインウィンドウの入力欄の脇で待たせる。ドロップの後は、ツールチップが出ないよう空いている所へ逃がす
    await mouse.moveTo(await screenPoint(input, mainBounds, scale, 120));
    const restPoint: Point = {
      x: (mainBounds.x + mainBounds.width * 0.5) * scale,
      y: (mainBounds.y + mainBounds.height * 0.85) * scale,
    };

    const videoFile = 'capture.mkv';
    const recordStart = Date.now();
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-f',
        'gdigrab',
        '-framerate',
        '30',
        '-draw_mouse',
        '1',
        '-offset_x',
        String(rect.x),
        '-offset_y',
        String(rect.y),
        '-video_size',
        `${rect.width - (rect.width % 2)}x${rect.height - (rect.height % 2)}`,
        '-i',
        'desktop',
        '-c:v',
        'libx264rgb',
        '-crf',
        '0',
        '-preset',
        'ultrafast',
        videoFile,
      ],
      { cwd: OUT_DIR, stdio: ['pipe', 'inherit', 'inherit'] }
    );
    await main.waitForTimeout(1500);
    const startSec = Math.max(0, (Date.now() - recordStart) / 1000 - 0.7);

    // 1. メインウィンドウで候補を出し、ワークスペースのグループへドラッグして入れる
    await main.keyboard.type(CONTENT.workspace.search, { delay: TYPE_DELAY_MS });
    await main.waitForTimeout(900);
    const row = main.locator('.item-row-wrapper .item-name').first();
    await mouse.glideTo(await screenPoint(row, mainBounds, scale), 600);
    await main.waitForTimeout(300);
    await mouse.drag(
      await screenPoint(row, mainBounds, scale),
      await screenPoint(targetHeader, wsBounds, scale),
      1200
    );
    await main.waitForTimeout(400);
    await mouse.glideTo(restPoint, 500);
    await main.waitForTimeout(1200);

    // 2. メインウィンドウを閉じても、ワークスペースは残る
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((bw) => bw.isVisible() && bw.webContents.getURL().includes('index.html'))
        ?.hide();
    });
    await main.waitForTimeout(1200);

    // 3. グループの見出しをワークスペースの外（メインウィンドウのあった所）へドラッグして切り離す
    const header = await screenPoint(targetHeader, wsBounds, scale);
    await mouse.glideTo(header, 600);
    await main.waitForTimeout(300);
    await mouse.drag(
      header,
      {
        x: (mainBounds.x + mainBounds.width * 0.35) * scale,
        y: (mainBounds.y + mainBounds.height * 0.3) * scale,
      },
      1200
    );
    await main.waitForTimeout(400);
    await mouse.glideTo(restPoint, 500);
    await main.waitForTimeout(1200);

    // 4. 切り離しウィンドウの見出しをクリックして畳むと、ウィンドウが見出しだけの大きさに縮む
    const detachedTitle = `${groupName} - QuickDashLauncher`;
    const detached = await findWindow(app, detachedTitle);
    // クリックしたグループに付く貼り付け先の枠（黄色）は、畳んで縮む様子の邪魔になるので撮影では出さない
    await detached.addStyleTag({
      content: '.workspace-group-header.paste-target { outline: none !important; }',
    });
    const collapseIcon = detached.locator('.workspace-group-collapse-icon').first();
    const icon = await screenPoint(collapseIcon, await contentBounds(app, detachedTitle), scale);
    await mouse.glideTo(icon, 600);
    await main.waitForTimeout(300);
    await mouse.click();
    await main.waitForTimeout(300);
    await mouse.glideTo(restPoint, 500);
    await main.waitForTimeout(2000);

    const endSec = (Date.now() - recordStart) / 1000;
    await new Promise<void>((resolve) => {
      ffmpeg.on('close', () => resolve());
      ffmpeg.stdin?.write('q');
    });
    fs.writeFileSync(
      path.join(OUT_DIR, 'meta.json'),
      JSON.stringify({ video: videoFile, startSec, endSec, width: rect.logicalWidth }, null, 2)
    );
  } finally {
    await mouse.stop().catch(() => {});
    await app.close().catch(() => {});
    helper.cleanup();
  }
});
