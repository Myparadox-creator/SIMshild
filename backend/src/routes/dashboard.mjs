/**
 * @file dashboard.mjs
 * @description Static asset server for SecOps Web Dashboard & Attack Simulator.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/**
 * Serves static dashboard files.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {boolean} True if static file was handled
 */
export function handleDashboardRoute(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;

  if (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/') {
    pathname = '/index.html';
  } else if (pathname.startsWith('/dashboard/')) {
    pathname = pathname.replace('/dashboard', '');
  }

  const safePath = pathname.replace(/^(\.\.[\/\\])+/, '');
  const filePath = join(PUBLIC_DIR, safePath);

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Content-Length': Buffer.byteLength(content)
    });

    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(content);
    }
    return true;
  } catch {
    return false;
  }
}
