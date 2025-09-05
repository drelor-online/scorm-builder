mod api_keys;
mod backup_recovery;
mod commands;
mod commands_secure;
mod localstorage_migration;
mod media_storage;
mod project_storage;
mod project_export_import;
mod scorm;
mod settings;

// Import only non-duplicate commands from commands.rs
use commands::{
    create_project, generate_scorm, generate_scorm_enhanced, get_app_settings, save_app_settings,
    set_projects_dir, take_screenshot, save_workflow_data, get_projects_directory, read_file_binary,
    clean_workflow_files, export_workflow_zip, save_workflow_json,
};
// Import secure versions of project commands and other secure commands
use commands_secure::{
    append_to_log, delete_api_keys, delete_project, get_cli_args, get_projects_dir, list_projects,
    load_api_keys, load_project, rename_project, save_api_keys, save_project, unsafe_download_image,
};
use backup_recovery::{
    check_recovery, cleanup_old_backups, create_backup, recover_from_backup,
};
use localstorage_migration::{
    clear_recent_files, migrate_from_localstorage,
};
use media_storage::{
    delete_media, get_all_project_media, get_all_project_media_metadata, get_media, store_media, store_media_base64,
};
use project_export_import::{
    create_project_zip, create_project_zip_with_progress, extract_project_zip,
    save_project_with_media, update_imported_media_paths,
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
            rename_project,
            get_projects_dir,
            set_projects_dir,
            get_app_settings,
            save_app_settings,
            get_cli_args,
            store_media,
            store_media_base64,
            get_all_project_media,
            get_all_project_media_metadata,
            delete_media,
            get_media,
            save_api_keys,
            load_api_keys,
            delete_api_keys,
            generate_scorm,
            generate_scorm_enhanced,
            append_to_log,
            create_backup,
            check_recovery,
            recover_from_backup,
            cleanup_old_backups,
            migrate_from_localstorage,
            clear_recent_files,
            create_project_zip,
            create_project_zip_with_progress,
            extract_project_zip,
            save_project_with_media,
            update_imported_media_paths,
            take_screenshot,
            save_workflow_data,
            get_projects_directory,
            read_file_binary,
            clean_workflow_files,
            export_workflow_zip,
            save_workflow_json,
            unsafe_download_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
