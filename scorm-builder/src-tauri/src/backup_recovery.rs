use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct RecoveryInfo {
    #[serde(rename = "hasRecovery")]
    pub has_recovery: bool,
    #[serde(rename = "backupTimestamp")]
    pub backup_timestamp: Option<String>,
    #[serde(rename = "backupPath")]
    pub backup_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CleanupResult {
    #[serde(rename = "deletedCount")]
    pub deleted_count: usize,
    #[serde(rename = "keptCount")]
    pub kept_count: usize,
}

/// Extract project ID from a path or return the ID if it's already just an ID
#[allow(dead_code)]
fn extract_project_id(project_id_or_path: &str) -> String {
    // If it contains .scormproj, extract the ID from the filename
    if project_id_or_path.contains(".scormproj") {
        let path = Path::new(project_id_or_path);
        if let Some(file_name) = path.file_name() {
            if let Some(file_str) = file_name.to_str() {
                // Try to extract ID from pattern like "ProjectName_1234567890.scormproj"
                if let Some(underscore_pos) = file_str.rfind('_') {
                    if let Some(dot_pos) = file_str.rfind('.') {
                        if underscore_pos < dot_pos {
                            let potential_id = &file_str[underscore_pos + 1..dot_pos];
                            // Check if it's all digits
                            if potential_id.chars().all(|c| c.is_ascii_digit()) {
                                return potential_id.to_string();
                            }
                        }
                    }
                }
                // Fallback: try to get ID from the beginning if no underscore pattern
                if let Some(dot_pos) = file_str.find('.') {
                    let potential_id = &file_str[..dot_pos];
                    if potential_id.chars().all(|c| c.is_ascii_digit()) {
                        return potential_id.to_string();
                    }
                }
            }
        }
    }

    // If it's already just an ID or we couldn't extract, return as is
    project_id_or_path.to_string()
}

/// Get the path for a project file
fn get_project_path(project_id_or_path: &str) -> PathBuf {
    // If it already contains .scormproj, it's likely a full path
    if project_id_or_path.contains(".scormproj") {
        return PathBuf::from(project_id_or_path);
    }
    
    // Otherwise, it's just an ID - search for the actual project file
    // Projects are named: Title_ProjectId.scormproj
    if let Ok(projects_dir) = crate::settings::get_projects_directory() {
        // Look for files matching *_projectId.scormproj pattern
        if let Ok(entries) = fs::read_dir(&projects_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    // Check if this file ends with _projectId.scormproj
                    if file_name.ends_with(&format!("_{}.scormproj", project_id_or_path)) {
                        println!("[backup] Found project file: {:?}", path);
                        return path;
                    }
                }
            }
        }
    }
    
    // Fallback: use a default name pattern for new projects
    // This handles the case where the project hasn't been saved yet
    // Use "Untitled" as the default project name to maintain naming convention
    if let Ok(projects_dir) = crate::settings::get_projects_directory() {
        projects_dir.join(format!("Untitled_{}.scormproj", project_id_or_path))
    } else {
        PathBuf::from(format!("Untitled_{}.scormproj", project_id_or_path))
    }
}

/// Create a backup of the project file
#[tauri::command]
pub fn create_backup(
    #[allow(non_snake_case)] projectId: String
) -> Result<(), String> {
    let project_path = get_project_path(&projectId);
    
    // If the project file doesn't exist, nothing to backup
    if !project_path.exists() {
        println!("[backup] Project file doesn't exist, skipping backup: \"{}\"", 
                 project_path.file_name()
                     .and_then(|n| n.to_str())
                     .unwrap_or(&project_path.to_string_lossy()));
        return Ok(());
    }
    
    // Create backup path
    let backup_path = project_path.with_extension("scormproj.backup");
    
    // Copy the project file to backup
    match fs::copy(&project_path, &backup_path) {
        Ok(_) => {
            println!("[backup] Created backup: {:?}", backup_path);
            Ok(())
        }
        Err(e) => {
            println!("[backup] Warning: Failed to create backup: {}", e);
            // Don't fail the operation, just log the warning
            Ok(())
        }
    }
}

/// Check if a recovery backup exists for the project
#[tauri::command]
pub fn check_recovery(
    #[allow(non_snake_case)] projectId: String
) -> Result<RecoveryInfo, String> {
    let project_path = get_project_path(&projectId);
    let backup_path = project_path.with_extension("scormproj.backup");
    
    if backup_path.exists() {
        // Get the modification time of the backup
        let timestamp = fs::metadata(&backup_path)
            .and_then(|meta| meta.modified())
            .map(|time| {
                // Convert to ISO 8601 format
                let datetime: DateTime<Utc> = time.into();
                datetime.to_rfc3339()
            })
            .unwrap_or_else(|_| "Unknown".to_string());
        
        Ok(RecoveryInfo {
            has_recovery: true,
            backup_timestamp: Some(timestamp),
            backup_path: Some(backup_path.to_string_lossy().to_string()),
        })
    } else {
        Ok(RecoveryInfo {
            has_recovery: false,
            backup_timestamp: None,
            backup_path: None,
        })
    }
}

