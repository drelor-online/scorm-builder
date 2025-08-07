use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub projects_directory: Option<String>,
    pub recent_projects_count: Option<usize>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            projects_directory: None,
            recent_projects_count: Some(10),
        }
    }
}

/// Get the settings file path
fn get_settings_path() -> Result<PathBuf, String> {
    let config_dir =
        dirs::config_dir().ok_or_else(|| "Unable to find config directory".to_string())?;

    let app_config_dir = config_dir.join("SCORM-Builder");

    // Create directory if it doesn't exist
    if !app_config_dir.exists() {
        fs::create_dir_all(&app_config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(app_config_dir.join("settings.json"))
}

/// Load application settings
pub fn load_settings() -> Result<AppSettings, String> {
    let settings_path = get_settings_path()?;

    if !settings_path.exists() {
        // Return default settings if file doesn't exist
        return Ok(AppSettings::default());
    }

    let contents = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    let settings: AppSettings = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse settings file: {}", e))?;

    Ok(settings)
}

/// Save application settings
pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let settings_path = get_settings_path()?;

    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json).map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}

/// Get the projects directory, either from settings or default
pub fn get_projects_directory() -> Result<PathBuf, String> {
    let settings = load_settings()?;

    if let Some(custom_dir) = settings.projects_directory {
        let path = PathBuf::from(custom_dir);
        if path.exists() {
            return Ok(path);
        }
    }

    // Fall back to default
    let home_dir = dirs::home_dir().ok_or_else(|| "Unable to find home directory".to_string())?;

    let default_dir = home_dir.join("Documents").join("SCORM Projects");

    // Create directory if it doesn't exist
    if !default_dir.exists() {
        fs::create_dir_all(&default_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }

    Ok(default_dir)
}

/// Set the projects directory
pub fn set_projects_directory(path: &Path) -> Result<(), String> {
    let mut settings = load_settings()?;
    settings.projects_directory = Some(path.to_string_lossy().to_string());
    save_settings(&settings)
}
