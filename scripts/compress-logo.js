const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = path.join(__dirname, '..', 'client', 'public', 'logo.png');
const output = input;
const tempOutput = input + '.tmp';

async function compress() {
  const before = fs.statSync(input).size;
  console.log(`Input: ${input} (${(before / 1024).toFixed(1)} KB)`);

  await sharp(input)
    .resize(200, 200, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 80, compressionLevel: 9 })
    .toFile(tempOutput);

  fs.renameSync(tempOutput, output);
  const after = fs.statSync(output).size;
  console.log(`Output: ${(after / 1024).toFixed(1)} KB (saved ${((before - after) / 1024).toFixed(0)} KB)`);
}

compress().catch(err => { console.error(err); process.exit(1); });
