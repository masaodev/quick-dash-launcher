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
 * デモデータ（4 タブ。メインに約 80 件）は demo-data.ts。案件フォルダは %TEMP%\qdl-demo\ に空のファイルで作る。
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

/**
 * 場面の切り替え（撮影用。アプリの画面には残らない）
 *
 * 前の場面の終わりで一気に真っ暗にし（暗くなっていく途中や、検索欄を消して一覧が変わるところは見せない）、
 * 暗い間に検索欄を消してから、次の場面を明転で始める。薄く暗くするだけだと、消える瞬間が透けて見える
 */
async function nextScene(page: Page, whileDark?: () => Promise<void>): Promise<void> {
  await page.evaluate(() => {
    let el = document.getElementById('demo-fade');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-fade';
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        background: '#0b1220',
        zIndex: '99998',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.style.transition = 'none';
    el.style.opacity = '1';
  });
  await page.waitForTimeout(30);
  await clearSearch(page);
  // 暗い間にしておきたいこと（タブをメインに戻すなど）
  if (whileDark) await whileDark();
  await page.waitForTimeout(40);
  await page.evaluate(() => {
    const el = document.getElementById('demo-fade');
    if (!el) return;
    el.style.transition = 'opacity 200ms ease-out';
    el.style.opacity = '0';
  });
  await page.waitForTimeout(450);
}

test('メインデモ', async () => {
  test.setTimeout(300000);
  const helper = ConfigFileHelper.createTempConfigDir('demo-gif-main', 'demo');
  // 前の撮影で作ったフォルダが残っていると、データから外したファイルまで候補に出るので、作り直す
  fs.rmSync(DEMO_ROOT, { recursive: true, force: true });
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
    // 案内は起動の少し後に出ることがあるので、出るまで待ってから確かめる（すぐ確かめると取得を飛ばして、アイコンの無い GIF になる）
    await notice.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
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
    await showBackdrop(app, area, 'Quick Dash Launcher', { pinned: true });
    const rect = {
      logicalWidth: area.width,
      x: Math.round(area.x * scale),
      y: Math.round(area.y * scale),
      width: Math.round(area.width * scale),
      height: Math.round(area.height * scale),
    };
    await input.focus();
    const videoFile = 'capture.mkv';
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
    // 動画のどこから GIF にするかは、時計ではなく動画の中の目印で決める。ffmpeg が録り始めるまでの遅れや、
    // 動画の時刻と PC の時計のずれは、PC の混み具合で 1〜数秒ぶれるため（決め打ちだと最初の場面が切れたり、
    // 空の画面が長く残ったりした）。録り始めを十分待ってから、画面全体をマゼンタの目印で 0.5 秒覆い、
    // 消した瞬間を GIF の始まりにする。scripts/make-demo-gif.mjs が目印の消えた時刻を動画から探す
    await win.waitForTimeout(3000);
    await win.evaluate(() => {
      const el = document.createElement('div');
      el.id = 'demo-marker';
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        background: '#ff00ff',
        zIndex: '99999',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    });
    await win.waitForTimeout(500);
    await win.evaluate(() => document.getElementById('demo-marker')?.remove());
    const markerGone = Date.now();
    // 動き始める前に、空のランチャーを少しだけ見せる（長いと静止画と思われて読み飛ばされるので短くする）
    await win.waitForTimeout(600);

    // 1. README の検索の例と同じ「goo」→「goo map」で、名前の一部で並び、足すと 1 件に絞れるのを見せる
    await caption(win, CONTENT.demo.captions.quick);
    await win.keyboard.type(CONTENT.demo.quick, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1200);
    await win.keyboard.type(CONTENT.demo.quickRefine, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1600);
    await nextScene(win);

    // 2. 種類の名前（Teams）で並べ、矢印キーで探して選ぶ
    await caption(win, CONTENT.demo.captions.list);
    await win.keyboard.type(CONTENT.demo.list, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(900);
    for (let i = 0; i < CONTENT.demo.listDown; i++) {
      await win.keyboard.press('ArrowDown');
      await win.waitForTimeout(450);
    }
    await win.waitForTimeout(1000);
    await nextScene(win);

    // 3. 同じ相手でも、付けた呼び名（sato）なら打つだけで 1 件に決まる
    await caption(win, CONTENT.demo.captions.call);
    await win.keyboard.type(CONTENT.demo.call, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1600);
    await nextScene(win);

    // 4. タブを一巡して、案件・ブックマーク・アプリに分けて整理している様子を見せる（目で追えるよう 1 タブ 1 秒）
    await caption(win, CONTENT.demo.captions.tabs);
    for (let i = 0; i < CONTENT.tabs.length; i++) {
      await win.keyboard.press('Tab');
      await win.waitForTimeout(1000);
    }
    await nextScene(win);

    // 5. 案件のタブに Tab で移り、そのタブの中で議事録を日付で出す
    await caption(win, CONTENT.demo.captions.minutes);
    await win.keyboard.press('Tab');
    await win.waitForTimeout(1200);
    await win.keyboard.type(CONTENT.demo.minutes, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(2000);
    // 暗い間にタブをメインへ戻す（案件のタブから残りのタブを送って一巡させる）
    await nextScene(win, async () => {
      for (let i = 1; i < CONTENT.tabs.length; i++) {
        await win.keyboard.press('Tab');
        await win.waitForTimeout(50);
      }
    });

    // 6. メインに無いものは 0 件になり、件数の出たほかのタブ（ブックマーク）へ Tab で見に行く
    await caption(win, CONTENT.demo.captions.otherTab);
    await win.keyboard.type(CONTENT.demo.otherTab, { delay: TYPE_DELAY_MS });
    await win.waitForTimeout(1400);
    await win.keyboard.press('Tab');
    await win.waitForTimeout(2200);

    // 目印が消えてから最後までの長さ（GIF の長さ）
    const durationSec = (Date.now() - markerGone) / 1000;
    await new Promise<void>((resolve) => {
      ffmpeg.on('close', () => resolve());
      ffmpeg.stdin?.write('q');
    });
    fs.writeFileSync(
      path.join(OUT_DIR, 'meta.json'),
      JSON.stringify(
        { video: videoFile, marker: true, durationSec, width: rect.logicalWidth },
        null,
        2
      )
    );
  } finally {
    // 正常時は上で閉じ済み。途中で失敗したときだけ閉じる（2 回目の close は失敗するので握りつぶす）
    await app.close().catch(() => {});
    helper.cleanup();
  }
});
