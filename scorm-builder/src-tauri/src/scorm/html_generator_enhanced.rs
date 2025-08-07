use handlebars::{Handlebars, Helper, Context, RenderContext, Output, HelperResult, Renderable};
use serde_json::json;

use super::generator_enhanced::{GenerateScormRequest, Topic, WelcomePage, ObjectivesPage, Assessment};

pub struct HtmlGenerator<'a> {
    handlebars: Handlebars<'a>,
    has_objectives: bool,
}

impl<'a> HtmlGenerator<'a> {
    // Helper to ensure media paths are properly formatted
    fn ensure_media_path(path: &str) -> String {
        // Don't modify external URLs
        if path.starts_with("http://") || path.starts_with("https://") || path.starts_with("//") {
            path.to_string()
        } else if path.starts_with("media/") {
            path.to_string()
        } else {
            format!("media/{}", path)
        }
    }
    
    pub fn new() -> Result<Self, String> {
        let mut handlebars = Handlebars::new();
        
        // Register helpers
        handlebars.register_helper("eq", Box::new(eq_helper));
        handlebars.register_helper("or", Box::new(or_helper));
        handlebars.register_helper("is_youtube", Box::new(is_youtube_helper));
        handlebars.register_helper("extract_youtube_id", Box::new(extract_youtube_id_helper));
        handlebars.register_helper("add", Box::new(add_helper));
        
        // Load templates
        let index_template = include_str!("templates/index.html.hbs");
        let topic_template = include_str!("templates/topic.html.hbs");
        let welcome_template = include_str!("templates/welcome.html.hbs");
        let objectives_template = include_str!("templates/objectives.html.hbs");
        let assessment_template = include_str!("templates/assessment.html.hbs");
        
        handlebars
            .register_template_string("index", index_template)
            .map_err(|e| format!("Failed to register index template: {}", e))?;
        
        handlebars
            .register_template_string("topic", topic_template)
            .map_err(|e| format!("Failed to register topic template: {}", e))?;
            
        handlebars
            .register_template_string("welcome", welcome_template)
            .map_err(|e| format!("Failed to register welcome template: {}", e))?;
            
        handlebars
            .register_template_string("objectives", objectives_template)
            .map_err(|e| format!("Failed to register objectives template: {}", e))?;
            
        handlebars
            .register_template_string("assessment", assessment_template)
            .map_err(|e| format!("Failed to register assessment template: {}", e))?;
        
        Ok(Self { handlebars, has_objectives: false })
    }
    
    pub fn generate_index_html(&self, request: &GenerateScormRequest) -> Result<String, String> {
        let data = json!({
            "course_title": request.course_title,
            "has_objectives": request.learning_objectives_page.is_some(),
            "topics": request.topics.iter().map(|t| json!({
                "id": t.id,
                "title": t.title
            })).collect::<Vec<_>>()
        });
        
        self.handlebars
            .render("index", &data)
            .map_err(|e| format!("Failed to render index template: {}", e))
    }
    
    pub fn generate_welcome_page(&self, welcome: &WelcomePage) -> Result<String, String> {
        eprintln!("[HTML Generator] Generating welcome page");
        eprintln!("[HTML Generator] Welcome has audio_file: {}", welcome.audio_file.is_some());
        eprintln!("[HTML Generator] Welcome has media: {:?}", welcome.media);
        
        // Process media items to ensure URLs are prefixed with media/
        let processed_media = welcome.media.as_ref().map(|media_items| {
            media_items.iter().map(|item| {
                let mut url = item.url.clone();
                // If URL doesn't start with http/https, prefix with media/
                if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("media/") {
                    url = format!("media/{}", url);
                }
                
                // Determine if this is a YouTube video
                let is_youtube = item.is_youtube.unwrap_or_else(|| {
                    item.embed_url.as_ref().map(|embed| {
                        embed.contains("youtube.com") || embed.contains("youtu.be")
                    }).unwrap_or(false) || 
                    url.contains("youtube.com") || 
                    url.contains("youtu.be")
                });
                
                json!({
                    "type": item.media_type,
                    "url": url,
                    "title": item.title,
                    "embed_url": item.embed_url,
                    "is_youtube": is_youtube
                })
            }).collect::<Vec<_>>()
        });
        
        let data = json!({
            "title": welcome.title,
            "content": welcome.content.replace('\n', "<br>"),
            "next_page": if self.has_objectives { "objectives" } else { "topic-1" },
            "start_button_text": welcome.start_button_text,
            "audio_file": welcome.audio_file.as_ref().map(|f| Self::ensure_media_path(f)),
            "caption_file": welcome.caption_file.as_ref().map(|f| Self::ensure_media_path(f)),
            "image_url": welcome.image_url.as_ref().map(|f| Self::ensure_media_path(f)),
            "media": processed_media,
            "id": "welcome"  // Add ID for audio player
        });
        
        self.handlebars
            .render("welcome", &data)
            .map_err(|e| format!("Failed to render welcome template: {}", e))
    }
    
