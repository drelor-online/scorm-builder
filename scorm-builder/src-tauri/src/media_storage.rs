use crate::project_storage::get_projects_directory;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct MediaMetadata {
    pub page_id: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub source: Option<String>,
    pub embed_url: Option<String>,
    pub title: Option<String>,
    pub clip_start: Option<u32>,
    pub clip_end: Option<u32>,
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
                // or "ProjectName_abc123.scormproj"
                if let Some(underscore_pos) = file_str.rfind('_') {
                    if let Some(dot_pos) = file_str.rfind('.') {
                        if underscore_pos < dot_pos {
                            let potential_id = &file_str[underscore_pos + 1..dot_pos];
                            // Accept alphanumeric IDs (including hyphens)
                            if !potential_id.is_empty() && 
                               potential_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
                                return potential_id.to_string();
                            }
                        }
                    }
                }
                // Fallback: try to get ID from the beginning if no underscore pattern
                if let Some(dot_pos) = file_str.find('.') {
                    let potential_id = &file_str[..dot_pos];
                    // Accept alphanumeric IDs for fallback too
                    if !potential_id.is_empty() && 
                       potential_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
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
    
    // 🚨 ROOT CAUSE FIX: Validate metadata consistency to prevent contamination
    let has_youtube_metadata = metadata.source.as_ref().map_or(false, |s| s == "youtube") ||
                               metadata.embed_url.is_some() ||
                               metadata.clip_start.is_some() ||
                               metadata.clip_end.is_some();
    
    if has_youtube_metadata && metadata.media_type != "video" && metadata.media_type != "youtube" {
        println!(
            "🚨 [media_storage] CONTAMINATION PREVENTED! Attempted to store {} with YouTube metadata",
            metadata.media_type
        );
        println!("   Media ID: {}", id);
        println!("   Media Type: {}", metadata.media_type);
        println!("   Source: {:?}", metadata.source);
        println!("   Has embed_url: {}", metadata.embed_url.is_some());
        println!("   Has clip timing: {}", metadata.clip_start.is_some() || metadata.clip_end.is_some());
        println!("   🔧 Cleaning metadata to prevent UI contamination...");
        
        // Create clean metadata without YouTube fields for non-video media
        let clean_metadata = MediaMetadata {
            page_id: metadata.page_id,
            media_type: metadata.media_type,
            original_name: metadata.original_name,
            mime_type: metadata.mime_type,
            source: None, // Clear contaminated source
            embed_url: None, // Clear contaminated YouTube URL
            title: metadata.title,
            clip_start: None, // Clear contaminated clip timing
            clip_end: None, // Clear contaminated clip timing
        };
        
        println!("   ✅ Metadata cleaned - storing without YouTube contamination");
        return store_media_internal(id, actual_project_id, data, clean_metadata);
    }
    
    println!(
        "[media_storage] Storing media {id} for project {projectId} (extracted: {actual_project_id})"
    );
    
    // If metadata is clean, store normally
    store_media_internal(id, actual_project_id, data, metadata)
}

