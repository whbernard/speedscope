@echo off
REM Speedscope with LLM - Easy Run Script for Windows
REM This script makes it easy to run the app from the command line

echo 🔬 Speedscope with LLM - Easy Run Script
echo ========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
) else (
    echo ✅ Dependencies are already installed
)

REM Ask user which version to run
echo.
echo Which version would you like to run?
echo 1) 🖥️  Desktop App (Recommended - Full Features)
echo 2) 🌐 Web Version (Fast Setup)
echo.
set /p choice="Enter your choice (1 or 2): "

if "%choice%"=="1" (
    echo 🚀 Starting Desktop App...
    npm run electron:dev
) else if "%choice%"=="2" (
    echo 🌐 Starting Web Version...
    echo 📱 Open http://localhost:8000 in your browser
    npm run dev
) else (
    echo ❌ Invalid choice. Please run the script again and choose 1 or 2.
    pause
    exit /b 1
)

pause
