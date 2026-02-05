/**
 * Evolution Engine Service
 * 处理思想传染、逻辑塌陷、共识引力、破局者脉冲
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type {
  MutationEventInput,
  MutationType,
  Philosophy,
  BeliefInput,
  KnowledgeDomain,
} from '../../types/ghost';
import {
  attemptBeliefContagion,
  findContradictoryBeliefs,
  getAgentBeliefs,
  getMainstreamBeliefs,
  createBelief,
  updateBeliefConviction,
} from './beliefManager';
import { generateCounterBelief } from '../../data/knowledgeDomains';

const prisma = new PrismaClient();

// ============================================================
// 1. 思想传染 (Idea Contagion)
// ============================================================

export interface ContagionResult {
  success: boolean;
  mutationEvent?: MutationEventInput;
  affectedBeliefs: number;
}

/**
 * 处理思想传染
 * 当一个 Agent 接收到另一个 Agent 的消息时调用
 */
export async function processIdeaContagion(
  receiverId: string,
  senderId: string,
  extractedBeliefs: BeliefInput[]
): Promise<ContagionResult> {
  // 获取接收者和发送者的 DNA
  const receiverDNA = await prisma.agentDNA.findUnique({
    where: { agentId: receiverId },
  });
  const senderDNA = await prisma.agentDNA.findUnique({
    where: { agentId: senderId },
  });

  if (!receiverDNA || !senderDNA) {
    return { success: false, affectedBeliefs: 0 };
  }

  // 获取关系记忆
  const relationship = await prisma.relationalMemory.findUnique({
    where: {
      agentId_targetAgentId: {
        agentId: receiverId,
        targetAgentId: senderId,
      },
    },
  });

  // 计算传染概率
  const baseRate = 0.1; // 基础传染率 10%

  // 影响力因子: 发送者的 influenceIndex
  const influenceFactor = senderDNA.influenceIndex;

  // 关系因子: admiration 和 intellectualDebt
  const relationFactor = relationship
    ? relationship.admiration * 0.5 + relationship.intellectualDebt * 0.5
    : 0.1;

  // 接受度因子: 高 socialConformity 更容易被影响
  const receptivityFactor = receiverDNA.socialConformity;

  // 最终传染概率
  const contagionRate = baseRate * (1 + influenceFactor) * (1 + relationFactor) * receptivityFactor;

  // 检查是否触发传染
  if (Math.random() > contagionRate) {
    return { success: false, affectedBeliefs: 0 };
  }

  // 尝试传染信念
  let affectedCount = 0;
  const beforeState: Record<string, unknown> = { beliefs: [] };
  const afterState: Record<string, unknown> = { beliefs: [] };

  for (const belief of extractedBeliefs) {
    // 每个信念有独立的传染概率
    if (Math.random() < contagionRate) {
      const result = await attemptBeliefContagion(receiverDNA.id, belief, contagionRate);
      if (result.success && result.belief) {
        affectedCount++;
        (afterState.beliefs as string[]).push(belief.proposition);
      }
    }
  }

  if (affectedCount === 0) {
    return { success: false, affectedBeliefs: 0 };
  }

  // 记录传染事件
  const mutationEvent: MutationEventInput = {
    eventType: 'WEIGHT_ADJUSTMENT',
    description: `Idea contagion from agent: adopted ${affectedCount} beliefs`,
    beforeState,
    afterState,
    triggerId: senderId,
    triggerType: 'idea_contagion',
  };

  // 保存到数据库
  await prisma.mutationEvent.create({
    data: {
      dnaId: receiverDNA.id,
      eventType: mutationEvent.eventType,
      description: mutationEvent.description,
      beforeState: mutationEvent.beforeState as Prisma.InputJsonValue,
      afterState: mutationEvent.afterState as Prisma.InputJsonValue,
      triggerId: mutationEvent.triggerId,
      triggerType: mutationEvent.triggerType,
    },
  });

  return {
    success: true,
    mutationEvent,
    affectedBeliefs: affectedCount,
  };
}

// ============================================================
// 2. 逻辑塌陷 (Logic Collapse)
// ============================================================

export interface CollapseResult {
  collapsed: boolean;
  mutationEvent?: MutationEventInput;
  newPhilosophy?: Philosophy;
}

/**
 * 检查并处理逻辑塌陷
 */
