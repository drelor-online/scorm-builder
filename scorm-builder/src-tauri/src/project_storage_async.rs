use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectFile {
    pub version: String,
    pub project: ProjectMetadata,
    pub course_data: CourseData,
    pub ai_prompt: Option<AiPromptData>,
    pub course_content: Option<serde_json::Value>,
    pub media: MediaData,
    pub audio_settings: AudioSettings,
    pub scorm_config: ScormConfig,
    // New fields for complete data persistence
    #[serde(skip_serializing_if = "Option::is_none")]
    pub course_seed_data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub json_import_data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activities_data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_enhancements: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_edits: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_step: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectMetadata {
    pub id: String,
    pub name: String,
    pub created: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseData {
    pub title: String,
    pub difficulty: u8,
    pub template: String,
    pub topics: Vec<String>,
    pub custom_topics: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiPromptData {
    pub prompt: String,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaData {
    pub images: Vec<MediaItem>,
    pub videos: Vec<VideoItem>,
    pub audio: Vec<MediaItem>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub captions: Vec<MediaItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaItem {
    pub id: String,
    pub filename: String,
    pub base64_data: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoItem {
    pub id: String,
    pub youtube_url: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioSettings {
    pub voice: String,
    pub speed: f32,
    pub pitch: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScormConfig {
    pub version: String,
    pub completion_criteria: String,
    pub passing_score: u8,
}

/// Get the default projects directory for the current platform
pub fn get_projects_directory() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Unable to find home directory".to_string())?;
    
    let projects_dir = home_dir.join("Documents").join("SCORM Projects");
    
    // Create directory if it doesn't exist (using blocking I/O for initialization)
    if !projects_dir.exists() {
        std::fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }
    
    Ok(projects_dir)
}

/// Save a project file to disk (async version)
pub async fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<(), String> {
    // Update last modified timestamp
    let mut project = project.clone();
    project.project.last_modified = Utc::now();
    
    // Validate project data
    validate_project_data(&project)?;
    
    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    
    // Create parent directory if needed
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Create a temporary file first
    let temp_path = file_path.with_extension("tmp");
    
    // Write to temporary file
    let mut file = fs::File::create(&temp_path).await
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;
    
    file.write_all(json.as_bytes()).await
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    file.sync_all().await
        .map_err(|e| format!("Failed to sync file: {}", e))?;
    
    // Atomically rename temp file to final path
    fs::rename(&temp_path, file_path).await
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    Ok(())
}

/// Load a project file from disk (async version)
pub async fn load_project_file(file_path: &Path) -> Result<ProjectFile, String> {
    if !file_path.exists() {
        return Err(format!("Project file not found: {}", file_path.display()));
    }
    
    let contents = fs::read_to_string(file_path).await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let project: ProjectFile = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;
    
    // Validate loaded data
    validate_project_data(&project)?;
    
    Ok(project)
}

/// Validate project data for security and integrity
fn validate_project_data(project: &ProjectFile) -> Result<(), String> {
    // Check version
    if project.version.is_empty() {
        return Err("Invalid project: missing version".to_string());
    }
    
    // Check project metadata
    if project.project.id.is_empty() || project.project.name.is_empty() {
        return Err("Invalid project: missing ID or name".to_string());
    }
    
    // Check for excessively large data
    let json_size = serde_json::to_string(&project)
        .map(|s| s.len())
        .unwrap_or(0);
    
    const MAX_PROJECT_SIZE: usize = 100 * 1024 * 1024; // 100MB
    if json_size > MAX_PROJECT_SIZE {
        return Err(format!("Project too large: {} bytes (max 100MB)", json_size));
    }
    
    // Validate media items
    for image in &project.media.images {
        if image.base64_data.len() > 20 * 1024 * 1024 { // 20MB per image
            return Err(format!("Image {} too large", image.id));
        }
    }
    
    for audio in &project.media.audio {
        if audio.base64_data.len() > 50 * 1024 * 1024 { // 50MB per audio
            return Err(format!("Audio {} too large", audio.id));
        }
    }
    
    Ok(())
}

/// List all project files in the projects directory
pub fn list_project_files() -> Result<Vec<PathBuf>, String> {
    let projects_dir = get_projects_directory()?;
    
    let mut project_files = Vec::new();
    
    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("scormproj") {
                project_files.push(path);
            }
        }
    }
    
    // Sort by modification time (newest first)
    project_files.sort_by(|a, b| {
        let a_time = std::fs::metadata(a).and_then(|m| m.modified()).ok();
        let b_time = std::fs::metadata(b).and_then(|m| m.modified()).ok();
        b_time.cmp(&a_time)
    });
    
    Ok(project_files)
}

/// Delete a project file
pub fn delete_project_file(file_path: &Path) -> Result<(), String> {
    if !file_path.exists() {
        return Err(format!("Project file not found: {}", file_path.display()));
    }
    
    // Create a backup before deleting
    let backup_path = file_path.with_extension("scormproj.bak");
    std::fs::copy(file_path, &backup_path)
        .map_err(|e| format!("Failed to create backup: {}", e))?;
    
    std::fs::remove_file(file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use uuid::Uuid;

    fn create_test_project() -> ProjectFile {
        ProjectFile {
            version: "1.0".to_string(),
            project: ProjectMetadata {
                id: format!("project_{}", Uuid::new_v4()),
                name: "Test Project".to_string(),
                created: Utc::now(),
                last_modified: Utc::now(),
            },
            course_data: CourseData {
                title: "Test Course".to_string(),
                difficulty: 3,
                template: "standard".to_string(),
                topics: vec!["Topic 1".to_string(), "Topic 2".to_string()],
                custom_topics: None,
            },
            ai_prompt: None,
            course_content: None,
            media: MediaData {
                images: vec![],
                videos: vec![],
                audio: vec![],
                captions: vec![],
            },
            audio_settings: AudioSettings {
                voice: "en-US-JennyNeural".to_string(),
                speed: 1.0,
                pitch: 1.0,
            },
            scorm_config: ScormConfig {
                version: "2004".to_string(),
                completion_criteria: "all_pages".to_string(),
                passing_score: 80,
            },
            // Initialize new fields
            course_seed_data: None,
            json_import_data: None,
            activities_data: None,
            media_enhancements: None,
            content_edits: None,
            current_step: None,
        }
    }

    #[tokio::test]
    async fn test_save_and_load_project_file_async() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_project.scormproj");
        
        let project = create_test_project();
        
        // Save project
        save_project_file(&project, &file_path).await.unwrap();
        assert!(file_path.exists());
        
        // Load project
        let loaded_project = load_project_file(&file_path).await.unwrap();
        assert_eq!(loaded_project.project.name, project.project.name);
        assert_eq!(loaded_project.course_data.title, project.course_data.title);
    }

    #[test]
    fn test_validate_project_data() {
        let mut project = create_test_project();
        
        // Valid project should pass
        assert!(validate_project_data(&project).is_ok());
        
        // Empty ID should fail
        project.project.id = "".to_string();
        assert!(validate_project_data(&project).is_err());
        
        // Restore ID
        project.project.id = "test_id".to_string();
        
        // Large image should fail
        project.media.images.push(MediaItem {
            id: "large_image".to_string(),
            filename: "large.jpg".to_string(),
            base64_data: "x".repeat(25 * 1024 * 1024), // 25MB
            metadata: None,
        });
        assert!(validate_project_data(&project).is_err());
    }
}