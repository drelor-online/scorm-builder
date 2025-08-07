use crate::scorm::{manifest, package};
use crate::project_storage::{
    ProjectFile, ProjectMetadata,
    save_project_file, load_project_file, list_project_files, delete_project_file, get_projects_directory
};
use crate::api_keys::{ApiKeys, save_api_keys as save_keys, load_api_keys as load_keys, delete_api_keys as delete_keys};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use url::Url;
use std::net::IpAddr;
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;

// Simple file logger for debugging
pub fn log_debug(message: &str) {
    let log_dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".scorm-builder")
        .join("logs");
    
    let _ = std::fs::create_dir_all(&log_dir);
    
    let log_file = log_dir.join(format!("rust-debug-{}.log", Local::now().format("%Y-%m-%d")));
    
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file)
    {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let _ = writeln!(file, "[{}] {}", timestamp, message);
    }
}

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

/// Validates that a path is within the allowed projects directory
fn validate_project_path(file_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(file_path);
    let projects_dir = get_projects_directory()?;
    
    // Get the parent directory of the file
    let file_parent = path.parent()
        .ok_or_else(|| "Invalid file path: no parent directory".to_string())?;
    
    // Canonicalize both paths (this resolves any .. or . components)
    let canonical_parent = file_parent.canonicalize()
        .or_else(|_| {
            // If the parent doesn't exist yet, check if it would be within projects dir
            if file_parent.starts_with(&projects_dir) {
                Ok(file_parent.to_path_buf())
            } else {
                Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Invalid path"))
            }
        })
        .map_err(|e| format!("Invalid path: {}", e))?;
    
    let canonical_projects_dir = projects_dir.canonicalize()
        .map_err(|e| format!("Failed to resolve projects directory: {}", e))?;
    
    // Ensure the path is within the projects directory
    if !canonical_parent.starts_with(&canonical_projects_dir) {
        return Err("Access denied: Path is outside projects directory".to_string());
    }
    
    // Ensure it's a .scormproj file
    if path.extension().and_then(|s| s.to_str()) != Some("scormproj") {
        return Err("Invalid file type: Only .scormproj files are allowed".to_string());
    }
    
    // Return the original path if validation passes
    Ok(path)
}

/// List of allowed image domains
const ALLOWED_IMAGE_DOMAINS: &[&str] = &[
    "images.unsplash.com",
    "i.imgur.com",
    "upload.wikimedia.org",
    "cdn.pixabay.com",
    "pexels.com",
    "cdn.pexels.com",
    "images.pexels.com",
];

/// Validates URL for image download
fn validate_image_url(url_str: &str) -> Result<Url, String> {
    let url = Url::parse(url_str)
        .map_err(|_| "Invalid URL format")?;
    
    // Only allow HTTPS
    if url.scheme() != "https" {
        return Err("Only HTTPS URLs are allowed".to_string());
    }
    
    // Check domain whitelist
    let host = url.host_str()
        .ok_or("Invalid URL: No host found")?;
    
    let is_allowed = ALLOWED_IMAGE_DOMAINS.iter().any(|&domain| {
        host == domain || host.ends_with(&format!(".{}", domain))
    });
    
    if !is_allowed {
        return Err(format!("Domain '{}' is not in the allowed list. Allowed domains: {:?}", host, ALLOWED_IMAGE_DOMAINS));
    }
    
    // Block private IP ranges
    if let Ok(ip) = host.parse::<IpAddr>() {
        if ip.is_loopback() {
            return Err("Access to loopback addresses is not allowed".to_string());
        }
        
        // Check for private IP ranges manually
        match ip {
            IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                // Check for private IPv4 ranges
                if (octets[0] == 10) || // 10.0.0.0/8
                   (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0/12
                   (octets[0] == 192 && octets[1] == 168) || // 192.168.0.0/16
                   (octets[0] == 169 && octets[1] == 254) // 169.254.0.0/16 (link-local)
                {
                    return Err("Access to private IP addresses is not allowed".to_string());
                }
            }
            IpAddr::V6(ipv6) => {
                // Check for IPv6 private/link-local ranges
                if ipv6.segments()[0] & 0xfe00 == 0xfc00 || // Unique local addresses
                   ipv6.segments()[0] & 0xffc0 == 0xfe80    // Link-local addresses
                {
                    return Err("Access to private IP addresses is not allowed".to_string());
                }
            }
        }
    }
    
    Ok(url)
}

