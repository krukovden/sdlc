const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { SDLC_ROOT } = require('./temp-project');

function extractArtifactPaths(workflowType) {
  const workflowFile = path.join(SDLC_ROOT, '.agents', 'workflows', `${workflowType}.md`);
  const content = fs.readFileSync(workflowFile, 'utf8');
  const paths = [];
  const matches = [...content.matchAll(/\|\s*`([^`]+)`\s*\|/g)];
  for (const m of matches) {
    const p = m[1];
    if (p.match(/^\d{2}-/) || p.startsWith('02-design/')) paths.push(p);
  }
  return [...new Set(paths)];
}

function findWorkflowFolder(cwd) {
  const workflowsDir = path.join(cwd, 'docs', 'workflows');
  if (!fs.existsSync(workflowsDir)) return null;
  let found = null;
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (fs.existsSync(path.join(full, 'manifest.json'))) found = full;
        else scan(full);
      }
    }
  };
  scan(workflowsDir);
  return found;
}

function validateManifest(cwd, workflowType) {
  const folder = findWorkflowFolder(cwd);
  assert.ok(folder, 'No workflow folder found');
  const manifestPath = path.join(folder, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json not found');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expectedPhases = workflowType === 'spike'
    ? ['clarify', 'research', 'design']
    : ['clarify', 'research', 'design', 'plan', 'implement'];
  const manifestPhases = Object.keys(manifest.phases || {});
  assert.deepStrictEqual(manifestPhases.sort(), expectedPhases.sort());
  const validStatuses = ['pending', 'in_progress', 'approved', 'failed'];
  for (const [phase, data] of Object.entries(manifest.phases)) {
    assert.ok(validStatuses.includes(data.status), `Invalid status "${data.status}" for "${phase}"`);
  }
  if (manifest.current_phase) {
    assert.ok(expectedPhases.includes(manifest.current_phase), `Invalid current_phase: ${manifest.current_phase}`);
  }
  return manifest;
}

function validateArtifacts(cwd, workflowType) {
  const folder = findWorkflowFolder(cwd);
  assert.ok(folder, 'No workflow folder found');
  const expectedPaths = extractArtifactPaths(workflowType);
  const missing = [];
  for (const relPath of expectedPaths) {
    if (!fs.existsSync(path.join(folder, relPath))) missing.push(relPath);
  }
  assert.strictEqual(missing.length, 0, `Missing artifacts:\n  ${missing.join('\n  ')}`);
}

function validateArtifactContent(filePath) {
  assert.ok(fs.existsSync(filePath), `Artifact not found: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.trim().length > 0, `Artifact is empty: ${filePath}`);
  assert.ok(/^#{1,6}\s+.+/m.test(content), `Artifact has no heading: ${filePath}`);
  assert.ok(!/\bTBD\b/.test(content), `Contains TBD: ${filePath}`);
  assert.ok(!/\bTODO\b/.test(content), `Contains TODO: ${filePath}`);
}

function validatePhaseProgression(cwd) {
  const folder = findWorkflowFolder(cwd);
  assert.ok(folder, 'No workflow folder found');
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  const phases = Object.entries(manifest.phases || {});
  let sawPending = false;
  for (const [name, data] of phases) {
    if (sawPending) {
      assert.ok(data.status === 'pending', `Phase "${name}" is "${data.status}" but a prior phase is still pending`);
    }
    if (data.status === 'pending') sawPending = true;
  }
}

module.exports = { extractArtifactPaths, findWorkflowFolder, validateManifest, validateArtifacts, validateArtifactContent, validatePhaseProgression };
