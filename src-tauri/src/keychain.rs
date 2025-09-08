use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum KeychainError {
    #[error("Keychain operation failed: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Entry not found")]
    NotFound,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OAuthToken {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub scope: Option<String>,
    pub expires_at: Option<u64>, // Unix timestamp
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StoredToken {
    pub token: OAuthToken,
    pub client_id: String,
    pub endpoint: String,
    pub stored_at: u64, // Unix timestamp
}

pub struct KeychainService {
    service_name: String,
}

impl KeychainService {
    pub fn new() -> Self {
        Self {
            service_name: "SpeedscopeLLM".to_string(),
        }
    }

    /// Store an OAuth token in the OS keychain
    pub fn store_token(
        &self,
        client_id: &str,
        endpoint: &str,
        token: OAuthToken,
    ) -> Result<(), KeychainError> {
        let key = format!("oauth_token_{}_{}", 
            self.sanitize_key(client_id), 
            self.sanitize_key(endpoint)
        );
        
        let stored_token = StoredToken {
            token,
            client_id: client_id.to_string(),
            endpoint: endpoint.to_string(),
            stored_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let entry = Entry::new(&self.service_name, &key)?;
        let serialized = serde_json::to_string(&stored_token)?;
        entry.set_password(&serialized)?;

        log::info!("Stored OAuth token for client_id: {}", client_id);
        Ok(())
    }

    /// Retrieve an OAuth token from the OS keychain
    pub fn get_token(&self, client_id: &str, endpoint: &str) -> Result<OAuthToken, KeychainError> {
        let key = format!("oauth_token_{}_{}", 
            self.sanitize_key(client_id), 
            self.sanitize_key(endpoint)
        );

        let entry = Entry::new(&self.service_name, &key)?;
        let password = entry.get_password()?;
        let stored_token: StoredToken = serde_json::from_str(&password)?;

        // Check if token is expired
        if let Some(expires_at) = stored_token.token.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            if now >= expires_at {
                // Token is expired, remove it
                self.delete_token(client_id, endpoint)?;
                return Err(KeychainError::NotFound);
            }
        }

        log::info!("Retrieved OAuth token for client_id: {}", client_id);
        Ok(stored_token.token)
    }

    /// Delete an OAuth token from the OS keychain
    pub fn delete_token(&self, client_id: &str, endpoint: &str) -> Result<(), KeychainError> {
        let key = format!("oauth_token_{}_{}", 
            self.sanitize_key(client_id), 
            self.sanitize_key(endpoint)
        );

        let entry = Entry::new(&self.service_name, &key)?;
        entry.delete_password()?;

        log::info!("Deleted OAuth token for client_id: {}", client_id);
        Ok(())
    }

    /// List all stored tokens (for debugging/admin purposes)
    pub fn list_tokens(&self) -> Result<Vec<StoredToken>, KeychainError> {
        // Note: The keyring crate doesn't provide a way to list all entries
        // This is a limitation of the OS keychain APIs
        // For now, we'll return an empty vector
        // In a real implementation, you might want to maintain a separate index
        Ok(vec![])
    }

    /// Clear all tokens (for debugging/admin purposes)
    pub fn clear_all_tokens(&self) -> Result<(), KeychainError> {
        // Note: The keyring crate doesn't provide a way to list and delete all entries
        // This is a limitation of the OS keychain APIs
        // For now, this is a no-op
        // In a real implementation, you might want to maintain a separate index
        log::warn!("clear_all_tokens is not implemented due to keyring API limitations");
        Ok(())
    }

    /// Sanitize a string to be used as a keychain key
    fn sanitize_key(&self, key: &str) -> String {
        key.chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
            .collect()
    }
}

impl Default for KeychainService {
    fn default() -> Self {
        Self::new()
    }
}
