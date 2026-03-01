const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

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

        await execFilePromise('pdftoppm', ['-jpeg', '-r', '250', pdfPath, outputPrefix]);

        const files = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(baseName + '-') && file.endsWith('.jpg'))
            .map(file => path.join(outputDir, file))
            .sort((a, b) => {
                const numA = parseInt(a.match(/-(\d+)\.jpg$/)[1]);
                const numB = parseInt(b.match(/-(\d+)\.jpg$/)[1]);
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
