#!/usr/bin/env node
//
// Sync AGENTS.md → .github/copilot-instructions.md
// =================================================
//
// WHO this is for: GitHub Copilot (IDE chat, Coding Agent, code review).
// Copilot has no native @-import mechanism, so .github/copilot-instructions.md
// must be a full real copy of AGENTS.md — not a pointer or symlink.
//
// Why this script exists: keep AGENTS.md as the single source of truth.
// Run after editing AGENTS.md so Copilot never reads stale guidance.
//
// Who this is NOT for:
//   - Claude Code   — reads CLAUDE.md, which uses runtime @AGENTS.md import (no sync needed).
//   - OpenAI Codex  — reads AGENTS.md directly (no sync needed).
//   - Cursor        — reads AGENTS.md directly (no sync needed).
//
// Cross-platform: pure Node fs/path APIs — works on Windows, macOS, Linux.
// Run via: `npm run sync:copilot`
//

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const src = path.join(repoRoot, 'AGENTS.md');
const destDir = path.join(repoRoot, '.github');
const dest = path.join(destDir, 'copilot-instructions.md');

if (!fs.existsSync(src)) {
  console.error(`✗ source not found: ${src}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);

const rel = (p) => path.relative(repoRoot, p).split(path.sep).join('/');
console.log(`✓ synced for GitHub Copilot: ${rel(src)} → ${rel(dest)}`);