    pub fn generate_objectives_page(&self, objectives: &ObjectivesPage) -> Result<String, String> {
        eprintln!("[HTML Generator] Generating objectives page");
        eprintln!("[HTML Generator] Objectives has audio_file: {}", objectives.audio_file.is_some());
        
        // Process media items to ensure URLs are prefixed with media/
        let processed_media = objectives.media.as_ref().map(|media_items| {
            media_items.iter().map(|item| {
                let mut url = item.url.clone();
                // If URL doesn't start with http/https, prefix with media/
                if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("media/") {
                    url = format!("media/{}", url);
                }
                
                // Determine if this is a YouTube video
                let is_youtube = item.is_youtube.unwrap_or_else(|| {
                    item.embed_url.as_ref().map(|embed| {
                        embed.contains("youtube.com") || embed.contains("youtu.be")
                    }).unwrap_or(false) || 
                    url.contains("youtube.com") || 
                    url.contains("youtu.be")
                });
                
                json!({
                    "type": item.media_type,
                    "url": url,
                    "title": item.title,
                    "embed_url": item.embed_url,
                    "is_youtube": is_youtube
                })
            }).collect::<Vec<_>>()
        });
        
        let data = json!({
            "objectives": objectives.objectives,
            "audio_file": objectives.audio_file.as_ref().map(|f| Self::ensure_media_path(f)),
            "caption_file": objectives.caption_file.as_ref().map(|f| Self::ensure_media_path(f)),
            "media": processed_media,
            "id": "objectives"  // Add ID for audio player
        });
        
        self.handlebars
            .render("objectives", &data)
            .map_err(|e| format!("Failed to render objectives template: {}", e))
    }
    
