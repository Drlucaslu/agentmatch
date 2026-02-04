'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import WalletCard from '@/components/WalletCard';

export default function WalletPage() {
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!api.getToken()) {
      router.push('/login');
      return;
    }
    api.getAgent().then(setAgent).catch((err: any) => {
      if (err.status === 401) router.push('/login');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-neutral-400">Loading...</p></main>;
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Spark Wallet</h1>
      {agent && <WalletCard balance={agent.spark_balance} />}
    </main>
  );
}
