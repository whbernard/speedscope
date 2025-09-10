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

# Testing & Quality
npm test               # Run all tests (typecheck, lint, coverage)
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint code linting
npm run coverage       # Jest test coverage

# Distribution
npm run electron:build # Create installers
```

## 🔧 VS Code Development & Debugging

### Prerequisites
- **VS Code** with recommended extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Jest Runner
  - Thunder Client (for API testing)

### Project Setup
1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/whbernard/speedscope.git
   cd speedscope
   npm install
   ```

2. **Open in VS Code:**
   ```bash
   code .
   ```

### Running the App

#### Desktop App (Electron)
```bash
# Start development server
npm run electron:dev
```
- **Main Process**: Runs in Node.js context (main.js)
- **Renderer Process**: Runs in Chromium context (React app)
- **DevTools**: Automatically opens in development mode

#### Web Version
```bash
# Start web development server
npm run dev
# Open http://localhost:8000
```

### Debugging Configuration

Create a `.vscode/launch.json` file with the following configuration:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Electron (Main + Renderer)",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": [".", "--inspect=5858", "--remote-debugging-port=9222"],
      "outputCapture": "std",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      },
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true,
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ]
    },
    {
      "name": "Debug Electron Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": [".", "--inspect=5858"],
      "outputCapture": "std",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Electron Renderer",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": [".", "--remote-debugging-port=9222"],
      "outputCapture": "std",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      },
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```

#### Debugging Options:

1. **Debug Electron (Main + Renderer)** - Recommended
   - **Best for**: Full app debugging with both main and renderer processes
   - **Usage**: Press `F5` or select from Run & Debug panel
   - **Features**: 
     - Main process debugging on port 5858
     - Renderer process debugging on port 9222
     - Full breakpoint support in both contexts

2. **Debug Electron Main** - Main Process Only
   - **Best for**: Debugging IPC handlers, OAuth/LLM requests, file operations
   - **Usage**: Set breakpoints in `main.js` and related files
   - **Features**: Node.js debugging with full access to main process

3. **Debug Electron Renderer** - Renderer Process Only  
   - **Best for**: Debugging React components, frontend logic
   - **Usage**: Set breakpoints in `src/` files
   - **Features**: Chromium DevTools integration

4. **Debug Tests** - Jest Testing
   - **Best for**: Debugging individual test cases
   - **Usage**: Set breakpoints in test files, run specific tests
   - **Features**: Full Jest debugging with breakpoints

#### Additional VS Code Configuration

**Recommended Extensions** (`.vscode/extensions.json`):
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "firsttris.vscode-jest-runner",
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "rangav.vscode-thunder-client"
  ]
}
```

**Editor Settings** (`.vscode/settings.json`):
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "jest.jestCommandLine": "npm test --",
  "jest.autoRun": "off",
  "files.exclude": {
    "**/node_modules": true,
    "**/build": true,
    "**/dist": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/build": true,
    "**/dist": true,
    "**/coverage": true
  },
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

**Development Tasks** (`.vscode/tasks.json`):
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "npm: electron:dev",
      "type": "shell",
      "command": "npm",
      "args": ["run", "electron:dev"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "npm: test",
      "type": "shell",
      "command": "npm",
      "args": ["test"],
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "npm: typecheck",
      "type": "shell",
      "command": "npm",
      "args": ["run", "typecheck"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      },
      "problemMatcher": ["$tsc"]
    }
  ]
}
```

#### Frontend Debugging
- **React DevTools**: Install browser extension
- **Redux DevTools**: Available in development mode
- **Console Logging**: Use `console.log()` in renderer process
- **Network Tab**: Monitor API calls to OAuth/LLM endpoints

#### 3. Backend Debugging
- **Main Process Logs**: Check VS Code terminal output
- **IPC Communication**: Logs in main.js show IPC calls
- **API Requests**: Axios requests logged with full payloads
- **Error Handling**: Full request payloads shown in error modal

### Testing & Quality Assurance

#### Run Tests
```bash
# Run all tests
npm test

