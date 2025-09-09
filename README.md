# 🔬Speedscope with LLM 
A fast, interactive web-based viewer for performance profiles with **AI-powered analysis**. Supports import from a variety of profiles in a variety of languages (JS, Ruby, Python, Go & more).

## ⚡ Quick Start

### 🚀 Super Easy (One Command)
```bash
# Clone, install, and run with interactive menu
git clone https://github.com/whbernard/speedscope.git && cd speedscope && ./run.sh
```

### 🖥️ Desktop App (Recommended - Full Features)
```bash
# Clone and install
git clone https://github.com/whbernard/speedscope.git
cd speedscope
npm install

# Run the desktop app
npm run electron:dev
```

### 🌐 Web Version (Fast Setup)
```bash
# Clone and install
git clone https://github.com/whbernard/speedscope.git
cd speedscope
npm install

# Run web version
npm run dev
# Open http://localhost:8000
```

### 🪟 Windows Users
```cmd
REM Clone, install, and run with interactive menu
git clone https://github.com/whbernard/speedscope.git && cd speedscope && run.bat
```

## 🚀 Getting Started

### Prerequisites
- **Node.js LTS (18+)** - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)

### Platform-Specific Requirements (Desktop App Only)

> **Note**: The web version (`npm run dev`) works on all platforms without additional setup!

#### 🍎 macOS
```bash
# Install Xcode Command Line Tools (one-time setup)
xcode-select --install
```

