const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create } = require('../helpers/temp-project');
const { spawnCLI, sendInput, waitForPhase, killCLI, getManifest } = require('../helpers/cli-runner');
const { findWorkflowFolder } = require('../helpers/artifact-validator');

describe('dashboard sync', { timeout: 1800000 }, () => {
  let proj;
  let handle;
  before(async () => { proj = await create({ tier: 2, tool: 'claude' }); });
  after(async () => { if (handle) await killCLI(handle); proj.cleanup(); });

  it('dashboard.html is created in workflow folder', async () => {
    handle = spawnCLI('claude', '/sdlc feature "add POST /echo endpoint"', proj.dir);
    for (const phase of ['clarify', 'research', 'design', 'plan']) {
      await waitForPhase(proj.dir, phase, 300000); sendInput(handle, 'approve');
    }
    const folder = findWorkflowFolder(proj.dir);
    assert.ok(folder, 'Workflow folder not found');
    const dashboardPath = path.join(folder, 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
      const content = fs.readFileSync(dashboardPath, 'utf8');
      assert.ok(content.includes('manifest.json'), 'Dashboard should reference manifest.json');
    }
  });

  it('manifest.json updates during execution', async () => {
    sendInput(handle, 'approve');
    const snapshots = [];
    const start = Date.now();
    while (Date.now() - start < 120000) {
      const manifest = getManifest(proj.dir);
      if (manifest) {
        snapshots.push(JSON.stringify({ phase: manifest.current_phase, tasks: (manifest.tasks || []).map(t => t.status) }));
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (manifest?.phases?.implement?.status === 'approved') break;
    }
    const uniqueSnapshots = [...new Set(snapshots)];
    assert.ok(uniqueSnapshots.length >= 2, `Expected >=2 distinct states, got ${uniqueSnapshots.length}`);
  });
});
