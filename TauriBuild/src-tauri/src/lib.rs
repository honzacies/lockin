use tauri_plugin_fs::FsExt;

/// Složkový workspace (např. Obsidian vault): povolí aplikaci číst a zapisovat
/// právě vybranou složku. Pevný seznam cest v capabilities by fungoval jen na
/// jednom počítači — uživatel si vault může dát kamkoli.
#[tauri::command]
fn allow_workspace_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
  app.fs_scope().allow_directory(&path, true).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![allow_workspace_folder])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
