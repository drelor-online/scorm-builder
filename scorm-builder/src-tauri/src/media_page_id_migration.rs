use std::fs;
use std::path::Path;
use serde_json::{Value, Map};

use crate::media_storage::get_media_directory;

// Debug logging for migration issues
fn debug_log(message: &str) {
    println!("[DEBUG] Media Migration: {}", message);
    eprintln!("[DEBUG] Media Migration: {}", message);
}

/// Migrates media metadata files to fix incorrect page_id assignments
/// This fixes the issue where objectives media was marked as "topic-0" instead of "objectives"
#[tauri::command]
pub async fn migrate_media_page_ids(project_id: String) -> Result<serde_json::Value, String> {
    debug_log(&format!("Starting media page_id migration for project: {}", project_id));

    let media_dir = get_media_directory(&project_id)
        .map_err(|e| format!("Failed to get media directory: {}", e))?;

    if !media_dir.exists() {
        return Ok(serde_json::json!({
            "success": true,
            "message": "No media directory found, nothing to migrate",
            "fixes_made": 0
        }));
    }

    let mut fixes_made = 0;
    let mut migration_log = Vec::new();

    // Read all JSON metadata files
    let entries = fs::read_dir(&media_dir)
        .map_err(|e| format!("Failed to read media directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                // Only process media metadata files (skip other JSON files)
                if file_name.starts_with("audio-") || file_name.starts_with("caption-") ||
                   file_name.starts_with("image-") || file_name.starts_with("video-") {

                    match fix_media_metadata_file(&path, file_name) {
                        Ok(Some(fix_info)) => {
                            fixes_made += 1;
                            migration_log.push(fix_info);
                            debug_log(&format!("Fixed metadata for: {}", file_name));
                        }
                        Ok(None) => {
                            // No fix needed, already correct
                        }
                        Err(e) => {
                            let error_msg = format!("Failed to process {}: {}", file_name, e);
                            debug_log(&error_msg);
                            migration_log.push(error_msg);
                        }
                    }
                }
            }
        }
    }

    debug_log(&format!("Media page_id migration completed. Fixes made: {}", fixes_made));

    Ok(serde_json::json!({
        "success": true,
        "fixes_made": fixes_made,
        "migration_log": migration_log,
        "message": format!("Migration completed. Fixed {} media files.", fixes_made)
    }))
}

