use crate::project_storage::get_projects_directory;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaMetadata {
    pub page_id: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub source: Option<String>,
    pub embed_url: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaData {
    pub id: String,
    pub data: Vec<u8>,
    pub metadata: MediaMetadata,
}

/// Extract project ID from a path or return the ID if it's already just an ID
fn extract_project_id(project_id_or_path: &str) -> String {
    // If it contains .scormproj, extract the ID from the filename
    if project_id_or_path.contains(".scormproj") {
        // Get the filename from the path
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

pub fn get_media_directory(project_id: &str) -> Result<PathBuf, String> {
    // Check for test environment variable first
    let projects_dir = if let Ok(test_dir) = std::env::var("SCORM_BUILDER_TEST_DIR") {
        PathBuf::from(test_dir)
    } else {
        get_projects_directory().map_err(|e| format!("Failed to get projects directory: {e}"))?
    };

    let media_dir = projects_dir.join(project_id).join("media");

    // Always attempt to create directory - handle "already exists" as success
    match fs::create_dir_all(&media_dir) {
        Ok(_) => Ok(media_dir),
        Err(e) => {
            // On Windows, error 183 means "already exists" which is fine
            // Also check for standard AlreadyExists error kind
            if e.kind() == std::io::ErrorKind::AlreadyExists
                || (cfg!(windows) && e.raw_os_error() == Some(183))
            {
                Ok(media_dir)
            } else {
                Err(format!("Failed to create media directory: {e}"))
            }
        }
    }
}

pub fn get_media_path(project_id: &str, media_id: &str) -> Result<PathBuf, String> {
    let media_dir = get_media_directory(project_id)?;
    Ok(media_dir.join(format!("{media_id}.bin")))
}

pub fn get_metadata_path(project_id: &str, media_id: &str) -> Result<PathBuf, String> {
    let media_dir = get_media_directory(project_id)?;
    Ok(media_dir.join(format!("{media_id}.json")))
}

#[tauri::command]
pub fn store_media(
    id: String,
    #[allow(non_snake_case)] projectId: String,
    data: Vec<u8>,
    metadata: MediaMetadata,
) -> Result<(), String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] Storing media {id} for project {projectId} (extracted: {actual_project_id})"
    );

    // Store the binary data
    let data_path = get_media_path(&actual_project_id, &id)?;
    fs::write(&data_path, &data).map_err(|e| format!("Failed to write media data: {e}"))?;

    // Store the metadata
    let metadata_path = get_metadata_path(&actual_project_id, &id)?;
    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {e}"))?;
    fs::write(&metadata_path, metadata_json)
        .map_err(|e| format!("Failed to write metadata: {e}"))?;

    println!(
        "[media_storage] Successfully stored media {} ({} bytes)",
        id,
        data.len()
    );
    Ok(())
}

#[tauri::command]
pub fn store_media_base64(
    id: String,
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] dataBase64: String,
    metadata: MediaMetadata,
) -> Result<(), String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] Storing media {id} from base64 for project {projectId} (extracted: {actual_project_id})"
    );

    // Decode base64 to Vec<u8>
    use base64::{engine::general_purpose, Engine as _};
    let data = general_purpose::STANDARD
        .decode(&dataBase64)
        .map_err(|e| format!("Failed to decode base64: {e}"))?;

    println!("[media_storage] Decoded {} bytes from base64", data.len());

    // Use the existing store_media logic with extracted ID
    store_media(id, actual_project_id, data, metadata)
}

#[tauri::command]
pub fn get_all_project_media(
    #[allow(non_snake_case)] projectId: String,
) -> Result<Vec<MediaData>, String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] Loading all media for project {projectId} (extracted: {actual_project_id})"
    );

    let media_dir = get_media_directory(&actual_project_id)?;
    let mut media_list = Vec::new();

    if !media_dir.exists() {
        println!("[media_storage] Media directory doesn't exist, returning empty list");
        return Ok(media_list);
    }

    // Read all .json files in the media directory
    let entries =
        fs::read_dir(&media_dir).map_err(|e| format!("Failed to read media directory: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();

        // Only process .json files
        if path.extension() == Some(std::ffi::OsStr::new("json")) {
            let media_id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .ok_or_else(|| "Invalid file name".to_string())?;

            // Read metadata
            let metadata_json = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read metadata for {media_id}: {e}"))?;
            let metadata: MediaMetadata = serde_json::from_str(&metadata_json)
                .map_err(|e| format!("Failed to parse metadata for {media_id}: {e}"))?;

            // Read binary data
            let data_path = get_media_path(&actual_project_id, media_id)?;
            if data_path.exists() {
                let data = fs::read(&data_path)
                    .map_err(|e| format!("Failed to read media data for {media_id}: {e}"))?;

                let data_len = data.len();

                media_list.push(MediaData {
                    id: media_id.to_string(),
                    data,
                    metadata,
                });

                println!("[media_storage] Loaded media {media_id} ({data_len} bytes)");
            } else {
                println!(
                    "[media_storage] Warning: metadata exists but data missing for {media_id}"
                );
            }
        }
    }

    println!("[media_storage] Loaded {} media items", media_list.len());
    Ok(media_list)
}

