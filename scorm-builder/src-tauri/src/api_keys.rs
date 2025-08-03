use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce
};
use aes_gcm::aead::rand_core::RngCore;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiKeys {
    pub google_image_api_key: String,
    pub google_cse_id: String,
    pub youtube_api_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedApiKeys {
    nonce: String,
    ciphertext: String,
}

fn get_api_keys_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?;
    
    let app_config_dir = config_dir.join("scorm-builder");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&app_config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    
    Ok(app_config_dir.join("api_keys.enc"))
}

fn get_or_create_key() -> Result<Vec<u8>, String> {
    let key_path = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("scorm-builder")
        .join(".key");
    
    if key_path.exists() {
        // Read existing key
        let key_base64 = fs::read_to_string(&key_path)
            .map_err(|e| format!("Failed to read key file: {}", e))?;
        
        general_purpose::STANDARD.decode(key_base64.trim())
            .map_err(|e| format!("Failed to decode key: {}", e))
    } else {
        // Generate new key
        let mut key = vec![0u8; 32]; // 256-bit key
        OsRng.fill_bytes(&mut key);
        
        // Save key as base64
        let key_base64 = general_purpose::STANDARD.encode(&key);
        fs::write(&key_path, key_base64)
            .map_err(|e| format!("Failed to save key file: {}", e))?;
        
        Ok(key)
    }
}

#[tauri::command]
pub fn save_api_keys(api_keys: ApiKeys) -> Result<(), String> {
    // Serialize API keys to JSON
    let json = serde_json::to_string(&api_keys)
        .map_err(|e| format!("Failed to serialize API keys: {}", e))?;
    
    // Get or create encryption key
    let key_bytes = get_or_create_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    
    // Create cipher
    let cipher = Aes256Gcm::new(key);
    
    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher.encrypt(nonce, json.as_bytes())
        .map_err(|e| format!("Failed to encrypt API keys: {}", e))?;
    
    // Create encrypted structure
    let encrypted = EncryptedApiKeys {
        nonce: general_purpose::STANDARD.encode(&nonce_bytes),
        ciphertext: general_purpose::STANDARD.encode(&ciphertext),
    };
    
    // Save to file
    let path = get_api_keys_path()?;
    let encrypted_json = serde_json::to_string_pretty(&encrypted)
        .map_err(|e| format!("Failed to serialize encrypted data: {}", e))?;
    
    fs::write(&path, encrypted_json)
        .map_err(|e| format!("Failed to save encrypted API keys: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn load_api_keys() -> Result<ApiKeys, String> {
    let path = get_api_keys_path()?;
    
    if !path.exists() {
        return Err("API keys file not found".to_string());
    }
    
    // Read encrypted file
    let encrypted_json = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read API keys file: {}", e))?;
    
    let encrypted: EncryptedApiKeys = serde_json::from_str(&encrypted_json)
        .map_err(|e| format!("Failed to parse encrypted data: {}", e))?;
    
    // Get encryption key
    let key_bytes = get_or_create_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    
    // Decode nonce and ciphertext
    let nonce_bytes = general_purpose::STANDARD.decode(&encrypted.nonce)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = general_purpose::STANDARD.decode(&encrypted.ciphertext)
        .map_err(|e| format!("Failed to decode ciphertext: {}", e))?;
    
    // Create cipher and decrypt
    let cipher = Aes256Gcm::new(key);
    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Failed to decrypt API keys: {}", e))?;
    
    // Parse JSON
    let json = String::from_utf8(plaintext)
        .map_err(|e| format!("Failed to convert decrypted data to string: {}", e))?;
    
    let api_keys: ApiKeys = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse API keys: {}", e))?;
    
    Ok(api_keys)
}

#[tauri::command]
pub fn delete_api_keys() -> Result<(), String> {
    let path = get_api_keys_path()?;
    
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete API keys file: {}", e))?;
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_save_and_load_api_keys() {
        let api_keys = ApiKeys {
            google_image_api_key: "test_google_key".to_string(),
            google_cse_id: "test_cse_id".to_string(),
            youtube_api_key: "test_youtube_key".to_string(),
        };
        
        // Save
        save_api_keys(api_keys.clone()).unwrap();
        
        // Load
        let loaded = load_api_keys().unwrap();
        
        assert_eq!(loaded.google_image_api_key, api_keys.google_image_api_key);
        assert_eq!(loaded.google_cse_id, api_keys.google_cse_id);
        assert_eq!(loaded.youtube_api_key, api_keys.youtube_api_key);
        
        // Cleanup
        delete_api_keys().unwrap();
    }
}