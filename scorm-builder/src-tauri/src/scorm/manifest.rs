use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::Writer;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

#[derive(Debug, Serialize, Deserialize)]
pub struct CourseMetadata {
    pub title: String,
    pub identifier: String,
    pub description: Option<String>,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ManifestOptions {
    pub course: CourseMetadata,
    pub scorm_version: String,
}

pub fn generate_manifest(options: &ManifestOptions) -> Result<String, String> {
    // Validate SCORM version
    match options.scorm_version.as_str() {
        "1.2" | "2004" | "2004.3" | "2004.4" => {}
        _ => return Err(format!("Invalid SCORM version: {}", options.scorm_version)),
    }

    let mut writer = Writer::new(Cursor::new(Vec::new()));

    // Write XML declaration
    writer
        .write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))
        .map_err(|e| format!("Failed to write XML declaration: {e}"))?;

    // Start manifest element
    let mut manifest_elem = BytesStart::new("manifest");
    // Escape attribute values using quick_xml's built-in escaping
    manifest_elem.push_attribute((
        "identifier",
        quick_xml::escape::escape(&options.course.identifier).as_ref(),
    ));
    manifest_elem.push_attribute((
        "version",
        quick_xml::escape::escape(&options.course.version).as_ref(),
    ));

    // Add namespace based on SCORM version
    match options.scorm_version.as_str() {
        "1.2" => {
            manifest_elem
                .push_attribute(("xmlns", "http://www.imsproject.org/xsd/imscp_rootv1p1p2"));
            manifest_elem
                .push_attribute(("xmlns:adlcp", "http://www.adlnet.org/xsd/adlcp_rootv1p2"));
        }
        _ => {
            manifest_elem.push_attribute(("xmlns", "http://www.imsglobal.org/xsd/imscp_v1p1"));
            manifest_elem.push_attribute(("xmlns:adlcp", "http://www.adlnet.org/xsd/adlcp_v1p3"));
            manifest_elem.push_attribute(("xmlns:adlseq", "http://www.adlnet.org/xsd/adlseq_v1p3"));
            manifest_elem.push_attribute(("xmlns:adlnav", "http://www.adlnet.org/xsd/adlnav_v1p3"));
            manifest_elem.push_attribute(("xmlns:imsss", "http://www.imsglobal.org/xsd/imsss"));
        }
    }

    writer
        .write_event(Event::Start(manifest_elem))
        .map_err(|e| format!("Failed to write manifest element: {e}"))?;

    // Write metadata
    writer
        .write_event(Event::Start(BytesStart::new("metadata")))
        .map_err(|e| format!("Failed to write metadata start: {e}"))?;

    writer
        .write_event(Event::Start(BytesStart::new("schema")))
        .map_err(|e| format!("Failed to write schema start: {e}"))?;
    writer
        .write_event(Event::Text(BytesText::new("ADL SCORM")))
        .map_err(|e| format!("Failed to write schema text: {e}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("schema")))
        .map_err(|e| format!("Failed to write schema end: {e}"))?;

    writer
        .write_event(Event::Start(BytesStart::new("schemaversion")))
        .map_err(|e| format!("Failed to write schemaversion start: {e}"))?;
    let version_text = match options.scorm_version.as_str() {
        "1.2" => "1.2",
        "2004" => "2004 3rd Edition",
        "2004.3" => "2004 3rd Edition",
        "2004.4" => "2004 4th Edition",
        _ => "2004 3rd Edition",
    };
    writer
        .write_event(Event::Text(BytesText::new(version_text)))
        .map_err(|e| format!("Failed to write schemaversion text: {e}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("schemaversion")))
        .map_err(|e| format!("Failed to write schemaversion end: {e}"))?;

    writer
        .write_event(Event::End(BytesEnd::new("metadata")))
        .map_err(|e| format!("Failed to write metadata end: {e}"))?;

    // Write organizations
    let mut orgs_elem = BytesStart::new("organizations");
    let default_org = format!("{}_org", options.course.identifier);
    orgs_elem.push_attribute(("default", default_org.as_str()));
    writer
        .write_event(Event::Start(orgs_elem))
        .map_err(|e| format!("Failed to write organizations start: {e}"))?;

    let mut org_elem = BytesStart::new("organization");
    let org_id = format!("{}_org", options.course.identifier);
    org_elem.push_attribute(("identifier", org_id.as_str()));
    writer
        .write_event(Event::Start(org_elem))
        .map_err(|e| format!("Failed to write organization start: {e}"))?;

    writer
        .write_event(Event::Start(BytesStart::new("title")))
        .map_err(|e| format!("Failed to write title start: {e}"))?;
    writer
        .write_event(Event::Text(BytesText::from_escaped(&options.course.title)))
        .map_err(|e| format!("Failed to write title text: {e}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("title")))
        .map_err(|e| format!("Failed to write title end: {e}"))?;

    // Add a default item
    let mut item_elem = BytesStart::new("item");
    item_elem.push_attribute(("identifier", "item_1"));
    item_elem.push_attribute(("identifierref", "resource_1"));
    writer
        .write_event(Event::Start(item_elem))
        .map_err(|e| format!("Failed to write item start: {e}"))?;

    writer
        .write_event(Event::Start(BytesStart::new("title")))
        .map_err(|e| format!("Failed to write item title start: {e}"))?;
    writer
        .write_event(Event::Text(BytesText::from_escaped(&options.course.title)))
        .map_err(|e| format!("Failed to write item title text: {e}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("title")))
        .map_err(|e| format!("Failed to write item title end: {e}"))?;

    writer
        .write_event(Event::End(BytesEnd::new("item")))
        .map_err(|e| format!("Failed to write item end: {e}"))?;

    writer
        .write_event(Event::End(BytesEnd::new("organization")))
        .map_err(|e| format!("Failed to write organization end: {e}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("organizations")))
        .map_err(|e| format!("Failed to write organizations end: {e}"))?;

    // Write resources
    writer
        .write_event(Event::Start(BytesStart::new("resources")))
        .map_err(|e| format!("Failed to write resources start: {e}"))?;

    let mut resource_elem = BytesStart::new("resource");
    resource_elem.push_attribute(("identifier", "resource_1"));
    resource_elem.push_attribute(("type", "webcontent"));
    resource_elem.push_attribute(("href", "index.html"));
    if options.scorm_version == "1.2" {
        resource_elem.push_attribute(("adlcp:scormtype", "sco"));
    } else {
        resource_elem.push_attribute(("adlcp:scormType", "sco"));
    }
    writer
        .write_event(Event::Start(resource_elem))
        .map_err(|e| format!("Failed to write resource start: {e}"))?;

    let mut file_elem = BytesStart::new("file");
    file_elem.push_attribute(("href", "index.html"));
    writer
        .write_event(Event::Empty(file_elem))
        .map_err(|e| format!("Failed to write file element: {e}"))?;

    writer
        .write_event(Event::End(BytesEnd::new("resource")))
        .map_err(|e| format!("Failed to write resource end: {e}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("resources")))
        .map_err(|e| format!("Failed to write resources end: {e}"))?;

    // Close manifest
    writer
        .write_event(Event::End(BytesEnd::new("manifest")))
        .map_err(|e| format!("Failed to write manifest end: {e}"))?;

    let result = writer.into_inner().into_inner();
    String::from_utf8(result).map_err(|e| format!("Failed to convert to UTF-8: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_manifest_creates_valid_xml() {
        let options = ManifestOptions {
            course: CourseMetadata {
                title: "Test Course".to_string(),
                identifier: "test-course-001".to_string(),
                description: Some("A test course for SCORM generation".to_string()),
                version: "1.0".to_string(),
            },
            scorm_version: "2004".to_string(),
        };

        let result = generate_manifest(&options);
        assert!(result.is_ok());

        let manifest = result.unwrap();
        assert!(manifest.contains("<?xml"));
        assert!(manifest.contains("<manifest"));
        assert!(manifest.contains("Test Course"));
    }

    #[test]
    fn test_manifest_includes_required_metadata() {
        let options = ManifestOptions {
            course: CourseMetadata {
                title: "Sample Course".to_string(),
                identifier: "sample-001".to_string(),
                description: None,
                version: "2.0".to_string(),
            },
            scorm_version: "1.2".to_string(),
        };

        let manifest = generate_manifest(&options).unwrap();

        // Check for required SCORM elements
        assert!(manifest.contains("<organizations"));
        assert!(manifest.contains("<resources"));
        assert!(manifest.contains("<metadata"));
        assert!(manifest.contains("sample-001"));
    }

    #[test]
    fn test_manifest_validates_scorm_version() {
        let options = ManifestOptions {
            course: CourseMetadata {
                title: "Test".to_string(),
                identifier: "test".to_string(),
                description: None,
                version: "1.0".to_string(),
            },
            scorm_version: "invalid".to_string(),
        };

        let result = generate_manifest(&options);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid SCORM version"));
    }
}