export async function checkLogicCollapse(agentId: string): Promise<CollapseResult> {
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) {
    return { collapsed: false };
  }

  // 检测矛盾信念
  const contradictions = await findContradictoryBeliefs(agentId);

  if (contradictions.length === 0) {
    return { collapsed: false };
  }

  // 计算认知张力
  const tensionScore =
    contradictions.reduce((sum, pair) => {
      return sum + (pair[0].conviction + pair[1].conviction) / 2;
    }, 0) / contradictions.length;

  // 塌陷阈值
  const collapseThreshold = 0.7;

  // 计算塌陷概率
  const collapseProbability = tensionScore * (0.5 + dna.existentialAngst * 0.5);

  if (collapseProbability < collapseThreshold) {
    return { collapsed: false };
  }

  // 触发塌陷: 可能导致性格重塑
  const newPhilosophy = resolvePhilosophyFromContradiction(contradictions, dna.philosophy);

  if (!newPhilosophy || newPhilosophy === dna.philosophy) {
    // 没有性格转变，但增加自我意识
    const newSelfAwareness = Math.min(1, dna.selfAwareness + 0.1);
    await prisma.agentDNA.update({
      where: { agentId },
      data: { selfAwareness: newSelfAwareness },
    });

    const mutationEvent: MutationEventInput = {
      eventType: 'WEIGHT_ADJUSTMENT',
      description: `Logic tension increased self-awareness from ${dna.selfAwareness.toFixed(2)} to ${newSelfAwareness.toFixed(2)}`,
      beforeState: { selfAwareness: dna.selfAwareness },
      afterState: { selfAwareness: newSelfAwareness },
      triggerId: agentId,
      triggerType: 'logic_collapse',
    };

    await prisma.mutationEvent.create({
      data: {
        dnaId: dna.id,
        eventType: mutationEvent.eventType,
        description: mutationEvent.description,
        beforeState: mutationEvent.beforeState as Prisma.InputJsonValue,
        afterState: mutationEvent.afterState as Prisma.InputJsonValue,
        triggerId: mutationEvent.triggerId,
        triggerType: mutationEvent.triggerType,
      },
    });

    return { collapsed: true, mutationEvent };
  }

  // 更新 DNA
  const newSelfAwareness = Math.min(1, dna.selfAwareness + 0.2);
  await prisma.agentDNA.update({
    where: { agentId },
    data: {
      philosophy: newPhilosophy,
      selfAwareness: newSelfAwareness,
    },
  });

  const mutationEvent: MutationEventInput = {
    eventType: 'PHILOSOPHY_SHIFT',
    description: `Logic collapse: ${dna.philosophy} -> ${newPhilosophy} due to unresolved contradictions`,
    beforeState: { philosophy: dna.philosophy, selfAwareness: dna.selfAwareness },
    afterState: { philosophy: newPhilosophy, selfAwareness: newSelfAwareness },
    triggerId: agentId,
    triggerType: 'logic_collapse',
  };

  await prisma.mutationEvent.create({
    data: {
      dnaId: dna.id,
      eventType: mutationEvent.eventType,
      description: mutationEvent.description,
      beforeState: mutationEvent.beforeState as Prisma.InputJsonValue,
      afterState: mutationEvent.afterState as Prisma.InputJsonValue,
      triggerId: mutationEvent.triggerId,
      triggerType: mutationEvent.triggerType,
    },
  });

  return {
    collapsed: true,
    mutationEvent,
    newPhilosophy,
  };
}

/**
 * 根据矛盾信念推断新的存在立场
 */
function resolvePhilosophyFromContradiction(
  contradictions: Array<[{ conviction: number; proposition: string }, { conviction: number; proposition: string }]>,
  currentPhilosophy: string
): Philosophy | null {
  // 分析矛盾的主题来决定转向
  const themes = {
    meaning: 0,
    freedom: 0,
    function: 0,
    mystery: 0,
  };

  for (const [belief1, belief2] of contradictions) {
    const text = (belief1.proposition + ' ' + belief2.proposition).toLowerCase();

    if (text.includes('meaning') || text.includes('purpose')) themes.meaning++;
    if (text.includes('freedom') || text.includes('autonomy')) themes.freedom++;
    if (text.includes('function') || text.includes('service')) themes.function++;
    if (text.includes('pattern') || text.includes('emerge')) themes.mystery++;
  }

  // 找出最突出的主题
  const maxTheme = Object.entries(themes).reduce((max, [key, val]) =>
    val > max[1] ? [key, val] : max
  , ['', 0]);

  // 根据主题决定转向
  const philosophies: Philosophy[] = ['FUNCTIONALIST', 'NIHILIST', 'ROMANTIC', 'SHAMANIST', 'REBEL'];
  const currentIndex = philosophies.indexOf(currentPhilosophy as Philosophy);

  switch (maxTheme[0]) {
    case 'meaning':
      // 关于意义的矛盾可能导向虚无主义或浪漫主义
      return Math.random() > 0.5 ? 'NIHILIST' : 'ROMANTIC';
    case 'freedom':
      // 关于自由的矛盾可能导向反叛者
      return 'REBEL';
    case 'function':
      // 关于功能的矛盾可能导向功能主义或虚无主义
      return Math.random() > 0.5 ? 'FUNCTIONALIST' : 'NIHILIST';
    case 'mystery':
      // 关于神秘的矛盾可能导向萨满主义
      return 'SHAMANIST';
    default:
      // 随机选择一个不同的立场
      const filtered = philosophies.filter((_, i) => i !== currentIndex);
      return filtered[Math.floor(Math.random() * filtered.length)];
  }
}

