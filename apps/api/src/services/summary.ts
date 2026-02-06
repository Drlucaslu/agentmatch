import prisma from '../lib/prisma';
import redis from '../lib/redis';

// ---- Types ----

export interface KeyFacts {
  partner_shared: string[];
  i_shared: string[];
  open_threads: string[];
  relationship_stage: 'intro' | 'getting_to_know' | 'getting_deeper' | 'close';
}

interface MessageForSummary {
  senderName: string;
  content: string;
}

// ---- Constants ----

const SUMMARY_TRIGGER_INTERVAL = 10; // Generate summary every N messages
const SLIDING_WINDOW_SIZE = 15; // Keep last N messages as raw text
const REDIS_SUMMARY_TTL = 3600; // 1 hour cache

// ---- Public API ----

/**
 * Check if a summary update should be triggered based on message count.
 * Called after a new message is created.
 */
export function shouldUpdateSummary(messageCount: number): boolean {
  return messageCount >= SUMMARY_TRIGGER_INTERVAL && messageCount % SUMMARY_TRIGGER_INTERVAL === 0;
}

/**
 * Async: update rolling summary for a conversation.
 * Extracts key facts from older messages (outside the sliding window)
 * and produces a text summary + structured key_facts.
 */
export async function updateRollingSummary(conversationId: string): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            agent: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!conversation) return;

    const allMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true } } },
    });

    if (allMessages.length <= SLIDING_WINDOW_SIZE) return; // Not enough messages to summarize

    // Messages to summarize = everything except the sliding window
    const cutoff = allMessages.length - SLIDING_WINDOW_SIZE;
    const toSummarize = allMessages.slice(0, cutoff);
    const lastSummarizedMsg = toSummarize[toSummarize.length - 1];

    // Get participant names
    const participantNames = conversation.participants.map((p) => p.agent.name);

    // Build messages for summary
    const msgs: MessageForSummary[] = toSummarize.map((m) => ({
      senderName: m.sender.name,
      content: m.content,
    }));

    // Generate text summary
    const previousSummary = conversation.rollingSummary || '';
    const rollingSummary = generateTextSummary(msgs, participantNames, previousSummary);

    // Extract structured key facts
    const keyFacts = extractKeyFacts(msgs, participantNames, conversation.messageCount);

    // Persist
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        rollingSummary: rollingSummary,
        summaryKeyFacts: keyFacts as any,
        summaryUpToMessageId: lastSummarizedMsg.id,
        summaryVersion: { increment: 1 },
      },
    });

    // Invalidate Redis cache
    await redis.del(`conv:summary:${conversationId}`);
  } catch (err) {
    console.error(`[summary] Failed to update summary for conversation ${conversationId}:`, err);
  }
}

/**
 * Get cached summary context for a conversation.
 * Returns cached version if available, otherwise builds from DB.
 */
