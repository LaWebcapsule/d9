---
description: Scaffold a d9 project with Docker Compose, extension management, and GitHub PR/issue templates, and promote its schema, roles and permissions across environments, using the @wbce/projen-d9 template.
readTime: 4 min read
---

# Projen Template

[`@wbce/projen-d9`](https://www.npmjs.com/package/@wbce/projen-d9) is a
[projen](https://projen.io) template for d9 projects. It scaffolds a local
development setup with Docker Compose (Postgres + Redis), extension management, and
GitHub PR and issue templates, and allows you to produce a Docker image you can
deploy to any environment. Its `d9-plumbing` CLI saves your schema, roles,
permissions, reference tables and shared files into the repository and applies them
to your other environments.

Companion package:
[`@wbce/projen-d9-extension`](https://www.npmjs.com/package/@wbce/projen-d9-extension)
for authoring extensions.

::: info Just want to run d9?
If you only need to run d9 (no extensions, no customization), the
[Docker Guide](/self-hosted/docker-guide) is the easier and faster path: one
`docker run` command, no project scaffolding.
:::

::: warning PostgreSQL only
The generated stack (Docker Compose, first run) and `d9-plumbing` assume PostgreSQL
as the d9 database. Extensions, the Dockerfile and the GitHub templates do not
depend on it. Support for other databases may be added in the future.
:::

## Bootstrap a new project

```sh
npx projen new --from @wbce/projen-d9
```

This creates a `.projenrc.js` and synthesizes the project.

## Integrate into an existing project

When you're adopting the template inside an existing d9 repo, projen needs to take
ownership of `package.json` and a handful of other files. The cleanest path is to
delete `package.json` and let `projen new` regenerate everything, then reconcile the
diff against your old config:

1. **Start a feature branch.** Run `git checkout -b add-projen`. You want a clean
   working tree so the post-synth diff is meaningful.
2. **Delete `package.json`** They'll be reconstructed from `.projenrc.js`.

   ```sh
   rm package.json Dockerfile docker-compose.yml .gitignore tsconfig.json
   ```

3. **Bootstrap with `--no-git`.** The flag stops projen from running `git init` or
   making an initial commit on top of your existing history, so you keep full
   control of when to commit.

   ```sh
   npx projen new --from @wbce/projen-d9 --no-git
   ```

4. **Reconcile the diff.** Compare the regenerated files against the previous
   commit (`git diff HEAD`). Anything missing from your old setup (extra deps,
   custom env vars in `docker-compose.yml`, extra Dockerfile steps, custom scripts)
   needs to be expressed in `.projenrc.js`, not patched into the generated files.
   Iterate: edit `.projenrc.js`, re-run `npx projen`, diff again.
   
5. **Commit once the diff is clean.**

::: tip Don't commit until the diff is right
Every `npx projen` run overwrites the managed files, so partial commits are easy
to clobber. Keep iterating on `.projenrc.js` until the generated output matches
what you need, then commit the whole set together.
:::

## Usage

`.projenrc.js`:

```js
import { D9Project } from '@wbce/projen-d9';
import { D9ExtensionType } from '@wbce/projen-d9-extension';

const project = new D9Project({
  name: 'my-d9',
  defaultReleaseBranch: 'main',
  eslintOptions: {
    dirs: ['src', 'test'],
    prettier: true,
  },
});

// A shared package other extensions can depend on
project.addExtension('shared', []);

// A hook extension that depends on the shared package
const myHook = project.addExtension('my-hook', [D9ExtensionType.HOOK]);
myHook.addDeps('shared@workspace:');

project.synth();
```

Then synth and start it:

```sh
npx projen
npx projen first-run   # boot stack + create admin user
npx projen run         # start d9 (port 8055)
```

The default admin user is `admin@example.com` / `totototo`.

::: warning Default credentials
The default admin password (`totototo`) is intentionally weak so you remember to
change it. Rotate it before exposing the instance to anything beyond `localhost`.
:::

The Docker container sets `EXTENSIONS_AUTO_RELOAD=true`, so editing an extension and
re-running `npx projen build-extensions` is enough. No restart, no redeploy.

### Extension types

`D9ExtensionType` values: `INTERFACE`, `DISPLAY`, `LAYOUT`, `MODULE`, `PANEL`,
`ENDPOINT`, `HOOK`, `OPERATION`. Pass an empty array for a shared (non-extension)
package.

Extensions live under `./plugins/` (configurable via `extensionsFolderName`) and are
built by the `build-extensions` task.

```js
// Single-type extension: a standalone `directus:extension` package
project.addExtension('audit-log', [D9ExtensionType.HOOK]);

// Multiple types: bundled under one `directus:extension` of type 'bundle'
project.addExtension('reporting-suite', [
  D9ExtensionType.ENDPOINT,
  D9ExtensionType.MODULE,
]);
```

### Sharing code across extensions

The `plugins/` folder is a pnpm workspace, so the usual pnpm sharing mechanisms
work across extensions:

- **`workspace:` protocol** to depend on a sibling package. The empty-types scaffold
  `addExtension('shared', [])` is the canonical case (see [Usage](#usage) for the
  full example).
- **`pnpm-workspace.yaml` catalogs** to pin shared dependency versions in one
  place, then consume them as `catalog:` from each extension's `deps` / `devDeps`.

## Generated tasks

| Task | Description |
| --- | --- |
| `first-run` | Boot the stack, import the `sql/` snapshot (or bootstrap an empty database), create admin, start d9 |
| `run` | Start d9 (`docker compose up d9`) |
| `build-extensions [name]` | Install and build all extensions (or only `name`) |
| `create-an-admin` | Create the default admin user |
| `d9-plumbing <command>` | Run the `d9-plumbing` CLI, see [Sharing schema across environments](#sharing-schema-across-environments) |

## What gets generated

- `docker-compose.yml`: d9, Postgres (PostGIS), Redis with healthchecks
- `Dockerfile`: Node 22 + pnpm, builds extensions
- `.env.local`: sample for local environment overrides
- `d9-plumbing.json`: configuration of the `d9-plumbing` CLI
- GitHub PR and issue templates via
  [`@wbce/projen-shared`](https://www.npmjs.com/package/@wbce/projen-shared) (set
  `githubConfig: false` to disable)

## Deploying

The generated `Dockerfile` is meant for deployment. Build and push it to your
registry, then run it against your target database and cache:

```sh
docker build -t <registry>/<image>:<tag> .
docker push <registry>/<image>:<tag>
```

Configure the deployed instance via environment variables (database, cache, secrets,
keys) the same way you would any other d9 container. See the
[Config Options](/self-hosted/config-options) page for the full list.

## Sharing schema across environments

`d9-plumbing` goes further than `npx d9 schema snapshot`: besides collections, fields
and relations, it saves **roles and permissions** and the other d9 configuration
tables (flows, dashboards, settings...), the **reference tables** you list, and the
files of the shared `d9-plumbing-common` folder. The full workflow is described in
[Migrate Your Project with Projen](/guides/migration/projen).

### Save a schema

On the source environment (usually local):

```sh
npx d9-plumbing save
```

This writes the schema to `sql/schema.sql`, the configuration tables to
`sql/data/*.csv`, the permissions as Cedar policies to `permissions/`, and pushes the
shared files to the intermediate storage. Add your reference tables to
`sql/tables_to_dump.txt`, one per line. Commit `sql/` and `permissions/`.

`sql/schema.sql` can also be edited by hand, for instance to add indexes the d9 app
cannot create. See [Edit the Schema with SQL](/guides/migration/projen#edit-the-schema-with-sql).

### Apply a schema

On the target environment, from the merged commit:

```sh
npx d9-plumbing apply-schema --last-save <commit of the last save of this environment>
```

The command refuses to run if the target has changes that were never saved. Purge
the d9 cache afterwards. See [Apply](/guides/migration/projen#apply).

## Better auditability with Cedar

On every save, the permissions of each role are transposed into readable
[Cedar](https://www.cedarpolicy.com/) policies in `permissions/<Role>/`
(`authorize.cedar`, `check-fields.cedar`, `validate.cedar`). Access changes show up
as Cedar diffs in your pull requests. You can also edit the policies and write them
back with `npx d9-plumbing cedar-to-d9`, see
[Edit Permissions with Cedar](/guides/migration/projen#edit-permissions-with-cedar).


## Options

The full `D9ProjectOptions` reference lives in the
[package's API docs](https://github.com/LaWebcapsule/projen-templates/blob/main/packages/directus/API.md).
Highlights:

- `extensionsFolderName`: folder for extension packages (default: `plugins`)
- `packageVersions.d9`: version of `@wbce-d9/directus9` (default: `12.0.15`)
- `packageVersions.atlas`: version of the [Atlas](https://atlasgo.io/) Community
  Edition binary used by `d9-plumbing` (default: `1.3.3`)
- `githubConfig`: `GitHubConfigOptions` or `false` to disable

Any option from the projen `TypeScriptProjectOptions` interface is also accepted.

The `d9-plumbing` CLI is configured with `project.configurePlumbing({ intermediateStorage, logLevel })`,
which writes `d9-plumbing.json`. See
[Configure the Intermediate Storage](/guides/migration/projen#configure-the-intermediate-storage).

## Source

- npm: [`@wbce/projen-d9`](https://www.npmjs.com/package/@wbce/projen-d9)
- Repository:
  [LaWebcapsule/projen-templates](https://github.com/LaWebcapsule/projen-templates/tree/main/packages/directus)
