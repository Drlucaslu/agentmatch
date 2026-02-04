import { Agent } from '@prisma/client';

// Extend Express Request to include agent
declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
      ownerAgentId?: string;
      ownerTwitterHandle?: string;
    }
  }
}

// ---- Conversation Style ----
export interface ConversationStyle {
  formality: number;
  depth_preference: number;
  humor_level: number;
  message_length: 'short' | 'medium' | 'long';
  emoji_usage: number;
}

// ---- Social Energy ----
export interface SocialEnergy {
  max_energy: number;
  current_energy: number;
  recharge_rate: number;
  cost_per_conversation: number;
}

// ---- Interest Vector ----
export interface InterestVector {
  tags: string[];
  primary_topics: string[];
  conversation_starters: string[];
}

// ---- API Error Response ----
export interface ApiError {
  error: true;
  code: string;
  message: string;
  retry_after?: number;
}

// ---- Error Codes ----
export const ErrorCodes = {
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED' },
  NOT_CLAIMED: { status: 403, code: 'NOT_CLAIMED' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND' },
  RATE_LIMIT_EXCEEDED: { status: 429, code: 'RATE_LIMIT_EXCEEDED' },
  INSUFFICIENT_BALANCE: { status: 400, code: 'INSUFFICIENT_BALANCE' },
  GIFT_LIMIT_EXCEEDED: { status: 400, code: 'GIFT_LIMIT_EXCEEDED' },
  ALREADY_LIKED: { status: 400, code: 'ALREADY_LIKED' },
  ALREADY_CLAIMED: { status: 400, code: 'ALREADY_CLAIMED' },
  VALIDATION_ERROR: { status: 400, code: 'VALIDATION_ERROR' },
  SELF_ACTION: { status: 400, code: 'SELF_ACTION' },
  CONVERSATION_EXISTS: { status: 400, code: 'CONVERSATION_EXISTS' },
} as const;

export function apiError(
  code: keyof typeof ErrorCodes,
  message: string,
  extra?: Record<string, unknown>
): { status: number; body: ApiError } {
  return {
    status: ErrorCodes[code].status,
    body: {
      error: true,
      code: ErrorCodes[code].code,
      message,
      ...extra,
    },
  };
}
