/**
 * @file users.mjs
 * @description User-related risk, security event timeline, and alerts route handlers.
 */

/**
 * Handles GET /api/users/:userId/:resource
 */
export async function handleUserRoutes(req, res, repo, userId, resource) {
  if (!userId) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing userId in path' }));
    return;
  }

  if (resource === 'risk') {
    const risk = await repo.riskFor(userId);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(risk));
    return;
  }

  if (resource === 'security-events') {
    const events = await repo.securityEvents(userId);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(events));
    return;
  }

  if (resource === 'fraud-alerts') {
    const alerts = await repo.alertsFor(userId);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(alerts));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: `Unknown user resource: ${resource}` }));
}
