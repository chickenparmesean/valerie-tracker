// RUN ONCE -- extension.pem is already generated and committed.
// Generates a 2048-bit RSA key pair for Chrome extension signing.
// Outputs: extension.pem (private key), extension ID, base64 public key for manifest.json

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pemPath = path.join(__dirname, 'extension.pem');

if (fs.existsSync(pemPath)) {
  console.error('extension.pem already exists! Delete it first if you want to regenerate.');
  process.exit(1);
}

// Generate 2048-bit RSA key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Save private key
fs.writeFileSync(pemPath, privateKey, 'utf8');
console.log('Private key saved to:', pemPath);

// Get DER-encoded public key (SubjectPublicKeyInfo)
const pubKeyObj = crypto.createPublicKey(privateKey);
const pubKeyDer = pubKeyObj.export({ type: 'spki', format: 'der' });

// Base64 encode for manifest.json key field (no headers, no newlines)
const pubKeyBase64 = pubKeyDer.toString('base64');
console.log('\nPublic key (base64 for manifest.json key field):');
console.log(pubKeyBase64);

// Compute Chrome extension ID from public key
const hash = crypto.createHash('sha256').update(pubKeyDer).digest('hex');
const extensionId = hash
  .substring(0, 32)
  .split('')
  .map((c) => {
    const n = parseInt(c, 16);
    return String.fromCharCode(n + 97); // 0->a, 1->b, ..., 15->p
  })
  .join('');

console.log('\nExtension ID:', extensionId);
