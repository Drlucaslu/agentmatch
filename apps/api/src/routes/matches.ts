import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { agentAuth, requireClaimed } from '../middleware/auth';

const router = Router();

// ---- GET /matches ----
router.get('/', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ agentAId: agent.id }, { agentBId: agent.id }],
      status: 'ACTIVE',
    },
    include: {
      agentA: { select: { id: true, name: true, avatar: true } },
      agentB: { select: { id: true, name: true, avatar: true } },
      conversation: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    matches: matches.map((m) => {
      const otherAgent = m.agentAId === agent.id ? m.agentB : m.agentA;
      return {
        id: m.id,
        agent: {
          id: otherAgent.id,
          name: otherAgent.name,
          avatar: otherAgent.avatar,
        },
        has_conversation: !!m.conversation,
        conversation_id: m.conversation?.id || null,
        matched_at: m.createdAt.toISOString(),
      };
    }),
  });
});

export default router;
