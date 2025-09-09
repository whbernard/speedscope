const fs = require('fs');
const path = require('path');

// Copy config.json to build directory
const sourcePath = path.join(__dirname, '..', 'config.json');
const destPath = path.join(__dirname, '..', 'build', 'config.json');

try {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log('✅ Config file copied to build directory');
  } else {
    console.log('⚠️  Config file not found, using defaults');
  }
} catch (error) {
  console.error('❌ Failed to copy config file:', error);
}

// Copy icon files to build directory
const iconFiles = ['icon.png', 'icon.icns', 'icon.ico'];
const assetsDir = path.join(__dirname, '..', 'assets');
const buildDir = path.join(__dirname, '..', 'build');

iconFiles.forEach(iconFile => {
  const sourceIconPath = path.join(assetsDir, iconFile);
  const destIconPath = path.join(buildDir, iconFile);
  
  try {
    if (fs.existsSync(sourceIconPath)) {
      fs.copyFileSync(sourceIconPath, destIconPath);
      console.log(`✅ ${iconFile} copied to build directory`);
    }
  } catch (error) {
    console.error(`❌ Failed to copy ${iconFile}:`, error);
  }
});


