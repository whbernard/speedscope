import {DEFAULT_LLM_CONFIG, getLLMConfig, LLM_PROVIDERS} from '../config/api-config'

export type LLMProviderKey = keyof typeof LLM_PROVIDERS

export interface LLMRequestOptions {
  provider?: LLMProviderKey
  model?: string
  prompt: string
  profileJson: string
  accessToken?: string // optional bearer token if OAuth is used externally
  extraHeaders?: Record<string, string>
}

export interface LLMResponse {
  ok: boolean
  status: number
  raw: any
  text?: string
}

/**
 * LLMService submits analysis requests to the configured LLM endpoint.
 */
export class LLMService {
  static async send(options: LLMRequestOptions): Promise<LLMResponse> {
    const providerKey: LLMProviderKey = options.provider || 'bedrockClaudeSonnet'
    const provider = getLLMConfig(providerKey)

    const headers: Record<string, string> = {
      'Content-Type': provider.contentType,
      ...(options.extraHeaders || {}),
    }

    if (options.accessToken) {
      headers['Authorization'] = `Bearer ${options.accessToken}`
    }

    const payload: any = {
      ...provider.requestSchema,
    }

    if (options.model || provider.defaultModel) {
      payload.model = options.model || provider.defaultModel
    }

    // Merge prompt and data into messages/content
    // Assumes OpenAI-style schema; can be adapted per provider.requestSchema
    if (!payload.messages) payload.messages = []
    payload.messages = [
      {
        role: 'user',
        content: `${options.prompt}\n\nProfile data:\n${options.profileJson}`,
      },
    ]

    const resp = await fetch(provider.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    let raw: any = null
    try {
      raw = await resp.json()
    } catch {
      // no-op; non-JSON response
    }

    let text: string | undefined
    if (raw?.content?.[0]?.text) {
      text = raw.content[0].text
    }

    return {
      ok: resp.ok,
      status: resp.status,
      raw,
      text,
    }
  }
}
