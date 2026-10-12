/**
 * 大きさの上限つきのログファイル
 *
 * 書く前に大きさを数え、上限を超えそうなら main.log → main.1.log → main.2.log … と回し、
 * 一番古いものを消す。起動しっぱなしでも 1 ファイルは上限まで（1 行が上限より大きいときだけその 1 行分超える）。
 * ロガーから呼ばれるので、ここで失敗してもロガーには書かない（書くと自分が呼ばれて止まらない）。
 *
 * 失敗したときは止めっぱなしにしない。Windows ではウイルス対策ソフトや検索のインデックス、
 * ログを開いているエディタがファイルを一時的に掴み、名前の変更が失敗することがある
 * - 回すのに失敗: 今のファイルに書き続け、少し待ってからもう一度回す
 * - 書くのに失敗: その行は捨て、少し待ってから開き直す
 */

import * as fs from 'fs';
import * as path from 'path';

export interface RotatingLogFileOptions {
  /** 1 ファイルの上限（バイト） */
  maxBytes?: number;
  /** 残す古い世代の数（main.1.log〜main.N.log） */
  generations?: number;
  /** ファイル名の元（main → main.log・main.1.log） */
  baseName?: string;
  /** 失敗したあと、もう一度試すまでの間（ミリ秒） */
  retryAfterMs?: number;
  /** テスト用: 今の時刻 */
  now?: () => number;
}

export class RotatingLogFile {
  private readonly maxBytes: number;
  private readonly generations: number;
  private readonly baseName: string;
  private readonly retryAfterMs: number;
  private readonly now: () => number;
  private fd: number | null = null;
  private size = 0;
  /** この時刻までは開き直さない（書くのに失敗したとき） */
  private pausedUntil = 0;
  /** この時刻までは回さない（回すのに失敗したとき） */
  private rotateAfter = 0;

  constructor(
    private readonly dir: string,
    options: RotatingLogFileOptions = {}
  ) {
    this.maxBytes = options.maxBytes ?? 1024 * 1024;
    this.generations = options.generations ?? 2;
    this.baseName = options.baseName ?? 'main';
    this.retryAfterMs = options.retryAfterMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  /** n 世代目のファイルのパス（0 が今書いているファイル） */
  filePath(generation = 0): string {
    const suffix = generation === 0 ? '' : `.${generation}`;
    return path.join(this.dir, `${this.baseName}${suffix}.log`);
  }

  write(line: string): void {
    if (this.now() < this.pausedUntil) return;
    try {
      if (this.fd === null) this.open();
      const bytes = Buffer.byteLength(line);
      if (this.size > 0 && this.size + bytes > this.maxBytes) this.tryRotate();
      fs.writeSync(this.fd!, line);
      this.size += bytes;
    } catch {
      // ディスクがいっぱい・権限が無いなど。この行は捨て、少し待ってから開き直す
      this.close();
      this.pausedUntil = this.now() + this.retryAfterMs;
    }
  }

  close(): void {
    if (this.fd === null) return;
    try {
      fs.closeSync(this.fd);
    } catch {
      // 閉じられなくても続ける
    }
    this.fd = null;
  }

  private open(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    this.fd = fs.openSync(this.filePath(), 'a');
    this.size = fs.fstatSync(this.fd).size;
  }

  /** 回す。失敗したら今のファイルに書き続け、少し待ってからもう一度試す */
  private tryRotate(): void {
    if (this.now() < this.rotateAfter) return;
    this.close();
    try {
      fs.rmSync(this.filePath(this.generations), { force: true });
      for (let generation = this.generations - 1; generation >= 0; generation--) {
        const from = this.filePath(generation);
        if (fs.existsSync(from)) fs.renameSync(from, this.filePath(generation + 1));
      }
    } catch {
      this.rotateAfter = this.now() + this.retryAfterMs;
    }
    this.open();
  }
}
