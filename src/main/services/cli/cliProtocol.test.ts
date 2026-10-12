import { describe, it, expect } from 'vitest';

import {
  CLI_EXIT,
  CLI_PROTOCOL_VERSION,
  getCliPipeName,
  isCliResponse,
  parseCliRequest,
} from './cliProtocol';

describe('getCliPipeName', () => {
  it('userData のフォルダ名とユーザー名から作る（qdl.exe と同じ規則）', () => {
    expect(getCliPipeName('quick-dash-launcher', 'taro')).toBe(
      String.raw`\\.\pipe\quick-dash-launcher-cli-taro`
    );
    expect(getCliPipeName('dev-quick-dash-launcher', 'taro')).toBe(
      String.raw`\\.\pipe\dev-quick-dash-launcher-cli-taro`
    );
  });
});

describe('parseCliRequest', () => {
  it('正しい依頼を読む', () => {
    const parsed = parseCliRequest(
      JSON.stringify({
        protocol: CLI_PROTOCOL_VERSION,
        argv: ['status'],
        cwd: 'C:\\',
        cliVersion: '0.1.0',
      })
    );
    expect(isCliResponse(parsed)).toBe(false);
    expect(parsed).toEqual({
      protocol: CLI_PROTOCOL_VERSION,
      argv: ['status'],
      cwd: 'C:\\',
      cliVersion: '0.1.0',
    });
  });

  it('JSON でなければ protocol の終了コードで返す', () => {
    const parsed = parseCliRequest('not json');
    expect(isCliResponse(parsed) && parsed.exitCode).toBe(CLI_EXIT.protocol);
  });

  it('版が違えば、両方の版を示して断る', () => {
    const parsed = parseCliRequest(JSON.stringify({ protocol: 99, argv: [] }));
    expect(isCliResponse(parsed)).toBe(true);
    if (!isCliResponse(parsed)) return;
    expect(parsed.exitCode).toBe(CLI_EXIT.protocol);
    expect(parsed.stderr).toContain('CLI: 99');
    expect(parsed.protocol).toBe(CLI_PROTOCOL_VERSION);
  });

  it('argv が文字列の配列でなければ断る', () => {
    const parsed = parseCliRequest(JSON.stringify({ protocol: CLI_PROTOCOL_VERSION, argv: [1] }));
    expect(isCliResponse(parsed) && parsed.exitCode).toBe(CLI_EXIT.protocol);
  });
});
