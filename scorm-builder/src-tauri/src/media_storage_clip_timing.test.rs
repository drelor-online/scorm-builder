//! Tests for YouTube clip timing persistence in MediaMetadata
//! 
//! This module tests that the Rust backend correctly handles clip_start and clip_end
//! fields in MediaMetadata, ensuring they are properly serialized/deserialized
//! and stored/retrieved from the file system.

use super::*;
use serde_json;
use std::fs;

#[cfg(test)]
mod tests {
    use super::*;
    
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
        
        println!("[RUST TEST] 📊 Original metadata: {:#?}", metadata);
        
        // Serialize to JSON (simulates what happens when storing to filesystem)
        let json = serde_json::to_string(&metadata).expect("Should serialize to JSON");
        println!("[RUST TEST] 📤 Serialized JSON: {}", json);
        
        // Verify JSON contains clip timing fields
        assert!(json.contains("\"clip_start\":90"));
        assert!(json.contains("\"clip_end\":225"));
        
        // Deserialize from JSON (simulates what happens when loading from filesystem) 
        let deserialized: MediaMetadata = serde_json::from_str(&json).expect("Should deserialize from JSON");
        println!("[RUST TEST] 📥 Deserialized metadata: {:#?}", deserialized);
        
        // Verify clip timing fields are preserved
        assert_eq!(deserialized.clip_start, Some(90));
        assert_eq!(deserialized.clip_end, Some(225));
        assert_eq!(deserialized.page_id, "topic-0");
        assert_eq!(deserialized.media_type, "youtube");
        assert_eq!(deserialized.title, Some("Test YouTube Video".to_string()));
        
        println!("[RUST TEST] ✅ MediaMetadata serialization/deserialization with clip timing works correctly!");
    }
    
    #[test] 
    fn test_media_metadata_without_clip_timing() {
        println!("[RUST TEST] 🧪 Testing MediaMetadata without clip timing (backward compatibility)...");
        
        // Create MediaMetadata without clip timing (existing behavior)
        let metadata = MediaMetadata {
            page_id: "topic-1".to_string(),
            media_type: "image".to_string(),
            original_name: "Test Image".to_string(),
            mime_type: Some("image/jpeg".to_string()),
            source: None,
            embed_url: None,
            title: Some("Test Image".to_string()),
            clip_start: None,
            clip_end: None,
        };
        
        // Serialize and deserialize
        let json = serde_json::to_string(&metadata).expect("Should serialize to JSON");
        let deserialized: MediaMetadata = serde_json::from_str(&json).expect("Should deserialize from JSON");
        
        // Verify clip timing fields are None
        assert_eq!(deserialized.clip_start, None);
        assert_eq!(deserialized.clip_end, None);
        assert_eq!(deserialized.media_type, "image");
        
        println!("[RUST TEST] ✅ MediaMetadata without clip timing works correctly (backward compatibility maintained)!");
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
        
        println!("[RUST TEST] 📥 JavaScript JSON: {}", javascript_json);
        
        // Rust should be able to deserialize this
        let metadata: MediaMetadata = serde_json::from_str(javascript_json)
            .expect("Should deserialize JavaScript JSON");
            
        println!("[RUST TEST] 📊 Deserialized metadata: {:#?}", metadata);
        
        // Verify all fields are correct
        assert_eq!(metadata.page_id, "topic-0");
        assert_eq!(metadata.media_type, "youtube");
        assert_eq!(metadata.clip_start, Some(45));
        assert_eq!(metadata.clip_end, Some(180));
        assert_eq!(metadata.embed_url, Some("https://www.youtube.com/embed/testId?start=45&end=180".to_string()));
        
        println!("[RUST TEST] ✅ JavaScript → Rust clip timing compatibility verified!");
    }
    
    #[test]
    fn test_legacy_json_without_clip_timing() {
        println!("[RUST TEST] 🧪 Testing legacy JSON without clip timing fields (backward compatibility)...");
        
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
        assert_eq!(metadata.title, Some("Legacy Video".to_string()));
        
        println!("[RUST TEST] ✅ Legacy JSON backward compatibility maintained!");
    }
    
    #[test]
    fn test_store_media_base64_with_clip_timing() {
        println!("[RUST TEST] 🧪 Testing store_media_base64 with clip timing metadata...");
        
        // Create a temporary project for testing
        let test_project_id = "clip_timing_test_project";
        
        // Create metadata with clip timing
        let metadata = MediaMetadata {
            page_id: "topic-0".to_string(),
            media_type: "youtube".to_string(),
            original_name: "Store Test Video".to_string(),
            mime_type: Some("text/plain".to_string()),
            source: Some("youtube".to_string()),
            embed_url: Some("https://www.youtube.com/embed/storeTestId?start=60&end=300".to_string()),
            title: Some("Store Test Video".to_string()),
            clip_start: Some(60),   // 1:00
            clip_end: Some(300),    // 5:00
        };
        
        // Create test data (YouTube URL as base64)
        let test_url = "https://www.youtube.com/watch?v=storeTestId";
        use base64::{engine::general_purpose, Engine as _};
        let test_data_base64 = general_purpose::STANDARD.encode(test_url.as_bytes());
        
        // Call store_media_base64 (this should now preserve clip timing)
        let result = store_media_base64(
            "clip-test-video".to_string(),
            test_project_id.to_string(),
            test_data_base64,
            metadata.clone()
        );
        
        // Should succeed
        assert!(result.is_ok(), "store_media_base64 should succeed");
        println!("[RUST TEST] ✅ store_media_base64 succeeded with clip timing metadata");
        
        // Now try to retrieve the media to verify clip timing is preserved
        let retrieved_result = get_media("clip-test-video".to_string(), test_project_id.to_string());
        
        if let Ok(retrieved_data) = retrieved_result {
            println!("[RUST TEST] 📊 Retrieved metadata: {:#?}", retrieved_data.metadata);
            
            // Verify clip timing is preserved
            assert_eq!(retrieved_data.metadata.clip_start, Some(60));
            assert_eq!(retrieved_data.metadata.clip_end, Some(300));
            assert_eq!(retrieved_data.metadata.media_type, "youtube");
            
            println!("[RUST TEST] ✅ Clip timing preserved in store → retrieve cycle!");
        } else {
            panic!("[RUST TEST] ❌ Failed to retrieve stored media: {:?}", retrieved_result);
        }
        
        // Cleanup: Remove test project directory
        let projects_dir = get_projects_directory().expect("Should get projects directory");
        let test_project_path = projects_dir.join(test_project_id);
        if test_project_path.exists() {
            fs::remove_dir_all(&test_project_path).expect("Should remove test project directory");
            println!("[RUST TEST] 🧹 Cleaned up test project directory");
        }
    }
}