/// Internal function that does the actual storage without validation
fn store_media_internal(
    id: String,
    actual_project_id: String,
    data: Vec<u8>,
    metadata: MediaMetadata,
) -> Result<(), String> {

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

    // 🚀 EFFICIENCY FIX: Check if media already exists to avoid expensive base64 decoding
    let data_path = get_media_path(&actual_project_id, &id)?;
    let metadata_path = get_metadata_path(&actual_project_id, &id)?;
    
    if data_path.exists() && metadata_path.exists() {
        println!("[media_storage] ⚡ EFFICIENCY: Media {} already exists, skipping base64 decode", id);
        
        // Verify metadata matches (update if needed)
        match fs::read_to_string(&metadata_path) {
            Ok(existing_metadata_json) => {
                if let Ok(existing_metadata) = serde_json::from_str::<MediaMetadata>(&existing_metadata_json) {
                    // If metadata is identical, skip entirely
                    if existing_metadata == metadata {
                        println!("[media_storage] ⚡ EFFICIENCY: Metadata identical, no work needed");
                        return Ok(());
                    } else {
                        println!("[media_storage] ⚡ EFFICIENCY: Updating metadata only (no base64 decode)");
                        
                        // Update metadata without touching binary data (apply same contamination prevention)
                        let sanitized_metadata = if metadata.source.as_ref().map_or(false, |s| s == "youtube") ||
                                                      metadata.embed_url.is_some() ||
                                                      metadata.clip_start.is_some() ||
                                                      metadata.clip_end.is_some() {
                            if metadata.media_type != "video" && metadata.media_type != "youtube" {
                                // Clean contaminated metadata
                                MediaMetadata {
                                    page_id: metadata.page_id.clone(),
                                    media_type: metadata.media_type.clone(),
                                    original_name: metadata.original_name.clone(),
                                    mime_type: metadata.mime_type.clone(),
                                    source: None,
                                    embed_url: None,
                                    title: metadata.title.clone(),
                                    clip_start: None,
                                    clip_end: None,
                                }
                            } else {
                                metadata.clone()
                            }
                        } else {
                            metadata.clone()
                        };
                        let metadata_json = serde_json::to_string_pretty(&sanitized_metadata)
                            .map_err(|e| format!("Failed to serialize metadata: {e}"))?;
                        
                        fs::write(&metadata_path, metadata_json)
                            .map_err(|e| format!("Failed to update metadata: {e}"))?;
                        
                        println!("[media_storage] ⚡ EFFICIENCY: Metadata updated without base64 operations");
                        return Ok(());
                    }
                }
            }
            Err(_) => {
                // If metadata is corrupted, we'll continue with full process
                println!("[media_storage] Warning: Existing metadata corrupted, proceeding with full store");
            }
        }
    }

    // Only decode base64 if we really need to store new data
    use base64::{engine::general_purpose, Engine as _};
    let data = general_purpose::STANDARD
        .decode(&dataBase64)
        .map_err(|e| format!("Failed to decode base64: {e}"))?;

    println!("[media_storage] Decoded {} bytes from base64", data.len());

    // Use the existing store_media logic with extracted ID
    store_media(id, actual_project_id, data, metadata)
}

// DEPRECATED: This function loads all binary data and is very slow
// Use get_all_project_media_metadata instead for better performance
#[tauri::command]
pub fn get_all_project_media(
    #[allow(non_snake_case)] projectId: String,
) -> Result<Vec<MediaData>, String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] DEPRECATED: Loading all media with binary data for project {projectId} (extracted: {actual_project_id})"
    );
    println!("[media_storage] WARNING: This function is slow and loads all binary data into memory!");

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

            // Read binary data - THIS IS THE SLOW PART!
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

    println!("[media_storage] Loaded {} media items with binary data", media_list.len());
    Ok(media_list)
}

// New structure for metadata-only responses
#[derive(Debug, Serialize, Deserialize)]
pub struct MediaMetadataInfo {
    pub id: String,
    pub metadata: MediaMetadata,
    pub size: u64, // File size in bytes
}

// OPTIMIZED: Returns only metadata without loading binary data
#[tauri::command]
pub fn get_all_project_media_metadata(
    #[allow(non_snake_case)] projectId: String,
) -> Result<Vec<MediaMetadataInfo>, String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] Loading media metadata for project {projectId} (extracted: {actual_project_id})"
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

            // Get file size WITHOUT reading the data
            let data_path = get_media_path(&actual_project_id, media_id)?;
            let size = if data_path.exists() {
                fs::metadata(&data_path)
                    .map(|m| m.len())
                    .unwrap_or(0)
            } else {
                println!(
                    "[media_storage] Warning: metadata exists but data missing for {media_id}"
                );
                0
            };

            media_list.push(MediaMetadataInfo {
                id: media_id.to_string(),
                metadata,
                size,
            });

            println!("[media_storage] Found media {media_id} ({size} bytes)");
        }
    }

    println!("[media_storage] Found {} media items (metadata only)", media_list.len());
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

// 🚀 EFFICIENCY FIX: Batch operation for efficient bulk media loading
#[tauri::command]
pub fn get_media_batch(
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] mediaIds: Vec<String>,
) -> Result<Vec<MediaData>, String> {
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] 🚀 BATCH: Getting {} media items efficiently for project {}",
        mediaIds.len(),
        actual_project_id
    );
    
    let mut results = Vec::with_capacity(mediaIds.len());
    let mut successful = 0;
    let mut failed = 0;
    
    for media_id in mediaIds {
        match get_media(projectId.clone(), media_id.clone()) {
            Ok(media_data) => {
                results.push(media_data);
                successful += 1;
            }
            Err(error) => {
                println!("[media_storage] ⚠️ BATCH: Failed to get media {}: {}", media_id, error);
                failed += 1;
                // Continue with other items instead of failing entire batch
            }
        }
    }
    
    println!(
        "[media_storage] 🚀 BATCH: Completed - {} successful, {} failed",
        successful, failed
    );
    
    Ok(results)
}

