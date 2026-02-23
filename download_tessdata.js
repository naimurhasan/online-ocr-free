const fs = require('fs');
const path = require('path');
const https = require('https');

const langs = [
    'afr', 'sqi', 'eus', 'por', 'bul', 'bel', 'cat', 'chi_sim', 'chi_tra',
    'hrv', 'ces', 'dan', 'nld', 'epo', 'est', 'fin', 'fra', 'glg', 'deu',
    'ell', 'hun', 'isl', 'ind', 'ita', 'jpn', 'kor', 'lat', 'lav', 'lit',
    'mkd', 'msa', 'ron', 'nor', 'pol', 'rus', 'srp', 'slk', 'slv',
    'spa', 'swe', 'tgl', 'tur', 'ukr'
];

const destDir = path.resolve(__dirname, 'tessdata');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            console.log(`Skipping ${path.basename(dest)}, already exists.`);
            return resolve();
        }
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                });
            } else {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            }
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
        });
    });
};

async function main() {
    const batchSize = 5;
    for (let i = 0; i < langs.length; i += batchSize) {
        const batch = langs.slice(i, i + batchSize);
        console.log(`Downloading batch: ${batch.join(', ')}...`);
        await Promise.all(batch.map(lang => {
            const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`;
            const dest = path.join(destDir, `${lang}.traineddata`);
            return download(url, dest).catch(e => console.error(`Failed ${lang}:`, e));
        }));
    }
    console.log('Download complete.');
}

main();
