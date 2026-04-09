import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/index.ts';
import http from 'node:http';

describe('GET /health', () => {
  let server: http.Server;

  it('returns 200 with status ok', async () => {
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;

    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { status: 'ok' });

    server.close();
  });
});

describe('POST /echo', () => {
  let server: http.Server;
  let port: number;

  it('echoes JSON body', async () => {
    server = app.listen(0);
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 3000;

    const payload = { message: 'hello', nested: { key: 'value' } };
    const res = await fetch(`http://localhost:${port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, payload);

    server.close();
  });

  it('echoes plain text body', async () => {
    server = app.listen(0);
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 3000;

    const res = await fetch(`http://localhost:${port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello world',
    });
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    assert.strictEqual(body, 'hello world');

    server.close();
  });

  it('returns 200 for empty body', async () => {
    server = app.listen(0);
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 3000;

    const res = await fetch(`http://localhost:${port}/echo`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 200);

    server.close();
  });

  it('echoes URL-encoded form body', async () => {
    server = app.listen(0);
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 3000;

    const res = await fetch(`http://localhost:${port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'key=value&name=test',
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { key: 'value', name: 'test' });

    server.close();
  });
});