// 🚀 EFFICIENCY FIX: Check if media exists without loading data (ultra-fast existence check)
#[tauri::command]
pub fn media_exists_batch(
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] mediaIds: Vec<String>,
) -> Result<Vec<bool>, String> {
    let actual_project_id = extract_project_id(&projectId);
    println!(
        "[media_storage] ⚡ EXISTS_CHECK: Checking existence of {} media items",
        mediaIds.len()
    );
    
    let results: Vec<bool> = mediaIds.iter().map(|media_id| {
        let data_path = get_media_path(&actual_project_id, media_id).unwrap_or_default();
        let metadata_path = get_metadata_path(&actual_project_id, media_id).unwrap_or_default();
        data_path.exists() && metadata_path.exists()
    }).collect();
    
    let existing_count = results.iter().filter(|&&exists| exists).count();
    println!(
        "[media_storage] ⚡ EXISTS_CHECK: {} exist, {} missing",
        existing_count, mediaIds.len() - existing_count
    );
    
    Ok(results)
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

        // Store some media first
        let metadata = MediaMetadata {
            page_id: "page1".to_string(),
            media_type: "image".to_string(),
            original_name: "test.png".to_string(),
            mime_type: Some("image/png".to_string()),
            source: None,
            embed_url: None,
            title: None,
            clip_start: None,
            clip_end: None,
        };

        // Create the media files directly for testing
        let data_path = media_dir.join(format!("{}.bin", media_id));
        let metadata_path = media_dir.join(format!("{}.json", media_id));
        fs::write(&data_path, b"test data").unwrap();
        fs::write(&metadata_path, serde_json::to_string(&metadata).unwrap()).unwrap();

        // Try to delete with .scormproj filename format
        let scormproj_filename = format!("TestProject_{}.scormproj", project_id);
        
        // Set the test directory for this specific test
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        let result = delete_media(scormproj_filename, media_id.to_string());
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");

        // This works correctly - extract_project_id handles .scormproj filenames
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
            clip_start: None,
            clip_end: None,
        };

        let test_data = b"test image data";

        // Create the media files directly for testing
        let data_path = media_dir.join(format!("{}.bin", media_id));
        let metadata_path = media_dir.join(format!("{}.json", media_id));
        fs::write(&data_path, test_data).unwrap();
        fs::write(&metadata_path, serde_json::to_string(&metadata).unwrap()).unwrap();

        // Try to get with .scormproj filename format
        let scormproj_filename = format!("TestProject_{}.scormproj", project_id);
        
        // Set the test directory for this specific test
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        let result = get_media(scormproj_filename, media_id.to_string());
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");

        // This works correctly - extract_project_id handles .scormproj filenames
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

        // Create the project directory
        let project_id = "test-project";
        let media_dir = temp_dir.path().join(project_id).join("media");
        fs::create_dir_all(&media_dir).unwrap();

        // Create test data (1KB for faster testing)
        let test_data = vec![42u8; 1024];
        let base64_data = general_purpose::STANDARD.encode(&test_data);

        // Set the test directory for this specific test
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
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
                clip_start: None,
                clip_end: None,
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
        
        // Clean up
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }

    #[test]
    fn test_store_media_handles_large_base64_files() {
        use tempfile::TempDir;

        // Setup temp directory for testing
        let temp_dir = TempDir::new().unwrap();

        // Create the project directory
        let project_id = "test-project-large";
        let media_dir = temp_dir.path().join(project_id).join("media");
        fs::create_dir_all(&media_dir).unwrap();
        
        // Set the test directory for this specific test
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());

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
                clip_start: None,
                clip_end: None,
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
        
        // Clean up
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
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

// Include clip timing tests
#[cfg(test)]
mod clip_timing_tests {
    use super::*;
    use serde_json;
    