/// Fix a single media metadata file if it has incorrect page_id
fn fix_media_metadata_file(file_path: &Path, file_name: &str) -> Result<Option<String>, String> {
    // Read the current metadata
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let mut metadata: Map<String, Value> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Extract media ID from filename (e.g., "audio-1.json" -> "audio-1")
    let media_id = file_name.trim_end_matches(".json");

    // Determine the correct page_id based on media ID
    let correct_page_id = match media_id {
        id if id.ends_with("-0") => "welcome".to_string(),
        // FIXED: Only match exactly audio-1 and caption-1, not audio-10-1, audio-11-1, etc.
        "audio-1" | "caption-1" => "objectives".to_string(),
        id if id.starts_with("audio-") || id.starts_with("caption-") ||
              id.starts_with("image-") || id.starts_with("video-") => {
            // Extract the number and calculate topic index
            if let Some(dash_pos) = id.rfind('-') {
                if let Ok(num) = id[dash_pos + 1..].parse::<i32>() {
                    if num >= 2 {
                        format!("topic-{}", num - 2)
                    } else {
                        return Err("Invalid media number".to_string());
                    }
                } else {
                    return Err("Could not parse media number".to_string());
                }
            } else {
                return Err("Could not find dash in media ID".to_string());
            }
        }
        _ => return Err("Unrecognized media ID format".to_string())
    };

    // Check if current page_id is incorrect
    let current_page_id = metadata.get("page_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if current_page_id != correct_page_id {
        // Update the page_id
        metadata.insert("page_id".to_string(), Value::String(correct_page_id.to_string()));

        // Write back the corrected metadata
        let updated_content = serde_json::to_string_pretty(&metadata)
            .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

        fs::write(file_path, updated_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(Some(format!(
            "{}: {} -> {}",
            media_id, current_page_id, correct_page_id
        )))
    } else {
        // Already correct
        Ok(None)
    }
}

/// Validates all media metadata files in a project for correct page_id assignments
#[tauri::command]
pub async fn validate_media_page_ids(project_id: String) -> Result<serde_json::Value, String> {
    debug_log(&format!("Validating media page_ids for project: {}", project_id));

    let media_dir = get_media_directory(&project_id)
        .map_err(|e| format!("Failed to get media directory: {}", e))?;

    if !media_dir.exists() {
        return Ok(serde_json::json!({
            "success": true,
            "message": "No media directory found",
            "issues": [],
            "valid_files": 0,
            "invalid_files": 0
        }));
    }

    let mut issues = Vec::new();
    let mut valid_files = 0;
    let mut invalid_files = 0;

    // Read all JSON metadata files
    let entries = fs::read_dir(&media_dir)
        .map_err(|e| format!("Failed to read media directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                // Only process media metadata files
                if file_name.starts_with("audio-") || file_name.starts_with("caption-") ||
                   file_name.starts_with("image-") || file_name.starts_with("video-") {

                    match validate_media_metadata_file(&path, file_name) {
                        Ok(None) => {
                            valid_files += 1;
                        }
                        Ok(Some(issue)) => {
                            invalid_files += 1;
                            issues.push(issue);
                        }
                        Err(e) => {
                            invalid_files += 1;
                            issues.push(format!("Error reading {}: {}", file_name, e));
                        }
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "valid_files": valid_files,
        "invalid_files": invalid_files,
        "issues": issues,
        "message": if invalid_files > 0 {
            format!("Found {} files with incorrect page_id assignments", invalid_files)
        } else {
            "All media files have correct page_id assignments".to_string()
        }
    }))
}

/// Validate a single media metadata file
fn validate_media_metadata_file(file_path: &Path, file_name: &str) -> Result<Option<String>, String> {
    // Read the current metadata
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let metadata: Map<String, Value> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Extract media ID from filename
    let media_id = file_name.trim_end_matches(".json");

    // Determine the correct page_id based on media ID
    let correct_page_id = match media_id {
        id if id.ends_with("-0") => "welcome".to_string(),
        // FIXED: Only match exactly audio-1 and caption-1, not audio-10-1, audio-11-1, etc.
        "audio-1" | "caption-1" => "objectives".to_string(),
        id if id.starts_with("audio-") || id.starts_with("caption-") ||
              id.starts_with("image-") || id.starts_with("video-") => {
            // Extract the number and calculate topic index
            if let Some(dash_pos) = id.rfind('-') {
                if let Ok(num) = id[dash_pos + 1..].parse::<i32>() {
                    if num >= 2 {
                        format!("topic-{}", num - 2)
                    } else {
                        return Err("Invalid media number".to_string());
                    }
                } else {
                    return Err("Could not parse media number".to_string());
                }
            } else {
                return Err("Could not find dash in media ID".to_string());
            }
        }
        _ => return Err("Unrecognized media ID format".to_string())
    };

    // Check current page_id
    let current_page_id = metadata.get("page_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if current_page_id != correct_page_id {
        Ok(Some(format!(
            "{}: expected '{}', found '{}'",
            media_id, correct_page_id, current_page_id
        )))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_media_id_to_page_id_mapping() {
        // Create test metadata files
        let temp_dir = TempDir::new().unwrap();

        // Test audio-1 should be objectives, not topic-0
        let audio1_path = temp_dir.path().join("audio-1.json");
        fs::write(&audio1_path, r#"{"page_id": "topic-0", "type": "audio"}"#).unwrap();

        let result = fix_media_metadata_file(&audio1_path, "audio-1.json").unwrap();
        assert!(result.is_some());
        assert!(result.unwrap().contains("topic-0 -> objectives"));

        // Verify the file was updated
        let updated_content = fs::read_to_string(&audio1_path).unwrap();
        let updated_metadata: Map<String, Value> = serde_json::from_str(&updated_content).unwrap();
        assert_eq!(updated_metadata.get("page_id").unwrap().as_str().unwrap(), "objectives");
    }
}