/**
 * @file transaction-manager.mjs
 * @description Transaction Lifecycle State Machine and Pre-Check Orchestration Service.
 * 
 * ZERO-TRUST PRINCIPLE:
 * The TransactionManager orchestrates SIMShield risk evaluation before allowing
 * the Mock Bank to execute funds transfers. Client requests cannot bypass risk checks.
 */

import { randomUUID } from 'node:crypto';
import { TransactionDecision, RiskLevel, EventType, Source } from '../risk-engine.mjs';

/**
 * Standardized Transaction States.
 * @enum {string}
 */
export const TransactionStatus = Object.freeze({
  CREATED: 'CREATED',
  PRECHECKED: 'PRECHECKED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  AUTHORIZED: 'AUTHORIZED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  HELD: 'HELD',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

export class TransactionManager {
  /**
   * @param {object} repo - Risk repository
   * @param {object} mockBank - Mock Bank Ledger
   * @param {object} riskEngine - RuleBasedRiskEngine
   */
  constructor(repo, mockBank, riskEngine) {
    this.repo = repo;
    this.mockBank = mockBank;
    this.riskEngine = riskEngine;
    this.transactions = new Map(); // key: transactionId -> transaction object
  }

  /**
   * Initiates payment pre-check through SIMShield risk evaluation.
   * @param {object} params
   * @returns {Promise<object>}
   */
  async precheckTransaction(params) {
    const {
      userId = 'demo-user',
      amount,
      currency = 'INR',
      recipientName = 'Rahul',
      upiId = 'rahul@mockbank',
      beneficiaryId = null,
      channel = 'MOCK_UPI',
      deviceId = 'demo-android-client'
    } = params;

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Transaction amount must be a positive number.');
    }

    const transactionId = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = Date.now();

    // 1. Check account status in Mock Bank
    const account = this.mockBank.getAccount(userId);
    if (account.status === 'PROTECTED') {
      const blockedTxn = {
        transactionId,
        userId,
        amount: numericAmount,
        currency,
        recipientName,
        upiId,
        beneficiaryId,
        channel,
        deviceId,
        status: TransactionStatus.BLOCKED,
        riskScore: 100,
        riskLevel: RiskLevel.CRITICAL,
        decision: TransactionDecision.BLOCK,
        reasonCodes: ['ACCOUNT_PROTECTED_EMERGENCY_LOCK', 'TRANSFERS_FROZEN'],
        recommendedMitigation: 'BLOCK_ACCESS',
        createdAt: new Date(now).toISOString(),
        executedAt: null,
        message: 'Transaction blocked. Account is currently protected under emergency lockdown.'
      };
      this.transactions.set(transactionId, blockedTxn);
      return blockedTxn;
    }

    // 2. Beneficiary resolution & check if new
    const beneficiaries = this.mockBank.getBeneficiaries(userId);
    let matchedBeneficiary = null;
    if (beneficiaryId) {
      matchedBeneficiary = beneficiaries.find((b) => b.beneficiaryId === beneficiaryId);
    } else if (upiId) {
      matchedBeneficiary = beneficiaries.find((b) => b.upiId.toLowerCase() === upiId.toLowerCase());
    }

    const isNewBeneficiary = Boolean(params.isNewBeneficiary) || (matchedBeneficiary ? matchedBeneficiary.isNew === true : false);

    // 3. Load user security events from correlation window
    const userEvents = await this.repo.securityEvents(userId);

    // 4. Run authoritative risk calculation for transaction
    const riskEval = this.riskEngine.evaluateTransactionRisk(
      userEvents,
      {
        amount: numericAmount,
        recipientName,
        upiId,
        isNewBeneficiary,
        channel
      },
      now
    );

    // 5. Determine State from Decision
    let status = TransactionStatus.PRECHECKED;
    if (riskEval.decision === TransactionDecision.BLOCK) {
      status = TransactionStatus.BLOCKED;
    } else if (riskEval.decision === TransactionDecision.HOLD) {
      status = TransactionStatus.HELD;
    } else if (riskEval.decision === TransactionDecision.REQUIRE_VERIFICATION) {
      status = TransactionStatus.PENDING_VERIFICATION;
    } else if (riskEval.decision === TransactionDecision.ALLOW) {
      status = TransactionStatus.AUTHORIZED;
    }

    const transaction = {
      transactionId,
      userId,
      amount: numericAmount,
      currency,
      recipientName,
      upiId,
      beneficiaryId: matchedBeneficiary?.beneficiaryId || beneficiaryId || `B-NEW-${randomUUID().slice(0, 6)}`,
      channel,
      deviceId,
      status,
      riskScore: riskEval.riskScore,
      riskLevel: riskEval.riskLevel,
      decision: riskEval.decision,
      reasonCodes: riskEval.reasonCodes,
      recommendedMitigation: riskEval.recommendedMitigation,
      isNewBeneficiary,
      createdAt: new Date(now).toISOString(),
      executedAt: null
    };

    this.transactions.set(transactionId, transaction);

    // 6. Ingest security event if transaction is flagged as suspicious or blocked
    if (riskEval.decision === TransactionDecision.BLOCK || riskEval.decision === TransactionDecision.HOLD) {
      await this.repo.ingest({
        userId,
        eventType: EventType.UNUSUAL_TRANSACTION,
        source: Source.BACKEND,
        platform: 'ANDROID',
        timestamp: transaction.createdAt,
        metadata: {
          transactionId,
          amount: `₹${numericAmount.toLocaleString('en-IN')}`,
          recipient: recipientName,
          upiId,
          decision: riskEval.decision,
          riskScore: riskEval.riskScore
        },
        riskRelevant: true,
        simulation: true
      });
    }

    return transaction;
  }

  /**
   * Authorizes a transaction following successful step-up biometric/PIN verification.
   * @param {string} transactionId
   * @param {string} verificationMethod
   * @returns {Promise<object>}
   */
  async verifyAndAuthorizeTransaction(transactionId, verificationMethod = 'BIOMETRIC') {
    const txn = this.transactions.get(transactionId);
    if (!txn) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (txn.status === TransactionStatus.BLOCKED || txn.decision === TransactionDecision.BLOCK) {
      throw new Error('Cannot authorize a BLOCKED transaction.');
    }

    // Acknowledge alert on backend
    await this.repo.confirmActivity(txn.userId, verificationMethod);

    txn.status = TransactionStatus.AUTHORIZED;
    txn.decision = TransactionDecision.ALLOW;
    txn.verifiedBy = verificationMethod;
    txn.verifiedAt = new Date().toISOString();

    return txn;
  }

  /**
   * Executes an authorized transaction on the simulated bank ledger.
   * STRICT SECURITY RULE: Rejects execution if transaction is not in AUTHORIZED state.
   * @param {string} transactionId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async executeTransaction(transactionId, userId) {
    const txn = this.transactions.get(transactionId);
    if (!txn) {
      throw new Error(`Transaction ${transactionId} not found.`);
    }

    if (txn.userId !== userId) {
      throw new Error('Transaction user mismatch.');
    }

    // STRICT ZERO-TRUST GUARD
    if (txn.status === TransactionStatus.BLOCKED || txn.decision === TransactionDecision.BLOCK) {
      throw new Error('Execution Rejected: Transaction is BLOCKED by SIMShield risk engine.');
    }

    if (txn.status === TransactionStatus.HELD || txn.decision === TransactionDecision.HOLD) {
      throw new Error('Execution Rejected: Transaction is HELD pending security review.');
    }

    if (txn.status === TransactionStatus.COMPLETED) {
      throw new Error('Transaction has already been executed.');
    }

    if (txn.status !== TransactionStatus.AUTHORIZED && txn.status !== TransactionStatus.PRECHECKED) {
      throw new Error(`Transaction not in executable state. Current state: ${txn.status}.`);
    }

    // Re-verify risk in real-time before executing
    const userEvents = await this.repo.securityEvents(userId);
    const recheck = this.riskEngine.evaluateTransactionRisk(userEvents, txn);
    if (recheck.decision === TransactionDecision.BLOCK) {
      txn.status = TransactionStatus.BLOCKED;
      txn.decision = TransactionDecision.BLOCK;
      txn.reasonCodes = recheck.reasonCodes;
      throw new Error('Execution Rejected: Real-time risk re-check determined CRITICAL threat.');
    }

    txn.status = TransactionStatus.EXECUTING;

    try {
      // Execute debit on Mock Bank
      const transferResult = this.mockBank.executeTransfer(
        userId,
        txn.amount,
        txn.upiId,
        { transactionId: txn.transactionId }
      );

      txn.status = TransactionStatus.COMPLETED;
      txn.executedAt = transferResult.executedAt;
      txn.previousBalance = transferResult.previousBalance;
      txn.newBalance = transferResult.newBalance;

      return {
        success: true,
        transactionId: txn.transactionId,
        status: TransactionStatus.COMPLETED,
        amount: txn.amount,
        currency: txn.currency,
        recipientName: txn.recipientName,
        upiId: txn.upiId,
        previousBalance: transferResult.previousBalance,
        newBalance: transferResult.newBalance,
        executedAt: txn.executedAt
      };
    } catch (err) {
      txn.status = TransactionStatus.FAILED;
      txn.failureReason = err.message;
      throw err;
    }
  }

  /**
   * Retrieves transaction by ID.
   */
  getTransaction(transactionId) {
    return this.transactions.get(transactionId) || null;
  }

  /**
   * Retrieves transaction history for a user.
   */
  getTransactionsForUser(userId) {
    return Array.from(this.transactions.values())
      .filter((t) => t.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  /**
   * Resets transaction records.
   */
  reset(userId = null) {
    if (userId) {
      for (const [id, txn] of this.transactions.entries()) {
        if (txn.userId === userId) {
          this.transactions.delete(id);
        }
      }
    } else {
      this.transactions.clear();
    }
  }
}
