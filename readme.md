<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/public/logo-readme-light.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/public/logo-readme.svg">
    <img alt="d9 Logo" src="docs/public/logo-readme.svg" width="200">
  </picture>
</p>

<br />

# d9 — Open Data Platform

**d9** is an open-source fork of [Directus 9](https://github.com/directus/directus) (GPLv3), maintained independently by [La Webcapsule](https://github.com/LaWebcapsule). As Directus 10+ is now a premium open-source software, this repository aims to maintain a standard openSource version of Directus 9.

> d9 is not affiliated with, endorsed by, or connected to the Directus core team or Monospace Inc.

## Why d9?

- **Open-source permanence** — d9 stays GPLv3, forever. No premium gates, no vendor lock-in.
- **Drop-in compatibility** — Same database schema as Directus 9. Migrate in minutes, not days.

## Features

- **REST & GraphQL API** — Instantly layers a blazingly fast Node.js API on top of any SQL database.
- **Manage pure SQL** — Works with new or existing SQL databases, no migration required.
- **Multi-database support** — PostgreSQL, MySQL, SQLite, OracleDB, CockroachDB, MariaDB, and MS-SQL.
- **Self-hosted** — Run on your own infrastructure. You own your data.
- **Fully extensible** — Modular architecture, easy to customize with extensions.
- **No-code Data Studio** — An intuitive Vue.js dashboard for non-technical users.

## Quick Start

```bash
npm init @wbce-d9/directus-project@latest
```

Or with Docker:

```bash
docker run -d -p 8055:8055 ghcr.io/lawebcapsule/directus9:latest
```

## Migrating from Directus 9

d9 uses the same database schema as Directus 9. No database migration needed.

### 1. Update your dependencies

```json
// package.json
"directus": "9.x.x"           →  "@wbce-d9/directus9": "10.x.x"
"@directus/some-package"       →  "@wbce-d9/some-package"
```

### 2. Update your imports

```ts
// Before
import { ... } from "directus"
import { ... } from "@directus/some-package"

// After
import { ... } from "@wbce-d9/directus9"
import { ... } from "@wbce-d9/some-package"
```

### 3. Install & run

```bash
npm update
npx d9 start
```

## JS SDK

```bash
npm install @wbce-d9/sdk
```

## Extensions

All Directus 9 extensions are compatible with d9 out of the box.

To create a new extension:

```bash
npm init @wbce-d9/directus-extension@latest
```

## Links

- **[Documentation](https://d9.webcapsule.io/getting-started/introduction.html)** — Full reference and guides
- **[GitHub](https://github.com/LaWebcapsule/directus9)** — Source code and issues
- **[Contributing](./contributing.md)** — How to contribute to d9

## License

d9 is released under the [GPLv3 license](./license).

This repository is a fork of Directus 9, which was released under GPLv3 by Monospace Inc. d9 is an independent project maintained by La Webcapsule.

## Asset Disclaimer

This fork contains modified versions of the original Directus documentation assets (screenshots, diagrams, and videos). These assets have been altered to replace Directus branding with d9 branding and to remove any user-identifying information. No original Directus trademarks, logos, or personal data from Directus contributors are used in this project.
