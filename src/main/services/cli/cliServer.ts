import * as net from 'net';

import { createChildLogger } from '@common/logger';

import { mainI18n } from '../mainI18n.js';

import {
  CLI_EXIT,
  CLI_MAX_REQUEST_BYTES,
  cliResponse,
  isCliResponse,
  parseCliRequest,
} from './cliProtocol.js';
import type { CliRequest, CliResponse } from './cliProtocol.js';

const cliLogger = createChildLogger('cli');

export type CliRequestHandler = (req: CliRequest) => Promise<CliResponse>;

/**
 * CLI（qdl.exe）からの依頼を名前付きパイプで受け付ける
 *
 * パイプの既定の権限では、書き込めるのは作成したユーザー・Administrators・SYSTEM だけなので、
 * 同じ PC の別ユーザーからは依頼できない。
 * 待ち受けに失敗しても本体の動作は止めない（CLI が使えないだけ）。
 */
export function startCliServer(
  pipeName: string,
  handle: CliRequestHandler
): Promise<net.Server | null> {
  const server = net.createServer((socket) => {
    let buffer = '';
    let done = false;

    const reply = (response: CliResponse): void => {
      if (done) return;
      done = true;
      socket.end(JSON.stringify(response) + '\n');
    };

    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      if (done) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer, 'utf8') > CLI_MAX_REQUEST_BYTES) {
        reply(cliResponse(CLI_EXIT.protocol, '', mainI18n.t('cli.errors.tooLarge') + '\n'));
        return;
      }
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;

      const parsed = parseCliRequest(buffer.slice(0, newline));
      if (isCliResponse(parsed)) {
        reply(parsed);
        return;
      }
      cliLogger.info({ argv: parsed.argv }, 'CLI の依頼を受け付けました');
      handle(parsed)
        .then(reply)
        .catch((error: unknown) => {
          cliLogger.error({ error }, 'CLI の依頼の処理に失敗しました');
          const message = error instanceof Error ? error.message : String(error);
          reply(
            cliResponse(CLI_EXIT.failure, '', mainI18n.t('cli.errors.failed', { message }) + '\n')
          );
        });
    });
    socket.on('error', (error) => {
      cliLogger.warn({ error }, 'CLI との接続でエラーが発生しました');
    });
  });

  return new Promise((resolve) => {
    server.once('error', (error) => {
      cliLogger.warn({ error, pipeName }, 'CLI の待ち受けを開始できませんでした');
      resolve(null);
    });
    server.listen(pipeName, () => {
      cliLogger.info({ pipeName }, 'CLI の待ち受けを開始しました');
      resolve(server);
    });
  });
}
