import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { RoomManager } from './server/roomManager.ts';
import { getOrGenerateDemoClip, getOrGenerateDemoSnapshot } from './server/demoSnapshot.ts';
import type { GameId } from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json());

  const roomManager = new RoomManager();

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, service: 'cloocade-party' });
  });

  app.get('/api/demo-snapshot/:gameId', (req, res) => {
    const gameId = req.params.gameId as GameId;
    try {
      const snapshot = getOrGenerateDemoSnapshot(gameId);
      if (!snapshot) {
        res.status(404).json({ error: 'Unknown gameId' });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(snapshot);
    } catch (err) {
      console.error(`[demo-snapshot] Failed for ${gameId}:`, err);
      res.status(500).json({ error: 'Failed to generate demo snapshot' });
    }
  });

  app.get('/api/demo-clip/:gameId', (req, res) => {
    const gameId = req.params.gameId as GameId;
    try {
      const clip = getOrGenerateDemoClip(gameId);
      if (!clip) {
        res.status(404).json({ error: 'Unknown gameId' });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(clip);
    } catch (err) {
      console.error(`[demo-clip] Failed for ${gameId}:`, err);
      res.status(500).json({ error: 'Failed to generate demo clip' });
    }
  });

  app.get('/api/rooms/:code', (req, res) => {
    const summary = roomManager.getRoomSummary(req.params.code);
    if (!summary) {
      res.status(404).json({ exists: false, message: 'Room not found' });
      return;
    }
    res.json(summary);
  });

  const server = http.createServer(app);
  server.requestTimeout = 0;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // Attach authoritative WebSocket server on /ws alongside HTTP
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    roomManager.handleConnection(ws);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cloocade Party server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    wss.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
