import * as net from 'net';

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@common/logger', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { startCliServer } from './cliServer';
import { CLI_EXIT, CLI_PROTOCOL_VERSION, cliResponse } from './cliProtocol';
import type { CliResponse } from './cliProtocol';

const servers: net.Server[] = [];

function uniquePipeName(): string {
  return (
    String.raw`\\.\pipe\qdl-cli-test-` + `${process.pid}-${Math.random().toString(36).slice(2)}`
  );
}

/** qdl.exe と同じく、1 行送って接続が閉じるまで読む */
function send(pipeName: string, payload: string): Promise<CliResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(pipeName);
    let data = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(payload));
    socket.on('data', (chunk: string) => (data += chunk));
    socket.on('end', () => resolve(JSON.parse(data)));
    socket.on('error', reject);
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe.runIf(process.platform === 'win32')('startCliServer', () => {
  it('依頼を処理して応答を返す（日本語を含む）', async () => {
    const pipeName = uniquePipeName();
    const handle = vi.fn(async () => cliResponse(CLI_EXIT.ok, '{"表示名":"メモ"}\n'));
    const server = await startCliServer(pipeName, handle);
    expect(server).not.toBeNull();
    servers.push(server!);

    const res = await send(
      pipeName,
      JSON.stringify({ protocol: CLI_PROTOCOL_VERSION, argv: ['status'], cwd: 'C:\\' }) + '\n'
    );
    expect(res).toEqual({
      protocol: CLI_PROTOCOL_VERSION,
      exitCode: 0,
      stdout: '{"表示名":"メモ"}\n',
      stderr: '',
    });
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ argv: ['status'] }));
  });

  it('版が合わない依頼は処理せずに断る', async () => {
    const pipeName = uniquePipeName();
    const handle = vi.fn();
    servers.push((await startCliServer(pipeName, handle))!);

    const res = await send(pipeName, JSON.stringify({ protocol: 99, argv: [] }) + '\n');
    expect(res.exitCode).toBe(CLI_EXIT.protocol);
    expect(handle).not.toHaveBeenCalled();
  });

  it('処理中の例外は failure の終了コードで返す', async () => {
    const pipeName = uniquePipeName();
    servers.push(
      (await startCliServer(pipeName, async () => {
        throw new Error('壊れた');
      }))!
    );

    const res = await send(
      pipeName,
      JSON.stringify({ protocol: CLI_PROTOCOL_VERSION, argv: ['reload'], cwd: '' }) + '\n'
    );
    expect(res.exitCode).toBe(CLI_EXIT.failure);
    expect(res.stderr).toContain('壊れた');
  });

  it('同じ名前で待ち受け中なら null を返し、例外を投げない', async () => {
    const pipeName = uniquePipeName();
    servers.push((await startCliServer(pipeName, vi.fn()))!);
    await expect(startCliServer(pipeName, vi.fn())).resolves.toBeNull();
  });
});
