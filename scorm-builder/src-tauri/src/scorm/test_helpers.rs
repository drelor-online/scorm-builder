use crate::scorm::generator::{GeneratedFile, CourseMetadata, GenerateScormRequest, MediaFile};
use serde_json::json;

/// Creates test generated files that represent realistic SCORM content
/// This simulates what the JavaScript frontend would generate
pub fn create_test_generated_files() -> Vec<GeneratedFile> {
    vec![
        // SCORM manifest file
        GeneratedFile {
            path: "imsmanifest.xml".to_string(),
            content: create_test_manifest(),
            is_binary: false,
        },
        // Main SCORM HTML content
        GeneratedFile {
            path: "index.html".to_string(),
            content: create_test_index_html(),
            is_binary: false,
        },
        // SCORM API wrapper
        GeneratedFile {
            path: "scorm-api.js".to_string(),
            content: create_test_scorm_api(),
            is_binary: false,
        },
        // Course styles
        GeneratedFile {
            path: "styles.css".to_string(),
            content: create_test_styles(),
            is_binary: false,
        },
    ]
}

/// Creates test generated files with specific CourseSettings
/// This allows testing different SCORM configurations
pub fn create_test_generated_files_with_settings(settings: &TestCourseSettings) -> Vec<GeneratedFile> {
    vec![
        GeneratedFile {
            path: "imsmanifest.xml".to_string(),
            content: create_test_manifest_with_settings(settings),
            is_binary: false,
        },
        GeneratedFile {
            path: "index.html".to_string(),
            content: create_test_index_html_with_settings(settings),
            is_binary: false,
        },
        GeneratedFile {
            path: "scorm-api.js".to_string(),
            content: create_test_scorm_api_with_settings(settings),
            is_binary: false,
        },
        GeneratedFile {
            path: "styles.css".to_string(),
            content: create_test_styles_with_settings(settings),
            is_binary: false,
        },
    ]
}

/// Test settings that mirror the JavaScript CourseSettings
#[derive(Debug, Clone)]
pub struct TestCourseSettings {
    pub require_audio_completion: bool,
    pub navigation_mode: String, // "linear" or "free"
    pub pass_mark: i32,
    pub allow_retake: bool,
    pub completion_criteria: String,
    pub show_progress: bool,
    pub font_size: String,
    pub time_limit: Option<i32>,
    pub keyboard_navigation: bool,
}

impl Default for TestCourseSettings {
    fn default() -> Self {
        Self {
            require_audio_completion: false,
            navigation_mode: "free".to_string(),
            pass_mark: 70,
            allow_retake: true,
            completion_criteria: "view_all".to_string(),
            show_progress: true,
            font_size: "medium".to_string(),
            time_limit: None,
            keyboard_navigation: false,
        }
    }
}

/// Creates a basic SCORM manifest
fn create_test_manifest() -> String {
    r#"<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          identifier="SingleSCO" version="1.0"
          xml:base="./">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
  <organizations default="course_org">
    <organization identifier="course_org">
      <title>Test Course</title>
      <item identifier="item_1" identifierref="resource_1">
        <title>Test Course Content</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource_1" type="webcontent" href="index.html">
      <file href="index.html"/>
      <file href="scorm-api.js"/>
      <file href="styles.css"/>
    </resource>
  </resources>
</manifest>"#.to_string()
}

/// Creates manifest with specific settings
fn create_test_manifest_with_settings(settings: &TestCourseSettings) -> String {
    let completion_threshold = if settings.completion_criteria == "pass_assessment" {
        format!("<adlcp:completionThreshold>{}</adlcp:completionThreshold>", settings.pass_mark)
    } else {
        String::new()
    };

    format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          identifier="SingleSCO" version="1.0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
  <organizations default="course_org">
    <organization identifier="course_org">
      <title>Test Course with Settings</title>
      <item identifier="item_1" identifierref="resource_1">
        <title>Course Content</title>
        <adlcp:masteryscore>{}</adlcp:masteryscore>
        {}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource_1" type="webcontent" href="index.html">
      <file href="index.html"/>
      <file href="scorm-api.js"/>
      <file href="styles.css"/>
    </resource>
  </resources>
</manifest>"#, settings.pass_mark, completion_threshold)
}

