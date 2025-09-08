import {getOAuthUrl} from '../config/api-config'
import {invoke} from '@tauri-apps/api/core'

export type OAuthProviderKey = 'generic'

export interface OAuthCredentials {
  endpoint: string
  clientId: string
  clientSecret: string
  scope?: string
  provider?: OAuthProviderKey
}

export interface OAuthToken {
  accessToken: string
  expiresAt: number // epoch millis
  raw: any
}

interface TauriOAuthToken {
  access_token: string
  token_type: string
  expires_in?: number
  scope?: string
  expires_at?: number
}

/**
 * OAuthService performs OAuth 2.0 Client Credentials grant and stores tokens in OS keychain
 */
export class OAuthService {
  /**
   * Acquire a bearer token, using OS keychain when valid
   */
  static async getToken(creds: OAuthCredentials): Promise<OAuthToken> {
    // Try keychain first
    try {
      const cachedToken = await invoke<TauriOAuthToken>('get_oauth_token', {
        request: {
          client_id: creds.clientId,
          endpoint: creds.endpoint,
        },
      })
      
      return {
        accessToken: cachedToken.access_token,
        expiresAt: cachedToken.expires_at ? cachedToken.expires_at * 1000 : Date.now() + 3600000,
        raw: cachedToken,
      }
    } catch (error) {
      // Token not found or expired, continue to fetch new one
      console.log('No valid token in keychain, fetching new one:', error)
    }

    // Build request body with standard OAuth fields
    const body = {
      grant_type: 'client_credentials',
      scope: creds.scope || 'api',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }

    const resp = await fetch(creds.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      throw new Error(`OAuth failed: ${resp.status} ${resp.statusText}`)
    }

    const json = await resp.json()
    
    if (!json.access_token) {
      throw new Error('Invalid OAuth response: no access_token')
    }

    const accessToken = String(json.access_token)
    const expiresIn = Number(json.expires_in) || 3600
    const expiresAt = Date.now() + expiresIn * 1000

    // Store the token in OS keychain
    try {
      await invoke('store_oauth_token', {
        request: {
          client_id: creds.clientId,
          endpoint: creds.endpoint,
          token: {
            access_token: accessToken,
            token_type: json.token_type || 'Bearer',
            expires_in: expiresIn,
            scope: json.scope,
            expires_at: Math.floor(expiresAt / 1000), // Convert to Unix timestamp
          },
        },
      })
    } catch (error) {
      console.warn('Failed to store token in keychain:', error)
      // Continue anyway, the token is still valid for this session
    }

    return {
      accessToken,
      expiresAt,
      raw: json,
    }
  }

  /**
   * Clear a stored token from the OS keychain
   */
  static async clearToken(clientId: string, endpoint: string): Promise<void> {
    try {
      await invoke('delete_oauth_token', {
        request: {
          client_id: clientId,
          endpoint: endpoint,
        },
      })
    } catch (error) {
      console.warn('Failed to clear token from keychain:', error)
    }
  }
}