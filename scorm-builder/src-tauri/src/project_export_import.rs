use crate::media_storage::{get_media_directory, MediaData};
use crate::project_storage::{save_project_file, ProjectFile};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use tauri::Emitter;
use tempfile::TempDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};


// Debug logging for export issues
fn debug_log(message: &str) {
    println!("[DEBUG] Project Export: {}", message);
    eprintln!("[DEBUG] Project Export: {}", message);
}

/// Check if a media file is a duplicate (has -1, -2, etc. suffix)
/// Returns true for duplicates like audio-0-1.json, false for normal files like audio-1.json
fn is_duplicate_media_file(file_name: &str) -> bool {
    // Extract name without extension
    let name_without_ext = if let Some(dot_pos) = file_name.rfind('.') {
        &file_name[..dot_pos]
    } else {
        file_name
    };

    // Look for pattern: {type}-{number}-{suffix} (e.g., audio-1-1, caption-2-1)
    // ALL such patterns are invalid duplicates - no exceptions
    let parts: Vec<&str> = name_without_ext.split('-').collect();
    if parts.len() >= 3 {
        // Check if last part is a number (suffix)
        if let Ok(_suffix) = parts.last().unwrap().parse::<u32>() {
            // Any file with format like audio-1-1, caption-2-1 etc. is a duplicate
            return true;
        }
    }

    false
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipExportResult {
    pub zip_data: Vec<u8>,
    pub file_count: usize,
    pub total_size: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractedProject {
    pub project_data: ProjectFile,
    pub media_files: Vec<MediaData>,
}

/// Creates a ZIP file containing the project and its media files
#[tauri::command]
pub async fn create_project_zip(
    project_path: String,
    project_id: String,
    include_media: bool,
) -> Result<ZipExportResult, String> {

    debug_log(&format!("Starting export for project_id: {}, path: {}, include_media: {}",
                      project_id, project_path, include_media));

    // Create ZIP buffer that we'll write to
    let mut zip_buffer = Vec::new();
    let mut file_count = 0;
    let mut total_size = 0;

    debug_log(&format!("Initial buffer size: {} bytes", zip_buffer.len()));

    // Use a scope to ensure the ZipWriter is dropped before we return the buffer
    {
        let cursor = std::io::Cursor::new(&mut zip_buffer);
        let mut zip = ZipWriter::new(cursor);
        let options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o755);

        // Add the actual project file to ZIP (not parsed, just the raw file)
        let project_path_obj = Path::new(&project_path);
        if !project_path_obj.exists() {
            return Err(format!("Project file not found: {}", project_path));
        }
        
        let project_filename = project_path_obj
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "Invalid project filename".to_string())?;
        
        
        // Read the project file as-is
        let project_content = fs::read(&project_path)
            .map_err(|e| format!("Failed to read project file: {}", e))?;
        
        
        // Add to ZIP with original filename
        zip.start_file(project_filename, options)
            .map_err(|e| format!("Failed to start project file in ZIP: {}", e))?;
        zip.write_all(&project_content)
            .map_err(|e| format!("Failed to write project to ZIP: {}", e))?;
        
        
        file_count += 1;
        total_size += project_content.len();

        // Add media files if requested
        if include_media {
            debug_log(&format!("Media inclusion requested for project_id: {}", project_id));

            // Validate media page_id assignments before export
            if let Ok(validation_result) = crate::media_page_id_migration::validate_media_page_ids(project_id.clone()).await {
                if let Some(invalid_files) = validation_result.get("invalid_files").and_then(|v| v.as_u64()) {
                    if invalid_files > 0 {
                        debug_log(&format!("WARNING: Found {} media files with incorrect page_id assignments in project {}", invalid_files, project_id));
                        debug_log("Consider running migrate_media_page_ids to fix these issues before export");
                        if let Some(issues) = validation_result.get("issues").and_then(|v| v.as_array()) {
                            for issue in issues.iter().take(3) { // Show first 3 issues
                                if let Some(issue_str) = issue.as_str() {
                                    debug_log(&format!("  - {}", issue_str));
                                }
                            }
                            if issues.len() > 3 {
                                debug_log(&format!("  ... and {} more issues", issues.len() - 3));
                            }
                        }
                    }
                }
            }

            let mut effective_project_id = project_id.clone();
            let mut media_dir = get_media_directory(&effective_project_id)
                .map_err(|e| format!("Failed to get media directory: {}", e))?;

            debug_log(&format!("Media directory path: {}", media_dir.display()));
            debug_log(&format!("Media directory exists: {}", media_dir.exists()));

            // If media directory doesn't exist or is empty, try extracting project ID from filename
            let mut media_files_count = 0;
            if media_dir.exists() {
                if let Ok(entries) = fs::read_dir(&media_dir) {
                    media_files_count = entries.count();
                }
            }

            if !media_dir.exists() || media_files_count == 0 {
                debug_log(&format!("No media found with project_id: {}, trying filename-based ID", effective_project_id));

                // Try to extract project ID from filename (e.g., "Project_Name_1234567890.scormproj" -> "1234567890")
                if let Some(filename_stem) = project_path_obj.file_stem().and_then(|s| s.to_str()) {
                    // Look for a pattern like "..._1234567890" at the end of the filename
                    if let Some(last_underscore_pos) = filename_stem.rfind('_') {
                        let potential_id = &filename_stem[last_underscore_pos + 1..];
                        // Check if it looks like a project ID (all digits, reasonable length)
                        if potential_id.chars().all(|c| c.is_ascii_digit()) && potential_id.len() >= 10 {
                            debug_log(&format!("Extracted potential project ID from filename: {}", potential_id));

                            let fallback_media_dir = get_media_directory(potential_id)
                                .map_err(|e| format!("Failed to get fallback media directory: {}", e))?;

                            debug_log(&format!("Fallback media directory path: {}", fallback_media_dir.display()));
                            debug_log(&format!("Fallback media directory exists: {}", fallback_media_dir.exists()));

                            if fallback_media_dir.exists() {
                                if let Ok(entries) = fs::read_dir(&fallback_media_dir) {
                                    let fallback_count = entries.count();
                                    if fallback_count > 0 {
                                        debug_log(&format!("Found {} media files using filename-based ID, switching to: {}", fallback_count, potential_id));
                                        effective_project_id = potential_id.to_string();
                                        media_dir = fallback_media_dir;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if media_dir.exists() {
                // Read all media files
                let entries = fs::read_dir(&media_dir)
                    .map_err(|e| format!("Failed to read media directory: {}", e))?;

                let mut media_files_found = 0;
                for entry in entries {
                    let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
                    let path = entry.path();

                    debug_log(&format!("Found entry: {} (is_file: {})", path.display(), path.is_file()));

                    if path.is_file() {
                        let file_name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .ok_or_else(|| "Invalid file name".to_string())?;

                        // Read file content
                        let file_content = fs::read(&path)
                            .map_err(|e| format!("Failed to read media file {}: {}", file_name, e))?;

                        debug_log(&format!("Adding media file to ZIP: {} ({} bytes)", file_name, file_content.len()));

                        // Add to ZIP with the media folder structure (use effective project ID)
                        let zip_path = format!("{}/media/{}", effective_project_id, file_name);
                        zip.start_file(&zip_path, options)
                            .map_err(|e| format!("Failed to start media file in ZIP: {}", e))?;
                        zip.write_all(&file_content)
                            .map_err(|e| format!("Failed to write media file to ZIP: {}", e))?;

                        media_files_found += 1;
                        file_count += 1;
                        total_size += file_content.len();

                        debug_log(&format!("Successfully added media file {} to ZIP", file_name));
                    }
                }
                debug_log(&format!("Total media files added to ZIP: {} (using project_id: {})", media_files_found, effective_project_id));
            } else {
                debug_log(&format!("Media directory does not exist for both original and filename-based project IDs"));
            }
        } else {
            debug_log("Media inclusion not requested");
        }

        // Finish the ZIP - this is important to flush all data
        zip.finish()
            .map_err(|e| format!("Failed to finish ZIP: {}", e))?;
    } // End of scope
    
    Ok(ZipExportResult {
        zip_data: zip_buffer,
        file_count,
        total_size,
    })
}

/// Creates a ZIP file with progress reporting
#[tauri::command]
pub async fn create_project_zip_with_progress(
    app: tauri::AppHandle,
    project_path: String,
    project_id: String,
    include_media: bool,
) -> Result<ZipExportResult, String> {
    debug_log(&format!("Starting export with progress for project_id: {}, path: {}, include_media: {}",
                      project_id, project_path, include_media));

    // Phase 1: Preparing
    let _ = app.emit(
        "export-progress",
        serde_json::json!({
            "phase": "preparing",
            "progress": 5,
            "message": "Loading project file...",
            "filesProcessed": 0,
            "totalFiles": 0
        }),
    );

    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let mut file_count = 0;
    let mut total_size = 0;

    // Read the project file
    let project_path_obj = std::path::Path::new(&project_path);
    let project_file_name = project_path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid project file name".to_string())?;

    let project_content = std::fs::read(&project_path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;

    // Phase 2: Validating
    let _ = app.emit(
        "export-progress",
        serde_json::json!({
            "phase": "validating",
            "progress": 15,
            "message": "Validating project data...",
            "filesProcessed": 0,
            "totalFiles": 1
        }),
    );

    // Validate project content
    if project_content.is_empty() {
        return Err("Project file is empty".to_string());
    }

    // Add project file to ZIP
    zip.start_file(project_file_name, options)
        .map_err(|e| format!("Failed to start project file in ZIP: {}", e))?;
    zip.write_all(&project_content)
        .map_err(|e| format!("Failed to write project file to ZIP: {}", e))?;

    file_count += 1;
    total_size += project_content.len();

    debug_log(&format!("Added project file {} to ZIP ({} bytes)", project_file_name, project_content.len()));

    // Phase 3: Processing media files
    if include_media {
        let _ = app.emit(
            "export-progress",
            serde_json::json!({
                "phase": "processing",
                "progress": 25,
                "message": "Scanning media directory...",
                "filesProcessed": 1,
                "totalFiles": 1
            }),
        );

        let mut effective_project_id = project_id.clone();
        let mut media_dir = get_media_directory(&effective_project_id)
            .map_err(|e| format!("Failed to get media directory: {}", e))?;

        debug_log(&format!("Media directory path: {}", media_dir.display()));

        // Count media files first
        let mut media_files_list = Vec::new();
        if media_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&media_dir) {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() {
                            media_files_list.push(path);
                        }
                    }
                }
            }
        }

        // If no media found, try extracting project ID from filename
        if media_files_list.is_empty() {
            if let Some(filename_stem) = project_path_obj.file_stem().and_then(|s| s.to_str()) {
                if let Some(last_underscore_pos) = filename_stem.rfind('_') {
                    let potential_id = &filename_stem[last_underscore_pos + 1..];
                    if potential_id.chars().all(|c| c.is_ascii_digit()) && potential_id.len() >= 10 {
                        let fallback_media_dir = get_media_directory(potential_id)
                            .map_err(|e| format!("Failed to get fallback media directory: {}", e))?;

                        if fallback_media_dir.exists() {
                            if let Ok(entries) = std::fs::read_dir(&fallback_media_dir) {
                                for entry in entries {
                                    if let Ok(entry) = entry {
                                        let path = entry.path();
                                        if path.is_file() {
                                            media_files_list.push(path);
                                        }
                                    }
                                }
                                if !media_files_list.is_empty() {
                                    effective_project_id = potential_id.to_string();
                                    // Note: media_dir is not needed after this point
                                }
                            }
                        }
                    }
                }
            }
        }

        let total_media_files = media_files_list.len();
        debug_log(&format!("Found {} media files to process", total_media_files));

        let _ = app.emit(
            "export-progress",
            serde_json::json!({
                "phase": "processing",
                "progress": 30,
                "message": format!("Processing {} media files...", total_media_files),
                "filesProcessed": 1,
                "totalFiles": total_media_files + 1
            }),
        );

        // Process media files with progress updates
        for (idx, media_file_path) in media_files_list.iter().enumerate() {
            let file_name = media_file_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| "Invalid media file name".to_string())?;

            let file_content = std::fs::read(&media_file_path)
                .map_err(|e| format!("Failed to read media file {}: {}", file_name, e))?;

            let zip_path = format!("{}/media/{}", effective_project_id, file_name);
            zip.start_file(&zip_path, options)
                .map_err(|e| format!("Failed to start media file in ZIP: {}", e))?;
            zip.write_all(&file_content)
                .map_err(|e| format!("Failed to write media file to ZIP: {}", e))?;

            file_count += 1;
            total_size += file_content.len();

            // Emit progress every 5 files or on the last file
            if idx % 5 == 0 || idx == total_media_files - 1 {
                let progress = 30 + ((idx as f32 / total_media_files as f32) * 45.0) as u32; // 30-75% range
                let _ = app.emit(
                    "export-progress",
                    serde_json::json!({
                        "phase": "processing",
                        "progress": progress,
                        "message": format!("Processing media files ({}/{})", idx + 1, total_media_files),
                        "currentFile": file_name,
                        "filesProcessed": idx + 2, // +1 for project file, +1 for current
                        "totalFiles": total_media_files + 1
                    }),
                );
            }

            debug_log(&format!("Added media file {} to ZIP ({} bytes)", file_name, file_content.len()));
        }

        debug_log(&format!("Total media files added: {}", total_media_files));
    }

    // Phase 4: Creating archive
    let _ = app.emit(
        "export-progress",
        serde_json::json!({
            "phase": "creating",
            "progress": 80,
            "message": "Creating archive...",
            "filesProcessed": file_count,
            "totalFiles": file_count
        }),
    );

    // Finalize the ZIP
    let zip_cursor = zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;
    let zip_data = zip_cursor.into_inner();

    // Phase 5: Completing
    let _ = app.emit(
        "export-progress",
        serde_json::json!({
            "phase": "completing",
            "progress": 95,
            "message": "Finalizing export...",
            "filesProcessed": file_count,
            "totalFiles": file_count
        }),
    );

    let result = ZipExportResult {
        zip_data: zip_data.clone(),
        file_count,
        total_size,
    };

    // Emit completion
    let _ = app.emit(
        "export-progress",
        serde_json::json!({
            "phase": "completing",
            "progress": 100,
            "message": "Export completed successfully!",
            "filesProcessed": file_count,
            "totalFiles": file_count
        }),
    );

    debug_log(&format!("Export completed successfully: {} files, {} bytes total", file_count, total_size));

    Ok(result)
}

/// Fixes media alignment issues when importing projects
/// This prevents objectives media from being duplicated to the first topic
fn fix_media_alignment_on_import(project_data: &mut ProjectFile) -> Result<(), String> {
    // Check if we have course content to validate
    if let Some(course_content) = &mut project_data.course_content {
        if let Some(course_obj) = course_content.as_object_mut() {
            let mut corrections_made = 0;

            // First, get the expected learning objectives media IDs
            let mut objectives_audio_id: Option<String> = None;
            let mut objectives_caption_id: Option<String> = None;

            if let Some(objectives) = course_obj.get("learningObjectivesPage").and_then(|v| v.as_object()) {
                if let Some(media_array) = objectives.get("media").and_then(|v| v.as_array()) {
                    for media in media_array {
                        if let Some(media_obj) = media.as_object() {
                            if let (Some(id), Some(media_type)) = (
                                media_obj.get("id").and_then(|v| v.as_str()),
                                media_obj.get("type").and_then(|v| v.as_str())
                            ) {
                                if media_type == "audio" {
                                    objectives_audio_id = Some(id.to_string());
                                } else if media_type == "caption" {
                                    objectives_caption_id = Some(id.to_string());
                                }
                            }
                        }
                    }
                }
            }

            // Check topics for duplicated objectives media
            if let Some(topics) = course_obj.get_mut("topics").and_then(|v| v.as_array_mut()) {
                for (topic_index, topic) in topics.iter_mut().enumerate() {
                    if let Some(topic_obj) = topic.as_object_mut() {
                        if let Some(media_array) = topic_obj.get_mut("media").and_then(|v| v.as_array_mut()) {
                            // Remove any media that duplicates objectives media
                            let mut items_to_remove = Vec::new();

                            for (media_index, media) in media_array.iter().enumerate() {
                                if let Some(media_obj) = media.as_object() {
                                    if let Some(id) = media_obj.get("id").and_then(|v| v.as_str()) {
                                        // Check if this topic media duplicates objectives media
                                        if let Some(ref obj_audio_id) = objectives_audio_id {
                                            if id == obj_audio_id {
                                                println!("[IMPORT_FIX] Removing duplicated objectives audio {} from topic {}", id, topic_index);
                                                items_to_remove.push(media_index);
                                                corrections_made += 1;
                                            }
                                        }
                                        if let Some(ref obj_caption_id) = objectives_caption_id {
                                            if id == obj_caption_id {
                                                println!("[IMPORT_FIX] Removing duplicated objectives caption {} from topic {}", id, topic_index);
                                                items_to_remove.push(media_index);
                                                corrections_made += 1;
                                            }
                                        }
                                    }
                                }
                            }

                            // Remove duplicated items (in reverse order to maintain indices)
                            for &index in items_to_remove.iter().rev() {
                                media_array.remove(index);
                            }

                            // After removing duplicates, add the correct media if missing
                            let expected_audio_id = format!("audio-{}", topic_index + 2);  // topic-0 = audio-2
                            let expected_caption_id = format!("caption-{}", topic_index + 2);  // topic-0 = caption-2

                            // Check if expected audio exists
                            let has_expected_audio = media_array.iter().any(|media| {
                                media.as_object()
                                    .and_then(|obj| obj.get("id"))
                                    .and_then(|id| id.as_str())
                                    .map(|id| id == expected_audio_id)
                                    .unwrap_or(false)
                            });

                            // Check if expected caption exists
                            let has_expected_caption = media_array.iter().any(|media| {
                                media.as_object()
                                    .and_then(|obj| obj.get("id"))
                                    .and_then(|id| id.as_str())
                                    .map(|id| id == expected_caption_id)
                                    .unwrap_or(false)
                            });

                            // Add missing audio if not present
                            if !has_expected_audio {
                                let audio_media = serde_json::json!({
                                    "id": expected_audio_id,
                                    "type": "audio",
                                    "storageId": expected_audio_id,
                                    "title": "",
                                    "url": ""
                                });
                                media_array.push(audio_media);
                                println!("[IMPORT_FIX] Added missing audio {} to topic {}", expected_audio_id, topic_index);
                                corrections_made += 1;
                            }

                            // Add missing caption if not present
                            if !has_expected_caption {
                                let caption_media = serde_json::json!({
                                    "id": expected_caption_id,
                                    "type": "caption",
                                    "storageId": expected_caption_id,
                                    "title": "",
                                    "url": ""
                                });
                                media_array.push(caption_media);
                                println!("[IMPORT_FIX] Added missing caption {} to topic {}", expected_caption_id, topic_index);
                                corrections_made += 1;
                            }
                        }
                    }
                }
            }

            if corrections_made > 0 {
                println!("[IMPORT_FIX] Fixed {} media alignment issues during import", corrections_made);
            }
        }
    }

    Ok(())
}

/// Extracts a project and its media from a ZIP file and saves to the projects directory
#[tauri::command]
pub async fn extract_project_zip(zip_data: Vec<u8>) -> Result<serde_json::Value, String> {
    // Create a temp directory for extraction
    let temp_dir = TempDir::new()
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    // Extract ZIP
    let cursor = std::io::Cursor::new(zip_data);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| format!("Invalid ZIP file: {}", e))?;

    let mut project_file_path = None;
    let mut project_id_from_media = None;
    
    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;
        
        let file_name = file.name().to_string();
        
        // Skip directories
        if file_name.ends_with('/') {
            continue;
        }
        
        // Determine output path
        let output_path = temp_dir.path().join(&file_name);
        
        // Create parent directories if needed
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        
        // Extract file
        let mut output_file = fs::File::create(&output_path)
            .map_err(|e| format!("Failed to create file: {}", e))?;
        let mut content = Vec::new();
        file.read_to_end(&mut content)
            .map_err(|e| format!("Failed to read from ZIP: {}", e))?;
        output_file.write_all(&content)
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        // Track the project file
        if file_name.ends_with(".scormproj") {
            project_file_path = Some(output_path);
        }
        
        // Extract project ID from media path if present
        if file_name.contains("/media/") && project_id_from_media.is_none() {
            if let Some(id) = file_name.split("/media/").next() {
                project_id_from_media = Some(id.to_string());
            }
        }
    }
    
    // Find the project file
    let project_file = project_file_path
        .ok_or_else(|| "No .scormproj file found in ZIP".to_string())?;
    
    // Generate new project ID (timestamp)
    let new_project_id = chrono::Utc::now().timestamp_millis().to_string();
    
    // Get projects directory
    let projects_dir = crate::project_storage::get_projects_directory()
        .map_err(|e| format!("Failed to get projects directory: {}", e))?;
    
    // Read and parse the project file to get the project name
    let project_content = fs::read_to_string(&project_file)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    let mut project_data: ProjectFile = serde_json::from_str(&project_content)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    // Validate and fix media alignment issues during import
    fix_media_alignment_on_import(&mut project_data)?;
    
    // Create new project filename
    let project_name = project_data.project.name.replace(" ", "_");
    let new_project_filename = format!("{}_{}.scormproj", project_name, new_project_id);
    let new_project_path = projects_dir.join(&new_project_filename);
    
    // Save the fixed project data to new location (instead of copying the original)
    let corrected_project_json = serde_json::to_string_pretty(&project_data)
        .map_err(|e| format!("Failed to serialize corrected project data: {}", e))?;
    fs::write(&new_project_path, corrected_project_json)
        .map_err(|e| format!("Failed to write corrected project file: {}", e))?;
    
    // Copy media files if they exist
    if let Some(old_id) = project_id_from_media {
        let old_media_dir = temp_dir.path().join(&old_id).join("media");
        if old_media_dir.exists() {
            let new_media_dir = projects_dir.join(&new_project_id).join("media");
            fs::create_dir_all(&new_media_dir)
                .map_err(|e| format!("Failed to create media directory: {}", e))?;
            
            // Copy all media files with deduplication
            let entries = fs::read_dir(&old_media_dir)
                .map_err(|e| format!("Failed to read media directory: {}", e))?;

            let mut skipped_duplicates = Vec::new();

            for entry in entries {
                let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
                let file_name_os = entry.file_name();
                let file_name = file_name_os.to_string_lossy();
                let src = entry.path();
                let dst = new_media_dir.join(&file_name_os);

                // Check if this is a duplicate file (has -1, -2, etc. suffix)
                if is_duplicate_media_file(&file_name) {
                    // Skip duplicates during import to prevent confusion
                    println!("[IMPORT_DEDUP] Skipping duplicate media file: {}", file_name);
                    skipped_duplicates.push(file_name.to_string());
                    continue;
                }

                fs::copy(&src, &dst)
                    .map_err(|e| format!("Failed to copy media file: {}", e))?;
            }

            if !skipped_duplicates.is_empty() {
                println!("[IMPORT_DEDUP] Skipped {} duplicate media files: {:?}",
                        skipped_duplicates.len(), skipped_duplicates);
            }

            // Import completed successfully
        }
    }

    Ok(serde_json::json!({
        "projectPath": new_project_path.to_string_lossy(),
        "projectId": new_project_id,
        "projectName": project_name
    }))
}

/// Saves a project with its media files
#[tauri::command]
pub async fn save_project_with_media(
    file_path: String,
    project_data: ProjectFile,
    media_files: Vec<MediaData>,
    new_project_id: String,
) -> Result<serde_json::Value, String> {
    // Save the project file
    save_project_file(&project_data, Path::new(&file_path))
        .map_err(|e| format!("Failed to save project: {}", e))?;

    // Save media files
    if !media_files.is_empty() {
        let media_dir = get_media_directory(&new_project_id)
            .map_err(|e| format!("Failed to get media directory: {}", e))?;

        // Ensure media directory exists
        fs::create_dir_all(&media_dir)
            .map_err(|e| format!("Failed to create media directory: {}", e))?;

        for media in media_files {
            let file_path = media_dir.join(&media.id);
            fs::write(&file_path, &media.data)
                .map_err(|e| format!("Failed to write media file: {}", e))?;

            // Save metadata
            let metadata_path = file_path.with_extension("json");
            let metadata_json = serde_json::to_string(&media.metadata)
                .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
            fs::write(&metadata_path, metadata_json)
                .map_err(|e| format!("Failed to write metadata: {}", e))?;
        }
    }

    Ok(serde_json::json!({
        "projectPath": file_path
    }))
}

/// Updates media paths after importing a project
#[tauri::command]
pub async fn update_imported_media_paths(
    _project_path: String,
    _project_data: ProjectFile,
    old_project_id: String,
    new_project_id: String,
) -> Result<(), String> {
    // If the project IDs are different, we might need to update media references
    // For now, the media files are already saved with the new project ID
    // This is a placeholder for future enhancements
    
    if old_project_id != new_project_id {
        // Media files are already saved in the new location by save_project_with_media
        // No additional action needed for now
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_storage::MediaMetadata;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_create_project_zip_without_media() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("test.scormproj");
        
        // Create a test project
        let project = ProjectFile {
            project: crate::project_storage::ProjectMetadata {
                id: "test123".to_string(),
                name: "Test Project".to_string(),
                created: chrono::Utc::now(),
                last_modified: chrono::Utc::now(),
                path: None,
            },
            course_data: crate::project_storage::CourseData {
                title: "Test Course".to_string(),
                difficulty: 2,
                template: "standard".to_string(),
                topics: vec!["Topic 1".to_string(), "Topic 2".to_string()],
                custom_topics: None,
            },
            ai_prompt: None,
            course_content: Some(serde_json::json!({
                "pages": []
            })),
            media: crate::project_storage::MediaData {
                images: vec![],
                videos: vec![],
                audio: vec![],
                captions: vec![],
            },
            audio_settings: crate::project_storage::AudioSettings {
                voice: "default".to_string(),
                speed: 1.0,
                pitch: 1.0,
            },
            scorm_config: crate::project_storage::ScormConfig {
                version: "1.2".to_string(),
                completion_criteria: "pages_viewed".to_string(),
                passing_score: 80,
            },
            course_seed_data: None,
            json_import_data: None,
            activities_data: None,
            media_enhancements: None,
            content_edits: None,
            current_step: None,
        };
        
        save_project_file(&project, project_path.as_path()).unwrap();
        
        // Create ZIP without media
        let result = create_project_zip(
            project_path.to_str().unwrap().to_string(),
            "test123".to_string(),
            false,
        )
        .await;
        
        assert!(result.is_ok());
        let zip_result = result.unwrap();
        assert_eq!(zip_result.file_count, 1);
        assert!(zip_result.zip_data.len() > 0);
    }

    #[tokio::test]
    async fn test_extract_project_zip() {
        // First create a ZIP
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("test.scormproj");
        
        let project = ProjectFile {
            project: crate::project_storage::ProjectMetadata {
                id: "test123".to_string(),
                name: "Test Project".to_string(),
                created: chrono::Utc::now(),
                last_modified: chrono::Utc::now(),
                path: None,
            },
            course_data: crate::project_storage::CourseData {
                title: "Test Course".to_string(),
                difficulty: 2,
                template: "standard".to_string(),
                topics: vec!["Topic 1".to_string(), "Topic 2".to_string()],
                custom_topics: None,
            },
            ai_prompt: None,
            course_content: Some(serde_json::json!({
                "pages": []
            })),
            media: crate::project_storage::MediaData {
                images: vec![],
                videos: vec![],
                audio: vec![],
                captions: vec![],
            },
            audio_settings: crate::project_storage::AudioSettings {
                voice: "default".to_string(),
                speed: 1.0,
                pitch: 1.0,
            },
            scorm_config: crate::project_storage::ScormConfig {
                version: "1.2".to_string(),
                completion_criteria: "pages_viewed".to_string(),
                passing_score: 80,
            },
            course_seed_data: None,
            json_import_data: None,
            activities_data: None,
            media_enhancements: None,
            content_edits: None,
            current_step: None,
        };
        
        save_project_file(&project, project_path.as_path()).unwrap();
        
        let zip_result = create_project_zip(
            project_path.to_str().unwrap().to_string(),
            "test123".to_string(),
            false,
        )
        .await
        .unwrap();
        
        // Now extract it
        let extracted = extract_project_zip(zip_result.zip_data).await;
        
        assert!(extracted.is_ok());
        let extracted_project = extracted.unwrap();
        // TODO: Fix test structure
        // assert_eq!(extracted_project.project_data.project.name, "Test Project");
        // assert_eq!(extracted_project.media_files.len(), 0);
    }

    #[tokio::test]
    async fn test_save_project_with_media() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("imported.scormproj");
        
        let project = ProjectFile {
            project: crate::project_storage::ProjectMetadata {
                id: "new456".to_string(),
                name: "Imported Project".to_string(),
                created: chrono::Utc::now(),
                last_modified: chrono::Utc::now(),
                path: None,
            },
            course_data: crate::project_storage::CourseData {
                title: "Imported Course".to_string(),
                difficulty: 2,
                template: "standard".to_string(),
                topics: vec!["Topic 1".to_string()],
                custom_topics: None,
            },
            ai_prompt: None,
            course_content: Some(serde_json::json!({
                "pages": []
            })),
            media: crate::project_storage::MediaData {
                images: vec![],
                videos: vec![],
                audio: vec![],
                captions: vec![],
            },
            audio_settings: crate::project_storage::AudioSettings {
                voice: "default".to_string(),
                speed: 1.0,
                pitch: 1.0,
            },
            scorm_config: crate::project_storage::ScormConfig {
                version: "1.2".to_string(),
                completion_criteria: "pages_viewed".to_string(),
                passing_score: 80,
            },
            course_seed_data: None,
            json_import_data: None,
            activities_data: None,
            media_enhancements: None,
            content_edits: None,
            current_step: None,
        };
        
        let media_files = vec![
            MediaData {
                id: "image1.png".to_string(),
                data: vec![1, 2, 3, 4, 5],
                metadata: MediaMetadata {
                    page_id: "page1".to_string(),
                    media_type: "image".to_string(),
                    original_name: "image1.png".to_string(),
                    mime_type: Some("image/png".to_string()),
                    source: None,
                    embed_url: None,
                    title: None,
                    clip_start: None,
                    clip_end: None,
                },
            },
        ];
        
        // Set test environment variable for media directory
        std::env::set_var("SCORM_BUILDER_TEST_DIR", temp_dir.path());
        
        let result = save_project_with_media(
            project_path.to_str().unwrap().to_string(),
            project,
            media_files,
            "new456".to_string(),
        )
        .await;
        
        assert!(result.is_ok());
        
        // Verify project file was saved
        assert!(project_path.exists());
        
        // Verify media file was saved
        let media_dir = temp_dir.path().join("new456").join("media");
        assert!(media_dir.exists());
        assert!(media_dir.join("image1.png").exists());
        assert!(media_dir.join("image1.json").exists());
        
        // Clean up
        std::env::remove_var("SCORM_BUILDER_TEST_DIR");
    }

    // TDD tests to expose and fix the buffer handling bug
    #[tokio::test]
    async fn test_export_zip_not_empty_bug_reproduction() {
        // RED: This test should fail initially because of the buffer bug
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("test_buffer_bug.scormproj");

        // Create a test project
        let project = ProjectFile {
            project: crate::project_storage::ProjectMetadata {
                id: "1756944132721".to_string(),
                name: "Buffer Bug Test".to_string(),
                created: chrono::Utc::now(),
                last_modified: chrono::Utc::now(),
                path: None,
            },
            course_data: crate::project_storage::CourseData {
                title: "Test Course".to_string(),
                difficulty: 2,
                template: "standard".to_string(),
                topics: vec!["Topic 1".to_string()],
                custom_topics: None,
            },
            ai_prompt: None,
            course_content: Some(serde_json::json!({
                "pages": [{"id": "page1", "title": "Test Page"}]
            })),
            media: crate::project_storage::MediaData {
                images: vec![],
                videos: vec![],
                audio: vec![],
                captions: vec![],
            },
            audio_settings: crate::project_storage::AudioSettings {
                voice: "default".to_string(),
                speed: 1.0,
                pitch: 1.0,
            },
            scorm_config: crate::project_storage::ScormConfig {
                version: "1.2".to_string(),
                completion_criteria: "pages_viewed".to_string(),
                passing_score: 80,
            },
            course_seed_data: None,
            json_import_data: None,
            activities_data: None,
            media_enhancements: None,
            content_edits: None,
            current_step: None,
        };

        let project_json = serde_json::to_string_pretty(&project).unwrap();
        std::fs::write(&project_path, project_json).unwrap();

        let result = create_project_zip(
            project_path.to_string_lossy().to_string(),
            "1756944132721".to_string(),
            false,
        ).await;

        assert!(result.is_ok(), "Export should succeed");
        let zip_result = result.unwrap();

        // This will fail initially due to the buffer bug - ZIP data should not be empty
        assert!(!zip_result.zip_data.is_empty(),
                "ZIP data should not be empty, got {} bytes", zip_result.zip_data.len());
        assert!(zip_result.zip_data.len() > 100,
                "ZIP should have substantial data, got {} bytes", zip_result.zip_data.len());
        assert_eq!(zip_result.file_count, 1, "Should contain 1 file");
        assert!(zip_result.total_size > 0, "Total size should be greater than 0");
    }

    #[tokio::test]
    async fn test_export_zip_contains_valid_data() {
        // RED: This test should fail because we can't parse an empty ZIP
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("test_valid_zip.scormproj");

        // Create a test project
        let project = ProjectFile {
            project: crate::project_storage::ProjectMetadata {
                id: "1756944132722".to_string(),
                name: "Valid ZIP Test".to_string(),
                created: chrono::Utc::now(),
                last_modified: chrono::Utc::now(),
                path: None,
            },
            course_data: crate::project_storage::CourseData {
                title: "Test Course".to_string(),
                difficulty: 2,
                template: "standard".to_string(),
                topics: vec!["Topic 1".to_string()],
                custom_topics: None,
            },
            ai_prompt: None,
            course_content: Some(serde_json::json!({
                "pages": [{"id": "page1", "title": "Test Page"}]
            })),
            media: crate::project_storage::MediaData {
                images: vec![],
                videos: vec![],
                audio: vec![],
                captions: vec![],
            },
            audio_settings: crate::project_storage::AudioSettings {
                voice: "default".to_string(),
                speed: 1.0,
                pitch: 1.0,
            },
            scorm_config: crate::project_storage::ScormConfig {
                version: "1.2".to_string(),
                completion_criteria: "pages_viewed".to_string(),
                passing_score: 80,
            },
            course_seed_data: None,
            json_import_data: None,
            activities_data: None,
            media_enhancements: None,
            content_edits: None,
            current_step: None,
        };

        let project_json = serde_json::to_string_pretty(&project).unwrap();
        std::fs::write(&project_path, project_json).unwrap();

        let result = create_project_zip(
            project_path.to_string_lossy().to_string(),
            "1756944132722".to_string(),
            false,
        ).await;

        assert!(result.is_ok(), "Export should succeed");
        let zip_result = result.unwrap();

        // Try to parse the ZIP data - this will fail if ZIP is empty or invalid
        let cursor = std::io::Cursor::new(zip_result.zip_data);
        let archive_result = zip::ZipArchive::new(cursor);
        assert!(archive_result.is_ok(), "ZIP should be valid and parseable");

        let mut archive = archive_result.unwrap();
        assert!(archive.len() > 0, "ZIP should contain at least one file");

        // Look for the .scormproj file
        let mut found_project_file = false;
        for i in 0..archive.len() {
            let file = archive.by_index(i).unwrap();
            if file.name().ends_with(".scormproj") {
                found_project_file = true;
                break;
            }
        }
        assert!(found_project_file, "ZIP should contain a .scormproj file");
    }

    #[tokio::test]
    async fn test_round_trip_export_import_bug() {
        // RED: This should fail because empty ZIP can't be imported
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("round_trip_test.scormproj");

        // Create a test project with content that should survive round-trip
        let project = ProjectFile {
            project: crate::project_storage::ProjectMetadata {
                id: "1756944132723".to_string(),
                name: "Round Trip Test".to_string(),
                created: chrono::Utc::now(),
                last_modified: chrono::Utc::now(),
                path: None,
            },
            course_data: crate::project_storage::CourseData {
                title: "Round Trip Course".to_string(),
                difficulty: 3,
                template: "advanced".to_string(),
                topics: vec!["Topic A".to_string(), "Topic B".to_string()],
                custom_topics: None,
            },
            ai_prompt: Some(crate::project_storage::AiPromptData {
                prompt: "Test AI prompt".to_string(),
                generated_at: chrono::Utc::now(),
            }),
            course_content: Some(serde_json::json!({
                "pages": [
                    {"id": "page1", "title": "First Page", "content": "Page content"},
                    {"id": "page2", "title": "Second Page", "content": "More content"}
                ]
            })),
            media: crate::project_storage::MediaData {
                images: vec![],
                videos: vec![],
                audio: vec![],
                captions: vec![],
            },
            audio_settings: crate::project_storage::AudioSettings {
                voice: "enhanced".to_string(),
                speed: 1.2,
                pitch: 0.9,
            },
            scorm_config: crate::project_storage::ScormConfig {
                version: "2004".to_string(),
                completion_criteria: "score_based".to_string(),
                passing_score: 85,
            },
            course_seed_data: Some(serde_json::json!({
                "seed": "test_seed_data"
            })),
            json_import_data: None,
            activities_data: None,
            media_enhancements: None,
            content_edits: None,
            current_step: None,
        };

        let project_json = serde_json::to_string_pretty(&project).unwrap();
        std::fs::write(&project_path, project_json).unwrap();

        // Export the project
        let export_result = create_project_zip(
            project_path.to_string_lossy().to_string(),
            "1756944132723".to_string(),
            false,
        ).await;

        assert!(export_result.is_ok(), "Export should succeed");
        let zip_result = export_result.unwrap();
        assert!(!zip_result.zip_data.is_empty(), "Exported ZIP should not be empty");

        // Try to import the project - this will fail if ZIP is empty
        let import_result = extract_project_zip(zip_result.zip_data).await;
        assert!(import_result.is_ok(), "Import should succeed");

        let import_data = import_result.unwrap();
        assert!(import_data["projectPath"].is_string(), "Should return project path");
        assert!(import_data["projectId"].is_string(), "Should return project ID");
        assert!(import_data["projectName"].is_string(), "Should return project name");
    }

    #[tokio::test]
    async fn test_export_real_project_file() {
        // Test with a real project file if it exists
        let real_project_path = r"C:\Users\sierr\Documents\SCORM Projects\Complex_Projects_-_03_-_ASME_B31_8__Gas_Transmission___Distribution_Piping_Code__1756944197691.scormproj";

        if std::path::Path::new(real_project_path).exists() {
            println!("[TEST] Testing with real project file: {}", real_project_path);

            let result = create_project_zip(
                real_project_path.to_string(),
                "1756944197691".to_string(),
                false, // Start without media to isolate the issue
            ).await;

            assert!(result.is_ok(), "Export should succeed");
            let zip_result = result.unwrap();

            println!("[TEST] ZIP size: {} bytes, file count: {}, total size: {}",
                     zip_result.zip_data.len(), zip_result.file_count, zip_result.total_size);

            // This should pass now with the fix
            assert!(!zip_result.zip_data.is_empty(),
                    "ZIP data should not be empty, got {} bytes", zip_result.zip_data.len());
            assert!(zip_result.zip_data.len() > 1000,
                    "ZIP should have substantial data, got {} bytes", zip_result.zip_data.len());
            assert_eq!(zip_result.file_count, 1, "Should contain 1 file");
            assert!(zip_result.total_size > 0, "Total size should be greater than 0");

            // Verify the ZIP is valid
            let cursor = std::io::Cursor::new(&zip_result.zip_data);
            let archive_result = zip::ZipArchive::new(cursor);
            assert!(archive_result.is_ok(), "ZIP should be valid and parseable");

            let mut archive = archive_result.unwrap();
            assert!(archive.len() > 0, "ZIP should contain at least one file");
        } else {
            println!("[TEST] Skipping real project test - file doesn't exist: {}", real_project_path);
        }
    }

    #[tokio::test]
    async fn test_complete_export_import_cycle_with_real_project() {
        // Test complete cycle with Project 02 (the one we just restored)
        let real_project_path = r"C:\Users\sierr\Documents\SCORM Projects\Complex_Projects_-_02_-_Hazardous_Area_Classification_1756944132721.scormproj";

        if std::path::Path::new(real_project_path).exists() {
            println!("[TEST] Testing complete export/import cycle with Project 02");

            // Step 1: Export the project
            let export_result = create_project_zip(
                real_project_path.to_string(),
                "1756944132721".to_string(),
                true, // Include media files
            ).await;

            assert!(export_result.is_ok(), "Export should succeed");
            let zip_result = export_result.unwrap();

            println!("[TEST] Export successful - ZIP size: {} bytes, file count: {}, total size: {}",
                     zip_result.zip_data.len(), zip_result.file_count, zip_result.total_size);

            // Verify export created a valid ZIP
            assert!(!zip_result.zip_data.is_empty(), "ZIP should not be empty");
            assert!(zip_result.zip_data.len() > 10000, "ZIP should be substantial size (>10KB)");
            assert!(zip_result.file_count >= 1, "Should contain at least the project file");

            // Step 2: Try to import the ZIP
            let import_result = extract_project_zip(zip_result.zip_data).await;
            assert!(import_result.is_ok(), "Import should succeed, got: {:?}", import_result);

            let import_data = import_result.unwrap();
            println!("[TEST] Import successful - new project: {:?}", import_data);

            // Verify import returned valid data
            assert!(import_data["projectPath"].is_string(), "Should return project path");
            assert!(import_data["projectId"].is_string(), "Should return project ID");
            assert!(import_data["projectName"].is_string(), "Should return project name");

            // Verify the imported project file exists
            let imported_project_path = import_data["projectPath"].as_str().unwrap();
            assert!(std::path::Path::new(imported_project_path).exists(),
                    "Imported project file should exist at: {}", imported_project_path);

            println!("[TEST] ✅ Complete export/import cycle successful!");

            // Clean up the imported project to avoid cluttering
            let _ = std::fs::remove_file(imported_project_path);
            let imported_id = import_data["projectId"].as_str().unwrap();
            let projects_dir = std::path::Path::new(r"C:\Users\sierr\Documents\SCORM Projects");
            let media_dir = projects_dir.join(imported_id).join("media");
            if media_dir.exists() {
                let _ = std::fs::remove_dir_all(media_dir.parent().unwrap());
            }
        } else {
            println!("[TEST] Skipping complete cycle test - Project 02 file doesn't exist: {}", real_project_path);
        }
    }

    // Include media export tests
    include!("project_export_import_media_test.rs");

    // Include project ID mismatch tests
    include!("project_export_import_mismatch_test.rs");
}