#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::process::{Child, Command as StdCommand, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::api::process::{Command as TauriCommand, CommandChild};
use tauri::{Manager, RunEvent};

// Global flag to track if the window was already created
static WINDOW_CREATED: AtomicBool = AtomicBool::new(false);

static SIGN_SERVER_PROCESS: Mutex<Option<SignServerProcess>> = Mutex::new(None);

enum SignServerProcess {
    Sidecar(CommandChild),
    Python(Child),
}

impl SignServerProcess {
    fn kill(self) {
        match self {
            SignServerProcess::Sidecar(child) => {
                let _ = child.kill();
            }
            SignServerProcess::Python(mut child) => {
                let _ = child.kill();
            }
        }
    }
}

fn dev_sign_server_script() -> Option<PathBuf> {
    let script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("TestingFinal")
        .join("sign_server.py");
    if script.exists() {
        Some(script)
    } else {
        None
    }
}

fn try_start_sign_sidecar() -> Option<SignServerProcess> {
    match TauriCommand::new_sidecar("sign-server") {
        Ok(command) => match command.spawn() {
            Ok((_rx, child)) => {
                println!("Sign recognition sidecar started on http://127.0.0.1:8001");
                Some(SignServerProcess::Sidecar(child))
            }
            Err(error) => {
                eprintln!("Failed to spawn sign-server sidecar: {error}");
                None
            }
        },
        Err(error) => {
            eprintln!("Sign-server sidecar binary not configured: {error}");
            None
        }
    }
}

fn try_start_sign_python_dev() -> Option<SignServerProcess> {
    let script = dev_sign_server_script()?;
    let workdir = script.parent()?.to_path_buf();

    println!("Starting sign server (dev Python) from {:?}", script);

    let child = if cfg!(target_os = "windows") {
        StdCommand::new("python")
            .arg(&script)
            .current_dir(&workdir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .or_else(|_| {
                StdCommand::new("py")
                    .arg("-3")
                    .arg(&script)
                    .current_dir(&workdir)
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
            })
    } else {
        StdCommand::new("python3")
            .arg(&script)
            .current_dir(&workdir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
    };

    match child {
        Ok(child) => {
            println!("Sign recognition Python server started on http://127.0.0.1:8001");
            Some(SignServerProcess::Python(child))
        }
        Err(error) => {
            eprintln!("Failed to start sign_server.py: {error}");
            None
        }
    }
}

fn start_sign_server() {
    if let Ok(mut guard) = SIGN_SERVER_PROCESS.lock() {
        if guard.is_some() {
            return;
        }

        let process = try_start_sign_sidecar().or_else(try_start_sign_python_dev);

        if process.is_none() {
            eprintln!(
                "Sign recognition service could not be started. \
                 Build the sidecar (TestingFinal/build_sign_sidecar.ps1) \
                 or install Python dependencies in TestingFinal."
            );
        }

        *guard = process;
    }
}

fn stop_sign_server() {
    if let Ok(mut guard) = SIGN_SERVER_PROCESS.lock() {
        if let Some(process) = guard.take() {
            println!("Stopping sign recognition service");
            process.kill();
        }
    }
}

#[cfg(debug_assertions)]
fn start_tts_server_dev() {
    // TTS remains on port 8000 (dev-only Python launcher).
    let tts_script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("bin")
        .join("start_tts.py");

    if !tts_script.exists() {
        return;
    }

    println!("Starting TTS server (dev) from {:?}", tts_script);

    let _ = if cfg!(target_os = "windows") {
        StdCommand::new("python")
            .arg(&tts_script)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .or_else(|_| {
                StdCommand::new("py")
                    .arg("-3")
                    .arg(&tts_script)
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
            })
    } else {
        StdCommand::new("python3")
            .arg(&tts_script)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
    };
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();

            if let Some(window) = app_handle.get_window("main") {
                if let Err(e) = window.set_focus() {
                    eprintln!("Failed to focus existing window: {e}");
                }
                return Ok(());
            }

            match tauri::WindowBuilder::new(
                &app_handle,
                "main".to_string(),
                tauri::WindowUrl::App("/".into()),
            )
            .title("Sign Language Communicator")
            .inner_size(1280.0, 720.0)
            .build()
            {
                Ok(window) => {
                    WINDOW_CREATED.store(true, Ordering::SeqCst);

                    let window_clone = window.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { .. } = event {
                            WINDOW_CREATED.store(false, Ordering::SeqCst);
                            let _ = window_clone.close();
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Failed to create window: {e}");
                    if let Some(existing_window) = app_handle.get_window("main") {
                        let _ = existing_window.set_focus();
                    }
                    return Ok(());
                }
            }

            start_sign_server();

            #[cfg(debug_assertions)]
            start_tts_server_dev();

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::Destroyed = event.event() {
                WINDOW_CREATED.store(false, Ordering::SeqCst);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. }) {
                stop_sign_server();
            }
        });
}
