/**
 * Windows の ShellExecuteExW を verb "runas" で呼び、管理者としてプログラムを起動する
 *
 * Electron には管理者で開く API が無いので koffi で呼ぶ。UAC の確認が閉じるまで戻らないので、
 * 非同期呼び出し（.async）にして本体を止めない。
 * 失敗の理由（GetLastError）は、koffi が非同期呼び出しの値を完了のコールバックの中に持ち越すので、
 * コールバックの中で読む
 */
import koffi from 'koffi';

const SEE_MASK_NOASYNC = 0x00000100;
/** lpFile・lpDirectory の環境変数（%USERPROFILE% など）を展開する */
const SEE_MASK_DOENVSUBST = 0x00000200;
/** 失敗しても Windows のエラーダイアログを出さない（知らせるのは QuickDashLauncher のトースト） */
const SEE_MASK_FLAG_NO_UI = 0x00000400;
const SW_SHOWNORMAL = 1;
/** GetLastError が 0 を返したとき（ふつうは無い）に返す値（ERROR_GEN_FAILURE） */
const ERROR_GEN_FAILURE = 31;

const SHELLEXECUTEINFOW = koffi.struct('SHELLEXECUTEINFOW', {
  cbSize: 'uint32',
  fMask: 'uint32',
  hwnd: 'void*',
  lpVerb: 'str16',
  lpFile: 'str16',
  lpParameters: 'str16',
  lpDirectory: 'str16',
  nShow: 'int',
  hInstApp: 'void*',
  lpIDList: 'void*',
  lpClass: 'str16',
  hkeyClass: 'void*',
  dwHotKey: 'uint32',
  hIconOrMonitor: 'void*',
  hProcess: 'void*',
});

const shell32 = koffi.load('shell32.dll');
const kernel32 = koffi.load('kernel32.dll');
const ShellExecuteExW = shell32.func('ShellExecuteExW', 'bool', [koffi.pointer(SHELLEXECUTEINFOW)]);
const GetLastError = kernel32.func('GetLastError', 'uint32', []);

/** 管理者として起動するときに ShellExecuteExW に渡すもの */
export interface RunAsRequest {
  /** 起動するファイル（exe・.lnk・.bat など。ファイル名だけなら Windows が PATH から探す） */
  file: string;
  /** 引数（無ければ渡さない） */
  parameters?: string;
  /** 作業フォルダ（無ければ渡さない） */
  directory?: string;
}

/**
 * 管理者として起動する
 *
 * @returns Win32 のエラーコード（0 なら起動できた。UAC で「いいえ」を押したときは 1223）
 */
export function shellExecuteRunAs(request: RunAsRequest): Promise<number> {
  const info = {
    cbSize: koffi.sizeof(SHELLEXECUTEINFOW),
    fMask: SEE_MASK_NOASYNC | SEE_MASK_DOENVSUBST | SEE_MASK_FLAG_NO_UI,
    hwnd: null,
    lpVerb: 'runas',
    lpFile: request.file,
    lpParameters: request.parameters ?? null,
    lpDirectory: request.directory ?? null,
    nShow: SW_SHOWNORMAL,
    hInstApp: null,
    lpIDList: null,
    lpClass: null,
    hkeyClass: null,
    dwHotKey: 0,
    hIconOrMonitor: null,
    hProcess: null,
  };
  return new Promise((resolve, reject) => {
    ShellExecuteExW.async(info, (error: unknown, succeeded: boolean) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      resolve(succeeded ? 0 : GetLastError() || ERROR_GEN_FAILURE);
    });
  });
}