/// Recover project data from backup
#[tauri::command]
pub fn recover_from_backup(
    #[allow(non_snake_case)] projectId: String
) -> Result<serde_json::Value, String> {
    let project_path = get_project_path(&projectId);
    let backup_path = project_path.with_extension("scormproj.backup");
    
    if !backup_path.exists() {
        return Err("No backup found".to_string());
    }
    
    // Read the backup file
    let backup_content = fs::read_to_string(&backup_path)
        .map_err(|e| format!("Failed to read backup: {}", e))?;
    
    // Parse as JSON
    let mut project_data: serde_json::Value = serde_json::from_str(&backup_content)
        .map_err(|e| format!("Failed to parse backup: {}", e))?;
    
    // Add recovery metadata
    if let Some(obj) = project_data.as_object_mut() {
        let recovery_metadata = serde_json::json!({
            "recovered": true,
            "timestamp": Utc::now().to_rfc3339()
        });
        obj.insert("metadata".to_string(), recovery_metadata);
    }
    
    Ok(project_data)
}

/// Cleanup old backup files, keeping only the specified number
#[tauri::command]
pub fn cleanup_old_backups(
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] keepCount: Option<usize>
) -> Result<CleanupResult, String> {
    let keep_count = keepCount.unwrap_or(5);
    let project_path = get_project_path(&projectId);
    let project_dir = project_path.parent()
        .ok_or_else(|| "Invalid project path".to_string())?;
    
    // Find all backup files for this project
    let project_name = project_path.file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid project name".to_string())?;
    
    let mut backup_files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    
    // Look for backup files with pattern: projectname.backup.1, projectname.backup.2, etc.
    if let Ok(entries) = fs::read_dir(project_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                if file_name.starts_with(project_name) && file_name.contains(".backup") {
                    if let Ok(metadata) = fs::metadata(&path) {
                        if let Ok(modified) = metadata.modified() {
                            backup_files.push((path, modified));
                        }
                    }
                }
            }
        }
    }
    
    // Sort by modification time (newest first)
    backup_files.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Delete old backups beyond the keep count
    let mut deleted_count = 0;
    for (i, (path, _)) in backup_files.iter().enumerate() {
        if i >= keep_count {
            if fs::remove_file(path).is_ok() {
                deleted_count += 1;
                println!("[backup] Deleted old backup: {:?}", path);
            }
        }
    }
    
    Ok(CleanupResult {
        deleted_count,
        kept_count: backup_files.len().min(keep_count),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_extract_project_id() {
        assert_eq!(extract_project_id("TestProject_1234567890.scormproj"), "1234567890");
        assert_eq!(extract_project_id("1234567890.scormproj"), "1234567890");
        assert_eq!(extract_project_id("1234567890"), "1234567890");
    }
    
    #[test]
    fn test_create_and_check_backup() {
        let temp_dir = TempDir::new().unwrap();
        let project_file = temp_dir.path().join("test_1234567890.scormproj");
        
        // Create a dummy project file
        fs::write(&project_file, r#"{"project": {"id": "1234567890"}}"#).unwrap();
        
        // Create backup
        let result = create_backup(project_file.to_string_lossy().to_string());
        assert!(result.is_ok());
        
        // Check if backup exists
        let backup_file = project_file.with_extension("scormproj.backup");
        assert!(backup_file.exists());
        
        // Check recovery info
        let recovery = check_recovery(project_file.to_string_lossy().to_string()).unwrap();
        assert!(recovery.has_recovery);
        assert!(recovery.backup_timestamp.is_some());
    }
    
    #[test]
    fn test_recover_from_backup() {
        let temp_dir = TempDir::new().unwrap();
        let project_file = temp_dir.path().join("test_1234567890.scormproj");
        let backup_file = project_file.with_extension("scormproj.backup");
        
        // Create a backup file with test data
        let test_data = r#"{"pages": [{"id": "page1", "title": "Test"}]}"#;
        fs::write(&backup_file, test_data).unwrap();
        
        // Recover from backup
        let result = recover_from_backup(project_file.to_string_lossy().to_string());
        assert!(result.is_ok());
        
        let recovered_data = result.unwrap();
        assert!(recovered_data["metadata"]["recovered"].as_bool().unwrap());
        assert!(recovered_data["pages"].is_array());
    }
}