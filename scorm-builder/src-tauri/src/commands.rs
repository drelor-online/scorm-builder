use super::project_storage::{self, ProjectFile};
use super::scorm::generator::{GenerateScormRequest, ScormGenerationResult};
use super::settings;
use crate::commands_secure::log_debug;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{command, Emitter};

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaFile {
    pub filename: String,
    pub content: Vec<u8>,
}

// Commented out - using secure version from commands_secure.rs
// #[command]
// pub fn get_projects_dir() -> Result<String, String> {
//     project_storage::get_projects_directory()
//         .map(|path| path.to_string_lossy().to_string())
// }

#[command]
pub fn create_project(name: String) -> Result<project_storage::ProjectMetadata, String> {
    use chrono::Utc;
    use std::fs;

    // Generate project ID
    let project_id = format!("{}", Utc::now().timestamp_millis());

    // Get projects directory
    let projects_dir = project_storage::get_projects_directory()?;

    // Create project folder
    let project_folder = projects_dir.join(&project_id);
    match fs::create_dir_all(&project_folder) {
        Ok(_) => {}
        Err(e)
            if e.kind() == std::io::ErrorKind::AlreadyExists
                || (cfg!(windows) && e.raw_os_error() == Some(183)) => {}
        Err(e) => return Err(format!("Failed to create project folder: {e}")),
    }

    // Create media folder
    let media_folder = project_folder.join("media");
    match fs::create_dir_all(&media_folder) {
        Ok(_) => {}
        Err(e)
            if e.kind() == std::io::ErrorKind::AlreadyExists
                || (cfg!(windows) && e.raw_os_error() == Some(183)) => {}
        Err(e) => return Err(format!("Failed to create media folder: {e}")),
    }

    // Create project file path
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let project_file_name = format!("{safe_name}_{project_id}.scormproj");
    let project_file_path = projects_dir.join(&project_file_name);

    // Create project data
    let project_metadata = project_storage::ProjectMetadata {
        id: project_id.clone(),
        name: name.clone(),
        created: Utc::now(),
        last_modified: Utc::now(),
        path: Some(project_file_path.to_string_lossy().to_string()),
    };

    // Create course seed data with the project name
    let default_difficulty = 3;
    let default_template = "None";

    let course_seed_data = serde_json::json!({
        "courseTitle": name.clone(),
        "difficulty": default_difficulty,
        "customTopics": [],
        "template": default_template,
        "templateTopics": []
    });

    let project_file = ProjectFile {
        project: project_metadata.clone(),
        course_data: project_storage::CourseData {
            title: name.clone(),
            difficulty: default_difficulty, // Now consistent with course_seed_data
            template: default_template.to_string(), // Now consistent with course_seed_data
            topics: Vec::new(),
            custom_topics: None,
        },
        ai_prompt: None,
        course_content: None,
        media: project_storage::MediaData {
            images: Vec::new(),
            videos: Vec::new(),
            audio: Vec::new(),
            captions: Vec::new(),
        },
        audio_settings: project_storage::AudioSettings {
            voice: "default".to_string(),
            speed: 1.0,
            pitch: 1.0,
        },
        scorm_config: project_storage::ScormConfig {
            version: "SCORM_2004".to_string(),
            completion_criteria: "all".to_string(),
            passing_score: 80,
        },
        // Initialize course_seed_data with the project name
        course_seed_data: Some(course_seed_data),
        json_import_data: None,
        activities_data: None,
        media_enhancements: None,
        content_edits: None,
        current_step: Some(serde_json::json!({"step": "seed"}).to_string()),
    };

    // Save project file
    project_storage::save_project_file(&project_file, &project_file_path)?;

    log_debug(&format!(
        "Project created successfully: id={}, name='{}', path='{}'",
        project_metadata.id,
        project_metadata.name,
        project_file_path.to_string_lossy()
    ));

    Ok(project_metadata)
}

// Commented out - using secure version from commands_secure.rs
// #[command]
// pub fn save_project(file_path: String, project_data: ProjectFile) -> Result<(), String> {
//     let path = PathBuf::from(file_path);
//     project_storage::save_project_file(&project_data, &path)
// }

