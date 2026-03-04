---
name: cdn-to-local-assets-migration
description: Process for migrating documentation assets from external CDN to local files to prevent broken links.
tags: [migration, docs, assets, cdn]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: la-webcapsule
  source: d9-session
  sessions: 2
  confidence: 0.80
---

# Skill: CDN to Local Assets Migration

## Purpose

When forking a project that references assets from the original project's CDN, those CDN links can break at any time (CDN taken down, URLs changed, access revoked). This skill describes the process for auditing all CDN references and migrating assets to local files.

## Triggers

- A project fork is being created and the original project hosts assets on its own CDN
- Documentation contains references to external image/video URLs (e.g., `https://cdn.original-project.com/...`)
- A CDN migration or domain change is planned

## Actions

1. **Audit**: Generate a CSV of all external asset references in the documentation
   ```bash
   # Find all CDN references in markdown files
   grep -rn "https://cdn\." docs/ > cdn-assets-audit.csv
   ```

2. **Categorize** each asset in the CSV:
   - **Keep**: Download locally, update the markdown reference
   - **Replace**: Provide a new asset (e.g., rebranded screenshot)
   - **Remove**: Delete the reference from documentation (outdated content)

3. **Download** assets to keep into `docs/public/images/`
   ```bash
   curl -o docs/public/images/filename.webp "https://cdn.example.com/original.webp"
   ```

4. **Update references** in all markdown files:
   ```markdown
   <!-- BEFORE -->
   ![Alt text](https://cdn.example.com/image.webp)

   <!-- AFTER -->
   ![Alt text](/images/image.webp)
   ```

5. **Verify**: Check for broken image links by building the docs site and visually inspecting key pages

6. **Clean up**: Remove the audit CSV before merging

## Errors Prevented

- **Broken images in production docs**: If the original project revokes CDN access or changes URLs, all images in your fork's documentation break simultaneously. No warning — images just show as broken. In the d9 migration, 267 assets were at risk (162 images, 103 videos, 2 other).

- **Mixed content warnings**: If your docs site uses HTTPS but CDN links are HTTP, browsers may block the images silently.

## Restrictions

- Do NOT download copyrighted assets you don't have rights to — check the original project's license
- Videos are often too large to host locally — consider re-hosting on your own CDN or YouTube
- Keep the original filenames when possible to make the migration traceable
- Add `docs/public/images/` to your git LFS configuration if the total size exceeds 50MB