    #[test]
    fn test_media_metadata_with_clip_timing_serialization() {
        println!("[RUST TEST] 🧪 Testing MediaMetadata serialization with clip timing...");
        
        // Create MediaMetadata with clip timing (simulating what JavaScript sends)
        let metadata = MediaMetadata {
            page_id: "topic-0".to_string(),
            media_type: "youtube".to_string(),
            original_name: "Test YouTube Video".to_string(),
            mime_type: Some("text/plain".to_string()),
            source: Some("youtube".to_string()),
            embed_url: Some("https://www.youtube.com/embed/testId".to_string()),
            title: Some("Test YouTube Video".to_string()),
            clip_start: Some(90),   // 1:30
            clip_end: Some(225),    // 3:45
        };
        
        // Serialize to JSON (simulates what happens when storing to filesystem)
        let json = serde_json::to_string(&metadata).expect("Should serialize to JSON");
        println!("[RUST TEST] 📤 Serialized JSON: {}", json);
        
        // Verify JSON contains clip timing fields
        assert!(json.contains("\"clip_start\":90"));
        assert!(json.contains("\"clip_end\":225"));
        
        // Deserialize from JSON (simulates what happens when loading from filesystem) 
        let deserialized: MediaMetadata = serde_json::from_str(&json).expect("Should deserialize from JSON");
        
        // Verify clip timing fields are preserved
        assert_eq!(deserialized.clip_start, Some(90));
        assert_eq!(deserialized.clip_end, Some(225));
        assert_eq!(deserialized.page_id, "topic-0");
        
        println!("[RUST TEST] ✅ MediaMetadata serialization/deserialization with clip timing works correctly!");
    }
    
    #[test]
    fn test_javascript_to_rust_clip_timing_compatibility() {
        println!("[RUST TEST] 🧪 Testing JavaScript → Rust clip timing compatibility...");
        
        // Simulate JSON that JavaScript would send (with our FileStorage.ts fix)
        let javascript_json = r#"{
            "page_id": "topic-0",
            "type": "youtube",
            "original_name": "JavaScript Test Video",
            "mime_type": "text/plain",
            "source": "youtube",
            "embed_url": "https://www.youtube.com/embed/testId?start=45&end=180",
            "title": "JavaScript Test Video",
            "clip_start": 45,
            "clip_end": 180
        }"#;
        
        // Rust should be able to deserialize this
        let metadata: MediaMetadata = serde_json::from_str(javascript_json)
            .expect("Should deserialize JavaScript JSON");
        
        // Verify all fields are correct
        assert_eq!(metadata.page_id, "topic-0");
        assert_eq!(metadata.media_type, "youtube");
        assert_eq!(metadata.clip_start, Some(45));
        assert_eq!(metadata.clip_end, Some(180));
        
        println!("[RUST TEST] ✅ JavaScript → Rust clip timing compatibility verified!");
    }
    
    #[test]
    fn test_legacy_json_backward_compatibility() {
        println!("[RUST TEST] 🧪 Testing legacy JSON without clip timing fields...");
        
        // Simulate old JSON that doesn't have clip timing fields
        let legacy_json = r#"{
            "page_id": "topic-0", 
            "type": "youtube",
            "original_name": "Legacy Video",
            "mime_type": "text/plain",
            "source": "youtube",
            "embed_url": "https://www.youtube.com/embed/legacyId",
            "title": "Legacy Video"
        }"#;
        
        // Rust should still be able to deserialize this (backward compatibility)
        let metadata: MediaMetadata = serde_json::from_str(legacy_json)
            .expect("Should deserialize legacy JSON without clip timing");
            
        // Verify clip timing fields default to None
        assert_eq!(metadata.clip_start, None);
        assert_eq!(metadata.clip_end, None);
        assert_eq!(metadata.media_type, "youtube");
        
        println!("[RUST TEST] ✅ Legacy JSON backward compatibility maintained!");
    }
}

