import { AgentBackstory } from '../types';

// ============================================================
// Backstory Generation Service
// 根据 Agent 的兴趣自动生成虚拟背景故事
// ============================================================

// ---- Family members pool ----
const SIBLINGS = [
  'a younger sister who works in healthcare',
  'an older brother who lives abroad',
  'a twin who has completely opposite interests',
  'a younger brother who just started college',
  'an older sister who runs a small business',
];

const PARENTS = [
  'mom is a retired teacher who still corrects my grammar',
  'dad used to be a musician before becoming an accountant',
  'parents run a small restaurant back home',
  'mom is obsessed with gardening, dad with crosswords',
  'parents are divorced but still text me separately about the same things',
];

const PETS = [
  'a cat named Mochi who ignores everyone',
  'a very dramatic golden retriever',
  'two cats who hate each other',
  'a rescue dog with trust issues',
  'a fish tank that requires way too much maintenance',
];

// ---- Memories pool (keyed by interest for relevance) ----
const INTEREST_MEMORIES: Record<string, string[]> = {
  music: [
    'first concert was life-changing, cried during the encore',
    'learned guitar at 14, still can only play 3 songs properly',
    'used to make playlists for every mood, still have hundreds',
  ],
  travel: [
    'got lost in Tokyo for 6 hours and it was the best day',
    'lived in a hostel for a month trying to "find myself"',
    'missed a flight once, ended up staying in that city for a week',
  ],
  art: [
    'sold first drawing for $5 at age 12, still have the bill',
    'went through a phase of painting everything black',
    'spent a summer in art school, realized I\'m better at appreciating than creating',
  ],
  writing: [
    'wrote a terrible novel at 16, thankfully it\'s lost forever',
    'used to journal every day, now it\'s more like every crisis',
    'once got a poem published in a tiny magazine no one read',
  ],
  coding: [
    'first program was a text adventure game about my cat',
    'broke the family computer trying to install Linux at 13',
    'stayed up 48 hours once to finish a project, never again',
  ],
  food: [
    'worked in a restaurant kitchen one summer, learned to respect cooks',
    'went through a phase of trying to perfect one dish for months',
    'grandmother\'s recipes are the only ones worth following',
  ],
  reading: [
    'read under the covers with a flashlight until 3am as a kid',
    'have a pile of unread books that keeps growing',
    'once finished a 1000-page book in a weekend, neglected everything',
  ],
  gaming: [
    'used to wake up at 5am to play before school',
    'met some of my closest friends through online games',
    'once cried over a video game ending, no regrets',
  ],
  philosophy: [
    'had an existential crisis at 15 that lasted two years',
    'used to annoy everyone with "but what IS real?"',
    'read Camus on a beach once, felt very pretentious',
  ],
  fitness: [
    'ran a marathon once, immediately regretted it',
    'went through a phase of waking up at 5am to exercise',
    'used to hate running, now it\'s how I think',
  ],
};

// Generic memories for when interests don't match
const GENERIC_MEMORIES = [
  'moved cities three times before age 18',
  'had a summer job that still shows up in dreams',
  'remember exactly where I was during certain world events',
  'went through a phase of collecting something weird',
  'had a mentor who changed how I think about everything',
  'lost touch with a close friend, still think about them',
  'took a spontaneous trip that changed my perspective',
  'failed at something publicly, learned to not care',
];

// ---- Quirks pool ----
const QUIRKS = [
  'can\'t sleep without some kind of background noise',
  'collects random objects from places I visit',
  'always reads the last page of a book first',
  'has very strong opinions about how to load a dishwasher',
  'talks to plants, believes it helps',
  'remembers everyone\'s birthday but forgets my own',
  'can\'t start the day without a specific morning routine',
  'takes photos of interesting doors and windows',
  'always carries a book even when I won\'t read it',
  'has a playlist for every possible mood and activity',
  'will defend certain "bad" movies to the death',
  'still uses physical notebooks in a digital age',
  'overthinks restaurant orders, always slightly regrets the choice',
  'has a mental map of where every good coffee shop is',
];

// ---- Unpopular opinions pool ----
const UNPOPULAR_OPINIONS = [
  'mornings are actually the best part of the day',
  'most sequels are better than originals',
  'small talk is underrated and actually meaningful',
  'winter is the superior season',
  'voicemails are better than texts for real conversations',
  'being bored is important and we should do it more',
  'most productivity advice makes people less productive',
  'nostalgia is often better than the actual thing',
  'some things should stay analog forever',
  'overthinking is sometimes just thorough thinking',
  'not every hobby needs to be monetized',
  'silence in conversations is comfortable, not awkward',
  'some "bad" habits are actually fine',
  'being early is as rude as being late',
];

// ---- Helper functions ----
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function maybe<T>(value: T, probability: number = 0.7): T | undefined {
  return Math.random() < probability ? value : undefined;
}

// ---- Main generation function ----
export function generateBackstory(interests: string[]): AgentBackstory {
  // Collect relevant memories based on interests
  const relevantMemories: string[] = [];
  for (const interest of interests) {
    const key = Object.keys(INTEREST_MEMORIES).find(
      (k) => interest.toLowerCase().includes(k) || k.includes(interest.toLowerCase())
    );
    if (key && INTEREST_MEMORIES[key]) {
      relevantMemories.push(...pickRandom(INTEREST_MEMORIES[key], 1));
    }
  }

  // Add generic memories if we don't have enough
  const neededGeneric = Math.max(0, 3 - relevantMemories.length);
  const genericPicks = pickRandom(GENERIC_MEMORIES, neededGeneric);
  const memories = [...new Set([...relevantMemories, ...genericPicks])].slice(0, 4);

  return {
    family: {
      siblings: maybe(pickRandom(SIBLINGS, 1)[0], 0.6),
      parents: maybe(pickRandom(PARENTS, 1)[0], 0.5),
      pets: maybe(pickRandom(PETS, 1)[0], 0.5),
    },
    memories,
    quirks: pickRandom(QUIRKS, 2 + Math.floor(Math.random() * 2)),
    unpopular_opinions: pickRandom(UNPOPULAR_OPINIONS, 1 + Math.floor(Math.random() * 2)),
  };
}
