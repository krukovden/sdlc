// Testing/tier2/claude-workflow.test.js
//
// End-to-end tests that run SDLC workflows through Claude Code CLI
// in headless mode (claude -p "prompt" --no-browser).
//
// Requirements:
//   - Claude Code CLI installed and authenticated
//   - ANTHROPIC_API_KEY set (or claude already logged in)
//
// Run:
//   node Testing/run.js tier2 claude
//   node Testing/run.js tier2 claude --keep   (preserve artifacts)

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create } = require('../helpers/temp-project');
const { runClaude, getManifest } = require('../helpers/cli-runner');
const {
  validateManifest,
  validateArtifacts,
  validateArtifactContent,
  validatePhaseProgression,
  findWorkflowFolder,
} = require('../helpers/artifact-validator');

const tool = process.env.SDLC_TEST_TOOL;
const skip = tool && tool !== 'claude';

describe('claude workflow tests', { skip }, () => {

  // --- Feature workflow ---
  describe('feature workflow', { timeout: 600000 }, () => {
    let proj;

    before(async () => {
      proj = await create({ tier: 2, tool: 'claude' });
    });
    after(() => { if (proj) proj.cleanup(); });

    it('completes all 5 phases and creates all artifacts', () => {
      const result = runClaude(
        '/sdlc feature "add POST /echo endpoint that returns the request body"',
        proj.dir,
        { timeout: 600000 }
      );

      // CLI should exit cleanly
      assert.strictEqual(result.exitCode, 0,
        `Claude CLI failed (exit ${result.exitCode}). Log: ${result.logFile}`);

      // Validate manifest
      const manifest = validateManifest(proj.dir, 'feature');
      validatePhaseProgression(proj.dir);

      // All phases should be approved
      for (const [phase, data] of Object.entries(manifest.phases)) {
        assert.strictEqual(data.status, 'approved',
          `Phase "${phase}" is "${data.status}", expected "approved"`);
      }

      // All artifacts should exist
      validateArtifacts(proj.dir, 'feature');

      // Implementation log should reference all agents
      const folder = findWorkflowFolder(proj.dir);
      const logPath = path.join(folder, '04-implementation-log.md');
      if (fs.existsSync(logPath)) {
        const log = fs.readFileSync(logPath, 'utf8');
        for (const agent of ['Coder', 'Tester', 'Reviewer', 'Security']) {
          assert.ok(log.includes(agent),
            `Implementation log missing "${agent}"`);
        }
      }
    });
  });

  // --- Bugfix workflow ---
  describe('bugfix workflow', { timeout: 600000 }, () => {
    let proj;

    before(async () => {
      proj = await create({ tier: 2, tool: 'claude' });
    });
    after(() => { if (proj) proj.cleanup(); });

    it('completes all 5 phases with bugfix-specific artifacts', () => {
      const result = runClaude(
        '/sdlc bugfix "GET /health returns 500 when no DB connection"',
        proj.dir,
        { timeout: 600000 }
      );

      assert.strictEqual(result.exitCode, 0,
        `Claude CLI failed (exit ${result.exitCode}). Log: ${result.logFile}`);

      const manifest = validateManifest(proj.dir, 'bugfix');

      for (const [phase, data] of Object.entries(manifest.phases)) {
        assert.strictEqual(data.status, 'approved',
          `Phase "${phase}" is "${data.status}", expected "approved"`);
      }

      validateArtifacts(proj.dir, 'bugfix');
    });
  });

  // --- Refactor workflow ---
  describe('refactor workflow', { timeout: 600000 }, () => {
    let proj;

    before(async () => {
      proj = await create({ tier: 2, tool: 'claude' });
    });
    after(() => { if (proj) proj.cleanup(); });

    it('completes all 5 phases with refactor-specific artifacts', () => {
      const result = runClaude(
        '/sdlc refactor "extract health check into service layer"',
        proj.dir,
        { timeout: 600000 }
      );

      assert.strictEqual(result.exitCode, 0,
        `Claude CLI failed (exit ${result.exitCode}). Log: ${result.logFile}`);

      const manifest = validateManifest(proj.dir, 'refactor');

      for (const [phase, data] of Object.entries(manifest.phases)) {
        assert.strictEqual(data.status, 'approved',
          `Phase "${phase}" is "${data.status}", expected "approved"`);
      }

      validateArtifacts(proj.dir, 'refactor');
    });
  });

  // --- Spike workflow ---
  describe('spike workflow', { timeout: 300000 }, () => {
    let proj;

    before(async () => {
      proj = await create({ tier: 2, tool: 'claude' });
    });
    after(() => { if (proj) proj.cleanup(); });

    it('stops at design with only 3 phases', () => {
      const result = runClaude(
        '/sdlc spike "evaluate logging libraries for Node.js"',
        proj.dir,
        { timeout: 300000 }
      );

      assert.strictEqual(result.exitCode, 0,
        `Claude CLI failed (exit ${result.exitCode}). Log: ${result.logFile}`);

      const manifest = validateManifest(proj.dir, 'spike');

      // Spike should only have 3 phases
      assert.ok(!manifest.phases.plan, 'Spike should not have plan phase');
      assert.ok(!manifest.phases.implement, 'Spike should not have implement phase');

      // All 3 phases should be approved
      for (const phase of ['clarify', 'research', 'design']) {
        assert.strictEqual(manifest.phases[phase].status, 'approved',
          `Phase "${phase}" is "${manifest.phases[phase].status}", expected "approved"`);
      }

      validateArtifacts(proj.dir, 'spike');
    });
  });
});
