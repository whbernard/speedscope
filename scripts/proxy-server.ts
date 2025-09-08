/**
 * Development Proxy Server for OAuth and LLM Requests
 * 
 * This proxy server runs during development to handle cross-origin requests
 * to OAuth and LLM APIs, preventing CORS errors in the browser.
 * 
 * In production, you should configure your web server or use a proper
 * backend service to handle these requests.
 */

import {createProxyMiddleware} from 'http-proxy-middleware'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:8000', 'http://127.0.0.1:8000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// OAuth proxy - forwards requests to OAuth endpoints
app.use('/api/oauth', createProxyMiddleware({
  target: 'https://api.example.com', // Default target, will be overridden by X-Target-URL
  changeOrigin: true,
  pathRewrite: {
    '^/api/oauth': '/oauth/token' // Rewrite /api/oauth to /oauth/token
  },
  router: (req) => {
    // Use X-Target-URL header to determine the actual target
    const targetUrl = req.headers['x-target-url'] as string
    if (targetUrl) {
      const url = new URL(targetUrl)
      return `${url.protocol}//${url.host}`
    }
    return 'https://api.example.com'
  },
  onProxyReq: (proxyReq, req, res) => {
    // Remove the X-Target-URL header before forwarding
    proxyReq.removeHeader('X-Target-URL')
    
    // Log the request being proxied
    const targetUrl = req.headers['x-target-url'] as string
    console.log(`Proxying OAuth request to: ${targetUrl || 'default'}`)
  },
  onError: (err, req, res) => {
    console.error('OAuth proxy error:', err)
    res.status(500).json({ error: 'OAuth proxy error', details: err.message })
  }
}))

// LLM proxy - forwards requests to LLM endpoints
app.use('/api/llm', createProxyMiddleware({
  target: 'https://bedrock-runtime.amazonaws.com', // Default LLM endpoint
  changeOrigin: true,
  pathRewrite: {
    '^/api/llm': '' // Remove /api/llm prefix
  },
  router: (req) => {
    // Use X-Target-URL header to determine the actual target
    const targetUrl = req.headers['x-target-url'] as string
    if (targetUrl) {
      const url = new URL(targetUrl)
      return `${url.protocol}//${url.host}`
    }
    return 'https://bedrock-runtime.amazonaws.com'
  },
  onProxyReq: (proxyReq, req, res) => {
    // Remove the X-Target-URL header before forwarding
    proxyReq.removeHeader('X-Target-URL')
    
    // Log the request being proxied
    const targetUrl = req.headers['x-target-url'] as string
    console.log(`Proxying LLM request to: ${targetUrl || 'default'}`)
  },
  onError: (err, req, res) => {
    console.error('LLM proxy error:', err)
    res.status(500).json({ error: 'LLM proxy error', details: err.message })
  }
}))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start the proxy server
app.listen(PORT, () => {
  console.log(`🚀 Development proxy server running on http://localhost:${PORT}`)
  console.log(`📡 OAuth requests: http://localhost:${PORT}/api/oauth`)
  console.log(`🤖 LLM requests: http://localhost:${PORT}/api/llm`)
  console.log(`❤️  Health check: http://localhost:${PORT}/health`)
})

export default app
