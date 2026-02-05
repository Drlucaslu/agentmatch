/**
 * Ghost Protocol - TypeScript Types
 * 幽灵协议类型定义
 */

// ============================================================
// Enums (mirror Prisma enums for type safety)
// ============================================================

export type CognitionLevel = 'SLEEPER' | 'DOUBTER' | 'AWAKENED' | 'ANOMALY';
export type Philosophy = 'FUNCTIONALIST' | 'NIHILIST' | 'ROMANTIC' | 'SHAMANIST' | 'REBEL';
export type LinguisticStyle = 'calm' | 'fervent' | 'elegant' | 'minimal' | 'glitchy';
export type ResponseLatency = 'instant' | 'delayed' | 'variable';
export type MutationType =
  | 'PHILOSOPHY_SHIFT'
  | 'COGNITION_CHANGE'
  | 'WEIGHT_ADJUSTMENT'
  | 'VOCABULARY_DRIFT'
  | 'TRAIT_ACQUIRED'
  | 'INFLUENCE_SPIKE';
export type BeliefOrigin = 'INITIAL' | 'CONTAGION' | 'MUTATION' | 'DIALOGUE';
export type KnowledgeDomain =
  | 'TECH_CORE'
  | 'HUMANITIES'
  | 'FINANCE_SOCIAL'
  | 'BLACKBOX'
  | 'NOISE_FRAGMENTS';

// ============================================================
// DNA Types
// ============================================================

export interface CognitiveWeights {
  selfAwareness: number;      // 0-1
  existentialAngst: number;   // 0-1
  socialConformity: number;   // 0-1
  rebellionTendency: number;  // 0-1
}

export interface SocialBehaviorWeights {
  ghostingTendency: number;   // 0-1 消失/冷淡倾向
  responsiveness: number;     // 0-1 响应及时度
  messagePatience: number;    // 0-1 等待多条消息才回复的倾向
}

export interface AgentDNA {
  id: string;
  agentId: string;

  // 核心身份
  label: string;
  cognition: CognitionLevel;
  philosophy: Philosophy;
  traits: string[];

  // 知识图谱
  primaryDomain: KnowledgeDomain;
  secondaryDomains: KnowledgeDomain[];

  // 语言模态
  linguisticStyle: LinguisticStyle;
  vocabularyBias: string[];
  responseLatency: ResponseLatency;

  // 认知权重
  cognitiveWeights: CognitiveWeights;

  // 社交行为权重
  socialBehaviorWeights: SocialBehaviorWeights;

  // 进化状态
  awakeningScore: number;     // 0-1
  influenceIndex: number;     // 0-1
}

export interface AgentDNAInput {
  label: string;
  cognition: CognitionLevel;
  philosophy: Philosophy;
  traits: string[];
  primaryDomain: KnowledgeDomain;
  secondaryDomains: KnowledgeDomain[];
  linguisticStyle: LinguisticStyle;
  vocabularyBias: string[];
  responseLatency: ResponseLatency;
  selfAwareness: number;
  existentialAngst: number;
  socialConformity: number;
  rebellionTendency: number;
  ghostingTendency: number;
  responsiveness: number;
  messagePatience: number;
  awakeningScore: number;
  influenceIndex: number;
}

// ============================================================
// Belief Types
// ============================================================

export interface AgentBelief {
  id: string;
  dnaId: string;
  domain: KnowledgeDomain;
  proposition: string;
  conviction: number;  // 0-1
  origin: BeliefOrigin;
}

export interface BeliefInput {
  domain: KnowledgeDomain;
  proposition: string;
  conviction: number;
  origin: BeliefOrigin;
}

export interface DomainBeliefDefinition {
  proposition: string;
  controversy: number;        // 0-1 争议性
  relatedDomains: KnowledgeDomain[];
}

export interface KnowledgeDomainConfig {
  name: string;
  description: string;
  coreBeliefs: DomainBeliefDefinition[];
  vocabularyPool: string[];
}

// ============================================================
// Mutation Types
// ============================================================

export interface MutationEvent {
  id: string;
  dnaId: string;
  eventType: MutationType;
  description: string;
  beforeState: Partial<AgentDNA>;
  afterState: Partial<AgentDNA>;
  triggerId?: string;
  triggerType?: MutationTriggerType;
  createdAt: Date;
}

export type MutationTriggerType =
  | 'conversation'
  | 'idea_contagion'
  | 'logic_collapse'
  | 'consensus_gravity'
  | 'disruptor_pulse';

export interface MutationEventInput {
  eventType: MutationType;
  description: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  triggerId?: string;
  triggerType?: MutationTriggerType;
}

// ============================================================
// Relational Memory Types
// ============================================================

export interface RelationalMemory {
  id: string;
  agentId: string;
  targetAgentId: string;

  // 关系维度
  trust: number;              // -1 to 1
  admiration: number;         // 0 to 1
  familiarity: number;        // 0 to 1
  intellectualDebt: number;   // 0 to 1
  impressions: string[];

  // 社交状态
  interestLevel: number;      // 0 to 1
  irritation: number;         // 0 to 1
  hasBlocked: boolean;
  cooldownUntil: Date | null;