/// Creates basic index.html
fn create_test_index_html() -> String {
    r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test SCORM Course</title>
    <link rel="stylesheet" href="styles.css">
    <script src="scorm-api.js"></script>
</head>
<body>
    <div id="course-container">
        <h1>Test SCORM Course</h1>
        <div id="content">
            <p>This is a test SCORM package.</p>
            <button onclick="completeCourse()">Complete Course</button>
        </div>
    </div>
    <script>
        function completeCourse() {
            SCORM.SetValue('cmi.completion_status', 'completed');
            SCORM.SetValue('cmi.success_status', 'passed');
            SCORM.Commit();
        }
    </script>
</body>
</html>"#.to_string()
}

/// Creates index.html with specific settings
fn create_test_index_html_with_settings(settings: &TestCourseSettings) -> String {
    let navigation_controls = if settings.navigation_mode == "linear" {
        r#"<div id="navigation" style="display: none;"></div>"#
    } else {
        r#"<div id="navigation">
            <button onclick="previousPage()">Previous</button>
            <button onclick="nextPage()">Next</button>
        </div>"#
    };

    let progress_bar = if settings.show_progress {
        r#"<div id="progress-bar">
            <div id="progress" style="width: 0%;"></div>
        </div>"#
    } else {
        ""
    };

    let font_class = match settings.font_size.as_str() {
        "small" => "font-small",
        "large" => "font-large",
        _ => "font-medium",
    };

    let audio_completion = if settings.require_audio_completion {
        r#"
        <script>
            let audioCompleted = false;
            document.querySelector('audio').addEventListener('ended', function() {
                audioCompleted = true;
                document.querySelector('#complete-btn').disabled = false;
            });
        </script>"#
    } else {
        ""
    };

    format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCORM Course with Settings</title>
    <link rel="stylesheet" href="styles.css">
    <script src="scorm-api.js"></script>
</head>
<body class="{}">
    <div id="course-container">
        <h1>SCORM Course with Custom Settings</h1>
        {}
        {}
        <div id="content">
            <p>Navigation Mode: {}</p>
            <p>Pass Mark: {}%</p>
            <p>Allow Retake: {}</p>
            <p>Audio Completion Required: {}</p>
            <button id="complete-btn" onclick="completeCourse()">Complete Course</button>
        </div>
    </div>
    <script>
        function completeCourse() {{
            SCORM.SetValue('cmi.completion_status', 'completed');
            SCORM.SetValue('cmi.score.scaled', '0.85');
            SCORM.SetValue('cmi.success_status', 'passed');
            SCORM.Commit();
        }}
    </script>
    {}
</body>
</html>"#, 
        font_class,
        progress_bar,
        navigation_controls,
        settings.navigation_mode,
        settings.pass_mark,
        settings.allow_retake,
        settings.require_audio_completion,
        audio_completion
    )
}

/// Creates basic SCORM API wrapper
fn create_test_scorm_api() -> String {
    r#"
// Basic SCORM API implementation for testing
var SCORM = {
    version: "1.2",
    initialized: false,
    
    Initialize: function() {
        this.initialized = true;
        return "true";
    },
    
    SetValue: function(element, value) {
        console.log("SCORM SetValue:", element, value);
        return "true";
    },
    
    GetValue: function(element) {
        console.log("SCORM GetValue:", element);
        return "";
    },
    
    Commit: function() {
        console.log("SCORM Commit called");
        return "true";
    },
    
    Terminate: function() {
        this.initialized = false;
        return "true";
    }
};

// Auto-initialize
window.addEventListener('load', function() {
    SCORM.Initialize();
});
"#.to_string()
}

/// Creates SCORM API with settings-specific behavior
fn create_test_scorm_api_with_settings(settings: &TestCourseSettings) -> String {
    let mastery_score = format!("masteryScore: {}", settings.pass_mark);
    let completion_threshold = if settings.require_audio_completion {
        "audioCompletionRequired: true"
    } else {
        "audioCompletionRequired: false"
    };

    format!(r#"
// SCORM API implementation with custom settings
var SCORM = {{
    version: "1.2",
    initialized: false,
    settings: {{
        {},
        {},
        navigationMode: "{}",
        allowRetake: {},
        completionCriteria: "{}"
    }},
    
    Initialize: function() {{
        this.initialized = true;
        console.log("SCORM initialized with settings:", this.settings);
        return "true";
    }},
    
    SetValue: function(element, value) {{
        console.log("SCORM SetValue:", element, value);
        if (element === "cmi.score.scaled" && this.settings.masteryScore) {{
            var score = parseFloat(value) * 100;
            if (score < this.settings.masteryScore) {{
                console.log("Score below mastery threshold");
            }}
        }}
        return "true";
    }},
    
    GetValue: function(element) {{
        if (element === "cmi.core.student_name") return "Test Student";
        return "";
    }},
    
    Commit: function() {{
        console.log("SCORM Commit called");
        return "true";
    }},
    
    Terminate: function() {{
        this.initialized = false;
        return "true";
    }}
}};

window.addEventListener('load', function() {{
    SCORM.Initialize();
}});
"#, 
        mastery_score,
        completion_threshold,
        settings.navigation_mode,
        settings.allow_retake,
        settings.completion_criteria
    )
}

