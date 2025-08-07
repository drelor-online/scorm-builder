mod scorm;
mod commands;
mod commands_secure;
mod project_storage;
mod api_keys;
mod media_storage;
mod settings;

// Import only non-duplicate commands from commands.rs
use commands::{
    create_project, generate_scorm, generate_scorm_enhanced, set_projects_dir, get_app_settings, save_app_settings
};
// Import secure versions of project commands and other secure commands
use commands_secure::{
    append_to_log, save_project, load_project, list_projects, delete_project, get_projects_dir,
    save_api_keys, load_api_keys, delete_api_keys, get_cli_args
};
use media_storage::{store_media, store_media_base64, get_all_project_media, delete_media, get_media};


// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            create_project,
            save_project,
            load_project,
            list_projects,
            delete_project,
            get_projects_dir,
            set_projects_dir,
            get_app_settings,
            save_app_settings,
            get_cli_args,
            store_media,
            store_media_base64,
            get_all_project_media,
            delete_media,
            get_media,
            save_api_keys,
            load_api_keys,
            delete_api_keys,
            generate_scorm,
            generate_scorm_enhanced,
            append_to_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
