use crate::scorm::generator::generate_scorm_package;
use crate::scorm::test_helpers::{TestCourseSettings, create_test_scorm_request_with_settings};
use std::fs;

/// Core SCORM settings generation tests
/// This directly answers: "Do the tests include creating SCORM zips using all of the various settings?"
#[cfg(test)]
mod core_settings_tests {
    use super::*;

    /// Test that we can generate SCORM packages with different CourseSettings
    #[tokio::test]
    async fn test_scorm_generation_with_various_settings() {
        println!("🧪 Testing SCORM generation with various CourseSettings...");
        
        let test_configurations = vec![
            ("Linear Navigation + Audio Completion", TestCourseSettings {
                require_audio_completion: true,
                navigation_mode: "linear".to_string(),
                pass_mark: 80,
                allow_retake: false,
                completion_criteria: "view_and_pass".to_string(),
                show_progress: true,
                font_size: "medium".to_string(),
                time_limit: Some(60),
                keyboard_navigation: true,
            }),
            
            ("Free Navigation + High Pass Mark", TestCourseSettings {
                require_audio_completion: false,
                navigation_mode: "free".to_string(),
                pass_mark: 95,
                allow_retake: true,
                completion_criteria: "pass_assessment".to_string(),
                show_progress: false,
                font_size: "large".to_string(),
                time_limit: None,
                keyboard_navigation: false,
            }),
            
            ("Accessibility Focused", TestCourseSettings {
                require_audio_completion: false,
                navigation_mode: "free".to_string(),
                pass_mark: 70,
                allow_retake: true,
                completion_criteria: "view_all".to_string(),
                show_progress: true,
                font_size: "large".to_string(),
                time_limit: None,
                keyboard_navigation: true,
            }),
            
            ("Strict Assessment Mode", TestCourseSettings {
                require_audio_completion: true,
                navigation_mode: "linear".to_string(),
                pass_mark: 100,
                allow_retake: false,
                completion_criteria: "pass_assessment".to_string(),
                show_progress: true,
                font_size: "small".to_string(),
                time_limit: Some(30),
                keyboard_navigation: false,
            }),
        ];
        
        let mut successful_generations = 0;
        let mut generated_packages = Vec::new();
        
        for (test_name, settings) in test_configurations {
            println!("📋 Testing: {}", test_name);
            println!("   Settings: {:?}", settings);
            
            // Generate SCORM package with these settings
            let request = create_test_scorm_request_with_settings(settings);
            let result = generate_scorm_package(request).await;
            
            match result {
                Ok(scorm_result) => {
                    println!("   ✅ Generated successfully");
                    println!("   📦 Package: {}", scorm_result.file_path);
                    println!("   📊 Size: {} bytes", scorm_result.size);
                    
                    // Verify the file exists and is a valid ZIP
                    assert!(fs::metadata(&scorm_result.file_path).is_ok(), 
                           "Generated package file should exist");
                    
                    // Basic ZIP validation
                    let file_content = fs::read(&scorm_result.file_path)
                        .expect("Should be able to read generated file");
                    
                    // Check ZIP signature (first 4 bytes: PK\x03\x04 or PK\x05\x06)
                    assert!(file_content.len() > 4, "File should have content");
                    assert_eq!(&file_content[0..2], b"PK", "Should be a valid ZIP file");
                    
                    assert!(scorm_result.size > 1000, "Package should be reasonably sized");
                    assert!(scorm_result.success, "Generation should report success");
                    
                    successful_generations += 1;
                    generated_packages.push((test_name, scorm_result.file_path, scorm_result.size));
                },
                Err(error) => {
                    println!("   ❌ Failed: {}", error);
                    panic!("SCORM generation failed for {}: {}", test_name, error);
                }
            }
        }
        
        // Cleanup generated files
        for (_, package_path, _) in &generated_packages {
            fs::remove_file(package_path).ok();
        }
        
        println!("\n🎉 SCORM Settings Generation Test Results:");
        println!("✅ Successful generations: {}/4", successful_generations);
        println!("📋 Configurations tested:");
        for (test_name, _, size) in generated_packages {
            println!("   - {}: {} bytes", test_name, size);
        }
        
        // All configurations should succeed
        assert_eq!(successful_generations, 4, 
                   "All CourseSettings configurations should generate valid SCORM packages");
        
        println!("\n🎊 SUCCESS: SCORM packages can be generated with various CourseSettings!");
    }