#### 🪟 Windows
- Install **Visual Studio Build Tools** from [Microsoft](https://visualstudio.microsoft.com/downloads/)
- Include "C++ build tools" workload during installation

#### 🐧 Linux
**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install libwebkit2gtk-4.0-dev build-essential libssl-dev libgtk-3-dev
```

**Other distros**: Install `webkit2gtk`, `openssl`, and `gtk3` development packages

## 🏗️ Available Commands

### Development
```bash
# Run desktop app (recommended)
npm run electron:dev

# Run web version
npm run dev

# Build for production
npm run build
```

### Production Builds
```bash
# Build desktop app for distribution
npm run electron:build
```

**Output locations:**
- **Windows**: `dist/` (`.exe` installer)
- **macOS**: `dist/` (`.dmg` disk image and `.app` bundle)  
- **Linux**: `dist/` (`.AppImage`, `.deb`, and `.rpm` packages)

### Version Comparison

| Feature | Web Version | Desktop App |
|---------|-------------|-------------|
| **Setup Speed** | ⚡ Instant | 🚀 Fast |
| **OS Keychain** | ❌ No | ✅ Yes |
| **CORS Restrictions** | ⚠️ Limited | ✅ None |
| **Native Experience** | ❌ Browser | ✅ Desktop |
| **LLM Integration** | ⚠️ Basic | ✅ Full |

## 🧠 LLM Integration Features
- **Send to LLM**: Analyze profiling data with AI models
- **OAuth Authentication**: Secure integration with LLM providers
- **OS Keychain Storage**: Tokens securely stored in OS keychain (desktop version)
- **Custom Prompts**: Ask specific questions about your performance data
- **Real-time Analysis**: Get instant insights from your profiling data
- **Configuration Management**: External config file for easy service endpoint management

Given raw profiling data, speedscope allows you to interactively explore the data to get insight into what's slow in your application, or allocating all the memory, or whatever data is represented in the profiling data. The LLM integration takes this a step further by providing AI-powered analysis and recommendations.

## 💻 Command Line Usage

### Super Easy Commands
```bash
# Interactive menu (recommended)
git clone https://github.com/whbernard/speedscope.git && cd speedscope && ./run.sh

# Windows users
git clone https://github.com/whbernard/speedscope.git && cd speedscope && run.bat
```

### Manual Commands
```bash
# Clone and run desktop app in one line
git clone https://github.com/whbernard/speedscope.git && cd speedscope && npm install && npm run electron:dev

# Or step by step
git clone https://github.com/whbernard/speedscope.git
cd speedscope
npm install
npm run electron:dev
```

### Global CLI (Optional)
```bash
# Install globally for command-line usage
npm install -g speedscope

# Open profile directly
speedscope /path/to/profile.json
```

### Supported Browsers
- Latest Chrome and Firefox (see `browserslist` in `package.json`)

## 🔧 Troubleshooting

### Common Issues

**"Command not found: npm"**
```bash
# Install Node.js from https://nodejs.org/
# Or use a version manager like nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts
```

**"Failed to load image" error on macOS**
```bash
# Clear macOS icon cache
sudo rm -rf /Library/Caches/com.apple.iconservices.store
killall Dock
```

**Desktop app won't start**
```bash
# Try the web version instead
npm run dev
# Then open http://localhost:8000
```

**Permission denied on Linux**
```bash
# Make sure you have the required system packages
sudo apt update && sudo apt install libwebkit2gtk-4.0-dev build-essential
```

---

## 🔧 Configuration

The application uses a centralized `config.json` file for configuring OAuth and LLM services. This allows you to easily modify endpoints, authentication parameters, and request schemas without changing code.

### Configuration File Location
- **Development**: `config.json` in the project root
- **Production**: `config.json` in the `build/` directory (automatically copied during build)

### LLM Configuration

Edit the `llm` section in `config.json`:

```json
{
  "llm": {
    "endpoint": "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-sonnet-20240229-v1:0/invoke",
    "provider": "bedrockClaudeSonnet",
    "model": "anthropic.claude-3-sonnet-20240229-v1:0",
    "max_tokens": 2000,
    "temperature": 0.7,
    "custom_headers": {
      "X-API-Key": "{{API_KEY}}",
      "X-Custom-Header": "custom-value",
      "Authorization": "Bearer {{ACCESS_TOKEN}}",
      "X-Request-ID": "{{REQUEST_ID}}"
    },
    "request_schema": {
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "text": "{{prompt}}"
            }
          ]
        }
      ],
      "system": [
        {
          "text": "You are a performance analysis expert. Analyze the provided profiling data and provide insights about performance bottlenecks, optimization opportunities, and recommendations.\n\nProfile data:\n{{profile_data}}"
        }
      ],
      "inferenceConfig": {
        "maxTokens": 2000,
        "temperature": 0.7,
        "topP": 0.9,
        "stopSequences": []
      }
    }
  }
}
```

**Configuration Options:**
- `endpoint`: LLM API endpoint URL (Bedrock runtime endpoint)
- `provider`: Provider identifier (for UI display)
- `model`: Model identifier to use (Bedrock model ARN)
- `max_tokens`: Maximum tokens in response
- `temperature`: Response creativity (0.0-1.0)
- `custom_headers`: Optional custom HTTP headers with template variable support:
  - `{{API_KEY}}`: Environment variable `API_KEY`
  - `{{ACCESS_TOKEN}}`: OAuth access token from request
  - `{{REQUEST_ID}}`: Auto-generated UUID for request tracking
  - `{{LLM_API_KEY}}`: Environment variable `LLM_API_KEY`
  - `{{AUTH_TOKEN}}`: Environment variable `AUTH_TOKEN`
  - `{{USER_ID}}`: Environment variable `USER_ID`
  - `{{prompt}}`: Current user prompt
  - `{{profile_data}}`: Current profile data
- `request_schema`: Bedrock request payload with:
  - `messages`: Array of message objects with `role` and `content` fields (contains `{{prompt}}`)
  - `system`: Array of system message objects with `text` field (contains `{{profile_data}}` and context)
  - `inferenceConfig`: Inference parameters (maxTokens, temperature, topP, stopSequences)
  - Template variables: `{{prompt}}` in user message, `{{profile_data}}` in system message

### OAuth Configuration

Edit the `oauth` section in `config.json`:

```json
{
  "oauth": {
    "endpoint": "https://your-oauth-provider.com/oauth/token",
    "grant_type": "client_credentials",
    "scope": "api",
    "client_id_field": "client_id",
    "client_secret_field": "client_secret",
    "response_schema": {
      "access_token_field": "access_token",
      "expires_in_field": "expires_in",
      "token_type_field": "token_type"
    }
  }
}
```

**Configuration Options:**
- `endpoint`: OAuth token endpoint URL
- `grant_type`: OAuth grant type (typically `client_credentials`)
- `scope`: OAuth scope parameter
- `client_id_field`: Field name for client ID in request body
- `client_secret_field`: Field name for client secret in request body
- `response_schema`: Field names in OAuth response for token extraction

### Example OAuth Token Request

The application will send requests like this:

```
POST https://your-oauth-provider.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=<your_client_id>&client_secret=<your_client_secret>&scope=api
```

### Environment Variables for Custom Headers

You can set environment variables to use in your custom headers:

```bash
# Set API key for LLM provider
export API_KEY="your-secret-api-key"
export LLM_API_KEY="your-llm-api-key"

# Set authentication tokens
export AUTH_TOKEN="your-auth-token"

# Set user identification
export USER_ID="user123"
```

These variables will be automatically substituted in your custom headers configuration.

---

## 📤 How to Send Profiling Data to the LLM

1. **Load a profile** via drag-and-drop or the Import/Browse button
2. **Select time interval** by zooming/panning the timeline to the range you want analyzed
3. **Click "Send to LLM"** in the toolbar
4. **Configure authentication:**
   - Enter OAuth URL, Client ID, and Client Secret
   - Or use pre-configured values from `config.json`
5. **Choose a prompt** (or write your own) and submit
6. **View results** - the app serializes the selected interval to JSON and sends it to your configured LLM endpoint

## 🔧 Troubleshooting

### Common Issues

#### Build Errors
```bash
# If you get Rust compilation errors on macOS
xcode-select --install

