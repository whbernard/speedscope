# Project Reproduction and Testing Guide

This document explains how to reproduce the current state of this fork, including new files, abstractions, versions, local commands, and CI.

## Runtime and Environment

- Node.js: 20.x (CI pins Node 20)
- npm: bundled with Node 20
- OS: macOS or Linux
- Dev server: http://localhost:8000

## Package Versions (key)

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

## Feature Changes

### Send to LLM toolbar button

- File: `src/views/toolbar.tsx`
- Change: Added a new toolbar tab "🤖 Send to LLM" bound to `sendToAPI`.

### Interval selector (Send-to-LLM dialog)

- File: `src/views/interval-selector.tsx`
- Changes:
  - Removed JSON Preview view and all related state/effects/styles
  - Kept "Export JSON" button
  - Export JSON is generated on demand when confirming/sending

### Dev server

- Command: `npm run serve`
- Script: `scripts/dev-server.ts`
- URL: http://localhost:8000

## New Files

- GitHub Actions workflow
  - `.github/workflows/tests.yml`
  - Runs lint, typecheck, full tests and a targeted run for the new suites on Node 20.x

- Test suites
  - `src/views/__tests__/export-filtered-json.test.ts`
  - `src/views/__tests__/interval-selector-export.test.ts`
  - `src/views/__tests__/export-import-roundtrip.test.ts`

## New Test Abstractions/Logic

- A helper used inside tests synthesizes boundary events to ensure filtered intervals yield balanced evented profiles (every open `O` has a corresponding close `C`).
  - If a close appears inside the interval without an open: add synthetic `O` at interval start
  - If an open appears inside the interval without a close: add synthetic `C` at interval end
  - Events are sorted by timestamp

- Roundtrip import/export invariants verified:
  - Schema and structure correctness
  - Frame metadata (file/line/col) preserved
  - Balanced events and stable import into a clean speedscope instance
  - Edge windows (exact boundaries, empty intervals) handled

## What the Tests Cover

- `export-filtered-json.test.ts`
  - Exported structure, balanced events, importability, edge cases, and large-profile sanity
- `interval-selector-export.test.ts`
  - Dialog-side export logic under various windows, formatted names, ordering, performance
- `export-import-roundtrip.test.ts`
  - Complex real-world trace simulation, correctness, large-profile performance

## CI Configuration

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

## Local Development

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

## Behavioral Guarantees

- Filtered JSON exports are schema-conformant, balanced, and import cleanly into another speedscope instance
- Frame metadata and structure are preserved through export/import
- Edge cases (exact boundary, empty window) behave predictably

## High-signal Files Touched

- Added
  - `.github/workflows/tests.yml`
  - `src/views/__tests__/export-filtered-json.test.ts`
  - `src/views/__tests__/interval-selector-export.test.ts`
  - `src/views/__tests__/export-import-roundtrip.test.ts`
- Edited earlier in the effort
  - `src/views/toolbar.tsx` (Send to LLM button)
  - `src/views/interval-selector.tsx` (Remove preview, keep export)
  - `package.json` (versions noted above)

## Success Criteria

- App runs at http://localhost:8000 and the toolbar shows "🤖 Send to LLM"
- `npm test` completes successfully with coverage
- Targeted suites pass: 36 tests passing across the three new files
