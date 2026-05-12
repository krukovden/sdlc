#!/usr/bin/env node
//
// PostToolUse hook for Claude Code.
// =================================================
//
// Triggers `npm run sync:copilot` when the contributor edits the root AGENTS.md
// (the dev-time instruction file for THIS source repo).
//
// Path filter logic:
//   - file ends with "AGENTS.md"     → candidate
//   - file path does NOT contain ".sdlc/" → exclude the shipped consumer template
//                                           (".sdlc/AGENTS.md" is published to consumers,
//                                            it has different content, no sync needed)
//
// Cross-platform: pure Node — works on Windows, macOS, Linux.
// Never blocks: any unexpected error exits 0 so the user's edit always completes.
//
// Registered in .claude/settings.json as a PostToolUse hook on Edit|Write|MultiEdit.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = input.trim() ? JSON.parse(input) : {};
    const filePath = (payload.tool_input && payload.tool_input.file_path) || '';
    if (!filePath) return;

    const normalized = filePath.split(path.sep).join('/');
    const isRootAgentsMd =
      normalized.endsWith('/AGENTS.md') && !normalized.includes('/.sdlc/');

    if (!isRootAgentsMd) return;

    const repoRoot = path.resolve(__dirname, '..');
    execFileSync('node', [path.join('bin', 'sync-copilot-instructions.js')], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } catch (err) {
    // Never block the user's edit. Surface the error to stderr for visibility.
    console.error(`[post-edit-hook] ${err.message}`);
    process.exit(0);
  }
});
