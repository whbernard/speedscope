export interface OAuthConfig {
  endpoint: string
  grant_type: string
  scope: string
  client_id_field: string
  client_secret_field: string
  response_schema: {
    access_token_field: string
    expires_in_field: string
    token_type_field: string
  }
}

export interface LLMConfig {
  endpoint: string
  provider: string
  model: string
  max_tokens: number
  temperature: number
  request_schema: {
    anthropic_version: string
    messages: Array<{
      role: string
      content: string
    }>
  }
}

export interface ServiceConfig {
  oauth: OAuthConfig
  llm: LLMConfig
}

/**
 * ServiceConfigManager handles loading and managing service configurations
 */
export class ServiceConfigManager {
  private static config: ServiceConfig | null = null

  /**
   * Load configuration from file or use defaults
   */
  static async loadConfig(): Promise<ServiceConfig> {
    if (this.config) {
      return this.config
    }

    try {
      // Try to load from config file
      const response = await fetch('./config.json')
      if (response.ok) {
        this.config = await response.json()
        return this.config
      }
    } catch (error) {
      console.warn('Failed to load config.json, using defaults:', error)
    }

    // Fallback to default configuration
    this.config = {
      oauth: {
        endpoint: 'https://your-oauth-provider.com/oauth/token',
        grant_type: 'client_credentials',
        scope: 'api',
        client_id_field: 'client_id',
        client_secret_field: 'client_secret',
        response_schema: {
          access_token_field: 'access_token',
          expires_in_field: 'expires_in',
          token_type_field: 'token_type'
        }
      },
      llm: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        temperature: 0.7,
        request_schema: {
          anthropic_version: 'bedrock-2023-05-31',
          messages: [
            {
              role: 'user',
              content: '{{prompt}}\n\nContext: {{profile_data}}'
            }
          ]
        }
      }
    }

    return this.config
  }

  /**
   * Get OAuth configuration
   */
  static async getOAuthConfig(): Promise<OAuthConfig> {
    const config = await this.loadConfig()
    return config.oauth
  }

  /**
   * Get LLM configuration
   */
  static async getLLMConfig(): Promise<LLMConfig> {
    const config = await this.loadConfig()
    return config.llm
  }

  /**
   * Update configuration (for runtime changes)
   */
  static updateConfig(newConfig: Partial<ServiceConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...newConfig }
    }
  }
}
