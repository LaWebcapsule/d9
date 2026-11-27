# @wbce-d9/schema

## 10.0.2

### Patch Changes

- [#520](https://github.com/LaWebcapsule/d9/pull/520)
  [`9ecf689`](https://github.com/LaWebcapsule/d9/commit/9ecf689f95395929c42461d7a0570e514405bde1) - Fixed the Postgres
  schema overview crashing when a table or column is dropped while the schema is being read.

## 10.0.1

### Patch Changes

- [#506](https://github.com/LaWebcapsule/d9/pull/506)
  [`b25f94e`](https://github.com/LaWebcapsule/d9/commit/b25f94e0f539179e93b487704b166b7f0e51fe86) - Built with
  TypeScript 5.9: `primary()` of the CockroachDB, Oracle and MSSQL schema inspectors is now typed as returning
  `string | null`, as it returns `null` when there is no primary key, and `optionToObject` is typed
  `(option: T | string) => T`

## 10.0.0

### Major Changes

- a561d87: Migrate to Node.js 22 runtime

## 9.26.4

### Patch Changes

- b59e970: npm security updates

## 9.26.3

### Patch Changes

- f1b4684: change package organization

## 9.26.2

### Patch Changes

- 973f4bb: update packages

## 9.26.1

### Patch Changes

- 9e4a63a: @directus9