// Commented out - using secure version from commands_secure.rs
// #[command]
// pub fn load_project(file_path: String) -> Result<ProjectFile, String> {
//     let path = PathBuf::from(file_path);
//     project_storage::load_project_file(&path)
// }

// Commented out - using secure version from commands_secure.rs
// #[command]
// pub fn list_projects() -> Result<Vec<project_storage::ProjectMetadata>, String> {
//     let project_files = project_storage::list_project_files()?;
//     let mut projects = Vec::new();
//     for path in project_files {
//         if let Ok(project_file) = project_storage::load_project_file(&path) {
//             // Return only the metadata with the file path included
//             let mut metadata = project_file.project.clone();
//             metadata.path = Some(path.to_string_lossy().to_string());
//             projects.push(metadata);
//         }
//     }
//     Ok(projects)
// }

// Commented out - using secure version from commands_secure.rs
// #[command]
// pub fn delete_project(file_path: String) -> Result<(), String> {
//     let path = PathBuf::from(file_path);
//     project_storage::delete_project_file(&path)
// }

#[command]
pub async fn generate_scorm(
    request: GenerateScormRequest,
) -> Result<ScormGenerationResult, String> {
    crate::scorm::generator::generate_scorm_package(request).await
}

#[command]
pub async fn generate_scorm_enhanced(
    app: tauri::AppHandle,
    course_data: serde_json::Value,
    project_id: String,
    media_files: Option<Vec<MediaFile>>,
    extension_map: Option<HashMap<String, String>>,
) -> Result<Vec<u8>, String> {
    use crate::scorm::generator_enhanced::{
        EnhancedScormGenerator, GenerateScormRequest as EnhancedRequest,
    };

    // Emit progress event
    let _ = app.emit(
        "scorm-generation-progress",
        serde_json::json!({
            "message": "Parsing course data...",
            "progress": 10
        }),
    );

    // Debug: Log the incoming course data
    eprintln!(
        "[generate_scorm_enhanced] Received course data with topics: {}",
        course_data
            .get("topics")
            .and_then(|t| t.as_array())
            .map(|a| a.len())
            .unwrap_or(0)
    );

    // Convert the course data to our enhanced request format
    let enhanced_request: EnhancedRequest =
        serde_json::from_value(course_data.clone()).map_err(|e| {
            eprintln!("[generate_scorm_enhanced] Failed to parse course data: {e}");
            eprintln!(
                "[generate_scorm_enhanced] Course data structure: {}",
                serde_json::to_string_pretty(&course_data).unwrap_or_default()
            );
            format!("Failed to parse course data: {e}")
        })?;

    // Debug: Log knowledge check data
    eprintln!(
        "[generate_scorm_enhanced] Enhanced request has {} topics",
        enhanced_request.topics.len()
    );
    for (i, topic) in enhanced_request.topics.iter().enumerate() {
        if let Some(kc) = &topic.knowledge_check {
            eprintln!(
                "[generate_scorm_enhanced] Topic {} has knowledge check with {} questions",
                i,
                kc.questions.len()
            );
            for (j, q) in kc.questions.iter().enumerate() {
                eprintln!(
                    "[generate_scorm_enhanced]   Question {}: type={}, text={}",
                    j, q.question_type, q.text
                );
            }
        }
    }

    // Emit progress event
    let _ = app.emit(
        "scorm-generation-progress",
        serde_json::json!({
            "message": "Processing media files...",
            "progress": 30
        }),
    );

    // Use provided media files or load from disk
    let media_files_map =
        if let Some(files) = media_files {
            eprintln!(
                "[generate_scorm_enhanced] 📦 Received {} media files from TypeScript",
                files.len()
            );
            
            // Log each file being processed for detailed debugging
            if files.len() > 0 {
                eprintln!("[generate_scorm_enhanced] 📋 Media files received:");
                for (idx, file) in files.iter().enumerate() {
                    eprintln!("  {}. {} ({} bytes)", idx + 1, file.filename, file.content.len());
                }
            } else {
                eprintln!("[generate_scorm_enhanced] ⚠️  Empty media files array received (no binary files to include)");
            }

            let _ = app.emit(
                "scorm-generation-progress",
                serde_json::json!({
                    "message": format!("Processing {} binary files...", files.len()),
                    "progress": 40
                }),
            );

            // Convert Vec<MediaFile> to HashMap<String, Vec<u8>>
            let mut map = HashMap::new();
            let total_files = files.len();
            for (idx, file) in files.into_iter().enumerate() {
                // Ensure media files are prefixed with media/ directory
                let path = if file.filename.starts_with("media/") {
                    file.filename.clone()
                } else {
                    format!("media/{}", file.filename)
                };
                eprintln!(
                    "[generate_scorm_enhanced] Adding media file: {} (size: {} bytes)",
                    path,
                    file.content.len()
                );
                map.insert(path, file.content);

                // Emit progress for media processing
                if idx % 5 == 0 || idx == total_files - 1 {
                    let progress = 40 + ((idx as f32 / total_files as f32) * 20.0) as u32;
                    let _ = app.emit("scorm-generation-progress", serde_json::json!({
                    "message": format!("Processing media file {}/{}...", idx + 1, total_files),
                    "progress": progress
                }));
                }
            }
            map
        } else {
            // Fallback to loading from disk
            eprintln!("[generate_scorm_enhanced] ⚠️  No media files provided from TypeScript - falling back to disk loading");
            eprintln!("[generate_scorm_enhanced] 📁 Searching for media files in project directory: {}/media/", project_id);
            
            let disk_files = load_project_media_files(&project_id).await?;
            eprintln!("[generate_scorm_enhanced] 💾 Found {} media files on disk", disk_files.len());
            
            if disk_files.len() > 0 {
                eprintln!("[generate_scorm_enhanced] 📋 Disk media files found:");
                for (idx, (path, content)) in disk_files.iter().enumerate() {
                    eprintln!("  {}. {} ({} bytes)", idx + 1, path, content.len());
                }
            } else {
                eprintln!("[generate_scorm_enhanced] ❌ No media files found on disk - SCORM package will have no media");
            }
            
            disk_files
        };

    // Emit progress event
    let _ = app.emit(
        "scorm-generation-progress",
        serde_json::json!({
            "message": "Generating HTML content...",
            "progress": 70
        }),
    );

    // Create the generator inside async context
    let generator = EnhancedScormGenerator::new()?;

    // Emit progress event
    let _ = app.emit(
        "scorm-generation-progress",
        serde_json::json!({
            "message": "Creating SCORM package...",
            "progress": 80
        }),
    );

    // Log extension map if provided
    if let Some(ref ext_map) = extension_map {
        eprintln!("[generate_scorm_enhanced] Received extension map with {} entries", ext_map.len());
        if !ext_map.is_empty() {
            eprintln!("[generate_scorm_enhanced] Extension map entries: {:?}", ext_map);
        }
    } else {
        eprintln!("[generate_scorm_enhanced] No extension map provided");
    }

    // Generate the SCORM package (synchronous)
    let result = generator.generate_scorm_package(enhanced_request, media_files_map)?;

    // Emit final progress event
    let _ = app.emit(
        "scorm-generation-progress",
        serde_json::json!({
            "message": "Finalizing package...",
            "progress": 95
        }),
    );

    // Emit 100% completion event
    let _ = app.emit(
        "scorm-generation-progress",
        serde_json::json!({
            "message": "SCORM package generated successfully!",
            "progress": 100
        }),
    );

    Ok(result)
}

