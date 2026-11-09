---
description: REST API documentation on the Indexes endpoints in d9.
readTime: 5 min read
pageClass: page-reference
---

# Indexes

> List, create and delete the indexes of a collection. These endpoints are only available to admin users and have no
> GraphQL equivalent.

Indexes are database objects, not rows in a d9 system collection: the database is the source of truth. d9 lists every
index the database reports, including indexes created outside d9, but only manages plain (non-unique) indexes, including
partial indexes where the database supports them. See [Indexes](/app/data-model/collections#indexes) for the app
workflow and the supported databases.

---

## The Index Object

`name` **string**\
Name of the index in the database.

`columns` **array**\
Columns the index covers, in order. The order matters for composite indexes.

`unique` **boolean**\
Whether the index enforces uniqueness.

`kind` **string**\
One of `index`, `primary`, `unique_constraint`, `unique_index`, `foreign_key_index` or `expression`.

`partial` **boolean**\
Whether the index only covers rows matching a condition.

`predicate` **string or null**\
For partial indexes, the SQL predicate as reported by the database. Display only: it is not accepted as input.

`deletable` **boolean**\
Whether the index can be dropped from d9.

`delete_blocked_reason` **string**\
When `deletable` is `false`, one of `primary_key`, `unique` or `foreign_key`. Otherwise `null`.

```json
{
	"name": "articles_status_published_index",
	"columns": ["status", "published_at"],
	"unique": false,
	"kind": "index",
	"partial": true,
	"predicate": "\"status\" = 'published'",
	"deletable": true,
	"delete_blocked_reason": null
}
```

---

## The Index Capabilities Object

`vendor` **string**\
Database client used by the instance.

`supported` **boolean**\
Whether index management is available on this database.

`where` **boolean**\
Whether partial indexes are supported.

```json
{
	"vendor": "postgres",
	"supported": true,
	"where": true
}
```

Current support: PostgreSQL, MySQL/MariaDB, SQLite, Microsoft SQL Server and OracleDB. Partial indexes are only
available on PostgreSQL, SQLite and SQL Server. CockroachDB and Amazon Redshift are not supported. Always read
`meta.capabilities` instead of hard-coding this list. See [the Indexes section](/app/data-model/collections#indexes).

---

## List Indexes in a Collection

List the indexes of a collection.

### Query Parameters

This endpoint doesn't currently support any query parameters.

### Returns

An array of [index objects](#the-index-object) sorted by name, and the database capabilities.

On a database that doesn't support index management, the endpoint returns `200` with an empty `data` array and
`supported: false`; it does not list the indexes.

### REST API

```
GET /indexes/:collection
```

##### Example

```
GET /indexes/articles
```

```json
{
	"data": [
		{
			"name": "articles_pkey",
			"columns": ["id"],
			"unique": true,
			"kind": "primary",
			"partial": false,
			"predicate": null,
			"deletable": false,
			"delete_blocked_reason": "primary_key"
		},
		{
			"name": "articles_status_published_index",
			"columns": ["status", "published_at"],
			"unique": false,
			"kind": "index",
			"partial": true,
			"predicate": "\"status\" = 'published'",
			"deletable": true,
			"delete_blocked_reason": null
		}
	],
	"meta": {
		"capabilities": {
			"vendor": "postgres",
			"supported": true,
			"where": true
		}
	}
}
```

### GraphQL

n/a

---

## Create an Index

Create a plain (non-unique) index. Partial indexes are supported when `capabilities.where` is `true`.

### Request Body

`columns` **array**\
Required. The columns to index, in order. The order matters for composite indexes.

`name` **string**\
Optional. The full index name. When omitted, d9 generates it.

`where` **object**\
Optional. A [filter](/reference/filter-rules) selecting the rows to index. Only available on databases that support partial
indexes. Use scalar fields: relational filters are not supported by the index form.

### Index Names

The generated name is `<table>_<column1>_<column2>_index`, lowercased, with dots and dashes replaced by underscores. It
is shortened with a hash when it exceeds 60 characters.

A custom name must match `^[a-z][a-z0-9_]*$` and be at most 60 characters. It must start with the normalized `<table>_`
prefix and end with the `_index` suffix, with at least one character between them. The app adds the prefix and suffix
automatically; this endpoint expects the full name. In PostgreSQL, index names share the namespace with tables, so a
name already used by a table or another relation is rejected.

Partial index predicates must be deterministic: the database rejects non-immutable functions and expressions with a
`400`.

### Returns

The created [index object](#the-index-object).

### REST API

```
POST /indexes/:collection
```

```json
{
	"columns": ["status", "published_at"],
	"name": "articles_status_published_index",
	"where": {
		"status": { "_eq": "published" }
	}
}
```

### GraphQL

n/a

---

## Delete an Index

Drop an index by name. The index definition is removed from the database; no data is deleted.

### Returns

```json
{
	"data": null
}
```

Indexes whose `deletable` property is `false` cannot be dropped: primary keys, unique constraints or unique indexes, and
foreign-key indexes are managed by d9 or the database.

### REST API

```
DELETE /indexes/:collection/:name
```

##### Example

```
DELETE /indexes/articles/articles_status_published_index
```

### GraphQL

n/a

---

## Limitations

- There is no endpoint to read a single index; use [List Indexes](#list-indexes-in-a-collection).
- Indexes cannot be updated in place. Drop the index and create a new one.
- Only plain, non-unique indexes can be created, plus partial indexes where supported. Unique indexes, expression
  indexes, non-B-tree methods, included columns, operator classes and `CREATE INDEX CONCURRENTLY` are not exposed. Use
  SQL for those.
- These endpoints are REST only. There is no GraphQL equivalent.
- Indexes are not part of `/schema/snapshot`, `/schema/diff` or `/schema/apply`. With the projen workflow,
  `d9-plumbing save` captures the full schema, indexes included, in `sql/schema.sql`; otherwise, recreate the indexes on
  the target. See [Migrate Your Data Model](/guides/migration/index).

## Audit

Creating or deleting an index writes an entry to the Activity Log against the collection. The entry is best-effort: a
failure to write it does not undo the index change. Index changes do not emit Flow or Webhook events.

## Errors

| Status | When                                                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | The database does not support index management or partial indexes; the name is invalid or already taken; the predicate is rejected; the index cannot be deleted. |
| `403`  | The user is not an admin; the collection does not exist; the index does not exist when deleting.                                                                 |
