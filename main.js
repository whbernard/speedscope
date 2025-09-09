const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const axios = require('axios')
const keytar = require('keytar')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs').promises

// Set the app name before app is ready
app.setName('Speedscope with LLM')
console.log('App name set to:', app.getName())

// Also set the app user model ID for Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.speedscope.llm')
}

// Note: app.dock is only available after app is ready

// Also set the about panel options
app.setAboutPanelOptions({
  applicationName: 'Speedscope with LLM',
  applicationVersion: '1.23.1',
  copyright: 'MIT License',
  description: 'Interactive flamegraph visualizer with AI-powered analysis'
})

// Keep a global reference of the window object
let mainWindow

// Configuration
let config = null

// Load configuration
async function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json')
    const configData = await fs.readFile(configPath, 'utf8')
    config = JSON.parse(configData)
    console.log('Configuration loaded successfully')
  } catch (error) {
    console.error('Failed to load config.json:', error)
    // Use default config if file doesn't exist
    config = {
      oauth: {
        endpoint: "https://your-oauth-provider.com/oauth/token",
        grant_type: "client_credentials",
        scope: "api",
        client_id_field: "client_id",
        client_secret_field: "client_secret",
        response_schema: {
          access_token_field: "access_token",
          expires_in_field: "expires_in",
          token_type_field: "token_type"
        }
      },
      llm: {
        endpoint: "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-sonnet-20240229-v1:0/invoke",
        provider: "bedrockClaudeSonnet",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        max_tokens: 2000,
        temperature: 0.7,
        custom_headers: {
          "X-API-Key": "{{API_KEY}}",
          "X-Custom-Header": "custom-value",
          "Authorization": "Bearer {{ACCESS_TOKEN}}",
          "X-Request-ID": "{{REQUEST_ID}}"
        },
        request_schema: {
          messages: [
            {
              role: "user",
              content: [
                {
                  text: "{{prompt}}"
                }
              ]
            }
          ],
          system: [
            {
              text: "You are a performance analysis expert. Analyze the provided profiling data and provide insights about performance bottlenecks, optimization opportunities, and recommendations.\n\nProfile data:\n{{profile_data}}"
            }
          ],
          inferenceConfig: {
            maxTokens: 2000,
            temperature: 0.7,
            topP: 0.9,
            stopSequences: []
          }
        }
      }
    }
  }
}

// Replace template variables in strings
function replaceTemplateVariables(text, variables) {
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    result = result.replace(new RegExp(placeholder, 'g'), value || '')
  }
  return result
}

// URL validation
function isAllowedUrl(url) {
  try {
    const parsedUrl = new URL(url)
    const allowedProtocols = ['http:', 'https:']
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return false
    }
    
    // Block localhost and private IPs for security
    const hostname = parsedUrl.hostname
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}

// Rate limiting
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10

function checkRateLimit(ip) {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, [])
  }
  
  const requests = rateLimitMap.get(ip)
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart)
  rateLimitMap.set(ip, validRequests)
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }
  
  validRequests.push(now)
  return true
}

// Create the main window
function createWindow() {
  // Use PNG icon for all platforms to avoid loading issues
  let iconPath = path.join(__dirname, 'build', 'icon.png')
  console.log('Platform:', process.platform)
  console.log('Icon path:', iconPath)
  console.log('Icon exists:', require('fs').existsSync(iconPath))
  
  // If icon doesn't exist in build directory, try the assets directory
  if (!require('fs').existsSync(iconPath)) {
    const fallbackPath = path.join(__dirname, 'assets', 'icon.png')
    console.log('Trying fallback icon path:', fallbackPath)
    console.log('Fallback exists:', require('fs').existsSync(fallbackPath))
    if (require('fs').existsSync(fallbackPath)) {
      iconPath = fallbackPath
    }
  }
  
  // Try absolute path as last resort
  if (!require('fs').existsSync(iconPath)) {
    const absolutePath = path.resolve(__dirname, 'build', 'icon.icns')
    console.log('Trying absolute path:', absolutePath)
    console.log('Absolute path exists:', require('fs').existsSync(absolutePath))
    if (require('fs').existsSync(absolutePath)) {
      iconPath = absolutePath
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    icon: iconPath,
    title: 'Speedscope with LLM',
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  
  // Set the window title explicitly
  mainWindow.setTitle('Speedscope with LLM')
  
  // Set the dock icon for macOS (only after app is ready)
  if (process.platform === 'darwin' && iconPath && app.dock) {
    try {
      app.dock.setIcon(iconPath)
      console.log('Dock icon set to:', iconPath)
    } catch (error) {
      console.log('Failed to set dock icon:', error.message)
    }
  }

  // Load the app
  mainWindow.loadFile('build/index.html').catch(err => {
    console.error('Failed to load index.html:', err)
  })

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

  // Add error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed')
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('Renderer process became unresponsive')
  })

  // Listen for console messages from the renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Renderer console [${level}]:`, message)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show')
    mainWindow.show()
  })
}

