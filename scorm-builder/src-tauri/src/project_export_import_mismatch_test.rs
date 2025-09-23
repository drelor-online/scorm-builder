// Imports are available from parent module

/// Test that reproduces and verifies the fix for project ID mismatch issue
/// Where the .scormproj file contains a different ID than the directory structure
#[tokio::test]
async fn test_export_with_mismatched_project_id() {
    println!("=== Testing Project ID Mismatch Fix ===");

    // Create temp directories that mirror the production structure
    let temp_base = tempfile::TempDir::new().expect("Failed to create temp base directory");
    let projects_dir = temp_base.path().join("SCORM Projects");
    fs::create_dir_all(&projects_dir).expect("Failed to create projects directory");

    // Set environment variable to use our test directory
    std::env::set_var("SCORM_BUILDER_TEST_DIR", projects_dir.to_string_lossy().to_string());

    // Simulate the real scenario:
    // - Project file has ID "1756944197691" inside it
    // - But media is stored in directory "1758555180766" (from filename)
    let file_project_id = "1756944197691";
    let directory_project_id = "1758555180766";

    // Create project file with the internal ID
    let project_filename = format!("Complex_Projects_-_03_-_ASME_B31_8_(Gas_Transmission_&_Distribution_Piping_Code)_{}.scormproj", directory_project_id);
    let project_path = projects_dir.join(&project_filename);

    let project_data = serde_json::json!({
        "project": {
            "id": file_project_id,  // Different from directory name!
            "name": "Complex Projects - 03 - ASME B31_8 (Gas Transmission & Distribution Piping Code)",
            "created": "2025-09-04T00:03:17.693539600Z",
            "last_modified": "2025-09-22T15:52:57.497153600Z",
            "path": project_path.to_string_lossy()
        },
        "course_data": {
            "title": "Complex Projects - 03 - ASME B31_8 (Gas Transmission & Distribution Piping Code)",
            "difficulty": 3,
            "template": "None",
            "topics": [
                "3.1. Scope of ASME B31.8 – covers the design, fabrication, installation"
            ]
        },
        "ai_prompt": null,
        "course_content": {
            "assessment": {
                "narration": "",
                "passMark": 80,
                "questions": []
            }
        },
        "media": {
            "images": [],
            "videos": [],
            "audio": []
        },
        "audio_settings": {
            "voice": "default",
            "speed": 1.0,
            "pitch": 1.0
        }
    });

    fs::write(&project_path, serde_json::to_string_pretty(&project_data).unwrap())
        .expect("Failed to write project file");

    println!("Created project file: {}", project_path.display());
    println!("Project file contains ID: {}", file_project_id);
    println!("Project filename suggests ID: {}", directory_project_id);

    // Create media directory using the directory-based ID (not the file-based ID)
    let media_dir = projects_dir.join(directory_project_id).join("media");
    fs::create_dir_all(&media_dir).expect("Failed to create media directory");

    // Create realistic media files in the directory-based ID location
    let media_files = vec![
        ("audio-0.bin", vec![0u8; 1168749]),
        ("audio-0.json", br#"{"id":"audio-0","filename":"welcome.mp3","type":"audio","metadata":{"original_name":"welcome.mp3","media_type":"audio","mime_type":"audio/mpeg"}}"#.to_vec()),
        ("audio-1.bin", vec![1u8; 1191213]),
        ("audio-1.json", br#"{"id":"audio-1","filename":"objectives.mp3","type":"audio","metadata":{"original_name":"objectives.mp3","media_type":"audio","mime_type":"audio/mpeg"}}"#.to_vec()),
        ("image-0.bin", vec![3u8; 2048576]),
        ("image-0.json", br#"{"id":"image-0","filename":"diagram.jpg","type":"image","metadata":{"original_name":"diagram.jpg","media_type":"image","mime_type":"image/jpeg"}}"#.to_vec()),
    ];

    let mut expected_total_media_size = 0;
    for (filename, content) in &media_files {
        let file_path = media_dir.join(filename);
        fs::write(&file_path, content).expect(&format!("Failed to write {}", filename));
        expected_total_media_size += content.len();
        println!("Created media file: {} ({} bytes)", filename, content.len());
    }

    // Also create empty directory for the file-based ID to simulate the real scenario
    let empty_media_dir = projects_dir.join(file_project_id).join("media");
    fs::create_dir_all(&empty_media_dir).expect("Failed to create empty media directory");
    println!("Created empty media directory at: {}", empty_media_dir.display());

    println!("Total expected media size: {} bytes", expected_total_media_size);

    // Test the export function
    println!("\n=== Starting Export Test ===");
    let result = create_project_zip(
        project_path.to_string_lossy().to_string(),
        file_project_id.to_string(), // Use the file-based ID (which has no media)
        true, // include_media = true
    ).await;

    println!("Export result: {:?}", result.is_ok());

    // Verify the result is successful
    assert!(result.is_ok(), "Export should succeed: {:?}", result);

    let zip_result = result.unwrap();

    // Log detailed information
    println!("\n=== Export Results ===");
    println!("File count: {}", zip_result.file_count);
    println!("Total size: {}", zip_result.total_size);
    println!("ZIP buffer length: {}", zip_result.zip_data.len());

    // The export should now include media files from the filename-based directory
    assert!(zip_result.file_count > 1, "Should have project file + media files, got: {}", zip_result.file_count);
    assert!(zip_result.total_size > expected_total_media_size, "Total size should include all media files");

    // Should have the media files we created plus the project file
    let expected_file_count = media_files.len() + 1; // +1 for .scormproj file
    assert!(zip_result.file_count as usize >= expected_file_count,
            "Expected at least {} files, got {}", expected_file_count, zip_result.file_count);

    // The ZIP should be significantly larger than the 67KB we were getting before
    // Note: ZIP compression can make files much smaller, so we check for reasonable minimum
    assert!(zip_result.zip_data.len() > 5000,
            "ZIP should be much larger than the previous 67-byte failure, got {} bytes", zip_result.zip_data.len());

    println!("\n=== Test PASSED ===");
    println!("Successfully exported project with mismatched IDs:");
    println!("  - File ID: {}", file_project_id);
    println!("  - Directory ID: {}", directory_project_id);
    println!("  - Files in ZIP: {}", zip_result.file_count);
    println!("  - ZIP size: {} bytes", zip_result.zip_data.len());

    // Clean up environment variable
    std::env::remove_var("SCORM_BUILDER_TEST_DIR");
}

/// Test that the fallback logic doesn't interfere when IDs match correctly
#[tokio::test]
async fn test_export_with_matching_project_id() {
    println!("=== Testing Export with Matching Project IDs ===");

    // Create temp directories
    let temp_base = tempfile::TempDir::new().expect("Failed to create temp base directory");
    let projects_dir = temp_base.path().join("SCORM Projects");
    fs::create_dir_all(&projects_dir).expect("Failed to create projects directory");

    // Set environment variable to use our test directory
    std::env::set_var("SCORM_BUILDER_TEST_DIR", projects_dir.to_string_lossy().to_string());

    let project_id = "1234567890";

    // Create project file with matching ID
    let project_filename = format!("Test_Project_{}.scormproj", project_id);
    let project_path = projects_dir.join(&project_filename);

    let project_data = serde_json::json!({
        "project": {
            "id": project_id,  // Matches the directory name
            "name": "Test Project",
            "created": "2025-09-22T00:00:00Z",
            "last_modified": "2025-09-22T00:00:00Z",
            "path": project_path.to_string_lossy()
        },
        "course_data": {
            "title": "Test Project",
            "difficulty": 1,
            "template": "None",
            "topics": ["Test topic"]
        },
        "media": {
            "images": [],
            "videos": [],
            "audio": []
        },
        "audio_settings": {
            "voice": "default",
            "speed": 1.0,
            "pitch": 1.0
        }
    });

    fs::write(&project_path, serde_json::to_string_pretty(&project_data).unwrap())
        .expect("Failed to write project file");

    // Create media directory with matching ID
    let media_dir = projects_dir.join(project_id).join("media");
    fs::create_dir_all(&media_dir).expect("Failed to create media directory");

    // Create a few media files
    let media_files = vec![
        ("test-audio.bin", vec![0u8; 50000]),
        ("test-audio.json", br#"{"id":"test-audio","filename":"test.mp3","type":"audio"}"#.to_vec()),
    ];

    for (filename, content) in &media_files {
        let file_path = media_dir.join(filename);
        fs::write(&file_path, content).expect(&format!("Failed to write {}", filename));
    }

    // Test the export function
    let result = create_project_zip(
        project_path.to_string_lossy().to_string(),
        project_id.to_string(),
        true,
    ).await;

    assert!(result.is_ok(), "Export should succeed: {:?}", result);

    let zip_result = result.unwrap();

    // Should work normally
    assert!(zip_result.file_count > 1, "Should include media files");
    assert!(zip_result.file_count as usize == media_files.len() + 1, "Should have exact file count");

    println!("Test passed - normal case still works with file count: {}", zip_result.file_count);

    // Clean up environment variable
    std::env::remove_var("SCORM_BUILDER_TEST_DIR");
}