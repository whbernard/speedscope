import {OAUTH_PROVIDERS, getOAuthConfig, tokenCache, validateOAuthResponse} from '../config/api-config'

export type OAuthProviderKey = keyof typeof OAUTH_PROVIDERS

export interface OAuthCredentials {
  endpoint: string
  clientId: string
  clientSecret: string
  provider?: OAuthProviderKey
}

export interface OAuthToken {
  accessToken: string
  expiresAt: number // epoch millis
  raw: any
}

/**
 * OAuthService performs OAuth 2.0 Client Credentials grant and caches tokens per (provider, clientId).
 */
export class OAuthService {
  /**
   * Acquire a bearer token, using in-memory cache when valid.
   */
  static async getToken(creds: OAuthCredentials): Promise<OAuthToken> {
    const providerKey: OAuthProviderKey = creds.provider || 'generic'
    const provider = getOAuthConfig(providerKey)

    // Try cache first
    const cached = tokenCache.getToken(provider, creds.clientId)
    if (cached) {
      const now = Date.now()
      const expiresInSec = cached[provider.responseSchema.expires_in]
      const issuedAtMs = cached.__issuedAtMs || 0
      const expiresAt = issuedAtMs + expiresInSec * 1000
      if (now < expiresAt) {
        return {
          accessToken: cached[provider.responseSchema.access_token],
          expiresAt,
          raw: cached,
        }
      }
    }

    // Build request body based on provider fields
    const body = new URLSearchParams()
    body.set('grant_type', provider.grantType)
    body.set(provider.clientIdField, creds.clientId)
    body.set(provider.clientSecretField, creds.clientSecret)

    const resp = await fetch(creds.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': provider.contentType,
      },
      body: body.toString(),
    })

    if (!resp.ok) {
      throw new Error(`OAuth failed: ${resp.status} ${resp.statusText}`)
    }

    const json = await resp.json()
    if (!validateOAuthResponse(json, provider)) {
      throw new Error('Invalid OAuth response format')
    }

    // Tag issuance time for cache expiry computation
    json.__issuedAtMs = Date.now()
    tokenCache.setToken(provider, creds.clientId, json)

    const accessToken: string = json[provider.responseSchema.access_token]
    const expiresIn: number = json[provider.responseSchema.expires_in]

    return {
      accessToken,
      expiresAt: json.__issuedAtMs + expiresIn * 1000,
      raw: json,
    }
  }
}
