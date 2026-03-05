# d9 Skills Index

## d9 Experience Skills (`d9/`)

Skills derived from real development sessions on d9. These prevent known pitfalls and accelerate onboarding. Specific to this project.

| Skill | Version | Description | Tags |
|-------|---------|-------------|------|
| [rebuild-plugins-before-deploy](./d9/rebuild-plugins-before-deploy/) | 1.0.0 | Rebuild plugins before deploy to avoid silent failures | deploy, plugins |
| [preserve-directus-code-identifiers](./d9/preserve-directus-code-identifiers/) | 1.1.0 | Never rename code identifiers when rebranding a Directus fork | fork, rebrand |
| [node-v24-windows-escape](./d9/node-v24-windows-escape/) | 1.0.0 | Escape `!` in node -e on Windows to avoid bash history expansion | environment, windows |
| [vitepress-logo-sizing](./d9/vitepress-logo-sizing/) | 1.0.0 | Fix logo distortion in VitePress dark mode with explicit CSS height | ui, css |
| [cdn-to-local-assets-migration](./d9/cdn-to-local-assets-migration/) | 1.0.0 | Migrate CDN-hosted doc assets to local files | migration, docs |
| [ses-eu-west3-setup](./d9/ses-eu-west3-setup/) | 1.0.0 | Configure AWS SES in eu-west-3 for EU email delivery | infra, aws |
| [d9-fork-setup](./d9/d9-fork-setup/) | 1.0.0 | Complete d9 dev environment setup (2 days → 2 hours) | setup, onboarding |
| [crlf-docker-entrypoint](./d9/crlf-docker-entrypoint/) | 1.0.0 | Prevent shell script failures from Windows CRLF line endings in Docker | docker, windows |
| [d9-key-secret-env](./d9/d9-key-secret-env/) | 1.0.0 | Ensure KEY and SECRET env vars are set with distinct values | auth, config |
| [d9-migration-session-tracking](./d9/d9-migration-session-tracking/) | 1.0.0 | Fix silent migration failure on session_id columns causing 500 on login | migration, database |
| [pnpm-ci-true-docker](./d9/pnpm-ci-true-docker/) | 1.0.0 | Set CI=true in Docker to avoid pnpm 10+ TTY prompts | docker, pnpm |
| [pnpm-deploy-require-path](./d9/pnpm-deploy-require-path/) | 1.0.0 | Fix Cannot find module errors for transitive deps with pnpm deploy | docker, pnpm |

## SkillOps — Meta Skills (`skillops/`)

Generic pipeline skills for capturing, comparing, anonymizing, and formatting developer experiences into shareable skills. **Not tied to d9 — works in any project.**

Drop the `skillops/` folder into any repo to enable community skill contributions.

| Skill | Version | Description | Tags |
|-------|---------|-------------|------|
| [detect-xp](./skillops/detect-xp/) | 2.0.0 | Detect reusable error/solution patterns during sessions | pipeline, detection |
| [match-existing](./skillops/match-existing/) | 1.0.0 | Compare experience against existing skills (new/amendment/duplicate) | pipeline, comparison |
| [anonymize-session](./skillops/anonymize-session/) | 1.1.0 | Clean & decontextualize sensitive info before sharing (runs locally) | pipeline, security |
| [format-skill](./skillops/format-skill/) | 1.0.0 | Generate SKILL.md or AMENDMENT.yaml from anonymized experience | pipeline, formatting |
| [refine-skill-design](./skillops/refine-skill-design/) | 1.0.0 | Audit & improve SKILL.md quality using ASQM meta-audit | meta, quality |
| [discover-skills](./skillops/discover-skills/) | 1.0.0 | Find skills from external catalogs to fill capability gaps | meta, discovery |
| [curate-skills](./skillops/curate-skills/) | 1.0.0 | Score (ASQM), tag, normalize, and audit all skills | meta, curation |

### Verification Tools

```bash
# Validate a single skill
node scripts/verify-skill-structure.mjs .claude/skills/d9/rebuild-plugins-before-deploy

# Validate all skills
node scripts/verify-skill-structure.mjs --all

# Check registry consistency
node scripts/verify-registry.mjs
```

## How to contribute

1. Work on d9 with Claude Code — `detect-xp` will detect reusable patterns
2. Say "Yes" when prompted to contribute
3. The pipeline handles comparison, anonymization, formatting, and quality checks automatically
4. `refine-skill-design` ensures the skill meets quality standards (ASQM >= 17)
5. Open a PR with the generated skill file
6. `curate-skills` runs in CI to score and check for overlaps
7. A maintainer reviews and merges

## How to reuse SkillOps in another project

```bash
# Copy the skillops folder into your project
cp -r .claude/skills/skillops/ /path/to/your-project/.claude/skills/skillops/

# Copy the CI workflow and PR template
cp .github/workflows/curate-on-pr.yml /path/to/your-project/.github/workflows/
cp .github/PULL_REQUEST_TEMPLATE/skill-contribution.md /path/to/your-project/.github/PULL_REQUEST_TEMPLATE/
cp scripts/generate-skill-pr-comment.js /path/to/your-project/scripts/

# Done — the pipeline works immediately
```

See the [PR template](../../.github/PULL_REQUEST_TEMPLATE/skill-contribution.md) for contribution guidelines.
