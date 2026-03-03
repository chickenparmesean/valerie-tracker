// Packs the Chrome extension into a CRX3 file using Chrome's built-in packer.
// Requires extension.pem to exist (run generate-extension-key.js first).
// Requires Google Chrome to be installed on the build machine.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extDir = path.join(__dirname, '..', 'chrome-extension');
const pemPath = path.join(__dirname, 'extension.pem');
const crxPath = path.join(__dirname, 'valerie-url-bridge.crx');

// Chrome outputs the CRX next to the source folder, not inside it
const chromeOutputCrx = path.join(__dirname, '..', 'chrome-extension.crx');

if (!fs.existsSync(pemPath)) {
  console.error('extension.pem not found. Run generate-extension-key.js first.');
  process.exit(1);
}

if (!fs.existsSync(extDir)) {
  console.error('chrome-extension/ folder not found at:', extDir);
  process.exit(1);
}

// Find Chrome executable
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

let chromePath = null;
for (const p of chromePaths) {
  if (fs.existsSync(p)) {
    chromePath = p;
    break;
  }
}

// Fall back to PATH
if (!chromePath) {
  try {
    const result = execSync('where chrome.exe 2>nul', { encoding: 'utf8' }).trim();
    if (result) chromePath = result.split('\n')[0].trim();
  } catch (_) {
    // not on PATH
  }
}

if (!chromePath) {
  console.error('Chrome not found -- required for CRX3 packing');
  console.error('Checked:', chromePaths.join(', '), '+ PATH');
  process.exit(1);
}

console.log('Using Chrome:', chromePath);

// Clean up any previous output
if (fs.existsSync(chromeOutputCrx)) fs.unlinkSync(chromeOutputCrx);
if (fs.existsSync(crxPath)) fs.unlinkSync(crxPath);

// Pack with Chrome's built-in packer (produces CRX3)
const cmd = `"${chromePath}" --pack-extension="${extDir}" --pack-extension-key="${pemPath}" --no-message-box`;
console.log('Running:', cmd);

try {
  execSync(cmd, { stdio: 'pipe', timeout: 30000 });
} catch (err) {
  // Chrome may exit with non-zero even on success, check if file was created
  if (!fs.existsSync(chromeOutputCrx)) {
    console.error('Chrome --pack-extension failed and no CRX was produced.');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
  }
}

if (!fs.existsSync(chromeOutputCrx)) {
  console.error('CRX file not found at expected location:', chromeOutputCrx);
  process.exit(1);
}

// Move to the expected build output path
fs.renameSync(chromeOutputCrx, crxPath);

// Log CRX info
const crxBytes = fs.readFileSync(crxPath);
console.log('CRX3 written to:', crxPath);
console.log('CRX size:', crxBytes.length, 'bytes');

// Compute and log extension ID from the PEM key (same method as before)
const pemKey = fs.readFileSync(pemPath, 'utf8');
const publicKey = crypto.createPublicKey(pemKey);
const pubKeyDer = publicKey.export({ type: 'spki', format: 'der' });
const hash = crypto.createHash('sha256').update(pubKeyDer).digest('hex');
const extensionId = hash
  .substring(0, 32)
  .split('')
  .map((c) => {
    const n = parseInt(c, 16);
    return String.fromCharCode(n + 97);
  })
  .join('');

console.log('Extension ID:', extensionId);
console.log('Public key (base64):', pubKeyDer.toString('base64'));
