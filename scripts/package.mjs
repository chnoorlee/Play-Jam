import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const from = file => path.join(root, file);
const licenseTail = text => text.slice(text.lastIndexOf('\nLicense\n') + 1);
const dependencies = [
  ['three 0.187.0', 'node_modules/three/LICENSE', false],
  ['lucide 0.468.0', 'node_modules/lucide/LICENSE', false],
  ['pathfinding 0.4.18', 'node_modules/pathfinding/README.md', true],
  ['heap 0.2.5 (transitive PathFinding.js dependency)', 'node_modules/heap/README.md', true],
];
let notices = '# Third-Party Notices\n\nRuntime dependency notices copied from the installed packages.\nThree.js and PathFinding.js: MIT. Lucide: ISC with Feather attribution. heap: PSF, as distributed by its author.\n\nProject integration: modules are bundled/minified for the browser; no intentional edits to the underlying heap algorithms.\n';
for (const [name, file, tail] of dependencies) {
  const text = (await readFile(from(file), 'utf8')).replaceAll('\r\n', '\n');
  notices += `\n## ${name}\n\n${tail ? licenseTail(text) : text}\n`;
}
await writeFile(from('THIRD_PARTY_NOTICES.md'), notices);
await cp(from('THIRD_PARTY_NOTICES.md'), from('dist/THIRD_PARTY_NOTICES.md'));
const destination = from('release/TheLastPost');
await mkdir(destination, { recursive: true });
const files = ['dist', 'src', 'tests', 'scripts', 'docs', 'package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'server.mjs', 'start.cmd', 'README.zh-CN.md', 'THIRD_PARTY_NOTICES.md'];
for (const file of files) await cp(from(file), path.join(destination, file), { recursive: true });
await mkdir(path.join(destination, 'artifacts'), { recursive: true });
for (const file of ['intro-desktop.png', 'gameplay-desktop.png', 'echo-desktop.png', 'gameplay-390x844.png', 'ending-release.png', 'e2e-report.json', 'production-smoke.json', 'unit-test-results.txt']) {
  await cp(from(`artifacts/${file}`), path.join(destination, 'artifacts', file));
}
console.log(`Packaged ${destination}`);
