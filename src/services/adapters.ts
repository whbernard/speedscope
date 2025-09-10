// Electron IPC adapters for backend services

export interface LlmApi {
  oauthRequest: (request: OAuthRequest) => Promise<OAuthResponse>
  llmRequest: (request: LLMRequest) => Promise<LLMResponse>
  httpRequest: (request: HttpRequest) => Promise<HttpResponse>
  storeToken: (data: {
    service: string
    account: string
    token: string
  }) => Promise<{success: boolean}>
  getToken: (data: {service: string; account: string}) => Promise<{token: string | null}>
  deleteToken: (data: {service: string; account: string}) => Promise<{success: boolean}>
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
  grant_type: string
  scope: string
  client_id_field: string
  client_secret_field: string
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
  prompt: string
  profile_data: string
  access_token?: string
  max_tokens: number
  temperature: number
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
  private static readonly OAUTH_ENDPOINT = 'https://api.example.com/oauth/token'
  private static readonly GRANT_TYPE = 'client_credentials'
  private static readonly SCOPE = 'api'
  private static readonly CLIENT_ID_FIELD = 'client_id'
  private static readonly CLIENT_SECRET_FIELD = 'client_secret'

  static async requestToken(clientId: string, clientSecret: string): Promise<OAuthResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: OAuthRequest = {
      endpoint: this.OAUTH_ENDPOINT,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: this.GRANT_TYPE,
      scope: this.SCOPE,
      client_id_field: this.CLIENT_ID_FIELD,
      client_secret_field: this.CLIENT_SECRET_FIELD,
    }

    return await window.llmApi.oauthRequest(request)
  }
}

// LLM Adapter
export class LLMAdapter {
  private static readonly LLM_ENDPOINT = 'https://api.anthropic.com/v1/messages'
  private static readonly DEFAULT_MAX_TOKENS = 2000
  private static readonly DEFAULT_TEMPERATURE = 0.7

  static async sendPrompt(
    prompt: string,
    profileData: string,
    accessToken: string | undefined,
  ): Promise<LLMResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: LLMRequest = {
      endpoint: this.LLM_ENDPOINT,
      prompt,
      profile_data: profileData,
      access_token: accessToken,
      max_tokens: this.DEFAULT_MAX_TOKENS,
      temperature: this.DEFAULT_TEMPERATURE,
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
      headers,
    }

    const response = await window.llmApi.httpRequest(request)
    return {
      data: response.data,
      status: response.status,
      statusText: response.status < 400 ? 'OK' : 'Error',
      headers: response.headers,
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    }
  }

  static async post(
    url: string,
    body: any,
    headers: Record<string, string> = {},
  ): Promise<HttpResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: HttpRequest = {
      method: 'POST',
      url,
      body,
      headers,
    }

    const response = await window.llmApi.httpRequest(request)
    return {
      data: response.data,
      status: response.status,
      statusText: response.status < 400 ? 'OK' : 'Error',
      headers: response.headers,
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    }
  }

  static async getBinary(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<HttpBinaryResponse> {
    if (!window.llmApi) {
      throw new Error('Electron API not available')
    }

    const request: HttpRequest = {
      method: 'GET',
      url,
      headers,
      binary: true,
    }

    const response = await window.llmApi.httpRequest(request)
    return {
      data: response.data,
      status: response.status,
      statusText: response.status < 400 ? 'OK' : 'Error',
      headers: response.headers,
      body: response.data,
    }
  }

  static binaryResponseToArrayBuffer(response: HttpBinaryResponse): ArrayBuffer {
    return new Uint8Array(response.data).buffer
  }
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
    headers: Record<string, string> = {},
  ): Promise<HttpResponse> {
    return await NativeHttpService.post(url, body, headers)
  }

  /**
   * Convenience method for POST requests with JSON body
   */
  static async postJson(
    url: string,
    data: any,
    headers: Record<string, string> = {},
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
  static async getBinary(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<HttpBinaryResponse> {
    return await NativeHttpService.getBinary(url, headers)
  }

  /**
   * Convert binary response to ArrayBuffer
   */
  static binaryResponseToArrayBuffer(response: HttpBinaryResponse): ArrayBuffer {
    return NativeHttpService.binaryResponseToArrayBuffer(response)
  }
}
