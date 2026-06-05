import Jimp from 'jimp';
import axios from 'axios';

/**
 * Helper to convert RGB to Hex string
 */
function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Extracts the dominant color from a given image URL
 * @param {string} imageUrl - The image to fetch and analyze
 * @returns {Promise<string>} Dominant color in Hex format (e.g., "#3A5B82") or default fallback
 */
export async function getDominantColor(imageUrl) {
  const defaultColor = '#5C6BC0'; // Slate indigo fallback
  
  if (!imageUrl) return defaultColor;

  try {
    // Fetch image as a buffer with a timeout
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const image = await Jimp.read(response.data);
    
    // Resize image to small grid to cluster colors and increase speed
    image.resize(16, 16);

    const colorCounts = {};
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelColor = image.getPixelColor(x, y);
        const rgba = Jimp.intToRGBA(pixelColor);

        // Ignore highly transparent pixels
        if (rgba.a < 120) continue;

        // Quantize colors to group similar hues (round to nearest 16 values)
        const qR = Math.round(rgba.r / 16) * 16;
        const qG = Math.round(rgba.g / 16) * 16;
        const qB = Math.round(rgba.b / 16) * 16;

        // Skip pure gray/black/white colors if we want a vibrant brand color, 
        // but keep track of them as fallback.
        const diffRG = Math.abs(qR - qG);
        const diffGB = Math.abs(qG - qB);
        const diffBR = Math.abs(qB - qR);
        
        // Calculate colorfulness (saturation-ish)
        const isGrayscale = diffRG < 24 && diffGB < 24 && diffBR < 24;
        
        // If grayscale, we de-prioritize it unless it's the only option
        const weight = isGrayscale ? 1 : 4; 

        const key = `${qR},${qG},${qB}`;
        colorCounts[key] = (colorCounts[key] || 0) + weight;
      }
    }

    // Find the most frequent color key
    let dominantKey = null;
    let maxCount = -1;

    for (const [key, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantKey = key;
      }
    }

    if (!dominantKey) return defaultColor;

    const [r, g, b] = dominantKey.split(',').map(Number);
    
    // Clamp to valid rgb values
    const clamp = (val) => Math.max(0, Math.min(255, val));
    
    return rgbToHex(clamp(r), clamp(g), clamp(b));
  } catch (error) {
    // Silently fall back to default color if image cannot be fetched or parsed
    return defaultColor;
  }
}
