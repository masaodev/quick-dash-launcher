//! QuickDashLauncher の CLI（qdl.exe）
//!
//! 引数の解釈・ヘルプ・検証はすべて起動中の本体（Electron のメインプロセス）が行い、
//! この exe は名前付きパイプで依頼を中継するだけ。コマンドを増やしても、ここは変えない。
//!
//! やり取り（1 回の接続で 1 往復。どちらも JSON 1 行）:
//!   依頼: {"protocol":1,"argv":[...],"cwd":"...","cliVersion":"..."}
//!   応答: {"protocol":1,"exitCode":0,"stdout":"...","stderr":"..."}

use std::env;
use std::fs::{File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::process::{Command, ExitCode, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

/// 本体と取り決めたやり取りの版。本体側の CLI_PROTOCOL_VERSION と合わせる
const PROTOCOL_VERSION: u32 = 1;

const EXIT_NOT_AVAILABLE: u8 = 3;
const EXIT_PROTOCOL: u8 = 4;

/// 本体を起動してからパイプが開くまで待つ上限
const LAUNCH_TIMEOUT: Duration = Duration::from_secs(60);
/// 本体が別の依頼を処理中（パイプが塞がっている）ときに待つ上限
const BUSY_TIMEOUT: Duration = Duration::from_secs(10);

const ERROR_FILE_NOT_FOUND: i32 = 2;
const ERROR_PIPE_BUSY: i32 = 231;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Request<'a> {
    protocol: u32,
    argv: &'a [String],
    cwd: String,
    cli_version: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Response {
    protocol: u32,
    exit_code: i32,
    #[serde(default)]
    stdout: String,
    #[serde(default)]
    stderr: String,
}

/// userData のフォルダ名（本体の app.getPath('userData') の末尾と同じ規則）
fn instance_base(instance: Option<&str>) -> String {
    match instance {
        Some(name) if !name.is_empty() => format!("{name}-quick-dash-launcher"),
        _ => "quick-dash-launcher".to_string(),
    }
}

/// 本体の getCliPipeName() と同じ規則でパイプ名を作る
fn pipe_name(base: &str, user: &str) -> String {
    format!(r"\\.\pipe\{base}-cli-{user}")
}

fn current_user() -> String {
    env::var("USERNAME").unwrap_or_else(|_| "user".to_string())
}

fn open_pipe(name: &str) -> io::Result<File> {
    OpenOptions::new().read(true).write(true).open(name)
}

/// パイプにつなぐ。塞がっていれば少し待つ。存在しなければ Err(ERROR_FILE_NOT_FOUND)
fn connect(name: &str) -> io::Result<File> {
    let start = Instant::now();
    loop {
        match open_pipe(name) {
            Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY) && start.elapsed() < BUSY_TIMEOUT => {
                sleep(Duration::from_millis(50));
            }
            other => return other,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LauncherInfo {
    exe_path: String,
}

/// 起動する本体の exe を探す。本体が起動のたびに書く cli-launcher.json を優先し、
/// 無ければインストール先（<インストール先>\resources\bin\qdl.exe から見た本体）を使う
fn find_app_exe(base: &str) -> Option<PathBuf> {
    if let Ok(path) = env::var("QDL_APP_EXE") {
        return Some(PathBuf::from(path));
    }
    if let Ok(appdata) = env::var("APPDATA") {
        let info_path = PathBuf::from(appdata).join(base).join("cli-launcher.json");
        if let Ok(text) = std::fs::read_to_string(&info_path) {
            if let Ok(info) = serde_json::from_str::<LauncherInfo>(&text) {
                let exe = PathBuf::from(info.exe_path);
                if exe.is_file() {
                    return Some(exe);
                }
            }
        }
    }
    let exe = env::current_exe().ok()?;
    let install_dir = exe.parent()?.parent()?.parent()?;
    let candidate = install_dir.join("QuickDashLauncher.exe");
    candidate.is_file().then_some(candidate)
}

/// 自分の標準入出力のハンドルを、これから起動するプロセスに引き継がせない
///
/// Windows では、継承可能なハンドルは CreateProcess で子に引き継がれる。qdl の標準出力が呼び出し元の
/// パイプ（AI のシェルなど）だと、起動した本体がそのパイプを持ち続け、qdl が終わっても呼び出し元が
/// 出力の終わりを受け取れずに待ち続ける。
fn stop_inheriting_std_handles() {
    use std::ffi::c_void;
    #[link(name = "kernel32")]
    extern "system" {
        fn GetStdHandle(std_handle: u32) -> *mut c_void;
        fn SetHandleInformation(handle: *mut c_void, mask: u32, flags: u32) -> i32;
    }
    const STD_INPUT_HANDLE: u32 = -10i32 as u32;
    const STD_OUTPUT_HANDLE: u32 = -11i32 as u32;
    const STD_ERROR_HANDLE: u32 = -12i32 as u32;
    const HANDLE_FLAG_INHERIT: u32 = 0x0000_0001;
    for which in [STD_INPUT_HANDLE, STD_OUTPUT_HANDLE, STD_ERROR_HANDLE] {
        // SAFETY: 自プロセスの標準ハンドルの属性を変えるだけ。無効なハンドルなら失敗して何も起きない
        unsafe {
            let handle = GetStdHandle(which);
            if !handle.is_null() && handle as isize != -1 {
                SetHandleInformation(handle, HANDLE_FLAG_INHERIT, 0);
            }
        }
    }
}

fn launch_app(exe: &PathBuf) -> io::Result<()> {
    use std::os::windows::process::CommandExt;
    stop_inheriting_std_handles();
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    Command::new(exe)
        .arg("--launched-by-cli")
        // 本体を Node として起動してしまわないよう、漏れてきた指定を消す
        .env_remove("ELECTRON_RUN_AS_NODE")
        // 本体のログが qdl の出力に混ざらないよう、標準入出力を引き継がない
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .spawn()
        .map(|_| ())
}

fn connect_or_launch(name: &str, base: &str) -> Result<File, String> {
    match connect(name) {
        Ok(pipe) => return Ok(pipe),
        Err(e) if e.raw_os_error() == Some(ERROR_FILE_NOT_FOUND) => {}
        Err(e) => return Err(format!("QuickDashLauncher に接続できません: {e}")),
    }

    if env::var("QDL_NO_LAUNCH").is_ok_and(|v| v == "1") {
        return Err("QuickDashLauncher が起動していません".to_string());
    }
    let exe = find_app_exe(base).ok_or(
        "QuickDashLauncher が起動しておらず、起動する exe も見つかりません。QuickDashLauncher を起動してから実行してください",
    )?;
    eprintln!("QuickDashLauncher を起動しています…");
    launch_app(&exe).map_err(|e| format!("QuickDashLauncher を起動できません（{}）: {e}", exe.display()))?;

    let start = Instant::now();
    while start.elapsed() < LAUNCH_TIMEOUT {
        sleep(Duration::from_millis(250));
        if let Ok(pipe) = connect(name) {
            return Ok(pipe);
        }
    }
    Err("QuickDashLauncher を起動しましたが、応答がありません".to_string())
}

fn exchange(mut pipe: File, request: &Request) -> Result<Response, String> {
    let mut line = serde_json::to_vec(request).map_err(|e| e.to_string())?;
    line.push(b'\n');
    pipe.write_all(&line)
        .and_then(|_| pipe.flush())
        .map_err(|e| format!("依頼を送れません: {e}"))?;

    let mut buf = Vec::new();
    pipe.read_to_end(&mut buf)
        .map_err(|e| format!("応答を受け取れません: {e}"))?;
    serde_json::from_slice(&buf).map_err(|e| format!("応答を解釈できません: {e}"))
}

fn run() -> Result<u8, (u8, String)> {
    let argv: Vec<String> = env::args_os()
        .skip(1)
        .map(|a| a.to_string_lossy().into_owned())
        .collect();
    let instance = env::var("QDL_INSTANCE").ok();
    let base = instance_base(instance.as_deref());
    let name = pipe_name(&base, &current_user());

    let pipe = connect_or_launch(&name, &base).map_err(|m| (EXIT_NOT_AVAILABLE, m))?;
    let cwd = env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let request = Request {
        protocol: PROTOCOL_VERSION,
        argv: &argv,
        cwd,
        cli_version: env!("CARGO_PKG_VERSION"),
    };
    let response = exchange(pipe, &request).map_err(|m| (EXIT_PROTOCOL, m))?;
    if response.protocol != PROTOCOL_VERSION {
        return Err((
            EXIT_PROTOCOL,
            format!(
                "CLI と QuickDashLauncher の版が合いません（CLI: {PROTOCOL_VERSION}、本体: {}）。同じ版の QuickDashLauncher に付属する qdl を使ってください",
                response.protocol
            ),
        ));
    }

    io::stdout().write_all(response.stdout.as_bytes()).ok();
    io::stderr().write_all(response.stderr.as_bytes()).ok();
    Ok(response.exit_code.clamp(0, 255) as u8)
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => ExitCode::from(code),
        Err((code, message)) => {
            eprintln!("qdl: {message}");
            ExitCode::from(code)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_follows_app_instance() {
        assert_eq!(instance_base(None), "quick-dash-launcher");
        assert_eq!(instance_base(Some("")), "quick-dash-launcher");
        assert_eq!(instance_base(Some("dev")), "dev-quick-dash-launcher");
    }

    #[test]
    fn pipe_name_matches_app_rule() {
        assert_eq!(
            pipe_name("quick-dash-launcher", "taro"),
            r"\\.\pipe\quick-dash-launcher-cli-taro"
        );
    }

    #[test]
    fn request_uses_camel_case() {
        let argv = vec!["status".to_string()];
        let json = serde_json::to_string(&Request {
            protocol: 1,
            argv: &argv,
            cwd: "C:\\".to_string(),
            cli_version: "0.1.0",
        })
        .unwrap();
        assert_eq!(
            json,
            r#"{"protocol":1,"argv":["status"],"cwd":"C:\\","cliVersion":"0.1.0"}"#
        );
    }

    #[test]
    fn response_tolerates_missing_streams() {
        let r: Response = serde_json::from_str(r#"{"protocol":1,"exitCode":2}"#).unwrap();
        assert_eq!(r.exit_code, 2);
        assert!(r.stdout.is_empty() && r.stderr.is_empty());
    }
}
