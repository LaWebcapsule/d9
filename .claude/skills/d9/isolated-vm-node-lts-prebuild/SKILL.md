---
name: isolated-vm-node-lts-prebuild
description: Use Node.js LTS to avoid silent 30s compilation of isolated-vm from source on non-LTS versions.
tags: [environment, nodejs, platform, performance]
version: 1.0.0
license: MIT
recommended_scope: project
metadata:
  author: anonymous-contributor
  source: session-contribution
  reproducibility: always
  time_saved: 30m
---

# isolated-vm-node-lts-prebuild

## Purpose

`isolated-vm` ships prebuilt native binaries only for Node.js LTS versions. On non-LTS versions (e.g. Node 25), `pnpm install` silently falls back to compiling from C++ source, adding ~30 seconds to the install with no warning. Using a Node LTS version (e.g. 22) avoids this entirely.

## Triggers

- `pnpm install` (or `npm install`) is unusually slow on a project that depends on `isolated-vm`
- The Node.js version in use is not a current LTS (odd major: 19, 21, 23, 25… or newer-than-LTS even major)
- Setting up d9 or any project with `isolated-vm` in its dependency tree

## Behavior

1. **Check the Node version.** Run `node --version`. LTS majors are even numbers up to the current LTS (18, 20, 22, 24). If the major is odd or higher than the latest LTS, prebuilds may not be available.
2. **Switch to a Node LTS version.** Use your version manager to select the latest LTS:
   ```bash
   nvm use 22        # if using nvm
   fnm use 22        # if using fnm
   ```
3. **Re-run the install.** `pnpm install` will use the prebuilt binary and complete in a few seconds instead of ~30s.
4. **If you must stay on a non-LTS version**, the install will still succeed — just slower. No functional breakage, only a performance cost at install time.

## Errors Prevented

- **Silent slow install (~30s)**: On non-LTS Node versions, `isolated-vm` compiles from C++ source without any warning or error. The install succeeds but is much slower than expected. The only symptom is a longer-than-normal install time with native compilation logs scrolling past. Easy to overlook in CI or on fast machines.

## Restrictions

### Hard Boundaries

- Do NOT assume the install failed — it will complete, just slowly. There is no error to fix, only a version to change.
- Do NOT downgrade Node below 18; d9 requires Node 18+.

### Soft Boundaries

- Prefer pinning the Node version in `.nvmrc` or `.node-version` at the repo root to prevent teammates from hitting this silently.
- Check the `isolated-vm` GitHub releases page for the exact list of prebuilt targets if unsure about a specific version.

## Self-Check

- [ ] `node --version` returns an LTS major (18, 20, 22, 24…).
- [ ] `pnpm install` completes in under 10 seconds (no native compilation logs).
- [ ] A `.nvmrc` or `.node-version` file pins an LTS version to prevent recurrence.

## Examples

### Example 1: Non-LTS → slow install

```
$ node --version
v25.0.0

$ pnpm install
# ... 30 seconds of C++ compilation output ...
# gyp info it worked if it ends with ok
# gyp info using node-gyp@...
# ...
Done in 32.4s
```

### Example 2: LTS → fast install

```
$ nvm use 22
Now using node v22.x.x

$ pnpm install
# No compilation output
Done in 4.1s
```

### Example 3: Pin Node version to prevent recurrence

```bash
# At the repo root
echo "22" > .nvmrc
# or
echo "v22.0.0" > .node-version
```

Teammates running `nvm use` or `fnm use` will automatically pick up the correct version.
