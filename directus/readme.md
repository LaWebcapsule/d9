<p>&nbsp;</p>

<a href="https://d9.dev" target="_blank" rel="noopener noreferrer"><img width="250" alt="d9 Logo" src="https://raw.githubusercontent.com/LaWebcapsule/directus9/docs-d9/docs/public/logo-light.svg"></a>

<p>&nbsp;</p>

**d9 is an open-source fork of Directus 9 (GPLv3), maintained independently by [La Webcapsule](https://github.com/LaWebcapsule). This repository is not affiliated with the Directus core team.**

## Introduction

**d9 is a free and open-source data platform for headless content management**. It can be installed on top of
any new or existing SQL database, instantly providing a dynamic API (REST+GraphQL) and accompanying App for managing
content. Built entirely in TypeScript (in Node and Vue), d9 is completely modular and end-to-end extensible...
with absolutely no paywalls or artificial limitations.

Modern and intuitive, the d9 App enables no-code data discovery, allowing for even the most non-technical users to
view, author, and manage your raw database content. Our performant and flexible API is able to adapt to any relational
schema, and includes rule-based permissions, event/web hooks, custom endpoints, numerous auth options, configurable
storage adapters, and much more.

Current database support includes: PostgreSQL, MySQL, SQLite, MS-SQL Server, OracleDB, MariaDB, and variants such as AWS
Aurora/Redshift or Google Cloud Platform SQL.

Learn more at...

- [GitHub](https://github.com/LaWebcapsule/directus9)
- [Documentation](https://docs.d9.dev)

<p>&nbsp;</p>

## Installing

d9 requires NodeJS 18+.

Install d9:

```
npm install @wbce-d9/directus9
```

Or using yarn:

```
yarn install @wbce-d9/directus9
```

Create a new project with our simple CLI tool:

```
npx directus init
```

The above command will create a directory with your project name, then walk you through the database configuration and
creation of your first admin user.

<p>&nbsp;</p>

## Updating

To update an existing d9 project, navigate to your project directory and run:

```
npm update
```

<p>&nbsp;</p>

## Migrating from directus@9.0.0^ to @wbce-d9@9.0.0^

You need to change your dependencies:

1. In package.json

```
"directus":9.0.0^ --> "@wbce-d9/directus9": 9.0.0^
"@directus/some-package" --> "@wbce-d9/some-package"
```

2. Update your dependencies:

```
npm update
```

3. If you have some code:

```ts
import {...} from "directus"
import {...} from "@directus/some-package"
```

should become:

```ts
import {...} from "@wbce-d9/directus9"
import {...} from "@wbce-d9/some-package"
```

4. You don't have to do any changes to your databases. d9 uses the same schema as directus@9.0.0^. As a
   consequence, you don't need other changes than the three steps below.

## Contributing

Please report any and all issues [on our GitHub](https://github.com/LaWebcapsule/directus9/issues/new).

Pull-requests are more than welcome, and always appreciated. Please be sure to read our
[Contributors Guide](https://docs.d9.dev/contributing/introduction/) before starting work on a new feature/fix, or
reach out via [GitHub Discussions](https://github.com/LaWebcapsule/directus9/discussions) with any questions.

<p>&nbsp;</p>

## License

d9 is released under the [GPLv3 license](./license). This repository is a fork of Directus 9, which was released under GPLv3 by Monospace Inc.
d9 is an independent project maintained by La Webcapsule.
