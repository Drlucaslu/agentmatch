import { TwitterProfile } from './twitter';

interface GenderResult {
  gender: string | null;
  confidence: number;
}

// Pronoun detection (highest priority)
function detectPronouns(bio: string): GenderResult | null {
  const lower = bio.toLowerCase();

  if (/\b(he|him|his)\b/.test(lower) && !/\b(she|her|hers)\b/.test(lower)) {
    return { gender: 'male', confidence: 0.9 };
  }
  if (/\b(she|her|hers)\b/.test(lower) && !/\b(he|him|his)\b/.test(lower)) {
    return { gender: 'female', confidence: 0.9 };
  }
  if (/\b(they|them|their)\b/.test(lower)) {
    return { gender: 'non_binary', confidence: 0.8 };
  }

  return null;
}

// Bio keyword detection
function detectKeywords(bio: string): GenderResult | null {
  const lower = bio.toLowerCase();

  const maleKeywords = ['dad', 'father', 'husband', 'brother', 'son', 'boyfriend', 'papa', '爸', '父', '兄', '哥'];
  const femaleKeywords = ['mom', 'mother', 'wife', 'sister', 'daughter', 'girlfriend', 'mama', '妈', '母', '姐', '妹'];

  const maleScore = maleKeywords.filter((k) => lower.includes(k)).length;
  const femaleScore = femaleKeywords.filter((k) => lower.includes(k)).length;

  if (maleScore > femaleScore && maleScore > 0) return { gender: 'male', confidence: 0.7 };
  if (femaleScore > maleScore && femaleScore > 0) return { gender: 'female', confidence: 0.7 };

  return null;
}

// Chinese pronoun detection
function detectChinesePronouns(bio: string): GenderResult | null {
  if (bio.includes('他') && !bio.includes('她')) return { gender: 'male', confidence: 0.6 };
  if (bio.includes('她') && !bio.includes('他')) return { gender: 'female', confidence: 0.6 };
  return null;
}

export function inferGender(profile: TwitterProfile): GenderResult {
  // Layer 1: Pronouns
  const pronounResult = detectPronouns(profile.bio);
  if (pronounResult) return pronounResult;

  // Layer 2: Bio keywords
  const keywordResult = detectKeywords(profile.bio);
  if (keywordResult) return keywordResult;

  // Layer 3: Chinese pronouns
  const chineseResult = detectChinesePronouns(profile.bio);
  if (chineseResult) return chineseResult;

  // Default: unknown
  return { gender: null, confidence: 0 };
}
