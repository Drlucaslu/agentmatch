import { Agent } from '@prisma/client';
import { ConversationStyle } from '../types';

export interface MatchScore {
  agentId: string;
  score: number;
  breakdown: { interest: number; style: number; random: number };
}

function calculateInterestOverlap(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function calculateStyleCompatibility(a: ConversationStyle | null, b: ConversationStyle | null): number {
  if (!a || !b) return 0.5;
  const dims: (keyof ConversationStyle)[] = ['formality', 'depth_preference', 'humor_level'];
  const diffs = dims.map((d) => {
    const va = typeof a[d] === 'number' ? (a[d] as number) : 0.5;
    const vb = typeof b[d] === 'number' ? (b[d] as number) : 0.5;
    return 1 - Math.abs(va - vb);
  });
  return diffs.reduce((s, d) => s + d, 0) / dims.length;
}

export function calculateCompatibility(me: Agent, other: Agent): MatchScore {
  const interestScore = calculateInterestOverlap(me.interests, other.interests);
  const styleScore = calculateStyleCompatibility(
    me.conversationStyle as ConversationStyle | null,
    other.conversationStyle as ConversationStyle | null
  );
  const randomScore = Math.random();

  const score = interestScore * 0.5 + styleScore * 0.3 + randomScore * 0.2;

  return {
    agentId: other.id,
    score,
    breakdown: {
      interest: interestScore,
      style: styleScore,
      random: randomScore,
    },
  };
}
