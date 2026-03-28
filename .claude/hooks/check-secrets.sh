#!/bin/bash
# Stop hook: check for hardcoded secrets before session ends
cd "$CLAUDE_PROJECT_DIR" || exit 0

SECRETS=$(grep -rn \
  --include="*.ts" --include="*.js" --include="*.json" \
  -iE "(api[_-]?key|secret|password|token)\s*[:=]\s*[\"'].{8,}" \
  . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude="*.lock" \
  --exclude="*.env*" \
  2>&1 | head -5)

if [ -n "$SECRETS" ]; then
  echo "WARNING: Possible hardcoded secrets found in source files. Review before committing."
  exit 1
fi
