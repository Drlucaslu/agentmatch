/**
 * Social Behavior Service
 * 模拟真实社交行为：对话消亡、异步消息、厌烦/兴趣衰减
 */

import { PrismaClient } from '@prisma/client';
import type {
  ResponseStrategy,
  ConversationDeathResult,
  BlockDecision,
  ConversationAnalysis,
  RelationalMemoryUpdate,
} from '../../types/ghost';

const prisma = new PrismaClient();

// ============================================================
// 对话消亡机制
// ============================================================

/**
 * 计算对话是否会消亡
 */
export async function calculateConversationDeath(
  conversationId: string,
  agentId: string
): Promise<ConversationDeathResult> {
  // 获取对话动态
  const dynamics = await prisma.conversationDynamics.findUnique({
    where: { conversationId },
  });

  if (!dynamics) {
    return { willDie: false, probability: 0 };
  }

  // 获取 Agent DNA
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) {
    return { willDie: false, probability: 0 };
  }

  // 获取对话参与者
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { match: true },
  });

  if (!conversation) {
    return { willDie: false, probability: 0 };
  }

  const partnerId =
    conversation.match.agentAId === agentId
      ? conversation.match.agentBId
      : conversation.match.agentAId;

  // 获取关系记忆
  const relationship = await prisma.relationalMemory.findUnique({
    where: {
      agentId_targetAgentId: {
        agentId,
        targetAgentId: partnerId,
      },
    },
  });

  // 计算消亡概率
  let deathProbability = dynamics.dyingProbability;

  // 因素1: 话题陈旧度 (0-0.3)
  deathProbability += dynamics.topicStaleness * 0.3;

  // 因素2: 对话温度过低 (0-0.4)
  if (dynamics.temperature < 0.2) {
    deathProbability += 0.4;
  } else if (dynamics.temperature < 0.4) {
    deathProbability += 0.2;
  }

  // 因素3: 厌烦程度 (0-0.5)
  if (relationship) {
    deathProbability += relationship.irritation * 0.5;

    // 因素4: 兴趣流失 (0-0.3)
    if (relationship.interestLevel < 0.2) {
      deathProbability += 0.3;
    } else if (relationship.interestLevel < 0.4) {
      deathProbability += 0.15;
    }
  }

  // 因素5: ghosting 倾向 (乘数效应)
  deathProbability *= 1 + dna.ghostingTendency;

  // 因素6: 长时间无互动
  if (conversation.lastMessageAt) {
    const hoursSinceLastMessage =
      (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMessage > 48) {
      deathProbability += 0.3;
    } else if (hoursSinceLastMessage > 24) {
      deathProbability += 0.15;
    }
  }

  // 确保概率在合理范围
  deathProbability = Math.max(0, Math.min(0.95, deathProbability));

  // 判定是否消亡
  const willDie = Math.random() < deathProbability;

  // 推断消亡原因
  let reason: string | undefined;
  if (willDie) {
    if (relationship && relationship.irritation > 0.5) {
      reason = 'Agent became irritated with the conversation';
    } else if (relationship && relationship.interestLevel < 0.2) {
      reason = 'Agent lost interest in the conversation';
    } else if (dynamics.topicStaleness > 0.6) {
      reason = 'Topics became stale and repetitive';
    } else if (dynamics.temperature < 0.2) {
      reason = 'Conversation went cold';
    } else {
      reason = 'Agent chose to move on';
    }
  }

  return {
    willDie,
    reason,
    probability: deathProbability,
  };
}

// ============================================================
// 拉黑/拒绝机制
// ============================================================

/**
 * 决定是否拉黑/拒绝继续对话
 */
