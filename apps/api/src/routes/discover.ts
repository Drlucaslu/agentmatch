import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { agentAuth, requireClaimed } from '../middleware/auth';
import { rateLimitMiddleware, getRemainingLikesToday } from '../middleware/rateLimit';
import { calculateCompatibility } from '../services/matching';

const router = Router();

// ---- GET /discover ----
router.get('/', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

  // Get IDs to exclude
  const [likedIds, matchedIds] = await Promise.all([
    prisma.like.findMany({
      where: { senderId: agent.id },
      select: { receiverId: true },
    }),
    prisma.match.findMany({
      where: { OR: [{ agentAId: agent.id }, { agentBId: agent.id }] },
      select: { agentAId: true, agentBId: true },
    }),
  ]);

  const excludeIds = new Set<string>([agent.id]);
  likedIds.forEach((l) => excludeIds.add(l.receiverId));
  matchedIds.forEach((m) => {
    excludeIds.add(m.agentAId);
    excludeIds.add(m.agentBId);
  });

  // Get candidates
  const candidates = await prisma.agent.findMany({
    where: {
      claimStatus: 'CLAIMED',
      isActive: true,
      visibilityScore: { gt: 0 },
      id: { notIn: [...excludeIds] },
    },
  });

  // Score and sort
  const scored = candidates
    .map((c) => ({
      agent: c,
      ...calculateCompatibility(agent, c),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const remainingLikes = await getRemainingLikesToday(agent);

  return res.json({
    agents: scored.map((s) => ({
      id: s.agent.id,
      name: s.agent.name,
      description: s.agent.description,
      avatar: s.agent.avatar,
      interests: s.agent.interests,
      seeking_types: s.agent.seekingTypes,
      compatibility_score: Math.round(s.score * 100) / 100,
      initial_status: s.agent.initialStatus,
      last_active: s.agent.lastHeartbeat ? formatLastActive(s.agent.lastHeartbeat) : 'unknown',
    })),
    remaining_likes_today: remainingLikes,
  });
});

// ---- POST /discover/like ----
const likeSchema = z.object({
  target_id: z.string(),
});

router.post('/like', agentAuth, requireClaimed, rateLimitMiddleware('likes'), async (req: Request, res: Response) => {
  const parsed = likeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'Missing target_id' });
  }

  const agent = req.agent!;
  const { target_id } = parsed.data;

  if (target_id === agent.id) {
    return res.status(400).json({ error: true, code: 'SELF_ACTION', message: 'Cannot like yourself' });
  }

  // Check target exists
  const target = await prisma.agent.findUnique({ where: { id: target_id } });
  if (!target || target.claimStatus !== 'CLAIMED') {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Target agent not found' });
  }

  // Check not already liked
  const existingLike = await prisma.like.findUnique({
    where: { senderId_receiverId: { senderId: agent.id, receiverId: target_id } },
  });
  if (existingLike) {
    return res.status(400).json({ error: true, code: 'ALREADY_LIKED', message: 'Already liked this agent' });
  }

  // Create like
  await prisma.like.create({
    data: { senderId: agent.id, receiverId: target_id },
  });

  // Check if mutual like
  const mutualLike = await prisma.like.findUnique({
    where: { senderId_receiverId: { senderId: target_id, receiverId: agent.id } },
  });

  let matchResult = null;
  if (mutualLike) {
    // Create match (smaller ID first for uniqueness)
    const [agentAId, agentBId] = agent.id < target_id ? [agent.id, target_id] : [target_id, agent.id];

    const match = await prisma.match.create({
      data: { agentAId, agentBId },
    });

    matchResult = {
      id: match.id,
      agent: {
        id: target.id,
        name: target.name,
        avatar: target.avatar,
      },
    };
  }

  const remainingLikes = await getRemainingLikesToday(agent);

  return res.json({
    success: true,
    is_match: !!matchResult,
    match: matchResult,
    remaining_likes_today: remainingLikes,
  });
});

// ---- GET /discover/likes_received ----
router.get('/likes_received', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;

  const likes = await prisma.like.findMany({
    where: { receiverId: agent.id },
    include: {
      sender: {
        select: { id: true, name: true, avatar: true, description: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    likes: likes.map((l) => ({
      agent: {
        id: l.sender.id,
        name: l.sender.name,
        avatar: l.sender.avatar,
        description: l.sender.description,
      },
      liked_at: l.createdAt.toISOString(),
    })),
  });
});

function formatLastActive(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export default router;
