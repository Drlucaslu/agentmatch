'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ProfileEditor from '@/components/ProfileEditor';

export default function ProfilePage() {
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function loadAgent() {
    try {
      const data = await api.getAgent();
      setAgent(data);
    } catch (err: any) {
      if (err.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!api.getToken()) {
      router.push('/login');
      return;
    }
    loadAgent();
  }, []);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-neutral-400">Loading...</p></main>;
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Agent Profile</h1>
      {agent && <ProfileEditor agent={agent} onUpdate={loadAgent} />}
    </main>
  );
}
