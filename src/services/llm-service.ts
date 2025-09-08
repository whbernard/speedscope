import {getLLMUrl} from '../config/api-config'

export type LLMProviderKey = 'bedrockClaudeSonnet'

export interface LLMConfig {
  endpoint: string
  provider: LLMProviderKey
  /** Actual LLM endpoint for proxy forwarding (development only) */
  actualEndpoint?: string
}

/**
 * LLMService handles communication with LLM APIs
 */
export class LLMService {
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  /**
   * Send a prompt to the LLM API
   */
  async sendPrompt(
    prompt: string,
    jsonData: string,
    accessToken?: string,
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    // Add the actual endpoint header for proxy forwarding (development only)
    if (this.config.actualEndpoint) {
      headers['X-Target-URL'] = this.config.actualEndpoint
    }

    // Prepare request payload for Claude/Bedrock format
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`LLM API failed: ${response.status} ${response.statusText}`)
    }

    const responseData = await response.json()

    // Extract text content from Claude response format
    if (responseData.content && Array.isArray(responseData.content) && responseData.content.length > 0) {
      return responseData.content[0].text || 'No response received'
    }

    throw new Error('Invalid LLM response format')
  }
}