/**
 * @file transactions.mjs
 * @description Mock UPI Transaction & Banking API Route Handlers.
 * 
 * ZERO-TRUST PRINCIPLE:
 * Enforces server-authoritative pre-check and execution.
 * Balances cannot be debited unless SIMShield evaluates the risk as ALLOW.
 */

/**
 * Handles /api/transactions/* routes.
 * @param {object} req
 * @param {object} res
 * @param {object} repo
 * @param {Array<string>} parts
 * @param {object} parsedBody
 */
export async function handleTransactionsRoute(req, res, repo, parts, parsedBody) {
  const method = req.method;

  // POST /api/transactions/precheck
  if (method === 'POST' && parts.length === 3 && parts[2] === 'precheck') {
    try {
      const result = await repo.precheckTransaction(parsedBody);
      const isBlocked = result.decision === 'BLOCK' || result.status === 'BLOCKED';
      const statusCode = isBlocked ? 200 : 200; // Returns 200 with decision: BLOCK

      res.writeHead(statusCode, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Precheck failed' }));
    }
    return;
  }

  // POST /api/transactions/verify
  if (method === 'POST' && parts.length === 3 && parts[2] === 'verify') {
    try {
      const transactionId = parsedBody.transactionId;
      const verificationMethod = parsedBody.verificationMethod || 'BIOMETRIC';
      const result = await repo.verifyAndAuthorizeTransaction(transactionId, verificationMethod);

      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Verification failed' }));
    }
    return;
  }

  // POST /api/transactions/authorize
  if (method === 'POST' && parts.length === 3 && parts[2] === 'authorize') {
    try {
      const transactionId = parsedBody.transactionId;
      const verificationMethod = parsedBody.verificationMethod || 'BIOMETRIC';
      const result = await repo.verifyAndAuthorizeTransaction(transactionId, verificationMethod);

      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Authorization failed' }));
    }
    return;
  }

  // POST /api/transactions/execute
  if (method === 'POST' && parts.length === 3 && parts[2] === 'execute') {
    try {
      const transactionId = parsedBody.transactionId;
      const userId = parsedBody.userId || 'demo-user';

      if (!transactionId) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required field: transactionId' }));
        return;
      }

      const result = await repo.executeTransaction(transactionId, userId);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(result));
    } catch (err) {
      const isForbidden = err.message.includes('BLOCKED') || err.message.includes('Rejected') || err.message.includes('HELD');
      const statusCode = isForbidden ? 403 : 400;
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Transaction execution failed' }));
    }
    return;
  }

  // GET /api/transactions/:id
  if (method === 'GET' && parts.length === 3) {
    const transactionId = parts[2];
    const txn = await repo.getTransaction(transactionId);
    if (!txn) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Transaction not found' }));
      return;
    }

    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(txn));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Transactions endpoint not found' }));
}

/**
 * Handles Banking & Ledger user-specific routes (/api/users/:userId/balance, etc.)
 */
export async function handleBankingUserRoutes(req, res, repo, userId, resource, parsedBody = {}) {
  const method = req.method;

  // GET /api/users/:userId/balance
  if (method === 'GET' && resource === 'balance') {
    const account = await repo.getAccount(userId);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(account));
    return;
  }

  // GET /api/users/:userId/transactions
  if (method === 'GET' && resource === 'transactions') {
    const txns = await repo.getTransactionsForUser(userId);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(txns));
    return;
  }

  // GET /api/users/:userId/beneficiaries
  if (method === 'GET' && resource === 'beneficiaries') {
    const beneficiaries = await repo.getBeneficiaries(userId);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(beneficiaries));
    return;
  }

  // POST /api/users/:userId/beneficiaries
  if (method === 'POST' && resource === 'beneficiaries') {
    try {
      const added = await repo.addBeneficiary(userId, parsedBody);
      res.writeHead(201, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(added));
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Failed to add beneficiary' }));
    }
    return;
  }

  return false; // Not handled here
}
