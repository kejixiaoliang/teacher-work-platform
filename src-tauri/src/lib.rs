use rand::RngCore;
use serde::Serialize;
use std::{
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{Manager, State, WindowEvent};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopBootstrap {
    api_base_url: String,
    api_token: String,
    data_dir: String,
    app_version: String,
    database_version: u32,
}

struct DesktopState {
    bootstrap: DesktopBootstrap,
    child: Mutex<Child>,
}

#[tauri::command]
fn desktop_bootstrap(state: State<'_, DesktopState>) -> DesktopBootstrap {
    state.bootstrap.clone()
}

fn portable_root() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return Ok(Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf());
    }
    std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法定位便携目录".into())
}

fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn start_backend() -> Result<(Child, DesktopBootstrap), String> {
    let root = portable_root()?;
    let data_dir = root.join("data");
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("无法创建数据目录: {e}"))?;
    let probe = data_dir.join(".write-test");
    std::fs::write(&probe, b"ok").map_err(|e| format!("数据目录不可写: {e}"))?;
    let _ = std::fs::remove_file(probe);
    let token = random_token();

    let mut command = if cfg!(debug_assertions) {
        let mut command = Command::new("node");
        command.arg(root.join("server/index.js")).current_dir(&root);
        command
    } else {
        let node = root.join("resources/runtime/node.exe");
        let app_root = root.join("resources/app");
        if !node.is_file() {
            return Err(format!("缺少运行时: {}", node.display()));
        }
        let mut command = Command::new(node);
        command
            .arg(app_root.join("server/index.js"))
            .current_dir(app_root);
        command
    };
    command
        .env("TEACHER_WORK_DATA_DIR", &data_dir)
        .env("TEACHER_WORK_API_TOKEN", &token)
        .env("TEACHER_WORK_SIDECAR", "1")
        .env("SEED_DEMO", "0")
        .env("NO_OPEN", "1")
        .env("PORT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x08000000);

    let mut child = command
        .spawn()
        .map_err(|e| format!("无法启动本地服务: {e}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法读取本地服务状态".to_string())?;
    let started = Instant::now();
    let mut ready = None;
    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|e| e.to_string())?;
        if let Some(json) = line.strip_prefix("TEACHER_WORK_READY ") {
            let port = json
                .split("\"port\":")
                .nth(1)
                .and_then(|s| s.split([',', '}']).next())
                .and_then(|s| s.parse::<u16>().ok())
                .ok_or_else(|| "本地服务返回了无效端口".to_string())?;
            ready = Some(port);
            break;
        }
        if started.elapsed() > Duration::from_secs(15) {
            break;
        }
    }
    let port = ready.ok_or_else(|| {
        let _ = child.kill();
        "本地服务启动超时".to_string()
    })?;
    let bootstrap = DesktopBootstrap {
        api_base_url: format!("http://127.0.0.1:{port}"),
        api_token: token,
        data_dir: data_dir.to_string_lossy().into_owned(),
        app_version: env!("CARGO_PKG_VERSION").into(),
            database_version: 6,
    };
    Ok((child, bootstrap))
}

pub fn run() {
    let (child, bootstrap) = start_backend().unwrap_or_else(|error| panic!("{error}"));
    tauri::Builder::default()
        .manage(DesktopState {
            bootstrap,
            child: Mutex::new(child),
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.app_handle().try_state::<DesktopState>() {
                    if let Ok(mut child) = state.child.lock() {
                        let _ = child.kill();
                    }
                }
                window.app_handle().exit(0);
                std::process::exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![desktop_bootstrap])
        .build(tauri::generate_context!())
        .expect("failed to build application")
        .run(|app, event| {
            match event {
                tauri::RunEvent::WindowEvent {
                    event: WindowEvent::CloseRequested { .. },
                    ..
                } => {
                    if let Some(state) = app.try_state::<DesktopState>() {
                        if let Ok(mut child) = state.child.lock() {
                            let _ = child.kill();
                        }
                    }
                    app.exit(0);
                    std::process::exit(0);
                }
                    tauri::RunEvent::Exit => {
                        if let Some(state) = app.try_state::<DesktopState>() {
                            if let Ok(mut child) = state.child.lock() {
                                let _ = child.kill();
                            }
                        }
                    }
                    tauri::RunEvent::ExitRequested { .. } => {
                        if let Some(state) = app.try_state::<DesktopState>() {
                            if let Ok(mut child) = state.child.lock() {
                                let _ = child.kill();
                            }
                        }
                        std::process::exit(0);
                    }
                    _ => {}
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn release_paths_are_sibling_directories() {
        let root = PathBuf::from(r"D:\老师 资料\教师工作台");
        assert_eq!(
            root.join("data"),
            PathBuf::from(r"D:\老师 资料\教师工作台\data")
        );
        assert_eq!(
            root.join("resources/runtime/node.exe"),
            PathBuf::from(r"D:\老师 资料\教师工作台\resources\runtime\node.exe")
        );
    }
}