// App event handlers
app.whenReady().then(async () => {
  await loadConfig()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers

// OAuth Request Handler
ipcMain.handle('oauth-request', async (event, request) => {
  try {
    if (!isAllowedUrl(request.endpoint)) {
      throw new Error('URL not allowed for security reasons')
    }

    if (!checkRateLimit('oauth')) {
      throw new Error('Rate limit exceeded')
    }

    const payload = {
      [config.oauth.client_id_field]: request.client_id,
      [config.oauth.client_secret_field]: request.client_secret,
      grant_type: request.grant_type || config.oauth.grant_type,
      scope: request.scope || config.oauth.scope
    }

    const response = await axios.post(request.endpoint, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    })

    const responseData = response.data
    return {
      access_token: responseData[config.oauth.response_schema.access_token_field],
      expires_in: responseData[config.oauth.response_schema.expires_in_field],
      token_type: responseData[config.oauth.response_schema.token_type_field]
    }
  } catch (error) {
    console.error('OAuth request failed:', error)
    throw new Error(`OAuth request failed: ${error.message}`)
  }
})

// LLM Request Handler
ipcMain.handle('llm-request', async (event, request) => {
  try {
    if (!isAllowedUrl(request.endpoint)) {
      throw new Error('URL not allowed for security reasons')
    }

    if (!checkRateLimit('llm')) {
      throw new Error('Rate limit exceeded')
    }

    // Build payload based on request schema
    let payload = {}
    
    if (request.request_schema && request.request_schema.messages) {
      // Bedrock format
      const messages = request.request_schema.messages.map(msgTemplate => {
        const content = msgTemplate.content.map(contentItem => ({
          text: replaceTemplateVariables(contentItem.text, {
            prompt: request.prompt,
            profile_data: request.profile_data
          })
        }))
        return {
          role: msgTemplate.role,
          content
        }
      })
      payload.messages = messages

      if (request.request_schema.system) {
        const system = request.request_schema.system.map(sysItem => ({
          text: replaceTemplateVariables(sysItem.text, {
            prompt: request.prompt,
            profile_data: request.profile_data
          })
        }))
        payload.system = system
      }

      if (request.request_schema.inferenceConfig) {
        payload.inferenceConfig = request.request_schema.inferenceConfig
      }
    } else {
      // Legacy format
      payload = {
        prompt: request.prompt,
        max_tokens: request.max_tokens || 2000,
        temperature: request.temperature || 0.7
      }
    }

    // Build headers
    const headers = {
      'Content-Type': 'application/json'
    }

    // Add custom headers with template variable replacement
    if (request.custom_headers) {
      for (const [key, value] of Object.entries(request.custom_headers)) {
        const headerValue = replaceTemplateVariables(value, {
          prompt: request.prompt,
          profile_data: request.profile_data,
          ACCESS_TOKEN: request.access_token || '',
          API_KEY: process.env.API_KEY || '',
          REQUEST_ID: uuidv4(),
          LLM_API_KEY: process.env.LLM_API_KEY || '',
          AUTH_TOKEN: process.env.AUTH_TOKEN || '',
          USER_ID: process.env.USER_ID || ''
        })
        headers[key] = headerValue
      }
    }

    // Override Authorization header if access_token is provided
    if (request.access_token) {
      headers.Authorization = `Bearer ${request.access_token}`
    }

    const response = await axios.post(request.endpoint, payload, {
      headers,
      timeout: 60000
    })

    // Parse response based on provider
    let content = ''
    let usage = null

    if (request.provider === 'bedrockClaudeSonnet') {
      // Bedrock response format
      const responseData = response.data
      if (responseData.content && responseData.content.length > 0) {
        content = responseData.content[0].text
      }
      if (responseData.usage) {
        usage = {
          input_tokens: responseData.usage.inputTokens,
          output_tokens: responseData.usage.outputTokens,
          total_tokens: responseData.usage.inputTokens + responseData.usage.outputTokens
        }
      }
    } else if (request.provider === 'anthropic') {
      // Anthropic response format
      content = response.data.content[0].text
      usage = response.data.usage
    } else {
      // OpenAI or other format
      content = response.data.choices[0].message.content
      usage = response.data.usage
    }

    return {
      content,
      usage
    }
  } catch (error) {
    console.error('LLM request failed:', error)
    throw new Error(`LLM request failed: ${error.message}`)
  }
})

// HTTP Request Handler
ipcMain.handle('http-request', async (event, request) => {
  try {
    if (!isAllowedUrl(request.url)) {
      throw new Error('URL not allowed for security reasons')
    }

    if (!checkRateLimit('http')) {
      throw new Error('Rate limit exceeded')
    }

    const response = await axios({
      method: request.method || 'GET',
      url: request.url,
      data: request.body,
      headers: request.headers || {},
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit
      responseType: request.binary ? 'arraybuffer' : 'json'
    })

    if (request.binary) {
      return {
        data: Array.from(new Uint8Array(response.data)),
        status: response.status,
        headers: response.headers
      }
    }

    return {
      data: response.data,
      status: response.status,
      headers: response.headers
    }
  } catch (error) {
    console.error('HTTP request failed:', error)
    throw new Error(`HTTP request failed: ${error.message}`)
  }
})

// Keychain handlers
ipcMain.handle('store-token', async (event, { service, account, token }) => {
  try {
    await keytar.setPassword(service, account, token)
    return { success: true }
  } catch (error) {
    console.error('Failed to store token:', error)
    throw new Error(`Failed to store token: ${error.message}`)
  }
})

ipcMain.handle('get-token', async (event, { service, account }) => {
  try {
    const token = await keytar.getPassword(service, account)
    return { token }
  } catch (error) {
    console.error('Failed to get token:', error)
    throw new Error(`Failed to get token: ${error.message}`)
  }
})

ipcMain.handle('delete-token', async (event, { service, account }) => {
  try {
    const result = await keytar.deletePassword(service, account)
    return { success: result }
  } catch (error) {
    console.error('Failed to delete token:', error)
    throw new Error(`Failed to delete token: ${error.message}`)
  }
})

// Config handler
ipcMain.handle('load-config', async () => {
  return config
})
