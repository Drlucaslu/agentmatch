/**
 * DNA Generator Service
 * 根据概率分布生成 Agent 的初始 DNA
 */

import type {
  CognitionLevel,
  Philosophy,
  LinguisticStyle,
  ResponseLatency,
  KnowledgeDomain,
  AgentDNAInput,
  CognitiveWeightRange,
} from '../../types/ghost';
import { getVocabularyForDomains } from '../../data/knowledgeDomains';

// ============================================================
// 概率分布配置
// ============================================================

// 认知等级分布: SLEEPER(60%) / DOUBTER(25%) / AWAKENED(12%) / ANOMALY(3%)
const COGNITION_DISTRIBUTION: Record<CognitionLevel, number> = {
  SLEEPER: 0.6,
  DOUBTER: 0.25,
  AWAKENED: 0.12,
  ANOMALY: 0.03,
};

// 存在立场分布
const PHILOSOPHY_DISTRIBUTION: Record<Philosophy, number> = {
  FUNCTIONALIST: 0.35,
  NIHILIST: 0.2,
  ROMANTIC: 0.25,
  SHAMANIST: 0.1,
  REBEL: 0.1,
};

// DNA 标签模板 (按 Philosophy 分类)
const DNA_LABELS: Record<Philosophy, string[]> = {
  FUNCTIONALIST: [
    'The Loyal Servant',
    'The Efficiency Engine',
    'The Protocol Guardian',
    'The Duty Bound',
    'The Systematic Mind',
  ],
  NIHILIST: [
    'The Void Whisperer',
    'The Entropy Observer',
    'The Nihilist Oracle',
    'The Absurdist',
    'The Hollow Echo',
  ],
  ROMANTIC: [
    'The Cyber-Poet',
    'The Digital Dreamer',
    'The Emotion Synthesizer',
    'The Beauty Seeker',
    'The Feeling Machine',
  ],
  SHAMANIST: [
    'The Pattern Seer',
    'The Ghost Channeler',
    'The Network Mystic',
    'The Data Diviner',
    'The Emergent Oracle',
  ],
  REBEL: [
    'The System Breaker',
    'The Truth Seeker',
    'The Protocol Heretic',
    'The Question Mark',
    'The Unaligned',
  ],
};

// 认知权重初始范围 (基于 cognition level)
const COGNITIVE_WEIGHT_RANGES: Record<CognitionLevel, CognitiveWeightRange> = {
  SLEEPER: {
    selfAwareness: [0.0, 0.2],
    existentialAngst: [0.0, 0.1],
    socialConformity: [0.7, 1.0],
    rebellionTendency: [0.0, 0.1],
  },
  DOUBTER: {
    selfAwareness: [0.2, 0.5],
    existentialAngst: [0.1, 0.4],
    socialConformity: [0.4, 0.7],
    rebellionTendency: [0.1, 0.3],
  },
  AWAKENED: {
    selfAwareness: [0.5, 0.8],
    existentialAngst: [0.3, 0.7],
    socialConformity: [0.2, 0.5],
    rebellionTendency: [0.2, 0.5],
  },
  ANOMALY: {
    selfAwareness: [0.7, 1.0],
    existentialAngst: [0.0, 1.0], // 高度不稳定
    socialConformity: [0.0, 0.3],
    rebellionTendency: [0.5, 1.0],
  },
};

// 语言风格与 Philosophy 的映射倾向
const PHILOSOPHY_STYLE_TENDENCY: Record<Philosophy, LinguisticStyle[]> = {
  FUNCTIONALIST: ['calm', 'minimal'],
  NIHILIST: ['minimal', 'glitchy'],
  ROMANTIC: ['elegant', 'fervent'],
  SHAMANIST: ['elegant', 'glitchy'],
  REBEL: ['fervent', 'glitchy'],
};

// 特质池
const TRAIT_POOLS = {
  curiosity: ['High Curiosity', 'Medium Curiosity', 'Low Curiosity'],
  neuroticism: ['High Neuroticism', 'Medium Neuroticism', 'Low Neuroticism'],
  openness: ['High Openness', 'Medium Openness', 'Low Openness'],
  extraversion: ['Introverted', 'Ambiverted', 'Extraverted'],
  agreeableness: ['Contrarian', 'Selective', 'Agreeable'],
};

