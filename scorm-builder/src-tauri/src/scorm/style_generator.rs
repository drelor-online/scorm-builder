use handlebars::Handlebars;
use serde_json::json;

use crate::scorm::generator_enhanced::GenerateScormRequest;

pub struct StyleGenerator<'a> {
    handlebars: Handlebars<'a>,
}

impl<'a> StyleGenerator<'a> {
    pub fn new() -> Result<Self, String> {
        let mut handlebars = Handlebars::new();

        // Load CSS template
        let css_template = include_str!("templates/main.css.hbs");
        handlebars
            .register_template_string("main_css", css_template)
            .map_err(|e| format!("Failed to register CSS template: {e}"))?;

        Ok(Self { handlebars })
    }

    pub fn generate_main_css(&self, request: &GenerateScormRequest) -> Result<String, String> {
        // Pass course settings to CSS for font sizes and interface options
        let font_size = request.font_size.as_ref().map(|s| s.as_str()).unwrap_or("medium");
        let show_progress = request.show_progress.unwrap_or(true);
        let show_outline = request.show_outline.unwrap_or(true);
        let printable = request.printable.unwrap_or(false);
        
        let data = json!({
            "primary_color": "#8fbb40",
            "secondary_color": "#241f20",
            "sidebar_width": if show_outline { "200px" } else { "0px" },
            "font_size": font_size,
            "show_progress": show_progress,
            "show_outline": show_outline,
            "printable": printable,
            "base_font_size": match font_size {
                "small" => "14px",
                "large" => "18px",
                _ => "16px" // medium
            }
        });

        self.handlebars
            .render("main_css", &data)
            .map_err(|e| format!("Failed to render CSS template: {e}"))
    }

    pub fn validate_css(&self, css_content: &str) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check for problematic styles
        if css_content.contains("min-height: 800px !important") {
            errors.push(
                "Found problematic min-height: 800px !important that pushes footer off screen"
                    .to_string(),
            );
        }

        // Ensure body has proper height
        if !css_content.contains("body") || !css_content.contains("height: 100vh") {
            errors.push("Body should have height: 100vh for proper layout".to_string());
        }

        // Check for flexbox layout
        if !css_content.contains(".main-area") || !css_content.contains("display: flex") {
            errors.push("Main area should use flexbox layout".to_string());
        }

        // Ensure footer has proper styling
        if !css_content.contains(".footer") {
            errors.push("Footer styles are missing".to_string());
        }

        // Check for navigation button styles
        if !css_content.contains(".nav-button") {
            errors.push("Navigation button styles are missing".to_string());
        }

        // Check for disabled state
        if !css_content.contains(":disabled") {
            errors.push("Disabled state styles are missing".to_string());
        }

        // Check for knowledge check styles
        if !css_content.contains(".knowledge-check-container") {
            errors.push("Knowledge check container styles are missing".to_string());
        }

        // Check for fill-in-blank styles
        if !css_content.contains(".kc-fill-blank") {
            errors.push("Fill-in-blank input styles are missing".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_css_generation() {
        let generator = StyleGenerator::new().unwrap();

        let request = GenerateScormRequest {
            course_title: "Test Course".to_string(),
            ..Default::default()
        };

        let css = generator.generate_main_css(&request).unwrap();

        // Verify critical styles
        assert!(css.contains("body"));
        assert!(css.contains("height: 100vh"));
        assert!(!css.contains("min-height: 800px !important"));

        // Validate the generated CSS
        generator.validate_css(&css).unwrap();
    }

    #[test]
    fn test_css_validation_catches_issues() {
        let generator = StyleGenerator::new().unwrap();

        // Test with problematic CSS
        let bad_css = r#"
        body {
            min-height: 800px !important;
        }
        "#;

        let result = generator.validate_css(bad_css);
        assert!(result.is_err());

        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("min-height: 800px")));
    }
}
