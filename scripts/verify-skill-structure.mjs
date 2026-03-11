#!/usr/bin/env node
/**
 * verify-skill-structure.mjs
 * Validates SKILL.md files against the SkillOps spec.
 *
 * Usage:
 *   node scripts/verify-skill-structure.mjs .claude/skills/d9/rebuild-plugins-before-deploy
 *   node scripts/verify-skill-structure.mjs --all
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const REQUIRED_FRONTMATTER = ['name', 'description'];
const RECOMMENDED_FRONTMATTER_META = ['license', 'metadata'];
const REQUIRED_SECTIONS = ['Purpose', 'Triggers', 'Behavior', 'Restrictions', 'Self-Check'];
const RECOMMENDED_SECTIONS = ['Examples'];

function parseFrontmatter(content) {
  content = content.replace(/\r\n/g, '\n');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content, error: 'No YAML frontmatter found' };

  const yaml = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of yaml.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (kv) frontmatter[kv[1]] = kv[2].trim();
  }

  return { frontmatter, body, error: null };
}

function extractSections(body) {
  const sections = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) sections.push(match[1].trim());
  }
  return sections;
}

function validateSkill(skillDir) {
  const skillPath = join(skillDir, 'SKILL.md');
  const errors = [];
  const warnings = [];

  let content;
  try {
    content = readFileSync(skillPath, 'utf-8');
  } catch {
    errors.push(`SKILL.md not found in ${skillDir}`);
    return { errors, warnings, score: 0 };
  }

  if (content.trim().length === 0) {
    errors.push('SKILL.md is empty');
    return { errors, warnings, score: 0 };
  }

  // Parse frontmatter
  const { frontmatter, body, error } = parseFrontmatter(content);
  if (error) errors.push(error);

  // Check required frontmatter fields
  for (const field of REQUIRED_FRONTMATTER) {
    if (!frontmatter[field]) {
      errors.push(`Missing frontmatter field: ${field}`);
    }
  }

  // Check tags format
  if (frontmatter.tags && !frontmatter.tags.startsWith('[')) {
    warnings.push('Tags should be in array format: [tag1, tag2]');
  }

  // Check version format
  if (frontmatter.version && !/^\d+\.\d+\.\d+$/.test(frontmatter.version)) {
    warnings.push(`Version "${frontmatter.version}" doesn't follow semver (x.y.z)`);
  }

  // Check sections
  const sections = extractSections(body);

  for (const req of REQUIRED_SECTIONS) {
    const found = sections.some(s =>
      s.toLowerCase().includes(req.toLowerCase()) ||
      s.toLowerCase().replace(/[^a-z]/g, '').includes(req.toLowerCase().replace(/[^a-z]/g, ''))
    );
    if (!found) errors.push(`Missing required section: ## ${req}`);
  }

  for (const rec of RECOMMENDED_SECTIONS) {
    const found = sections.some(s => s.toLowerCase().includes(rec.toLowerCase()));
    if (!found) warnings.push(`Missing recommended section: ## ${rec}`);
  }

  // Check self-check has checkboxes
  const selfCheckMatch = body.match(/## Self-Check[\s\S]*?(?=\n## |$)/);
  if (selfCheckMatch) {
    const checkboxes = (selfCheckMatch[0].match(/- \[ \]/g) || []).length;
    if (checkboxes === 0) warnings.push('Self-Check section has no checkboxes (- [ ])');
    if (checkboxes < 3) warnings.push(`Self-Check has only ${checkboxes} items (recommend >= 3)`);
  }

  // Check for agent.yaml
  try {
    readFileSync(join(skillDir, 'agent.yaml'), 'utf-8');
  } catch {
    warnings.push('No agent.yaml found (optional but recommended for ASQM scoring)');
  }

  // Calculate basic quality score
  let score = 20;
  score -= errors.length * 3;
  score -= warnings.length * 1;
  score = Math.max(0, Math.min(20, score));

  return { errors, warnings, score };
}

function findAllSkillDirs(baseDir) {
  const dirs = [];
  try {
    for (const cat of readdirSync(baseDir)) {
      const catPath = join(baseDir, cat);
      if (!statSync(catPath).isDirectory()) continue;
      for (const skill of readdirSync(catPath)) {
        const skillPath = join(catPath, skill);
        if (statSync(skillPath).isDirectory()) {
          dirs.push(skillPath);
        }
      }
    }
  } catch { /* empty */ }
  return dirs;
}

// Main
const args = process.argv.slice(2);
let skillDirs = [];

if (args.includes('--all')) {
  const base = resolve('.claude/skills');
  skillDirs = findAllSkillDirs(base);
} else if (args.length > 0) {
  skillDirs = args.map(a => resolve(a));
} else {
  console.log('Usage: node scripts/verify-skill-structure.mjs <skill-dir> [--all]');
  process.exit(1);
}

let hasErrors = false;

for (const dir of skillDirs) {
  const name = dir.split(/[/\\]/).slice(-2).join('/');
  const { errors, warnings, score } = validateSkill(dir);

  const status = errors.length === 0 ? '✅' : '❌';
  console.log(`\n${status} ${name} (score: ${score}/20)`);

  for (const e of errors) console.log(`  ❌ ${e}`);
  for (const w of warnings) console.log(`  ⚠️  ${w}`);

  if (errors.length > 0) hasErrors = true;
}

console.log(`\n${skillDirs.length} skill(s) checked.`);
process.exit(hasErrors ? 1 : 0);
