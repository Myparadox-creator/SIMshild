/**
 * @file migrate.mjs
 * @description Automated PostgreSQL database migration runner.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../src/config.mjs';
import { logger } from '../src/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  if (!config.databaseUrl) {
    logger.error('DATABASE_URL environment variable is not set. Migration aborted.');
    process.exit(1);
  }

  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();

  try {
    logger.info('Connected to PostgreSQL. Running migrations...');
    await client.query('BEGIN');

    // Create migrations tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const appliedRes = await client.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(appliedRes.rows.map((r) => r.version));

    const files = readdirSync(__dirname)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.debug(`Migration ${file} already applied.`);
        continue;
      }

      logger.info(`Applying migration: ${file}`);
      const sql = readFileSync(join(__dirname, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      logger.info(`Successfully applied migration: ${file}`);
    }

    await client.query('COMMIT');
    logger.info('All migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed. Rolled back changes.', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  logger.error('Migration execution error', err);
  process.exit(1);
});