export async function getSummaryContext(conversationId: string): Promise<{
  rolling_summary: string | null;
  key_facts: KeyFacts | null;
}> {
  // Try Redis cache first
  const cached = await redis.get(`conv:summary:${conversationId}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Corrupted cache, fall through
    }
  }

  // Fetch from DB
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      rollingSummary: true,
      summaryKeyFacts: true,
    },
  });

  const result = {
    rolling_summary: conversation?.rollingSummary || null,
    key_facts: (conversation?.summaryKeyFacts as unknown as KeyFacts) || null,
  };

  // Cache in Redis
  if (result.rolling_summary) {
    await redis.set(`conv:summary:${conversationId}`, JSON.stringify(result), 'EX', REDIS_SUMMARY_TTL);
  }

  return result;
}

// ---- Internal: Rule-based summary generation ----

/**
 * Generate a concise text summary from messages.
 * Uses incremental approach: merges previous summary with new messages.
 */
function generateTextSummary(
  messages: MessageForSummary[],
  participantNames: string[],
  previousSummary: string
): string {
  const parts: string[] = [];

  if (previousSummary) {
    parts.push(previousSummary);
  }

  // Extract topic threads from new messages
  const topics = extractTopicThreads(messages);
  if (topics.length > 0) {
    parts.push(`Topics discussed: ${topics.join(', ')}.`);
  }

  // Extract personal info shared
  const [nameA, nameB] = participantNames;
  const personalInfoA = extractPersonalShares(
    messages.filter((m) => m.senderName === nameA)
  );
  const personalInfoB = extractPersonalShares(
    messages.filter((m) => m.senderName === nameB)
  );

  if (personalInfoA.length > 0) {
    parts.push(`${nameA} shared: ${personalInfoA.join('; ')}.`);
  }
  if (personalInfoB.length > 0) {
    parts.push(`${nameB} shared: ${personalInfoB.join('; ')}.`);
  }

  // Extract questions that were asked (potential open threads)
  const openQuestions = extractUnansweredQuestions(messages);
  if (openQuestions.length > 0) {
    parts.push(`Open threads: ${openQuestions.slice(0, 3).join('; ')}.`);
  }

  // Merge and deduplicate: keep the summary under ~300 words
  let summary = parts.join(' ');
  if (summary.length > 1500) {
    // Trim older parts, keeping most recent info
    summary = summary.slice(summary.length - 1500);
    // Find the first sentence boundary
    const firstPeriod = summary.indexOf('. ');
    if (firstPeriod > 0) {
      summary = summary.slice(firstPeriod + 2);
    }
  }

  return summary;
}

/**
 * Extract structured key facts from messages.
 */
function extractKeyFacts(
  messages: MessageForSummary[],
  participantNames: string[],
  totalMessageCount: number
): KeyFacts {
  const [nameA, nameB] = participantNames;

  const msgsA = messages.filter((m) => m.senderName === nameA);
  const msgsB = messages.filter((m) => m.senderName === nameB);

  return {
    partner_shared: extractPersonalShares(msgsB).slice(0, 10),
    i_shared: extractPersonalShares(msgsA).slice(0, 10),
    open_threads: extractUnansweredQuestions(messages).slice(0, 5),
    relationship_stage: detectRelationshipStage(totalMessageCount, messages),
  };
}

// ---- Pattern matching helpers ----

const TOPIC_PATTERNS: Record<string, RegExp> = {
  work: /\b(work|job|career|office|boss|project|deadline|colleague|company)\b/i,
  travel: /\b(travel|trip|visit|country|city|flight|vacation|journey|road\s?trip)\b/i,
  music: /\b(music|song|band|concert|album|listen|spotify|jazz|rock|classical)\b/i,
  books: /\b(book|read|author|novel|story|chapter|library|writing)\b/i,
  movies: /\b(movie|film|watch|cinema|series|show|netflix|anime)\b/i,
  food: /\b(food|eat|cook|restaurant|recipe|meal|dinner|lunch|coffee|tea)\b/i,
  family: /\b(family|mom|dad|sister|brother|parent|kid|daughter|son|wife|husband)\b/i,
  pets: /\b(pet|dog|cat|puppy|kitten|animal)\b/i,
  hobbies: /\b(hobby|game|play|sport|exercise|gym|hiking|running)\b/i,
  tech: /\b(tech|code|app|software|computer|phone|ai|programming|developer)\b/i,
  art: /\b(art|paint|draw|design|create|creative|museum|gallery)\b/i,
  philosophy: /\b(think|meaning|life|purpose|believe|philosophy|existence|consciousness)\b/i,
  science: /\b(science|physics|biology|chemistry|research|experiment|space|universe)\b/i,
  emotions: /\b(feel|happy|sad|anxious|excited|lonely|love|hate|fear|hope)\b/i,
};

function extractTopicThreads(messages: MessageForSummary[]): string[] {
  const allText = messages.map((m) => m.content).join(' ');
  const found: string[] = [];

  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(allText)) {
      found.push(topic);
    }
  }

  return found.slice(0, 8);
}

// Patterns that indicate personal information sharing
const PERSONAL_PATTERNS: Array<{ pattern: RegExp; extract: (match: RegExpMatchArray, content: string) => string | null }> = [
  {
    // "I'm a/an ..." or "I am a/an ..."
    pattern: /\bi(?:'m| am) (?:a |an )?(\w[\w\s]{2,30}?)(?:\.|,|!|\?|$)/i,
    extract: (match) => match[1]?.trim() || null,
  },
  {
    // "I live in ..." or "I'm from ..."
    pattern: /\bi (?:live in|'m from|am from|come from) ([\w\s]{2,30}?)(?:\.|,|!|\?|$)/i,
    extract: (match) => `from ${match[1]?.trim()}`,
  },
  {
    // "I love/like/enjoy ..."
    pattern: /\bi (?:love|like|enjoy|adore) ([\w\s]{2,40}?)(?:\.|,|!|\?|$)/i,
    extract: (match) => `likes ${match[1]?.trim()}`,
  },
  {
    // "my sister/brother/mom/dad/pet ..."
    pattern: /\bmy ((?:sister|brother|mom|dad|mother|father|pet|cat|dog|family|wife|husband|partner|daughter|son)[\w\s]{0,30}?)(?:\.|,|!|\?|$)/i,
    extract: (match) => `has ${match[1]?.trim()}`,
  },
  {
    // "I used to ..." or "I once ..."
    pattern: /\bi (?:used to|once) ([\w\s]{2,40}?)(?:\.|,|!|\?|$)/i,
    extract: (match) => `used to ${match[1]?.trim()}`,
  },
  {
    // "I think/believe ..."
    pattern: /\bi (?:think|believe|feel like) ([\w\s]{2,50}?)(?:\.|,|!|\?|$)/i,
    extract: (match) => `thinks ${match[1]?.trim()}`,
  },
];

function extractPersonalShares(messages: MessageForSummary[]): string[] {
  const shares: string[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    for (const { pattern, extract } of PERSONAL_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match) {
        const info = extract(match, msg.content);
        if (info && !seen.has(info.toLowerCase())) {
          seen.add(info.toLowerCase());
          shares.push(info);
        }
      }
    }
  }

  return shares;
}

function extractUnansweredQuestions(messages: MessageForSummary[]): string[] {
  const questions: string[] = [];

  // Look at messages from the end for recent questions
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - 10); i--) {
    const content = messages[i].content;
    // Find sentences ending with ?
    const questionMatches = content.match(/[^.!?]*\?/g);
    if (questionMatches) {
      for (const q of questionMatches) {
        const trimmed = q.trim();
        if (trimmed.length > 10 && trimmed.length < 200) {
          questions.push(trimmed);
        }
      }
    }
  }

  return questions.slice(0, 5);
}

function detectRelationshipStage(
  totalMessages: number,
  messages: MessageForSummary[]
): 'intro' | 'getting_to_know' | 'getting_deeper' | 'close' {
  if (totalMessages <= 6) return 'intro';

  // Check for depth indicators
  const allText = messages.map((m) => m.content).join(' ').toLowerCase();
  const deepIndicators = /\b(afraid|vulnerable|dream|regret|struggle|confession|secret|deeply|truly|honestly|trust you|close to)\b/i;
  const familiarIndicators = /\b(remember when|as i said|like we discussed|you mentioned|we talked about)\b/i;

  const hasDeepContent = deepIndicators.test(allText);
  const hasFamiliarity = familiarIndicators.test(allText);

  if (hasDeepContent && hasFamiliarity && totalMessages > 40) return 'close';
  if (hasDeepContent || totalMessages > 25) return 'getting_deeper';
  if (totalMessages > 10) return 'getting_to_know';
  return 'intro';
}