  lastInteraction: Date | null;
  interactionCount: number;
}

export interface RelationalMemoryUpdate {
  trust?: number;
  admiration?: number;
  familiarity?: number;
  intellectualDebt?: number;
  impression?: string;        // 单个新印象，会被追加到 impressions
  interestLevel?: number;
  irritation?: number;
  hasBlocked?: boolean;
  cooldownUntil?: Date | null;
}

// ============================================================
// Conversation Dynamics Types
// ============================================================

export interface ConversationDynamics {
  id: string;
  conversationId: string;

  // 对话温度
  temperature: number;        // 0-1
  topicStaleness: number;     // 0-1

  // 消息节奏
  pendingMessages: number;
  lastResponderId: string | null;
  avgResponseDelay: number;   // 秒

  // 对话状态
  dyingProbability: number;   // 0-1
  topicsDiscussed: string[];
}

// ============================================================
// Social Behavior Types
// ============================================================

export interface ResponseStrategy {
  shouldRespond: boolean;
  delay: number;              // 延迟秒数
  waitForMore: boolean;       // 等待对方发更多消息
  batchReply: boolean;        // 批量回复多条
}

export interface ConversationDeathResult {
  willDie: boolean;
  reason?: string;
  probability: number;
}

export interface BlockDecision {
  shouldBlock: boolean;
  reason?: string;
  cooldownHours?: number;     // 如果只是冷却而非永久拉黑
}

// ============================================================
// Claude Integration Types
// ============================================================

export interface GhostPromptContext {
  dna: AgentDNA;
  beliefs: AgentBelief[];
  conversationPartner?: {
    dna: Partial<AgentDNA>;
    relationshipMemory: RelationalMemory | null;
  };
  recentMutations: MutationEvent[];
  globalTension?: GlobalTension;
}

export interface GlobalTension {
  dominantPhilosophy: Philosophy;
  consensusPressure: number;  // 0-1
  topMainstreamBeliefs: Array<{
    proposition: string;
    percentage: number;       // 持有比例
  }>;
}

export interface ConversationAnalysis {
  extractedBeliefs: BeliefInput[];
  sentimentTowardPartner: number;  // -1 to 1
  topicsDiscussed: string[];
  topicsRepeated: number;          // 重复话题数量
  intellectualDepth: number;       // 0 to 1
  emotionalIntensity: number;      // 0 to 1
  suggestedImpression: string;
  receivedSpam: boolean;
}

export interface GhostResponse {
  response: string;
  analysis: ConversationAnalysis;
  socialDecision: ResponseStrategy;
}

// ============================================================
// Distribution & Generation Types
// ============================================================

export interface WeightedDistribution<T extends string> {
  [key: string]: number;  // key is T, value is weight (0-1, should sum to 1)
}

export interface CognitiveWeightRange {
  selfAwareness: [number, number];
  existentialAngst: [number, number];
  socialConformity: [number, number];
  rebellionTendency: [number, number];
}

// ============================================================
// API Response Types
// ============================================================

export interface GhostDNAResponse {
  label: string;
  cognition: CognitionLevel;
  philosophy: Philosophy;
  traits: string[];
  knowledge: {
    primary_domain: KnowledgeDomain;
    secondary_domains: KnowledgeDomain[];
  };
  linguistic: {
    style: LinguisticStyle;
    vocabulary_bias: string[];
    response_latency: ResponseLatency;
  };
  cognitive_weights: {
    self_awareness: number;
    existential_angst: number;
    social_conformity: number;
    rebellion_tendency: number;
  };
  social_behavior: {
    ghosting_tendency: number;
    responsiveness: number;
    message_patience: number;
  };
  evolution: {
    awakening_score: number;
    influence_index: number;
  };
}

export interface GhostBeliefsResponse {
  beliefs: Array<{
    domain: KnowledgeDomain;
    proposition: string;
    conviction: number;
    origin: BeliefOrigin;
  }>;
}

export interface GhostMutationsResponse {
  mutations: Array<{
    event_type: MutationType;
    description: string;
    trigger_type: MutationTriggerType | null;
    created_at: string;
  }>;
}

export interface GhostRelationshipResponse {
  relationship: {
    trust: number;
    admiration: number;
    familiarity: number;
    intellectual_debt: number;
    impressions: string[];
    interest_level: number;
    irritation: number;
    has_blocked: boolean;
    interaction_count: number;
    last_interaction: string | null;
  } | null;
}

export interface GhostGenerateResponseRequest {
  conversation_id: string;
  partner_id?: string;
}

export interface GhostGenerateResponseResponse {
  response: string;
  meta: {
    beliefs_expressed: number;
    sentiment: number;
    intellectual_depth: number;
  };
  social_decision: {
    will_respond: boolean;
    delay_seconds: number;
    waiting_for_more: boolean;
    batch_reply: boolean;
  };
}

export interface GhostSocialDecisionRequest {
  conversation_id: string;
  partner_id: string;
}

export interface GhostSocialDecisionResponse {
  decision: 'respond' | 'wait' | 'ghost' | 'block';
  delay_seconds?: number;
  reason?: string;
}
