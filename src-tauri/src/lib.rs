mod keychain;

use keychain::{KeychainService, OAuthToken, KeychainError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug)]
struct StoreTokenRequest {
    client_id: String,
    endpoint: String,
    token: OAuthToken,
}

#[derive(Serialize, Deserialize, Debug)]
struct GetTokenRequest {
    client_id: String,
    endpoint: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct DeleteTokenRequest {
    client_id: String,
    endpoint: String,
}

/// Store an OAuth token in the OS keychain
#[tauri::command]
async fn store_oauth_token(
    request: StoreTokenRequest,
    keychain: tauri::State<'_, KeychainService>,
) -> Result<(), String> {
    keychain
        .store_token(&request.client_id, &request.endpoint, request.token)
        .map_err(|e| e.to_string())
}

/// Retrieve an OAuth token from the OS keychain
#[tauri::command]
async fn get_oauth_token(
    request: GetTokenRequest,
    keychain: tauri::State<'_, KeychainService>,
) -> Result<OAuthToken, String> {
    keychain
        .get_token(&request.client_id, &request.endpoint)
        .map_err(|e| e.to_string())
}

/// Delete an OAuth token from the OS keychain
#[tauri::command]
async fn delete_oauth_token(
    request: DeleteTokenRequest,
    keychain: tauri::State<'_, KeychainService>,
) -> Result<(), String> {
    keychain
        .delete_token(&request.client_id, &request.endpoint)
        .map_err(|e| e.to_string())
}

/// Clear all stored tokens (for debugging)
#[tauri::command]
async fn clear_all_tokens(
    keychain: tauri::State<'_, KeychainService>,
) -> Result<(), String> {
    keychain
        .clear_all_tokens()
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(KeychainService::new())
    .invoke_handler(tauri::generate_handler![
        store_oauth_token,
        get_oauth_token,
        delete_oauth_token,
        clear_all_tokens
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
