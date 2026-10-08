---
description:
  Learn how to save the schema, roles, permissions, reference data and files of a d9 project and apply them to another
  environment with the d9-plumbing CLI of the projen template.
tags: []
skill_level:
directus_version:
author_override:
author: La Webcapsule
---

# Migrate Your Project with Projen

> {{ $frontmatter.description }}

## Explanation

The [projen template for d9](/self-hosted/projen-d9) ships `d9-plumbing`, a CLI that saves the state of a d9 instance
into your repository and applies it to another environment. It is the most complete way to promote changes from one
environment to another:

- **Roles and permissions are saved.** `npx d9 schema snapshot` only covers collections, fields and relations.
  `d9-plumbing` also saves roles, permissions, flows, operations, dashboards, panels, settings, webhooks and the other
  d9 configuration tables.
- **Reference tables can be added.** Tables holding reference data (countries, categories, statuses...) can be saved
  alongside the configuration.
- **Permissions are human-readable and editable.** Each role gets [Cedar](https://www.cedarpolicy.com/) policies,
  which you can review in pull requests, audit, and edit.
- **Files come along.** Files of the shared `common` folder are transferred between environments.

Everything is plain files (SQL, CSV, Cedar) committed to Git, so every change to your configuration is reviewed and
versioned like code.

::: warning PostgreSQL only

`d9-plumbing` currently supports PostgreSQL only. Support for other databases may be added in the future.

:::

## Prerequisites

- A project managed with the [`@wbce/projen-d9` template](/self-hosted/projen-d9#bootstrap-a-new-project).

Run `d9-plumbing` from the root of the project, either directly or through the generated projen task:

```sh
npx d9-plumbing <command> [options]
npx projen d9-plumbing <command> [options]
npx d9-plumbing --help
```

The CLI reads the same environment as d9 (`.env`, `DB_*`, `STORAGE_*` variables). Each database setting can be
overridden with a flag (`--host`, `--user`, `--password`, `--database`, `--ssl`).

## What Is Saved

| Path                          | Content                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| `sql/schema.sql`              | The whole database schema, dumped with [Atlas](https://atlasgo.io/)        |
| `sql/data/*.csv`              | The d9 configuration tables, including roles and permissions               |
| `sql/tables_to_dump.txt`      | Optional, your reference tables (one per line)                             |
| `sql/tables_not_to_dump.txt`  | Optional, tables never to dump (one per line)                              |
| `permissions/<Role>/*.cedar`  | The permissions of each role, as Cedar policies                            |

### Roles and Permissions

Unlike a [schema snapshot](/self-hosted/cli#migrate-schema-to-a-different-environment), the save dumps every
`directus_*` table, including `directus_roles` and `directus_permissions`. Only tables specific to each environment are
left out: `directus_users`, `directus_sessions`, `directus_revisions`, `directus_activity` and `directus_presets`.

### Reference Tables

List the tables holding reference data in `sql/tables_to_dump.txt`, one per line. Their content is saved with the
configuration and applied to the other environments:

```txt
countries
categories
```

If a reference item points to a user, the reference is replaced with a fixed CI user, so the saved data does not depend
on the users of an environment.

List in `sql/tables_not_to_dump.txt` the tables that must never be saved, even `directus_*` ones.

### Cedar Policies

The permissions are also written as Cedar policies in `permissions/`, one folder per role (`Public` for permissions
without a role):

- `authorize.cedar`: which actions the role can do on which collections, with their filters.
- `check-fields.cedar`: the fields allowed per action.
- `validate.cedar`: the validation rules.

Policies sharing the same conditions are grouped into a single policy, so a role's access fits in a few readable lines.
See [Edit Permissions with Cedar](#edit-permissions-with-cedar).

### Files

Only the files of the d9 folder named `common` and its subfolders are saved: the save dumps only those rows of
`directus_files` and `directus_folders`, so every other file stays local to its environment. Put the files shared by
all environments (logos, default images...) in `common`.

The files themselves are not committed. They are transferred through an intermediate storage shared by your
environments, see [Configure the Intermediate Storage](#configure-the-intermediate-storage).

## Save

On the source environment (usually local), run:

```sh
npx d9-plumbing save
```

It:

1. Dumps the schema into `sql/schema.sql`.
2. Empties `sql/data` and dumps one CSV per saved table.
3. Regenerates the Cedar policies in `permissions/` (skip it with `--no-cedar`).
4. Pushes the files of the `common` folder to the intermediate storage.

Commit `sql/` and `permissions/` and merge them like any other change.

## Apply

On the target environment, from the merged commit, run:

```sh
npx d9-plumbing apply-schema --last-save <commit>
```

`--last-save` is the commit of the last save applied to, or made from, this environment. Before applying anything, the
command checks that the target has no unsaved changes, by comparing a fresh save of the target with the `sql/` folder
of that commit. If someone changed the target directly, the command fails: run `save` there first, commit,
then retry. `--no-last-save` skips this check (after a confirmation), and `--yes` skips the confirmations.

The command then pulls the files from the intermediate storage, applies the SQL snapshot and imports the saved tables.

Once done, purge the d9 cache ([`POST /utils/cache/clear`](/reference/system/utilities#clear-the-internal-cache)) so
the new schema, and permissions when `CACHE_ENABLED` is set, are taken into account. Restart d9 if flows, operations or
webhooks changed.

::: tip New environment

On an empty database, `npx d9-plumbing first-import` applies the snapshot and pulls the files.

:::

## Edit Permissions with Cedar

1. Edit the policies in `permissions/<Role>/*.cedar`.
2. Write them back into the CSV:

   ```sh
   npx d9-plumbing cedar-to-d9
   ```

   A (role, collection, action) added in Cedar creates a permission, one removed from Cedar deletes it. Every role
   folder must match an existing role (except `Public`).

3. Apply it to your local d9. The local database has not changed since the last commit, so use `HEAD` as the last
   save:

   ```sh
   npx d9-plumbing apply-schema --last-save HEAD
   ```

4. Purge the d9 cache and check the permissions in d9.
5. Commit the `.cedar` files and the CSV together, then [apply](#apply) them to the other environments.

## Edit the Schema with SQL

`sql/schema.sql` is the source of truth for the schema: `apply-schema` loads it into a temporary database, computes the
difference with the target database, and applies only that difference. You can therefore change the schema
by editing the file, for instance to add an index, which the d9 app cannot create:

1. Add the statement to `sql/schema.sql`:

   ```sql
   CREATE INDEX "articles_published_at_idx" ON "public"."articles" ("published_at");
   ```

2. Apply it to your local d9:

   ```sh
   npx d9-plumbing apply-schema --last-save HEAD
   ```

   Do not run `save` before this step: `save` dumps the schema from the database and overwrites your edit.

3. Optionally run `npx d9-plumbing save` to rewrite `sql/schema.sql` in the format Atlas dumps.
4. Commit `sql/schema.sql`, then [apply](#apply) it to the other environments.

## Configure the Intermediate Storage

The intermediate storage accepts the same drivers as d9 (`s3`, `gcs`, `azure`, `local`, `cloudinary`). It is resolved
from, by increasing priority:

1. `configurePlumbing()` in `.projenrc.js`, which writes `d9-plumbing.json`. Secrets are given as the names of the
   environment variables holding them, never as values:

   ```js
   project.configurePlumbing({
   	intermediateStorage: {
   		driver: 's3',
   		options: { bucket: 'my-d9-files', region: 'eu-west-3' },
   		secretEnv: { key: 'S3_ACCESS_KEY_ID_ENV_VAR', secret: 'S3_SECRET_ACCESS_KEY_ENV_VAR' },
   	},
   });
   ```

2. `INTERMEDIATE_STORAGE_*` environment variables (e.g. `INTERMEDIATE_STORAGE_DRIVER=s3`).
3. The repeatable `--intermediate-storage-config key=value` flag.

The storage of the d9 instance itself is the first location of `STORAGE_LOCATIONS`. `npx d9-plumbing push-files` and
`npx d9-plumbing pull-files` sync the files on their own; `save` and `apply-schema` run them for you.

## Reference

The full CLI reference (every command and option) lives in the
[d9-plumbing documentation](https://github.com/LaWebcapsule/projen-templates/blob/main/packages/directus/docs/D9-plumbing.md).
