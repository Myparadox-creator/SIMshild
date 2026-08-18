/**
 * @file risk-engine.test.mjs
 * @description Comprehensive unit test suite for FraudRiskEngine, RuleBasedRiskEngine, temporal correlation, and alerts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EventType,
  Source,
  RiskLevel,
  AlertSeverity,
  MitigationAction,
  RuleBasedRiskEngine,
  InMemoryRiskRepository,
  validateEvent
} from '../src/risk-engine.mjs';
import { hashIdentifier, verifyWebhookSignature } from '../src/crypto.mjs';

const createEvent = (type, minutesAgo = 0, overrides = {}) => ({
  userId: 'test-user-123',
  eventType: type,
  source: Source.MOCK_CARRIER,
  timestamp: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  riskRelevant: true,
  simulation: true,
  ...overrides
});

test('Event validation correctly normalizes and validates mobile identity events', () => {
  const valid = validateEvent({
    userId: 'user-abc',
    eventType: EventType.SIM_CHANGED,
    source: Source.CARRIER
  });

  assert.equal(valid.userId, 'user-abc');
  assert.equal(valid.eventType, EventType.SIM_CHANGED);
  assert.equal(valid.source, Source.CARRIER);
  assert.equal(valid.platform, 'ANDROID');
  assert.ok(valid.eventId);
  assert.ok(valid.timestamp);

  // Missing userId throws
  assert.throws(() => validateEvent({ eventType: EventType.SIM_CHANGED, source: Source.CARRIER }));
  // Invalid eventType throws
  assert.throws(() => validateEvent({ userId: 'u1', eventType: 'INVALID_EVENT', source: Source.CARRIER }));
  // Invalid source throws
  assert.throws(() => validateEvent({ userId: 'u1', eventType: EventType.SIM_CHANGED, source: 'UNKNOWN_SOURCE' }));
});

test('Recent SIM change is a warning-level medium risk (30 pts), not an account lockout', () => {
  const repo = new InMemoryRiskRepository();
  const res = repo.ingest(createEvent(EventType.SIM_CHANGED));

  assert.equal(res.risk.riskScore, 30);
  assert.equal(res.risk.riskLevel, RiskLevel.MEDIUM);
  assert.equal(res.risk.recommendedMitigation, MitigationAction.WARN_USER);
  assert.equal(res.alert.severity, AlertSeverity.WARNING);
  assert.ok(res.risk.reasonCodes.includes('RECENT_SIM_CHANGE'));
});

test('Recent eSIM profile change is a warning-level medium risk (30 pts)', () => {
  const repo = new InMemoryRiskRepository();
  const res = repo.ingest(createEvent(EventType.ESIM_CHANGED));

  assert.equal(res.risk.riskScore, 30);
  assert.equal(res.risk.riskLevel, RiskLevel.MEDIUM);
  assert.ok(res.risk.reasonCodes.includes('RECENT_ESIM_CHANGE'));
  assert.equal(res.alert.severity, AlertSeverity.WARNING);
});

test('Number ported event awards 25 risk points with a warning alert', () => {
  const repo = new InMemoryRiskRepository();
  const res = repo.ingest(createEvent(EventType.NUMBER_PORTED));

  assert.equal(res.risk.riskScore, 25);
  assert.equal(res.risk.riskLevel, RiskLevel.MEDIUM);
  assert.ok(res.risk.reasonCodes.includes('NUMBER_PORTED'));
});

test('SIM change followed by new device login triggers ACCOUNT_TAKEOVER_PATTERN (HIGH risk, 50 pts)', () => {
  const repo = new InMemoryRiskRepository();
  repo.ingest(createEvent(EventType.SIM_CHANGED, 10));
  const res = repo.ingest(createEvent(EventType.NEW_DEVICE_LOGIN, 2));

  assert.equal(res.risk.riskScore, 50);
  assert.equal(res.risk.riskLevel, RiskLevel.HIGH);
  assert.equal(res.risk.recommendedMitigation, MitigationAction.STEP_UP_AUTH);
  assert.ok(res.risk.reasonCodes.includes('ACCOUNT_TAKEOVER_PATTERN'));
  assert.ok(res.risk.reasonCodes.includes('RECENT_SIM_CHANGE'));
  assert.ok(res.risk.reasonCodes.includes('NEW_DEVICE'));
});

test('Temporal Sequence: Password reset & beneficiary addition shortly after SIM change', () => {
  const repo = new InMemoryRiskRepository();
  repo.ingest(createEvent(EventType.SIM_CHANGED, 30));
  repo.ingest(createEvent(EventType.PASSWORD_RESET, 20));
  const res = repo.ingest(createEvent(EventType.NEW_BENEFICIARY, 10));

  assert.equal(res.risk.riskScore, 60); // 30 + 15 + 15 = 60
  assert.equal(res.risk.riskLevel, RiskLevel.HIGH);
  assert.ok(res.risk.reasonCodes.includes('PASSWORD_RESET_AFTER_SIM_CHANGE'));
  assert.ok(res.risk.reasonCodes.includes('NEW_BENEFICIARY_AFTER_SIM_CHANGE'));
});

test('Full correlated takeover sequence caps score at 100 and escalates to CRITICAL risk', () => {
  const repo = new InMemoryRiskRepository();
  const attackSequence = [
    EventType.SIM_CHANGED,
    EventType.NEW_DEVICE_LOGIN,
    EventType.PASSWORD_RESET,
    EventType.NEW_BENEFICIARY,
    EventType.UNUSUAL_TRANSACTION
  ];

  attackSequence.forEach((type, idx) => {
    repo.ingest(createEvent(type, (attackSequence.length - idx) * 5, {
      metadata: type === EventType.UNUSUAL_TRANSACTION ? { transactionId: 'held-txn-999', amount: '₹2,00,000' } : {}
    }));
  });

  const risk = repo.riskFor('test-user-123');
  assert.equal(risk.riskScore, 100);
  assert.equal(risk.riskLevel, RiskLevel.CRITICAL);
  assert.equal(risk.recommendedMitigation, MitigationAction.HOLD_TRANSACTION);

  const alerts = repo.alertsFor('test-user-123');
  assert.ok(alerts.some((a) => a.severity === AlertSeverity.CRITICAL));
  assert.ok(repo.cases.some((c) => c.userId === 'test-user-123' && c.status === 'OPEN'));
});

test('Events outside the 24-hour correlation window are ignored', () => {
  const engine = new RuleBasedRiskEngine();
  const oldEvent = createEvent(EventType.SIM_CHANGED, 25 * 60); // 25 hours ago
  const currentEvent = createEvent(EventType.UNUSUAL_LOCATION, 5); // 5 mins ago

  const risk = engine.calculateRisk([oldEvent, currentEvent]);
  assert.equal(risk.riskScore, 10);
  assert.equal(risk.riskLevel, RiskLevel.LOW);
  assert.ok(!risk.reasonCodes.includes('RECENT_SIM_CHANGE'));
});

test('Safe customer confirmation ("This was me" flow) resolves alerts with verified audit trail', () => {
  const repo = new InMemoryRiskRepository();
  repo.ingest(createEvent(EventType.SIM_CHANGED));
  assert.equal(repo.alertsFor('test-user-123').length, 1);
  assert.equal(repo.alertsFor('test-user-123')[0].status, 'OPEN');

  const confirmRes = repo.confirmActivity('test-user-123', 'BIOMETRIC_APP_PIN');
  assert.equal(confirmRes.status, 'CONFIRMED');
  assert.equal(confirmRes.resolvedAlertsCount, 1);
  assert.equal(repo.alertsFor('test-user-123')[0].status, 'ACKNOWLEDGED');
  assert.ok(repo.alertsFor('test-user-123')[0].resolvedBy.includes('BIOMETRIC'));
});

test('Crypto HMAC hashing and timing-safe webhook signature verification', () => {
  const secret = 'test-carrier-secret-key-123';
  const payload = JSON.stringify({ userId: 'u1', eventType: 'SIM_CHANGED' });
  const hash = hashIdentifier('+15551234567', secret);

  assert.ok(hash);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);

  // Verify valid signature
  const validSignature = hashIdentifier(payload, secret);
  assert.equal(verifyWebhookSignature(payload, validSignature, secret), true);

  // Reject tampered payload
  assert.equal(verifyWebhookSignature(payload + 'tampered', validSignature, secret), false);
  assert.equal(verifyWebhookSignature(payload, 'badhash', secret), false);
});
