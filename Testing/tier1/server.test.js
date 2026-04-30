'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');

const { create, SDLC_ROOT } = require('../helpers/temp-project');

const PORT = 7866; // different from production 7865 to avoid conflicts
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function waitForServer(url, timeout = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      httpGet(url).then(resolve).catch(() => {
        if (Date.now() - start > timeout) reject(new Error(`Server did not start at ${url}`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

// ─── /api/state with no workflows ───────────────────────────────────────────

describe('/api/state — no workflows', () => {
  let proc;

  before(async () => {
    const dashPy = path.join(SDLC_ROOT, '.sdlc', 'assets', 'server', 'dashboard.py');
    proc = spawn(pythonCmd, [dashPy, '--port', String(PORT)], {
      cwd: SDLC_ROOT,
      stdio: 'pipe',
    });
    await waitForServer(`http://localhost:${PORT}/health`);
  });

  after(() => { try { proc.kill(); } catch {} });

  it('returns active_workflow: null when no manifests exist', async () => {
    const res = await httpGet(`http://localhost:${PORT}/api/state`);
    assert.strictEqual(res.status, 200);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.active_workflow, null);
    assert.ok(Array.isArray(data.recent_workflows));
  });

  it('/health returns ok:true', async () => {
    const res = await httpGet(`http://localhost:${PORT}/health`);
    assert.strictEqual(JSON.parse(res.body).ok, true);
  });
});

// ─── /api/state with a manifest ─────────────────────────────────────────────

describe('/api/state — with a manifest', () => {
  let proc;
  let proj;

  before(async () => {
    proj = await create({ tool: 'claude' });

    const wfDir = path.join(proj.dir, 'sdlc-doc', 'workflows', 'feature', '2026-04-29-test-wf');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'manifest.json'), JSON.stringify({
      workflow_type: 'feature',
      slug: 'test-wf',
      created: '2026-04-29',
      current_phase: 'implement',
      phases: {
        clarify:   { status: 'approved',    completed_at: '2026-04-29T10:00:00Z' },
        research:  { status: 'approved',    completed_at: '2026-04-29T11:00:00Z' },
        design:    { status: 'approved',    completed_at: '2026-04-29T12:00:00Z' },
        plan:      { status: 'approved',    completed_at: '2026-04-29T13:00:00Z' },
        implement: { status: 'in_progress', completed_at: null },
      },
      tasks: [
        {
          id: 1, title: 'Scaffold project', status: 'active',
          current_agent: 'coder',
          skills: { primary: 'backend-node', supplementary: [] },
          agents: {
            coder:    { status: 'active',  bounces: 0 },
            tester:   { status: 'pending', bounces: 0 },
            reviewer: { status: 'pending', bounces: 0 },
            security: { status: 'pending', bounces: 0 },
            lead:     { status: 'pending', bounces: 0 },
          },
          retry_count: 0, commit: null, failed_agent: null, failure_reason: null,
        },
      ],
    }));

    const dashPy = path.join(SDLC_ROOT, '.sdlc', 'assets', 'server', 'dashboard.py');
    proc = spawn(pythonCmd, [dashPy, '--port', String(PORT + 1)], {
      cwd: proj.dir,
      stdio: 'pipe',
    });
    await waitForServer(`http://localhost:${PORT + 1}/health`);
  });

  after(async () => {
    try { proc.kill(); } catch {}
    await new Promise(r => proc.once('close', r));
    proj.cleanup();
  });

  it('returns the active workflow from manifest', async () => {
    const res = await httpGet(`http://localhost:${PORT + 1}/api/state`);
    const data = JSON.parse(res.body);
    assert.ok(data.active_workflow, 'should have active_workflow');
    assert.strictEqual(data.active_workflow.slug, 'test-wf');
    assert.strictEqual(data.active_workflow.current_phase, 'implement');
  });

  it('active workflow tasks include agents.bounces field', async () => {
    const res = await httpGet(`http://localhost:${PORT + 1}/api/state`);
    const data = JSON.parse(res.body);
    const task = data.active_workflow.tasks[0];
    assert.strictEqual(task.agents.coder.bounces, 0);
    assert.strictEqual(task.agents.coder.status, 'active');
  });

  it('phases reflect approved status', async () => {
    const res = await httpGet(`http://localhost:${PORT + 1}/api/state`);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.active_workflow.phases.clarify.status, 'approved');
    assert.strictEqual(data.active_workflow.phases.implement.status, 'in_progress');
  });
});

// ─── setup.js init writes \.sdlc/config.json ─────────────────────────────────

describe('setup.js init writes \.sdlc/config.json', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'claude' });
  });

  after(() => proj.cleanup());

  it('creates \.sdlc/config.json with package_dir after init', () => {
    const configPath = path.join(proj.dir, '\.sdlc/config.json');
    assert.ok(fs.existsSync(configPath), '\.sdlc/config.json should exist after init');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(typeof config.package_dir === 'string', 'package_dir must be a string');
    assert.ok(config.package_dir.length > 0, 'package_dir must not be empty');
  });
});

// ─── sdlc server url subcommand ──────────────────────────────────────────────

describe('sdlc server url — reads \.sdlc/server.json', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'claude' });
    fs.writeFileSync(
      path.join(proj.dir, '\.sdlc/server.json'),
      JSON.stringify({ pid: 99999, port: 7865, url: 'http://localhost:7865', started: new Date().toISOString() }),
    );
  });

  after(() => proj.cleanup());

  it('sdlc server url prints the URL', () => {
    let output;
    try {
      output = execFileSync(process.execPath, ['bin/sdlc.js', 'server', 'url'], {
        cwd: proj.dir,
        stdio: 'pipe',
        env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
      }).toString().trim();
    } catch (err) {
      output = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
    }
    assert.ok(output.includes('http://localhost:7865'), `Expected URL in output, got: ${output}`);
  });
});

describe('sdlc server url — no \.sdlc/server.json exits with 1', () => {
  let proj;
  let exitCode;
  let output;

  before(async () => {
    proj = await create({ tool: 'claude' });
    try {
      execFileSync(process.execPath, ['bin/sdlc.js', 'server', 'url'], {
        cwd: proj.dir,
        stdio: 'pipe',
        env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
      });
      exitCode = 0;
    } catch (err) {
      exitCode = err.status;
      output = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
    }
  });

  after(() => proj.cleanup());

  it('exits with code 1', () => assert.strictEqual(exitCode, 1));
  it('prints not running message', () => {
    assert.ok(
      output && (output.includes('not running') || output.includes('No server') || output.includes('server')),
      `Expected server-related message in: ${output}`,
    );
  });
});
