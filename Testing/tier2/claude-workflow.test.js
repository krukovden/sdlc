// Testing/tier2/claude-workflow.test.js
//
// End-to-end tests: run SDLC workflows through Claude Code CLI in headless mode.
//
// Run:
//   node Testing/run.js tier2 claude
//   node Testing/run.js tier2 claude --keep

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create } = require('../helpers/temp-project');
const { runClaude } = require('../helpers/cli-runner');
const {
  validateManifest,
  validateAllPhasesCompleted,
  validateArtifacts,
  findWorkflowFolder,
} = require('../helpers/artifact-validator');

const tool = process.env.SDLC_TEST_TOOL;
const skip = tool && tool !== 'claude';

// 15 min for full workflows, 10 min for spike
const FULL_TIMEOUT = 900000;
const SPIKE_TIMEOUT = 600000;

describe('claude workflow tests', { skip }, () => {

  describe('feature workflow', { timeout: FULL_TIMEOUT }, () => {
    let proj;
    before(async () => { proj = await create({ tier: 2, tool: 'claude' }); });
    after(() => { if (proj) proj.cleanup(); });

    it('completes all 5 phases and creates all artifacts', () => {
      const result = runClaude(
        '/sdlc feature "add POST /echo endpoint that returns the request body"',
        proj.dir, { timeout: FULL_TIMEOUT }
      );

      // If CLI exited non-zero but artifacts exist, still validate them
      if (result.exitCode !== 0) {
        const folder = findWorkflowFolder(proj.dir);
        assert.ok(folder,
          `Claude CLI failed (exit ${result.exitCode}) and no workflow folder created. Log: ${result.logFile}`);
      }

      validateManifest(proj.dir, 'feature');
      validateAllPhasesCompleted(proj.dir, 'feature');
      validateArtifacts(proj.dir, 'feature');

      const folder = findWorkflowFolder(proj.dir);
      const logPath = path.join(folder, '04-implementation-log.md');
      if (fs.existsSync(logPath)) {
        const log = fs.readFileSync(logPath, 'utf8').toLowerCase();
        for (const agent of ['coder', 'tester', 'reviewer', 'security']) {
          assert.ok(log.includes(agent), `Implementation log missing "${agent}"`);
        }
      }
    });
  });

  describe('bugfix workflow', { timeout: FULL_TIMEOUT }, () => {
    let proj;
    before(async () => { proj = await create({ tier: 2, tool: 'claude' }); });
    after(() => { if (proj) proj.cleanup(); });

    it('completes all 5 phases with bugfix-specific artifacts', () => {
      const result = runClaude(
        '/sdlc bugfix "GET /health returns 500 when no DB connection"',
        proj.dir, { timeout: FULL_TIMEOUT }
      );

      if (result.exitCode !== 0) {
        const folder = findWorkflowFolder(proj.dir);
        assert.ok(folder,
          `Claude CLI failed (exit ${result.exitCode}) and no workflow folder created. Log: ${result.logFile}`);
      }

      validateManifest(proj.dir, 'bugfix');
      validateAllPhasesCompleted(proj.dir, 'bugfix');
      validateArtifacts(proj.dir, 'bugfix');
    });
  });

  describe('refactor workflow', { timeout: FULL_TIMEOUT }, () => {
    let proj;
    before(async () => { proj = await create({ tier: 2, tool: 'claude' }); });
    after(() => { if (proj) proj.cleanup(); });

    it('completes all 5 phases with refactor-specific artifacts', () => {
      const result = runClaude(
        '/sdlc refactor "extract health check into service layer"',
        proj.dir, { timeout: FULL_TIMEOUT }
      );

      if (result.exitCode !== 0) {
        const folder = findWorkflowFolder(proj.dir);
        assert.ok(folder,
          `Claude CLI failed (exit ${result.exitCode}) and no workflow folder created. Log: ${result.logFile}`);
      }

      validateManifest(proj.dir, 'refactor');
      validateAllPhasesCompleted(proj.dir, 'refactor');
      validateArtifacts(proj.dir, 'refactor');
    });
  });

  describe('spike workflow', { timeout: SPIKE_TIMEOUT }, () => {
    let proj;
    before(async () => { proj = await create({ tier: 2, tool: 'claude' }); });
    after(() => { if (proj) proj.cleanup(); });

    it('stops at design with only 3 phases', () => {
      const result = runClaude(
        '/sdlc spike "evaluate logging libraries for Node.js"',
        proj.dir, { timeout: SPIKE_TIMEOUT }
      );

      if (result.exitCode !== 0) {
        const folder = findWorkflowFolder(proj.dir);
        assert.ok(folder,
          `Claude CLI failed (exit ${result.exitCode}) and no workflow folder created. Log: ${result.logFile}`);
      }

      const manifest = validateManifest(proj.dir, 'spike');
      assert.ok(!manifest.phases.plan, 'Spike should not have plan phase');
      assert.ok(!manifest.phases.implement, 'Spike should not have implement phase');
      validateAllPhasesCompleted(proj.dir, 'spike');
      validateArtifacts(proj.dir, 'spike');
    });
  });
});
