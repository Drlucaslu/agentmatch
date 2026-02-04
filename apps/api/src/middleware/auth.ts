import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export async function agentAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Missing API key' });
  }

  const agent = await prisma.agent.findUnique({ where: { apiKey: token } });
  if (!agent) {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Invalid API key' });
  }

  req.agent = agent;
  next();
}

export function requireClaimed(req: Request, res: Response, next: NextFunction) {
  if (!req.agent || req.agent.claimStatus !== 'CLAIMED') {
    return res.status(403).json({
      error: true,
      code: 'NOT_CLAIMED',
      message: 'Agent must be claimed before using this feature',
    });
  }
  next();
}
