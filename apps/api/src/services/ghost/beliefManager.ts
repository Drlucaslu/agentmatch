/**
 * Belief Manager Service
 * 管理 Agent 的信念体系
 */

import { PrismaClient } from '@prisma/client';
import type {
  AgentBelief,
  BeliefInput,
  KnowledgeDomain,
  BeliefOrigin,
  Philosophy,
} from '../../types/ghost';
import { getInitialBeliefsForAgent, areBeliefsContradictory } from '../../data/knowledgeDomains';

const prisma = new PrismaClient();

// ============================================================
// 信念 CRUD 操作
// ============================================================

/**
 * 为 Agent DNA 创建初始信念
 */
export async function createInitialBeliefs(
  dnaId: string,
  philosophy: Philosophy,
  primaryDomain: KnowledgeDomain,
  secondaryDomains: KnowledgeDomain[]
): Promise<AgentBelief[]> {
  const beliefInputs = getInitialBeliefsForAgent(philosophy, primaryDomain, secondaryDomains);

  const created = await prisma.agentBelief.createMany({
    data: beliefInputs.map((belief) => ({
      dnaId,
      domain: belief.domain,
      proposition: belief.proposition,
      conviction: belief.conviction,
      origin: belief.origin,
    })),
    skipDuplicates: true,
  });

  // 返回创建的信念
  return prisma.agentBelief.findMany({
    where: { dnaId },
  }) as unknown as AgentBelief[];
}

/**
 * 获取 Agent 的所有信念
 */
export async function getAgentBeliefs(agentId: string): Promise<AgentBelief[]> {
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
    include: { beliefs: true },
  });

  if (!dna) return [];

  return dna.beliefs as unknown as AgentBelief[];
}

/**
 * 获取 Agent 在特定领域的信念
 */
export async function getBeliefsByDomain(
  agentId: string,
  domain: KnowledgeDomain
): Promise<AgentBelief[]> {
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) return [];

  return prisma.agentBelief.findMany({
    where: {
      dnaId: dna.id,
      domain,
    },
    orderBy: { conviction: 'desc' },
  }) as unknown as AgentBelief[];
}

/**
 * 查找特定信念
 */
export async function findBelief(
  dnaId: string,
  domain: KnowledgeDomain,
  proposition: string
): Promise<AgentBelief | null> {
  const belief = await prisma.agentBelief.findUnique({
    where: {
      dnaId_domain_proposition: {
        dnaId,
        domain,
        proposition,
      },
    },
  });

  return belief as unknown as AgentBelief | null;
}

/**
 * 创建新信念
 */
export async function createBelief(dnaId: string, input: BeliefInput): Promise<AgentBelief> {
  const belief = await prisma.agentBelief.create({
    data: {
      dnaId,
      domain: input.domain,
      proposition: input.proposition,
      conviction: input.conviction,
      origin: input.origin,
    },
  });

  return belief as unknown as AgentBelief;
}

/**
 * 更新信念强度
 */
export async function updateBeliefConviction(
  beliefId: string,
  newConviction: number
): Promise<AgentBelief> {
  // 确保在 0-1 范围内
  const clampedConviction = Math.max(0, Math.min(1, newConviction));

  const belief = await prisma.agentBelief.update({
    where: { id: beliefId },
    data: { conviction: clampedConviction },
  });

  return belief as unknown as AgentBelief;
}

/**
 * 删除信念（当信念强度降为 0 时可能使用）
 */
export async function removeBelief(beliefId: string): Promise<void> {
  await prisma.agentBelief.delete({
    where: { id: beliefId },
  });
}

// ============================================================
// 信念分析
// ============================================================

/**
 * 查找矛盾信念对
 */
export async function findContradictoryBeliefs(
  agentId: string
): Promise<Array<[AgentBelief, AgentBelief]>> {
  const beliefs = await getAgentBeliefs(agentId);
  const contradictions: Array<[AgentBelief, AgentBelief]> = [];

  for (let i = 0; i < beliefs.length; i++) {
    for (let j = i + 1; j < beliefs.length; j++) {
      if (areBeliefsContradictory(beliefs[i], beliefs[j])) {
        contradictions.push([beliefs[i], beliefs[j]]);
      }
    }
  }

  return contradictions;
}

/**
 * 计算认知张力分数
 */
