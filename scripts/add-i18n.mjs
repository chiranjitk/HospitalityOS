import fs from 'fs';
import path from 'path';

const BASE = path.resolve('/home/z/my-project/StaySuite-HospitalityOS/src/components');

// Map: directory -> namespace
const DIR_NAMESPACE = {
  admin: 'admin', settings: 'settings', channels: 'channels', crm: 'crm',
  marketing: 'marketing', automation: 'automation', inventory: 'inventory',
  events: 'events', ai: 'ai', notifications: 'notifications', staff: 'staff',
  integrations: 'integrations', webhooks: 'webhooks', help: 'help',
  parking: 'parking', iot: 'iot', chain: 'chain', ads: 'ads', auth: 'auth',
  portal: 'portal', gdpr: 'gdpr', audit: 'audit', common: 'common',
  communication: 'communication', layout: 'layout', profile: 'profile',
};

// Files already translated
const ALREADY_DONE = new Set([
  'layout/header.tsx', 'layout/language-switcher.tsx', 'layout/sidebar.tsx'
]);

// Collect all files
const allFiles = [];
for (const [dir, ns] of Object.entries(DIR_NAMESPACE)) {
  const dirPath = path.join(BASE, dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.tsx'))) {
    const key = `${dir}/${f}`;
    if (ALREADY_DONE.has(key)) continue;
    allFiles.push({ filePath: path.join(dirPath, f), dir, ns, file: f, key });
  }
}

console.log(`Processing ${allFiles.length} files...`);

let modifiedCount = 0;
let skippedCount = 0;
const allKeys = {}; // namespace -> Set of keys

for (const { filePath, dir, ns, file } of allFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Skip if already has useTranslations
  if (content.includes('useTranslations')) {
    console.log(`  SKIP (already has useTranslations): ${dir}/${file}`);
    skippedCount++;
    continue;
  }
  
  // Skip 'use client' components that don't render UI (like wrapper)
  if (content.includes('export default function') && !content.includes('return (') && !content.includes('return <')) {
    // Check if it's just a re-export/wrapper with no JSX
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('import') && !l.trim().startsWith('export') && !l.trim().startsWith('const') && !l.trim().startsWith("'"));
    if (lines.length < 5) {
      console.log(`  SKIP (wrapper/empty): ${dir}/${file}`);
      skippedCount++;
      continue;
    }
  }

  // 1. Add import
  const importLine = `import { useTranslations } from 'next-intl';`;
  let newContent = content;
  
  // Find last import line and add after it
  const importRegex = /^import .+;$/gm;
  const imports = [...content.matchAll(importRegex)];
  if (imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const insertPos = lastImport.index + lastImport[0].length;
    newContent = content.slice(0, insertPos) + '\n' + importLine + content.slice(insertPos);
  } else {
    // Add after 'use client'
    newContent = newContent.replace("'use client';", `'use client';\n\n${importLine}`);
  }

  // 2. Add const t = useTranslations('namespace') in the component function
  // Find the function component pattern
  const funcPatterns = [
    // Named export function
    /export (default )?function (\w+)\s*\(\s*\)\s*\{/g,
    // Named export const (arrow)
    /export (default )?const (\w+) = \(\) => \{/g,
    // Named export const with props
    /export (default )?const (\w+) = \(\{[^}]*\}\) => \{/g,
    // export function with props
    /export (default )?function (\w+)\s*\([^)]*\)\s*\{/g,
    // Regular function
    /function (\w+)\s*\(\s*\)\s*\{/g,
    // Regular const (arrow)  
    /const (\w+) = \(\) => \{/g,
  ];
  
  let hookAdded = false;
  for (const pattern of funcPatterns) {
    const match = [...newContent.matchAll(pattern)];
    // Find the last function declaration that's likely the component
    for (let i = match.length - 1; i >= 0; i--) {
      const m = match[i];
      const funcName = m[2] || m[1];
      // Skip if it's a helper function (starts with lowercase typically, or known non-components)
      if (funcName && funcName[0] === funcName[0].toLowerCase() && 
          !['UserManagement', 'TenantManagement', 'TenantLifecycle', 'RolePermissions', 
             'RevenueAnalytics', 'SystemHealth', 'UsageTracking', 'FeatureGuard', 
             'SectionGuard'].includes(funcName)) {
        continue;
      }
      const afterBrace = m.index + m[0].length;
      // Find next newline after the opening brace
      const nlPos = newContent.indexOf('\n', afterBrace);
      if (nlPos !== -1) {
        const indent = newContent.slice(afterBrace, nlPos + 1).match(/\n(\s*)/)?.[1] || '  ';
        newContent = newContent.slice(0, nlPos + 1) + `${indent}const t = useTranslations('${ns}');\n` + newContent.slice(nlPos + 1);
        hookAdded = true;
        break;
      }
    }
    if (hookAdded) break;
  }

  if (!hookAdded) {
    console.log(`  WARN (could not find component function): ${dir}/${file}`);
    skippedCount++;
    continue;
  }

  fs.writeFileSync(filePath, newContent, 'utf-8');
  modifiedCount++;
  console.log(`  DONE: ${dir}/${file}`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`Modified: ${modifiedCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Total: ${allFiles.length}`);
