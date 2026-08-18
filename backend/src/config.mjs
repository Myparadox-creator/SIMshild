/**
 * @file config.mjs
 * @description Centralized application configuration.
 */

export const config = Object.freeze({
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  demoMode: process.env.SIMSHIELD_DEMO === 'true',
  hashSecret: process.env.HASH_SECRET || 'simshield-default-dev-secret-change-in-prod',
  carrierWebhookSecret: process.env.CARRIER_WEBHOOK_SECRET || 'simshield-carrier-shared-secret',
  databaseUrl: process.env.DATABASE_URL || null,
  correlationWindowMs: Number(process.env.CORRELATION_WINDOW_MS || 24 * 60 * 60 * 1000), // 24 hours
  maxScore: 100
});
