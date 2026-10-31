import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { test, _electron as electron } from '@playwright/test';
import type { Page } from '@playwright/test';

import { en } from '../../src/common/i18n/locales/en';
import { ja } from '../../src/common/i18n/locales/ja';
import { ConfigFileHelper } from '../e2e/helpers/config-file-helper';

import { BACKDROP_MARGIN, showBackdrop } from './demo-backdrop';
import { demoContent, demoLang, writeDemoData } from './demo-data';

/**
 * README のメインデモ GIF の素材（ランチャーの動画）を撮る
 *
 * デモデータ（5 タブ。メインに約 140 件）は demo-data.ts。案件フォルダは %TEMP%\qdl-demo\ に空のファイルで作る。
 * 環境変数 DEMO_LANG=en で英語の画面とデータで撮る（GIF は docs/images/demo-main-en.gif。既定は日本語で demo-main.gif）。
 * 録画は ffmpeg の gdigrab で、ランチャーの周りに少し余白を足した範囲を 30fps・劣化なしで撮る（Playwright の動画は
 * 圧縮の残像が出るため使わない）。余白には色付きの背景を敷く（demo-backdrop.ts）。
 * 撮影中はウィンドウを最前面に固定するので、その範囲に他の物を重ねないこと。
 * 動画のどこから使うかを test-results/demo-gif/<main か main-en>/meta.json に書き、scripts/make-demo-gif.mjs がその範囲を
 * GIF にする。画面下の説明文（字幕）は既定では出さず、DEMO_CAPTIONS=1 のときだけ出す
 */

const LANG = demoLang();
const CONTENT = demoContent(LANG);
const MESSAGES = LANG === 'en' ? en : ja;
const OUT_DIR = path.join(
  process.cwd(),
  'test-results',
  'demo-gif',
  LANG === 'en' ? 'main-en' : 'main'
);
const DEMO_ROOT = path.join(os.tmpdir(), LANG === 'en' ? 'qdl-demo-en' : 'qdl-demo');
const SHOW_CAPTIONS = process.env.DEMO_CAPTIONS === '1';
const TYPE_DELAY_MS = 200;

/** 画面下に操作の説明を出す（撮影用。アプリの画面には残らない） */
async function caption(page: Page, text: string): Promise<void> {
  if (!SHOW_CAPTIONS) return;
  await page.evaluate((captionText) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      Object.assign(el.style, {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        padding: '9px 16px',
        background: 'rgba(20, 20, 20, 0.8)',
        color: '#fff',
        fontSize: '15px',
        fontWeight: 'bold',
        textAlign: 'center',
        zIndex: '99999',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.textContent = captionText;
  }, text);
}

async function clearSearch(page: Page): Promise<void> {
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
}

test('メインデモ', async () => {
  test.setTimeout(300000);
  const helper = ConfigFileHelper.createTempConfigDir('demo-gif-main', 'demo');
  writeDemoData(helper.getConfigDir(), DEMO_ROOT, LANG);
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

  try {
    let win: Page | undefined;
    for (let i = 0; !win && i < 40; i++) {
      win = app.windows().find((w) => w.url().includes('index.html'));
      if (!win) await new Promise((r) => setTimeout(r, 250));
    }
    if (!win) throw new Error('ランチャーが見つかりません');
    await win.waitForLoadState('networkidle');

    // アイコンを取得してから撮る（Web サイトのファビコン取得にネットワークを使う）
    const notice = win.locator('.missing-icon-notice button', {
      hasText: MESSAGES.launcher.missingIcons.fetch,
    });
    if (await notice.isVisible().catch(() => false)) {
      await notice.click();
      await win
        .locator(`button[aria-label="${MESSAGES.common.showDetails}"]`)
        .waitFor({ state: 'visible', timeout: 240000 });
      await win.locator('.progress-close-btn').click();
    }
    // 実際のマウスカーソルが一覧の上にあると選択が動くので、撮影中はマウスに反応させない
    await win.addStyleTag({ content: '* { pointer-events: none !important; }' });
    const input = win.locator('input[type="text"]').first();
    await input.focus();
    // 一度入力して消し、選択を先頭に戻す
    await win.keyboard.type('x');
    await clearSearch(win);
    await caption(win, CONTENT.demo.captions.intro);

    // ランチャーを最前面に固定し、周りに余白を足した範囲を撮る。余白には色付きの背景を敷く
    const { area, scale } = await app.evaluate(({ BrowserWindow, screen }, margin) => {
      const w = BrowserWindow.getAllWindows().find(
        (bw) => bw.isVisible() && bw.webContents.getURL().includes('index.html')
      );
      if (!w) throw new Error('ランチャーが見つかりません');
      w.setAlwaysOnTop(true, 'screen-saver');
      w.focus();
      const b = w.getContentBounds();
      return {
        area: {
          x: b.x - margin,
          y: b.y - margin,
          width: b.width + margin * 2,
          height: b.height + margin * 2,
        },
        scale: screen.getDisplayMatching(b).scaleFactor,
      };
    }, BACKDROP_MARGIN);
    await showBackdrop(app, area, 'QuickDashLauncher');
    const rect = {
      logicalWidth: area.width,
      x: Math.round(area.x * scale),
      y: Math.round(area.y * scale),
      width: Math.round(area.width * scale),
      height: Math.round(area.height * scale),
    };
    await input.focus();
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
        '0',
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
    // ffmpeg が録り始めるまでの遅れを見込んで、最初の画面を長めに見せる
    await win.waitForTimeout(1500);
    const startSec = Math.max(0, (Date.now() - recordStart) / 1000 - 0.7);

    // 1. メインタブ → タブを一巡して、案件・ブックマーク・アプリに整理されている様子を見せる
    await caption(win, CONTENT.demo.captions.tabs);
    for (let i = 0; i < 5; i++) {
      await win.keyboard.press('Tab');
      await win.waitForTimeout(i === 4 ? 900 : 750);
    }

    // 2. メインに全部入っているので、名前の一部を打つだけで案件の資料まで絞り込める
    await caption(win, CONTENT.demo.captions.search);
    await win.keyboard.type(CONTENT.demo.search, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1500);

    // 3. スペース区切りでさらに絞る
    await caption(win, CONTENT.demo.captions.refine);
    await win.keyboard.type(CONTENT.demo.refine, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(900);
    await win.keyboard.press('ArrowDown');
    await caption(win, CONTENT.demo.captions.open);
    await win.waitForTimeout(1500);

    // 4. 議事録
    await clearSearch(win);
    await caption(win, CONTENT.demo.captions.minutes);
    await win.keyboard.type(CONTENT.demo.minutes, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1800);

    // 5. Teams のチャット
    await clearSearch(win);
    await caption(win, CONTENT.demo.captions.chat);
    await win.keyboard.type(CONTENT.demo.chat, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1800);

    // 6. メインに無いもの（ブックマーク）は、件数の出たタブへ Tab で移る
    await clearSearch(win);
    await caption(win, CONTENT.demo.captions.otherTab);
    await win.keyboard.type(CONTENT.demo.otherTab, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1000);
    await win.keyboard.press('Tab');
    await win.waitForTimeout(2000);

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
    // 正常時は上で閉じ済み。途中で失敗したときだけ閉じる（2 回目の close は失敗するので握りつぶす）
    await app.close().catch(() => {});
    helper.cleanup();
  }
});
