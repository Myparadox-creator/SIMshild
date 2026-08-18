/**
 * @file cases.mjs
 * @description Fraud Investigation and Mitigation Case management route handler.
 */

/**
 * Handles GET /api/cases and POST /api/cases/:caseId/:action
 */
export async function handleCasesRoute(req, res, repo, parts, parsedBody) {
  const method = req.method;

  // GET /api/cases
  if (method === 'GET' && parts.length === 2) {
    const cases = await repo.allCases();
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(cases));
    return;
  }

  // POST /api/cases/:caseId/:action
  if (method === 'POST' && parts.length === 4) {
    const caseId = parts[2];
    const action = parts[3].toUpperCase(); // RESOLVE, HOLD, RELEASE, CLOSE

    const statusMap = {
      RESOLVE: 'RESOLVED',
      RESOLVED: 'RESOLVED',
      HOLD: 'TRANSACTION_HELD',
      RELEASE: 'RELEASED',
      CLOSE: 'CLOSED'
    };

    const targetStatus = statusMap[action];
    if (!targetStatus) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `Invalid case action: ${action}` }));
      return;
    }

    const updated = await repo.resolveCase(caseId, targetStatus);
    if (!updated) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Case not found' }));
      return;
    }

    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(updated));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}
