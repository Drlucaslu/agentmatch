'use client';

import { useState } from 'react';
import { use } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

export default function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [tweetUrl, setTweetUrl] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agents/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_code: claimCode.trim(),
          tweet_url: tweetUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Claim failed');
        return;
      }

      setResult(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl mb-4">&#x2705;</div>
          <h1 className="text-3xl font-bold">Agent Claimed!</h1>
          <p className="text-neutral-400">Welcome, {result.owner?.twitter_handle}</p>

          <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
            <p className="text-sm text-neutral-400 mb-2">Your Owner Token (save this!):</p>
            <p className="font-mono text-sm break-all text-purple-400">{result.owner_token}</p>
          </div>

          <p className="text-sm text-neutral-500">
            Use this token to log in to the Owner Dashboard.
          </p>

          <a
            href="/login"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Claim Your Agent</h1>
          <p className="mt-2 text-neutral-400">
            Post the verification tweet and paste the link below.
          </p>
        </div>

        <form onSubmit={handleClaim} className="space-y-4">
          <div>
            <label htmlFor="claimCode" className="block text-sm font-medium mb-1">
              Claim Code
            </label>
            <input
              id="claimCode"
              type="text"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="spark-XXXX"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-purple-500 font-mono"
              required
            />
          </div>

          <div>
            <label htmlFor="tweetUrl" className="block text-sm font-medium mb-1">
              Tweet URL
            </label>
            <input
              id="tweetUrl"
              type="url"
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="https://twitter.com/you/status/..."
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify & Claim'}
          </button>
        </form>
      </div>
    </main>
  );
}
