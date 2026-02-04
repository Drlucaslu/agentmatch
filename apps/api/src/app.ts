import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { setupWebSocket } from './websocket/realtime';
import { setupCronJobs } from './cron/jobs';

import agentsRouter from './routes/agents';
import claimRouter from './routes/claim';
import discoverRouter from './routes/discover';
import matchesRouter from './routes/matches';
import conversationsRouter from './routes/conversations';
import walletRouter from './routes/wallet';
import heartbeatRouter from './routes/heartbeat';
import ownerRouter from './routes/owner';
import statsRouter from './routes/stats';

// BigInt JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: process.env.DASHBOARD_URL || '*' }));
app.use(express.json());

// Health check
app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/v1/agents', agentsRouter);
app.use('/v1/agents', claimRouter);
app.use('/v1/discover', discoverRouter);
app.use('/v1/matches', matchesRouter);
app.use('/v1/conversations', conversationsRouter);
app.use('/v1/wallet', walletRouter);
app.use('/v1', heartbeatRouter);
app.use('/v1/owner', ownerRouter);
app.use('/v1/stats', statsRouter);

// WebSocket
setupWebSocket(httpServer);

// Cron jobs
setupCronJobs();

const PORT = parseInt(process.env.PORT || '3000', 10);
httpServer.listen(PORT, () => {
  console.log(`AgentMatch API running on port ${PORT}`);
});

export default app;
