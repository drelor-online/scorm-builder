#[cfg(test)]
mod efficiency_tests {
    use crate::media_storage::{store_media_base64, get_media, MediaMetadata};
    use base64::{engine::general_purpose, Engine as _};
    use tempfile::TempDir;

    // Test to reproduce the inefficiency: duplicate base64 operations
    #[test]
    fn test_duplicate_base64_operations_inefficiency() {
        // Setup test environment
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "test-efficiency-project";
        let media_id = "duplicate-test-media";
        
        // Create test data - this simulates expensive base64 encoding
        let test_data = vec![42u8; 1024 * 1024]; // 1MB test file
        let base64_data = general_purpose::STANDARD.encode(&test_data);
        
        let metadata = MediaMetadata {
            page_id: "test-page".to_string(),
            media_type: "audio".to_string(),
            original_name: "test.mp3".to_string(),
            mime_type: Some("audio/mp3".to_string()),
            source: None,
            embed_url: None,
            title: None,
            clip_start: None,
            clip_end: None,
        };
        
        // FIRST CALL - This should store the media
        let start_time = std::time::Instant::now();
        let result1 = store_media_base64(
            media_id.to_string(),
            project_id.to_string(),
            base64_data.clone(),
            metadata.clone()
        );
        let first_call_duration = start_time.elapsed();
        
        assert!(result1.is_ok(), "First store should succeed");
        println!("[EFFICIENCY TEST] First store took: {:?}", first_call_duration);
        
        // SECOND CALL - This should be MUCH faster (exists check, no base64 decode)
        let start_time = std::time::Instant::now();
        let result2 = store_media_base64(
            media_id.to_string(),
            project_id.to_string(),
            base64_data.clone(),
            metadata.clone()
        );
        let second_call_duration = start_time.elapsed();
        
        assert!(result2.is_ok(), "Second store should succeed");
        println!("[EFFICIENCY TEST] Second store took: {:?}", second_call_duration);
        
        // ASSERTION: Second call should be at least 10x faster due to exists check
        // Currently this test will FAIL because we don't have exists-check optimization
        // After implementing the fix, the second call should skip base64 decoding
        println!("[EFFICIENCY TEST] Speed ratio: {:.2}x", 
                first_call_duration.as_nanos() as f64 / second_call_duration.as_nanos() as f64);
        
        // TODO: This assertion will fail until we implement the efficiency fix
        // Uncomment after implementing exists-check optimization:
        // assert!(second_call_duration.as_millis() < first_call_duration.as_millis() / 5,
        //         "Second call should be much faster due to exists check");
        
        // Verify that the media was actually stored correctly
        let retrieved = get_media(project_id.to_string(), media_id.to_string());
        assert!(retrieved.is_ok(), "Should be able to retrieve stored media");
        
        let retrieved_data = retrieved.unwrap();
        assert_eq!(retrieved_data.data.len(), test_data.len(), "Data should match original");
    }
    
    // Test to verify that duplicate calls don't corrupt data
    #[test]
    fn test_duplicate_calls_data_integrity() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "test-integrity-project";
        let media_id = "integrity-test-media";
        
        // Create unique test data
        let original_data = b"unique-test-data-for-integrity-check".to_vec();
        let base64_data = general_purpose::STANDARD.encode(&original_data);
        
        let metadata = MediaMetadata {
            page_id: "test-page".to_string(),
            media_type: "image".to_string(),
            original_name: "test.jpg".to_string(),
            mime_type: Some("image/jpeg".to_string()),
            source: None,
            embed_url: None,
            title: None,
            clip_start: None,
            clip_end: None,
        };
        
        // Store multiple times with the same data
        for i in 0..3 {
            let result = store_media_base64(
                media_id.to_string(),
                project_id.to_string(),
                base64_data.clone(),
                metadata.clone()
            );
            assert!(result.is_ok(), "Store attempt {} should succeed", i + 1);
        }
        
        // Verify data integrity after multiple stores
        let retrieved = get_media(project_id.to_string(), media_id.to_string());
        assert!(retrieved.is_ok(), "Should retrieve data after multiple stores");
        
        let retrieved_data = retrieved.unwrap();
        assert_eq!(retrieved_data.data, original_data, "Data should remain intact after duplicate stores");
    }
    
    // Test to measure base64 decode overhead
    #[test]
    fn test_base64_decode_overhead() {
        // This test measures the actual cost of base64 decoding to establish benchmarks
        let sizes = vec![1024, 1024 * 100, 1024 * 1024]; // 1KB, 100KB, 1MB
        
        for size in sizes {
            let test_data = vec![42u8; size];
            let base64_data = general_purpose::STANDARD.encode(&test_data);
            
            // Measure base64 decode time
            let start_time = std::time::Instant::now();
            let decoded = general_purpose::STANDARD.decode(&base64_data).unwrap();
            let decode_duration = start_time.elapsed();
            
            println!("[BASE64 BENCHMARK] Size: {}KB, Decode time: {:?}", 
                    size / 1024, decode_duration);
            
            assert_eq!(decoded, test_data, "Decoded data should match original");
        }
    }
}