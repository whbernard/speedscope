import {getOAuthUrl} from '../config/api-config'

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

/**
 * Simple in-memory token cache
 */
class TokenCache {
  private cache: Map<string, {token: string, expiresAt: number}> = new Map()

  setToken(clientId: string, token: string, expiresIn: number): void {
    const expiresAt = Date.now() + expiresIn * 1000
    this.cache.set(clientId, {token, expiresAt})
  }

  getToken(clientId: string): string | null {
    const cached = this.cache.get(clientId)
    if (!cached) return null
    
    if (Date.now() >= cached.expiresAt) {
      this.cache.delete(clientId)
      return null
    }
    
    return cached.token
  }

  clearToken(clientId: string): void {
    this.cache.delete(clientId)
  }
}

const tokenCache = new TokenCache()

/**
 * OAuthService performs OAuth 2.0 Client Credentials grant and caches tokens
 */
export class OAuthService {
  /**
   * Acquire a bearer token, using in-memory cache when valid
   */
  static async getToken(creds: OAuthCredentials): Promise<OAuthToken> {
    // Try cache first
    const cachedToken = tokenCache.getToken(creds.clientId)
    if (cachedToken) {
      return {
        accessToken: cachedToken,
        expiresAt: Date.now() + 3600000, // 1 hour default
        raw: {access_token: cachedToken}
      }
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

    // Cache the token
    tokenCache.setToken(creds.clientId, accessToken, expiresIn)

    return {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      raw: json,
    }
  }
}