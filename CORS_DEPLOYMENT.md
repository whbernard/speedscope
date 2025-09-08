# CORS Deployment Guide

This guide explains how to deploy Speedscope with LLM in production while handling CORS (Cross-Origin Resource Sharing) issues.

## Development vs Production

### Development
- Uses a local proxy server (`scripts/proxy-server.ts`) running on port 3001
- Automatically detects localhost and routes requests through the proxy
- Prevents CORS errors during development

### Production
- Requires proper CORS configuration on your web server or backend
- No proxy server needed - requests go directly to OAuth and LLM endpoints

## Production Deployment Options

### Option 1: Web Server CORS Configuration

Configure your web server (nginx, Apache, etc.) to handle CORS:

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Serve the built application
    location / {
        root /path/to/speedscope/build;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy OAuth requests
    location /api/oauth {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        proxy_pass https://api.example.com/oauth/token;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Proxy LLM requests
    location /api/llm/ {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        proxy_pass https://bedrock-runtime.amazonaws.com/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Backend API Service

Create a backend service to handle OAuth and LLM requests:

#### Express.js Backend Example
```javascript
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Enable CORS
app.use(cors({
  origin: ['https://your-domain.com'],
  credentials: true
}));

// OAuth proxy
app.use('/api/oauth', createProxyMiddleware({
  target: 'https://api.example.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/oauth': '/oauth/token'
  }
}));

// LLM proxy
app.use('/api/llm', createProxyMiddleware({
  target: 'https://bedrock-runtime.amazonaws.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/llm': ''
  }
}));

app.listen(3001, () => {
  console.log('Backend API server running on port 3001');
});
```

### Option 3: Serverless Functions

Deploy serverless functions to handle API requests:

#### AWS Lambda Example
```javascript
exports.handler = async (event) => {
  const { httpMethod, path, headers, body } = event;
  
  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }
  
  // Proxy OAuth requests
  if (path.startsWith('/api/oauth')) {
    // Forward to OAuth endpoint
    const response = await fetch('https://api.example.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    });
    
    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(await response.json())
    };
  }
  
  // Similar logic for LLM requests...
};
```

## Environment Configuration

### Development
```bash
# Start both proxy and dev server
npm run dev:full

# Or start them separately
npm run proxy    # Port 3001
npm run dev      # Port 8000
```

### Production
```bash
# Build the application
npm run build

# Serve the built files
npx serve build --listen 80
```

## Security Considerations

1. **CORS Origins**: Restrict CORS origins to your actual domain in production
2. **API Keys**: Never expose OAuth client secrets or API keys in client-side code
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Implement rate limiting on your proxy/backend
5. **Authentication**: Consider adding authentication to your proxy endpoints

## Testing CORS Configuration

Test your CORS setup with:

```bash
# Test OAuth endpoint
curl -X OPTIONS \
  -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://your-domain.com/api/oauth

# Test LLM endpoint
curl -X OPTIONS \
  -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://your-domain.com/api/llm/model/anthropic.claude-3-sonnet-20240229-v1:0/invoke
```

## Troubleshooting

### Common CORS Errors
- **"Access to fetch at 'X' from origin 'Y' has been blocked by CORS policy"**
  - Solution: Configure proper CORS headers on your server

- **"Preflight request doesn't pass access control check"**
  - Solution: Handle OPTIONS requests properly

- **"Request header field authorization is not allowed"**
  - Solution: Add 'Authorization' to Access-Control-Allow-Headers

### Debug Tips
1. Check browser developer tools Network tab
2. Verify CORS headers in response
3. Test with curl to isolate client vs server issues
4. Use browser extensions to disable CORS (development only)
