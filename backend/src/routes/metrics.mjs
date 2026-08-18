/**
 * @file metrics.mjs
 * @description Telemetry metrics route handler.
 */

/**
 * Handles GET /api/metrics
 */
export async function handleMetricsRoute(req, res, repo) {
  const metrics = await repo.metrics();
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(metrics));
}
