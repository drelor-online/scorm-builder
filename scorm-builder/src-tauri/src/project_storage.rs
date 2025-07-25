use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectFile {
    pub project: ProjectMetadata,
    pub course_data: CourseData,
    pub ai_prompt: Option<AiPromptData>,
    pub course_content: Option<serde_json::Value>,
    pub media: MediaData,
    pub audio_settings: AudioSettings,
    pub scorm_config: ScormConfig,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base64_data: Option<String>, // Now optional for backward compatibility
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relative_path: Option<String>, // New field for file-based storage
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
    
    // Create directory if it doesn't exist
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }
    
    Ok(projects_dir)
}

/// Save a project file to disk
pub fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<(), String> {
    // Update last modified timestamp
    let mut project = project.clone();
    project.project.last_modified = Utc::now();
    
    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    
    // Create parent directory if needed
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Write to file
    let mut file = fs::File::create(file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

/// Load a project file from disk
pub fn load_project_file(file_path: &Path) -> Result<ProjectFile, String> {
    if !file_path.exists() {
        return Err(format!("Project file not found: {}", file_path.display()));
    }
    
    let contents = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let project: ProjectFile = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;
    
    Ok(project)
}

/// List all project files in the projects directory
pub fn list_project_files() -> Result<Vec<PathBuf>, String> {
    let projects_dir = get_projects_directory()?;
    
    let mut project_files = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("scormproj") {
                project_files.push(path);
            }
        }
    }
    
    // Sort by modification time (newest first)
    project_files.sort_by(|a, b| {
        let a_time = fs::metadata(a).and_then(|m| m.modified()).ok();
        let b_time = fs::metadata(b).and_then(|m| m.modified()).ok();
        b_time.cmp(&a_time)
    });
    
    Ok(project_files)
}

/// Delete a project file, its backup, and associated project folder
pub fn delete_project_file(file_path: &Path) -> Result<(), String> {
    if !file_path.exists() {
        return Err(format!("Project file not found: {}", file_path.display()));
    }
    
    // Try to load the project to get its ID for folder deletion
    let project_id = match load_project_file(file_path) {
        Ok(project) => Some(project.project.id),
        Err(_) => None
    };
    
    // Delete the main project file
    fs::remove_file(file_path)
        .map_err(|e| format!("Failed to delete project file: {}", e))?;
    
    // Delete the backup file if it exists
    let backup_path = file_path.with_extension("scormproj.backup");
    if backup_path.exists() {
        fs::remove_file(&backup_path)
            .map_err(|e| format!("Failed to delete backup file: {}", e))?;
    }
    
    // Delete the project folder if it exists
    // First try with the project ID (UUID-based folder)
    if let Some(id) = project_id {
        if let Ok(projects_dir) = get_projects_directory() {
            let uuid_folder = projects_dir.join(&id);
            if uuid_folder.exists() && uuid_folder.is_dir() {
                fs::remove_dir_all(&uuid_folder)
                    .map_err(|e| format!("Failed to delete project UUID folder: {}", e))?;
            }
        }
    }
    
    // Also try with the file stem (legacy folder naming)
    if let Some(file_stem) = file_path.file_stem() {
        if let Some(parent) = file_path.parent() {
            let project_folder = parent.join(file_stem);
            if project_folder.exists() && project_folder.is_dir() {
                fs::remove_dir_all(&project_folder)
                    .map_err(|e| format!("Failed to delete project folder: {}", e))?;
            }
        }
    }
    
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
        }
    }

    #[test]
    fn test_save_and_load_project_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_project.scormproj");
        
        let project = create_test_project();
        
        // Save project
        save_project_file(&project, &file_path).unwrap();
        assert!(file_path.exists());
        
        // Load project
        let loaded_project = load_project_file(&file_path).unwrap();
        assert_eq!(loaded_project.project.name, project.project.name);
        assert_eq!(loaded_project.course_data.title, project.course_data.title);
    }

    #[test]
    fn test_project_file_includes_all_data() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("complete_project.scormproj");
        
        let mut project = create_test_project();
        
        // Add AI prompt
        project.ai_prompt = Some(AiPromptData {
            prompt: "Test prompt".to_string(),
            generated_at: Utc::now(),
        });
        
        // Add media
        project.media.images.push(MediaItem {
            id: "img_123".to_string(),
            filename: "test.jpg".to_string(),
            base64_data: Some("base64encodeddata".to_string()),
            relative_path: Some("media/images/test.jpg".to_string()),
            metadata: None,
        });
        
        project.media.videos.push(VideoItem {
            id: "vid_123".to_string(),
            youtube_url: "https://youtube.com/watch?v=123".to_string(),
            metadata: None,
        });
        
        // Save and load
        save_project_file(&project, &file_path).unwrap();
        let loaded = load_project_file(&file_path).unwrap();
        
        // Verify all data
        assert!(loaded.ai_prompt.is_some());
        assert_eq!(loaded.media.images.len(), 1);
        assert_eq!(loaded.media.videos.len(), 1);
        assert_eq!(loaded.media.videos[0].youtube_url, "https://youtube.com/watch?v=123");
    }

    #[test]
    fn test_list_project_files() {
        let temp_dir = TempDir::new().unwrap();
        
        // Create multiple project files
        for i in 0..3 {
            let mut project = create_test_project();
            project.project.name = format!("Project {}", i);
            let file_path = temp_dir.path().join(format!("project_{}.scormproj", i));
            save_project_file(&project, &file_path).unwrap();
        }
        
        // Also create a non-project file
        fs::write(temp_dir.path().join("other.txt"), "test").unwrap();
        
        // Mock the projects directory for testing
        // In real implementation, we'd need to mock get_projects_directory()
        // For now, we'll test the filtering logic separately
    }

    #[test]
    fn test_delete_project_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("delete_test.scormproj");
        let backup_path = temp_dir.path().join("delete_test.scormproj.backup");
        let project_folder = temp_dir.path().join("delete_test");
        
        let mut project = create_test_project();
        // Set a specific ID for testing UUID folder deletion
        project.project.id = "test-uuid-123".to_string();
        save_project_file(&project, &file_path).unwrap();
        assert!(file_path.exists());
        
        // Create a backup file and project folders to test deletion
        fs::write(&backup_path, "backup content").unwrap();
        fs::create_dir(&project_folder).unwrap();
        fs::write(project_folder.join("test.txt"), "test content").unwrap();
        
        // Also create UUID-based folder to simulate media storage
        let uuid_folder = temp_dir.path().join("test-uuid-123");
        fs::create_dir(&uuid_folder).unwrap();
        fs::write(uuid_folder.join("media.png"), "media content").unwrap();
        
        assert!(backup_path.exists());
        assert!(project_folder.exists());
        assert!(uuid_folder.exists());
        
        delete_project_file(&file_path).unwrap();
        
        // Verify all are deleted
        assert!(!file_path.exists());
        assert!(!backup_path.exists());
        assert!(!project_folder.exists());
        assert!(!uuid_folder.exists());
    }

    #[test]
    fn test_load_nonexistent_file_returns_error() {
        let result = load_project_file(Path::new("nonexistent.scormproj"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_delete_nonexistent_file_returns_error() {
        let result = delete_project_file(Path::new("nonexistent.scormproj"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }
}