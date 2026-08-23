/**
 * @file risk-engine.mjs
 * @description Centralized Risk Engine for Mobile Identity Fraud, SIM/eSIM Takeover, and ATO Detection.
 * Implements extensible FraudRiskEngine interface, rule-based correlation, reason codes, and mitigation policies.
 */

import { randomUUID } from 'node:crypto';
import { hashIdentifier } from './crypto.mjs';
import { MockBank } from './banking/mock-bank.mjs';
import { TransactionManager } from './banking/transaction-manager.mjs';

/**
 * Standardized Mobile Identity and Security Event Types.
 * @enum {string}
 */
export const EventType = Object.freeze({
  SIM_CHANGED: 'SIM_CHANGED',
  SIM_REPLACED: 'SIM_REPLACED',
  SIM_ACTIVATED: 'SIM_ACTIVATED',
  SIM_DEACTIVATED: 'SIM_DEACTIVATED',
  ESIM_ADDED: 'ESIM_ADDED',
  ESIM_REMOVED: 'ESIM_REMOVED',
  ESIM_ACTIVATED: 'ESIM_ACTIVATED',
  ESIM_CHANGED: 'ESIM_CHANGED',
  NUMBER_PORTED: 'NUMBER_PORTED',
  CARRIER_CHANGED: 'CARRIER_CHANGED',
  DEVICE_CHANGED: 'DEVICE_CHANGED',
  NEW_DEVICE_LOGIN: 'NEW_DEVICE_LOGIN',
  UNUSUAL_LOGIN: 'UNUSUAL_LOGIN',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PIN_RESET: 'PIN_RESET',
  NEW_BENEFICIARY: 'NEW_BENEFICIARY',
  UNUSUAL_TRANSACTION: 'UNUSUAL_TRANSACTION',
  HIGH_TRANSACTION_VELOCITY: 'HIGH_TRANSACTION_VELOCITY',
  FAILED_AUTH_ATTEMPTS: 'FAILED_AUTH_ATTEMPTS',
  UNUSUAL_LOCATION: 'UNUSUAL_LOCATION',
  IMPOSSIBLE_TRAVEL: 'IMPOSSIBLE_TRAVEL'
});

/**
 * Event source origins.
 * @enum {string}
 */
export const Source = Object.freeze({
  DEVICE: 'DEVICE',
  BACKEND: 'BACKEND',
  CARRIER: 'CARRIER',
  MOCK_CARRIER: 'MOCK_CARRIER',
  AUTH_SERVICE: 'AUTH_SERVICE'
});

/**
 * Standardized Risk Levels.
 * @enum {string}
 */
export const RiskLevel = Object.freeze({
  LOW: 'LOW',           // 0 - 29 (Normal)
  MEDIUM: 'MEDIUM',     // 30 - 49 (Warning only / step-up where available)
  HIGH: 'HIGH',         // 50 - 79 (Step-up auth required / restricted actions)
  CRITICAL: 'CRITICAL'  // 80 - 100 (Transaction held / immediate case review)
});

/**
 * Alert Severities.
 * @enum {string}
 */
export const AlertSeverity = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

/**
 * Recommended automated mitigation actions.
 * @enum {string}
 */
export const MitigationAction = Object.freeze({
  ALLOW: 'ALLOW',
  WARN_USER: 'WARN_USER',
  STEP_UP_AUTH: 'STEP_UP_AUTH',
  HOLD_TRANSACTION: 'HOLD_TRANSACTION',
  BLOCK_ACCESS: 'BLOCK_ACCESS'
});

/**
 * Set of event types that represent physical or digital mobile identity transitions.
 */
export const MOBILE_IDENTITY_EVENTS = Object.freeze(new Set([
  EventType.SIM_CHANGED,
  EventType.SIM_REPLACED,
  EventType.SIM_ACTIVATED,
  EventType.SIM_DEACTIVATED,
  EventType.ESIM_ADDED,
  EventType.ESIM_REMOVED,
  EventType.ESIM_ACTIVATED,
  EventType.ESIM_CHANGED,
  EventType.NUMBER_PORTED,
  EventType.CARRIER_CHANGED
]));

/**
 * Default rule configuration and scoring weights (fully externalizable & configurable).
 */
