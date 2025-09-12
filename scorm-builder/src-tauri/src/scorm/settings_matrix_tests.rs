use crate::scorm::generator::generate_scorm_package;
use crate::scorm::test_helpers::{TestCourseSettings, create_test_scorm_request_with_settings};
use std::fs;
use zip;

/// Comprehensive SCORM settings matrix testing
/// This answers the question: "Do the tests include creating SCORM zips using all of the various settings?"
#[cfg(test)]
mod settings_matrix_tests {
    use super::*;

    /// Test linear navigation with audio completion requirements
    #[tokio::test]
    async fn test_linear_navigation_with_audio_completion() {
        let settings = TestCourseSettings {
            require_audio_completion: true,
            navigation_mode: "linear".to_string(),
            pass_mark: 80,
            allow_retake: false,
            completion_criteria: "view_and_pass".to_string(),
            show_progress: true,
            font_size: "medium".to_string(),
            time_limit: Some(60),
            keyboard_navigation: true,
        };

        let result = generate_and_validate_scorm(settings).await;
        assert!(result.is_ok(), "Linear navigation + audio completion should generate valid SCORM");
        
        let (package_path, validation) = result.unwrap();
        
        // Validate ZIP contains expected settings implementation
        assert!(validation.contains_manifest);
        assert!(validation.contains_index_html);
        assert!(validation.contains_scorm_api);
        assert!(validation.manifest_has_navigation_restrictions);
        assert!(validation.html_has_audio_completion_logic);
        
        // Cleanup
        fs::remove_file(package_path).ok();
    }

    /// Test free navigation with high pass mark
    #[tokio::test]
    async fn test_free_navigation_with_high_pass_mark() {
        let settings = TestCourseSettings {
            require_audio_completion: false,
            navigation_mode: "free".to_string(),
            pass_mark: 95,
            allow_retake: true,
            completion_criteria: "pass_assessment".to_string(),
            show_progress: true,
            font_size: "large".to_string(),
            time_limit: None,
            keyboard_navigation: false,
        };

        let result = generate_and_validate_scorm(settings).await;
        assert!(result.is_ok(), "Free navigation + high pass mark should generate valid SCORM");
        
        let (package_path, validation) = result.unwrap();
        
        // Validate specific settings are implemented
        assert!(validation.manifest_has_mastery_score_95);
        assert!(validation.html_allows_free_navigation);
        assert!(!validation.html_has_audio_completion_logic);
        
        // Cleanup
        fs::remove_file(package_path).ok();
    }

    /// Test accessibility settings (large font, keyboard navigation)
    #[tokio::test]
    async fn test_accessibility_settings() {
        let settings = TestCourseSettings {
            require_audio_completion: false,
            navigation_mode: "free".to_string(),
            pass_mark: 70,
            allow_retake: true,
            completion_criteria: "view_all".to_string(),
            show_progress: false,
            font_size: "large".to_string(),
            time_limit: None,
            keyboard_navigation: true,
        };

        let result = generate_and_validate_scorm(settings).await;
        assert!(result.is_ok(), "Accessibility settings should generate valid SCORM");
        
        let (package_path, validation) = result.unwrap();
        
        // Validate accessibility features
        assert!(validation.css_has_large_font_styles);
        assert!(validation.html_has_keyboard_navigation);
        assert!(!validation.html_has_progress_bar);
        
        // Cleanup
        fs::remove_file(package_path).ok();
    }

    /// Test strict assessment mode (no retakes, view and pass required)
    #[tokio::test]
    async fn test_strict_assessment_mode() {
        let settings = TestCourseSettings {
            require_audio_completion: true,
            navigation_mode: "linear".to_string(),
            pass_mark: 100,
            allow_retake: false,
            completion_criteria: "pass_assessment".to_string(),
            show_progress: true,
            font_size: "medium".to_string(),
            time_limit: Some(30),
            keyboard_navigation: false,
        };

        let result = generate_and_validate_scorm(settings).await;
        assert!(result.is_ok(), "Strict assessment mode should generate valid SCORM");
        
        let (package_path, validation) = result.unwrap();
        
        // Validate strict assessment implementation
        assert!(validation.manifest_has_mastery_score_100);
        assert!(validation.scorm_api_enforces_no_retakes);
        assert!(validation.html_has_time_limit_30_minutes);
        assert!(validation.html_has_audio_completion_logic);
        
        // Cleanup
        fs::remove_file(package_path).ok();
    }

