/**
 * @file dashboard.test.mjs
 * @description Integration tests for SecOps Dashboard routes, Cases, and Metrics APIs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/server.mjs';
import { InMemoryRiskRepositoryImpl } from '../src/repository/in-memory-repo.mjs';
import { EventType, Source } from '../src/risk-engine.mjs';

function request(server, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        method,
        path,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const data = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode, headers: res.headers, body: data, raw });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

test('SecOps Dashboard & Studio API Suite', async (t) => {
  const repo = new InMemoryRiskRepositoryImpl();
  const server = createServer(repo);

  await new Promise((res) => server.listen(0, '127.0.0.1', res));

  t.after(() => {
    server.close();
  });

  await t.test('GET / serves HTML dashboard', async () => {
    const res = await request(server, 'GET', '/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.raw.includes('SIMShield'));
    assert.ok(res.raw.includes('SecOps Studio'));
  });

  await t.test('GET /styles.css serves CSS stylesheet', async () => {
    const res = await request(server, 'GET', '/styles.css');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/css'));
    assert.ok(res.raw.includes('--bg-app'));
  });

  await t.test('GET /app.js serves JavaScript controller', async () => {
    const res = await request(server, 'GET', '/app.js');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('javascript'));
    assert.ok(res.raw.includes('SimShieldApp'));
  });

  await t.test('GET /api/metrics returns system metrics and telemetry', async () => {
    const res = await request(server, 'GET', '/api/metrics');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.totalEvents, 'number');
    assert.equal(typeof res.body.activeAlerts, 'number');
    assert.equal(typeof res.body.criticalCases, 'number');
    assert.equal(typeof res.body.uptime, 'number');
  });

  await t.test('GET /api/mobile-events returns global recent events list', async () => {
    // Ingest sample event
    await request(server, 'POST', '/api/mobile-events', {
      userId: 'test-subject-99',
      eventType: EventType.SIM_CHANGED,
      source: Source.CARRIER
    });

    const res = await request(server, 'GET', '/api/mobile-events');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((e) => e.userId === 'test-subject-99'));
  });

  await t.test('Case escalation and resolution workflow', async () => {
    // Trigger critical ATO pattern to spawn a case
    const events = [
      EventType.SIM_CHANGED,
      EventType.NEW_DEVICE_LOGIN,
      EventType.PASSWORD_RESET,
      EventType.NEW_BENEFICIARY,
      EventType.UNUSUAL_TRANSACTION
    ];

    for (const evt of events) {
      await request(server, 'POST', '/api/mobile-events', {
        userId: 'ato-victim',
        eventType: evt,
        source: Source.AUTH_SERVICE,
        metadata: { transactionId: 'txn-12345' }
      });
    }

    const casesRes = await request(server, 'GET', '/api/cases');
    assert.equal(casesRes.status, 200);
    assert.ok(Array.isArray(casesRes.body));
    const targetCase = casesRes.body.find((c) => c.userId === 'ato-victim');
    assert.ok(targetCase, 'Critical event must produce a fraud investigation case');
    assert.equal(targetCase.status, 'OPEN');

    // Hold transaction on case
    const holdRes = await request(server, 'POST', `/api/cases/${targetCase.caseId}/hold`);
    assert.equal(holdRes.status, 200);
    assert.equal(holdRes.body.status, 'TRANSACTION_HELD');

    // Resolve case
    const resolveRes = await request(server, 'POST', `/api/cases/${targetCase.caseId}/resolve`);
    assert.equal(resolveRes.status, 200);
    assert.equal(resolveRes.body.status, 'RESOLVED');
  });

  await t.test('POST /api/reset clears user state cleanly', async () => {
    const resetRes = await request(server, 'POST', '/api/reset', { userId: 'ato-victim' });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.status, 'RESET_COMPLETED');

    const riskRes = await request(server, 'GET', '/api/users/ato-victim/risk');
    assert.equal(riskRes.body.riskScore, 0);
    assert.equal(riskRes.body.riskLevel, 'LOW');
  });
});