#[tauri::command]
pub async fn generate_scorm_manifest(request: GenerateManifestRequest) -> Result<String, String> {
    // Validate inputs
    if request.course_title.is_empty() {
        return Err("Course title cannot be empty".to_string());
    }
    
    if request.course_title.len() > 200 {
        return Err("Course title too long (max 200 characters)".to_string());
    }
    
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
    // Validate output path
    let output_path = validate_package_output_path(&request.output_path)?;
    
    // Validate manifest XML size (max 1MB)
    if request.manifest_xml.len() > 1024 * 1024 {
        return Err("Manifest XML too large (max 1MB)".to_string());
    }
    
    // Validate HTML content size (max 10MB)
    if request.html_content.len() > 10 * 1024 * 1024 {
        return Err("HTML content too large (max 10MB)".to_string());
    }
    
    let content = package::PackageContent {
        manifest: request.manifest_xml,
        html_content: request.html_content,
        resources: request.resources,
    };
    
    package::create_scorm_package(&content, &output_path)?;
    
    Ok(format!("SCORM package created successfully at: {}", output_path.display()))
}

fn validate_package_output_path(path_str: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path_str);
    
    // Ensure it ends with .zip
    if path.extension().and_then(|s| s.to_str()) != Some("zip") {
        return Err("Output path must end with .zip".to_string());
    }
    
    // For now, allow any path for package output as users may want to save anywhere
    // In production, you might want to restrict this further
    Ok(path)
}

// Project Storage Commands with Security

#[tauri::command]
pub async fn save_project(project_data: ProjectFile, file_path: String) -> Result<(), String> {
    log_debug(&format!("save_project called with path: {}", file_path));
    
    // Log what we're saving
    if let Some(ref seed_data) = project_data.course_seed_data {
        log_debug(&format!("Saving project with course_seed_data: {}", seed_data));
    } else {
        log_debug("Saving project WITHOUT course_seed_data");
    }
    
    let path = validate_project_path(&file_path)?;
    save_project_file(&project_data, &path)?;
    
    log_debug("Project saved successfully");
    Ok(())
}

#[tauri::command]
pub async fn load_project(file_path: String) -> Result<ProjectFile, String> {
    log_debug(&format!("load_project called with path: {}", file_path));
    
    let path = validate_project_path(&file_path)?;
    let project = load_project_file(&path)?;
    
    // Log what we're loading
    if let Some(ref seed_data) = project.course_seed_data {
        log_debug(&format!("Loaded project with course_seed_data: {}", seed_data));
    } else {
        log_debug("Loaded project WITHOUT course_seed_data");
    }
    
    log_debug(&format!("Project title from course_data: '{}'", project.course_data.title));
    
    Ok(project)
}

#[tauri::command]
pub async fn list_projects() -> Result<Vec<ProjectMetadata>, String> {
    log_debug("list_projects called");
    
    let files = list_project_files()?;
    let mut projects = Vec::new();
    
    for path in files {
        log_debug(&format!("Processing project file: {}", path.display()));
        
        match load_project_file(&path) {
            Ok(project_file) => {
                // Return only the metadata with the file path included
                let mut metadata = project_file.project.clone();
                metadata.path = Some(path.to_string_lossy().to_string());
                
                log_debug(&format!("Loaded project: id={}, name='{}', path='{}'", 
                    metadata.id, metadata.name, metadata.path.as_ref().unwrap_or(&String::from("unknown"))));
                
                projects.push(metadata);
            }
            Err(e) => {
                log_debug(&format!("Failed to load project file '{}': {}", path.display(), e));
                // Continue processing other files even if one fails
            }
        }
    }
    
    log_debug(&format!("Returning {} projects", projects.len()));
    Ok(projects)
}

