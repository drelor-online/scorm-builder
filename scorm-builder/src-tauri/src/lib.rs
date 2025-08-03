mod scorm;
mod commands;
mod project_storage;
mod api_keys;
mod media_storage;
mod settings;

use commands::{
    create_project, save_project, load_project, list_projects, delete_project, get_projects_dir, generate_scorm,
    generate_scorm_enhanced, set_projects_dir, get_app_settings, save_app_settings
};
use media_storage::{store_media, get_all_project_media, delete_media, get_media};
use api_keys::{save_api_keys, load_api_keys, delete_api_keys};

#[tauri::command]
fn get_cli_args() -> Option<Vec<String>> {
    std::env::args().nth(1).map(|arg| vec![arg])
}

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
            get_all_project_media,
            delete_media,
            get_media,
            save_api_keys,
            load_api_keys,
            delete_api_keys,
            generate_scorm,
            generate_scorm_enhanced
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
