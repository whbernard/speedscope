# Prefork README

This document consolidates prefork-specific notes, reproduction steps, test info, and admin workflows.

---

## Project Reproduction and Testing Guide (from README-REPRO.md)

This document explains how to reproduce the current state of this fork, including new files, abstractions, versions, local commands, and CI.

### Runtime and Environment

- Node.js: 20.x (CI pins Node 20)
- npm: bundled with Node 20
- OS: macOS or Linux
- Dev server: http://localhost:8000

### Package Versions (key)

- Dev
  - typescript: 3.9.10
  - jest: 24.3.0
  - ts-jest: 24.3.0
  - @types/jest: 22.2.3
  - eslint: 8.0.0
  - prettier: 3.1.1
  - tsx: 4.19.2
  - esbuild: 0.24.2
- Runtime
  - open: 10.1.0

### Feature Changes

#### Send to LLM toolbar button

- File: `src/views/toolbar.tsx`
- Change: Added a new toolbar tab "🤖 Send to LLM" bound to `sendToAPI`.

#### Interval selector (Send-to-LLM dialog)

- File: `src/views/interval-selector.tsx`
- Changes:
  - Removed JSON Preview view and all related state/effects/styles
  - Kept "Export JSON" button
  - Export JSON is generated on demand when confirming/sending

#### Dev server

- Command: `npm run serve`
- Script: `scripts/dev-server.ts`
- URL: http://localhost:8000

### New Files

- GitHub Actions workflow
  - `.github/workflows/tests.yml`
  - Runs lint, typecheck, full tests and a targeted run for the new suites on Node 20.x

- Test suites
  - `src/views/__tests__/export-filtered-json.test.ts`
  - `src/views/__tests__/interval-selector-export.test.ts`
  - `src/views/__tests__/export-import-roundtrip.test.ts`

### New Test Abstractions/Logic

- A helper used inside tests synthesizes boundary events to ensure filtered intervals yield balanced evented profiles (every open `O` has a corresponding close `C`).
  - If a close appears inside the interval without an open: add synthetic `O` at interval start
  - If an open appears inside the interval without a close: add synthetic `C` at interval end
  - Events are sorted by timestamp

- Roundtrip import/export invariants verified:
  - Schema and structure correctness
  - Frame metadata (file/line/col) preserved
  - Balanced events and stable import into a clean speedscope instance
  - Edge windows (exact boundaries, empty intervals) handled

### What the Tests Cover

- `export-filtered-json.test.ts`
  - Exported structure, balanced events, importability, edge cases, and large-profile sanity
- `interval-selector-export.test.ts`
  - Dialog-side export logic under various windows, formatted names, ordering, performance
- `export-import-roundtrip.test.ts`
  - Complex real-world trace simulation, correctness, large-profile performance

### CI Configuration

- Workflow: `.github/workflows/tests.yml`
- Triggers: push/PR to `main`
- Steps:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test -- --coverage`
  - Targeted suite run:
    ```bash
    npm run jest -- --runInBand --verbose --testPathPattern="src/views/__tests__/(export-filtered-json|interval-selector-export|export-import-roundtrip)\.test\.ts"
    ```

### Local Development

```bash
# Install
npm ci

# Start dev server
npm run serve
# open http://localhost:8000

# Full tests via repo CI script (includes typecheck+lint)
npm test

# Only new suites
npm run jest -- --runInBand --verbose --testPathPattern="src/views/__tests__/(export-filtered-json|interval-selector-export|export-import-roundtrip)\.test\.ts"
```

### Behavioral Guarantees

- Filtered JSON exports are schema-conformant, balanced, and import cleanly into another speedscope instance
- Frame metadata and structure are preserved through export/import
- Edge cases (exact boundary, empty window) behave predictably

### High-signal Files Touched

- Added
  - `.github/workflows/tests.yml`
  - `src/views/__tests__/export-filtered-json.test.ts`
  - `src/views/__tests__/interval-selector-export.test.ts`
  - `src/views/__tests__/export-import-roundtrip.test.ts`
- Edited earlier in the effort
  - `src/views/toolbar.tsx` (Send to LLM button)
  - `src/views/interval-selector.tsx` (Remove preview, keep export)
  - `package.json` (versions noted above)

### Success Criteria

- App runs at http://localhost:8000 and the toolbar shows "🤖 Send to LLM"
- `npm test` completes successfully with coverage
- Targeted suites pass: 36 tests passing across the three new files

---

## Admin Processes (from README-ADMINS.md)

This section describes processes needed by admins of this repository.

At time of writing, deployment assumes you're running macOS. It probably works if you're on Linux, and almost definitely does not work on Windows.

### Test the release

Speedscope is tested in CI, so all the automated tests should be passing. We'll just be doing a few sanity checks to make sure the build & deployment machinery is working correctly.

```
scripts/prepare-test-installation.sh
```

This will do a mock publish & installation to ensure that the version we're about to publish is going to work. At the end of this command, it should echo a `cd` command to run in your shell to switch to the installation directory. Something like this:

```
Run the following command to switch into the test directory
cd /var/folders/l0/qtd9z14973s2tw81vmzwkyp00000gp/T/speedscope-test-installation.9Ssdd2PZ/package
```

Run this command, to switch to the test directory.

Inside of here, run `bin/cli.mjs`. This should open a copy of speedscope in browser. Try importing a profile from disk via the browse button and make sure it works.

Next, try running `bin/cli.mjs dist/release/perf-vertx*`. This should immediately open speedscope in browser, and the perf-vertx file should load immediately.

### Create & publish the new release

Ensure you have the Github CLI tools installed and you're authenticated. Try running the following if you're unsure:

```
gh auth status
npm whoami
```

In your default browser, ensure that you're logged into your npm account, otherwise you'll see a 404 page when you open the authenticate link during the npm publish.

Once ready to publish, run:

```
scripts/publish-and-deploy.sh
```

### Verifying the release

To verify that the npm publish was successful, run `npm install -g speedscope`.
Try `speedscope`, which should open speedscope in browser.
Try `speedscope sample/profiles/stackcollapse/simple.txt`, which should immediately load the profile.

To verify the website has finished deploying, check the version number shown in the console of https://www.speedscope.app/
