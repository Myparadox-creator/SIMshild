/**
 * @file integration.test.mjs
 * @description Comprehensive HTTP API integration test suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/server.mjs';
import { InMemoryRiskRepositoryImpl } from '../src/repository/in-memory-repo.mjs';
import { EventType, Source, RiskLevel } from '../src/risk-engine.mjs';

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

test('HTTP API Integration Suite', async (t) => {
  const repo = new InMemoryRiskRepositoryImpl();
  const server = createServer(repo);

  await new Promise((res) => server.listen(0, '127.0.0.1', res));

  t.after(() => {
    server.close();
  });

  await t.test('GET /healthz returns 200 HEALTHY', async () => {
    const res = await request(server, 'GET', '/healthz');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'HEALTHY');
    assert.equal(res.body.service, 'simshield-risk-service');
  });

  await t.test('POST /api/mobile-events ingests event and returns 201', async () => {
    const eventPayload = {
      userId: 'user-integration-1',
      eventType: EventType.SIM_CHANGED,
      source: Source.CARRIER,
      platform: 'ANDROID'
    };

    const res = await request(server, 'POST', '/api/mobile-events', eventPayload);
    assert.equal(res.status, 201);
    assert.equal(res.body.event.userId, 'user-integration-1');
    assert.equal(res.body.risk.riskScore, 30);
    assert.equal(res.body.alert.severity, 'WARNING');
  });

  await t.test('GET /api/users/:userId/risk returns updated risk evaluation', async () => {
    const res = await request(server, 'GET', '/api/users/user-integration-1/risk');
    assert.equal(res.status, 200);
    assert.equal(res.body.riskScore, 30);
    assert.equal(res.body.riskLevel, 'MEDIUM');
    assert.equal(res.body.recommendedMitigation, 'WARN_USER');
  });

  await t.test('GET /api/users/:userId/security-events returns event timeline', async () => {
    const res = await request(server, 'GET', '/api/users/user-integration-1/security-events');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].eventType, EventType.SIM_CHANGED);
  });

  await t.test('POST /api/security/confirm-activity confirms user identity and resolves open alerts', async () => {
    const res = await request(server, 'POST', '/api/security/confirm-activity', {
      userId: 'user-integration-1',
      verificationMethod: 'BIOMETRIC_APP_PIN'
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'CONFIRMED');
    assert.equal(res.body.resolvedAlertsCount, 1);

    const alertsRes = await request(server, 'GET', '/api/users/user-integration-1/fraud-alerts');
    assert.equal(alertsRes.body[0].status, 'ACKNOWLEDGED');
  });

  await t.test('POST /api/fraud-alerts/:alertId/report opens fraud case', async () => {
    // Generate new high alert
    await request(server, 'POST', '/api/mobile-events', {
      userId: 'user-fraud-rep',
      eventType: EventType.ESIM_CHANGED,
      source: Source.CARRIER
    });
    const alertsRes = await request(server, 'GET', '/api/users/user-fraud-rep/fraud-alerts');
    const alertId = alertsRes.body[0].alertId;

    const repRes = await request(server, 'POST', `/api/fraud-alerts/${alertId}/report`);
    assert.equal(repRes.status, 200);
    assert.equal(repRes.body.status, 'REPORTED');
  });

  await t.test('POST /api/simulation/:scenario fails with 403 when demo mode is disabled in production', async () => {
    const res = await request(server, 'POST', '/api/simulation/sim-swap', { userId: 'demo-user' });
    assert.equal(res.status, 403);
    assert.ok(res.body.error.includes('disabled'));
  });
});
