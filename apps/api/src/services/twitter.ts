export interface TweetVerification {
  isValid: boolean;
  twitterUserId: string;
  twitterHandle: string;
  twitterName: string;
  tweetContent: string;
  errorMessage?: string;
}

export interface TwitterProfile {
  handle: string;
  name: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  tweetCount: number;
  createdAt: string;
}

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

function extractTweetId(tweetUrl: string): string | null {
  const match = tweetUrl.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

// ---- Plan A: Twitter API v2 ----
async function verifyTweetViaApi(tweetUrl: string, expectedCode: string): Promise<TweetVerification> {
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    return { isValid: false, twitterUserId: '', twitterHandle: '', twitterName: '', tweetContent: '', errorMessage: 'Invalid tweet URL format' };
  }

  const url = `https://api.twitter.com/2/tweets/${tweetId}?expansions=author_id&tweet.fields=text&user.fields=username,name,profile_image_url`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
  });

  if (!resp.ok) {
    return { isValid: false, twitterUserId: '', twitterHandle: '', twitterName: '', tweetContent: '', errorMessage: `Twitter API error: ${resp.status}` };
  }

  const data: any = await resp.json();
  const tweetText = data.data?.text || '';
  const author = data.includes?.users?.[0];

  if (!tweetText.includes(expectedCode)) {
    return { isValid: false, twitterUserId: author?.id || '', twitterHandle: author?.username || '', twitterName: author?.name || '', tweetContent: tweetText, errorMessage: 'Tweet does not contain the claim code' };
  }

  return {
    isValid: true,
    twitterUserId: author?.id || '',
    twitterHandle: author?.username || '',
    twitterName: author?.name || '',
    tweetContent: tweetText,
  };
}

// ---- Plan B: oEmbed fallback ----
async function verifyTweetViaOembed(tweetUrl: string, expectedCode: string): Promise<TweetVerification> {
  const resp = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}`);

  if (!resp.ok) {
    return { isValid: false, twitterUserId: '', twitterHandle: '', twitterName: '', tweetContent: '', errorMessage: 'oEmbed request failed' };
  }

  const data: any = await resp.json();
  const html: string = data.html || '';
  const authorName: string = data.author_name || '';
  const authorUrl: string = data.author_url || '';

  // Extract handle from author_url
  const handleMatch = authorUrl.match(/twitter\.com\/(\w+)/i) || authorUrl.match(/x\.com\/(\w+)/i);
  const handle = handleMatch ? handleMatch[1] : '';

  // Check if HTML content includes the claim code
  if (!html.includes(expectedCode)) {
    return { isValid: false, twitterUserId: '', twitterHandle: handle, twitterName: authorName, tweetContent: html, errorMessage: 'Tweet does not contain the claim code' };
  }

  return {
    isValid: true,
    twitterUserId: '',
    twitterHandle: handle,
    twitterName: authorName,
    tweetContent: html,
  };
}

export async function verifyTweet(tweetUrl: string, expectedCode: string): Promise<TweetVerification> {
  if (TWITTER_BEARER_TOKEN) {
    return verifyTweetViaApi(tweetUrl, expectedCode);
  }
  return verifyTweetViaOembed(tweetUrl, expectedCode);
}

export async function fetchTwitterProfile(handle: string): Promise<TwitterProfile | null> {
  if (!TWITTER_BEARER_TOKEN) {
    // Return null if no API key - profile will use defaults
    return null;
  }

  const url = `https://api.twitter.com/2/users/by/username/${handle}?user.fields=profile_image_url,description,public_metrics,created_at`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
  });

  if (!resp.ok) return null;

  const data: any = await resp.json();
  const user = data.data;
  if (!user) return null;

  return {
    handle: user.username,
    name: user.name,
    avatar: user.profile_image_url?.replace('_normal', '_400x400') || '',
    bio: user.description || '',
    followers: user.public_metrics?.followers_count || 0,
    following: user.public_metrics?.following_count || 0,
    tweetCount: user.public_metrics?.tweet_count || 0,
    createdAt: user.created_at || '',
  };
}