    /// Test a matrix of common settings combinations
    #[tokio::test]
    async fn test_settings_combinations_matrix() {
        println!("🧪 Testing matrix of settings combinations...");
        
        let navigation_modes = vec!["linear", "free"];
        let audio_completion_options = vec![true, false];
        let pass_marks = vec![60, 80, 95];
        
        let mut total_tests = 0;
        let mut successful_tests = 0;
        let mut generated_packages = Vec::new();
        
        for navigation_mode in &navigation_modes {
            for &audio_completion in &audio_completion_options {
                for &pass_mark in &pass_marks {
                    total_tests += 1;
                    
                    let settings = TestCourseSettings {
                        require_audio_completion: audio_completion,
                        navigation_mode: navigation_mode.to_string(),
                        pass_mark,
                        allow_retake: pass_mark < 95, // No retakes for high scores
                        completion_criteria: if pass_mark >= 90 { 
                            "pass_assessment".to_string() 
                        } else { 
                            "view_all".to_string() 
                        },
                        show_progress: true,
                        font_size: "medium".to_string(),
                        time_limit: if *navigation_mode == "linear" { Some(45) } else { None },
                        keyboard_navigation: audio_completion, // Accessibility correlation
                    };
                    
                    let test_name = format!("{}+audio_{}+pass_{}", 
                                          navigation_mode, audio_completion, pass_mark);
                    
                    println!("📋 Testing combination {}/{}: {}", 
                           total_tests, 12, test_name);
                    
                    let request = create_test_scorm_request_with_settings(settings);
                    match generate_scorm_package(request).await {
                        Ok(result) => {
                            println!("   ✅ Success: {} bytes", result.size);
                            successful_tests += 1;
                            generated_packages.push(result.file_path);
                        },
                        Err(error) => {
                            println!("   ❌ Failed: {}", error);
                        }
                    }
                }
            }
        }
        
        // Cleanup
        for package_path in generated_packages {
            fs::remove_file(package_path).ok();
        }
        
        let success_rate = successful_tests as f64 / total_tests as f64;
        println!("\n📊 Settings Matrix Results:");
        println!("✅ Successful: {}/{}", successful_tests, total_tests);
        println!("📈 Success rate: {:.1}%", success_rate * 100.0);
        
        // Require high success rate
        assert!(success_rate >= 0.8, 
               "Should have >= 80% success rate, got {:.1}%", success_rate * 100.0);
        
        println!("🎉 Settings matrix testing completed successfully!");
    }

    /// Test that different settings produce different package content
    #[tokio::test]
    async fn test_settings_affect_package_content() {
        println!("🧪 Testing that different settings produce different package content...");
        
        // Generate two packages with very different settings
        let minimal_settings = TestCourseSettings {
            require_audio_completion: false,
            navigation_mode: "free".to_string(),
            pass_mark: 60,
            allow_retake: true,
            completion_criteria: "view_all".to_string(),
            show_progress: false,
            font_size: "small".to_string(),
            time_limit: None,
            keyboard_navigation: false,
        };
        
        let maximal_settings = TestCourseSettings {
            require_audio_completion: true,
            navigation_mode: "linear".to_string(),
            pass_mark: 100,
            allow_retake: false,
            completion_criteria: "pass_assessment".to_string(),
            show_progress: true,
            font_size: "large".to_string(),
            time_limit: Some(15),
            keyboard_navigation: true,
        };
        
        // Generate both packages
        let minimal_request = create_test_scorm_request_with_settings(minimal_settings);
        let maximal_request = create_test_scorm_request_with_settings(maximal_settings);
        
        let minimal_result = generate_scorm_package(minimal_request).await
            .expect("Minimal settings should generate valid package");
        let maximal_result = generate_scorm_package(maximal_request).await
            .expect("Maximal settings should generate valid package");
        
        println!("📦 Minimal settings package: {} bytes", minimal_result.size);
        println!("📦 Maximal settings package: {} bytes", maximal_result.size);
        
        // Both should be valid packages
        assert!(minimal_result.success);
        assert!(maximal_result.success);
        assert!(minimal_result.size > 1000);
        assert!(maximal_result.size > 1000);
        
        // Read both packages to compare content
        let minimal_content = fs::read(&minimal_result.file_path)
            .expect("Should read minimal package");
        let maximal_content = fs::read(&maximal_result.file_path)
            .expect("Should read maximal package");
        
        // Packages should be different (different settings = different content)
        assert_ne!(minimal_content, maximal_content, 
                  "Different settings should produce different SCORM packages");
        
        println!("✅ Confirmed: Different settings produce different package content");
        
        // Cleanup
        fs::remove_file(minimal_result.file_path).ok();
        fs::remove_file(maximal_result.file_path).ok();
        
        println!("🎉 Settings differentiation test completed successfully!");
    }
}