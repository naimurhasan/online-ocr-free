const Tesseract = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');
const { execFile } = require('child_process');
const fs = require('fs').promises;
const { convertPdfToImages, deleteFile } = require('../utils/fileUtils');

const TESSERACT_OPTS = {
    langPath: path.resolve('./tessdata'),
    gzip: false
};

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

    // Step 0: Original (Keep for reference)
    const step0Path = path.join(tempDir, `${stepPrefix}_${timestamp}_0_original.png`);
    await sharp(imagePath).toFile(step0Path);
    console.log('✅ Step 0: Original saved to', step0Path);

    // Optimized Step: Combined Processing
    // Grayscale -> Resize -> Normalize -> Sharpen -> Median (Denoise) -> Threshold
    const finalPath = path.join(tempDir, `${stepPrefix}_${timestamp}_final_processed.png`);

    await sharp(step0Path)
        .grayscale()
        .resize({
            width: 3000,
            fit: 'inside',
            withoutEnlargement: false
        })
        .normalize()
        .sharpen()
        .median(3)
        .threshold(128)
        .toFile(finalPath);

    console.log('✅ Optimized Processing Complete:', finalPath);
    console.log('\n📁 Processed image saved in:', tempDir);

    return finalPath;
};

const advancedPreprocessWithSteps = async (imagePath, stepPrefix = 'advanced') => {
    const tempDir = await ensureTempFolder();
    const timestamp = Date.now();

    // Step 0: Original
    const step0Path = path.join(tempDir, `${stepPrefix}_${timestamp}_0_original.png`);
    await sharp(imagePath).toFile(step0Path);

    console.log('🔍 Running Optimized Advanced Preprocessing...');

    // Combined Chain: Grayscale -> Median -> Linear (Contrast) -> Resize -> Sharpen -> Threshold
    const finalPath = path.join(tempDir, `${stepPrefix}_${timestamp}_final_processed.png`);

    await sharp(step0Path)
        .grayscale()
        .median(3)
        .linear(1.5, -(128 * 1.5) + 128) // Contrast increase
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

const extractText = async (filePath, mimetype, lang = 'ben', saveSteps = true) => {
    let textResult = '';

    if (mimetype === 'application/pdf') {
        const imageFiles = await convertPdfToImages(filePath);

        for (let i = 0; i < imageFiles.length; i++) {
            const image = imageFiles[i];
            console.log(`\n📄 Processing page ${i + 1}/${imageFiles.length}...`);

            const processedImage = saveSteps
                ? await preprocessImageWithSteps(image, `page${i + 1}`)
                : await preprocessImageWithSteps(image, `page${i + 1}`);

            console.log('🔍 Running OCR...');
            const { data: { text } } = await Tesseract.recognize(
                processedImage,
                lang,
                {
                    ...TESSERACT_OPTS,
                    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                    preserve_interword_spaces: '1'
                }
            );

            textResult += text + '\n\n';
            console.log('✅ OCR completed for page', i + 1);

            deleteFile(image);
        }
    } else {
        console.log('\n📄 Processing single image...');

        const processedImage = saveSteps
            ? await preprocessImageWithSteps(filePath, 'single')
            : await preprocessImageWithSteps(filePath, 'single');

        console.log('🔍 Running OCR...');
        const { data: { text } } = await Tesseract.recognize(
            processedImage,
            lang,
            {
                ...TESSERACT_OPTS,
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                preserve_interword_spaces: '1'
            }
        );

        textResult = text;
        console.log('✅ OCR completed');
    }

    console.log('\n✨ Text extraction complete!');
    console.log('📁 Check ./temp folder for all preprocessing steps');

    return textResult;
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
    extractText,
    preprocessImageWithSteps,
    advancedPreprocessWithSteps,
    clearTempFolder
};