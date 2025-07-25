use std::path::Path;
use std::io::Write;
use serde::{Deserialize, Serialize};
use zip::write::FileOptions;
use zip::CompressionMethod;

#[derive(Debug, Serialize, Deserialize)]
pub struct PackageContent {
    pub manifest: String,
    pub html_content: String,
    pub resources: Vec<Resource>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Resource {
    pub path: String,
    pub content: Vec<u8>,
}

pub fn create_scorm_package(content: &PackageContent, output_path: &Path) -> Result<(), String> {
    let file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o755);
    
    // Write manifest file
    zip.start_file("imsmanifest.xml", options)
        .map_err(|e| format!("Failed to start manifest file: {}", e))?;
    zip.write_all(content.manifest.as_bytes())
        .map_err(|e| format!("Failed to write manifest content: {}", e))?;
    
    // Write main HTML file
    zip.start_file("index.html", options)
        .map_err(|e| format!("Failed to start HTML file: {}", e))?;
    zip.write_all(content.html_content.as_bytes())
        .map_err(|e| format!("Failed to write HTML content: {}", e))?;
    
    // Write resources
    for resource in &content.resources {
        // Validate path to prevent ZipSlip vulnerability
        let path = Path::new(&resource.path);
        
        // Check for dangerous path components
        if path.is_absolute() || path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err(format!("Invalid resource path: {}", resource.path));
        }
        
        // Create directories if needed
        if let Some(parent) = path.parent() {
            if parent.to_string_lossy().len() > 0 {
                // The zip crate handles directory creation automatically
                // when we write files with paths containing directories
            }
        }
        
        zip.start_file(&resource.path, options)
            .map_err(|e| format!("Failed to start resource file {}: {}", resource.path, e))?;
        zip.write_all(&resource.content)
            .map_err(|e| format!("Failed to write resource {}: {}", resource.path, e))?;
    }
    
    // Write SCORM API JavaScript file
    let scorm_api_js = include_str!("../../assets/scorm_api.js");
    zip.start_file("scorm_api.js", options)
        .map_err(|e| format!("Failed to start SCORM API file: {}", e))?;
    zip.write_all(scorm_api_js.as_bytes())
        .map_err(|e| format!("Failed to write SCORM API: {}", e))?;
    
    zip.finish()
        .map_err(|e| format!("Failed to finish ZIP file: {}", e))?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_create_scorm_package_creates_zip() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("course.zip");
        
        let content = PackageContent {
            manifest: "<?xml version=\"1.0\"?><manifest></manifest>".to_string(),
            html_content: "<html><body>Test</body></html>".to_string(),
            resources: vec![],
        };

        let result = create_scorm_package(&content, &output_path);
        assert!(result.is_ok());
        assert!(output_path.exists());
        
        // Verify it's a valid ZIP file
        let file_size = fs::metadata(&output_path).unwrap().len();
        assert!(file_size > 0);
    }

    #[test]
    fn test_package_includes_required_files() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("course.zip");
        
        let content = PackageContent {
            manifest: "<?xml version=\"1.0\"?><manifest></manifest>".to_string(),
            html_content: "<html><body>Course Content</body></html>".to_string(),
            resources: vec![
                Resource {
                    path: "styles.css".to_string(),
                    content: b"body { margin: 0; }".to_vec(),
                }
            ],
        };

        create_scorm_package(&content, &output_path).unwrap();
        
        // Verify ZIP contains expected files
        use zip::ZipArchive;
        let file = fs::File::open(&output_path).unwrap();
        let mut archive = ZipArchive::new(file).unwrap();
        
        let file_names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
            
        assert!(file_names.contains(&"imsmanifest.xml".to_string()));
        assert!(file_names.contains(&"index.html".to_string()));
        assert!(file_names.contains(&"styles.css".to_string()));
    }

    #[test]
    fn test_package_handles_nested_resources() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("course.zip");
        
        let content = PackageContent {
            manifest: "<?xml version=\"1.0\"?><manifest></manifest>".to_string(),
            html_content: "<html><body>Test</body></html>".to_string(),
            resources: vec![
                Resource {
                    path: "images/logo.png".to_string(),
                    content: vec![0x89, 0x50, 0x4E, 0x47], // PNG header
                },
                Resource {
                    path: "scripts/main.js".to_string(),
                    content: b"console.log('SCORM');".to_vec(),
                }
            ],
        };

        create_scorm_package(&content, &output_path).unwrap();
        
        use zip::ZipArchive;
        let file = fs::File::open(&output_path).unwrap();
        let mut archive = ZipArchive::new(file).unwrap();
        
        let file_names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
            
        assert!(file_names.contains(&"images/logo.png".to_string()));
        assert!(file_names.contains(&"scripts/main.js".to_string()));
    }
}