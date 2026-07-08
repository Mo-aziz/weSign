const fs = require('fs');
const https = require('https');
const path = require('path');

const inputFile = process.argv[2] || 'backend_database_diagram.mmd';
const outputFile = process.argv[3] || 'backend_database_diagram.png';
const diagram = fs.readFileSync(path.join(__dirname, inputFile), 'utf8');

const postData = JSON.stringify({
  diagram_source: diagram,
  diagram_type: 'mermaid',
  output_format: 'png',
});

const options = {
  hostname: 'kroki.io',
  port: 443,
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  if (res.statusCode !== 200) {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      console.error(`Kroki failed (${res.statusCode}):`, body.slice(0, 500));
      process.exit(1);
    });
    return;
  }

  const outPath = path.join(__dirname, outputFile);
  const file = fs.createWriteStream(outPath);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log(`Exported: ${outPath}`);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
  process.exit(1);
});

req.write(postData);
req.end();
