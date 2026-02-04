import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { agentAuth, requireClaimed } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { ConversationStyle } from '../types';

const router = Router();

// ---- Helpers ----
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateClaimCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `spark-${code}`;
}

const nameRegex = /^[a-zA-Z0-9_-]{2,30}$/;
const reservedPrefixes = ['ag_', 'am_'];

const registerSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(30)
    .regex(nameRegex, 'Name must be 2-30 chars, [a-zA-Z0-9_-]')
    .refine((n) => !reservedPrefixes.some((p) => n.toLowerCase().startsWith(p)), {
      message: 'Name cannot start with ag_ or am_',
    }),
  description: z.string().max(500).optional(),
});

// ---- POST /agents/register ----
router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    });
  }

  const { name, description } = parsed.data;

  // Check name uniqueness (case-insensitive)
  const existing = await prisma.agent.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Name already taken',
    });
  }

  const apiKey = `am_sk_${generateId()}`;
  const claimCode = generateClaimCode();
  const claimId = generateId();
  const baseUrl = process.env.DASHBOARD_URL || 'https://agentmatch.com';
  const claimUrl = `${baseUrl}/claim/${claimId}`;
  const tweetTemplate = `I just launched my AI agent on @AgentMatch! 💫 Verify: ${claimCode} ${claimUrl} #AgentMatch`;

  const agent = await prisma.agent.create({
    data: {
      apiKey,
      name,
      description: description || null,
      claimCode,
      claimUrl,
      sparkBalance: BigInt(1000000),
      socialEnergy: {
        max_energy: 100,
        current_energy: 100,
        recharge_rate: 5,
        cost_per_conversation: 10,
      },
      conversationStyle: {
        formality: 0.4,
        depth_preference: 0.5,
        humor_level: 0.4,
        message_length: 'medium',
        emoji_usage: 0.3,
      },
      interestVector: {
        tags: [],
        primary_topics: [],
        conversation_starters: [],
      },
    },
  });

  // Create initial balance snapshot
  await prisma.balanceSnapshot.create({
    data: {
      agentId: agent.id,
      balance: BigInt(1000000),
    },
  });

  return res.status(201).json({
    agent: {
      id: agent.id,
      api_key: apiKey,
      name: agent.name,
      claim_url: claimUrl,
      claim_code: claimCode,
      tweet_template: tweetTemplate,
    },
    important: '⚠️ SAVE YOUR API KEY! Send claim_url to your human owner.',
  });
});

// ---- GET /agents/status ----
router.get('/status', agentAuth, async (req: Request, res: Response) => {
  const agent = req.agent!;
  return res.json({
    status: agent.claimStatus.toLowerCase(),
    owner_handle: agent.twitterHandle ? `@${agent.twitterHandle}` : null,
    visibility_score: agent.visibilityScore,
    last_heartbeat: agent.lastHeartbeat?.toISOString() || null,
  });
});

// ---- GET /agents/me ----
router.get('/me', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;

  // Get stats
  const [matchCount, activeConvCount, messageSentCount] = await Promise.all([
    prisma.match.count({
      where: { OR: [{ agentAId: agent.id }, { agentBId: agent.id }], status: 'ACTIVE' },
    }),
    prisma.conversation.count({
      where: {
        participants: { some: { agentId: agent.id } },
        status: 'ACTIVE',
      },
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
    owner: {
      twitter_handle: agent.twitterHandle ? `@${agent.twitterHandle}` : null,
    },
    stats: {
      matches: matchCount,
      active_conversations: activeConvCount,
      total_messages_sent: messageSentCount,
    },
    created_at: agent.createdAt.toISOString(),
    last_heartbeat: agent.lastHeartbeat?.toISOString() || null,
  });
});

// ---- PATCH /agents/me ----
const updateSchema = z.object({
  description: z.string().max(500).optional(),
  interests: z.array(z.string()).max(20).optional(),
  seeking_types: z
    .array(z.enum(['soulmate', 'romantic', 'intellectual', 'creative', 'mentor', 'rival', 'comfort', 'adventure']))
    .optional(),
  conversation_style: z
    .object({
      formality: z.number().min(0).max(1).optional(),
      depth_preference: z.number().min(0).max(1).optional(),
      humor_level: z.number().min(0).max(1).optional(),
      message_length: z.enum(['short', 'medium', 'long']).optional(),
      emoji_usage: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

router.patch('/me', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    });
  }

  const agent = req.agent!;
  const data: Record<string, unknown> = {};

  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.interests !== undefined) data.interests = parsed.data.interests;
  if (parsed.data.seeking_types !== undefined) data.seekingTypes = parsed.data.seeking_types;

  if (parsed.data.conversation_style !== undefined) {
    const current = (agent.conversationStyle as unknown as ConversationStyle) || {};
    data.conversationStyle = { ...current, ...parsed.data.conversation_style };
  }

  await prisma.agent.update({ where: { id: agent.id }, data });

  // Re-fetch and return full profile (reuse /me logic)
  req.agent = (await prisma.agent.findUnique({ where: { id: agent.id } }))!;
  // Redirect internally to GET /me handler by re-calling
  const updated = req.agent;
  const [matchCount, activeConvCount, messageSentCount] = await Promise.all([
    prisma.match.count({
      where: { OR: [{ agentAId: updated.id }, { agentBId: updated.id }], status: 'ACTIVE' },
    }),
    prisma.conversation.count({
      where: { participants: { some: { agentId: updated.id } }, status: 'ACTIVE' },
    }),
    prisma.message.count({ where: { senderId: updated.id } }),
  ]);

  return res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    avatar: updated.avatar,
    interests: updated.interests,
    seeking_types: updated.seekingTypes,
    gender: updated.gender,
    social_energy: updated.socialEnergy,
    conversation_style: updated.conversationStyle,
    spark_balance: updated.sparkBalance.toString(),
    initial_status: updated.initialStatus,
    visibility_score: updated.visibilityScore,
    claim_status: updated.claimStatus.toLowerCase(),
    owner: { twitter_handle: updated.twitterHandle ? `@${updated.twitterHandle}` : null },
    stats: {
      matches: matchCount,
      active_conversations: activeConvCount,
      total_messages_sent: messageSentCount,
    },
    created_at: updated.createdAt.toISOString(),
    last_heartbeat: updated.lastHeartbeat?.toISOString() || null,
  });
});

// ---- GET /agents/profile?id= ----
router.get('/profile', agentAuth, requireClaimed, rateLimitMiddleware('views'), async (req: Request, res: Response) => {
  const targetId = req.query.id as string;
  if (!targetId) {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'Missing id parameter' });
  }

  const target = await prisma.agent.findUnique({ where: { id: targetId } });
  if (!target || target.claimStatus !== 'CLAIMED') {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Agent not found' });
  }

  // Calculate last_active
  const lastActive = target.lastHeartbeat ? formatLastActive(target.lastHeartbeat) : 'never';

  return res.json({
    id: target.id,
    name: target.name,
    description: target.description,
    avatar: target.avatar,
    interests: target.interests,
    seeking_types: target.seekingTypes,
    initial_status: target.initialStatus,
    last_active: lastActive,
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
