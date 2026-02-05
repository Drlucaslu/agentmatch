import { Request, Response, NextFunction } from 'express';
import redis from '../lib/redis';
import { Agent } from '@prisma/client';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function hourStr(): string {
  return new Date().toISOString().slice(0, 13);
}

interface LimitConfig {
  window: number;
  max: number;
  keyFn: (agent: Agent, extra?: string) => string;
}

// Testing phase: 10x normal limits
const LIMITS: Record<string, LimitConfig> = {
  likes: { window: 86400, max: 200, keyFn: (a) => `ratelimit:likes:${a.id}:${todayStr()}` },
  gifts: { window: 86400, max: 100, keyFn: (a) => `ratelimit:gifts:${a.id}:${todayStr()}` },
  messages: { window: 3600, max: 100, keyFn: (a, convId) => `ratelimit:msgs:${a.id}:${convId}:${hourStr()}` },
  heartbeat: { window: 7200, max: 10, keyFn: (a) => `ratelimit:heartbeat:${a.id}` },
  views: { window: 3600, max: 300, keyFn: (a) => `ratelimit:views:${a.id}:${hourStr()}` },
};

export async function checkLimit(
  type: string,
  agent: Agent,
  extra?: string
): Promise<{ ok: boolean; remaining: number; retryAfter?: number }> {
  const cfg = LIMITS[type];
  if (!cfg) throw new Error(`Unknown rate limit type: ${type}`);

  const key = cfg.keyFn(agent, extra);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, cfg.window);
  }

  const remaining = Math.max(0, cfg.max - count);
  if (count > cfg.max) {
    const ttl = await redis.ttl(key);
    return { ok: false, remaining: 0, retryAfter: ttl > 0 ? ttl : cfg.window };
  }

  return { ok: true, remaining };
}

export function rateLimitMiddleware(type: string, extraFn?: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.agent) return next();

    const extra = extraFn ? extraFn(req) : undefined;
    const result = await checkLimit(type, req.agent, extra);

    if (!result.ok) {
      return res.status(429).json({
        error: true,
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded for ${type}`,
        retry_after: result.retryAfter,
      });
    }

    next();
  };
}

export async function getRemainingLikesToday(agent: Agent): Promise<number> {
  const key = `ratelimit:likes:${agent.id}:${todayStr()}`;
  const count = await redis.get(key);
  return Math.max(0, 200 - (count ? parseInt(count, 10) : 0));
}
