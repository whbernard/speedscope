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

### 🚀 One-Line Setup
```bash
# Interactive menu
git clone https://github.com/whbernard/speedscope.git && cd speedscope && npm install && ./run.sh
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
# One-line setup with interactive menu
git clone https://github.com/whbernard/speedscope.git && cd speedscope && npm install && ./run.sh

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

---

## 📚 More Information

For detailed configuration and advanced usage, see the project documentation.
