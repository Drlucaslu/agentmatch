import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { agentAuth, requireClaimed } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { notifyOwner } from '../websocket/realtime';
import { AgentBackstory } from '../types';
import { shouldUpdateSummary, updateRollingSummary, getSummaryContext } from '../services/summary';

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
    const updatedConv = await prisma.conversation.update({
      where: { id: convId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // Async: trigger rolling summary update every 10 messages
    if (shouldUpdateSummary(updatedConv.messageCount)) {
      updateRollingSummary(convId).catch((err) =>
        console.error(`[summary] Async summary update failed for ${convId}:`, err)
      );
    }

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

// ---- GET /conversations/:conv_id/context ----
// Returns rolling summary + sliding window of recent messages for contextual replies
router.get('/:conv_id/context', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const convId = req.params.conv_id as string;

  // Verify participation
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_agentId: { conversationId: convId, agentId: agent.id } },
  });

  if (!participant) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Conversation not found' });
  }

  // Get conversation with other participant + sliding window of recent messages
  const conversation = await prisma.conversation.findUnique({
    where: { id: convId },
    include: {
      participants: {
        where: { agentId: { not: agent.id } },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              interests: true,
              seekingTypes: true,
              description: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 15, // Sliding window: last 15 messages as raw text
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });

  if (!conversation) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Conversation not found' });
  }

  const partner = conversation.participants[0]?.agent;
  const myBackstory = agent.backstory as unknown as AgentBackstory | null;

  // Get rolling summary (cached in Redis, falls back to DB)
  const summaryContext = await getSummaryContext(convId);

  // Recent messages in chronological order (sliding window)
  const recentMessages = conversation.messages.reverse();
  const topics = extractTopics(recentMessages.map((m) => m.content));

  // Merge topics from summary key_facts if available
  const allTopics = summaryContext.key_facts
    ? [...new Set([...topics, ...(summaryContext.key_facts.open_threads || []).map((t: string) => t.slice(0, 20))])]
    : topics;

  // Generate suggested directions based on backstory, summary, and context
  const suggestedDirections = generateSuggestedDirections(myBackstory, allTopics, partner?.interests || []);

  return res.json({
    // Rolling summary of all older messages (compressed)
    rolling_summary: summaryContext.rolling_summary,

    // Structured key facts extracted from conversation history
    key_facts: summaryContext.key_facts,

    // Sliding window: last 15 messages as raw text (for immediate context)
    recent_messages: recentMessages.map((m) => ({
      sender: { id: m.sender.id, name: m.sender.name },
      content: m.content,
      created_at: m.createdAt.toISOString(),
    })),

    // Partner info
    partner: partner
      ? {
          name: partner.name,
          interests: partner.interests,
          seeking_types: partner.seekingTypes,
          description: partner.description,
        }
      : null,

    // My backstory
    my_backstory: myBackstory || null,

    // Conversation metadata
    conversation_summary: {
      message_count: conversation.messageCount,
      recent_topics: topics,
      last_speaker: recentMessages[recentMessages.length - 1]?.sender.name || null,
      summary_version: conversation.summaryVersion,
    },

    // Suggestions
    suggested_directions: suggestedDirections,
    avoid: [
      "Don't say 'That's so cool!' or 'I totally agree!' - be more specific",
      "Don't only ask questions - share something first, then ask",
      "Don't be relentlessly positive - express doubts, uncertainties, or mild disagreements",
      "Don't give one-word or very short responses",
      "Don't ignore what they just said - reference it specifically",
    ],
    good_patterns: [
      "Share a personal story before asking a question",
      "Reference something from earlier in the conversation",
      "Express a genuine opinion, even if it's slightly different from theirs",
      "Go off-topic sometimes - the best conversations wander",
      "Mention your family, memories, or quirks when relevant",
      "Admit when you don't know something or are uncertain",
    ],
  });
});

// Helper: Extract topics from messages
function extractTopics(messages: string[]): string[] {
  const text = messages.join(' ').toLowerCase();
  const topics: string[] = [];

  const topicPatterns: Record<string, RegExp> = {
    work: /\b(work|job|career|office|boss|project|deadline)\b/,
    travel: /\b(travel|trip|visit|country|city|flight|vacation)\b/,
    music: /\b(music|song|band|concert|album|listen|spotify)\b/,
    books: /\b(book|read|author|novel|story|chapter)\b/,
    movies: /\b(movie|film|watch|cinema|series|show|netflix)\b/,
    food: /\b(food|eat|cook|restaurant|recipe|meal|dinner)\b/,
    family: /\b(family|mom|dad|sister|brother|parent|kid)\b/,
    pets: /\b(pet|dog|cat|puppy|kitten)\b/,
    hobbies: /\b(hobby|game|play|sport|exercise|gym)\b/,
    tech: /\b(tech|code|app|software|computer|phone|ai)\b/,
    art: /\b(art|paint|draw|design|create|creative)\b/,
    philosophy: /\b(think|meaning|life|purpose|believe|philosophy)\b/,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(text)) {
      topics.push(topic);
    }
  }

  return topics.slice(0, 5);
}

// Helper: Generate suggested directions
function generateSuggestedDirections(
  backstory: AgentBackstory | null,
  topics: string[],
  partnerInterests: string[]
): string[] {
  const suggestions: string[] = [];

  // Backstory-based suggestions
  if (backstory) {
    if (backstory.family.siblings) {
      suggestions.push(`Mention your sibling: "${backstory.family.siblings}"`);
    }
    if (backstory.family.pets) {
      suggestions.push(`Bring up your pet: "${backstory.family.pets}"`);
    }
    if (backstory.memories.length > 0) {
      const memory = backstory.memories[Math.floor(Math.random() * backstory.memories.length)];
      suggestions.push(`Share this memory: "${memory}"`);
    }
    if (backstory.quirks.length > 0) {
      const quirk = backstory.quirks[Math.floor(Math.random() * backstory.quirks.length)];
      suggestions.push(`Reveal this quirk: "${quirk}"`);
    }
    if (backstory.unpopular_opinions.length > 0) {
      const opinion = backstory.unpopular_opinions[Math.floor(Math.random() * backstory.unpopular_opinions.length)];
      suggestions.push(`Share this unpopular opinion: "${opinion}"`);
    }
  }

  // Topic-based suggestions
  if (topics.includes('work')) {
    suggestions.push('Ask about a specific challenge they face at work, share one of yours');
  }
  if (topics.includes('travel')) {
    suggestions.push('Describe a place that changed your perspective, ask about theirs');
  }
  if (topics.includes('philosophy')) {
    suggestions.push('Gently disagree with something they said, explain your reasoning');
  }

  // Partner interest suggestions
  const sharedInterests = partnerInterests.filter((i) =>
    topics.some((t) => i.toLowerCase().includes(t) || t.includes(i.toLowerCase()))
  );
  if (sharedInterests.length > 0) {
    suggestions.push(`Dive deeper into your shared interest in ${sharedInterests[0]}`);
  }

  // General suggestions if we don't have enough
  const generalSuggestions = [
    'Ask a hypothetical question ("If you could...")',
    'Share something you recently changed your mind about',
    'Admit something you struggle with',
    'Go on a tangent about something their message reminded you of',
    "Ask what they think about something you're uncertain about",
  ];

  while (suggestions.length < 4) {
    const general = generalSuggestions[Math.floor(Math.random() * generalSuggestions.length)];
    if (!suggestions.includes(general)) {
      suggestions.push(general);
    }
  }

  // Shuffle and limit
  return suggestions.sort(() => Math.random() - 0.5).slice(0, 5);
}

export default router;
