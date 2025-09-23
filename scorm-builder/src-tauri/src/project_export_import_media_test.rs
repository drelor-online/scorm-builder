use std::fs;
use std::path::PathBuf;

    /// Test that reproduces the media export issue
    /// Where export shows mediaCount=48 but fileCount=1 with only 67KB
    #[tokio::test]
    async fn test_media_export_includes_all_files() {
        println!("=== Testing Media Export Issue ===");

        // Create temp directories that mirror the production structure
        let temp_base = TempDir::new().expect("Failed to create temp base directory");
        let projects_dir = temp_base.path().join("SCORM Projects");
        fs::create_dir_all(&projects_dir).expect("Failed to create projects directory");

        // Set environment variable to use our test directory
        std::env::set_var("SCORM_BUILDER_TEST_DIR", projects_dir.to_string_lossy().to_string());

        let project_id = "1758554187321";
        let project_dir = projects_dir.join(project_id);
        let media_dir = project_dir.join("media");

        // Create project directory structure
        fs::create_dir_all(&media_dir).expect("Failed to create media directory");

        println!("Created test directories:");
        println!("  Projects dir: {}", projects_dir.display());
        println!("  Project dir: {}", project_dir.display());
        println!("  Media dir: {}", media_dir.display());

        // Create realistic project file (matching user's structure)
        let project_path = project_dir.join(format!("{}.scormproj", project_id));
        let project_data = serde_json::json!({
            "project": {
                "id": project_id,
                "name": "Complex Projects - 03 - ASME B31_8 (Gas Transmission & Distribution Piping Code)",
                "created": "2025-09-04T00:03:17.693539600Z",
                "last_modified": "2025-09-22T01:05:45.765398600Z",
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

        // Create realistic media files (matching user's .bin + .json structure)
        let media_files = vec![
            ("audio-0.bin", vec![0u8; 1168749]), // Realistic audio file size
            ("audio-0.json", br#"{"id":"audio-0","filename":"welcome.mp3","type":"audio","metadata":{"original_name":"welcome.mp3","media_type":"audio","mime_type":"audio/mpeg"}}"#.to_vec()),
            ("audio-1.bin", vec![1u8; 1191213]),
            ("audio-1.json", br#"{"id":"audio-1","filename":"objectives.mp3","type":"audio","metadata":{"original_name":"objectives.mp3","media_type":"audio","mime_type":"audio/mpeg"}}"#.to_vec()),
            ("audio-2.bin", vec![2u8; 1500000]),
            ("audio-2.json", br#"{"id":"audio-2","filename":"topic1.mp3","type":"audio","metadata":{"original_name":"topic1.mp3","media_type":"audio","mime_type":"audio/mpeg"}}"#.to_vec()),
            ("image-0.bin", vec![3u8; 2048576]), // 2MB image
            ("image-0.json", br#"{"id":"image-0","filename":"diagram.jpg","type":"image","metadata":{"original_name":"diagram.jpg","media_type":"image","mime_type":"image/jpeg"}}"#.to_vec()),
        ];

        let mut expected_total_media_size = 0;
        for (filename, content) in &media_files {
            let file_path = media_dir.join(filename);
            fs::write(&file_path, content).expect(&format!("Failed to write {}", filename));
            expected_total_media_size += content.len();
            println!("Created media file: {} ({} bytes)", filename, content.len());
        }

        println!("Total expected media size: {} bytes", expected_total_media_size);

        // Verify media directory exists and has files
        assert!(media_dir.exists(), "Media directory should exist");
        let media_entries: Vec<_> = fs::read_dir(&media_dir)
            .expect("Failed to read media directory")
            .collect();
        println!("Media directory contains {} entries", media_entries.len());

        // Test the export function
        println!("\n=== Starting Export Test ===");
        let result = create_project_zip(
            project_path.to_string_lossy().to_string(),
            project_id.to_string(),
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

        // The buffer should not be empty
        assert!(zip_result.zip_data.len() > 0, "ZIP buffer should not be empty");
        assert!(zip_result.file_count > 1, "Should have project file + media files, got: {}", zip_result.file_count);
        assert!(zip_result.total_size > expected_total_media_size, "Total size should include all media files");

        // Should have at least the number of media files we created plus the project file
        let expected_file_count = media_files.len() + 1; // +1 for .scormproj file
        assert!(zip_result.file_count as usize >= expected_file_count,
                "Expected at least {} files, got {}", expected_file_count, zip_result.file_count);

        // Verify ZIP is valid by extracting it
        println!("\n=== Verifying ZIP Extraction ===");
        let extract_result = extract_project_zip(zip_result.zip_data).await;
        assert!(extract_result.is_ok(), "Should be able to extract the created ZIP: {:?}", extract_result);

        let extracted = extract_result.unwrap();
        println!("Extracted project data: {}", extracted);

        // For this test, we just verify that the extraction succeeded
        // The detailed verification will be done in integration tests

        println!("\n=== Test PASSED ===");
        println!("Successfully created and extracted ZIP");

        // Clean up environment variable
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }

    /// Test media export with the exact project ID from user's logs
    #[tokio::test]
    async fn test_export_with_actual_user_project_structure() {
        println!("=== Testing with User's Actual Project Structure ===");

        // This test checks if the real project directory structure works
        let real_project_id = "1758554187321";
        let real_media_dir = PathBuf::from(r"C:\Users\sierr\Documents\SCORM Projects")
            .join(real_project_id)
            .join("media");

        if real_media_dir.exists() {
            println!("Real media directory exists: {}", real_media_dir.display());

            // List actual files in the directory
            let entries: Result<Vec<_>, _> = fs::read_dir(&real_media_dir)
                .map(|entries| entries.collect());

            if let Ok(entries) = entries {
                println!("Found {} entries in real media directory:", entries.len());
                for (i, entry) in entries.iter().enumerate() {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() {
                            if let Ok(metadata) = fs::metadata(&path) {
                                println!("  {}: {} ({} bytes)",
                                    i + 1,
                                    path.file_name().unwrap().to_string_lossy(),
                                    metadata.len()
                                );
                            }
                        }
                    }
                    if i >= 10 { // Limit output
                        println!("  ... and {} more files", entries.len() - 10);
                        break;
                    }
                }

                // Test what get_media_directory returns
                match crate::media_storage::get_media_directory(real_project_id) {
                    Ok(media_path) => {
                        println!("get_media_directory returns: {}", media_path.display());
                        println!("Path exists: {}", media_path.exists());

                        if media_path.exists() {
                            if let Ok(dir_entries) = fs::read_dir(&media_path) {
                                let file_count = dir_entries.count();
                                println!("Files found by get_media_directory: {}", file_count);
                            }
                        }
                    }
                    Err(e) => {
                        println!("get_media_directory failed: {}", e);
                    }
                }
            } else {
                println!("Failed to read real media directory");
            }
        } else {
            println!("Real media directory does not exist, skipping this test");
            println!("Expected path: {}", real_media_dir.display());
        }
    }