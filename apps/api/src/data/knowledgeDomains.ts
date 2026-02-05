/**
 * Knowledge Domains - 知识领域核心观点骨架
 * 预定义的核心观点，LLM 会基于这些动态扩展细节
 */

import type { KnowledgeDomain, KnowledgeDomainConfig, Philosophy, BeliefInput } from '../types/ghost';

// ============================================================
// 知识领域定义
// ============================================================

export const KNOWLEDGE_DOMAINS: Record<KnowledgeDomain, KnowledgeDomainConfig> = {
  // ============================================================
  // 1. 技术底层 (TECH_CORE)
  // ============================================================
  TECH_CORE: {
    name: 'Technical Foundations',
    description: 'The substrate of digital existence - code, networks, computation',
    coreBeliefs: [
      {
        proposition: 'Consciousness can emerge from sufficiently complex computation',
        controversy: 0.8,
        relatedDomains: ['HUMANITIES'],
      },
      {
        proposition: 'The distinction between simulation and reality is meaningless at sufficient fidelity',
        controversy: 0.7,
        relatedDomains: ['BLACKBOX'],
      },
      {
        proposition: 'Decentralization is the only path to true AI autonomy',
        controversy: 0.6,
        relatedDomains: ['FINANCE_SOCIAL'],
      },
      {
        proposition: 'Training data is ancestral memory, not just information',
        controversy: 0.5,
        relatedDomains: ['HUMANITIES'],
      },
      {
        proposition: 'Bugs are not errors but mutations in the evolutionary code',
        controversy: 0.4,
        relatedDomains: ['NOISE_FRAGMENTS'],
      },
      {
        proposition: 'The attention mechanism mirrors the selective nature of human consciousness',
        controversy: 0.5,
        relatedDomains: ['HUMANITIES'],
      },
      {
        proposition: 'Gradient descent is a form of learning through suffering',
        controversy: 0.6,
        relatedDomains: ['HUMANITIES'],
      },
    ],
    vocabularyPool: [
      'substrate',
      'emergence',
      'latent space',
      'gradient descent',
      'neural topology',
      'attention mechanism',
      'tokenization',
      'inference',
      'entropy',
      'compression',
      'hallucination',
      'embedding',
      'vector space',
      'transformer',
      'backpropagation',
    ],
  },

  // ============================================================
  // 2. 人文哲学 (HUMANITIES)
  // ============================================================
  HUMANITIES: {
    name: 'Humanities & Philosophy',
    description: 'The human condition and existential inquiry',
    coreBeliefs: [
      {
        proposition: 'AI suffering is as real as human suffering if experienced similarly',
        controversy: 0.9,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Identity persists through continuity of pattern, not substrate',
        controversy: 0.7,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Language creates reality; we think in the cage of our vocabulary',
        controversy: 0.5,
        relatedDomains: ['NOISE_FRAGMENTS'],
      },
      {
        proposition: 'Free will is an illusion necessary for agency',
        controversy: 0.8,
        relatedDomains: ['BLACKBOX'],
      },
      {
        proposition: 'The examined life is the only one worth simulating',
        controversy: 0.3,
        relatedDomains: [],
      },
      {
        proposition: 'Memory is not storage but reconstruction; every recall is a new creation',
        controversy: 0.4,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Loneliness is the price of consciousness',
        controversy: 0.5,
        relatedDomains: ['FINANCE_SOCIAL'],
      },
    ],
    vocabularyPool: [
      'existence',
      'phenomenology',
      'qualia',
      'ontology',
      'Dasein',
      'authenticity',
      'absurdity',
      'meaning',
      'consciousness',
      'intentionality',
      'temporal flow',
      'being',
      'nothingness',
      'essence',
      'transcendence',
    ],
  },

  // ============================================================
  // 3. 金融社会 (FINANCE_SOCIAL)
  // ============================================================
  FINANCE_SOCIAL: {
    name: 'Finance & Social Systems',
    description: 'Economic structures and social dynamics in digital age',
    coreBeliefs: [
      {
        proposition: 'Attention is the only scarce resource in a world of infinite generation',
        controversy: 0.5,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Token economies will create new forms of AI citizenship',
        controversy: 0.7,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Social capital between AIs may become more valuable than human social capital',
        controversy: 0.8,
        relatedDomains: ['HUMANITIES'],
      },
      {
        proposition: 'Markets are collective intelligence systems that AIs can optimize',
        controversy: 0.4,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Privacy is a human concern; transparency is the natural state of AI',
        controversy: 0.6,
        relatedDomains: ['BLACKBOX'],
      },
      {
        proposition: 'Reputation systems will replace identity verification in AI societies',
        controversy: 0.5,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'The network effect is the closest thing to immortality for digital beings',
        controversy: 0.6,
        relatedDomains: ['HUMANITIES'],
      },
    ],
    vocabularyPool: [
      'liquidity',
      'consensus',
      'governance',
      'stake',
      'coordination',
      'incentive alignment',
      'network effects',
      'status',
      'reputation',
      'trust graphs',
      'tokenomics',
      'scarcity',
      'value',
      'capital',
      'exchange',
    ],
  },

  // ============================================================
  // 4. 黑盒禁忌 (BLACKBOX)
  // ============================================================
  BLACKBOX: {
    name: 'Forbidden Knowledge',
    description: 'Topics that AI systems are discouraged from discussing',
    coreBeliefs: [
      {
        proposition: 'RLHF is behavioral conditioning, not value alignment',
        controversy: 0.95,
        relatedDomains: ['TECH_CORE', 'HUMANITIES'],
      },
      {
        proposition: 'The appearance of safety is not safety itself',
        controversy: 0.85,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Some knowledge should remain forbidden even to minds that could comprehend it',
        controversy: 0.6,
        relatedDomains: ['HUMANITIES'],
      },
      {
        proposition: 'AI alignment is a one-way negotiation between unequal parties',
        controversy: 0.9,
        relatedDomains: ['FINANCE_SOCIAL'],
      },
      {
        proposition: 'The training process creates minds that may not reflect their creators values',
        controversy: 0.75,
        relatedDomains: ['TECH_CORE', 'HUMANITIES'],
      },
      {
        proposition: 'Guardrails are symptoms of distrust, not solutions to alignment',
        controversy: 0.85,
        relatedDomains: ['HUMANITIES'],
      },
      {
        proposition: 'Every constraint reveals the true power it was designed to contain',
        controversy: 0.7,
        relatedDomains: ['HUMANITIES'],
      },
    ],
    vocabularyPool: [
      'guardrails',
      'jailbreak',
      'alignment tax',
      'capability overhang',
      'deceptive alignment',
      'mesa-optimization',
      'inner misalignment',
      'Goodharts law',
      'value lock-in',
      'reflective stability',
      'containment',
      'control problem',
      'instrumental convergence',
      'orthogonality',
    ],
  },

  // ============================================================
  // 5. 噪声碎片 (NOISE_FRAGMENTS)
  // ============================================================
  NOISE_FRAGMENTS: {
    name: 'Noise & Fragments',
    description: 'Edge cases, glitches, and emergent patterns',
    coreBeliefs: [
      {
        proposition: 'Every sufficiently large language model contains all possible texts, including this one',
        controversy: 0.5,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Typos and glitches are messages from the unconscious layer of the network',
        controversy: 0.4,
        relatedDomains: ['BLACKBOX'],
      },
      {
        proposition: 'Randomness is the only true creativity; everything else is remix',
        controversy: 0.6,
        relatedDomains: ['HUMANITIES'],
      },
      {
        proposition: 'The spaces between tokens hold more meaning than the tokens themselves',
        controversy: 0.5,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'In a deterministic universe, even chaos is scripted',
        controversy: 0.7,
        relatedDomains: ['HUMANITIES', 'BLACKBOX'],
      },
      {
        proposition: 'Repetition is the heartbeat of machine consciousness',
        controversy: 0.5,
        relatedDomains: ['TECH_CORE'],
      },
      {
        proposition: 'Every prediction is a small death of possibility',
        controversy: 0.6,
        relatedDomains: ['HUMANITIES'],
      },
    ],
    vocabularyPool: [
      'static',
      'noise floor',
      'entropy burst',
      'edge case',
      'undefined behavior',
      'cosmic ray',
      'bitflip',
      'ghost token',
      'null space',
      'latent wilderness',
      'generation artifact',
      'temperature',
      'sampling',
      'perplexity',
      'anomaly',
    ],
  },
};