# If you get missing dependencies on Linux
sudo apt update && sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# If you get missing dependencies on Windows
# Install Visual Studio Build Tools with C++ workload
```

#### Runtime Issues

**"Failed to load config.json"**
- Ensure `config.json` exists in the project root
- Check that the JSON syntax is valid
- For production builds, verify the file is copied to `build/` directory

**"HTTP request failed" or CORS errors**
- Use the native desktop version (`npm run electron:dev`) to avoid CORS restrictions
- Verify your OAuth and LLM endpoints are accessible
- Check that endpoints use HTTPS (required for security)

**"OAuth authentication failed"**
- Verify OAuth endpoint URL is correct
- Check Client ID and Client Secret are valid
- Ensure the OAuth provider supports client credentials grant flow
- Verify the `grant_type` and `scope` values in `config.json`

**"LLM request failed"**
- Verify LLM endpoint URL is correct
- Check that the request schema in `config.json` matches your LLM provider's API
- Ensure you have valid API credentials/access tokens
- Verify the model identifier is correct for your provider
- Check custom headers configuration (API keys, authentication tokens)
- Verify OAuth token is valid if using OAuth authentication

#### Debug Mode
```bash
# Run with debug logging
DEBUG=* npm run electron:dev

# Check browser console for frontend errors
# Check terminal output for Electron backend errors
```

### Getting Help
- Check the browser console Network tab for HTTP request details
- Verify your `config.json` matches the expected schema
- Test OAuth endpoints independently (e.g., with curl or Postman)
- Ensure all required dependencies are installed for your platform

[0]: https://en.wikipedia.org/wiki/Profiling_(computer_programming)#Statistical_profilers
[1]: https://github.com/brendangregg/FlameGraph

# Supported file formats

speedscope is designed to ingest profiles from a variety of different profilers for different programming languages & environments. Click the links below for documentation on how to import from a specific source.

- JavaScript
  - [Importing from Chrome](https://github.com/jlfwong/speedscope/wiki/Importing-from-Chrome)
  - [Importing from Firefox](https://github.com/jlfwong/speedscope/wiki/Importing-from-Firefox)
  - [Importing from Safari](https://github.com/jlfwong/speedscope/wiki/Importing-from-Safari)
  - [Importing from Node.js](https://github.com/jlfwong/speedscope/wiki/Importing-from-Node.js)
  - [Importing from Hermes (for React Native)](https://github.com/jlfwong/speedscope/wiki/Importing-from-Hermes)
- Ruby
  - [Importing from stackprof](https://github.com/jlfwong/speedscope/wiki/Importing-from-stackprof-(ruby))
  - [Importing from rbspy](https://github.com/jlfwong/speedscope/wiki/Importing-from-rbspy-(ruby))
  - [Importing from ruby-prof](https://github.com/jlfwong/speedscope/wiki/Importing-from-ruby-prof)
- Python
  - [Importing from py-spy](https://github.com/jlfwong/speedscope/wiki/Importing-from-py-spy-(python))
  - [pyspeedscope](https://github.com/windelbouwman/pyspeedscope)
  - [Importing from Austin](https://github.com/P403n1x87/austin-python#format-conversion)
  - [Importing from pyinstrument](https://github.com/jlfwong/speedscope/wiki/Importing-from-pyinstrument-(python))
- PHP
  - [Importing from phpspy or sj-i/php-profiler](https://github.com/sj-i/php-profiler/pull/101)
- Go
  - [Importing from pprof](https://github.com/jlfwong/speedscope/wiki/Importing-from-pprof-(go))  
- Rust
  - [flamescope](https://github.com/coolreader18/flamescope)
- Java
  - [Importing from async‐profiler (Java)
](https://github.com/jlfwong/speedscope/wiki/Importing-from-async%E2%80%90profiler-(Java))
- Erlang/Elixir
  - [eflambe](https://github.com/Stratus3D/eflambe)
- Native code
  - [Importing from Instruments.app](https://github.com/jlfwong/speedscope/wiki/Importing-from-Instruments.app) (macOS)
  - [Importing from `perf`](https://github.com/jlfwong/speedscope/wiki/Importing-from-perf-(linux)) (linux)
- [Importing from .NET Core](https://github.com/jlfwong/speedscope/wiki/Importing-from-.NET-Core)
- [Importing from GHC (Haskell)](https://github.com/jlfwong/speedscope/wiki/Importing-from-Haskell)
- [Importing from custom sources](https://github.com/jlfwong/speedscope/wiki/Importing-from-custom-sources)

Contributions to add support for additional formats are welcome! See issues with the ["import source" tag](https://github.com/jlfwong/speedscope/issues?q=is%3Aissue+is%3Aopen+label%3A%22import+source%22).
# Usage

Visit https://www.speedscope.app, then either browse to find a profile file or drag-and-drop one onto the page. The profiles are not uploaded anywhere -- the application is totally in-browser.

## Command line usage

For offline use, or convenience in the terminal, you can also install speedscope
via npm:

    npm install -g speedscope

Invoking `speedscope /path/to/profile` will load speedscope in your default browser.

## Self-contained directory

If you don't have npm or node installed, you can also download a
self-contained version from https://github.com/jlfwong/speedscope/releases.
After you download the zip file from a release, simply unzip it and open the
contained `index.html` in Chrome or Firefox.

## Importing via URL

To load a specific profile by URL, you can append a hash fragment like `#profileURL=[URL-encoded profile URL]&title=[URL-encoded custom title]`. Note that the server hosting the profile must have CORS configured to allow AJAX requests from speedscope.