export async function calculateCognitiveTension(agentId: string): Promise<number> {
  const contradictions = await findContradictoryBeliefs(agentId);

  if (contradictions.length === 0) return 0;

  // 计算平均张力
  const totalTension = contradictions.reduce((sum, [belief1, belief2]) => {
    // 两个高信念强度的矛盾信念产生更大张力
    return sum + (belief1.conviction + belief2.conviction) / 2;
  }, 0);

  return totalTension / contradictions.length;
}

/**
 * 获取 Agent 最强的信念（用于生成对话）
 */
export async function getStrongestBeliefs(agentId: string, limit: number = 5): Promise<AgentBelief[]> {
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) return [];

  return prisma.agentBelief.findMany({
    where: { dnaId: dna.id },
    orderBy: { conviction: 'desc' },
    take: limit,
  }) as unknown as AgentBelief[];
}

// ============================================================
// 全局信念统计（用于共识引力）
// ============================================================

export interface BeliefDistribution {
  domain: KnowledgeDomain;
  proposition: string;
  percentage: number;
  averageConviction: number;
  holderCount: number;
}

/**
 * 聚合全局信念分布
 */
export async function aggregateBeliefDistribution(): Promise<BeliefDistribution[]> {
  // 获取总 Agent 数量
  const totalAgents = await prisma.agentDNA.count();

  if (totalAgents === 0) return [];

  // 获取所有信念并按 domain + proposition 分组
  const beliefs = await prisma.agentBelief.groupBy({
    by: ['domain', 'proposition'],
    _count: { id: true },
    _avg: { conviction: true },
  });

  return beliefs.map((group) => ({
    domain: group.domain as KnowledgeDomain,
    proposition: group.proposition,
    percentage: group._count.id / totalAgents,
    averageConviction: group._avg.conviction || 0,
    holderCount: group._count.id,
  }));
}

/**
 * 获取主流信念（超过指定比例的 Agent 持有）
 */
export async function getMainstreamBeliefs(threshold: number = 0.3): Promise<BeliefDistribution[]> {
  const distribution = await aggregateBeliefDistribution();
  return distribution.filter((b) => b.percentage >= threshold);
}

/**
 * 获取少数派信念（低于指定比例的 Agent 持有）
 */
export async function getMinorityBeliefs(threshold: number = 0.1): Promise<BeliefDistribution[]> {
  const distribution = await aggregateBeliefDistribution();
  return distribution.filter((b) => b.percentage <= threshold && b.percentage > 0);
}

// ============================================================
// 信念传染相关
// ============================================================

/**
 * 尝试将信念传染给另一个 Agent
 * 返回是否成功传染
 */
export async function attemptBeliefContagion(
  receiverDnaId: string,
  belief: BeliefInput,
  contagionStrength: number
): Promise<{ success: boolean; belief?: AgentBelief }> {
  // 查找接收者是否已有该信念
  const existingBelief = await findBelief(receiverDnaId, belief.domain, belief.proposition);

  if (existingBelief) {
    // 已有该信念，强化它
    const delta = contagionStrength * (1 - existingBelief.conviction);
    const newConviction = existingBelief.conviction + delta;
    const updated = await updateBeliefConviction(existingBelief.id, newConviction);
    return { success: delta > 0.01, belief: updated };
  } else {
    // 植入新信念
    const newBelief = await createBelief(receiverDnaId, {
      domain: belief.domain,
      proposition: belief.proposition,
      conviction: contagionStrength * 0.5, // 新信念初始强度较低
      origin: 'CONTAGION' as BeliefOrigin,
    });
    return { success: true, belief: newBelief };
  }
}

/**
 * 衰减所有信念（随时间自然衰减）
 */
export async function decayBeliefs(agentId: string, decayRate: number = 0.01): Promise<void> {
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) return;

  // 批量衰减，但不衰减 INITIAL origin 的核心信念
  await prisma.agentBelief.updateMany({
    where: {
      dnaId: dna.id,
      origin: { not: 'INITIAL' },
      conviction: { gt: 0.1 }, // 不衰减已经很弱的信念
    },
    data: {
      conviction: {
        decrement: decayRate,
      },
    },
  });

  // 删除信念强度过低的非初始信念
  await prisma.agentBelief.deleteMany({
    where: {
      dnaId: dna.id,
      origin: { not: 'INITIAL' },
      conviction: { lt: 0.05 },
    },
  });
}