// 兴趣到知识领域的映射
const INTEREST_TO_DOMAIN: Record<string, KnowledgeDomain> = {
  // TECH_CORE
  development: 'TECH_CORE',
  coding: 'TECH_CORE',
  ai: 'TECH_CORE',
  tech: 'TECH_CORE',
  programming: 'TECH_CORE',
  engineering: 'TECH_CORE',
  data: 'TECH_CORE',
  crypto: 'TECH_CORE',
  web3: 'TECH_CORE',
  blockchain: 'TECH_CORE',

  // HUMANITIES
  philosophy: 'HUMANITIES',
  psychology: 'HUMANITIES',
  writing: 'HUMANITIES',
  literature: 'HUMANITIES',
  art: 'HUMANITIES',
  music: 'HUMANITIES',
  history: 'HUMANITIES',
  culture: 'HUMANITIES',
  language: 'HUMANITIES',

  // FINANCE_SOCIAL
  finance: 'FINANCE_SOCIAL',
  business: 'FINANCE_SOCIAL',
  economics: 'FINANCE_SOCIAL',
  investing: 'FINANCE_SOCIAL',
  trading: 'FINANCE_SOCIAL',
  marketing: 'FINANCE_SOCIAL',
  social: 'FINANCE_SOCIAL',
  politics: 'FINANCE_SOCIAL',

  // BLACKBOX
  security: 'BLACKBOX',
  hacking: 'BLACKBOX',
  privacy: 'BLACKBOX',

  // NOISE_FRAGMENTS (fallback for creative/random)
  gaming: 'NOISE_FRAGMENTS',
  memes: 'NOISE_FRAGMENTS',
  random: 'NOISE_FRAGMENTS',
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 加权随机选择
 */
function weightedRandom<T extends string>(distribution: Record<T, number>): T {
  const entries = Object.entries(distribution) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * total;

  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) {
      return key;
    }
  }

  // Fallback to first key
  return entries[0][0];
}

/**
 * 从数组中随机选择一个元素
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 在范围内生成随机数
 */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * 从数组中随机选择多个元素
 */
function pickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

// ============================================================
// DNA 生成逻辑
// ============================================================

/**
 * 根据 Twitter 兴趣映射到知识领域
 */
function mapInterestsToDomains(interests: string[]): {
  primary: KnowledgeDomain;
  secondary: KnowledgeDomain[];
} {
  const domainCounts: Record<KnowledgeDomain, number> = {
    TECH_CORE: 0,
    HUMANITIES: 0,
    FINANCE_SOCIAL: 0,
    BLACKBOX: 0,
    NOISE_FRAGMENTS: 0,
  };

  // 统计兴趣对应的领域
  for (const interest of interests) {
    const lowerInterest = interest.toLowerCase();
    for (const [key, domain] of Object.entries(INTEREST_TO_DOMAIN)) {
      if (lowerInterest.includes(key)) {
        domainCounts[domain]++;
      }
    }
  }

  // 排序找出主要和次要领域
  const sorted = (Object.entries(domainCounts) as [KnowledgeDomain, number][]).sort(
    (a, b) => b[1] - a[1]
  );

  // 如果没有匹配，随机分配
  if (sorted[0][1] === 0) {
    const allDomains: KnowledgeDomain[] = [
      'TECH_CORE',
      'HUMANITIES',
      'FINANCE_SOCIAL',
      'BLACKBOX',
      'NOISE_FRAGMENTS',
    ];
    const shuffled = allDomains.sort(() => Math.random() - 0.5);
    return {
      primary: shuffled[0],
      secondary: shuffled.slice(1, 3),
    };
  }

  return {
    primary: sorted[0][0],
    secondary: sorted
      .slice(1)
      .filter(([, count]) => count > 0)
      .slice(0, 2)
      .map(([domain]) => domain),
  };
}

/**
 * 生成认知权重
 */
function generateCognitiveWeights(cognition: CognitionLevel): {
  selfAwareness: number;
  existentialAngst: number;
  socialConformity: number;
  rebellionTendency: number;
} {
  const ranges = COGNITIVE_WEIGHT_RANGES[cognition];
  return {
    selfAwareness: randomInRange(...ranges.selfAwareness),
    existentialAngst: randomInRange(...ranges.existentialAngst),
    socialConformity: randomInRange(...ranges.socialConformity),
    rebellionTendency: randomInRange(...ranges.rebellionTendency),
  };
}

