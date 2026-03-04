<p align="center"><img alt="Directus Logo" src="https://user-images.githubusercontent.com/522079/158864859-0fbeae62-9d7a-4619-b35e-f8fa5f68e0c8.png"></p>

<br />

**This repository is a fork of the Directus 9. Directus 9 was under GPLv3 license and so is this repository. As Directus
10 is now <i>a premium open-source software</i>, this repository aims to maintain a standard openSource version of
Directus 9. This repository is not bound to the directus core team.**

## 🐰 Introduction

Directus is a real-time API and App dashboard for managing SQL database content.

- **Free & open-source.** No artificial limitations, vendor lock-in, or hidden paywalls.
- **REST & GraphQL API.** Instantly layers a blazingly fast Node.js API on top of any SQL database.
- **Manage pure SQL.** Works with new or existing SQL databases, no migration required.
- **Choose your database.** Supports PostgreSQL, MySQL, SQLite, OracleDB, CockroachDB, MariaDB, and MS-SQL.
- **On-Prem or Cloud.** Run locally, install on-premises, or use our
  [self-service Cloud service](https://directus.io/pricing).
- **Completely extensible.** Built to white-label, it is easy to customize our modular platform.
- **A modern dashboard.** Our no-code Vue.js app is safe and intuitive for non-technical users, no training required.

**[Learn more about Directus](https://directus.io)** • **[Documentation](https://docs.directus.io)**

<br />

## Migrating from directus@9.0.0^ to @wbce-d9@9.0.0^

You need to change your dependencies :

1. In package.json

```
"directus":9.0.0^ --> "@wbce-d9/directus9": 10.0.0^
"@directus/some-package" --> "@wbce-d9/some-package"
```

2. Update your dependencies :

```
npm update
```

3. If you have some code :

```ts
import {...} from "directus"
import {...} from "@directus/some-package"
```

should become :

```ts
import {...} from "@wbce-d9/directus9"
import {...} from "@wbce-d9/some-package"
```

4. You don't have to do any changes to your databases. Directus9 use the same schema as directus@9.0.0^. As a
   consequence, you don't need other changes than the three steps below.

## Migrating from version @wbce-d9@9.0.0^ to @wbce-d9@10.0.0^

We've recognized and rectified an issue within Directus 9 related to Single Sign-On (SSO) management, ensuring
standardization. While exceptionally uncommon, this could occasionally cause a discrepancy between your SSO user and
Directus. Should this occur, we advise synchronizing Directus' external_id with your SSO. Please note that IDs are now
case-sensitive.

### JS SDK

A JS sdk is also realeased under _@wbce-d9_, you can install it via:

```bash
npm install --save @wbce-d9/sdk
```

### Extensions

All classic Directus versions 9 extensions should work without any hurdle with this open source branch.

If you want to start building a new extension the utility tool is also realeased, use is as so:

```bash
npm init @wbce-d9/directus-extension@latest
```

## License

Directus is released under the [GPLv3 license](./license). Monospace Inc owns all Directus trademarks, logos, and
intellectual property on behalf of our project's community. Copyright © 2004-2020, Monospace Inc.

**This repository is a fork of the Directus 9. Directus 9 was under GPLv3 license and so is this repository. As Directus
10 is now <i>a premium open-source software</i>, this repository aims to maintain a standard openSource version of
Directus 9. This repository is not bound to the directus core team.**

