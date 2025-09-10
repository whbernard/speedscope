// Analysis Service - Uses both OAuth and LLM adapters to provide complete analysis
import {OAuthAdapter, LLMAdapter} from './adapters'

export interface AnalysisRequest {
  prompt: string
  profileData: string
  clientId: string
  clientSecret: string
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
    // Step 1: Get OAuth token using OAuth adapter
    const oauthResponse = await OAuthAdapter.requestToken(request.clientId, request.clientSecret)

    // Step 2: Send prompt to LLM using LLM adapter with the access token
    const llmResponse = await LLMAdapter.sendPrompt(
      request.prompt,
      request.profileData,
      oauthResponse.access_token,
    )

    return llmResponse
  }
}
