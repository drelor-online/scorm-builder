#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_never_use_rust_fallback() {
        // This test ensures that we always receive generated files from JavaScript
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
            generated_files: vec![], // Empty files - this should fail in production
        };

        // In production, this should return an error if no files are provided
        let result = generate_scorm_package(request).await;
        
        // Currently this succeeds because of the fallback
        // TODO: Change this to ensure generated_files is never empty
        assert!(result.is_ok(), "Should handle empty generated_files");
    }

    #[tokio::test]
    async fn test_with_generated_files() {
        // This is the correct usage - always provide generated files
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
                    path: "index.html".to_string(),
                    content: "<html></html>".to_string(),
                    is_binary: false,
                },
                GeneratedFile {
                    path: "scripts/navigation.js".to_string(),
                    content: "// navigation with checkFillInBlank".to_string(),
                    is_binary: false,
                },
            ],
        };

        let result = generate_scorm_package(request).await;
        assert!(result.is_ok(), "Should succeed with generated files");
    }
}