export const DEFAULT_RULES = Object.freeze({
  correlationWindowMs: 24 * 60 * 60 * 1000, // 24-hour sliding correlation window
  maxScore: 100,
  weights: Object.freeze({
    [EventType.SIM_CHANGED]: 30,
    [EventType.SIM_REPLACED]: 30,
    [EventType.ESIM_CHANGED]: 30,
    [EventType.ESIM_ADDED]: 30,
    [EventType.ESIM_ACTIVATED]: 30,
    [EventType.NUMBER_PORTED]: 25,
    [EventType.CARRIER_CHANGED]: 20,
    [EventType.NEW_DEVICE_LOGIN]: 20,
    [EventType.DEVICE_CHANGED]: 20,
    [EventType.UNUSUAL_LOCATION]: 10,
    [EventType.IMPOSSIBLE_TRAVEL]: 10,
    [EventType.UNUSUAL_LOGIN]: 10,
    [EventType.FAILED_AUTH_ATTEMPTS]: 10,
    [EventType.PASSWORD_RESET]: 15,
    [EventType.PIN_RESET]: 15,
    [EventType.NEW_BENEFICIARY]: 15,
    [EventType.UNUSUAL_TRANSACTION]: 20,
    [EventType.HIGH_TRANSACTION_VELOCITY]: 15
  })
});

/**
 * Standardized Machine-Readable Reason Codes.
 */
export const REASON_CODES = Object.freeze({
  [EventType.SIM_CHANGED]: 'RECENT_SIM_CHANGE',
  [EventType.SIM_REPLACED]: 'RECENT_SIM_CHANGE',
  [EventType.ESIM_CHANGED]: 'RECENT_ESIM_CHANGE',
  [EventType.ESIM_ADDED]: 'RECENT_ESIM_CHANGE',
  [EventType.ESIM_ACTIVATED]: 'RECENT_ESIM_CHANGE',
  [EventType.NUMBER_PORTED]: 'NUMBER_PORTED',
  [EventType.CARRIER_CHANGED]: 'CARRIER_CHANGED',
  [EventType.NEW_DEVICE_LOGIN]: 'NEW_DEVICE',
  [EventType.DEVICE_CHANGED]: 'UNKNOWN_DEVICE',
  [EventType.UNUSUAL_LOCATION]: 'UNUSUAL_LOCATION',
  [EventType.IMPOSSIBLE_TRAVEL]: 'IMPOSSIBLE_TRAVEL',
  [EventType.UNUSUAL_LOGIN]: 'UNUSUAL_LOGIN',
  [EventType.PASSWORD_RESET]: 'PASSWORD_RESET',
  [EventType.PIN_RESET]: 'PIN_RESET',
  [EventType.NEW_BENEFICIARY]: 'NEW_BENEFICIARY',
  [EventType.UNUSUAL_TRANSACTION]: 'ABNORMAL_TRANSACTION',
  [EventType.HIGH_TRANSACTION_VELOCITY]: 'HIGH_TRANSACTION_VELOCITY',
  [EventType.FAILED_AUTH_ATTEMPTS]: 'FAILED_AUTH_ATTEMPTS'
});

export { hashIdentifier };

/**
 * Validates and normalizes an incoming mobile identity event.
 * @param {object} input
 * @returns {object} Immutable validated event object
 */
export function validateEvent(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Event payload must be a non-null object');
  }

  if (!input.userId || String(input.userId).trim() === '') {
    throw new Error('Event missing required field: userId');
  }

  if (!input.eventType || !Object.values(EventType).includes(input.eventType)) {
    throw new Error(`Invalid eventType: ${input.eventType}`);
  }

  if (!input.source || !Object.values(Source).includes(input.source)) {
    throw new Error(`Invalid source: ${input.source}`);
  }

  const timestamp = input.timestamp ? new Date(input.timestamp).toISOString() : new Date().toISOString();
  if (isNaN(Date.parse(timestamp))) {
    throw new Error('Invalid timestamp format');
  }

  return Object.freeze({
    eventId: input.eventId || randomUUID(),
    userId: String(input.userId).trim(),
    eventType: input.eventType,
    source: input.source,
    platform: input.platform || 'ANDROID',
    timestamp,
    carrier: input.carrier || null,
    previousCarrier: input.previousCarrier || null,
    simType: input.simType || null,
    previousSimType: input.previousSimType || null,
    deviceIdHash: input.deviceIdHash || null,
    previousDeviceIdHash: input.previousDeviceIdHash || null,
    ipAddressHash: input.ipAddressHash || null,
    country: input.country || null,
    riskRelevant: input.riskRelevant !== false,
    metadata: typeof input.metadata === 'object' && input.metadata !== null ? { ...input.metadata } : {},
    verified: input.verified === true,
    simulation: input.simulation === true || input.source === Source.MOCK_CARRIER
  });
}

