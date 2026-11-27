import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { RoomManager } from './server/roomManager.ts';
import { hostAuth, type GuestPassMode } from './server/hostAuth.ts';
import {
  getOrGenerateDemoClipAsync,
  getOrGenerateDemoSnapshotAsync,
  getOrGenerateRuleClipsAsync,
} from './server/demoSnapshot.ts';
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
    res.json({ ok: true, service: 'joinstick-arcade' });
  });

  const extractBearer = (req: express.Request): string | null => {
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    return null;
  };

  const getClientKey = (req: express.Request): string => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  };

  app.get('/api/host-auth/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      masterConfigured: hostAuth.isMasterConfigured(),
      usingEnvPin: hostAuth.isUsingEnvPin(),
      publicAccessOpen: hostAuth.isPublicAccessOpen(),
      lastLockedAt: hostAuth.getLastLockedAt(),
    });
  });

  app.post('/api/host-auth/claim-pin', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = hostAuth.claimInitialMasterPin('', getClientKey(req));
    res.status(result.status).json({ error: result.error });
  });

  app.post('/api/host-auth/verify', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const requireMaster = req.body?.requireMaster === true;
    const result = hostAuth.verifyCode(code, getClientKey(req), { requireMaster });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/host-auth/logout', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    hostAuth.revokeSessionToken(extractBearer(req));
    res.json({ ok: true });
  });

  app.post('/api/host-auth/change-pin', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const newPin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    const result = hostAuth.changeMasterPin(extractBearer(req), newPin);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/host-auth/passes', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = hostAuth.listGuestPasses(extractBearer(req));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/host-auth/passes', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const mode: GuestPassMode = req.body?.mode === 'timed' ? 'timed' : 'single-use';
    const label = typeof req.body?.label === 'string' ? req.body.label : undefined;
    const hours = typeof req.body?.hours === 'number' ? req.body.hours : undefined;
    const result = hostAuth.createGuestPass(extractBearer(req), { label, mode, hours });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  });

  app.delete('/api/host-auth/passes/:id', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = hostAuth.revokeGuestPass(extractBearer(req), req.params.id);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/host-auth/public-access', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (typeof req.body?.open !== 'boolean') {
      res.status(400).json({ error: 'Invalid open flag. Expected boolean.' });
      return;
    }
    const result = hostAuth.setPublicAccess(extractBearer(req), req.body.open);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.get('/api/owner/rooms', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const session = hostAuth.verifyToken(extractBearer(req));
    if (!session || session.role !== 'master') {
      res.status(403).json({ error: 'Master authorization required.' });
      return;
    }
    res.json(roomManager.getOwnerDashboardSnapshot());
  });

  app.delete('/api/owner/rooms/:code', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const session = hostAuth.verifyToken(extractBearer(req));
    if (!session || session.role !== 'master') {
      res.status(403).json({ error: 'Master authorization required.' });
      return;
    }
    const rawCode = typeof req.params.code === 'string' ? req.params.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{4,8}$/.test(rawCode)) {
      res.status(400).json({ error: 'Invalid room code.' });
      return;
    }
    const closed = roomManager.closeRoomByOwner(rawCode);
    if (!closed) {
      res.status(404).json({ error: 'Active room not found.' });
      return;
    }
    res.json({ ok: true, code: rawCode });
  });

  app.get('/api/demo-snapshot/:gameId', async (req, res) => {
    const gameId = req.params.gameId as GameId;
    try {
      const snapshot = await getOrGenerateDemoSnapshotAsync(gameId);
      if (!snapshot) {
        res.status(404).json({ error: 'Unknown gameId' });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.json(snapshot);
    } catch (err) {
      console.error(`[demo-snapshot] Failed for ${gameId}:`, err);
      res.status(500).json({ error: 'Failed to generate demo snapshot' });
    }
  });

  app.get('/api/demo-clip/:gameId', async (req, res) => {
    const gameId = req.params.gameId as GameId;
    try {
      const clip = await getOrGenerateDemoClipAsync(gameId);
      if (!clip) {
        res.status(404).json({ error: 'Unknown gameId' });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.json(clip);
    } catch (err) {
      console.error(`[demo-clip] Failed for ${gameId}:`, err);
      res.status(500).json({ error: 'Failed to generate demo clip' });
    }
  });

  app.get('/api/rule-clips/:gameId', async (req, res) => {
    const gameId = req.params.gameId as GameId;
    try {
      const ruleClips = await getOrGenerateRuleClipsAsync(gameId);
      if (!ruleClips) {
        res.status(404).json({ error: 'Unknown gameId' });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.json(ruleClips);
    } catch (err) {
      console.error(`[rule-clips] Failed for ${gameId}:`, err);
      res.status(500).json({ error: 'Failed to generate rule clips' });
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
  server.on('connection', (socket) => {
    socket.setKeepAlive(true, 15_000);
    socket.setNoDelay(true);
  });

  // Attach authoritative WebSocket server on /ws alongside HTTP
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 2 * 1024 * 1024,
  });
  wss.on('error', (err) => {
    console.error('[ws] WebSocketServer error:', err);
  });
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
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '365d',
        immutable: true,
        fallthrough: false,
      })
    );
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`JoinStick Arcade server listening on http://0.0.0.0:${PORT}`);
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