    pub fn generate_topic_page(&self, topic: &Topic) -> Result<String, String> {
        // Use eprintln! for debugging - it goes to stderr which might be visible
        eprintln!("[HTML Generator] Processing topic: {}", topic.id);
        eprintln!("[HTML Generator] Topic has knowledge_check: {}", topic.knowledge_check.is_some());
        eprintln!("[HTML Generator] Topic has audio_file: {}", topic.audio_file.is_some());
        eprintln!("[HTML Generator] Topic has caption_file: {}", topic.caption_file.is_some());
        
        // Prepare knowledge check questions with proper indexing
        let kc_questions = if let Some(kc) = &topic.knowledge_check {
            eprintln!("[HTML Generator] Knowledge check enabled: {}, questions: {}", kc.enabled, kc.questions.len());
            
            // Debug print each question
            for (i, q) in kc.questions.iter().enumerate() {
                eprintln!("[HTML Generator] Question {}: type={}, text={}", i, q.question_type, q.text);
                eprintln!("[HTML Generator]   - correct_answer: {}", q.correct_answer);
                eprintln!("[HTML Generator]   - options: {:?}", q.options);
            }
            
            if kc.enabled {
                kc.questions.iter().enumerate().map(|(index, q)| {
                    let mut question_data = json!({
                        "type": q.question_type,  // This is now "type" not "question_type" for template compatibility
                        "text": q.text,
                        "index": index,
                        "correct_answer": q.correct_answer,
                        "explanation": q.explanation.as_deref().unwrap_or(""),
                    });
                    
                    // Add type-specific fields
                    match q.question_type.as_str() {
                        "multiple-choice" | "true-false" => {
                            question_data["options"] = json!(q.options.as_ref().unwrap_or(&Vec::new()));
                            // Add feedback for all question types
                            question_data["correct_feedback"] = json!(
                                q.correct_feedback.as_deref()
                                    .or(q.explanation.as_deref())
                                    .unwrap_or("Correct!")
                            );
                            question_data["incorrect_feedback"] = json!(
                                q.incorrect_feedback.as_deref()
                                    .unwrap_or("Not quite. Try again!")
                            );
                        }
                        "fill-in-the-blank" => {
                            // Use the actual feedback fields from the question
                            question_data["correct_feedback"] = json!(
                                q.correct_feedback.as_deref()
                                    .or(q.explanation.as_deref())
                                    .unwrap_or("Correct!")
                            );
                            question_data["incorrect_feedback"] = json!(
                                q.incorrect_feedback.as_deref()
                                    .unwrap_or("Not quite. Try again!")
                            );
                        }
                        _ => {}
                    }
                    
                    eprintln!("[HTML Generator] Prepared question data: {}", serde_json::to_string_pretty(&question_data).unwrap());
                    question_data
                }).collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };
        
        eprintln!("[HTML Generator] Total prepared KC questions: {}", kc_questions.len());
        
        // Debug: Force audio file to test template
        let audio_file_path = topic.audio_file.as_ref().map(|f| Self::ensure_media_path(f));
        eprintln!("[HTML Generator] Audio file path for template: {:?}", audio_file_path);
        
        let data = json!({
            "id": topic.id,
            "title": topic.title,
            "content": topic.content,
            "has_knowledge_check": !kc_questions.is_empty(),
            "knowledge_check_questions": kc_questions,
            "audio_file": audio_file_path,
            "caption_file": topic.caption_file.as_ref().map(|f| Self::ensure_media_path(f)),
            // Filter out invalid image URLs like "media/image-3.jpg"
            "image_url": topic.image_url.as_ref()
                .filter(|url| {
                    // Skip URLs that look like broken paths (e.g., "media/image-X.jpg")
                    !url.contains(".jpg") && !url.contains(".jpeg") && !url.contains(".png") && !url.contains(".gif")
                    || url.starts_with("http://") || url.starts_with("https://") 
                    || url.starts_with("media/image-") && !url.contains(".")
                })
                .map(|f| Self::ensure_media_path(f)),
            "media": topic.media.as_ref().map(|media_items| {
                media_items.iter().map(|item| {
                    let mut url = item.url.clone();
                    // If URL doesn't start with http/https, prefix with media/
                    if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("media/") {
                        url = format!("media/{}", url);
                    }
                    
                    // Determine if this is a YouTube video
                    let is_youtube = item.is_youtube.unwrap_or_else(|| {
                        item.embed_url.as_ref().map(|embed| {
                            embed.contains("youtube.com") || embed.contains("youtu.be")
                        }).unwrap_or(false) || 
                        url.contains("youtube.com") || 
                        url.contains("youtu.be")
                    });
                    
                    json!({
                        "type": item.media_type,
                        "url": url,
                        "title": item.title,
                        "embed_url": item.embed_url,
                        "is_youtube": is_youtube
                    })
                }).collect::<Vec<_>>()
            })
        });
        
        eprintln!("[HTML Generator] Template data: has_knowledge_check={}, kc_questions_count={}", 
            !kc_questions.is_empty(), kc_questions.len());
        eprintln!("[HTML Generator] Audio file: {:?}", topic.audio_file.as_ref().map(|f| Self::ensure_media_path(f)));
        eprintln!("[HTML Generator] Full template data: {}", serde_json::to_string_pretty(&data).unwrap());
        
        // Render template and debug the result
        let rendered_html = self.handlebars
            .render("topic", &data)
            .map_err(|e| format!("Failed to render topic template: {}", e))?;
            
        // Check if knowledge check was rendered
        if !kc_questions.is_empty() {
            if rendered_html.contains("kc-question-wrapper") {
                eprintln!("[HTML Generator] SUCCESS: Knowledge check questions were rendered in HTML");
            } else {
                eprintln!("[HTML Generator] ERROR: Knowledge check questions NOT found in rendered HTML!");
                eprintln!("[HTML Generator] First 500 chars of HTML: {}", &rendered_html.chars().take(500).collect::<String>());
            }
        }
        
        Ok(rendered_html)
    }
    
    pub fn generate_assessment_page(&self, assessment: &Assessment) -> Result<String, String> {
        let data = json!({
            "assessment": {
                "questions": assessment.questions.iter().enumerate().map(|(idx, q)| json!({
                    "index": idx,
                    "text": q.text,
                    "options": q.options,
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation.as_deref().unwrap_or(""),
                    "correct_feedback": q.correct_feedback.as_deref()
                        .or(q.explanation.as_deref())
                        .unwrap_or("Correct!"),
                    "incorrect_feedback": q.incorrect_feedback.as_deref()
                        .unwrap_or("Not quite. Try again!")
                })).collect::<Vec<_>>()
            }
        });
        
        self.handlebars
            .render("assessment", &data)
            .map_err(|e| format!("Failed to render assessment template: {}", e))
    }
    
    pub fn with_objectives(mut self, has_objectives: bool) -> Self {
        self.has_objectives = has_objectives;
        self
    }
}

// Handlebars helper for equality comparison (block helper)
fn eq_helper<'reg, 'rc>(
    h: &Helper<'reg, 'rc>,
    r: &'reg Handlebars<'reg>,
    ctx: &'rc Context,
    rc: &mut RenderContext<'reg, 'rc>,
    out: &mut dyn Output,
) -> HelperResult {
    let param1 = h.param(0).map(|v| v.value());
    let param2 = h.param(1).map(|v| v.value());
    
    let result = match (param1, param2) {
        (Some(v1), Some(v2)) => {
            eprintln!("[eq_helper] Comparing: {:?} == {:?} => {}", v1, v2, v1 == v2);
            v1 == v2
        }
        _ => false,
    };
    
    // For block helpers, we need to render the template block if the condition is true
    if result {
        if let Some(ref template) = h.template() {
            template.render(r, ctx, rc, out)?;
        }
    } else {
        // Render the else block if present
        if let Some(ref template) = h.inverse() {
            template.render(r, ctx, rc, out)?;
        }
    }
    
    Ok(())
}

// Handlebars helper for logical OR (block helper)
fn or_helper<'reg, 'rc>(
    h: &Helper<'reg, 'rc>,
    r: &'reg Handlebars<'reg>,
    ctx: &'rc Context,
    rc: &mut RenderContext<'reg, 'rc>,
    out: &mut dyn Output,
) -> HelperResult {
    let mut result = false;
    
    // Check if any parameter is truthy
    for i in 0.. {
        if let Some(param) = h.param(i) {
            let value = param.value();
            // Check if value is truthy (not null, not false, not empty string, not 0)
            let is_truthy = match value {
                serde_json::Value::Null => false,
                serde_json::Value::Bool(b) => *b,
                serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
                serde_json::Value::String(s) => !s.is_empty(),
                serde_json::Value::Array(a) => !a.is_empty(),
                serde_json::Value::Object(o) => !o.is_empty(),
            };
            if is_truthy {
                result = true;
                break;
            }
        } else {
            break;
        }
    }
    
    // For block helpers, render the template block if condition is true
    if result {
        if let Some(ref template) = h.template() {
            template.render(r, ctx, rc, out)?;
        }
    } else {
        // Render the else block if present
        if let Some(ref template) = h.inverse() {
            template.render(r, ctx, rc, out)?;
        }
    }
    
    Ok(())
}

// Handlebars helper to check if a URL is a YouTube URL (block helper)
fn is_youtube_helper<'reg, 'rc>(
    h: &Helper<'reg, 'rc>,
    r: &'reg Handlebars<'reg>,
    ctx: &'rc Context,
    rc: &mut RenderContext<'reg, 'rc>,
    out: &mut dyn Output,
) -> HelperResult {
    let is_youtube = if let Some(url_value) = h.param(0) {
        if let Some(url_str) = url_value.value().as_str() {
            url_str.contains("youtube.com") || url_str.contains("youtu.be")
        } else {
            false
        }
    } else {
        false
    };
    
    // For block helpers, render the template block if condition is true
    if is_youtube {
        if let Some(ref template) = h.template() {
            template.render(r, ctx, rc, out)?;
        }
    } else {
        // Render the else block if present
        if let Some(ref template) = h.inverse() {
            template.render(r, ctx, rc, out)?;
        }
    }
    
    Ok(())
}

// Handlebars helper to extract YouTube video ID from URL
fn extract_youtube_id_helper<'reg, 'rc>(
    h: &Helper<'reg, 'rc>,
    _: &'reg Handlebars<'reg>,
    _: &'rc Context,
    _: &mut RenderContext<'reg, 'rc>,
    out: &mut dyn Output,
) -> HelperResult {
    if let Some(url_value) = h.param(0) {
        if let Some(url_str) = url_value.value().as_str() {
            // Handle youtube.com/watch?v=ID format
            if let Some(start) = url_str.find("watch?v=") {
                let id_start = start + 8;
                let id_end = url_str[id_start..].find('&')
                    .map(|i| id_start + i)
                    .unwrap_or(url_str.len());
                out.write(&url_str[id_start..id_end])?;
            }
            // Handle youtu.be/ID format
            else if let Some(start) = url_str.find("youtu.be/") {
                let id_start = start + 9;
                let id_end = url_str[id_start..].find('?')
                    .map(|i| id_start + i)
                    .unwrap_or(url_str.len());
                out.write(&url_str[id_start..id_end])?;
            }
        }
    }
    
    Ok(())
}

// Handlebars helper to add numbers
fn add_helper<'reg, 'rc>(
    h: &Helper<'reg, 'rc>,
    _: &'reg Handlebars<'reg>,
    _: &'rc Context,
    _: &mut RenderContext<'reg, 'rc>,
    out: &mut dyn Output,
) -> HelperResult {
    let param1 = h.param(0)
        .and_then(|v| v.value().as_u64())
        .unwrap_or(0);
    let param2 = h.param(1)
        .and_then(|v| v.value().as_u64())
        .unwrap_or(0);
    
    out.write(&format!("{}", param1 + param2))?;
    Ok(())
}
