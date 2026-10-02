# Security Policy

## Reporting Security Vulnerabilities

**If you believe you have discovered a security issue within a d9 product or service, please open a
[new private security vulnerability report](https://github.com/LaWebcapsule/d9/security/advisories/new). Do not open a
public issue for security problems.**

d9 values the members of the independent security research community who find security vulnerabilities and work
with our team so that proper fixes can be issued to users. Our policy is to credit all researchers in the published
security advisory. In order to receive credit, security researchers must follow responsible disclosure practices, including:

- They do not publish the vulnerability before the agreed disclosure date (90 days after the report by default)
- They do not divulge exact details of the issue, for example through exploits or proof-of-concepts, before that date

## Supported Versions

Only the latest minor release of the latest major version receives security fixes (e.g. 12.0.x). Older lines are end of life. Upgrading within a major version is generally straightforward.

## What to expect

- Acknowledgement within 5 working days.
- Initial assessment within 10 working days (severity, reproduction confirmed, scope).
- Fix timeline depends on severity — critical and high issues are fixed within 30 days; lower-severity within 90 days.
- Coordinated disclosure: we will agree on a public-disclosure date with you. Default embargo is up to 90 days from
  initial report, in line with industry norms ([Google Project Zero](https://googleprojectzero.blogspot.com/p/vulnerability-disclosure-policy.html), [GitHub coordinated disclosure](https://googleprojectzero.blogspot.com/p/vulnerability-disclosure-policy.html)).
- Credit: contributors who report responsibly are credited in the security advisory.

## Upstream Vulnerabilities

d9 is a fork of Directus 9.26.0. As such, advisories published against Directus 9 (`directus` and `@directus/*`
packages) may also affect d9, but vulnerability scanners don't report them for the `@wbce-d9/*` packages.

Our strategy is:

- `directus@9.26.0` is pinned as a development dependency of the root package, reduced to its `@directus/*`
  dependencies. It is never part of the published packages: it only lets Dependabot alert us on upstream advisories.
- Upstream vulnerabilities that apply to d9 are fixed within the timelines above.
- You can follow the status of each upstream advisory:
  - if it is not applicable, it is listed in the
    [`upstream-vulnerabilities`](https://github.com/LaWebcapsule/d9/tree/main/upstream-vulnerabilities) folder, with
    the reason;
  - if it is applicable, it is published as a [d9 security advisory](https://github.com/LaWebcapsule/d9/security/advisories),
    and its fix is listed with its CVE or GHSA id in the release notes;
  - if it is in neither place, we are still reviewing whether it applies.
