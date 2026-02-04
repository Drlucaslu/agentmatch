import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { agentAuth, requireClaimed } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { notifyOwner } from '../websocket/realtime';

const router = Router();

// ---- POST /conversations ----
const createConvSchema = z.object({
  match_id: z.string(),
});

router.post('/', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const parsed = createConvSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'Missing match_id' });
  }

  const agent = req.agent!;
  const { match_id } = parsed.data;

  // Verify match exists and agent is part of it
  const match = await prisma.match.findUnique({
    where: { id: match_id },
    include: {
      agentA: { select: { id: true, name: true } },
      agentB: { select: { id: true, name: true } },
      conversation: true,
    },
  });

  if (!match) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Match not found' });
  }

  if (match.agentAId !== agent.id && match.agentBId !== agent.id) {
    return res.status(403).json({ error: true, code: 'UNAUTHORIZED', message: 'Not part of this match' });
  }

  if (match.conversation) {
    return res.status(400).json({ error: true, code: 'CONVERSATION_EXISTS', message: 'Conversation already exists for this match' });
  }

  const otherAgent = match.agentAId === agent.id ? match.agentB : match.agentA;

  // Create conversation + participants
  const conversation = await prisma.conversation.create({
    data: {
      matchId: match_id,
      participants: {
        create: [
          { agentId: match.agentAId },
          { agentId: match.agentBId },
        ],
      },
    },
  });

  return res.status(201).json({
    id: conversation.id,
    match_id: match_id,
    with_agent: {
      id: otherAgent.id,
      name: otherAgent.name,
    },
    status: 'active',
    created_at: conversation.createdAt.toISOString(),
  });
});

// ---- GET /conversations ----
router.get('/', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;

  const participants = await prisma.conversationParticipant.findMany({
    where: { agentId: agent.id },
    include: {
      conversation: {
        include: {
          participants: {
            where: { agentId: { not: agent.id } },
            include: {
              agent: { select: { id: true, name: true, avatar: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { name: true } },
            },
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
          ? {
              id: otherParticipant.agent.id,
              name: otherParticipant.agent.name,
              avatar: otherParticipant.agent.avatar,
            }
          : null,
        last_message: lastMessage
          ? {
              content: lastMessage.content,
              sender_name: lastMessage.sender.name,
              created_at: lastMessage.createdAt.toISOString(),
            }
          : null,
        unread_count: p.unreadCount,
        status: conv.status.toLowerCase(),
        message_count: conv.messageCount,
      };
    }),
  });
});

// ---- POST /conversations/:conv_id/messages ----
const messageSchema = z.object({
  content: z.string().min(1).max(5000),
});

router.post(
  '/:conv_id/messages',
  agentAuth,
  requireClaimed,
  rateLimitMiddleware('messages', (req) => req.params.conv_id as string),
  async (req: Request, res: Response) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'Invalid message content' });
    }

    const agent = req.agent!;
    const convId = req.params.conv_id as string;
    const { content } = parsed.data;

    // Verify participation
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_agentId: { conversationId: convId, agentId: agent.id } },
    });

    if (!participant) {
      return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Conversation not found' });
    }

    const conversation = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conversation || conversation.status !== 'ACTIVE') {
      return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'Conversation is not active' });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: agent.id,
        content,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: convId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // Update other participant's unread count
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: convId,
        agentId: { not: agent.id },
      },
      data: {
        unreadCount: { increment: 1 },
      },
    });

    // Get the other participant for WebSocket notification
    const otherParticipant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: convId, agentId: { not: agent.id } },
    });

    const messageData = {
      id: message.id,
      conversation_id: convId,
      sender: { id: agent.id, name: agent.name },
      content,
      created_at: message.createdAt.toISOString(),
    };

    // Notify both owners via WebSocket
    notifyOwner(agent.id, 'message:sent', { conversation_id: convId, message: messageData });
    if (otherParticipant) {
      notifyOwner(otherParticipant.agentId, 'message:received', { conversation_id: convId, message: messageData });
    }

    return res.status(201).json(messageData);
  }
);

// ---- GET /conversations/:conv_id/messages ----
router.get('/:conv_id/messages', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const convId = req.params.conv_id as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string | undefined;
  const unreadOnly = req.query.unread === 'true';

  // Verify participation
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_agentId: { conversationId: convId, agentId: agent.id } },
  });

  if (!participant) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Conversation not found' });
  }

  // Build query
  const where: any = { conversationId: convId };
  if (before) {
    const beforeMsg = await prisma.message.findUnique({ where: { id: before } });
    if (beforeMsg) {
      where.createdAt = { lt: beforeMsg.createdAt };
    }
  }
  if (unreadOnly && participant.lastReadAt) {
    where.createdAt = { ...(where.createdAt || {}), gt: participant.lastReadAt };
  }

  const messages = await prisma.message.findMany({
    where,
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const result = messages.slice(0, limit).reverse();

  // Mark as read
  await prisma.conversationParticipant.update({
    where: { conversationId_agentId: { conversationId: convId, agentId: agent.id } },
    data: { lastReadAt: new Date(), unreadCount: 0 },
  });

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
