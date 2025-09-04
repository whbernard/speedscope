# LLM Integration for Speedscope

This document describes the "Send to LLM" feature that allows users to send profiling data to Large Language Models for intelligent analysis and insights.

## Overview

The "Send to LLM" feature enables users to:
- Select a time interval from the flamegraph
- Send the filtered profiling data to an LLM API
- Receive intelligent analysis and recommendations
- Get actionable insights for performance optimization
- Use flexible authentication (API key or OAuth)

## Features

### 🤖 LLM Analysis
- **Default Endpoint**: OpenAI GPT-4 API (`https://api.openai.com/v1/chat/completions`)
- **Configurable**: Users can specify any LLM inference URL
- **Sample Prompts**: Pre-defined analysis prompts for common use cases
- **Custom Prompts**: Users can enter their own analysis requests

### 🔐 Authentication Options
- **API Key Authentication**: Simple API key-based authentication
- **OAuth Authentication**: Enterprise-grade OAuth 2.0 password grant flow
- **Secure**: No credentials are stored, must be provided each time
- **Flexible**: Support for custom OAuth endpoints

### 📊 Sample Analysis Prompts

1. **Identify performance bottlenecks** in this profile data
2. **Find the most time-consuming functions**
3. **Analyze the call stack patterns** and suggest optimizations
4. **Identify potential memory leaks** or inefficient algorithms
5. **Compare this profile** with typical performance patterns
6. **Suggest specific code improvements** based on the profiling data

### 🎯 Time Interval Selection
- **Zoom-based**: Select intervals by zooming and panning the flamegraph
- **Visual feedback**: See the selected time range in real-time
- **Duration display**: Shows total and selected duration
- **Unit awareness**: Displays appropriate time units (samples, milliseconds, etc.)

## Usage

### Basic Workflow

1. **Load a profile** in Speedscope
2. **Zoom and pan** to focus on the time interval of interest
3. **Click "Send to LLM"** button in the toolbar
4. **Review the selected interval** in the modal
5. **Configure authentication**:
   - Choose between OAuth or API key authentication
   - If OAuth: Provide OAuth endpoint, username, and password
   - If API key: Provide your API key
6. **Choose an analysis prompt** or enter a custom one
7. **Receive analysis** with insights and recommendations

### Authentication Configuration

#### API Key Authentication
- **Simple Setup**: Just provide your API key when prompted
- **No Storage**: API keys are not stored and must be entered each time
- **Compatible**: Works with most LLM services (OpenAI, Anthropic, etc.)

#### OAuth Authentication
- **Enterprise Ready**: Supports OAuth 2.0 client credentials flow
- **Secure**: Credentials are not stored and must be provided each time
- **Flexible**: Works with any OAuth-compliant authentication server
- **Simple Configuration**: Direct input of OAuth endpoint, client ID, and client secret
- **Client Credentials**: Uses OAuth 2.0 client credentials grant flow

## Technical Implementation

### Data Flow

1. **Profile Filtering**: The selected time interval is filtered from the original profile
2. **Data Serialization**: Profile data is converted to JSON format
3. **Authentication**: OAuth token is obtained or API key is used
4. **LLM Request**: Data is sent with analysis prompt to LLM API
5. **Response Processing**: LLM analysis is extracted and displayed
6. **User Feedback**: Results are shown in an alert dialog

### OAuth Flow

When OAuth authentication is selected:

1. **Single Dialog Configuration**: User provides all OAuth details in one dialog:
   - **Format**: Three lines separated by newlines
   - **Line 1**: OAuth URL (e.g., `https://your-oauth-server.com/oauth/token`)
   - **Line 2**: CLIENT_ID
   - **Line 3**: CLIENT_SECRET
2. **Token Request**: Application sends OAuth client credentials grant request:
   ```javascript
   POST /oauth/token
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=client_credentials&client_id=<client_id>&client_secret=<client_secret>
   ```
3. **Token Extraction**: Access token is extracted from the OAuth response
4. **API Authentication**: Access token is used for LLM API requests

### Request Format

```javascript
{
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: 'You are a performance analysis expert...'
    },
    {
      role: 'user',
      content: `${analysisPrompt}\n\nProfile data:\n${jsonData}`
    }
  ],
  max_tokens: 2000,
  temperature: 0.3
}
```

