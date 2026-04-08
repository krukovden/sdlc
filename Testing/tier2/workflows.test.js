// Testing/tier2/workflows.test.js
//
// Unified tier2 integration tests. Iterates tools × workflows.
// Each tool that is available runs all workflows from config.js.
// Tools that are not installed are skipped with a warning.
//
// Env vars:
//   SDLC_TEST_TOOL=claude   — run only one tool
//   SDLC_STOP_AT=design     — stop after design phase
//
// Run:
//   node Testing/run.js tier2                    — all available tools
//   node Testing/run.js tier2 claude             — claude only
//   node Testing/run.js tier2 claude --keep      — keep artifacts
//   SDLC_STOP_AT=design node Testing/run.js tier2 claude

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { WORKFLOWS, STOP_AT, getEffectivePhases } = require('./config');
const { getRunners } = require('./runners');
const { create } = require('../helpers/temp-project');
const {
  validateManifest,
  validateAllPhasesCompleted,
  validateArtifacts,
  findWorkflowFolder,
} = require('../helpers/artifact-validator');

const runners = getRunners();

for (const runner of runners) {
  const available = runner.isAvailable();

  describe(`${runner.name} workflows`, { skip: !available }, () => {
    if (!available) return;

    for (const [type, config] of Object.entries(WORKFLOWS)) {
      const effectivePhases = getEffectivePhases(type, STOP_AT);
      const testTimeout = config.timeout + 60000; // node:test timeout > CLI timeout

      describe(`${type} workflow`, { timeout: testTimeout }, () => {
        let proj;

        before(async () => {
          proj = await create({ tier: 2, tool: runner.initPlatform, workflow: type });
        });

        after(() => { if (proj) proj.cleanup(); });

        it(`completes phases: ${effectivePhases.join(' → ')}`, () => {
          const result = runner.run(type, config.description, proj.dir, {
            stopAt: STOP_AT,
            timeout: config.timeout,
          });

          // If CLI exited non-zero, still validate if artifacts were created
          if (result.exitCode !== 0) {
            const folder = findWorkflowFolder(proj.dir);
            assert.ok(folder,
              `${runner.name} CLI failed (exit ${result.exitCode}) and no workflow folder created.\nLog: ${result.logFile}\nStderr: ${result.stderr}`);
          }

          // Validate manifest and phases
          validateManifest(proj.dir, type, { stopAt: STOP_AT });
          validateAllPhasesCompleted(proj.dir, type, { stopAt: STOP_AT });

          // Validate artifacts (only for completed phases)
          validateArtifacts(proj.dir, type);

          // For full workflows with implement phase, check implementation log exists
          if (effectivePhases.includes('implement')) {
            const folder = findWorkflowFolder(proj.dir);
            const logPath = path.join(folder, '04-implementation-log.md');
            assert.ok(fs.existsSync(logPath),
              'Implementation log (04-implementation-log.md) not created');
            const log = fs.readFileSync(logPath, 'utf8');
            assert.ok(log.trim().length > 50,
              `Implementation log too short (${log.trim().length} chars)`);
          }
        });
      });
    }
  });
}
