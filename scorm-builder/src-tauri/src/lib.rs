mod scorm;
mod commands;
mod project_storage;
mod api_keys;
mod media_storage;

use commands::{
    generate_scorm_manifest, create_scorm_package,
    save_project, load_project, list_projects, delete_project, get_projects_dir, get_cli_args,
    append_to_log, save_api_keys, load_api_keys, delete_api_keys, download_image,
    write_file, read_file
};
use media_storage::{store_media, get_all_project_media, delete_media, get_media};

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
            generate_scorm_manifest,
            create_scorm_package,
            save_project,
            load_project,
            list_projects,
            delete_project,
            get_projects_dir,
            get_cli_args,
            append_to_log,
            save_api_keys,
            load_api_keys,
            delete_api_keys,
            download_image,
            write_file,
            read_file,
            store_media,
            get_all_project_media,
            delete_media,
            get_media
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