### Error Handling

- **Network errors**: Graceful handling with user-friendly messages
- **API errors**: Status code and message display
- **OAuth errors**: Specific handling for authentication failures
- **Configuration errors**: Guidance for endpoint and credential setup
- **Data errors**: Validation and fallback mechanisms

## Benefits

### For Developers
- **Quick insights**: Get immediate analysis without manual interpretation
- **Expert guidance**: Leverage LLM expertise for performance optimization
- **Actionable recommendations**: Receive specific improvement suggestions
- **Time savings**: Automate routine performance analysis tasks
- **Flexible authentication**: Choose the authentication method that fits your environment

### For Teams
- **Consistent analysis**: Standardized approach to performance review
- **Knowledge sharing**: LLM insights can be shared and discussed
- **Documentation**: Analysis results can be saved for future reference
- **Training**: Help team members learn performance analysis techniques
- **Enterprise security**: OAuth support for secure enterprise environments

## Future Enhancements

### Planned Features
- **Analysis history**: Save and review previous LLM analyses
- **Custom templates**: User-defined analysis prompt templates
- **Batch processing**: Analyze multiple profiles simultaneously
- **Integration**: Connect with CI/CD pipelines for automated analysis
- **Export options**: Save analysis results in various formats
- **OAuth refresh**: Automatic token refresh for long-running sessions
- **Credential management**: Secure credential storage options

### Potential Integrations
- **GitHub**: Link analyses to specific commits or pull requests
- **Slack**: Send analysis results to team channels
- **JIRA**: Create tickets based on performance issues
- **Monitoring**: Integrate with APM tools for continuous analysis

## Security Considerations

### Data Privacy
- **Local processing**: Profile data is processed locally before sending
- **Minimal data**: Only necessary profiling information is transmitted
- **User control**: Users choose what data to send and when
- **No persistence**: Analysis data is not stored by Speedscope

### Authentication Security
- **No credential storage**: API keys and OAuth credentials are never stored
- **Client credentials security**: OAuth client secrets must be provided each time and are never saved
- **Secure transmission**: HTTPS for all API communications
- **OAuth standards**: Uses standard OAuth 2.0 client credentials grant flow
- **User control**: Users manage their own authentication credentials

### API Security
- **Secure transmission**: HTTPS for all API communications
- **Key management**: Users manage their own API keys
- **Rate limiting**: Respect API rate limits and quotas
- **Error handling**: Secure error messages without sensitive data

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - **API Key**: Ensure you've provided a valid API key
   - **OAuth**: Verify OAuth endpoint, client ID, and client secret are correct
   - **Permissions**: Check that credentials have necessary API permissions

2. **Endpoint Issues**
   - **LLM Endpoint**: Check the LLM inference URL is correct
   - **OAuth Endpoint**: Verify the OAuth token endpoint URL
   - **Format Support**: Ensure endpoints support the required request format

3. **Network Problems**
   - Check your internet connection
   - Verify firewall settings allow API access
   - Check for corporate proxy or VPN issues

4. **Data Format Issues**
   - Ensure the profile data is valid
   - Check for any data corruption or format issues

### OAuth-Specific Issues

1. **Token Acquisition Failure**
   - Verify OAuth endpoint URL is correct
   - Check client ID and client secret are valid
   - Ensure OAuth server supports client credentials grant flow
   - Check OAuth server is accessible from your network

2. **Invalid Token Response**
   - Verify OAuth server returns standard OAuth response format
   - Check that `access_token` field is present in response
   - Ensure token has sufficient scope for LLM API access

3. **Configuration Issues**
   - Verify your OAuth configuration has exactly 3 lines
   - Check that OAuth URL, CLIENT_ID, and CLIENT_SECRET are valid
   - Ensure the OAuth endpoint matches your provider's documentation

### Getting Help

- **Console logs**: Check browser console for detailed error messages
- **Network tab**: Review API requests and responses in browser dev tools
- **Documentation**: Refer to LLM provider and OAuth server documentation
- **Community**: Check Speedscope GitHub issues for similar problems
