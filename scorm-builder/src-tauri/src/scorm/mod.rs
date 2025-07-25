pub mod manifest;
pub mod package;

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