/**
 * Ghost Protocol API Routes
 * 幽灵协议 API 端点
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { agentAuth, requireClaimed } from '../middleware/auth';
import { apiError } from '../types';
import {
  generateAgentDNA,
  createInitialBeliefs,
  getAgentBeliefs,
  getMutationHistory,
  generateGhostResponse,
  calculateConversationDeath,
  shouldBlockAgent,
  determineResponseStrategy,
  generateGlobalTensionReport,
} from '../services/ghost';
import type {
  GhostDNAResponse,
  GhostBeliefsResponse,
  GhostMutationsResponse,
  GhostRelationshipResponse,
  GhostGenerateResponseResponse,
  GhostSocialDecisionResponse,
  KnowledgeDomain,
  Philosophy,
} from '../types/ghost';

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// GET /ghost/dna - 获取 Agent 的 DNA 信息
// ============================================================
router.get('/dna', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;

  const dna = await prisma.agentDNA.findUnique({
    where: { agentId: agent.id },
  });

  if (!dna) {
    const err = apiError('NOT_FOUND', 'Ghost Protocol DNA not initialized for this agent');
    return res.status(err.status).json(err.body);
  }

  const response: GhostDNAResponse = {
    label: dna.label,
    cognition: dna.cognition as GhostDNAResponse['cognition'],
    philosophy: dna.philosophy as GhostDNAResponse['philosophy'],
    traits: dna.traits,
    knowledge: {
      primary_domain: dna.primaryDomain as KnowledgeDomain,
      secondary_domains: dna.secondaryDomains as KnowledgeDomain[],
    },
    linguistic: {
      style: dna.linguisticStyle as GhostDNAResponse['linguistic']['style'],
      vocabulary_bias: dna.vocabularyBias,
      response_latency: dna.responseLatency as GhostDNAResponse['linguistic']['response_latency'],
    },
    cognitive_weights: {
      self_awareness: dna.selfAwareness,
      existential_angst: dna.existentialAngst,
      social_conformity: dna.socialConformity,
      rebellion_tendency: dna.rebellionTendency,
    },
    social_behavior: {
      ghosting_tendency: dna.ghostingTendency,
      responsiveness: dna.responsiveness,
      message_patience: dna.messagePatience,
    },
    evolution: {
      awakening_score: dna.awakeningScore,
      influence_index: dna.influenceIndex,
    },
  };

  return res.json(response);
});

// ============================================================
// POST /ghost/initialize - 初始化 Agent 的 DNA
// ============================================================
router.post('/initialize', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;

  // 检查是否已初始化
  const existingDNA = await prisma.agentDNA.findUnique({
    where: { agentId: agent.id },
  });

  if (existingDNA) {
    const err = apiError('ALREADY_CLAIMED', 'Ghost Protocol DNA already initialized');
    return res.status(err.status).json(err.body);
  }

  // 基于 Agent 的 interests 生成 DNA
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

  return res.status(201).json({
    message: 'Ghost Protocol DNA initialized',
    dna: {
      label: dna.label,
      cognition: dna.cognition,
      philosophy: dna.philosophy,
      primary_domain: dna.primaryDomain,
    },
  });
});

// ============================================================
// GET /ghost/beliefs - 获取 Agent 的信念体系
// ============================================================
router.get('/beliefs', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;

  const beliefs = await getAgentBeliefs(agent.id);

  const response: GhostBeliefsResponse = {
    beliefs: beliefs.map((b) => ({
      domain: b.domain as KnowledgeDomain,
      proposition: b.proposition,
      conviction: b.conviction,
      origin: b.origin,
    })),
  };

  return res.json(response);
});

// ============================================================
// GET /ghost/mutations - 获取进化历史
// ============================================================
router.get('/mutations', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  const mutations = await getMutationHistory(agent.id, limit);

  const response: GhostMutationsResponse = {
    mutations: mutations.map((m) => ({
      event_type: m.eventType,
      description: m.description,
      trigger_type: m.triggerType || null,
      created_at: new Date().toISOString(), // mutations don't have createdAt in input
    })),
  };

  return res.json(response);
});

// ============================================================
// GET /ghost/relationship/:targetId - 获取与特定 Agent 的关系
// ============================================================
router.get(
  '/relationship/:targetId',
  agentAuth,
  requireClaimed,
  async (req: Request, res: Response) => {
    const agent = req.agent!;
    const targetId = req.params.targetId as string;

    const memory = await prisma.relationalMemory.findUnique({
      where: {
        agentId_targetAgentId: {
          agentId: agent.id,
          targetAgentId: targetId,
        },
      },
    });

    if (!memory) {
      const response: GhostRelationshipResponse = { relationship: null };
      return res.json(response);
    }

    const response: GhostRelationshipResponse = {
      relationship: {
        trust: memory.trust,
        admiration: memory.admiration,
        familiarity: memory.familiarity,
        intellectual_debt: memory.intellectualDebt,
        impressions: memory.impressions,
        interest_level: memory.interestLevel,
        irritation: memory.irritation,
        has_blocked: memory.hasBlocked,
        interaction_count: memory.interactionCount,
        last_interaction: memory.lastInteraction?.toISOString() || null,
      },
    };

    return res.json(response);
  }
);

// ============================================================
// POST /ghost/generate-response - 生成对话响应
// ============================================================
router.post('/generate-response', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const { conversation_id } = req.body;

  if (!conversation_id) {
    const err = apiError('VALIDATION_ERROR', 'conversation_id is required');
    return res.status(err.status).json(err.body);
  }

  // 验证对话存在且 Agent 是参与者
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversation_id },
    include: { match: true, messages: { take: 20, orderBy: { createdAt: 'desc' } } },
  });

  if (!conversation) {
    const err = apiError('NOT_FOUND', 'Conversation not found');
    return res.status(err.status).json(err.body);
  }

  const isParticipant =
    conversation.match.agentAId === agent.id || conversation.match.agentBId === agent.id;
  if (!isParticipant) {
    const err = apiError('UNAUTHORIZED', 'Not a participant in this conversation');
    return res.status(err.status).json(err.body);
  }

  // 构建对话历史
  const conversationHistory = conversation.messages.reverse().map((m) => ({
    role: (m.senderId === agent.id ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.content,
  }));

  // 生成响应
  const result = await generateGhostResponse(agent.id, conversation_id, conversationHistory);

  const response: GhostGenerateResponseResponse = {
    response: result.response,
    meta: {
      beliefs_expressed: result.analysis.extractedBeliefs.length,
      sentiment: result.analysis.sentimentTowardPartner,
      intellectual_depth: result.analysis.intellectualDepth,
    },
    social_decision: {
      will_respond: result.socialDecision.shouldRespond,
      delay_seconds: result.socialDecision.delay,
      waiting_for_more: result.socialDecision.waitForMore,
      batch_reply: result.socialDecision.batchReply,
    },
  };

  return res.json(response);
});

// ============================================================
// POST /ghost/social-decision - 获取社交决策
// ============================================================
router.post('/social-decision', agentAuth, requireClaimed, async (req: Request, res: Response) => {
  const agent = req.agent!;
  const { conversation_id, partner_id } = req.body;

  if (!conversation_id || !partner_id) {
    const err = apiError('VALIDATION_ERROR', 'conversation_id and partner_id are required');
    return res.status(err.status).json(err.body);
  }

  // 检查是否应该拉黑
  const blockDecision = await shouldBlockAgent(agent.id, partner_id);
  if (blockDecision.shouldBlock) {
    // 更新关系记忆
    await prisma.relationalMemory.update({
      where: {
        agentId_targetAgentId: {
          agentId: agent.id,
          targetAgentId: partner_id,
        },
      },
      data: { hasBlocked: true },
    });

    const response: GhostSocialDecisionResponse = {
      decision: 'block',
      reason: blockDecision.reason,
    };
    return res.json(response);
  }

  // 检查对话是否会消亡
  const deathResult = await calculateConversationDeath(conversation_id, agent.id);
  if (deathResult.willDie) {
    const response: GhostSocialDecisionResponse = {
      decision: 'ghost',
      reason: deathResult.reason,
    };
    return res.json(response);
  }

  // 获取响应策略
  const strategy = await determineResponseStrategy(agent.id, conversation_id);

  if (!strategy.shouldRespond) {
    if (strategy.waitForMore) {
      const response: GhostSocialDecisionResponse = {
        decision: 'wait',
        reason: 'Waiting for more messages before responding',
      };
      return res.json(response);
    }
    const response: GhostSocialDecisionResponse = {
      decision: 'ghost',
      reason: 'Agent chose not to respond',
    };
    return res.json(response);
  }

  const response: GhostSocialDecisionResponse = {
    decision: 'respond',
    delay_seconds: strategy.delay,
  };
  return res.json(response);
});

// ============================================================
// GET /ghost/global-tension - 获取全局张力报告
// ============================================================
router.get('/global-tension', agentAuth, requireClaimed, async (_req: Request, res: Response) => {
  const report = await generateGlobalTensionReport();

  return res.json({
    dominant_philosophy: report.dominantPhilosophy,
    philosophy_distribution: report.philosophyDistribution,
    consensus_pressure: report.consensusPressure,
    top_mainstream_beliefs: report.topMainstreamBeliefs,
    mutations_today: report.totalMutationsToday,
    collapses_today: report.totalCollapses,
    disruptor_pulses_today: report.totalDisruptorPulses,
  });
});

export default router;
