# @wbce-d9/exceptions

## 10.0.1

### Patch Changes

- [#416](https://github.com/LaWebcapsule/d9/pull/416)
  [`8a59add`](https://github.com/LaWebcapsule/d9/commit/8a59add5b9b0039cc77f0a00f0f6874a16531100) - security: `_in`
  validation rules with an empty list (e.g. `$CURRENT_USER.user_roles.role` for a user without roles) now
  (GHSA-hxgm-ghmv-xjjm, CVE-2024-39701) reject any value instead of accepting everything (GHSA-hxgm-ghmv-xjjm /
  CVE-2024-39701)

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
