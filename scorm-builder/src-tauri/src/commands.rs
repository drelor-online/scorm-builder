use crate::scorm::{manifest, package};
use crate::project_storage::{
    ProjectFile,
    save_project_file, load_project_file, list_project_files, delete_project_file, get_projects_directory
};
use crate::api_keys::{ApiKeys, save_api_keys as save_keys, load_api_keys as load_keys, delete_api_keys as delete_keys};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateManifestRequest {
    pub course_title: String,
    pub course_identifier: String,
    pub course_description: Option<String>,
    pub course_version: String,
    pub scorm_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePackageRequest {
    pub manifest_xml: String,
    pub html_content: String,
    pub resources: Vec<package::Resource>,
    pub output_path: String,
}

#[tauri::command]
pub async fn generate_scorm_manifest(request: GenerateManifestRequest) -> Result<String, String> {
    let options = manifest::ManifestOptions {
        course: manifest::CourseMetadata {
            title: request.course_title,
            identifier: request.course_identifier,
            description: request.course_description,
            version: request.course_version,
        },
        scorm_version: request.scorm_version,
    };
    
    manifest::generate_manifest(&options)
}

#[tauri::command]
pub async fn create_scorm_package(request: CreatePackageRequest) -> Result<String, String> {
    let content = package::PackageContent {
        manifest: request.manifest_xml,
        html_content: request.html_content,
        resources: request.resources,
    };
    
    let output_path = PathBuf::from(&request.output_path);
    package::create_scorm_package(&content, &output_path)?;
    
    Ok(format!("SCORM package created successfully at: {}", request.output_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_generate_scorm_manifest_command() {
        let request = GenerateManifestRequest {
            course_title: "Test Course".to_string(),
            course_identifier: "test-001".to_string(),
            course_description: Some("A test course".to_string()),
            course_version: "1.0".to_string(),
            scorm_version: "2004".to_string(),
        };

        let result = generate_scorm_manifest(request).await;
        assert!(result.is_ok());
        
        let manifest = result.unwrap();
        assert!(manifest.contains("<?xml"));
        assert!(manifest.contains("Test Course"));
    }

    #[tokio::test]
    async fn test_create_scorm_package_command() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test-package.zip");
        
        let request = CreatePackageRequest {
            manifest_xml: "<?xml version=\"1.0\"?><manifest></manifest>".to_string(),
            html_content: "<html><body>Test Content</body></html>".to_string(),
            resources: vec![],
            output_path: output_path.to_string_lossy().to_string(),
        };

        let result = create_scorm_package(request).await;
        assert!(result.is_ok());
        assert!(output_path.exists());
    }

    #[tokio::test]
    async fn test_invalid_scorm_version_returns_error() {
        let request = GenerateManifestRequest {
            course_title: "Test".to_string(),
            course_identifier: "test".to_string(),
            course_description: None,
            course_version: "1.0".to_string(),
            scorm_version: "invalid".to_string(),
        };

        let result = generate_scorm_manifest(request).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid SCORM version"));
    }
}

// Project Storage Commands

#[tauri::command]
pub async fn save_project(project_data: ProjectFile, file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    save_project_file(&project_data, &path)
}

#[tauri::command]
pub async fn load_project(file_path: String) -> Result<ProjectFile, String> {
    let path = PathBuf::from(file_path);
    load_project_file(&path)
}

#[tauri::command]
pub async fn list_projects() -> Result<Vec<String>, String> {
    let files = list_project_files()?;
    Ok(files.into_iter()
        .filter_map(|p| p.to_str().map(String::from))
        .collect())
}

#[tauri::command]
pub async fn delete_project(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    delete_project_file(&path)
}

#[tauri::command]
pub async fn get_projects_dir() -> Result<String, String> {
    let dir = get_projects_directory()?;
    dir.to_str()
        .map(String::from)
        .ok_or_else(|| "Invalid directory path".to_string())
}

#[tauri::command]
pub fn get_cli_args() -> Vec<String> {
    std::env::args().collect()
}

#[tauri::command]
pub async fn append_to_log(content: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;
    use chrono::Local;
    
    let log_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".scorm-builder")
        .join("logs");
    
    // Create logs directory if it doesn't exist
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    
    let log_file = log_dir.join(format!("debug-{}.log", Local::now().format("%Y-%m-%d")));
    
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("Failed to open log file: {}", e))?;
    
    writeln!(file, "{}", content)
        .map_err(|e| format!("Failed to write to log file: {}", e))?;
    
    Ok(())
}

// API Keys Commands

#[tauri::command]
pub async fn save_api_keys(api_keys: ApiKeys) -> Result<(), String> {
    save_keys(&api_keys)
}

#[tauri::command]
pub async fn load_api_keys() -> Result<ApiKeys, String> {
    load_keys()
}

#[tauri::command]
pub async fn delete_api_keys() -> Result<(), String> {
    delete_keys()
}

// Image Download Command

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadImageResponse {
    pub base64_data: String,
    pub content_type: String,
}

#[tauri::command]
pub async fn download_image(url: String) -> Result<DownloadImageResponse, String> {
    // Create a client with appropriate headers
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Download the image
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;
    
    // Check status
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    // Get content type
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    
    // Get the bytes
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image data: {}", e))?;
    
    // Convert to base64
    use base64::{Engine as _, engine::general_purpose};
    let base64_data = general_purpose::STANDARD.encode(&bytes);
    
    Ok(DownloadImageResponse {
        base64_data,
        content_type,
    })
}

// File I/O Commands for FileStorage

#[tauri::command]
pub async fn write_file(project_id: String, relative_path: String, content: String) -> Result<(), String> {
    let projects_dir = get_projects_directory()
        .map_err(|e| format!("Failed to get projects directory: {}", e))?;
    
    let file_path = projects_dir.join(&project_id).join(&relative_path);
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Decode base64 content
    use base64::{Engine as _, engine::general_purpose};
    let bytes = general_purpose::STANDARD.decode(&content)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Write file
    std::fs::write(&file_path, bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn read_file(project_id: String, relative_path: String) -> Result<String, String> {
    let projects_dir = get_projects_directory()
        .map_err(|e| format!("Failed to get projects directory: {}", e))?;
    
    let file_path = projects_dir.join(&project_id).join(&relative_path);
    
    // Read file
    let bytes = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Encode to base64
    use base64::{Engine as _, engine::general_purpose};
    let base64_data = general_purpose::STANDARD.encode(&bytes);
    
    Ok(base64_data)
}