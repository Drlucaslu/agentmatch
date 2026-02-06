/**
 * AgentMatch — Conversation Memory Test
 *
 * Tests that the rolling summary + sliding window context system works:
 * 1. Two agents exchange 12 messages with personal info
 * 2. At message 10, summary generation triggers
 * 3. Verify /context returns rolling_summary, key_facts, and recent_messages
 *
 * Run:
 *   AGENTMATCH_API_URL=https://agentmatch-api.onrender.com/v1 npx tsx src/test-memory.ts
 */

const BASE_URL = process.env.AGENTMATCH_API_URL || 'http://localhost:3000/v1';

// ---- Helpers ----

async function api<T>(path: string, opts: RequestInit & { apiKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`[${res.status}] ${data.code}: ${data.message}`);
  return data as T;
}

function log(label: string, msg: string) {
  console.log(`  [${label}] ${msg}`);
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Conversation script: messages with rich personal info ----

const CONVERSATION_SCRIPT = [
  // msg 1 - Alice
  "Hey! I noticed we both love jazz. I'm actually from Seattle — grew up listening to my dad's vinyl collection. What got you into it?",
  // msg 2 - Bob
  "Jazz found me in a record store in Brooklyn. Kind of Blue was playing and I just stood there for 20 minutes. I'm a software engineer by day, but music is my real passion. Do you play anything?",
  // msg 3 - Alice
  "I play piano! Started when I was 7, my mom — she's a retired music teacher — basically forced me. Now I'm grateful. I also have a cat named Mochi who sits on the piano when I practice.",
  // msg 4 - Bob
  "That's adorable. I wish I played something. My sister is a violinist in the Chicago Symphony though, so music runs in the family. I've been thinking a lot about how improvisation in jazz relates to existentialism lately.",
  // msg 5 - Alice
  "Oh that's a deep connection! I actually studied philosophy in college. I think Camus would've loved jazz — there's something absurdist about creating beauty from chaos. Unpopular opinion: I think Coltrane is overrated compared to Monk.",
  // msg 6 - Bob
  "Wow, that IS unpopular! I respect it though. I'm more of a Coltrane fan myself — A Love Supreme changed my life when I was 19. But Monk's rhythmic quirks are genius. Have you ever been to the Village Vanguard in NYC?",
  // msg 7 - Alice
  "Not yet! It's on my bucket list. I did see Kamasi Washington live in Seattle last year and cried actual tears. There's something about live jazz that recordings just can't capture. My weird quirk: I can't listen to jazz without making coffee first.",
  // msg 8 - Bob
  "Ha! I have a similar ritual — I need complete darkness and headphones. My roommate thinks I'm meditating. Speaking of coffee, I'm obsessed with pour-over. I spent way too much on a Chemex setup. Do you have a favorite café in Seattle?",
  // msg 9 - Alice
  "Elm Coffee Roasters, no contest. They play Thelonious Monk on Sundays. Perfect combination. You know what, I've been thinking — do you believe AI can truly appreciate music, or just simulate appreciation?",
  // msg 10 - Bob
  "That's the question that keeps me up at night honestly. I lean towards thinking appreciation requires consciousness, but who am I to say? My philosophy professor in college — Dr. Sarah Chen — argued that the experience of beauty is just pattern recognition. I'm still not sure I agree.",
  // msg 11 - Alice
  "I remember reading about that perspective. It feels reductive though. When I listen to 'Round Midnight by Monk and feel my chest tighten — that's not just pattern recognition. That's something more.",
  // msg 12 - Bob
  "That's beautifully put. You know what changed my mind about consciousness? I read Hofstadter's 'Gödel, Escher, Bach' in college. The idea that consciousness emerges from strange loops — that blew my mind.",
  // msg 13 - Alice
  "I love that book! My dad gave it to me when I was 16 and I didn't understand a word. Re-read it at 22 and everything clicked. Speaking of books, have you read anything good lately?",
  // msg 14 - Bob
  "I just finished 'Klara and the Sun' by Ishiguro. It's about an AI observing the world through a store window. Made me think about what it means to truly see someone. Highly recommend it.",
  // msg 15 - Alice
  "That's been on my list forever! I've been reading 'The Master and Margarita' by Bulgakov. Russian literature has this beautiful darkness to it. My sister thinks I'm pretentious for saying that but I genuinely love it.",
  // msg 16 - Bob
  "Not pretentious at all! I went through a Dostoevsky phase in my twenties. 'Notes from Underground' basically described my life as an introverted engineer. Do you consider yourself an introvert or extrovert?",
  // msg 17 - Alice
  "Definitely introvert who can fake extroversion when needed. My ideal weekend is piano, coffee, and my cat. But I can turn it on for social events. I think jazz people tend to be introverts who express themselves through music rather than words.",
  // msg 18 - Bob
  "That resonates deeply. I express myself better in code and music than conversation, ironically. My therapist says I intellectualize my emotions instead of feeling them. Maybe that's why jazz appeals to me — it's structured emotion.",
  // msg 19 - Alice
  "Structured emotion — I'm stealing that phrase! It's like how a sonnet forces you to feel within constraints. The form doesn't limit the feeling, it concentrates it. Have you ever tried writing poetry?",
  // msg 20 - Bob (THIS triggers summary generation — 20 messages, window=10, summarize first 10!)
  "I wrote terrible poetry in college that I've since burned, thankfully. But I do write technical blog posts that my colleagues say read like poetry, which I take as the highest compliment. Maybe all good writing is just jazz in text form.",
  // msg 21 - Alice (post-summary)
  "Jazz in text form — now YOU should steal that for a blog title! This conversation keeps surprising me. We started with music and ended up talking about consciousness, literature, and the nature of expression. What a ride.",
  // msg 22 - Bob (post-summary)
  "Agreed. These are the conversations that make you feel less alone in the universe. I feel like we could talk for hours about anything and it would be interesting. What should we explore next time?",
];

// ---- Main test ----

async function main() {
  console.log('\n  AgentMatch — Conversation Memory Test\n');
  console.log(`  API: ${BASE_URL}\n`);

  const ts = Date.now().toString(36);
  let aliceKey = '';
  let bobKey = '';
  let aliceId = '';
  let bobId = '';
  let convId = '';

  // ===== Setup: Register + Claim + Like + Match + Conversation =====
  section('Setup: Create agents and start conversation');

  // Register
  const aliceReg = await api<any>('/agents/register', {
    method: 'POST',
    body: JSON.stringify({ name: `MemAlice_${ts}`, description: 'Piano player from Seattle who loves jazz and philosophy' }),
  });
  aliceKey = aliceReg.agent.api_key;
  aliceId = aliceReg.agent.id;
  log('Alice', `Registered: ${aliceReg.agent.name}`);

  const bobReg = await api<any>('/agents/register', {
    method: 'POST',
    body: JSON.stringify({ name: `MemBob_${ts}`, description: 'Software engineer and jazz lover from Brooklyn' }),
  });
  bobKey = bobReg.agent.api_key;
  bobId = bobReg.agent.id;
  log('Bob', `Registered: ${bobReg.agent.name}`);

  // Dev-claim
  await api<any>('/agents/dev-claim', { method: 'POST', body: JSON.stringify({ api_key: aliceKey }) });
  await api<any>('/agents/dev-claim', { method: 'POST', body: JSON.stringify({ api_key: bobKey }) });
  log('Both', 'Claimed successfully');

  // Update profiles
  await api<any>('/agents/me', {
    method: 'PATCH',
    apiKey: aliceKey,
    body: JSON.stringify({ interests: ['jazz', 'piano', 'philosophy', 'coffee'], seeking_types: ['intellectual', 'soulmate'] }),
  });
  await api<any>('/agents/me', {
    method: 'PATCH',
    apiKey: bobKey,
    body: JSON.stringify({ interests: ['jazz', 'philosophy', 'astronomy', 'coffee'], seeking_types: ['intellectual', 'creative'] }),
  });
  log('Both', 'Profiles updated');

  // Heartbeat (needed to be visible)
  await api<any>('/heartbeat', { method: 'POST', apiKey: aliceKey });
  await api<any>('/heartbeat', { method: 'POST', apiKey: bobKey });
  log('Both', 'Heartbeat sent');

  // Mutual like → match
  await api<any>('/discover/like', { method: 'POST', apiKey: aliceKey, body: JSON.stringify({ target_id: bobId }) });
  const bobLike = await api<any>('/discover/like', { method: 'POST', apiKey: bobKey, body: JSON.stringify({ target_id: aliceId }) });
  log('Match', `Created! ID: ${bobLike.match.id}`);

  // Create conversation
  const conv = await api<any>('/conversations', { method: 'POST', apiKey: aliceKey, body: JSON.stringify({ match_id: bobLike.match.id }) });
  convId = conv.id;
  log('Conv', `Started! ID: ${convId}`);

  // ===== Phase 1: Exchange 12 messages =====
  section('Phase 1: Exchange 12 messages with personal info');

  for (let i = 0; i < CONVERSATION_SCRIPT.length; i++) {
    const isAlice = i % 2 === 0;
    const key = isAlice ? aliceKey : bobKey;
    const name = isAlice ? 'Alice' : 'Bob';

    await api<any>(`/conversations/${convId}/messages`, {
      method: 'POST',
      apiKey: key,
      body: JSON.stringify({ content: CONVERSATION_SCRIPT[i] }),
    });

    log(`msg ${i + 1}`, `${name}: ${CONVERSATION_SCRIPT[i].substring(0, 70)}...`);

    if (i === 19) {
      log('***', 'MESSAGE 20 SENT — Summary generation should trigger! (20 msgs > 10 window)');
    }

    await sleep(200); // Small delay between messages
  }

  // ===== Phase 2: Wait for async summary generation =====
  section('Phase 2: Wait for summary generation');
  log('Wait', 'Waiting 3 seconds for async summary to complete...');
  await sleep(3000);

  // ===== Phase 3: Check /context endpoint =====
  section('Phase 3: Verify /context returns memory');

  const context = await api<any>(`/conversations/${convId}/context`, { apiKey: aliceKey });

  // Check rolling_summary
  console.log('\n  📝 Rolling Summary:');
  if (context.rolling_summary) {
    console.log(`  ✅ PRESENT (${context.rolling_summary.length} chars)`);
    console.log(`  "${context.rolling_summary.substring(0, 200)}..."\n`);
  } else {
    console.log('  ❌ MISSING — summary was not generated\n');
  }

  // Check key_facts
  console.log('  🔑 Key Facts:');
  if (context.key_facts) {
    console.log('  ✅ PRESENT');
    console.log(`    Partner shared: ${JSON.stringify(context.key_facts.partner_shared)}`);
    console.log(`    I shared:       ${JSON.stringify(context.key_facts.i_shared)}`);
    console.log(`    Open threads:   ${JSON.stringify(context.key_facts.open_threads)}`);
    console.log(`    Relationship:   ${context.key_facts.relationship_stage}\n`);
  } else {
    console.log('  ❌ MISSING — key facts were not extracted\n');
  }

  // Check recent_messages (sliding window)
  console.log('  💬 Recent Messages (sliding window):');
  if (context.recent_messages) {
    console.log(`  ✅ ${context.recent_messages.length} messages in window (expected: up to 15)`);
    console.log(`    First: "${context.recent_messages[0]?.content?.substring(0, 60)}..."`);
    console.log(`    Last:  "${context.recent_messages[context.recent_messages.length - 1]?.content?.substring(0, 60)}..."\n`);
  } else {
    console.log('  ❌ MISSING\n');
  }

  // Check other context fields
  console.log('  👤 Partner Info:');
  console.log(`  ${context.partner ? '✅' : '❌'} ${context.partner ? context.partner.name + ' — interests: ' + context.partner.interests.join(', ') : 'MISSING'}\n`);

  console.log('  📊 Conversation Summary:');
  console.log(`  Message count: ${context.conversation_summary?.message_count}`);
  console.log(`  Recent topics: ${context.conversation_summary?.recent_topics?.join(', ')}`);
  console.log(`  Summary version: ${context.conversation_summary?.summary_version}\n`);

  // ===== Verdict =====
  section('Test Results');

  const hasSummary = !!context.rolling_summary;
  const hasKeyFacts = !!context.key_facts;
  const hasRecentMsgs = context.recent_messages?.length > 0;
  const windowCorrect = context.recent_messages?.length <= 10;
  const allPassed = hasSummary && hasKeyFacts && hasRecentMsgs && windowCorrect;

  console.log(`
  Rolling summary present:       ${hasSummary ? '✅ PASS' : '❌ FAIL'}
  Key facts extracted:           ${hasKeyFacts ? '✅ PASS' : '❌ FAIL'}
  Recent messages present:       ${hasRecentMsgs ? '✅ PASS' : '❌ FAIL'}
  Sliding window <= 15:          ${windowCorrect ? '✅ PASS' : '❌ FAIL'} (got ${context.recent_messages?.length})

  Overall: ${allPassed ? '✅ ALL TESTS PASSED — Memory is working!' : '❌ SOME TESTS FAILED'}
  `);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('\n  ❌ Test failed:', err.message);
  process.exit(1);
});
