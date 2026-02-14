const fs = require('fs');
const path = require('path');
const pdf = require('pdf-poppler');

// Helper to delete file
const deleteFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
    }
};

const convertPdfToImages = async (pdfPath) => {
    const outputDir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));

    const opts = {
        format: 'png',
        out_dir: outputDir,
        out_prefix: baseName,
        page: null // convert all pages
    };

    try {
        await pdf.convert(pdfPath, opts);
        // pdf-poppler returns undefined on success sometimes or list of files
        // Use fs to find generated files if return is empty
        const files = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(baseName) && file.endsWith('.png'))
            .map(file => path.join(outputDir, file));

        return files;
    } catch (err) {
        console.error('PDF Conversion Error:', err);
        throw err;
    }
};

module.exports = { deleteFile, convertPdfToImages };