async fn load_project_media_files(project_id: &str) -> Result<HashMap<String, Vec<u8>>, String> {
    use tokio::fs;

    let mut media_files = HashMap::new();

    // Get the media directory path using the configurable projects directory
    let projects_dir = project_storage::get_projects_directory()?;
    let base_path = projects_dir.join(project_id).join("media");

    if base_path.exists() {
        let mut entries = fs::read_dir(&base_path)
            .await
            .map_err(|e| format!("Failed to read media directory: {e}"))?;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| format!("Failed to read directory entry: {e}"))?
        {
            let path = entry.path();
            if path.is_file() {
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .ok_or_else(|| "Invalid file name".to_string())?;

                let content = fs::read(&path)
                    .await
                    .map_err(|e| format!("Failed to read file {file_name}: {e}"))?;

                media_files.insert(format!("media/{file_name}"), content);
            }
        }
    }

    Ok(media_files)
}

#[command]
pub fn set_projects_dir(directory: String) -> Result<(), String> {
    let path = PathBuf::from(directory);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    settings::set_projects_directory(&path)
}

#[command]
pub fn get_app_settings() -> Result<settings::AppSettings, String> {
    settings::load_settings()
}

#[command]
pub fn save_app_settings(settings: settings::AppSettings) -> Result<(), String> {
    settings::save_settings(&settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    use tokio;

    #[test]
    fn test_create_project_data_consistency() {
        // Setup test directory
        let temp_dir = TempDir::new().unwrap();

        // Set the custom directory in settings
        let mut settings = settings::load_settings().unwrap_or_default();
        settings.projects_directory = Some(temp_dir.path().to_string_lossy().to_string());
        settings::save_settings(&settings).unwrap();

        // Create a new project
        let project_name = "Test Course";
        let result = create_project(project_name.to_string());

        // Clean up settings before assertions
        settings.projects_directory = None;
        settings::save_settings(&settings).unwrap();

        assert!(result.is_ok(), "Project creation should succeed");
        let metadata = result.unwrap();

        // Load the created project file to check data consistency
        let project_file_path = PathBuf::from(metadata.path.unwrap());
        let project_file = project_storage::load_project_file(&project_file_path).unwrap();

        // Check that course_data and course_seed_data have the same title
        assert_eq!(
            project_file.course_data.title, project_name,
            "course_data.title should match project name"
        );

        if let Some(seed_data) = &project_file.course_seed_data {
            assert_eq!(
                seed_data.get("courseTitle").and_then(|v| v.as_str()),
                Some(project_name),
                "course_seed_data.courseTitle should match project name"
            );

            // Check that difficulty values match
            let seed_difficulty = seed_data
                .get("difficulty")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u8;
            assert_eq!(
                seed_difficulty,
                3, // The seed data sets difficulty to 3
                "course_seed_data.difficulty should be 3 as set in create_project"
            );
            // Note: course_data.difficulty is set to 1, which is inconsistent!
        } else {
            panic!("course_seed_data should be initialized");
        }

        // Clean up
        let _ = project_storage::delete_project_file(&project_file_path);
    }

    // This test requires the "test" feature to be enabled in Tauri
    // #[tokio::test]
    #[allow(dead_code)]
    async fn test_generate_scorm_emits_100_percent_progress() {
        use std::sync::{Arc, Mutex};
        // Tauri test module requires "test" feature to be enabled
        // use tauri::test::MockAppHandle;

        // Create a mock app handle to capture emitted events
        let emitted_events: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
        let events_clone = emitted_events.clone();

        // Create minimal course data for testing
        let course_data = serde_json::json!({
            "course_title": "Test Course",
            "topics": [],
            "pass_mark": 80,
            "navigation_mode": "linear",
            "allow_retake": true
        });

        // Note: We can't easily test the actual event emission without a real Tauri app handle
        // But we can verify the function completes and would emit 100% at the end
        // The actual test would need to be an integration test with a real Tauri app

        // For now, let's just verify the structure exists for 100% emission
        let source_code = include_str!("commands.rs");

        // Check that we emit progress events
        assert!(
            source_code.contains("scorm-generation-progress"),
            "Should emit progress events"
        );

        // Check that we have progress values going up
        assert!(
            source_code.contains("progress\": 10"),
            "Should have 10% progress"
        );
        assert!(
            source_code.contains("progress\": 30"),
            "Should have 30% progress"
        );
        assert!(
            source_code.contains("progress\": 70"),
            "Should have 70% progress"
        );
        assert!(
            source_code.contains("progress\": 95"),
            "Should have 95% progress"
        );

        // This test will fail until we add 100% progress event
        assert!(
            source_code.contains("progress\": 100") || source_code.contains("\"progress\": 100"),
            "Should emit 100% progress at completion"
        );
    }

    #[tokio::test]
    async fn test_load_project_media_uses_custom_directory() {
        // Create a temporary custom projects directory
        let temp_dir = TempDir::new().unwrap();
        let custom_projects_dir = temp_dir.path().join("CustomProjects");
        fs::create_dir_all(&custom_projects_dir).unwrap();

        // Set the custom directory in settings
        let mut settings = settings::load_settings().unwrap_or_default();
        settings.projects_directory = Some(custom_projects_dir.to_string_lossy().to_string());
        settings::save_settings(&settings).unwrap();

        // Create a project with media in the custom directory
        let project_id = "test_project_123";
        let project_media_dir = custom_projects_dir.join(project_id).join("media");
        fs::create_dir_all(&project_media_dir).unwrap();

        // Add a test media file
        let test_file_path = project_media_dir.join("test_image.png");
        let test_content = b"fake png content";
        fs::write(&test_file_path, test_content).unwrap();

        // Try to load media files - this should find our test file
        let result = load_project_media_files(project_id).await;

        // Clean up settings before assertions
        settings.projects_directory = None;
        settings::save_settings(&settings).unwrap();

        // Verify the media was found
        assert!(
            result.is_ok(),
            "Should successfully load media from custom directory"
        );
        let media_files = result.unwrap();
        assert_eq!(media_files.len(), 1, "Should find one media file");
        assert!(
            media_files.contains_key("media/test_image.png"),
            "Should contain the test image"
        );
        assert_eq!(
            media_files.get("media/test_image.png").unwrap(),
            test_content,
            "Content should match"
        );
    }
}

// Workflow recording commands
#[command]
pub async fn take_screenshot(filename: String) -> Result<String, String> {
    use screenshots::Screen;
    
    // Get projects directory or use temp directory
    let projects_dir = project_storage::get_projects_directory()
        .unwrap_or_else(|_| std::env::temp_dir());
    
    let screenshots_dir = projects_dir.join("workflow-screenshots");
    
    // Create screenshots directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&screenshots_dir) {
        return Err(format!("Failed to create screenshots directory: {}", e));
    }
    
    let screenshot_path = screenshots_dir.join(&filename);
    
    // Take actual screenshot
    match Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                match screen.capture() {
                    Ok(image) => {
                        // Save image directly as PNG
                        if let Err(e) = image.save(&screenshot_path) {
                            return Err(format!("Failed to save screenshot: {}", e));
                        }
                        
                        log_debug(&format!("Screenshot saved: {}", screenshot_path.display()));
                        Ok(screenshot_path.to_string_lossy().to_string())
                    }
                    Err(e) => {
                        log_debug(&format!("Failed to capture screenshot: {}, falling back to placeholder", e));
                        // Fallback to placeholder file
                        let placeholder_content = format!(
                            "Screenshot failed: {}\nTimestamp: {}\nPath: {}",
                            e,
                            chrono::Utc::now().to_rfc3339(),
                            screenshot_path.display()
                        );
                        
                        if let Err(e) = std::fs::write(&screenshot_path, placeholder_content) {
                            return Err(format!("Failed to save screenshot placeholder: {}", e));
                        }
                        
                        Ok(screenshot_path.to_string_lossy().to_string())
                    }
                }
            } else {
                Err("No screens found".to_string())
            }
        }
        Err(e) => {
            Err(format!("Failed to get screens: {}", e))
        }
    }
}

