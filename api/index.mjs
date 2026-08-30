import { createRepository, createServer } from '../backend/src/server.mjs';

let appHandler = null;

export default async function handler(req, res) {
  if (!appHandler) {
    const repo = await createRepository();
    const server = createServer(repo);
    appHandler = server.listeners('request')[0];
  }
  return appHandler(req, res);
}
