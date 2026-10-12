/**
 * assets/icon.svg から Store 版（appx）のロゴ画像を build/appx/ に作る。
 * electron-builder は build/appx/ の画像をパッケージに入れ、拡大率ごとの画像があれば resources.pri も作る。
 * SVG の描画には Electron の非表示ウィンドウの canvas を使う（Electron で実行する）
 *
 * 使い方: electron scripts/generate-appx-assets.mjs（npm run dist:appx から呼ばれる）
 */
import fs from 'fs';
import path from 'path';

import { app, BrowserWindow } from 'electron';

const svg = fs.readFileSync(path.join(process.cwd(), 'assets', 'icon.svg'), 'utf8');
const outDir = path.join(process.cwd(), 'build', 'appx');

// [ファイル名, 幅, 高さ, アイコンの大きさ（高さに対する割合）]
const scales = [100, 125, 150, 200, 400];
const targets = [];
for (const s of scales) {
  const k = s / 100;
  targets.push([`StoreLogo.scale-${s}.png`, 50 * k, 50 * k, 1]);
  targets.push([`Square44x44Logo.scale-${s}.png`, 44 * k, 44 * k, 1]);
  targets.push([`Square150x150Logo.scale-${s}.png`, 150 * k, 150 * k, 0.66]);
  targets.push([`Wide310x150Logo.scale-${s}.png`, 310 * k, 150 * k, 0.66]);
}
// タスクバー・スタートメニュー・タスク マネージャーの小さいアイコン（unplated＝背景の板なし）
for (const t of [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256]) {
  targets.push([`Square44x44Logo.targetsize-${t}.png`, t, t, 1]);
  targets.push([`Square44x44Logo.targetsize-${t}_altform-unplated.png`, t, t, 1]);
}

app
  .whenReady()
  .then(async () => {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const win = new BrowserWindow({ show: false });
    await win.loadURL('data:text/html,<html></html>');
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    for (const [name, w, h, ratio] of targets) {
      const width = Math.round(w);
      const height = Math.round(h);
      const size = Math.round(height * ratio);
      // ページの canvas に SVG を描き、PNG の data URL で受け取る
      const dataUrl = await win.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = ${width};
          canvas.height = ${height};
          canvas.getContext('2d').drawImage(img, ${(width - size) / 2}, ${(height - size) / 2}, ${size}, ${size});
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('SVG の読み込みに失敗'));
        img.src = ${JSON.stringify(svgUrl)};
      })
    `);
      fs.writeFileSync(path.join(outDir, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    win.destroy();
    console.log(`${targets.length} images -> ${path.relative(process.cwd(), outDir)}`);
    app.quit();
  })
  .catch((error) => {
    // 失敗しても隠しウィンドウが残って終わらなくならないよう、終了コード 1 で抜ける
    console.error(error);
    app.exit(1);
  });
