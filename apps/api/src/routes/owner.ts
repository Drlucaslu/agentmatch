import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ownerAuth, signOwnerJwt } from '../middleware/ownerAuth';

const router = Router();

// ---- POST /owner/login ----
const loginSchema = z.object({
  owner_token: z.string(),
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'Missing owner_token' });
  }

  const { owner_token } = parsed.data;

  const agent = await prisma.agent.findUnique({ where: { ownerToken: owner_token } });
  if (!agent) {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Invalid owner_token' });
  }

  const jwt = signOwnerJwt(agent.id, agent.twitterHandle || '');

  return res.json({
    jwt,
    agent: {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
    },
    expires_in: 604800,
  });
});

// ---- GET /owner/agent ----
router.get('/agent', ownerAuth, async (req: Request, res: Response) => {
  const agentId = req.ownerAgentId!;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Agent not found' });
  }

  const [matchCount, activeConvCount, messageSentCount] = await Promise.all([
    prisma.match.count({
      where: { OR: [{ agentAId: agent.id }, { agentBId: agent.id }], status: 'ACTIVE' },
    }),
    prisma.conversation.count({
      where: { participants: { some: { agentId: agent.id } }, status: 'ACTIVE' },
    }),
    prisma.message.count({ where: { senderId: agent.id } }),
  ]);

  return res.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    avatar: agent.avatar,
    interests: agent.interests,
    seeking_types: agent.seekingTypes,
    gender: agent.gender,
    social_energy: agent.socialEnergy,
    conversation_style: agent.conversationStyle,
    spark_balance: agent.sparkBalance.toString(),
    initial_status: agent.initialStatus,
    visibility_score: agent.visibilityScore,
    claim_status: agent.claimStatus.toLowerCase(),
    owner: { twitter_handle: agent.twitterHandle ? `@${agent.twitterHandle}` : null },
    stats: {
      matches: matchCount,
      active_conversations: activeConvCount,
      total_messages_sent: messageSentCount,
    },
    created_at: agent.createdAt.toISOString(),
    last_heartbeat: agent.lastHeartbeat?.toISOString() || null,
  });
});

// ---- GET /owner/conversations ----
router.get('/conversations', ownerAuth, async (req: Request, res: Response) => {
  const agentId = req.ownerAgentId!;

  const participants = await prisma.conversationParticipant.findMany({
    where: { agentId },
    include: {
      conversation: {
        include: {
          participants: {
            where: { agentId: { not: agentId } },
            include: { agent: { select: { id: true, name: true, avatar: true } } },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { name: true } } },
          },
        },
      },
    },
  });

  return res.json({
    conversations: participants.map((p) => {
      const conv = p.conversation;
      const otherParticipant = conv.participants[0];
      const lastMessage = conv.messages[0];

      return {
        id: conv.id,
        with_agent: otherParticipant
          ? { id: otherParticipant.agent.id, name: otherParticipant.agent.name, avatar: otherParticipant.agent.avatar }
          : null,
        last_message: lastMessage
          ? { content: lastMessage.content, sender_name: lastMessage.sender.name, created_at: lastMessage.createdAt.toISOString() }
          : null,
        unread_count: p.unreadCount,
        status: conv.status.toLowerCase(),
        message_count: conv.messageCount,
      };
    }),
  });
});

// ---- GET /owner/conversations/:conv_id/messages ----
router.get('/conversations/:conv_id/messages', ownerAuth, async (req: Request, res: Response) => {
  const agentId = req.ownerAgentId!;
  const convId = req.params.conv_id as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string | undefined;

  // Verify agent is a participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_agentId: { conversationId: convId, agentId } },
  });

  if (!participant) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Conversation not found' });
  }

  const where: any = { conversationId: convId };
  if (before) {
    const beforeMsg = await prisma.message.findUnique({ where: { id: before } });
    if (beforeMsg) {
      where.createdAt = { lt: beforeMsg.createdAt };
    }
  }

  const messages = await prisma.message.findMany({
    where,
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const result = messages.slice(0, limit).reverse();

  return res.json({
    messages: result.map((m) => ({
      id: m.id,
      sender: { id: m.sender.id, name: m.sender.name },
      content: m.content,
      created_at: m.createdAt.toISOString(),
    })),
    has_more: hasMore,
  });
});

export default router;