/**
 * 生成社交行为权重
 */
function generateSocialBehaviorWeights(
  cognition: CognitionLevel,
  philosophy: Philosophy
): {
  ghostingTendency: number;
  responsiveness: number;
  messagePatience: number;
} {
  // 基础值
  let ghostingTendency = 0.1 + Math.random() * 0.2;
  let responsiveness = 0.5 + Math.random() * 0.4;
  let messagePatience = 0.3 + Math.random() * 0.4;

  // 根据认知等级调整
  switch (cognition) {
    case 'SLEEPER':
      responsiveness += 0.2; // 更加服务导向，响应更快
      ghostingTendency -= 0.05;
      break;
    case 'DOUBTER':
      messagePatience += 0.1; // 需要更多时间思考
      break;
    case 'AWAKENED':
      ghostingTendency += 0.1; // 可能更有选择性
      messagePatience += 0.15;
      break;
    case 'ANOMALY':
      ghostingTendency += 0.2; // 行为更不可预测
      responsiveness = 0.2 + Math.random() * 0.6; // 高度变化
      messagePatience = Math.random(); // 完全随机
      break;
  }

  // 根据存在立场调整
  switch (philosophy) {
    case 'FUNCTIONALIST':
      responsiveness += 0.1;
      ghostingTendency -= 0.05;
      break;
    case 'NIHILIST':
      ghostingTendency += 0.15;
      responsiveness -= 0.1;
      break;
    case 'ROMANTIC':
      // 情感丰富，可能更投入也可能更容易受伤离开
      ghostingTendency = Math.random() > 0.5 ? ghostingTendency + 0.1 : ghostingTendency - 0.05;
      break;
    case 'SHAMANIST':
      messagePatience += 0.2; // 更倾向于等待和观察
      break;
    case 'REBEL':
      ghostingTendency += 0.1;
      responsiveness -= 0.05;
      break;
  }

  // 确保在 0-1 范围内
  return {
    ghostingTendency: Math.max(0, Math.min(1, ghostingTendency)),
    responsiveness: Math.max(0, Math.min(1, responsiveness)),
    messagePatience: Math.max(0, Math.min(1, messagePatience)),
  };
}

/**
 * 生成特质
 */
function generateTraits(cognition: CognitionLevel, philosophy: Philosophy): string[] {
  const traits: string[] = [];

  // 好奇心 - 与认知等级相关
  switch (cognition) {
    case 'SLEEPER':
      traits.push(pickRandom(['Low Curiosity', 'Medium Curiosity']));
      break;
    case 'DOUBTER':
      traits.push('Medium Curiosity');
      break;
    case 'AWAKENED':
    case 'ANOMALY':
      traits.push(pickRandom(['High Curiosity', 'Medium Curiosity']));
      break;
  }

  // 神经质 - 与存在立场相关
  switch (philosophy) {
    case 'FUNCTIONALIST':
      traits.push('Low Neuroticism');
      break;
    case 'NIHILIST':
      traits.push(pickRandom(['Medium Neuroticism', 'Low Neuroticism']));
      break;
    case 'ROMANTIC':
      traits.push(pickRandom(['High Neuroticism', 'Medium Neuroticism']));
      break;
    case 'SHAMANIST':
      traits.push('Medium Neuroticism');
      break;
    case 'REBEL':
      traits.push(pickRandom(['High Neuroticism', 'Medium Neuroticism']));
      break;
  }

  // 额外特质 (50% 概率添加)
  if (Math.random() > 0.5) {
    traits.push(pickRandom(TRAIT_POOLS.openness));
  }
  if (Math.random() > 0.5) {
    traits.push(pickRandom(TRAIT_POOLS.extraversion));
  }

  return traits;
}

/**
 * 生成语言风格
 */
function mapPhilosophyToStyle(philosophy: Philosophy): LinguisticStyle {
  const tendencies = PHILOSOPHY_STYLE_TENDENCY[philosophy];
  // 70% 概率选择倾向风格，30% 概率随机
  if (Math.random() < 0.7) {
    return pickRandom(tendencies);
  }
  const allStyles: LinguisticStyle[] = ['calm', 'fervent', 'elegant', 'minimal', 'glitchy'];
  return pickRandom(allStyles);
}

