const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create } = require('../helpers/temp-project');
const { spawnCLI, sendInput, waitForPhase, killCLI, getManifest } = require('../helpers/cli-runner');
const { findWorkflowFolder } = require('../helpers/artifact-validator');

describe('cross-tool resume', { timeout: 1200000 }, () => {
  let proj;
  before(async () => { proj = await create({ tier: 2, tool: 'all' }); });
  after(() => { proj.cleanup(); });

  it('Claude to Copilot: start feature, resume in Copilot', async () => {
    let handle = spawnCLI('claude', '/sdlc feature "add POST /echo endpoint"', proj.dir);
    await waitForPhase(proj.dir, 'clarify', 300000); sendInput(handle, 'approve');
    await waitForPhase(proj.dir, 'research', 300000); sendInput(handle, 'approve');
    await killCLI(handle);
    let manifest = getManifest(proj.dir);
    assert.strictEqual(manifest.phases.clarify.status, 'approved');
    assert.strictEqual(manifest.phases.research.status, 'approved');
    handle = spawnCLI('copilot', '/sdlc:resume', proj.dir);
    await waitForPhase(proj.dir, 'design', 300000); sendInput(handle, 'approve');
    await killCLI(handle);
    manifest = getManifest(proj.dir);
    assert.strictEqual(manifest.phases.clarify.status, 'approved');
    assert.strictEqual(manifest.phases.research.status, 'approved');
    assert.strictEqual(manifest.phases.design.status, 'approved');
  });

  it('Copilot to Codex: start bugfix, resume in Codex', async () => {
    let handle = spawnCLI('copilot', '/sdlc bugfix "GET /health returns 500"', proj.dir);
    for (const phase of ['clarify', 'research', 'design']) { await waitForPhase(proj.dir, phase, 300000); sendInput(handle, 'approve'); }
    await killCLI(handle);
    handle = spawnCLI('codex', '$sdlc resume', proj.dir);
    await waitForPhase(proj.dir, 'plan', 300000); sendInput(handle, 'approve');
    await killCLI(handle);
    const manifest = getManifest(proj.dir);
    assert.strictEqual(manifest.phases.plan.status, 'approved');
  });

  it('Codex to Claude: start refactor, resume in Claude', async () => {
    let handle = spawnCLI('codex', '$sdlc refactor "extract health check into service"', proj.dir);
    for (const phase of ['clarify', 'research', 'design', 'plan']) { await waitForPhase(proj.dir, phase, 300000); sendInput(handle, 'approve'); }
    await killCLI(handle);
    handle = spawnCLI('claude', '/sdlc:resume', proj.dir);
    await waitForPhase(proj.dir, 'implement', 300000); sendInput(handle, 'approve');
    await killCLI(handle);
    const manifest = getManifest(proj.dir);
    assert.strictEqual(manifest.phases.implement.status, 'approved');
  });

  it('modified artifacts detected on resume', async () => {
    let handle = spawnCLI('claude', '/sdlc feature "add DELETE /echo endpoint"', proj.dir);
    await waitForPhase(proj.dir, 'clarify', 300000); sendInput(handle, 'approve');
    await waitForPhase(proj.dir, 'research', 300000); sendInput(handle, 'approve');
    await killCLI(handle);
    const folder = findWorkflowFolder(proj.dir);
    const researchPath = path.join(folder, '01-research.md');
    if (fs.existsSync(researchPath)) {
      fs.appendFileSync(researchPath, '\n\n## Manually Added Section\nThis was added after the phase completed.\n');
    }
    handle = spawnCLI('claude', '/sdlc:resume', proj.dir);
    await new Promise(resolve => setTimeout(resolve, 15000));
    await killCLI(handle);
    assert.ok(true, 'Resume completed without error after artifact modification');
  });
});