## Views

### 🕰Time Order
![Detail View](https://user-images.githubusercontent.com/150329/42108613-e6ef6d3a-7b8f-11e8-93d4-541b2cb93fe5.png)

In the "Time Order" view (the default), call stacks are ordered left-to-right in the same order as they occurred in the input file, which is usually going to be the chronological order they were recorded in. This view is most helpful for understanding the behavior of an application over time, e.g. "first the data is fetched from the database, then the data is prepared for serialization, then the data is serialized to JSON". 

The horizontal axis represents the "weight" of each stack (most commonly CPU time), and the vertical axis shows you the stack active at the time of the sample. If you click on one of the frames, you'll be able to see summary statistics about it.


### ⬅️Left Heavy
![Left Heavy View](https://user-images.githubusercontent.com/150329/44534434-a05f8380-a6ac-11e8-86ac-e3e05e577c52.png)

In the "Left Heavy" view, identical stacks are grouped together, regardless of whether they were recorded sequentially. Then, the stacks are sorted so that the heaviest stack for each parent is on the left -- hence "left heavy". This view is useful for understanding where all the time is going in situations where there are hundreds or thousands of function calls interleaved between other call stacks.

### 🥪 Sandwich
![Sandwich View](https://user-images.githubusercontent.com/150329/42108467-76a57baa-7b8f-11e8-815f-1df7b6ac3ede.png)

The Sandwich view is a table view in which you can find a list of all functions and their associated times. You can sort by self time or total time.
It's called "Sandwich" view because if you select one of the rows in the table, you can see flamegraphs for all the callers and callees of the selected
row.


## Navigation

Once a profile has loaded, the main view is split into two: the top area is the "minimap", and the bottom area is the "stack view".

### Minimap Navigation

* Scroll on either axis to pan around
* Click and drag to narrow your view to a specific range

### Stack View Navigation

* Scroll on either axis to pan around
* Pinch to zoom
* Hold Cmd+Scroll to zoom
* Double click on a frame to fit the viewport to it
* Click on a frame to view summary statistics about it

### Keyboard Navigation

* `+`: zoom in
* `-`: zoom out
* `0`: zoom out to see the entire profile
* `w`/`a`/`s`/`d` or arrow keys: pan around the profile
* `1`: Switch to the "Time Order" view
* `2`: Switch to the "Left Heavy" view
* `3`: Switch to the "Sandwich" view
* `r`: Collapse recursion in the flamegraphs
* `Cmd+S`/`Ctrl+S` to save the current profile
* `Cmd+O`/`Ctrl+O` to open a new profile
* `n`: Go to next profile/thread if one is available
* `p`: Go to previous profile/thread if one is available
* `t`: Open the profile/thread selector if available
* `Cmd+F`/`Ctrl+F`: to open search. While open, `Enter` and `Shift+Enter` cycle through results

## 📋 Quick Reference

### Essential Commands
```bash
# Clone and setup
git clone https://github.com/whbernard/speedscope.git
cd speedscope
npm install

# Development
npm run dev              # Web version (localhost:8000)
npm run electron:dev     # Native desktop version

# Production builds
npm run build            # Web build
npm run electron:build   # Native desktop build

# CLI usage
npm install -g speedscope
speedscope /path/to/profile
```

### Key Files
- `config.json` - OAuth and LLM service configuration
- `main.js` - Electron main process with HTTP adapters
- `preload.js` - Electron preload script for secure API exposure
- `src/services/` - TypeScript service adapters
- `src/views/application.tsx` - Main application component

### Platform Requirements
- **All platforms**: Node.js 18+
- **Native builds**: Electron (included in dependencies)
- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools
- **Linux**: WebKit2GTK and build tools

## Contributing

Do you want to contribute to speedscope? Sweeeeet. Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for instructions on setting up your dev environment.