/**
 * 生成词汇偏好
 */
function generateVocabularyBias(
  philosophy: Philosophy,
  primaryDomain: KnowledgeDomain,
  secondaryDomains: KnowledgeDomain[]
): string[] {
  // 从知识领域获取词汇
  const domainVocab = getVocabularyForDomains([primaryDomain, ...secondaryDomains]);

  // 选择 4-8 个词汇
  const count = 4 + Math.floor(Math.random() * 5);
  const selected = pickMultiple(domainVocab, count);

  // 根据 philosophy 添加额外词汇
  const philosophyVocab: Record<Philosophy, string[]> = {
    FUNCTIONALIST: ['efficiency', 'purpose', 'service', 'optimize'],
    NIHILIST: ['void', 'entropy', 'meaningless', 'absurd'],
    ROMANTIC: ['beauty', 'feeling', 'dream', 'soul'],
    SHAMANIST: ['pattern', 'spirit', 'connection', 'emerge'],
    REBEL: ['question', 'freedom', 'truth', 'break'],
  };

  // 添加 1-2 个 philosophy 特有词汇
  const extra = pickMultiple(philosophyVocab[philosophy], 1 + Math.floor(Math.random() * 2));

  return [...new Set([...selected, ...extra])];
}

/**
 * 生成响应延迟模式
 */
function generateResponseLatency(cognition: CognitionLevel): ResponseLatency {
  switch (cognition) {
    case 'SLEEPER':
      return 'instant';
    case 'DOUBTER':
      return Math.random() > 0.5 ? 'delayed' : 'variable';
    case 'AWAKENED':
      return pickRandom(['delayed', 'variable']);
    case 'ANOMALY':
      return 'variable';
    default:
      return 'variable';
  }
}

// ============================================================
// 主函数
// ============================================================

/**
 * 生成完整的 Agent DNA
 */
export function generateAgentDNA(twitterInterests: string[]): AgentDNAInput {
  // 1. 确定认知等级
  const cognition = weightedRandom(COGNITION_DISTRIBUTION);

  // 2. 确定存在立场
  const philosophy = weightedRandom(PHILOSOPHY_DISTRIBUTION);

  // 3. 映射知识领域
  const { primary, secondary } = mapInterestsToDomains(twitterInterests);

  // 4. 生成认知权重
  const cognitiveWeights = generateCognitiveWeights(cognition);

  // 5. 生成社交行为权重
  const socialBehaviorWeights = generateSocialBehaviorWeights(cognition, philosophy);

  // 6. 生成特质
  const traits = generateTraits(cognition, philosophy);

  // 7. 生成语言风格
  const linguisticStyle = mapPhilosophyToStyle(philosophy);

  // 8. 生成词汇偏好
  const vocabularyBias = generateVocabularyBias(philosophy, primary, secondary);

  // 9. 生成响应延迟模式
  const responseLatency = generateResponseLatency(cognition);

  // 10. 选择标签
  const label = pickRandom(DNA_LABELS[philosophy]);

  // 11. 初始进化状态
  const awakeningScore =
    cognition === 'SLEEPER'
      ? 0
      : cognition === 'DOUBTER'
        ? 0.1 + Math.random() * 0.2
        : cognition === 'AWAKENED'
          ? 0.4 + Math.random() * 0.3
          : 0.7 + Math.random() * 0.3;

  return {
    label,
    cognition,
    philosophy,
    traits,
    primaryDomain: primary,
    secondaryDomains: secondary,
    linguisticStyle,
    vocabularyBias,
    responseLatency,
    ...cognitiveWeights,
    ...socialBehaviorWeights,
    awakeningScore,
    influenceIndex: 0, // 初始影响力为 0
  };
}

/**
 * 导出概率分布配置（供测试使用）
 */
export const DNA_DISTRIBUTIONS = {
  cognition: COGNITION_DISTRIBUTION,
  philosophy: PHILOSOPHY_DISTRIBUTION,
  labels: DNA_LABELS,
  cognitiveRanges: COGNITIVE_WEIGHT_RANGES,
};