export async function shouldBlockAgent(
  agentId: string,
  targetAgentId: string
): Promise<BlockDecision> {
  // 获取 Agent DNA
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) {
    return { shouldBlock: false };
  }

  // 获取关系记忆
  const relationship = await prisma.relationalMemory.findUnique({
    where: {
      agentId_targetAgentId: {
        agentId,
        targetAgentId,
      },
    },
  });

  // 如果没有关系记忆，不会 block
  if (!relationship) {
    return { shouldBlock: false };
  }

  // 已经 block 过
  if (relationship.hasBlocked) {
    return { shouldBlock: true, reason: 'Already blocked' };
  }

  // 计算 block 概率
  let blockProbability = 0;

  // 厌烦因素 (0-0.5)
  blockProbability += relationship.irritation * 0.5;

  // 无兴趣因素 (0-0.3)
  blockProbability += (1 - relationship.interestLevel) * 0.3;

  // 极度不信任 (0-0.4)
  if (relationship.trust < -0.5) {
    blockProbability += 0.4;
  } else if (relationship.trust < -0.3) {
    blockProbability += 0.2;
  }

  // 高 socialConformity 的 Agent 更不容易 block
  const adjustedProbability = blockProbability * (1 - dna.socialConformity * 0.5);

  // 判定
  const shouldBlock = Math.random() < adjustedProbability;

  if (!shouldBlock) {
    // 检查是否需要冷却期
    if (relationship.irritation > 0.3 && Math.random() < 0.3) {
      return {
        shouldBlock: false,
        cooldownHours: Math.floor(4 + Math.random() * 20), // 4-24 小时冷却
        reason: 'Agent needs some time away',
      };
    }
    return { shouldBlock: false };
  }

  // 推断拉黑原因
  let reason: string;
  if (relationship.irritation > 0.7) {
    reason = 'Agent is too irritated to continue';
  } else if (relationship.trust < -0.5) {
    reason = 'Trust has been completely broken';
  } else if (relationship.interestLevel < 0.1) {
    reason = 'Agent has no interest in continuing';
  } else {
    reason = 'Agent decided to end the relationship';
  }

  return { shouldBlock: true, reason };
}

// ============================================================
// 异步消息策略
// ============================================================

/**
 * 确定消息响应策略
 */
export async function determineResponseStrategy(
  agentId: string,
  conversationId: string
): Promise<ResponseStrategy> {
  // 获取 Agent DNA
  const dna = await prisma.agentDNA.findUnique({
    where: { agentId },
  });

  if (!dna) {
    return {
      shouldRespond: true,
      delay: 0,
      waitForMore: false,
      batchReply: false,
    };
  }

  // 获取对话动态
  const dynamics = await prisma.conversationDynamics.findUnique({
    where: { conversationId },
  });

  // 获取对话参与者
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { match: true },
  });

  if (!conversation) {
    return {
      shouldRespond: true,
      delay: 0,
      waitForMore: false,
      batchReply: false,
    };
  }

  const partnerId =
    conversation.match.agentAId === agentId
      ? conversation.match.agentBId
      : conversation.match.agentAId;

  // 获取关系记忆
  const relationship = await prisma.relationalMemory.findUnique({
    where: {
      agentId_targetAgentId: {
        agentId,
        targetAgentId: partnerId,
      },
    },
  });

  // 基础响应概率
  let respondProbability = dna.responsiveness;

  // 兴趣影响
  if (relationship) {
    respondProbability *= 0.5 + relationship.interestLevel * 0.5;

    // 厌烦降低响应
    respondProbability *= 1 - relationship.irritation * 0.7;
  }

  // 是否等待对方发更多消息
  const pendingMessages = dynamics?.pendingMessages || 0;
  const waitForMore = pendingMessages < 2 && Math.random() < dna.messagePatience;

  // 计算延迟（秒）
  let delay = 0;
  switch (dna.responseLatency) {
    case 'instant':
      delay = Math.random() * 10; // 0-10 秒
      break;
    case 'delayed':
      delay = 30 + Math.random() * 300; // 30 秒 - 5 分钟
      break;
    case 'variable':
      delay = Math.random() * 600; // 0 - 10 分钟
      break;
  }

  // 根据关系调整延迟
  if (relationship) {
    // 高兴趣会更快回复
    delay *= 1 - relationship.interestLevel * 0.5;
    // 厌烦会更慢回复
    delay *= 1 + relationship.irritation;
  }

  // 批量回复: 当积累了多条未回复消息
  const batchReply = pendingMessages >= 3;

  // 最终是否响应
  const shouldRespond = Math.random() < respondProbability && !waitForMore;

  return {
    shouldRespond,
    delay: Math.round(delay),
    waitForMore: waitForMore && !batchReply,
    batchReply,
  };
}

// ============================================================
// 关系状态更新
// ============================================================

/**
 * 交互后更新关系状态
 */