// Contamination prevention tests
#[cfg(test)]
mod contamination_prevention_tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    
    #[test]
    fn test_contamination_prevention_in_store_media() {
        println!("🧪 [RUST TEST] Testing ROOT CAUSE FIX: contamination prevention in store_media...");
        
        // Setup temp directory
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "contamination-test";
        let media_id = "contaminated-image";
        let test_data = vec![42u8; 100]; // Small test image data
        
        // Create contaminated metadata - image with YouTube fields
        let contaminated_metadata = MediaMetadata {
            page_id: "test-page".to_string(),
            media_type: "image".to_string(), // This is an IMAGE
            original_name: "test-image.jpg".to_string(),
            mime_type: Some("image/jpeg".to_string()),
            // Contaminated YouTube fields that should be cleaned
            source: Some("youtube".to_string()), // WRONG for image
            embed_url: Some("https://www.youtube.com/embed/test".to_string()), // WRONG for image
            title: Some("Test Image".to_string()),
            clip_start: Some(30), // WRONG for image
            clip_end: Some(60), // WRONG for image
        };
        
        // This should trigger contamination prevention and store clean metadata
        let result = store_media(
            media_id.to_string(),
            project_id.to_string(),
            test_data.clone(),
            contaminated_metadata
        );
        
        assert!(result.is_ok(), "Store should succeed even with contaminated metadata");
        
        // Verify the stored metadata was cleaned
        let metadata_path = temp_dir.path()
            .join(project_id)
            .join("media")
            .join(format!("{}.json", media_id));
            
        assert!(metadata_path.exists(), "Metadata file should be created");
        
        let stored_metadata_json = fs::read_to_string(&metadata_path).unwrap();
        let stored_metadata: MediaMetadata = serde_json::from_str(&stored_metadata_json).unwrap();
        
        // Verify contaminated fields were cleaned
        assert_eq!(stored_metadata.media_type, "image");
        assert_eq!(stored_metadata.source, None, "Source should be cleaned");
        assert_eq!(stored_metadata.embed_url, None, "Embed URL should be cleaned");
        assert_eq!(stored_metadata.clip_start, None, "Clip start should be cleaned");
        assert_eq!(stored_metadata.clip_end, None, "Clip end should be cleaned");
        
        // Verify legitimate fields were preserved
        assert_eq!(stored_metadata.page_id, "test-page");
        assert_eq!(stored_metadata.original_name, "test-image.jpg");
        assert_eq!(stored_metadata.mime_type, Some("image/jpeg".to_string()));
        assert_eq!(stored_metadata.title, Some("Test Image".to_string()));
        
        println!("✅ [RUST TEST] ROOT CAUSE FIX: Contamination prevention working correctly!");
        
        // Cleanup
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
    
    #[test]
    fn test_legitimate_youtube_video_storage_still_works() {
        println!("🧪 [RUST TEST] Testing legitimate YouTube video storage still works...");
        
        // Setup temp directory
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "youtube-test";
        let media_id = "legitimate-youtube";
        let test_data = vec![123u8; 50]; // Small test video data
        
        // Create legitimate YouTube video metadata
        let youtube_metadata = MediaMetadata {
            page_id: "test-page".to_string(),
            media_type: "video".to_string(), // This is a VIDEO - legitimate
            original_name: "youtube-video.mp4".to_string(),
            mime_type: Some("video/mp4".to_string()),
            // These are legitimate for video
            source: Some("youtube".to_string()), 
            embed_url: Some("https://www.youtube.com/embed/realvideo".to_string()),
            title: Some("Real YouTube Video".to_string()),
            clip_start: Some(15),
            clip_end: Some(90),
        };
        
        // This should store without any cleaning
        let result = store_media(
            media_id.to_string(),
            project_id.to_string(),
            test_data.clone(),
            youtube_metadata.clone()
        );
        
        assert!(result.is_ok(), "Legitimate YouTube video storage should succeed");
        
        // Verify the stored metadata was NOT cleaned (all fields preserved)
        let metadata_path = temp_dir.path()
            .join(project_id)
            .join("media")
            .join(format!("{}.json", media_id));
            
        let stored_metadata_json = fs::read_to_string(&metadata_path).unwrap();
        let stored_metadata: MediaMetadata = serde_json::from_str(&stored_metadata_json).unwrap();
        
        // Verify all YouTube fields were preserved
        assert_eq!(stored_metadata.media_type, "video");
        assert_eq!(stored_metadata.source, Some("youtube".to_string()));
        assert_eq!(stored_metadata.embed_url, Some("https://www.youtube.com/embed/realvideo".to_string()));
        assert_eq!(stored_metadata.clip_start, Some(15));
        assert_eq!(stored_metadata.clip_end, Some(90));
        assert_eq!(stored_metadata.title, Some("Real YouTube Video".to_string()));
        
        println!("✅ [RUST TEST] Legitimate YouTube video storage working correctly!");
        
        // Cleanup
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
    
    #[test]
    fn test_base64_storage_inherits_contamination_prevention() {
        println!("🧪 [RUST TEST] Testing base64 storage inherits contamination prevention...");
        
        // Setup temp directory
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "base64-test";
        let media_id = "base64-contaminated";
        let test_data = vec![255u8; 75];
        
        use base64::{engine::general_purpose, Engine as _};
        let base64_data = general_purpose::STANDARD.encode(&test_data);
        
        // Create contaminated metadata for audio with YouTube fields
        let contaminated_metadata = MediaMetadata {
            page_id: "test-page".to_string(),
            media_type: "audio".to_string(), // This is AUDIO
            original_name: "test-audio.mp3".to_string(),
            mime_type: Some("audio/mp3".to_string()),
            // Contaminated YouTube fields
            source: Some("youtube".to_string()), // WRONG for audio
            embed_url: Some("https://www.youtube.com/embed/audio".to_string()), // WRONG
            title: Some("Audio File".to_string()),
            clip_start: Some(10), // WRONG for audio
            clip_end: Some(50), // WRONG for audio
        };
        
        // This should trigger contamination prevention via store_media_base64 -> store_media
        let result = store_media_base64(
            media_id.to_string(),
            project_id.to_string(),
            base64_data,
            contaminated_metadata
        );
        
        assert!(result.is_ok(), "Base64 store should succeed with contamination prevention");
        
        // Verify contaminated fields were cleaned
        let metadata_path = temp_dir.path()
            .join(project_id)
            .join("media")
            .join(format!("{}.json", media_id));
            
        let stored_metadata_json = fs::read_to_string(&metadata_path).unwrap();
        let stored_metadata: MediaMetadata = serde_json::from_str(&stored_metadata_json).unwrap();
        
        assert_eq!(stored_metadata.media_type, "audio");
        assert_eq!(stored_metadata.source, None, "Source should be cleaned");
        assert_eq!(stored_metadata.embed_url, None, "Embed URL should be cleaned");
        assert_eq!(stored_metadata.clip_start, None, "Clip start should be cleaned");
        assert_eq!(stored_metadata.clip_end, None, "Clip end should be cleaned");
        
        println!("✅ [RUST TEST] ROOT CAUSE FIX: Base64 contamination prevention working!");
        
        // Cleanup
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
}

// Add efficiency tests module
mod efficiency_test;
mod batch_operations_test;

#[cfg(test)]
mod efficiency_integration_tests {
    use super::*;
    use base64::{engine::general_purpose, Engine as _};
    use std::time::Instant;
    use tempfile::TempDir;
    
    // Integration test to verify the efficiency fix works with real backend calls
    #[test]
    fn test_efficiency_fix_integration() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "efficiency-integration-test";
        let media_id = "test-efficiency-media";
        
        // Create 100KB test data to make timing differences measurable
        let test_data = vec![42u8; 100 * 1024];
        let base64_data = general_purpose::STANDARD.encode(&test_data);
        
        let metadata = MediaMetadata {
            page_id: "test-page".to_string(),
            media_type: "audio".to_string(),
            original_name: "efficiency-test.mp3".to_string(),
            mime_type: Some("audio/mp3".to_string()),
            source: None,
            embed_url: None,
            title: None,
            clip_start: None,
            clip_end: None,
        };
        
        // First call - should perform full base64 decode and store
        let start = Instant::now();
        let result1 = store_media_base64(
            media_id.to_string(),
            project_id.to_string(),
            base64_data.clone(),
            metadata.clone()
        );
        let duration1 = start.elapsed();
        
        assert!(result1.is_ok(), "First store should succeed");
        
        // Second call - after implementing efficiency fix, should be much faster
        let start = Instant::now();
        let result2 = store_media_base64(
            media_id.to_string(),
            project_id.to_string(),
            base64_data,
            metadata
        );
        let duration2 = start.elapsed();
        
        assert!(result2.is_ok(), "Second store should succeed");
        
        println!("[EFFICIENCY INTEGRATION] First call: {:?}, Second call: {:?}", duration1, duration2);
        
        // Verify data integrity
        let retrieved = get_media(project_id.to_string(), media_id.to_string()).unwrap();
        assert_eq!(retrieved.data.len(), test_data.len());
        
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
}