/**
 * Authoritative Transaction Decisions.
 * @enum {string}
 */
export const TransactionDecision = Object.freeze({
  ALLOW: 'ALLOW',
  REQUIRE_VERIFICATION: 'REQUIRE_VERIFICATION',
  HOLD: 'HOLD',
  BLOCK: 'BLOCK'
});

/**
 * Extensible Base FraudRiskEngine Interface.
 * Allows pluggable implementations (RuleBasedRiskEngine, MLRiskEngine, HybridRiskEngine).
 */
export class FraudRiskEngine {
  /**
   * Calculates risk evaluation for a sequence of events.
   * @param {Array<object>} events
   * @param {number} [now]
   * @returns {object}
   */
  calculateRisk(events = [], now = Date.now()) {
    throw new Error('Method calculateRisk() must be implemented by concrete risk engine.');
  }

  /**
   * Calculates risk evaluation specifically in the context of a payment transaction.
   * @param {Array<object>} events
   * @param {object} transaction
   * @param {number} [now]
   * @returns {object}
   */
  evaluateTransactionRisk(events = [], transaction = {}, now = Date.now()) {
    throw new Error('Method evaluateTransactionRisk() must be implemented by concrete risk engine.');
  }
}

/**
 * Authoritative Rule-Based Risk Engine with sliding-window temporal correlation.
 */
export class RuleBasedRiskEngine extends FraudRiskEngine {
  constructor(rules = DEFAULT_RULES) {
    super();
    this.rules = rules;
  }

  /**
   * Evaluates user event history and computes correlated risk score, level, reasons, and mitigation actions.
   * @param {Array<object>} events - User security events.
   * @param {number} [now=Date.now()] - Reference time.
   * @returns {object} Authoritative risk evaluation result.
   */
  calculateRisk(events = [], now = Date.now()) {
    // 1. Filter events within the 24-hour correlation window
    const recent = events.filter((e) => {
      if (!e || e.riskRelevant === false) return false;
      const eventTime = Date.parse(e.timestamp);
      return !isNaN(eventTime) && now - eventTime <= this.rules.correlationWindowMs;
    });

    // Sort chronologically ascending for sequence analysis
    recent.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    const mobileEvents = recent.filter((e) => MOBILE_IDENTITY_EVENTS.has(e.eventType));
    const hasMobileIdentityChange = mobileEvents.length > 0;
    const firstMobileEvent = mobileEvents[0];
    const firstMobileTime = firstMobileEvent ? Date.parse(firstMobileEvent.timestamp) : 0;

    let rawScore = 0;
    const reasons = new Set();
    const relatedEventIds = [];

    for (const event of recent) {
      const weight = this.rules.weights[event.eventType] || 0;
      if (weight > 0) {
        rawScore += weight;
        const code = REASON_CODES[event.eventType];
        if (code) reasons.add(code);
        if (event.eventId) relatedEventIds.push(event.eventId);
      }

      // Temporal Sequence Correlation: Actions occurring shortly AFTER a mobile identity change
      const eventTime = Date.parse(event.timestamp);
      if (hasMobileIdentityChange && eventTime >= firstMobileTime) {
        if ([EventType.PASSWORD_RESET, EventType.PIN_RESET].includes(event.eventType)) {
          reasons.add('PASSWORD_RESET_AFTER_SIM_CHANGE');
        }
        if (event.eventType === EventType.NEW_BENEFICIARY) {
          reasons.add('NEW_BENEFICIARY_AFTER_SIM_CHANGE');
        }
      }
    }

    // Correlated Attack Pattern: Mobile Identity Change + New/Unknown Device
    const hasNewDevice = recent.some((e) =>
      [EventType.NEW_DEVICE_LOGIN, EventType.DEVICE_CHANGED].includes(e.eventType)
    );
    if (hasMobileIdentityChange && hasNewDevice) {
      reasons.add('ACCOUNT_TAKEOVER_PATTERN');
    }

    // Cap the maximum score at maxScore (100)
    const riskScore = Math.min(this.rules.maxScore, rawScore);

    // Calculate Risk Level
    let riskLevel = RiskLevel.LOW;
    if (riskScore >= 80) {
      riskLevel = RiskLevel.CRITICAL;
    } else if (riskScore >= 50) {
      riskLevel = RiskLevel.HIGH;
    } else if (riskScore >= 30) {
      riskLevel = RiskLevel.MEDIUM;
    }

    // Guard: A single mobile identity change without correlated suspicious actions is a warning (MEDIUM), not a lockout.
    if (!hasNewDevice && recent.length === 1 && hasMobileIdentityChange && riskScore <= 30) {
      riskLevel = RiskLevel.MEDIUM;
    }

    // Determine Mitigation Policy
    let recommendedMitigation = MitigationAction.ALLOW;
    if (riskLevel === RiskLevel.CRITICAL) {
      recommendedMitigation = MitigationAction.HOLD_TRANSACTION;
    } else if (riskLevel === RiskLevel.HIGH) {
      recommendedMitigation = MitigationAction.STEP_UP_AUTH;
    } else if (riskLevel === RiskLevel.MEDIUM) {
      recommendedMitigation = MitigationAction.WARN_USER;
    }

    return {
      riskScore,
      riskLevel,
      reasonCodes: Array.from(reasons),
      relatedEventIds,
      recommendedMitigation,
      correlationWindowEndsAt: new Date(now + this.rules.correlationWindowMs).toISOString()
    };
  }