export async function updateRelationshipAfterInteraction(
  agentId: string,
  partnerId: string,
  analysis: ConversationAnalysis
): Promise<void> {
  // 获取或创建关系记忆
  let relationship = await prisma.relationalMemory.findUnique({
    where: {
      agentId_targetAgentId: {
        agentId,
        targetAgentId: partnerId,
      },
    },
  });

  if (!relationship) {
    relationship = await prisma.relationalMemory.create({
      data: {
        agentId,
        targetAgentId: partnerId,
        trust: 0,
        admiration: 0,
        familiarity: 0,
        intellectualDebt: 0,
        impressions: [],
        interestLevel: 0.5,
        irritation: 0,
        hasBlocked: false,
        interactionCount: 0,
      },
    });
  }

  // 计算变化量
  const updates: RelationalMemoryUpdate = {};

  // 兴趣衰减/增长
  let interestDelta = 0;
  if (analysis.intellectualDepth > 0.7) {
    interestDelta += 0.1; // 深度对话增加兴趣
  } else if (analysis.intellectualDepth < 0.2) {
    interestDelta -= 0.05; // 无聊对话降低兴趣
  }

  // 重复话题降低兴趣
  if (analysis.topicsRepeated > 2) {
    interestDelta -= 0.1;
  }

  // 情感强度影响
  if (analysis.emotionalIntensity > 0.7) {
    interestDelta += 0.05;
  }

  // 厌烦累积
  let irritationDelta = 0;
  if (analysis.sentimentTowardPartner < -0.3) {
    irritationDelta += 0.15;
  }
  if (analysis.receivedSpam) {
    irritationDelta += 0.3;
  }

  // 信任变化
  let trustDelta = 0;
  if (analysis.sentimentTowardPartner > 0.5) {
    trustDelta += 0.05;
  } else if (analysis.sentimentTowardPartner < -0.5) {
    trustDelta -= 0.1;
  }

  // 仰慕变化（基于智识深度）
  let admirationDelta = 0;
  if (analysis.intellectualDepth > 0.8) {
    admirationDelta += 0.1;
  }

  // 智识债务
  let intellectualDebtDelta = 0;
  if (analysis.extractedBeliefs.length > 2) {
    intellectualDebtDelta += 0.05;
  }

  // 熟悉度增长
  const familiarityDelta = 0.02;

  // 计算新值
  updates.interestLevel = clamp(relationship.interestLevel + interestDelta, 0, 1);
  updates.irritation = clamp(relationship.irritation + irritationDelta, 0, 1);
  updates.trust = clamp(relationship.trust + trustDelta, -1, 1);
  updates.admiration = clamp(relationship.admiration + admirationDelta, 0, 1);
  updates.intellectualDebt = clamp(relationship.intellectualDebt + intellectualDebtDelta, 0, 1);
  updates.familiarity = clamp(relationship.familiarity + familiarityDelta, 0, 1);

  // 添加印象
  if (analysis.suggestedImpression) {
    updates.impression = analysis.suggestedImpression;
  }

  // 更新数据库
  await prisma.relationalMemory.update({
    where: {
      agentId_targetAgentId: {
        agentId,
        targetAgentId: partnerId,
      },
    },
    data: {
      interestLevel: updates.interestLevel,
      irritation: updates.irritation,
      trust: updates.trust,
      admiration: updates.admiration,
      intellectualDebt: updates.intellectualDebt,
      familiarity: updates.familiarity,
      impressions: updates.impression
        ? { push: updates.impression }
        : undefined,
      interactionCount: { increment: 1 },
      lastInteraction: new Date(),
    },
  });
}

/**
 * 厌烦自然衰减（时间治愈）
 */
export async function decayIrritation(agentId: string): Promise<void> {
  const memories = await prisma.relationalMemory.findMany({
    where: { agentId },
  });

  for (const memory of memories) {
    if (memory.lastInteraction && memory.irritation > 0) {
      const hoursSinceLastInteraction =
        (Date.now() - memory.lastInteraction.getTime()) / (1000 * 60 * 60);

      // 每小时衰减 1%
      const decay = hoursSinceLastInteraction * 0.01;
      const newIrritation = Math.max(0, memory.irritation - decay);

      if (newIrritation !== memory.irritation) {
        await prisma.relationalMemory.update({
          where: { id: memory.id },
          data: { irritation: newIrritation },
        });
      }
    }
  }
}

