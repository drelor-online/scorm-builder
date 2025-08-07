mod api_keys;
mod commands;
mod commands_secure;
mod media_storage;
mod project_storage;
mod scorm;
mod settings;

// Import only non-duplicate commands from commands.rs
use commands::{
    create_project, generate_scorm, generate_scorm_enhanced, get_app_settings, save_app_settings,
    set_projects_dir,
};
// Import secure versions of project commands and other secure commands
use commands_secure::{
    append_to_log, delete_api_keys, delete_project, get_cli_args, get_projects_dir, list_projects,
    load_api_keys, load_project, save_api_keys, save_project,
};
use media_storage::{
    delete_media, get_all_project_media, get_media, store_media, store_media_base64,
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
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
