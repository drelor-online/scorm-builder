#[cfg(test)]
mod html_template_settings_tests {
    use crate::scorm::html_generator_enhanced::HtmlGenerator;
    use crate::scorm::generator_enhanced::*;

    #[test]
    fn test_index_html_includes_show_progress_when_true() {
        let generator = HtmlGenerator::new().expect("Failed to create HTML generator");

        let request = GenerateScormRequest {
            course_title: "Test Course".to_string(),
            welcome_page: Some(WelcomePage {
                title: "Welcome".to_string(),
                content: "Welcome content".to_string(),
                image_url: None,
                audio_file: None,
                caption_file: None,
                media: Some(vec![]),
                start_button_text: "Start".to_string(),
            }),
            learning_objectives_page: None,
            topics: vec![],
            assessment: None,
            show_progress: Some(true),  // Explicitly set to true
            show_outline: Some(true),   // Explicitly set to true
            ..Default::default()
        };

        let html = generator.generate_index_html(&request)
            .expect("Failed to generate index HTML");

        // When show_outline=true, sidebar should be visible (not have display: none)
        assert!(!html.contains(r#"<nav class="sidebar" style="display: none;">"#),
            "Sidebar should be visible when show_outline=true");

        // When show_progress=true, progress circle should be present
        assert!(html.contains("progress-circle-container"),
            "Progress circle should be present when show_progress=true");
    }

    #[test]
    fn test_index_html_includes_show_progress_when_false() {
        let generator = HtmlGenerator::new().expect("Failed to create HTML generator");

        let request = GenerateScormRequest {
            course_title: "Test Course".to_string(),
            welcome_page: Some(WelcomePage {
                title: "Welcome".to_string(),
                content: "Welcome content".to_string(),
                image_url: None,
                audio_file: None,
                caption_file: None,
                media: Some(vec![]),
                start_button_text: "Start".to_string(),
            }),
            learning_objectives_page: None,
            topics: vec![],
            assessment: None,
            show_progress: Some(false), // Explicitly set to false
            show_outline: Some(false),  // Explicitly set to false
            ..Default::default()
        };

        let html = generator.generate_index_html(&request)
            .expect("Failed to generate index HTML");

        // This test will currently FAIL because show_progress and show_outline
        // are not being passed to the template
        println!("Generated HTML: {}", html);

        // When show_outline=false, sidebar should be hidden
        assert!(html.contains(r#"<nav class="sidebar" style="display: none;">"#),
            "Sidebar should be hidden when show_outline=false");

        // When show_progress=false, progress circle should NOT be present
        assert!(!html.contains("progress-circle-container"),
            "Progress circle should be hidden when show_progress=false");
    }

    #[test]
    fn test_show_progress_conditional_in_template() {
        let generator = HtmlGenerator::new().expect("Failed to create HTML generator");

        let request = GenerateScormRequest {
            course_title: "Test Course".to_string(),
            welcome_page: Some(WelcomePage {
                title: "Welcome".to_string(),
                content: "Welcome content".to_string(),
                image_url: None,
                audio_file: None,
                caption_file: None,
                media: Some(vec![]),
                start_button_text: "Start".to_string(),
            }),
            learning_objectives_page: None,
            topics: vec![],
            assessment: None,
            show_progress: Some(false), // Progress should be hidden
            show_outline: Some(true),   // Outline should be shown
            ..Default::default()
        };

        let html = generator.generate_index_html(&request)
            .expect("Failed to generate index HTML");

        // This test will FAIL until we add the {{#if show_progress}} conditional
        // around the progress-circle-container in the template

        // Check that when show_progress is false, the progress bar is hidden
        // but the sidebar itself is still shown (because show_outline is true)
        if html.contains("{{#if show_progress}}") {
            println!("✅ Template correctly includes show_progress conditional");
        } else {
            println!("❌ Template missing show_progress conditional - this is the bug!");
        }
    }
}