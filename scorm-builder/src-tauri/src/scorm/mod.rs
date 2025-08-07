pub mod generator;
pub mod generator_enhanced;
pub mod html_generator;
pub mod html_generator_enhanced;
pub mod manifest;
pub mod navigation_generator;
pub mod output_validator;
pub mod package;
pub mod style_generator;

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
