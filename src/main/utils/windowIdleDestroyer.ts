/**
 * 非表示のまま一定時間経過したウィンドウを破棄するためのアイドルタイマー。
 *
 * hide して常駐するウィンドウはレンダラープロセス（実測で1枚約100MB）を
 * 保持し続けるため、しばらく使われなければ破棄してメモリを解放する。
 * 次回表示時は各マネージャーの遅延生成で再作成される。
 */
export class WindowIdleDestroyer {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private idleMs: number,
    private destroyFn: () => void
  ) {}

  /** 非表示になったタイミングで呼ぶ。既存のタイマーは張り直す */
  schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.destroyFn();
    }, this.idleMs);
  }

  /** 再表示・明示破棄のタイミングで呼ぶ */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
