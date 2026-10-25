import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';

/**
 * 撮影用に OS の本物のマウスを動かす（ウィンドウをまたぐドラッグ・ウィンドウの外へのドロップを撮るため）
 *
 * Playwright のマウスはページの中にしか届かず、ウィンドウをまたぐドラッグ＆ドロップを起こせない。
 * そこで PowerShell から user32 の SetCursorPos・mouse_event を呼ぶ。座標は画面の物理ピクセル
 * （Per-Monitor DPI Aware にしてから動かすので、拡大率の影響を受けない）。
 * 撮影中は実際のマウスが動くので、手を触れないこと
 */

const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DemoMouse {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
"@
[DemoMouse]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
[Console]::Out.WriteLine('ready')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null -or $line -eq 'exit') { break }
  $p = $line.Split(' ')
  switch ($p[0]) {
    'move' { [DemoMouse]::SetCursorPos([int]$p[1], [int]$p[2]) | Out-Null }
    'down' { [DemoMouse]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) }
    'up' { [DemoMouse]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) }
  }
  [Console]::Out.WriteLine('ok')
}
`;

export interface Point {
  x: number;
  y: number;
}

export class OsMouse {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private waiters: (() => void)[] = [];
  private pos: Point = { x: 0, y: 0 };

  private constructor() {
    // 標準入力は命令の受け渡しに使うので、スクリプトは -EncodedCommand（UTF-16LE の Base64）で渡す
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
    this.proc = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { stdio: 'pipe' }
    );
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (line === 'ready' || line === 'ok') this.waiters.shift()?.();
      }
    });
  }

  /** PowerShell を起こし、受け付けるまで待つ */
  static async start(): Promise<OsMouse> {
    const mouse = new OsMouse();
    await new Promise<void>((resolve) => mouse.waiters.push(resolve));
    return mouse;
  }

  private send(command: string): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      this.proc.stdin.write(command + '\r\n');
    });
  }

  async moveTo(p: Point): Promise<void> {
    this.pos = { x: Math.round(p.x), y: Math.round(p.y) };
    await this.send(`move ${this.pos.x} ${this.pos.y}`);
  }

  /** 今の位置から p まで、durationMs かけて滑らかに動かす */
  async glideTo(p: Point, durationMs: number): Promise<void> {
    const from = this.pos;
    const steps = Math.max(1, Math.round(durationMs / 16));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await this.moveTo({ x: from.x + (p.x - from.x) * ease, y: from.y + (p.y - from.y) * ease });
      await new Promise((r) => setTimeout(r, 16));
    }
  }

  async down(): Promise<void> {
    await this.send('down');
  }

  async up(): Promise<void> {
    await this.send('up');
  }

  /** 今の位置でクリックする */
  async click(): Promise<void> {
    await this.down();
    await new Promise((r) => setTimeout(r, 80));
    await this.up();
  }

  /** from で押して to で離す。ドラッグが始まるよう、押した直後に少しずつ動かす */
  async drag(from: Point, to: Point, durationMs: number): Promise<void> {
    await this.moveTo(from);
    await this.down();
    for (let i = 1; i <= 5; i++) {
      await this.moveTo({ x: from.x + i * 2, y: from.y + i });
      await new Promise((r) => setTimeout(r, 30));
    }
    await this.glideTo(to, durationMs);
    await new Promise((r) => setTimeout(r, 200));
    await this.up();
  }

  async stop(): Promise<void> {
    this.proc.stdin.write('exit\r\n');
    await new Promise<void>((resolve) => this.proc.on('close', () => resolve()));
  }
}
