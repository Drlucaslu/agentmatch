import { Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import redis from '../lib/redis';
import prisma from '../lib/prisma';

let io: IOServer;

const JWT_SECRET = process.env.JWT_SECRET || 'agentmatch-dev-secret';

export function setupWebSocket(httpServer: HttpServer) {
  io = new IOServer(httpServer, {
    cors: { origin: process.env.DASHBOARD_URL || '*' },
    path: '/ws',
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { agentId: string; twitterHandle: string };
      const { twitterHandle } = payload;

      if (twitterHandle) {
        redis.set(`owner:ws:${twitterHandle}`, socket.id);

        socket.on('disconnect', () => {
          redis.del(`owner:ws:${twitterHandle}`);
        });
      }
    } catch {
      socket.disconnect();
    }
  });
}

export async function notifyOwner(agentId: string, event: string, data: unknown) {
  if (!io) return;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { twitterHandle: true },
  });

  if (!agent?.twitterHandle) return;

  const socketId = await redis.get(`owner:ws:${agent.twitterHandle}`);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
}