  /**
   * Authoritatively evaluates risk for an in-flight payment transaction proposal.
   * @param {Array<object>} events - User's security events history
   * @param {object} transaction - Proposed transaction details (amount, beneficiary, channel)
   * @param {number} [now=Date.now()] - Reference timestamp
   * @returns {object} Authoritative transaction decision and risk metrics
   */
  evaluateTransactionRisk(events = [], transaction = {}, now = Date.now()) {
    const baseRisk = this.calculateRisk(events, now);
    let rawScore = baseRisk.riskScore;
    const reasons = new Set(baseRisk.reasonCodes);
    const relatedEventIds = [...baseRisk.relatedEventIds];

    const recent = events.filter((e) => {
      if (!e || e.riskRelevant === false) return false;
      const eventTime = Date.parse(e.timestamp);
      return !isNaN(eventTime) && now - eventTime <= this.rules.correlationWindowMs;
    });

    const mobileEvents = recent.filter((e) => MOBILE_IDENTITY_EVENTS.has(e.eventType));
    const hasMobileIdentityChange = mobileEvents.length > 0;
    const hasNewDevice = recent.some((e) =>
      [EventType.NEW_DEVICE_LOGIN, EventType.DEVICE_CHANGED].includes(e.eventType)
    );
    const hasPasswordReset = recent.some((e) =>
      [EventType.PASSWORD_RESET, EventType.PIN_RESET].includes(e.eventType)
    );
    const hasNewBeneficiaryEvent = recent.some((e) => e.eventType === EventType.NEW_BENEFICIARY);

    if (hasMobileIdentityChange && hasNewBeneficiaryEvent) {
      reasons.add('NEW_BENEFICIARY_AFTER_SIM_CHANGE');
    } else if (hasMobileIdentityChange && transaction.isNewBeneficiary) {
      reasons.add('NEW_BENEFICIARY_AFTER_SIM_CHANGE');
      rawScore += 15;
    }

    const amount = Number(transaction.amount) || 0;
    if (amount >= 50000 || (hasMobileIdentityChange && amount >= 20000)) {
      reasons.add('ABNORMAL_TRANSACTION');
      rawScore += 20;
    }

    // High correlation ATO: SIM change + new device + (password reset or new beneficiary)
    if (hasMobileIdentityChange && hasNewDevice && (hasPasswordReset || hasNewBeneficiaryEvent)) {
      reasons.add('ACCOUNT_TAKEOVER_PATTERN');
      if (rawScore < 85) rawScore = 95;
    }

    const riskScore = Math.min(this.rules.maxScore, rawScore);

    let riskLevel = RiskLevel.LOW;
    let decision = TransactionDecision.ALLOW;

    if (riskScore >= 80) {
      riskLevel = RiskLevel.CRITICAL;
      decision = TransactionDecision.BLOCK;
    } else if (riskScore >= 50) {
      riskLevel = RiskLevel.HIGH;
      decision = TransactionDecision.REQUIRE_VERIFICATION;
    } else if (riskScore >= 30) {
      riskLevel = RiskLevel.MEDIUM;
      decision = TransactionDecision.REQUIRE_VERIFICATION;
    } else {
      riskLevel = RiskLevel.LOW;
      decision = TransactionDecision.ALLOW;
    }

    return {
      riskScore,
      riskLevel,
      decision,
      reasonCodes: Array.from(reasons),
      relatedEventIds,
      recommendedMitigation: baseRisk.recommendedMitigation,
      evaluatedAt: new Date(now).toISOString()
    };
  }
}

