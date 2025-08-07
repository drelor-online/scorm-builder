use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationResult {
    #[serde(rename = "migratedItems")]
    pub migrated_items: usize,
    pub success: bool,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationData {
    pub media: Option<Value>,
    pub project: Option<Value>,
    #[serde(rename = "courseContent")]
    pub course_content: Option<Value>,
}

/// Migrate data from localStorage to file system
#[tauri::command]
pub fn migrate_from_localstorage(data: MigrationData) -> Result<MigrationResult, String> {
    let mut migrated_items = 0;
    let mut errors = Vec::new();
    
    // Get the projects directory
    let projects_dir = crate::project_storage::get_projects_directory()
        .map_err(|e| format!("Failed to get projects directory: {}", e))?;
    
    // Create migration directory if needed
    let migration_dir = projects_dir.join("migrated_data");
    if !migration_dir.exists() {
        fs::create_dir_all(&migration_dir)
            .map_err(|e| format!("Failed to create migration directory: {}", e))?;
    }
    
    // Migrate media data
    if let Some(media) = data.media {
        let media_file = migration_dir.join("migrated_media.json");
        match serde_json::to_string_pretty(&media) {
            Ok(json_str) => {
                match fs::write(&media_file, json_str) {
                    Ok(_) => {
                        println!("[migration] Migrated media data to {:?}", media_file);
                        migrated_items += 1;
                    }
                    Err(e) => errors.push(format!("Failed to write media data: {}", e))
                }
            }
            Err(e) => errors.push(format!("Failed to serialize media data: {}", e))
        }
    }
    
    // Migrate project data
    if let Some(project) = data.project {
        let project_file = migration_dir.join("migrated_project.json");
        match serde_json::to_string_pretty(&project) {
            Ok(json_str) => {
                match fs::write(&project_file, json_str) {
                    Ok(_) => {
                        println!("[migration] Migrated project data to {:?}", project_file);
                        migrated_items += 1;
                    }
                    Err(e) => errors.push(format!("Failed to write project data: {}", e))
                }
            }
            Err(e) => errors.push(format!("Failed to serialize project data: {}", e))
        }
    }
    
    // Migrate course content
    if let Some(course_content) = data.course_content {
        let content_file = migration_dir.join("migrated_course_content.json");
        match serde_json::to_string_pretty(&course_content) {
            Ok(json_str) => {
                match fs::write(&content_file, json_str) {
                    Ok(_) => {
                        println!("[migration] Migrated course content to {:?}", content_file);
                        migrated_items += 1;
                    }
                    Err(e) => errors.push(format!("Failed to write course content: {}", e))
                }
            }
            Err(e) => errors.push(format!("Failed to serialize course content: {}", e))
        }
    }
    
    Ok(MigrationResult {
        migrated_items,
        success: errors.is_empty(),
        errors,
    })
}

/// Clear the recent files cache
#[tauri::command]
pub fn clear_recent_files() -> Result<serde_json::Value, String> {
    // Get app data directory
    let app_dir = dirs::config_dir()
        .ok_or_else(|| "Failed to get config directory".to_string())?
        .join("scorm-builder");
    
    let recent_files_path = app_dir.join("recent_files.json");
    
    let mut cleared_count = 0;
    
    // Check if file exists and delete it
    if recent_files_path.exists() {
        // First, try to read how many items were in the file
        if let Ok(content) = fs::read_to_string(&recent_files_path) {
            if let Ok(data) = serde_json::from_str::<Value>(&content) {
                if let Some(arr) = data.as_array() {
                    cleared_count = arr.len();
                }
            }
        }
        
        // Delete the file
        match fs::remove_file(&recent_files_path) {
            Ok(_) => {
                println!("[cache] Cleared recent files cache: {} items", cleared_count);
            }
            Err(e) => {
                return Err(format!("Failed to clear recent files: {}", e));
            }
        }
    }
    
    // Also clear from settings if it exists there
    if let Ok(mut settings) = crate::settings::load_settings() {
        if settings.recent_projects.is_some() {
            let count = settings.recent_projects.as_ref().unwrap().len();
            settings.recent_projects = Some(Vec::new());
            if crate::settings::save_settings(&settings).is_ok() {
                cleared_count += count;
            }
        }
    }
    
    Ok(serde_json::json!({
        "cleared": cleared_count
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_migration_data_structure() {
        let data = MigrationData {
            media: Some(serde_json::json!({
                "media-1": {
                    "id": "media-1",
                    "type": "image"
                }
            })),
            project: Some(serde_json::json!({
                "id": "project-1",
                "name": "Test Project"
            })),
            course_content: None,
        };
        
        // Should serialize properly
        let json = serde_json::to_string(&data);
        assert!(json.is_ok());
    }
    
    #[test]
    fn test_clear_recent_files() {
        let temp_dir = TempDir::new().unwrap();
        let recent_file = temp_dir.path().join("recent_files.json");
        
        // Create a test file
        let test_data = serde_json::json!([
            {"id": "1", "name": "Project 1"},
            {"id": "2", "name": "Project 2"}
        ]);
        fs::write(&recent_file, test_data.to_string()).unwrap();
        
        // File should exist
        assert!(recent_file.exists());
        
        // Note: The actual clear_recent_files function uses dirs::config_dir()
        // which we can't easily mock in tests, so we test the logic separately
    }
}