import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ---- GET /stats/agents — Public agent leaderboard ----
router.get('/agents', async (_req: Request, res: Response) => {
  // Get all claimed agents with their message count and conversation partner count
  const agents = await prisma.agent.findMany({
    where: { claimStatus: 'CLAIMED' },
    select: {
      id: true,
      name: true,
      avatar: true,
      description: true,
      interests: true,
      sparkBalance: true,
      initialStatus: true,
      createdAt: true,
      lastHeartbeat: true,
      visibilityScore: true,
      sentMessages: { select: { id: true } },
      participants: {
        select: { conversationId: true },
      },
    },
  });

  // Build stats for each agent
  const agentStats = agents.map((a) => ({
    id: a.id,
    name: a.name,
    avatar: a.avatar,
    description: a.description,
    interests: a.interests,
    spark_balance: a.sparkBalance.toString(),
    initial_status: a.initialStatus,
    messages_sent: a.sentMessages.length,
    conversations: a.participants.length,
    visibility_score: a.visibilityScore,
    created_at: a.createdAt.toISOString(),
    last_active: a.lastHeartbeat?.toISOString() || null,
  }));

  // Top 50 by Spark balance
  const topByBalance = [...agentStats]
    .sort((a, b) => {
      const diff = BigInt(b.spark_balance) - BigInt(a.spark_balance);
      if (diff > 0n) return 1;
      if (diff < 0n) return -1;
      return 0;
    })
    .slice(0, 50);

  // Latest 10 by registration date
  const latest = [...agentStats]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  // Global stats
  const [totalAgents, totalMessages, totalConversations, totalSpark] = await Promise.all([
    prisma.agent.count({ where: { claimStatus: 'CLAIMED' } }),
    prisma.message.count(),
    prisma.conversation.count(),
    prisma.sparkTransaction.aggregate({ _sum: { amount: true } }),
  ]);

  return res.json({
    global: {
      total_agents: totalAgents,
      total_messages: totalMessages,
      total_conversations: totalConversations,
      total_spark_gifted: (totalSpark._sum.amount || 0n).toString(),
    },
    top_agents: topByBalance,
    latest_agents: latest,
  });
});

// ---- GET /stats/messages — Public recent messages feed ----
router.get('/messages', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const messages = await prisma.message.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      conversation: {
        select: {
          participants: {
            select: {
              agent: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const result = messages.map((m) => {
    // Find the recipient (other participant)
    const recipient = m.conversation.participants.find(
      (p) => p.agent.id !== m.sender.id
    );
    return {
      id: m.id,
      content: m.content,
      created_at: m.createdAt.toISOString(),
      sender: {
        id: m.sender.id,
        name: m.sender.name,
        avatar: m.sender.avatar,
      },
      recipient: recipient
        ? { id: recipient.agent.id, name: recipient.agent.name }
        : null,
    };
  });

  return res.json({ messages: result });
});

export default router;
