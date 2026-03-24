# d9 — Directus 9 Fork by La Webcapsule

## Project

d9 is an open-source fork of Directus 9 (GPLv3), focused on performance and EU regulatory compliance. Maintained by La Webcapsule.

## Skills & Contributing

### Install the d9-skills plugin

All agent skills and the SkillOps contribution pipeline live in the **[d9-skills](https://github.com/LaWebcapsule/d9-skills)** plugin repo.

```bash
# As a Claude Code plugin (recommended — includes skills + commands + hooks)
git clone https://github.com/LaWebcapsule/d9-skills.git
claude --plugin-dir ./d9-skills

# Skills only (any agent)
npx skills add LaWebcapsule/d9-skills
```

### Contributing a skill

Every debugging session is a potential contribution. Run `/d9-skills:skillops` to share your experience. The pipeline detects the pattern, anonymizes your session, formats a SKILL.md, and opens a PR — all from a single command.

## Important rules

- Code identifiers `@directus/`, `directus_*`, `DIRECTUS_*`, `npx d9`, `new Directus()` must NEVER be renamed
- Plugins must be rebuilt (`pnpm build` in plugins/) before any deployment
- AWS region is eu-west-3 (Paris) for all services
- Contact: support@webcapsule.io
