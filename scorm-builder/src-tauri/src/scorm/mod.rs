pub mod generator;
pub mod generator_enhanced;
pub mod html_generator;
pub mod html_generator_enhanced;
pub mod manifest;
pub mod navigation_generator;
pub mod output_validator;
pub mod package;
pub mod style_generator;

// Re-export commonly used types - removed unused CourseMetadata export

#[cfg(test)]
mod generator_guard_test;

#[cfg(test)]
pub mod test_helpers;

#[cfg(test)]
mod settings_matrix_tests;

#[cfg(test)]
mod core_settings_test;

#[cfg(test)]
mod html_template_settings;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_exports() {
        // Ensure modules are accessible
        let _ = manifest::generate_manifest;
        let _ = package::create_scorm_package;
    }
}
