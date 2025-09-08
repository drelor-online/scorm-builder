#[cfg(test)]
mod contamination_fix_tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_contamination_prevention_in_store_media() {
        println!("🧪 [RUST TEST] Testing contamination prevention in store_media...");
        
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
        
        // Verify binary data was stored correctly
        let data_path = temp_dir.path()
            .join(project_id)
            .join("media")
            .join(format!("{}.bin", media_id));
            
        assert!(data_path.exists(), "Data file should be created");
        let stored_data = fs::read(&data_path).unwrap();
        assert_eq!(stored_data, test_data, "Binary data should be preserved");
        
        println!("✅ [RUST TEST] Contamination prevention working correctly!");
        
        // Cleanup
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
    
    #[test]
    fn test_legitimate_youtube_video_storage_still_works() {
        println!("🧪 [RUST TEST] Testing legitimate YouTube video storage...");
        
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
        let base64_data = base64::engine::general_purpose::STANDARD.encode(&test_data);
        
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
        
        println!("✅ [RUST TEST] Base64 contamination prevention working correctly!");
        
        // Cleanup
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }
}