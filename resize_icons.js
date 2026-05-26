const Jimp = require('jimp');
const fs = require('fs');

async function processIcons() {
  try {
    if (!fs.existsSync('icons')) {
      fs.mkdirSync('icons');
    }
    
    // Read the large image generated earlier (which is around 505KB)
    const imgPath = 'icons/icon.png';
    const image = await Jimp.read(imgPath);
    
    // Ensure we create perfect squares, resize, and save as proper tiny PNGs
    const sizes = [16, 32, 48, 128];
    for (const size of sizes) {
      const clone = image.clone();
      clone.resize(size, size);
      await clone.writeAsync(`icons/icon_${size}.png`);
      console.log(`Saved icon_${size}.png`);
    }
    console.log("Icon resizing complete.");
  } catch (e) {
    console.error("Error resizing icons:", e);
  }
}

processIcons();
