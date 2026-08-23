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

  async getAccount(userId) {
    throw new Error('Method getAccount() must be implemented');
  }

  async getBeneficiaries(userId) {
    throw new Error('Method getBeneficiaries() must be implemented');
  }

  async addBeneficiary(userId, beneficiaryData) {
    throw new Error('Method addBeneficiary() must be implemented');
  }

  async emergencyLock(userId, reason) {
    throw new Error('Method emergencyLock() must be implemented');
  }

  async precheckTransaction(params) {
    throw new Error('Method precheckTransaction() must be implemented');
  }

  async verifyAndAuthorizeTransaction(transactionId, verificationMethod) {
    throw new Error('Method verifyAndAuthorizeTransaction() must be implemented');
  }

  async executeTransaction(transactionId, userId) {
    throw new Error('Method executeTransaction() must be implemented');
  }

  async getTransaction(transactionId) {
    throw new Error('Method getTransaction() must be implemented');
  }

  async getTransactionsForUser(userId) {
    throw new Error('Method getTransactionsForUser() must be implemented');
  }
}
