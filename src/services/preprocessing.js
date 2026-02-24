const path = require('path');
const sharp = require('sharp');
const fs = require('fs').promises;

const ensureTempFolder = async () => {
    const tempDir = path.resolve('./temp');
    try {
        await fs.access(tempDir);
    } catch {
        await fs.mkdir(tempDir, { recursive: true });
    }
    return tempDir;
};

const preprocessImageWithSteps = async (imagePath, stepPrefix = 'image') => {
    const tempDir = await ensureTempFolder();
    const timestamp = Date.now();

    const step0Path = path.join(tempDir, `${stepPrefix}_${timestamp}_0_original.png`);
    await sharp(imagePath).toFile(step0Path);
    console.log('✅ Step 0: Original saved to', step0Path);

    const finalPath = path.join(tempDir, `${stepPrefix}_${timestamp}_final_processed.png`);

    // Grayscale -> Resize -> Normalize -> Sharpen -> Blur (dilation sim) -> Threshold
    await sharp(step0Path)
        .grayscale()
        .resize({
            width: 3000,
            fit: 'inside',
            withoutEnlargement: false
        })
        .normalize()
        .sharpen()
        .blur(0.5)
        .threshold(160)
        .toFile(finalPath);

    console.log('✅ Optimized Processing Complete:', finalPath);

    return finalPath;
};

const advancedPreprocessWithSteps = async (imagePath, stepPrefix = 'advanced') => {
    const tempDir = await ensureTempFolder();
    const timestamp = Date.now();

    const step0Path = path.join(tempDir, `${stepPrefix}_${timestamp}_0_original.png`);
    await sharp(imagePath).toFile(step0Path);

    console.log('🔍 Running Optimized Advanced Preprocessing...');

    const finalPath = path.join(tempDir, `${stepPrefix}_${timestamp}_final_processed.png`);

    // Grayscale -> Median -> Contrast -> Resize -> Sharpen -> Threshold
    await sharp(step0Path)
        .grayscale()
        .median(3)
        .linear(1.5, -(128 * 1.5) + 128)
        .resize({
            width: 3000,
            fit: 'inside',
            withoutEnlargement: false
        })
        .sharpen({ sigma: 1.5 })
        .threshold(140)
        .toFile(finalPath);

    console.log('✅ Advanced Processing Complete:', finalPath);
    return finalPath;
};

const clearTempFolder = async () => {
    const tempDir = path.resolve('./temp');
    try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
            await fs.unlink(path.join(tempDir, file));
        }
        console.log('🧹 Temp folder cleared');
    } catch (error) {
        console.log('ℹ️ No temp folder to clear');
    }
};

module.exports = {
    preprocessImageWithSteps,
    advancedPreprocessWithSteps,
    clearTempFolder
};
