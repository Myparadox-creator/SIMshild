/**
 * @file postgres-repo.mjs
 * @description Production PostgreSQL persistence implementation of RiskRepository.
 */

import { randomUUID } from 'node:crypto';
import { RiskRepository } from './risk-repository.mjs';
import { RuleBasedRiskEngine, RiskLevel, validateEvent } from '../risk-engine.mjs';
import { logger } from '../logger.mjs';

export class PostgresRiskRepository extends RiskRepository {
  /**
   * @param {object} pool - pg.Pool instance
   * @param {RuleBasedRiskEngine} [engine]
   */
  constructor(pool, engine = new RuleBasedRiskEngine()) {
    super();
    this.pool = pool;
    this.engine = engine;
  }

  async ingest(rawEvent) {
    const event = validateEvent(rawEvent);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Insert mobile identity event
      const insertEventQuery = `
        INSERT INTO mobile_identity_events (
          event_id, user_id, event_type, source, platform, timestamp,
          carrier, previous_carrier, sim_type, device_id_hash,
          ip_address_hash, country, metadata, verified, simulation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `;

      await client.query(insertEventQuery, [
        event.eventId,
        event.userId,
        event.eventType,
        event.source,
        event.platform,
        event.timestamp,
        event.carrier,
        event.previousCarrier,
        event.simType,
        event.deviceIdHash,
        event.ipAddressHash,
        event.country,
        JSON.stringify(event.metadata),
        event.verified,
        event.simulation
      ]);

      // 2. Fetch events in correlation window to calculate risk
      const windowStart = new Date(Date.now() - this.engine.rules.correlationWindowMs).toISOString();
      const eventsQuery = `
        SELECT event_id as "eventId", user_id as "userId", event_type as "eventType",
               source, platform, timestamp, carrier, previous_carrier as "previousCarrier",
               sim_type as "simType", device_id_hash as "deviceIdHash",
               ip_address_hash as "ipAddressHash", country, metadata,
               verified, simulation, true as "riskRelevant"
        FROM mobile_identity_events
        WHERE user_id = $1 AND timestamp >= $2
        ORDER BY timestamp DESC
      `;
      const eventsRes = await client.query(eventsQuery, [event.userId, windowStart]);
      const userEvents = eventsRes.rows;

      const risk = this.engine.calculateRisk(userEvents);

      // 3. Persist calculated risk score
      const insertScoreQuery = `
        INSERT INTO fraud_risk_scores (
          id, user_id, correlation_id, risk_score, risk_level, reason_codes
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await client.query(insertScoreQuery, [
        randomUUID(),
        event.userId,
        event.eventId,
        risk.riskScore,
        risk.riskLevel,
        JSON.stringify(risk.reasonCodes)
      ]);

      // 4. Create and persist alert if not LOW risk
      let alert = null;
      if (risk.riskLevel !== RiskLevel.LOW) {
        const severity = risk.riskLevel === RiskLevel.MEDIUM ? 'WARNING' : risk.riskLevel;
        const title =
          severity === RiskLevel.CRITICAL
            ? 'Potential account takeover detected'
            : severity === RiskLevel.HIGH
            ? 'Suspicious account activity detected'
            : 'Recent SIM/eSIM change detected';

        const simulation = Boolean(event.simulation);
        const alertId = randomUUID();
        const triggeredAt = new Date().toISOString();

        alert = {
          alertId,
          userId: event.userId,
          severity,
          riskScore: risk.riskScore,
          alertType: 'MOBILE_IDENTITY_RISK',
          title,
          message: simulation ? `${title} (Simulation)` : title,
          triggeredAt,
          status: 'OPEN',
          reasons: risk.reasonCodes,
          relatedEventIds: risk.relatedEventIds,
          transactionId: event.metadata?.transactionId || null,
          resolvedAt: null,
          resolvedBy: null,
          simulation
        };

        const insertAlertQuery = `
          INSERT INTO fraud_alerts (
            alert_id, user_id, severity, risk_score, alert_type, title, message,
            status, reason_codes, related_event_ids, simulation, triggered_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        await client.query(insertAlertQuery, [
          alert.alertId,
          alert.userId,
          alert.severity,
          alert.riskScore,
          alert.alertType,
          alert.title,
          alert.message,
          alert.status,
          JSON.stringify(alert.reasons),
          JSON.stringify(alert.relatedEventIds),
          alert.simulation,
          alert.triggeredAt
        ]);

        if (severity === RiskLevel.CRITICAL) {
          const insertCaseQuery = `
            INSERT INTO fraud_cases (case_id, user_id, alert_id, status, created_at, simulation)
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          await client.query(insertCaseQuery, [
            randomUUID(),
            event.userId,
            alert.alertId,
            'OPEN',
            alert.triggeredAt,
            simulation
          ]);
        }
      }

      await client.query('COMMIT');
      return { event, risk, alert };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to ingest event in PostgreSQL repository', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async riskFor(userId) {
    const windowStart = new Date(Date.now() - this.engine.rules.correlationWindowMs).toISOString();
    const query = `
      SELECT event_id as "eventId", user_id as "userId", event_type as "eventType",
             source, platform, timestamp, carrier, previous_carrier as "previousCarrier",
             sim_type as "simType", device_id_hash as "deviceIdHash",
             ip_address_hash as "ipAddressHash", country, metadata,
             verified, simulation, true as "riskRelevant"
      FROM mobile_identity_events
      WHERE user_id = $1 AND timestamp >= $2
      ORDER BY timestamp DESC
    `;
    const res = await this.pool.query(query, [userId, windowStart]);
    return this.engine.calculateRisk(res.rows);
  }

  async securityEvents(userId) {
    const query = `
      SELECT event_id as "eventId", user_id as "userId", event_type as "eventType",
             source, platform, timestamp, carrier, previous_carrier as "previousCarrier",
             sim_type as "simType", device_id_hash as "deviceIdHash",
             ip_address_hash as "ipAddressHash", country, metadata,
             verified, simulation
      FROM mobile_identity_events
      WHERE user_id = $1
      ORDER BY timestamp DESC
    `;
    const res = await this.pool.query(query, [userId]);
    return res.rows;
  }

  async allEvents(limit = 50) {
    const query = `
      SELECT event_id as "eventId", user_id as "userId", event_type as "eventType",
             source, platform, timestamp, carrier, previous_carrier as "previousCarrier",
             sim_type as "simType", device_id_hash as "deviceIdHash",
             ip_address_hash as "ipAddressHash", country, metadata,
             verified, simulation
      FROM mobile_identity_events
      ORDER BY timestamp DESC
      LIMIT $1
    `;
    const res = await this.pool.query(query, [limit]);
    return res.rows;
  }

  async alertsFor(userId) {
    const query = `
      SELECT alert_id as "alertId", user_id as "userId", severity, risk_score as "riskScore",
             alert_type as "alertType", title, message, status,
             reason_codes as "reasons", related_event_ids as "relatedEventIds",
             simulation, triggered_at as "triggeredAt", resolved_at as "resolvedAt",
             resolved_by as "resolvedBy"
      FROM fraud_alerts
      WHERE user_id = $1
      ORDER BY triggered_at DESC
    `;
    const res = await this.pool.query(query, [userId]);
    return res.rows;
  }

  async resolveAlert(alertId, action) {
    const status = action === 'report' ? 'REPORTED' : 'ACKNOWLEDGED';
    const resolvedAt = new Date().toISOString();
    const query = `
      UPDATE fraud_alerts
      SET status = $1, resolved_at = $2
      WHERE alert_id = $3
      RETURNING alert_id as "alertId", user_id as "userId", severity, risk_score as "riskScore",
                alert_type as "alertType", title, message, status,
                reason_codes as "reasons", related_event_ids as "relatedEventIds",
                simulation, triggered_at as "triggeredAt", resolved_at as "resolvedAt"
    `;
    const res = await this.pool.query(query, [status, resolvedAt, alertId]);
    return res.rows[0] || null;
  }

  async confirmActivity(userId, verificationMethod = 'BIOMETRIC') {
    const status = 'ACKNOWLEDGED';
    const resolvedAt = new Date().toISOString();
    const resolvedBy = `CUSTOMER_VERIFIED_${verificationMethod}`;

    const query = `
      UPDATE fraud_alerts
      SET status = $1, resolved_at = $2, resolved_by = $3
      WHERE user_id = $4 AND status = 'OPEN'
      RETURNING alert_id as "alertId"
    `;
    const res = await this.pool.query(query, [status, resolvedAt, resolvedBy, userId]);
    return {
      status: 'CONFIRMED',
      userId,
      verificationMethod,
      resolvedAlertsCount: res.rowCount,
      timestamp: resolvedAt
    };
  }

  async allCases() {
    const query = `
      SELECT c.case_id as "caseId", c.user_id as "userId", c.alert_id as "alertId",
             c.status, c.created_at as "createdAt", c.simulation,
             a.risk_score as "riskScore", a.title
      FROM fraud_cases c
      LEFT JOIN fraud_alerts a ON c.alert_id = a.alert_id
      ORDER BY c.created_at DESC
    `;
    const res = await this.pool.query(query);
    return res.rows;
  }

  async resolveCase(caseId, status = 'RESOLVED') {
    const query = `
      UPDATE fraud_cases
      SET status = $1
      WHERE case_id = $2
      RETURNING case_id as "caseId", user_id as "userId", alert_id as "alertId", status, created_at as "createdAt"
    `;
    const res = await this.pool.query(query, [status, caseId]);
    return res.rows[0] || null;
  }

  async metrics() {
    const eventsCountRes = await this.pool.query('SELECT COUNT(*)::int as count FROM mobile_identity_events');
    const alertsCountRes = await this.pool.query("SELECT COUNT(*)::int as count FROM fraud_alerts WHERE status = 'OPEN'");
    const casesCountRes = await this.pool.query("SELECT COUNT(*)::int as count FROM fraud_cases WHERE status = 'OPEN'");
    const usersCountRes = await this.pool.query('SELECT COUNT(DISTINCT user_id)::int as count FROM mobile_identity_events');

    return {
      totalEvents: eventsCountRes.rows[0].count,
      activeAlerts: alertsCountRes.rows[0].count,
      criticalCases: casesCountRes.rows[0].count,
      heldTransactions: 0,
      uniqueUsers: usersCountRes.rows[0].count,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  async resetUser(userId) {
    if (userId) {
      await this.pool.query('DELETE FROM mobile_identity_events WHERE user_id = $1', [userId]);
      await this.pool.query('DELETE FROM fraud_alerts WHERE user_id = $1', [userId]);
      await this.pool.query('DELETE FROM fraud_cases WHERE user_id = $1', [userId]);
      await this.pool.query('DELETE FROM fraud_risk_scores WHERE user_id = $1', [userId]);
    } else {
      await this.pool.query('TRUNCATE mobile_identity_events, fraud_alerts, fraud_cases, fraud_risk_scores CASCADE');
    }
  }
}