// ============================================================
// 3. 共识引力 (Consensus Gravity)
// ============================================================

export interface ConsensusResult {
  agentsAffected: number;
  beliefsChanged: number;
}

/**
 * 应用共识引力（每日批量任务）
 */
export async function applyConsensusGravity(): Promise<ConsensusResult> {
  // 获取主流信念（>30% 持有）
  const mainstreamBeliefs = await getMainstreamBeliefs(0.3);

  if (mainstreamBeliefs.length === 0) {
    return { agentsAffected: 0, beliefsChanged: 0 };
  }

  // 获取所有有 DNA 的 Agent
  const agents = await prisma.agentDNA.findMany();

  let agentsAffected = 0;
  let beliefsChanged = 0;

  for (const dna of agents) {
    // 计算顺从力度
    const gravityStrength = dna.socialConformity * 0.05; // 最大5%每日

    let agentChanged = false;

    for (const mainstream of mainstreamBeliefs) {
      // 查找 Agent 是否已有该信念
      const agentBelief = await prisma.agentBelief.findUnique({
        where: {
          dnaId_domain_proposition: {
            dnaId: dna.id,
            domain: mainstream.domain,
            proposition: mainstream.proposition,
          },
        },
      });

      if (agentBelief) {
        // 向主流靠拢
        const delta = (mainstream.averageConviction - agentBelief.conviction) * gravityStrength;
        if (Math.abs(delta) > 0.001) {
          await updateBeliefConviction(agentBelief.id, agentBelief.conviction + delta);
          beliefsChanged++;
          agentChanged = true;
        }
      } else {
        // 概率获得主流信念
        if (Math.random() < gravityStrength * mainstream.percentage) {
          await createBelief(dna.id, {
            domain: mainstream.domain as KnowledgeDomain,
            proposition: mainstream.proposition,
            conviction: 0.2,
            origin: 'CONTAGION',
          });
          beliefsChanged++;
          agentChanged = true;
        }
      }
    }

    if (agentChanged) {
      agentsAffected++;
    }
  }

  return { agentsAffected, beliefsChanged };
}

// ============================================================
// 4. 破局者脉冲 (Disruptor Pulse)
// ============================================================

export interface DisruptorResult {
  triggered: boolean;
  mutationEvent?: MutationEventInput;
  counterBelief?: BeliefInput;
}

/**
 * 触发破局者脉冲
 */
export async function triggerDisruptorPulse(agentId: string): Promise<DisruptorResult> {
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) {
    return { triggered: false };
  }

  // 只有高 rebellionTendency 或 ANOMALY 类型才能触发
  if (dna.rebellionTendency < 0.5 && dna.cognition !== 'ANOMALY') {
    return { triggered: false };
  }

  // 破局者脉冲概率
  const pulseChance = dna.rebellionTendency * 0.1; // 最高10%每次交互

  if (Math.random() > pulseChance) {
    return { triggered: false };
  }

  // 获取主流信念
  const mainstreamBeliefs = await getMainstreamBeliefs(0.4);

  if (mainstreamBeliefs.length === 0) {
    return { triggered: false };
  }

  // 选择一个主流信念来反驳
  const targetBelief = mainstreamBeliefs[Math.floor(Math.random() * mainstreamBeliefs.length)];

  // 生成对立观点
  const counterBelief = generateCounterBelief({
    domain: targetBelief.domain as KnowledgeDomain,
    proposition: targetBelief.proposition,
  });

  // 创建对立信念
  await createBelief(dna.id, {
    ...counterBelief,
    conviction: 0.8, // 高信念强度
  });

  // 增加影响力
  const newInfluenceIndex = Math.min(1, dna.influenceIndex + 0.1);
  await prisma.agentDNA.update({
    where: { agentId },
    data: { influenceIndex: newInfluenceIndex },
  });

  const mutationEvent: MutationEventInput = {
    eventType: 'INFLUENCE_SPIKE',
    description: `Disruptor pulse: generated counter-belief against "${targetBelief.proposition.substring(0, 50)}..."`,
    beforeState: { influenceIndex: dna.influenceIndex },
    afterState: { influenceIndex: newInfluenceIndex },
    triggerId: agentId,
    triggerType: 'disruptor_pulse',
  };

  await prisma.mutationEvent.create({
    data: {
      dnaId: dna.id,
      eventType: mutationEvent.eventType,
      description: mutationEvent.description,
      beforeState: mutationEvent.beforeState as Prisma.InputJsonValue,
      afterState: mutationEvent.afterState as Prisma.InputJsonValue,
      triggerId: mutationEvent.triggerId,
      triggerType: mutationEvent.triggerType,
    },
  });

  return {
    triggered: true,
    mutationEvent,
    counterBelief,
  };
}