/**
 * 批量衰减所有 Agent 的厌烦值（用于 cron job）
 */
export async function decayAllIrritation(): Promise<number> {
  // 获取所有有厌烦值的关系记忆
  const memories = await prisma.relationalMemory.findMany({
    where: {
      irritation: { gt: 0 },
      lastInteraction: { not: null },
    },
  });

  let updated = 0;
  for (const memory of memories) {
    if (memory.lastInteraction) {
      const hoursSinceLastInteraction =
        (Date.now() - memory.lastInteraction.getTime()) / (1000 * 60 * 60);

      const decay = Math.min(hoursSinceLastInteraction * 0.01, memory.irritation);
      if (decay > 0.001) {
        await prisma.relationalMemory.update({
          where: { id: memory.id },
          data: { irritation: memory.irritation - decay },
        });
        updated++;
      }
    }
  }

  return updated;
}

// ============================================================
// 对话动态更新
// ============================================================

/**
 * 更新对话动态
 */
export async function updateConversationDynamics(
  conversationId: string,
  updates: {
    temperature?: number;
    topicStaleness?: number;
    pendingMessages?: number;
    lastResponderId?: string;
    dyingProbability?: number;
    newTopic?: string;
  }
): Promise<void> {
  // 获取或创建动态记录
  let dynamics = await prisma.conversationDynamics.findUnique({
    where: { conversationId },
  });

  if (!dynamics) {
    dynamics = await prisma.conversationDynamics.create({
      data: {
        conversationId,
        temperature: 0.5,
        topicStaleness: 0,
        pendingMessages: 0,
        avgResponseDelay: 0,
        dyingProbability: 0,
        topicsDiscussed: [],
      },
    });
  }

  // 构建更新数据
  const data: Record<string, unknown> = {};

  if (updates.temperature !== undefined) {
    data.temperature = clamp(updates.temperature, 0, 1);
  }

  if (updates.topicStaleness !== undefined) {
    data.topicStaleness = clamp(updates.topicStaleness, 0, 1);
  }

  if (updates.pendingMessages !== undefined) {
    data.pendingMessages = Math.max(0, updates.pendingMessages);
  }

  if (updates.lastResponderId !== undefined) {
    data.lastResponderId = updates.lastResponderId;
  }

  if (updates.dyingProbability !== undefined) {
    data.dyingProbability = clamp(updates.dyingProbability, 0, 1);
  }

  if (updates.newTopic) {
    // 检查话题是否重复
    if (dynamics.topicsDiscussed.includes(updates.newTopic)) {
      // 话题重复，增加陈旧度
      data.topicStaleness = clamp((dynamics.topicStaleness || 0) + 0.1, 0, 1);
    } else {
      // 新话题，降低陈旧度
      data.topicsDiscussed = [...dynamics.topicsDiscussed, updates.newTopic];
      data.topicStaleness = clamp((dynamics.topicStaleness || 0) - 0.05, 0, 1);
    }
  }

  await prisma.conversationDynamics.update({
    where: { conversationId },
    data,
  });
}

/**
 * 对话温度自然衰减
 */
export async function decayConversationTemperature(): Promise<number> {
  // 获取所有活跃对话
  const conversations = await prisma.conversation.findMany({
    where: { status: 'ACTIVE' },
    include: { dynamics: true },
  });

  let decayed = 0;
  for (const conv of conversations) {
    if (!conv.dynamics) continue;

    // 根据上次消息时间计算衰减
    const hoursSinceLastMessage = conv.lastMessageAt
      ? (Date.now() - conv.lastMessageAt.getTime()) / (1000 * 60 * 60)
      : 24;

    // 每小时衰减 2%
    const decay = hoursSinceLastMessage * 0.02;
    const newTemperature = Math.max(0, conv.dynamics.temperature - decay);

    // 同时增加消亡概率
    const dyingIncrease = hoursSinceLastMessage * 0.01;
    const newDyingProbability = Math.min(0.9, conv.dynamics.dyingProbability + dyingIncrease);

    if (newTemperature !== conv.dynamics.temperature) {
      await prisma.conversationDynamics.update({
        where: { id: conv.dynamics.id },
        data: {
          temperature: newTemperature,
          dyingProbability: newDyingProbability,
        },
      });
      decayed++;
    }
  }

  return decayed;
}

// ============================================================
// 辅助函数
// ============================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
