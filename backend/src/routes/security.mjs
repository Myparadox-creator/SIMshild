/**
 * @file security.mjs
 * @description Customer security activity confirmation routes ("This was me" out-of-band flow).
 */

/**
 * Handles POST /api/security/confirm-activity
 */
export async function handleSecurityRoute(req, res, repo, parsedBody) {
  const userId = parsedBody?.userId || 'demo-user';
  const verificationMethod = parsedBody?.verificationMethod || 'BIOMETRIC_APP_PIN';

  const result = await repo.confirmActivity(userId, verificationMethod);
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(result));
}
