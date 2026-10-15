/**
 * 既定のブラウザ（https を開くプログラム）を Windows に問い合わせる
 *
 * 登録・編集画面の「変換」で、URL をブラウザの新しいウィンドウなどで開く形にするときに使う。
 * レジストリを自分で読むと UserChoice と UserChoiceLatest（Windows 11 の新しい版）の両方を見る必要があるので、
 * AssocQueryStringW に任せる
 */
import koffi from 'koffi';
import type { DefaultBrowser } from '@common/itemConversions';

const ASSOCF_IS_PROTOCOL = 0x00001000;
const ASSOCSTR_EXECUTABLE = 2;
const ASSOCSTR_FRIENDLYAPPNAME = 4;
/** 返す文字列の最大の長さ（文字数） */
const BUFFER_CHARS = 1024;

const shlwapi = koffi.load('shlwapi.dll');
const AssocQueryStringW = shlwapi.func('AssocQueryStringW', 'long', [
  'uint32', // flags
  'uint32', // str
  'str16', // pszAssoc
  'str16', // pszExtra
  'void*', // pszOut
  koffi.inout(koffi.pointer('uint32')), // pcchOut
]);

function queryHttps(kind: number): string | null {
  const size = [BUFFER_CHARS];
  const buffer = Buffer.alloc(BUFFER_CHARS * 2);
  const hr = AssocQueryStringW(ASSOCF_IS_PROTOCOL, kind, 'https', 'open', buffer, size);
  if (hr !== 0) return null;
  // 返る文字数は終端の NUL を含む
  const value = buffer
    .toString('utf16le')
    .substring(0, Math.max(0, size[0] - 1))
    .trim();
  return value || null;
}

/** 既定のブラウザの exe と表示名。取れなければ null */
export function getDefaultBrowser(): DefaultBrowser | null {
  try {
    const exePath = queryHttps(ASSOCSTR_EXECUTABLE);
    if (!exePath) return null;
    const name = queryHttps(ASSOCSTR_FRIENDLYAPPNAME) ?? exePath.split('\\').pop() ?? exePath;
    return { exePath, name };
  } catch {
    return null;
  }
}
