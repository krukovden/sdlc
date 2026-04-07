const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { create } = require('../helpers/temp-project');
const { spawnCLI, sendInput, waitForPhase, killCLI, getManifest } = require('../helpers/cli-runner');
const { validateManifest, validateArtifacts, validateArtifactContent, validatePhaseProgression, findWorkflowFolder } = require('../helpers/artifact-validator');

const tool = process.env.SDLC_TEST_TOOL;
const skip = tool && tool !== 'codex';

describe('codex workflow tests', { skip }, () => {
  let proj;
  before(async () => { proj = await create({ tier: 2, tool: 'codex' }); });
  after(() => { proj.cleanup(); });

  describe('feature workflow', { timeout: 1800000 }, () => {
    let handle;
    after(async () => { if (handle) await killCLI(handle); });

    it('completes all 5 phases', async () => {
      handle = spawnCLI('codex', '$sdlc feature "add POST /echo endpoint that returns the request body"', proj.dir);
      const phases = ['clarify', 'research', 'design', 'plan', 'implement'];
      for (const phase of phases) {
        await waitForPhase(proj.dir, phase, 300000);
        sendInput(handle, 'approve');
      }
      validateManifest(proj.dir, 'feature');
      validateArtifacts(proj.dir, 'feature');
      validatePhaseProgression(proj.dir);
      const folder = findWorkflowFolder(proj.dir);
      const logPath = require('node:path').join(folder, '04-implementation-log.md');
      if (fs.existsSync(logPath)) {
        const log = fs.readFileSync(logPath, 'utf8');
        assert.ok(log.includes('Coder'), 'Implementation log missing Coder');
        assert.ok(log.includes('Tester'), 'Implementation log missing Tester');
        assert.ok(log.includes('Reviewer'), 'Implementation log missing Reviewer');
        assert.ok(log.includes('Security'), 'Implementation log missing Security');
      }
    });
  });

  describe('bugfix workflow', { timeout: 1800000 }, () => {
    let handle;
    after(async () => { if (handle) await killCLI(handle); });
    it('completes all 5 phases with bugfix artifacts', async () => {
      handle = spawnCLI('codex', '$sdlc bugfix "GET /health returns 500 when no DB connection"', proj.dir);
      const phases = ['clarify', 'research', 'design', 'plan', 'implement'];
      for (const phase of phases) { await waitForPhase(proj.dir, phase, 300000); sendInput(handle, 'approve'); }
      validateManifest(proj.dir, 'bugfix');
      validateArtifacts(proj.dir, 'bugfix');
    });
  });

  describe('refactor workflow', { timeout: 1800000 }, () => {
    let handle;
    after(async () => { if (handle) await killCLI(handle); });
    it('completes all 5 phases with refactor artifacts', async () => {
      handle = spawnCLI('codex', '$sdlc refactor "extract health check into service layer"', proj.dir);
      const phases = ['clarify', 'research', 'design', 'plan', 'implement'];
      for (const phase of phases) { await waitForPhase(proj.dir, phase, 300000); sendInput(handle, 'approve'); }
      validateManifest(proj.dir, 'refactor');
      validateArtifacts(proj.dir, 'refactor');
    });
  });

  describe('spike workflow', { timeout: 900000 }, () => {
    let handle;
    after(async () => { if (handle) await killCLI(handle); });
    it('stops at design with only 3 phases', async () => {
      handle = spawnCLI('codex', '$sdlc spike "evaluate logging libraries for Node.js"', proj.dir);
      const phases = ['clarify', 'research', 'design'];
      for (const phase of phases) { await waitForPhase(proj.dir, phase, 300000); sendInput(handle, 'approve'); }
      const manifest = validateManifest(proj.dir, 'spike');
      assert.ok(!manifest.phases.plan, 'Spike should not have plan phase');
      assert.ok(!manifest.phases.implement, 'Spike should not have implement phase');
      validateArtifacts(proj.dir, 'spike');
    });
  });

  describe('phase gates block', { timeout: 60000 }, () => {
    let handle;
    after(async () => { if (handle) await killCLI(handle); });
    it('does not proceed without approval', async () => {
      handle = spawnCLI('codex', '$sdlc feature "add PUT /echo endpoint"', proj.dir);
      await new Promise(resolve => setTimeout(resolve, 30000));
      const manifest = getManifest(proj.dir);
      if (manifest) {
        assert.ok(manifest.current_phase === 'clarify', `Expected clarify, got: ${manifest.current_phase}`);
        assert.ok(manifest.phases.research?.status === 'pending', 'Research should still be pending');
      }
    });
  });
});