#[tauri::command]
pub async fn delete_project(file_path: String) -> Result<(), String> {
    let path = validate_project_path(&file_path)?;
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
    
    // Limit log entry size to 10KB
    const MAX_LOG_ENTRY_SIZE: usize = 10_000;
    if content.len() > MAX_LOG_ENTRY_SIZE {
        return Err("Log entry too large (max 10KB)".to_string());
    }
    
    let log_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".scorm-builder")
        .join("logs");
    
    // Create logs directory if it doesn't exist
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    
    let log_file = log_dir.join(format!("debug-{}.log", Local::now().format("%Y-%m-%d")));
    
    // Check log file size (rotate if > 50MB)
    if let Ok(metadata) = std::fs::metadata(&log_file) {
        if metadata.len() > 50 * 1024 * 1024 {
            // Rotate log file
            let backup_file = log_dir.join(format!("debug-{}-old.log", Local::now().format("%Y-%m-%d")));
            std::fs::rename(&log_file, backup_file).ok();
        }
    }
    
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("Failed to open log file: {}", e))?;
    
    writeln!(file, "[{}] {}", Local::now().format("%Y-%m-%d %H:%M:%S"), content)
        .map_err(|e| format!("Failed to write to log file: {}", e))?;
    
    Ok(())
}

// API Keys Commands

#[tauri::command]
pub async fn save_api_keys(api_keys: ApiKeys) -> Result<(), String> {
    save_keys(api_keys)
}

#[tauri::command]
pub async fn load_api_keys() -> Result<ApiKeys, String> {
    load_keys()
}

#[tauri::command]
pub async fn delete_api_keys() -> Result<(), String> {
    delete_keys()
}

// Image Download Command with Security

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadImageResponse {
    pub base64_data: String,
    pub content_type: String,
}

#[tauri::command]
pub async fn download_image(url: String) -> Result<DownloadImageResponse, String> {
    // Validate URL first
    let validated_url = validate_image_url(&url)?;
    
    // Create a client with appropriate headers and limits
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(3)) // Limit redirects
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Download the image
    let response = client
        .get(validated_url.as_str())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;
    
    // Check status
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    // Get and verify content type
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    
    if !content_type.starts_with("image/") {
        return Err(format!("Invalid content type: {}. Only images are allowed", content_type));
    }
    
    // Check content length (max 10MB)
    const MAX_SIZE: u64 = 10 * 1024 * 1024;
    if let Some(content_length) = response.content_length() {
        if content_length > MAX_SIZE {
            return Err(format!("Image too large: {} bytes (max 10MB)", content_length));
        }
    }
    
    // Get the bytes with size limit
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image data: {}", e))?;
    
    // Double-check size after download
    if bytes.len() > MAX_SIZE as usize {
        return Err("Image too large: Maximum size is 10MB".to_string());
    }
    
    // Convert to base64
    use base64::{Engine as _, engine::general_purpose};
    let base64_data = general_purpose::STANDARD.encode(&bytes);
    
    Ok(DownloadImageResponse {
        base64_data,
        content_type,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_validate_project_path() {
        // This test would need to mock get_projects_directory()
        // For now, we'll test the validation logic separately
    }

    #[test]
    fn test_validate_image_url() {
        // Valid URLs
        assert!(validate_image_url("https://images.unsplash.com/photo.jpg").is_ok());
        assert!(validate_image_url("https://i.imgur.com/abc123.png").is_ok());
        
        // Invalid URLs
        assert!(validate_image_url("http://images.unsplash.com/photo.jpg").is_err()); // Not HTTPS
        assert!(validate_image_url("https://evil.com/photo.jpg").is_err()); // Not whitelisted
        assert!(validate_image_url("https://192.168.1.1/photo.jpg").is_err()); // Private IP
        assert!(validate_image_url("https://127.0.0.1/photo.jpg").is_err()); // Loopback
    }

    #[tokio::test]
    async fn test_log_size_limit() {
        let large_content = "x".repeat(20_000); // 20KB
        let result = append_to_log(large_content).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too large"));
    }
}