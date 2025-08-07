use serde_json::json;

#[test]
fn test_generate_welcome_page_html() {
    let course_content = json!({
        "welcomePage": {
            "title": "Welcome to the Course",
            "content": "<p>This is a comprehensive course on Rust programming.</p>",
            "narration": "Welcome to this comprehensive course on Rust programming.",
            "audioId": "audio-0",
            "captionId": "caption-0",
            "media": [{
                "id": "image-0",
                "type": "image",
                "url": "/media/welcome-image.jpg",
                "title": "Course Welcome Image"
            }]
        }
    });

    let html = generate_welcome_page_html(&course_content["welcomePage"]);

    // Verify the HTML contains expected elements
    assert!(html.contains("<h1>Welcome to the Course</h1>"));
    assert!(html.contains("This is a comprehensive course on Rust programming."));
    assert!(html.contains("<img"));
    assert!(html.contains("src=\"media/image-0.jpg\""));
    assert!(html.contains("alt=\"Course Welcome Image\""));
    assert!(html.contains("<audio"));
    assert!(html.contains("src=\"media/audio-0.mp3\""));
    assert!(html.contains("<track"));
    assert!(html.contains("src=\"media/caption-0.vtt\""));
}

#[test]
fn test_generate_objectives_page_html() {
    let course_content = json!({
        "learningObjectivesPage": {
            "objectives": [
                "Understand Rust ownership system",
                "Write memory-safe code",
                "Build concurrent applications"
            ],
            "content": "<h2>Learning Objectives</h2><ul><li>Understand Rust ownership system</li><li>Write memory-safe code</li><li>Build concurrent applications</li></ul>",
            "narration": "In this course, you will learn three key objectives.",
            "audioId": "audio-1",
            "captionId": "caption-1"
        }
    });

    let html = generate_objectives_page_html(&course_content["learningObjectivesPage"]);

    // Verify the HTML contains expected elements
    assert!(html.contains("<h2>Learning Objectives</h2>"));
    assert!(html.contains("Understand Rust ownership system"));
    assert!(html.contains("Write memory-safe code"));
    assert!(html.contains("Build concurrent applications"));
    assert!(html.contains("<audio"));
    assert!(html.contains("src=\"media/audio-1.mp3\""));
}

#[test]
fn test_generate_topic_page_html() {
    let topic = json!({
        "id": "topic-1",
        "title": "Introduction to Rust",
        "content": "<h2>What is Rust?</h2><p>Rust is a systems programming language.</p>",
        "sections": [{
            "content": "Rust provides memory safety without garbage collection.",
            "activities": []
        }],
        "knowledgeCheck": {
            "type": "multiple-choice",
            "question": "What does Rust provide?",
            "options": ["Memory safety", "Garbage collection", "Dynamic typing", "Interpreted execution"],
            "correctAnswer": "Memory safety",
            "explanation": "Rust provides memory safety without needing garbage collection."
        },
        "audioId": "audio-2",
        "captionId": "caption-2",
        "media": [{
            "id": "image-1",
            "type": "image",
            "url": "/media/rust-logo.png",
            "title": "Rust Logo"
        }]
    });

    let html = generate_topic_page_html(&topic, 0);

    println!("Generated HTML:\n{}", html);

    // Verify the HTML contains expected elements
    assert!(html.contains("<h1>Introduction to Rust</h1>"));
    assert!(html.contains("What is Rust?"));
    assert!(html.contains("Rust is a systems programming language."));
    assert!(html.contains("Rust provides memory safety without garbage collection."));

    // Check knowledge check rendering
    assert!(html.contains("What does Rust provide?"));
    assert!(html.contains("Memory safety"));
    assert!(html.contains("Garbage collection"));
    assert!(html.contains("data-correct=\"0\"")); // First option is correct

    // Check media
    assert!(html.contains("<img"));
    assert!(html.contains("src=\"media/image-1.png\""));
    assert!(html.contains("<audio"));
    assert!(html.contains("src=\"media/audio-2.mp3\""));
}

#[test]
fn test_generate_assessment_page_html() {
    let assessment = json!({
        "questions": [
            {
                "id": "q1",
                "type": "multiple-choice",
                "question": "What is Rust?",
                "options": ["A programming language", "A game engine", "A database", "An operating system"],
                "correctAnswer": 0,
                "explanation": "Rust is a systems programming language."
            },
            {
                "id": "q2",
                "type": "true-false",
                "question": "Rust requires garbage collection.",
                "correctAnswer": false,
                "explanation": "Rust provides memory safety without garbage collection."
            }
        ],
        "passMark": 80
    });

    let html = generate_assessment_page_html(&assessment);

    // Verify the HTML contains expected elements
    assert!(html.contains("<h1>Assessment</h1>"));
    assert!(html.contains("What is Rust?"));
    assert!(html.contains("A programming language"));
    assert!(html.contains("data-correct=\"0\""));

    assert!(html.contains("Rust requires garbage collection."));
    assert!(html.contains("True"));
    assert!(html.contains("False"));
    assert!(html.contains("data-correct=\"1\"")); // False is correct

    assert!(html.contains("data-pass-mark=\"80\""));
}

#[test]
fn test_generate_complete_scorm_html() {
    let course_content = json!({
        "welcomePage": {
            "title": "Welcome",
            "content": "Welcome content"
        },
        "learningObjectivesPage": {
            "objectives": ["Learn Rust"],
            "content": "Objectives content"
        },
        "topics": [
            {
                "id": "topic-1",
                "title": "Topic 1",
                "content": "Topic content"
            }
        ],
        "assessment": {
            "questions": [{
                "type": "multiple-choice",
                "question": "Test question",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": 0
            }],
            "passMark": 80
        }
    });

    let metadata = crate::scorm::generator::CourseMetadata {
        title: "Test Course".to_string(),
        description: "Test Description".to_string(),
        project_title: "Test Project".to_string(),
        version: None,
        scorm_version: None,
    };

    let html = generate_complete_scorm_html(&course_content, &metadata);

    // Verify the HTML structure
    assert!(html.contains("<!DOCTYPE html>"));
    assert!(html.contains("<html"));
    assert!(html.contains("<head>"));
    assert!(html.contains("<title>Test Course</title>"));
    assert!(html.contains("<script src=\"scorm_api.js\"></script>"));
    assert!(html.contains("<body>"));

    // Verify navigation
    assert!(html.contains("id=\"nav-welcome\""));
    assert!(html.contains("id=\"nav-objectives\""));
    assert!(html.contains("id=\"nav-topic-0\""));
    assert!(html.contains("id=\"nav-assessment\""));

    // Verify pages
    assert!(html.contains("id=\"page-welcome\""));
    assert!(html.contains("id=\"page-objectives\""));
    assert!(html.contains("id=\"page-topic-0\""));
    assert!(html.contains("id=\"page-assessment\""));
}

// Import the functions we're testing (these don't exist yet, so tests will fail)
use crate::scorm::html_generator::{
    generate_assessment_page_html, generate_complete_scorm_html, generate_objectives_page_html,
    generate_topic_page_html, generate_welcome_page_html,
};
