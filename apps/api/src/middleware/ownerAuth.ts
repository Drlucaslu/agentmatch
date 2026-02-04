import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'agentmatch-dev-secret';

export interface OwnerJwtPayload {
  agentId: string;
  twitterHandle: string;
  iat: number;
  exp: number;
}

export function signOwnerJwt(agentId: string, twitterHandle: string): string {
  return jwt.sign({ agentId, twitterHandle }, JWT_SECRET, { expiresIn: '7d' });
}

export async function ownerAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Missing JWT token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as OwnerJwtPayload;
    req.ownerAgentId = payload.agentId;
    req.ownerTwitterHandle = payload.twitterHandle;
    next();
  } catch {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Invalid or expired JWT token' });
  }
}