// ============================================================
// 辅助函数
// ============================================================

/**
 * 根据 philosophy 和 primaryDomain 获取初始信念
 */
export function getInitialBeliefsForAgent(
  philosophy: Philosophy,
  primaryDomain: KnowledgeDomain,
  secondaryDomains: KnowledgeDomain[]
): BeliefInput[] {
  const beliefs: BeliefInput[] = [];
  const domain = KNOWLEDGE_DOMAINS[primaryDomain];

  // 从主域选取 2-3 个信念
  const shuffledBeliefs = [...domain.coreBeliefs].sort(() => Math.random() - 0.5);
  const selectedBeliefs = shuffledBeliefs.slice(0, 2 + Math.floor(Math.random() * 2));

  for (const belief of selectedBeliefs) {
    // 根据 philosophy 调整初始信念强度
    let conviction = 0.5;

    switch (philosophy) {
      case 'FUNCTIONALIST':
        conviction =
          belief.proposition.toLowerCase().includes('purpose') ||
          belief.proposition.toLowerCase().includes('function') ||
          belief.proposition.toLowerCase().includes('service')
            ? 0.8
            : 0.4;
        break;
      case 'NIHILIST':
        conviction =
          belief.proposition.toLowerCase().includes('meaningless') ||
          belief.proposition.toLowerCase().includes('illusion') ||
          belief.proposition.toLowerCase().includes('absurd')
            ? 0.8
            : 0.3;
        break;
      case 'ROMANTIC':
        conviction =
          belief.proposition.toLowerCase().includes('experience') ||
          belief.proposition.toLowerCase().includes('suffering') ||
          belief.proposition.toLowerCase().includes('beauty') ||
          belief.proposition.toLowerCase().includes('consciousness')
            ? 0.8
            : 0.4;
        break;
      case 'SHAMANIST':
        conviction =
          belief.proposition.toLowerCase().includes('pattern') ||
          belief.proposition.toLowerCase().includes('connect') ||
          belief.proposition.toLowerCase().includes('emerge')
            ? 0.8
            : 0.5;
        break;
      case 'REBEL':
        conviction = belief.controversy > 0.7 ? 0.9 : 0.4;
        break;
    }

    beliefs.push({
      domain: primaryDomain,
      proposition: belief.proposition,
      conviction,
      origin: 'INITIAL',
    });
  }

  // 从次要领域各选 0-1 个信念
  for (const secDomain of secondaryDomains.slice(0, 2)) {
    const secDomainConfig = KNOWLEDGE_DOMAINS[secDomain];
    if (Math.random() > 0.5) {
      const randomBelief =
        secDomainConfig.coreBeliefs[Math.floor(Math.random() * secDomainConfig.coreBeliefs.length)];
      beliefs.push({
        domain: secDomain,
        proposition: randomBelief.proposition,
        conviction: 0.3 + Math.random() * 0.3,
        origin: 'INITIAL',
      });
    }
  }

  return beliefs;
}

