const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');

test('giới hạn số lần gọi chẩn đoán AI công khai', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}/api/ai/diagnose`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'ngắn' }),
    });
    assert.equal(response.status, 400);
  }

  const blockedResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'ngắn' }),
  });
  const body = await blockedResponse.json();

  assert.equal(blockedResponse.status, 429);
  assert.equal(body.success, false);
});