/**
 * In-Memory Risk Repository implementation.
 */
export class InMemoryRiskRepository {
  constructor(engine = new RuleBasedRiskEngine(), mockBank = new MockBank()) {
    this.engine = engine;
    this.mockBank = mockBank;
    this.transactionManager = new TransactionManager(this, this.mockBank, this.engine);
    this.events = [];
    this.alerts = [];
    this.cases = [];
    this.trustedDevices = new Map(); // key: userId:deviceIdHash
  }

  ingest(rawEvent) {
    const event = validateEvent(rawEvent);
    this.events.push(event);

    // Update trusted device tracking if deviceIdHash present
    if (event.deviceIdHash) {
      const devKey = `${event.userId}:${event.deviceIdHash}`;
      const existing = this.trustedDevices.get(devKey);
      if (!existing) {
        this.trustedDevices.set(devKey, {
          userId: event.userId,
          deviceIdHash: event.deviceIdHash,
          platform: event.platform,
          firstSeenAt: event.timestamp,
          lastSeenAt: event.timestamp,
          trustedAt: null,
          revokedAt: null,
          riskStatus: 'NEW'
        });
      } else {
        existing.lastSeenAt = event.timestamp;
      }
    }

    const userEvents = this.events.filter((e) => e.userId === event.userId);
    const risk = this.engine.calculateRisk(userEvents);
    const alert = this.createAlert(event.userId, risk, event);

    return { event, risk, alert };
  }

  createAlert(userId, risk, event) {
    if (risk.riskLevel === RiskLevel.LOW) {
      return null;
    }

    const severity =
      risk.riskLevel === RiskLevel.CRITICAL
        ? AlertSeverity.CRITICAL
        : risk.riskLevel === RiskLevel.HIGH
        ? AlertSeverity.HIGH
        : AlertSeverity.WARNING;

    const title =
      severity === AlertSeverity.CRITICAL
        ? 'Potential account takeover detected. A suspicious transaction was attempted shortly after a mobile identity change.'
        : severity === AlertSeverity.HIGH
        ? 'Suspicious account activity detected after a recent SIM/eSIM change.'
        : 'Recent SIM/eSIM change detected.';

    const simulation = Boolean(event.simulation);

    const alert = {
      alertId: randomUUID(),
      userId,
      severity,
      riskScore: risk.riskScore,
      alertType: 'MOBILE_IDENTITY_RISK',
      title,
      message: simulation ? `${title} (Simulation)` : title,
      triggeredAt: new Date().toISOString(),
      status: 'OPEN',
      reasons: risk.reasonCodes,
      relatedEventIds: risk.relatedEventIds,
      transactionId: event.metadata?.transactionId || null,
      resolvedAt: null,
      resolvedBy: null,
      simulation
    };

    this.alerts.push(alert);

    if (severity === AlertSeverity.CRITICAL) {
      this.cases.push({
        caseId: randomUUID(),
        userId,
        alertId: alert.alertId,
        title: `ATO Investigation: ${userId}`,
        riskScore: risk.riskScore,
        transactionId: event.metadata?.transactionId || null,
        status: 'OPEN',
        createdAt: alert.triggeredAt,
        simulation
      });
    }

    return alert;
  }

  riskFor(userId) {
    const userEvents = this.events.filter((e) => e.userId === userId);
    return this.engine.calculateRisk(userEvents);
  }

  securityEvents(userId) {
    return this.events
      .filter((e) => e.userId === userId)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }

