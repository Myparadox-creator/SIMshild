/**
 * @file simulation.mjs
 * @description Sandbox / Developer Simulation Route Handler.
 * Guarded strictly by config.demoMode (SIMSHIELD_DEMO=true).
 */

import { config } from '../config.mjs';
import { EventType, MockCarrierEventProvider } from '../risk-engine.mjs';

const mockCarrier = new MockCarrierEventProvider();

/**
 * Executes a simulated attack scenario.
 * @param {object} repo - Risk repository
 * @param {string} userId - User identifier
 * @param {string} scenario - Scenario name
 * @returns {Promise<Array<object>>} Ingested event results
 */
export async function simulateScenario(repo, userId, scenario) {
  if (!config.demoMode) {
    throw new Error('Simulation is disabled in production environments.');
  }

  // Normalize scenario names (support kebab-case and camelCase)
  const normalized = scenario.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  if (normalized === 'reset') {
    await repo.resetUser(userId);
    return [{
      status: 'RESET_COMPLETED',
      userId,
      risk: { riskScore: 0, riskLevel: 'LOW', reasonCodes: [], recommendedMitigation: 'ALLOW' },
      balance: 10000
    }];
  }

  const scenarioMap = {
    simSwap: EventType.SIM_CHANGED,
    esimChange: EventType.ESIM_CHANGED,
    numberPort: EventType.NUMBER_PORTED,
    newDevice: EventType.NEW_DEVICE_LOGIN,
    passwordReset: EventType.PASSWORD_RESET,
    newBeneficiary: EventType.NEW_BENEFICIARY,
    suspiciousTransaction: EventType.UNUSUAL_TRANSACTION,
    largeTransaction: EventType.UNUSUAL_TRANSACTION
  };

  const singleType = scenarioMap[normalized];
  if (singleType) {
    const isCarrier = [EventType.SIM_CHANGED, EventType.ESIM_CHANGED, EventType.NUMBER_PORTED].includes(singleType);
    const event = {
      ...mockCarrier.emit(userId, singleType),
      source: isCarrier ? 'MOCK_CARRIER' : 'AUTH_SERVICE',
      metadata: singleType === EventType.UNUSUAL_TRANSACTION ? { transactionId: 'sim-flagged-txn-1', amount: '₹1,50,000' } : {}
    };
    const singleResult = await repo.ingest(event);
    return [singleResult];
  }

  if (normalized !== 'accountTakeover' && normalized !== 'fullTakeover') {
    throw new Error(`Unknown simulation scenario: ${scenario}`);
  }

  // Full correlated account takeover sequence:
  // SIM_SWAP -> NEW_DEVICE -> PASSWORD_RESET -> NEW_BENEFICIARY
  const order = [
    EventType.SIM_CHANGED,
    EventType.NEW_DEVICE_LOGIN,
    EventType.PASSWORD_RESET,
    EventType.NEW_BENEFICIARY
  ];

  const results = [];
  for (let i = 0; i < order.length; i++) {
    const eventType = order[i];
    const baseEvent = mockCarrier.emit(userId, eventType);
    const event = {
      ...baseEvent,
      source: i === 0 ? 'MOCK_CARRIER' : 'AUTH_SERVICE',
      metadata: { step: i + 1, totalSteps: order.length, label: 'ATO Attack Simulation' }
    };
    results.push(await repo.ingest(event));
  }

  return results;
}

/**
 * Handles POST /api/simulation/:scenario
 */
export async function handleSimulationRoute(req, res, repo, scenario, parsedBody) {
  if (!config.demoMode) {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Simulation endpoints are disabled. Enable via SIMSHIELD_DEMO=true.' }));
    return;
  }

  const userId = parsedBody?.userId || 'demo-user';
  const results = await simulateScenario(repo, userId, scenario);
  const latest = results[results.length - 1];

  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(latest));
}
