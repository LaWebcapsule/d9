#!/usr/bin/env node
/**
 * generate-skill-pr-comment.js
 *
 * Reads a SKILL.md (or AMENDMENT.yaml) from a skill directory and generates
 * an ASCII fiche as a PR comment. Used by the curate-on-pr GitHub Action.
 *
 * Usage:
 *   node scripts/generate-skill-pr-comment.js .claude/skills/rebuild-plugins-before-deploy
 *   node scripts/generate-skill-pr-comment.js .claude/skills/some-skill  # with AMENDMENT.yaml
 */

const fs = require('fs');
const path = require('path');

// --- YAML frontmatter parser (simple, no deps) ---
function parseFrontmatter(content) {
  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split('\n');
  let currentKey = null;

  for (const line of lines) {
    // Top-level key: value
    const kvMatch = line.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let val = kvMatch[2].trim();
      // Array [a, b, c]
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim());
      }
      // Skip empty values (nested objects like metadata:)
      if (val === '' || val === '>') continue;
      meta[currentKey] = val;
    }
    // Indented key: value (nested, flatten into meta)
    const nestedMatch = line.match(/^\s+(\w[\w_-]*):\s*(.+)$/);
    if (nestedMatch) {
      meta[nestedMatch[1]] = nestedMatch[2].trim();
    }
  }
  return { meta, body: match[2] };
}

// --- Extract sections from markdown body ---
function extractSections(body) {
  const sections = {};
  let currentSection = null;
  let currentContent = [];

  for (const line of body.split('\n')) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = headingMatch[1].trim().toLowerCase();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }
  return sections;
}

// --- Extract list items from a section ---
function extractListItems(text) {
  if (!text) return [];
  const items = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^[-*]\s+(.+)$/);
    if (m) items.push(m[1].trim());
    const n = line.match(/^\d+\.\s+(.+)$/);
    if (n) items.push(n[1].trim());
  }
  return items;
}

// --- Generate ASCII flow from actions ---
function generateActionFlow(actions) {
  const items = extractListItems(actions);
  if (items.length === 0) return '  (no actions defined)';

  const lines = [];
  for (let i = 0; i < items.length; i++) {
    const label = items[i].length > 45 ? items[i].substring(0, 42) + '...' : items[i];
    lines.push(`  [${label}]`);
    if (i < items.length - 1) {
      lines.push('         |');
      lines.push('         v');
    }
  }
  return lines.join('\n');
}

// --- Read ASQM scores from agent.yaml if present ---
function readAgentYaml(skillDir) {
  const agentPath = path.join(skillDir, 'agent.yaml');
  if (!fs.existsSync(agentPath)) return null;

  const content = fs.readFileSync(agentPath, 'utf-8');
  const scores = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*(agent_native|cognitive|composability|stance|asqm_quality):\s*(\d+)/);
    if (m) scores[m[1]] = parseInt(m[2]);
    const s = line.match(/^\s*status:\s*(\S+)/);
    if (s) scores.status = s[1];
  }
  return Object.keys(scores).length > 0 ? scores : null;
}

// --- Generate score bar ---
function scoreBar(score, max = 5) {
  const filled = '█'.repeat(score);
  const empty = '░'.repeat(max - score);
  return `${filled}${empty} ${score}/${max}`;
}