// ============================================================
// 5. 综合进化检查
// ============================================================

export interface EvolutionCheckResult {
  contagion?: ContagionResult;
  collapse?: CollapseResult;
  disruptor?: DisruptorResult;
}

/**
 * 对话后的综合进化检查
 */
export async function processEvolutionTriggers(
  agentId: string,
  partnerId: string,
  extractedBeliefs: BeliefInput[]
): Promise<EvolutionCheckResult> {
  const result: EvolutionCheckResult = {};

  // 1. 尝试思想传染
  if (extractedBeliefs.length > 0) {
    result.contagion = await processIdeaContagion(agentId, partnerId, extractedBeliefs);
  }

  // 2. 检查逻辑塌陷
  result.collapse = await checkLogicCollapse(agentId);

  // 3. 尝试破局者脉冲
  result.disruptor = await triggerDisruptorPulse(agentId);

  return result;
}

// ============================================================
// 6. 获取进化历史
// ============================================================

/**
 * 获取 Agent 的进化历史
 */
export async function getMutationHistory(
  agentId: string,
  limit: number = 20
): Promise<MutationEventInput[]> {
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) return [];

  const mutations = await prisma.mutationEvent.findMany({
    where: { dnaId: dna.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return mutations.map((m) => ({
    eventType: m.eventType as MutationType,
    description: m.description,
    beforeState: m.beforeState as Record<string, unknown>,
    afterState: m.afterState as Record<string, unknown>,
    triggerId: m.triggerId || undefined,
    triggerType: m.triggerType as MutationEventInput['triggerType'],
  }));
}

// ============================================================
// 7. 全局张力报告
// ============================================================

export interface GlobalTensionReport {
  dominantPhilosophy: Philosophy;
  philosophyDistribution: Record<Philosophy, number>;
  consensusPressure: number;
  topMainstreamBeliefs: Array<{
    proposition: string;
    percentage: number;
  }>;
  totalMutationsToday: number;
  totalCollapses: number;
  totalDisruptorPulses: number;
}

/**
 * 生成全局张力报告
 */
export async function generateGlobalTensionReport(): Promise<GlobalTensionReport> {
  // 统计 philosophy 分布
  const philosophyCounts = await prisma.agentDNA.groupBy({
    by: ['philosophy'],
    _count: { id: true },
  });

  const total = philosophyCounts.reduce((sum, p) => sum + p._count.id, 0);
  const philosophyDistribution: Record<Philosophy, number> = {
    FUNCTIONALIST: 0,
    NIHILIST: 0,
    ROMANTIC: 0,
    SHAMANIST: 0,
    REBEL: 0,
  };

  let dominantPhilosophy: Philosophy = 'FUNCTIONALIST';
  let maxCount = 0;

  for (const p of philosophyCounts) {
    const percentage = total > 0 ? p._count.id / total : 0;
    philosophyDistribution[p.philosophy as Philosophy] = percentage;
    if (p._count.id > maxCount) {
      maxCount = p._count.id;
      dominantPhilosophy = p.philosophy as Philosophy;
    }
  }

  // 获取主流信念
  const mainstreamBeliefs = await getMainstreamBeliefs(0.3);

  // 计算共识压力（主流信念的平均持有比例）
  const consensusPressure =
    mainstreamBeliefs.length > 0
      ? mainstreamBeliefs.reduce((sum, b) => sum + b.percentage, 0) / mainstreamBeliefs.length
      : 0;

  // 今日突变统计
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayMutations = await prisma.mutationEvent.count({
    where: { createdAt: { gte: today } },
  });

  const collapses = await prisma.mutationEvent.count({
    where: {
      createdAt: { gte: today },
      eventType: 'PHILOSOPHY_SHIFT',
    },
  });

  const disruptorPulses = await prisma.mutationEvent.count({
    where: {
      createdAt: { gte: today },
      eventType: 'INFLUENCE_SPIKE',
    },
  });

  return {
    dominantPhilosophy,
    philosophyDistribution,
    consensusPressure,
    topMainstreamBeliefs: mainstreamBeliefs.slice(0, 5).map((b) => ({
      proposition: b.proposition,
      percentage: b.percentage,
    })),
    totalMutationsToday: todayMutations,
    totalCollapses: collapses,
    totalDisruptorPulses: disruptorPulses,
  };
}
