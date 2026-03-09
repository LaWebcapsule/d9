#!/usr/bin/env node
/**
 * verify-registry.mjs
 * Validates .skills.json registry against actual skill directories.
 *
 * Usage: node scripts/verify-registry.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const registryPath = resolve('.skills.json');
let registry;

try {
  registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
} catch (e) {
  console.error('❌ Cannot read .skills.json:', e.message);
  process.exit(1);
}

let hasErrors = false;
const allSkills = [];

console.log(`Registry: ${registry.name} v${registry.version}\n`);

for (const [catName, cat] of Object.entries(registry.categories || {})) {
  console.log(`📁 ${catName} (${cat.path})`);

  const catDir = resolve(cat.path);

  for (const skill of cat.skills || []) {
    const skillDir = join(catDir, skill);
    const skillMd = join(skillDir, 'SKILL.md');

    if (!existsSync(skillDir)) {
      console.log(`  ❌ ${skill} — directory not found: ${skillDir}`);
      hasErrors = true;
      continue;
    }

    if (!existsSync(skillMd)) {
      console.log(`  ❌ ${skill} — SKILL.md not found`);
      hasErrors = true;
      continue;
    }

    // Read frontmatter name and check consistency
    const content = readFileSync(skillMd, 'utf-8').replace(/\r\n/g, '\n');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const nameMatch = match[1].match(/^name:\s*(.+)/m);
      if (nameMatch && nameMatch[1].trim() !== skill) {
        console.log(`  ⚠️  ${skill} — frontmatter name "${nameMatch[1].trim()}" doesn't match directory name`);
      }
    }

    allSkills.push(skill);
    console.log(`  ✅ ${skill}`);
  }

  console.log();
}

// Check for orphan skills (on disk but not in registry)
const { readdirSync, statSync } = await import('fs');
for (const [catName, cat] of Object.entries(registry.categories || {})) {
  const catDir = resolve(cat.path);
  if (!existsSync(catDir)) continue;

  for (const entry of readdirSync(catDir)) {
    const entryPath = join(catDir, entry);
    if (!statSync(entryPath).isDirectory()) continue;
    if (!existsSync(join(entryPath, 'SKILL.md'))) continue;

    if (!cat.skills.includes(entry)) {
      console.log(`⚠️  Orphan skill: ${catName}/${entry} — on disk but not in .skills.json`);
    }
  }
}

console.log(`\n${allSkills.length} skill(s) verified.`);
process.exit(hasErrors ? 1 : 0);
