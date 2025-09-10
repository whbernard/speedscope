// Analysis Service - Uses both OAuth and LLM adapters to provide complete analysis
import {OAuthAdapter, LLMAdapter, OAuthCredentials, LLMConfig} from './adapters'

export interface AnalysisRequest {
  prompt: string
  profileData: string
  oauthCredentials: OAuthCredentials
  llmConfig: LLMConfig
}

export interface AnalysisResponse {
  content: string
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

/**
 * High-level service that orchestrates OAuth authentication and LLM analysis
 * Uses both OAuth and LLM adapters to provide a complete analysis workflow
 */
export class AnalysisService {
  /**
   * Perform complete analysis with OAuth authentication
   * 1. Authenticate using OAuth credentials
   * 2. Send prompt and profile data to LLM with access token
   * 3. Return the analysis result
   */
  static async analyzeProfile(request: AnalysisRequest): Promise<AnalysisResponse> {
    // Step 1: Get OAuth token using OAuth adapter (with hardcoded endpoint, grant_type, and scope)
    const oauthResponse = await OAuthAdapter.requestToken(
      request.oauthCredentials.clientId,
      request.oauthCredentials.clientSecret,
      // endpoint, grant_type, and scope are now hardcoded in OAuthAdapter
    )

    // Step 2: Send prompt to LLM using LLM adapter with the access token (with hardcoded endpoint, provider, etc.)
    const llmResponse = await LLMAdapter.sendPrompt(
      request.prompt,
      request.profileData,
      oauthResponse.access_token,
      // endpoint, provider, max_tokens, and temperature are now hardcoded in LLMAdapter
    )

    return llmResponse
  }

  /**
   * Convenience method for simple analysis with hardcoded configurations
   */
  static async quickAnalysis(
    prompt: string,
    profileData: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const response = await this.analyzeProfile({
      prompt,
      profileData,
      oauthCredentials: {
        clientId,
        clientSecret,
        // endpoint, grantType, and scope are now hardcoded in OAuthAdapter
      },
      llmConfig: {
        // endpoint, provider, maxTokens, and temperature are now hardcoded in LLMAdapter
      },
    })

    return response.content
  }
}
