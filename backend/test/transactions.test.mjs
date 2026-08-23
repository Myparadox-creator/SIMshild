/**
 * @file transactions.test.mjs
 * @description Comprehensive test suite for Mock UPI payment orchestration, risk pre-check, and fraud prevention.
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

test('Mock UPI & Transaction Anti-Fraud Suite', async (t) => {
  const repo = new InMemoryRiskRepositoryImpl();
  const server = createServer(repo);

  await new Promise((res) => server.listen(0, '127.0.0.1', res));

  t.after(() => {
    server.close();
  });

  await t.test('Scenario 1: Normal transaction with low risk completes and updates balance', async () => {
    // 1. Check initial balance = ₹10,000
    const balRes1 = await request(server, 'GET', '/api/users/demo-user/balance');
    assert.equal(balRes1.status, 200);
    assert.equal(balRes1.body.balance, 10000);

    // 2. Pre-check ₹2,000 payment to known beneficiary Rahul
    const precheckRes = await request(server, 'POST', '/api/transactions/precheck', {
      userId: 'demo-user',
      recipientName: 'Rahul (Personal)',
      upiId: 'rahul@mockbank',
      beneficiaryId: 'B-RAHUL-01',
      amount: 2000,
      currency: 'INR'
    });

    assert.equal(precheckRes.status, 200);
    assert.equal(precheckRes.body.riskLevel, 'LOW');
    assert.equal(precheckRes.body.decision, 'ALLOW');
    assert.ok(precheckRes.body.transactionId);

    // 3. Execute the authorized transaction
    const execRes = await request(server, 'POST', '/api/transactions/execute', {
      transactionId: precheckRes.body.transactionId,
      userId: 'demo-user'
    });

    assert.equal(execRes.status, 200);
    assert.equal(execRes.body.status, 'COMPLETED');
    assert.equal(execRes.body.amount, 2000);
    assert.equal(execRes.body.previousBalance, 10000);
    assert.equal(execRes.body.newBalance, 8000);

    // 4. Verify balance is now ₹8,000
    const balRes2 = await request(server, 'GET', '/api/users/demo-user/balance');
    assert.equal(balRes2.body.balance, 8000);
  });

  await t.test('Scenario 2: SIM swap only raises risk to MEDIUM and requires verification', async () => {
    await request(server, 'POST', '/api/reset', { userId: 'user-sim-swap' });

    // Ingest SIM change event
    await request(server, 'POST', '/api/mobile-events', {
      userId: 'user-sim-swap',
      eventType: EventType.SIM_CHANGED,
      source: Source.CARRIER
    });

    // Attempt ₹1,000 transfer
    const precheck = await request(server, 'POST', '/api/transactions/precheck', {
      userId: 'user-sim-swap',
      recipientName: 'Priya',
      upiId: 'priya@mockbank',
      amount: 1000
    });

    assert.equal(precheck.status, 200);
    assert.equal(precheck.body.riskScore, 30);
    assert.equal(precheck.body.riskLevel, 'MEDIUM');
    assert.equal(precheck.body.decision, 'REQUIRE_VERIFICATION');
    assert.ok(precheck.body.reasonCodes.includes('RECENT_SIM_CHANGE'));
  });

  await t.test('Scenario 3: SIM swap + New device raises risk to HIGH and requires biometric step-up', async () => {
    await request(server, 'POST', '/api/reset', { userId: 'user-sim-device' });

    // Ingest SIM change + New Device
    await request(server, 'POST', '/api/mobile-events', {
      userId: 'user-sim-device',
      eventType: EventType.SIM_CHANGED,
      source: Source.CARRIER
    });
    await request(server, 'POST', '/api/mobile-events', {
      userId: 'user-sim-device',
      eventType: EventType.NEW_DEVICE_LOGIN,
      source: Source.AUTH_SERVICE
    });

    const precheck = await request(server, 'POST', '/api/transactions/precheck', {
      userId: 'user-sim-device',
      recipientName: 'Amit',
      upiId: 'amit@mockbank',
      amount: 1500
    });

    assert.equal(precheck.status, 200);
    assert.equal(precheck.body.riskScore, 50);
    assert.equal(precheck.body.riskLevel, 'HIGH');
    assert.equal(precheck.body.decision, 'REQUIRE_VERIFICATION');
    assert.ok(precheck.body.reasonCodes.includes('ACCOUNT_TAKEOVER_PATTERN'));
  });

  await t.test('Scenario 4: Full ATO sequence results in CRITICAL risk, BLOCK decision, and zero balance change', async () => {
    await request(server, 'POST', '/api/reset', { userId: 'user-ato-victim' });

    // Initial balance check
    const initialBal = await request(server, 'GET', '/api/users/user-ato-victim/balance');
    assert.equal(initialBal.body.balance, 10000);

    // Multi-stage attack chain: SIM_CHANGED -> NEW_DEVICE -> PASSWORD_RESET -> NEW_BENEFICIARY
    const attackEvents = [
      { eventType: EventType.SIM_CHANGED, source: Source.CARRIER },
      { eventType: EventType.NEW_DEVICE_LOGIN, source: Source.AUTH_SERVICE },
      { eventType: EventType.PASSWORD_RESET, source: Source.AUTH_SERVICE },
      { eventType: EventType.NEW_BENEFICIARY, source: Source.AUTH_SERVICE }
    ];

    for (const evt of attackEvents) {
      await request(server, 'POST', '/api/mobile-events', {
        userId: 'user-ato-victim',
        ...evt
      });
    }

    // Attacker attempts ₹2,000 transfer
    const precheck = await request(server, 'POST', '/api/transactions/precheck', {
      userId: 'user-ato-victim',
      recipientName: 'Attacker Mule Account',
      upiId: 'attacker@fraudbank',
      amount: 2000
    });

    assert.equal(precheck.status, 200);
    assert.ok(precheck.body.riskScore >= 80, `Expected riskScore >= 80, got ${precheck.body.riskScore}`);
    assert.equal(precheck.body.riskLevel, 'CRITICAL');
    assert.equal(precheck.body.decision, 'BLOCK');
    assert.equal(precheck.body.status, 'BLOCKED');

    // Attempting to force execute must be rejected
    const execAttempt = await request(server, 'POST', '/api/transactions/execute', {
      transactionId: precheck.body.transactionId,
      userId: 'user-ato-victim'
    });

    assert.equal(execAttempt.status, 403);
    assert.ok(execAttempt.body.error.includes('BLOCKED'));

    // Critical assertion: Balance MUST remain strictly unchanged at ₹10,000
    const finalBal = await request(server, 'GET', '/api/users/user-ato-victim/balance');
    assert.equal(finalBal.body.balance, 10000);
  });

  await t.test('Scenario 5: Old SIM event outside 24h window does not penalize transaction', async () => {
    await request(server, 'POST', '/api/reset', { userId: 'user-old-sim' });

    // Ingest SIM change 26 hours ago
    const oldTimestamp = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    await request(server, 'POST', '/api/mobile-events', {
      userId: 'user-old-sim',
      eventType: EventType.SIM_CHANGED,
      source: Source.CARRIER,
      timestamp: oldTimestamp
    });

    const precheck = await request(server, 'POST', '/api/transactions/precheck', {
      userId: 'user-old-sim',
      recipientName: 'Rahul',
      upiId: 'rahul@mockbank',
      amount: 500
    });

    assert.equal(precheck.status, 200);
    assert.equal(precheck.body.riskScore, 0);
    assert.equal(precheck.body.riskLevel, 'LOW');
    assert.equal(precheck.body.decision, 'ALLOW');
  });

  await t.test('Scenario 6: Emergency Lockdown freezes transfers immediately', async () => {
    await request(server, 'POST', '/api/reset', { userId: 'user-panic-lock' });

    // Customer activates emergency lock
    const lockRes = await request(server, 'POST', '/api/security/emergency-lock', {
      userId: 'user-panic-lock',
      reason: 'CUSTOMER_INITIATED_PANIC_LOCK'
    });

    assert.equal(lockRes.status, 200);
    assert.equal(lockRes.body.status, 'PROTECTED');
    assert.equal(lockRes.body.transfersFrozen, true);

    // Any payment precheck is immediately BLOCKED
    const precheck = await request(server, 'POST', '/api/transactions/precheck', {
      userId: 'user-panic-lock',
      recipientName: 'Rahul',
      upiId: 'rahul@mockbank',
      amount: 500
    });

    assert.equal(precheck.status, 200);
    assert.equal(precheck.body.decision, 'BLOCK');
    assert.equal(precheck.body.status, 'BLOCKED');
    assert.ok(precheck.body.reasonCodes.includes('TRANSFERS_FROZEN'));
  });

  await t.test('Scenario 7: Transaction history audit log accurately records all transactions', async () => {
    const historyRes = await request(server, 'GET', '/api/users/user-ato-victim/transactions');
    assert.equal(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.body));
    assert.ok(historyRes.body.length >= 1);
    assert.equal(historyRes.body[0].decision, 'BLOCK');
    assert.equal(historyRes.body[0].status, 'BLOCKED');
  });
});
