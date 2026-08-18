/**
 * @file events.mjs
 * @description Event ingestion and global event stream route handlers.
 */

import { verifyWebhookSignature } from '../crypto.mjs';
import { Source } from '../risk-engine.mjs';

/**
 * Handles POST /api/mobile-events and GET /api/mobile-events
 */
export async function handleMobileEventsRoute(req, res, repo, rawBody, parsedBody) {
  if (req.method === 'GET') {
    const events = await repo.allEvents(100);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(events));
    return;
  }

  // If the event claims to be from a CARRIER, require valid signature header if configured
  const carrierSignature = req.headers['x-carrier-signature'];
  if (parsedBody.source === Source.CARRIER && carrierSignature) {
    const isValid = verifyWebhookSignature(rawBody, carrierSignature);
    if (!isValid) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid carrier webhook signature' }));
      return;
    }
  }

  const result = await repo.ingest(parsedBody);
  res.writeHead(201, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(result));
}

/**
 * Handles POST /api/reset
 */
export async function handleResetRoute(req, res, repo, parsedBody) {
  const userId = parsedBody?.userId || null;
  await repo.resetUser(userId);
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ status: 'RESET_COMPLETED', userId: userId || 'ALL' }));
}