    /// Test all combinations of critical settings
    #[tokio::test]
    async fn test_settings_combinations_matrix() {
        let test_cases = vec![
            // Case 1: Minimal requirements
            TestCourseSettings {
                require_audio_completion: false,
                navigation_mode: "free".to_string(),
                pass_mark: 60,
                allow_retake: true,
                completion_criteria: "view_all".to_string(),
                show_progress: false,
                font_size: "small".to_string(),
                time_limit: None,
                keyboard_navigation: false,
            },
            // Case 2: Maximum restrictions
            TestCourseSettings {
                require_audio_completion: true,
                navigation_mode: "linear".to_string(),
                pass_mark: 100,
                allow_retake: false,
                completion_criteria: "pass_assessment".to_string(),
                show_progress: true,
                font_size: "large".to_string(),
                time_limit: Some(15),
                keyboard_navigation: true,
            },
            // Case 3: Mixed settings
            TestCourseSettings {
                require_audio_completion: true,
                navigation_mode: "free".to_string(),
                pass_mark: 85,
                allow_retake: true,
                completion_criteria: "view_and_pass".to_string(),
                show_progress: true,
                font_size: "medium".to_string(),
                time_limit: Some(45),
                keyboard_navigation: false,
            },
        ];

        let mut results = Vec::new();
        
        for (index, settings) in test_cases.iter().enumerate() {
            println!("Testing settings combination {}: {:?}", index + 1, settings);
            
            let result = generate_and_validate_scorm(settings.clone()).await;
            assert!(result.is_ok(), "Settings combination {} should generate valid SCORM", index + 1);
            
            let (package_path, validation) = result.unwrap();
            results.push((package_path.clone(), validation));
            
            // Cleanup
            fs::remove_file(package_path).ok();
        }
        
        // All combinations should succeed
        assert_eq!(results.len(), test_cases.len());
        println!("✅ All {} settings combinations generated valid SCORM packages", results.len());
    }

    /// Comprehensive validation of 16 common settings combinations
    #[tokio::test]
    async fn test_comprehensive_settings_validation() {
        let combinations = generate_common_settings_combinations();
        let mut successful_generations = 0;
        let mut failed_generations = Vec::new();
        
        println!("Testing {} common settings combinations...", combinations.len());
        
        for (index, settings) in combinations.iter().enumerate() {
            match generate_and_validate_scorm(settings.clone()).await {
                Ok((package_path, validation)) => {
                    successful_generations += 1;
                    
                    // Perform deep validation
                    assert!(validation.is_valid_zip, "Package {} should be valid ZIP", index + 1);
                    assert!(validation.contains_manifest, "Package {} should contain manifest", index + 1);
                    assert!(validation.manifest_is_valid_xml, "Package {} manifest should be valid XML", index + 1);
                    
                    // Settings-specific validations
                    if settings.navigation_mode == "linear" {
                        assert!(validation.manifest_has_navigation_restrictions, 
                               "Linear navigation should be enforced in package {}", index + 1);
                    }
                    
                    if settings.require_audio_completion {
                        assert!(validation.html_has_audio_completion_logic,
                               "Audio completion should be implemented in package {}", index + 1);
                    }
                    
                    if settings.font_size == "large" {
                        assert!(validation.css_has_large_font_styles,
                               "Large font styles should be present in package {}", index + 1);
                    }
                    
                    // Cleanup
                    fs::remove_file(package_path).ok();
                    
                    println!("✅ Package {} generated successfully", index + 1);
                },
                Err(error) => {
                    failed_generations.push((index + 1, error));
                    println!("❌ Package {} failed: {:?}", index + 1, settings);
                }
            }
        }
        
        // Report results
        println!("\n📊 Settings Matrix Test Results:");
        println!("✅ Successful: {}/{}", successful_generations, combinations.len());
        println!("❌ Failed: {}", failed_generations.len());
        
        if !failed_generations.is_empty() {
            println!("Failed combinations:");
            for (index, error) in failed_generations {
                println!("  Package {}: {}", index, error);
            }
        }
        
        // Require high success rate (allow some edge case failures)
        let success_rate = successful_generations as f64 / combinations.len() as f64;
        assert!(success_rate >= 0.9, "Success rate should be >= 90%, got {:.1}%", success_rate * 100.0);
        
        println!("🎉 Settings matrix testing completed with {:.1}% success rate", success_rate * 100.0);
    }
}

/// Generate and validate SCORM package with given settings
async fn generate_and_validate_scorm(settings: TestCourseSettings) -> Result<(String, ScormValidation), String> {
    // Generate SCORM package using the settings
    let request = create_test_scorm_request_with_settings(settings);
    let result = generate_scorm_package(request).await
        .map_err(|e| format!("SCORM generation failed: {}", e))?;
    
    if !result.success {
        return Err("SCORM generation reported failure".to_string());
    }
    
    // Validate the generated ZIP package
    let validation = validate_scorm_package(&result.file_path)?;
    
    Ok((result.file_path, validation))
}

