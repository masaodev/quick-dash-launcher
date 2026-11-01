//! 本体が使う補助コマンド `qdl __shell-open <開くもの> [作業フォルダ]`
//!
//! 本体（Electron）の shell.openPath・shell.openExternal は、開いたアプリに渡す環境変数を選べない。
//! 本体はこの exe を「ユーザーの標準の環境変数」で起動し、ここで ShellExecuteExW を呼ぶ。開いたアプリは
//! この exe の環境を受け継ぐので、本体の環境（本体を起動したシェルなどが足した変数）が届かない。
//! 本体とのパイプは使わない（中継の原則の例外。利用者が打つコマンドではないので、ヘルプにも出さない）。
//!
//! 終了コード: 0 = 開いた／それ以外 = ShellExecuteExW が失敗したときの Win32 のエラーコード
//!（UAC で「いいえ」= 1223、見つからない = 2・3、関連付けが無い = 1155 など）

use std::ffi::{c_void, OsStr};
use std::os::windows::ffi::OsStrExt;
use std::ptr::null_mut;

/// 補助コマンドの名前（本体の SHELL_OPEN_COMMAND と合わせる）
pub const COMMAND: &str = "__shell-open";

/// 引数の誤り（Win32 のエラーコードと重ならない値。ERROR_INVALID_PARAMETER）
const EXIT_USAGE: i32 = 87;
/// GetLastError が 0 を返したとき（ふつうは無い）の値（ERROR_GEN_FAILURE）
const ERROR_GEN_FAILURE: i32 = 31;

const SEE_MASK_NOASYNC: u32 = 0x0000_0100;
const SEE_MASK_FLAG_NO_UI: u32 = 0x0000_0400;
const SW_SHOWNORMAL: i32 = 1;
const COINIT_APARTMENTTHREADED: u32 = 0x2;
const COINIT_DISABLE_OLE1DDE: u32 = 0x4;
/// AllowSetForegroundWindow に渡す「どのプロセスでも」
const ASFW_ANY: u32 = u32::MAX;

#[repr(C)]
#[allow(non_snake_case)]
struct ShellExecuteInfoW {
    cbSize: u32,
    fMask: u32,
    hwnd: *mut c_void,
    lpVerb: *const u16,
    lpFile: *const u16,
    lpParameters: *const u16,
    lpDirectory: *const u16,
    nShow: i32,
    hInstApp: *mut c_void,
    lpIDList: *mut c_void,
    lpClass: *const u16,
    hkeyClass: *mut c_void,
    dwHotKey: u32,
    hIconOrMonitor: *mut c_void,
    hProcess: *mut c_void,
}

#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteExW(info: *mut ShellExecuteInfoW) -> i32;
}
#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(reserved: *mut c_void, coinit: u32) -> i32;
}
#[link(name = "user32")]
extern "system" {
    fn AllowSetForegroundWindow(process_id: u32) -> i32;
}
#[link(name = "kernel32")]
extern "system" {
    fn GetLastError() -> u32;
}

fn wide(text: &str) -> Vec<u16> {
    OsStr::new(text).encode_wide().chain(Some(0)).collect()
}

/// `__shell-open` の引数（開くもの・作業フォルダ）を読む
pub fn parse_args(args: &[String]) -> Option<(&str, Option<&str>)> {
    match args {
        [target] if !target.is_empty() => Some((target, None)),
        [target, dir] if !target.is_empty() => Some((target, (!dir.is_empty()).then_some(dir.as_str()))),
        _ => None,
    }
}

/// 開いて、終了コードを返す
pub fn run(args: &[String]) -> i32 {
    let Some((target, dir)) = parse_args(args) else {
        eprintln!("qdl: 使い方: qdl {COMMAND} <開くもの> [作業フォルダ]");
        return EXIT_USAGE;
    };
    let file = wide(target);
    let directory = dir.map(wide);
    // 本体から受け継いだ前面に出す権利を、開くアプリへ渡す（渡さないと、開いたウィンドウが後ろに出ることがある）
    // SAFETY: 引数は定数。失敗しても前面に出ないだけ
    unsafe {
        AllowSetForegroundWindow(ASFW_ANY);
    }
    // シェルの拡張が COM を使うので、ShellExecuteExW の前に STA で初期化する（Microsoft の推奨）
    // SAFETY: このスレッドで 1 回だけ呼ぶ。失敗しても ShellExecuteExW は試す
    unsafe {
        CoInitializeEx(null_mut(), COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
    }
    let mut info = ShellExecuteInfoW {
        cbSize: std::mem::size_of::<ShellExecuteInfoW>() as u32,
        // NOASYNC: 開き終わるまで戻らない（すぐ終わるプロセスから呼ぶため）。FLAG_NO_UI: 失敗のダイアログを出さない
        //（知らせるのは本体のトースト）
        fMask: SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI,
        hwnd: null_mut(),
        lpVerb: std::ptr::null(),
        lpFile: file.as_ptr(),
        lpParameters: std::ptr::null(),
        lpDirectory: directory.as_ref().map_or(std::ptr::null(), |d| d.as_ptr()),
        nShow: SW_SHOWNORMAL,
        hInstApp: null_mut(),
        lpIDList: null_mut(),
        lpClass: std::ptr::null(),
        hkeyClass: null_mut(),
        dwHotKey: 0,
        hIconOrMonitor: null_mut(),
        hProcess: null_mut(),
    };
    // SAFETY: info とその中の文字列は、呼び出しの間ずっと生きている
    if unsafe { ShellExecuteExW(&mut info) } != 0 {
        return 0;
    }
    // SAFETY: 引数なし
    match unsafe { GetLastError() } as i32 {
        0 => ERROR_GEN_FAILURE,
        code => code,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(items: &[&str]) -> Vec<String> {
        items.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn parses_target_and_optional_directory() {
        assert_eq!(parse_args(&s(&["C:\\a.txt"])), Some(("C:\\a.txt", None)));
        assert_eq!(parse_args(&s(&["C:\\a.txt", "C:\\"])), Some(("C:\\a.txt", Some("C:\\"))));
        assert_eq!(parse_args(&s(&["https://example.com", ""])), Some(("https://example.com", None)));
    }

    #[test]
    fn rejects_missing_or_extra_arguments() {
        assert_eq!(parse_args(&s(&[])), None);
        assert_eq!(parse_args(&s(&[""])), None);
        assert_eq!(parse_args(&s(&["a", "b", "c"])), None);
    }

    #[test]
    fn struct_size_matches_windows_x64() {
        // SHELLEXECUTEINFOW は 64 ビットで 112 バイト
        assert_eq!(std::mem::size_of::<ShellExecuteInfoW>(), 112);
    }
}