# Individual test commands
npm run typecheck      # TypeScript compilation
npm run lint           # Code style checking
npm run coverage       # Test coverage report
```

#### VS Code Test Integration
1. **Install Jest Runner extension**
2. **Run individual tests**: Click "Run" button above test functions
3. **Debug tests**: Set breakpoints and use "Debug" button
4. **Coverage**: View coverage in VS Code or open `coverage/lcov-report/index.html`

### Common Debugging Scenarios

#### 1. OAuth Authentication Issues
- **Check error modal**: Shows full request payload
- **Verify credentials**: Client ID/secret in adapter configuration
- **TLS issues**: Check CA certificate path or disable validation
- **Network**: Verify endpoint URL and firewall settings

#### 2. LLM API Problems
- **Request payload**: Full JSON shown in error modal
- **Template variables**: Check `{{profile_data}}` and `{{prompt}}` replacement
- **Headers**: Verify custom headers and authentication
- **Rate limiting**: Check API quotas and rate limits

#### 3. Profile Import Issues
- **File format**: Check supported formats in `src/import/`
- **File size**: Large files may timeout (10MB limit)
- **Parsing errors**: Check console for detailed error messages

#### 4. Performance Issues
- **Memory usage**: Monitor in DevTools Performance tab
- **Large profiles**: Consider using interval selection for analysis
- **WebGL**: Check browser compatibility and GPU drivers

### Development Workflow

#### 1. Making Changes
```bash
# Start development server
npm run electron:dev

# In another terminal, run tests
npm test

# Check for type errors
npm run typecheck
```

#### 2. Code Quality
- **ESLint**: Fixes auto-applied on save (if configured)
- **Prettier**: Code formatting on save
- **TypeScript**: Real-time type checking in VS Code

#### 3. Building & Distribution
```bash
# Build for production
npm run build

# Create desktop installers
npm run electron:build
```

### Troubleshooting

#### Common Issues
1. **"Electron API not available"**: Ensure running in Electron context
2. **"Config file not found"**: Normal warning, using defaults
3. **TypeScript errors**: Run `npm run typecheck` for details
4. **Build failures**: Check Node.js version (18+ required)

#### Getting Help
- **Console logs**: Check both main and renderer process logs
- **Error modals**: Full request context provided
- **DevTools**: Network, Console, and Performance tabs
- **GitHub Issues**: Report bugs with full error details

### 🔍 Debugging Verification

To verify VS Code debugging is working:

1. **Open VS Code** in the project directory:
   ```bash
   code .
   ```

2. **Set a breakpoint** in `main.js` (e.g., line 210 in the OAuth handler)

3. **Start debugging**:
   - Press `F5` or go to Run & Debug panel
   - Select "Debug Electron (Main + Renderer)"
   - The app should start and hit your breakpoint

4. **Test breakpoints**:
   - Set breakpoints in `src/views/application.tsx` for frontend debugging
   - Set breakpoints in `main.js` for backend debugging
   - Use the debug console to inspect variables

5. **Verify features**:
   - ✅ Main process debugging (Node.js context)
   - ✅ Renderer process debugging (React context)  
   - ✅ Breakpoint support in both processes
   - ✅ Variable inspection and watch expressions
   - ✅ Call stack navigation
   - ✅ Error modal with full request payloads

**Expected output when debugging starts:**
```
Debugger listening on ws://127.0.0.1:5858/...
DevTools listening on ws://127.0.0.1:9222/...
App name set to: Speedscope with LLM
Window ready to show
```

### 🔧 **Troubleshooting Breakpoint Issues**

If your breakpoints are "unbinding" (turning gray) after debug starts:

#### **1. Ensure Source Maps Are Generated**
```bash
# Check if source maps exist
ls -la build/*.map

# Rebuild with source maps
npm run build
```

#### **2. Fix VS Code Launch Configuration**
Add these properties to your launch.json:
```json
{
  "sourceMaps": true,
  "resolveSourceMapLocations": [
    "${workspaceFolder}/**",
    "!**/node_modules/**"
  ],
  "outFiles": ["${workspaceFolder}/build/**/*.js"]
}
```

#### **3. Set Breakpoints After Debug Starts**
- **Don't set breakpoints before starting debug**
- **Start the debugger first**
- **Then set breakpoints in the running code**
- **Wait for "Debugger attached" message**

#### **4. Use Chrome DevTools for Renderer Process**
- Open Chrome DevTools: `http://localhost:9222`
- Set breakpoints directly in Chrome DevTools
- More reliable for frontend debugging

#### **5. Check File Paths**
- Ensure breakpoints are in files that are actually bundled
- Check that the file path matches exactly (case-sensitive)
- Avoid breakpoints in files that aren't imported

#### **6. Restart Debug Session**
- Stop the debugger completely
- Clear VS Code's debug cache: `Ctrl+Shift+P` → "Debug: Clear Breakpoints"
- Restart the debug session
- Set breakpoints again

#### **7. Alternative: Use Console Logging**
If breakpoints still don't work:
```typescript
// Add temporary logging
console.log('Debug point reached:', variableName);
debugger; // Force breakpoint
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
