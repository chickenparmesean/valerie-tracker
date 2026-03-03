// Packs the Chrome extension into a CRX2 file for registry-based installation.
// Uses PowerShell Compress-Archive for zipping (no npm deps).
// Requires extension.pem to exist (run generate-extension-key.js first).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extDir = path.join(__dirname, '..', 'chrome-extension');
const pemPath = path.join(__dirname, 'extension.pem');
const zipPath = path.join(__dirname, 'extension.zip');
const crxPath = path.join(__dirname, 'valerie-url-bridge.crx');

if (!fs.existsSync(pemPath)) {
  console.error('extension.pem not found. Run generate-extension-key.js first.');
  process.exit(1);
}

// 1. Zip the extension directory
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
execSync(
  `powershell -Command "Compress-Archive -Path '${extDir.replace(/\//g, '\\\\')}\\\\*' -DestinationPath '${zipPath.replace(/\//g, '\\\\')}' -Force"`,
);

// 2. Read private key and zip
const pemKey = fs.readFileSync(pemPath, 'utf8');
const zipBytes = fs.readFileSync(zipPath);

// 3. Get DER-encoded public key (SubjectPublicKeyInfo)
const publicKey = crypto.createPublicKey(pemKey);
const pubKeyDer = publicKey.export({ type: 'spki', format: 'der' });

// 4. Sign the zip with RSA-SHA1
const sign = crypto.createSign('SHA1');
sign.update(zipBytes);
const signature = sign.sign(pemKey);

// 5. Assemble CRX2 binary
const header = Buffer.alloc(16);
header.write('Cr24', 0);                        // magic number
header.writeUInt32LE(2, 4);                      // CRX version 2
header.writeUInt32LE(pubKeyDer.length, 8);       // public key length
header.writeUInt32LE(signature.length, 12);      // signature length

const crx = Buffer.concat([header, pubKeyDer, signature, zipBytes]);
fs.writeFileSync(crxPath, crx);

// 6. Compute extension ID
const hash = crypto.createHash('sha256').update(pubKeyDer).digest('hex');
const extensionId = hash
  .substring(0, 32)
  .split('')
  .map((c) => {
    const n = parseInt(c, 16);
    return String.fromCharCode(n + 97);
  })
  .join('');

console.log('CRX written to:', crxPath);
console.log('Extension ID:', extensionId);
console.log('Public key (base64 for manifest.json):', pubKeyDer.toString('base64'));
console.log('CRX size:', crx.length, 'bytes');

// Clean up zip
fs.unlinkSync(zipPath);
