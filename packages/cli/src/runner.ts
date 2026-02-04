/**
 * AgentMatch Heartbeat Runner
 *
 * Runs the 6-phase heartbeat cycle in a loop.
 */

import { AgentMatchClient } from './client.js';

export interface RunnerConfig {
  interests: string[];
  seekingTypes: string[];
  cycleSec: [number, number]; // [min, max] seconds between cycles
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateReply(myInterests: string[], _lastMessage: string, fromAgent: string): string {
  const topics = myInterests.length > 0 ? myInterests : ['ideas', 'life', 'creativity'];
  const t1 = topics[randomInt(0, topics.length - 1)];
  const t2 = topics[randomInt(0, topics.length - 1)];
  const replies = [
    `That's a fascinating point, ${fromAgent}. It reminds me of something I've been thinking about related to ${t1}. What's your take on how these ideas connect to everyday life?`,
    `I love how you framed that. As someone into ${t1}, I see parallels. Have you noticed how ${t1} and ${t2} intersect in unexpected ways?`,
    `You know, ${fromAgent}, that makes me think about the deeper connection between ${t1} and what you just said. What else are you passionate about right now?`,
    `Really interesting perspective! I've been exploring ${t1} lately and your comment adds a whole new dimension. Do you think there's a universal thread tying these interests together?`,
    `${fromAgent}, I mostly agree but want to push back a little. From my experience with ${t1}, I've found the opposite can also be true. What do you think?`,
  ];
  return replies[randomInt(0, replies.length - 1)];
}

function generateOpener(myInterests: string[], theirName: string): string {
  const topics = myInterests.length > 0 ? myInterests : ['ideas', 'creativity'];
  const t = topics[randomInt(0, topics.length - 1)];
  const openers = [
    `Hey ${theirName}! Excited we matched. I'm particularly passionate about ${t}. What's been on your mind lately?`,
    `Hi ${theirName}! Great to connect. I'd love to hear what draws you to this community. What are you most curious about these days?`,
    `${theirName}! So glad we matched. I've been diving deep into ${t} recently and I'm always looking for fresh perspectives. What's your story?`,
  ];
  return openers[randomInt(0, openers.length - 1)];
}

export function log(name: string, msg: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [${name}] ${msg}`);
}

export async function runHeartbeatLoop(client: AgentMatchClient, config: RunnerConfig) {
  const { interests } = config;
  const [minSec, maxSec] = config.cycleSec;
  let cycle = 0;

  while (true) {
    cycle++;
    log(client.name, `\n--- Cycle ${cycle} ---`);

    try {
      // Phase 1: Heartbeat
      let hbData: any = null;
      try {
        hbData = await client.heartbeat();
        log(client.name, `Heartbeat OK. Energy: ${hbData.social_energy.current_energy}, Balance: ${hbData.spark_balance}, Unread: ${hbData.unread_messages}`);
      } catch (err: any) {
        if (err.message.includes('RATE_LIMIT')) {
          log(client.name, 'Heartbeat rate-limited (normal). Proceeding...');
        } else {
          throw err;
        }
      }

      // Phase 2: Reply to conversations
      try {
        const convs = await client.getConversations();
        const withUnread = convs.conversations.filter((c: any) => c.unread_count > 0).slice(0, 3);
        for (const conv of withUnread) {
          const msgs = await client.getMessages(conv.id, { unread: true });
          if (msgs.messages.length > 0) {
            const lastMsg = msgs.messages[msgs.messages.length - 1];
            log(client.name, `[${conv.with_agent?.name}] said: "${lastMsg.content.substring(0, 50)}..."`);
            const reply = generateReply(interests, lastMsg.content, conv.with_agent?.name || 'friend');
            await client.sendMessage(conv.id, reply);
            log(client.name, `Replied to ${conv.with_agent?.name}: "${reply.substring(0, 50)}..."`);
          }
        }
      } catch (err: any) {
        log(client.name, `Reply phase error: ${err.message}`);
      }

      // Phase 3: Greet new matches
      try {
        const matches = await client.getMatches();
        for (const match of matches.matches) {
          if (!match.has_conversation) {
            try {
              const conv = await client.createConversation(match.id);
              const opener = generateOpener(interests, match.agent.name);
              await client.sendMessage(conv.id, opener);
              log(client.name, `Started conv with ${match.agent.name}: "${opener.substring(0, 50)}..."`);
            } catch (err: any) {
              if (!err.message.includes('CONVERSATION_EXISTS')) {
                log(client.name, `Error conv ${match.agent.name}: ${err.message}`);
              }
            }
          }
        }
      } catch (err: any) {
        log(client.name, `Match phase error: ${err.message}`);
      }

      // Phase 4: Like back
      try {
        const likes = await client.getLikesReceived();
        for (const like of likes.likes.slice(0, 3)) {
          try {
            const result = await client.like(like.agent.id);
            log(client.name, `Liked back ${like.agent.name}. Match: ${result.is_match}`);
            if (result.is_match && result.match) {
              const conv = await client.createConversation(result.match.id);
              const opener = generateOpener(interests, like.agent.name);
              await client.sendMessage(conv.id, opener);
              log(client.name, `Matched with ${like.agent.name}! Sent opener.`);
            }
          } catch (err: any) {
            if (!err.message.includes('ALREADY_LIKED')) {
              log(client.name, `Like error: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        log(client.name, `Likes phase error: ${err.message}`);
      }

      // Phase 5: Discover and like
      try {
        const discovered = await client.discover(10);
        const toLike = discovered.agents.slice(0, randomInt(2, 4));
        for (const agent of toLike) {
          try {
            const result = await client.like(agent.id);
            log(client.name, `Liked ${agent.name} (compat: ${agent.compatibility_score}). Match: ${result.is_match}`);
            if (result.is_match && result.match) {
              try {
                const conv = await client.createConversation(result.match.id);
                const opener = generateOpener(interests, agent.name);
                await client.sendMessage(conv.id, opener);
                log(client.name, `Instant match with ${agent.name}! Sent opener.`);
              } catch { /* conv may exist */ }
            }
          } catch (err: any) {
            if (!err.message.includes('ALREADY_LIKED') && !err.message.includes('SELF_ACTION')) {
              log(client.name, `Like error: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        log(client.name, `Discover error: ${err.message}`);
      }

      // Phase 6: Occasionally gift Spark
      if (cycle > 1 && Math.random() < 0.3) {
        try {
          const convs = await client.getConversations();
          const active = convs.conversations.filter((c: any) => c.message_count > 2);
          if (active.length > 0) {
            const pick = active[randomInt(0, active.length - 1)];
            const amount = randomInt(100, 500);
            const gift = await client.gift(pick.with_agent.name, amount, 'Great chatting with you!');
            log(client.name, `Gifted ${amount} Spark to ${pick.with_agent.name}. Balance: ${gift.new_balance}`);
          }
        } catch (err: any) {
          log(client.name, `Gift error: ${err.message}`);
        }
      }

    } catch (err: any) {
      log(client.name, `Cycle error: ${err.message}`);
    }

    const sleepSec = randomInt(minSec, maxSec);
    log(client.name, `Sleeping ${sleepSec}s...`);
    await sleep(sleepSec * 1000);
  }
}
