// Minimal test to verify the media storage fix
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

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

fn get_media_directory(project_id: &str) -> Result<PathBuf, String> {
    // Check for test environment variable first
    let projects_dir = if let Ok(test_dir) = std::env::var("SCORM_BUILDER_TEST_DIR") {
        PathBuf::from(test_dir)
    } else {
        return Err("No test directory set".to_string());
    };

    let media_dir = projects_dir.join(project_id).join("media");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&media_dir).map_err(|e| format!("Failed to create media directory: {e}"))?;
    
    Ok(media_dir)
}

fn delete_media(project_id: String, media_id: String) -> Result<(), String> {
    // Extract actual project ID in case a path was passed
    let actual_project_id = extract_project_id(&project_id);
    println!("Deleting media {} from project {} (extracted: {})", media_id, project_id, actual_project_id);
    
    let media_dir = get_media_directory(&actual_project_id)?;
    
    // Delete data file
    let data_path = media_dir.join(format!("{}.bin", media_id));
    if data_path.exists() {
        fs::remove_file(&data_path).map_err(|e| format!("Failed to delete media data: {e}"))?;
    }
    
    // Delete metadata file  
    let metadata_path = media_dir.join(format!("{}.json", media_id));
    if metadata_path.exists() {
        fs::remove_file(&metadata_path).map_err(|e| format!("Failed to delete metadata: {e}"))?;
    }
    
    println!("Successfully deleted media {}", media_id);
    Ok(())
}

fn main() {
    println!("Testing media storage with .scormproj filenames...\n");
    
    // Setup
    let temp_dir = TempDir::new().unwrap();
    let project_id = "1234567890";
    let media_id = "test-media";
    
    // Create the project media directory
    let media_dir = temp_dir.path().join(project_id).join("media");
    fs::create_dir_all(&media_dir).unwrap();
    
    // Set up to use the temp directory
    std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
    
    // Create test media files
    let data_path = media_dir.join(format!("{}.bin", media_id));
    let metadata_path = media_dir.join(format!("{}.json", media_id));
    fs::write(&data_path, b"test data").unwrap();
    fs::write(&metadata_path, r#"{"page_id":"page1","media_type":"image"}"#).unwrap();
    
    println!("Created test files:");
    println!("  - {:?}", data_path);
    println!("  - {:?}", metadata_path);
    
    // Test deletion with .scormproj filename format
    let scormproj_filename = format!("TestProject_{}.scormproj", project_id);
    println!("\nTrying to delete with: {}", scormproj_filename);
    
    let result = delete_media(scormproj_filename, media_id.to_string());
    
    // Check results
    match result {
        Ok(_) => {
            println!("✓ Delete succeeded!");
            
            if !data_path.exists() && !metadata_path.exists() {
                println!("✓ Files were deleted correctly!");
                println!("\nTEST PASSED!");
            } else {
                println!("✗ Files still exist!");
                println!("\nTEST FAILED!");
            }
        }
        Err(e) => {
            println!("✗ Delete failed: {}", e);
            println!("\nTEST FAILED!");
        }
    }
}