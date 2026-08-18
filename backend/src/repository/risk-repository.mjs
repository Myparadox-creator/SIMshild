/**
 * @file risk-repository.mjs
 * @description Abstract Base Repository contract for Risk & Security Event persistence.
 */

export class RiskRepository {
  async ingest(rawEvent) {
    throw new Error('Method ingest() must be implemented');
  }

  async riskFor(userId) {
    throw new Error('Method riskFor() must be implemented');
  }

  async securityEvents(userId) {
    throw new Error('Method securityEvents() must be implemented');
  }

  async allEvents(limit = 50) {
    throw new Error('Method allEvents() must be implemented');
  }

  async alertsFor(userId) {
    throw new Error('Method alertsFor() must be implemented');
  }

  async resolveAlert(alertId, action, resolvedBy = 'CUSTOMER') {
    throw new Error('Method resolveAlert() must be implemented');
  }

  async confirmActivity(userId, verificationMethod = 'BIOMETRIC') {
    throw new Error('Method confirmActivity() must be implemented');
  }

  async allCases() {
    throw new Error('Method allCases() must be implemented');
  }

  async resolveCase(caseId, status) {
    throw new Error('Method resolveCase() must be implemented');
  }

  async metrics() {
    throw new Error('Method metrics() must be implemented');
  }

  async resetUser(userId) {
    throw new Error('Method resetUser() must be implemented');
  }
}
