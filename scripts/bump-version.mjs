import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../package.json');

const targetType = process.argv[2]?.toLowerCase();
const validTypes = ['major', 'staging', 'patch', 'task'];

if (!targetType || !validTypes.includes(targetType)) {
  console.error(`❌ Sử dụng: node scripts/bump-version.mjs <major|staging|patch|task>`);
  process.exit(1);
}

const rawPkg = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(rawPkg);

let [major, staging, patch, task] = (pkg.version || '0.0.0.0')
  .split('.')
  .map((v) => parseInt(v, 10) || 0);

const oldVersion = `${major}.${staging}.${patch}.${task}`;

switch (targetType) {
  case 'task':
    task += 1;
    break;
  case 'patch':
    patch += 1;
    task = 0;
    break;
  case 'staging':
    staging += 1;
    patch = 0;
    task = 0;
    break;
  case 'major':
    major += 1;
    staging = 0;
    patch = 0;
    task = 0;
    break;
}

const newVersion = `${major}.${staging}.${patch}.${task}`;
pkg.version = newVersion;

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`🚀 Version bumped: ${oldVersion} -> ${newVersion} (${targetType.toUpperCase()})`);

