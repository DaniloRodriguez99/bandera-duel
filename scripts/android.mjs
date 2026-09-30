import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const client = resolve(root, 'packages/client');
const command = process.argv[2] || 'apk';
if (!['sync', 'apk', 'bundle'].includes(command)) throw new Error('Usá sync, apk o bundle.');
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Se requiere Node 24.');
const release = command === 'bundle';
if (release) for (const key of ['ANDROID_KEYSTORE', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Falta ${key} para firmar la distribución.`);
}
const env = { ...process.env, VITE_ANDROID_DEBUG: release ? 'false' : 'true' };
function run(exe, args, cwd = root) {
  const result = spawnSync(exe, args, { cwd, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const node = (script, args = [], cwd = root) => run(process.execPath, [resolve(root, script), ...args], cwd);
node('node_modules/typescript/bin/tsc', ['-p', 'packages/shared/tsconfig.json']);
node('node_modules/typescript/bin/tsc', ['-p', 'packages/client/tsconfig.json', '--noEmit']);
node('node_modules/vite/bin/vite.js', ['build'], client);
node('node_modules/@capacitor/cli/bin/capacitor', ['sync', 'android'], client);
if (command === 'sync') process.exit(0);
const android = resolve(client, 'android');
if (!env.ANDROID_HOME && process.platform === 'win32') env.ANDROID_HOME = resolve(env.LOCALAPPDATA, 'Android/Sdk');
if (!env.JAVA_HOME && process.platform === 'win32' && existsSync('C:/Program Files/Java/jdk-21')) env.JAVA_HOME = 'C:/Program Files/Java/jdk-21';
const task = release ? 'bundleRelease' : 'assembleDebug';
if (process.platform === 'win32') run('cmd.exe', ['/d', '/c', 'gradlew.bat', task, '--no-daemon'], android);
else run('./gradlew', [task, '--no-daemon'], android);
const output = resolve(root, 'artifacts'); mkdirSync(output, { recursive: true });
const artifact = release ? 'bundle/release/app-release.aab' : 'apk/debug/app-debug.apk';
const dest = resolve(output, release ? 'bandera-duel-release.aab' : 'bandera-duel-debug.apk');
copyFileSync(resolve(android, 'app/build/outputs', artifact), dest);
console.log(`Entrega: ${dest}`);
