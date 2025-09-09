#!/bin/bash

# Speedscope with LLM - Easy Run Script
# This script makes it easy to run the app from the command line

set -e

echo "🔬 Speedscope with LLM - Easy Run Script"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js LTS from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js LTS from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) and npm $(npm --version) are installed"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies are already installed"
fi

# Ask user which version to run
echo ""
echo "Which version would you like to run?"
echo "1) 🖥️  Desktop App (Recommended - Full Features)"
echo "2) 🌐 Web Version (Fast Setup)"
echo ""
read -p "Enter your choice (1 or 2): " choice

case $choice in
    1)
        echo "🚀 Starting Desktop App..."
        npm run electron:dev
        ;;
    2)
        echo "🌐 Starting Web Version..."
        echo "📱 Open http://localhost:8000 in your browser"
        npm run dev
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and choose 1 or 2."
        exit 1
        ;;
esac