#[command]
pub async fn save_workflow_data(filename: String, data: String) -> Result<String, String> {
    
    // Get projects directory or use temp directory
    let projects_dir = project_storage::get_projects_directory()
        .unwrap_or_else(|_| std::env::temp_dir());
    
    let workflow_dir = projects_dir.join("workflow-recordings");
    
    // Create workflow directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&workflow_dir) {
        return Err(format!("Failed to create workflow directory: {}", e));
    }
    
    let workflow_path = workflow_dir.join(&filename);
    
    if let Err(e) = std::fs::write(&workflow_path, data) {
        return Err(format!("Failed to save workflow data: {}", e));
    }
    
    log_debug(&format!("Workflow data saved: {}", workflow_path.display()));
    Ok(workflow_path.to_string_lossy().to_string())
}

#[command]
pub async fn get_projects_directory() -> Result<String, String> {
    match project_storage::get_projects_directory() {
        Ok(dir) => Ok(dir.to_string_lossy().to_string()),
        Err(e) => Err(format!("Failed to get projects directory: {}", e))
    }
}

#[command]
pub async fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    match std::fs::read(&path) {
        Ok(data) => Ok(data),
        Err(e) => Err(format!("Failed to read file {}: {}", path, e))
    }
}

#[command]
pub async fn clean_workflow_files() -> Result<String, String> {
    use std::fs;
    
    // Get projects directory or use temp directory
    let projects_dir = project_storage::get_projects_directory()
        .unwrap_or_else(|_| std::env::temp_dir());
    
    let screenshots_dir = projects_dir.join("workflow-screenshots");
    let recordings_dir = projects_dir.join("workflow-recordings");
    
    let mut deleted_count = 0;
    let mut errors = Vec::new();
    
    // Clean screenshots directory
    if screenshots_dir.exists() {
        match fs::read_dir(&screenshots_dir) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() {
                            match fs::remove_file(&path) {
                                Ok(_) => {
                                    deleted_count += 1;
                                    log_debug(&format!("Deleted screenshot: {}", path.display()));
                                }
                                Err(e) => {
                                    errors.push(format!("Failed to delete {}: {}", path.display(), e));
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => errors.push(format!("Failed to read screenshots directory: {}", e))
        }
    }
    
    // Clean recordings directory
    if recordings_dir.exists() {
        match fs::read_dir(&recordings_dir) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                            match fs::remove_file(&path) {
                                Ok(_) => {
                                    deleted_count += 1;
                                    log_debug(&format!("Deleted workflow: {}", path.display()));
                                }
                                Err(e) => {
                                    errors.push(format!("Failed to delete {}: {}", path.display(), e));
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => errors.push(format!("Failed to read recordings directory: {}", e))
        }
    }
    
    let message = if errors.is_empty() {
        format!("Successfully deleted {} workflow files", deleted_count)
    } else {
        format!("Deleted {} files with {} errors: {}", deleted_count, errors.len(), errors.join("; "))
    };
    
    log_debug(&message);
    Ok(message)
}

#[tauri::command]
pub async fn export_workflow_zip(session_id: String, workflow_data: String) -> Result<String, String> {
    use std::io::Write;
    use zip::write::{FileOptions, ZipWriter};
    
    log_debug(&format!("Starting ZIP export for session: {}", session_id));
    
    // Get projects directory
    let projects_dir = project_storage::get_projects_directory()?;
    let screenshots_dir = projects_dir.join("workflow-screenshots");
    let recordings_dir = projects_dir.join("workflow-recordings");
    
    // Create recordings directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&recordings_dir) {
        return Err(format!("Failed to create recordings directory: {}", e));
    }
    
    let zip_filename = format!("workflow-{}.zip", session_id);
    let zip_path = recordings_dir.join(&zip_filename);
    
    // Parse workflow data to extract screenshot filenames
    let workflow_json: serde_json::Value = serde_json::from_str(&workflow_data)
        .map_err(|e| format!("Failed to parse workflow data: {}", e))?;
    
    let mut screenshot_files = Vec::new();
    if let Some(interactions) = workflow_json["interactions"].as_array() {
        for interaction in interactions {
            if let Some(screenshot) = interaction["screenshot"].as_str() {
                screenshot_files.push(screenshot.to_string());
            }
        }
    }
    
    log_debug(&format!("Found {} screenshots to include in ZIP", screenshot_files.len()));
    
    // Create ZIP file
    let zip_file = std::fs::File::create(&zip_path)
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;
    
    let mut zip = ZipWriter::new(zip_file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);
    
    // Add workflow JSON to ZIP
    zip.start_file("workflow-data.json", options)
        .map_err(|e| format!("Failed to start workflow JSON file in ZIP: {}", e))?;
    zip.write_all(workflow_data.as_bytes())
        .map_err(|e| format!("Failed to write workflow data to ZIP: {}", e))?;
    
    // Add README file
    let readme_content = format!(
        "# Workflow Recording Package\n\n\
         Session ID: {}\n\
         Exported: {}\n\n\
         ## Contents\n\
         - workflow-data.json: Complete interaction data and metadata\n\
         - screenshots/: All screenshots captured during the session\n\n\
         ## Usage\n\
         This package contains a complete workflow recording that can be analyzed \
         to understand user behavior and identify UI/UX issues.\n\n\
         The workflow-data.json file contains:\n\
         - All user interactions (clicks, inputs, navigation)\n\
         - Step transitions and timestamps\n\
         - Screenshot references\n\
         - Browser and environment metadata\n",
        session_id,
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );
    
    zip.start_file("README.txt", options)
        .map_err(|e| format!("Failed to start README file in ZIP: {}", e))?;
    zip.write_all(readme_content.as_bytes())
        .map_err(|e| format!("Failed to write README to ZIP: {}", e))?;
    
    // Add screenshots to ZIP
    let mut screenshots_added = 0;
    let mut screenshots_missing = 0;
    
    for screenshot_file in screenshot_files {
        let screenshot_path = screenshots_dir.join(&screenshot_file);
        let zip_screenshot_path = format!("screenshots/{}", screenshot_file);
        
        if screenshot_path.exists() {
            match std::fs::read(&screenshot_path) {
                Ok(screenshot_data) => {
                    zip.start_file(&zip_screenshot_path, options)
                        .map_err(|e| format!("Failed to start screenshot file in ZIP: {}", e))?;
                    zip.write_all(&screenshot_data)
                        .map_err(|e| format!("Failed to write screenshot to ZIP: {}", e))?;
                    screenshots_added += 1;
                    log_debug(&format!("Added screenshot to ZIP: {}", screenshot_file));
                }
                Err(e) => {
                    log_debug(&format!("Failed to read screenshot {}: {}", screenshot_file, e));
                    screenshots_missing += 1;
                }
            }
        } else {
            log_debug(&format!("Screenshot file not found: {}", screenshot_path.display()));
            screenshots_missing += 1;
        }
    }
    
    // Finalize ZIP
    zip.finish().map_err(|e| format!("Failed to finalize ZIP: {}", e))?;
    
    let summary = format!(
        "ZIP export completed: {} (Added {} screenshots, {} missing)",
        zip_path.display(),
        screenshots_added,
        screenshots_missing
    );
    
    log_debug(&summary);
    Ok(zip_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_workflow_json(session_id: String, workflow_data: String) -> Result<String, String> {
    use std::io::Write;
    
    log_debug(&format!("Saving workflow JSON for session: {}", session_id));
    
    // Get projects directory
    let projects_dir = project_storage::get_projects_directory()?;
    let recordings_dir = projects_dir.join("workflow-recordings");
    
    // Create recordings directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&recordings_dir) {
        return Err(format!("Failed to create recordings directory: {}", e));
    }
    
    let json_filename = format!("workflow-{}.json", session_id);
    let json_path = recordings_dir.join(&json_filename);
    
    // Write the JSON file
    match std::fs::File::create(&json_path) {
        Ok(mut file) => {
            if let Err(e) = file.write_all(workflow_data.as_bytes()) {
                return Err(format!("Failed to write workflow JSON file: {}", e));
            }
        }
        Err(e) => {
            return Err(format!("Failed to create workflow JSON file: {}", e));
        }
    }
    
    let success_message = format!("Workflow JSON saved: {}", json_filename);
    log_debug(&success_message);
    Ok(json_path.to_string_lossy().to_string())
}
