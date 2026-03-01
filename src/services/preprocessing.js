const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const fs = require('fs').promises;

// Reduce memory footprint on constrained servers
sharp.cache(false);
sharp.concurrency(1);

const uniqueId = () => `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

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
    const uid = uniqueId();

    const finalPath = path.join(tempDir, `${stepPrefix}_${uid}_final_processed.jpg`);

    // Grayscale -> Resize -> Normalize -> Sharpen -> Threshold -> JPEG
    await sharp(imagePath)
        .grayscale()
        .resize({
            width: 2000,
            fit: 'inside',
            withoutEnlargement: true
        })
        .normalize()
        .sharpen()
        .threshold(160)
        .jpeg({ quality: 90 })
        .toFile(finalPath);

    console.log('✅ Processing Complete:', finalPath);

    return finalPath;
};

const advancedPreprocessWithSteps = async (imagePath, stepPrefix = 'advanced') => {
    const tempDir = await ensureTempFolder();
    const uid = uniqueId();

    const finalPath = path.join(tempDir, `${stepPrefix}_${uid}_final_processed.jpg`);

    // Grayscale -> Median -> Contrast -> Resize -> Sharpen -> Threshold -> JPEG
    await sharp(imagePath)
        .grayscale()
        .median(3)
        .linear(1.5, -(128 * 1.5) + 128)
        .resize({
            width: 2000,
            fit: 'inside',
            withoutEnlargement: true
        })
        .sharpen({ sigma: 1.5 })
        .threshold(140)
        .jpeg({ quality: 90 })
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
