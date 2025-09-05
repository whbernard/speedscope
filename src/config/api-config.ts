/**
 * API Configuration for OAuth and LLM Integration
 * 
 * This file contains the configuration for external API integrations
 * including OAuth authentication and LLM service endpoints.
 */

export interface OAuthConfig {
  /** OAuth token endpoint URL */
  url: string
  /** OAuth client ID field name */
  clientIdField: string
  /** OAuth client secret field name */
  clientSecretField: string
  /** OAuth grant type */
  grantType: string
  /** Content type for OAuth request */
  contentType: string
  /** Expected response schema for OAuth token */
  responseSchema: {
    access_token: string
    token_type?: string
    expires_in?: number
    scope?: string
  }
}

export interface LLMConfig {
  /** LLM API endpoint URL */
  url: string
  /** Default model to use */
  defaultModel: string
  /** Content type for LLM request */
  contentType: string
  /** Request body schema for LLM API */
  requestSchema: {
    anthropic_version: string
    max_tokens: number
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
    temperature?: number
    top_p?: number
    top_k?: number
    stop_sequences?: string[]
  }
  /** Expected response schema for LLM API */
  responseSchema: {
    id: string
    type: string
    role: string
    content: Array<{
      type: 'text'
      text: string
    }>
    model: string
    stop_reason: string
    stop_sequence: string | null
    usage: {
      input_tokens: number
      output_tokens: number
    }
  }
}

/**
 * Default OAuth configuration
 * Generic OAuth 2.0 client credentials flow
 */
export const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
  url: 'https://api.example.com/oauth/token',
  clientIdField: 'client_id',
  clientSecretField: 'client_secret',
  grantType: 'client_credentials',
  contentType: 'application/x-www-form-urlencoded',
  responseSchema: {
    access_token: 'string',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'read write'
  }
}

/**
 * Default LLM configuration
 * Runtime-configurable model endpoint
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  url: (typeof process !== 'undefined' && process.env?.LLM_ENDPOINT) || 'https://bedrock-runtime.amazonaws.com/model/anthropic.claude-3-sonnet-20240229-v1:0/invoke',
  defaultModel: (typeof process !== 'undefined' && process.env?.LLM_MODEL) || 'anthropic.claude-3-sonnet-20240229-v1:0',
  contentType: 'application/json',
  requestSchema: {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: 'You are a performance analysis expert. Analyze the provided profiling data and provide actionable insights.'
      }
    ],
    temperature: 0.7,
    top_p: 1,
    top_k: 250,
    stop_sequences: []
  },
  responseSchema: {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'Analysis results...'
      }
    ],
    model: 'anthropic.claude-3-sonnet-20240229-v1:0',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 200
    }
  }
}

/**
 * Generic OAuth configurations
 */
export const OAUTH_PROVIDERS = {
  /** Generic OAuth 2.0 provider */
  generic: DEFAULT_OAUTH_CONFIG
} as const

/**
 * Runtime-configurable LLM providers
 * Model selection is handled through environment variables:
 * 
 * Environment Variables:
 * - LLM_ENDPOINT: Override the default model endpoint URL
 * - LLM_MODEL: Override the default model name
 * 
 * Example:
 * LLM_ENDPOINT=https://bedrock-runtime.amazonaws.com/model/anthropic.claude-3-haiku-20240307-v1:0/invoke
 * LLM_MODEL=anthropic.claude-3-haiku-20240307-v1:0
 */
export const LLM_PROVIDERS = {
  /** Default runtime-configured model */
  bedrockClaudeSonnet: DEFAULT_LLM_CONFIG
} as const

/**
 * Get OAuth configuration by provider name
 */
export function getOAuthConfig(provider: keyof typeof OAUTH_PROVIDERS = 'generic'): OAuthConfig {
  return OAUTH_PROVIDERS[provider]
}

/**
 * Get LLM configuration by provider name
 */
export function getLLMConfig(provider: keyof typeof LLM_PROVIDERS = 'bedrockClaudeSonnet'): LLMConfig {
  return LLM_PROVIDERS[provider]
}

/**
 * Validate OAuth response against expected schema
 */
export function validateOAuthResponse(response: any, config: OAuthConfig): boolean {
  const schema = config.responseSchema
  return (
    typeof response === 'object' &&
    response !== null &&
    typeof response[schema.access_token] === 'string'
  )
}

/**
 * Validate LLM response against expected schema
 */
export function validateLLMResponse(response: any, config: LLMConfig): boolean {
  return (
    typeof response === 'object' &&
    response !== null &&
    Array.isArray(response.content) &&
    response.content.length > 0 &&
    typeof response.content[0].text === 'string' &&
    typeof response.stop_reason === 'string'
  )
}

/**
 * In-memory token cache for secure token storage
 */
interface CachedToken {
  access_token: string
  token_type: string
  expires_at: number
  scope?: string
}

class TokenCache {
  private cache: Map<string, CachedToken> = new Map()
  private readonly CACHE_KEY_PREFIX = 'oauth_token_'

  /**
   * Generate a cache key based on OAuth configuration
   */
  private getCacheKey(config: OAuthConfig, clientId: string): string {
    const key = config.url + ':' + clientId
    // Simple hash function for browser compatibility
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `${this.CACHE_KEY_PREFIX}${Math.abs(hash).toString(36)}`
  }

  /**
   * Store token in cache with expiration
   */
  setToken(config: OAuthConfig, clientId: string, tokenResponse: any): void {
    const expiresIn = tokenResponse.expires_in || 3600
    const expiresAt = Date.now() + (expiresIn * 1000)
    
    const cachedToken: CachedToken = {
      access_token: tokenResponse.access_token,
      token_type: tokenResponse.token_type || 'Bearer',
      expires_at: expiresAt,
      scope: tokenResponse.scope
    }

    const cacheKey = this.getCacheKey(config, clientId)
    this.cache.set(cacheKey, cachedToken)
  }

  /**
   * Retrieve valid token from cache
   */
  getToken(config: OAuthConfig, clientId: string): string | null {
    const cacheKey = this.getCacheKey(config, clientId)
    const cachedToken = this.cache.get(cacheKey)

    if (!cachedToken) {
      return null
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now()
    const bufferTime = 5 * 60 * 1000 // 5 minutes
    if (cachedToken.expires_at <= now + bufferTime) {
      this.cache.delete(cacheKey)
      return null
    }

    return cachedToken.access_token
  }

  /**
   * Clear token from cache
   */
  clearToken(config: OAuthConfig, clientId: string): void {
    const cacheKey = this.getCacheKey(config, clientId)
    this.cache.delete(cacheKey)
  }

  /**
   * Clear all cached tokens
   */
  clearAll(): void {
    this.cache.clear()
  }

  /**
   * Check if token exists and is valid
   */
  hasValidToken(config: OAuthConfig, clientId: string): boolean {
    return this.getToken(config, clientId) !== null
  }
}

// Global token cache instance
export const tokenCache = new TokenCache()
