// Computes the Chrome extension ID from the "key" field in manifest.json.
// Chrome extension IDs are derived from the SHA-256 hash of the decoded public key,
// mapped to the Chrome extension ID alphabet (a-p instead of 0-9a-f).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const manifestPath = path.join(__dirname, '..', 'chrome-extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

if (!manifest.key) {
  console.error('No "key" field found in manifest.json');
  process.exit(1);
}

const keyBytes = Buffer.from(manifest.key, 'base64');
const hash = crypto.createHash('sha256').update(keyBytes).digest('hex');

// Map hex chars to Chrome extension ID alphabet: 0-9 -> a-j, a-f -> k-p
const extensionId = hash
  .slice(0, 32)
  .split('')
  .map((c) => {
    const n = parseInt(c, 16);
    return String.fromCharCode(n + 97); // 0->a, 1->b, ..., 9->j, 10->k, ..., 15->p
  })
  .join('');

console.log('Extension ID:', extensionId);
