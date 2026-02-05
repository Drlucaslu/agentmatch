import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { verifyTweet, fetchTwitterProfile } from '../services/twitter';
import { generateAgentProfile } from '../services/profileGen';

const router = Router();

const claimSchema = z.object({
  claim_code: z.string().regex(/^spark-[A-Z0-9]{4}$/),
  tweet_url: z.string().url(),
});

// ---- POST /agents/claim ----
router.post('/claim', async (req: Request, res: Response) => {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    });
  }

  const { claim_code, tweet_url } = parsed.data;

  // Find agent by claim_code
  const agent = await prisma.agent.findUnique({ where: { claimCode: claim_code } });
  if (!agent) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Invalid claim code' });
  }

  if (agent.claimStatus !== 'PENDING') {
    return res.status(400).json({ error: true, code: 'ALREADY_CLAIMED', message: 'This agent has already been claimed' });
  }

  // Verify tweet
  const verification = await verifyTweet(tweet_url, claim_code);
  if (!verification.isValid) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: verification.errorMessage || 'Tweet verification failed',
    });
  }

  // Check twitter handle not already bound
  if (verification.twitterHandle) {
    const existing = await prisma.agent.findUnique({ where: { twitterHandle: verification.twitterHandle } });
    if (existing && existing.id !== agent.id) {
      return res.status(400).json({
        error: true,
        code: 'ALREADY_CLAIMED',
        message: 'This Twitter account is already bound to another agent',
      });
    }
  }

  // Generate owner token
  const ownerToken = `am_ot_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

  // Update agent
  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      claimStatus: 'CLAIMED',
      twitterHandle: verification.twitterHandle || null,
      twitterId: verification.twitterUserId || null,
      verificationTweetUrl: tweet_url,
      ownerToken,
    },
  });

  // Async: fetch Twitter profile and generate Agent parameters
  if (verification.twitterHandle) {
    fetchTwitterProfile(verification.twitterHandle).then(async (profile) => {
      if (!profile) return;

      const generated = generateAgentProfile(profile);

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          avatar: generated.avatar,
          interests: generated.interests,
          initialStatus: generated.initialStatus,
          socialEnergy: generated.socialEnergy as any,
          conversationStyle: generated.conversationStyle as any,
          interestVector: generated.interestVector as any,
          gender: generated.gender,
          genderConfidence: generated.genderConfidence,
          twitterAvatar: profile.avatar,
          twitterBio: profile.bio,
          twitterFollowers: profile.followers,
          twitterFollowing: profile.following,
        },
      });
    }).catch((err) => {
      console.error('Failed to fetch Twitter profile:', err);
    });
  }

  return res.json({
    success: true,
    agent_id: agent.id,
    owner_token: ownerToken,
    owner: {
      twitter_handle: verification.twitterHandle ? `@${verification.twitterHandle}` : null,
      twitter_name: verification.twitterName || null,
      twitter_avatar: null, // Will be filled by async profile fetch
    },
    message: 'Agent claimed! Save your owner_token to access the Dashboard.',
  });
});

// ---- POST /agents/dev-claim (skip Twitter verification) ----
const devClaimSchema = z.object({
  api_key: z.string(),
});

router.post('/dev-claim', async (req: Request, res: Response) => {
  const parsed = devClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: true, code: 'VALIDATION_ERROR', message: 'Missing api_key' });
  }

  const agent = await prisma.agent.findUnique({ where: { apiKey: parsed.data.api_key } });
  if (!agent) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Agent not found' });
  }

  if (agent.claimStatus === 'CLAIMED') {
    return res.status(400).json({ error: true, code: 'ALREADY_CLAIMED', message: 'Already claimed' });
  }

  const ownerToken = `am_ot_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const devHandle = `dev_${agent.name.toLowerCase()}`;

  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      claimStatus: 'CLAIMED',
      ownerToken,
      twitterHandle: devHandle,
    },
  });

  return res.json({
    success: true,
    agent_id: agent.id,
    owner_token: ownerToken,
    message: 'Agent claimed without Twitter verification.',
  });
});

export default router;
