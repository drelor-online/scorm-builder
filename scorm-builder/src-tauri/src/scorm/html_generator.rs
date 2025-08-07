use crate::scorm::generator::CourseMetadata;
use serde_json::Value;

pub fn generate_welcome_page_html(welcome: &Value) -> String {
    let title = welcome
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Welcome");
    let content = welcome
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let audio_id = welcome.get("audioId").and_then(|v| v.as_str());
    let caption_id = welcome.get("captionId").and_then(|v| v.as_str());

    let mut html = format!(
        r#"
<div class="page-content">
    <h1>{}</h1>
    <div class="content">
        {}
    </div>
"#,
        title, content
    );

    // Add media if present
    if let Some(media_array) = welcome.get("media").and_then(|v| v.as_array()) {
        for media in media_array {
            let media_type = media.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let media_id = media.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let media_title = media.get("title").and_then(|v| v.as_str()).unwrap_or("");

            match media_type {
                "image" => {
                    let extension = if media_id.contains("image-0") {
                        ".jpg"
                    } else {
                        ".png"
                    };
                    html.push_str(&format!(
                        r#"    <img src="media/{}{}" alt="{}" class="content-image" />
"#,
                        media_id, extension, media_title
                    ));
                }
                "video" => {
                    html.push_str(&format!(
                        r#"    <video src="media/{}.mp4" controls class="content-video"></video>
"#,
                        media_id
                    ));
                }
                _ => {}
            }
        }
    }

    // Add audio narration if present
    if let (Some(audio), Some(caption)) = (audio_id, caption_id) {
        html.push_str(&format!(
            r#"    <audio id="narration-audio" controls class="narration-audio">
        <source src="media/{}.mp3" type="audio/mpeg">
        <track kind="captions" src="media/{}.vtt" srclang="en" label="English" default>
    </audio>
"#,
            audio, caption
        ));
    }

    html.push_str("</div>\n");
    html
}

pub fn generate_objectives_page_html(objectives_page: &Value) -> String {
    let content = objectives_page
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let audio_id = objectives_page.get("audioId").and_then(|v| v.as_str());
    let caption_id = objectives_page.get("captionId").and_then(|v| v.as_str());

    let mut html = format!(
        r#"
<div class="page-content">
    {}
"#,
        content
    );

    // Add media if present
    if let Some(media_array) = objectives_page.get("media").and_then(|v| v.as_array()) {
        for media in media_array {
            let media_type = media.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let media_id = media.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let media_title = media.get("title").and_then(|v| v.as_str()).unwrap_or("");

            match media_type {
                "image" => {
                    let extension = if media_id.contains("objectives") {
                        ".jpg"
                    } else {
                        ".png"
                    };
                    html.push_str(&format!(
                        r#"    <img src="media/{}{}" alt="{}" class="content-image" />
"#,
                        media_id, extension, media_title
                    ));
                }
                "video" => {
                    html.push_str(&format!(
                        r#"    <video src="media/{}.mp4" controls class="content-video"></video>
"#,
                        media_id
                    ));
                }
                _ => {}
            }
        }
    }

    // Add audio narration if present
    if let (Some(audio), Some(caption)) = (audio_id, caption_id) {
        html.push_str(&format!(
            r#"    <audio id="narration-audio" controls class="narration-audio">
        <source src="media/{}.mp3" type="audio/mpeg">
        <track kind="captions" src="media/{}.vtt" srclang="en" label="English" default>
    </audio>
"#,
            audio, caption
        ));
    }

    html.push_str("</div>\n");
    html
}

