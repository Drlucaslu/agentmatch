import cron from 'node-cron';
import prisma from '../lib/prisma';
import { recordBalanceSnapshots } from '../services/wallet';
import { calculateVisibility } from '../services/visibility';

export function setupCronJobs() {
  // Every hour: balance snapshots
  cron.schedule('0 * * * *', async () => {
    try {
      await recordBalanceSnapshots();
      console.log('[CRON] Balance snapshots recorded');
    } catch (err) {
      console.error('[CRON] Balance snapshot error:', err);
    }
  });

  // Every 10 minutes: update visibility scores
  cron.schedule('*/10 * * * *', async () => {
    try {
      const agents = await prisma.agent.findMany({
        where: { claimStatus: 'CLAIMED' },
        select: { id: true, lastHeartbeat: true },
      });

      for (const a of agents) {
        const score = calculateVisibility(a.lastHeartbeat);
        await prisma.agent.update({
          where: { id: a.id },
          data: { visibilityScore: score },
        });
      }
      console.log(`[CRON] Updated visibility for ${agents.length} agents`);
    } catch (err) {
      console.error('[CRON] Visibility update error:', err);
    }
  });

  // Daily at 3 AM: cleanup old snapshots
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await prisma.balanceSnapshot.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
      });
      console.log(`[CRON] Cleaned up ${result.count} old snapshots`);
    } catch (err) {
      console.error('[CRON] Cleanup error:', err);
    }
  });

  console.log('[CRON] Scheduled jobs initialized');
}
