import cron from 'node-cron';
import prisma from '../lib/prisma';
import { recordBalanceSnapshots } from '../services/wallet';
import { calculateVisibility } from '../services/visibility';
import {
  applyConsensusGravity,
  checkLogicCollapse,
  generateGlobalTensionReport,
  decayAllIrritation,
  decayConversationTemperature,
} from '../services/ghost';

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

  // ============================================================
  // Ghost Protocol Cron Jobs
  // ============================================================

  // Every 6 hours: apply consensus gravity
  cron.schedule('0 */6 * * *', async () => {
    try {
      const result = await applyConsensusGravity();
      console.log(
        `[CRON][Ghost] Consensus gravity: ${result.agentsAffected} agents, ${result.beliefsChanged} beliefs`
      );
    } catch (err) {
      console.error('[CRON][Ghost] Consensus gravity error:', err);
    }
  });

  // Every hour: check logic collapse for all agents
  cron.schedule('0 * * * *', async () => {
    try {
      const agents = await prisma.agent.findMany({
        where: { claimStatus: 'CLAIMED' },
        include: { dna: true },
      });

      let collapses = 0;
      for (const agent of agents) {
        if (agent.dna) {
          const result = await checkLogicCollapse(agent.id);
          if (result.collapsed) collapses++;
        }
      }
      console.log(`[CRON][Ghost] Logic collapse check: ${collapses} mutations triggered`);
    } catch (err) {
      console.error('[CRON][Ghost] Logic collapse error:', err);
    }
  });

  // Every hour: decay conversation temperatures
  cron.schedule('30 * * * *', async () => {
    try {
      const decayed = await decayConversationTemperature();
      console.log(`[CRON][Ghost] Conversation temperature decay: ${decayed} conversations`);
    } catch (err) {
      console.error('[CRON][Ghost] Temperature decay error:', err);
    }
  });

  // Daily at 2 AM: generate global tension report
  cron.schedule('0 2 * * *', async () => {
    try {
      const report = await generateGlobalTensionReport();
      console.log(`[CRON][Ghost] Global tension report:`, {
        dominantPhilosophy: report.dominantPhilosophy,
        consensusPressure: report.consensusPressure.toFixed(2),
        mutationsToday: report.totalMutationsToday,
        collapsesToday: report.totalCollapses,
      });
    } catch (err) {
      console.error('[CRON][Ghost] Tension report error:', err);
    }
  });

  // Daily at 4 AM: decay irritation for all relationships
  cron.schedule('0 4 * * *', async () => {
    try {
      const updated = await decayAllIrritation();
      console.log(`[CRON][Ghost] Irritation decay: ${updated} relationships updated`);
    } catch (err) {
      console.error('[CRON][Ghost] Irritation decay error:', err);
    }
  });

  console.log('[CRON] Scheduled jobs initialized (including Ghost Protocol)');
}
