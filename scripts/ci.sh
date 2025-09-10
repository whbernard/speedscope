#!/bin/bash

set -euxo pipefail

npm run typecheck
npm run lint
npm run coverage
# Skip schema generation due to TypeScript version incompatibility with @types packages
# node scripts/generate-file-format-schema-json.js > /dev/null