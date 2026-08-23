/**
 * @file security.mjs
 * @description Customer security activity confirmation routes ("This was me" out-of-band flow).
 */

/**
 * Handles POST /api/security/confirm-activity and POST /api/security/emergency-lock
 */
export async function handleSecurityRoute(req, res, repo, parsedBody, pathname) {
  const userId = parsedBody?.userId || 'demo-user';

  if (pathname === '/api/security/emergency-lock') {
    const reason = parsedBody?.reason || 'CUSTOMER_INITIATED_PANIC_LOCK';
    const result = await repo.emergencyLock(userId, reason);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(result));
    return;
  }

  const verificationMethod = parsedBody?.verificationMethod || 'BIOMETRIC_APP_PIN';
  const result = await repo.confirmActivity(userId, verificationMethod);
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(result));
}
