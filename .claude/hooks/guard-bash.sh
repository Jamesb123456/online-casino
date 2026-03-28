#!/bin/bash
# PreToolUse hook: block dangerous bash commands before execution
CMD="$CLAUDE_TOOL_INPUT"

if echo "$CMD" | grep -qiE \
  "(rm\s+-rf\s+[/~]|git\s+push\s+--force|git\s+push\s+-f|git\s+reset\s+--hard|curl.*\|\s*bash|wget.*\|\s*bash|chmod\s+777|>/etc/|mkfs|dd\s+if=|format\s+[a-z]:|del\s+/[sfq]|\bsudo\b|\bssh\b|>\s*/dev/)"; then
  echo "BLOCKED: Dangerous command detected"
  exit 2
fi
