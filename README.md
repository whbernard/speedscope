# 🔬Speedscope with LLM 
A fast, interactive web-based viewer for performance profiles with **AI-powered analysis**. Supports import from a variety of profiles in a variety of languages (JS, Ruby, Python, Go & more).

## ⚡ Quick Start

### 🖥️ Desktop App (Recommended)
```bash
git clone https://github.com/whbernard/speedscope.git
cd speedscope
npm install
npm run electron:dev
```

### 🌐 Web Version
```bash
git clone https://github.com/whbernard/speedscope.git
cd speedscope
npm install
npm run dev
# Open http://localhost:8000
```


## 📋 Requirements

- **Node.js LTS (18+)** - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)

> **Note**: The web version works on all platforms. Desktop app requires additional setup for Windows/Linux.

## 🏗️ Commands

```bash
# Development
npm run electron:dev    # Desktop app
npm run dev            # Web version
npm run build          # Build for production

# Distribution
npm run electron:build # Create installers
```

## 🖥️ Desktop setup by platform

### macOS
- Install Xcode Command Line Tools: `xcode-select --install`
- Install Node.js LTS (18+) and npm
- Run the app in dev: `npm run electron:dev`
- Build a signed/notarized app (optional): set mac signing env or edit `electron-builder` config, then `npm run electron:build`

### Windows
- Install Node.js LTS (18+) and npm
- Install Visual Studio Build Tools (Desktop development with C++) from Microsoft (required by some native deps)
- Run the app in dev (PowerShell or CMD): `npm run electron:dev`
- Build an installer: `npm run electron:build`

### Linux (Debian/Ubuntu)
- Install system deps:
  - `sudo apt update && sudo apt install -y libgtk-3-0 libnss3 libxss1 libasound2 libxtst6 libx11-xcb1 gconf-service libgbm1`
- Install Node.js LTS (18+) and npm
- Run the app in dev: `npm run electron:dev`
- Build packages: `npm run electron:build` (produces `.AppImage`/`.deb` depending on config)

### Version Comparison

| Feature | Web Version | Desktop App |
|---------|-------------|-------------|
| **Setup** | ⚡ Instant | 🚀 Fast |
| **LLM Features** | ⚠️ Basic | ✅ Full |
| **Experience** | Browser | Native |

## 🧠 LLM Integration

- **AI Analysis**: Analyze profiling data with AI models
- **Custom Prompts**: Ask specific questions about your performance data
- **Secure Authentication**: OAuth integration with LLM providers
- **Real-time Insights**: Get instant analysis from your profiling data

Speedscope allows you to interactively explore profiling data to understand performance bottlenecks. The LLM integration provides AI-powered analysis and recommendations.

## 💻 Command Line Usage

```bash
# Or manually
git clone https://github.com/whbernard/speedscope.git
cd speedscope
npm install
npm run electron:dev
```

### Global CLI
```bash
npm install -g speedscope
speedscope /path/to/profile.json
```

## 🔧 Troubleshooting

**"Command not found: npm"**
- Install Node.js from [nodejs.org](https://nodejs.org/)

**"Missing script: electron:dev"**
```bash
cd speedscope
npm install
```

**Desktop app won't start**
```bash
npm run dev  # Use web version instead
```

**Permission denied on Linux**
```bash
sudo apt update && sudo apt install libwebkit2gtk-4.0-dev build-essential
```

### OAuth and LLM configuration (in code)

Configure OAuth/LLM entirely in code via the adapter methods shown below. You control the OAuth `endpoint`, fields (`client_id_field`, `client_secret_field`, `grant_type`, `scope`), and TLS (custom CA or disabled verification). For LLM, provide the `endpoint`, headers, and `request_schema` with `{{profile_data}}` and `{{prompt}}` placeholders.

---

## 🔌 Where to modify adapters

This app configures OAuth/LLM entirely in code. Adjust these files to change behavior:

- `src/services/adapters.ts`
  - `OAuthAdapter.requestToken(clientId, clientSecret, customConfig?)`
    - Set/override: `endpoint`, `grant_type`, `scope`, `client_id_field`, `client_secret_field`
    - TLS options (enable/disable CA verification):
      - `tls.ca_pem` (string PEM), or `tls.ca_path` (path to PEM)
      - `tls.disableCertValidation: boolean`
  - `LLMAdapter.sendPrompt(prompt, profileData, accessToken?, customConfig?)`
    - Provide: `endpoint`, `custom_headers`, and `request_schema`
    - `request_schema.system[].text` and `messages[].content[].text` support `{{profile_data}}` and `{{prompt}}`

- `main.js` (Electron backend)
  - OAuth IPC handler: search for `ipcMain.handle('oauth-request'` to see required request fields and TLS handling
  - LLM IPC handler: `ipcMain.handle('llm-request'` for how the payload is built and how `{{profile_data}}` is injected

Example: pass TLS and fields via adapters

```ts
// OAuth
await OAuthAdapter.requestToken(clientId, clientSecret, {
  endpoint: 'https://oauth.example.com/token',
  grant_type: 'client_credentials',
  scope: 'api',
  client_id_field: 'client_id',
  client_secret_field: 'client_secret',
  tls: {
    // choose one of these:
    // ca_pem: myCaPemString,
    // ca_path: '/path/to/ca.pem',
    // or disable verification for testing only
    // disableCertValidation: true
  }
})

// LLM
await LLMAdapter.sendPrompt(prompt, profileData, accessToken, {
  endpoint: 'https://api.anthropic.com/v1/messages',
  custom_headers: { Authorization: 'Bearer {{ACCESS_TOKEN}}' },
  request_schema: {
    messages: [{ role: 'user', content: [{ text: '{{prompt}}' }] }],
    system: [{ text: 'You are a performance analysis expert.\n\nProfile data:\n{{profile_data}}' }],
    inferenceConfig: { maxTokens: 2000, temperature: 0.7, topP: 0.9, stopSequences: [] }
  }
})
```

---

## 📚 More Information

For detailed configuration and advanced usage, see the project documentation.
