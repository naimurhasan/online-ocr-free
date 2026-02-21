const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

// Helper to delete file
const deleteFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error('Error deleting file:', err);
    }
};

const convertPdfToImages = async (pdfPath) => {
    const outputDir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    const outputPrefix = path.join(outputDir, baseName);

    try {
        console.log(`📄 Converting PDF using system pdftoppm: ${pdfPath}`);

        // Use system pdftoppm (usually in /opt/homebrew/bin/pdftoppm on Apple Silicon)
        // We trust the system PATH to find it.
        // Command: pdftoppm -png -r 300 input.pdf output_prefix

        await execFilePromise('pdftoppm', ['-png', '-r', '300', pdfPath, outputPrefix]);

        // pdftoppm generates files like output_prefix-1.png, output_prefix-2.png
        // We need to find them.
        const files = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(baseName + '-') && file.endsWith('.png'))
            .map(file => path.join(outputDir, file))
            // Sort by page number
            .sort((a, b) => {
                const numA = parseInt(a.match(/-(\d+)\.png$/)[1]);
                const numB = parseInt(b.match(/-(\d+)\.png$/)[1]);
                return numA - numB;
            });

        console.log(`✅ Converted ${files.length} pages.`);
        return files;
    } catch (err) {
        console.error('PDF Conversion Error:', err);
        if (err.code === 'ENOENT') {
            console.error('❌ pdftoppm not found. Please install poppler: `brew install poppler`');
        }
        throw err;
    }
};

module.exports = { deleteFile, convertPdfToImages };
