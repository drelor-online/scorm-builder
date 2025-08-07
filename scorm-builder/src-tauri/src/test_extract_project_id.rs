// Test file to validate extract_project_id function
use std::path::Path;

/// Extract project ID from a path or return the ID if it's already just an ID
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_from_underscore_pattern() {
        // Test the standard format: ProjectName_1234567890.scormproj
        assert_eq!(
            extract_project_id("TestProject_1234567890.scormproj"),
            "1234567890"
        );
        assert_eq!(
            extract_project_id("My_Cool_Project_9876543210.scormproj"),
            "9876543210"
        );
    }

    #[test]
    fn test_extract_from_numeric_only() {
        // Test numeric-only format: 1234567890.scormproj
        assert_eq!(
            extract_project_id("1234567890.scormproj"),
            "1234567890"
        );
    }

    #[test]
    fn test_extract_from_full_path() {
        // Test with full paths
        assert_eq!(
            extract_project_id("C:\\projects\\TestProject_1234567890.scormproj"),
            "1234567890"
        );
        assert_eq!(
            extract_project_id("/home/user/projects/MyProject_9876543210.scormproj"),
            "9876543210"
        );
    }

    #[test]
    fn test_plain_project_id() {
        // Test when it's already just an ID
        assert_eq!(
            extract_project_id("1234567890"),
            "1234567890"
        );
    }

    #[test]
    fn test_invalid_formats() {
        // Test formats that can't be parsed - should return as-is
        assert_eq!(
            extract_project_id("NotAProject.scormproj"),
            "NotAProject.scormproj"
        );
        assert_eq!(
            extract_project_id("Project_NotNumeric.scormproj"),
            "Project_NotNumeric.scormproj"
        );
    }
}

fn main() {
    println!("Running extract_project_id tests...");
    
    // Test cases
    let test_cases = vec![
        ("TestProject_1234567890.scormproj", "1234567890"),
        ("1234567890.scormproj", "1234567890"),
        ("C:\\projects\\TestProject_1234567890.scormproj", "1234567890"),
        ("1234567890", "1234567890"),
        ("NotAProject.scormproj", "NotAProject.scormproj"),
    ];
    
    for (input, expected) in test_cases {
        let result = extract_project_id(input);
        println!("Input: {} -> Output: {} (Expected: {})", input, result, expected);
        assert_eq!(result, expected, "Failed for input: {}", input);
    }
    
    println!("All tests passed!");
}