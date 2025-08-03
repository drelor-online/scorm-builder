use tauri::command;
use super::project_storage::{self, ProjectFile};
use super::scorm::generator::{GenerateScormRequest, ScormGenerationResult};
use super::settings;
use std::path::PathBuf;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaFile {
    pub filename: String,
    pub content: Vec<u8>,
}

#[command]
pub fn get_projects_dir() -> Result<String, String> {
    project_storage::get_projects_directory()
        .map(|path| path.to_string_lossy().to_string())
}

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
    fs::create_dir_all(&project_folder)
        .map_err(|e| format!("Failed to create project folder: {}", e))?;
    
    // Create media folder
    let media_folder = project_folder.join("media");
    fs::create_dir_all(&media_folder)
        .map_err(|e| format!("Failed to create media folder: {}", e))?;
    
    // Create project file path
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let project_file_name = format!("{}_{}.scormproj", safe_name, project_id);
    let project_file_path = projects_dir.join(&project_file_name);
    
    // Create project data
    let project_metadata = project_storage::ProjectMetadata {
        id: project_id.clone(),
        name: name.clone(),
        created: Utc::now(),
        last_modified: Utc::now(),
        path: Some(project_file_path.to_string_lossy().to_string()),
    };
    
    let project_file = ProjectFile {
        project: project_metadata.clone(),
        course_data: project_storage::CourseData {
            title: name,
            difficulty: 1,
            template: "default".to_string(),
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
    };
    
    // Save project file
    project_storage::save_project_file(&project_file, &project_file_path)?;
    
    Ok(project_metadata)
}

#[command]
pub fn save_project(file_path: String, project_data: ProjectFile) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    project_storage::save_project_file(&project_data, &path)
}

#[command]
pub fn load_project(file_path: String) -> Result<ProjectFile, String> {
    let path = PathBuf::from(file_path);
    project_storage::load_project_file(&path)
}

#[command]
pub fn list_projects() -> Result<Vec<project_storage::ProjectMetadata>, String> {
    let project_files = project_storage::list_project_files()?;
    let mut projects = Vec::new();
    for path in project_files {
        if let Ok(project_file) = project_storage::load_project_file(&path) {
            // Return only the metadata with the file path included
            let mut metadata = project_file.project.clone();
            metadata.path = Some(path.to_string_lossy().to_string());
            projects.push(metadata);
        }
    }
    Ok(projects)
}

#[command]
pub fn delete_project(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    project_storage::delete_project_file(&path)
}

#[command]
pub async fn generate_scorm(request: GenerateScormRequest) -> Result<ScormGenerationResult, String> {
    crate::scorm::generator::generate_scorm_package(request).await
}

#[command]
pub async fn generate_scorm_enhanced(
    course_data: serde_json::Value,
    project_id: String,
    media_files: Option<Vec<MediaFile>>,
) -> Result<Vec<u8>, String> {
    use crate::scorm::generator_enhanced::{EnhancedScormGenerator, GenerateScormRequest as EnhancedRequest};
    
    // Debug: Log the incoming course data
    eprintln!("[generate_scorm_enhanced] Received course data with topics: {}", 
        course_data.get("topics").and_then(|t| t.as_array()).map(|a| a.len()).unwrap_or(0));
    
    // Convert the course data to our enhanced request format
    let enhanced_request: EnhancedRequest = serde_json::from_value(course_data.clone())
        .map_err(|e| {
            eprintln!("[generate_scorm_enhanced] Failed to parse course data: {}", e);
            eprintln!("[generate_scorm_enhanced] Course data structure: {}", serde_json::to_string_pretty(&course_data).unwrap_or_default());
            format!("Failed to parse course data: {}", e)
        })?;
    
    // Debug: Log knowledge check data
    eprintln!("[generate_scorm_enhanced] Enhanced request has {} topics", enhanced_request.topics.len());
    for (i, topic) in enhanced_request.topics.iter().enumerate() {
        if let Some(kc) = &topic.knowledge_check {
            eprintln!("[generate_scorm_enhanced] Topic {} has knowledge check with {} questions", i, kc.questions.len());
            for (j, q) in kc.questions.iter().enumerate() {
                eprintln!("[generate_scorm_enhanced]   Question {}: type={}, text={}", j, q.question_type, q.text);
            }
        }
    }
    
    // Use provided media files or load from disk
    let media_files_map = if let Some(files) = media_files {
        eprintln!("[generate_scorm_enhanced] Received {} media files from TypeScript", files.len());
        // Convert Vec<MediaFile> to HashMap<String, Vec<u8>>
        let mut map = HashMap::new();
        for file in files {
            // Ensure media files are prefixed with media/ directory
            let path = if file.filename.starts_with("media/") {
                file.filename.clone()
            } else {
                format!("media/{}", file.filename)
            };
            eprintln!("[generate_scorm_enhanced] Adding media file: {} (size: {} bytes)", path, file.content.len());
            map.insert(path, file.content);
        }
        map
    } else {
        // Fallback to loading from disk
        load_project_media_files(&project_id).await?
    };
    
    // Create the generator inside async context
    let generator = EnhancedScormGenerator::new()?;
    
    // Generate the SCORM package (synchronous)
    Ok(generator.generate_scorm_package(enhanced_request, media_files_map)?)
}

async fn load_project_media_files(project_id: &str) -> Result<HashMap<String, Vec<u8>>, String> {
    use tokio::fs;
    
    let mut media_files = HashMap::new();
    
    // Get the media directory path
    let base_path = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?
        .join("SCORM Projects")
        .join(project_id)
        .join("media");
    
    if base_path.exists() {
        let mut entries = fs::read_dir(&base_path).await
            .map_err(|e| format!("Failed to read media directory: {}", e))?;
        
        while let Some(entry) = entries.next_entry().await
            .map_err(|e| format!("Failed to read directory entry: {}", e))? {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .ok_or_else(|| "Invalid file name".to_string())?;
                
                let content = fs::read(&path).await
                    .map_err(|e| format!("Failed to read file {}: {}", file_name, e))?;
                
                media_files.insert(format!("media/{}", file_name), content);
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
