use super::*;
use serde_json::json;

#[cfg(test)]
mod guard_tests {
    use super::*;

    #[tokio::test]
    async fn test_guard_prevents_rust_fallback() {
        // Test that empty generated_files causes an error
        let request = GenerateScormRequest {
            project_id: "test-project".to_string(),
            course_content: json!({
                "title": "Test Course",
                "topics": []
            }),
            course_metadata: CourseMetadata {
                title: "Test Course".to_string(),
                description: "Test".to_string(),
                project_title: "Test".to_string(),
                version: None,
                scorm_version: None,
            },
            media_files: vec![],
            generated_files: vec![], // Empty - should fail
        };

        let result = generate_scorm_package(request).await;
        
        // This should fail with our guard
        assert!(result.is_err(), "Should fail when no generated files provided");
        assert!(result.unwrap_err().contains("No generated files provided"));
    }

    #[tokio::test]
    async fn test_guard_allows_valid_generation() {
        // Test that proper generated_files works
        let request = GenerateScormRequest {
            project_id: "test-project".to_string(),
            course_content: json!({
                "title": "Test Course",
                "topics": []
            }),
            course_metadata: CourseMetadata {
                title: "Test Course".to_string(),
                description: "Test".to_string(),
                project_title: "Test".to_string(),
                version: None,
                scorm_version: None,
            },
            media_files: vec![],
            generated_files: vec![
                GeneratedFile {
                    path: "imsmanifest.xml".to_string(),
                    content: "<?xml version=\"1.0\"?>".to_string(),
                    is_binary: false,
                },
                GeneratedFile {
                    path: "index.html".to_string(),
                    content: "<!DOCTYPE html>".to_string(),
                    is_binary: false,
                },
            ],
        };

        let result = generate_scorm_package(request).await;
        assert!(result.is_ok(), "Should succeed with generated files");
    }
}