#[cfg(test)]
mod batch_efficiency_tests {
    use crate::media_storage::{store_media_base64, get_media_batch, media_exists_batch, MediaMetadata};
    use base64::{engine::general_purpose, Engine as _};
    use tempfile::TempDir;
    use std::time::Instant;
    
    #[test]
    fn test_batch_operations_efficiency() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "batch-efficiency-test";
        
        // Create test data for multiple media items
        let media_items = vec![
            ("audio-0", "audio", "test-audio-0.mp3"),
            ("audio-1", "audio", "test-audio-1.mp3"),
            ("image-0", "image", "test-image-0.jpg"),
            ("image-1", "image", "test-image-1.jpg"),
            ("video-0", "video", "test-video-0.mp4"),
        ];
        
        let test_data = vec![42u8; 50 * 1024]; // 50KB per item
        let base64_data = general_purpose::STANDARD.encode(&test_data);
        
        // Store all media items first
        for (media_id, media_type, original_name) in &media_items {
            let metadata = MediaMetadata {
                page_id: "test-page".to_string(),
                media_type: media_type.to_string(),
                original_name: original_name.to_string(),
                mime_type: Some(format!("{}/test", media_type)),
                source: None,
                embed_url: None,
                title: None,
                clip_start: None,
                clip_end: None,
            };
            
            let result = store_media_base64(
                media_id.to_string(),
                project_id.to_string(),
                base64_data.clone(),
                metadata
            );
            assert!(result.is_ok(), "Should store media item {}", media_id);
        }
        
        let media_ids: Vec<String> = media_items.iter().map(|(id, _, _)| id.to_string()).collect();
        
        // Test 1: Batch existence check (should be ultra-fast)
        let start = Instant::now();
        let exists_result = media_exists_batch(project_id.to_string(), media_ids.clone());
        let exists_duration = start.elapsed();
        
        assert!(exists_result.is_ok(), "Batch exists check should succeed");
        let exists_flags = exists_result.unwrap();
        assert_eq!(exists_flags.len(), media_items.len());
        assert!(exists_flags.iter().all(|&exists| exists), "All media should exist");
        
        println!("[BATCH TEST] Existence check for {} items took: {:?}", media_items.len(), exists_duration);
        
        // Test 2: Batch media loading
        let start = Instant::now();
        let batch_result = get_media_batch(project_id.to_string(), media_ids.clone());
        let batch_duration = start.elapsed();
        
        assert!(batch_result.is_ok(), "Batch get should succeed");
        let batch_media = batch_result.unwrap();
        assert_eq!(batch_media.len(), media_items.len());
        
        // Verify all data is correct
        for (i, media_data) in batch_media.iter().enumerate() {
            assert_eq!(media_data.data.len(), test_data.len());
            assert_eq!(media_data.id, media_items[i].0);
            assert_eq!(media_data.metadata.media_type, media_items[i].1);
        }
        
        println!("[BATCH TEST] Batch loading {} items took: {:?}", media_items.len(), batch_duration);
        
        // Test 3: Compare with individual loading
        let start = Instant::now();
        let mut individual_media = Vec::new();
        for media_id in &media_ids {
            let individual_result = crate::media_storage::get_media(project_id.to_string(), media_id.clone());
            assert!(individual_result.is_ok(), "Individual get should succeed for {}", media_id);
            individual_media.push(individual_result.unwrap());
        }
        let individual_duration = start.elapsed();
        
        println!("[BATCH TEST] Individual loading {} items took: {:?}", media_items.len(), individual_duration);
        
        // Verify batch and individual results are identical
        assert_eq!(batch_media.len(), individual_media.len());
        for (batch_item, individual_item) in batch_media.iter().zip(individual_media.iter()) {
            assert_eq!(batch_item.id, individual_item.id);
            assert_eq!(batch_item.data, individual_item.data);
            assert_eq!(batch_item.metadata.media_type, individual_item.metadata.media_type);
        }
        
        println!("[BATCH TEST] ✅ All batch operations working correctly!");
        println!("[BATCH TEST] Performance comparison:");
        println!("  - Existence check: {:?} ({} items)", exists_duration, media_items.len());
        println!("  - Batch loading: {:?} ({} items)", batch_duration, media_items.len());
        println!("  - Individual loading: {:?} ({} items)", individual_duration, media_items.len());
        
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
    
    #[test]
    fn test_batch_operations_with_missing_items() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let project_id = "batch-missing-test";
        let media_ids = vec!["existing-media".to_string(), "missing-media".to_string()];
        
        // Store only one item
        let test_data = vec![42u8; 1024];
        let base64_data = general_purpose::STANDARD.encode(&test_data);
        let metadata = MediaMetadata {
            page_id: "test-page".to_string(),
            media_type: "audio".to_string(),
            original_name: "existing.mp3".to_string(),
            mime_type: Some("audio/mp3".to_string()),
            source: None,
            embed_url: None,
            title: None,
            clip_start: None,
            clip_end: None,
        };
        
        let result = store_media_base64(
            "existing-media".to_string(),
            project_id.to_string(),
            base64_data,
            metadata
        );
        assert!(result.is_ok());
        
        // Test existence check with mixed results
        let exists_result = media_exists_batch(project_id.to_string(), media_ids.clone());
        assert!(exists_result.is_ok());
        let exists_flags = exists_result.unwrap();
        assert_eq!(exists_flags, vec![true, false]); // First exists, second doesn't
        
        // Test batch get with partial results (should handle gracefully)
        let batch_result = get_media_batch(project_id.to_string(), media_ids);
        assert!(batch_result.is_ok());
        let batch_media = batch_result.unwrap();
        assert_eq!(batch_media.len(), 1); // Only the existing item
        assert_eq!(batch_media[0].id, "existing-media");
        
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
}