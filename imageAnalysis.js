const { Image } = require('image-js');
const path = require('path');
const fs = require('fs');

/**
 * Calculate the variance and mean of pixel intensities
 */
function calculateVariance(pixelData) {
  const mean = pixelData.reduce((sum, val) => sum + val, 0) / pixelData.length;
  const variance = pixelData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pixelData.length;
  return { variance, mean };
}

/**
 * Analyze image: grayscale variance, mean, histogram-based contrast
 */
async function analyzeImage(filename) {
  try {
    const filepath = path.join(__dirname, '../public/uploads', filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`❌ Image not found: ${filename}`);
    }

    const buffer = fs.readFileSync(filepath);
    const img = await Image.load(buffer);

    const gray = img.grey(); // Convert to grayscale
    const grayData = gray.data; // Intensity array (0–255)

    const { variance, mean } = calculateVariance(grayData);
    const histogram = gray.getHistogram();
    const contrastEstimate = histogram.filter(x => x > 0).length;

    console.log(`✅ Analysis complete for ${filename}`);

    return {
      filename,
      variance,
      mean,
      contrastEstimate,
    };

  } catch (err) {
    console.error(`❌ Error analyzing image ${filename}:`, err.message);
    throw new Error('Image analysis failed: ' + err.message);
  }
}

module.exports = { analyzeImage };
