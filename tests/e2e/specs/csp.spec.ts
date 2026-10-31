import type { ElectronApplication, Page } from '@playwright/test';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

/**
 * ビルドした画面に CSP が入り、注入されたインラインスクリプトが動かない（scripts/viteCspPlugin.ts）
 *
 * E2E はビルドした dist を起動するので、ここで見る CSP は出荷するものと同じ。
 * page.evaluate 自体は CSP の対象外なので、<script> 要素を差し込んで実行されるかで確かめる
 */
async function injectedInlineScriptRuns(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const w = window as unknown as { __cspProbe?: boolean };
    delete w.__cspProbe;
    const script = document.createElement('script');
    script.textContent = 'window.__cspProbe = true';
    document.head.appendChild(script);
    await new Promise((resolve) => setTimeout(resolve, 100));
    script.remove();
    return w.__cspProbe === true;
  });
}

async function cspOf(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      document
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.getAttribute('content') ?? ''
  );
}

/** 開いているウィンドウのうち、トーストを書き込まれたもの（オーバーレイ）を探す */
async function findOverlay(electronApp: ElectronApplication): Promise<Page | undefined> {
  for (const win of electronApp.windows()) {
    if (win.isClosed()) continue;
    if ((await win.locator('#toast').count()) > 0) return win;
  }
  return undefined;
}

test.describe('QuickDashLauncher - CSP', () => {
  test('ランチャーに CSP があり、差し込んだインラインスクリプトは動かない', async ({
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    const csp = await cspOf(mainWindow);
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    expect(await injectedInlineScriptRuns(mainWindow)).toBe(false);
    // 画面自体（React）は動いている
    await expect(mainWindow.locator('.search-input, input[type="text"]').first()).toBeVisible();
  });

  test('管理ウィンドウにも CSP が効く', async ({ electronApp, mainWindow }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();
    const adminWindow = await utils.openAdminWindow(electronApp, 'settings');

    expect(await cspOf(adminWindow)).toContain("script-src 'self'");
    expect(await injectedInlineScriptRuns(adminWindow)).toBe(false);
  });

  test('オーバーレイのインラインスクリプトは動き、読めないアイコンは既定のアイコンになる', async ({
    electronApp,
    mainWindow,
  }) => {
    const utils = new TestUtils(mainWindow);
    await utils.waitForPageLoad();

    await mainWindow.evaluate(() =>
      window.electronAPI.showToastWindow({
        itemType: 'url',
        displayName: 'E2E CSP トースト',
        path: 'https://example.com/',
        // 壊れた画像。onerror の代わりの error の監視が既定のアイコンに差し替える
        icon: 'data:image/png;base64,AAAA',
        type: 'success',
        long: true,
      })
    );

    let overlay: Page | undefined;
    await expect
      .poll(
        async () => {
          overlay = await findOverlay(electronApp);
          return overlay ? overlay.locator('#toast').innerText() : '';
        },
        { timeout: 5000 }
      )
      .toContain('E2E CSP トースト');

    // 子ウィンドウは開き元の CSP を引き継いだうえで、書き込まれた HTML の CSP も効く
    expect(await cspOf(overlay!)).toContain("script-src 'self'");
    expect(await injectedInlineScriptRuns(overlay!)).toBe(false);
    await expect(overlay!.locator('.toast-icon-wrapper .default-icon')).toHaveText('🌐');
    await expect(overlay!.locator('.toast-icon-wrapper img')).toHaveCount(0);
  });
});
