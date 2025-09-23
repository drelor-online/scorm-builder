#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Test that reproduces the 0-byte ZIP issue reported by user
    #[tokio::test]
    async fn test_export_creates_non_empty_zip() {
        // Create a temp project file similar to the user's setup
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let project_path = temp_dir.path().join("test_project.scormproj");

        // Create a realistic project file with content
        let project_data = r#"{
            "id": "test-project-123",
            "name": "Test Project",
            "description": "A test project",
            "courseSeedData": {
                "title": "Test Course",
                "description": "Test course description",
                "learningObjectives": ["Objective 1", "Objective 2"]
            },
            "courseContent": {
                "pages": [
                    {
                        "id": "page1",
                        "title": "Introduction",
                        "content": "Welcome to the course"
                    }
                ]
            }
        }"#;

        fs::write(&project_path, project_data).expect("Failed to write project file");

        // Call the export function
        let result = create_project_zip(
            project_path.to_string_lossy().to_string(),
            "test-project-123".to_string(),
            false, // No media for now
        ).await;

        println!("Export result: {:?}", result);

        // Verify the result is successful
        assert!(result.is_ok(), "Export should succeed");

        let zip_result = result.unwrap();

        // Log detailed information
        println!("File count: {}", zip_result.file_count);
        println!("Total size: {}", zip_result.total_size);
        println!("ZIP buffer length: {}", zip_result.zip_data.len());

        // The buffer should not be empty
        assert!(zip_result.zip_data.len() > 0, "ZIP buffer should not be empty");
        assert!(zip_result.file_count > 0, "Should have at least one file");
        assert!(zip_result.total_size > 0, "Total size should be greater than 0");

        // Try to extract and verify the ZIP is valid
        let extract_result = extract_project_zip(zip_result.zip_data).await;
        assert!(extract_result.is_ok(), "Should be able to extract the created ZIP");

        println!("Test passed - ZIP creation works correctly");
    }

    /// Test with media files to match user's scenario more closely
    #[tokio::test]
    async fn test_export_with_media_files() {
        // Create temp directories
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let project_path = temp_dir.path().join("test_project_with_media.scormproj");

        // Create project file
        let project_data = r#"{
            "id": "test-project-media-456",
            "name": "Test Project with Media",
            "description": "A test project with media files",
            "courseSeedData": {
                "title": "Test Course with Media",
                "description": "Test course with media files"
            },
            "courseContent": {
                "pages": [
                    {
                        "id": "page1",
                        "title": "Introduction",
                        "content": "Welcome to the course with media"
                    }
                ]
            }
        }"#;

        fs::write(&project_path, project_data).expect("Failed to write project file");

        // Create a media directory and files (simulating the user's setup)
        let media_dir = temp_dir.path().join("media").join("test-project-media-456");
        fs::create_dir_all(&media_dir).expect("Failed to create media directory");

        // Create some test media files
        let audio_file = media_dir.join("audio-0.mp3");
        let image_file = media_dir.join("image-1.jpg");

        fs::write(&audio_file, b"fake audio data").expect("Failed to write audio file");
        fs::write(&image_file, b"fake image data").expect("Failed to write image file");

        println!("Created test media files:");
        println!("  Audio: {} bytes", fs::metadata(&audio_file).unwrap().len());
        println!("  Image: {} bytes", fs::metadata(&image_file).unwrap().len());

        // Export with media
        let result = create_project_zip(
            project_path.to_string_lossy().to_string(),
            "test-project-media-456".to_string(),
            true, // Include media
        ).await;

        println!("Export with media result: {:?}", result);

        // Verify the result
        assert!(result.is_ok(), "Export with media should succeed");

        let zip_result = result.unwrap();

        println!("Media export - File count: {}", zip_result.file_count);
        println!("Media export - Total size: {}", zip_result.total_size);
        println!("Media export - ZIP buffer length: {}", zip_result.zip_data.len());

        // Should have project file + media files
        assert!(zip_result.zip_data.len() > 0, "ZIP buffer should not be empty");
        assert!(zip_result.file_count >= 3, "Should have project file + 2 media files");
        assert!(zip_result.total_size > 30, "Total size should include all files");

        println!("Media test passed - ZIP creation with media works correctly");
    }

    /// Test that specifically checks buffer handling
    #[tokio::test]
    async fn test_buffer_handling_detailed() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let project_path = temp_dir.path().join("buffer_test.scormproj");

        // Create a larger project file to make buffer issues more obvious
        let large_content = "x".repeat(10000); // 10KB of content
        let project_data = format!(r#"{{
            "id": "buffer-test-789",
            "name": "Buffer Test Project",
            "description": "Testing buffer handling with large content: {}",
            "courseSeedData": {{
                "title": "Buffer Test Course",
                "description": "Large content for buffer testing"
            }}
        }}"#, large_content);

        fs::write(&project_path, &project_data).expect("Failed to write project file");

        println!("Created project file with {} bytes", project_data.len());

        // Export and examine buffer at each step
        let result = create_project_zip(
            project_path.to_string_lossy().to_string(),
            "buffer-test-789".to_string(),
            false,
        ).await;

        assert!(result.is_ok(), "Buffer test export should succeed");

        let zip_result = result.unwrap();

        println!("Buffer test results:");
        println!("  Original file size: {} bytes", project_data.len());
        println!("  ZIP file count: {}", zip_result.file_count);
        println!("  ZIP total size: {}", zip_result.total_size);
        println!("  ZIP buffer length: {}", zip_result.zip_data.len());

        // The ZIP should be smaller than the original due to compression but not empty
        assert!(zip_result.zip_data.len() > 100, "Compressed ZIP should still be substantial");
        assert!(zip_result.zip_data.len() < project_data.len(), "ZIP should be compressed");

        // Verify we can extract it
        let extract_result = extract_project_zip(zip_result.zip_data).await;
        assert!(extract_result.is_ok(), "Should be able to extract buffer test ZIP");

        println!("Buffer test passed - large content handled correctly");
    }
}