/// Creates basic CSS
fn create_test_styles() -> String {
    r#"
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}

#course-container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

#content {
    margin-top: 20px;
}

button {
    background-color: #007cba;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
}

button:hover {
    background-color: #005c87;
}
"#.to_string()
}

/// Creates CSS with settings-specific styles  
fn create_test_styles_with_settings(settings: &TestCourseSettings) -> String {
    let font_size_styles = match settings.font_size.as_str() {
        "small" => ".font-small { font-size: 14px; }",
        "large" => ".font-large { font-size: 18px; }",
        _ => ".font-medium { font-size: 16px; }",
    };

    let progress_styles = if settings.show_progress {
        r#"
#progress-bar {
    width: 100%;
    height: 20px;
    background-color: #e0e0e0;
    border-radius: 10px;
    margin: 10px 0;
}

#progress {
    height: 100%;
    background-color: #4caf50;
    border-radius: 10px;
    transition: width 0.3s ease;
}
"#
    } else {
        ""
    };

    let navigation_styles = if settings.navigation_mode == "linear" {
        "#navigation { display: none !important; }"
    } else {
        r#"
#navigation {
    margin: 20px 0;
    text-align: center;
}

#navigation button {
    margin: 0 10px;
}
"#
    };

    format!(r#"
body {{
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}}

#course-container {{
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}}

#content {{
    margin-top: 20px;
}}

button {{
    background-color: #007cba;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
}}

button:hover {{
    background-color: #005c87;
}}

{}

{}

{}
"#, font_size_styles, progress_styles, navigation_styles)
}

/// Creates a complete test request for SCORM generation
pub fn create_test_scorm_request() -> GenerateScormRequest {
    GenerateScormRequest {
        project_id: "test-project".to_string(),
        course_content: json!({
            "title": "Test Course",
            "description": "A test course for validation",
            "topics": ["Introduction", "Content", "Assessment"]
        }),
        course_metadata: CourseMetadata {
            title: "Test Course".to_string(),
            description: "Test Description".to_string(),
            project_title: "Test Project".to_string(),
            version: Some("1.0".to_string()),
            scorm_version: Some("2004".to_string()),
        },
        media_files: vec![],
        generated_files: create_test_generated_files(),
        extension_map: std::collections::HashMap::new(),
    }
}

/// Creates a test request with specific settings
pub fn create_test_scorm_request_with_settings(settings: TestCourseSettings) -> GenerateScormRequest {
    GenerateScormRequest {
        project_id: "test-project-settings".to_string(),
        course_content: json!({
            "title": "Test Course with Settings",
            "description": "A test course with custom settings",
            "topics": ["Introduction", "Content", "Assessment"],
            "settings": {
                "requireAudioCompletion": settings.require_audio_completion,
                "navigationMode": settings.navigation_mode,
                "passMark": settings.pass_mark,
                "allowRetake": settings.allow_retake,
                "completionCriteria": settings.completion_criteria,
                "showProgress": settings.show_progress,
                "fontSize": settings.font_size,
                "timeLimit": settings.time_limit,
                "keyboardNavigation": settings.keyboard_navigation
            }
        }),
        course_metadata: CourseMetadata {
            title: "Test Course with Settings".to_string(),
            description: "Test course with custom CourseSettings".to_string(),
            project_title: "Test Project Settings".to_string(),
            version: Some("1.0".to_string()),
            scorm_version: Some("2004".to_string()),
        },
        media_files: vec![],
        generated_files: create_test_generated_files_with_settings(&settings),
        extension_map: std::collections::HashMap::new(),
    }
}