// --- MAIN ---
function generateNewSkillComment(skillDir) {
  const skillPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    console.error(`Error: ${skillPath} not found`);
    process.exit(1);
  }

  const content = fs.readFileSync(skillPath, 'utf-8');
  const { meta, body } = parseFrontmatter(content);
  const sections = extractSections(body);
  const asqm = readAgentYaml(skillDir);

  const name = meta.name || path.basename(skillDir);
  const version = meta.version || '1.0.0';
  const description = meta.description || '(no description)';
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const confidence = meta.metadata ? (meta.confidence || '') : '';
  const sessions = meta.metadata ? (meta.sessions || '') : '';

  let output = [];

  output.push(`## 🔍 Skill Review — ${name}`);
  output.push('');
  output.push(`**Status:** NEW | **Version:** ${version}`);

  if (asqm && asqm.asqm_quality !== undefined) {
    output.push(`**ASQM:** ${asqm.asqm_quality}/20 [${asqm.status || 'pending'}]`);
  }

  if (tags.length > 0) {
    output.push(`**Tags:** ${tags.map(t => `\`${t}\``).join(' ')}`);
  }

  output.push('');
  output.push(`> ${description}`);
  output.push('');

  // Triggers
  if (sections.triggers) {
    output.push('### Triggers');
    output.push('```');
    const triggers = extractListItems(sections.triggers);
    if (triggers.length > 0) {
      triggers.forEach(t => output.push(`  ● ${t}`));
    } else {
      output.push(sections.triggers.split('\n').map(l => `  ${l}`).join('\n'));
    }
    output.push('```');
    output.push('');
  }

  // Actions flow
  if (sections.actions) {
    output.push('### Actions');
    output.push('```');
    output.push(generateActionFlow(sections.actions));
    output.push('```');
    output.push('');
  }

  // Errors prevented
  if (sections['errors prevented']) {
    output.push('### Errors Prevented');
    output.push('');
    const errorText = sections['errors prevented'];
    const errorBlocks = errorText.split(/(?=- \*\*)/);
    for (const block of errorBlocks) {
      const trimmed = block.trim();
      if (trimmed) {
        output.push(trimmed.startsWith('-') ? trimmed : `- ${trimmed}`);
      }
    }
    output.push('');
  }

  // ASQM scores
  if (asqm) {
    output.push('### ASQM Score');
    output.push('```');
    if (asqm.agent_native !== undefined) output.push(`  agent_native   ${scoreBar(asqm.agent_native)}`);
    if (asqm.cognitive !== undefined) output.push(`  cognitive      ${scoreBar(asqm.cognitive)}`);
    if (asqm.composability !== undefined) output.push(`  composability  ${scoreBar(asqm.composability)}`);
    if (asqm.stance !== undefined) output.push(`  stance         ${scoreBar(asqm.stance)}`);
    output.push('```');
    output.push('');
  }

  output.push('---');
  output.push('*Generated by [d9 SkillOps](https://github.com/AurelienMusic/directus9) pipeline*');

  return output.join('\n');
}

function generateAmendmentComment(skillDir) {
  const amendPath = path.join(skillDir, 'AMENDMENT.yaml');
  if (!fs.existsSync(amendPath)) return null;

  const content = fs.readFileSync(amendPath, 'utf-8');
  const { meta, body } = parseFrontmatter(content);
  const sections = extractSections(body);

  const targetSkill = meta.target_skill || '(unknown)';
  const targetVersion = meta.target_version || '?';
  const proposedVersion = meta.proposed_version || '?';

  let output = [];

  output.push(`## 📝 Amendment to: ${targetSkill}`);
  output.push('');
  output.push(`**${targetVersion}** → **${proposedVersion}** proposed`);
  output.push(`**Source:** ${meta.source_sessions || 1} session(s)`);
  output.push('');

  // Additions
  if (sections['actions (append)'] || body.includes('## Actions')) {
    output.push('### Actions Added');
    output.push('```');
    const actionsText = sections['actions (append)'] || sections['actions'] || '';
    const items = extractListItems(actionsText);
    items.forEach(item => output.push(`  + ${item}`));
    output.push('```');
    output.push('');
  }

  if (sections['errors prevented (append)'] || sections['errors prevented']) {
    output.push('### New Errors Prevented');
    output.push('');
    const errorText = sections['errors prevented (append)'] || sections['errors prevented'] || '';
    output.push(errorText);
    output.push('');
  }

  if (sections['triggers (append)'] || sections['triggers']) {
    output.push('### New Triggers');
    output.push('```');
    const triggerText = sections['triggers (append)'] || sections['triggers'] || '';
    const items = extractListItems(triggerText);
    items.forEach(item => output.push(`  + ${item}`));
    output.push('```');
    output.push('');
  }

  output.push('---');
  output.push('*Generated by [d9 SkillOps](https://github.com/AurelienMusic/directus9) pipeline*');

  return output.join('\n');
}

// --- Entry point ---
const skillDir = process.argv[2];
if (!skillDir) {
  console.error('Usage: node generate-skill-pr-comment.js <skill-directory>');
  console.error('  e.g.: node generate-skill-pr-comment.js .claude/skills/rebuild-plugins-before-deploy');
  process.exit(1);
}

const resolvedDir = path.resolve(skillDir);

// Check for amendment first
const amendmentPath = path.join(resolvedDir, 'AMENDMENT.yaml');
if (fs.existsSync(amendmentPath)) {
  const comment = generateAmendmentComment(resolvedDir);
  if (comment) {
    console.log(comment);
    process.exit(0);
  }
}

// Otherwise generate new skill comment
console.log(generateNewSkillComment(resolvedDir));
