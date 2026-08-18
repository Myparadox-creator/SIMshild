/**
 * @file crypto.mjs
 * @description Cryptographic utilities for identifier hashing and webhook signature verification.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.mjs';

/**
 * Computes a secure HMAC-SHA256 hash of a sensitive identifier (e.g. device ID, IP address, phone number).
 * @param {string|number} value - The identifier to hash.
 * @param {string} [secret] - Secret pepper / key (defaults to config.hashSecret).
 * @returns {string} Hex-encoded hash string.
 */
export function hashIdentifier(value, secret = config.hashSecret) {
  if (value === null || value === undefined) return null;
  return createHmac('sha256', secret)
    .update(String(value).trim())
    .digest('hex');
}

/**
 * Standard SHA-256 hash without key (for legacy compatibility).
 * @param {string|number} value
 * @returns {string} Hex-encoded hash.
 */
export function sha256(value) {
  if (value === null || value === undefined) return null;
  return createHash('sha256')
    .update(String(value).trim())
    .digest('hex');
}

/**
 * Verifies HMAC-SHA256 signature on an incoming webhook payload using timing-safe comparison.
 * @param {string|Buffer} rawPayload - Raw request body string/buffer.
 * @param {string} signature - Provided hex signature (e.g. from X-Carrier-Signature header).
 * @param {string} [secret] - Webhook secret.
 * @returns {boolean} True if signature matches.
 */
export function verifyWebhookSignature(rawPayload, signature, secret = config.carrierWebhookSecret) {
  if (!rawPayload || !signature) return false;
  try {
    const expected = createHmac('sha256', secret)
      .update(typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf8'))
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}