pub fn generate_topic_page_html(topic: &Value, _index: usize) -> String {
    let title = topic
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Topic");
    let content = topic.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let audio_id = topic.get("audioId").and_then(|v| v.as_str());
    let caption_id = topic.get("captionId").and_then(|v| v.as_str());

    let mut html = format!(
        r#"
<div class="page-content">
    <h1>{}</h1>
    <div class="content">
        {}
    </div>
"#,
        title, content
    );

    // Add sections if present
    if let Some(sections) = topic.get("sections").and_then(|v| v.as_array()) {
        for section in sections {
            if let Some(section_content) = section.get("content").and_then(|v| v.as_str()) {
                html.push_str(&format!(
                    r#"    <div class="section">
        {}
    </div>
"#,
                    section_content
                ));
            }
        }
    }

    // Add media if present
    if let Some(media_array) = topic.get("media").and_then(|v| v.as_array()) {
        for media in media_array {
            let media_type = media.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let media_id = media.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let media_title = media.get("title").and_then(|v| v.as_str()).unwrap_or("");

            match media_type {
                "image" => {
                    let extension = if media_id.contains("logo") {
                        ".png"
                    } else if media_id.contains("image-1") {
                        ".png"
                    } else {
                        ".jpg"
                    };
                    html.push_str(&format!(
                        r#"    <img src="media/{}{}" alt="{}" class="content-image" />
"#,
                        media_id, extension, media_title
                    ));
                }
                "video" => {
                    html.push_str(&format!(
                        r#"    <video src="media/{}.mp4" controls class="content-video"></video>
"#,
                        media_id
                    ));
                }
                _ => {}
            }
        }
    }

    // Add knowledge check if present
    if let Some(kc) = topic.get("knowledgeCheck").and_then(|v| v.as_object()) {
        html.push_str(
            r#"    <div class="knowledge-check">
        <h3>Knowledge Check</h3>
"#,
        );

        let question = kc.get("question").and_then(|v| v.as_str()).unwrap_or("");
        let kc_type = kc
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("multiple-choice");
        let correct_answer = kc
            .get("correctAnswer")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let explanation = kc.get("explanation").and_then(|v| v.as_str()).unwrap_or("");

        html.push_str(&format!(
            r#"        <div class="question">
            <p>{}</p>
"#,
            question
        ));

        if kc_type == "multiple-choice" {
            if let Some(options) = kc.get("options").and_then(|v| v.as_array()) {
                html.push_str(r#"            <div class="options">"#);
                for (i, option) in options.iter().enumerate() {
                    let option_text = option.as_str().unwrap_or("");
                    let is_correct = option_text == correct_answer;

                    html.push_str(&format!(
                        r#"
                <label class="option">
                    <input type="radio" name="kc-question" value="{}" {} />
                    <span>{}</span>
                </label>"#,
                        i,
                        if is_correct {
                            format!(r#"data-correct="{}""#, i)
                        } else {
                            String::new()
                        },
                        option_text
                    ));
                }
                html.push_str(
                    r#"
            </div>"#,
                );
            }
        }

        html.push_str(&format!(
            r#"
            <div class="explanation" style="display:none;">
                <p>{}</p>
            </div>
        </div>
    </div>
"#,
            explanation
        ));
    }

    // Add audio narration if present
    if let (Some(audio), Some(caption)) = (audio_id, caption_id) {
        html.push_str(&format!(
            r#"    <audio id="narration-audio" controls class="narration-audio">
        <source src="media/{}.mp3" type="audio/mpeg">
        <track kind="captions" src="media/{}.vtt" srclang="en" label="English" default>
    </audio>
"#,
            audio, caption
        ));
    }

    html.push_str("</div>\n");
    html
}

pub fn generate_assessment_page_html(assessment: &Value) -> String {
    let pass_mark = assessment
        .get("passMark")
        .and_then(|v| v.as_u64())
        .unwrap_or(80);

    let mut html = format!(
        r#"
<div class="page-content" data-pass-mark="{}">
    <h1>Assessment</h1>
    <div class="assessment-questions">
"#,
        pass_mark
    );

    // Add questions if present
    if let Some(questions) = assessment.get("questions").and_then(|v| v.as_array()) {
        for (q_index, question) in questions.iter().enumerate() {
            let q_type = question
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("multiple-choice");
            let q_text = question
                .get("question")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let default_id = format!("q{}", q_index + 1);
            let q_id = question
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or(&default_id);
            let explanation = question
                .get("explanation")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            html.push_str(&format!(
                r#"        <div class="question" data-question-id="{}">
            <p>{}</p>
"#,
                q_id, q_text
            ));

            match q_type {
                "multiple-choice" => {
                    if let Some(options) = question.get("options").and_then(|v| v.as_array()) {
                        let correct_answer = question
                            .get("correctAnswer")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as usize;

                        html.push_str(r#"            <div class="options">"#);
                        for (i, option) in options.iter().enumerate() {
                            let option_text = option.as_str().unwrap_or("");
                            let is_correct = i == correct_answer;

                            html.push_str(&format!(
                                r#"
                <label class="option">
                    <input type="radio" name="q-{}" value="{}" {} />
                    <span>{}</span>
                </label>"#,
                                q_id,
                                i,
                                if is_correct {
                                    format!(r#"data-correct="{}""#, i)
                                } else {
                                    String::new()
                                },
                                option_text
                            ));
                        }
                        html.push_str(
                            r#"
            </div>"#,
                        );
                    }
                }
                "true-false" => {
                    let correct_answer = question
                        .get("correctAnswer")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);

                    html.push_str(r#"            <div class="options">"#);
                    // True option
                    html.push_str(&format!(
                        r#"
                <label class="option">
                    <input type="radio" name="q-{}" value="0" {} />
                    <span>True</span>
                </label>"#,
                        q_id,
                        if correct_answer {
                            ""
                        } else {
                            r#"data-correct="0""#
                        }
                    ));
                    // False option
                    html.push_str(&format!(
                        r#"
                <label class="option">
                    <input type="radio" name="q-{}" value="1" {} />
                    <span>False</span>
                </label>"#,
                        q_id,
                        if !correct_answer {
                            r#"data-correct="1""#
                        } else {
                            ""
                        }
                    ));
                    html.push_str(
                        r#"
            </div>"#,
                    );
                }
                _ => {}
            }

            html.push_str(&format!(
                r#"
            <div class="explanation" style="display:none;">
                <p>{}</p>
            </div>
        </div>
"#,
                explanation
            ));
        }
    }

    html.push_str(
        r#"    </div>
</div>
"#,
    );
    html
}

pub fn generate_complete_scorm_html(course_content: &Value, metadata: &CourseMetadata) -> String {
    let mut html = format!(
        r#"<!DOCTYPE html>
<html lang="en" style="height: 100%; margin: 0; padding: 0;">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <link rel="stylesheet" href="styles.css">
    <style>
        /* Ensure full height in Moodle iframe */
        html, body {{
            height: 100% !important;
            min-height: 800px !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
        }}
        
        /* Target Moodle's SCORM player specifically */
        @media screen {{
            html, body {{
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
            }}
        }}
        
        /* Force expansion in iframe context */
        html:has(body) {{
            min-height: 100vh !important;
        }}
        
        /* Override any Moodle constraints */
        body > * {{
            height: 100% !important;
            min-height: 800px !important;
        }}
    </style>
    <script src="scorm_api.js"></script>
    <script src="navigation.js"></script>
</head>
<body style="height: 100%; margin: 0; padding: 0;">
    <div class="navigation">
        <button id="nav-welcome" class="nav-btn active" onclick="showPage('welcome')">Welcome</button>
        <button id="nav-objectives" class="nav-btn" onclick="showPage('objectives')">Objectives</button>
"#,
        metadata.title
    );

    // Add topic navigation buttons
    if let Some(topics) = course_content.get("topics").and_then(|v| v.as_array()) {
        for (i, topic) in topics.iter().enumerate() {
            let default_title = format!("Topic {}", i + 1);
            let topic_title = topic
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or(&default_title);
            html.push_str(&format!(
                r#"        <button id="nav-topic-{}" class="nav-btn" onclick="showPage('topic-{}')">{}</button>
"#, i, i, topic_title
            ));
        }
    }

    // Add assessment button if present
    if course_content
        .get("assessment")
        .and_then(|v| v.as_object())
        .is_some()
    {
        html.push_str(r#"        <button id="nav-assessment" class="nav-btn" onclick="showPage('assessment')">Assessment</button>
"#);
    }

    html.push_str(
        r#"    </div>
    
    <div class="content-container">
"#,
    );

    // Generate welcome page
    if let Some(_welcome) = course_content
        .get("welcomePage")
        .and_then(|v| v.as_object())
    {
        html.push_str(
            r#"        <div id="page-welcome" class="page-content active">
"#,
        );
        let welcome_html = generate_welcome_page_html(course_content.get("welcomePage").unwrap());
        // Remove the outer div wrapper since we're adding our own
        let welcome_content = welcome_html
            .trim_start_matches("<div class=\"page-content\">\n")
            .trim_end_matches("</div>\n");
        html.push_str(&format!("            {}", welcome_content));
        html.push_str(
            r#"        </div>
"#,
        );
    }

    // Generate objectives page
    if let Some(_objectives) = course_content
        .get("learningObjectivesPage")
        .and_then(|v| v.as_object())
    {
        html.push_str(
            r#"        <div id="page-objectives" class="page-content">
"#,
        );
        let objectives_html =
            generate_objectives_page_html(course_content.get("learningObjectivesPage").unwrap());
        // Remove the outer div wrapper
        let objectives_content = objectives_html
            .trim_start_matches("<div class=\"page-content\">\n")
            .trim_end_matches("</div>\n");
        html.push_str(&format!("            {}", objectives_content));
        html.push_str(
            r#"        </div>
"#,
        );
    }

    // Generate topic pages
    if let Some(topics) = course_content.get("topics").and_then(|v| v.as_array()) {
        for (i, topic) in topics.iter().enumerate() {
            html.push_str(&format!(
                r#"        <div id="page-topic-{}" class="page-content">
"#,
                i
            ));
            let topic_html = generate_topic_page_html(topic, i);
            // Remove the outer div wrapper
            let topic_content = topic_html
                .trim_start_matches("<div class=\"page-content\">\n")
                .trim_end_matches("</div>\n");
            html.push_str(&format!("            {}", topic_content));
            html.push_str(
                r#"        </div>
"#,
            );
        }
    }

    // Generate assessment page
    if let Some(_assessment) = course_content.get("assessment").and_then(|v| v.as_object()) {
        html.push_str(
            r#"        <div id="page-assessment" class="page-content">
"#,
        );
        let assessment_html =
            generate_assessment_page_html(course_content.get("assessment").unwrap());
        // Remove the outer div wrapper
        let assessment_content = assessment_html
            .trim_start_matches("<div class=\"page-content\" data-pass-mark=\"80\">\n")
            .trim_end_matches("</div>\n");
        html.push_str(&format!("            {}", assessment_content));
        html.push_str(
            r#"        </div>
"#,
        );
    }

    html.push_str(r#"    </div>
    
    <!-- Moodle iframe height fix -->
    <script>
        // Force full viewport height
        function forceFullHeight() {
            // Set body to full viewport
            document.body.style.height = '100vh';
            document.body.style.minHeight = '800px';
            document.documentElement.style.height = '100vh';
            document.documentElement.style.minHeight = '800px';
            
            // Try to expand the iframe from inside
            if (window.frameElement) {
                try {
                    window.frameElement.style.width = '100%';
                    window.frameElement.style.height = '100vh';
                    window.frameElement.style.minHeight = '800px';
                    window.frameElement.style.position = 'absolute';
                    window.frameElement.style.top = '0';
                    window.frameElement.style.left = '0';
                    window.frameElement.style.right = '0';
                    window.frameElement.style.bottom = '0';
                } catch (e) {
                    console.log('Cannot modify iframe styles from inside');
                }
            }
            
            // Notify parent window about desired size
            if (window.parent && window.parent !== window) {
                try {
                    // Try multiple methods to communicate with parent
                    window.parent.postMessage({
                        type: 'setHeight',
                        height: Math.max(800, window.innerHeight, document.body.scrollHeight)
                    }, '*');
                    
                    // Try SCORM-specific resize
                    if (window.parent.resizeIframe) {
                        window.parent.resizeIframe('100%', '800px');
                    }
                    
                    // Try Moodle-specific resize
                    if (window.parent.M && window.parent.M.mod_scorm && window.parent.M.mod_scorm.resize) {
                        window.parent.M.mod_scorm.resize();
                    }
                } catch (e) {
                    console.log('Could not communicate with parent window:', e);
                }
            }
        }
        
        // Run immediately
        forceFullHeight();
        
        // Run on various events
        window.addEventListener('load', forceFullHeight);
        window.addEventListener('DOMContentLoaded', forceFullHeight);
        window.addEventListener('resize', forceFullHeight);
        
        // Run periodically for the first few seconds
        let attempts = 0;
        const interval = setInterval(function() {
            forceFullHeight();
            attempts++;
            if (attempts > 10) {
                clearInterval(interval);
            }
        }, 500);
    </script>
    
    <script>
        // Navigation functionality
        function showPage(pageId) {
            // Hide all pages
            const pages = document.querySelectorAll('.page-content');
            pages.forEach(page => page.classList.remove('active'));
            
            // Show selected page
            const targetPage = document.getElementById('page-' + pageId);
            if (targetPage) {
                targetPage.classList.add('active');
            }
            
            // Update navigation buttons
            const navButtons = document.querySelectorAll('.nav-btn');
            navButtons.forEach(btn => btn.classList.remove('active'));
            
            const activeBtn = document.getElementById('nav-' + pageId);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
            
            // Track page change in SCORM
            trackPageChange(pageId);
        }
        
        // Initialize SCORM
        window.onload = function() {
            // SCORM is auto-initialized by scorm_api.js
            // Track page navigation
            showPage('welcome');
        };
        
        // Track page changes in SCORM
        window.currentPage = 'welcome';
        function trackPageChange(pageId) {
            window.currentPage = pageId;
            if (window.SCORM && window.SCORM.initialized) {
                window.SCORM.setValue('cmi.core.lesson_location', pageId);
                window.SCORM.commit();
            }
        }
    </script>
</body>
</html>"#);

    html
}

#[cfg(test)]
#[path = "html_generator_test.rs"]
mod tests;
