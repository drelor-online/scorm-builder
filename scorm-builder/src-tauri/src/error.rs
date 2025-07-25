use std::fmt;

#[derive(Debug)]
pub enum AppError {
    Io(std::io::Error),
    Serialization(serde_json::Error),
    Validation(String),
    NotFound(String),
    Unauthorized(String),
    NetworkError(reqwest::Error),
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "IO error: {}", e),
            AppError::Serialization(e) => write!(f, "Serialization error: {}", e),
            AppError::Validation(msg) => write!(f, "Validation error: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            AppError::NetworkError(e) => write!(f, "Network error: {}", e),
            AppError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

// Automatic conversions
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::NetworkError(err)
    }
}

// Convert to Tauri command result
impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;