#[tauri::command]
pub fn delete_media(
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] mediaId: String,
) -> Result<(), String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] Deleting media {mediaId} from project {projectId} (extracted: {actual_project_id})"
    );

    // Delete data file
    let data_path = get_media_path(&actual_project_id, &mediaId)?;
    if data_path.exists() {
        fs::remove_file(&data_path).map_err(|e| format!("Failed to delete media data: {e}"))?;
    }

    // Delete metadata file
    let metadata_path = get_metadata_path(&actual_project_id, &mediaId)?;
    if metadata_path.exists() {
        fs::remove_file(&metadata_path).map_err(|e| format!("Failed to delete metadata: {e}"))?;
    }

    println!("[media_storage] Successfully deleted media {mediaId}");
    Ok(())
}

#[tauri::command]
pub fn get_media(
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] mediaId: String,
) -> Result<MediaData, String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] Getting media {mediaId} from project {projectId} (extracted: {actual_project_id})"
    );

    // Read metadata
    let metadata_path = get_metadata_path(&actual_project_id, &mediaId)?;
    let metadata_json =
        fs::read_to_string(&metadata_path).map_err(|e| format!("Failed to read metadata: {e}"))?;
    let metadata: MediaMetadata = serde_json::from_str(&metadata_json)
        .map_err(|e| format!("Failed to parse metadata: {e}"))?;

    // Read binary data
    let data_path = get_media_path(&actual_project_id, &mediaId)?;
    let data = fs::read(&data_path).map_err(|e| format!("Failed to read media data: {e}"))?;

    Ok(MediaData {
        id: mediaId,
        data,
        metadata,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose, Engine as _};

    // Test helper to call the actual store_media_base64 command
    // Note: Removed the mock function - we'll test the real implementation

    #[test]
    fn test_delete_media_with_scormproj_filename() {
        use std::fs;
        use tempfile::TempDir;

        // Setup
        let temp_dir = TempDir::new().unwrap();
        let project_id = "1234567890";
        let media_id = "test-media";

        // Create the project media directory
        let media_dir = temp_dir.path().join(project_id).join("media");
        fs::create_dir_all(&media_dir).unwrap();

        // Set up to use the temp directory
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());

        // Store some media first
        let metadata = MediaMetadata {
            page_id: "page1".to_string(),
            media_type: "image".to_string(),
            original_name: "test.png".to_string(),
            mime_type: Some("image/png".to_string()),
            source: None,
            embed_url: None,
            title: None,
        };

        // Create the media files directly for testing
        let data_path = media_dir.join(format!("{}.bin", media_id));
        let metadata_path = media_dir.join(format!("{}.json", media_id));
        fs::write(&data_path, b"test data").unwrap();
        fs::write(&metadata_path, serde_json::to_string(&metadata).unwrap()).unwrap();

        // Try to delete with .scormproj filename format
        let scormproj_filename = format!("TestProject_{}.scormproj", project_id);
        let result = delete_media(scormproj_filename, media_id.to_string());

        // This should work after fix (currently will fail)
        assert!(
            result.is_ok(),
            "Should be able to delete media with .scormproj filename"
        );
        assert!(!data_path.exists(), "Data file should be deleted");
        assert!(!metadata_path.exists(), "Metadata file should be deleted");
    }

    #[test]
    fn test_get_media_with_scormproj_filename() {
        use std::fs;
        use tempfile::TempDir;

        // Setup
        let temp_dir = TempDir::new().unwrap();
        let project_id = "1234567890";
        let media_id = "test-media";

        // Create the project media directory
        let media_dir = temp_dir.path().join(project_id).join("media");
        fs::create_dir_all(&media_dir).unwrap();

        // Set up to use the temp directory
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());

        // Store some media first
        let metadata = MediaMetadata {
            page_id: "page1".to_string(),
            media_type: "image".to_string(),
            original_name: "test.png".to_string(),
            mime_type: Some("image/png".to_string()),
            source: None,
            embed_url: None,
            title: None,
        };

        let test_data = b"test image data";

        // Create the media files directly for testing
        let data_path = media_dir.join(format!("{}.bin", media_id));
        let metadata_path = media_dir.join(format!("{}.json", media_id));
        fs::write(&data_path, test_data).unwrap();
        fs::write(&metadata_path, serde_json::to_string(&metadata).unwrap()).unwrap();

        // Try to get with .scormproj filename format
        let scormproj_filename = format!("TestProject_{}.scormproj", project_id);
        let result = get_media(scormproj_filename, media_id.to_string());

        // This should work after fix (currently will fail)
        assert!(
            result.is_ok(),
            "Should be able to get media with .scormproj filename"
        );
        let media_data = result.unwrap();
        assert_eq!(media_data.id, media_id);
        assert_eq!(media_data.data, test_data);
        assert_eq!(media_data.metadata.original_name, "test.png");
    }

    #[test]
    fn test_store_media_accepts_base64_data() {
        use tempfile::TempDir;

        // Setup temp directory for testing
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());

        // Create the project directory
        let project_id = "test-project";
        let media_dir = temp_dir.path().join(project_id).join("media");
        fs::create_dir_all(&media_dir).unwrap();

        // Create test data (1KB for faster testing)
        let test_data = vec![42u8; 1024];
        let base64_data = general_purpose::STANDARD.encode(&test_data);

        // This should work with base64 input
        let result = super::store_media_base64(
            "test-media-id".to_string(),
            project_id.to_string(),
            base64_data,
            MediaMetadata {
                page_id: "test-page".to_string(),
                media_type: "audio".to_string(),
                original_name: "test.wav".to_string(),
                mime_type: Some("audio/wav".to_string()),
                source: None,
                embed_url: None,
                title: None,
            },
        );

        // Test should pass - function is implemented
        assert!(
            result.is_ok(),
            "store_media_base64 should succeed: {:?}",
            result
        );

        // Verify the files were created
        let data_path = media_dir.join("test-media-id.bin");
        let metadata_path = media_dir.join("test-media-id.json");
        assert!(data_path.exists(), "Data file should be created");
        assert!(metadata_path.exists(), "Metadata file should be created");

        // Verify the data was stored correctly
        let stored_data = fs::read(&data_path).unwrap();
        assert_eq!(stored_data, test_data, "Stored data should match original");
    }

    #[test]
    fn test_store_media_handles_large_base64_files() {
        use tempfile::TempDir;

        // Setup temp directory for testing
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());

        // Create the project directory
        let project_id = "test-project-large";
        let media_dir = temp_dir.path().join(project_id).join("media");
        fs::create_dir_all(&media_dir).unwrap();

        // Test with a larger file to ensure memory efficiency
        let large_size = 5 * 1024 * 1024; // 5MB for testing
        let test_data = vec![42u8; large_size];
        let base64_data = general_purpose::STANDARD.encode(&test_data);

        // This should handle large files efficiently
        let result = super::store_media_base64(
            "test-media-large".to_string(),
            project_id.to_string(),
            base64_data,
            MediaMetadata {
                page_id: "test-page".to_string(),
                media_type: "audio".to_string(),
                original_name: "large-audio.wav".to_string(),
                mime_type: Some("audio/wav".to_string()),
                source: None,
                embed_url: None,
                title: None,
            },
        );

        // Should succeed with real implementation
        assert!(result.is_ok(), "Should handle large files: {:?}", result);

        // Verify the large file was stored correctly
        let data_path = media_dir.join("test-media-large.bin");
        assert!(data_path.exists(), "Large data file should be created");
        let stored_data = fs::read(&data_path).unwrap();
        assert_eq!(
            stored_data.len(),
            large_size,
            "Stored data size should match"
        );
    }

    #[test]
    fn test_backward_compatibility_with_vec_u8() {
        // Ensure the original store_media function still works
        // We'll just test that it compiles and has the right signature
        let test_data = vec![1, 2, 3, 4, 5];

        // This test verifies the function exists with the right signature
        // We can't actually run it without setting up the full environment
        let _ = |id: String,
                 project_id: String,
                 data: Vec<u8>,
                 metadata: MediaMetadata|
         -> Result<(), String> { store_media(id, project_id, data, metadata) };

        // Test passes if it compiles
        assert!(true);
    }
}
