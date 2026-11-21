import {readFile, writeFile, readdir, mkdir, copyFile} from 'node:fs/promises';
import {dirname, extname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8'
};
const assets = {};
async function includeAssets(directory, prefix) {
  for (const item of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    if (item.name.startsWith('.')) continue;
    const path = join(directory, item.name);
    const key = prefix + '/' + item.name;
    if (item.isDirectory() && (prefix || item.name === 'assets')) {
      await includeAssets(path, key);
    } else if (item.isFile() && mime[extname(item.name)]) {
      assets[key] = [mime[extname(item.name)], (await readFile(path)).toString('base64')];
    }
  }
}
await includeAssets(dist, '');
if (!assets['/index.html']) throw new Error('Missing dist/index.html');
const template = await readFile(join(root, 'worker/index.js'), 'utf8');
const marker = '/* EMBED_STATIC_ASSETS */ {}';
if (template.split(marker).length !== 2) throw new Error('Worker asset placeholder missing or duplicated');
const output = join(dist, 'server/index.js');
const builtManifest = join(dist, '.openai/hosting.json');
await Promise.all([mkdir(dirname(output), {recursive: true}), mkdir(dirname(builtManifest), {recursive: true})]);
await writeFile(output, template.replace(marker, () => JSON.stringify(assets)));
await copyFile(join(root, '.openai/hosting.json'), builtManifest);
console.log('Built Worker with ' + Object.keys(assets).length + ' static assets.');
