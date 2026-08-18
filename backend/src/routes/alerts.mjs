/**
 * @file alerts.mjs
 * @description Alert resolution and reporting route handler.
 */

/**
 * Handles POST /api/fraud-alerts/:alertId/:action
 */
export async function handleAlertRoutes(req, res, repo, alertId, action) {
  if (!['acknowledge', 'report'].includes(action)) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `Invalid action '${action}'. Expected 'acknowledge' or 'report'.` }));
    return;
  }

  const alert = await repo.resolveAlert(alertId, action);
  if (!alert) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Alert not found' }));
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(alert));
}
