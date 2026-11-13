// Builds the native Android project: copies the web app, adds Android, then applies
// permissions and the app/notification icons. Run by the GitHub workflow.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK'
];

function patchManifest(file) {
  let s = fs.readFileSync(file, 'utf8');
  const add = PERMISSIONS.filter(p => !s.includes(`"${p}"`)).map(p => `    <uses-permission android:name="${p}"/>`).join('\n');
  if (add) s = s.replace('</manifest>', add + '\n</manifest>');
  fs.writeFileSync(file, s);
  return add ? add.split('\n').length : 0;
}

function applyIcons(resDir, assetsDir) {
  // Remove the default adaptive icon so the PNG launcher icons below are used
  for (const f of ['mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml']) {
    fs.rmSync(path.join(resDir, f), { force: true });
  }
  for (const d of fs.readdirSync(resDir)) {
    if (d.startsWith('mipmap-')) fs.rmSync(path.join(resDir, d, 'ic_launcher_foreground.png'), { force: true });
  }
  fs.cpSync(assetsDir, resDir, { recursive: true });
}

module.exports = { patchManifest, applyIcons };

if (require.main === module) {
  const run = c => { console.log('> ' + c); execSync(c, { stdio: 'inherit', cwd: root }); };
  run('node scripts/prepare-www.js');
  run('npx cap add android');
  const res = path.join(root, 'android/app/src/main/res');
  console.log('permissions added:', patchManifest(path.join(root, 'android/app/src/main/AndroidManifest.xml')));
  applyIcons(res, path.join(root, 'android-res'));
  run('npx cap sync android');
}
