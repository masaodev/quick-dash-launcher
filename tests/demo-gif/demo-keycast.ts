import type { ElectronApplication } from '@playwright/test';
import type { BrowserWindow as ElectronWindow } from 'electron';

import type { Bounds } from './demo-backdrop';

/** 押したキーを見せる帯の高さ（論理ピクセル）。撮る範囲の下にこの分を足す */
export const KEYCAST_HEIGHT = 44;

/** 帯に並べるキー（同じキーを続けて押したときは count を増やして「Tab ×3」のように見せる） */
interface Cap {
  label: string;
  /** 打った文字（1 つのキーにまとめて伸ばす）か、特別なキー（Tab・↓ など）か */
  text: boolean;
  count: number;
}

const PAGE = `<!doctype html><meta charset="utf-8"><style>
html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
body.marker { background: #ff00ff; }
#row { height: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  font-family: "Segoe UI", "Yu Gothic UI", sans-serif; }
.cap { display: inline-flex; align-items: baseline; gap: 6px; min-width: 22px; justify-content: center;
  padding: 3px 11px; background: #fff; color: #1f2937; font-size: 16px; font-weight: 700; line-height: 22px;
  border: 1px solid #8b99ad; border-bottom-width: 3px; border-radius: 7px; }
.cap.latest { animation: pop 160ms ease-out; }
.count { font-size: 13px; color: #4b5563; }
@keyframes pop { from { transform: translateY(2px) scale(0.92); } to { transform: none; } }
</style><body><div id="row"></div>
<script>
window.render = (caps, popLast) => {
  const row = document.getElementById('row');
  row.replaceChildren(...caps.map((c, i) => {
    const el = document.createElement('span');
    el.className = 'cap' + (popLast && i === caps.length - 1 ? ' latest' : '');
    el.textContent = c.label;
    if (c.count > 1) {
      const n = document.createElement('span');
      n.className = 'count';
      n.textContent = '\\u00d7' + c.count;
      el.appendChild(n);
    }
    return el;
  }));
};
window.marker = (on) => document.body.classList.toggle('marker', on);
</script>`;

/**
 * 撮影中に押したキーを、ランチャーの下の帯に並べて見せる（撮影用。アプリの画面には残らない）
 *
 * ランチャーの中に重ねると一覧の行や下端のキーの案内を隠すので、撮る範囲を下へ KEYCAST_HEIGHT だけ広げ、
 * そこに透明な別ウィンドウを置いて描く。キー操作の前に台本から show を呼ぶ（ページでキーを拾う方式だと、
 * 場面の切り替えで暗い間に打つ Ctrl+A などまで出てしまう）。打った文字は 1 つのキーに伸ばしてまとめる
 */
export class Keycast {
  private caps: Cap[] = [];

  private constructor(private readonly app: ElectronApplication) {}

  /** bounds（論理ピクセル）に帯のウィンドウを出し、focusTitle のウィンドウにフォーカスを戻す */
  static async open(
    app: ElectronApplication,
    bounds: Bounds,
    focusTitle: string
  ): Promise<Keycast> {
    await app.evaluate(
      async ({ BrowserWindow }, { b, html, title }) => {
        const w = new BrowserWindow({
          ...b,
          frame: false,
          transparent: true,
          resizable: false,
          focusable: false,
          skipTaskbar: true,
          show: false,
        });
        w.setAlwaysOnTop(true, 'screen-saver');
        await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        w.showInactive();
        (globalThis as unknown as { __keycast: ElectronWindow }).__keycast = w;
        BrowserWindow.getAllWindows()
          .find((bw) => bw.getTitle() === title)
          ?.focus();
      },
      { b: bounds, html: PAGE, title: focusTitle }
    );
    return new Keycast(app);
  }

  private async run(js: string): Promise<void> {
    await this.app.evaluate(async (_electron, code) => {
      const w = (globalThis as unknown as { __keycast?: ElectronWindow }).__keycast;
      await w?.webContents.executeJavaScript(code);
    }, js);
  }

  private async render(popLast: boolean): Promise<void> {
    await this.run(`window.render(${JSON.stringify(this.caps)}, ${popLast})`);
  }

  /** 文字を 1 つ打ったことにする（直前も文字なら、そのキーに書き足す） */
  async char(c: string): Promise<void> {
    const last = this.caps[this.caps.length - 1];
    if (last?.text) last.label += c;
    else this.caps.push({ label: c, text: true, count: 1 });
    await this.render(false);
  }

  /** 特別なキー（Tab・↓ など）を押したことにする */
  async key(label: string): Promise<void> {
    const last = this.caps[this.caps.length - 1];
    if (last && !last.text && last.label === label) last.count++;
    else this.caps.push({ label, text: false, count: 1 });
    await this.render(true);
  }

  async clear(): Promise<void> {
    this.caps = [];
    await this.render(false);
  }

  /** 録画の始まりの目印（マゼンタ）を帯にも出す。ランチャーと合わせて撮る範囲のほぼ全体を覆うため */
  async marker(on: boolean): Promise<void> {
    await this.run(`window.marker(${on})`);
  }
}
