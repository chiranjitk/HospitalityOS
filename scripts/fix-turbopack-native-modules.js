#!/usr/bin/env node
/**
 * fix-turbopack-native-modules.js
 *
 * Turbopack (Next.js 16 bundler) expects a `napi_versions` field inside the
 * `binary` object of node-pre-gyp style package.json files. Some older native
 * modules (e.g. lzma-native@4.0.6) don't include this field, causing build
 * failures with: "missing field `napi_versions`".
 *
 * This script patches affected package.json files after every `bun install`.
 * It is idempotent — safe to run multiple times.
 */

const fs = require('fs');
const path = require('path');

function patchBinaryField(pkgJsonPath) {
  try {
    const raw = fs.readFileSync(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(raw);

    if (pkg.binary && !('napi_versions' in pkg.binary)) {
      pkg.binary.napi_versions = [];
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  [patched] ${path.relative(process.cwd(), pkgJsonPath)}`);
    }
  } catch (e) {
    // Ignore missing/unreadable files — not all modules have node-pre-gyp binary fields
  }
}

// Packages known to cause Turbopack build failures due to missing napi_versions
const targets = [
  'lzma-native',
  'node-sqlite3',
  'sqlite3',
  'canvas',
  'bcrypt',
  'cpu-features',
];

let patched = 0;
for (const name of targets) {
  const pkgPath = path.join('node_modules', name, 'package.json');
  if (fs.existsSync(pkgPath)) {
    patchBinaryField(pkgPath);
    patched++;
  }
}

if (patched > 0) {
  console.log(`  fix-turbopack-native-modules: ${patched} package(s) patched`);
}
