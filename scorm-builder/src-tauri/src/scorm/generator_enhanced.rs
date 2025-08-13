use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use zip::write::FileOptions;
use zip::ZipWriter;

use super::html_generator_enhanced::HtmlGenerator;
use super::navigation_generator::NavigationGenerator;
use super::output_validator::OutputValidator;
use super::style_generator::StyleGenerator;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Topic {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub knowledge_check: Option<KnowledgeCheck>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<Vec<MediaItem>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KnowledgeCheck {
    pub enabled: bool,
    pub questions: Vec<Question>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Question {
    #[serde(rename = "type")]
    pub question_type: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    pub correct_answer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_feedback: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incorrect_feedback: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaItem {
    pub id: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub url: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embed_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_youtube: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateScormRequest {
    pub course_title: String,
    pub course_description: Option<String>,
    pub welcome_page: Option<WelcomePage>,
    pub learning_objectives_page: Option<ObjectivesPage>,
    pub topics: Vec<Topic>,
    pub assessment: Option<Assessment>,
    pub pass_mark: u32,
    pub navigation_mode: String,
    pub allow_retake: bool,
}

impl Default for GenerateScormRequest {
    fn default() -> Self {
        Self {
            course_title: String::new(),
            course_description: None,
            welcome_page: None,
            learning_objectives_page: None,
            topics: Vec::new(),
            assessment: None,
            pass_mark: 80,
            navigation_mode: "linear".to_string(),
            allow_retake: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WelcomePage {
    pub title: String,
    pub content: String,
    pub start_button_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<Vec<MediaItem>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObjectivesPage {
    pub objectives: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<Vec<MediaItem>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Assessment {
    pub questions: Vec<Question>,
}

pub struct EnhancedScormGenerator {
    navigation_generator: NavigationGenerator<'static>,
    style_generator: StyleGenerator<'static>,
    html_generator: HtmlGenerator<'static>,
    output_validator: OutputValidator,
}

impl EnhancedScormGenerator {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            navigation_generator: NavigationGenerator::new()?,
            style_generator: StyleGenerator::new()?,
            html_generator: HtmlGenerator::new()?,
            output_validator: OutputValidator::new(),
        })
    }

    pub fn generate_scorm_package(
        &self,
        request: GenerateScormRequest,
        media_files: HashMap<String, Vec<u8>>,
    ) -> Result<Vec<u8>, String> {
        let mut zip_buffer = Vec::new();
        {
            let mut zip = ZipWriter::new(std::io::Cursor::new(&mut zip_buffer));
            let options =
                FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

            // Generate navigation.js
            let navigation_js = self.navigation_generator.generate_navigation_js(&request)?;
            self.navigation_generator
                .validate_navigation_js(&navigation_js)
                .map_err(|errors| errors.join("\n"))?;

            zip.start_file("scripts/navigation.js", options)
                .map_err(|e| format!("Failed to create navigation.js: {e}"))?;
            zip.write_all(navigation_js.as_bytes())
                .map_err(|e| format!("Failed to write navigation.js: {e}"))?;

            // Generate main.css
            let main_css = self.style_generator.generate_main_css(&request)?;
            self.style_generator
                .validate_css(&main_css)
                .map_err(|errors| errors.join("\n"))?;

            zip.start_file("styles/main.css", options)
                .map_err(|e| format!("Failed to create main.css: {e}"))?;
            zip.write_all(main_css.as_bytes())
                .map_err(|e| format!("Failed to write main.css: {e}"))?;

            // Generate index.html
            let index_html = self.html_generator.generate_index_html(&request)?;
            zip.start_file("index.html", options)
                .map_err(|e| format!("Failed to create index.html: {e}"))?;
            zip.write_all(index_html.as_bytes())
                .map_err(|e| format!("Failed to write index.html: {e}"))?;

            // Generate page HTML files
            if let Some(welcome) = &request.welcome_page {
                let welcome_html = self.html_generator.generate_welcome_page(welcome)?;
                zip.start_file("pages/welcome.html", options)
                    .map_err(|e| format!("Failed to create welcome.html: {e}"))?;
                zip.write_all(welcome_html.as_bytes())
                    .map_err(|e| format!("Failed to write welcome.html: {e}"))?;
            }

            if let Some(objectives) = &request.learning_objectives_page {
                let objectives_html = self.html_generator.generate_objectives_page(objectives)?;
                zip.start_file("pages/objectives.html", options)
                    .map_err(|e| format!("Failed to create objectives.html: {e}"))?;
                zip.write_all(objectives_html.as_bytes())
                    .map_err(|e| format!("Failed to write objectives.html: {e}"))?;
            }

            // Generate topic pages
            for topic in &request.topics {
                let topic_html = self.html_generator.generate_topic_page(topic)?;
                zip.start_file(format!("pages/{}.html", topic.id), options)
                    .map_err(|e| format!("Failed to create topic page: {e}"))?;
                zip.write_all(topic_html.as_bytes())
                    .map_err(|e| format!("Failed to write topic page: {e}"))?;
            }

            // Generate assessment page
            if let Some(assessment) = &request.assessment {
                let assessment_html = self.html_generator.generate_assessment_page(assessment)?;
                zip.start_file("pages/assessment.html", options)
                    .map_err(|e| format!("Failed to create assessment.html: {e}"))?;
                zip.write_all(assessment_html.as_bytes())
                    .map_err(|e| format!("Failed to write assessment.html: {e}"))?;
            }

            // Add manifest
            let manifest = self.generate_simple_manifest(&request)?;
            zip.start_file("imsmanifest.xml", options)
                .map_err(|e| format!("Failed to create manifest: {e}"))?;
            zip.write_all(manifest.as_bytes())
                .map_err(|e| format!("Failed to write manifest: {e}"))?;

            // Add media files
            for (path, data) in media_files {
                zip.start_file(&path, options)
                    .map_err(|e| format!("Failed to create media file {path}: {e}"))?;
                zip.write_all(&data)
                    .map_err(|e| format!("Failed to write media file {path}: {e}"))?;
            }

            zip.finish()
                .map_err(|e| format!("Failed to finish ZIP: {e}"))?;
        }

        // Validate the generated package
        let validation_report = self.output_validator.validate_scorm_package(&zip_buffer)?;
        if validation_report.has_errors() {
            return Err(format!(
                "SCORM package validation failed:\n{}",
                validation_report.summary()
            ));
        }

        Ok(zip_buffer)
    }

    fn generate_simple_manifest(&self, request: &GenerateScormRequest) -> Result<String, String> {
        let mut resources = String::new();

        // Add main index
        resources.push_str(r#"        <resource identifier="main" type="webcontent" adlcp:scormType="sco" href="index.html">
            <file href="index.html"/>
            <file href="styles/main.css"/>
            <file href="scripts/navigation.js"/>
"#);

        // Add page files
        if request.welcome_page.is_some() {
            resources.push_str("            <file href=\"pages/welcome.html\"/>\n");
        }
        if request.learning_objectives_page.is_some() {
            resources.push_str("            <file href=\"pages/objectives.html\"/>\n");
        }
        for topic in &request.topics {
            resources.push_str(&format!(
                "            <file href=\"pages/{}.html\"/>\n",
                topic.id
            ));
        }
        if request.assessment.is_some() {
            resources.push_str("            <file href=\"pages/assessment.html\"/>\n");
        }

        resources.push_str("        </resource>");

        Ok(format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="course-{}" version="1.0"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
    <metadata>
        <schema>ADL SCORM</schema>
        <schemaversion>1.2</schemaversion>
    </metadata>
    <organizations default="default_org">
        <organization identifier="default_org">
            <title>{}</title>
            <item identifier="item_1" identifierref="main">
                <title>{}</title>
            </item>
        </organization>
    </organizations>
    <resources>
{}
    </resources>
</manifest>"#,
            uuid::Uuid::new_v4(),
            request.course_title,
            request.course_title,
            resources
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enhanced_generation() {
        let generator = EnhancedScormGenerator::new().unwrap();

        let request = GenerateScormRequest {
            course_title: "Test Course".to_string(),
            topics: vec![Topic {
                id: "topic-1".to_string(),
                title: "Topic 1".to_string(),
                content: "Content 1".to_string(),
                knowledge_check: Some(KnowledgeCheck {
                    enabled: true,
                    questions: vec![Question {
                        question_type: "fill-in-the-blank".to_string(),
                        text: "The capital of France is _____.".to_string(),
                        options: None,
                        correct_answer: "Paris".to_string(),
                        explanation: Some("Paris is the capital of France.".to_string()),
                        correct_feedback: None,
                        incorrect_feedback: None,
                    }],
                }),
                ..Default::default()
            }],
            ..Default::default()
        };

        let result = generator.generate_scorm_package(request, HashMap::new());
        assert!(result.is_ok());
    }

    #[test]
    fn test_media_item_with_youtube_fields() {
        // Test that MediaItem can deserialize with YouTube fields
        let json_data = serde_json::json!({
            "id": "youtube-1",
            "type": "video",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "Test Video",
            "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "is_youtube": true
        });

        let media_item: MediaItem = serde_json::from_value(json_data).unwrap();

        assert_eq!(media_item.id, "youtube-1");
        assert_eq!(media_item.media_type, "video");
        assert_eq!(
            media_item.url,
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        );
        assert_eq!(
            media_item.embed_url,
            Some("https://www.youtube.com/embed/dQw4w9WgXcQ".to_string())
        );
        assert_eq!(media_item.is_youtube, Some(true));
    }

    #[test]
    fn test_topic_with_youtube_media() {
        // Test that Topic can handle YouTube media items
        let topic = Topic {
            id: "topic-1".to_string(),
            title: "Test Topic".to_string(),
            content: "<p>Content</p>".to_string(),
            knowledge_check: None,
            audio_file: None,
            caption_file: None,
            image_url: None,
            media: Some(vec![MediaItem {
                id: "youtube-1".to_string(),
                media_type: "video".to_string(),
                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ".to_string(),
                title: "YouTube Video".to_string(),
                embed_url: Some("https://www.youtube.com/embed/dQw4w9WgXcQ".to_string()),
                is_youtube: Some(true),
            }]),
        };

        assert!(topic.media.is_some());
        let media_items = topic.media.unwrap();
        assert_eq!(media_items.len(), 1);
        assert_eq!(media_items[0].is_youtube, Some(true));
        assert!(media_items[0].embed_url.is_some());
    }
}
