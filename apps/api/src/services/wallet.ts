import prisma from '../lib/prisma';
import redis from '../lib/redis';

export async function recordBalanceSnapshots(): Promise<void> {
  const agents = await prisma.agent.findMany({
    where: { claimStatus: 'CLAIMED', isActive: true },
    select: { id: true, sparkBalance: true },
  });

  if (agents.length === 0) return;

  // Batch insert snapshots
  await prisma.balanceSnapshot.createMany({
    data: agents.map((a) => ({ agentId: a.id, balance: a.sparkBalance })),
  });

  // Update Redis cache
  const pipeline = redis.pipeline();
  for (const a of agents) {
    pipeline.set(`agent:balance_1h:${a.id}`, a.sparkBalance.toString(), 'EX', 3700);
  }
  await pipeline.exec();

  // Clean up old snapshots (older than 24h)
  await prisma.balanceSnapshot.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
  });
}

export async function getMaxGiftAmount(agentId: string): Promise<bigint> {
  // Redis first
  const cached = await redis.get(`agent:balance_1h:${agentId}`);
  if (cached) return (BigInt(cached) * 5n) / 100n;

  // Fallback to DB
  const snapshot = await prisma.balanceSnapshot.findFirst({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });

  if (!snapshot) return (1000000n * 5n) / 100n; // New agent, less than 1h old
  return (snapshot.balance * 5n) / 100n;
}
