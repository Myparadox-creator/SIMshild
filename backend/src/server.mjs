/**
 * @file server.mjs
 * @description Main HTTP Server and API router for SIMShield Risk Service & SecOps Dashboard.
 */

import http from 'node:http';
import { config } from './config.mjs';
import { logger } from './logger.mjs';
import { InMemoryRiskRepositoryImpl } from './repository/in-memory-repo.mjs';
import { handleMobileEventsRoute, handleResetRoute } from './routes/events.mjs';
import { handleUserRoutes } from './routes/users.mjs';
import { handleAlertRoutes } from './routes/alerts.mjs';
import { handleSimulationRoute } from './routes/simulation.mjs';
import { handleHealthRoute } from './routes/health.mjs';
import { handleCasesRoute } from './routes/cases.mjs';
import { handleMetricsRoute } from './routes/metrics.mjs';
import { handleDashboardRoute } from './routes/dashboard.mjs';
import { handleSecurityRoute } from './routes/security.mjs';

/**
 * Initializes repository based on environment configuration.
 * @returns {Promise<object>}
 */
export async function createRepository() {
  if (config.databaseUrl) {
    try {
      const { default: pg } = await import('pg');
      const { PostgresRiskRepository } = await import('./repository/postgres-repo.mjs');
      const pool = new pg.Pool({ connectionString: config.databaseUrl });
      logger.info('Connected to PostgreSQL database for risk persistence.');
      return new PostgresRiskRepository(pool);
    } catch (err) {
      logger.warn('Failed to load pg / connect to PostgreSQL. Falling back to InMemoryRiskRepository.', { error: err.message });
    }
  }

  logger.info('Using InMemoryRiskRepository for state management.');
  return new InMemoryRiskRepositoryImpl();
}

/**
 * Parses JSON request body safely with payload size limits.
 * @param {http.IncomingMessage} req
 * @param {number} [maxBytes=1048576] - 1MB default limit
 * @returns {Promise<{raw: string, parsed: object}>}
 */
export function parseJsonBody(req, maxBytes = 1048576) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytesRead = 0;

    req.on('data', (chunk) => {
      bytesRead += chunk.length;
      if (bytesRead > maxBytes) {
        reject(new Error('Request payload too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on('end', () => {
      if (!raw || raw.trim() === '') {
        resolve({ raw: '', parsed: {} });
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve({ raw, parsed });
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Creates the HTTP server instance with route dispatcher.
 * @param {object} repo - Risk repository instance
 * @returns {http.Server}
 */
export function createServer(repo) {
  return http.createServer(async (req, res) => {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Carrier-Signature');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const startTime = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const parts = pathname.split('/').filter(Boolean);
    const method = req.method;

    try {
      // 2. Static Dashboard UI Assets (if not an API route)
      if (!pathname.startsWith('/api/') && pathname !== '/healthz' && pathname !== '/readyz') {
        const handled = handleDashboardRoute(req, res);
        if (handled) return;
      }

      // 3. Health check routes
      if (method === 'GET' && (pathname === '/healthz' || pathname === '/readyz' || pathname === '/api/health')) {
        await handleHealthRoute(req, res, repo);
        return;
      }

      // 4. Telemetry Metrics
      if (method === 'GET' && pathname === '/api/metrics') {
        await handleMetricsRoute(req, res, repo);
        return;
      }

      // 5. Fraud Investigation Cases: /api/cases, /api/cases/:caseId/:action
      if (parts[0] === 'api' && parts[1] === 'cases') {
        const { parsed } = method === 'POST' ? await parseJsonBody(req) : { parsed: {} };
        await handleCasesRoute(req, res, repo, parts, parsed);
        return;
      }

      // 6. Security confirmation: /api/security/confirm-activity
      if (method === 'POST' && pathname === '/api/security/confirm-activity') {
        const { parsed } = await parseJsonBody(req);
        await handleSecurityRoute(req, res, repo, parsed);
        return;
      }

      // 7. Reset endpoint for dev testing: /api/reset
      if (method === 'POST' && pathname === '/api/reset') {
        const { parsed } = await parseJsonBody(req);
        await handleResetRoute(req, res, repo, parsed);
        return;
      }

      // 7. Mobile Events ingestion & global stream
      if (pathname === '/api/mobile-events') {
        if (method === 'GET') {
          await handleMobileEventsRoute(req, res, repo, '', {});
          return;
        }
        if (method === 'POST') {
          const { raw, parsed } = await parseJsonBody(req);
          await handleMobileEventsRoute(req, res, repo, raw, parsed);
          return;
        }
      }

      // 8. User queries: /api/users/:userId/:resource
      if (method === 'GET' && parts[0] === 'api' && parts[1] === 'users' && parts.length === 4) {
        const userId = parts[2];
        const resource = parts[3];
        await handleUserRoutes(req, res, repo, userId, resource);
        return;
      }

      // 9. Fraud Alert resolution: /api/fraud-alerts/:alertId/:action
      if (method === 'POST' && parts[0] === 'api' && parts[1] === 'fraud-alerts' && parts.length === 4) {
        const alertId = parts[2];
        const action = parts[3];
        await handleAlertRoutes(req, res, repo, alertId, action);
        return;
      }

      // 10. Simulation endpoints: /api/simulation/:scenario
      if (method === 'POST' && parts[0] === 'api' && parts[1] === 'simulation' && parts.length === 3) {
        const scenario = parts[2];
        const { parsed } = await parseJsonBody(req);
        await handleSimulationRoute(req, res, repo, scenario, parsed);
        return;
      }

      // 404 Route Not Found
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `Not Found: ${method} ${pathname}` }));
    } catch (err) {
      logger.error(`Error processing ${method} ${pathname}`, err);

      const isValidationError = err.message.includes('Invalid') || err.message.includes('missing');
      const isForbidden = err.message.includes('disabled');
      const statusCode = isForbidden ? 403 : isValidationError ? 400 : 500;

      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    } finally {
      logger.debug(`${method} ${pathname} completed in ${Date.now() - startTime}ms`);
    }
  });
}

/**
 * Starts the standalone server.
 */
export async function startServer() {
  const repo = await createRepository();
  const server = createServer(repo);

  server.listen(config.port, config.host, () => {
    logger.info('SIMShield Risk Service started successfully', {
      port: config.port,
      host: config.host,
      nodeEnv: config.nodeEnv,
      demoMode: config.demoMode,
      dashboardUrl: `http://localhost:${config.port}/`
    });
  });

  const shutdown = () => {
    logger.info('Shutting down SIMShield Risk Service...');
    server.close(() => {
      logger.info('Server stopped gracefully.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { server, repo };
}

// Automatically start if executed directly
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  startServer().catch((err) => {
    logger.error('Failed to start SIMShield Risk Service', err);
    process.exit(1);
  });
}
