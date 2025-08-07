// Simple test without external dependencies
use std::fs;
use std::path::{Path, PathBuf};

fn extract_project_id(project_id_or_path: &str) -> String {
    // If it contains .scormproj, extract the ID from the filename
    if project_id_or_path.contains(".scormproj") {
        // Get the filename from the path
        let path = Path::new(project_id_or_path);
        if let Some(file_name) = path.file_name() {
            if let Some(file_str) = file_name.to_str() {
                // Try to extract ID from pattern like "ProjectName_1234567890.scormproj"
                if let Some(underscore_pos) = file_str.rfind('_') {
                    if let Some(dot_pos) = file_str.rfind('.') {
                        if underscore_pos < dot_pos {
                            let potential_id = &file_str[underscore_pos + 1..dot_pos];
                            // Check if it's all digits
                            if potential_id.chars().all(|c| c.is_ascii_digit()) {
                                return potential_id.to_string();
                            }
                        }
                    }
                }
                // Fallback: try to get ID from the beginning if no underscore pattern
                if let Some(dot_pos) = file_str.find('.') {
                    let potential_id = &file_str[..dot_pos];
                    if potential_id.chars().all(|c| c.is_ascii_digit()) {
                        return potential_id.to_string();
                    }
                }
            }
        }
    }

    // If it's already just an ID or we couldn't extract, return as is
    project_id_or_path.to_string()
}

fn main() {
    println!("Testing extract_project_id function:\n");
    
    let test_cases = vec![
        ("TestProject_1234567890.scormproj", "1234567890"),
        ("My_Cool_Project_9876543210.scormproj", "9876543210"),
        ("1234567890.scormproj", "1234567890"),
        ("C:\\projects\\TestProject_1234567890.scormproj", "1234567890"),
        ("/home/user/projects/MyProject_9876543210.scormproj", "9876543210"),
        ("1234567890", "1234567890"),
        ("NotAProject.scormproj", "NotAProject.scormproj"),
        ("Project_NotNumeric.scormproj", "Project_NotNumeric.scormproj"),
    ];
    
    let mut all_passed = true;
    
    for (input, expected) in test_cases {
        let result = extract_project_id(input);
        let passed = result == expected;
        let status = if passed { "✓" } else { "✗" };
        
        println!("{} Input: '{}' -> Output: '{}' (Expected: '{}')", 
                 status, input, result, expected);
        
        if !passed {
            all_passed = false;
        }
    }
    
    println!("\n{}", if all_passed { 
        "ALL TESTS PASSED! ✓" 
    } else { 
        "SOME TESTS FAILED! ✗" 
    });
}