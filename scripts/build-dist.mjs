import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const distDir = path.join(rootDir, 'dist');

/**
 * Extension runtime files to include in dist.
 * Keep this list limited to what Chrome needs to load the unpacked extension.
 */
const runtimePaths = [
  'manifest.json',
  'content.js',
  'contentAT.js',
  'popup.html',
  'popup.js',
  'launcher-icon-1x.png',
  'vendor',
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function copyDir(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(src, dest);
    } else if (entry.isFile()) {
      await copyFile(src, dest);
    }
  }
}

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  const missing = [];
  for (const rel of runtimePaths) {
    const abs = path.join(rootDir, rel);
    if (!(await pathExists(abs))) missing.push(rel);
  }

  if (missing.length > 0) {
    console.error('Build failed: missing runtime files:');
    for (const rel of missing) console.error(`- ${rel}`);
    process.exitCode = 1;
    return;
  }

  for (const rel of runtimePaths) {
    const src = path.join(rootDir, rel);
    const dest = path.join(distDir, rel);
    const stat = await fs.stat(src);

    if (stat.isDirectory()) {
      await copyDir(src, dest);
    } else {
      await copyFile(src, dest);
    }
  }

  console.log('Built dist/ with extension runtime files:');
  for (const rel of runtimePaths) console.log(`- ${rel}`);
}

await main();