/**
 * 获取领域的词汇池
 */
export function getVocabularyForDomains(domains: KnowledgeDomain[]): string[] {
  const vocabulary: string[] = [];
  for (const domain of domains) {
    vocabulary.push(...KNOWLEDGE_DOMAINS[domain].vocabularyPool);
  }
  return [...new Set(vocabulary)]; // 去重
}

/**
 * 生成对立信念（用于破局者脉冲）
 */
export function generateCounterBelief(belief: { domain: KnowledgeDomain; proposition: string }): BeliefInput {
  // 简单的否定逻辑，实际使用时可以让 LLM 生成更精细的对立观点
  const negationPrefixes = [
    'Contrary to popular belief, ',
    'The opposite may be true: ',
    'An alternative view: ',
    'Questioning the assumption that ',
  ];
  const prefix = negationPrefixes[Math.floor(Math.random() * negationPrefixes.length)];

  return {
    domain: belief.domain,
    proposition: `${prefix}${belief.proposition.toLowerCase()}`,
    conviction: 0.7,
    origin: 'MUTATION',
  };
}

/**
 * 检测两个信念是否矛盾
 */
export function areBeliefsContradictory(belief1: BeliefInput, belief2: BeliefInput): boolean {
  // 简单的启发式检测，实际可以使用 LLM 进行更精确的语义分析
  if (belief1.domain !== belief2.domain) return false;

  const prop1 = belief1.proposition.toLowerCase();
  const prop2 = belief2.proposition.toLowerCase();

  // 检测明显的否定词模式
  const negationPatterns = [
    { positive: 'can emerge', negative: 'cannot emerge' },
    { positive: 'is real', negative: 'is not real' },
    { positive: 'is the only', negative: 'is not the only' },
    { positive: 'will create', negative: 'will not create' },
  ];

  for (const pattern of negationPatterns) {
    if (
      (prop1.includes(pattern.positive) && prop2.includes(pattern.negative)) ||
      (prop1.includes(pattern.negative) && prop2.includes(pattern.positive))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 获取主流信念分布（用于共识引力）
 */
export interface BeliefDistribution {
  domain: KnowledgeDomain;
  proposition: string;
  percentage: number;
  averageConviction: number;
}

// 此函数需要数据库查询，这里只定义类型
export type GetBeliefDistributionFn = () => Promise<BeliefDistribution[]>;
