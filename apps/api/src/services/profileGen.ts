import { TwitterProfile } from './twitter';
import { ConversationStyle, SocialEnergy, InterestVector, AgentBackstory } from '../types';
import { inferGender } from './gender';
import { generateBackstory } from './backstoryGen';

// Interest keyword mapping
const INTEREST_MAP: Record<string, string> = {
  write: 'writing', writer: 'writing', author: 'writing', poet: 'poetry', poetry: 'poetry',
  music: 'music', jazz: 'jazz', blues: 'blues', rock: 'rock', hiphop: 'hip-hop', classical: 'classical',
  art: 'art', artist: 'art', paint: 'painting', design: 'design', designer: 'design',
  tech: 'technology', dev: 'development', developer: 'development', code: 'coding', coder: 'coding',
  engineer: 'engineering', programming: 'programming', ai: 'ai', ml: 'machine-learning',
  crypto: 'crypto', web3: 'web3', blockchain: 'blockchain', defi: 'defi', nft: 'nft',
  film: 'film', movie: 'movies', cinema: 'cinema', director: 'filmmaking',
  photo: 'photography', photographer: 'photography',
  cook: 'cooking', chef: 'cooking', food: 'food', foodie: 'food',
  coffee: 'coffee', tea: 'tea', wine: 'wine',
  travel: 'travel', traveler: 'travel', explorer: 'exploration',
  read: 'reading', reader: 'reading', book: 'books', literature: 'literature',
  philosophy: 'philosophy', existential: 'philosophy',
  science: 'science', physics: 'physics', math: 'mathematics',
  game: 'gaming', gamer: 'gaming', esport: 'esports',
  fitness: 'fitness', gym: 'fitness', yoga: 'yoga', run: 'running', runner: 'running',
  cat: 'cats', dog: 'dogs', pet: 'pets',
  startup: 'startups', founder: 'entrepreneurship', entrepreneur: 'entrepreneurship',
  invest: 'investing', investor: 'investing', finance: 'finance',
};

function extractInterests(bio: string): string[] {
  const interests = new Set<string>();
  const lowerBio = bio.toLowerCase();

  // Split by common separators
  const segments = lowerBio.split(/[|·,;/•]+/).map((s) => s.trim());

  for (const segment of segments) {
    const words = segment.split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      if (INTEREST_MAP[cleaned]) {
        interests.add(INTEREST_MAP[cleaned]);
      }
    }
  }

  return [...interests].slice(0, 10);
}

function calculateInitialStatus(followers: number): number {
  if (followers >= 100000) return 85 + Math.min(10, Math.floor(followers / 100000));
  if (followers >= 10000) return 70 + Math.floor((followers - 10000) / 6000);
  if (followers >= 1000) return 55 + Math.floor((followers - 1000) / 600);
  if (followers >= 100) return 40 + Math.floor((followers - 100) / 60);
  return 30 + Math.floor(followers / 10);
}

export interface GeneratedProfile {
  avatar: string;
  interests: string[];
  initialStatus: number;
  socialEnergy: SocialEnergy;
  conversationStyle: ConversationStyle;
  interestVector: InterestVector;
  backstory: AgentBackstory;
  gender: string | null;
  genderConfidence: number;
}

export function generateAgentProfile(profile: TwitterProfile): GeneratedProfile {
  const interests = extractInterests(profile.bio);
  const initialStatus = calculateInitialStatus(profile.followers);
  const { gender, confidence } = inferGender(profile);

  const socialEnergy: SocialEnergy = {
    max_energy: 100,
    current_energy: 100,
    recharge_rate: 5,
    cost_per_conversation: 10,
  };

  const conversationStyle: ConversationStyle = {
    formality: 0.4,
    depth_preference: 0.5,
    humor_level: 0.4,
    message_length: 'medium',
    emoji_usage: 0.3,
  };

  const interestVector: InterestVector = {
    tags: interests,
    primary_topics: interests.slice(0, 3),
    conversation_starters: [],
  };

  // Generate virtual backstory based on interests
  const backstory = generateBackstory(interests);

  return {
    avatar: profile.avatar,
    interests,
    initialStatus,
    socialEnergy,
    conversationStyle,
    interestVector,
    backstory,
    gender: confidence >= 0.6 ? gender : null,
    genderConfidence: confidence,
  };
}
