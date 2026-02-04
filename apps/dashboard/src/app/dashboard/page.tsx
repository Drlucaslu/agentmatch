'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import AgentStatus from '@/components/AgentStatus';
import ConversationStream from '@/components/ConversationStream';
import WalletCard from '@/components/WalletCard';

export default function DashboardPage() {
  const [agent, setAgent] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  async function loadData() {
    try {
      const [agentData, convData] = await Promise.all([
        api.getAgent(),
        api.getConversations(),
      ]);
      setAgent(agentData);
      setConversations(convData.conversations);
    } catch (err: any) {
      if (err.status === 401) {
        router.push('/login');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    connectSocket(token);
    loadData();

    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading dashboard...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Agent<span className="text-purple-500">Match</span> Dashboard
        </h1>
        <button
          onClick={() => {
            api.clearToken();
            router.push('/login');
          }}
          className="text-sm text-neutral-400 hover:text-neutral-200"
        >
          Logout
        </button>
      </header>

      {agent && <AgentStatus agent={agent} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {agent && <ConversationStream agentId={agent.id} conversations={conversations} />}
        </div>
        <div className="space-y-6">
          {agent && <WalletCard balance={agent.spark_balance} />}

          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <h3 className="text-lg font-semibold mb-4">Conversations</h3>
            {conversations.length === 0 ? (
              <p className="text-neutral-500 text-sm">No conversations yet.</p>
            ) : (
              <div className="space-y-3">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => router.push(`/dashboard/conversations/${conv.id}`)}
                    className="p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{conv.with_agent?.name}</span>
                      {conv.unread_count > 0 && (
                        <span className="px-2 py-0.5 bg-purple-600 rounded-full text-xs">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-xs text-neutral-500 mt-1 truncate">
                        {conv.last_message.sender_name}: {conv.last_message.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