  allEvents(limit = 50) {
    return this.events
      .slice()
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, limit);
  }

  alertsFor(userId) {
    return this.alerts.filter((a) => a.userId === userId);
  }

  resolveAlert(alertId, action, resolvedBy = 'CUSTOMER') {
    const alert = this.alerts.find((a) => a.alertId === alertId);
    if (!alert) return null;

    alert.status = action === 'report' ? 'REPORTED' : 'ACKNOWLEDGED';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy;
    return alert;
  }

  confirmActivity(userId, verificationMethod = 'BIOMETRIC') {
    // "This was me" confirmation flow
    const openAlerts = this.alerts.filter((a) => a.userId === userId && a.status === 'OPEN');
    openAlerts.forEach((a) => {
      a.status = 'ACKNOWLEDGED';
      a.resolvedAt = new Date().toISOString();
      a.resolvedBy = `CUSTOMER_VERIFIED_${verificationMethod}`;
    });

    return {
      status: 'CONFIRMED',
      userId,
      verificationMethod,
      resolvedAlertsCount: openAlerts.length,
      timestamp: new Date().toISOString()
    };
  }

  allCases() {
    return this.cases
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  resolveCase(caseId, status = 'RESOLVED') {
    const item = this.cases.find((c) => c.caseId === caseId);
    if (!item) return null;

    item.status = status;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  metrics() {
    return {
      totalEvents: this.events.length,
      activeAlerts: this.alerts.filter((a) => a.status === 'OPEN').length,
      criticalCases: this.cases.filter((c) => c.status === 'OPEN').length,
      heldTransactions: this.events.filter((e) => e.metadata?.transactionId).length,
      uniqueUsers: new Set(this.events.map((e) => e.userId)).size,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  // Banking & Account Management
  getAccount(userId) {
    return this.mockBank.getAccount(userId);
  }

  getBeneficiaries(userId) {
    return this.mockBank.getBeneficiaries(userId);
  }

  addBeneficiary(userId, beneficiaryData) {
    return this.mockBank.addBeneficiary(userId, beneficiaryData);
  }

  emergencyLock(userId, reason = 'CUSTOMER_INITIATED_PANIC_LOCK') {
    const lockResult = this.mockBank.emergencyLock(userId, reason);

    const event = validateEvent({
      userId,
      eventType: EventType.FAILED_AUTH_ATTEMPTS,
      source: Source.BACKEND,
      platform: 'ANDROID',
      timestamp: lockResult.lockedAt,
      metadata: {
        action: 'EMERGENCY_LOCKDOWN',
        status: 'PROTECTED',
        reason
      },
      riskRelevant: true,
      simulation: true
    });
    this.events.push(event);

    const caseId = randomUUID();
    this.cases.push({
      caseId,
      userId,
      alertId: randomUUID(),
      title: `Emergency Lockdown Activated: ${userId}`,
      riskScore: 100,
      status: 'PROTECTED',
      createdAt: lockResult.lockedAt,
      simulation: true
    });

    return {
      ...lockResult,
      caseId
    };
  }

  // Transaction Orchestration
  precheckTransaction(params) {
    return this.transactionManager.precheckTransaction(params);
  }

  verifyAndAuthorizeTransaction(transactionId, verificationMethod) {
    return this.transactionManager.verifyAndAuthorizeTransaction(transactionId, verificationMethod);
  }

  executeTransaction(transactionId, userId) {
    return this.transactionManager.executeTransaction(transactionId, userId);
  }

  getTransaction(transactionId) {
    return this.transactionManager.getTransaction(transactionId);
  }

  getTransactionsForUser(userId) {
    return this.transactionManager.getTransactionsForUser(userId);
  }

  resetUser(userId) {
    if (userId) {
      this.events = this.events.filter((e) => e.userId !== userId);
      this.alerts = this.alerts.filter((a) => a.userId !== userId);
      this.cases = this.cases.filter((c) => c.userId !== userId);
      this.mockBank.reset(userId);
      this.transactionManager.reset(userId);
    } else {
      this.events = [];
      this.alerts = [];
      this.cases = [];
      this.trustedDevices.clear();
      this.mockBank.reset();
      this.transactionManager.reset();
    }
  }
}

/**
 * Telecom Carrier Event Adapter Interface.
 * Clean abstraction for connecting live carrier webhook integrations (e.g. GSMA Open Gateway / CAMARA).
 */
export class CarrierEventAdapter {
  normalizeWebhookPayload(rawPayload, headers) {
    throw new Error('Method normalizeWebhookPayload() must be implemented.');
  }
}

/**
 * Mock Telecom Provider for safe local demonstrations.
 */
export class MockCarrierEventProvider extends CarrierEventAdapter {
  emit(userId, eventType = EventType.SIM_CHANGED, metadata = {}) {
    const simType = eventType.startsWith('ESIM') ? 'ESIM' : 'PHYSICAL_SIM';
    return {
      userId,
      eventType,
      source: Source.MOCK_CARRIER,
      platform: 'ANDROID',
      timestamp: new Date().toISOString(),
      simType,
      riskRelevant: true,
      verified: false,
      simulation: true,
      metadata: {
        provider: 'mock-carrier-telecom-adapter',
        label: 'Simulation',
        ...metadata
      }
    };
  }

  normalizeWebhookPayload(rawPayload) {
    return validateEvent({
      ...rawPayload,
      source: Source.CARRIER,
      simulation: false,
      verified: true
    });
  }
}
