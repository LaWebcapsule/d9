# @wbce-d9/api

## 12.7.0

### Minor Changes

- [#430](https://github.com/LaWebcapsule/d9/pull/430)
  [`eb7890d`](https://github.com/LaWebcapsule/d9/commit/eb7890d705ca0ecf3e92d928a39e90265596f5bc) - Added the
  `AUTH_<PROVIDER>_REQUIRE_REFRESH_TOKEN` option for the OpenID and OAuth2 drivers (default `true`, which keeps the
  current behavior). Setting it to `false` lets users log in and renew their session when the identity provider issued
  no refresh token (for example Google when the account has already granted consent), instead of rejecting them with
  `INVALID_CREDENTIALS` / "No [OpenID] Session found". A stored refresh token is still checked against the provider.

  With the default, a login without a refresh token now redirects once to the provider with `prompt=consent` (as already
  done for a revoked token) instead of failing right away, and a stored refresh token is no longer overwritten with
  `null` when the provider does not issue a new one on login.

### Patch Changes

- [#441](https://github.com/LaWebcapsule/d9/pull/441)
  [`4e86904`](https://github.com/LaWebcapsule/d9/commit/4e869043bb2c092d5aa0d6e893407f79fe5663d0) - security: when
  `GRAPHQL_INTROSPECTION` is disabled, the GraphQL SDL is no longer served by `/server/specs/graphql` nor
  (GHSA-wxwm-3fxv-mrvx, CVE-2026-35413) by the `server_specs_graphql` query, as it exposes the same schema information
  as an introspection query (GHSA-wxwm-3fxv-mrvx / CVE-2026-35413)

- [#437](https://github.com/LaWebcapsule/d9/pull/437)
  [`a6ec87c`](https://github.com/LaWebcapsule/d9/commit/a6ec87c3b5057b5616a611169020f9ebdb1348d8) - security: password
  reset requests now always take at least the same minimum time, whatever the outcome (invalid (GHSA-jr94-gj3h-c8rf,
  CVE-2026-26185) `reset_url`, unknown or inactive user, mail error), so response timing no longer reveals whether an
  account exists (GHSA-jr94-gj3h-c8rf).

- [#451](https://github.com/LaWebcapsule/d9/pull/451)
  [`7792afb`](https://github.com/LaWebcapsule/d9/commit/7792afba141f9bd9249b132b16a40eba2d00a7b1) - security: Validate
  client-supplied values for `uuid` fields on create and store them lowercased (GHSA-9v9p-pxh4-qxj9)

- [#438](https://github.com/LaWebcapsule/d9/pull/438)
  [`16aa3cb`](https://github.com/LaWebcapsule/d9/commit/16aa3cb19341edf981582527a2ea13d3ed54b76c) - security: concealed
  fields (such as user passwords and tokens) of the payload received by an event-triggered flow are
  (GHSA-x3vm-88hf-gpxp, CVE-2025-53885) now masked in the "Log to Console" operation output and in the flow run
  revisions (GHSA-x3vm-88hf-gpxp)

- [#444](https://github.com/LaWebcapsule/d9/pull/444)
  [`d492d37`](https://github.com/LaWebcapsule/d9/commit/d492d37fa9d0ba2c5dcda9b8d4c42a3a82b13d78) - security: an access
  token passed in the query string is no longer written to the logs (GHSA-vw58-ph65-6rxp / (CVE-2024-47822)
  CVE-2024-47822)
- Updated dependencies [[`490e25e`](https://github.com/LaWebcapsule/d9/commit/490e25e6a1577514c097da123e74ab2f55a8968c),
  [`2db4d1d`](https://github.com/LaWebcapsule/d9/commit/2db4d1d6c4fa8339c590340bfe14f7595148b3b5),
  [`aba4181`](https://github.com/LaWebcapsule/d9/commit/aba4181682b087ffc0909cc355e4676572d8fa6c),
  [`0a82510`](https://github.com/LaWebcapsule/d9/commit/0a825102ce18631669bbcd1d21636398f38896d6),
  [`f95759f`](https://github.com/LaWebcapsule/d9/commit/f95759fb4af879ffb432474b626f549e2c342820),
  [`20fc79d`](https://github.com/LaWebcapsule/d9/commit/20fc79d568e80de4177bfaccffbbe23f2790914e),
  [`2db4d1d`](https://github.com/LaWebcapsule/d9/commit/2db4d1d6c4fa8339c590340bfe14f7595148b3b5)]:
  - @wbce-d9/app@11.2.0

## 12.6.1

### Patch Changes

- [#427](https://github.com/LaWebcapsule/d9/pull/427)
  [`7956e59`](https://github.com/LaWebcapsule/d9/commit/7956e594eedf194da2565f13971a5c136579ad3c) - security: `hash`
  fields are now concealed on read, like `conceal` fields, so their value is no longer stored in clear text
  (GHSA-mvv8-v4jj-g47j, CVE-2026-39943) in revisions when an item is created, and their hash is no longer returned by
  the API (GHSA-mvv8-v4jj-g47j).

- [#425](https://github.com/LaWebcapsule/d9/pull/425)
  [`7e04036`](https://github.com/LaWebcapsule/d9/commit/7e0403632d8c11d2d2bcba1b43aec432a6ed185d) - security: fields
  with the `conceal` special can no longer be used with value-returning aggregate functions (`min`,
  (GHSA-38hg-ww64-rrwc, CVE-2026-35442, GHSA-8jpw-gpr4-8cmh, CVE-2025-64748) `max`, `sum`, `avg`, …)
  (GHSA-38hg-ww64-rrwc / CVE-2026-35442) and are excluded from search (GHSA-8jpw-gpr4-8cmh / CVE-2025-64748), to prevent
  extracting their values

- [#429](https://github.com/LaWebcapsule/d9/pull/429)
  [`90fb2e7`](https://github.com/LaWebcapsule/d9/commit/90fb2e7bf0bfcc3a51071ca111c1d998cc1b7e65) - security: deleting a
  field now removes it from the permissions of its collection, so a field later created with the same
  (GHSA-9x5g-62gj-wqf2, CVE-2025-64746) name no longer inherits the deleted field's access (GHSA-9x5g-62gj-wqf2 /
  CVE-2025-64746)

- [#426](https://github.com/LaWebcapsule/d9/pull/426)
  [`3a76a3a`](https://github.com/LaWebcapsule/d9/commit/3a76a3a80f3c4d384d7a99277dca8c2a651e6209) - security: the
  OpenAPI specification served by `/server/specs/oas` now only exposes the exact running version in
  (GHSA-rmjh-cf9q-pv7q) `info.version` to admins, like `/server/info`; other users get `0.0.0-hidden`
  (GHSA-rmjh-cf9q-pv7q)

- [#424](https://github.com/LaWebcapsule/d9/pull/424)
  [`2c9fefc`](https://github.com/LaWebcapsule/d9/commit/2c9fefcb0e76d8d513cc4a33ec559cb93b9ca59d) - security: manual
  Flow triggers now require read access to the Flow and to the target collection / items (GHSA-7cvf-pxgp-42fc,
  CVE-2025-53889) (GHSA-7cvf-pxgp-42fc / CVE-2025-53889)
- Updated dependencies
  [[`d4d8aa9`](https://github.com/LaWebcapsule/d9/commit/d4d8aa999c5515b618555b25e6df914a3d2ad703)]:
  - @wbce-d9/app@11.1.0

## 12.6.0

### Minor Changes

- [#418](https://github.com/LaWebcapsule/d9/pull/418)
  [`cd9638d`](https://github.com/LaWebcapsule/d9/commit/cd9638dbf8b3f911aca3f1aaf57dca32027cf661) - security: file
  import from URL now only connects to public IP addresses, checked on every redirect hop through (GHSA-j5h6-vqc3-phqh,
  GHSA-wv3h-5fx7-966h, GHSA-xhgj-x4mj-6c93, CVE-2026-61835, CVE-2026-35409) request-filtering-agent, and follows at most
  5 redirects (GHSA-xhgj-x4mj-6c93). Importing files from private IP addresses now fails unless they are listed in the
  new `IMPORT_FILE_IP_ALLOW_LIST` (IPs or CIDR ranges).

  `IMPORT_IP_DENY_LIST`'s `0.0.0.0` entry now also denies IPv6 local interface addresses (e.g. `::1`), as documented.
  This applies to webhooks and Flows too: requests to `localhost` resolving to `::1` are now denied.

### Patch Changes

- [#414](https://github.com/LaWebcapsule/d9/pull/414)
  [`fbaca91`](https://github.com/LaWebcapsule/d9/commit/fbaca91348958934721cb67936c92ac26b97a2dc) - security: Fixed an
  open redirect in the SAML ACS endpoint: `RelayState` is now validated against the allowed login redirects
  (GHSA-qmqf-6vxq-c7f4) before redirecting, on both the success and error paths
- Updated dependencies
  [[`8a59add`](https://github.com/LaWebcapsule/d9/commit/8a59add5b9b0039cc77f0a00f0f6874a16531100)]:
  - @wbce-d9/utils@10.0.4
  - @wbce-d9/exceptions@10.0.1
  - @wbce-d9/app@11.0.1
  - @wbce-d9/extensions-sdk@10.0.5
  - @wbce-d9/storage-driver-azure@10.0.4
  - @wbce-d9/storage-driver-cloudinary@10.0.5
  - @wbce-d9/storage-driver-gcs@10.0.4
  - @wbce-d9/storage-driver-local@10.0.4
  - @wbce-d9/storage-driver-s3@10.0.4

## 12.5.11

### Patch Changes

- [#413](https://github.com/LaWebcapsule/d9/pull/413)
  [`5b79c1f`](https://github.com/LaWebcapsule/d9/commit/5b79c1f3135c5e1bd18ef1d3a7fcbe4e17e9bb6e) - security: Fixed a
  security issue (CVE-2026-35408) where responses were sent without a `Cross-Origin-Opener-Policy` header, so a
  (GHSA-8m32-p958-jg99) cross-origin page that opened the login page could keep a reference to its window and tamper
  with the SSO flow. The header is now set to `same-origin` by default and can be changed with
  `CROSS_ORIGIN_OPENER_POLICY` (`same-origin-allow-popups` or `unsafe-none`).

- [#400](https://github.com/LaWebcapsule/d9/pull/400)
  [`9ba2f5e`](https://github.com/LaWebcapsule/d9/commit/9ba2f5e287bc36e6d94dbf1c916e6f2daa066f03) - security: condition
  operation errors now only contain the path and type of each failed rule, so webhook flows returning
  (GHSA-fm3h-p9wm-h74h) the last operation data no longer leak `$env`, `$accountability` or other flow data
  (GHSA-fm3h-p9wm-h74h)

- [#411](https://github.com/LaWebcapsule/d9/pull/411)
  [`e0655b1`](https://github.com/LaWebcapsule/d9/commit/e0655b1bf7b332620e22022d116deff1b163977b) - security: Harden the
  login redirect validator against backslash and port bypasses (GHSA-f42p-ffpq-jh5c)

## 12.5.10

### Patch Changes

- [#398](https://github.com/LaWebcapsule/d9/pull/398)
  [`7f20016`](https://github.com/LaWebcapsule/d9/commit/7f20016c7de2a65f3153412362bdedec5e26833c) - security: Fixed a
  security issue where the OpenID login handler forwarded arbitrary request query parameters into the
  (GHSA-qchf-7rv9-8wmm) authorization request, allowing a caller to override server-set protocol parameters
  (`redirect_uri`, `state`, `nonce`, `code_challenge`) or inject others (`client_id`, `response_type`, `request_uri`).
  Reserved protocol parameters are now stripped from forwarded query parameters, and the remaining ones are merged
  before the server-set parameters so the latter always win. Non-protocol parameters such as Keycloak's `kc_action`
  continue to work.

## 12.5.9

### Patch Changes

- [#396](https://github.com/LaWebcapsule/d9/pull/396)
  [`0f20df6`](https://github.com/LaWebcapsule/d9/commit/0f20df670e3cb534cf571f11d348340f1cb30d68) - security: include
  role, admin/app access, share and share scope in the response cache key so cached responses are no
  (GHSA-2mh4-2jfx-3h7r) longer shared between anonymous, share and role contexts that have no user id
  (GHSA-2mh4-2jfx-3h7r)

## 12.5.8

### Patch Changes

- [#380](https://github.com/LaWebcapsule/d9/pull/380)
  [`1136ffc`](https://github.com/LaWebcapsule/d9/commit/1136ffc780684e1c49872993036344ce6f842db6) - Keep a file's title,
  description and tags when the file is replaced

- [#391](https://github.com/LaWebcapsule/d9/pull/391)
  [`25f74b2`](https://github.com/LaWebcapsule/d9/commit/25f74b2d4f92f36be688e1d05419994fb0f3a0c4) - security: assets csp
  hardening

- [#393](https://github.com/LaWebcapsule/d9/pull/393)
  [`50beac9`](https://github.com/LaWebcapsule/d9/commit/50beac94cafa1db3fe665e1ea982745721ad171e) - Pin the transitive
  `uuid` security override to `^11.1.1` so CommonJS dependencies (e.g. the MSSQL driver's `@azure/msal-node`) can still
  load it

## 12.5.7

### Patch Changes

- Updated dependencies [70ea742]
  - @wbce-d9/app@11.0.0

## 12.5.6

### Patch Changes

- b9776d5: security: fix audit alerts
- Updated dependencies [b9776d5]
  - @wbce-d9/storage-driver-cloudinary@10.0.4
  - @wbce-d9/update-check@10.0.4
  - @wbce-d9/utils@10.0.3
  - @wbce-d9/app@10.1.3
  - @wbce-d9/extensions-sdk@10.0.4
  - @wbce-d9/storage-driver-azure@10.0.3
  - @wbce-d9/storage-driver-gcs@10.0.3
  - @wbce-d9/storage-driver-local@10.0.3
  - @wbce-d9/storage-driver-s3@10.0.3

## 12.5.5

### Patch Changes

- Updated dependencies [86d6ce4]
  - @wbce-d9/app@10.1.2

## 12.5.4

### Patch Changes

- b619954: Add a new env var to disable graphql

## 12.5.3

### Patch Changes

- 01c493c: security: fix audit alerts (sanitize-html 2.17.7, nanoid 5.1.16, undici 7.29.0, dompurify 3.4.13 + transitive
  dependency overrides), and release the catalog bumps that were never published (joi 18.2.1, lodash-es 4.18.1, tmp
  0.2.7)
- Updated dependencies [01c493c]
  - @wbce-d9/app@10.1.1
  - @wbce-d9/storage-driver-cloudinary@10.0.3
  - @wbce-d9/update-check@10.0.3
  - @wbce-d9/utils@10.0.2
  - @wbce-d9/extensions-sdk@10.0.3
  - @wbce-d9/storage-driver-azure@10.0.2
  - @wbce-d9/storage-driver-gcs@10.0.2
  - @wbce-d9/storage-driver-local@10.0.2
  - @wbce-d9/storage-driver-s3@10.0.2

## 12.5.2

### Patch Changes

- c3b166a: security: fix Dependabot alerts (sharp 0.35.3 + transitive dependency overrides)

## 12.5.1

### Patch Changes

- c44b95d: qualify the `collection` scope column in many-to-any (a2o/o2a) filter and sort JOINs
- afab06b: security: fix Dependabot alerts (nodemailer 9.0.3, ws 6.2.5/8.21.1, uuid ≥11.1.1)

## 12.5.0

### Minor Changes

- 41d2185: configure (revisions|activity).item to work as a m2a (alias) field
- 41d2185: Add date_created and date_updated on directus_users table

### Patch Changes

- cc14faf: when inviting an user that doesn't exist, reload user data from db after creation
- Updated dependencies [41d2185]
- Updated dependencies [41d2185]
  - @wbce-d9/app@10.1.0

## 12.4.5

### Patch Changes

- Updated dependencies [b2847d6]
  - @wbce-d9/app@10.0.5

## 12.4.4

### Patch Changes

- Updated dependencies [1b20ba2]
  - @wbce-d9/app@10.0.4

## 12.4.3

### Patch Changes

- eeea793: Fix vulnerabilities
- Updated dependencies [eeea793]
  - @wbce-d9/storage-driver-cloudinary@10.0.2
  - @wbce-d9/update-check@10.0.2
  - @wbce-d9/app@10.0.3

## 12.4.2

### Patch Changes

- Updated dependencies [839d3c7]
  - @wbce-d9/app@10.0.2

## 12.4.1

### Patch Changes

- 205431f: Bump handlebars to 4.7.9 for security fix
- Updated dependencies [205431f]
  - @wbce-d9/app@10.0.1

## 12.4.0

### Minor Changes

- b0cf593: Increment openid-client version.

## 12.3.0

### Minor Changes

- 92162bc: Enable multi-tabs sessions
- b1da816: Change the default config for the oauth2 cookie
- 92162bc: Enable multi-tabs session
- 2787990: Add "system-only" fields

### Patch Changes

- cdd19fe: Properly count alias array length in validate payload
- 57db0c9: Update qs version
- 5a896e5: Rebrand Directus to d9: update docs, logos, sidebar loader, and fix broken CDN image references
- 6d89f94: Fix getIPFromReq to safely handle undefined IP values by returning an empty string instead of throwing an
  error
- Updated dependencies [5a896e5]
- Updated dependencies [6310473]
  - @wbce-d9/app@10.0.0

## 12.2.0

### Minor Changes

- 9a3d8e7: Add QS_ARRAY_LIMIT & QS_PARAMETER_LIMIT env variables and upate qs to 6.14.1

### Patch Changes

- 1f4d43f: Bump lodash-es from 4.17.21 to 4.17.23
- Updated dependencies [c1ae2c0]
- Updated dependencies [b830a2e]
- Updated dependencies [b830a2e]
- Updated dependencies [1f4d43f]
- Updated dependencies [df9b144]
  - @wbce-d9/app@9.35.1
  - @wbce-d9/storage-driver-cloudinary@10.0.1
  - @wbce-d9/utils@10.0.1
  - @wbce-d9/extensions-sdk@10.0.2
  - @wbce-d9/storage-driver-azure@10.0.1
  - @wbce-d9/storage-driver-gcs@10.0.1
  - @wbce-d9/storage-driver-local@10.0.1
  - @wbce-d9/storage-driver-s3@10.0.1

## 12.1.0

### Minor Changes

- 3eb24d9: Add MAX_ITEMS_PER_QUERY, maximum number of items allowed when querying relational field
- 18cfe9c: Add a way to define check constraints through api and web app

### Patch Changes

- 3eb24d9: Bump qs from 6.11.1 to 6.14.1
- Updated dependencies [3eb24d9]
- Updated dependencies [3eb24d9]
- Updated dependencies [18cfe9c]
  - @wbce-d9/app@9.35.0
  - @wbce-d9/update-check@10.0.1
  - @wbce-d9/exceptions@10.0.0
  - @wbce-d9/extensions-sdk@10.0.1
  - @wbce-d9/utils@10.0.0

## 12.0.6

### Patch Changes

- cb6e010: fix regexp in getSharedDependency.

## 12.0.5

### Patch Changes

- 853cc61: Bump auth0/node-jws to 3.2.3
- 853cc61: Bump node-forge to 1.3.2

## 12.0.4

### Patch Changes

- fae5aba: Bump nodemailer from 7.0.7 to 7.0.11

## 12.0.3

### Patch Changes

- Updated dependencies [a020496]
  - @wbce-d9/app@9.34.0

## 12.0.2

### Patch Changes

- 7a257b0: Bump js-yaml to 4.1.1
- 7a257b0: Fix OpenID login failure caused by mismatched redirect URI

## 12.0.1

### Patch Changes

- 3e418cf: Add redirect on login or on redirect uri OpenID error
- Updated dependencies [3e418cf]
  - @wbce-d9/app@9.33.8

## 12.0.0

### Major Changes

- a561d87: Migrate to Node.js 22 runtime

### Patch Changes

- Updated dependencies [a561d87]
  - @wbce-d9/storage-driver-cloudinary@10.0.0
  - @wbce-d9/storage-driver-azure@10.0.0
  - @wbce-d9/storage-driver-local@10.0.0
  - @wbce-d9/storage-driver-gcs@10.0.0
  - @wbce-d9/storage-driver-s3@10.0.0
  - @wbce-d9/extensions-sdk@10.0.0
  - @wbce-d9/update-check@10.0.0
  - @wbce-d9/exceptions@10.0.0
  - @wbce-d9/constants@10.0.0
  - @wbce-d9/storage@10.0.0
  - @wbce-d9/schema@10.0.0
  - @wbce-d9/utils@10.0.0
  - @wbce-d9/app@9.33.7

## 11.1.6

### Patch Changes

- b1a0105: fix mailjet and ses compatibility

## 11.1.5

### Patch Changes

- bdcd952: Security update change, manual and dependabot updates
- Updated dependencies [bdcd952]
  - @wbce-d9/app@9.33.6
  - @wbce-d9/extensions-sdk@9.27.4
  - @wbce-d9/storage-driver-azure@9.26.10
  - @wbce-d9/storage-driver-cloudinary@9.27.3
  - @wbce-d9/storage-driver-gcs@9.26.10
  - @wbce-d9/storage-driver-local@9.26.10
  - @wbce-d9/storage-driver-s3@9.26.12
  - @wbce-d9/update-check@9.28.1
  - @wbce-d9/utils@9.29.3

## 11.1.4

### Patch Changes

- 0cc629f: Bump dependencies
- Updated dependencies [0cc629f]
  - @wbce-d9/app@9.33.5

## 11.1.3

### Patch Changes

- 49466be: Display directus version instead of api version
- Updated dependencies [49466be]
  - @wbce-d9/app@9.33.4

## 11.1.2

### Patch Changes

- 3e74c9e: Add transversal session_id for activity audit
- Updated dependencies [3e74c9e]
  - @wbce-d9/app@9.33.3
  - @wbce-d9/exceptions@9.26.4
  - @wbce-d9/extensions-sdk@9.27.3
  - @wbce-d9/utils@9.29.2

## 11.1.1

### Patch Changes

- 0d32bf9: Fix Token Expired Exception

## 11.1.0

### Minor Changes

- da7e17f: Limit access token to GET assets in cookies

## 11.0.8

### Patch Changes

- 6085327: Bump form-data from 4.0.0 to 4.0.4

## 11.0.7

### Patch Changes

- d4be10c: Fix SSRF Loopback IP filter bypass

## 11.0.6

### Patch Changes

- Updated dependencies [f907b36]
  - @wbce-d9/utils@9.29.2
  - @wbce-d9/app@9.33.2
  - @wbce-d9/extensions-sdk@9.27.2
  - @wbce-d9/storage-driver-azure@9.26.9
  - @wbce-d9/storage-driver-cloudinary@9.27.2
  - @wbce-d9/storage-driver-gcs@9.26.9
  - @wbce-d9/storage-driver-local@9.26.9
  - @wbce-d9/storage-driver-s3@9.26.11

## 11.0.5

### Patch Changes

- 645ef51: Bump dependencies to fix security alerts
- Updated dependencies [645ef51]
  - @wbce-d9/specs@9.26.5
  - @wbce-d9/storage-driver-cloudinary@9.27.1

## 11.0.4

### Patch Changes

- 3786de8: fix url to be bypassed by catch

## 11.0.3

### Patch Changes

- c71b9d5: Bump samlify from 2.8.10 to 2.10.0

## 11.0.2

### Patch Changes

- 4b4b098: Fix: Run Script Operation Not Executing in Directus Flows

## 11.0.1

### Patch Changes

- da7afa2: Bump xml-crypto

## 11.0.0

### Major Changes

- 03314e1: Switched from 'vm2 'to 'isolated-vm' to sandbox the "Run Script" functionality in Flows

  ## Breaking change

  ### Removed Support for Custom NPM Modules in the "Run Script" Operation in Flows

  Previously, Directus used vm2 to execute code in Run Script operations within Flows. However, vm2 is now unmaintained
  and has critical security vulnerabilities that could allow sandbox escapes, potentially compromising the host machine.
  To ensure a secure execution environment, we have migrated to isolated-vm.

  If your script requires a third-party library, you will need to create a custom operation extension.

### Patch Changes

- Updated dependencies [03314e1]
  - @wbce-d9/app@9.33.0

## 10.6.0

### Minor Changes

- 40644e2: npm security updates

### Patch Changes

- Updated dependencies [40644e2]
  - @wbce-d9/update-check@9.28.0
  - @wbce-d9/app@9.32.0
  - @wbce-d9/extensions-sdk@9.27.1
  - @wbce-d9/exceptions@9.26.4
  - @wbce-d9/utils@9.29.1

## 10.5.0

### Minor Changes

- af89302: npm security updates

### Patch Changes

- Updated dependencies [af89302]
  - @wbce-d9/storage-driver-cloudinary@9.27.0
  - @wbce-d9/extensions-sdk@9.27.0
  - @wbce-d9/update-check@9.27.0
  - @wbce-d9/constants@9.28.0
  - @wbce-d9/app@9.31.0
  - @wbce-d9/utils@9.29.1
  - @wbce-d9/storage-driver-azure@9.26.8
  - @wbce-d9/storage-driver-gcs@9.26.8
  - @wbce-d9/storage-driver-local@9.26.8
  - @wbce-d9/storage-driver-s3@9.26.10

## 10.4.0

### Minor Changes

- 91ab5d6: fix security vulnerabilies and authentification issues

### Patch Changes

- Updated dependencies [91ab5d6]
  - @wbce-d9/app@9.30.0
  - @wbce-d9/constants@9.27.0
  - @wbce-d9/utils@9.29.0
  - @wbce-d9/extensions-sdk@9.26.7
  - @wbce-d9/exceptions@9.26.4
  - @wbce-d9/storage-driver-azure@9.26.7
  - @wbce-d9/storage-driver-cloudinary@9.26.7
  - @wbce-d9/storage-driver-gcs@9.26.7
  - @wbce-d9/storage-driver-local@9.26.7
  - @wbce-d9/storage-driver-s3@9.26.9

## 10.3.1

### Patch Changes

- b59e970: npm security updates
- Updated dependencies [b59e970]
  - @wbce-d9/app@9.29.1
  - @wbce-d9/constants@9.26.4
  - @wbce-d9/exceptions@9.26.4
  - @wbce-d9/extensions-sdk@9.26.6
  - @wbce-d9/schema@9.26.4
  - @wbce-d9/specs@9.26.4
  - @wbce-d9/storage@9.26.4
  - @wbce-d9/storage-driver-azure@9.26.6
  - @wbce-d9/storage-driver-cloudinary@9.26.6
  - @wbce-d9/storage-driver-gcs@9.26.6
  - @wbce-d9/storage-driver-local@9.26.6
  - @wbce-d9/storage-driver-s3@9.26.8
  - @wbce-d9/update-check@9.26.4
  - @wbce-d9/utils@9.28.1

## 10.3.0

### Minor Changes

- fcf6cf4: Empty realease to update d9 version

## 10.2.0

### Minor Changes

- bce4637: Make patitionned optional

## 10.1.0

### Minor Changes

- 4d186ff: This pull request introduces the "Partitioned" tag for the sessions cookie to prevent it from being treated
  as a third-party cookie by browsers. Additionally, it adds an environment variable REFRESH_TOKEN_COOKIE_PARTITIONED
  which can be set to false to deactivate this feature.

## 10.0.0

### Major Changes

- 65185c3: Refactored and fixed Oauth and OpendId flows

### Minor Changes

- 65185c3: Revoke tokens on sessions logout for OpenId SSO

## 9.29.0

### Minor Changes

- 41a3210: Revoke tokens on sessions logout for OpenId SSO

## 9.28.0

### Minor Changes

- 7255037: Fix openid connector for keycloack
- 6d7f40e: fix cache compression

### Patch Changes

- Updated dependencies [9d909a7]
  - @wbce-d9/app@9.29.0

## 9.27.0

### Minor Changes

- 7c1b7c7: Fix M2M panel visualization for collections

### Patch Changes

- Updated dependencies [7c1b7c7]
  - @wbce-d9/utils@9.28.0
  - @wbce-d9/app@9.28.0
  - @wbce-d9/extensions-sdk@9.26.5
  - @wbce-d9/storage-driver-azure@9.26.5
  - @wbce-d9/storage-driver-cloudinary@9.26.5
  - @wbce-d9/storage-driver-gcs@9.26.5
  - @wbce-d9/storage-driver-local@9.26.5
  - @wbce-d9/storage-driver-s3@9.26.7

## 9.26.7

### Patch Changes

- Updated dependencies
  - @wbce-d9/app@9.27.0

## 9.26.6

### Patch Changes

- 5998365: update aws-sdk
- Updated dependencies [5998365]
  - @wbce-d9/storage-driver-s3@9.26.6

## 9.26.5

### Patch Changes

- b2b739e: update aws-sdk
- Updated dependencies [b2b739e]
  - @wbce-d9/storage-driver-s3@9.26.5

## 9.26.4

### Patch Changes

- Updated dependencies [9740cc5]
  - @wbce-d9/utils@9.27.0
  - @wbce-d9/app@9.26.4
  - @wbce-d9/extensions-sdk@9.26.4
  - @wbce-d9/storage-driver-azure@9.26.4
  - @wbce-d9/storage-driver-cloudinary@9.26.4
  - @wbce-d9/storage-driver-gcs@9.26.4
  - @wbce-d9/storage-driver-local@9.26.4
  - @wbce-d9/storage-driver-s3@9.26.4

## 9.26.3

### Patch Changes

- f1b4684: change package organization
- Updated dependencies [f1b4684]
  - @wbce-d9/storage-driver-cloudinary@9.26.3
  - @wbce-d9/storage-driver-azure@9.26.3
  - @wbce-d9/storage-driver-local@9.26.3
  - @wbce-d9/storage-driver-gcs@9.26.3
  - @wbce-d9/storage-driver-s3@9.26.3
  - @wbce-d9/extensions-sdk@9.26.3
  - @wbce-d9/update-check@9.26.3
  - @wbce-d9/exceptions@9.26.3
  - @wbce-d9/constants@9.26.3
  - @wbce-d9/storage@9.26.3
  - @wbce-d9/schema@9.26.3
  - @wbce-d9/specs@9.26.3
  - @wbce-d9/utils@9.26.3
  - @wbce-d9/app@9.26.3

## 9.26.2

### Patch Changes

- 973f4bb: update packages
- Updated dependencies [973f4bb]
  - @wbce-d9/app@9.26.2
  - @wbce-d9/constants@9.26.2
  - @wbce-d9/exceptions@9.26.2
  - @wbce-d9/extensions-sdk@9.26.2
  - @wbce-d9/schema@9.26.2
  - @wbce-d9/specs@9.26.2
  - @wbce-d9/storage@9.26.2
  - @wbce-d9/storage-driver-azure@9.26.2
  - @wbce-d9/storage-driver-cloudinary@9.26.2
  - @wbce-d9/storage-driver-gcs@9.26.2
  - @wbce-d9/storage-driver-local@9.26.2
  - @wbce-d9/storage-driver-s3@9.26.2
  - @wbce-d9/update-check@9.26.2
  - @wbce-d9/utils@9.26.2

## 9.26.1

### Patch Changes

- 9e4a63a: @directus9
- Updated dependencies [9e4a63a]
  - @wbce-d9/storage-driver-cloudinary@9.26.1
  - @wbce-d9/storage-driver-azure@9.26.1
  - @wbce-d9/storage-driver-local@9.26.1
  - @wbce-d9/storage-driver-gcs@9.26.1
  - @wbce-d9/storage-driver-s3@9.26.1
  - @wbce-d9/extensions-sdk@9.26.1
  - @wbce-d9/update-check@9.26.1
  - @wbce-d9/exceptions@9.26.1
  - @wbce-d9/constants@9.26.1
  - @wbce-d9/storage@9.26.1
  - @wbce-d9/schema@9.26.1
  - @wbce-d9/specs@9.26.1
  - @wbce-d9/utils@9.26.1
  - @wbce-d9/app@9.26.1
