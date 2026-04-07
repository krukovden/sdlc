import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/index';
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
