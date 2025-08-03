use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::project_storage::get_projects_directory;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaMetadata {
    pub page_id: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub source: Option<String>,
    pub embed_url: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaData {
    pub id: String,
    pub data: Vec<u8>,
    pub metadata: MediaMetadata,
}

pub fn get_media_directory(project_id: &str) -> Result<PathBuf, String> {
    let projects_dir = get_projects_directory()
        .map_err(|e| format!("Failed to get projects directory: {}", e))?;
    
    let media_dir = projects_dir.join(project_id).join("media");
    
    // Create directory if it doesn't exist
    if !media_dir.exists() {
        fs::create_dir_all(&media_dir)
            .map_err(|e| format!("Failed to create media directory: {}", e))?;
    }
    
    Ok(media_dir)
}

pub fn get_media_path(project_id: &str, media_id: &str) -> Result<PathBuf, String> {
    let media_dir = get_media_directory(project_id)?;
    Ok(media_dir.join(format!("{}.bin", media_id)))
}

pub fn get_metadata_path(project_id: &str, media_id: &str) -> Result<PathBuf, String> {
    let media_dir = get_media_directory(project_id)?;
    Ok(media_dir.join(format!("{}.json", media_id)))
}

#[tauri::command]
pub fn store_media(
    id: String,
    #[allow(non_snake_case)] projectId: String,
    data: Vec<u8>,
    metadata: MediaMetadata,
) -> Result<(), String> {
    println!("[media_storage] Storing media {} for project {}", id, projectId);
    
    // Store the binary data
    let data_path = get_media_path(&projectId, &id)?;
    fs::write(&data_path, &data)
        .map_err(|e| format!("Failed to write media data: {}", e))?;
    
    // Store the metadata
    let metadata_path = get_metadata_path(&projectId, &id)?;
    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&metadata_path, metadata_json)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;
    
    println!("[media_storage] Successfully stored media {} ({} bytes)", id, data.len());
    Ok(())
}

#[tauri::command]
pub fn get_all_project_media(#[allow(non_snake_case)] projectId: String) -> Result<Vec<MediaData>, String> {
    println!("[media_storage] Loading all media for project {}", projectId);
    
    let media_dir = get_media_directory(&projectId)?;
    let mut media_list = Vec::new();
    
    if !media_dir.exists() {
        println!("[media_storage] Media directory doesn't exist, returning empty list");
        return Ok(media_list);
    }
    
    // Read all .json files in the media directory
    let entries = fs::read_dir(&media_dir)
        .map_err(|e| format!("Failed to read media directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        // Only process .json files
        if path.extension() == Some(std::ffi::OsStr::new("json")) {
            let media_id = path.file_stem()
                .and_then(|s| s.to_str())
                .ok_or_else(|| "Invalid file name".to_string())?;
            
            // Read metadata
            let metadata_json = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read metadata for {}: {}", media_id, e))?;
            let metadata: MediaMetadata = serde_json::from_str(&metadata_json)
                .map_err(|e| format!("Failed to parse metadata for {}: {}", media_id, e))?;
            
            // Read binary data
            let data_path = get_media_path(&projectId, media_id)?;
            if data_path.exists() {
                let data = fs::read(&data_path)
                    .map_err(|e| format!("Failed to read media data for {}: {}", media_id, e))?;
                
                let data_len = data.len();
                
                media_list.push(MediaData {
                    id: media_id.to_string(),
                    data,
                    metadata,
                });
                
                println!("[media_storage] Loaded media {} ({} bytes)", media_id, data_len);
            } else {
                println!("[media_storage] Warning: metadata exists but data missing for {}", media_id);
            }
        }
    }
    
    println!("[media_storage] Loaded {} media items", media_list.len());
    Ok(media_list)
}

#[tauri::command]
pub fn delete_media(
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] mediaId: String,
) -> Result<(), String> {
    println!("[media_storage] Deleting media {} from project {}", mediaId, projectId);
    
    // Delete data file
    let data_path = get_media_path(&projectId, &mediaId)?;
    if data_path.exists() {
        fs::remove_file(&data_path)
            .map_err(|e| format!("Failed to delete media data: {}", e))?;
    }
    
    // Delete metadata file
    let metadata_path = get_metadata_path(&projectId, &mediaId)?;
    if metadata_path.exists() {
        fs::remove_file(&metadata_path)
            .map_err(|e| format!("Failed to delete metadata: {}", e))?;
    }
    
    println!("[media_storage] Successfully deleted media {}", mediaId);
    Ok(())
}

#[tauri::command]
pub fn get_media(
    #[allow(non_snake_case)] projectId: String,
    #[allow(non_snake_case)] mediaId: String,
) -> Result<MediaData, String> {
    println!("[media_storage] Getting media {} from project {}", mediaId, projectId);
    
    // Read metadata
    let metadata_path = get_metadata_path(&projectId, &mediaId)?;
    let metadata_json = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let metadata: MediaMetadata = serde_json::from_str(&metadata_json)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;
    
    // Read binary data
    let data_path = get_media_path(&projectId, &mediaId)?;
    let data = fs::read(&data_path)
        .map_err(|e| format!("Failed to read media data: {}", e))?;
    
    Ok(MediaData {
        id: mediaId,
        data,
        metadata,
    })
}