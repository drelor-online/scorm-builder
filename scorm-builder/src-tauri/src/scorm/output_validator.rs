use std::collections::HashMap;
use std::io::Read;
use zip::ZipArchive;

pub struct OutputValidator {
    validation_rules: HashMap<String, Box<dyn Fn(&str) -> Result<(), String>>>,
}

impl OutputValidator {
    pub fn new() -> Self {
        let mut validator = Self {
            validation_rules: HashMap::new(),
        };

        // Add validation rules
        validator.add_navigation_rules();
        validator.add_css_rules();
        validator.add_html_rules();

        validator
    }

    fn add_navigation_rules(&mut self) {
        // Check navigation.js has proper structure
        self.validation_rules.insert(
            "scripts/navigation.js".to_string(),
            Box::new(|content| {
                // Check for navigation blocking
                if !content.contains("shouldBlockNavigation()") {
                    return Err("Navigation blocking function not found".to_string());
                }

                // Check for proper state update timing
                if !content.contains("updateNavigationState()") {
                    return Err("Navigation state update not found".to_string());
                }

                // Verify it's called after content load within navigateToPage function
                // Look for the pattern within the .then(html => { ... }) block
                if let Some(then_block_start) = content.find(".then(html => {") {
                    // Find the content within this specific then block
                    let block_content = &content[then_block_start..];

                    // Find initializePageAudio within this block
                    if let Some(audio_pos) = block_content.find("initializePageAudio(pageId)") {
                        // Now find updateNavigationState after audio initialization
                        let after_audio = &block_content[audio_pos..];

                        if let Some(nav_pos) = after_audio.find("updateNavigationState()") {
                            // Check distance (allowing more space for comments)
                            if nav_pos > 500 {
                                return Err("updateNavigationState() too far from content load".to_string());
                            }
                        } else {
                            return Err("updateNavigationState() not found after initializePageAudio in then block".to_string());
                        }
                    } else {
                        return Err("initializePageAudio not found in then block".to_string());
                    }
                } else {
                    return Err("navigateToPage then block not found".to_string());
                }

                // Check for sidebar click handling
                if !content.contains("[SCORM Navigation] Sidebar click:") {
                    return Err("Sidebar navigation logging not found".to_string());
                }

                // Check for knowledge check functions
                if !content.contains("window.checkFillInBlank") {
                    return Err("Fill-in-blank check function not found".to_string());
                }

                if !content.contains("window.checkMultipleChoice") {
                    return Err("Multiple choice check function not found".to_string());
                }

                Ok(())
            }),
        );
    }

    fn add_css_rules(&mut self) {
        self.validation_rules.insert(
            "styles/main.css".to_string(),
            Box::new(|content| {
                // Check for problematic styles
                if content.contains("min-height: 800px !important") {
                    return Err(
                        "Found problematic min-height that pushes footer off screen".to_string()
                    );
                }

                // Check body has proper height
                if !content.contains("body") || !content.contains("height: 100vh") {
                    return Err("Body missing proper height: 100vh".to_string());
                }

                // Check footer is visible
                if !content.contains(".footer") {
                    return Err("Footer styles missing".to_string());
                }

                // Check for disabled button styles
                if !content.contains(".nav-button:disabled") {
                    return Err("Disabled navigation button styles missing".to_string());
                }

                Ok(())
            }),
        );
    }

    fn add_html_rules(&mut self) {
        self.validation_rules.insert(
            "index.html".to_string(),
            Box::new(|content| {
                // Check for required elements
                if !content.contains("id=\"prev-button\"") {
                    return Err("Previous button not found".to_string());
                }

                if !content.contains("id=\"next-button\"") {
                    return Err("Next button not found".to_string());
                }

                if !content.contains("id=\"content-container\"") {
                    return Err("Content container not found".to_string());
                }

                if !content.contains("id=\"scorm-alert-container\"") {
                    return Err("Alert container not found".to_string());
                }

                Ok(())
            }),
        );
    }

    pub fn validate_scorm_package(&self, zip_data: &[u8]) -> Result<ValidationReport, String> {
        let cursor = std::io::Cursor::new(zip_data);
        let mut archive =
            ZipArchive::new(cursor).map_err(|e| format!("Failed to open ZIP archive: {e}"))?;

        let mut report = ValidationReport::new();

        // Check each file against validation rules
        for (path, validator) in &self.validation_rules {
            match archive.by_name(path) {
                Ok(mut file) => {
                    let mut content = String::new();
                    file.read_to_string(&mut content)
                        .map_err(|e| format!("Failed to read {path}: {e}"))?;

                    match validator(&content) {
                        Ok(()) => {
                            report.add_success(path.clone(), "Validation passed".to_string());
                        }
                        Err(error) => {
                            report.add_error(path.clone(), error);
                        }
                    }
                }
                Err(_) => {
                    report.add_error(path.clone(), "File not found in package".to_string());
                }
            }
        }

        // Check for knowledge check HTML
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).unwrap();
            let name = file.name().to_string();

            if name.starts_with("pages/topic-") && name.ends_with(".html") {
                let mut content = String::new();
                file.read_to_string(&mut content).ok();

                // Check if page has knowledge check
                if content.contains("knowledge-check-container") {
                    // Verify fill-in-blank structure
                    if content.contains("fill-blank-") && !content.contains("kc-fill-blank") {
                        report.add_error(
                            name.clone(),
                            "Fill-in-blank input missing proper class".to_string(),
                        );
                    }

                    // Verify submit button - checks for submitAllKnowledgeChecks which handles all question types
                    if content.contains("fill-blank-")
                        && !content.contains("onclick=\"window.submitAllKnowledgeChecks")
                    {
                        report.add_error(
                            name,
                            "Fill-in-blank submit button missing proper onclick handler"
                                .to_string(),
                        );
                    }
                }
            }
        }

        Ok(report)
    }
}

pub struct ValidationReport {
    pub success: Vec<(String, String)>,
    pub errors: Vec<(String, String)>,
}

impl ValidationReport {
    fn new() -> Self {
        Self {
            success: Vec::new(),
            errors: Vec::new(),
        }
    }

    fn add_success(&mut self, file: String, message: String) {
        self.success.push((file, message));
    }

    fn add_error(&mut self, file: String, message: String) {
        self.errors.push((file, message));
    }

    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }

    pub fn summary(&self) -> String {
        let mut summary = format!(
            "Validation Report: {} success, {} errors\n",
            self.success.len(),
            self.errors.len()
        );

        if !self.errors.is_empty() {
            summary.push_str("\nErrors:\n");
            for (file, error) in &self.errors {
                summary.push_str(&format!("  - {file}: {error}\n"));
            }
        }

        summary
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_navigation_validation() {
        let validator = OutputValidator::new();
        let rule = validator
            .validation_rules
            .get("scripts/navigation.js")
            .unwrap();

        // Test valid navigation.js with proper structure
        let valid_js = r#"
        function shouldBlockNavigation() { return false; }
        function updateNavigationState() { }
        function navigateToPage(pageId) {
            fetch(`pages/${pageId}.html`)
                .then(html => {
                    contentContainer.innerHTML = html;
                    initializePageAudio(pageId);
                    initializeKnowledgeChecks();
                    // Update navigation state after content loads
                    updateNavigationState();
                    updateProgress();
                });
        }
        console.log('[SCORM Navigation] Sidebar click:');
        window.checkFillInBlank = function() {};
        window.checkMultipleChoice = function() {};
        "#;

        assert!(rule(valid_js).is_ok());

        // Test invalid navigation.js
        let invalid_js = "// Missing required functions";
        assert!(rule(invalid_js).is_err());
    }
}
