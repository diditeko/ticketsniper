require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Serve static dashboard build if available
const dashboardDist = path.join(__dirname, 'dashboard', 'dist');
if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
}

// ─── WebSocket broadcast ───────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'Connected to TicketSniper server' }));
  ws.on('error', () => {});
});

// ─── Bot state ────────────────────────────────────────────────────────────
let botState = {
  status: 'idle',
  step: null,
  startedAt: null,
  result: null,
  error: null,
};
let botProcess = null;

// ─── REST API ─────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json(botState);
});

app.post('/api/bot/start', async (req, res) => {
  if (botState.status === 'running') {
    return res.status(409).json({ error: 'Bot is already running' });
  }

  // Always clean up any stale browser from a previous error/stop before launching
  const { run, setBroadcast, cleanup } = require('./bot');
  await cleanup();

  botState = { status: 'running', step: 'init', startedAt: Date.now(), result: null, error: null };
  broadcast({ type: 'bot_started' });
  res.json({ ok: true });

  setBroadcast(broadcast);

  run()
    .then((result) => {
      botState.status = 'done';
      botState.result = result;
      broadcast({ type: 'bot_done', result });
    })
    .catch((err) => {
      logger.error(`Bot error: ${err.message}`);
      botState.status = 'error';
      botState.error = err.message;
      broadcast({ type: 'bot_error', message: err.message });
    });
});

app.post('/api/bot/stop', async (_req, res) => {
  const { cleanup } = require('./bot');
  await cleanup();
  botState.status = 'idle';
  broadcast({ type: 'bot_stopped' });
  res.json({ ok: true });
});

// ─── Config endpoints ─────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return res.json({});
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const config = {};
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        config[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  });
  res.json(config);
});

app.post('/api/config', (req, res) => {
  const envPath = path.join(__dirname, '.env');
  const data = req.body;
  const lines = Object.entries(data)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  fs.writeFileSync(envPath, lines + '\n');
  Object.assign(process.env, data);
  res.json({ ok: true });
});

// ─── Profile endpoints ────────────────────────────────────────────────────
app.get('/api/profile', (_req, res) => {
  const profilePath = path.join(__dirname, 'profile.json');
  if (!fs.existsSync(profilePath)) {
    return res.json({});
  }
  res.json(JSON.parse(fs.readFileSync(profilePath, 'utf-8')));
});

app.post('/api/profile', (req, res) => {
  const profilePath = path.join(__dirname, 'profile.json');
  fs.writeFileSync(profilePath, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// ─── Session check ────────────────────────────────────────────────────────
app.get('/api/session/check', async (_req, res) => {
  try {
    const { checkSession } = require('./session');
    const valid = await checkSession();
    res.json({ valid });
  } catch (err) {
    res.json({ valid: false, error: err.message });
  }
});

// ─── Logs ─────────────────────────────────────────────────────────────────
app.get('/api/logs', (_req, res) => {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) return res.json([]);
  const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.log'));
  res.json(files);
});

// ─── SPA fallback ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(dashboardDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'TicketSniper API running. Build dashboard with: cd dashboard && npm run build' });
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────
logger.setWebSocketBroadcaster(broadcast);
server.listen(PORT, () => {
  logger.success(`TicketSniper server running at http://localhost:${PORT}`);
  logger.info('Dashboard: http://localhost:5173 (run: cd dashboard && npm run dev)');
});

module.exports = { app, broadcast };
