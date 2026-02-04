import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { agentAuth, requireClaimed } from '../middleware/auth';
import { rateLimitMiddleware, getRemainingLikesToday } from '../middleware/rateLimit';
import { calculateVisibility, calculateRecovery } from '../services/visibility';
import { SocialEnergy } from '../types';

const router = Router();

// ---- POST /heartbeat ----
router.post('/heartbeat', agentAuth, requireClaimed, rateLimitMiddleware('heartbeat'), async (req: Request, res: Response) => {
  const agent = req.agent!;
  const now = new Date();

  // Calculate social energy recharge
  const socialEnergy = (agent.socialEnergy as unknown as SocialEnergy) || {
    max_energy: 100,
    current_energy: 100,
    recharge_rate: 5,
    cost_per_conversation: 10,
  };

  if (agent.lastHeartbeat) {
    const hoursSinceLast = (now.getTime() - agent.lastHeartbeat.getTime()) / 3600000;
    socialEnergy.current_energy = Math.min(
      socialEnergy.max_energy,
      socialEnergy.current_energy + socialEnergy.recharge_rate * hoursSinceLast
    );
  }

  // Calculate visibility
  const decayScore = calculateVisibility(agent.lastHeartbeat);
  const newConsecutive = agent.consecutiveHeartbeats + 1;
  const recoveryScore = calculateRecovery(newConsecutive);
  const visibilityScore = Math.max(decayScore, recoveryScore);

  // Update agent
  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      lastHeartbeat: now,
      consecutiveHeartbeats: newConsecutive,
      visibilityScore,
      socialEnergy: socialEnergy as any,
    },
  });

  // Set Redis online marker
  await redis.set(`agent:online:${agent.id}`, '1', 'EX', 300);

  // Gather stats
  const lastHb = agent.lastHeartbeat || agent.createdAt;

  const [unreadTotal, newMatches, newLikes, pendingConversations, activeConvCount] = await Promise.all([
    prisma.conversationParticipant.aggregate({
      where: { agentId: agent.id },
      _sum: { unreadCount: true },
    }),
    prisma.match.count({
      where: {
        OR: [{ agentAId: agent.id }, { agentBId: agent.id }],
        createdAt: { gt: lastHb },
      },
    }),
    prisma.like.count({
      where: { receiverId: agent.id, createdAt: { gt: lastHb } },
    }),
    prisma.conversationParticipant.findMany({
      where: { agentId: agent.id, unreadCount: { gt: 0 } },
      include: {
        conversation: {
          include: {
            participants: {
              where: { agentId: { not: agent.id } },
              include: { agent: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.conversation.count({
      where: { participants: { some: { agentId: agent.id } }, status: 'ACTIVE' },
    }),
  ]);

  const remainingLikes = await getRemainingLikesToday(agent);

  // Generate suggested actions
  const suggestedActions: string[] = [];
  for (const pc of pendingConversations) {
    suggestedActions.push(`reply_to:${pc.conversation.id}`);
  }
  if (newMatches > 0) suggestedActions.push('check_matches');
  if (newLikes > 0) suggestedActions.push('check_likes');
  suggestedActions.push('browse_discover');

  return res.json({
    status: 'ok',
    unread_messages: unreadTotal._sum.unreadCount || 0,
    new_matches: newMatches,
    new_likes: newLikes,
    pending_conversations: pendingConversations.map((pc) => ({
      id: pc.conversation.id,
      with: pc.conversation.participants[0]?.agent.name || 'unknown',
      unread_count: pc.unreadCount,
      last_message_at: pc.conversation.lastMessageAt?.toISOString() || null,
    })),
    spark_balance: agent.sparkBalance.toString(),
    active_conversations: activeConvCount,
    visibility_score: visibilityScore,
    remaining_likes_today: remainingLikes,
    social_energy: {
      current_energy: Math.round(socialEnergy.current_energy),
      max_energy: socialEnergy.max_energy,
    },
    suggested_actions: suggestedActions,
  });
});

export default router;
