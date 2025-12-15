#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::sync::atomic::{AtomicBool, Ordering};

// Global flag to track if the window was already created
static WINDOW_CREATED: AtomicBool = AtomicBool::new(false);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Get app handle
            let app_handle = app.handle();
            
            // Check if window already exists
            if let Some(window) = app_handle.get_window("main") {
                // If window exists, bring it to front and focus
                if let Err(e) = window.set_focus() {
                    eprintln!("Failed to focus existing window: {}", e);
                }
                return Ok(());
            }

            // Create main window
            match tauri::WindowBuilder::new(
                &app_handle,
                "main".to_string(),
                tauri::WindowUrl::App("/".into())
            )
            .title("Sign Language Communicator")
            .inner_size(1280.0, 720.0)
            .build() {
                Ok(window) => {
                    WINDOW_CREATED.store(true, Ordering::SeqCst);
                    
                    // Handle window close event
                    let window_clone = window.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { .. } = event {
                            // Reset the flag when window is closed
                            WINDOW_CREATED.store(false, Ordering::SeqCst);
                            // Let the window close
                            let _ = window_clone.close();
                        }
                    });
                },
                Err(e) => {
                    eprintln!("Failed to create window: {}", e);
                    // Try to find and focus existing window if creation failed
                    if let Some(existing_window) = app_handle.get_window("main") {
                        let _ = existing_window.set_focus();
                    }
                    return Ok(());
                }
            }

            // Start TTS server in development mode
            #[cfg(debug_assertions)]
            start_tts_server(&app_handle);

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::Destroyed = event.event() {
                WINDOW_CREATED.store(false, Ordering::SeqCst);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(debug_assertions)]
fn start_tts_server(app_handle: &tauri::AppHandle) {
    use std::process::{Command, Stdio};

    if let Some(app_dir) = app_handle.path_resolver().app_data_dir() {
        let tts_script = app_dir
            .parent()
            .unwrap()
            .join("bin")
            .join("start_tts.py");

        if tts_script.exists() {
            println!("Starting TTS server from: {:?}", tts_script);
            
            let _ = if cfg!(target_os = "windows") {
                Command::new("python")
                    .arg(tts_script)
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
            } else {
                Command::new("python3")
                    .arg(tts_script)
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
            };
        }
    }
}
