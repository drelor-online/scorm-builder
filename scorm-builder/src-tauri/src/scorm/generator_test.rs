use crate::scorm::generator::{generate_scorm_package, stream_file_to_zip, GenerateScormRequest, CourseMetadata, MediaFile};
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

#[tokio::test]
async fn test_direct_file_streaming_into_zip() {
    // Create a temporary directory with test files
    let temp_dir = TempDir::new().unwrap();
    let media_dir = temp_dir.path().join("media");
    fs::create_dir(&media_dir).unwrap();
    
    // Create large test files to verify streaming (not loading into memory)
    let large_file_path = media_dir.join("large_video.mp4");
    let large_file_size = 100 * 1024 * 1024; // 100MB
    create_large_test_file(&large_file_path, large_file_size);
    
    // Create request with reference to the large file
    let request = GenerateScormRequest {
        course_content: create_test_course_content(),
        course_metadata: CourseMetadata {
            title: "Test Course".to_string(),
            description: "Test Description".to_string(),
            project_title: "Test Project".to_string(),
            version: None,
            scorm_version: None,
        },
        project_id: "test-project".to_string(),
        media_files: vec![
            MediaFile {
                id: "video-1".to_string(),
                file_path: large_file_path.to_str().unwrap().to_string(),
                mime_type: "video/mp4".to_string(),
            }
        ],
        generated_files: vec![],
    };
    
    // Track memory usage before generation
    let memory_before = get_current_memory_usage();
    
    // Generate SCORM package
    let result = generate_scorm_package(request).await.unwrap();
    
    // Track memory usage after generation
    let memory_after = get_current_memory_usage();
    
    // Memory usage should not increase by more than 10MB (allowing for overhead)
    // If files were loaded into memory, it would increase by 100MB+
    let memory_increase = if memory_after > memory_before {
        memory_after - memory_before
    } else {
        0 // Memory decreased, which is fine
    };
    assert!(memory_increase < 10 * 1024 * 1024, 
        "Memory usage increased by {}MB, indicating files were loaded into memory instead of streamed", 
        memory_increase / (1024 * 1024));
    
    // Verify the ZIP contains the large file
    let zip_file = fs::File::open(&result.file_path).unwrap();
    let mut archive = zip::ZipArchive::new(zip_file).unwrap();
    
    // Check that the video file is in the ZIP
    let video_in_zip = archive.by_name("media/video-1.mp4").unwrap();
    assert_eq!(video_in_zip.size(), large_file_size as u64);
}

#[test]
fn test_stream_file_to_zip_writer() {
    let temp_dir = TempDir::new().unwrap();
    let source_file = temp_dir.path().join("source.bin");
    let zip_file = temp_dir.path().join("output.zip");
    
    // Create a test file
    let test_data = vec![0u8; 1024 * 1024]; // 1MB
    fs::write(&source_file, &test_data).unwrap();
    
    // Create ZIP and stream file into it
    let file = fs::File::create(&zip_file).unwrap();
    let mut zip = zip::ZipWriter::new(file);
    
    // This should stream the file, not load it into memory
    let result = stream_file_to_zip(&mut zip, &source_file, "test.bin");
    
    assert!(result.is_ok());
    zip.finish().unwrap();
    
    // Verify the ZIP contains the file
    let zip_file = fs::File::open(&zip_file).unwrap();
    let mut archive = zip::ZipArchive::new(zip_file).unwrap();
    let file_in_zip = archive.by_name("test.bin").unwrap();
    assert_eq!(file_in_zip.size(), test_data.len() as u64);
}

fn create_large_test_file(path: &PathBuf, size: usize) {
    use std::io::Write;
    let mut file = fs::File::create(path).unwrap();
    let chunk = vec![0u8; 1024 * 1024]; // 1MB chunks
    for _ in 0..(size / chunk.len()) {
        file.write_all(&chunk).unwrap();
    }
}

fn get_current_memory_usage() -> usize {
    // Platform-specific memory usage tracking
    #[cfg(target_os = "windows")]
    {
        use winapi::um::processthreadsapi::GetCurrentProcess;
        use winapi::um::psapi::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
        use std::mem;
        
        unsafe {
            let mut pmc: PROCESS_MEMORY_COUNTERS = mem::zeroed();
            pmc.cb = mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
            
            if GetProcessMemoryInfo(
                GetCurrentProcess(),
                &mut pmc as *mut PROCESS_MEMORY_COUNTERS,
                pmc.cb
            ) != 0 {
                pmc.WorkingSetSize as usize
            } else {
                0
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // For other platforms, return 0 for now
        // Could implement using /proc/self/status on Linux
        0
    }
}

fn create_test_course_content() -> serde_json::Value {
    serde_json::json!({
        "welcomePage": {
            "title": "Welcome",
            "content": "Welcome to the course"
        },
        "learningObjectivesPage": {
            "objectives": ["Learn Rust", "Build SCORM packages"],
            "content": "Objectives"
        },
        "topics": [],
        "assessment": {
            "questions": [],
            "passMark": 80
        }
    })
}