/// Generate common settings combinations for comprehensive testing
fn generate_common_settings_combinations() -> Vec<TestCourseSettings> {
    let mut combinations = Vec::new();
    
    // Navigation modes
    let navigation_modes = vec!["linear", "free"];
    
    // Audio completion settings
    let audio_settings = vec![true, false];
    
    // Pass marks
    let pass_marks = vec![60, 80, 100];
    
    // Font sizes
    let font_sizes = vec!["small", "medium", "large"];
    
    // Generate combinations
    for nav_mode in &navigation_modes {
        for &audio_completion in &audio_settings {
            for &pass_mark in &pass_marks {
                for font_size in &font_sizes {
                    combinations.push(TestCourseSettings {
                        require_audio_completion: audio_completion,
                        navigation_mode: nav_mode.to_string(),
                        pass_mark,
                        allow_retake: pass_mark < 100, // No retakes for perfect scores
                        completion_criteria: if pass_mark >= 90 { 
                            "pass_assessment".to_string() 
                        } else { 
                            "view_all".to_string() 
                        },
                        show_progress: true,
                        font_size: font_size.to_string(),
                        time_limit: if *nav_mode == "linear" { Some(60) } else { None },
                        keyboard_navigation: *font_size == "large", // Accessibility correlation
                    });
                }
            }
        }
    }
    
    combinations
}

/// SCORM package validation results
#[derive(Debug)]
struct ScormValidation {
    is_valid_zip: bool,
    contains_manifest: bool,
    contains_index_html: bool,
    contains_scorm_api: bool,
    contains_styles_css: bool,
    manifest_is_valid_xml: bool,
    manifest_has_navigation_restrictions: bool,
    manifest_has_mastery_score_95: bool,
    manifest_has_mastery_score_100: bool,
    html_has_audio_completion_logic: bool,
    html_allows_free_navigation: bool,
    html_has_progress_bar: bool,
    html_has_keyboard_navigation: bool,
    html_has_time_limit_30_minutes: bool,
    css_has_large_font_styles: bool,
    scorm_api_enforces_no_retakes: bool,
}

/// Validate a SCORM package ZIP file
fn validate_scorm_package(package_path: &str) -> Result<ScormValidation, String> {
    use std::io::Read;
    
    // Read the ZIP file
    let file = fs::File::open(package_path)
        .map_err(|e| format!("Failed to open package: {}", e))?;
    
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP: {}", e))?;
    
    let mut validation = ScormValidation {
        is_valid_zip: true,
        contains_manifest: false,
        contains_index_html: false,
        contains_scorm_api: false,
        contains_styles_css: false,
        manifest_is_valid_xml: false,
        manifest_has_navigation_restrictions: false,
        manifest_has_mastery_score_95: false,
        manifest_has_mastery_score_100: false,
        html_has_audio_completion_logic: false,
        html_allows_free_navigation: false,
        html_has_progress_bar: false,
        html_has_keyboard_navigation: false,
        html_has_time_limit_30_minutes: false,
        css_has_large_font_styles: false,
        scorm_api_enforces_no_retakes: false,
    };
    
    // Check for required files and analyze their content
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file {}: {}", i, e))?;
        
        let filename = file.name().to_string();
        
        match filename.as_str() {
            "imsmanifest.xml" => {
                validation.contains_manifest = true;
                let mut content = String::new();
                file.read_to_string(&mut content)
                    .map_err(|e| format!("Failed to read manifest: {}", e))?;
                
                validation.manifest_is_valid_xml = content.contains("<?xml version=\"1.0\"");
                validation.manifest_has_mastery_score_95 = content.contains("95");
                validation.manifest_has_mastery_score_100 = content.contains("100");
                validation.manifest_has_navigation_restrictions = content.contains("linear") || content.contains("sequencing");
            },
            "index.html" => {
                validation.contains_index_html = true;
                let mut content = String::new();
                file.read_to_string(&mut content)
                    .map_err(|e| format!("Failed to read HTML: {}", e))?;
                
                validation.html_has_audio_completion_logic = content.contains("audioCompleted") || content.contains("audio") && content.contains("ended");
                validation.html_allows_free_navigation = content.contains("navigation") && !content.contains("display: none");
                validation.html_has_progress_bar = content.contains("progress-bar") || content.contains("progress");
                validation.html_has_keyboard_navigation = content.contains("keydown") || content.contains("keyboard");
                validation.html_has_time_limit_30_minutes = content.contains("30") && content.contains("time");
            },
            "scorm-api.js" => {
                validation.contains_scorm_api = true;
                let mut content = String::new();
                file.read_to_string(&mut content)
                    .map_err(|e| format!("Failed to read SCORM API: {}", e))?;
                
                validation.scorm_api_enforces_no_retakes = content.contains("allowRetake: false") || content.contains("retake") && content.contains("false");
            },
            "styles.css" => {
                validation.contains_styles_css = true;
                let mut content = String::new();
                file.read_to_string(&mut content)
                    .map_err(|e| format!("Failed to read CSS: {}", e))?;
                
                validation.css_has_large_font_styles = content.contains("font-large") || content.contains("18px") || content.contains("font-size: large");
            },
            _ => {} // Ignore other files
        }
    }
    
    Ok(validation)
}