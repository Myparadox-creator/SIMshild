/**
 * @file mock-bank.mjs
 * @description Simulated Bank Ledger & Account Management Service.
 * 
 * ZERO-TRUST PRINCIPLE:
 * The Mock Bank is an authoritative ledger. It never modifies balances unless
 * SIMShield's risk engine has issued an explicit ALLOW / AUTHORIZED decision.
 * Blocked or held transactions NEVER modify account balances.
 */

import { randomUUID } from 'node:crypto';

/**
 * Account Status.
 * @enum {string}
 */
export const AccountStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  PROTECTED: 'PROTECTED', // Emergency lockdown activated
  FROZEN: 'FROZEN',
  SUSPENDED: 'SUSPENDED'
});

/**
 * In-Memory Mock Bank Ledger.
 */
export class MockBank {
  constructor() {
    this.accounts = new Map();
    this.beneficiaries = new Map(); // key: userId -> Array of beneficiaries
    this.seedDefaultData();
  }

  /**
   * Seeds default demo accounts and beneficiaries.
   */
  seedDefaultData() {
    // Default demo user account with ₹10,000 INR balance
    this.createOrResetAccount('demo-user', {
      accountNumber: 'AC10219988',
      accountHolder: 'Rahul Sharma',
      balance: 10000,
      currency: 'INR',
      status: AccountStatus.ACTIVE
    });

    // Seed default beneficiaries for demo-user
    this.beneficiaries.set('demo-user', [
      {
        beneficiaryId: 'B-RAHUL-01',
        name: 'Rahul (Personal)',
        upiId: 'rahul@mockbank',
        accountNumber: 'AC99881122',
        isNew: false,
        addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
      },
      {
        beneficiaryId: 'B-PRIYA-02',
        name: 'Priya Patel',
        upiId: 'priya@mockbank',
        accountNumber: 'AC55443322',
        isNew: false,
        addedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
      },
      {
        beneficiaryId: 'B-AMIT-03',
        name: 'Amit Kumar',
        upiId: 'amit@mockbank',
        accountNumber: 'AC77665544',
        isNew: false,
        addedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
      }
    ]);
  }

  /**
   * Creates or resets an account.
   */
  createOrResetAccount(userId, data = {}) {
    const account = {
      userId,
      accountNumber: data.accountNumber || `AC${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountHolder: data.accountHolder || userId,
      balance: typeof data.balance === 'number' ? data.balance : 10000,
      currency: data.currency || 'INR',
      status: data.status || AccountStatus.ACTIVE,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.accounts.set(userId, account);
    return account;
  }

  /**
   * Retrieves account details.
   */
  getAccount(userId) {
    let account = this.accounts.get(userId);
    if (!account) {
      account = this.createOrResetAccount(userId);
    }
    return { ...account };
  }

  /**
   * Retrieves list of beneficiaries for a user.
   */
  getBeneficiaries(userId) {
    return (this.beneficiaries.get(userId) || []).slice();
  }

  /**
   * Adds a new beneficiary to a user account.
   */
  addBeneficiary(userId, beneficiaryData) {
    const account = this.getAccount(userId);
    if (account.status === AccountStatus.PROTECTED) {
      throw new Error('Account is in PROTECTED status. Adding new beneficiaries is locked.');
    }

    const list = this.beneficiaries.get(userId) || [];
    const newBeneficiary = {
      beneficiaryId: beneficiaryData.beneficiaryId || `B-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: beneficiaryData.name || 'Unknown Recipient',
      upiId: beneficiaryData.upiId || 'unknown@mockbank',
      accountNumber: beneficiaryData.accountNumber || `AC${Math.floor(10000000 + Math.random() * 90000000)}`,
      isNew: true,
      addedAt: new Date().toISOString()
    };

    list.unshift(newBeneficiary);
    this.beneficiaries.set(userId, list);
    return newBeneficiary;
  }

  /**
   * Executes an authorized debit and credit transfer on the ledger.
   * STRICT SECURITY RULE: Rejects execution if account is protected or balance is insufficient.
   */
  executeTransfer(userId, amount, recipientUpiOrId, metadata = {}) {
    const account = this.accounts.get(userId);
    if (!account) {
      throw new Error(`Account not found for user ${userId}`);
    }

    if (account.status === AccountStatus.PROTECTED) {
      throw new Error('Transfer rejected: Account is currently in PROTECTED emergency lockdown.');
    }

    if (account.status !== AccountStatus.ACTIVE) {
      throw new Error(`Transfer rejected: Account status is ${account.status}.`);
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Invalid transfer amount.');
    }

    if (account.balance < numericAmount) {
      throw new Error(`Insufficient funds: Available balance ₹${account.balance}, requested ₹${numericAmount}.`);
    }

    // Atomic debit
    const previousBalance = account.balance;
    account.balance -= numericAmount;
    account.updatedAt = new Date().toISOString();

    return {
      success: true,
      userId,
      amount: numericAmount,
      currency: account.currency,
      previousBalance,
      newBalance: account.balance,
      recipient: recipientUpiOrId,
      executedAt: account.updatedAt,
      metadata
    };
  }

  /**
   * Applies Emergency Lockdown ("Secure My Account").
   * Freezes outbound transfers, revokes sessions, blocks beneficiary changes.
   */
  emergencyLock(userId, reason = 'CUSTOMER_INITIATED_PANIC_LOCK') {
    const account = this.accounts.get(userId) || this.createOrResetAccount(userId);
    account.status = AccountStatus.PROTECTED;
    account.updatedAt = new Date().toISOString();

    return {
      userId,
      status: AccountStatus.PROTECTED,
      transfersFrozen: true,
      beneficiariesLocked: true,
      sessionsRevoked: true,
      reason,
      lockedAt: account.updatedAt
    };
  }

  /**
   * Resets bank ledger state for a user or globally.
   */
  reset(userId = null) {
    if (userId) {
      this.createOrResetAccount(userId, { balance: 10000, status: AccountStatus.ACTIVE });
      if (userId === 'demo-user') {
        this.seedDefaultData();
      } else {
        this.beneficiaries.delete(userId);
      }
    } else {
      this.accounts.clear();
      this.beneficiaries.clear();
      this.seedDefaultData();
    }
  }
}
