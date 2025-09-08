/**
 * API Configuration - Simple URL definitions
 * 
 * This file contains only the URLs that are being called by the application.
 * All other configuration logic has been moved to the service classes.
 */

/**
 * OAuth Provider URLs
 */
export const OAUTH_URLS = {
  /** Generic OAuth 2.0 token endpoint */
  generic: 'https://api.example.com/oauth/token',
} as const

/**
 * LLM Provider URLs
 */
export const LLM_URLS = {
  /** AWS Bedrock Claude Sonnet endpoint */
  bedrockClaudeSonnet: 'https://bedrock-runtime.amazonaws.com/model/anthropic.claude-3-sonnet-20240229-v1:0/invoke',
} as const

/**
 * Get OAuth URL by provider name
 */
export function getOAuthUrl(provider: keyof typeof OAUTH_URLS = 'generic'): string {
  return OAUTH_URLS[provider]
}

/**
 * Get LLM URL by provider name
 */
export function getLLMUrl(provider: keyof typeof LLM_URLS = 'bedrockClaudeSonnet'): string {
  return LLM_URLS[provider]
}