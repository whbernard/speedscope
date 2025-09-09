// Electron IPC adapters for backend services

export interface LlmApi {
  oauthRequest: (request: OAuthRequest) => Promise<OAuthResponse>
  llmRequest: (request: LLMRequest) => Promise<LLMResponse>
  httpRequest: (request: HttpRequest) => Promise<HttpResponse>
  storeToken: (data: { service: string; account: string; token: string }) => Promise<{ success: boolean }>
  getToken: (data: { service: string; account: string }) => Promise<{ token: string | null }>
  deleteToken: (data: { service: string; account: string }) => Promise<{ success: boolean }>
  loadConfig: () => Promise<any>
}

declare global {
  interface Window {
    llmApi: LlmApi
  }
}

// OAuth Types
export interface OAuthRequest {
  endpoint: string
  client_id: string
  client_secret: string
  grant_type?: string
  scope?: string
}

export interface OAuthResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope?: string
}

// LLM Types
export interface LLMRequest {
  endpoint: string
  provider: string
  prompt: string
  profile_data: string
  access_token?: string
  max_tokens?: number
  temperature?: number
  custom_headers?: Record<string, string>
  request_schema?: {
    messages?: Array<{
      role: string
      content: Array<{ text: string }>
    }>
    system?: Array<{ text: string }>
    inferenceConfig?: {
      maxTokens: number
      temperature: number
      topP: number
      stopSequences: string[]
    }
  }
}

export interface LLMResponse {
  content: string
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

// HTTP Types (consolidated)
export interface HttpRequest {
  method?: string
  url: string
  body?: any
  headers?: Record<string, string>
  binary?: boolean
}

export interface HttpResponse {
  data: any
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export interface HttpBinaryResponse {
  data: number[]
  status: number
  statusText: string
  headers: Record<string, string>
  body: number[]
}

// OAuth Adapter
export class OAuthAdapter {
  // Hardcoded OAuth configuration
  private static readonly OAUTH_ENDPOINT = 'https://api.example.com/oauth/token'
  private static readonly GRANT_TYPE = 'client_credentials'
  private static readonly SCOPE = 'api'

  static async requestToken(
    clientId: string,
    clientSecret: string,
    customConfig?: {
      endpoint?: string
      grant_type?: string
      scope?: string
    }
  ): Promise<OAuthResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: OAuthRequest = {
      endpoint: this.OAUTH_ENDPOINT, // Use hardcoded endpoint
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: this.GRANT_TYPE, // Use hardcoded grant type
      scope: this.SCOPE // Use hardcoded scope
    }

    return await window.llmApi.oauthRequest(request)
  }
}

// LLM Adapter
export class LLMAdapter {
  // Hardcoded LLM configuration
  private static readonly LLM_ENDPOINT = 'https://api.anthropic.com/v1/messages'
  private static readonly DEFAULT_PROVIDER = 'anthropic'
  private static readonly DEFAULT_MAX_TOKENS = 2000
  private static readonly DEFAULT_TEMPERATURE = 0.7

  static async sendPrompt(
    prompt: string,
    profileData: string,
    accessToken: string | undefined,
    customConfig?: {
      endpoint?: string
      provider?: string
      model?: string
      max_tokens?: number
      temperature?: number
      custom_headers?: Record<string, string>
      request_schema?: any
    }
  ): Promise<LLMResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: LLMRequest = {
      endpoint: this.LLM_ENDPOINT, // Use hardcoded endpoint
      provider: this.DEFAULT_PROVIDER, // Use hardcoded provider
      prompt,
      profile_data: profileData,
      access_token: accessToken,
      max_tokens: this.DEFAULT_MAX_TOKENS, // Use hardcoded max tokens
      temperature: this.DEFAULT_TEMPERATURE, // Use hardcoded temperature
      custom_headers: customConfig?.custom_headers,
      request_schema: customConfig?.request_schema
    }

    return await window.llmApi.llmRequest(request)
  }
}

// Native HTTP Service (for internal use)
class NativeHttpService {
  static async get(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: HttpRequest = {
      method: 'GET',
      url,
      headers
    }

    const response = await window.llmApi.httpRequest(request)
    return {
      data: response.data,
      status: response.status,
      statusText: response.status < 400 ? 'OK' : 'Error',
      headers: response.headers,
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    }
  }

  static async post(url: string, body: any, headers: Record<string, string> = {}): Promise<HttpResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: HttpRequest = {
      method: 'POST',
      url,
      body,
      headers
    }

    const response = await window.llmApi.httpRequest(request)
    return {
      data: response.data,
      status: response.status,
      statusText: response.status < 400 ? 'OK' : 'Error',
      headers: response.headers,
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    }
  }

  static async getBinary(url: string, headers: Record<string, string> = {}): Promise<HttpBinaryResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: HttpRequest = {
      method: 'GET',
      url,
      headers,
      binary: true
    }

    const response = await window.llmApi.httpRequest(request)
    return {
      data: response.data,
      status: response.status,
      statusText: response.status < 400 ? 'OK' : 'Error',
      headers: response.headers,
      body: response.data
    }
  }

  static binaryResponseToArrayBuffer(response: HttpBinaryResponse): ArrayBuffer {
    return new Uint8Array(response.data).buffer
  }
}

// Service Types (exported for use by other services)
export type OAuthProviderKey = 'generic'

export interface OAuthCredentials {
  endpoint?: string
  clientId: string
  clientSecret: string
  scope?: string
  grantType?: string
  provider?: OAuthProviderKey
}

export interface OAuthToken {
  accessToken: string
  expiresAt: number // epoch millis
  raw: any
}

export type LLMProviderKey = 'bedrockClaudeSonnet'

export interface LLMConfig {
  endpoint?: string
  provider?: LLMProviderKey
  model?: string
  maxTokens?: number
  temperature?: number
}

// HTTP Service
export class HttpService {
  /**
   * Make an HTTP request through the Electron backend
   */
  static async request(request: HttpRequest): Promise<HttpResponse> {
    if (request.method === 'GET') {
      return await NativeHttpService.get(request.url, request.headers)
    } else if (request.method === 'POST') {
      return await NativeHttpService.post(request.url, request.body, request.headers)
    } else {
      throw new Error(`Unsupported HTTP method: ${request.method}`)
    }
  }

  /**
   * Convenience method for GET requests
   */
  static async get(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
    return await NativeHttpService.get(url, headers)
  }

  /**
   * Convenience method for POST requests
   */
  static async post(
    url: string,
    body: string,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse> {
    return await NativeHttpService.post(url, body, headers)
  }

  /**
   * Convenience method for POST requests with JSON body
   */
  static async postJson(
    url: string,
    data: any,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse> {
    const jsonHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    }
    
    return this.post(url, JSON.stringify(data), jsonHeaders)
  }

  /**
   * Make a GET request and return binary data
   */
  static async getBinary(url: string, headers: Record<string, string> = {}): Promise<HttpBinaryResponse> {
    return await NativeHttpService.getBinary(url, headers)
  }

  /**
   * Convert binary response to ArrayBuffer
   */
  static binaryResponseToArrayBuffer(response: HttpBinaryResponse): ArrayBuffer {
    return NativeHttpService.binaryResponseToArrayBuffer(response)
  }
}
