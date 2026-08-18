/**
 * @file health.mjs
 * @description Liveness, Readiness, and System Status health check route handler.
 */

import { config } from '../config.mjs';

/**
 * Handles GET /healthz, /readyz, /api/health
 */
export async function handleHealthRoute(req, res, repo) {
  const isPostgres = repo?.constructor?.name === 'PostgresRiskRepository';
  let dbStatus = 'in-memory';

  if (isPostgres && repo.pool) {
    try {
      await repo.pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'degraded';
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        status: 'UNHEALTHY',
        database: dbStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
      return;
    }
  }

  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({
    status: 'HEALTHY',
    service: 'simshield-risk-service',
    version: '1.0.0',
    demoMode: config.demoMode,
    database: dbStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }));
}
