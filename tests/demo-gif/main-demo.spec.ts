import fs from 'fs';
import os from 'os';
import path from 'path';

import type { Page } from '@playwright/test';

import { test } from '../e2e/fixtures/electron-app';
import { TestUtils } from '../e2e/helpers/test-utils';

/**
 * README のメインデモ GIF の素材（1 操作ごとのスクリーンショット）を撮る
 *
 * デモデータは tests/e2e/templates/demo/。アイテムのパスは %TEMP%\qdl-demo\ を指すので、
 * 撮影前にそこへ空のフォルダとファイルを作り、フォルダや Office ファイルのアイコンが出るようにする。
 * 撮った画像と表示時間は test-results/demo-gif/main/ に置き、scripts/make-demo-gif.mjs が GIF にまとめる
 */

const FRAME_DIR = path.join(process.cwd(), 'test-results', 'demo-gif', 'main');
const DEMO_ROOT = path.join(os.tmpdir(), 'qdl-demo');

const DEMO_FILES = [
  'A社/議事録/2026-10-01_定例.docx',
  'A社/見積書_v3.xlsx',
  'A社/要件定義書.docx',
  'B社/議事録/2026-09-28_キックオフ.docx',
  'B社/見積書.xlsx',
  'B社/提案資料.pptx',
];

type Frame = { file: string; durationMs: number };

class FrameRecorder {
  private frames: Frame[] = [];

  constructor(private readonly page: Page) {
    fs.rmSync(FRAME_DIR, { recursive: true, force: true });
    fs.mkdirSync(FRAME_DIR, { recursive: true });
  }

  /** 画面下に操作の説明を出す（撮影用。アプリの画面には残らない） */
  async caption(text: string): Promise<void> {
    await this.page.evaluate((captionText) => {
      let el = document.getElementById('demo-caption');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-caption';
        Object.assign(el.style, {
          position: 'fixed',
          left: '0',
          right: '0',
          bottom: '0',
          padding: '10px 16px',
          background: 'rgba(20, 20, 20, 0.82)',
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

  async shot(durationMs: number): Promise<void> {
    await this.page.waitForTimeout(250);
    const file = `frame-${String(this.frames.length + 1).padStart(3, '0')}.png`;
    await this.page.screenshot({ path: path.join(FRAME_DIR, file), animations: 'disabled' });
    this.frames.push({ file, durationMs });
  }

  /** 1 文字ずつ打ち、打つたびに撮る */
  async typeSlowly(text: string, perCharMs: number, lastHoldMs: number): Promise<void> {
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      await this.page.keyboard.insertText(chars[i]);
      await this.shot(i === chars.length - 1 ? lastHoldMs : perCharMs);
    }
  }

  save(): void {
    fs.writeFileSync(path.join(FRAME_DIR, 'frames.json'), JSON.stringify(this.frames, null, 2));
  }
}

test.use({ configTemplate: 'demo' });

test.beforeAll(() => {
  for (const rel of DEMO_FILES) {
    const full = path.join(DEMO_ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (!fs.existsSync(full)) fs.writeFileSync(full, '');
  }
});

test('メインデモ', async ({ mainWindow }) => {
  test.setTimeout(120000);
  const utils = new TestUtils(mainWindow);
  await utils.waitForPageLoad();

  // アイコンを取得してから撮る（Web サイトのファビコン取得にネットワークを使う）
  await mainWindow.locator('.missing-icon-notice button', { hasText: '取得' }).click();
  await mainWindow
    .locator('button[aria-label="詳細を表示"]')
    .waitFor({ state: 'visible', timeout: 45000 });
  await mainWindow.locator('.progress-close-btn').click();
  // 閉じたときのマウス位置で選択が動くので、マウスを検索欄へ戻す
  await mainWindow.mouse.move(10, 10);

  const searchInput = mainWindow.locator('input[type="text"]').first();
  await searchInput.fill('x');
  await searchInput.fill('');
  await searchInput.focus();

  const rec = new FrameRecorder(mainWindow);

  await rec.caption('Alt+Space で呼び出し。案件ごとのタブに、フォルダ・資料・Web・チャットが並ぶ');
  await rec.shot(2600);

  await rec.caption('名前の一部を打つと、1 文字ごとに候補が絞られる');
  await rec.typeSlowly('議事', 500, 1600);

  await rec.caption('ほかのタブの一致件数も出る。Tab キーで B社 へ');
  await rec.shot(1600);
  await mainWindow.keyboard.press('Tab');
  await rec.caption('Tab キーで、一致したほかのタブへ移れる');
  await rec.shot(2000);

  await searchInput.fill('');
  await rec.caption('「見積」→ B社 の見積書。Enter ですぐ開く');
  await rec.typeSlowly('見積', 500, 2200);

  await searchInput.fill('');
  await rec.caption('Teams のチャットも、同じように呼び出せる');
  await rec.typeSlowly('チャット', 300, 2600);

  rec.save();
});
