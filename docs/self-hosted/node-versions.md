---
description: Which Node.js versions d9 supports, and how and when d9 moves to the next one.
readTime: 2 min read
---

# Supported Node.js Versions

> d9 supports a single Node.js LTS version at a time.

d9 is maintained by a small team. Supporting a single Node.js version lets us test every release on the exact version it
runs on, instead of spreading our CI and support across several.

## Policy

- d9 moves to the next Node.js LTS version in a major release, before the current version reaches its end of life and at
  the latest one quarter before it.
- The switch is announced at least two months ahead: in the release notes, in a pinned GitHub issue, and by a warning in
  the API logs at startup.

The Docker image always ships the supported Node.js version. Docker users only need to check that their extensions run
on it.

## Versions

| d9 version | Node.js | Node.js end of life | Switch to the next version |
| ---------- | ------- | ------------------- | -------------------------- |
| 12.x       | 22      | 2027-04-30          | 2027-01-31 (Node.js 24)    |

See the [Node.js release schedule](https://github.com/nodejs/Release#release-schedule) for the end of life dates.

## Startup Warning

Until the switch, the API logs a warning at startup when it runs on a Node.js version that the next major release of d9
won't support.
