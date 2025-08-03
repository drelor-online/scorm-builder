#[cfg(test)]
mod tests {
    use super::super::html_generator_enhanced::HtmlGenerator;
    use super::super::generator_enhanced::{GenerateScormRequest, WelcomePage, Topic};
    use serde_json::json;

    #[test]
    fn test_csp_header_in_generated_html() {
        let generator = HtmlGenerator::new().expect("Failed to create generator");
        
        let request = GenerateScormRequest {
            project_id: "test-project".to_string(),
            course_title: "Test Course".to_string(),
            course_description: "Test Description".to_string(),
            course_identifier: "test-course-id".to_string(),
            organization_name: "Test Org".to_string(),
            scorm_version: "2004".to_string(),
            course_data: json!({}),
            topics: vec![],
            welcome_page: WelcomePage {
                title: "Welcome".to_string(),
                content: "Welcome content".to_string(),
                image_url: None,
                audio_file: None,
                media: None,
            },
            learning_objectives_page: None,
            assessment: None,
        };
        
        let html = generator.generate_index_html(&request)
            .expect("Failed to generate HTML");
        
        // Check that CSP meta tag is present
        assert!(html.contains("Content-Security-Policy"), "CSP meta tag not found in generated HTML");
        
        // Check for required CSP directives
        assert!(html.contains("default-src 'self'"), "Missing default-src directive");
        assert!(html.contains("script-src 'self' 'unsafe-inline' 'unsafe-eval'"), "Missing script-src directive");
        assert!(html.contains("style-src 'self' 'unsafe-inline'"), "Missing style-src directive");
        assert!(html.contains("img-src 'self' data: https: blob:"), "Missing img-src directive");
        assert!(html.contains("media-src 'self' blob: https:"), "Missing media-src directive");
        assert!(html.contains("frame-src 'self' https://www.youtube.com"), "Missing frame-src directive");
        assert!(html.contains("object-src 'none'"), "Missing object-src directive");
        assert!(html.contains("base-uri 'self'"), "Missing base-uri directive");
        assert!(html.contains("frame-ancestors *"), "Missing frame-ancestors directive for SCORM compatibility");
    }
    
    #[test]
    fn test_csp_allows_youtube_embeds() {
        let generator = HtmlGenerator::new().expect("Failed to create generator");
        
        let request = GenerateScormRequest {
            project_id: "test-project".to_string(),
            course_title: "Test Course".to_string(),
            course_description: "Test Description".to_string(),
            course_identifier: "test-course-id".to_string(),
            organization_name: "Test Org".to_string(),
            scorm_version: "2004".to_string(),
            course_data: json!({}),
            topics: vec![],
            welcome_page: WelcomePage {
                title: "Welcome".to_string(),
                content: "Welcome content".to_string(),
                image_url: None,
                audio_file: None,
                media: None,
            },
            learning_objectives_page: None,
            assessment: None,
        };
        
        let html = generator.generate_index_html(&request)
            .expect("Failed to generate HTML");
        
        // Verify YouTube domains are allowed in frame-src
        assert!(html.contains("https://www.youtube.com"), "YouTube not allowed in CSP");
        assert!(html.contains("https://youtube.com"), "YouTube not allowed in CSP");
        assert!(html.contains("https://www.youtube-nocookie.com"), "YouTube-nocookie not allowed in CSP");
    }
}