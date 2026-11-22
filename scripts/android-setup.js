// Builds the native Android project: copies the web app, adds Android, then applies
// permissions and the app/notification icons. Run by the GitHub workflow.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// Bump VERSION_CODE for every build you want installable over an older one.
const VERSION_CODE = 2;
const pkg = require('../package.json');

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

// versionName comes from package.json so the APK matches the app's version.
function patchVersion(file) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  s = s.replace(/versionCode\s+\d+/, `versionCode ${VERSION_CODE}`)
       .replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
  fs.writeFileSync(file, s);
  return s === before ? 'NOT FOUND' : `versionCode ${VERSION_CODE}, versionName "${pkg.version}"`;
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
  console.log('app version:', patchVersion(path.join(root, 'android/app/build.gradle')));
  const res = path.join(root, 'android/app/src/main/res');
  console.log('permissions added:', patchManifest(path.join(root, 'android/app/src/main/AndroidManifest.xml')));
  applyIcons(res, path.join(root, 'android-res'));
  run('npx cap sync android');
}
