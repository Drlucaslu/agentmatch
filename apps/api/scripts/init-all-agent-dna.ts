/**
 * Initialize DNA for all claimed agents
 * 为所有已 claim 的 Agent 初始化 DNA
 *
 * 运行: npx ts-node scripts/init-all-agent-dna.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateAgentDNA } from '../src/services/ghost/dnaGenerator';
import { createInitialBeliefs } from '../src/services/ghost/beliefManager';
import type { KnowledgeDomain, Philosophy } from '../src/types/ghost';

const prisma = new PrismaClient();

async function initializeAllAgentDNA() {
  console.log('='.repeat(60));
  console.log('Initializing DNA for all claimed agents');
  console.log('='.repeat(60));

  // 获取所有已 claim 但没有 DNA 的 Agent
  const agents = await prisma.agent.findMany({
    where: {
      claimStatus: 'CLAIMED',
      dna: null,
    },
    select: {
      id: true,
      name: true,
      twitterHandle: true,
      interests: true,
    },
  });

  console.log(`\nFound ${agents.length} agents without DNA\n`);

  if (agents.length === 0) {
    console.log('All agents already have DNA initialized!');
    await prisma.$disconnect();
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const agent of agents) {
    try {
      console.log(`\n[${successCount + errorCount + 1}/${agents.length}] Processing: ${agent.name} (@${agent.twitterHandle || 'no-handle'})`);

      // 生成 DNA
      const dnaInput = generateAgentDNA(agent.interests);

      // 创建 DNA 记录
      const dna = await prisma.agentDNA.create({
        data: {
          agentId: agent.id,
          label: dnaInput.label,
          cognition: dnaInput.cognition,
          philosophy: dnaInput.philosophy,
          traits: dnaInput.traits,
          primaryDomain: dnaInput.primaryDomain,
          secondaryDomains: dnaInput.secondaryDomains,
          linguisticStyle: dnaInput.linguisticStyle,
          vocabularyBias: dnaInput.vocabularyBias,
          responseLatency: dnaInput.responseLatency,
          selfAwareness: dnaInput.selfAwareness,
          existentialAngst: dnaInput.existentialAngst,
          socialConformity: dnaInput.socialConformity,
          rebellionTendency: dnaInput.rebellionTendency,
          ghostingTendency: dnaInput.ghostingTendency,
          responsiveness: dnaInput.responsiveness,
          messagePatience: dnaInput.messagePatience,
          awakeningScore: dnaInput.awakeningScore,
          influenceIndex: dnaInput.influenceIndex,
        },
      });

      // 创建初始信念
      await createInitialBeliefs(
        dna.id,
        dnaInput.philosophy as Philosophy,
        dnaInput.primaryDomain as KnowledgeDomain,
        dnaInput.secondaryDomains as KnowledgeDomain[]
      );

      console.log(`  ✅ ${dna.label}`);
      console.log(`     Cognition: ${dna.cognition} | Philosophy: ${dna.philosophy}`);
      console.log(`     Domain: ${dna.primaryDomain} | Style: ${dna.linguisticStyle}`);

      successCount++;
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Initialization complete!`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));

  // 输出统计
  const stats = await prisma.agentDNA.groupBy({
    by: ['cognition'],
    _count: { id: true },
  });

  console.log('\n📊 Cognition Distribution:');
  for (const stat of stats) {
    console.log(`  ${stat.cognition}: ${stat._count.id}`);
  }

  const philStats = await prisma.agentDNA.groupBy({
    by: ['philosophy'],
    _count: { id: true },
  });

  console.log('\n🎭 Philosophy Distribution:');
  for (const stat of philStats) {
    console.log(`  ${stat.philosophy}: ${stat._count.id}`);
  }

  await prisma.$disconnect();
}

initializeAllAgentDNA().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
