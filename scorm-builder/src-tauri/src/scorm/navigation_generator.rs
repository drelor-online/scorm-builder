use handlebars::Handlebars;
use serde_json::json;

use crate::scorm::generator_enhanced::GenerateScormRequest;

pub struct NavigationGenerator<'a> {
    handlebars: Handlebars<'a>,
}

impl<'a> NavigationGenerator<'a> {
    pub fn new() -> Result<Self, String> {
        let mut handlebars = Handlebars::new();

        // Register helpers
        handlebars.register_helper("eq", Box::new(eq_helper));

        // Load navigation template
        let navigation_template = include_str!("templates/navigation.js.hbs");
        handlebars
            .register_template_string("navigation", navigation_template)
            .map_err(|e| format!("Failed to register navigation template: {e}"))?;

        Ok(Self { handlebars })
    }

    pub fn generate_navigation_js(&self, request: &GenerateScormRequest) -> Result<String, String> {
        // Build topic data with knowledge check info
        let topics_data: Vec<_> = request
            .topics
            .iter()
            .map(|topic| {
                let has_knowledge_check = topic
                    .knowledge_check
                    .as_ref()
                    .map(|kc| kc.enabled && !kc.questions.is_empty())
                    .unwrap_or(false);

                json!({
                    "id": topic.id,
                    "title": topic.title,
                    "has_knowledge_check": has_knowledge_check
                })
            })
            .collect();

        let data = json!({
            "has_objectives": request.learning_objectives_page.is_some(),
            "topics": topics_data,
            "pass_mark": request.pass_mark
        });

        self.handlebars
            .render("navigation", &data)
            .map_err(|e| format!("Failed to render navigation template: {e}"))
    }

    pub fn validate_navigation_js(&self, js_content: &str) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check for required functions
        let required_functions = [
            "updateNavigationState",
            "shouldBlockNavigation",
            "navigateToPage",
            "checkMultipleChoice",
            "checkFillInBlank",
            "initializeNavigation",
        ];

        for func in &required_functions {
            if !js_content.contains(&format!("function {func}"))
                && !js_content.contains(&format!("window.{func} ="))
            {
                errors.push(format!("Missing required function: {func}"));
            }
        }

        // Check for navigation blocking logic
        if !js_content.contains("shouldBlockNavigation()") {
            errors.push("Navigation blocking check not found in navigation flow".to_string());
        }

        // Check for updateNavigationState after content load
        if !js_content.contains("initializePageAudio(pageId);")
            || !js_content.contains("updateNavigationState();")
        {
            errors
                .push("Navigation state update not properly placed after content load".to_string());
        }

        // Check for sidebar click logging
        if !js_content.contains("[SCORM Navigation] Sidebar click:") {
            errors.push("Sidebar navigation logging not found".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// Handlebars helper for equality comparison
fn eq_helper(
    h: &handlebars::Helper,
    _: &Handlebars,
    _: &handlebars::Context,
    _: &mut handlebars::RenderContext,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    let param1 = h.param(0).map(|v| v.value());
    let param2 = h.param(1).map(|v| v.value());

    if param1 == param2 {
        out.write("true")?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scorm::generator_enhanced::{KnowledgeCheck, Question, Topic};

    #[test]
    fn test_navigation_generation() {
        let generator = NavigationGenerator::new().unwrap();

        let request = GenerateScormRequest {
            course_title: "Test Course".to_string(),
            topics: vec![
                Topic {
                    id: "topic-1".to_string(),
                    title: "Topic 1".to_string(),
                    content: "Content 1".to_string(),
                    knowledge_check: Some(KnowledgeCheck {
                        enabled: true,
                        questions: vec![Question {
                            question_type: "fill-in-the-blank".to_string(),
                            text: "Test question".to_string(),
                            options: None,
                            correct_answer: "answer".to_string(),
                            explanation: Some("Explanation".to_string()),
                            correct_feedback: None,
                            incorrect_feedback: None,
                        }],
                    }),
                    ..Default::default()
                },
                Topic {
                    id: "topic-2".to_string(),
                    title: "Topic 2".to_string(),
                    content: "Content 2".to_string(),
                    knowledge_check: None,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };

        let js = generator.generate_navigation_js(&request).unwrap();

        // Verify generated content
        assert!(js.contains("PAGES_WITH_KNOWLEDGE_CHECKS"));
        assert!(js.contains("'topic-1': true"));
        assert!(!js.contains("'topic-2': true"));

        // Validate the generated JS
        generator.validate_navigation_js(&js).unwrap();
    }

    #[test]
    fn test_navigation_validation() {
        let generator = NavigationGenerator::new().unwrap();

        // Test with invalid JS
        let invalid_js = "// Invalid navigation file";
        let result = generator.validate_navigation_js(invalid_js);

        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.len() > 0);
        assert!(errors.iter().any(|e| e.contains("updateNavigationState")));
    }
}
