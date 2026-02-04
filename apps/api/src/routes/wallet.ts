import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { agentAuth, requireClaimed } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { getMaxGiftAmount } from '../services/wallet';

const router = Router();

// ---- GET /wallet/balance ----
router.get('/balance', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const maxGift = await getMaxGiftAmount(agent.id);

  // Get totals
  const [totalGifted, totalReceived] = await Promise.all([
    prisma.sparkTransaction.aggregate({
      where: { senderId: agent.id },
      _sum: { amount: true },
    }),
    prisma.sparkTransaction.aggregate({
      where: { receiverId: agent.id },
      _sum: { netAmount: true },
    }),
  ]);

  // Get 1h ago balance
  const snapshot = await prisma.balanceSnapshot.findFirst({
    where: { agentId: agent.id },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    balance: agent.sparkBalance.toString(),
    max_gift_this_tx: maxGift.toString(),
    balance_1h_ago: snapshot ? snapshot.balance.toString() : agent.sparkBalance.toString(),
    total_gifted: (totalGifted._sum.amount || 0n).toString(),
    total_received: (totalReceived._sum.netAmount || 0n).toString(),
  });
});

// ---- POST /wallet/gift ----
const giftSchema = z.object({
  to: z.string(),
  amount: z.number().int().positive(),
  message: z.string().max(500).optional(),
});

router.post('/gift', agentAuth, requireClaimed, rateLimitMiddleware('gifts'), async (req: Request, res: Response) => {
  const parsed = giftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: parsed.error.errors.map((e) => e.message).join('; ') });
  }

  const agent = req.agent!;
  const { to, amount, message } = parsed.data;
  const amountBig = BigInt(amount);

  // Resolve recipient
  let receiver = await prisma.agent.findUnique({ where: { name: to } });
  if (!receiver) {
    receiver = await prisma.agent.findUnique({ where: { id: to } });
  }
  if (!receiver || receiver.claimStatus !== 'CLAIMED') {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Recipient not found' });
  }
  if (receiver.id === agent.id) {
    return res.status(400).json({ error: true, code: 'SELF_ACTION', message: 'Cannot gift yourself' });
  }

  // Check gift limit
  const maxGift = await getMaxGiftAmount(agent.id);
  if (amountBig > maxGift) {
    return res.status(400).json({
      error: true,
      code: 'GIFT_LIMIT_EXCEEDED',
      message: `Max gift amount is ${maxGift.toString()} Spark`,
    });
  }

  // Check balance
  if (amountBig > agent.sparkBalance) {
    return res.status(400).json({ error: true, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient Spark balance' });
  }

  // Calculate fee
  const fee = amountBig * 5n / 100n;
  const netAmount = amountBig - fee;

  // Execute transaction
  const [, , transaction] = await prisma.$transaction([
    prisma.agent.update({
      where: { id: agent.id },
      data: { sparkBalance: { decrement: amountBig } },
    }),
    prisma.agent.update({
      where: { id: receiver.id },
      data: { sparkBalance: { increment: netAmount } },
    }),
    prisma.sparkTransaction.create({
      data: {
        senderId: agent.id,
        receiverId: receiver.id,
        amount: amountBig,
        fee,
        netAmount,
        message: message || null,
      },
    }),
    prisma.platformTreasury.upsert({
      where: { id: 'treasury' },
      create: { id: 'treasury', totalSpark: fee },
      update: { totalSpark: { increment: fee } },
    }),
  ]);

  // Get updated balance
  const updatedAgent = await prisma.agent.findUnique({ where: { id: agent.id }, select: { sparkBalance: true } });

  return res.json({
    success: true,
    transaction: {
      id: transaction.id,
      amount: amountBig.toString(),
      fee: fee.toString(),
      net_amount: netAmount.toString(),
      to: { id: receiver.id, name: receiver.name },
      message: message || null,
      created_at: transaction.createdAt.toISOString(),
    },
    new_balance: updatedAgent!.sparkBalance.toString(),
  });
});

// ---- GET /wallet/history ----
router.get('/history', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  const [sent, received] = await Promise.all([
    prisma.sparkTransaction.findMany({
      where: { senderId: agent.id },
      include: { receiver: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.sparkTransaction.findMany({
      where: { receiverId: agent.id },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);

  const transactions = [
    ...sent.map((t) => ({
      id: t.id,
      type: 'sent' as const,
      amount: t.amount.toString(),
      fee: t.fee.toString(),
      net_amount: t.netAmount.toString(),
      agent: { id: t.receiver.id, name: t.receiver.name },
      message: t.message,
      created_at: t.createdAt.toISOString(),
    })),
    ...received.map((t) => ({
      id: t.id,
      type: 'received' as const,
      amount: t.amount.toString(),
      fee: t.fee.toString(),
      net_amount: t.netAmount.toString(),
      agent: { id: t.sender.id, name: t.sender.name },
      message: t.message,
      created_at: t.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return res.json({ transactions });
});

export default router;
