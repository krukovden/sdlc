const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { SDLC_ROOT } = require('./temp-project');

// Statuses that mean "phase completed successfully"
// AI may use any of these variants — accept all
const COMPLETED_STATUSES = ['approved', 'done', 'completed', 'complete'];
const VALID_STATUSES = ['pending', 'in_progress', 'approved', 'done', 'completed', 'complete', 'failed'];

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

  // Check phases exist
  assert.ok(manifest.phases, 'manifest.json missing "phases" object');

  const expectedPhases = workflowType === 'spike'
    ? ['clarify', 'research', 'design']
    : ['clarify', 'research', 'design', 'plan', 'implement'];

  const manifestPhases = Object.keys(manifest.phases);
  assert.deepStrictEqual(manifestPhases.sort(), expectedPhases.sort(),
    `Expected phases ${expectedPhases.join(',')} but got ${manifestPhases.join(',')}`);

  // Validate statuses — accept multiple formats (approved, done, completed)
  for (const [phase, data] of Object.entries(manifest.phases)) {
    const status = typeof data === 'string' ? data : data.status;
    assert.ok(VALID_STATUSES.includes(status),
      `Invalid status "${status}" for phase "${phase}"`);
  }

  return manifest;
}

/**
 * Check that all phases are in a completed state.
 */
function validateAllPhasesCompleted(cwd, workflowType) {
  const folder = findWorkflowFolder(cwd);
  assert.ok(folder, 'No workflow folder found');
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));

  for (const [phase, data] of Object.entries(manifest.phases)) {
    const status = typeof data === 'string' ? data : data.status;
    assert.ok(COMPLETED_STATUSES.includes(status),
      `Phase "${phase}" is "${status}", expected one of: ${COMPLETED_STATUSES.join(', ')}`);
  }
}

function validateArtifacts(cwd, workflowType) {
  const folder = findWorkflowFolder(cwd);
  assert.ok(folder, 'No workflow folder found');
  const expectedPaths = extractArtifactPaths(workflowType);

  // List all actual files in the workflow folder (recursive)
  const actualFiles = [];
  const scanFiles = (dir, prefix = '') => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) scanFiles(path.join(dir, entry.name), rel);
      else actualFiles.push(rel);
    }
  };
  scanFiles(folder);

  const missing = [];
  for (const relPath of expectedPaths) {
    const exact = fs.existsSync(path.join(folder, relPath));
    if (exact) continue;

    // Fuzzy match: check if any actual file contains the expected stem
    // e.g., expected "root-cause.md" matches actual "root-cause-analysis.md"
    const stem = path.basename(relPath, '.md');
    const dir = path.dirname(relPath);
    const fuzzy = actualFiles.some(f => {
      const fDir = path.dirname(f);
      const fName = path.basename(f, '.md');
      return fDir === dir && fName.includes(stem);
    });

    if (!fuzzy) missing.push(relPath);
  }
  assert.strictEqual(missing.length, 0, `Missing artifacts:\n  ${missing.join('\n  ')}\nActual files:\n  ${actualFiles.join('\n  ')}`);
}

function validateArtifactContent(filePath) {
  assert.ok(fs.existsSync(filePath), `Artifact not found: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.trim().length > 0, `Artifact is empty: ${filePath}`);
  assert.ok(/^#{1,6}\s+.+/m.test(content), `Artifact has no heading: ${filePath}`);
}

function validatePhaseProgression(cwd) {
  const folder = findWorkflowFolder(cwd);
  assert.ok(folder, 'No workflow folder found');
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  const phases = Object.entries(manifest.phases || {});
  let sawPending = false;
  for (const [name, data] of phases) {
    const status = typeof data === 'string' ? data : data.status;
    if (sawPending) {
      assert.ok(status === 'pending',
        `Phase "${name}" is "${status}" but a prior phase is still pending`);
    }
    if (status === 'pending') sawPending = true;
  }
}

module.exports = {
  extractArtifactPaths,
  findWorkflowFolder,
  validateManifest,
  validateAllPhasesCompleted,
  validateArtifacts,
  validateArtifactContent,
  validatePhaseProgression,
  COMPLETED_STATUSES,
};
