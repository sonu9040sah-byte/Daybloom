// Copies the web app into ./www, which Capacitor packages into the Android app.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons']) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
console.log('www ready:', fs.readdirSync(out).join(', '));
