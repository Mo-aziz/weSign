const zlib = require('zlib');
const fs = require('fs');
const https = require('https');

const generateImage = (filename, format) => {
    const text = fs.readFileSync(`${filename}.mmd`, 'utf8');
    const data = Buffer.from(text, 'utf8');
    const compressed = zlib.deflateSync(data);
    const encoded = compressed.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    const url = `https://kroki.io/mermaid/${format}/${encoded}`;
    
    https.get(url, (res) => {
        if (res.statusCode !== 200) {
            console.error(`Failed to download ${filename}.${format}: ${res.statusCode}`);
            return;
        }
        const outName = `${filename}_high_quality.${format}`;
        const file = fs.createWriteStream(outName);
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Successfully downloaded ${outName}`);
        });
    }).on('error', (err) => {
        console.error('Error downloading:', err.message);
    });
};

generateImage('webrtc_call_flow', 'svg');
generateImage('webrtc_call_flow', 'png');
