/**
 * Windows の CreateEnvironmentBlock で、ユーザーの標準の環境変数を作る
 *
 * ログオン直後の新しいプロセスが受け取るのと同じもの（システムの変数・ユーザーの変数・
 * Volatile Environment・USERPROFILE などの自動の値）を Windows が組み立てて返す。
 * QuickDashLauncher 自身の環境（起動したシェルや Claude Code が足した変数を含む）は混ぜない（bInherit = FALSE）。
 * REG_EXPAND_SZ の展開や PATH の連結（システム → ユーザー）も Windows に任せる。
 */
import koffi from 'koffi';

const TOKEN_DUPLICATE = 0x0002;
const TOKEN_QUERY = 0x0008;

const kernel32 = koffi.load('kernel32.dll');
const advapi32 = koffi.load('advapi32.dll');
const userenv = koffi.load('userenv.dll');

const GetCurrentProcess = kernel32.func('void* __stdcall GetCurrentProcess()');
const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void* handle)');
const OpenProcessToken = advapi32.func(
  'bool __stdcall OpenProcessToken(void* process, uint32 access, _Out_ void** token)'
);
const CreateEnvironmentBlock = userenv.func(
  'bool __stdcall CreateEnvironmentBlock(_Out_ void** environment, void* token, bool inherit)'
);
const DestroyEnvironmentBlock = userenv.func(
  'bool __stdcall DestroyEnvironmentBlock(void* environment)'
);

/**
 * ユーザーの標準の環境変数を「名前=値」の並びで返す
 *
 * 作れなかったら投げる（呼び出し側は QuickDashLauncher の環境変数のまま起動する）
 */
export function createStandardEnvironmentEntries(): string[] {
  const token: [unknown] = [null];
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | TOKEN_DUPLICATE, token)) {
    throw new Error('OpenProcessToken failed');
  }
  const block: [unknown] = [null];
  try {
    if (!CreateEnvironmentBlock(block, token[0], false)) {
      throw new Error('CreateEnvironmentBlock failed');
    }
  } finally {
    CloseHandle(token[0]);
  }
  try {
    // 「名前=値\0名前=値\0\0」の形（UTF-16）。空の文字列が来たら終わり
    const entries: string[] = [];
    let offset = 0;
    for (;;) {
      const entry = koffi.decode(block[0], offset, 'char16_t', -1) as string;
      if (!entry) break;
      entries.push(entry);
      offset += (entry.length + 1) * 2;
    }
    return entries;
  } finally {
    DestroyEnvironmentBlock(block[0]);
  }
}
